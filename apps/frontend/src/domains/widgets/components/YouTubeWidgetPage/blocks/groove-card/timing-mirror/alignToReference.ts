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
  const refSlots = bucketBySlot(referenceOnsetsSec, grid);
  // Player onsets kept in TIME space (not slot-bucketed) — bucketing collapses
  // adjacent onsets and drives the slot-stealing cascade. We match in time with a
  // tolerance, so a phantom near a reference note can't bump the REAL player note.
  const players = playerOnsetsSec
    .map((sec) => ({ sec, slot: snapOnsetToGrid(sec, grid) }))
    .filter((p) => !p.slot.beforeGrid)
    .map((p, i) => ({ sec: p.sec, subIndex: p.slot.subIndex, idx: i, claimed: false }));

  // Match tolerance: ±1.5 sixteenths in TIME. A note played up to ~1.5 subs off
  // still matches (as a late/early note carrying its error); anything further is
  // unmatched (a miss for the reference / noise for the player).
  const barSeconds = grid.loopDurationSeconds / grid.lengthBars;
  const subSeconds = barSeconds / ((grid.beatsPerBar ?? 4) * (grid.subdivisionsPerBeat ?? 4));
  const tolSec = subSeconds * 1.5;

  const matched: AlignedPair[] = [];
  const missed: number[] = [];

  // For each reference note (in time order), claim the NEAREST unclaimed player
  // onset within tolerance. Nearest-in-time means a phantom slightly off can't
  // out-compete the real note that's closer.
  const refEntries = [...refSlots.entries()].sort((a, b) => a[1] - b[1]);
  for (const [subIndex, referenceSec] of refEntries) {
    let best: (typeof players)[number] | null = null;
    let bestDist = tolSec;
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
        subIndex,
        referenceSec,
        playerSec: best.sec,
        errorSec: best.sec - referenceSec,
      });
    } else {
      missed.push(referenceSec);
    }
  }

  // Unclaimed player onsets = NOISE (the player is playing a known part, so an
  // onset matching no reference note is almost always a phantom). Rejected, NOT
  // penalised, and — because we matched in time — they never stole a real slot.
  const noise = players.filter((p) => !p.claimed).map((p) => p.sec);

  matched.sort((a, b) => a.subIndex - b.subIndex);
  missed.sort((a, b) => a - b);
  noise.sort((a, b) => a - b);

  const refCount = refSlots.size;
  const coverage = refCount > 0 ? matched.length / refCount : 0;

  return { matched, missed, noise, coverage };
}
