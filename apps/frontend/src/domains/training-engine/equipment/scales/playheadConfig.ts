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

  // ── Landing ripple ("dartboard") — concentric rings at the dot on each bounce touchdown ──
  /** Master toggle for the ripple (0 = off, 1 = on). */
  rippleOn: number;
  /** Ring color (hex). Independent of the sphere so the dartboard can contrast. */
  rippleColor: string;
  /** DENSITY — how many concentric rings expand together (1 = single shockwave). */
  rippleRings: number;
  /** How far the rings expand, as a multiple of the sphere radius (1 = no growth). */
  rippleExpand: number;
  /** How long ONE ripple lasts, in milliseconds (impact → fully faded). Frame-rate independent. */
  rippleDurationMs: number;
  /** Peak ring opacity on impact (fades to 0 as it expands). */
  rippleOpacity: number;

  // ── Trailing second ripple — same expand/speed/opacity, fires DELAY behind the first ──
  /** Toggle the trailing ripple (0 = off, 1 = on). */
  ripple2On: number;
  /** The trailing ring's color (hex; default black for an orange-then-dark chase). */
  ripple2Color: string;
  /** How far behind the first ripple it fires, in ripple-progress units [0..1]. */
  ripple2Delay: number;

  // ── ANTICIPATION: ghost-ball RUNWAY — the next few notes previewed as fading ghost
  //    spheres + a connecting tracer, so the route ahead reads early (Guitar-Hero style) ──
  /** Toggle the runway (0 = off, 1 = on). */
  runwayOn: number;
  /** How many notes ahead to preview (the runway length). Auto-shortened at fast tempo. */
  runwayCount: number;
  /** Ghost color (hex). */
  runwayColor: string;
  /** Opacity of the NEAREST ghost (the next note). Further ghosts fade toward 0. */
  runwayOpacity: number;
  /** The nearest ghost's radius as a fraction of the sphere radius (further ones shrink). */
  runwaySize: number;
  /** Connecting tracer line opacity (0 = no tracer, just ghost balls). */
  runwayTracer: number;
  /** How MANY connecting line segments to draw (0 = none; caps at the gaps available). */
  tracerCount: number;
  /** Tracer line thickness, as a fraction of the sphere radius. */
  tracerThickness: number;
  /** Tracer line color (hex) — independent of the dot/ghost color. */
  tracerColor: string;
  /** Above this BPM the runway shortens (declutter at speed). 0 = never shorten. */
  runwayTempoCap: number;
  /** Ghost SHAPE: 'sphere' = raised 3D ball, 'disc' = flat dot lying on the fretboard. */
  runwayShape: GhostShape;

  // ── ANTICIPATION: APPROACH RING (the timing layer) — a ring shrinks onto the NEXT dot,
  //    collapsing to it exactly on the downbeat = "play now", then hands off to the ripple ──
  /** Toggle the approach ring (0 = off, 1 = on). */
  approachOn: number;
  /** Ring color (hex). */
  approachColor: string;
  /** How many beats BEFORE the note the ring starts (its lead time). */
  approachLead: number;
  /** The ring's start size, as a multiple of the sphere radius (shrinks to ~1× = the dot). */
  approachStart: number;
  /** Ring opacity (fades in as it closes). */
  approachOpacity: number;

  // ── ROOT MARKER RINGS — static rings (EXACTLY the yellow active ring's mesh, recolored)
  //    around the root + octave notes (the dark-green dots). Only on/off + color are tunable;
  //    geometry/opacity match the active-ring template. ──
  /** Toggle the root rings (0 = off, 1 = on). */
  rootRingOn: number;
  /** Ring color (hex) — green or blue to mark the roots. */
  rootRingColor: string;

  // ── HIGHLIGHT WINDOW (gym Scales) — while PLAYING, only a small moving window of dots is
  //    BRIGHT green; the rest stay a SOLID muted green. The bright highlight EASES in/out as the
  //    window slides. Dimming is by COLOR (opacity stays 1 → solid, never see-through). ──
  /** How many notes AHEAD of the current note are bright (the window size). 1 = just the next. */
  litWindowAhead: number;
  /** Per-frame lerp toward the brightness target (0–1). Higher = snappier fade; lower = slower. */
  litSmoothing: number;
  /** Bright (in-window) green for a normal scale note (hex). */
  litBrightColor: string;
  /** Dim (out-of-window) green for a normal scale note (hex) — solid, just muted. */
  litDimColor: string;
  /** Bright green for a ROOT/octave note (hex) — the home note stands out. */
  litBrightRootColor: string;
  /** Dim green for a ROOT/octave note (hex). */
  litDimRootColor: string;
  /** Out-of-window root RING brightness factor (0–1) — its RGB scales by this while playing. */
  rootRingDimFactor: number;
}

export type GhostShape = 'sphere' | 'disc';
export const GHOST_SHAPES: { value: GhostShape; label: string }[] = [
  { value: 'sphere', label: 'Spheres (raised)' },
  { value: 'disc', label: 'Dots on the ground' },
];

// Eye-tuned on the gym board 2026-06-28 (panel → "Log values"): an Arc-hop playhead — the
// sphere bounces note-to-note with a quick eased slide + an on-beat pulse.
export const DEFAULT_PLAYHEAD_CONFIG: PlayheadConfig = {
  radius: 5,
  color: '#bdbdbd', // light grey sphere
  opacity: 0.95,
  emissiveIntensity: 0.8,
  zOffset: 7,
  pulseAmount: 0.4,
  anim: 'arc_hop',
  holdFrac: 0,
  glideFrac: 0.05,
  hopHeight: 18,
  bezier: [0, 0.77, 0.96, 1],
  rippleOn: 1,
  rippleColor: '#f97316',
  rippleRings: 1,
  rippleExpand: 1.1, // eye-tuned: a tight, subtle pop (barely grows)
  rippleDurationMs: 100, // eye-tuned: quick flash that self-fades
  rippleOpacity: 0.2, // eye-tuned: faint
  // Trailing second ripple: same params, fires a beat behind the first, in a darker orange
  // so the landing reads as a bright flash chased by a dim ring.
  ripple2On: 1,
  ripple2Color: '#b85e14',
  ripple2Delay: 0.18,
  // Anticipation runway — eye-tuned: 1 flat black DOT on the ground (the NEXT note only), no
  // tracer line. The faint next-next ghost was dropped (cluttered the look).
  runwayOn: 1,
  runwayCount: 1,
  runwayColor: '#000000',
  runwayOpacity: 0.95,
  runwaySize: 1.4,
  runwayTracer: 0,
  tracerCount: 2,
  tracerThickness: 0.72,
  tracerColor: '#000000',
  runwayTempoCap: 0,
  runwayShape: 'disc',
  // Approach ring (timing layer) — orange ring, long 3.25-beat lead, starts near the dot.
  approachOn: 1,
  approachColor: '#ff9500',
  approachLead: 3.25,
  approachStart: 1.5,
  approachOpacity: 1,
  // Root marker rings — green by default, around the root + octave dots.
  rootRingOn: 1,
  rootRingColor: '#22c55e', // green-500
  // Highlight window — eased dim↔bright. Baked from the in-code constants: bright = green-600 /
  // root green-900; dim = solid muted greens; smoothing 0.18 (a few-frame ease).
  litWindowAhead: 1,
  litSmoothing: 0.18,
  litBrightColor: '#16a34a', // green-600
  litDimColor: '#184936', // solid muted green (eye-tuned)
  litBrightRootColor: '#14532d', // green-900 (root home note)
  litDimRootColor: '#0f2a1c', // dim root green
  rootRingDimFactor: 0.35,
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
