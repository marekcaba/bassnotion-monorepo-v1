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

// The real params the gym uses: 4-string and 5/6-string necks (21 & 24 frets), baseline viewport.
const VIEWPORT = 880;
// The baseline on-screen px/fret + center anchor + slack the module is built on. Derived from the
// module's behaviour (not hardcoded magic) so these tests track the baseline if it's re-tuned.
const BASE_PXF = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT })
  .screenPxPerFret;
const ANCHOR = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT })
  .centerFretAt0;
const SLACK = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT })
  .scrollSlack;

describe('computeFretboardGeometry — golden (baseline, scaleFactor=1)', () => {
  it('21-fret neck at the baseline viewport: maxScroll = (frets−anchor)·pxf − vw/2 + slack', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    const expected = (21 - ANCHOR) * BASE_PXF - VIEWPORT / 2 + SLACK;
    expect(g.maxScroll).toBeCloseTo(expected, 6);
    expect(g.fullContentWidth).toBeCloseTo(expected + VIEWPORT, 6);
    expect(g.viewFrets).toBeCloseTo(VIEWPORT / BASE_PXF, 6);
    expect(g.screenPxPerFret).toBe(g.centerPxPerFret); // the two rates stay locked
  });

  it('24-fret neck at the baseline viewport', () => {
    const g = computeFretboardGeometry({ maxFrets: 24, viewportWidth: VIEWPORT });
    expect(g.maxScroll).toBeCloseTo((24 - ANCHOR) * BASE_PXF - VIEWPORT / 2 + SLACK, 6);
    expect(g.fullContentWidth).toBeCloseTo(g.maxScroll + VIEWPORT, 6);
  });

  it('scrollForFret centers a fret via (fret − anchor)·pxf, clamped to [0, maxScroll]', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    // fret below the center anchor clamps to 0 (can't scroll left of home).
    expect(g.scrollForFret(0)).toBe(0);
    expect(g.scrollForFret(ANCHOR)).toBeCloseTo(0, 6);
    // a mid fret
    expect(g.scrollForFret(10)).toBeCloseTo((10 - ANCHOR) * BASE_PXF, 6);
    // beyond the right edge clamps to maxScroll
    expect(g.scrollForFret(99)).toBe(g.maxScroll);
  });

  it('fitsInView uses the fret-domain margin 1.5 against viewFrets', () => {
    const g = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    const viewFrets = VIEWPORT / BASE_PXF;
    // a span just inside (viewFrets − 1.5) fits; just outside doesn't.
    expect(g.fitsInView(0, Math.floor(viewFrets - 1.5) - 1)).toBe(true);
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
    // "same frets, just bigger". Model that: viewport ×1.3, factor 1.3.
    const base = computeFretboardGeometry({ maxFrets: 21, viewportWidth: VIEWPORT });
    const wide = computeFretboardGeometry({
      maxFrets: 21,
      viewportWidth: VIEWPORT * 1.3,
      scaleFactor: 1.3,
    });
    expect(wide.viewFrets).toBeCloseTo(base.viewFrets, 6); // SAME frets visible
    expect(wide.screenPxPerFret).toBeCloseTo(BASE_PXF * 1.3, 6); // bigger px/fret
  });

  it('px-rates scale by the factor; the fret-domain anchor does NOT', () => {
    const g = computeFretboardGeometry({
      maxFrets: 21,
      viewportWidth: VIEWPORT * 1.3,
      scaleFactor: 1.3,
    });
    expect(g.screenPxPerFret).toBeCloseTo(BASE_PXF * 1.3, 6);
    expect(g.centerPxPerFret).toBeCloseTo(BASE_PXF * 1.3, 6);
    expect(g.scrollSlack).toBeCloseTo(SLACK * 1.3, 6);
    expect(g.centerFretAt0).toBe(ANCHOR); // fret index — UNSCALED
  });
});
