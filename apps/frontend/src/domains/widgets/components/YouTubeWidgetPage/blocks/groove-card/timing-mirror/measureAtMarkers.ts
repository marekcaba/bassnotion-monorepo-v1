/**
 * measureAtMarkers — the Yousician/Rocksmith grading mechanic for the bass coach.
 *
 * THE MODEL (the user's insight, 2026-06-21): do NOT globally detect the player's onsets
 * and then reconcile two lists (that two-list matching was the entire source of the
 * missed/noise mess). Instead, the COACH'S AUTHORED MARKERS are the only anchors. For
 * each marker — whose time we KNOW — open a small window in the PLAYER'S RAW AUDIO and
 * find where the player's transient actually is inside that window. The distance from the
 * marker to that transient IS the timing error for that note. No transient in the window
 * → that note was missed. This is exactly how Yousician/Rocksmith grade against a chart:
 * the expected position drives the search; you never blindly transcribe the player.
 *
 * Why it's simpler AND more correct than the old detect+align:
 *   - It can't produce phantom player onsets — we only look where a marker points.
 *   - It can't mis-pair two lists — there are no two lists.
 *   - A body ripple BETWEEN notes is never examined (no marker points at it).
 *   - The number of measurements is exactly the number of markers — always.
 *
 * The transient locator inside a window: a local complex-domain-style energy-rise search
 * (the steepest sustained rise = the attack). We reuse the proven attack-edge idea, run
 * locally and anchored, so it lands on the pluck regardless of body loudness.
 *
 * Pure + offline: signal + marker times in, per-marker measurements out. Unit-tested.
 */

export interface MarkerMeasurement {
  /** The authored coach marker time (audio-ctx seconds). */
  markerSec: number;
  /** Where the player's transient was found in the window (ctx seconds), or null if no
   *  transient cleared the threshold → the note was MISSED. */
  playerSec: number | null;
  /** playerSec − markerSec (seconds). null when missed. Positive = player late. */
  errorSec: number | null;
  /** Strength of the found transient (0..1, relative to the window's own energy) — for
   *  the viz / a confidence read. 0 when missed. */
  strength: number;
}

export interface MeasureOptions {
  /** Half-width of the search window around each marker (seconds). The player may be
   *  early OR late, so we look both sides. ±0.12s catches a badly-dragged note while
   *  staying well inside one beat at typical bass tempos. */
  windowSec?: number;
  /** Min transient strength (local rise / window peak) to count as a real hit. */
  minStrength?: number;
  /** Min ABSOLUTE energy at the found attack, as a fraction of the TAKE's peak energy.
   *  This is the ripple-tail rejecter: a real attack reaches a meaningful absolute level;
   *  a decaying note's body ripple rises locally (high relative strength) but its absolute
   *  energy is LOW (the note faded) — so it fails this gate. Without it, a marker placed
   *  over a previous note's tail false-positives. */
  minAbsLevel?: number;
  /** Short-time energy step for the local envelope (seconds). */
  envStepSec?: number;
}

const DEFAULTS: Required<MeasureOptions> = {
  windowSec: 0.12,
  minStrength: 0.18,
  minAbsLevel: 0.15,
  envStepSec: 0.002,
};

/**
 * For each marker, find the player's transient in a window around it and measure the
 * offset. Returns one measurement per marker, in marker order.
 *
 * @param signal       the player's RAW captured take (mono Float32, normalize first).
 * @param sampleRate   take sample rate.
 * @param startedAtSec ctx time of the take's sample 0 (so window math is in ctx time).
 * @param markersSec   the coach's authored marker times, in ctx seconds.
 */
export function measureAtMarkers(
  signal: Float32Array,
  sampleRate: number,
  startedAtSec: number,
  markersSec: number[],
  opts: MeasureOptions = {},
): MarkerMeasurement[] {
  const windowSec = opts.windowSec ?? DEFAULTS.windowSec;
  const minStrength = opts.minStrength ?? DEFAULTS.minStrength;
  const minAbsLevel = opts.minAbsLevel ?? DEFAULTS.minAbsLevel;
  const envStep = Math.max(1, Math.floor((opts.envStepSec ?? DEFAULTS.envStepSec) * sampleRate));

  // Local RMS energy at sample i over [i, i+envStep).
  const energyAt = (i: number): number => {
    const start = Math.max(0, i);
    const end = Math.min(signal.length, start + envStep);
    let s = 0;
    for (let k = start; k < end; k++) {
      const v = signal[k] ?? 0;
      s += v * v;
    }
    return Math.sqrt(s / Math.max(1, end - start));
  };

  // The TAKE's peak energy (for the absolute-level gate that rejects decayed ripple).
  let takePeak = 0;
  for (let i = 0; i < signal.length; i += envStep) {
    const e = energyAt(i);
    if (e > takePeak) takePeak = e;
  }
  const absFloor = takePeak * minAbsLevel;

  return markersSec.map((markerSec) => {
    // window in BUFFER samples (marker is ctx time; buffer time = ctx − startedAt)
    const centerBuf = Math.round((markerSec - startedAtSec) * sampleRate);
    const halfW = Math.round(windowSec * sampleRate);
    const from = Math.max(0, centerBuf - halfW);
    const to = Math.min(signal.length - envStep, centerBuf + halfW);
    if (to <= from) {
      return { markerSec, playerSec: null, errorSec: null, strength: 0 };
    }

    // Build the local energy envelope and find the largest POSITIVE RISE (the attack
    // edge) — and require it to clear the window's noise floor. The rise FOOT (where it
    // leaves the floor) is the transient time. Loudness-invariant within the window.
    let prevE = energyAt(from);
    let envPeak = prevE;
    let bestRise = 0;
    let bestFoot = -1;
    for (let i = from + envStep; i <= to; i += envStep) {
      const e = energyAt(i);
      if (e > envPeak) envPeak = e;
      const rise = e - prevE;
      if (rise > bestRise) {
        bestRise = rise;
        bestFoot = i - envStep; // foot of the steepest rise = the attack onset
      }
      prevE = e;
    }

    // Strength = the steepest rise relative to the window's peak energy. A real attack
    // rises a large fraction of the note's energy fast; sustain/silence barely rises.
    const strength = envPeak > 1e-6 ? Math.min(1, bestRise / envPeak) : 0;
    // ABSOLUTE-LEVEL gate: the energy the attack rises TO must clear the take-relative
    // floor. A real attack reaches a loud level; a decayed note's body ripple has high
    // RELATIVE strength but LOW absolute energy → rejected (no phantom on a tail).
    const levelAfter = bestFoot >= 0 ? energyAt(bestFoot + envStep) : 0;
    if (bestFoot < 0 || strength < minStrength || levelAfter < absFloor) {
      return { markerSec, playerSec: null, errorSec: null, strength };
    }

    const playerSec = startedAtSec + bestFoot / sampleRate;
    return { markerSec, playerSec, errorSec: playerSec - markerSec, strength };
  });
}

export interface MarkerScore {
  measurements: MarkerMeasurement[];
  /** hits / markers — how much of the part the player actually played. */
  coverage: number;
  hitCount: number;
  missedCount: number;
  /** Constant lean (ms) = median of the per-note errors. Capture latency + anticipation;
   *  calibrated out of the feel grade, reported separately. */
  offsetMs: number;
  /** De-meaned spread of the hit errors (ms) = the feel metric. */
  jitterMs: number;
}

/**
 * Summarise marker measurements into a score: coverage, the constant offset (median
 * error = latency/lean, calibratable) and the de-meaned jitter (the feel grade).
 */
export function scoreMarkerMeasurements(
  measurements: MarkerMeasurement[],
): MarkerScore {
  const hits = measurements.filter((m) => m.errorSec != null);
  const hitCount = hits.length;
  const missedCount = measurements.length - hitCount;
  const coverage = measurements.length > 0 ? hitCount / measurements.length : 0;

  if (hitCount === 0) {
    return { measurements, coverage, hitCount, missedCount, offsetMs: 0, jitterMs: 0 };
  }

  const errsMs = hits.map((m) => (m.errorSec as number) * 1000).sort((a, b) => a - b);
  const mid = errsMs.length >> 1;
  const offsetMs =
    errsMs.length % 2 ? errsMs[mid]! : (errsMs[mid - 1]! + errsMs[mid]!) / 2;
  // de-meaned spread (jitter) = stddev of (error − median): the feel, latency removed.
  const variance =
    errsMs.reduce((a, e) => a + (e - offsetMs) ** 2, 0) / errsMs.length;
  const jitterMs = Math.sqrt(variance);

  return { measurements, coverage, hitCount, missedCount, offsetMs, jitterMs };
}
