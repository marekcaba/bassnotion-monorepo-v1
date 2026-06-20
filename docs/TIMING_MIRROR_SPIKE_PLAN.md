# Timing-Mirror Spike — Build-Ready Plan

> **Goal:** Prove the "most impressive" honest timing mirror — capture the user's bass via `getUserMedia`, detect onsets, score timing-vs-grid (reusing `BeatTimingAnalyzer`'s drift/jitter/syncScore), and render it **viscerally** (DAW-like attack-vs-grid). **Dual job:** be impressive AND prove the number matches the ear. An impressive-but-wrong number kills trust, so the trust gate is a first-class deliverable, not an afterthought.

> **Status:** plan only, no code yet. Synthesized from the 7 subsystem audits + 4 adversarial probes. Every file path / API below was verified against `apps/frontend/src` at synthesis time.

---

## 0. TL;DR decisions

| Question | Decision | Why |
|---|---|---|
| Where does it live? | **In-app, dev-flagged React panel inside `GrooveCardBlockView`** (revive the `NEXT_PUBLIC_BASS_RECORDER_PROBE` pattern) | The mirror's entire value is comparing onsets against the **real** engine grid (`loopStartAudioTime` + `loopDurationSeconds` + shared `WindowRegistry` `AudioContext`), which exists ONLY inside `useGrooveCardPlayback`. A standalone HTML page is architecturally walled off from it. |
| Onset detector? | **Copy `detectOnsetsDetailed` (drum-slicer)**, retune for bass (HPF + min-note-spacing), **skip** `suppressBodyFragments` | Production-hardened spectral-flux + own FFT + confidence scoring + 10 unit tests. Strictly stronger than the removed amplitude-threshold probe whose documented failure was sustain over-trigger. |
| Scoring engine? | **`new BeatTimingAnalyzer()`** (a fresh instance, NOT the singleton) | Pure drift→jitter→syncScore math already exists and is named in the spec. The singleton is live-used in `YouTubeWidgetPage` + `TimingDebugWindow`; sharing it interleaves history across sources. |
| Clock? | **One clock end-to-end: `audioContext.currentTime` (seconds), rebased to `loopStartAudioTime`, ×1000 to ms** before `recordBeat`. | The analyzer is `performance.now()`-ms internally; feeding raw audio seconds is 3-orders-of-magnitude wrong + wrong origin. Bridge at the boundary, keep the class's internal unit as ms. |
| Trust gate? | **Offset/jitter split + loopback round-trip calibration + note-count sanity + ear A/B**, DI rig only for the published number | The impressive-but-wrong trap is reporting raw `onset − T0` (pure system latency) as "you drag 150ms". |

---

## 1. WHERE the spike lives

**Decision: in-app, dev-flagged React panel rendered inside `GrooveCardBlockView.tsx`.**

### Reasoning (from the dev-tools-spike-home audit)
The deciding factor is whether the spike MUST reach the real groove engine + grid. It must:
- The grid (`loopStartAudioTime`, `loopDurationSeconds`, `getCurrentTime()`) lives only inside `useGrooveCardPlayback` (`apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/useGrooveCardPlayback.ts`).
- The shared clock comes from `WindowRegistry.getAudioContext()` — a standalone page creating its own `new AudioContext()` measures a **different** clock than the audible groove, making onset-vs-beat math meaningless.
- `setStemMuted('audio-bass', true)` (the "mute the reference, score the user against the silent grid" move) is an engine call.

The committed standalone probe `docs/dev-tools/recording-latency/index.html` **proved the browser can capture in sync with a metronome it generates itself** — but NOT in sync with OUR stem-stretched grid. It stays as the **rig-latency baseline** (raw round-trip), a different question. We lift its capture-path DSP, not its home.

### Concrete wiring point
`GrooveCardBlockView.tsx` already threads everything the panel needs into child components (audit: lines ~874–930, 974):
- `audioContext`
- `loopStartAudioTime`
- `loopDurationSeconds`
- `setStemMuted('audio-bass', ...)`

So the panel drops in with **zero new plumbing**. Gate it behind an env flag so it tree-shakes out of prod:

```tsx
{process.env.NEXT_PUBLIC_BASS_RECORDER_PROBE === 'true' && (
  <TimingMirrorPanel
    audioContext={audioContext}
    loopStartAudioTime={loopStartAudioTime}
    loopDurationSeconds={loopDurationSeconds}
    lengthBars={block.lengthBars}
    getCurrentTime={playback.getCurrentTime}
    setStemMuted={playback.setStemMuted}
    isPlaying={playback.isPlaying}
  />
)}
```

### Hard prerequisites (DONE / TODO)
- ✅ **`Permissions-Policy: microphone=(self)`** — already set in `apps/frontend/next.config.js:247` (the audit flagged this as missing `microphone=()`; it has since been fixed). No action needed.
- ❌ **DO NOT** create a new top-level route (`/timing-mirror`, `/app/...-test`, a `/drum-record` sibling). CLAUDE.md warns against orphan/versioned pages; they ship to prod unless gated. The dev-flagged panel inside an existing component is the correct shape.

### File to create
```
apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/
  TimingMirrorPanel.tsx          # the dev panel (UI + orchestration)
  timing-mirror/
    captureBassInput.ts          # getUserMedia + MediaStreamSource lifecycle
    bassOnsetDetector.ts         # detectOnsetsDetailed wrapper, bass-tuned
    scoreAgainstGrid.ts          # clock bridge + BeatTimingAnalyzer feeding
    TimingMirrorVisualizer.tsx   # the DAW-like attack-vs-grid canvas
```

---

## 2. The exact REUSE wiring (capture → onset → clock bridge → score)

### 2a. Capture: `getUserMedia` on the ENGINE context
Source the context from `WindowRegistry.getAudioContext()` **at capture time** (never cache across play sessions; never `new AudioContext()`).

```ts
// captureBassInput.ts
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

async function startCapture() {
  // Piggyback on the SAME user gesture that resumed the context (Safari + permission).
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,   // MANDATORY off — destroys bass signal
      autoGainControl: false,    // MANDATORY off
      noiseSuppression: false,   // MANDATORY off
      channelCount: 1,
    },
  });
  const ctx = WindowRegistry.getAudioContext();          // THE engine context
  if (!ctx || ctx.state === 'closed') throw new Error('no live context');
  const source = ctx.createMediaStreamSource(stream);    // bound to THIS ctx for life
  return { stream, source, ctx };
}
```

The forced `echoCancellation/AGC/NS = false` triad is verbatim from `recording-latency/index.html:173-178` and the capture contract in `PRACTICE_TOOLS_FEASIBILITY.md:612`.

**Recording the buffer for offline analysis** (cleanest for the spike — onset DSP is offline): tap the `source` into a capture `AudioWorkletNode` (ring buffer) OR a `MediaRecorder` and decode to an `AudioBuffer`. The detector (`detectOnsetsDetailed`) runs on an `AudioBuffer`, so either path works. For v1, **`MediaRecorder` → `decodeAudioData`** is the least code; upgrade to a capture worklet (numberOfInputs:1, registered via the `SoundTouchInsert.register()` WeakSet pattern — `apps/frontend/src/domains/playback/services/core/pitch-shift/SoundTouchInsert.ts:63`) only if you need live/streaming onsets.

> **Do NOT** extend `public/worklets/timing-processor.js` — it's declared `numberOfInputs:0` and can't see mic input. A capture worklet needs its own processor file.

### 2b. Onset detection (see §3 for tuning)
```ts
import { detectOnsetsDetailed } from '@/domains/playback/services/core/drum-slicer/detectOnsets';
const onsets = detectOnsetsDetailed(highPassedBassBuffer, {
  minOnsetGapSeconds: 0.08,      // bass min-note-spacing (was 0.035 drum default)
  sensitivity: 0.6,              // tune by ear
  minRelativeStrength: 0.12,
}); // → OnsetInfo[] {time (seconds, buffer-relative), confidence}
```

### 2c. CLOCK BRIDGE (the load-bearing reconciliation)
This is the #1 correctness hazard. Verified facts from `BeatTimingAnalyzer.ts`:
- `start()` anchors `this.startTime = performance.now()` (line 48) — **wall-clock ms, document origin**.
- `recordBeat(source, beat, measure, actualTime?)`: `now = actualTime || performance.now()` (line 77), `elapsedTime = now - this.startTime` (line 79).
- `expectedTime` is **ms**: `beatDuration = 60000 / tempo` (line 98), `expectedTime = totalBeats * beatDuration` (line 101). `drift = elapsedTime - expectedTime` (line 104).
- The dedup window is `< 100` (ms, line 87). The drift warn is `> 10` (ms, line 123). `syncScore` uses `Math.abs(averageDrift) * 2` (line 187) — all ms-domain.

**The bridge (recommended — zero change to the drift math):**

1. **Anchor in the audio clock.** Use the engine's existing grid anchor as T0:
   ```ts
   const audioT0 = loopStartAudioTime;   // already audioContext.currentTime-domain seconds
   ```
   This is the *future* count-in anchor — bar-1 downbeat — and it is the SAME origin the waveform/`useReferenceDrop` use, so the analyzer's grid and the engine's grid agree by construction.

2. **Call `start(tempo, {numerator: 4, denominator: 4})`** to set tempo, then **neutralize its `performance.now()` anchor** so the subtraction base is 0:
   ```ts
   const analyzer = new BeatTimingAnalyzer();
   analyzer.start(currentBpm);            // sets startTime = performance.now()
   // overwrite so elapsedTime === actualTime (no epoch skew):
   (analyzer as any).startTime = 0;       // OR fork a thin variant taking an audio anchor
   ```
   > Cleaner long-term: fork a `startWithAudioAnchor(tempo)` that sets `startTime = 0`, leaving the rest untouched. For a spike, the cast is acceptable and isolated.

3. **Per onset, pass RELATIVE MILLISECONDS in the audio clock:**
   ```ts
   const relMs = (onsetCtxSeconds - audioT0) * 1000;   // seconds→ms, rebased
   analyzer.recordBeat('user-bass', beatNumber, measureNumber, relMs);
   ```
   - `onsetCtxSeconds` = the onset time **in `audioContext.currentTime`** (buffer-relative onset + the ctx time the recording started).
   - The `*1000` is mandatory — without it drift is 1000× wrong and `syncScore` collapses to 0.
   - Because `startTime = 0`, `elapsedTime = relMs`, and `drift = relMs − expectedTime` — both now in ms, both in the audio clock. **One clock, end to end.**

4. **Supply the grid slot per onset.** `expectedTime` falls out of `measureNumber`/`beatNumber` (lines 98–101). Compute which slot each onset is aiming at using the deterministic grid (§2d), then pass those indices. Drift is then automatic.

**Why not a fixed offset between `performance.now()` and `currentTime`?** The probe proved there is NO stable additive constant — origins differ by tens of seconds and the `AudioContext` can be recreated across resumes/closes. The only robust bridge is: anchor AND onsets BOTH from the same live context (`WindowRegistry.getAudioContext()`), rebase, ×1000.

**Falsy-zero trap:** `actualTime || performance.now()` (line 77) means passing `0` silently falls back to wall-clock. The first onset exactly on the anchor would be `relMs = 0`. Guard: nudge to `Number.EPSILON` or fork to use `?? `/explicit-undefined. (For a real take the first onset is never exactly at T0, but handle it.)

### 2d. The expected GRID (deterministic, NOT `getAudioPhase`)
Copy `useReferenceDrop.ts:200-258` verbatim — it's the canonical scoring grid in this codebase and survives tempo re-anchor + count-in by construction:

```ts
const barSeconds  = loopDurationSeconds / lengthBars;     // current tempo
const beatsPerBar = 4;                                     // hook hardcodes 4/4 — supply it yourself
const beatSeconds = barSeconds / beatsPerBar;
// per onset, in audio-ctx seconds:
const elapsed = onsetCtxSeconds - loopStartAudioTime;      // negative during count-in → skip
const absBeat = Math.round(elapsed / beatSeconds);         // nearest grid beat
const measureNumber = Math.floor(absBeat / beatsPerBar);
const beatNumber    = ((absBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
```

**Do NOT use `getAudioPhase()` for scoring** — it's visual-latency-shifted (~185ms), slewed, reports ~1.0 at the loop origin, and is non-monotonic across tempo nudges. It's a playhead, not a scoring clock. `useReferenceDrop` explicitly abandoned it for exactly this reason.

### 2e. Read the score
```ts
const stats = analyzer.getStatistics('user-bass');
// { averageDrift, jitter, consistency, driftTrend, syncScore, totalBeats, ... }
```
- `averageDrift` → **offset** (calibration constant, see trust gate).
- `jitter` → **the timing-quality metric** (stddev of drift).
- `syncScore` → the headline number AFTER offset is calibrated out.

---

## 3. The ONSET detector approach

**Reuse `detectOnsetsDetailed` (`detectOnsets.ts:132`). Do NOT write a new detector and do NOT mutate this one in place** — it's the live drum-slicer analysis path (ear-tuned against Ableton's ~90-transient density, has a parked double-length bug). Import read-only or copy; pass per-call options, never edit the `DEFAULTS`.

### Why this over the removed probe
The removed `BassRecorderPanel`/`useBassRecorder` used amplitude-threshold onset (`first sample crossing 40% of peak`, no refractory, no HPF). Documented failure: **over-triggered on bass sustain** (counted 92 onsets on a 14s line vs ~75 real), inflating jitter (`PRACTICE_TOOLS_FEASIBILITY.md:640-641`). Spectral-flux + confidence is categorically stronger for sustained material.

### The three bass-specific fixes (the probe's documented prescription, applied via options + pre-filter)
1. **High-pass the input first** (~40–120 Hz floor cut) before handing the buffer to the detector. A held ~41 Hz E1 crosses an amplitude threshold repeatedly during its slow decay; HPF kills the sustain energy that fakes re-onsets. Apply offline (biquad over the recorded buffer) or via a `BiquadFilterNode` in the capture chain.
2. **Min-note-spacing / refractory:** raise `minOnsetGapSeconds` from the drum default `0.035` to ~`0.08` (one bass note = one onset). This is a per-call option — no constant edit.
3. **SKIP `suppressBodyFragments`** (`DrumBeatsPlayer.ts:211`) — it's a 140ms drum-body merge window, the OPPOSITE of what sustained bass wants. Call `detectOnsetsDetailed` directly, not via `DrumBeatsPlayer.analyze()`.

### Onset-time convention bias
`detectOnsets.ts` reports onset time = **frame START** (FFT window start), used as the attack edge. For grid comparison this is a systematic ~0–21ms bias (at fftSize 1024). Account for it: subtract half the constant, OR fold it into the calibrated offset (it presents as constant offset, which the offset/jitter split absorbs — see §5).

### Read `context.sampleRate` at runtime
The live rate is 44100 OR 48000 depending on entry path. `detectOnsets.ts` already derives windowing from `buffer.sampleRate` correctly — never hardcode 48k.

### Fallback / cross-check detector
`docs/dev-tools/drum-spike-meter.js:83 detectPeaks()` (RMS-energy envelope, 18%-of-peak adaptive, 40ms debounce) is a clean standalone amplitude picker. Use it as a **cross-check** during validation (if two independent detectors disagree on note count, the take is untrustworthy), not as the primary.

---

## 4. The VISUALIZATION (the impressive part)

Goal: make the timing truth **undeniable** — the user should SEE their attack land off the grid before they read any number. Render to a `<canvas>` in `TimingMirrorVisualizer.tsx`.

### Primary view: attack-vs-grid "piano-roll lane"
- **Horizontal time axis** = one or two loops, anchored at `loopStartAudioTime`.
- **Vertical grid lines** at every `beatSeconds` (subdivide to 8ths/16ths faintly) — the **expected grid**, drawn from the deterministic `loopStart + k×beatSeconds` math (NOT `getAudioPhase`).
- **For each detected onset:** a vertical tick at its actual time, **color-coded by drift sign** (e.g. warm = late/drag, cool = early/rush, neutral/green = within ±tolerance). The tick's horizontal distance from the nearest grid line IS the drift, drawn at scale — the visceral "you're consistently 30ms behind" picture.
- **Confidence → opacity/height** of the tick (low-confidence onsets fade), so the user sees which detections are weak.

### Secondary overlays (make the number trustworthy on sight)
- **Drift histogram / scatter** along the bottom: each onset's drift in ms, mean line (= `averageDrift`/offset) and ±1σ band (= `jitter`). A tight cluster off-center = "you're consistently late but steady" (good pocket, bad calibration); a wide smear = "erratic" (`driftTrend`). This visual directly mirrors the `offset` vs `jitter` split.
- **Live read-head** (optional) gliding across the lane during playback for orientation — reuse the groove-card glide-overlay pattern, but label it clearly as visual-only (it carries the ~185ms shift).
- **The number, last:** `syncScore` + `jitter (ms)` + `driftTrend` badge, shown only AFTER the round-trip offset is calibrated out (§5). Label honestly: e.g. "Timing tightness: ±Xms jitter" not "99% perfect".

### Why this is the impressive part
The DAW-attack-vs-grid is the same instrument pros trust (Ableton/Logic warp markers). Seeing your own note physically sit behind the beat-line is more convincing than any percentage — and it's self-verifying: if the visual shows ticks ON the lines but the number says "you drag", the user (and we) catch the lie immediately. The visual IS part of the trust gate.

---

## 5. The ACCURACY / TRUST gate

The spike is unpublishable until it proves the number matches the ear. Five checks, in order:

### G1 — Offset/jitter split (mandatory framing)
Never show raw `onset − T0`. Split into:
- **Offset** = `averageDrift` (constant: system latency + acoustic round-trip + frame-start bias). Calibrated out, reported separately as "rig latency", NOT as player error.
- **Jitter** = stddev of drift = the actual timing-quality metric.

Raw onset-minus-T0 reads as a confident "you rush/drag ~150ms" that is pure output+input latency. This is THE impressive-but-wrong trap.

### G2 — Round-trip calibration (measure the rig, subtract it)
Reuse the loopback-click + punch-in method from `recording-latency/index.html` (section 2 + section 3, lines ~330-336): play a known click, capture it, measure round-trip, subtract the mean before claiming any absolute "you were X ms late". Capture latency was already measured at ~±5–11ms on a DI rig (no daemon). Run this calibration at the START of every session; store the offset; subtract from `averageDrift` so the residual is the player's true offset.

### G3 — Note-count sanity (catches sustain over-trigger AND bleed)
Before showing ANY number: compare **detected onset count** to the **authored bassline's known note count** for the test groove (memory: `test-groove-2` is the auth-gated tutorials groove). If detected count exceeds authored by more than a small margin → **refuse to score** and surface "detector over-triggering / bleed detected". This single guard catches both the sustain-over-trigger defect and backing-track bleed (extra kick onsets).

### G4 — Ear A/B (ground truth is the user's ear — per memory `feedback-ear-first-measurement`)
1. Play a line deliberately **dead-on** → number must say tight (low jitter, near-zero residual offset).
2. Play deliberately **sloppy/late** → number must move proportionally and in the right direction (`driftTrend: 'late'`).
3. Play **constant timing across octaves** (low E1 → high notes) → residual offset must NOT correlate with pitch. If low notes read "late", the detector is taking onset from pitch-confidence not the attack transient (the ~50–70ms low-note physics floor) — fix by taking onset from the broadband attack, keep timing grading separate from pitch.
4. **Waveform zoom cross-check:** for any onset the number flags, zoom the recorded buffer and confirm the attack is actually where the detector says (memory: show the SPECIFIC audible artifact; a metric disagreeing with the ear means the metric is wrong).

### G5 — Capture-path scoping (laptop-mic vs DI)
- **Published number: DI rig only** (Focusrite/interface DI + headphones — the config the capture test was PROVEN on). The backing never enters the input, so no bleed.
- **Laptop-mic path:** explicitly scoped OUT of any published number for v1. If demoed at all, REQUIRE headphones (the "setup nudge") so the speaker output isn't in the mic field, AND apply known-backing exclusion: we author the groove, so we know where the kicks/snares are — reject detected onsets whose timing coincides with known backing events (anti-bleed by exclusion). A laptop-mic demo that scores a SILENT take as "in the pocket" from kick bleed is the fastest trust-kill.

### Honest expectation-setting
Do NOT borrow `TimingMetricsCollector`-style confidence (sub-ms jitter, "99% EXCELLENT") — that collector grades deterministic scheduled events, not a live acoustic signal, and STILL hit 409ms false jitter from a wrong `transportStartTime` and 3% accuracy from assuming 120 BPM. A clean DI rig + good detector realistically yields a jitter floor near the punch-in residual (sub-3ms was for tap-clicks, NOT sustained bass — expect higher for bass). Say so. A flattering number that collapses the moment a skeptical bassist plays deliberately sloppy and still scores 99% is worse than no number.

---

## 6. LANDMINES and how the plan handles each

| Landmine | Source | Handling |
|---|---|---|
| **Clock mismatch** — `performance.now()` ms vs `audioContext.currentTime` s, different unit AND origin | clock-reconciliation probe (blocker) | §2c bridge: anchor `startTime = 0`, pass `(onsetSec − loopStartAudioTime) × 1000` as relative ms. One clock end-to-end. No fixed-offset shortcut (origins drift across resumes). |
| **Wrong scoring clock** — `getAudioPhase` is latency-shifted/slewed | groove-card audit | §2d: deterministic `loopStart + k×beatSeconds`, copy `useReferenceDrop`. Never score off `getAudioPhase`. |
| **Count-in future anchor** — `loopStartAudioTime` is ~1 bar in the FUTURE at play start; `now − loopStart` is negative during count-in | groove-card audit + anchor probe | Gate scoring on `loopStartAudioTime != null && (getCurrentTime() − loopStartAudioTime) >= 0`. Drop the count-in→loop-1 seam wrap (not a completed loop). |
| **Mispredicted anchor** — `loopStartAudioTime` is a PREDICTED future time; engine settles over ~10s; first play after PM2 restart unreliable | anchor probe (high) | Let the engine settle (≥10s) before recording; ignore first-play-after-restart. Presents as constant offset → G1 split + G2 calibration absorb it. Optionally anchor to MEASURED count-in onset via `onset-meter.js` for the gold-standard read. |
| **AudioContext lifecycle** — `MediaStreamSource` is bound to one context; engine can `close()` it (ErrorRecovery, teardown) and only rebinds on `state==='closed'`, NOT on a different-but-running context | context-lifecycle probe (high) | Source context from `WindowRegistry.getAudioContext()` at node-build time; subscribe `AudioContextManager.onGlobalStateChange`; on `'closed'`, `track.stop()` + tear down + re-acquire. Build the input node inside the play() self-heal window (`useGrooveCardPlayback.ts:1401-1417` pattern: check `needsContextRebind`, rebind, THEN build nodes). |
| **Mic not released** — `context.close()` does NOT stop `MediaStream` tracks | context-lifecycle probe | Own `track.stop()` explicitly on teardown or the OS mic indicator leaks across engine restart. |
| **Wrong context authority** — `widgets/utils/audioContextManager.ts` holds a stale ref; probe contexts open/close unsupervised | context-lifecycle probe (medium) | Acquire ONLY from `WindowRegistry.getAudioContext()` / engine `getContext()`. Listen for statechange on YOUR captured instance, not any global. |
| **Sustain over-trigger** — amplitude onset fakes re-onsets on bass decay | onset-trust probe (blocker) | §3: spectral-flux (`detectOnsetsDetailed`) + HPF pre-filter + `minOnsetGapSeconds ~0.08` + SKIP `suppressBodyFragments`. G3 note-count guard refuses to score if count is impossible. |
| **Backing-track bleed** — laptop mic hears our own kicks as onsets; AGC/NS forced off | onset-trust probe (high) | §5 G5: DI-only published number; laptop = headphones + known-backing exclusion. G3 catches extra onsets. |
| **Low-note detection lag** — onset from pitch-confidence drifts late on low notes (~50–70ms E1 floor) | onset-trust probe (medium) | Take onset from the broadband ATTACK transient (fast), keep timing grading separate from pitch grading. G4 step 3 validates offset doesn't correlate with pitch. |
| **Moving grid** — per-loop re-anchor + tempo nudges re-grid mid-take | onset-trust probe (medium) + groove-card audit | Lock the FIRST honest take to fixed tempo + full-loop region (no nudge, no slice). Re-derive `barSeconds` from LIVE `loopDurationSeconds`/bpm every frame; never cache one grid at record-start. |
| **Singleton collision** — shared `beatTimingAnalyzer` is live in `YouTubeWidgetPage` + `TimingDebugWindow` | timing-scoring audit (landmine) | `new BeatTimingAnalyzer()` per session. Never import the singleton. |
| **Missing `logger` import** — `BeatTimingAnalyzer.ts:50/71/91/124` reference a bare `logger` with NO import → `start()` throws `ReferenceError` at runtime | timing-scoring audit (blocker) | Step zero: add `import { getLogger } from '@/utils/logger.js'; const logger = getLogger('BeatTimingAnalyzer');` at top of the file (or strip the log lines). Mandatory before any call. |
| **Falsy-zero `actualTime`** — `actualTime || performance.now()` treats `0` as "not provided" | clock probe (medium) | First onset exactly at T0 → nudge `relMs` to `Number.EPSILON`, or fork to `?? `. |
| **Dedup eats fast onsets** — 100ms same-beat dedup | timing-scoring audit | Onset density on a bassline is < 1/100ms in normal play; if a fast line is tested, relax/fork the dedup. Verify count via G3. |
| **New top-level route** | dev-tools-home audit | Dev-flagged panel inside `GrooveCardBlockView`, env-gated. No new page. |

---

## 7. Step-by-step BUILD ORDER

Each step has a **what to write** and a **test at this step** so failures localize.

**Step 0 — Unblock `BeatTimingAnalyzer`.**
Add the missing `logger` import (or strip the 4 log lines). 
*Test:* `new BeatTimingAnalyzer(); a.start(120); a.recordBeat('x',0,0,500); a.getStatistics('x')` runs without `ReferenceError` and returns sane stats. (Do this in a scratch unit test, not the app.)

**Step 1 — Clock-bridge unit (pure, no audio).**
Write `scoreAgainstGrid.ts`: given `loopStartAudioTime`, `loopDurationSeconds`, `lengthBars`, `bpm`, and a list of synthetic onset times in ctx-seconds, produce `recordBeat` calls and return `getStatistics`. 
*Test:* feed perfectly-on-grid synthetic onsets → `jitter ≈ 0`, `syncScore ≈ 100`, `averageDrift ≈ 0`. Feed onsets shifted by a constant +30ms → `averageDrift ≈ 30`, `jitter ≈ 0`. Feed jittered onsets → `jitter` matches the injected stddev. **This proves the bridge math before any mic touches it.**

**Step 2 — Onset detector (offline, on a known buffer).**
Write `bassOnsetDetector.ts`: HPF + `detectOnsetsDetailed({minOnsetGapSeconds: 0.08})`, no body-suppression. 
*Test:* run on a rendered/known bass clip (or the audio-audit harness output) where the note count is known. Detected count must match within G3 margin. Compare against `drum-spike-meter.js detectPeaks` cross-check.

**Step 3 — Capture lifecycle (mic in, buffer out).**
Write `captureBassInput.ts`: `getUserMedia` (triad off) → `MediaStreamSource` on `WindowRegistry.getAudioContext()` → `MediaRecorder` → `decodeAudioData`. Subscribe `onGlobalStateChange`; on `'closed'` tear down + `track.stop()`. 
*Test:* click record, play a few notes, confirm a non-empty `AudioBuffer` at the live `context.sampleRate`; confirm `track.stop()` clears the OS mic indicator; force an engine restart and confirm the chain rebuilds (no silent-orphan).

**Step 4 — End-to-end score (capture → detect → bridge → score), numbers in console.**
Wire steps 1–3 in `TimingMirrorPanel.tsx` behind the env flag inside `GrooveCardBlockView`. Mute bass via `setStemMuted('audio-bass', true)`. Gate on count-in (`elapsed >= 0`). Let engine settle ≥10s. Log `stats` to console. 
*Test:* play dead-on → tight; play sloppy → moves correctly. **Numbers only, no visual yet** — proves the pipeline before investing in the canvas.

**Step 5 — Round-trip calibration (G2).**
Add the loopback-click round-trip measurement (lift from `recording-latency/index.html` sections 2–3). Subtract the measured offset from `averageDrift`. 
*Test:* on a DI rig, residual offset after calibration is near-zero for a dead-on take.

**Step 6 — Visualization (the impressive part).**
Write `TimingMirrorVisualizer.tsx`: attack-vs-grid lane + drift histogram + offset/jitter overlay. 
*Test:* G4 ear A/B — the visual ticks must visibly sit off the grid lines for a sloppy take and ON them for a tight take, matching the number.

**Step 7 — Trust gate hardening.**
Wire G3 (note-count refusal), G5 (DI-only published / laptop headphones+exclusion). 
*Test:* a silent take or a bleed-heavy laptop take REFUSES to score (doesn't report "in the pocket").

---

## 8. TEST CHECKLIST (must answer before wiring into a real flow)

The spike is "done" only when every box is checked. These map 1:1 to the trust gate.

- [ ] **Bridge correctness:** synthetic on-grid onsets → `syncScore ≈ 100`, `jitter ≈ 0`; +30ms constant shift → `averageDrift ≈ 30`, `jitter ≈ 0`; injected stddev → `jitter` matches. (No clock corruption.)
- [ ] **Note-count sanity (G3):** detected onset count matches the authored bassline count for `test-groove-2` within margin; an over-trigger or bleed take is REFUSED, not scored.
- [ ] **Offset/jitter split (G1):** the UI shows offset and jitter SEPARATELY; no raw `onset − T0` is ever presented as player error.
- [ ] **Round-trip calibrated (G2):** measured rig round-trip subtracted; residual offset on a dead-on DI take is near-zero.
- [ ] **Ear A/B (G4):** dead-on reads tight; deliberately late reads `driftTrend: 'late'` proportionally; the visual ticks match the ear; waveform-zoom confirms flagged onsets are real attacks.
- [ ] **Pitch independence (G4-3):** constant-timing line across octaves → residual offset does NOT correlate with note pitch (onset taken from attack, not pitch-confidence).
- [ ] **Lifecycle resilience:** engine `close()`/restart mid-session rebuilds the capture chain (no silent orphan); `track.stop()` releases the mic.
- [ ] **Anchor stability:** engine settled ≥10s before recording; not run on first-play-after-PM2-restart; tempo locked + full-loop region for the honest take (no mid-take re-grid).
- [ ] **Capture-path scoping (G5):** published number is DI-only; laptop-mic path requires headphones + known-backing exclusion, or is explicitly unscored.
- [ ] **No singleton collision:** uses `new BeatTimingAnalyzer()`, not the shared singleton; doesn't disturb `YouTubeWidgetPage`/`TimingDebugWindow`.
- [ ] **Prod-safe:** panel is env-gated (`NEXT_PUBLIC_BASS_RECORDER_PROBE`), tree-shakes out, no new top-level route, `microphone=(self)` confirmed in `next.config.js`.

---

## Appendix — key file/API references (verified)

- **Scoring:** `apps/frontend/src/domains/playback/utils/BeatTimingAnalyzer.ts` — `start(tempo, timeSig)` :45, `recordBeat(source,beat,measure,actualTime?)` :58, `getStatistics(source?)` :135, `syncScore` formula :185-189. ⚠️ missing `logger` import :50/71/91/124. Singleton `beatTimingAnalyzer` :321 — DO NOT reuse.
- **Onset DSP:** `apps/frontend/src/domains/playback/services/core/drum-slicer/detectOnsets.ts` — `detectOnsetsDetailed(buffer, options)` :132, `DEFAULTS` (drum-tuned, don't edit) :42. SKIP `DrumBeatsPlayer.suppressBodyFragments` (`DrumBeatsPlayer.ts:211`).
- **Grid / clock:** `useGrooveCardPlayback.ts` — `loopStartAudioTime` (future count-in anchor) :1505-1506, `loopDurationSeconds` :579, `getCurrentTime` :588-606, `setStemMuted('audio-bass', ...)` :909-920, context-ref refresh :463-473. **Scoring grid template:** `useReferenceDrop.ts:200-258`.
- **Context:** `WindowRegistry.getAudioContext()` :139 (canonical read), `AudioContextManager.onGlobalStateChange` (:248) for close/rebind. Worklet registration template: `SoundTouchInsert.register()` :63.
- **Wiring point:** `GrooveCardBlockView.tsx` ~:874-930,974 (threads audioContext + loopStart + loopDuration + setStemMuted into children).
- **Capture-path DSP to lift:** `docs/dev-tools/recording-latency/index.html` (getUserMedia triad-off :173-178, round-trip/punch-in :245-252, :330-336). Cross-check picker: `docs/dev-tools/drum-spike-meter.js:83`.
- **Prereq:** `apps/frontend/next.config.js:247` — `microphone=(self)` ✅ already set.
- **Spec + prior-art prose:** `docs/HONEST_MIRROR_BUILD_OPTIONS.md`, `docs/PERFORMANCE_ANALYSIS_FEASIBILITY.md`, `docs/PRACTICE_TOOLS_FEASIBILITY.md:625-654`.
