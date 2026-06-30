/**
 * fretboardGeometry — the PURE scroll/centering math for the gym Scales 3D fretboard window.
 *
 * Extracted verbatim from ScaleFretboardWindow so it can be unit-tested and, crucially, so the
 * size-tier `scaleFactor` lives in ONE place. The board is a fixed-pixel 3D scene (see
 * Ring3DOverlayCanvas); the DOM scroll container pans it. The scroll↔fret mapping is a MEASURED
 * on-screen relationship (≈45.5 px/fret at the baseline contentScale 1.17 + viewportWidth 700).
 *
 * THE SIZE LEVER (why scaleFactor exists): to make the whole board appear bigger/smaller we scale
 * the 3D content's `contentScale`. That changes the on-screen pixels-per-fret, so the scroll
 * math's px-rates MUST scale by the SAME factor or the scroll container + scroll-driven playhead
 * sphere desync from the dots. So:
 *
 *   SCALES with the factor (px-rates / px sizes):  SCREEN_PX_PER_FRET, CENTER_PX_PER_FRET,
 *                                                  SCROLL_SLACK, (and viewportWidth, passed in).
 *   STAYS CONSTANT (fret-domain / unitless):       CENTER_FRET_AT_0 (a FRET INDEX — every use is
 *                                                  `someFret − CENTER_FRET_AT_0`, scaling it would
 *                                                  shift home framing), the fits-in-view margin.
 *
 * INVARIANT: `viewFrets = viewportWidth / SCREEN_PX_PER_FRET`. Under correct uniform scaling BOTH
 * numerator and denominator carry the factor, so viewFrets is identical at every tier. If it
 * drifts across tiers, the px-rate/viewport pair was scaled wrong.
 *
 * scaleFactor defaults to 1 → byte-identical to the pre-extraction inline math (BASE × 1 === BASE
 * in IEEE-754, exactly), which the gate test asserts.
 */

/** Baseline measured constants — the calibration locked at contentScale 1.17 + viewportWidth 700
 *  (ScaleFretboardWindow comments dated 2026-06-28/30). scaleFactor multiplies the px-rates. */
const BASE_SCREEN_PX_PER_FRET = 45.5;
const BASE_CENTER_PX_PER_FRET = 45.5; // same measured rate as SCREEN_PX_PER_FRET (kept locked)
const BASE_SCROLL_SLACK = 40;
/** The fret centered at scrollLeft 0. A FRET INDEX — never scales. */
const CENTER_FRET_AT_0 = 4.77;
/** Fret-domain slack in the fits-in-view test. Unitless (frets). Never scales. */
const FITS_IN_VIEW_MARGIN = 1.5;

export interface FretboardGeometryInput {
  /** Number of frets on the neck (musical property — never scales). */
  maxFrets: number;
  /** Canvas viewport width in px. Already the per-tier (scaled) width. */
  viewportWidth: number;
  /** Size-tier multiplier on the px-rates. 1 = baseline (byte-identical to the old inline math). */
  scaleFactor?: number;
}

export interface FretboardGeometry {
  /** Measured on-screen px per fret, scaled. Used for the fits-in-view test. */
  screenPxPerFret: number;
  /** Scroll px per fret of pan, scaled. Used for centering (same value as screenPxPerFret). */
  centerPxPerFret: number;
  /** The fret centered at scrollLeft 0 (fret index, unscaled). */
  centerFretAt0: number;
  /** Breathing room past the right-edge stop (px, scaled). */
  scrollSlack: number;
  /** Max scrollLeft: the right-edge stop where the last fret sits flush-right. */
  maxScroll: number;
  /** Spacer width = maxScroll + viewportWidth, so the browser clamps scroll to [0, maxScroll]. */
  fullContentWidth: number;
  /** How many whole frets fit across the viewport. The scale invariant. */
  viewFrets: number;
  /** scrollLeft that centers `fret` in the viewport, clamped to [0, maxScroll]. */
  scrollForFret: (fret: number) => number;
  /** Whether a fret SPAN [lo, hi] fits within the viewport (with the fret-domain margin). */
  fitsInView: (lo: number, hi: number) => boolean;
}

/**
 * Compute the fretboard scroll/centering geometry for a given neck + viewport + size tier.
 * Pure: no DOM, no state — testable. scaleFactor=1 reproduces the original inline math exactly.
 */
export function computeFretboardGeometry({
  maxFrets,
  viewportWidth,
  scaleFactor = 1,
}: FretboardGeometryInput): FretboardGeometry {
  const screenPxPerFret = BASE_SCREEN_PX_PER_FRET * scaleFactor;
  const centerPxPerFret = BASE_CENTER_PX_PER_FRET * scaleFactor;
  const scrollSlack = BASE_SCROLL_SLACK * scaleFactor;
  const centerFretAt0 = CENTER_FRET_AT_0; // fret index — unscaled

  // The right-edge stop. Centering the last fret is (maxFrets − anchor)×px; the RIGHT EDGE is
  // half a viewport less, so the last fret stops flush right with no blank leather beyond it.
  const maxScroll = Math.max(
    0,
    (maxFrets - centerFretAt0) * centerPxPerFret - viewportWidth / 2 + scrollSlack,
  );
  const fullContentWidth = maxScroll + viewportWidth;
  const viewFrets = viewportWidth / screenPxPerFret;

  const scrollForFret = (fret: number): number =>
    Math.min(Math.max((fret - centerFretAt0) * centerPxPerFret, 0), maxScroll);

  const fitsInView = (lo: number, hi: number): boolean =>
    hi - lo <= viewFrets - FITS_IN_VIEW_MARGIN;

  return {
    screenPxPerFret,
    centerPxPerFret,
    centerFretAt0,
    scrollSlack,
    maxScroll,
    fullContentWidth,
    viewFrets,
    scrollForFret,
    fitsInView,
  };
}
