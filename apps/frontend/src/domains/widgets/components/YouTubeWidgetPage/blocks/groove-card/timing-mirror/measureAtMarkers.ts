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

/** Max look-BACK before a marker (seconds). Small, so a marker's window doesn't catch the
 *  PREVIOUS note's still-ringing sustain and land early on the wrong note. A genuinely
 *  early-played note is rare and small; the forward reach (windowSec) covers dragging. */
const BACK_REACH_SEC = 0.045;

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

  // Sort markers so we can bound each window by its neighbours (a marker must only search
  // its OWN note's territory — never reach into an adjacent note and grab THAT attack).
  const sorted = [...markersSec].sort((a, b) => a - b);
  const indexOf = new Map(sorted.map((t, i) => [t, i]));

  return markersSec.map((markerSec) => {
    // window in BUFFER samples (marker is ctx time; buffer time = ctx − startedAt)
    const centerBuf = Math.round((markerSec - startedAtSec) * sampleRate);
    // NEIGHBOUR-BOUNDED window: half the distance to the nearest adjacent marker, capped
    // at windowSec. THE FIX for the early/late bimodal bug — when notes are ~130ms apart,
    // a fixed ±120ms window reached BACK into the previous note and grabbed its (louder)
    // attack → false "early" measurement. Bounding to the midpoint keeps each marker in
    // its own note. Asymmetric: the back and forward reach are clamped independently.
    // ASYMMETRIC reach: a player's attack lands AT or slightly before/after its marker —
    // but the back-reach must stay SMALL so it doesn't catch the PREVIOUS note's still-
    // ringing sustain (which would land the marker early on the wrong note). Forward reach
    // can be larger (a dragged note is late). Both still neighbour-bounded so we never
    // cross into the adjacent note's attack.
    const i = indexOf.get(markerSec) ?? 0;
    const prevGap = i > 0 ? markerSec - sorted[i - 1]! : Infinity;
    const nextGap = i < sorted.length - 1 ? sorted[i + 1]! - markerSec : Infinity;
    const backSec = Math.min(BACK_REACH_SEC, prevGap * 0.4);
    const fwdSec = Math.min(windowSec, nextGap * 0.6);
    const from = Math.max(0, centerBuf - Math.round(backSec * sampleRate));
    const to = Math.min(
      signal.length - envStep,
      centerBuf + Math.round(fwdSec * sampleRate),
    );
    if (to <= from) {
      return { markerSec, playerSec: null, errorSec: null, strength: 0 };
    }

    // Build the local energy envelope and its PEAK. The attack is the FIRST place energy
    // crosses a low fraction of the window peak — the foot of the rise where the note
    // leaves the floor — NOT the steepest rise (a bass body often SWELLS louder than the
    // pluck, so "steepest rise" lands in the body, putting the marker mid-note. This was
    // the visible "blue marker is way in the waveform, not on the transient" bug).
    const idxs: number[] = [];
    const envs: number[] = [];
    let envPeak = 0;
    for (let i = from; i <= to; i += envStep) {
      const e = energyAt(i);
      idxs.push(i);
      envs.push(e);
      if (e > envPeak) envPeak = e;
    }
    if (envPeak <= 1e-6) {
      return { markerSec, playerSec: null, errorSec: null, strength: 0 };
    }

    // FIRST crossing of 15% of the window peak = the attack edge. Scanning for the FIRST
    // crossing (not the loudest/steepest) keeps the marker on the pluck and OFF the body.
    const crossThr = envPeak * 0.15;
    let attackIdx = -1;
    for (let n = 0; n < envs.length; n++) {
      if (envs[n]! >= crossThr) {
        attackIdx = n > 0 ? idxs[n - 1]! : idxs[n]!; // step back to the foot of the rise
        break;
      }
    }

    // Strength = window peak relative to the TAKE peak (a real note's window is loud; a
    // decayed-tail window is quiet → low strength → missed).
    const strength = Math.min(1, envPeak / (takePeak || 1));
    // ABSOLUTE-LEVEL gate: the window's peak energy must clear the take-relative floor.
    // Rejects a marker placed over a previous note's decaying ripple (loud-relative,
    // quiet-absolute) → no phantom.
    if (attackIdx < 0 || envPeak < absFloor) {
      return { markerSec, playerSec: null, errorSec: null, strength };
    }

    const playerSec = startedAtSec + attackIdx / sampleRate;
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
