/**
 * pickKeySet — LAUNCH-02.5c.
 *
 * Pure function that maps a user-requested semitone offset to the closest
 * delivered key set, plus the residual pitch-shift that the bass+harmony
 * PitchShift nodes need to apply to land on the requested pitch.
 *
 * Five key sets per groove at fixed offsets [-8, -4, 0, +4, +8]. The
 * picker prefers a residual within ±2 semitones (the "comfortable
 * range"); beyond that it accepts up to ±4 as documented "extremes".
 *
 * Mirrored table from the story (positive side; negative is symmetrical):
 *
 *   user offset | loaded key set | pitch-shift applied
 *   0..+2       | default (0)    | 0..+2
 *   +3..+6      | first-up (+4)  | -1..+2
 *   +7..+10     | second-up (+8) | -1..+2
 *   +11..+12    | second-up (+8) | +3..+4 (accepted extreme)
 *
 * The function is pure (no IO, no globals). Use it from
 * useGrooveCardPlayback when the user moves the Key stepper. Unit-tested
 * in isolation in pickKeySet.test.ts.
 */

/** Five fixed offsets a Groove Card delivers, in display order. */
export const KEY_SET_OFFSETS = [-8, -4, 0, 4, 8] as const;

/** Index into the 5-tuple stored on the block config. 0 == −8, 4 == +8. */
export type KeySetIndex = 0 | 1 | 2 | 3 | 4;

export interface PickKeySetResult {
  /** Index into the key-set tuple to load + play. */
  keySetIndex: KeySetIndex;
  /** Pitch-shift in semitones the bass+harmony nodes must apply to reach
   * the requested user offset. Drums and click always stay at 0. */
  residualShift: number;
  /** True when |residualShift| > 2 (documented "extreme" zone). UIs may
   * surface a subtle warning. */
  isExtreme: boolean;
}

/**
 * Map a user-requested semitone offset to the closest delivered key set
 * and the residual pitch-shift.
 *
 * Algorithm:
 *  1. Clamp the offset to ±12 (the Groove Card's hard range).
 *  2. Pick the delivered offset that minimises |residual|. On ties (the
 *     midpoints ±2, ±6, ±10), prefer the LOWER-magnitude key set so the
 *     residual goes UP — keeps residual sign consistent with the user's
 *     intent of pushing the pitch in that direction.
 *  3. residualShift = userOffset − chosenKeySetOffset.
 */
export function pickKeySet(userOffsetSemitones: number): PickKeySetResult {
  const clamped = Math.max(-12, Math.min(12, userOffsetSemitones));

  let bestIndex: KeySetIndex = 2; // default (offset 0)
  let bestResidualMagnitude = Infinity;
  let bestResidual = clamped;

  for (let i = 0; i < KEY_SET_OFFSETS.length; i++) {
    const keySetOffset = KEY_SET_OFFSETS[i]!;
    const residual = clamped - keySetOffset;
    const magnitude = Math.abs(residual);

    if (magnitude < bestResidualMagnitude) {
      bestResidualMagnitude = magnitude;
      bestIndex = i as KeySetIndex;
      bestResidual = residual;
      continue;
    }

    // Tie: prefer the lower-magnitude key set (closer to default).
    // Equivalent to "the residual keeps the user's pushing direction."
    if (magnitude === bestResidualMagnitude) {
      const currentBestOffset = KEY_SET_OFFSETS[bestIndex]!;
      if (Math.abs(keySetOffset) < Math.abs(currentBestOffset)) {
        bestIndex = i as KeySetIndex;
        bestResidual = residual;
      }
    }
  }

  return {
    keySetIndex: bestIndex,
    residualShift: bestResidual,
    isExtreme: Math.abs(bestResidual) > 2,
  };
}
