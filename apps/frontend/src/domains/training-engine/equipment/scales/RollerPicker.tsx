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
 * HOW THE SLIDE WORKS: the strip renders 7 rows (prev3..next3) — the outer two are
 * BUFFER so a value always covers the viewport edge MID-slide (otherwise the row sliding
 * in is blank until the snap-back). On a
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
  /** Press-and-hold the arrows to auto-repeat (accelerating), bypassing the slow per-step
   *  slide. For continuous ranges like TEMPO/BPM where stepping one at a time is tedious;
   *  leave off for discrete pickers (scale/position/key) where you'd overshoot. */
  holdRepeat?: boolean;
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
  holdRepeat = false,
  anim = ROLLER_ANIM,
}: RollerPickerProps) {
  const ROW_H = anim.rowHeightPx;
  // offset in ROWS: 0 = centered. A spin sets ±1 (animated), then transition-end
  // commits the value and resets to 0 (no animation).
  const [offset, setOffset] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  // The slide duration in play right now. Normal clicks use anim.durationMs; press-and-
  // hold steps shorten it to track the (accelerating) repeat rate so each roll completes
  // before the next begins.
  const [slideMs, setSlideMs] = React.useState(anim.durationMs);
  const pendingRef = React.useRef<null | (() => void)>(null);

  const spin = (dir: 1 | -1, commit: () => void) => {
    if (disabled || animating) return;
    setSlideMs(anim.durationMs); // normal click → the baked slide duration
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

  // ── Press-and-hold auto-repeat (tempo) ──────────────────────────────────────
  // A TAP behaves EXACTLY like every other roller: one normal animated `spin`. Only a
  // genuine HOLD (button still down after HOLD_THRESHOLD) kicks in the fast, accelerating
  // auto-repeat. So nothing changes for a tap; the fast behaviour is hold-only.
  const HOLD_THRESHOLD = 350; // ms the button must stay down before auto-repeat starts
  const holdTimerRef = React.useRef<number | null>(null);
  const visualResetRef = React.useRef<number | null>(null);
  // Always commit the LATEST handler (props change every render as the value steps).
  const handlersRef = React.useRef({ onUp, onDown });
  handlersRef.current = { onUp, onDown };

  // Visual-only roll used DURING the fast repeat: slide the strip one row then snap back,
  // WITHOUT committing (the value was already committed). Restartable mid-flight so fast
  // repeats keep showing motion. Not used by a tap — a tap goes through normal `spin`.
  const visualSpin = (dir: 1 | -1, durationMs: number) => {
    if (visualResetRef.current !== null) {
      window.clearTimeout(visualResetRef.current);
      visualResetRef.current = null;
    }
    setAnimating(false);
    setOffset(0);
    requestAnimationFrame(() => {
      setSlideMs(durationMs);
      setAnimating(true);
      setOffset(-dir);
    });
    visualResetRef.current = window.setTimeout(() => {
      setAnimating(false);
      setOffset(0);
      visualResetRef.current = null;
    }, durationMs + 16);
  };

  const stopHold = React.useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Pointer-down: do ONE normal spin (identical to a click on any roller), then arm the
  // hold timer. If the button is released before HOLD_THRESHOLD, that's all that happens —
  // a plain tap. If it's still held, the accelerating auto-repeat begins.
  const startHold = (dir: 1 | -1) => {
    if (disabled) return;
    const onStep = dir === -1 ? onUp : onDown;
    spin(dir, onStep); // the SAME animated step every other roller does

    const fire = (durationMs: number) => {
      if (dir === -1) handlersRef.current.onUp();
      else handlersRef.current.onDown();
      visualSpin(dir, durationMs); // feedback roll (value already committed)
    };
    let delay = 200; // repeat cadence once auto-repeat has started
    const tick = () => {
      delay = Math.max(45, delay * 0.82); // accelerate, floor at ~22/sec
      fire(Math.max(40, delay * 0.9)); // roll a hair shorter than the cadence
      holdTimerRef.current = window.setTimeout(tick, delay);
    };
    // Auto-repeat only starts after the threshold — a quick tap never reaches here.
    holdTimerRef.current = window.setTimeout(tick, HOLD_THRESHOLD);
  };

  // Stop on unmount so a held button that gets removed doesn't keep firing.
  React.useEffect(() => {
    return () => {
      stopHold();
      if (visualResetRef.current !== null)
        window.clearTimeout(visualResetRef.current);
    };
  }, [stopHold]);

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

  // 7 rows: prev3..next3. The center is index 3. The extra outer rows (prev3/next3) are
  // BUFFER so that during a 1-row slide there's always a value covering the viewport
  // edge — otherwise the row sliding in is blank until the snap-back re-renders.
  const rows: string[] = [
    '', // prev3 buffer
    prev2Label ?? '',
    prevLabel ?? '',
    currentLabel, // index 3 = center
    nextLabel ?? '',
    next2Label ?? '',
    '', // next3 buffer
  ];
  const CENTER_ROW = 3;

  // The fixed LENS — the viewport is 4 ROWS tall (so the fade extends 2 rows above and
  // below the center). Three zones, anchored to the center-font edges:
  //   ABOVE: fades from 0 at the very top UP to 100% at the center-font top edge.
  //   CENTER: SOLID 100% across the full font height, edge to edge.
  //   BELOW: fades from 100% at the center-font bottom edge DOWN to 0 at the bottom.
  // The fade is EXPONENTIAL so it falls off fast right after the font and tails gently.
  const VIEWPORT_ROWS = 4;
  const viewportPx = ROW_H * VIEWPORT_ROWS;
  const centerPct = 50; // center sits at the geometric viewport middle
  const fontHalfPct = (anim.currentFontPx / 2 / viewportPx) * 100; // half-font as % of viewport
  const half = fontHalfPct + anim.bandHalfPct; // solid band half-height
  const bandTop = centerPct - half; // center-font top edge
  const bandBot = centerPct + half; // center-font bottom edge

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
            // Center the strip's CENTER_ROW in the 4-row viewport. That row's center is
            // at (CENTER_ROW + 0.5)·ROW_H within the strip; the viewport center is at
            // 2·ROW_H. top = 2·ROW_H − (CENTER_ROW + 0.5)·ROW_H.
            top: (VIEWPORT_ROWS / 2 - (CENTER_ROW + 0.5)) * ROW_H,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${offset * ROW_H}px)`,
            transition: animating
              ? `transform ${slideMs}ms ${anim.easing}`
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

      {/* UP / DOWN arrows. With holdRepeat (tempo), press-and-hold auto-repeats with
          acceleration; otherwise a click does one animated slide. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          type="button"
          {...(holdRepeat
            ? {
                onPointerDown: () => startHold(-1),
                onPointerUp: stopHold,
                onPointerLeave: stopHold,
                onPointerCancel: stopHold,
              }
            : { onClick: () => spin(-1, onUp) })}
          disabled={disabled}
          aria-label={`${ariaLabel} up`}
          className="touch-none select-none rounded-md p-0.5 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          {...(holdRepeat
            ? {
                onPointerDown: () => startHold(1),
                onPointerUp: stopHold,
                onPointerLeave: stopHold,
                onPointerCancel: stopHold,
              }
            : { onClick: () => spin(1, onDown) })}
          disabled={disabled}
          aria-label={`${ariaLabel} down`}
          className="touch-none select-none rounded-md p-0.5 text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
