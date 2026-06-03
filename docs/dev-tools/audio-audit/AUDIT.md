# Groove-Card Playback Engine — Audio Quality Audit

**Date:** 2026-06-03 · **Branch:** `feature/stem-time-stretch`
**Method:** Real engine rendered in headless Chromium (full Web Audio + the
actual signalsmith / soundtouch WASM worklets), output tapped at the master bus
and per-stem gains, captured to WAV, analysed offline. **This is the signal a
user actually hears** — not a simulation.

Tooling lives in `docs/dev-tools/audio-audit/`:
`capture.mjs` (record), `seam.mjs` (timestamp-driven seam metrics),
`analyze.mjs` / `compare.mjs` (click/transient analysis). Reproduce with
`node docs/dev-tools/audio-audit/capture.mjs keychange out.wav --stem audio-bass`.

> Caveat honoured from project memory: **the ear is ground truth.** These
> numbers are designed to point your ear at the _specific_ moment to listen to
> (the exact seam sample), not to replace listening. Where a metric and the ear
> disagree, the metric is wrong.

---

## Architecture (verified against source)

| Concern              | Mechanism                                                                                                                                                                                                                   | Where                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Pitch (bass/harmony) | **signalsmith-stretch** phase vocoder, formant-corrected (always on), per-stem profiles (bass `formantBaseHz:90 blockMs:140`, harmony auto/`120`). Pitch ⟂ rate via **buffer-streaming mode** (worklet input disconnected). | `PitchShiftAdapter.ts`                                        |
| Tempo (bass/harmony) | Same signalsmith node, `rate` field. **Immediate, mid-loop** re-rate (Model C).                                                                                                                                             | `PitchShiftAdapter.setRate`, `useGrooveCardPlayback.setTempo` |
| Tempo (drums)        | **WSOLA continuous-bed + bit-exact transient overlays**, transient-notched bed to avoid lag-driven body doubling, equal-power crossfade.                                                                                    | `DrumSlicePlayer.ts`                                          |
| Key change timing    | Deferred to a loop boundary via `computeNextBoundaryAudioTime`; bass+harmony scheduled at the **same** apply-at time. Drums never transpose.                                                                                | `useGrooveCardPlayback.setKey`                                |
| Drum/pitched sync    | DelayNode compensates signalsmith latency (~0.175s) so drums stay aligned.                                                                                                                                                  | `PlaybackEngine`                                              |

---

## Findings (objective)

### ✅ 1. The key-change seam is clean — no click, no glitch

Measured at the **exact** engine-reported apply-at sample (no inference), ±30ms
window, vs. a steady-playback control window:

| Capture              | seam maxJump | control maxJump | **ratio** | specFlux ratio |
| -------------------- | ------------ | --------------- | --------- | -------------- |
| Bass isolated, +3 st | 0.00199      | 0.00321         | **0.62×** | 0.27×          |
| Full mix, +3 st      | 0.02298      | 0.02094         | **1.10×** | 1.20×          |

A ratio ≈ 1× means the seam is **indistinguishable from ordinary steady
playback**. Both are ~1× or below. For scale: a real drum transient is a ~0.5
inter-sample jump; the seam's largest jump is 0.002–0.023. **The signalsmith
self-looping + boundary-scheduled pitch write delivers a seamless key swap.**
This is genuinely state-of-the-art behaviour for a browser engine.

### ✅ 2. Bass + harmony change key sample-accurately together

Both stems are scheduled at the **identical** apply-at time (e.g.
`18.3806...s`, same sample index to 15 sig figs). Rapid taps (+1, +2, +3 within
one loop) all collapse to the **same** seam — no staggered, drifting changes.

### ✅ 3. Tempo change is immediate and click-free (Logic/Ableton-style)

`setStretchRatio` fires **live, mid-loop** per BPM step (not deferred). Across a
+20 BPM ramp the bass render shows **1 discontinuity total**, and it's the
playback-start transient at t=2.29s (silence→audio), not a tempo artifact. The
mid-loop re-rate introduces no audible click. Phase continuity is preserved by
re-anchoring `loopStartTime` at a shared pivot across all stems.

### ⚠️ 4. PRIMARY ISSUE — key change waits a full LOOP, not the next BAR

`computeNextBoundaryAudioTime` snaps to the next multiple of
**`loopDurationSeconds`** — the whole 8-bar loop — not the next bar:

```
elapsed = now - loopStartAudioTime
completedLoops = ceil(elapsed / loopDur)        // <-- whole loop
naturalSeamTime = loopStartAudioTime + completedLoops * loopDur
```

Measured: a key tap at 3.45s applied at 18.38s — **deferred 12.9s**. For this
groove (133 BPM, 8 bars): **1 loop = 14.44s, 1 bar = 1.80s.** So the user can
wait up to ~14s for a key change to take effect, when the stated design goal is
"wait for the first bar of the loop" (≤1.8s).

**This is the gap between intent and implementation.** The seam is _clean_; it
just fires at the wrong granularity — up to **8× longer** than a bar-quantized
seam would.

### Notes / lower-priority

- **Drums don't transpose by design** — on a key change drums + harmony are
  briefly in different keys until... they never reconcile (drums are
  percussion, no pitch). Expected, but worth a conscious product call: a real
  Logic/Ableton session would pitch the whole kit or leave it — current
  behaviour (leave drums) is the common choice.
- Brief 15–40ms RMS dips at some loop boundaries in the isolated bass (notes
  decaying between phrases) — inaudible in the mix, not seam-related.
- Source `drums.ogg` itself **clips (peak 1.46)** — a mastering issue in the
  asset, independent of the engine.

---

## Recommendations (ranked by audibility)

1. **Bar-quantize the key-change seam** (highest impact). Change
   `computeNextBoundaryAudioTime` to snap to the next **bar** boundary
   (`loopDur / lengthBars`), not the whole loop. One-line-ish change; makes the
   key change feel responsive (≤1 bar) as intended, and the seam is already
   proven clean at any boundary. _Verify the signalsmith deferred-key re-insert
   still lands correctly at a sub-loop boundary._
2. **Optional: choose seam granularity** — some users want "change at next
   bar," others "next phrase." A small setting (bar / 2-bar / loop) maps
   directly to the `completedLoops` math.
3. **Leave the seam DSP alone** — it's clean; don't add a crossfade it doesn't
   need (would only risk introducing artifacts).
4. **Drum-clip**: re-export `waitlist-groove/e/drums.ogg` with -3 dB headroom
   (asset fix, not engine).

---

## How to re-run

```bash
# frontend must be up on :3001 (PM2)
node docs/dev-tools/audio-audit/capture.mjs keychange  cap-bass.wav --stem audio-bass
node docs/dev-tools/audio-audit/seam.mjs    cap-bass.wav
node docs/dev-tools/audio-audit/capture.mjs tempochange cap-tempo.wav --stem audio-bass
node docs/dev-tools/audio-audit/analyze.mjs cap-tempo.wav
```
