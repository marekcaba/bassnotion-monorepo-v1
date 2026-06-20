/**
 * bassOnsetDetector — bass-tuned onset detection for the timing-mirror spike.
 *
 * Wraps the production drum-slicer detector (`detectOnsetsDetailed`,
 * spectral-flux + own FFT + per-onset confidence, 10 unit tests) READ-ONLY.
 * We pass per-call options and a pre-filtered buffer; we NEVER mutate the
 * drum-tuned DEFAULTS (that detector is the live slicer's analysis path, ear-
 * tuned against Ableton's transient density).
 *
 * Three bass-specific adaptations (the removed amplitude probe over-triggered on
 * bass sustain — 92 onsets on a 14s line vs ~75 real; spectral-flux + these fixes
 * is categorically stronger):
 *   1. HIGH-PASS the input first. A held ~41 Hz E1 sustains low-frequency energy
 *      that an amplitude gate re-triggers on; the ATTACK transient (pluck / finger
 *      noise) is broadband and survives the HPF, the sustain doesn't. So HPF keeps
 *      attack flux, kills sustain flux → one onset per note.
 *   2. minOnsetGapSeconds ~0.08 (one bass note = one onset; drum default 0.035 is
 *      too fast and splits a single note).
 *   3. SKIP suppressBodyFragments (a 140ms drum-body MERGE — the opposite of what
 *      sustained bass wants). We call detectOnsetsDetailed directly, never via
 *      DrumBeatsPlayer.analyze().
 *
 * Also drops the detector's synthetic origin onset (it always emits {time:0,
 * confidence:1}); a real first note is never exactly at sample 0.
 *
 * Pure (no AudioContext): the HPF is a direct biquad over the samples, so this is
 * unit-testable offline — Step 2 of the build order.
 */

import {
  detectOnsetsDetailed,
  type OnsetInfo,
} from '@/domains/playback/services/core/drum-slicer/detectOnsets.js';

export interface BassOnsetOptions {
  /** High-pass cutoff (Hz). Cuts sustain fundamentals below it, keeps attacks.
   *  CAUTION: too high cuts the ATTACK energy of very low notes too — an 80 Hz
   *  cutoff under-detects a 41 Hz low-E (its attack flux drops below threshold).
   *  ~45 Hz sits just under a low-E fundamental, taming the steady-state sustain
   *  drone while preserving the broadband pluck transient. Tune by ear; the
   *  spectral-flux's half-wave-rectified rising-energy bias does most of the
   *  sustain rejection anyway. 0 disables the HPF. */
  highPassHz?: number;
  /** Min gap between onsets (s). One bass note = one onset. */
  minOnsetGapSeconds?: number;
  /** Spectral-flux sensitivity (passed through). Higher = fewer onsets. */
  sensitivity?: number;
  /** Global confidence floor — drop onsets below this fraction of the loudest
   *  onset's flux. The drum default (0.12) is too aggressive for bass: a bass
   *  player's attack strength varies far more note-to-note than a drum machine's,
   *  and a quieter (but real) note's attack flux can sit well below the loudest
   *  note's. 0.05 keeps real-but-soft attacks while still culling the sustain
   *  re-trigger fragments (which sit ~0.01-0.04). Tune by ear against the
   *  note-count guard. */
  minRelativeStrength?: number;
}

const BASS_DEFAULTS: Required<BassOnsetOptions> = {
  highPassHz: 45,
  minOnsetGapSeconds: 0.08,
  sensitivity: 0.6,
  minRelativeStrength: 0.05,
};

/**
 * A 2nd-order Butterworth high-pass biquad, applied in-place over a mono signal.
 * Standard RBJ cookbook coefficients (Q = 1/√2). Pure JS so the wrapper needs no
 * AudioContext and stays unit-testable.
 */
export function highPassInPlace(
  signal: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  if (cutoffHz <= 0) return signal;
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const Q = Math.SQRT1_2; // Butterworth
  const alpha = sinw0 / (2 * Q);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  // normalize
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i]!;
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    signal[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return signal;
}

/** Build a single-channel AudioBuffer-shaped object from a Float32Array.
 *  detectOnsetsDetailed only reads getChannelData(0) + sampleRate + length, so a
 *  minimal duck-typed buffer avoids needing a real AudioContext in tests. */
function asMonoBuffer(signal: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: signal.length,
    duration: signal.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => signal,
  } as unknown as AudioBuffer;
}

/**
 * Detect bass note onsets in a mono signal. Returns onsets in seconds (ascending),
 * WITHOUT the synthetic origin, high-pass-filtered to suppress sustain re-triggers.
 *
 * Takes a Float32Array (not an AudioBuffer) so it's pure/testable; the caller
 * decodes the recorded take to mono samples first.
 */
export function detectBassOnsets(
  signal: Float32Array,
  sampleRate: number,
  options: BassOnsetOptions = {},
): OnsetInfo[] {
  const opt = { ...BASS_DEFAULTS, ...options };

  // HPF on a COPY (don't clobber the caller's buffer — they may want it for the
  // visualizer / waveform-zoom cross-check).
  const filtered = highPassInPlace(
    Float32Array.from(signal),
    sampleRate,
    opt.highPassHz,
  );

  const onsets = detectOnsetsDetailed(asMonoBuffer(filtered, sampleRate), {
    minOnsetGapSeconds: opt.minOnsetGapSeconds,
    sensitivity: opt.sensitivity,
    minRelativeStrength: opt.minRelativeStrength,
  });

  // Drop the detector's synthetic origin onset (it always prepends {time:0}).
  // A real first note is never exactly at sample 0; > ~1ms is safe.
  return onsets.filter((o) => o.time > 0.001);
}
