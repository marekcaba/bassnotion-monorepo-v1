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

import { useEffect, useRef } from 'react';

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
  /** Orange brand colour used for the bar lines. */
  color?: string;
}

const DEFAULT_BAR_COLOR = '#F97316'; // tailwind orange-500
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
  color = DEFAULT_BAR_COLOR,
}: GrooveCardWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  // Latest props in refs so the RAF loop reads fresh values without
  // tearing down on every prop change.
  const stateRef = useRef({
    isPlaying,
    bassBuffer: bassBuffer ?? null,
    audioContext: audioContext ?? null,
    loopStartAudioTime: loopStartAudioTime ?? null,
    loopDurationSeconds,
    lengthBars,
    color,
  });
  stateRef.current = {
    isPlaying,
    bassBuffer: bassBuffer ?? null,
    audioContext: audioContext ?? null,
    loopStartAudioTime: loopStartAudioTime ?? null,
    loopDurationSeconds,
    lengthBars,
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

        // Playhead: only when actively playing and we know when the loop
        // started. Wraps via modulo at the loop boundary.
        if (
          s.isPlaying &&
          s.audioContext &&
          s.loopStartAudioTime !== null &&
          s.loopDurationSeconds > 0
        ) {
          const elapsed = s.audioContext.currentTime - s.loopStartAudioTime;
          if (elapsed >= 0) {
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
        className="w-full h-32 rounded-lg bg-black/30"
        aria-hidden="true"
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
