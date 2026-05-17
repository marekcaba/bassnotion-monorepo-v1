# BETA Launch Plan — BassNotion

> **Purpose:** Plan what we ship in BETA, what we polish first, what we defer to post-launch.
>
> **Created:** 2026-05-17 (after the grand audit + playback engine deep-dive)
>
> **Status:** Pre-decision — needs your input on scope before we start executing.

---

## What we're shipping (the BETA product, in one paragraph)

BassNotion BETA is a **paid tutorial library for bass players** with three sellable products:

1. **Economy Picking module** — 22 tutorials drip-fed over 30 days from purchase date (~1 tutorial every 1.4 days).
2. **Play Along pack** — two themed packs (12 grooves each). Each groove has layers (intro → practice exercises → unlockable "special groove"). The unlock mechanics (exercises turn green when played enough, special groove unlocks when all green) **already exist in the UI** — backend wiring will be verified, not built.
3. **Bundle** — both products at a discount.

The CORE value is the playback experience: a tutorial page with synced YouTube video, 3D fretboard, multitrack audio stems (bass + drums + chords + accompaniment), metronome, and beat-timing analysis. This is genuinely production-quality on desktop Chrome/Firefox.

What we are NOT shipping in BETA:

- The Groove Finder assessment (no video segments seeded)
- The personalized journey system (UI not integrated)
- Patterns domain (no UI)
- Social domain (no UI)
- Studio / Gigs / Backstage rooms (placeholder pages, already hidden from nav)
- iOS Safari (architectural limitation — no AudioWorklet; banner users to use desktop)

---

## What works today (verified, not guessed)

### Playback engine (the core value)

| Sub-system                                         | Status              | How we verified                                                                                                                                                                                |
| -------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single Tone.Transport clock drives all instruments | ✅ Works            | Read `PlaybackEngine.start()` — `transportStartTime` is captured once, shared by all regions                                                                                                   |
| Sample preload BEFORE play button is clickable     | ✅ Works            | `ScrollTriggerLoader.tsx` kicks off preload on first user interaction; `usePlaybackControl` awaits `waitForSamplesReady()` + `waitForBassBuffersReady()` before calling `start()`              |
| Loading state visible to user                      | ⚠️ Works but chatty | Shows up to 4 toasts per play click ("Loading Sounds…" → "Ready!" → "Loading Bass Sounds…" → "Ready!")                                                                                         |
| Fretboard sync to audio                            | ✅ Works            | `WidgetSyncService.startPositionUpdates()` polls `window.Tone.Transport.seconds` at fixed interval and emits `POSITION` events that `FretboardVisualizerCard` subscribes to via `SyncedWidget` |
| Metronome stays locked to tempo                    | ✅ Works            | Driven by same Tone.Transport as other instruments; tempo changes debounced 50ms                                                                                                               |
| Tempo changes mid-playback                         | ✅ Works            | Reschedules via `regionScheduler` after 50ms debounce. Slight 50ms lag on rapid changes.                                                                                                       |
| AudioContext resume on user gesture                | ✅ Works            | `AudioContextManager.resume()` with 5s timeout, event-driven state changes (BUG #4 fix)                                                                                                        |
| Stripe checkout flow                               | ✅ Works            | End-to-end tested in Phase 6.2; test mode on staging                                                                                                                                           |

### Auth & user

| Sub-system                                   | Status   |
| -------------------------------------------- | -------- |
| Signup / login (email + Google OAuth)        | ✅ Works |
| Password reset, idle timeout, account delete | ✅ Works |
| Session management (Supabase)                | ✅ Works |
| Profile editing, avatar upload               | ✅ Works |

### Content (what's actually in the DB)

| Type                                   | Count                                             | Status                                 |
| -------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Mock tutorials (Billie Jean, etc.)     | ~10                                               | Seeded, with YouTube URLs              |
| Test exercises with multitrack audio   | ~10                                               | Seeded, with bass/drum/chord/acc stems |
| Sample audio files in Supabase storage | Many                                              | Stored, loaded via `ToneBufferLoader`  |
| Stripe products (default)              | 3 courses ($39/$49/$99) + 1 subscription ($14/mo) | Seeded by `StripeService.onModuleInit` |

---

## What's WEAK in the current playback UX

These are the issues that would make a paying BETA user complain.

### 🔴 P0 — Must fix before paid users touch this

**1. The 4-toast loading flow looks janky** (~30 min to fix)

- **Current:** User clicks Play → "Loading Sounds…" toast → "Ready!" toast → "Loading Bass Sounds…" toast → "Ready!" toast → audio finally plays.
- **Better:** Play button shows a loading spinner + "Loading…" text on the button itself. Single visual. No toasts. Errors still toast.
- **File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/hooks/usePlaybackControl.ts` (lines 327–382) + the play button component.

**2. Sample preload waits for user interaction instead of starting on page load** (~30 min to fix)

- **Current:** `ScrollTriggerLoader.tsx` waits for first user gesture (scroll/touch/click) before starting the sample download. The comment says "browser gesture required for AudioContext" — but **sample fetching doesn't need a gesture**, only AudioContext creation does.
- **Better:** Start sample fetch on tutorial page mount. Keep AudioContext creation deferred to play click. User gets a ~2-3 second head start.
- **File:** `apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx`

**3. No retry on Supabase fetch failure** (~1 hour to fix)

- **Current:** If a single sample fetch fails (CORS, slow network, blip), `ToneBufferLoader` logs error and moves on. That instrument is silent for the session.
- **Better:** Wrap sample fetches in the existing `CircuitBreaker` (already imported in the file but unused). One retry with 500ms backoff. After two failures, surface a "Bass samples failed to load — try refreshing" toast.
- **File:** `apps/frontend/src/domains/playback/modules/storage/loaders/ToneBufferLoader.ts`

### 🟡 P1 — Should fix; doesn't block ship but feels rough

**4. Six different "is samples ready?" sources of truth** (~2-3 hours)

- `__samplesReady`, `__essentialSamplesLoaded`, `window.__bassnotion_samplesReady`, `__bassnotion_essentialSamplesLoaded`, `WindowRegistry.getSamplesReady()`, plus the events `samplesReady` and `essentialSamplesLoaded`. Pre-existing migration debt; some marked `@deprecated`.
- **Risk:** Code reads "if (x || y || z)" defensively everywhere. Subtle bugs lurk in edge cases. Not actively broken but fragile.
- **Fix:** Pick one (recommend `WindowRegistry.getSamplesReady()`), update all callers, delete the rest. Mechanical work.

**5. Per-exercise bass buffer reloading** (~1-2 hours to verify, fix variable)

- **Suspected issue:** When user switches exercises in the same tutorial, bass buffers may reload from network each time. `WindowRegistry.getBassBuffersReady(exerciseId)` is per-exercise. For a Play Along pack with 12 grooves, this could be 12 network round trips.
- **Action:** Verify this hypothesis by reading the buffer loader cache logic; if confirmed, add a tutorial-scoped cache so buffers stay warm during pack browsing.

**6. iOS Safari is broken; users aren't told** (~30 min to add banner)

- **Reality:** No AudioWorklet support on iOS Safari; Web Worker timing was disabled because it conflicted; audio will stutter on scroll, samples may not load reliably.
- **Fix for BETA:** Detect iOS Safari + show a one-time banner: "Best experience on desktop. Mobile bass practice coming soon." Don't try to actually fix iOS audio for BETA — multi-week project.

### 🟢 P2 — Polish post-launch

**7. Tone.Transport polling for position updates is `setInterval`-based** (not high priority)

- Works fine for visual feedback. Would be more elegant as event-driven from PlaybackEngine, but no user-facing impact.

**8. Sentry verification on next staging deploy**

- Wiring complete (Phase 6.2); confirm errors actually arrive at the Sentry dashboard once staging redeploys.

**9. Documenting 35 undocumented env vars** in `.env.example`

- All have hardcoded defaults; pure polish.

**10. Segment-level `error.tsx`** instead of just root

- Better graceful recovery; not blocking.

**11. ~6.7k legacy lint errors**

- Already deferred; no per-commit friction (hook relaxed in commit `757f6bb`).

---

## What's MISSING for the 3 BETA products (billing/drip layer)

The grand audit found that the billing system needs real work to sell these three products. Estimated 16 hours of focused backend dev.

### What works today (no changes needed)

✅ Stripe payment flow + webhooks
✅ `Purchase` tracking in DB
✅ `Subscription` logic (unaffected)
✅ Frontend "green when practiced" UI (already exists)
✅ Exercise → Tutorial linking via foreign key

### What needs to be built

| Item                                                                                                               | Type                    | Estimate      |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------- |
| Extend `CourseType` enum: add `economy-picking`, `play-along-pack-1`, `play-along-pack-2`, `bundle`                | Backend constant        | 30 min        |
| Add `product_id` (or `product_name`) nullable column to `tutorials` table                                          | Migration               | 30 min        |
| Create `tutorial_releases` table — tracks (user_id, purchase_id, tutorial_id, scheduled_at) for drip feed          | Migration + service     | 2 hours       |
| Create `exercise_packs` table — groups exercises into purchasable packs                                            | Migration               | 30 min        |
| Create `exercise_progress` table — backend-track completion (drives frontend "green")                              | Migration + endpoint    | 2 hours       |
| Extend `Purchase` schema to support `course_types[]` array (or separate `purchase_entitlements` table) for bundles | Migration + webhook fix | 2 hours       |
| `DripFeedService` — calculates which tutorials are available for a user (time-based from purchase)                 | Backend service         | 3 hours       |
| Tutorial access guard — checks DripFeedService before returning tutorial content                                   | Backend middleware      | 1 hour        |
| `POST /exercises/:id/complete` endpoint                                                                            | Backend endpoint        | 2 hours       |
| Update Stripe webhook to grant bundle entitlements correctly                                                       | Backend fix             | 1 hour        |
| Tests for the new code                                                                                             | Backend tests           | 4 hours       |
| **TOTAL**                                                                                                          |                         | **~16 hours** |

### What you do in Stripe Dashboard (not code)

- Create 3 Stripe products: "Economy Picking", "Play Along Pack 1", "Play Along Pack 2", "Bundle"
- Set prices (one-time, not recurring)
- Optionally: configure dunning emails for failed payments

---

## What we should HIDE from BETA users

These features exist in code but aren't ready. Hide them so they don't confuse paying users.

| Feature                   | Where it lives                                          | Status                                       | Action                                                                    |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Groove Finder assessment  | `/assessment/v2` + assessment domain                    | Framework works, no video content seeded     | **Hide nav link** (route can stay accessible for testing)                 |
| Journey dashboard         | `/app/app/journey` (or wherever components are mounted) | Components exist but not wired into app home | **Hide** until BETA users have content to journey through                 |
| Patterns                  | Domain folder exists, no frontend pages                 | Pre-alpha                                    | **Already invisible** (no nav link)                                       |
| Social                    | Domain folder exists, no frontend pages                 | Pre-alpha                                    | **Already invisible**                                                     |
| Studio / Gigs / Backstage | `/app/studio`, `/app/gigs`, `/app/backstage`            | "Coming soon" placeholders                   | **Already hidden** (commit `ae3474d` marked them `disabled: true` in nav) |

---

## Landing page positioning

Current pitch on `/`: _"Most platforms give you more. Bassicology does the opposite. Personalized practice sessions tailored to your gaps."_

The personalization promise isn't deliverable in BETA. Two options:

### Option A — Re-pitch as "tutorial library + play-along practice"

- "Practice bass with synced video, multitrack audio stems, and a 3D fretboard"
- Lead with the technical strength (the playback experience IS production-quality)
- Drop "assess your gaps" copy
- 1-2 hours of copy + design work

### Option B — Keep the pitch, add "Coming Q3 2026" badges to the unbuilt features

- Less honest in spirit, but doesn't require recommitting
- Risk: BETA users get sold on a promise they can't experience

**Recommended: A.** Honest positioning, sets correct expectations, doesn't poison your launch narrative.

---

## Implementation plan — what we actually do, in what order

Each phase builds on the previous. Estimated total: **4-6 days** of focused work.

### Phase BETA-1: Playback polish (1 day)

**Goal:** Make the play experience feel professional, not chatty/janky.

- [ ] P0-1: Replace 4-toast flow with single play-button loading state (~30 min)
- [ ] P0-2: Start sample preload on tutorial page mount, not first interaction (~30 min)
- [ ] P0-3: Add 1 retry with backoff to Supabase fetches via existing CircuitBreaker (~1 hour)
- [ ] P1-6: Add iOS Safari banner (~30 min)
- [ ] Manual QA on Chrome + Firefox + Safari desktop

**Outcome:** Paying users get a smooth play experience. iOS users are warned.

### Phase BETA-2: Hide unfinished features + update positioning (~1/2 day)

**Goal:** What ships matches what's pitched.

- [ ] Hide assessment + journey from nav (similar to Studio/Gigs/Backstage)
- [ ] Update `/` landing page copy (Option A above)
- [ ] Remove or update `/pricing` page if it lists unbuilt features

**Outcome:** Landing page matches product reality.

### Phase BETA-3: Sellable products (2-3 days)

**Goal:** Stripe can sell the 3 SKUs and access is correctly granted.

Sub-phase 3a: Schema (~3 hours)

- [ ] Migrations for `tutorial_releases`, `exercise_packs`, `Purchase.course_types[]`
- [ ] Extend `CourseType` enum
- [ ] Add `product_id` column to tutorials

Sub-phase 3b: Drip feed (~5 hours)

- [ ] `DripFeedService` (calculate per-user tutorial availability)
- [ ] Tutorial access guard in controller
- [ ] Frontend: show "today's tutorial" or "next unlocks in X days"

Sub-phase 3c: Bundle + entitlements (~3 hours)

- [ ] Webhook update to grant multiple `course_types` on bundle purchase
- [ ] `GET /billing/access` returns correct entitlement set

Sub-phase 3d: Exercise progress (~3 hours)

- [ ] `exercise_progress` table + `POST /exercises/:id/complete` endpoint
- [ ] Frontend wires "green when played" UI to backend (or verify it's already backend-driven)

Sub-phase 3e: Tests (~4 hours)

- [ ] Backend tests for drip feed, bundle entitlements, completion tracking

**Outcome:** All 3 products can be purchased and access works correctly.

### Phase BETA-4: P1 polish (optional, 0-1 day)

**Goal:** Should-fix items if time permits.

- [ ] P1-4: Unify the 6 "samples ready" sources into one
- [ ] P1-5: Verify/fix bass buffer caching across exercise switches

### Phase BETA-5: Phase 8 — pre-launch checklist (~0.5 day)

**Goal:** Final go-LIVE hygiene.

- [ ] Write `ROLLBACK_RUNBOOK.md` (Vercel + Railway + Supabase rollback procedures)
- [ ] Run `pnpm audit --audit-level high` → 0 high/critical
- [ ] Verify CI is green on `develop` and `main`
- [ ] Manual QA walk-through on staging: signup → tutorial → audio → exercise → stripe checkout (test mode)
- [ ] Production env audit: Vercel + Railway env vars, Stripe webhook URL, Supabase site URL, DNS

**Outcome:** Ready to flip the switch.

---

## Decision matrix — what to do RIGHT NOW

You're picking between these paths. Each has a cost/benefit.

### Path X — Lean BETA (3-4 days)

Phase BETA-1 + BETA-2 + minimal BETA-3 (just sell ONE product first: Play Along pack since unlock UI exists).

- Polish the play experience (smooth UX)
- Hide unfinished features
- Sell 1 product
- Skip drip feed for now
- Ship invite-only

**Best for:** Get feedback fast, iterate. Not optimal if you want to monetize from day 1.

### Path Y — Full BETA (5-6 days)

All phases BETA-1 through BETA-5. All 3 products sellable. Drip feed working.

- Polish the play experience
- All 3 products live
- Hide unfinished features
- Ready for public BETA

**Best for:** Genuinely shippable to anyone you can market to.

### Path Z — Ship as-is, polish later (1 day)

Just Phase BETA-2 + BETA-5. Don't fix the 4-toast UX. Don't add retry. Hide unbuilt features. Ship.

- Accept the chatty UX
- Accept the no-retry fragility
- Invite-only, manage expectations directly
- Iterate after launch with real user feedback

**Best for:** Speed-to-market over polish. Risk: first-impression damage.

---

## What I recommend

**Path X** (Lean BETA, 3-4 days):

1. **Day 1:** Phase BETA-1 (playback polish). The single biggest delta in user experience.
2. **Day 2 morning:** Phase BETA-2 (hide unfinished features, fix landing copy).
3. **Day 2 afternoon + Day 3:** Implement ONE product (Play Along pack) end-to-end. Unlock mechanics already exist; just need Stripe SKU + webhook entitlement. Skip drip feed for now.
4. **Day 4:** Phase BETA-5 (rollback runbook, audits, QA). Ship invite-only.

Why:

- The 4-toast UX is the single thing that screams "demo" to a tester. Fixing it is high-leverage.
- Selling 1 product instead of 3 is a 3-4 day savings.
- Drip feed (Economy Picking) is the most complex piece — it deserves its own focused build after BETA reveals what users actually want.
- Invite-only means you can fix what breaks before scaling.

After BETA validates the play-along loop is what users actually want, then invest the 2-3 more days to add Economy Picking + drip feed + Bundle.

---

## Open questions for the user

1. **Which path (X / Y / Z) do you want?** Affects how I plan the next 1-6 days.
2. **For Path X / Y: which Stripe product is FIRST?** I recommend Play Along pack because the unlock mechanics already exist. Economy Picking requires the drip-feed system to be built first.
3. **iOS users — banner ("desktop only") or full block?** Banner is honest + accessible; block is cleaner UX but locks out potential users.
4. **Landing page copy rewrite — do you have copy you want, or should I propose new copy?**
5. **Pricing — do you have the actual prices for Economy Picking, Play Along packs, and Bundle?**

---

## Appendix — file-level references

For when we start executing, key files to touch:

### Playback polish (Phase BETA-1)

- `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/hooks/usePlaybackControl.ts` (lines 313–400) — play button handler
- `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/` — play button UI
- `apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx` — sample preload trigger
- `apps/frontend/src/domains/playback/modules/storage/loaders/ToneBufferLoader.ts` — sample fetcher (add retry)
- `apps/frontend/src/domains/playback/patterns/CircuitBreaker.ts` — existing CircuitBreaker to wrap fetches

### Hide unfinished features (Phase BETA-2)

- `apps/frontend/src/domains/platform/constants/navigation.ts` — nav config
- `apps/frontend/src/app/page.tsx` — landing page
- `apps/frontend/src/app/pricing/page.tsx` — pricing page

### Billing for 3 products (Phase BETA-3)

- `apps/backend/src/domains/billing/types/billing.types.ts` — CourseType enum
- `apps/backend/src/domains/billing/services/stripe.service.ts` — Stripe product registration
- `apps/backend/src/domains/billing/webhook.controller.ts` — purchase entitlement grant
- `apps/backend/src/domains/billing/billing.controller.ts` — checkout + access endpoints
- `apps/backend/src/domains/tutorials/` — tutorial access guard
- `supabase/migrations/` — new tables + columns

### Phase 8

- `docs/deployment/ROLLBACK_RUNBOOK.md` — to be created
- `docs/deployment/PRODUCTION_READINESS_PLAN.md` — update with BETA decisions
