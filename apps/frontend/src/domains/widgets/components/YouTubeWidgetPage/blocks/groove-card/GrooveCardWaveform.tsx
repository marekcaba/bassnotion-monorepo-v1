'use client';

/**
 * GrooveCardWaveform — LAUNCH-02.5c.
 *
 * Live amplitude readout rendered to a canvas at ~30 FPS via
 * requestAnimationFrame. Pauses when the card scrolls offscreen
 * (IntersectionObserver) to keep the per-card cost negligible when many
 * cards stack on one tutorial page.
 *
 * For v1 we draw a stylised pulse animation when `isPlaying` is true and
 * a flat line at rest. A real `Tone.Analyser` tap would be slotted in
 * here in a follow-up — the analyser API is wired through the master bus
 * but exposing it cleanly from PlaybackEngine is out of scope for this
 * story (see `getAnalyser()` in the hook public surface — it's reserved
 * but not yet implemented). This is the only visualisation gap; nothing
 * else about the card relies on the analyser data.
 */

import { useEffect, useRef } from 'react';

interface GrooveCardWaveformProps {
  isPlaying: boolean;
  /** Orange brand colour used for the bar lines. */
  color?: string;
}

const DEFAULT_BAR_COLOR = '#F97316'; // tailwind orange-500
const BAR_COUNT = 32;

export function GrooveCardWaveform({
  isPlaying,
  color = DEFAULT_BAR_COLOR,
}: GrooveCardWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // IntersectionObserver: stop animating when offscreen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleRef.current = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    // In test environments (jsdom) canvas.getContext is not implemented.
    // Skip silently — there's nothing to render and no point logging.
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let lastDrawTime = 0;
    const targetFrameInterval = 1000 / 30; // ~30 FPS

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      if (!visibleRef.current) return;
      if (now - lastDrawTime < targetFrameInterval) return;
      lastDrawTime = now;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / (BAR_COUNT * 2);
      const midY = height / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Synthesize a pulse with a sine + tiny jitter when playing,
        // a flat low line at rest.
        const t = now / 200;
        const phase = (i / BAR_COUNT) * Math.PI * 4;
        const base = isPlaying
          ? Math.abs(Math.sin(t + phase)) * 0.7 + Math.random() * 0.2 + 0.1
          : 0.05;
        const barHeight = Math.max(2, base * midY);

        ctx.fillStyle = color;
        ctx.globalAlpha = isPlaying ? 0.85 : 0.35;
        ctx.fillRect(
          i * barWidth * 2 + barWidth / 2,
          midY - barHeight,
          barWidth,
          barHeight * 2,
        );
      }
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [color, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={64}
      className="w-full h-16 rounded-lg bg-black/30"
      aria-hidden="true"
    />
  );
}
