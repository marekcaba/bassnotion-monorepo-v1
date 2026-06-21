/**
 * verifyPitch — monophonic bass pitch detection for the bass coach (the "WHAT").
 *
 * THE MODEL: the coach grades onset TIMING via measureAtMarkers (the "WHEN"). Pitch adds
 * the "WHAT" — for each matched onset we detect the player's fundamental and compare to
 * the note the chart says should be there. This (a) confirms the right note, (b) rejects a
 * wrong-pitch hit, and (c) on WEAK/quiet notes — where the timing detector is least sure —
 * a clear pitch read disambiguates a real note from a wobble.
 *
 * Algorithm: YIN (de Cheveigné & Kawahara 2002) — autocorrelation-difference + cumulative
 * mean normalization + parabolic interpolation. Time-domain, not FFT (FFT-bin spacing is
 * ~2.5Hz between bass semitones at E1≈41Hz — far too coarse). The lag search is BOUNDED to
 * the bass register (B0≈30.9Hz … G2≈98Hz fundamentals, with headroom) — the primary
 * octave-error guard. Bass is monophonic, so a single-f0 search is valid.
 *
 * Returns { midi, confidence, cents } or null when no confident pitch (very short/staccato
 * notes, dead/ghost notes) — null is a FIRST-CLASS answer (never a guessed label). `cents`
 * (sub-Hz deviation from equal temperament) is a free byproduct, stored for future
 * intonation grading.
 *
 * Pure + offline: a Float32 window in, a pitch out. Unit-tested.
 */

export interface PitchResult {
  /** Detected MIDI note number (rounded to the nearest semitone). */
  midi: number;
  /** Detected fundamental in Hz (pre-rounding). */
  hz: number;
  /** YIN confidence in [0,1] = 1 − (CMND value at the chosen lag). Higher = surer. */
  confidence: number;
  /** Signed cents deviation from the nearest equal-tempered semitone (−50..+50). */
  cents: number;
}

export interface VerifyPitchOptions {
  /** Lowest fundamental to search (Hz). B0≈30.9 (5/6-string low B) with headroom. */
  minHz?: number;
  /** Highest fundamental to search (Hz). Bass rarely exceeds G2≈98; cap with headroom so
   *  a bright harmonic doesn't pull the estimate up an octave. */
  maxHz?: number;
  /** CMND threshold: the first lag whose normalized difference dips below this is the
   *  period. ~0.15 is the YIN-standard absolute threshold. Lower = stricter. */
  threshold?: number;
  /** Minimum confidence (1 − CMND) to RETURN a pitch; below → null (no confident read). */
  minConfidence?: number;
}

const DEFAULTS: Required<VerifyPitchOptions> = {
  minHz: 28, // a touch below B0 (30.9) for headroom
  maxHz: 400, // covers fretted bass well above G2; high enough headroom, low enough to
  // exclude most octave-up harmonic confusions on a clean DI
  threshold: 0.15,
  minConfidence: 0.5,
};

/** Hz → MIDI (float). A4=440=MIDI 69. */
export function hzToMidiFloat(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** MIDI → Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Detect the fundamental pitch of a mono signal WINDOW via YIN. The caller slices a window
 * starting ~10ms after the onset (skip the broadband attack) of length ≥ a few periods of
 * the lowest note (~65ms for low-B). Returns null if no confident pitch.
 */
export function verifyPitch(
  window: Float32Array,
  sampleRate: number,
  opts: VerifyPitchOptions = {},
): PitchResult | null {
  const minHz = opts.minHz ?? DEFAULTS.minHz;
  const maxHz = opts.maxHz ?? DEFAULTS.maxHz;
  const threshold = opts.threshold ?? DEFAULTS.threshold;
  const minConfidence = opts.minConfidence ?? DEFAULTS.minConfidence;

  // Lag (period in samples) search bounds from the Hz register. minHz → max lag.
  const maxLag = Math.floor(sampleRate / minHz);
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  // Need at least 2× maxLag samples for the difference function to be meaningful.
  if (window.length < 2 * maxLag) return null;

  const N = maxLag; // number of lags we evaluate
  // 1) Difference function d(tau) = sum_j (x[j] - x[j+tau])^2 over an integration window.
  const diff = new Float32Array(N + 1);
  const integ = window.length - maxLag; // samples used per lag
  for (let tau = minLag; tau <= maxLag; tau++) {
    let sum = 0;
    for (let j = 0; j < integ; j++) {
      const delta = (window[j] ?? 0) - (window[j + tau] ?? 0);
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // 2) Cumulative mean normalized difference (CMND). d'(0)=1; d'(tau)=d(tau)/((1/tau)·Σ).
  const cmnd = new Float32Array(N + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += diff[tau]!;
    cmnd[tau] = running > 0 ? (diff[tau]! * tau) / running : 1;
  }

  // 3) Absolute threshold: the FIRST lag (≥ minLag) where CMND dips below `threshold` and
  //    is a local minimum. If none, take the global minimum in range (best effort).
  let bestTau = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (cmnd[tau]! < threshold) {
      // descend to the local minimum of this dip
      while (tau + 1 <= maxLag && cmnd[tau + 1]! < cmnd[tau]!) tau++;
      bestTau = tau;
      break;
    }
  }
  if (bestTau < 0) {
    // no dip below threshold — global min as a fallback (lower confidence)
    let minVal = Infinity;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau]! < minVal) {
        minVal = cmnd[tau]!;
        bestTau = tau;
      }
    }
    if (bestTau < 0) return null;
  }

  // 4) Parabolic interpolation around bestTau for sub-sample period precision.
  let tauInterp = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const a = cmnd[bestTau - 1]!;
    const b = cmnd[bestTau]!;
    const c = cmnd[bestTau + 1]!;
    const denom = a + c - 2 * b;
    if (Math.abs(denom) > 1e-9) {
      tauInterp = bestTau + (a - c) / (2 * denom);
    }
  }

  const hz = sampleRate / tauInterp;
  if (hz < minHz || hz > maxHz) return null;

  const confidence = Math.max(0, Math.min(1, 1 - cmnd[bestTau]!));
  if (confidence < minConfidence) return null;

  const midiFloat = hzToMidiFloat(hz);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  return { midi, hz, confidence, cents };
}
