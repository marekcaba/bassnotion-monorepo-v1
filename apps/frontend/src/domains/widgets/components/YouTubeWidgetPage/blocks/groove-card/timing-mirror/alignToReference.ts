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

import { snapOnsetToGrid, type GridParams } from './scoreAgainstGrid';

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
  /** Player notes with no reference note in their slot — EXTRA. (player times, sec) */
  extra: number[];
  /** matched / (matched + missed) — how much of the part the player actually hit. */
  coverage: number;
}

/**
 * Bucket onsets (audio-ctx seconds) into a map of subIndex → onset times, dropping
 * count-in onsets. When two onsets land in one slot, keep the FIRST (a second is a
 * spurious double-trigger at this resolution).
 */
function bucketBySlot(onsetsSec: number[], grid: GridParams): Map<number, number> {
  const slots = new Map<number, number>();
  for (const onsetSec of onsetsSec) {
    const slot = snapOnsetToGrid(onsetSec, grid);
    if (slot.beforeGrid) continue;
    if (!slots.has(slot.subIndex)) slots.set(slot.subIndex, onsetSec);
  }
  return slots;
}

/**
 * Align player onsets to reference onsets via the shared grid.
 *
 * @param playerOnsetsSec    detected player onsets, audio-ctx seconds
 * @param referenceOnsetsSec detected reference-stem onsets, audio-ctx seconds
 *                           (mapped to ctx time by the caller: loopStart + onset/R)
 * @param grid               the SAME GridParams used for grid-mode scoring
 */
export function alignToReference(
  playerOnsetsSec: number[],
  referenceOnsetsSec: number[],
  grid: GridParams,
): AlignmentResult {
  const playerSlots = bucketBySlot(playerOnsetsSec, grid);
  const refSlots = bucketBySlot(referenceOnsetsSec, grid);

  const matched: AlignedPair[] = [];
  const missed: number[] = [];
  const claimedPlayerSlots = new Set<number>();

  // For each reference note, find the player note in its slot — OR, if none, an
  // unclaimed player note in an ADJACENT slot (±1 sixteenth). The adjacent reach
  // is essential: a note played more than half a sixteenth off snaps to the
  // neighbor slot, and a feel-grading coach must score that as a LATE/EARLY note
  // (a real match with a large error), not as miss+extra. Reference slots are
  // processed in order so an earlier note claims its closest player onset first.
  for (const subIndex of [...refSlots.keys()].sort((a, b) => a - b)) {
    const referenceSec = refSlots.get(subIndex)!;
    // candidate slots: exact first, then ±1 (closest grid distance wins on a tie)
    const candidates = [subIndex, subIndex - 1, subIndex + 1].filter(
      (s) => playerSlots.has(s) && !claimedPlayerSlots.has(s),
    );
    if (candidates.length === 0) {
      missed.push(referenceSec);
      continue;
    }
    // pick the player onset closest in TIME to the reference
    let best = candidates[0]!;
    let bestDist = Math.abs(playerSlots.get(best)! - referenceSec);
    for (const c of candidates.slice(1)) {
      const d = Math.abs(playerSlots.get(c)! - referenceSec);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    const playerSec = playerSlots.get(best)!;
    claimedPlayerSlots.add(best);
    matched.push({
      subIndex,
      referenceSec,
      playerSec,
      errorSec: playerSec - referenceSec,
    });
  }

  // Player onsets not claimed by any reference note = extras.
  const extra: number[] = [];
  for (const [subIndex, playerSec] of playerSlots) {
    if (!claimedPlayerSlots.has(subIndex)) extra.push(playerSec);
  }

  matched.sort((a, b) => a.subIndex - b.subIndex);
  missed.sort((a, b) => a - b);
  extra.sort((a, b) => a - b);

  const refCount = refSlots.size;
  const coverage = refCount > 0 ? matched.length / refCount : 0;

  return { matched, missed, extra, coverage };
}
