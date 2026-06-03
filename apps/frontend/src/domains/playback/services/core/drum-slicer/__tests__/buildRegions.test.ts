/**
 * buildRegions validation — the hybrid's grouping logic. Strong onsets (≥
 * threshold) become bit-exact `transient` regions; runs of weak onsets between
 * them collapse into one `texture` region (WSOLA-stretched as a whole).
 * Adjacent strong onsets ⇒ no texture region. Index 0 is always strong.
 * Region boundaries must reconstruct the original onset grid with no gaps.
 */
import { describe, it, expect } from 'vitest';
import { buildRegions, type DrumRegion } from '../DrumSlicePlayer.js';

const T = 0.6; // threshold

/** Every onset index must be covered exactly once by the regions, in order
 *  (no gaps, no overlaps) — i.e. regions tile [0, n). */
function tilesContiguously(regions: DrumRegion[], n: number): boolean {
  let expected = 0;
  for (const r of regions) {
    if (r.startIndex !== expected) return false;
    if (r.endIndex <= r.startIndex) return false;
    expected = r.endIndex;
  }
  return expected === n;
}

describe('buildRegions', () => {
  it('all strong → all transient regions, no texture', () => {
    const conf = [1, 0.9, 0.8, 0.95];
    const r = buildRegions(conf, T);
    expect(r.every((x) => x.kind === 'transient')).toBe(true);
    expect(r.length).toBe(4);
    expect(tilesContiguously(r, 4)).toBe(true);
  });

  it('weak onsets between two strong collapse into ONE texture region', () => {
    // strong(0) soft(1) soft(2) strong(3) soft(4) strong(5)
    const conf = [1, 0.2, 0.3, 0.8, 0.1, 0.9];
    const r = buildRegions(conf, T);
    // Expect: transient[0,1), texture[1,3), transient[3,4), texture[4,5), transient[5,6)
    expect(r.map((x) => x.kind)).toEqual([
      'transient',
      'texture',
      'transient',
      'texture',
      'transient',
    ]);
    const tex = r.filter((x) => x.kind === 'texture');
    expect(tex[0]).toMatchObject({ startIndex: 1, endIndex: 3 });
    expect(tex[1]).toMatchObject({ startIndex: 4, endIndex: 5 });
    expect(tilesContiguously(r, 6)).toBe(true);
  });

  it('adjacent strong transients ⇒ no texture between them', () => {
    const conf = [1, 0.9, 0.2, 0.2, 0.9];
    const r = buildRegions(conf, T);
    // transient[0,1), transient[1,2), texture[2,4), transient[4,5)
    expect(r.map((x) => x.kind)).toEqual([
      'transient',
      'transient',
      'texture',
      'transient',
    ]);
    expect(tilesContiguously(r, 5)).toBe(true);
  });

  it('trailing weak run becomes a texture region to the loop end', () => {
    const conf = [1, 0.9, 0.2, 0.2, 0.2];
    const r = buildRegions(conf, T);
    // transient[0,1), transient[1,2), texture[2,5)
    expect(r[r.length - 1]).toMatchObject({
      kind: 'texture',
      startIndex: 2,
      endIndex: 5,
    });
    expect(tilesContiguously(r, 5)).toBe(true);
  });

  it('index 0 is always strong even if its confidence is low', () => {
    const conf = [0.0, 0.1, 0.9];
    const r = buildRegions(conf, T);
    expect(r[0]).toMatchObject({ kind: 'transient', startIndex: 0, endIndex: 1 });
    expect(tilesContiguously(r, 3)).toBe(true);
  });

  it('a higher threshold turns more onsets into texture', () => {
    const conf = [1, 0.7, 0.5, 0.7];
    const lo = buildRegions(conf, 0.6); // 0.7s are strong
    const hi = buildRegions(conf, 0.8); // only index 0 strong → rest texture
    expect(lo.filter((x) => x.kind === 'texture').length).toBeLessThan(
      hi.filter((x) => x.kind === 'texture').length + 1,
    );
    // At threshold 0.8 only onset 0 is strong → one big texture region [1,4).
    expect(hi.map((x) => x.kind)).toEqual(['transient', 'texture']);
    expect(hi[1]).toMatchObject({ startIndex: 1, endIndex: 4 });
  });

  it('empty input → no regions', () => {
    expect(buildRegions([], T)).toEqual([]);
  });
});
