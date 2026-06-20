/**
 * alignToReference — match a player's note onsets to a REFERENCE performance's
 * onsets (the bass coach). The genuinely net-new core: two REAL note sequences,
 * and the player may SKIP a note, ADD a note, or play a different count — so they
 * can't be paired by index.
 *
 * The tractability trick (from docs/BASS_COACH_BUILD_PLAN.md): the reference is
 * LOOPED on a known bar grid, so we bucket BOTH sequences into bar+subdivision
 * SLOTS via the same snapOnsetToGrid the grid scorer uses. Two onsets in the same
 * slot are the same musical event → that's the match. A reference onset whose slot
 * has no player onset = a MISS; a player onset whose slot has no reference onset =
 * an EXTRA. This is the grid-as-alignment-key approach, NOT full free-sequence DTW
 * (which we'd only need for un-gridded material).
 *
 * Pure: onset lists in, matched pairs out. Unit-tested offline.
 */

import type { GridParams } from './scoreAgainstGrid';

export interface AlignedPair {
  /** Absolute subdivision index both onsets snapped to. */
  subIndex: number;
  /** Reference onset time (audio-ctx seconds). */
  referenceSec: number;
  /** Player onset time (audio-ctx seconds). */
  playerSec: number;
  /** Player − reference, seconds (the per-note timing error vs the recording). */
  errorSec: number;
}

export interface AlignmentResult {
  /** Notes the player hit that the reference also has (graded for timing/etc). */
  matched: AlignedPair[];
  /** Reference notes with no player note in their slot — MISSED. (ref times, sec) */
  missed: number[];
  /** Player onsets that matched no reference note. The player is playing a KNOWN
   *  part, so an onset where the reference has no note is almost always NOISE
   *  (string buzz, sustain re-trigger) — NOT a real extra note. We REJECT these as
   *  noise rather than penalise them, and they cannot steal a real note's slot.
   *  (player times, sec) */
  noise: number[];
  /** matched / (matched + missed) — how much of the part the player actually hit. */
  coverage: number;
}


/**
 * Align player onsets to reference onsets via the shared grid.
 *
 * @param playerOnsetsSec    detected player onsets, audio-ctx seconds
 * @param referenceOnsetsSec detected reference-stem onsets, audio-ctx seconds
 *                           (mapped to ctx time by the caller: loopStart + onset/R)
 * @param _grid              kept for API stability; the coach-anchored matcher works
 *                           purely in time and no longer needs the grid.
 */
export function alignToReference(
  playerOnsetsSec: number[],
  referenceOnsetsSec: number[],
  _grid: GridParams,
): AlignmentResult {
  // COACH-ANCHORED matching, purely in TIME (no grid-slot bucketing). The reference
  // markers are the SOURCE OF TRUTH: for each one, find the player's nearest unclaimed
  // attack and measure the distance. A player onset not near ANY reference marker is
  // NOISE (sustain wobble / a stray) — ignored, never penalised. This is robust to
  // the player playing a sparser/denser take and to over-detection (the # of player
  // onsets doesn't have to match the reference).
  const refs = [...referenceOnsetsSec].sort((a, b) => a - b);
  const players = playerOnsetsSec
    .map((sec) => ({ sec, claimed: false }))
    .sort((a, b) => a.sec - b.sec);

  // Per-reference tolerance: half the distance to the nearest neighbouring reference
  // marker (so two close reference notes can't both claim the same player onset),
  // capped at ~120ms (a note >120ms off its target is genuinely a miss, not a match).
  const MAX_TOL = 0.12;
  const tolFor = (i: number): number => {
    const prevGap = i > 0 ? refs[i]! - refs[i - 1]! : Infinity;
    const nextGap = i < refs.length - 1 ? refs[i + 1]! - refs[i]! : Infinity;
    const halfNearest = Math.min(prevGap, nextGap) / 2;
    return Math.min(MAX_TOL, Math.max(0.03, halfNearest));
  };

  const matched: AlignedPair[] = [];
  const missed: number[] = [];

  refs.forEach((referenceSec, i) => {
    const tol = tolFor(i);
    let best: (typeof players)[number] | null = null;
    let bestDist = tol;
    for (const p of players) {
      if (p.claimed) continue;
      const d = Math.abs(p.sec - referenceSec);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) {
      best.claimed = true;
      matched.push({
        subIndex: i, // index into the reference markers (kept for the viz)
        referenceSec,
        playerSec: best.sec,
        errorSec: best.sec - referenceSec,
      });
    } else {
      missed.push(referenceSec);
    }
  });

  // Player onsets that matched no reference marker = NOISE (sustain wobble, strays).
  const noise = players.filter((p) => !p.claimed).map((p) => p.sec);

  missed.sort((a, b) => a - b);
  noise.sort((a, b) => a - b);

  const coverage = refs.length > 0 ? matched.length / refs.length : 0;

  return { matched, missed, noise, coverage };
}
