'use client';

/**
 * RollerPicker — a vertical wheel-style picker that SLIDES: spin up/down and the value
 * strip animates one row, the new value sliding into the bright center while a fresh
 * value appears at the faint edge — the "infinite wheel" feel. UP/DOWN arrows on the
 * right.
 *
 *   prev   (40% opacity)
 *   CURR   (100%)        ▲
 *   next   (40%)         ▼
 *
 * HOW THE SLIDE WORKS: the strip renders 5 rows (prev2/prev/curr/next/next2). On a
 * step we (1) translate the strip one row in the spin direction WITH a transition (so
 * the eye sees it slide), then (2) on transition-end snap back to center with NO
 * transition and commit the new value via onUp/onDown — so the next render's "curr" is
 * already the value that slid in. The snap-back is invisible because the values shift
 * in lockstep.
 */

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ROLLER_ANIM, type RollerAnimConfig } from './rollerConfig';

export interface RollerPickerProps {
  prevLabel?: string;
  currentLabel: string;
  nextLabel?: string;
  /** Two-out labels — make the edges look continuous as you spin (optional). */
  prev2Label?: string;
  next2Label?: string;
  onUp: () => void;
  onDown: () => void;
  ariaLabel: string;
  widthPx?: number;
  disabled?: boolean;
  /** Animation config — defaults to the baked ROLLER_ANIM; the calibration panel
   *  passes a live one. */
  anim?: RollerAnimConfig;
}

export function RollerPicker({
  prevLabel,
  currentLabel,
  nextLabel,
  prev2Label,
  next2Label,
  onUp,
  onDown,
  ariaLabel,
  widthPx = 92,
  disabled = false,
  anim = ROLLER_ANIM,
}: RollerPickerProps) {
  const ROW_H = anim.rowHeightPx;
  // offset in ROWS: 0 = centered. A spin sets ±1 (animated), then transition-end
  // commits the value and resets to 0 (no animation).
  const [offset, setOffset] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  const pendingRef = React.useRef<null | (() => void)>(null);

  const spin = (dir: 1 | -1, commit: () => void) => {
    if (disabled || animating) return;
    setAnimating(true);
    pendingRef.current = commit;
    // UP (dir -1) should reveal the value ABOVE → strip moves DOWN (offset +1).
    setOffset(-dir);
  };

  const onTransitionEnd = () => {
    // Commit the value that slid in, then snap the strip back to center sans animation.
    pendingRef.current?.();
    pendingRef.current = null;
    setAnimating(false);
    setOffset(0);
  };

  // EVERY row is identical — brightness comes from POSITION, not the value. A gradient
  // MASK on the viewport (below) is the fixed LENS: opaque in the center, faint at the
  // edges. As the strip slides, whatever value reaches the center brightens and the
  // leaving one dims — so the 100% lens stays put while values flow through it.
  const rowStyle: React.CSSProperties = {
    height: ROW_H,
    lineHeight: `${ROW_H}px`,
    color: '#fff',
    fontSize: anim.currentFontPx,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
    width: '100%',
  };

  // 5 rows: prev2, prev, curr, next, next2 (the mask sets brightness, not the row).
  const rows: string[] = [
    prev2Label ?? '',
    prevLabel ?? '',
    currentLabel,
    nextLabel ?? '',
    next2Label ?? '',
  ];

  // The fixed LENS — the viewport is 4 ROWS tall (so the fade extends 1.5 rows above and
  // below the center: a full row + half a row of feathering space). Three zones:
  //   ABOVE (1.5 rows): fades from 0 at the very top UP to 100% at the center-font edge.
  //   CENTER:           SOLID 100% across the full font height, edge to edge.
  //   BELOW (1.5 rows): fades from 100% at the center-font edge DOWN to 0 at the bottom.
  // The fade is EXPONENTIAL so it falls off fast right after the font and tails gently.
  const VIEWPORT_ROWS = 4;
  const viewportPx = ROW_H * VIEWPORT_ROWS;
  const fontHalfPct = (anim.currentFontPx / 2 / viewportPx) * 100; // half-font as % of viewport
  const half = fontHalfPct + anim.bandHalfPct; // solid band half-height
  const bandTop = 50 - half; // center-font top edge
  const bandBot = 50 + half; // center-font bottom edge

  // Exponential falloff from the band edge (1.0) to the viewport edge (0). Sample the
  // curve at a few points and place mask stops so the opacity curves rather than ramps.
  const curve = (t: number) => Math.pow(1 - t, 2.2); // t: 0 at band edge → 1 at viewport edge
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const topStops = stops
    .map(
      (t) =>
        `rgba(0,0,0,${curve(t).toFixed(3)}) ${(bandTop * (1 - t)).toFixed(2)}%`,
    )
    .reverse()
    .join(', ');
  const botStops = stops
    .map(
      (t) =>
        `rgba(0,0,0,${curve(t).toFixed(3)}) ${(bandBot + (100 - bandBot) * t).toFixed(2)}%`,
    )
    .join(', ');
  const maskGradient = `linear-gradient(to bottom, ${topStops}, #000 ${bandTop}%, #000 ${bandBot}%, ${botStops})`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* The roller viewport: 4 rows tall (extra ½ row of fade above/below); a fixed
          gradient mask is the LENS that keeps the center bright while values slide. */}
      <div
        style={{
          width: widthPx,
          height: viewportPx,
          overflow: 'hidden',
          position: 'relative',
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        }}
        aria-label={ariaLabel}
      >
        <div
          onTransitionEnd={onTransitionEnd}
          style={{
            position: 'absolute',
            // Center the strip's row index 2 in the 4-row viewport: row 2's center sits
            // at 2.5·ROW_H within the strip; we want it at the viewport center (2·ROW_H).
            top: -0.5 * ROW_H,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${offset * ROW_H}px)`,
            transition: animating
              ? `transform ${anim.durationMs}ms ${anim.easing}`
              : 'none',
          }}
        >
          {rows.map((r, i) => (
            <div key={`${i}-${r}`} style={rowStyle}>
              {r || ' '}
            </div>
          ))}
        </div>
      </div>

      {/* UP / DOWN arrows. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          type="button"
          onClick={() => spin(-1, onUp)}
          disabled={disabled}
          aria-label={`${ariaLabel} up`}
          className="rounded-md p-0.5 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => spin(1, onDown)}
          disabled={disabled}
          aria-label={`${ariaLabel} down`}
          className="rounded-md p-0.5 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
