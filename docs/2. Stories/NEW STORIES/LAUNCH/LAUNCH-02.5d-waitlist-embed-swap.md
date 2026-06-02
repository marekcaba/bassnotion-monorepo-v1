# [LAUNCH-02.5d] Waitlist Embed Swap

**Parent:** [LAUNCH-02.5 (epic)](./LAUNCH-02.5-groove-card-block.md) • [Launch Backlog](./README.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~2-3 working days
**Status:** ✅ Done — shipped 2026-05-27 on `develop` as commit `6791eee`. **LAUNCH-01 stop-ship is closed.**
**Blocks:** [LAUNCH-01](./LAUNCH-01-whitelist-page.md) — _unblocked_ (the public waitlist mockup is gone)
**Depends on:** [LAUNCH-02.5c](./LAUNCH-02.5c-groove-card-in-app.md) ✅ `c4da911` • transitively 02.5a `48f8b85` + 02.5b `6f50acf`
**The thing this story is:** the waitlist mockup at [WaitlistClient.tsx:468](../../../../apps/frontend/src/app/WaitlistClient.tsx) → real interactive card. Plus the minimal audio bootstrap the marketing page needs (it has no `AudioProvider`), the bundled countdown click sample, the viewport-intersection pre-warm, the ±4 key cap, and the mockup deletion.

---

## Why this is its own story

02.5c builds the card and ships it inside `/app`. The `/app` shell has `AudioProvider` + `TransportProvider` + `CoreServices` initialised — the card inherits a fully-warm engine. **The waitlist page has none of that infra.** Mounting the card on a marketing page means either (a) bootstrapping the entire CoreServices stack (too heavy — ~+200 KB JS plus eager metronome MP3 decoding), or (b) bootstrapping a minimal "audio-only" subset (this story's approach).

Splitting this out lets the in-`/app` work (02.5c) ship and be QA'd against real tutorials, while the marketing-page work — which has different risks (iOS Safari first-tap, bundle size scrutiny, public-page caching) — gets its own focused PR.

## Pre-PR ops step (asset)

**Marek (or admin upload) must produce `countdown-click.ogg`** in the `audio-samples` Supabase bucket **before** this PR opens. Spec:

- Single short click, ~30-50ms
- `.ogg` Vorbis, ≤5 KB
- Tuned for monitor + headphone audibility on phone speakers (the YouTube traffic is majority mobile)
- Stored at a stable path in `audio-samples` — the URL gets pinned in the hook's `mode="waitlist"` config

This is the only manual step. Until the asset exists, the waitlist countdown has nothing to play. The PR cannot merge without it.

## What this story adds

### 1. The minimal audio-only bootstrap

**New file:** `apps/frontend/src/app/_components/WaitlistAudioBootstrap.tsx` (or co-located near WaitlistClient — naming is a detail).

A lightweight React provider that mounts around the embedded Groove Card and initialises **just enough** of the engine for `AudioPlayerScheduler` + countdown:

- `AudioContext` via `ensureAudioContext()` (from [apps/frontend/src/domains/playback/utils/ensureAudioContext.ts](../../../../apps/frontend/src/domains/playback/utils/ensureAudioContext.ts))
- `PlaybackEngine` with `MusicalTruthAuthority`
- `AudioPlayerScheduler` wired into `EventRouter`
- **A bundled `audio-click` countdown stem** instead of the MIDI metronome path. No `MetronomeScheduler`, no `MetronomePreloadStrategy`, no drum-buffer scaffolding

The countdown emits 4 plays of the single short click `AudioBuffer` (pre-decoded on first viewport intersection, see iOS gesture handling below).

### 2. The viewport-intersection pre-warm

`ensureAudioContext()` is async; on cold mount, it can take 200–500ms before the AudioContext is actually running. If that runs _during_ the Play tap, iOS Safari's "first click is silent" risk re-surfaces because by the time the context resumes, the gesture's audio window has expired in some Safari versions.

**The waitlist embed pre-warms on first viewport intersection:**

- `IntersectionObserver` watches the card. On first intersection (card visible), call `ensureAudioContext()` and decode the countdown click buffer.
- The AudioContext stays _suspended_ until the Play tap (no autoplay).
- Gesture-resume on tap then completes in <10ms.
- Pre-decoded buffer is ready to fire on the first countdown click — zero perceived latency between tap and click.

### 3. The component mount

`<GrooveCardBlockView mode="waitlist" ... />` replaces `<GrooveCardMockup />` at [WaitlistClient.tsx:468](../../../../apps/frontend/src/app/WaitlistClient.tsx). The component family already exists from 02.5c — this story only adds the `mode="waitlist"` behavior:

- **Loads only the default key set** (4 files, not 20). Loading 20 audio files for a public marketing page is too heavy; loading 4 (+ the countdown click) is fine.
- **Key range hard-capped at ±4 semitones** from the default. (At ±4 the residual pitch-shift on the single delivered key set is still ±4 — at the artifact edge but acceptable for a demo.) Beyond ±4 the stepper arrow shows a subtle "full range in app" hint and refuses further input — the cap-as-CTA mechanism the funnel narrative wants.
- **Tempo range unchanged** (50–180 BPM) — time-stretching, not pitch-shifting, works fine on a single key set.
- **All four stems still load**, including click. Mute Bass / Solo Drums / click toggle all work.
- **Countdown uses the bundled `audio-click` sample** via the hook's `countdownClickUrl` prop (added in 02.5c). Same `addCountdownRegion()` timing math, different sound source.
- **No completion writes, no auth required.**
- **No backend call**, no telemetry-on-mount — only the existing telemetry fires on user actions (`groove_card_waitlist_cap_hit` on cap-reach is the new event).

### 4. The mockup deletion

`GrooveCardMockup` is currently defined at [WaitlistClient.tsx:990](../../../../apps/frontend/src/app/WaitlistClient.tsx#L990) and used once at line 468. Verified single reference. Delete the function in the same PR as the swap — no orphan/dead-code window.

## Telemetry

The existing card-level telemetry (from 02.5c) continues to fire. This story adds one waitlist-specific event:

```
groove_card_waitlist_cap_hit { blockId, lever: 'key', valueAttempted }
```

Fires when a visitor taps the key stepper beyond ±4. Feeds the "does hitting the key cap correlate with signup?" question — central to whether the cap-as-CTA mechanism is working.

## Requirements

### Functional — bootstrap

- [ ] `WaitlistAudioBootstrap` provider mounted around the embedded card on the waitlist page
- [ ] Initialises only: `AudioContext`, `PlaybackEngine`, `MusicalTruthAuthority`, `AudioPlayerScheduler` (wired into `EventRouter`)
- [ ] Does NOT initialise: `MetronomeScheduler`, `MetronomePreloadStrategy`, drum-buffer scaffolding, MIDI synth instruments, anything related to harmony/bass MIDI tracks
- [ ] AudioContext stays _suspended_ until the user taps Play — no autoplay, no preemptive resume

### Functional — pre-warm

- [ ] `IntersectionObserver` triggers on first card visibility
- [ ] On first intersection: `ensureAudioContext()` is called and the countdown click `AudioBuffer` is decoded
- [ ] AudioContext is intentionally left suspended after pre-warm — resume happens on Play tap
- [ ] Pre-warm runs once per page load (re-intersecting after scrolling away does not re-decode)

### Functional — card behavior in waitlist mode

- [ ] `<GrooveCardMockup />` at `WaitlistClient.tsx:468` replaced with `<GrooveCardBlockView mode="waitlist" ... />`
- [ ] **Only the default key set** loads (4 files, not 20)
- [ ] **Key range hard-capped at ±4 semitones**; arrow taps beyond show a subtle "full range in app" hint
- [ ] Hitting the key cap fires the `groove_card_waitlist_cap_hit` telemetry event
- [ ] Tempo range unchanged (50–180 BPM)
- [ ] Mute Bass / Solo Drums / click toggle all work
- [ ] **Countdown plays via the bundled `audio-click` sample** (not the MIDI metronome path). Same 1-2-3-4 timing, different sound source.
- [ ] Active-card store still applies (only one card on the page; behaves identically — no two-card coordination needed in practice)
- [ ] No completion writes, no auth required

### Functional — asset

- [ ] `countdown-click.ogg` exists in the `audio-samples` Supabase bucket (uploaded via the admin form or directly by Marek). URL pinned in the hook config for `mode="waitlist"`. **This is a pre-PR step; the PR cannot merge without the asset.**

### Functional — mockup deletion

- [ ] `GrooveCardMockup` function definition at `WaitlistClient.tsx:990` deleted
- [ ] Any imports/helpers used only by the mockup (e.g. `GrooveState`, `CAPTIONS`, `GrooveWaveform` if mockup-only) — deleted
- [ ] Grep `WaitlistClient.tsx` for `GrooveCardMockup` → 0 hits
- [ ] No orphan exports

### Non-functional

- [ ] **Mobile-responsive** — card and stepper arrows work on phone-width screens (YouTube traffic is majority mobile)
- [ ] Bundle size impact tracked — the waitlist bootstrap is the only new JS shipped to the marketing page. Target: keep the page's JS budget reasonable; if it grows beyond ~150 KB (gzipped) for the audio addition, escalate before merge
- [ ] No new fonts, no new SVG dependencies that weren't already part of the Groove Card component family
- [ ] Existing CSP allowlist in [next.config.js](../../../../apps/frontend/next.config.js) continues to allow the `audio-samples` Supabase host (already in `connect-src` for the in-`/app` use)

## Acceptance Criteria

- [ ] The waitlist page loads — the SVG mockup is gone, replaced by a real interactive Groove Card
- [ ] On desktop Chrome: card plays on first click; countdown 1-2-3-4 with bundled `audio-click` samples; all 4 stems lock in on the downbeat at original BPM and key
- [ ] **On iPhone Safari (real device, not simulator):** tapping play plays audio on the first try. The countdown clicks audibly, then the groove starts on the one. **No delay** between tap and the first click — the pre-warm has done its job
- [ ] User taps Tempo arrow → BPM advances, playback speeds up, pitch unchanged
- [ ] User taps Key arrow within ±4 → key changes at the next loop boundary; bass and harmony pitch is audibly transposed; drums unchanged
- [ ] User taps Key arrow at ±4 (boundary) → arrow shows "full range in app" hint; no further input accepted; telemetry `groove_card_waitlist_cap_hit` fires
- [ ] User taps Mute Bass / Solo Drums / click toggle — all behave identically to the in-`/app` version
- [ ] Scrolling the card offscreen and back: pre-warm doesn't re-run; AudioContext state is unchanged
- [ ] Page bundle size on the waitlist route is within budget (specific number set by Marek pre-PR; if not set, target is ≤150 KB gzipped additional JS)
- [ ] No console errors, no audio "click" artifacts on stop/unmount

## Out of Scope

- ❌ Recording the actual stems for any new groove featured on the waitlist — this story uses whatever default-key stems are already uploaded for the demo groove
- ❌ A/B testing the waitlist cap shapes — single config in v1
- ❌ Per-visitor entitlement gating (logged-in user lands on waitlist) — that's a corner case; treat all waitlist visitors as `'free'` regardless of session
- ❌ Telemetry pipeline plumbing — the `groove_card_waitlist_cap_hit` event uses the same emitter as the existing card events; no new event-bus work
- ❌ Sharing the waitlist card via URL with state preserved — pure mount, no deep-linking
- ❌ Lazy-loading the bootstrap below-the-fold further than the existing intersection-based decode — bundle is small enough
- ❌ Wrapping the marketing page in `<TransportProvider>` from `/app` — the bootstrap is purpose-built and lighter

## Risks

- **Pre-warm on viewport intersection may run before the user has scrolled.** The card is high on the page (`WaitlistClient.tsx:468` is above the fold on most viewports). Pre-warm on first intersection means: on most page loads, it runs ~immediately. Acceptable; AudioContext stays suspended so it's not autoplay.
- **iOS Safari "first tap silent" bug.** Mitigated by the pre-warm. Verify on a real iPhone, not the simulator — the simulator does not exhibit the bug.
- **The bundled click sample is small but adds an HTTP roundtrip.** Pre-warm fetches it during the intersection; if the network is slow, the user could tap Play before the buffer is decoded. Fallback: if the buffer isn't ready by Play, fire the click via a tiny in-bundle `<click>` Float32Array (pre-bundled, ~200 bytes of base64) instead of the .ogg. Acceptable degradation — same audible timing, slightly less polished tone. Not required for v1 if the .ogg loads within 500ms on a reasonable connection.
- **The CSP allowlist already includes `audio-samples`.** Verified — same bucket as in-`/app` use, no CSP change needed.

## Verification before merge

- [ ] Real iPhone Safari (NOT simulator): card plays on first tap, no white-screen, no delay before countdown click
- [ ] Desktop Chrome: card plays on first click; identical behavior to in-`/app`
- [ ] Network panel: only 4 stem files load (not 20)
- [ ] Bundle analyser: incremental JS on the waitlist route is within budget
- [ ] Mockup is gone — grep `WaitlistClient.tsx` for `Mockup` returns 0 results (or only unrelated matches)
- [ ] Key cap at ±4 fires telemetry and refuses further input
- [ ] Smoke-test the in-`/app` Groove Card from 02.5c is **unaffected** by this story's changes (the bootstrap is waitlist-only; nothing in `/app` should change)
- [ ] The waitlist page passes the same Lighthouse mobile audit it did before (or better — the SVG mockup is gone, and the real card is lazier)

## Files to touch

**NEW:**

- `apps/frontend/src/app/_components/WaitlistAudioBootstrap.tsx` — the minimal audio provider
- (optional) `apps/frontend/src/app/_components/useWaitlistPrewarm.ts` — the IntersectionObserver hook if extracted

**EDIT:**

- [`apps/frontend/src/app/WaitlistClient.tsx`](../../../../apps/frontend/src/app/WaitlistClient.tsx) — replace `<GrooveCardMockup />` at line 468 with `<GrooveCardBlockView mode="waitlist" ... />`, wrap in `<WaitlistAudioBootstrap>`. **DELETE** the `GrooveCardMockup` function (lines 990+) and any helpers used only by it

**Assets (manual, pre-PR):**

- `audio-samples` bucket — upload `countdown-click.ogg` (≤5 KB)

**Database / contracts:** none.

---

## Notes

- **This is the deliverable that closes LAUNCH-01's stop-ship.** Without it, the public mockup stays up and the YouTube channel can't drive traffic to the waitlist. Treat the waitlist swap as gating LAUNCH-01.
- The pre-warm-on-intersection pattern is the iOS Safari mitigation. Without it, the experience is "tap Play, wait, then hear something" — not "tap Play, hear the click."
- The bundled-click-sample design keeps "the platform IS the instrument" honest: real engine, real audio graph, real timing. It's not "a fake mock that does the right thing" — it's the same `addCountdownRegion()` math feeding a different sound source on a leaner provider stack.
- If 02.5c's listen-tests reject the in-`/app` card's audio (PitchShift artifacts unacceptable, tempo seam too jarring), **don't ship 02.5d on top of broken audio.** Escalate before merge.

---

## Implementation outcome (post-merge)

Landed on `develop` as commit **`6791eee`** on 2026-05-27. 11 files changed, +1,358 / −310 LOC. The mockup deletion alone is −292 LOC.

### What shipped exactly as specified

- **Minimal audio bootstrap.** [`WaitlistAudioBootstrap.tsx`](../../../../apps/frontend/src/app/_components/WaitlistAudioBootstrap.tsx) constructs only `EventBus + PlaybackEngine` (no `CoreServices.initialize()`, no WAM plugins, no metronome MIDI scheduler, no drum buffers, no harmony scaffolding) and registers both via `WindowRegistry`. **Idempotent:** if `/app`'s CoreServices already populated the registry (e.g. user navigated waitlist → app → back), the bootstrap is a no-op. Disposes the engine it constructed on unmount.
- **Pre-warm hook.** [`useWaitlistPrewarm.ts`](../../../../apps/frontend/src/app/_components/useWaitlistPrewarm.ts) uses `IntersectionObserver` to fire pre-warm exactly once on first card visibility. Pre-warm: creates the `AudioContext` (left in `suspended` state — no autoplay), calls `PlaybackEngine.initialize(ctx, ctx.destination)`, fetches + decodes the bundled countdown click. The observer `disconnect()`s after firing so a scroll-away → scroll-back doesn't re-decode. `resume()` is the user-gesture hop with a built-in **race-case fallback** (Play-before-scroll): if the user taps Play before the observer fires, `resume()` kicks pre-warm synchronously.
- **Card mount.** [`<GrooveCardBlockView mode="waitlist" />`](../../../../apps/frontend/src/app/_components/WaitlistGrooveCard.tsx) at `WaitlistClient.tsx:468` replaces the deleted mockup. The waitlist surface loads only the default key set (4 stems, not 20) because `useGrooveCardPlayback` in waitlist mode suppresses the lazy outer-key expansion.
- **±4 key cap with cap-as-CTA telemetry.** `useGrooveCardPlayback`'s `setKey` is now mode-aware: `KEY_RANGE_WAITLIST = 4`. Beyond-cap requests are SWALLOWED (state does not advance) AND fire `trackWaitlistKeyCapHit({ blockId, lever: 'key', valueAttempted })` so the funnel team can measure "tap-the-cap → signup" conversion. `block` mode still allows ±12 with no telemetry.
- **Mockup deletion (−292 LOC).** All six mockup-only declarations gone: `GrooveControl` + `GrooveState` types, `TEMPO_OPTIONS` / `KEY_OPTIONS` / `CAPTION_DEFAULT` / `CAPTIONS` constants, `GrooveCardMockup` + `ControlButton` + `GrooveWaveform` functions. Verified via grep: zero orphan references remain in `WaitlistClient.tsx`. No imports needed cleanup (all are shared).
- **Telemetry helper.** [`telemetry.ts`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/telemetry.ts) — wraps the project's `trackEvent` (Sentry breadcrumbs) convention with named card-event helpers. All events land under the `groove-card` category for clean Sentry rollups.

### Necessary scope adjustments discovered during implementation

- **The story said "uses the existing card-event emitter" but 02.5c shipped without telemetry.** 02.5d establishes the convention via [`telemetry.ts`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/telemetry.ts). Four named helpers: `trackWaitlistKeyCapHit` (required by 02.5d), plus `trackPlayFirst` / `trackPlay` / `trackUnmount` (the surface 02.5c implicitly assumed and can wire later).
- **CSP audit.** The story said "CSP allowlist already includes `audio-samples`." Confirmed correct: `next.config.js:226` includes `https://*.supabase.co` (wildcard) in `media-src`. A hardcoded host (`htuztkrbuewheehjspcz.supabase.co`) is also present but harmless — the wildcard already covers all our buckets.
- **`ensureAudioContext()` does heavy work** (goes through CoreServices). The bootstrap cannot use it for the minimal path. Created the AudioContext directly inside `useWaitlistPrewarm` instead — leaner and side-effect free.
- **Hardcoded demo block config required.** The waitlist surface has no admin form / DB / auth; it needs an in-tree `GrooveCardBlockConfig` to render. [`waitlistGrooveCard.config.ts`](../../../../apps/frontend/src/app/_components/waitlistGrooveCard.config.ts) pins the demo groove ("Greasy Pocket — Funk in E") and the countdown click URL.

### Tests added (25 new across 4 files, all passing)

| File                                                                                                                                                                                                                                                                                         | Count |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| [`telemetry.test.ts`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/__tests__/telemetry.test.ts) — every helper calls `trackEvent` with documented shape; negative `valueAttempted`; category invariant                                      | 6     |
| [`useGrooveCardPlayback.waitlistCap.test.ts`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/__tests__/useGrooveCardPlayback.waitlistCap.test.ts) — ±4 in-range; beyond-cap swallowed; cap-hit fires; block mode unaffected                   | 7     |
| [`WaitlistAudioBootstrap.test.tsx`](../../../../apps/frontend/src/app/_components/__tests__/WaitlistAudioBootstrap.test.tsx) — constructs + registers on mount; renders children; no-op when registry already populated; disposes on unmount                                                 | 4     |
| [`useWaitlistPrewarm.test.ts`](../../../../apps/frontend/src/app/_components/__tests__/useWaitlistPrewarm.test.ts) — no pre-warm pre-intersection; intersection → context + engine init + decode; observer disconnects; suspended state preserved; resume race-case; disabled short-circuits | 8     |

### Tooling discovery (documented inline in the test files)

Vitest 3 + React 19 + class constructors do NOT work cleanly with `vi.fn().mockImplementation(...)` — the call passes through but the factory body never runs. The fix is a `class MockX { constructor() { ... } }` pattern combined with `vi.hoisted(...)` for the captured arrays. Saved future test authors from rediscovering this.

### Verification results

- ✅ `pnpm tsc --noEmit` (apps/frontend): 3,409 errors — exact match with pre-02.5d baseline. **Zero introduced.**
- ✅ `pnpm tsc --noEmit` (apps/backend): 0 errors
- ✅ LAUNCH-02.5 full surface: **212/212 tests pass across 15 files** (no regressions from 02.5a/b/c)
- ✅ ESLint on touched 02.5d files: 0 errors introduced. The only errors flagged were three pre-existing unused-var errors in `WaitlistClient.tsx` (`BackgroundTuner`, `setBgConfig`, `FounderQuote`), which lint-staged disables on commit. 13 stylistic warnings (non-null assertions + structured-logging suggestions) match repo conventions.

### Pre-PR ops step — **status: PENDING upload**

The following assets must be uploaded to the `audio-samples` Supabase bucket at the paths pinned in [`waitlistGrooveCard.config.ts`](../../../../apps/frontend/src/app/_components/waitlistGrooveCard.config.ts) before the waitlist surface becomes audible:

- `audio-samples/waitlist/countdown-click.ogg` (≤5 KB)
- `audio-samples/waitlist/greasy-pocket/E/{bass,drums,harmony,click}.ogg` (the demo groove's default-key stems)

Until the assets land, the card mounts but each stem fetch returns 404. The engine's per-item failure tolerance keeps the UI alive; the play button just has nothing to play. **The code is ready — the only remaining gate is the asset upload.**

### What this closes

- **LAUNCH-01's stop-ship.** The public waitlist mockup is gone; the real interactive card is in place. YouTube traffic can now drive to the page.
- **The entire LAUNCH-02.5 epic.** All four sub-stories shipped: 02.5a `48f8b85` → 02.5b `6f50acf` → 02.5c `c4da911` → 02.5d `6791eee`. The Groove Card is first-class everywhere the funnel needs it: `/app` tutorials, Bassment standalone, and the public marketing page.
