# [LAUNCH-05] Playback Polish — Loading UX, Retry, iOS Banner

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~3 days
**Status:** 📝 Ready
**Independent of:** LAUNCH-02, 03, 04 (no dependencies; can ship any time)
**Source:** Carried over from old BETA Plan Phase BETA-1; this story consolidates those items into one shippable unit.

---

## Story

- As a **first-time visitor clicking Play on a groove**
- I want to **see ONE loading indicator on the play button, not four sequential toasts**
- so that **my first impression is "this looks professional," not "this looks chatty and broken"**

And:

- As a **user on a flaky network**
- I want the platform to **retry a failed sample fetch once before giving up**
- so that **a single transient blip doesn't leave my bass silent for the entire session**

And:

- As an **iOS Safari user**
- I want to be **told upfront that mobile bass practice isn't fully supported yet**
- so that **I don't experience stuttering audio without explanation and walk away thinking the product is broken**

## Background / Context

The old BETA Plan's audit identified three P0 polish items that would make a paying user complain. These all live in the existing playback engine and were deferred from the BETA Plan's Phase 1. They still need to ship — and they ship cleanly as one bundled story since they're all in adjacent files.

From the BETA Plan ([docs/deployment/BETA_PLAN.md](../../../deployment/BETA_PLAN.md), now superseded by LAUNCH_PLAN.md):

> **1. The 4-toast loading flow looks janky**
> Current: User clicks Play → "Loading Sounds…" toast → "Ready!" toast → "Loading Bass Sounds…" toast → "Ready!" toast → audio finally plays.
> Better: Play button shows a loading spinner + "Loading…" text on the button itself. Single visual. No toasts. Errors still toast.

> **2. Sample preload waits for user interaction instead of starting on page load**
> Current: ScrollTriggerLoader waits for first user gesture (scroll/touch/click) before starting the sample download.
> Better: Start sample fetch on tutorial page mount. Keep AudioContext creation deferred to play click. User gets a ~2-3 second head start.

> **3. No retry on Supabase fetch failure**
> Current: If a single sample fetch fails (CORS, slow network, blip), `ToneBufferLoader` logs error and moves on. That instrument is silent for the session.
> Better: Wrap sample fetches in the existing CircuitBreaker (already imported in the file but unused). One retry with 500ms backoff. After two failures, surface a "Bass samples failed to load — try refreshing" toast.

> **4. iOS Safari is broken; users aren't told**
> Reality: No AudioWorklet support on iOS Safari; Web Worker timing was disabled because it conflicted; audio will stutter on scroll, samples may not load reliably.
> Fix for launch: Detect iOS Safari + show a one-time banner: "Best experience on desktop. Mobile bass practice coming soon."

## Solution / Scope

Four discrete fixes, each scoped to a known file and ~30min to a few hours of work.

### Fix 1 — Single play-button loading state (replaces 4-toast flow)

- **Remove** the 4 sequential toast calls in `usePlaybackControl.ts` (lines 327–382 per BETA Plan reference)
- **Replace** with a button-local loading state: spinner + "Loading…" text on the play button itself
- **Keep** error toasts — if loading actually fails, that's worth a toast
- **One visual state at a time:** "Loading…" → "Ready" (button click-able) → playing. No intermediate informational toasts.

### Fix 2 — Preload samples on tutorial page mount

- **`ScrollTriggerLoader.tsx`** — currently waits for first user gesture before starting sample fetch
- **Change:** start the fetch on tutorial page mount (component mounts → fetch begins)
- **Keep deferred:** AudioContext creation (still needs a user gesture per browser policy)
- **Net effect:** sample bytes are already downloading while the user reads the page; by the time they click Play, samples are warm

### Fix 3 — Retry on Supabase fetch failure

- **`ToneBufferLoader.ts`** already imports `CircuitBreaker` but doesn't use it
- **Wrap** sample fetches in the existing CircuitBreaker
- **Retry policy:** 1 retry with 500ms backoff
- **After 2 failures:** surface a toast: *"Some samples failed to load. Try refreshing — usually fixes it."*
- **Don't silently fall back** to a missing instrument — the user needs to know something's off

### Fix 4 — iOS Safari banner

- **Detect:** `navigator.userAgent` includes `Mobile/.*Safari` AND `Mac OS X.*iPhone|iPad|iPod`
- **Show banner:** one-time per session (localStorage flag), dismissable
- **Copy:** *"Best experience on desktop Chrome/Firefox. Mobile bass practice coming soon — we'll email you when it's ready."*
- **Optional:** include a "Notify me" link to the whitelist page (LAUNCH-01) for mobile-only users to opt in for the mobile launch later
- **Don't block** — iOS users can still use the platform, just with the warning

## Requirements

### Functional

- [ ] Clicking Play shows a single loading state on the button, not 4 toasts
- [ ] Sample fetch begins on tutorial page mount, not first user gesture
- [ ] AudioContext creation still deferred to play click (browser policy compliance)
- [ ] Failed sample fetches retry once with 500ms backoff
- [ ] Two consecutive failures surface a user-friendly toast (not silent failure)
- [ ] iOS Safari users see a banner on first session; dismissible; respects dismissal for the session

### Non-functional

- [ ] No regression in time-to-first-play on Chrome/Firefox desktop (the happy path)
- [ ] Sample preload doesn't block the page render — must be async
- [ ] CircuitBreaker integration doesn't break the existing error logging
- [ ] iOS detection is conservative (only true iOS Safari, not Chrome on iOS) — false positives on desktop browsers are worse than missing some edge iOS users

## Acceptance Criteria

- [ ] **Play button UX:** click Play on a cold page load → button shows "Loading…" with spinner → button becomes "Pause" when audio starts. No toast popups during the happy path.
- [ ] **Preload:** open a tutorial page, watch Network tab → sample fetches begin within ~500ms of page mount, before any click
- [ ] **Retry:** kill Supabase access via DevTools network blocking → first fetch fails, second fetch retries automatically, second failure surfaces a toast
- [ ] **iOS banner:** open in iOS Safari simulator (or real device) → banner appears at top, dismissable, doesn't reappear in same session
- [ ] **iOS detection:** opening in desktop Chrome/Firefox/Safari does NOT show the banner
- [ ] **No regression:** Chrome desktop happy-path play time is same or faster than before
- [ ] **Manual QA:** test all four fixes on staging in Chrome, Firefox, Safari desktop, and iOS Safari (real device)
- [ ] **Error toasts still work:** if a sample genuinely can't load after retry, user sees the message

## Out of Scope (deferred)

- ❌ **Real iOS Safari audio support** — multi-week project, deferred indefinitely; banner is the launch fix
- ❌ **Fixing the 6 "is samples ready?" sources of truth** — pre-existing fragility, separate cleanup story
- ❌ **Per-exercise bass buffer caching across exercise switches** — needs investigation; not blocking launch
- ❌ **Web Audio API improvements / Tone.Transport refactors** — out of scope
- ❌ **Sentry verification** — separate ops checklist item, handled in LAUNCH-12
- ❌ **Documenting 35 undocumented env vars** — pure polish, defer
- ❌ **Segment-level `error.tsx`** — defer

## Implementation Notes

### Files to touch

**Fix 1 — Loading UX:**
- **EDIT:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/hooks/usePlaybackControl.ts` (lines 327–382 per BETA Plan)
- **EDIT:** the play button component (find via [GlobalControls/](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/))

**Fix 2 — Preload:**
- **EDIT:** `apps/frontend/src/domains/playback/components/ScrollTriggerLoader.tsx`

**Fix 3 — Retry:**
- **EDIT:** `apps/frontend/src/domains/playback/modules/storage/loaders/ToneBufferLoader.ts`
- **REFERENCE:** `apps/frontend/src/domains/playback/patterns/CircuitBreaker.ts` (already exists, just unused)

**Fix 4 — iOS banner:**
- **NEW:** `apps/frontend/src/shared/components/IOSSafariBanner.tsx`
- **NEW:** `apps/frontend/src/shared/hooks/useIOSDetection.ts`
- **EDIT:** root layout to mount the banner

### Anti-patterns to avoid

- **Don't add MORE toasts.** The whole point is fewer informational toasts. Errors only.
- **Don't break the happy path while fixing edge cases.** Chrome desktop time-to-first-play must not regress.
- **Don't try to fix iOS audio.** The banner IS the fix. Real iOS support is multi-week and not launch-critical.
- **Don't retry forever.** One retry only. Surface the failure cleanly after that.
- **Don't put the banner in the way.** Top of viewport, dismissable, not a full-screen overlay.

---

## Notes

- This is the lowest-risk, highest-polish-per-hour story in the launch backlog. Good first-week work while LAUNCH-02 is being built.
- Splitting the four fixes into separate PRs is fine (each touches a different file). One story to track them; multiple commits/PRs to ship them.
- The iOS banner copy can include the whitelist page link — turns a "your platform is broken" moment into a signup for mobile-launch notifications.
