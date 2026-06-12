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

/** Fractional-bar span [startFrac, endFrac] of the active fill, for the blue
 *  region highlight. 0 = loop start, lengthBars = loop end. */
export interface WaveformFillRegion {
  startFrac: number;
  endFrac: number;
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
   *  modulus so it wraps at lengthBars. FALLBACK clock — used only when
   *  getAudioPhase() returns null (audio not yet streaming). */
  loopDurationSeconds?: number;
  /** Time-stretch (LAUNCH-06): returns the REAL audio playhead phase [0,1)
   *  from the bass stem's worklet read-head, or null when unavailable. When
   *  present + non-null this is the PRIMARY playhead clock so the playhead
   *  tracks the actual sound (and a pending tempo change moves the playhead
   *  only when the audio actually changes at the seam, never before). */
  getAudioPhase?: () => number | null;
  /** Number of musical bars one loop iteration spans. Used to render the
   *  thin bar-line ruler under the waveform (one tick + number per bar).
   *  Omit / set 0 to hide the ruler. */
  lengthBars?: number;
  /** Currently committed bar selection (looped). null = no selection. */
  loopSelection?: WaveformLoopSelection | null;
  /** The active fill's region (fractional bars), drawn as a blue gradient band.
   *  null = no fill active → no highlight. */
  fillRegion?: WaveformFillRegion | null;
  /** Called when the user commits a new selection via drag (mouseup /
   *  touchend) or clears it (click outside / right-click). Pass null to
   *  clear. Pointer events are only wired when this prop is provided. */
  onLoopSelectionChange?: (next: WaveformLoopSelection | null) => void;
  /** Orange brand colour used for the bar lines. */
  color?: string;
  /** Count-in beat (1-based, 1..N) currently showing in the play button, or null
   *  when not counting in. The parked start playhead PULSES on each new beat in
   *  lockstep with the play-button numbers, then begins sweeping when the groove
   *  starts. */
  countdownBeat?: number | null;
}

// Default waveform bar colour — the warm near-black grey the waitlist demo
// card established (LAUNCH-02.5d). Both surfaces (waitlist + in-app player)
// now share this default so the Groove Card looks identical everywhere; the
// `color` prop remains an explicit per-card override.
const DEFAULT_BAR_COLOR = '#1f252e';
const SELECTION_COLOR = '#3B82F6'; // tailwind blue-500 — loop-range bracket
const FILL_REGION_COLOR = '59, 130, 246'; // blue-500 RGB — fill-region band fill
const PULSE_BAR_COUNT = 32;
// Beat-1 wrap guard window (s). getStemPlayheadPhase() subtracts ~185ms of visual-
// latency compensation, which pulls the phase NEGATIVE at the loop origin and wraps it
// to ≈1.0 (far right) for roughly that long at the very start of bar 1 — the "flash at
// the end then jump to the start" artifact. For the first GUARD window of bar 1, if the
// reported phase has wrapped near the end, we park the playhead at the start instead.
// ~0.25s comfortably covers the processing+output latency at any tempo.
const BEAT1_GUARD_SEC = 0.25;

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
  getAudioPhase,
  lengthBars = 0,
  loopSelection,
  fillRegion,
  onLoopSelectionChange,
  color = DEFAULT_BAR_COLOR,
  countdownBeat = null,
}: GrooveCardWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  // Count-in pulse: timestamp (perf.now ms) of the last beat change, so the parked
  // playhead can flash on each new countdown number. Updated in the RAF loop when
  // the beat value changes (reads it from stateRef so we don't restart the loop).
  const pulseStartRef = useRef<number>(0);
  const lastBeatRef = useRef<number | null>(null);

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
    getAudioPhase: getAudioPhase ?? null,
    lengthBars,
    loopSelection: loopSelection ?? null,
    fillRegion: fillRegion ?? null,
    dragSelection,
    color,
    countdownBeat,
  });
  stateRef.current = {
    isPlaying,
    bassBuffer: bassBuffer ?? null,
    audioContext: audioContext ?? null,
    loopStartAudioTime: loopStartAudioTime ?? null,
    loopDurationSeconds,
    getAudioPhase: getAudioPhase ?? null,
    lengthBars,
    loopSelection: loopSelection ?? null,
    fillRegion: fillRegion ?? null,
    dragSelection,
    color,
    countdownBeat,
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
      c.fillStyle = 'rgba(255, 255, 255, 0.10)';
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
      opacity = 1, // 1 = normal full-brightness playhead; <1 fades the whole playhead
      // (used during the count-in: the parked playhead snaps to 1 on each beat then
      //  fades down toward 0, creating an opacity pulse in sync with the numbers).
    ) => {
      // 2px white line with a soft glow so it reads on any peaks density. Both the line
      // and its halo scale with `opacity` so the whole playhead pulses cleanly.
      c.fillStyle = `rgba(255, 255, 255, ${0.12 * opacity})`;
      c.fillRect(x - 3, 0, 7, height); // halo
      c.fillStyle = `rgba(255, 255, 255, ${0.95 * opacity})`;
      c.fillRect(x, 0, 2, height);
    };

    /** Blue gradient band marking where the active fill happens. The fill is
     *  solid-ish in the middle and fades to transparent at the left/right edges
     *  (a horizontal gradient) so it reads as a soft "this zone" highlight, not
     *  a hard-walled block. `startFrac`/`endFrac` are fractional bar positions
     *  (0..bars). Drawn UNDER the peaks so the waveform stays crisp on top. */
    const drawFillRegion = (
      c: CanvasRenderingContext2D,
      width: number,
      height: number,
      bars: number,
      startFrac: number,
      endFrac: number,
    ) => {
      if (bars <= 0 || !(endFrac > startFrac)) return;
      const xs = (startFrac / bars) * width;
      const xe = (endFrac / bars) * width;
      const bandW = xe - xs;
      if (bandW <= 0) return;
      // Edge fade: ~0.4 bar each side, but never more than 40% of the band so a
      // narrow region still shows a solid core. Expressed as a 0..1 stop.
      const fadeBars = 0.4;
      const fadePx = Math.min((fadeBars / bars) * width, bandW * 0.4);
      const fadeStop = bandW > 0 ? fadePx / bandW : 0;
      const core = 0.26; // peak alpha at the band core
      const grad = c.createLinearGradient(xs, 0, xe, 0);
      grad.addColorStop(0, `rgba(${FILL_REGION_COLOR}, 0)`);
      grad.addColorStop(fadeStop, `rgba(${FILL_REGION_COLOR}, ${core})`);
      grad.addColorStop(1 - fadeStop, `rgba(${FILL_REGION_COLOR}, ${core})`);
      grad.addColorStop(1, `rgba(${FILL_REGION_COLOR}, 0)`);
      c.fillStyle = grad;
      c.fillRect(xs, 0, bandW, height);
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

      // Reset the count-in pulse tracker once the count-in is over (so the next play
      // re-pulses from beat 1 instead of inheriting the previous run's last beat).
      if (s.countdownBeat == null) lastBeatRef.current = null;

      if (s.bassBuffer) {
        // Bar grid first — peaks paint on top so the lines show only in
        // the quieter portions of the waveform.
        drawBarLines(ctx, width, height, s.lengthBars);
        // Fill-region band UNDER the peaks (when a fill is active) so the
        // waveform stays crisp on top of the blue tint.
        if (s.fillRegion && s.lengthBars > 0) {
          drawFillRegion(
            ctx,
            width,
            height,
            s.lengthBars,
            s.fillRegion.startFrac,
            s.fillRegion.endFrac,
          );
        }
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
          // PRIMARY clock (LAUNCH-06): the REAL audio phase [0,1) from the
          // bass worklet's read-head. Using this keeps the playhead glued to
          // the SOUND — a pending tempo change (deferred to the loop seam)
          // moves the playhead only when the audio actually changes, never
          // before. FALLBACK to the currentBpm-derived clock when the audio
          // isn't streaming yet (null) — e.g. the count-in before the first
          // stem sample, or if the worklet hasn't resolved.
          const elapsed = s.audioContext.currentTime - s.loopStartAudioTime;
          // Count-in gate: loopStartAudioTime is anchored at the END of the
          // 4-beat count-in (anchor + countdownSeconds), so `elapsed < 0` means
          // we're still counting in — bar 1 hasn't begun. Don't draw the
          // playhead yet (the worklet read-head may already sit near the loop
          // end, which would wrongly flash the playhead at the LAST bar during
          // the count-in). The playhead appears at bar 1 the moment elapsed≥0.
          const audioPhase =
            elapsed >= 0 && s.getAudioPhase ? s.getAudioPhase() : null;
          const sel = s.loopSelection;
          // Where bar 1 (or the selection's first bar) sits on the canvas — the
          // playhead's "home". Used to PARK the playhead here during the count-in and
          // to guard the beat-1 latency-wrap flash (see below).
          const barW = width / s.lengthBars;
          const homeX = sel ? Math.round((sel.startBar - 1) * barW) : 0;

          if (elapsed < 0) {
            // COUNT-IN: park the playhead at the start, visible and waiting, so it
            // begins sweeping from bar 1 the moment the groove starts (instead of
            // popping in mid-flight). It PULSES on each new countdown beat in lockstep
            // with the play-button numbers (s.countdownBeat).
            const beat = s.countdownBeat;
            if (beat != null && beat !== lastBeatRef.current) {
              lastBeatRef.current = beat;
              pulseStartRef.current = now; // `now` is performance.now() ms (RAF arg)
            }
            // OPACITY PULSE: on each new beat the playhead snaps to full brightness and
            // fades down over ~380ms toward a dim floor, so it throbs in time with the
            // countdown numbers. Stays faintly visible between beats (parked, waiting).
            const since = now - pulseStartRef.current;
            const PULSE_MS = 380;
            const FLOOR = 0.18;
            const t = beat != null ? Math.min(1, since / PULSE_MS) : 1;
            const opacity =
              beat != null ? FLOOR + (1 - FLOOR) * (1 - t) : FLOOR;
            drawPlayhead(ctx, width, height, homeX, opacity);
          } else if (sel) {
            // Map the bar selection onto the canvas: x range and the duration
            // the playhead wraps in. Both bracket and playhead share the same
            // bar-grid math, so they stay aligned.
            const xStart = homeX;
            const xEnd = Math.round(sel.endBar * barW);
            const selectionWidth = Math.max(1, xEnd - xStart);
            const selectionSeconds =
              ((sel.endBar - sel.startBar + 1) / s.lengthBars) *
              s.loopDurationSeconds;
            // The worklet loops the slice internally, so audioPhase already
            // wraps within the selection — map it directly. Fall back to the
            // elapsed-based wrap when audioPhase is null.
            if (audioPhase != null) {
              // BEAT-1 WRAP GUARD: the visual-latency compensation pulls the
              // read-head phase NEGATIVE at the loop origin, which wraps to ≈1.0
              // (far right) for the first ~latency window of bar 1 — the flash the
              // user reported. While we're at the very start (elapsed within the
              // visual-latency window) and the phase has wrapped near the end,
              // park at home instead.
              const x =
                elapsed < BEAT1_GUARD_SEC && audioPhase > 0.5
                  ? xStart
                  : xStart + audioPhase * selectionWidth;
              drawPlayhead(ctx, width, height, x);
            } else if (elapsed >= 0 && selectionSeconds > 0) {
              const phase =
                ((elapsed % selectionSeconds) + selectionSeconds) %
                selectionSeconds;
              const x = xStart + (phase / selectionSeconds) * selectionWidth;
              drawPlayhead(ctx, width, height, x);
            }
          } else if (audioPhase != null) {
            // Full-loop, real audio clock. Same beat-1 wrap guard as above.
            const x =
              elapsed < BEAT1_GUARD_SEC && audioPhase > 0.5
                ? 0
                : audioPhase * width;
            drawPlayhead(ctx, width, height, x);
          } else if (elapsed >= 0) {
            // Full-loop, fallback clock.
            const phase =
              ((elapsed % s.loopDurationSeconds) + s.loopDurationSeconds) %
              s.loopDurationSeconds;
            const x = (phase / s.loopDurationSeconds) * width;
            drawPlayhead(ctx, width, height, x);
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
