/**
 * fretboardViewConfig — the calibrated 3D-scene config the gym fretboard tools pass
 * to Ring3DOverlayCanvas, so the tool's fretboard renders at the SAME size + tilt +
 * proportions as the tutorial player's fretboard (the "grab the same dumbbell"
 * familiarity).
 *
 * These values MIRROR the tutorial's hand-calibrated overlay3DConfig in
 * YouTubeWidgetPage.tsx (~line 432). They were tuned by eye there; we copy them so
 * the two surfaces match. `sceneX` is string-count-dependent (4-string sits at a
 * different X than 5/6) — getFretboardOverlayConfig(stringCount) applies that rule,
 * matching YouTubeWidgetPage.tsx:498-509.
 *
 * NOTE: when a SECOND equipment tool needs this, promote it to a shared widgets-level
 * export the tutorial ALSO consumes (single source of truth) instead of a mirror.
 * For now it's a mirror to avoid editing the tutorial.
 */

/** The canvas the tutorial calibrated against is ~568px wide (originX 284 = center). */
export const FRETBOARD_CANVAS_WIDTH = 568;
/** Container height that gives the same vertical proportion as the tutorial.
 *  Ear/eye-calibrated for the gym scales tool (2026-06-24). */
export const FRETBOARD_CANVAS_HEIGHT = 305;

/** WINDOW geometry (the canvas box, not the 3D scene). The fretboard canvas is WIDER
 *  than the fixed-width card so more frets show; the right cut moves right while the
 *  left edge stays anchored. Calibrated live, baked here. */
export const FRETBOARD_WINDOW = {
  /** The PRIMARY (inner canvas) width in px. HIGHER = right hard-cut moves right →
   *  more frets visible (scene was hardcoded to 580). Calibrated 2026-06-24. */
  viewportWidth: 710,
};

export function getFretboardOverlayConfig(stringCount: 4 | 5 | 6) {
  // Calibrated on a 4-string (the right cut, content scale, and left-anchor were tuned
  // by eye 2026-06-24). 5/6-string keep the same relative left-shift the tutorial used
  // (4→others was a −17 nudge), applied to the calibrated 4-string base.
  const sceneX = stringCount === 4 ? -51 : -68;
  return {
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    offsetX: 25,
    offsetY: 3,
    sceneX,
    sceneY: 0,
    sceneZ: 174,
    cameraDistance: 740,
    fovOffset: 0,
    originX: 284, // center of the 568px canvas
    originY: 136,
    contentScale: 1.57,
    contentScaleX: 0.878,
    contentScaleY: 0.949,
    cameraY: 0,
    perspectiveMultiplier: 0.98,
    topEdgeScale: 1.0,
    bottomEdgeScale: 1.0,
    positioningMode: 'flat' as 'flat' | 'tilted-plane' | 'screen-space',
    tiltAxisOffset: -23,
    tiltAxisOffsetX: 448,
    leftFadeZone: 10,
    rightFadeZone: 10,
    fadeEdgeAngle: 0,
    activeRingZOffset: -1,
    activeRingRadius: 13,
    activeRingTubeRadius: 1.25,
    activeDotColor: '#3b82f6',
    activeRingColor: '#f97316',
    bloomEnabled: true,
    bloomIntensity: 0.0,
    bloomThreshold: 1.0,
    fingerLabelOffsetX: 0,
    fingerLabelOffsetY: -2,
  };
}
