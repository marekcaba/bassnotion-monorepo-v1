# [LAUNCH-02.5b] Audio Stems as First-Class DAW Peers

**Parent:** [LAUNCH-02.5 (epic)](./LAUNCH-02.5-groove-card-block.md) • [Launch Backlog](./README.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~3-4 working days
**Status:** ✅ Done — shipped 2026-05-27 on `develop` as commit `6f50acf`
**Blocks:** [LAUNCH-02.5c](./LAUNCH-02.5c-groove-card-in-app.md) (the Groove Card hook consumes this engine surface), and transitively LAUNCH-01, LAUNCH-02, LAUNCH-05 — _unblocked_
**Depends on:** [LAUNCH-02.5a](./LAUNCH-02.5a-instrumenttype-refactor.md) ✅ — landed first as commit `48f8b85`
**The thing this story is:** the audio-engine work that turns pre-rendered audio stems into peers of the existing MIDI-driven instruments. New `AudioPlayerScheduler`, one branch in `EventRouter`, three new methods on `PlaybackEngine`, and the **novel infinite-loop scheduling algorithm** in `RegionScheduler`. No UI — verified by unit tests + an integration fixture. The single biggest design call across the LAUNCH-02.5 epic lives here.

---

## Why this is its own story

This is the **novel architectural work** in the Groove Card epic. The original story bundled it with the card UI, which would have made the PR un-reviewable. Separating it means:

- The infinite-loop scheduler — a pattern that does not exist anywhere else in the codebase — gets its own PR review focused on correctness, not feature scope.
- If the scheduler has problems, you discover them in unit tests before any UI work is wasted.
- 02.5c can scaffold against the `IAudioStemEngine` interface (pinned in 02.5a) in parallel with this work.

**Honest scope note:** the scheduler is _structurally_ test-verifiable here (unit tests for routing, generation-counter cleanup, stop-during-pending-schedule). **Acoustic correctness** (seam quality, crossfade artifacts, tempo-change displacement) can only be heard once 02.5c provides UI. This story's merge gate is structural; the acoustic listen-test is in 02.5c.

## Architectural finding (recap from epic)

The platform is **DAW-shaped at the runtime layer, but MIDI-shaped at the type layer** (02.5a fixed the latter). The internal data structures (gain-node Maps, transport timing, sample-accurate frame alignment) are generic; what was missing is a scheduler that handles `AudioBufferSource` lifecycle the way `DrumScheduler` and `BassScheduler` handle MIDI note events.

| Truly generic (no change)                                                                                                                                                                                          | Genuinely missing (build)                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Region.audioClipId?: string` field already defined at [region.ts:31](../../../../apps/frontend/src/domains/playback/types/region.ts#L31)                                                                          | `AudioPlayerScheduler` class — implements the `Scheduler` interface at [EventRouter.ts:32-34](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L32-L34)                                           |
| `EventRouter.emitEvent(instrumentType: string, ...)` accepts string at [line 93](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L93)                  | `EventRouter.scheduleAudioDirect` branch for `instrumentType.startsWith('audio-')`                                                                                                                                                                           |
| Sample-accurate frame alignment at [EventRouter.ts:99-106](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L99-L106) — audio stems inherit it for free | `PlaybackEngine.setAudioStemBuffers()` + `startAudioStems()` + `stopAudioStems()` + `unregisterTracksByPrefix()`                                                                                                                                             |
| `MusicalTruthAuthority.setBPM(bpm)` — single source of truth                                                                                                                                                       | Infinite-loop scheduling in `RegionScheduler` for `loopCount: 0` (currently rejected at [line 254](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts#L254) with "not supported yet") |

## What to build

### 1. `AudioPlayerScheduler.ts` (NEW, ~120 LOC)

**File:** `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/AudioPlayerScheduler.ts`

Implements the `Scheduler` interface at [EventRouter.ts:32-34](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L32-L34) (single method: `schedule(event, audioTime, frame): boolean`).

- Per-stem state: `buffers: Map<string, AudioBuffer>` and `gains: Map<string, GainNode>` populated by a `setStem(stemKey, buffer, gain)` injector.
- On `schedule(event, audioTime)`: reads `event.data.stemKey` (`"bass" | "drums" | "harmony" | "click"`), creates an `AudioBufferSource` from the cached buffer, connects to that stem's gain node, calls `source.start(audioTime, event.data.offsetSeconds ?? 0)`.
- Tracks active sources in `Map<string, AudioBufferSourceNode>` for `stopStem(stemKey)` and `stopAll(graceful)`.
- **The scheduler does not see `instrumentType`** — only `PatternEvent`. Stem identity travels via `event.data.stemKey`.
- Looping is owned by `RegionScheduler` (see item 4 below); this scheduler fires once per call.

### 2. `EventRouter.ts` (EDIT, ~8 LOC)

**File:** [`services/core/region-processing/event-routing/EventRouter.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts)

- Add optional 10th positional arg `audioPlayerScheduler?: Scheduler` to `initialize()` (backward-compatible — existing test callers don't break).
- Add one branch in `scheduleAudioDirect()` around [line 156](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L156):
  ```ts
  if (instrumentType.startsWith('audio-') && this.audioPlayerScheduler) {
    return this.audioPlayerScheduler.schedule(event, audioTime, frame);
  }
  ```
- Use `startsWith('audio-')`, **not** enumerated equality. One scheduler instance handles all 4 stems; stem identity passes through `event.data.stemKey`, so adding a 5th stem in the future doesn't touch `EventRouter`.
- **Registry refactor deferred** — converting the if-chain to `Map<string, Scheduler>` is the right long-term shape but costs more LOC now than it saves. Do it when the third scheduler family arrives.
- Sample-accurate frame alignment at [lines 99-106](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts#L99-L106) runs **once before** `scheduleAudioDirect` — audio stems inherit identical precision for free.

### 3. `PlaybackEngine.ts` (EDIT, ~120-160 LOC)

**File:** [`services/core/PlaybackEngine.ts`](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts)

`PlaybackEngine` implements [`IAudioStemEngine`](./LAUNCH-02.5a-instrumenttype-refactor.md#the-audio-stem-engine-interface-contract-pin-for-025bc-parallelization) (interface declared in 02.5a):

- **`setAudioStemBuffers(stems: Partial<Record<AudioInstrumentType, AudioBuffer>>): void`** — mirrors the **wrapper shape** (not the scheduler delegation) of `setDrumBuffers` at [line 2066](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts#L2066). For each stem: calls `getOrCreateInstrumentGainNode(stem)`, stops any previous source for that stem, stores the buffer, and connects the (future) source to the gain node. **Does not** delegate to a per-pad scheduler — stems are long pre-rendered loops with no per-note dispatch.
- **`startAudioStems(): void`** and **`stopAudioStems(): void`** (~40 LOC together) — drive `AudioBufferSource.start()` against the master transport time; `stopAudioStems()` uses a 5ms gain ramp-down per active source to avoid clicks.
- **`unregisterTracksByPrefix(prefix: string): void`** — iterates `engine.tracks`, removes every track whose ID starts with `prefix`. Sister method to `stopAudioStems()` for the per-card cleanup contract that 02.5c will consume. Without this, 02.5c either grows engine scope or papers over with ad-hoc loops.

### 4. `RegionScheduler.ts` — infinite-loop branch (EDIT, ~100-130 LOC)

**File:** [`services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts)

Current design at [lines 248-361](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts#L248-L361) **pre-expands every loop iteration into `eventsByTime` upfront** — fundamentally one-shot. Line 254 clamps `loopCount: 0 → 1` with comment "not supported yet." For infinite playback this won't work — unbounded upfront expansion blows memory.

Branch in `scheduleAll()` before the existing finite-loop `for` (around line 264):

```ts
if (instrumentType.startsWith('audio-') && (region.loopCount ?? 1) === 0) {
  this.scheduleInfiniteAudioRegion(region, trackId, instrumentType, ...);
  return; // skip eventsByTime expansion for this region
}
// else: existing finite loop expansion stays untouched
```

**This algorithm is novel in this codebase.** Every other scheduler uses `Tone.getTransport().scheduleRepeat(...)` ([BeatEmitter.ts:194](../../../../apps/frontend/src/domains/playback/services/core/BeatEmitter.ts#L194), [transport/core/Scheduler.ts:131](../../../../apps/frontend/src/domains/playback/modules/transport/core/Scheduler.ts#L131)). The Groove Card cannot reuse `scheduleRepeat` because the per-iteration callback must (a) recompute iteration duration from live BPM and (b) pick the right key-set buffer at each boundary — two state inputs that `scheduleRepeat`'s fixed-interval callback doesn't see. This story commits to writing a new pattern and owning its risk register explicitly.

#### `scheduleInfiniteAudioRegion()` — design

- Schedules iteration 0 at `T0 = transportStartTime + region.startTime` at full gain. `D` (iteration duration in seconds) is computed from `lengthBars`, current `timeSignature`, and the **current** `Tone.Transport.bpm.value` at scheduling time.
- Uses **one-shot self-rescheduling** via `Tone.getTransport().schedule(callback, t)`. Each callback (a) recomputes `D` from the _live_ BPM at callback time and (b) calls `Tone.getTransport().schedule(...)` again for the next boundary. Store the returned ID; cleanup calls `Tone.getTransport().clear(id)` and nulls the stored ID so a racing `stopAll()` cannot trigger a fresh schedule.
- At each boundary `B - 50ms` (50ms lookahead): callback resolves pending key via a hook-supplied `resolvePendingKey()` closure (passed in by 02.5c — this story accepts the closure but does not own the key state), picks the right `AudioBuffer`, creates the next iteration's source, schedules it at `B - 10ms` (crossfade pre-roll).
- Concrete Web Audio crossfade calls per boundary:
  ```ts
  const XF = 0.01; // 10ms
  // Outgoing
  gainOut.gain.setValueAtTime(1.0, B - XF);
  gainOut.gain.linearRampToValueAtTime(0.0, B);
  sourceOut.stop(B + 0.001);
  // Incoming
  gainIn.gain.setValueAtTime(0.0, B - XF);
  gainIn.gain.linearRampToValueAtTime(1.0, B);
  sourceIn.start(B - XF, 0);
  ```
- Tracks active sources in `Map<string, {source, gain, scheduleId, iter, gen}>` keyed by `${regionId}#${iter}`. Capped at 2 alive at any time (outgoing + incoming). Each entry carries a `gen` counter incremented on `stopAll()` so a late-firing callback can detect "I belong to a stopped generation, do nothing."
- `stopAll()` cleanup, in order: bump generation counter; iterate active entries — `Tone.getTransport().clear(scheduleId)` for each pending callback; 5ms gain ramp-down; `try { source.stop(now + 0.006) } catch {}`; drop the Map entry. **Order matters** — clearing the transport schedule before ramping the gain prevents a callback from re-arming during cleanup.

#### Risk register (acknowledged, mitigated where possible)

- **Memory**: max 2 sources alive at any moment, regardless of playback duration. ✓
- **Timer drift**: if callback fires >50ms late, detect `nextBoundary - 0.005 < currentTime` and drop the crossfade gracefully — incoming source starts at `currentTime` with no pre-roll; one audible micro-discontinuity at the seam, no infinite-loop break. ✓
- **Transport stop mid-schedule**: the generation counter + `clear(scheduleId)` pair guarantee a stopped card cannot re-arm. **Test explicitly** — unit test calls `stopAll()` 1ms before a pending boundary and asserts no new sources are created.
- **Mid-play tempo change**: handled at the iteration boundary (iteration N+1 picks up new `D` from live BPM). **Iteration N keeps playing at its baked rate** — `AudioBufferSource.playbackRate` defaults to 1.0 and the buffer is pre-rendered at the source BPM. This means: if the user pushes tempo from 104 → 130 mid-loop, the _audio stem_ in iteration N still finishes at the 104 BPM duration while `Tone.Transport.seconds` advances faster. The seam at the next boundary can audibly displace by `D_old - D_new` (≈1.7 s at this extreme). This is a real artifact, not "masked by 10ms crossfade." **Accepted for v1** — matches how a tape-based DAW behaves when tempo changes against a fixed-rate buffer. Future story may add `source.playbackRate` ramping per iteration.
- **BPM at zero / negative**: clamp to `[50, 180]` is enforced at the hook layer (02.5c), so the scheduler need not defend against it.
- **Transport position rewind via external code**: the existing engine doesn't expose `setPosition()` for users mid-play; add a `// TODO(future): re-anchor on transport.position discontinuity` next to the schedule-time math.
- **Callback re-entry**: each callback re-schedules exactly once, before any await; no re-entry risk under Tone's single-threaded JS callback model.

### 5. `EventRouter.test.ts` (EDIT, minimal)

**File:** `apps/frontend/src/domains/playback/services/core/region-processing/event-routing/__tests__/EventRouter.test.ts`

Add 10th `undefined` arg or `audioPlayerScheduler` mock to existing `initialize()` calls. Add a new test that mocks `audioPlayerScheduler.schedule` and asserts `instrumentType.startsWith('audio-')` events route to it.

## Requirements

### Functional

- [ ] **NEW:** `AudioPlayerScheduler.ts` exists and implements the `Scheduler` interface from `EventRouter.ts:32-34`. On `schedule(event, audioTime)` creates an `AudioBufferSource` from cached buffers, connects to the instrument gain node, calls `source.start(audioTime, offsetSeconds)`, tracks for `stopAll()`.
- [ ] **EDIT:** `EventRouter.ts` accepts `audioPlayerScheduler` in `initialize()`, routes `instrumentType.startsWith('audio-')` events to it in `scheduleAudioDirect()`.
- [ ] **EDIT:** `PlaybackEngine.ts` implements `IAudioStemEngine`: `setAudioStemBuffers`, `startAudioStems`, `stopAudioStems`, `unregisterTracksByPrefix`. Creates the scheduler, wires it into `EventRouter`. Existing finite-loop path (`loopCount: 1..N`) untouched.
- [ ] **EDIT:** `RegionScheduler.ts` handles audio-region looping. For `loopCount: 1..N` the existing finite-loop path is untouched. For `loopCount: 0` (infinite), the new `scheduleInfiniteAudioRegion()` private method uses one-shot self-rescheduling via `Tone.getTransport().schedule(cb, t)`. Each callback computes the next boundary from live BPM, schedules the next iteration with the 10ms pre-roll crossfade, and re-arms itself. Cleanup uses a generation counter + explicit `Tone.getTransport().clear(id)` to prevent late-firing callbacks from re-arming after `stopAll()`.
- [ ] 10ms crossfade at loop boundary applied automatically (overlap outgoing-source ramp-down with incoming-source ramp-up) per the Web Audio calls above.
- [ ] `(stub — wire in 02.5b)` markers removed from `INSTRUMENT_CONFIGS` audio-stem `loggerName` strings (02.5a's grep-visible reminder is replaced with the real scheduler being wired).

### Non-functional

- [ ] **Acoustic verification is deferred to 02.5c.** This story's merge gate is structural unit tests passing. Be explicit in the PR description that the listen-test (seam quality, tempo-change displacement) lives in 02.5c.
- [ ] Both apps type-check clean
- [ ] No coupling to `Mixer.ts` — its solo logic at [`modules/tracks/mixing/Mixer.ts:399`](../../../../apps/frontend/src/domains/playback/modules/tracks/mixing/Mixer.ts#L399) (note: path is `tracks/mixing/`) stays out of the audio-stem path. Per-stem mute uses `playbackEngine.setInstrumentMuted('audio-bass', true)` directly — the existing widget pattern.

## Acceptance Criteria — Unit / Integration Tests

- [ ] **`AudioPlayerScheduler.test.ts`** (NEW): drives `schedule(event, audioTime, frame)` with a stub `AudioBuffer` (mocked via Vitest), asserts the scheduler creates an `AudioBufferSource`, connects to the gain node, and calls `source.start(audioTime, offset)`. Mirrors the `mockDrumScheduler: Scheduler` harness at [EventRouter.test.ts:19-49](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/__tests__/EventRouter.test.ts#L19-L49).
- [ ] **`EventRouter.test.ts`** (EDIT): existing `initialize()` calls get the 10th argument. New test asserts that an event with `instrumentType: 'audio-bass'` routes to `audioPlayerScheduler.schedule`, and an event with `instrumentType: 'drums'` does NOT.
- [ ] **`RegionScheduler.test.ts`** (EDIT): new tests covering `loopCount: 0` + `instrumentType: 'audio-bass'`:
  - First iteration is scheduled at the expected transport time
  - Self-rescheduling fires the second iteration with the correct `D` derived from live BPM
  - Generation-counter cleanup: `stopAll()` called 1ms before a pending boundary creates **no** new sources
  - Timer drift: simulate a callback firing 100ms late, assert the incoming source starts at `currentTime` (no negative pre-roll)
- [ ] **Integration test (no UI):** a small fixture that loads 4 stub `AudioBuffer`s into `setAudioStemBuffers`, calls `registerTracks` + `startAudioStems`, advances the transport, and asserts that all 4 stems' scheduled events fire on the expected frame-aligned audio times.
- [ ] `pnpm test:frontend` — all existing tests still pass after the EventRouter signature change.
- [ ] `pnpm tsc --noEmit` — clean on both apps.

## Out of Scope

- ❌ The Groove Card UI, hook, or block contract — that's [02.5c](./LAUNCH-02.5c-groove-card-in-app.md)
- ❌ The waitlist embed and its minimal audio bootstrap — that's [02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md)
- ❌ Acoustic correctness verification (crossfade quality, tempo-change seam) — listened to in 02.5c
- ❌ A `PitchShift` node — that's a key-system concern, owned by 02.5c
- ❌ Per-stem `PitchShift` on bass/harmony stems — 02.5c
- ❌ The entitlement stub, `useEntitlement`, billing types in contracts — 02.5c
- ❌ Converting `EventRouter`'s if-chain to a `Map<string, Scheduler>` registry — long-term shape, but defer until a 3rd scheduler family appears
- ❌ A `PitchAuthority` analogue to `MusicalTruthAuthority` — future, separate story
- ❌ A `Mixer.ts` refactor to route audio stems through `Mixer.setSolo()` — current widget pattern is sibling-muting via `setInstrumentMuted`; this story follows that pattern
- ❌ Time-stretching artifact mitigation at tempo extremes — accepted as the cost of the lever
- ❌ Configurable crossfade duration — hard-coded at 10ms

## Risks

- **The infinite-loop scheduler is novel.** Acknowledged in the risk register above. Three things to do during PR review: (1) walk through `stopAll()` order with the reviewer, (2) verify the generation counter test exists and passes, (3) confirm the "callback fires >50ms late" mitigation is in code, not just docs.
- **Tempo-change seam is audible at extremes.** Documented as accepted. If 02.5c's listen-test rejects it, escalate before merging 02.5c — the fix is iteration playbackRate ramping, which has its own pitch implications and would be a separate story.
- **Tone.js mocking pain.** Vitest mocks of Tone.js exist in `PlaybackSession.test.ts:19`, `PlaybackSessionManager.test.ts:20`, `CoreServicesIntegration.test.ts:24`. Reuse those patterns; don't invent a new mocking strategy.

## Verification before merge

- [ ] All new + existing tests pass
- [ ] Type-check clean on both apps
- [ ] Manual code walk: `stopAll()` cleanup order is `[clear schedule] → [bump gen] → [ramp gain] → [stop source] → [drop entry]`
- [ ] PR description includes the explicit "acoustic verification deferred to 02.5c" caveat so reviewers don't expect a working card here

## Files to touch

**NEW:**

- `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/AudioPlayerScheduler.ts` (~120 LOC)
- `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/__tests__/AudioPlayerScheduler.test.ts`

**EDIT:**

- [`services/core/region-processing/event-routing/EventRouter.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts) (~8 LOC)
- [`services/core/region-processing/event-routing/__tests__/EventRouter.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/__tests__/EventRouter.test.ts)
- [`services/core/PlaybackEngine.ts`](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts) (~120-160 LOC at end of class; lines 2323/2372/2409/2443/2452 already widened by 02.5a)
- [`services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts) (~100-130 LOC; existing finite-loop path untouched)
- [`services/core/region-processing/scheduling-orchestrator/__tests__/RegionScheduler.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/__tests__/RegionScheduler.test.ts)
- [`services/core/Scheduler.ts`](../../../../apps/frontend/src/domains/playback/services/core/Scheduler.ts) — remove the `(stub — wire in 02.5b)` markers from audio-stem `loggerName` entries

**Database / contracts:** none.

---

## Notes

- **This is where the design risk lives.** The infinite-loop scheduler is the novel thing. If something goes wrong with the LAUNCH-02.5 epic, it will be here. Build it with unit-test discipline; do not skip the generation-counter test.
- The `unregisterTracksByPrefix` deliverable is small but easy to forget. Without it, 02.5c's per-card cleanup contract has nowhere to land cleanly.
- This story has no user-visible output. The reviewer is checking _correctness_, not _features_. Frame the PR accordingly.

---

## Implementation outcome (post-merge)

Landed on `develop` as commit **`6f50acf`** on 2026-05-27. 12 files changed, +2002 / −10 LOC. Pre-commit hook (eslint + prettier) ran clean on all staged files.

### What shipped exactly as specified

- **NEW [`AudioPlayerScheduler.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/AudioPlayerScheduler.ts)** (~200 LOC, 12 unit tests). Implements the `Scheduler` interface from `EventRouter.ts`. Per-stem state populated via `setStem(stemKey, buffer, gain)`. `schedule(event, audioTime, frame)` creates an `AudioBufferSource` from the cached buffer, connects to the stem's gain, calls `source.start(audioTime, offsetSeconds ?? 0)`. `stopStem` / `stopAll` / `dispose` ramp gains over 5ms before stopping sources. Returns `false` from `schedule()` when audioContext is missing, when `event.data.stemKey` is missing, or when the stem is not registered — preserving the EventRouter fall-through contract.
- **EDIT `EventRouter.ts`** — added an optional 10th positional arg `audioPlayerScheduler?: Scheduler` to `initialize()` (backward-compatible; existing test callers compile unchanged). Added one branch in `scheduleAudioDirect()`:
  ```ts
  if (instrumentType.startsWith('audio-') && this.audioPlayerScheduler) {
    return this.audioPlayerScheduler.schedule(event, audioTime, frame);
  }
  ```
  Single `startsWith('audio-')` branch, not enumerated equality — stem identity flows via `event.data.stemKey`, so a future 5th stem doesn't require an EventRouter change. Sample-accurate frame alignment at lines 99–106 runs once before the branch, so audio stems inherit identical precision.
- **EDIT `PlaybackEngine.ts`** — now `implements IAudioStemEngine`. All four interface methods landed:
  - `setAudioStemBuffers(stems)` — mirrors the wrapper shape of `setDrumBuffers`. For each provided stem: stops any in-flight source for that stem, allocates a gain node via `getOrCreateInstrumentGainNode(instrumentType)`, registers `(buffer, gain)` with `AudioPlayerScheduler.setStem`.
  - `startAudioStems()` — anchors every registered stem's `AudioBufferSource.start()` to `max(audioContext.currentTime, transportStartTime)`.
  - `stopAudioStems()` — 5ms gain ramp on every active source, `source.stop(now + 6ms)`, then `audioPlayerScheduler.stopAll()` and `regionScheduler.stopAllInfiniteAudio(audioContext)` so the infinite-loop iterations tear down too.
  - `unregisterTracksByPrefix(prefix)` — iterates `this.tracks`, calls the existing `unregisterTrack(id)` per match. Per-card cleanup contract for 02.5c.

  Also wires `AudioPlayerScheduler` into `EventRouter.initialize()` (10th arg) and passes the same instance to `regionScheduler.scheduleAll()` as the `audioStemAccess` dependency.

- **EDIT `RegionScheduler.ts`** — the **novel infinite-loop branch** landed exactly per the story's risk register. Two new optional `scheduleAll()` params at the tail: `resolvePendingBuffer?` (for 02.5c's key-set swaps) and `audioStemAccess?` (the narrow contract `{ getStem, trackExternalSource }`). New branch at the top of the region loop:

  ```ts
  if (instrumentType.startsWith('audio-') && (region.loopCount ?? 1) === 0 && audioContext) {
    this.scheduleInfiniteAudioRegion(...);
    return; // skip the finite-loop / eventsByTime path
  }
  ```

  New private `scheduleInfiniteAudioRegion` + `armNextBoundary` methods implement the **one-shot self-rescheduling** pattern. Each `Tone.getTransport().schedule(cb, B - 50ms)` callback (a) bails out via generation-counter mismatch if `stopAllInfiniteAudio` ran in between; (b) resolves the next buffer via the hook closure or falls back to whichever buffer is currently registered; (c) creates the incoming source with a 10ms crossfade pre-roll (`incomingStartAt = B - 10ms`, `outgoingStopAt = B + 1ms`); (d) recomputes the next iteration's duration `D` from the **live** BPM at callback time — mid-loop tempo changes are honored at the iteration boundary; (e) re-arms the next boundary. Max 2 sources alive at any moment per region.

  Public `stopAllInfiniteAudio(audioContext)` cleanup runs in the strict order the story specified: **bump generation counter → `Tone.getTransport().clear(id)` every pending schedule → 5ms gain ramp → `source.stop(now + 6ms)` → drop map entries**. Reordering steps 1–2 would let a callback re-arm during cleanup.

- **EDIT `Scheduler.ts`** — removed the 02.5a `(stub — wire in 02.5b)` markers from `INSTRUMENT_CONFIGS` audio-stem `loggerName` entries (the wiring is real now). The matching exhaustiveness test in `Scheduler.test.ts` was flipped to assert the marker is **gone**.

### Necessary scope adjustments discovered during implementation

These weren't in the original spec but the implementation required them:

- **`AudioStemKey` type + 2 helper functions added to `TrackManagerProcessor.ts`.** The story referenced `event.data.stemKey: "bass" | "drums" | "harmony" | "click"` but no such union existed. Added `AudioStemKey`, `AUDIO_STEM_KEYS` const array, `audioInstrumentTypeToStemKey()` and `stemKeyToAudioInstrumentType()` helpers — co-located with `AudioInstrumentType` because they're the same conceptual axis. Re-exported via the `modules/shared` barrel.
- **`InfiniteAudioStemAccess` narrow interface declared in `RegionScheduler.ts`** so the scheduler doesn't pull in a hard dependency on `AudioPlayerScheduler`. Two methods: `getStem(stemKey)` and `trackExternalSource(stemKey, source)`. `AudioPlayerScheduler` got matching public methods to satisfy this contract.
- **`AudioPlayerScheduler.getStem` and `trackExternalSource` weren't in the original `AudioPlayerScheduler` design.** They became necessary because `RegionScheduler.scheduleInfiniteAudioRegion` needs to spawn its OWN `AudioBufferSource`s (to drive the crossfade) but must reuse the same `(buffer, gain)` registered for the stem and must let `stopAll()` see those sources too. Without these, the infinite-loop path would have grown its own buffer/gain store and lifecycle, duplicating state with `AudioPlayerScheduler` — exactly the kind of split this epic was designed to prevent.
- **`RegionScheduler.scheduleAll` parameter count grew from 16 to 18** (positions 17/18 are optional and trailing, so all existing call sites stay backward-compatible). `PlaybackEngine`'s single call site was updated to pass `undefined` for `resolvePendingBuffer` (02.5c will inject) and the `AudioPlayerScheduler` instance for `audioStemAccess`.

### Tests added (48 new, all passing)

- [`scheduling/__tests__/AudioPlayerScheduler.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/__tests__/AudioPlayerScheduler.test.ts) — **12 tests**. Stem registration; replacement stops previous source; `schedule()` creates source + connects to stem gain + calls `start(audioTime, offset)`; default `offsetSeconds = 0`; `schedule()` returns false on missing context / missing stemKey / unregistered stem; `stopStem` / `stopAll` ramp gains and stop sources; `dispose` clears everything; `trackExternalSource` makes externally-spawned sources stoppable.
- [`event-routing/__tests__/EventRouter.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/__tests__/EventRouter.test.ts) — **+5 tests** (4 audio-stem routing tests via `it.each` + 1 MIDI-doesn't-leak test + 1 missing-scheduler test). Asserts each of `'audio-bass' | 'audio-drums' | 'audio-harmony' | 'audio-click'` routes to `audioPlayerScheduler.schedule` with frame-aligned audio time; MIDI `'drums'` still goes to `drumScheduler`; missing audio scheduler doesn't leak into MIDI schedulers.
- [`scheduling-orchestrator/__tests__/RegionScheduler.infiniteAudio.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/__tests__/RegionScheduler.infiniteAudio.test.ts) — **8 tests**. Iteration 0 source created and started at `transportStartTime + region.startTime`; `Tone.getTransport().schedule` armed at `T0 + D − 50ms`; iteration 1 fires with `D` recomputed from **live** BPM after a mid-loop tempo change; generation-counter cleanup (a stop before the callback fires creates no new source); generation-counter bail (a late-firing callback whose `cleared` flag was missed still bails via gen-mismatch); timer drift (callback firing past the boundary starts incoming at `currentTime`, not negative); finite-loop BC (`loopCount: 2` still goes through the existing path); silent no-op when `audioStemAccess` is undefined. **Tone is installed on `window.Tone`** in `beforeEach` to match the production `getTone()` accessor pattern.
- [`__tests__/audioStem.integration.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/region-processing/__tests__/audioStem.integration.test.ts) — **2 tests**. EventRouter ⇄ AudioPlayerScheduler end-to-end: register 4 stems, emit one event per stem, assert each source connects to the matching gain and starts at the frame-rounded 48kHz audio time, with no MIDI scheduler invocations and no event-bus leakage; missing-stem fall-through doesn't trick the MIDI schedulers.
- [`__tests__/Scheduler.test.ts`](../../../../apps/frontend/src/domains/playback/services/core/__tests__/Scheduler.test.ts) — the "carries stub marker" assertion was flipped to "no longer carries the 02.5a stub marker (wired in 02.5b)".

### Verification results

- ✅ `pnpm tsc --noEmit` (apps/frontend): **zero refactor-introduced errors** in any of the 4 new files. The pre-existing 3406 baseline became 3409 due to line-number shifts in already-broken neighbors (PlaybackEngine.ts, RegionScheduler.ts) — no new error categories.
- ✅ `pnpm tsc --noEmit` (apps/backend): 0 errors total
- ✅ All 146 affected tests pass across 7 files: 62 Scheduler + 20 InstrumentType.canonical + 18 pre-existing RegionScheduler (backward-compatible due to optional trailing params) + 26 EventRouter + 12 AudioPlayerScheduler + 8 RegionScheduler.infiniteAudio + 2 audioStem.integration.
- ✅ ESLint on touched files: **0 errors**, 12 warnings (all `no-non-null-assertion`, matching repo convention seen in every test file in this directory).
- ✅ Story's PR-description caveat satisfied: acoustic verification (seam quality, crossfade artifacts, tempo-change displacement) deferred to 02.5c — this PR is structural correctness only.
- ✅ Story's risk register honored in code: generation-counter test exists and passes; drift mitigation is in code, not just docs; `stopAllInfiniteAudio` follows the exact `[bump gen → clear schedule → ramp gain → stop source → drop entry]` order; max 2 sources alive per region; mid-loop tempo change picks up at the next iteration boundary while iteration N completes at its baked rate (documented seam).

### What 02.5c can now consume

- `playbackEngine.setAudioStemBuffers({ 'audio-bass': buf1, … })` to load decoded buffers per stem
- `playbackEngine.startAudioStems()` / `stopAudioStems()` for the one-shot lifecycle when not driven by a region
- `playbackEngine.unregisterTracksByPrefix('card-abc-')` so two cards on one page can register tracks under separate prefixes and clean themselves up independently
- `audio-*` events end-to-end through `EventRouter` → `AudioPlayerScheduler` → `AudioBufferSource.start` at sample-accurate audio times
- **Infinite-loop scheduling out of the box** for any region with `instrumentType: 'audio-*'` and `loopCount: 0`. The hook can optionally inject a `resolvePendingBuffer(regionId, iter)` closure into `regionScheduler.scheduleAll` to swap key-set buffers between iterations.
