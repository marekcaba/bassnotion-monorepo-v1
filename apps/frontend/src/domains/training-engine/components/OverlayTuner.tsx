'use client';

/**
 * OverlayTuner — a draggable dev-only panel to tune the gym overlay's scrim
 * (the radial-gradient opacity stops + backdrop blur/saturate) live, then read
 * the numbers off to paste into gym/page.tsx. NOT shipped to users: the gym only
 * mounts it in development (process.env.NODE_ENV !== 'production').
 *
 * It's fully controlled — the gym owns the OverlayBg state and renders the scrim
 * from it, so what you see IS what the panel says. Drag by the header.
 */

import { useCallback, useRef, useState } from 'react';

export interface OverlayBg {
  /** Radial-gradient opacity stops (0–1): center, mid (60%), edge. */
  centerOpacity: number;
  midOpacity: number;
  edgeOpacity: number;
  /** backdrop-filter blur in px. */
  blurPx: number;
  /** backdrop-filter saturate (0–2). */
  saturate: number;
}

export const DEFAULT_OVERLAY_BG: OverlayBg = {
  centerOpacity: 1,
  midOpacity: 0,
  edgeOpacity: 1,
  blurPx: 8.5,
  saturate: 0.9,
};

/** Build the scrim `background` string from the tuner state. */
export function overlayBackground(bg: OverlayBg): string {
  return `radial-gradient(80% 60% at 50% 42%, rgba(12,11,14,${bg.centerOpacity}) 0%, rgba(12,11,14,${bg.midOpacity}) 60%, rgba(8,7,10,${bg.edgeOpacity}) 100%)`;
}

/** Build the `backdrop-filter` string from the tuner state. */
export function overlayBackdropFilter(bg: OverlayBg): string {
  return `blur(${bg.blurPx}px) saturate(${bg.saturate})`;
}

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[11px]">
      <span className="w-16 shrink-0 font-mono uppercase tracking-[1px] text-[#8A8690]">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-[#E8A44A]"
      />
      <span className="w-12 shrink-0 text-right font-mono tabular-nums text-[#E8E4DD]">
        {value}
        {suffix}
      </span>
    </label>
  );
}

export function OverlayTuner({
  value,
  onChange,
}: {
  value: OverlayBg;
  onChange: (next: OverlayBg) => void;
}) {
  // Position (drag). Starts pinned bottom-left-ish so it doesn't hide the rep.
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = useCallback(
    (patch: Partial<OverlayBg>) => onChange({ ...value, ...patch }),
    [value, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture(e.pointerId);
      drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    },
    [pos],
  );
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.max(0, e.clientX - drag.current.dx),
      y: Math.max(0, e.clientY - drag.current.dy),
    });
  }, []);
  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  // The exact lines to paste into gym/page.tsx.
  const snippet = `background:\n  'radial-gradient(80% 60% at 50% 42%, rgba(12,11,14,${value.centerOpacity}) 0%, rgba(12,11,14,${value.midOpacity}) 60%, rgba(8,7,10,${value.edgeOpacity}) 100%)',\nbackdropFilter: 'blur(${value.blurPx}px) saturate(${value.saturate})',`;

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }, [snippet]);

  return (
    <div
      className="fixed z-[60] w-[300px] select-none rounded-xl border border-white/10 bg-[#1a181e]/95 shadow-2xl backdrop-blur"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex cursor-grab items-center justify-between rounded-t-xl border-b border-white/10 bg-white/[0.03] px-3 py-2 active:cursor-grabbing"
      >
        <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#8A8690]">
          ⠿ Overlay tuner
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
          dev only
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        <Row
          label="Center"
          value={value.centerOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ centerOpacity: v })}
        />
        <Row
          label="Mid 60%"
          value={value.midOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ midOpacity: v })}
        />
        <Row
          label="Edge"
          value={value.edgeOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ edgeOpacity: v })}
        />
        <div className="my-1 h-px bg-white/10" />
        <Row
          label="Blur"
          value={value.blurPx}
          min={0}
          max={24}
          step={0.5}
          suffix="px"
          onChange={(v) => set({ blurPx: v })}
        />
        <Row
          label="Saturate"
          value={value.saturate}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => set({ saturate: v })}
        />

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-md bg-[#E8A44A] px-3 py-1.5 text-[11px] font-semibold text-[#2a1c08] transition hover:brightness-105"
          >
            {copied ? 'Copied ✓' : 'Copy CSS'}
          </button>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_OVERLAY_BG)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] text-[#8A8690] transition hover:text-[#E8E4DD]"
          >
            Reset
          </button>
        </div>

        {/* The readable numbers, in case clipboard is blocked. */}
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 font-mono text-[9.5px] leading-relaxed text-[#9A938A]">
          {snippet}
        </pre>
      </div>
    </div>
  );
}
