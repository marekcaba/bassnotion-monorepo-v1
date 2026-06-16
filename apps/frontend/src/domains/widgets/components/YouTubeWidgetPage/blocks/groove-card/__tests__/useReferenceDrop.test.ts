import { describe, it, expect } from 'vitest';
import type { ReferenceDropConfig } from '@bassnotion/contracts';
import { isDroppedForLoop } from '../useReferenceDrop';

/** The cadence logic is the heart of the drill — pure + worth proving in
 *  isolation (the gain scheduling rides the already-tested seam clock). */
function cfg(overrides: Partial<ReferenceDropConfig> = {}): ReferenceDropConfig {
  return {
    enabled: true,
    everyBars: 4,
    dropForBars: 2,
    dropTargets: ['drums'],
    ...overrides,
  };
}

describe('isDroppedForLoop — drop cadence', () => {
  it('drops the first dropForBars of every everyBars cycle', () => {
    const c = cfg({ everyBars: 4, dropForBars: 2 });
    // cycle: loops 0,1 dropped | 2,3 present | 4,5 dropped | 6,7 present
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => isDroppedForLoop(i, c))).toEqual([
      true, true, false, false, true, true, false, false,
    ]);
  });

  it('supports a different cadence (drop 1 every 3)', () => {
    const c = cfg({ everyBars: 3, dropForBars: 1 });
    expect([0, 1, 2, 3, 4, 5].map((i) => isDroppedForLoop(i, c))).toEqual([
      true, false, false, true, false, false,
    ]);
  });

  it('clamps dropForBars to at most everyBars (never drops the whole cycle past it)', () => {
    const c = cfg({ everyBars: 2, dropForBars: 9 });
    // dropFor clamps to 2 → every loop dropped (a continuous-drop drill)
    expect([0, 1, 2, 3].map((i) => isDroppedForLoop(i, c))).toEqual([
      true, true, true, true,
    ]);
  });

  it('handles negative loop indices safely (wraps)', () => {
    const c = cfg({ everyBars: 4, dropForBars: 2 });
    expect(isDroppedForLoop(-1, c)).toBe(false); // -1 → position 3 → present
    expect(isDroppedForLoop(-4, c)).toBe(true); // -4 → position 0 → dropped
  });
});
