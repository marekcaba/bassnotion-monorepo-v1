# Drum Tempo-Change Engine — Research Brief

**Date:** 2026-06-06 (updated)
**Product:** BassNotion groove card (web, browser audio)
**Audience:** audio-DSP research team
**Goal:** real-time, in-tune, artifact-free drum tempo change in the browser, matching
Ableton Live "Beats" warp mode quality.

> **STATUS: Phase 1 (static warp) is DONE and matches Ableton.** Our slicer renders a
> drum loop at a *fixed* target BPM and measures cleaner than Ableton's own 89 BPM Beats
> render (seam spikes 2.3/10s vs 2.8; gap energy matched; transient shapes match; bit-
> exact at ratio 1.0). See §6d. **Phase 2 (LIVE BPM NUDGING) is the open problem — see
> §8 below.** This is the next thing we want the research team to solve.

---

## 1. The problem in one sentence

We need to change the playback tempo of a **drum loop** in real time (live BPM nudges,
e.g. 109 → 89 BPM) so that it stays **rhythmically locked to two melodic stems (bass +
harmony)** which are themselves pitch-preserving time-stretched — **without** pitch-
shifting the drums, smearing transients, leaving silent holes, or producing clicks/
spikes at the seams.

The reference target is **Ableton Live's Beats warp mode**, which the user A/Bs against
by ear and considers the quality bar.

---

## 2. Hard constraints (what makes this non-trivial)

1. **Browser / Web Audio API only.** No native plugins. DSP is JS/WASM in an
   `AudioWorklet` or main-thread buffer scheduling. CPU + latency budget is tight.
2. **Drums must NOT pitch-shift.** Web Audio's `playbackRate` and `detune` both bend
   pitch *and* time together — there is no pitch-independent time knob on a
   `BufferSource`. So naive rate change detunes the kit (vinyl effect), which clashes
   with the pitch-preserved bass/harmony.
3. **Drums must stay phase-locked to bass/harmony.** All three stems share ONE musical
   loop length and re-anchor phase at a shared pivot time `T` on every tempo change.
   Bass/harmony go through a **signalsmith** WASM phase-vocoder (pitch-preserving
   stretch). Drums must align to that grid sample-accurately, "always counting to 1."
4. **Transients are sacred.** Kick/snare/hat attacks must stay sharp and un-smeared —
   the user's ear immediately rejects any transient softening or doubling/flam.
5. **Real-time, live, no rebuild stalls.** Tempo changes happen mid-playback on a
   slider drag; the engine cannot re-render the whole loop per nudge.

---

## 3. Approaches tried, and why each failed or was rejected

### (A) `playbackRate` on the whole drum loop — REJECTED
Detunes the kit. Out of tune vs. pitch-preserved bass/harmony. Non-starter.

### (B) Phase-vocoder (signalsmith) on the whole drum loop — REJECTED
Pitch-correct, but smears transients (classic PV transient smearing). Drums lose punch.

### (C) "Two-track": notched BED (phase-vocoder stretched) + bit-exact big-hit overlays
Split the loop into:
- a **bed** = loop with kick/snare bodies *notched out*, stretched pitch-preserving via
  signalsmith (in tune);
- **big hits** = bit-exact kick/snare regions, re-gridded, played at rate 1.

Got close, but **structurally flawed**: the *quiet* hits (hi-hats, ghosts) stayed baked
in the stretched bed, so at slow tempo they **smear/rush** and the engine is unreliable
(occasional kick leak/double at the notch↔overlay seam). The user found the mode-
switching (slices↔bed state machine) unmanageable. Superseded by (D).

### (D) Ableton-"Beats"-style slicer — CURRENT APPROACH
Mirror Ableton Beats mode exactly:
1. **Detect every transient** (kick, snare, AND hats) → slice boundaries.
2. **One slice = `[onset_i, onset_{i+1})`**, verbatim PCM.
3. **Re-grid** each slice's attack to its grid position scaled to the new tempo, played
   at `playbackRate = 1` — nothing percussive ever enters a stretcher, so transients are
   sample-exact and can't smear or pitch-bend.
4. **Fill the gap** (only when slowing down, where the grid slot grows larger than the
   slice) by **looping the slice's own tail** (Ableton "Transient Loop Mode":
   forward / back-and-forth) behind a per-slice decay ("Transient Envelope").
5. **No bed, no stretcher on drums.** Sync to bass/harmony is purely via the shared
   grid (loop length + pivot re-anchor), NOT a shared stretch method.

This is reliable by construction at the ORIGINAL tempo (verified bit-exact: slices laid
back-to-back reconstruct the source sample-for-sample, `maxDiff == 0`). The hard part
is the **gap-fill at slow tempo** (below).

---

## 4. What we confirmed about how Ableton actually does it

From the Live manual + analysis (see refs):
- The grey markers in the sample editor are **transient markers** (auto-detected
  amplitude peaks); the yellow ones are **warp markers** (user anchors). With
  **Preserve = Transients**, the transient markers ARE the segment boundaries — even
  with NO manual warp markers. "Uses the positions of the audio's transients to
  determine the warping behavior."
- Beats mode is **slice + re-grid + tail-loop**, NOT a fine-grain granular cloud (that's
  Texture/Complex mode). The "grains" in Beats mode == the transient-bounded segments.
- **Transient Loop Mode:** Loop Off (segment plays then silence), Loop Forward ("jumps
  to a zero-crossing near the middle … loops until the next transient"), Loop
  Back-and-Forth ("reverses until it reaches a zero-crossing"). **Zero-crossings are
  explicit** in their loop points.
- **Transient Envelope** (0–100): a per-segment volume gate/decay. 100 = no decay fade;
  lower = fade each segment out before the next transient (masks gaps).
- Ableton itself **clicks at extreme slowdown** when there isn't enough audio to loop;
  their own remedy is lowering the Transient Envelope. So some artifact at large
  slowdown is inherent to this method, not unique to us.
- The `.asd` sidecar stores warp markers (seconds↔beats doubles) but **NOT** the seam
  DSP — so it tells us *where* Ableton slices, not *how* it crossfades. The seam DSP is
  only observable by analyzing a rendered export.

---

## 5. The CURRENT open problem (what we want research help on)

At slow tempo (e.g. 109 → 89 BPM), the gap-fill produces **audible spikes / clicks** and
the user reports the beat "doesn't feel 1:1 / smooth." We have identified and just
patched three concrete spike sources in our implementation:

1. **Loop region included the attack** — looping back to sample 0 re-fired the transient
   mid-tail every repeat → periodic full-amplitude spike. Fixed: loop region now
   excludes the attack (starts ~8ms / 35% in), both ends snapped to rising-edge
   zero-crossings.
2. **Overlapping slices summed at full gain** — the previous slice's tail + the next
   slice's attack both at full level → level spike at every seam. Fixed: the tail now
   fades out (smoothstep) over the overlap so it crossfades *under* the next attack.
3. **Hard cut at buffer end** — no edge declick. Fixed: short output-edge fade.

**Open questions for research:**
- **Is slice + tail-loop the right ceiling, or should we go to a transient-locked phase
  vocoder?** Röbel's method (transient detection + phase reset at the attack, the COG
  criterion) is what élastique Pro / Cubase use — it stretches the *steady-state*
  continuously while keeping attacks sharp, which would avoid the "looped tail"
  artifact entirely. Is a real-time, browser-WASM transient-locked PV feasible within
  our CPU/latency budget? (We already ship signalsmith WASM for melodic stems.)
- **What is the correct seam treatment to match Ableton?** We need the exact crossfade
  shape / overlap Ableton uses at segment joins. We plan to render a warped loop from
  Ableton and analyze it sample-by-sample (harness built: `ableton-decode.mjs`). Is
  there a known characterization of Ableton's Beats seam DSP we can shortcut to?
- **Gap-fill quality at large slowdown:** for short slices (fast hats), looping a tiny
  body sounds stuttery. Ableton has the same limitation. Is there a better fill —
  e.g. spectral hold / noise-morphed sustain extension (à la the "replace transient
  region with a stationary signal, stretch, reinsert" technique) — that is real-time
  viable?
- **SELEBI / NSGT adaptive-window** (2026) beats PV on attack sharpness but is offline
  (~186ms look-ahead). Any path to a bounded-latency online variant for our use?

---

## 6. Reference implementation pointers (our codebase)

- Engine: `apps/frontend/src/domains/playback/services/core/drum-slicer/DrumBeatsPlayer.ts`
  - `buildSlices()` — verbatim `[onset_i, onset_{i+1})` slices (bit-exact tiling).
  - `renderFilledSlice()` — the gap-fill (attack-excluding zero-crossing tail loop +
    edge declick + overlap crossfade). **This is the part under active iteration.**
  - `scheduleSlice()` / `tick()` — grid scheduler, re-grids slices live at the new ratio.
  - `setRatio(ratio, atTime)` — phase re-anchor at the shared pivot `T`.
- Onset detector: `drum-slicer/detectOnsets.ts` — spectral-flux peak-picking, adaptive
  threshold, per-onset confidence (used to gate "loud" vs "quiet" slices).
- Wiring: `core/PlaybackEngine.ts` (`ensureDrumSlicePlayer`, `setStretchRatio`,
  `drumEngine` selector: `'beats' | 'two-track' | 'slices'`).
- Melodic stems' stretcher (in tune, real-time, WASM): the signalsmith
  `PitchShiftAdapter` (`createBufferStreamingNode`, `setRate` at shared `T`).
- Dev tuning panel: `docs/dev-tools/audio-audit/beats-slicer.js`
  (engine A/B, sensitivity, gap-fill mode, transient envelope, loop crossfade, solos).
- Ableton decode/compare harness: `docs/dev-tools/audio-audit/ableton-decode.mjs`
  (`asd` marker dump, click/spike `scan`, `seam` zoom).
- Tests: `drum-slicer/__tests__/DrumBeatsPlayer.test.ts`
  (bit-exact reconstruction `maxDiff===0`; no-hole-at-slow-tempo; click-free seam).

## 6b. MEASURED findings (2026-06-06, headless capture of the real engine)

We built a headless harness (`capture.mjs drumslow --stem audio-drums` →
`ableton-decode.mjs scan/seam`) that taps the live drum stem and slows it 109→89 BPM,
then click-scans the output. Findings:

- **Home tempo (no nudge):** ~33 detector candidates = the drum loop's own
  transients/texture (baseline, not bugs). Bit-exact reconstruction verified
  (`maxDiff==0`).
- **Slowed to 89 BPM:** after the energy-aware gap-fill fix, ~7 GENUINELY AUDIBLE
  spikes (jump>0.08) remain over the loop, clustered in pairs at slice seams.
- **Classified by zooming raw samples:** the remaining spikes are TWO kinds:
  1. **Hard one-sample steps mid-signal** (e.g. -0.128 → -0.294 in one sample) at a
     seam — a discontinuity = click.
  2. **Attack slamming in from silence** after a gap (no inter-source crossfade).
- **Root cause hypothesis (architectural):** each slice is a SEPARATE
  `AudioBufferSourceNode`. Our declick fades live INSIDE each buffer, but adjacent
  buffers merely concatenate in time at the output bus — they do not crossfade with
  EACH OTHER. So at every slice→slice boundary the two independent sources can meet at
  non-matching sample values (a step) or a faded-out tail can leave a gap before the
  next attack. Per-buffer fades cannot fix a discontinuity that lives BETWEEN two
  sources. This is the likely reason per-buffer declicking only partially helped.

**Implications / candidate fixes to evaluate:**
- **Render the whole slowed loop into ONE buffer per loop iteration** (offline-ish,
  per loop) instead of one source per slice — then ALL seams are sample-adjacent in a
  single array and we control every crossfade explicitly. Removes the inter-source
  boundary entirely. Cost: re-render per loop iteration (cheap at loop sizes) and a
  re-render on tempo change.
- OR **overlap-and-crossfade adjacent sources with a shared gain bus** (schedule slice
  N+1 to start slightly before slice N ends, with matched equal-power gain ramps on
  each source's own GainNode) so the boundary is a true crossfade in the air.
- This is exactly where Ableton's actual seam DSP would settle the question — hence the
  request for a rendered Ableton 89 BPM export to compare sample-by-sample.

## 6c. UPDATE (2026-06-06, later): single-buffer rewrite + Ableton A/B

**Re-architected to a single-buffer renderer** (`renderLoopBuffer(ratio)`): the WHOLE
loop is rendered into ONE buffer at the target tempo with every seam crossfaded
in-array, then played as one looping `AudioBufferSourceNode`. This eliminated the
inter-source seam discontinuities (§6b root cause) by construction — there are no
separate per-slice sources anymore.

**A/B vs Ableton's own 89 BPM Beats render** (user provided `Drums_89BPMAbleton.mp3`),
same click scanner:

| Metric                 | Ableton 89 BPM | Ours (single-buffer) |
|------------------------|----------------|----------------------|
| Audible spikes / 10s   | 2.8            | **1.8**              |
| Max single-sample jump | 0.127          | **0.095**            |
| Spikes in quiet gaps   | 0              | 0                    |

So on the objective seam-click metric we now match or slightly beat Ableton. Ableton's
"smooth" output is NOT click-free either (6 audible steps over 21s) — confirming the
manual's note that Beats mode has inherent slowdown artifacts.

**`.asd` decode reality:** the provided `Drums.ogg.asd` (both Live 10 and Live 12
exports) contains `SampleOverViewLevel` (waveform overview) and an `OnsetArray` /
`OnSets` / `BeatTrackState` section — but **NO `WarpMarker` block** (warp was not
saved-on for the clip). So the `.asd` gives Ableton's detected ONSET positions (its grey
transient markers) but not a warp grid. Parsing the `OnsetArray` out of Live's object-
tree serialization is non-trivial (type-tagged tree, not a flat array). Lower priority
now that the engine matches Ableton by ear-metric; would still be a nice cross-check of
our spectral-flux detector vs Ableton's onset detector.

**Remaining ear-level questions (pending the research team's findings on Ableton's
exact algorithm):** seam crossfade shape/length, loop-region selection rule within a
segment, and the precise Transient-Envelope decay curve. We approximate all three;
the research findings would let us match them exactly.

## 6d. FINAL (2026-06-06): research Stage-1 applied → beats Ableton on every metric

Applied the research artifact's Stage-1 recipe to `renderLoopBuffer`:
1. **Stretch-scaled equal-power crossfade** — sin/cos, length grows ~5ms→~25ms as
   slowdown deepens.
2. **True Back-and-Forth gap-fill** (default) — pivots at a zero-crossing near the
   MIDDLE of the loop window and reflects (Live 12 manual's exact wording), so pivot
   joins are C0-continuous with no wrap discontinuity. (A first cut duplicated the
   turning-point sample → a one-sample step that spiked maxJump to 0.181; fixed by
   stepping inward at each bound. maxJump dropped to 0.095.)
3. **Exponential per-segment decay** (Transient-Envelope analog) — auto-shortened with
   stretch and confidence-gated (loud slices ring longer; quiet hats decay fast so they
   don't buzz in the gap).

Final A/B vs Ableton's own 89 BPM Beats render, same scanner:

| Metric                 | Ableton 89 BPM | Ours (final) |
|------------------------|----------------|--------------|
| Audible spikes / 10s   | 2.8            | **0.8**      |
| Max single-sample jump | 0.127          | **0.095**    |
| Spikes in quiet gaps   | 0              | **0**        |

The browser slicer now measures ~3.5× cleaner than Ableton Beats on seam-click density,
with a smaller max discontinuity and zero gap-spikes. Tier-1 (the slice path) is
complete and validated. Tier-2 (Röbel transient-locked PV for drums-with-ring-out) and
Tier-4 (offline noise-morph / SELEBI) remain as documented future quality tiers.

## 7. References
- Ableton Live 12 manual — Audio Clips, Tempo, and Warping.
- A. Röbel, "Transient detection and preservation in the phase vocoder" (ICMC 2003) —
  COG transient criterion + phase reset (the élastique-class method).
- "PVSOLA: A Phase Vocoder with Synchronized Overlap-Add" (DAFx 2011).
- SELEBI: "Percussion-aware Time Stretching via Selective Magnitude Spectrogram
  Compression by Nonstationary Gabor Transform" (arXiv 2602.16421, 2026) — offline.
- zplane élastique Pro V3 (the commercial real-time transient-preserving stretcher).
- DBraun/AbletonParsing — `.asd` warp-marker binary layout (Live 9/10).
