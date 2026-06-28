/**
 * playheadConfig — the gliding orange PLAYHEAD sphere's appearance + animation, tunable via
 * the dev PlayheadPanel and baked here. The 3D canvas reads a PlayheadConfig and the pure
 * `playheadEase` helper to position the sphere each frame.
 *
 * Five animation TYPES describe how the sphere moves note→note; the bezier handles + timing
 * shape the in-between. Pure (no React/three) so it's testable + shared by panel + canvas.
 */

export type PlayheadAnim =
  | 'glide_hold' // hold on the note, then a quick eased slide into the next (default)
  | 'linear' // constant-speed continuous travel across the whole beat
  | 'snap' // jump to the next note on its downbeat — no travel
  | 'arc_hop' // glide + a vertical hop (parabola) — Guitar-Hero "bounce"
  | 'bezier'; // full cubic-bezier eased glide over the beat (handles drive the curve)

export const PLAYHEAD_ANIMS: { value: PlayheadAnim; label: string }[] = [
  { value: 'glide_hold', label: 'Glide + Hold' },
  { value: 'linear', label: 'Linear glide' },
  { value: 'snap', label: 'Snap' },
  { value: 'arc_hop', label: 'Arc hop' },
  { value: 'bezier', label: 'Bezier ease' },
];

export interface PlayheadConfig {
  // ── Appearance ──
  /** Sphere radius in canvas px (dots are ~13). */
  radius: number;
  /** Hex color string (e.g. '#f97316'). */
  color: string;
  /** 0–1 material opacity. */
  opacity: number;
  /** Emissive glow intensity (0–2). */
  emissiveIntensity: number;
  /** Z lift above the dot plane. */
  zOffset: number;
  /** Scale the sphere UP on the note's downbeat then settle (0 = off, e.g. 0.4 = +40%). */
  pulseAmount: number;

  // ── Animation ──
  anim: PlayheadAnim;
  /** glide_hold: fraction of the beat spent HOLDING before the slide (0–1). */
  holdFrac: number;
  /** Fraction of the beat the glide occupies (the slide happens in the LAST `glideFrac`).
   *  For 'linear' the whole beat is used; for 'glide_hold' this is implied by holdFrac. */
  glideFrac: number;
  /** arc_hop: peak hop height in px (lifts the sphere mid-travel). */
  hopHeight: number;
  /** bezier: cubic-bezier easing control points [x1,y1,x2,y2] (CSS-style, 0–1 x). */
  bezier: [number, number, number, number];
}

export const DEFAULT_PLAYHEAD_CONFIG: PlayheadConfig = {
  radius: 7,
  color: '#f97316', // orange-500
  opacity: 0.95,
  emissiveIntensity: 0.85,
  zOffset: 3,
  pulseAmount: 0,
  anim: 'glide_hold',
  holdFrac: 0.7,
  glideFrac: 0.3,
  hopHeight: 10,
  bezier: [0.4, 0, 0.2, 1], // a snappy ease-in-out
};

/** Solve a cubic-bezier easing y for a given x (Newton's method, CSS-style). Pure. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Bezier basis on the parameter t.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  // Solve t for the target x.
  let t = x;
  for (let i = 0; i < 8; i++) {
    const xErr = sampleX(t) - x;
    if (Math.abs(xErr) < 1e-4) break;
    const dx = sampleDX(t);
    if (Math.abs(dx) < 1e-6) break;
    t -= xErr / dx;
    t = Math.min(Math.max(t, 0), 1);
  }
  return sampleY(t);
}

/**
 * Given the progress through the CURRENT note's slot [0..1] and the config, return the glide
 * parameters: `t` ∈ [0..1] for the lerp from the current dot → next dot, and `hop` ∈ [0..1]
 * for the vertical arc (0 except for arc_hop). Pure — the canvas multiplies these into the
 * dot positions. Each anim type shapes the in-between differently.
 */
export function playheadGlide(
  noteProgress: number,
  cfg: PlayheadConfig,
): { t: number; hop: number } {
  const p = Math.min(Math.max(noteProgress, 0), 1);
  switch (cfg.anim) {
    case 'snap':
      // Stay on the note the whole slot; the lerp jumps to the next only at the very end.
      return { t: p >= 0.999 ? 1 : 0, hop: 0 };

    case 'linear':
      // Constant-speed travel across the whole beat.
      return { t: p, hop: 0 };

    case 'arc_hop': {
      // Glide across the whole beat + a parabolic hop that peaks mid-travel.
      const hop = Math.sin(p * Math.PI); // 0 → 1 → 0
      return { t: p, hop };
    }

    case 'bezier': {
      // Full cubic-bezier eased glide over the whole beat.
      const [x1, y1, x2, y2] = cfg.bezier;
      return { t: cubicBezier(x1, y1, x2, y2, p), hop: 0 };
    }

    case 'glide_hold':
    default: {
      // Hold for holdFrac, then a quick bezier-eased slide over the remaining time.
      const hold = Math.min(Math.max(cfg.holdFrac, 0), 0.95);
      const raw = p <= hold ? 0 : (p - hold) / (1 - hold);
      const [x1, y1, x2, y2] = cfg.bezier;
      return { t: cubicBezier(x1, y1, x2, y2, raw), hop: 0 };
    }
  }
}

/** Scale multiplier for the on-beat pulse (1 at rest, up to 1+pulseAmount right on the
 *  downbeat, settling over the first ~40% of the slot). Pure. */
export function playheadPulse(
  noteProgress: number,
  cfg: PlayheadConfig,
): number {
  if (cfg.pulseAmount <= 0) return 1;
  const p = Math.min(Math.max(noteProgress, 0), 1);
  if (p > 0.4) return 1;
  // Decay the pulse from full at p=0 to 0 at p=0.4.
  const decay = 1 - p / 0.4;
  return 1 + cfg.pulseAmount * decay;
}
