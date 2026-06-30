'use client';

/**
 * useFretboardSizeTier — pick a responsive SIZE TIER for the gym Scales fretboard from the CARD
 * CONTAINER's own width (not the raw window), so the tier is right even when the page layout
 * constrains the card.
 *
 * Why container-width + ResizeObserver (not window/matchMedia): the card mounts behind the gym's
 * auth/membership/loading guards, so its element may not exist on first mount — a plain
 * `useRef + useEffect([])` misses that and a `getBoundingClientRect` in useEffect reads 0 during
 * SPA navigation. The callback-ref + ResizeObserver pattern (mirrors NodeMatrix) fires the moment
 * the element gets a non-zero width, whenever that is.
 *
 * Tiers key off the project's EXISTING Tailwind thresholds (640 / 1024 / 1536) — no new breakpoint
 * system. The TABLET tier is the baseline everything is currently calibrated at (scaleFactor 1.0).
 *
 * scaleFactor is the single lever the geometry + scene scale by (see fretboardGeometry +
 * [[fretboard-scale-lever]]): it multiplies the on-screen px-per-fret AND contentScale in lockstep
 * so the whole board zooms with nothing desyncing. viewportWidth is the per-tier canvas width
 * (the frustum width — wider reveals more frets, so we scale it WITH the factor to keep the SAME
 * frets visible, just bigger).
 */

import { useCallback, useRef, useState } from 'react';

export type FretboardSizeTier = 'mobile' | 'tablet' | 'desktop' | 'large';

export interface FretboardSizeTierResult {
  /** Attach to the card container whose width drives the tier (callback ref). */
  ref: (node: HTMLElement | null) => void;
  /** The resolved tier. */
  tier: FretboardSizeTier;
  /** The size multiplier for this tier (1.0 = tablet baseline, the current calibration). */
  scaleFactor: number;
  /** The per-tier canvas viewport width in px (baseline × scaleFactor). */
  viewportWidth: number;
  /** The container width last measured (px); 0 until first measure. */
  measuredWidth: number;
}

/** Baseline canvas width — the value the board is calibrated at (FRETBOARD_WINDOW.viewportWidth). */
const BASELINE_VIEWPORT_WIDTH = 880;

/**
 * Per-tier config. scaleFactor is the size multiplier; viewportWidth = baseline × scaleFactor so
 * the frustum widens in step with the content scale → "same frets, just bigger".
 *
 * The BASELINE (scaleFactor 1.0, viewport 880) is the eye-tuned FULL-DESKTOP look (the values
 * baked in fretboardViewConfig 2026-07-01). BOTH desktop AND large render it at 1.0 — i.e. every
 * real desktop shows the tuned size — and only tablet/mobile scale DOWN. (Down-factors are first
 * estimates; eye-tune via the calibration panel per tier.)
 */
const TIER_CONFIG: Record<
  FretboardSizeTier,
  { scaleFactor: number; viewportWidth: number }
> = {
  mobile: { scaleFactor: 0.58, viewportWidth: Math.round(BASELINE_VIEWPORT_WIDTH * 0.58) },
  tablet: { scaleFactor: 0.74, viewportWidth: Math.round(BASELINE_VIEWPORT_WIDTH * 0.74) },
  desktop: { scaleFactor: 1.0, viewportWidth: BASELINE_VIEWPORT_WIDTH },
  large: { scaleFactor: 1.0, viewportWidth: BASELINE_VIEWPORT_WIDTH },
};

/** Map a container width (px) to a tier using the existing Tailwind 640/1024/1536 thresholds. */
export function tierForWidth(width: number): FretboardSizeTier {
  if (width >= 1536) return 'large';
  if (width >= 1024) return 'desktop';
  if (width >= 640) return 'tablet';
  return 'mobile';
}

export interface UseFretboardSizeTierOptions {
  /**
   * When false (the default during the plumbing-only step), the hook always reports the TABLET
   * baseline (scaleFactor 1.0) regardless of measured width — so the board stays byte-identical
   * while the ResizeObserver wiring is proven. Flip to true to activate real per-tier scaling.
   */
  enabled?: boolean;
}

export function useFretboardSizeTier(
  options: UseFretboardSizeTierOptions = {},
): FretboardSizeTierResult {
  const { enabled = false } = options;
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (node) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) setMeasuredWidth(w);
        }
      });
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  // Until enabled (and until we have a real measurement) hold the tablet baseline so nothing
  // jumps. measuredWidth 0 also resolves to mobile via tierForWidth, so guard on it explicitly.
  const tier: FretboardSizeTier =
    enabled && measuredWidth > 0 ? tierForWidth(measuredWidth) : 'tablet';
  const { scaleFactor, viewportWidth } = TIER_CONFIG[tier];

  return { ref, tier, scaleFactor, viewportWidth, measuredWidth };
}
