import { describe, it, expect } from 'vitest';
import { barBeatToFraction, resolveFillRegionFractions } from './fillRegion';

describe('barBeatToFraction', () => {
  it('bar 1 beat 1 is the loop start (0)', () => {
    expect(barBeatToFraction(1, 1)).toBe(0);
  });
  it('whole bars map to integer fractions', () => {
    expect(barBeatToFraction(7, 1)).toBe(6);
    expect(barBeatToFraction(8, 1)).toBe(7);
  });
  it('beats add quarter-bar steps', () => {
    expect(barBeatToFraction(7, 3)).toBe(6.5); // 6 + 2/4
    expect(barBeatToFraction(8, 4)).toBe(7.75); // 7 + 3/4
  });
});

describe('resolveFillRegionFractions', () => {
  it('returns null when there is no region', () => {
    expect(resolveFillRegionFractions(undefined, 8)).toBeNull();
    expect(resolveFillRegionFractions(null, 8)).toBeNull();
  });

  it('maps a bars 7→8 region to its fractional span (end is inclusive)', () => {
    // endBar 8 beat 1 → through the end of beat 1 = 7 + 1/4 = 7.25.
    const r = resolveFillRegionFractions(
      { startBar: 7, startBeat: 1, endBar: 8, endBeat: 1 },
      8,
    );
    expect(r).toEqual({ startFrac: 6, endFrac: 7.25 });
  });

  it('respects sub-bar beats with an inclusive end', () => {
    const r = resolveFillRegionFractions(
      { startBar: 7, startBeat: 3, endBar: 8, endBeat: 1 },
      8,
    );
    expect(r).toEqual({ startFrac: 6.5, endFrac: 7.25 });
  });

  it('highlights THROUGH the last beat of the loop (the bug fix)', () => {
    // endBar 8 beat 4 = the last beat → must reach the loop end (8), not 7.75.
    const r = resolveFillRegionFractions(
      { startBar: 8, startBeat: 1, endBar: 8, endBeat: 4 },
      8,
    );
    expect(r).toEqual({ startFrac: 7, endFrac: 8 });
  });

  it('clamps an out-of-range end to lengthBars', () => {
    // authored endBar 10 but loop is only 8 bars → clamp to 8 (the +1 beat too)
    const r = resolveFillRegionFractions(
      { startBar: 7, startBeat: 1, endBar: 10, endBeat: 1 },
      8,
    );
    expect(r).toEqual({ startFrac: 6, endFrac: 8 });
  });

  it('a single-beat selection (start == end) highlights that one beat', () => {
    // bar 5 beat 1 → bar 5 beat 1: now an inclusive one-beat span, not empty.
    const r = resolveFillRegionFractions(
      { startBar: 5, startBeat: 1, endBar: 5, endBeat: 1 },
      8,
    );
    expect(r).toEqual({ startFrac: 4, endFrac: 4.25 });
  });

  it('returns null for an inverted span', () => {
    expect(
      resolveFillRegionFractions(
        { startBar: 8, startBeat: 1, endBar: 7, endBeat: 1 },
        8,
      ),
    ).toBeNull();
  });

  it('returns null for a non-positive lengthBars', () => {
    expect(
      resolveFillRegionFractions(
        { startBar: 1, startBeat: 1, endBar: 2, endBeat: 1 },
        0,
      ),
    ).toBeNull();
  });
});
