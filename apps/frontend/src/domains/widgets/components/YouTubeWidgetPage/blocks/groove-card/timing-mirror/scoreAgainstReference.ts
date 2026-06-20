/**
 * scoreAgainstReference — the bass coach's headline (Step 4): grade a player's take
 * against the REFERENCE performance (how close to how it was really played), not the
 * ideal grid. Pure: onset lists in, a graded outcome out. Unit-tested offline.
 *
 * Pipeline: align player↔reference onsets (alignToReference, the grid-anchored
 * regional aligner) → matched-pair timing errors → split constant OFFSET (latency,
 * calibratable) from JITTER (feel) → gradeTiming (human scale). Coverage (how much
 * of the part was hit) and extras (ghosts) report alongside.
 *
 * Trust guard: a reference's onsets are themselves DETECTED (from the stem), so they
 * can be wrong (a quiet stem mis-detects — see Step 0). If the reference detection
 * looks untrustworthy, REFUSE to grade rather than grade against a bad target.
 */

import { alignToReference, type AlignmentResult } from './alignToReference';
import type { GridParams } from './scoreAgainstGrid';
import { gradeTiming, type TimingGrade } from './timingGrade';

export interface ReferenceScore {
  /** Human-scaled grade of the player's timing vs the reference. */
  grade: TimingGrade;
  /** Mean player−reference error (ms) = the constant offset (latency/anticipation,
   *  calibratable — NOT feel). */
  offsetMs: number;
  /** Stddev of the de-meaned error (ms) = the feel metric. */
  jitterMs: number;
  /** matched / reference-notes — how much of the part the player actually hit. */
  coverage: number;
  matchedCount: number;
  missedCount: number;
  extraCount: number;
  /** The raw alignment, for the visualizer / detail. */
  alignment: AlignmentResult;
  /** True when the reference target is untrustworthy → no grade shown. */
  untrustworthy: boolean;
  /** Why it's untrustworthy (for the panel message). null when trusted. */
  untrustworthyReason: string | null;
}

export interface ReferenceScoreOptions {
  /** Expected reference note count (authored ATTACK count — notes minus legato).
   *  If the detected reference onsets diverge from this beyond tolerance, the
   *  reference detection is mis-tuned → refuse. null skips this check. */
  expectedReferenceCount?: number | null;
  /** Allowed |detected − expected| before refusing. */
  referenceCountTolerance?: number;
  /** Minimum coverage to produce a grade — below this the player played too little
   *  of the part for a meaningful timing read (it's a "play more of it" state, not
   *  a bad grade). */
  minCoverage?: number;
}

const DEFAULTS = {
  referenceCountTolerance: 3,
  minCoverage: 0.5,
};

export function scoreAgainstReference(
  playerOnsetsSec: number[],
  referenceOnsetsSec: number[],
  grid: GridParams,
  opts: ReferenceScoreOptions = {},
): ReferenceScore {
  const referenceCountTolerance =
    opts.referenceCountTolerance ?? DEFAULTS.referenceCountTolerance;
  const minCoverage = opts.minCoverage ?? DEFAULTS.minCoverage;

  const alignment = alignToReference(playerOnsetsSec, referenceOnsetsSec, grid);
  const matched = alignment.matched;

  const base = {
    offsetMs: 0,
    jitterMs: 0,
    coverage: alignment.coverage,
    matchedCount: matched.length,
    missedCount: alignment.missed.length,
    extraCount: alignment.extra.length,
    alignment,
  };

  // ── Trust guard 1: is the reference detection itself sane? ──
  // Count distinct reference slots actually used (matched + missed = ref notes seen).
  const referenceNotesSeen = matched.length + alignment.missed.length;
  if (opts.expectedReferenceCount != null) {
    const diff = Math.abs(referenceNotesSeen - opts.expectedReferenceCount);
    if (diff > referenceCountTolerance) {
      return {
        ...base,
        grade: gradeTiming(0, 0),
        untrustworthy: true,
        untrustworthyReason: `Reference stem detected ${referenceNotesSeen} notes but the exercise has ~${opts.expectedReferenceCount}. The reference onset preset is mis-tuned (tune it in the admin form). Not grading against a wrong target.`,
      };
    }
  }

  // ── Trust guard 2: did the player play enough of the part to grade? ──
  if (matched.length === 0 || alignment.coverage < minCoverage) {
    return {
      ...base,
      grade: gradeTiming(0, 0),
      untrustworthy: true,
      untrustworthyReason: `Only ${Math.round(alignment.coverage * 100)}% of the part was played — play more of it before scoring the timing.`,
    };
  }

  // ── Score: offset/jitter split over matched-pair errors ──
  const errsMs = matched.map((p) => p.errorSec * 1000);
  const offsetMs = errsMs.reduce((a, b) => a + b, 0) / errsMs.length;
  const variance =
    errsMs.reduce((a, b) => a + (b - offsetMs) ** 2, 0) / errsMs.length;
  const jitterMs = Math.sqrt(variance);

  return {
    ...base,
    offsetMs,
    jitterMs,
    grade: gradeTiming(jitterMs, offsetMs),
    untrustworthy: false,
    untrustworthyReason: null,
  };
}
