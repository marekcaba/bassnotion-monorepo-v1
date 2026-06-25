/**
 * rollerConfig — the tunable animation params for the RollerPicker, in one place so a
 * dev calibration panel can adjust them live and the chosen values get baked here.
 */

export interface RollerAnimConfig {
  /** Slide duration (ms). */
  durationMs: number;
  /** CSS easing function. */
  easing: string;
  /** Height of one row in px (= the slide distance per step + the visible row size). */
  rowHeightPx: number;
  /** Opacity of the immediate prev/next rows (one step from center). */
  edgeOpacity: number;
  /** Opacity of the two-out rows (prev2/next2). */
  edge2Opacity: number;
  /** Font size of the centered current value (px). */
  currentFontPx: number;
  /** Font size of the faint edge values (px). */
  edgeFontPx: number;
  /** A +/- NUDGE (% of viewport) on the solid 100% band, on top of the auto-computed
   *  center-font height. 0 = exactly the font; positive widens the bright band a touch,
   *  negative narrows it. The feather then spans the full rows above/below. */
  bandHalfPct: number;
}

/** Baked defaults — tune live via the panel, then paste the values here. */
export const ROLLER_ANIM: RollerAnimConfig = {
  durationMs: 160,
  easing: 'ease-out',
  rowHeightPx: 18,
  edgeOpacity: 0.4,
  edge2Opacity: 0.15,
  currentFontPx: 15,
  edgeFontPx: 12,
  bandHalfPct: 0, // exactly the font height; nudge ± to taste
};

export const ROLLER_CALIBRATION_ENABLED =
  process.env.NEXT_PUBLIC_ROLLER_CALIBRATION === 'true';

export const EASINGS = [
  'ease-out',
  'ease-in-out',
  'ease',
  'linear',
  'cubic-bezier(0.22, 1, 0.36, 1)', // easeOutQuint — snappy settle
  'cubic-bezier(0.34, 1.56, 0.64, 1)', // easeOutBack — slight overshoot
];
