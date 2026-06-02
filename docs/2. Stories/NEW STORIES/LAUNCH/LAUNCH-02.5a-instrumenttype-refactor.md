# [LAUNCH-02.5a] `InstrumentType` Canonical Refactor

**Parent:** [LAUNCH-02.5 (epic)](./LAUNCH-02.5-groove-card-block.md) • [Launch Backlog](./README.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~2 working days
**Status:** ✅ Done — shipped 2026-05-27 on `develop` as commit `48f8b85`
**Blocks:** [LAUNCH-02.5b](./LAUNCH-02.5b-audio-stems-daw-peers.md) (and transitively 02.5c, 02.5d) — _unblocked_
**Depends on:** nothing
**The thing this story is:** the type-system pre-work that makes audio stems addressable in the existing DAW. Pure refactor; no new feature, no UI, no runtime behavior change. Lands silently and unblocks everything else.

---

## Why this exists as its own story

`InstrumentType` is declared **5 times across 5 files with 3 different value sets** (plus `voiceCue` vs `voice-cue` casing drift), plus **3 broken re-export/import sites** pointing to a deleted path. The codebase compiles only because nothing currently hits the broken paths at type-check time. Widening any one declaration without consolidating leaves the duplication problem alive and forces re-edits every time a new instrument type is added.

This story lands the consolidation in isolation, with no feature riding on top, so type-check + test pass is the entire merge gate.

## Current state (audit)

| File                                                                                                                                     | Values                                                                   | Status                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| [TrackManagerProcessor.ts:79](../../../../apps/frontend/src/domains/playback/modules/tracks/management/TrackManagerProcessor.ts#L79)     | `metronome \| drums \| bass \| chords \| melody \| voice-cue \| unknown` | **Widest set — pick as canonical** |
| [InstrumentLifecycleManager.ts:19](../../../../apps/frontend/src/domains/playback/modules/lifecycle/InstrumentLifecycleManager.ts#L19)   | `bass \| drums \| chords \| metronome \| voice-cue`                      | Delete, import canonical           |
| [PreloadableInstrumentRegistry.ts:15](../../../../apps/frontend/src/domains/playback/services/core/PreloadableInstrumentRegistry.ts#L15) | `metronome \| drums \| harmony \| bass \| voice-cue`                     | Delete, import canonical           |
| [Scheduler.ts:27](../../../../apps/frontend/src/domains/playback/services/core/Scheduler.ts#L27)                                         | `metronome \| drums \| harmony \| bass \| voiceCue` (camelCase!)         | Delete, import canonical           |
| [InstrumentRegistry.ts:14](../../../../apps/frontend/src/domains/playback/services/core/InstrumentRegistry.ts#L14)                       | `drums \| bass \| harmony \| metronome \| voice-cue`                     | Delete, import canonical           |
| [modules/shared/index.ts:32](../../../../apps/frontend/src/domains/playback/modules/shared/index.ts#L32)                                 | Re-exports from `services/plugins/TrackManagerProcessor.js`              | **Path no longer exists — fix**    |
| [TrackEntity.ts:9](../../../../apps/frontend/src/domains/playback/repositories/entities/TrackEntity.ts#L9)                               | Imports from same broken path                                            | **Path no longer exists — fix**    |
| [TrackRepositoryStore.ts:12](../../../../apps/frontend/src/domains/playback/repositories/track/TrackRepositoryStore.ts#L12)              | Imports from same broken path                                            | **Path no longer exists — fix**    |

`harmony` vs `chords` is already bridged at runtime in [usePatternRegistration.ts:17-22](../../../../apps/frontend/src/domains/widgets/hooks/usePatternRegistration.ts#L17-L22) (note: lives under `domains/widgets/hooks/`, not `playback/hooks/`). The canonical definition should include **both** so the bridge becomes a no-op.

## The canonical type

Replaces the declaration at [TrackManagerProcessor.ts:79](../../../../apps/frontend/src/domains/playback/modules/tracks/management/TrackManagerProcessor.ts#L79):

```ts
export type MidiInstrumentType =
  | 'metronome'
  | 'drums'
  | 'bass'
  | 'chords'
  | 'harmony'
  | 'melody'
  | 'voice-cue';

export type AudioInstrumentType =
  | 'audio-bass'
  | 'audio-drums'
  | 'audio-harmony'
  | 'audio-click';

export type InstrumentType =
  | MidiInstrumentType
  | AudioInstrumentType
  | 'unknown';
```

## Pre-existing gaps the consolidation will surface

These are not invented by this story — they're already broken, just hidden by the duplication. Consolidating to the canonical type _causes the compiler to notice them_. Adding them is part of this story's scope:

- **`triggerMethodMap` at [InstrumentAdapter.ts:186](../../../../apps/frontend/src/domains/playback/modules/instruments/base/InstrumentAdapter.ts#L186) is typed `Record<InstrumentType, string>` but only has entries for `bass | drums | metronome | chords | melody | unknown`.** Missing: `harmony`, `voice-cue`. Compiles today only because the locally-imported `InstrumentType` happens to be narrower than canonical. Once consolidated, both must be added (in addition to the 4 audio-stem entries).
- The same risk exists for any other `Record<InstrumentType, ...>` in the codebase. The acceptance criteria includes a grep step to catch any others.

## Files to edit (11 total, all under `apps/frontend/src/domains/playback/`)

1. **EDIT:** [`modules/tracks/management/TrackManagerProcessor.ts`](../../../../apps/frontend/src/domains/playback/modules/tracks/management/TrackManagerProcessor.ts) — define the three canonical types at line 79; extend `NAME_PATTERNS` (line 268) with 4 new entries for the audio stems — **empty arrays `[]`, NOT regexes** (regexes would auto-misclassify MIDI tracks containing words like "bass")
2. **EDIT:** [`modules/shared/index.ts`](../../../../apps/frontend/src/domains/playback/modules/shared/index.ts) — fix the broken re-export at line 32 to point at the canonical path
3. **EDIT:** [`repositories/entities/TrackEntity.ts`](../../../../apps/frontend/src/domains/playback/repositories/entities/TrackEntity.ts) — fix the broken import at line 9
4. **EDIT:** [`repositories/track/TrackRepositoryStore.ts`](../../../../apps/frontend/src/domains/playback/repositories/track/TrackRepositoryStore.ts) — fix the broken import at line 12 (third reference to the deleted path)
5. **EDIT:** [`modules/lifecycle/InstrumentLifecycleManager.ts`](../../../../apps/frontend/src/domains/playback/modules/lifecycle/InstrumentLifecycleManager.ts) — delete local declaration at line 19, `import type { InstrumentType } from ...`
6. **EDIT:** [`services/core/PreloadableInstrumentRegistry.ts`](../../../../apps/frontend/src/domains/playback/services/core/PreloadableInstrumentRegistry.ts) — same pattern
7. **EDIT:** [`services/core/Scheduler.ts`](../../../../apps/frontend/src/domains/playback/services/core/Scheduler.ts) — delete local declaration at line 27 (resolving the `voiceCue` camelCase split in favour of `voice-cue` kebab); extend `INSTRUMENT_CONFIGS` (line 82) with 4 new audio-stem entries. **Each audio-stem entry's `loggerName` must contain the literal string `'(stub — wire in 02.5b)'`** so anyone grepping logs between this story and 02.5b sees the explicit "not wired yet" marker.
8. **EDIT:** [`services/core/InstrumentRegistry.ts`](../../../../apps/frontend/src/domains/playback/services/core/InstrumentRegistry.ts) — same pattern
9. **EDIT:** [`services/core/PlaybackEngine.ts`](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts) — widen 5 method signatures from `'metronome' | 'drums' | 'bass' | 'harmony'` to `MidiInstrumentType | AudioInstrumentType`:
   - `getOrCreateInstrumentGainNode` (line 2323)
   - `setInstrumentVolume` (line 2372)
   - `setInstrumentMuted` (line 2409)
   - `isInstrumentMuted` (line 2443)
   - `getInstrumentVolume` (line 2452)

   **No internal refactor required** — storage is already `Map<string, GainNode>` ([line 218](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts#L218)), no switch statements, no `assertNever` exhaustiveness checks. Pure signature widening.

10. **EDIT:** [`modules/instruments/base/InstrumentAdapter.ts`](../../../../apps/frontend/src/domains/playback/modules/instruments/base/InstrumentAdapter.ts) — extend `triggerMethodMap` (line 186) with **6 new entries**: the 4 audio stems + the pre-existing-gap `harmony` and `voice-cue`. Audio-stem entries can be a stub like `'triggerAudioStem'` (the audio stems don't go through MIDI trigger methods, but the map needs to be exhaustive over `InstrumentType`).
11. **EDIT:** [`modules/audio-engine/core/OptimizedToneLoader.ts`](../../../../apps/frontend/src/domains/playback/modules/audio-engine/core/OptimizedToneLoader.ts) — add 4 `case` branches at line 319. Audio stems don't need Tone synth modules loaded (they're buffer playback), so each case can early-return with no modules.

**The ~30 narrow MIDI-only literal unions across ~14 feature files** (MidiDropZone, SessionModel, InstrumentAssetOptimizer, pattern repository/selector/components, etc.) **do not need to change for this story** — they describe MIDI-side widget plumbing that audio stems don't pass through. Leave them; fix later when those callers grow audio-stem awareness.

## Landing order

1. Define canonical types in `TrackManagerProcessor.ts`, fix 3 broken import paths.
2. Delete the 4 duplicate declarations, re-import.
3. Widen 5 `PlaybackEngine` signatures.
4. Extend `INSTRUMENT_CONFIGS`, `triggerMethodMap` (including pre-existing `harmony`/`voice-cue` gaps), `NAME_PATTERNS`, `OptimizedToneLoader` switch.
5. Type-check both apps (`pnpm tsc --noEmit` in each), run `pnpm test:frontend`.

## The audio-stem engine interface (contract pin for 02.5b/c parallelization)

This story locks in the public engine surface that 02.5b will implement and 02.5c will consume. Adding it here (not in 02.5b) lets the two parallelize the easy parts: 02.5c can scaffold against the interface while 02.5b implements it.

**NEW:** `apps/frontend/src/domains/playback/services/core/IAudioStemEngine.ts` (or co-located in PlaybackEngine.ts as a type export):

```ts
export interface IAudioStemEngine {
  /** Load decoded AudioBuffers for each stem. Idempotent — replacing previous buffers stops any in-flight source for that stem. */
  setAudioStemBuffers(
    stems: Partial<Record<AudioInstrumentType, AudioBuffer>>,
  ): void;

  /** Start audio stems against the master transport time. Caller must have called registerTracks first. */
  startAudioStems(): void;

  /** Stop all audio stems with a 5ms gain ramp-down to avoid clicks. */
  stopAudioStems(): void;

  /** Unregister all tracks whose trackId begins with the given prefix. Used by Groove Card per-card cleanup. */
  unregisterTracksByPrefix(prefix: string): void;
}
```

`PlaybackEngine` will implement this interface in 02.5b. This story only declares the interface — no implementation, no behavior change.

## Requirements

### Functional

- [ ] Canonical types defined: `MidiInstrumentType`, `AudioInstrumentType`, `InstrumentType = MidiInstrumentType | AudioInstrumentType | 'unknown'`
- [ ] 4 duplicate local declarations deleted (`InstrumentLifecycleManager.ts:19`, `PreloadableInstrumentRegistry.ts:15`, `Scheduler.ts:27`, `InstrumentRegistry.ts:14`); each file imports the canonical type
- [ ] 3 broken import paths fixed: `TrackEntity.ts:9`, `modules/shared/index.ts:32`, `repositories/track/TrackRepositoryStore.ts:12`
- [ ] 5 `PlaybackEngine` method signatures widened (lines 2323, 2372, 2409, 2443, 2452)
- [ ] `INSTRUMENT_CONFIGS` (Scheduler.ts:82) extended with 4 audio-stem entries; **each `loggerName` contains `'(stub — wire in 02.5b)'`**
- [ ] `triggerMethodMap` (InstrumentAdapter.ts:186) extended with **6** entries: 4 audio stems + pre-existing-gap `harmony` + `voice-cue`
- [ ] `NAME_PATTERNS` (TrackManagerProcessor.ts:268) extended with 4 audio-stem entries — **all empty arrays `[]`, no regexes**
- [ ] `OptimizedToneLoader.ts:319` switch extended with 4 `case` branches, each early-returning (no Tone synth modules)
- [ ] `IAudioStemEngine` interface declared as the contract for 02.5b
- [ ] Grep-verified: no other `Record<InstrumentType, ...>` in the codebase that breaks after consolidation. If any found, extend appropriately.

### Non-functional

- [ ] Both apps type-check clean: `pnpm tsc --noEmit` in `apps/frontend` and `apps/backend`
- [ ] `pnpm test:frontend` passes — no test changes required, this is signature-only widening
- [ ] No DB migration touched (verified: zero Supabase enum references to `instrument_type`)
- [ ] No Zod schema mirror in `libs/contracts` to update (verified)

## Acceptance Criteria

- [ ] Type-check on both apps passes after the canonical type lands
- [ ] Existing test suite passes unchanged
- [ ] Searching the codebase for `'metronome' | 'drums' | 'bass' | 'harmony'` (the narrow 4-literal union) returns ≤17 hits, none of which are in the playback engine core or any `Record<InstrumentType, ...>`
- [ ] `'audio-bass' | 'audio-drums' | 'audio-harmony' | 'audio-click'` are valid `InstrumentType` values; passing one to `playbackEngine.setInstrumentMuted('audio-bass', true)` compiles
- [ ] `IAudioStemEngine` interface exists and is exported; 02.5b's PR can `implements IAudioStemEngine` against `PlaybackEngine` without further type changes

## Out of Scope

- ❌ Any `AudioPlayerScheduler` / `setAudioStemBuffers` _implementation_ — that's [02.5b](./LAUNCH-02.5b-audio-stems-daw-peers.md)
- ❌ Widening the ~30 narrow MIDI-only literal unions in widget plumbing — they don't touch audio stems; revisit when relevant
- ❌ Renaming `voiceCue` → `voice-cue` in any caller-side code outside `Scheduler.ts` — the canonical type's `voice-cue` kebab is sufficient; existing camelCase callers are pre-existing tech debt
- ❌ Any UI, any new feature, any new behavior
- ❌ A `Mixer.ts` refactor — the Mixer is live in production but does not reference `InstrumentType` (verified), so widening has zero impact on it

## Risks

- **Pre-existing `triggerMethodMap` gap surfacing.** Mitigation: this story's checklist requires adding `harmony` and `voice-cue` entries explicitly. If a reviewer flags "but this isn't audio-stem work" — that's correct, but it's the natural cost of the consolidation; trying to do the consolidation without fixing these will fail type-check.
- **Reviewer scope drift.** This is a refactor with no feature value visible to a non-technical reviewer. Frame the PR as "unblocks 02.5b/c/d; type-check passing is the entire merge gate."

## Verification before merge

- [ ] `pnpm tsc --noEmit` in `apps/frontend` — clean
- [ ] `pnpm tsc --noEmit` in `apps/backend` — clean
- [ ] `pnpm test:frontend` — passes
- [ ] `pnpm lint:fix` — no new lint errors
- [ ] Manual grep: `'audio-` returns the new InstrumentType members and (for the next story's benefit) is grep-discoverable
- [ ] Manual grep: `services/plugins/TrackManagerProcessor` — 0 hits (all 3 broken paths fixed)

---

## Notes

- This story has **no demo, no acceptance test you can show a stakeholder, no user-visible change.** Its value is unblocking everything downstream and removing 3 broken imports that compile by accident. Resist the temptation to bundle it into 02.5b — when 02.5b's PR has a problem, you want to know it's in the new code, not the refactor.
- The `(stub — wire in 02.5b)` markers in `loggerName` strings are intentional. Between this story shipping and 02.5b shipping, if anything ever fires an `audio-*` event into Scheduler (it shouldn't — nothing creates audio tracks yet), the log line will say exactly what's wrong. **Update:** 02.5b removed these markers when the real audio-stem path landed; the Scheduler.test.ts exhaustiveness assertion was flipped to "marker is gone."

---

## Implementation outcome (post-merge)

Landed on `develop` as commit **`48f8b85`** on 2026-05-27. 17 files changed, +379 / −49 LOC.

### What shipped exactly as specified

- Canonical types defined in [`TrackManagerProcessor.ts`](../../../../apps/frontend/src/domains/playback/modules/tracks/management/TrackManagerProcessor.ts): `MidiInstrumentType` (7 literals), `AudioInstrumentType` (4 literals), `InstrumentType = MidiInstrumentType | AudioInstrumentType | 'unknown'`.
- 4 duplicate local `InstrumentType` declarations deleted; each file now imports the canonical type. `Scheduler.ts`'s `voiceCue` camelCase resolved in favour of the canonical `'voice-cue'` kebab — including the renamed `INSTRUMENT_CONFIGS['voice-cue']` key and the corresponding `Scheduler.test.ts` assertion.
- 3 broken import paths fixed (the `services/plugins/TrackManagerProcessor` ghost path is gone — `grep "services/plugins/TrackManagerProcessor"` returns 0 hits across the frontend).
- 5 `PlaybackEngine` method signatures widened to `MidiInstrumentType | AudioInstrumentType`.
- `triggerMethodMap` extended with 6 entries (4 audio stems + the pre-existing `harmony` / `voice-cue` gaps).
- `OptimizedToneLoader.preloadForInstrument` switch extended with 4 `case` branches that early-return (no Tone synth modules — audio stems don't need them).
- `IAudioStemEngine` interface declared in [`services/core/IAudioStemEngine.ts`](../../../../apps/frontend/src/domains/playback/services/core/IAudioStemEngine.ts) as the 02.5b contract pin — implemented by `PlaybackEngine` in 02.5b.

### Necessary scope adjustments discovered during implementation

These weren't in the original story but the consolidation forced them:

- **`INSTRUMENT_CONFIGS` (Scheduler.ts) needed `chords`, `melody`, and `unknown` entries**, not just the 4 audio-stem entries. The pre-consolidation type only had 5 of the 7 MIDI instruments, so widening to canonical required adding entries the existing code never used. Added as no-event-mapping stubs with `loggerName: '…Scheduler (stub — unused)'`.
- **`NAME_PATTERNS` (TrackManagerProcessor.ts) needed empty-array entries for `harmony` and `voice-cue` too** — same pre-existing-gap pattern as `triggerMethodMap`. All audio-stem entries are empty arrays (regexes would misclassify MIDI tracks named "bass" into `audio-bass`).
- **3 InstrumentType-adjacent pre-existing errors** the canonical type unmasked were fixed: `types/track.ts` now re-exports `InstrumentType` so consumers of `import { InstrumentType } from '../types/track.js'` resolve correctly; `useTrackMigration.ts`'s default `trackType = 'instrument'` → `'unknown'`; `MetronomeWidget.tsx`'s `type: 'utility'` → `type: 'metronome'`. Per user direction these were judged in-scope because they were directly caused by the consolidation surfacing pre-existing invalid literals.

### Tests added (37 new, all passing)

- [`modules/tracks/__tests__/InstrumentType.canonical.test.ts`](../../../../apps/frontend/src/domains/playback/modules/tracks/__tests__/InstrumentType.canonical.test.ts) — 20 tests covering union literal membership; type assignability via `expectTypeOf<MidiInstrumentType>().toMatchTypeOf<InstrumentType>()`; `NAME_PATTERNS` no-misclassify guarantee (e.g. a track named "bass" still classifies as `bass`, not `audio-bass`); `IAudioStemEngine` interface shape pin.
- [`services/core/__tests__/Scheduler.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/__tests__/Scheduler.test.ts) — 17 new tests under "Canonical InstrumentType exhaustiveness (LAUNCH-02.5a)": `INSTRUMENT_CONFIGS` has entries for all 7 MIDI + 4 audio + `unknown` keys; each audio-stem entry's `loggerName` carried the `(stub — wire in 02.5b)` marker (subsequently flipped by 02.5b to assert the marker is gone); the `voiceCue` camelCase key is absent.

### Verification results

- ✅ `pnpm tsc --noEmit` (apps/frontend): zero refactor-introduced errors; the 3406 pre-existing total stayed unchanged at the refactor surface
- ✅ `pnpm tsc --noEmit` (apps/backend): 0 errors total
- ✅ All affected tests pass: 62 Scheduler + 20 InstrumentType.canonical + the existing playback test suite
- ✅ `pnpm lint:fix` on touched files: 0 errors; the only warnings are repo-wide style conventions (non-null assertions, etc.) that exist in unmodified neighbors
- ✅ All four story acceptance greps pass: `'services/plugins/TrackManagerProcessor'` → 0 hits; `'audio-*'` literals → 24 grep-discoverable hits; the narrow `'metronome' | 'drums' | 'bass' | 'harmony'` union → 1 remaining hit in `domains/admin/components/MidiDropZone.tsx` (≤17 budget, not in engine core, not inside any `Record<InstrumentType, …>`); `IAudioStemEngine.ts` exists and is exported

### Adjacent files touched beyond the 11-file spec

- [`types/track.ts`](../../../../apps/frontend/src/domains/playback/types/track.ts) — added `export type { InstrumentType }` so the 3 hook callers (`useTrack.ts`, `useTrackMigration.ts`, `usePatternRegistration.ts`) that import from this barrel keep compiling.
- [`hooks/useTrackMigration.ts`](../../../../apps/frontend/src/domains/playback/hooks/useTrackMigration.ts) — default `trackType` changed from `'instrument'` (never a valid `InstrumentType`) to `'unknown'`.
- [`domains/widgets/components/YouTubeWidgetPage/MetronomeWidget/MetronomeWidget.tsx`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/MetronomeWidget/MetronomeWidget.tsx) — `type: 'utility'` → `type: 'metronome'` (semantically correct; the widget IS a metronome).

The broader ~30 narrow MIDI-only literal unions in widget plumbing were intentionally left for later, per the original Out-of-Scope section.
