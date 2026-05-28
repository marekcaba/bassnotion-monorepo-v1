'use client';

/**
 * GrooveCardWaveform — LAUNCH-02.5c.
 *
 * Renders the active bass stem as a min/max peaks waveform and sweeps a
 * vertical playhead across one loop iteration. The waveform represents the
 * full lengthBars; the playhead wraps at the loop boundary. When no buffer
 * is available (or before preload completes) we fall back to a stylised
 * pulse animation so the card still feels alive.
 *
 * The peaks are computed once per (buffer, canvas-width) pair and cached.
 * The playhead is the only thing that moves on the RAF loop, so the per-card
 * cost is one fillRect + one re-draw of the (cached) peaks per frame.
 * IntersectionObserver pauses the loop when the card scrolls offscreen.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

/** 1-indexed inclusive bar range. */
export interface WaveformLoopSelection {
  startBar: number;
  endBar: number;
}

interface GrooveCardWaveformProps {
  isPlaying: boolean;
  /** Bass stem audio data. When null the component falls back to the
   *  pulse animation. */
  bassBuffer?: AudioBuffer | null;
  /** AudioContext driving playback. Used to read `currentTime` for the
   *  playhead position. */
  audioContext?: AudioContext | null;
  /** Audio-context time when the current loop iteration began. null while
   *  stopped (the playhead is not drawn). */
  loopStartAudioTime?: number | null;
  /** Duration of one loop iteration in seconds. Used as the playhead
   *  modulus so it wraps at lengthBars. */
  loopDurationSeconds?: number;
  /** Number of musical bars one loop iteration spans. Used to render the
   *  thin bar-line ruler under the waveform (one tick + number per bar).
   *  Omit / set 0 to hide the ruler. */
  lengthBars?: number;
  /** Currently committed bar selection (looped). null = no selection. */
  loopSelection?: WaveformLoopSelection | null;
  /** Called when the user commits a new selection via drag (mouseup /
   *  touchend) or clears it (click outside / right-click). Pass null to
   *  clear. Pointer events are only wired when this prop is provided. */
  onLoopSelectionChange?: (next: WaveformLoopSelection | null) => void;
  /** Orange brand colour used for the bar lines. */
  color?: string;
}

const DEFAULT_BAR_COLOR = '#F97316'; // tailwind orange-500
const SELECTION_COLOR = '#3B82F6'; // tailwind blue-500 — loop-range bracket
const PULSE_BAR_COUNT = 32;

/**
 * Compute min/max peaks per pixel column. Returns a Float32Array of length
 * 2 * width where peaks[2*i] = min, peaks[2*i+1] = max for column i. Cached
 * by (buffer, width) so we recompute only when either changes.
 */
function computePeaks(buffer: AudioBuffer, width: number): Float32Array {
  const channelData = buffer.getChannelData(0); // mono mix from channel 0
  const samplesPerColumn = Math.max(1, Math.floor(channelData.length / width));
  const peaks = new Float32Array(width * 2);
  for (let col = 0; col < width; col++) {
    const start = col * samplesPerColumn;
    const end = Math.min(channelData.length, start + samplesPerColumn);
    let min = 1.0;
    let max = -1.0;
    for (let i = start; i < end; i++) {
      const v = channelData[i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[col * 2] = min;
    peaks[col * 2 + 1] = max;
  }
  return peaks;
}

// Module-level peaks cache. AudioBuffer identity is stable across renders
// (the preload hook holds a single reference per stem) so a WeakMap keyed
// on it is correct and lets browsers reclaim peaks when buffers are
// garbage-collected.
const peaksCache = new WeakMap<
  AudioBuffer,
  { width: number; peaks: Float32Array }
>();

function getOrComputePeaks(buffer: AudioBuffer, width: number): Float32Array {
  const cached = peaksCache.get(buffer);
  if (cached && cached.width === width) return cached.peaks;
  const peaks = computePeaks(buffer, width);
  peaksCache.set(buffer, { width, peaks });
  return peaks;
}

export function GrooveCardWaveform({
  isPlaying,
  bassBuffer,
  audioContext,
  loopStartAudioTime,
  loopDurationSeconds = 0,
  lengthBars = 0,
  loopSelection,
  onLoopSelectionChange,
  color = DEFAULT_BAR_COLOR,
}: GrooveCardWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  // In-progress selection while the user is dragging (committed via prop on
  // mouse/touch up). null when not dragging.
  const [dragSelection, setDragSelection] =
    useState<WaveformLoopSelection | null>(null);
  // Drag anchor bar (1-indexed) — null when no drag is in progress.
  const dragAnchorRef = useRef<number | null>(null);

  // Latest props in refs so the RAF loop reads fresh values without
  // tearing down on every prop change.
  const stateRef = useRef({
    isPlaying,
    bassBuffer: bassBuffer ?? null,
    audioContext: audioContext ?? null,
    loopStartAudioTime: loopStartAudioTime ?? null,
    loopDurationSeconds,
    lengthBars,
    loopSelection: loopSelection ?? null,
    dragSelection,
    color,
  });
  stateRef.current = {
    isPlaying,
    bassBuffer: bassBuffer ?? null,
    audioContext: audioContext ?? null,
    loopStartAudioTime: loopStartAudioTime ?? null,
    loopDurationSeconds,
    lengthBars,
    loopSelection: loopSelection ?? null,
    dragSelection,
    color,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleRef.current = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let lastDrawTime = 0;
    const targetFrameInterval = 1000 / 30; // ~30 FPS

    const drawBarLines = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      bars: number,
    ) => {
      // Thin vertical lines at every bar boundary, drawn underneath the
      // peaks so they show through quiet sections and get masked where the
      // waveform is loud (reads as DAW grid). Skip i=0 and i=bars (left and
      // right canvas edges respectively) — drawing those just overlaps the
      // rounded-rect border.
      if (bars <= 1) return;
      c.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let i = 1; i < bars; i++) {
        const x = Math.round((i / bars) * width);
        c.fillRect(x, 0, 1, height);
      }
    };

    const drawPeaks = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      buffer: AudioBuffer,
      fillColor: string,
    ) => {
      // Single 80%-opacity state — the playhead (full white) alone signals
      // "playing vs. stopped". Dimming the peaks when stopped made the
      // waveform feel like a disabled control; uniform 80% reads as a
      // calmer reference layer and lets the bar lines + playhead pop.
      const peaks = getOrComputePeaks(buffer, width);
      const midY = height / 2;
      c.fillStyle = fillColor;
      c.globalAlpha = 0.8;
      for (let col = 0; col < width; col++) {
        const min = peaks[col * 2] ?? 0;
        const max = peaks[col * 2 + 1] ?? 0;
        const yTop = midY - Math.max(0, max) * midY;
        const yBot = midY - Math.min(0, min) * midY;
        const h = Math.max(1, yBot - yTop);
        c.fillRect(col, yTop, 1, h);
      }
      c.globalAlpha = 1; // restore for subsequent paints in this frame
    };

    const drawPulseFallback = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      now: number,
      fillColor: string,
      isActive: boolean,
    ) => {
      const barWidth = width / (PULSE_BAR_COUNT * 2);
      const midY = height / 2;
      for (let i = 0; i < PULSE_BAR_COUNT; i++) {
        const t = now / 200;
        const phase = (i / PULSE_BAR_COUNT) * Math.PI * 4;
        const base = isActive
          ? Math.abs(Math.sin(t + phase)) * 0.7 + Math.random() * 0.2 + 0.1
          : 0.05;
        const barHeight = Math.max(2, base * midY);
        c.fillStyle = fillColor;
        c.globalAlpha = isActive ? 0.85 : 0.35;
        c.fillRect(
          i * barWidth * 2 + barWidth / 2,
          midY - barHeight,
          barWidth,
          barHeight * 2,
        );
      }
      c.globalAlpha = 1;
    };

    const drawPlayhead = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      x: number,
    ) => {
      // 2px white line with a soft glow so it reads on any peaks density.
      c.fillStyle = 'rgba(255, 255, 255, 0.12)';
      c.fillRect(x - 3, 0, 7, height); // halo
      c.fillStyle = 'rgba(255, 255, 255, 0.95)';
      c.fillRect(x, 0, 2, height);
    };

    /** 2-px rectangle frame around the selected bar range. When the
     *  selection touches the left or right canvas edge, the bracket's
     *  outer corners are rounded (8px radius matching the parent canvas's
     *  `rounded-lg`); inner corners stay square — that's how DAWs draw
     *  selection rectangles. `pending` (drag-in-progress) renders at lower
     *  alpha so the user can tell preview vs. committed apart. */
    const drawSelectionBracket = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      bars: number,
      startBar: number,
      endBar: number,
      pending: boolean,
      strokeColor: string,
    ) => {
      if (bars <= 0) return;
      const thickness = 2;
      // 8px to match Tailwind's rounded-lg on the canvas wrapper. Skip
      // rounding on the side that's NOT at the canvas edge.
      const cornerRadius = 8;
      const r = thickness / 2;
      const x = Math.round(((startBar - 1) / bars) * width);
      const right = Math.round((endBar / bars) * width);
      // Inset by half the stroke so the stroke sits INSIDE the bar-x range
      // (no overflow past the rounded canvas border).
      const left = x + r;
      const top = r;
      const rightInner = right - r;
      const bottom = height - r;
      const roundLeft = startBar === 1;
      const roundRight = endBar === bars;
      const rl = roundLeft ? cornerRadius : 0;
      const rr = roundRight ? cornerRadius : 0;

      c.strokeStyle = strokeColor;
      c.lineWidth = thickness;
      c.globalAlpha = pending ? 0.55 : 0.9;
      c.beginPath();
      // Start at top-left + radius, go clockwise.
      c.moveTo(left + rl, top);
      c.lineTo(rightInner - rr, top);
      if (rr > 0) c.arcTo(rightInner, top, rightInner, top + rr, rr);
      c.lineTo(rightInner, bottom - rr);
      if (rr > 0) c.arcTo(rightInner, bottom, rightInner - rr, bottom, rr);
      c.lineTo(left + rl, bottom);
      if (rl > 0) c.arcTo(left, bottom, left, bottom - rl, rl);
      c.lineTo(left, top + rl);
      if (rl > 0) c.arcTo(left, top, left + rl, top, rl);
      c.closePath();
      c.stroke();
      c.globalAlpha = 1;
    };

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (!visibleRef.current) return;
      if (now - lastDrawTime < targetFrameInterval) return;
      lastDrawTime = now;

      const s = stateRef.current;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (s.bassBuffer) {
        // Bar grid first — peaks paint on top so the lines show only in
        // the quieter portions of the waveform.
        drawBarLines(ctx, width, height, s.lengthBars);
        drawPeaks(ctx, width, height, s.bassBuffer, s.color);

        // Selection bracket: drag-in-progress (pending=true) is drawn at
        // 55% alpha so the user sees their drag is being tracked; once
        // committed (loopSelection from props) it solidifies to 90%.
        // Always drawn in blue so the loop range is visually distinct from
        // the orange waveform peaks and playhead.
        const active = s.dragSelection ?? s.loopSelection;
        if (active && s.lengthBars > 0) {
          drawSelectionBracket(
            ctx,
            width,
            height,
            s.lengthBars,
            active.startBar,
            active.endBar,
            s.dragSelection !== null,
            SELECTION_COLOR,
          );
        }

        // Playhead. Two modes:
        //   - No selection: sweep across the FULL waveform width, wrapping
        //     at the full loop duration.
        //   - Selection active: confine the sweep to the selected bar range,
        //     wrapping at the selection's duration (matches what the audio
        //     actually does via source.loopStart/loopEnd). Without this the
        //     visual playhead keeps marching past the selected bars while
        //     the audio loops bars 1-4 — misleadingly suggests "loop ignored".
        if (
          s.isPlaying &&
          s.audioContext &&
          s.loopStartAudioTime !== null &&
          s.loopDurationSeconds > 0 &&
          s.lengthBars > 0
        ) {
          const elapsed = s.audioContext.currentTime - s.loopStartAudioTime;
          if (elapsed >= 0) {
            const sel = s.loopSelection;
            if (sel) {
              // Map the bar selection onto the canvas: x range and the
              // duration the playhead wraps in. Both bracket and playhead
              // share the same bar-grid math, so they stay aligned.
              const barW = width / s.lengthBars;
              const xStart = Math.round((sel.startBar - 1) * barW);
              const xEnd = Math.round(sel.endBar * barW);
              const selectionWidth = Math.max(1, xEnd - xStart);
              const selectionSeconds =
                ((sel.endBar - sel.startBar + 1) / s.lengthBars) *
                s.loopDurationSeconds;
              if (selectionSeconds > 0) {
                const phase =
                  ((elapsed % selectionSeconds) + selectionSeconds) %
                  selectionSeconds;
                const x = xStart + (phase / selectionSeconds) * selectionWidth;
                drawPlayhead(ctx, width, height, x);
              }
            } else {
              const phase =
                ((elapsed % s.loopDurationSeconds) + s.loopDurationSeconds) %
                s.loopDurationSeconds;
              const x = (phase / s.loopDurationSeconds) * width;
              drawPlayhead(ctx, width, height, x);
            }
          }
        }
      } else {
        drawPulseFallback(ctx, width, height, now, s.color, s.isPlaying);
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []); // RAF loop is mounted once; reads live state via stateRef.

  // Pointer event handlers for drag-to-select. Pointer Events unify
  // mouse / touch / pen — same handler works for desktop + mobile. Only
  // wired when onLoopSelectionChange + lengthBars are both present.
  const selectionEnabled = !!onLoopSelectionChange && lengthBars > 0;

  /** Convert clientX on the canvas to a 1-indexed bar number (clamped to
   *  [1..lengthBars]). Returns null when bar math is impossible. */
  const barFromClientX = useCallback(
    (clientX: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas || lengthBars <= 0) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      // Math.floor + 1 maps [0..1/N) → bar 1, [1/N..2/N) → bar 2, etc.
      const bar = Math.floor(ratio * lengthBars) + 1;
      return Math.max(1, Math.min(lengthBars, bar));
    },
    [lengthBars],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!selectionEnabled) return;
      // Right click clears any current selection.
      if (e.button === 2) {
        e.preventDefault();
        onLoopSelectionChange?.(null);
        return;
      }
      // Only the primary button starts a drag.
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      const bar = barFromClientX(e.clientX);
      if (bar == null) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      // Record the anchor but do NOT set dragSelection yet. The bracket
      // continues to render the existing committed loopSelection. Only when
      // the pointer actually moves to a DIFFERENT bar do we promote the
      // gesture from "click" to "drag" and show a preview rectangle.
      // Without this lazy promotion, a single click on an already-looped
      // region would flash a one-bar preview at the click point before
      // pointerup's toggle-off fires — the "extra middle step" the user
      // reported.
      dragAnchorRef.current = bar;
    },
    [selectionEnabled, barFromClientX, onLoopSelectionChange],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (dragAnchorRef.current == null) return;
      const bar = barFromClientX(e.clientX);
      if (bar == null) return;
      const anchor = dragAnchorRef.current;
      // First-move promotion: if the pointer moved to a different bar we
      // commit to a drag gesture and start rendering the preview. If we're
      // still on the anchor bar (just sub-pixel jitter), keep dragSelection
      // null so the bracket stays on the existing committed loopSelection.
      if (bar === anchor && dragSelection == null) return;
      const startBar = Math.min(anchor, bar);
      const endBar = Math.max(anchor, bar);
      setDragSelection((prev) =>
        prev && prev.startBar === startBar && prev.endBar === endBar
          ? prev
          : { startBar, endBar },
      );
    },
    [barFromClientX, dragSelection],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const anchor = dragAnchorRef.current;
      if (anchor == null) return;
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        // pointer already released — ignore
      }
      const finalSelection = dragSelection;
      dragAnchorRef.current = null;
      setDragSelection(null);

      if (finalSelection == null) {
        // Click without drag — dragSelection was never set because the
        // pointer never left the anchor bar. Decide based on the anchor:
        //   - inside the existing committed loop → toggle off
        //   - outside it (or no committed loop) → commit single-bar select
        const isInsideExistingRange =
          loopSelection != null &&
          anchor >= loopSelection.startBar &&
          anchor <= loopSelection.endBar;
        if (isInsideExistingRange) {
          onLoopSelectionChange?.(null);
        } else {
          onLoopSelectionChange?.({ startBar: anchor, endBar: anchor });
        }
        return;
      }

      // Drag committed a range — apply it.
      onLoopSelectionChange?.(finalSelection);
    },
    [dragSelection, loopSelection, onLoopSelectionChange],
  );

  const handlePointerCancel = useCallback(() => {
    dragAnchorRef.current = null;
    setDragSelection(null);
  }, []);

  // Ruler beneath the canvas. Aligned column-for-column with the in-canvas
  // bar lines (which sit at `i/lengthBars` for i = 1..lengthBars-1, skipping
  // the canvas edges), so each number appears directly under the bar line
  // that marks the START of that bar. Numbering starts at "2" because bar 1
  // begins at the left edge of the canvas where no bar line is drawn.
  const showRuler = lengthBars > 1;

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={canvasRef}
        width={640}
        height={128}
        className={`w-full h-32 rounded-lg bg-black/30 ${
          selectionEnabled ? 'cursor-crosshair touch-none' : ''
        }`}
        aria-hidden={selectionEnabled ? undefined : 'true'}
        aria-label={
          selectionEnabled
            ? 'Drag to loop a bar range. Right-click to clear.'
            : undefined
        }
        onPointerDown={selectionEnabled ? handlePointerDown : undefined}
        onPointerMove={selectionEnabled ? handlePointerMove : undefined}
        onPointerUp={selectionEnabled ? handlePointerUp : undefined}
        onPointerCancel={selectionEnabled ? handlePointerCancel : undefined}
        onContextMenu={selectionEnabled ? (e) => e.preventDefault() : undefined}
      />
      {showRuler && (
        <div className="relative h-3 select-none" aria-hidden="true">
          {Array.from({ length: lengthBars - 1 }, (_, i) => {
            const barNumber = i + 2; // bar 2..lengthBars
            const leftPct = ((i + 1) / lengthBars) * 100;
            return (
              <span
                key={barNumber}
                className="absolute top-0 -translate-x-1/2 text-[9px] leading-none text-white/40 tabular-nums"
                style={{ left: `${leftPct}%` }}
              >
                {barNumber}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
