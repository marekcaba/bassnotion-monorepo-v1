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
 *  Re-calibrated by eye 2026-07-01 (the new full-desktop baseline). */
export const FRETBOARD_CANVAS_HEIGHT = 315;

/** WINDOW geometry (the canvas box, not the 3D scene). The gym fretboard uses the tutorial's
 *  scroll model — a native scroll container pans the neck (ScaleFretboardWindow). The viewport
 *  width is the BASELINE (scaleFactor 1.0); the responsive size tiers in useFretboardSizeTier
 *  scale from here. Re-calibrated by eye on a full-desktop window 2026-07-01: 940. */
export const FRETBOARD_WINDOW = {
  /** Canvas width in px at the baseline tier. The scroll-range + scrollToFret math in
   *  ScaleFretboardWindow read this, so they stay consistent; tiers multiply it by scaleFactor.
   *  MUST stay in sync with BASELINE_VIEWPORT_WIDTH in useFretboardSizeTier. */
  viewportWidth: 940,
};

export function getFretboardOverlayConfig(stringCount: 4 | 5 | 6) {
  // Scroll-model scene config. Re-calibrated by eye on a full-desktop window 2026-07-01 via the
  // FretboardCalibrationPanel: contentScale 1.521, contentScaleX 0.865, contentScaleY 0.833,
  // rotationX 13°, tiltAxisOffsetX 430, offsetX -1, viewport 940, height 315. sceneX is
  // string-count-dependent: tuned by eye on the 5-STRING board at viewport 940 → -409. 4-string
  // sits higher, so it keeps the old +17 gap (less negative) → -392.
  const sceneX = stringCount === 4 ? -392 : -409;
  return {
    rotationX: 13,
    rotationY: 0,
    rotationZ: 0,
    offsetX: -1,
    offsetY: 3,
    sceneX,
    sceneY: 0,
    sceneZ: 174,
    cameraDistance: 740,
    fovOffset: 0,
    originX: 284, // center of the 568px canvas
    originY: 136,
    contentScale: 1.521,
    contentScaleX: 0.865,
    contentScaleY: 0.833,
    cameraY: 0,
    perspectiveMultiplier: 0.98,
    topEdgeScale: 1.0,
    bottomEdgeScale: 1.0,
    positioningMode: 'flat' as 'flat' | 'tilted-plane' | 'screen-space',
    tiltAxisOffset: -23,
    tiltAxisOffsetX: 430,
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
