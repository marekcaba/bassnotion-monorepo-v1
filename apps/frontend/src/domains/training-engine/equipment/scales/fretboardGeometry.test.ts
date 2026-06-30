/**
 * fretboardGeometry — golden + gate tests.
 *
 * The board has NO geometry test coverage historically; the scroll/centering math was only
 * provable by eye in the browser. These tests (1) CHARACTERIZE today's behaviour at the real
 * params so the scaleFactor refactor has a safety net, and (2) GATE that scaleFactor=1 is
 * byte-identical to the no-arg call (the proof the refactor changed nothing before tiers exist).
 */
import { describe, it, expect } from 'vitest';
import { computeFretboardGeometry } from './fretboardGeometry';

// The real params the gym uses: 4-string and 5/6-string necks (21 & 24 frets), viewport 700.
const VIEWPORT = 700;

describe('computeFretboardGeometry — golden (baseline, scaleFactor=1)', () => {
  it('21-fret neck at viewport 700 matches the pre-extraction inline math', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    // maxScroll = (21 − 4.77)·45.5 − 700/2 + 40 = 16.23·45.5 − 350 + 40 = 738.465 − 310 = 428.465
    expect(g.maxScroll).toBeCloseTo(428.465, 3);
    expect(g.fullContentWidth).toBeCloseTo(1128.465, 3);
    expect(g.viewFrets).toBeCloseTo(700 / 45.5, 6); // 15.3846…
    expect(g.centerFretAt0).toBe(4.77);
    expect(g.screenPxPerFret).toBe(45.5);
    expect(g.centerPxPerFret).toBe(45.5);
    expect(g.scrollSlack).toBe(40);
  });

  it('24-fret neck at viewport 700', () => {
    const g = computeFretboardGeometry({ maxFrets: 24, viewportWidth: VIEWPORT });
    // (24 − 4.77)·45.5 − 350 + 40 = 19.23·45.5 − 310 = 875.0 − 310 = 565.0… check exact
    expect(g.maxScroll).toBeCloseTo((24 - 4.77) * 45.5 - 350 + 40, 6);
    expect(g.fullContentWidth).toBeCloseTo(g.maxScroll + VIEWPORT, 6);
  });

  it('scrollForFret centers a fret via (fret − 4.77)·45.5, clamped to [0, maxScroll]', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    // fret below the center anchor clamps to 0 (can't scroll left of home).
    expect(g.scrollForFret(0)).toBe(0);
    expect(g.scrollForFret(4.77)).toBeCloseTo(0, 6);
    // a mid fret
    expect(g.scrollForFret(10)).toBeCloseTo((10 - 4.77) * 45.5, 6);
    // beyond the right edge clamps to maxScroll
    expect(g.scrollForFret(99)).toBe(g.maxScroll);
  });

  it('fitsInView uses the fret-domain margin 1.5 against viewFrets', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    const viewFrets = 700 / 45.5; // ~15.38
    // a span just inside (viewFrets − 1.5 ≈ 13.88) fits; just outside doesn't.
    expect(g.fitsInView(0, 13)).toBe(true);
    expect(g.fitsInView(0, Math.ceil(viewFrets - 1.5) + 1)).toBe(false);
  });
});

describe('computeFretboardGeometry — gate (scaleFactor=1 ⇒ byte-identical)', () => {
  const PARAM_SETS = [
    { maxFrets: 21, viewportWidth: 700 },
    { maxFrets: 24, viewportWidth: 700 },
    { maxFrets: 21, viewportWidth: 580 },
    { maxFrets: 24, viewportWidth: 900 },
  ];

  for (const params of PARAM_SETS) {
    it(`compute(${JSON.stringify(params)}, 1) deep-equals no-arg`, () => {
      const noArg = computeFretboardGeometry(params);
      const explicitOne = computeFretboardGeometry({ ...params, scaleFactor: 1 });
      // Compare every numeric field exactly (=== via toBe), and the function outputs.
      expect(explicitOne.maxScroll).toBe(noArg.maxScroll);
      expect(explicitOne.fullContentWidth).toBe(noArg.fullContentWidth);
      expect(explicitOne.viewFrets).toBe(noArg.viewFrets);
      expect(explicitOne.screenPxPerFret).toBe(noArg.screenPxPerFret);
      expect(explicitOne.centerPxPerFret).toBe(noArg.centerPxPerFret);
      expect(explicitOne.centerFretAt0).toBe(noArg.centerFretAt0);
      expect(explicitOne.scrollSlack).toBe(noArg.scrollSlack);
      for (const fret of [0, 4.77, 7, 12, 19, 99]) {
        expect(explicitOne.scrollForFret(fret)).toBe(noArg.scrollForFret(fret));
      }
      for (const [lo, hi] of [[0, 5], [3, 14], [0, 20]] as const) {
        expect(explicitOne.fitsInView(lo, hi)).toBe(noArg.fitsInView(lo, hi));
      }
    });
  }
});

describe('computeFretboardGeometry — scaled tiers (scaleFactor ≠ 1)', () => {
  it('viewFrets is INVARIANT when viewport and px-rate scale together (the litmus test)', () => {
    // A real tier scales BOTH viewportWidth and the px-rate by f, so viewFrets stays the same →
    // "same frets, just bigger". Here we model that: viewport 700→910 (×1.3), factor 1.3.
    const base = computeFretboardGeometry({ maxFrets: 21, viewportWidth: 700 });
    const wide = computeFretboardGeometry({
      maxFrets: 21,
      viewportWidth: 700 * 1.3,
      scaleFactor: 1.3,
    });
    expect(wide.viewFrets).toBeCloseTo(base.viewFrets, 6); // SAME frets visible
    expect(wide.screenPxPerFret).toBeCloseTo(45.5 * 1.3, 6); // bigger px/fret
  });

  it('px-rates scale by the factor; the fret-domain anchor does NOT', () => {
    const g = computeFretboardGeometry({
      maxFrets: 21,
      viewportWidth: 700 * 1.3,
      scaleFactor: 1.3,
    });
    expect(g.screenPxPerFret).toBeCloseTo(45.5 * 1.3, 6);
    expect(g.centerPxPerFret).toBeCloseTo(45.5 * 1.3, 6);
    expect(g.scrollSlack).toBeCloseTo(40 * 1.3, 6);
    expect(g.centerFretAt0).toBe(4.77); // fret index — UNSCALED
  });
});
