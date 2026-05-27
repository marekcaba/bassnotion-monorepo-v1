/**
 * pickKeySet — LAUNCH-02.5c unit tests.
 *
 * Covers the spec table from the story exhaustively (both sides of zero),
 * the ±12 clamp, the tie-break rule, and the isExtreme flag.
 */

import { describe, it, expect } from 'vitest';
import { pickKeySet, KEY_SET_OFFSETS } from '../pickKeySet.js';

describe('pickKeySet — LAUNCH-02.5c', () => {
  describe('canonical 5 offsets', () => {
    it('maps each delivered offset to its own key set with 0 residual', () => {
      const cases: Array<[number, number]> = [
        [-8, 0],
        [-4, 1],
        [0, 2],
        [4, 3],
        [8, 4],
      ];
      for (const [offset, expectedIndex] of cases) {
        const result = pickKeySet(offset);
        expect(result.keySetIndex).toBe(expectedIndex);
        expect(result.residualShift).toBe(0);
        expect(result.isExtreme).toBe(false);
      }
    });
  });

  // Positive side — direct mirror of the story table.
  describe('positive direction (story table)', () => {
    const positives: Array<{
      userOffset: number;
      keySetIndex: number;
      residual: number;
      isExtreme: boolean;
    }> = [
      // 0..+2 → default (0)
      { userOffset: 1, keySetIndex: 2, residual: 1, isExtreme: false },
      { userOffset: 2, keySetIndex: 2, residual: 2, isExtreme: false },
      // +3..+6 → first-up (+4)
      { userOffset: 3, keySetIndex: 3, residual: -1, isExtreme: false },
      { userOffset: 4, keySetIndex: 3, residual: 0, isExtreme: false },
      { userOffset: 5, keySetIndex: 3, residual: 1, isExtreme: false },
      { userOffset: 6, keySetIndex: 3, residual: 2, isExtreme: false },
      // +7..+10 → second-up (+8)
      { userOffset: 7, keySetIndex: 4, residual: -1, isExtreme: false },
      { userOffset: 8, keySetIndex: 4, residual: 0, isExtreme: false },
      { userOffset: 9, keySetIndex: 4, residual: 1, isExtreme: false },
      { userOffset: 10, keySetIndex: 4, residual: 2, isExtreme: false },
      // +11..+12 → second-up (+8); residual is extreme (3..4)
      { userOffset: 11, keySetIndex: 4, residual: 3, isExtreme: true },
      { userOffset: 12, keySetIndex: 4, residual: 4, isExtreme: true },
    ];

    it.each(positives)(
      'userOffset $userOffset → keySetIndex $keySetIndex, residual $residual, extreme=$isExtreme',
      ({ userOffset, keySetIndex, residual, isExtreme }) => {
        const result = pickKeySet(userOffset);
        expect(result.keySetIndex).toBe(keySetIndex);
        expect(result.residualShift).toBe(residual);
        expect(result.isExtreme).toBe(isExtreme);
      },
    );
  });

  // Negative side — symmetrical mirror.
  describe('negative direction (symmetrical mirror)', () => {
    const negatives: Array<{
      userOffset: number;
      keySetIndex: number;
      residual: number;
      isExtreme: boolean;
    }> = [
      // -1..-2 → default (0)
      { userOffset: -1, keySetIndex: 2, residual: -1, isExtreme: false },
      { userOffset: -2, keySetIndex: 2, residual: -2, isExtreme: false },
      // -3..-6 → first-down (-4)
      { userOffset: -3, keySetIndex: 1, residual: 1, isExtreme: false },
      { userOffset: -5, keySetIndex: 1, residual: -1, isExtreme: false },
      { userOffset: -6, keySetIndex: 1, residual: -2, isExtreme: false },
      // -7..-10 → second-down (-8)
      { userOffset: -7, keySetIndex: 0, residual: 1, isExtreme: false },
      { userOffset: -10, keySetIndex: 0, residual: -2, isExtreme: false },
      // -11..-12 → second-down (-8); residual is extreme
      { userOffset: -11, keySetIndex: 0, residual: -3, isExtreme: true },
      { userOffset: -12, keySetIndex: 0, residual: -4, isExtreme: true },
    ];

    it.each(negatives)(
      'userOffset $userOffset → keySetIndex $keySetIndex, residual $residual, extreme=$isExtreme',
      ({ userOffset, keySetIndex, residual, isExtreme }) => {
        const result = pickKeySet(userOffset);
        expect(result.keySetIndex).toBe(keySetIndex);
        expect(result.residualShift).toBe(residual);
        expect(result.isExtreme).toBe(isExtreme);
      },
    );
  });

  describe('clamp to ±12', () => {
    it('clamps offsets above +12 to +12', () => {
      const result = pickKeySet(20);
      expect(result.keySetIndex).toBe(4);
      expect(result.residualShift).toBe(4);
      expect(result.isExtreme).toBe(true);
    });

    it('clamps offsets below -12 to -12', () => {
      const result = pickKeySet(-50);
      expect(result.keySetIndex).toBe(0);
      expect(result.residualShift).toBe(-4);
      expect(result.isExtreme).toBe(true);
    });
  });

  describe('isExtreme flag', () => {
    it('is true when |residual| > 2, false otherwise', () => {
      // Within budget.
      expect(pickKeySet(0).isExtreme).toBe(false);
      expect(pickKeySet(2).isExtreme).toBe(false);
      expect(pickKeySet(-2).isExtreme).toBe(false);
      expect(pickKeySet(6).isExtreme).toBe(false); // |2|
      // Beyond budget.
      expect(pickKeySet(11).isExtreme).toBe(true); // |3|
      expect(pickKeySet(12).isExtreme).toBe(true); // |4|
    });
  });

  describe('drums + click invariant (residual applies ONLY to bass + harmony)', () => {
    it('the residualShift returned is whatever the bass+harmony PitchShift node will receive', () => {
      // This test is a contract reminder: the function returns a residual
      // and the caller is responsible for applying it ONLY to bass and
      // harmony stems. Drums and click are stem-swapped with the key
      // set and never pitch-shifted. The function itself is unaware of
      // that policy — it's a pure mapper.
      const result = pickKeySet(5);
      expect(result.residualShift).toBe(1);
    });
  });

  describe('KEY_SET_OFFSETS contract pin', () => {
    it('exports the five delivered offsets in ascending order', () => {
      expect(KEY_SET_OFFSETS).toEqual([-8, -4, 0, 4, 8]);
      expect(KEY_SET_OFFSETS).toHaveLength(5);
    });
  });
});
