/**
 * onsetAmplitude — shared per-onset amplitude + envelope helpers for the bass
 * coach. Used by note-LENGTH detection (Step 5: where a note ends) and DYNAMICS
 * grading (Step 6: how hard each note is hit / ghost notes). One helper so both
 * dimensions measure amplitude the same way.
 *
 * Pure (Float32Array in, numbers out) — unit-tested offline.
 *
 * ⚠️ Footgun avoided: the reference RMS code in SpectralAnalyzer computes peak as
 * `Math.max(...channelData.map(Math.abs))` — spreading a Float32Array of hundreds
 * of thousands of samples OVERFLOWS the call stack. We copy only the RMS
 * sum-of-squares loop and compute peak with a plain for-loop.
 */

export interface OnsetAmplitude {
  /** RMS energy over the window (0..~1). The accent/dynamics measure. */
  rms: number;
  /** Peak |sample| over the window (0..1). */
  peak: number;
}

/**
 * Amplitude over a sample window [start, end). Clamps to buffer bounds; returns
 * zeros for an empty/invalid window. Plain loops — safe on large buffers.
 */
export function windowAmplitude(
  signal: Float32Array,
  startSample: number,
  endSample: number,
): OnsetAmplitude {
  const start = Math.max(0, Math.floor(startSample));
  const end = Math.min(signal.length, Math.floor(endSample));
  if (end <= start) return { rms: 0, peak: 0 };

  let sumSquares = 0;
  let peak = 0;
  for (let i = start; i < end; i++) {
    const s = signal[i] ?? 0;
    sumSquares += s * s;
    const a = s < 0 ? -s : s;
    if (a > peak) peak = a;
  }
  return { rms: Math.sqrt(sumSquares / (end - start)), peak };
}

/**
 * Amplitude in the ATTACK window after an onset — the per-note loudness used for
 * dynamics. `onsetSec` and `windowSec` are seconds; the window is clamped to the
 * buffer. ~30ms captures the attack body of a bass note without bleeding into the
 * next.
 */
export function onsetAmplitude(
  signal: Float32Array,
  sampleRate: number,
  onsetSec: number,
  windowSec = 0.03,
): OnsetAmplitude {
  const start = onsetSec * sampleRate;
  const end = (onsetSec + windowSec) * sampleRate;
  return windowAmplitude(signal, start, end);
}

/**
 * A smoothed amplitude ENVELOPE of the whole signal, one value per `hopSec` frame.
 * Asymmetric (fast attack, slow release) so it tracks note bodies and decays —
 * the basis for note-OFFSET (length) detection: a note "ends" where its envelope
 * falls below a fraction of its onset level (Step 5).
 *
 * Returns frames + the hop so the caller can map frame index ↔ time.
 */
export interface Envelope {
  /** One smoothed |amplitude| value per frame. */
  frames: Float32Array;
  /** Seconds between frames. frame i is centred at i * hopSec. */
  hopSec: number;
  sampleRate: number;
}

export function computeEnvelope(
  signal: Float32Array,
  sampleRate: number,
  opts: { hopSec?: number; attack?: number; release?: number } = {},
): Envelope {
  const hopSec = opts.hopSec ?? 0.005; // 5ms frames
  const attack = opts.attack ?? 0.6; // fast rise
  const release = opts.release ?? 0.08; // moderate fall — tracks the PLAYED note,
  // not the long natural decay tail (a plucked bass note rings out far past where
  // it's perceived to end; a too-slow release overestimates note length).
  const hop = Math.max(1, Math.floor(hopSec * sampleRate));
  const numFrames = Math.max(1, Math.floor(signal.length / hop));
  const frames = new Float32Array(numFrames);

  let env = 0;
  for (let f = 0; f < numFrames; f++) {
    // peak |sample| within this hop
    const start = f * hop;
    const end = Math.min(signal.length, start + hop);
    let blockPeak = 0;
    for (let i = start; i < end; i++) {
      const s = signal[i] ?? 0;
      const a = s < 0 ? -s : s;
      if (a > blockPeak) blockPeak = a;
    }
    // asymmetric follower
    env =
      blockPeak > env
        ? env + (blockPeak - env) * attack
        : env + (blockPeak - env) * release;
    frames[f] = env;
  }
  return { frames, hopSec: hop / sampleRate, sampleRate };
}

/**
 * Estimate a note's LENGTH (seconds) from the envelope: from its onset, walk
 * forward until the envelope falls below `endFraction` of the onset's local peak,
 * OR the next onset arrives, whichever comes first. This is the Step-5 primitive
 * (note-offset detection); kept here next to the envelope it reads.
 */
export function noteLengthFromEnvelope(
  env: Envelope,
  onsetSec: number,
  nextOnsetSec: number | null,
  endFraction = 0.25,
): number {
  const startFrame = Math.floor(onsetSec / env.hopSec);
  if (startFrame >= env.frames.length) return 0;
  // local peak = max over the first few frames after the onset (the attack body)
  const peakWindow = Math.max(1, Math.round(0.02 / env.hopSec)); // ~20ms
  let onsetPeak = 0;
  for (
    let f = startFrame;
    f < Math.min(env.frames.length, startFrame + peakWindow);
    f++
  ) {
    if ((env.frames[f] ?? 0) > onsetPeak) onsetPeak = env.frames[f] ?? 0;
  }
  if (onsetPeak <= 0) return 0;

  const threshold = onsetPeak * endFraction;
  const limitFrame =
    nextOnsetSec != null
      ? Math.floor(nextOnsetSec / env.hopSec)
      : env.frames.length;

  for (
    let f = startFrame + peakWindow;
    f < Math.min(env.frames.length, limitFrame);
    f++
  ) {
    if ((env.frames[f] ?? 0) < threshold) {
      return f * env.hopSec - onsetSec;
    }
  }
  // never dropped below threshold before the next onset / end → held until then
  const endSec =
    nextOnsetSec != null
      ? nextOnsetSec
      : env.frames.length * env.hopSec;
  return Math.max(0, endSec - onsetSec);
}
