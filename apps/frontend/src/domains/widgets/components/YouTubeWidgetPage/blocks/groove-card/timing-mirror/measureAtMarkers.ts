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
 * The transient locator inside a window: the COMPLEX-DOMAIN detection function (phase-
 * aware, Bello/Duxbury — the Ableton lineage), computed once over the take. We take the
 * strongest detection peak in each marker's window. Phase is what lets it find a new
 * pluck even when it lands ON a previous note's sustain (where an energy envelope can't —
 * there's no low→high rise). This fixed the "-45ms snap off the transient" on notes in
 * succession that the energy-envelope search produced.
 *
 * Pure + offline: signal + marker times in, per-marker measurements out. Unit-tested.
 */

import { complexDomainDetectionFunction } from './complexDomainOnsets';

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

  // THE DETECTION FUNCTION: complex-domain (phase-aware), computed ONCE over the take.
  // Why not an energy envelope: a new note played ON TOP of a previous note's sustain
  // (notes in succession) is NOT a low→high energy rise — the energy just climbs from
  // loud to louder, so an envelope-crossing search snaps to the window edge (the pinned
  // ~-45ms bug). The complex-domain function spikes on the PHASE DISCONTINUITY of the new
  // pluck even over a sustain, and stays low in the body/ripple — exactly what we need to
  // locate the attack inside a marker window regardless of what came before.
  const { df, hopSec } = complexDomainDetectionFunction(signal, sampleRate);
  const frameToSec = (f: number) => f * hopSec + hopSec / 2;
  let dfPeak = 0;
  for (let f = 0; f < df.length; f++) if (df[f]! > dfPeak) dfPeak = df[f]!;
  const dfFloor = dfPeak * minAbsLevel;

  // The TAKE's peak raw amplitude — for an ABSOLUTE silence check per window. The df is
  // normalized, so on a fully silent take its "peak" is just numerical noise and the
  // relative dfFloor can't tell silence from a note. A raw-amplitude floor can: a window
  // whose audio never reaches a fraction of the take's loudest sample has no real note.
  let takeAmp = 0;
  for (let k = 0; k < signal.length; k++) {
    const a = Math.abs(signal[k] ?? 0);
    if (a > takeAmp) takeAmp = a;
  }
  // Floor relative to the take's loudest sample, but never below a tiny absolute epsilon
  // so a fully-silent take (takeAmp≈0) still reports every marker as MISSED.
  const ampFloor = Math.max(1e-4, takeAmp * minAbsLevel);

  // Sort markers so we can bound each window by its neighbours (a marker must only search
  // its OWN note's territory — never reach into an adjacent note and grab THAT attack).
  const sorted = [...markersSec].sort((a, b) => a - b);
  const indexOf = new Map(sorted.map((t, i) => [t, i]));

  return markersSec.map((markerSec) => {
    const markerBufSec = markerSec - startedAtSec; // marker in the take's own timeline
    // NEIGHBOUR-BOUNDED, ASYMMETRIC window: a player's attack lands at/near its marker.
    // Back-reach stays SMALL (so it can't catch the previous note) and forward-reach is
    // larger (a dragged note is late). Both clamped to the neighbour midpoint so we never
    // cross into the adjacent note. Expressed in the take's buffer-seconds.
    const i = indexOf.get(markerSec) ?? 0;
    const prevGap = i > 0 ? markerSec - sorted[i - 1]! : Infinity;
    const nextGap = i < sorted.length - 1 ? sorted[i + 1]! - markerSec : Infinity;
    const backSec = Math.min(BACK_REACH_SEC, prevGap * 0.4);
    const fwdSec = Math.min(windowSec, nextGap * 0.6);
    const fromFrame = Math.max(0, Math.floor((markerBufSec - backSec) / hopSec));
    const toFrame = Math.min(df.length - 1, Math.ceil((markerBufSec + fwdSec) / hopSec));
    if (toFrame <= fromFrame) {
      return { markerSec, playerSec: null, errorSec: null, strength: 0 };
    }

    // ABSOLUTE silence check: if the window's audio never reaches the take-relative
    // amplitude floor, there's no note here → MISSED (robust even on a near-silent take
    // where the normalized df floor is meaningless).
    let winAmp = 0;
    const ampFrom = Math.max(0, Math.round((markerBufSec - backSec) * sampleRate));
    const ampTo = Math.min(signal.length, Math.round((markerBufSec + fwdSec) * sampleRate));
    for (let k = ampFrom; k < ampTo; k++) {
      const a = Math.abs(signal[k] ?? 0);
      if (a > winAmp) winAmp = a;
    }
    if (winAmp < ampFloor) {
      return { markerSec, playerSec: null, errorSec: null, strength: 0 };
    }

    // The attack = the FIRST strong detection-function peak in the window — NOT the
    // single strongest. THE FIX for "the blue marker is already IN the note": a later
    // mid-note phase event (vibrato, a finger transition, the body's evolution) can spike
    // the df HIGHER than the initial pluck, so "strongest" lands deep in the note (the
    // +109ms / +66ms outliers). The attack is the FIRST event that clears a fraction of
    // the window's max — the onset, even when a later event is bigger.
    let windowMax = 0;
    for (let f = fromFrame; f <= toFrame; f++) if (df[f]! > windowMax) windowMax = df[f]!;
    // The whole window must contain a real attack at all (take-relative floor). If even
    // its strongest df is weak → silence / faded tail → MISSED.
    if (windowMax < dfFloor) {
      return {
        markerSec,
        playerSec: null,
        errorSec: null,
        strength: dfPeak > 0 ? Math.min(1, windowMax / dfPeak) : 0,
      };
    }
    // Accept the FIRST local df peak that clears 30% of the window max — the attack is the
    // first real phase event, even when a LATER mid-note event (a pitch transition spikes
    // df ~3× the pluck) is bigger. 30% admits a moderate pluck while still ignoring tiny
    // ripple wobbles. (Taking the strongest gave the "+109ms, marker IN the note" bug.)
    const acceptThr = Math.max(dfFloor, windowMax * 0.3);
    let bestFrame = -1;
    let bestVal = 0;
    for (let f = fromFrame; f <= toFrame; f++) {
      const isPeak = df[f]! >= (df[f - 1] ?? 0) && df[f]! >= (df[f + 1] ?? 0);
      if (isPeak && df[f]! >= acceptThr) {
        bestFrame = f;
        bestVal = df[f]!;
        break;
      }
    }
    const strength = dfPeak > 0 ? Math.min(1, bestVal / dfPeak) : 0;
    if (bestFrame < 0) {
      return { markerSec, playerSec: null, errorSec: null, strength };
    }

    const playerSec = startedAtSec + frameToSec(bestFrame);
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
