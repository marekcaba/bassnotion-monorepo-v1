# Feature-Entitlement Model + "Lines & Fills" — Implementation Plan

**Status:** Proposed — VALIDATED (adversarial multi-agent audit, 2026-06-10). 6 blockers + 21 majors + 9 minors found and folded in below. Architecture holds; B2 (audio engine) was over-optimistic and is now de-risked.
**Author:** drafted with Claude, 2026-06-10
**Decisions locked (by product owner):**
1. Feature grants are **global per product/tier** ("Bass College unlocks Lines-and-Fills everywhere"), not per-content. **BUT** the storage signer still AND-checks per-groove content access (see §B5 — global feature grant ≠ permission to open a content-gated groove).
2. Bassline **data lives on the groove record** (`groove_library.stems` JSONB extended), not as bundled product content.
3. Build the **full feature-entitlement model first**, then Lines-and-Fills on top.
4. Premium stem files must be **genuinely access-controlled in storage**, not just hidden in the UI.
5. **Bass College (existing `accelerator` product) grants `linesAndFills`** for now. It already confers member-tier; so a College owner gets the 5 baseline levers PLUS linesAndFills; a plain $24 member gets the 5 levers but NOT linesAndFills.

> ## ⚠️ Validation findings — read before implementing
> The audit caught issues an implementer would otherwise hit. The big ones:
> - **B2 "seamless in-place bass swap" is NOT a `setKey` clone** — it's heavy worklet surgery (append-only `addBuffers`, read-head reset, the codebase already *removed* a glitchy re-register-at-seam). MUST prototype + ear-measure (audio-audit harness) before committing to "seamless". This is the highest-risk pillar.
> - **Accelerator-confers-membership** must be preserved — reuse the existing `hasMemberAccess()`, don't re-derive from `hasActiveSubscription` (a no-sub College owner would otherwise LOSE the 5 baseline levers).
> - **No stable membership UUID** — resolve membership by `type`/slug at runtime; never hardcode a UUID (differs per env).
> - **Feature-grant ≠ content-grant** — the bassline signer must AND-check `canAccessContent(groove)` too, or a College owner can fetch basslines from a different pack's gated groove.
> - **`bassVariants` is NOT a free pass-through** — `mapDbToGroove` drops unknown stem keys on read; the stem-URL Zod regex hardcodes the public bucket. Both need edits.
> - **Hidden surfaces**: /free funnel, anonymous users, `BILLING_DEV_MODE` mock, waitlist card, post-purchase product refresh, and the 6-arg `entitlement.service.spec` constructor all need explicit handling.

---

## 0. Why this exists (the gap)

The platform already has a **product-aware CONTENT entitlement system** (backend `EntitlementService`):
tiers `free | member | product`, real ownership from `purchases`/`subscriptions`, product bundles
(`product_contents`), accelerator time-drip. It gates videos, tutorials, grooves server-side.

What it does NOT have: a **product → FEATURE** mapping. The frontend `useEntitlement` hook collapses
everything into a `free | member` binary and **hardcodes** which of the 6 levers each tier gets
(`UNPAID_CAPS` / `ALL_LEVERS_UNCAPPED`). That hardcoded object is the thing we replace.

> Content entitlement answers "can you open this groove?"
> Feature entitlement answers "can you use Lines-and-Fills / Dynamic Loop / the full tempo dial?"
> The first exists and works. The second is hardcoded. This plan builds the second.

**Blast radius is small:** only TWO production components consume `useEntitlement`
(`GrooveCardBlockView.tsx`, `GrooveCardControls.tsx`). Everything else routes through them.

---

## TRACK A — Product-aware feature-entitlement model

### A1. Feature registry (contracts)
Define the canonical, stable set of gateable features. The 6 existing levers are the seed set; add `linesAndFills`.

- **New** `libs/contracts/src/types/features.ts`:
  ```ts
  export const FEATURE_KEYS = [
    'tempo', 'transpose', 'loopRange', 'deconstruction', 'dynamicLoop', 'linesAndFills',
  ] as const;
  export type FeatureKey = (typeof FEATURE_KEYS)[number];
  ```
- Extend `libs/contracts/src/types/billing.ts`:
  - `EntitlementTier` stays `free | member` for now BUT the response gains an **OPTIONAL** `grantedFeatures?: FeatureKey[]`
    (the union of features the user's owned products/tier grant). Caps are DERIVED from this set, not from tier.
    **OPTIONAL is load-bearing** — making it required breaks every existing fixture (`freeTierCappedResponse()`, `responseForMember()`, `MOCK_USER_ACCESS`).
  - **`LeverCaps` DOES change shape (contra the original plan):** add a 7th key `linesAndFills: LeverCap`. B6 reads `caps.linesAndFills`.
  - **CRITICAL — the key sets differ:** `LeverCaps` keys = `{tempo, mute, transpose, loopRange, deconstruction, dynamicLoop, linesAndFills}` (7). `FEATURE_KEYS` = `{tempo, transpose, loopRange, deconstruction, dynamicLoop, linesAndFills}` (6 — **no `mute`**). `mute` is a lever with NO feature key (never capped, by design). The derivation must map the 6 gateable levers 1:1 to FEATURE_KEYS and special-case `mute` as always-uncapped.
  - Update `ALL_LEVERS_UNCAPPED`, `UNPAID_CAPS`, and `freeTierCappedResponse()` to include a `linesAndFills` entry, or every fixture is a type error.

### A2. Grant mapping: product/tier → features (DB)
Model on the existing `product_contents` table (product → content). We want product → feature.

- **New migration** `supabase/migrations/<ts>_create_product_features.sql`:
  ```sql
  create table public.product_features (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete cascade,
    feature_key text not null,            -- matches FEATURE_KEYS
    created_at timestamptz default now(),
    unique (product_id, feature_key)
  );
  -- RLS: public read (feature catalog is not secret); admin write. Mirror product_contents policies.
  ```
- **Plus a "tier baseline":** membership (active subscription) grants a baseline feature set even with no
  product rows. Two options — pick one:
  - (a) Seed a `product_features` row set against the membership product (cleanest — everything is data).
  - (b) A small constant `MEMBER_BASELINE_FEATURES` in the backend resolver.
  - **Recommendation:** (a) — keeps "what does membership unlock" editable from admin, no redeploy.
- Seed: membership → `[tempo, transpose, loopRange, deconstruction, dynamicLoop]` (today's member set).
  Lines-and-Fills is intentionally NOT in the membership baseline yet — it'll be granted by whichever
  product(s) you choose (e.g. College Program). That's the whole point of the model.

### A3. Backend resolver (`EntitlementService`)
Add a feature-resolution method alongside the existing content methods, reusing the SAME ownership reads.

**⚠️ CORRECTED design (two blockers fixed):**
- **BLOCKER-1 — no stable membership UUID.** `MEMBERSHIP_PRODUCT_ID` does NOT exist; the product id is `gen_random_uuid()` and differs per env (prod `iuuplfrktnzsbzibpfjm` vs staging `vraxryaaznpkvtkindpn`). Resolve it at runtime by `type='membership'` (or slug `monthly-membership`) and memoize per-process.
- **BLOCKER-2 — accelerator-confers-membership MUST be preserved.** Today `hasMemberAccess()` returns true for a no-subscription accelerator OWNER (it loops owned products, returns true on `type==='accelerator'`). If we re-derive membership from `hasActiveSubscription` only, a Bass College owner with no sub LOSES the 5 baseline levers. → REUSE `hasMemberAccess()`.

```ts
private membershipProductId: string | null = null;  // memoized

private async getMembershipProductId(): Promise<string | null> {
  if (this.membershipProductId) return this.membershipProductId;
  const products = await this.productRepository.findAllActive();
  this.membershipProductId = products.find((p) => p.type === 'membership')?.id ?? null;
  return this.membershipProductId;
}

async getGrantedFeatures(userId: string | null): Promise<FeatureKey[]> {
  if (!userId) return [];                               // anon: nothing
  if (await this.isAdmin(userId)) return [...FEATURE_KEYS];  // admin: everything

  const productIds = new Set<string>();
  // REUSE hasMemberAccess — covers active subscription AND accelerator-confers-membership.
  if (await this.hasMemberAccess(userId)) {
    const memId = await this.getMembershipProductId();
    if (memId) productIds.add(memId);                   // grants the 5 baseline levers (seeded in A2)
  }
  // Layer each owned product's OWN extra grants (e.g. Bass College → linesAndFills).
  for (const id of await this.purchaseRepository.getPurchasedProductIds(userId)) productIds.add(id);

  return this.productFeaturesRepository.featuresForProducts([...productIds]);
}
```
- **New repo** `product-features.repository.ts`. NOTE: `product_contents.repository` uses `.eq` (single product), so it is NOT a literal template for the `.in` (many products) case here. The new `featuresForProducts(ids)` MUST:
  ```ts
  if (productIds.length === 0) return [];              // empty-IN guard (codebase convention)
  // .select('feature_key').in('product_id', productIds), dedupe to Set,
  // then drop any value not in FEATURE_KEYS (a stray DB row can't inject a bogus feature).
  ```
- This reuses `hasMemberAccess` + `getPurchasedProductIds` — the exact, already-trusted ownership reads, keeping the resolver byte-identical to the content path.
- **TEST TOUCH (omission caught):** `entitlement.service.spec.ts:90-104` constructs the service with **6 positional repos**; adding `productFeaturesRepository` is a 7th arg → update `makeService()` or it won't compile. Add cases: anon→[], admin→all keys, active subscriber→baseline, **no-sub accelerator owner→baseline ∪ linesAndFills**.

### A4. Backend endpoint
Extend the existing `/billing/access` to return `grantedFeatures`.
- `apps/backend/src/domains/billing/billing.controller.ts` `getUserAccess` → include
  `grantedFeatures: await entitlementService.getGrantedFeatures(userId)` in `UserAccessStatus`.
  (Admin already short-circuits → `getGrantedFeatures` returns all keys for admins; consistent.)
- **Update BOTH `UserAccessStatus` copies in lockstep** — the frontend (`apps/frontend/.../billing/types/billing.types.ts:50-57`) and backend (`apps/backend/.../billing.types.ts:263-270`) versions ALREADY drift (`subscriptionEndDate?:string` vs `Date`, optional vs required `purchasedProductIds`). Add `grantedFeatures?: FeatureKey[]` to both; don't widen the drift.
- **Add `grantedFeatures: [...FEATURE_KEYS]` to `MOCK_USER_ACCESS`** (`billing.api.ts:33-40`) so `BILLING_DEV_MODE` still yields the uncapped experience. Also add the missing `purchasedProductIds: []` and fix `subscriptionPeriodEnd`→`subscriptionEndDate`.

### A5. Frontend rewire (`useEntitlement`)
Replace the hardcoded binary with a feature-set → caps derivation. **This is the core swap.**
- `apps/frontend/src/domains/billing/hooks/useEntitlement.ts`:
  - Read `grantedFeatures` from `useUserAccess()`. **Default to `[]` when undefined:** `const granted = new Set(access?.grantedFeatures ?? [])`. Anonymous visitors NEVER query `/billing/access` (the query stays `enabled: isAuthenticated`), so `access` is `undefined` → `[]` → all-capped UNPAID profile, with NO network call. (Omission caught — without the `?? []` default, `granted.has(...)` throws for anon.)
  - **Derivation — pull the WHOLE LeverCap object from the existing constants, do NOT synthesize `{isCapped:!granted}`** (the numeric `limit` on tempo=5 / transpose=2 is load-bearing; a boolean would evaporate the free wall):
    ```ts
    // For each gateable lever, granted → ALL_LEVERS_UNCAPPED[lever], else → UNPAID_CAPS[lever].
    // The grant SET selects WHICH value table; the cap VALUES (isCapped, limit, message) stay in the tables.
    function capFor(lever, featureKey) {
      return granted.has(featureKey) ? ALL_LEVERS_UNCAPPED[lever] : UNPAID_CAPS[lever];
    }
    const caps = {
      tempo:          capFor('tempo', 'tempo'),
      transpose:      capFor('transpose', 'transpose'),
      loopRange:      capFor('loopRange', 'loopRange'),
      deconstruction: capFor('deconstruction', 'deconstruction'),
      dynamicLoop:    capFor('dynamicLoop', 'dynamicLoop'),
      linesAndFills:  capFor('linesAndFills', 'linesAndFills'),
      mute:           { isCapped: false, message: '' },   // ALWAYS uncapped — no feature key, by design
    };
    ```
  - **Keep the existing `isResolving` guard verbatim** — while the access query is in flight, return `UNPAID_CAPS`, `isLoading:true` (treat `grantedFeatures` as `[]`). Only the resolved branch changes from isMember-binary to set-derived. Never flash access.
  - `tier` stays for copy purposes but caps no longer depend on it directly.
- The 2 DIRECT consumers (`GrooveCardBlockView`, `GrooveCardControls`) **don't change** — they still read `caps.*`. But note **2 transitive surfaces** (the `/free` funnel via `FreeGrooveExperience`, the homepage `WaitlistGrooveCard`) depend on the EXACT unpaid profile for anonymous visitors — covered by the `[] → UNPAID_CAPS` default above.
- **`BILLING_DEV_MODE` (omission caught):** `MOCK_USER_ACCESS` (`billing.api.ts:33-40`) has no `grantedFeatures` → under the new model a forced "member" would see EVERYTHING LOCKED (inverts the dev override). A4 MUST add `grantedFeatures: [...FEATURE_KEYS]` (and the missing `purchasedProductIds`, and fix the stale `subscriptionPeriodEnd`→`subscriptionEndDate` field) to the mock.
- **Regression tests:** anon → all features capped (no network call); active subscriber → 5 baseline uncapped, linesAndFills capped; College owner → +linesAndFills; mute always uncapped; dev-mode → all uncapped.

### A6. Migrate the 6 existing levers + cleanup
- Verify each lever (tempo/transpose/loopRange/deconstruction/dynamicLoop) still gates identically
  after the rewire (existing tests in `useEntitlement.test.ts`, `useGrooveCardPlayback.*.test.ts` cover this).
- **Dormant gates** — decide: fold into the new model or delete.
  - `PremiumGate.tsx` / `usePremiumAccess` / `useHasCourseAccess` — **no consumers** (verified). Safe to DELETE.
    BUT do NOT delete `SubscriptionManager.tsx` / `PricingSection.tsx` — they still DISPLAY `purchasedCourses` (live on `/pricing`), they just don't grant features.
  - Fretboard ring `isPremium` (`useRingOverlay.ts`, bypassed by `DEBUG_FORCE_ENABLE`) — either wire to a
    `ringOverlay` feature key or leave as-is. Low priority; note it.
- **Legacy `course` product owners get ZERO features under the new model** — courses key off `course_type`, not `product_id`/`product_features`, so they have no `product_features` rows. Acceptable IF no real course purchases exist (pre-production). **Confirm zero course purchases** before relying on this; otherwise map `course_type`→a product or add a course-feature path.

### A7. Admin UI (optional but on-theme)
"Choose what's gated for whom" implies an admin surface to edit `product_features`.
- Extend the existing admin products editor (`admin-products.controller.ts` + admin UI) with a
  feature-checklist per product. Can be a fast-follow; the DB table + seed is enough to ship Track B.

**Track A exit criteria:** member behavior is byte-identical to today, but driven by data
(`product_features`) instead of hardcoded objects; the platform can now grant any feature to any product.

---

## TRACK B — "Lines & Fills" (built on Track A)

### B1. Data model — alternate basslines on the groove
- Extend `GrooveCardStemSet` (or add a sibling) in `libs/contracts/src/types/block.ts`:
  ```ts
  export interface BasslineVariant {
    id: string;            // stable id
    title: string;         // "Ex 4"-style label / name
    url: string;           // storage path or signed-URL-resolvable ref (see B5)
    feature?: FeatureKey;  // gate key; default 'linesAndFills'
  }
  export interface GrooveCardStemSet {
    bass: string; drums: string; harmony: string;
    bassVariants?: BasslineVariant[];   // NEW — premium alternate basslines
  }
  ```
- **The "no migration, free pass-through" claim is HALF TRUE — three concrete edits required (blocker):**
  - (a) `groove_library.stems` is schema-less JSONB → **no column migration**. ✅
  - (b) **`mapDbToGroove` (`grooves.service.ts:154-180`) rebuilds stems as EXACTLY `{bass, drums, harmony}` and silently DROPS `bassVariants` on every library read.** Must add `bassVariants: Array.isArray(stems.bassVariants) ? stems.bassVariants : undefined`. Also surface `accessTier`/`productId` here (needed for the B5 content-grant check) — currently omitted from `GrooveLibraryItem` entirely.
  - (c) **The Zod stem-URL validator hardcodes the PUBLIC bucket.** `STEM_PATH_REGEX` (`groove-card-block.schema.ts:24`) requires `/storage/v1/object/public/audio-samples/` — a `bassVariants` url pointing at the new PRIVATE `premium-basslines` bucket FAILS it. Add `bassVariants` as an optional array to `grooveCardStemSetSchema` with its OWN url validator that accepts the private-bucket path (a second regex or a storage-path union), NOT reusing `grooveCardStemUrlSchema`.
  - Add `bassVariants` to `GrooveLibraryItem.stems` type AND `GrooveCardStemSet`.
  - (Note: the inline-block write path happens to survive today only because `validateGrooveCardBlocks` returns the RAW blocks (Zod's stripped `.data` is discarded) — don't rely on that quirk; do the schema edit properly.)

### B2. Engine — bass-only swap  ⚠️ HIGHEST-RISK PILLAR — RE-SCOPED AFTER VALIDATION
**The original "seamless in-place swap = `setKey` clone" framing was WISHFUL.** What the audit found:
- `setKey` writes a SCALAR (`semitones`) to a still-looping node via `schedule()` — cheap, deferrable, no re-arm. **A buffer swap replaces the entire PCM payload** — categorically heavier. `signalsmith.schedule()` has NO buffer field; you cannot defer a buffer change the way you defer semitones.
- `addBuffers` is **APPEND-only** (pushes PCM, advances `audioBuffersEnd`, does NOT reset the read-head). `dropBuffers()` wipes all buffers + resets `audioBuffersStart/End=0` while the read-head keeps advancing → the worklet zero-pads (silence) or reads at a phase offset until the next loop wrap. A naive drop→add mid-loop = guaranteed audible discontinuity.
- `__bufferDuration`/`loopEnd` are set ONCE at node creation and are the **seam-clock authority for ALL stems** (`getStemNextSeamTime`, playhead, key/tempo quantization). A different-length variant desyncs the whole band.
- The codebase **already removed** a re-register-at-seam approach for the bass worklet — documented as *"TORE DOWN and rebuilt the worklet at key 0... introducing a seam glitch and a latent default-key regression."* That is exactly the risk a buffer swap re-introduces.
- signalsmith ships **no `.d.ts`**; `dropBuffers`/`addBuffers` are untyped worklet RPCs the adapter does NOT currently surface. New adapter + `InfiniteAudioSource` verbs are required.

**RE-SCOPED design — two hard requirements + a prototype gate:**
1. **HARD-REQUIRE every `bassVariant` be the EXACT same sample-length / loop-grid as the default bass.** Enforce at admin upload (validate sample count) AND defensively in the engine. This keeps `__bufferDuration`/`loopEnd`/the shared grid valid → the swap touches only PCM, not the seam metadata. (If we ever allow different-length variants, `swapStemBuffer` must also rewrite `__bufferDuration` + reschedule `loopStart/loopEnd` + re-anchor `__phaseStamp` — out of scope for v1.)
2. **The swap MUST re-apply the live key + tempo at the seam.** A swapped bass otherwise arms at `semitones=0, rate=1` → out of tune AND out of time if the user transposed/slowed. Read `currentSemitonesRef` + current rate and re-schedule them on the swapped buffer at the same seam (mirror `setRate`'s deferred-key-preservation dance).
3. **PROTOTYPE + EAR-MEASURE before committing to "seamless."** Build `swapStemBuffer(instrumentType, newBuffer, atSeamTime)` as a NEW heavy code path (new adapter method `swapBuffers` + new `InfiniteAudioSource` verb), sequence it as: at the seam wrap → `dropBuffers()` → `addBuffers(newChannelData)` → `schedule({loopStart:0, loopEnd:len})` + re-apply semitones/rate → realign segment `input` to the seam. Verify with the existing `docs/dev-tools/audio-audit/` onset-meter/seam harness. **If in-place proves glitchy, fall back to a measured full re-register at the seam** (Path A — drums+harmony DO restart, but `rampSeconds:0` at the wrap may be click-acceptable; the loop-SELECTION swap already does exactly this, so it's a known-working fallback, just not "drums untouched").
- **Do NOT claim "drums+harmony untouched, truly seamless" until the prototype proves it by ear.** Budget PR3 for real DSP work, not a 3-line method.

### B3. Preload — fetch variant buffers
- `useGrooveCardStemPreload.ts` is hardcoded to `bass|drums|harmony`. Extend to also fetch/decode the variant buffers.
- **⚠️ URL-keyed caching BREAKS for signed URLs (major).** The cache keys `stemCache`/`inflight` by the raw URL string. A Supabase signed URL embeds a token + expiry in the querystring that **changes on every mint** → every mint is a cache MISS, defeating the dedupe, and `getBuffer('bass')` can't find the buffer (the signed URL is ephemeral, not stable identity).
  → **Cache variants by a STABLE key** (`BasslineVariant.id` or a `groove:variant` composite), NOT the minted URL. Add a preloader overload `(stableKey, urlResolver)`: store the decoded `AudioBuffer` under `stableKey`, call `urlResolver()` to mint a fresh signed URL ONLY on a cold miss. Playback then runs from the in-memory `AudioBuffer`, so the 1h TTL expiring mid-session is harmless (the URL is only needed for a cold decode).
- **⚠️ Anon/non-entitled 403 must be tolerated (minor, on /free).** A variant whose signed-URL fetch 403s (anon funnel visitor, or non-entitled user) must be SKIPPED so the core `bass/drums/harmony` still decode. Make variant preload best-effort; never let a gated-variant 403 break the base stems.

### B4. Hook command — `setBassVariant`
- `useGrooveCardPlayback.ts`: add `setBassVariant(variantId | null)` that resolves the buffer from preload (by STABLE key, B3)
  and calls `engine.swapStemBuffer('audio-bass', buf, computeNextBoundaryAudioTime(0))`.
  `null` = back to the default bass.
- **NOT a clone of `setKey`'s deferred-write** (corrected). `setKey` schedules a scalar; this swaps PCM (see B2). The command MUST pass the live key + tempo so the engine re-applies them on the swapped buffer at the seam (else out-of-tune/out-of-time).

### B5. Secure storage (the access-control answer)
**Pattern = clone the video signer. Free stems stay public; premium basslines go in a NEW private bucket.**
- **New migration**: create private bucket `premium-basslines` (`public=false`, no broad SELECT RLS).
  Precedent: `20251021000001_create_temp_midi_bucket.sql`.
- **New `SupabaseService.createSignedReadUrl(bucket, path, ttl)`** — thin wrapper over `.createSignedUrl`
  (call already proven at `supabase.service.ts:204`).
- **New gated endpoint** `GET /api/v1/grooves/:id/bassline-url?variantId=X`.
  **⚠️ SECURITY (major bypass caught): gate on BOTH content-grant AND feature-grant, AND-ed.** A global `linesAndFills` grant is NOT permission to open a content-gated groove — a Bass College owner could otherwise fetch basslines from a groove gated behind a DIFFERENT pack they don't own. Since the bassline file lives ON the groove record, file access = groove-content access.
  ```
  OptionalAuthGuard  (exists; populates req.user for authed, allows anon)
   → load groove (single read) → its accessTier, productId, and the variant {path, feature}
   → CONTENT GRANT: entitlementService.canAccessContent(userId, {
        accessTier: groove.accessTier,
        productId: groove.productId,
        contentRef: groove.accessTier === 'product' ? { type: 'groove', id: grooveId } : undefined,
      })  // identical to tutorials.controller.ts:70-81 — "may this user open THIS groove at all?"
   → FEATURE GRANT: (await getGrantedFeatures(userId)).includes(variant.feature ?? 'linesAndFills')
   → if EITHER fails → 403
   → return { url: await supa.createSignedReadUrl('premium-basslines', path, ttl), expires }
  ```
  (Requires mapDbToGroove to surface `accessTier`/`productId` — see B1 edit (b).)
- **Admin upload**: parallel of the existing backend-proxied stem upload, pointed at `premium-basslines`
  (the `uploadFile(bucket, ...)` already takes the bucket name). Admin-gated, service-role write.
- **TTL caveat (document, don't over-engineer):** short-lived signed URL = access-controlled at issuance, not DRM. Accept reshare-until-expiry as the standard bar.
  **Prefer minting ON-DEMAND at swap time with a SHORTER TTL (5–15 min)** rather than a 1h URL at preload — pairs naturally with the stable-key cache (B3: cache the decoded buffer, re-mint only on cold decode) and shrinks the reshare window without hurting playback continuity.
- **Free stems untouched:** do NOT flip `audio-samples` private (~40 ungated loaders + the /free funnel depend on it). Only paid basslines live in the private bucket. (Moving paid basslines OUT of the public bucket is a net security GAIN vs the `stem-bucket-hardening` memo's "bulk-scrapeable today" baseline.)
- **CSP:** confirm the Supabase storage signed-URL host is in `next.config.js` `connect-src` (same host as the public bucket, so likely already allowed — verify).

### B6. UI — the "Lines & Fills" section (reuse the exercise rectangle)
- **Extract `SelectableCell` as the VISUAL SHELL ONLY (not the whole cardButton).** The audit found `cardButton` closes over ~10 exercise-specific vars (`isRewardCard`, `advancedUnlocked`, `details.colors`, `ProgressDots`/`REQUIRED_COMPLETIONS`, the reward/Unlock-chip branch, `handleExerciseSelect` vs `onUnlock`). Only ~half is shareable. Scope `SelectableCell` to: `(icon, primaryLabel, secondaryLabel?, colorBarClass?, footer?: ReactNode, selected, locked, active, disabled, onClick, title)`. Render `ProgressDots`/reward-chip as the OPTIONAL `footer` slot (exercises supply ProgressDots; basslines supply nothing or a "gated" badge). Keep `difficultyColors`/`getExerciseDetails` in `ExerciseSelectorCard` and pass the resolved `colorBarClass`/`footer` down. **Do NOT promise the reward card uses the shared cell** — its `w-full`+`Zap`+Unlock-chip path stays bespoke.
- `AnimatedBorderWrapper` (`ExerciseSelectorCard.tsx:26-63`) is reusable as-is (children-only); violet→amber is a one-line conic-gradient edit (`:52`).
- New `LinesAndFillsSection` rendered under the groove-card block.
  - **Where it mounts (trace this):** confirm whether `useGrooveCardPlayback` is instantiated in `GrooveCardBlockView` itself or a child, so the section has access to `setBassVariant`. Render the section where the hook instance lives.
  - Each rectangle = a `BasslineVariant`. "selected" = active bassline.
- **Upsell wiring — FOUR coordinated edits, NOT a drop-in (major):**
  1. Add `'linesAndFills'` to the `UpgradeLever` union (`UpgradePitch.tsx:24-30`).
  2. Add a `LEVER_HEADLINE['linesAndFills']` entry — `LEVER_HEADLINE` is a total `Record<UpgradeLever,string>`, so a missing entry is a TS COMPILE ERROR, not a blank render.
  3. Add a `BENEFITS` row for linesAndFills (hand-maintained list; without it the benefit silently never shows).
  4. Widen the `onCapHit` / `onCapHitExternal` lever unions (`GrooveCardBlockView.tsx:102-109,199-209`) to include `'linesAndFills'`.
- **Gate — follow the Dynamic Loop pattern EXACTLY** (not the tempo/transpose path):
  - `const linesAndFillsCapped = capsEnabled && caps.linesAndFills.isCapped;`
  - Members WITH the grant: full row, click-to-swap.
  - Locked click: `trackEvent('cap_hit',{lever:'linesAndFills'})`; then `if (suppressUpsell) onCapHitExternal?.('linesAndFills')` (the /free funnel's Sign-up reveal) `else` open the pitch popover.
  - **Anchor the linesAndFills Popover INSIDE `LinesAndFillsSection`** (like dynamicLoop anchors to the dial) — `GrooveCardControls`' `anchorIf` only knows `tempo|transpose|loopRange|deconstruction`, so it canNOT host this one.
- **Surface guards (omissions caught — decide & document):**
  - **Drill bricks:** hide the section with `!isDrillBrick` (same as `dynamicLoopShown`) — alternate basslines don't belong inside a prescribed drill where the part is author-locked.
  - **Homepage `WaitlistGrooveCard`** (`capsEnabled=false`): HIDE the section (no caps to gate it → would leak as a working free feature). Mount only when `capsEnabled`.
  - **`/free` funnel** (`enableCaps=true, suppressUpsell=true`): SHOW it LOCKED as a tease; locked click reveals Sign up via the `onCapHitExternal` branch above.

### B7. Admin authoring
- **The variant repeater is NET-NEW UI** — the groove-card form (`GrooveCardBlockForm.tsx`) has NO repeater (its only list, `ChordChartEditor`, is a fixed bars×16 grid, wrong shape to clone).
  → **Clone `ExplainBlockForm.tsx`'s repeater scaffolding** (`generateId` + add/delete/reorder + per-row upload) — it's the correct template and already does per-item file upload.
- **Where it lives (corrected):** stems/chordChart only render for INLINE (non-library) blocks (`GrooveCardBlockForm.tsx:152,297`), but basslines "live on the groove record" (LIBRARY) per locked decision #2. → the variant repeater must live where **LIBRARY grooves** are edited (`apps/frontend/src/app/admin/grooves/page.tsx`), not the inline block form.
- **Upload must target the PRIVATE bucket** — `useStemUpload`/`StemUploadButton` are HARDCODED to `POST /api/v1/tutorials/groove-stem/upload` → `audio-samples` (`buildStemPath:87-91`, stem union excludes variants). → **Parameterize `useStemUpload` by `{endpoint, bucket, folder}`** (or add `useBasslineVariantUpload`) so variant files hit the B5 `premium-basslines` admin endpoint. Do NOT reuse `buildStemPath` verbatim.
- **Enforce the same-length guard (B2 req #1)** at upload: validate the variant's sample count matches the default bass before accepting.

### B8. Post-purchase grant refresh (omission caught — REQUIRED for the College→Lines-and-Fills flow)
The whole premise is "buy Bass College → get linesAndFills", but the current refresh paths only handle MEMBERSHIP:
- `/app/welcome` polls with exit `if (isMember || polls>=5)` — `isMember = hasActiveSubscription`. A **product** purchase NEVER flips that → it polls 5× and gives up; the grant won't appear until manual reload.
- `/app/store?success=true` does a SINGLE `refetchAccess()` with no retry → races the Stripe webhook that writes the `purchases` row → first read is stale.
- `UpgradePitch` (the in-card lever upsell) ALWAYS checks out `type:'subscription'` → buying a `linesAndFills`-granting PRODUCT from a lever-upsell isn't even wired to product checkout.
**Fixes:** make `/app/welcome` and `/app/store` poll until `grantedFeatures` includes the expected key (OR `polls>=N`); and decide how a product that grants linesAndFills is bought from the groove card (the lever upsell must route to PRODUCT checkout, not subscription — or the upsell points the user to the store).

**Track B exit criteria (updated):** a user who OWNS the granting product AND can access the groove sees the Lines-and-Fills row, clicks a rectangle, and a different bassline swaps in **with a measured-clean seam** (ear-verified via the audio-audit harness — "seamless, drums untouched" only if the B2 prototype proves it) at the current key/tempo; a user **non-entitled by feature OR by groove-content** sees a locked row + upsell and gets a **403 at the signer**; on the /free funnel a locked click reveals Sign up.

---

## Sequencing / PRs
1. **PR1 (Track A core):** contracts `features.ts` (+`linesAndFills` in `LeverCaps`, `grantedFeatures?` OPTIONAL on both `EntitlementResponse` & `UserAccessStatus` copies) + `product_features` migration (mirror `product_contents` RLS, no GRANTs) + seed against the runtime-resolved membership product + backend resolver (reuse `hasMemberAccess`, empty-IN guard, FEATURE_KEYS filter) + endpoint + `useEntitlement` rewire (whole-LeverCap fallback, mute always-uncapped, anon `[]` default) + `MOCK_USER_ACCESS` fix + **update `entitlement.service.spec` 6→7-arg constructor** + verify 6 levers byte-identical. (Member behavior identical.)
2. **PR2 (Track A cleanup):** delete dormant `PremiumGate`/`usePremiumAccess`/`useHasCourseAccess` (no consumers); KEEP `SubscriptionManager`/`PricingSection` (still display courses); optional admin feature-checklist.
3. **PR3 (Track B engine — HIGH RISK, prototype-gated):** `BasslineVariant` contract + same-length requirement + `swapStemBuffer` (new adapter `swapBuffers` verb + re-apply key/tempo at seam) + stable-key preload + `setBassVariant`. **Gate this PR on an ear-clean prototype** (audio-audit harness); if in-place swap is glitchy, fall back to measured full re-register. No UI.
4. **PR4 (Track B storage):** private `premium-basslines` bucket migration + `createSignedReadUrl` + gated bassline-url endpoint (**BOTH content-grant AND feature-grant**) + `mapDbToGroove` surfaces `bassVariants`+`accessTier`+`productId` + Zod schema accepts private-bucket variant URLs + admin upload endpoint.
5. **PR5 (Track B UI):** extract `SelectableCell` (visual shell + footer slot) + `LinesAndFillsSection` + 4-part upsell wiring + drill-brick/waitlist/funnel surface guards + admin variant repeater (clone `ExplainBlockForm`, parameterized upload) on the LIBRARY groove editor.
6. **PR6 (post-purchase refresh):** poll `grantedFeatures` on `/app/welcome` + `/app/store`; route the lines-and-fills upsell to PRODUCT checkout. (Can fold into PR5 if the lever-upsell needs it sooner.)

## Open questions to confirm before PR1
- Which product(s) grant `linesAndFills`? (College Program only? Membership too? A new "Lines Pack"?)
  → determines the seed rows in A2. **Does NOT block building the model** — it's just data.
- Membership baseline feature set — confirm it's exactly today's 5 levers.
- Signed-URL TTL for basslines — default 1h (temp-bucket precedent) unless you want shorter.

## Key references (anchors for implementers)
- Backend content authority (extend): `apps/backend/src/domains/billing/services/entitlement.service.ts`
- Product types/enums: `apps/backend/src/domains/billing/types/billing.types.ts` (`ProductType`, `ContentAccessTier`)
- Product→content bundle table (model to clone): `supabase/migrations/20260606000003_storefront_product_contents.sql`
- Frontend binary to replace: `apps/frontend/src/domains/billing/hooks/useEntitlement.ts` (`UNPAID_CAPS`/`ALL_LEVERS_UNCAPPED`)
- Entitlement contract: `libs/contracts/src/types/billing.ts`
- Gating template (copy for bassline signer): `apps/backend/src/domains/videos/videos.controller.ts:42-75`
- Supabase signed-URL precedent: `apps/backend/src/infrastructure/supabase/supabase.service.ts:200-204`
- Private-bucket migration precedent: `supabase/migrations/20251021000001_create_temp_midi_bucket.sql`
- Public stem bucket (leave alone): `supabase/migrations/20250720000000_create_audio_samples_bucket.sql`
- Bass swap machinery: `apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts` (self-looping bass node, `getStemNextSeamTime`)
- Bass seam/deferred-write pattern (clone for setBassVariant): groove-card `useGrooveCardPlayback.ts` (`setKey`)
- Exercise rectangle to extract: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/ExerciseSelectorCard.tsx:378-497`
- Dynamic Loop gate pattern (cleanest): `GrooveCardBlockView.tsx:323-361`
- Upsell UX: `apps/frontend/src/domains/billing/components/UpgradePitch.tsx`
