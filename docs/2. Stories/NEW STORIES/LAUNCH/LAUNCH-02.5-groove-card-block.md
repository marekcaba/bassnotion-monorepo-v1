# [LAUNCH-02.5] Groove Card Block — Epic

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~12-15 working days, split across 4 sub-stories
**Status:** ✅ Done — all four sub-stories shipped on `develop` between commits `48f8b85` → `6791eee` on 2026-05-27
**Blocks:** [LAUNCH-01](./LAUNCH-01-whitelist-page.md) (via 02.5d) • [LAUNCH-02](./LAUNCH-02-capped-levers.md) (via 02.5c) • [LAUNCH-05](./LAUNCH-05-playback-polish.md) Fix 1 (via 02.5c) — _all unblocked_

---

## The thing this epic is

The Groove Card is the ground-base playback container that every other launch story plugs into. The card _is_ the instrument. Get this right and Membership has a body to sell, the waitlist has a real demo, and the capped levers have a home.

The work was originally drafted as one ~780-line story. After investigation it was clear that combining the audio-engine refactor, the novel infinite-loop scheduler, the card UI, and the waitlist embed into a single PR would produce something un-reviewable. The split below preserves the original architectural decisions while making each piece independently shippable.

## The four sub-stories

### [LAUNCH-02.5a — `InstrumentType` Canonical Refactor](./LAUNCH-02.5a-instrumenttype-refactor.md) ✅ Done — `48f8b85`

**~2 days • depends on nothing • blocks 02.5b**

The type-system pre-work. `InstrumentType` is declared 5 times across 5 files with 3 different value sets, plus 3 broken re-export/import sites that compile only by accident. This story consolidates them, widens 5 `PlaybackEngine` signatures, extends 4 lookup tables (`INSTRUMENT_CONFIGS`, `triggerMethodMap`, `NAME_PATTERNS`, `OptimizedToneLoader`), and pins the `IAudioStemEngine` interface as the contract that 02.5b implements.

**No feature, no UI, no runtime change.** Type-check passing is the entire merge gate. Lands silently and unblocks everything else.

### [LAUNCH-02.5b — Audio Stems as First-Class DAW Peers](./LAUNCH-02.5b-audio-stems-daw-peers.md) ✅ Done — `6f50acf`

**~3-4 days • depends on 02.5a • blocks 02.5c**

The audio-engine work. New `AudioPlayerScheduler`, one branch in `EventRouter`, four new methods on `PlaybackEngine` (`setAudioStemBuffers`, `startAudioStems`, `stopAudioStems`, `unregisterTracksByPrefix`), and the **novel infinite-loop scheduling algorithm** in `RegionScheduler` with its explicit risk register.

No UI. Verified structurally by unit tests + an integration fixture. Acoustic verification (crossfade seam, tempo displacement, PitchShift artifacts) is **deferred to 02.5c's listen-test** — flagged explicitly in 02.5b's PR description so reviewers don't expect a working card.

The single biggest design call across this epic lives here.

### [LAUNCH-02.5c — Groove Card Block (in `/app`)](./LAUNCH-02.5c-groove-card-in-app.md) ✅ Done — `c4da911`

**~5-6 days • depends on 02.5a + 02.5b • blocks LAUNCH-02, LAUNCH-05 Fix 1, 02.5d**

The product surface. Block contract (`'groove-card'` in `BlockType`), admin form, card component family (shell + waveform + controls + hook + preloader + `pickKeySet`), entitlement stub (`useEntitlement`, contracts `billing.ts`), key/pitch logic, active-card coordination with per-card track cleanup, tempo via `MusicalTruthAuthority`. Renders inside any tutorial in `/app`. **The waitlist mockup at `WaitlistClient.tsx:468` stays in place** — that swap is 02.5d.

This story also closes 02.5b's deferred acoustic verification — the PitchShift artifact listen-test, the tempo-change seam audit, the crossfade quality check all happen here.

### [LAUNCH-02.5d — Waitlist Embed Swap](./LAUNCH-02.5d-waitlist-embed-swap.md) ✅ Done — `6791eee`

**~2-3 days • depends on 02.5c • blocks LAUNCH-01 — _closed_. Pending pre-PR asset upload before audio becomes audible (countdown-click.ogg + 4 demo stems in `audio-samples/waitlist/`).**

The marketing-page deliverable that closes LAUNCH-01's stop-ship. Mockup → real card on the public waitlist. Includes the minimal `WaitlistAudioBootstrap` (the marketing page has no `AudioProvider`, so the engine must be brought in as a lightweight purpose-built provider), the bundled `countdown-click.ogg` (pre-PR ops step), the `IntersectionObserver` pre-warm for iOS Safari, the ±4 key cap with telemetry, and the mockup deletion.

The iOS Safari "first tap silent" mitigation lives here — verified on a real iPhone (not simulator).

## Dependency graph

```
02.5a (refactor)  ──►  02.5b (engine)  ──►  02.5c (card in /app)  ──►  02.5d (waitlist swap) ──► unblocks LAUNCH-01
                                                  │
                                                  ├──► unblocks LAUNCH-02 (capped levers consume the card's useEntitlement call sites)
                                                  └──► unblocks LAUNCH-05 Fix 1 (single play-button loading state targets the card)
```

The chain is strictly serial. **Parallelization opportunity:** 02.5c can scaffold against the `IAudioStemEngine` interface (pinned in 02.5a) while 02.5b implements it. But 02.5c cannot merge until 02.5b is in — the hook references methods that don't exist otherwise.

## How the sub-stories complement each other

- **02.5a → 02.5b:** 02.5a declares `AudioInstrumentType` and the `IAudioStemEngine` interface. 02.5b's `AudioPlayerScheduler` and `PlaybackEngine.setAudioStemBuffers` are the implementation. Without 02.5a, 02.5b's code does not type-check.
- **02.5b → 02.5c:** 02.5b ships `setAudioStemBuffers`, `startAudioStems`, `stopAudioStems`, `unregisterTracksByPrefix`. 02.5c's `useGrooveCardPlayback` hook consumes all four. The per-card track cleanup contract — central to two-cards-on-page coordination — only works because 02.5b ships `unregisterTracksByPrefix`. Without that explicit deliverable, 02.5c either grows engine scope or papers over with ad-hoc loops.
- **02.5c → 02.5d:** 02.5c builds `<GrooveCardBlockView>` with `mode` already as a prop (`'block' | 'waitlist'`). 02.5d adds the waitlist-specific bootstrap and asset; the component itself doesn't fork. The hook's optional `countdownClickUrl` prop is added in 02.5c, consumed in 02.5d.
- **02.5b's deferred acoustic verification → 02.5c's listen-test:** 02.5b can't validate seam quality without UI; 02.5c's verification checklist explicitly includes the PitchShift artifact audit, the tempo-change displacement audit, and the crossfade quality check. If any fails at 02.5c, the fix is in 02.5b (or scope reduction) — not in 02.5c.

## What landed in the original story but lives in the sub-stories now

The 4 sub-stories together cover everything the original ~780-line story specified. The notable evolutions during investigation:

- **The countdown caveat for the waitlist** — added because the original assumption ("countdown inherited for free") was only true inside `/app`. 02.5d's bootstrap + bundled click solves it without dragging the whole `/app` audio pipeline onto the marketing page.
- **The active-card track-cleanup contract** — the original story's Zustand flag alone was insufficient; cards share one `PlaybackEngine`. Added explicit `unregisterTracksByPrefix` as a 02.5b deliverable.
- **The infinite-loop scheduler's risk register** — the original story claimed the pattern was "verified live" by citing `BeatEmitter.ts:194`; that file actually uses `scheduleRepeat`, not the self-rescheduling pattern. 02.5b honestly frames the algorithm as novel and ships the generation-counter / stop-during-pending test.
- **Backend Zod URL host validation** — original said "stem URLs pointing into the `audio-samples` bucket host"; staging and production project refs differ (per [CLAUDE.md](../../../../CLAUDE.md)). 02.5c validates the **path pattern** `/storage/v1/object/public/audio-samples/...`, host-agnostic.
- **Pre-existing gaps surfaced by the InstrumentType consolidation** — `triggerMethodMap` is missing `harmony` and `voice-cue` today; compiles only because of the duplicate-declarations problem. 02.5a's checklist explicitly includes adding these alongside the audio-stem entries.
- **Mixer is live in production**, not "scaffolded but never reached." The story originally claimed otherwise. 02.5c follows the established widget pattern (sibling-muting via `setInstrumentMuted`) rather than coupling to `Mixer.setSolo()`.
- **Tempo-change-mid-loop seam** — honestly described as a real artifact, not "masked by 10ms crossfade." 02.5c's listen-test gates merge.

## Cross-story merge sequencing

Recommended order — strictly serial:

1. **02.5a lands first.** Type-check on both apps. No feature visible. PR description: "Unblocks 02.5b/c/d; type-check passing is the entire merge gate."
2. **02.5b lands second.** All structural unit tests pass. Acoustic verification deferred. PR description: "Listen-test deferred to 02.5c; this PR is correctness-only."
3. **02.5c lands third.** Includes the acoustic listen-tests as merge gates. If a listen-test fails, fix in code OR narrow the budget (PitchShift) — don't ship a broken acoustic experience.
4. **02.5d lands fourth.** Real iPhone Safari verification. Mockup deletion in the same PR as the swap. Closes LAUNCH-01's stop-ship.

LAUNCH-02 (capped levers), LAUNCH-05 Fix 1 (play-button loading state), and LAUNCH-01 (waitlist polish/CTA work) can each start work as soon as their minimum predecessor set ships, **without** waiting for the full 02.5 epic to complete. See each downstream story's `Depends on:` line for specifics.

---

## Notes

- This is the ground floor. LAUNCH-01, LAUNCH-02, and LAUNCH-05 all assume the card exists. Ship 02.5a/b/c/d in order, then those land cleanly on top.
- The naming asymmetry between the existing `groove` block type (YouTube-synced full performance) and the new `groove-card` block type is intentional — they're different products. The old `groove` block stays; this one is the interactive instrument. Don't merge them.
- **The biggest design risk lives in 02.5b** (the novel infinite-loop scheduler). The biggest product risk lives in 02.5c (PitchShift artifacts, tempo seam) and 02.5d (iOS Safari first-tap). Match QA effort accordingly.
- The waitlist-lite version (02.5d) is the deliverable that closes LAUNCH-01's stop-ship. **Treat its merge as gating LAUNCH-01** — without it, the public mockup stays up and the YouTube channel still can't drive traffic.
