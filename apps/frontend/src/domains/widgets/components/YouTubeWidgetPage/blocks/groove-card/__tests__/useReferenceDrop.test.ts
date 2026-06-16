import { describe, it, expect } from 'vitest';
import type { ReferenceDropConfig } from '@bassnotion/contracts';
import { isDroppedForBar } from '../useReferenceDrop';

/** The drop pattern is a per-loop MASK (dropBars, 1-based bar numbers). It's
 *  bound to the loop, so it repeats identically every loop and can't desync.
 *  isDroppedForBar takes a 0-based bar POSITION within the loop. */
function cfg(dropBars: number[]): ReferenceDropConfig {
  return { enabled: true, dropBars, dropTargets: ['drums'] };
}

describe('isDroppedForBar — per-loop drop mask', () => {
  it('drops exactly the masked bars of an 8-bar loop (1,2,5,6)', () => {
    const c = cfg([1, 2, 5, 6]);
    // positions 0..7 ↔ bars 1..8
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((p) => isDroppedForBar(p, c))).toEqual([
      true, true, false, false, true, true, false, false,
    ]);
  });

  it('supports an arbitrary combination (just bar 4)', () => {
    const c = cfg([4]);
    expect([0, 1, 2, 3, 4, 5].map((p) => isDroppedForBar(p, c))).toEqual([
      false, false, false, true, false, false,
    ]);
  });

  it('drops nothing when the mask is empty', () => {
    const c = cfg([]);
    expect([0, 1, 2, 3].map((p) => isDroppedForBar(p, c))).toEqual([
      false, false, false, false,
    ]);
  });

  it('is bound to loop position — same pattern repeats every loop (no desync)', () => {
    // The hook keys isDroppedForBar on bar-WITHIN-loop, so bar 1 of loop 2 is
    // position 0 again → same decision. This is what fixes the loop-2 bug.
    const c = cfg([1, 2]);
    expect(isDroppedForBar(0, c)).toBe(true); // bar 1 (any loop)
    expect(isDroppedForBar(1, c)).toBe(true); // bar 2
    expect(isDroppedForBar(2, c)).toBe(false); // bar 3
  });
});
