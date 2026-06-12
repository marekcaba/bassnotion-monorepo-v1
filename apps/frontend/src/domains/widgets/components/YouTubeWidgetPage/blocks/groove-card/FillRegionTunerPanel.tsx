'use client';

/**
 * FillRegionTunerPanel — a DEV-ONLY floating, draggable panel for dialling in
 * the fill-region waveform highlight (color / opacity / edge fade / under-or-
 * over the peaks) by eye, in real time, on the actual card.
 *
 * It writes the chosen values to `window.__fillRegionStyle`, which
 * GrooveCardWaveform's `readFillRegionStyle()` merges over the baked defaults on
 * the next RAF frame — so the live waveform updates as you drag. When the look
 * is right, hit "Copy" and paste the values into `FILL_REGION_DEFAULT_STYLE` in
 * GrooveCardWaveform.tsx, then this panel (and its mount) can be removed.
 *
 * NOT a shipping user control — mount it only behind a dev gate.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FILL_REGION_DEFAULT_STYLE,
  type FillRegionStyle,
} from './GrooveCardWaveform';

/** "#rrggbb" → "r, g, b" for the rgba() the waveform builds. */
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return FILL_REGION_DEFAULT_STYLE.rgb;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** "r, g, b" → "#rrggbb" for the <input type=color>. */
function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map((s) => parseInt(s.trim(), 10) || 0);
  const h = (v: number) => (v & 255).toString(16).padStart(2, '0');
  return `#${h(parts[0] ?? 0)}${h(parts[1] ?? 0)}${h(parts[2] ?? 0)}`;
}

export function FillRegionTunerPanel() {
  const [style, setStyle] = useState<FillRegionStyle>({
    ...FILL_REGION_DEFAULT_STYLE,
  });
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const [copied, setCopied] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Push the live style to the global the waveform reads each frame.
  useEffect(() => {
    (
      window as unknown as { __fillRegionStyle?: FillRegionStyle }
    ).__fillRegionStyle = style;
    return () => {
      delete (window as unknown as { __fillRegionStyle?: FillRegionStyle })
        .__fillRegionStyle;
    };
  }, [style]);

  const patch = useCallback(
    (p: Partial<FillRegionStyle>) => setStyle((s) => ({ ...s, ...p })),
    [],
  );

  // ── dragging the panel by its header ──────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    },
    [pos],
  );
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: e.clientX - dragRef.current.dx,
      y: e.clientY - dragRef.current.dy,
    });
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const snippet = `const FILL_REGION_DEFAULT_STYLE: FillRegionStyle = {
  rgb: '${style.rgb}',
  coreAlpha: ${style.coreAlpha},
  fadeBars: ${style.fadeBars},
  drawOverPeaks: ${style.drawOverPeaks},
};`;

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [snippet]);

  return (
    <div
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[9999] w-64 select-none rounded-xl border border-white/15 bg-slate-900/95 text-white shadow-2xl backdrop-blur"
    >
      {/* Draggable header */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex cursor-grab items-center justify-between rounded-t-xl border-b border-white/10 bg-white/5 px-3 py-2 active:cursor-grabbing"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
          Fill highlight tuner
        </span>
        <span className="text-[9px] text-white/30">drag</span>
      </div>

      <div className="space-y-3 px-3 py-3">
        {/* Color */}
        <label className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/60">Color</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/40">
              {rgbToHex(style.rgb)}
            </span>
            <input
              type="color"
              value={rgbToHex(style.rgb)}
              onChange={(e) => patch({ rgb: hexToRgb(e.target.value) })}
              className="h-6 w-8 cursor-pointer rounded border border-white/15 bg-transparent"
            />
          </span>
        </label>

        {/* Core opacity */}
        <label className="block">
          <span className="flex justify-between text-[11px] text-white/60">
            <span>Opacity</span>
            <span className="font-mono text-white/40">
              {style.coreAlpha.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={style.coreAlpha}
            onChange={(e) => patch({ coreAlpha: +e.target.value })}
            className="mt-1 w-full accent-blue-500"
          />
        </label>

        {/* Edge fade width (bars) */}
        <label className="block">
          <span className="flex justify-between text-[11px] text-white/60">
            <span>Edge fade (bars)</span>
            <span className="font-mono text-white/40">
              {style.fadeBars.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={style.fadeBars}
            onChange={(e) => patch({ fadeBars: +e.target.value })}
            className="mt-1 w-full accent-blue-500"
          />
        </label>

        {/* Under / over peaks */}
        <label className="flex items-center justify-between">
          <span className="text-[11px] text-white/60">Draw over peaks</span>
          <input
            type="checkbox"
            checked={style.drawOverPeaks}
            onChange={(e) => patch({ drawOverPeaks: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-blue-500"
          />
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            {copied ? 'Copied ✓' : 'Copy values'}
          </button>
          <button
            type="button"
            onClick={() => setStyle({ ...FILL_REGION_DEFAULT_STYLE })}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
          >
            Reset
          </button>
        </div>

        <pre className="overflow-x-auto rounded bg-black/40 px-2 py-1 text-[9px] leading-tight text-white/40">
          {snippet}
        </pre>
      </div>
    </div>
  );
}
