# LAUNCH-06 — Pitch-preserving time-stretching for groove-card stems

**Status:** Pending design. Spawned from a real user observation while shipping LAUNCH-02.5c — the tempo stepper on the groove card today only changes the _spacing_ between loop iterations, NOT the speed of the recorded audio. Students hear the bass play at its original recorded tempo regardless of the BPM stepper. For a practice tool this is a hole in the core value proposition.

## Why this matters

The groove card sells students the promise of practicing along to a real recording at a tempo they choose. Without real time-stretching, the recording stays at its source BPM and the UI control is misleading. Lowering tempo to learn the part — the canonical practice workflow — does not work.

## Why it's not a one-line fix

The Web Audio API has exactly one native primitive for changing speed: `AudioBufferSourceNode.playbackRate`. It works like a tape machine — **slowing it down lowers the pitch, speeding it up raises the pitch**. The bass groove recorded at E becomes F# at 150% playback or D♭ at 80%. This breaks the key-set model entirely: the existing ±4/±8 semitone key sets are pre-rendered to specific pitches; mixing playbackRate-driven tempo with them produces unpredictable transpositions.

Pitch-preserving time-stretching requires a separate DSP algorithm running outside the standard Web Audio graph. The browser has none built in.

## Options surveyed

### 1. Rubber Band Library (WASM)

- The open-source industry-standard pitch-preserving stretcher (Ardour, Mixxx, Reaper).
- Has a WebAssembly port (`rubberband-wasm`); also reachable via WAM plugins.
- **Quality:** broadcast-grade.
- **Footprint:** ~300-500 KB compressed WASM per stem track.
- **Latency:** typical implementations need 50-200 ms of pre-buffer.
- **Realtime parameter changes:** supported by the "realtime" variant; not all wrappers expose it.
- **Codebase fit:** we already use WAM plugins (WamKeyboard, WamMetronome). Plumbing a stretcher per-stem channel into the engine's audio graph is real but not alien work.

### 2. SoundTouchJS / Phaze (pure JS in AudioWorklet)

- `soundtouchjs` is a JS port of the SoundTouch library; `phaze` is a phase-vocoder implementation.
- **Quality:** acceptable within ±20% deviation from source BPM; visibly artifacty beyond ~30%.
- **Footprint:** smaller than Rubber Band — tens of KB.
- **Latency:** lower than Rubber Band but still ≥1 buffer of look-ahead.
- **Realtime parameter changes:** designed for this.
- **Codebase fit:** runs in an AudioWorklet — fits the existing AudioWorkletManager pattern.

### 3. PlaybackRate hack (rejected)

- Set `source.playbackRate.value = newBpm / originalBpm`.
- Cheap, ~50 lines.
- **Rejected** because it tightly couples tempo and pitch and breaks the key-set transposition model.

## Recommendation

Start with **SoundTouchJS in an AudioWorklet**. Footprint and complexity are bounded; quality is acceptable for the practice-tool range (typical student BPM exploration is 80-160 BPM around a 100-140 BPM source — well within ±25%). If audio quality complaints come in for extreme stretches, migrate to Rubber Band as a paid-tier or premium-quality toggle.

## Scope

### Engineering tasks (estimate before starting)

1. **Audio-graph rewiring:** insert a stretcher AudioWorkletNode between each stem's `AudioBufferSourceNode` and its current gain node. Today's chain is `source → instrumentGainNode → destination`. New chain becomes `source → stretcher → instrumentGainNode → destination`.
2. **Parameter wiring:** route `musicalTruth.setBPM` → stretcher.stretchRatio via AudioParam (or `port.postMessage` if the worklet exposes a port).
3. **Lifecycle:** stretcher must be created when the buffer is registered (`setAudioStemBuffers`) and torn down when stopped. Hooks into the pre-arm window in [RegionScheduler.scheduleInfiniteAudioRegion](apps/frontend/src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts) — every iteration's `source.start` needs to flow through its stretcher.
4. **Boundary alignment:** the audible "loop duration" of a stretched buffer is `bufferDuration / stretchRatio`. The current pre-arm scheduler computes `iterStartTime + computeIterationDuration(region)` (which is BPM-derived). When tempo is bumped, the next loop iteration's `start(when)` time should align to the **stretched** buffer's natural end, not the BPM-derived musical duration — the relationship currently holds because we record at originalBpm; with stretching, they decouple and the math needs a careful re-derivation.
5. **Tests:** new integration tests around the stretcher + boundary alignment.

### UX tasks

1. **Tempo range:** decide clamps. Recommend ±30% around `originalBpm` (so a 120 BPM source supports 84-156). Beyond that, SoundTouch artifacts dominate.
2. **Feedback:** consider showing a small "stretched" indicator when tempo deviates from originalBpm so users know the audio is being processed.
3. **Performance:** decide what happens on low-end devices (one stretcher per stem × multiple stems = real CPU). Possible fallback: disable stretching, lock tempo to originalBpm on slow devices.

## Open questions for design review

- **Per-stem or shared stretcher?** All three groove-card stems play in lockstep. A single stretcher applied to the mixed output would be cheaper but couples the stems irreversibly. Per-stem is more flexible but ~3x CPU.
- **Mid-loop tempo change vs. boundary-aligned change?** SoundTouch supports realtime ratio changes. We could either (a) allow tempo to take effect immediately mid-loop or (b) defer to the next iteration boundary (matches the current "documented seam" semantics of the MIDI scheduler). (b) is musically cleaner; (a) is more responsive.
- **Interaction with the key-set system?** Each key set is pre-rendered at its target pitch. Stretching changes only time, not pitch — so the existing key-set transposition still works correctly. Verify in practice.

## Prerequisites met

- LAUNCH-02.5c (groove card in-app) ✅
- Loop-gap fix (this commit) ✅ — the pre-arm scheduler is a clean foundation to insert a stretcher into.

## What we'll get with this

A groove card where:

- Student presses play → hears 4-beat metronome count-in → hears stems start on the downbeat at original BPM and key.
- Student drags tempo to 100 BPM → stems slow down audibly without changing pitch. Loop boundaries remain musically clean.
- Student transposes via key stepper → stems play in the new key (key-set switch on next boundary, as today).
- Together: a real DAW-quality practice tool that respects the recording while letting students learn at their own pace.
