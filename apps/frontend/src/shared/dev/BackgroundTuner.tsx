'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Localhost-only floating panel for vibing with the waitlist page's
 * background. Renders nothing on production builds (gated by
 * NEXT_PUBLIC_VERCEL_ENV in the parent). State lives in the parent so
 * the page actually reflects edits live; this component is pure UI.
 *
 * "Copy CSS" dumps a paste-ready snippet to clipboard so you can drop
 * the chosen values back into WaitlistClient.tsx when you're happy.
 */

export interface RadialLayer {
  color: string; // hex like #F26B1D
  opacity: number; // 0–1
  width: number; // px
  height: number; // px
  x: number; // % across viewport
  y: number; // % down viewport
  fadeEnd: number; // % of the radial where it fades to transparent
}

export interface BackgroundConfig {
  baseColor: string;
  radial1: RadialLayer;
  radial2: RadialLayer;
  noiseOpacity: number; // 0–0.2
}

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  baseColor: '#0A0908',
  radial1: {
    color: '#DEDEDE',
    opacity: 0.02,
    width: 600,
    height: 440,
    x: 29,
    y: 9,
    fadeEnd: 93,
  },
  radial2: {
    color: '#A6A6A6',
    opacity: 0.05,
    width: 720,
    height: 640,
    x: 91,
    y: 95,
    fadeEnd: 55,
  },
  noiseOpacity: 0.045,
};

/** Turns a {color, opacity, w, h, x, y, fadeEnd} block into a CSS radial-gradient(...). */
export function radialToCss(r: RadialLayer): string {
  const rgba = hexToRgba(r.color, r.opacity);
  return `radial-gradient(${r.width}px ${r.height}px at ${r.x}% ${r.y}%, ${rgba}, transparent ${r.fadeEnd}%)`;
}

export function backgroundToCss(c: BackgroundConfig): string {
  return `${radialToCss(c.radial1)}, ${radialToCss(c.radial2)}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  config: BackgroundConfig;
  onChange: (next: BackgroundConfig) => void;
}

export function BackgroundTuner({ config, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  // Portal-mount only after the client has hydrated. `document` is not
  // available during SSR; rendering before mount would throw.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Draggable position. Starts in the top-right corner; once dragged, the
  // panel stays wherever you dropped it (still `position: fixed` so it
  // ignores page scroll). Persisted to localStorage so the position
  // survives page refreshes — useful when you're tweaking + refreshing
  // to see the page in a clean state.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bn_bg_tuner_pos');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPos(parsed);
        }
      }
    } catch {
      // localStorage blocked / parse failed — fine, keep default top-right.
    }
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    // Only drag from the header bar — not from buttons inside it.
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement)
      .closest('[data-bg-tuner]')!
      .getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: rect.left,
      baseY: rect.top,
    };

    const handleMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = drag.baseX + (ev.clientX - drag.startX);
      const y = drag.baseY + (ev.clientY - drag.startY);
      // Clamp inside viewport with a small breathing margin.
      const clampedX = Math.max(0, Math.min(window.innerWidth - 100, x));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 40, y));
      setPos({ x: clampedX, y: clampedY });
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      dragRef.current = null;
      try {
        if (pos) localStorage.setItem('bn_bg_tuner_pos', JSON.stringify(pos));
      } catch {
        // Storage failure is non-fatal.
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Persist whenever pos changes (covers both drag-end and any future
  // programmatic move). Cheap — just one localStorage write per stop.
  useEffect(() => {
    if (!pos) return;
    try {
      localStorage.setItem('bn_bg_tuner_pos', JSON.stringify(pos));
    } catch {
      // ignore
    }
  }, [pos]);

  const positionStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto' }
    : { right: 16, top: 16 };

  const update = <K extends keyof BackgroundConfig>(
    key: K,
    value: BackgroundConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  const updateRadial = (
    which: 'radial1' | 'radial2',
    patch: Partial<RadialLayer>,
  ) => {
    onChange({ ...config, [which]: { ...config[which], ...patch } });
  };

  const handleCopy = async () => {
    const snippet = buildSnippet(config);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail on http (non-localhost) — fall back to alert
      // so you can still grab the snippet manually.
      window.prompt('Copy this CSS:', snippet);
    }
  };

  const handleReset = () => onChange(DEFAULT_BACKGROUND);

  // Do not render until mounted on the client — `document.body` only
  // exists after hydration. Returning null on the server keeps SSR happy.
  if (!mounted) return null;

  if (!open) {
    return createPortal(
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={positionStyle}
        className="fixed z-[9999] bg-black/85 text-white border border-white/30 rounded-lg px-3 py-1.5 text-xs font-mono hover:bg-black"
        title="Open background tuner"
      >
        🎨 bg
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div
      data-bg-tuner
      style={positionStyle}
      className="fixed z-[9999] w-[320px] max-h-[90vh] overflow-y-auto bg-black/90 text-white text-xs font-mono rounded-lg border border-white/20 shadow-2xl backdrop-blur"
    >
      <div
        onMouseDown={onDragStart}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-move select-none"
        title="Drag to move"
      >
        <span className="font-bold tracking-wider">🎨 BG TUNER (dev)</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-white/60 hover:text-white"
            title="Reset to defaults"
          >
            reset
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-white/60 hover:text-white px-1"
            title="Collapse"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Base color */}
        <Section title="Base">
          <ColorRow
            label="base color"
            value={config.baseColor}
            onChange={(v) => update('baseColor', v)}
          />
        </Section>

        {/* Radial 1 */}
        <Section title="Radial 1 (top-right glow)">
          <RadialControls
            radial={config.radial1}
            onChange={(patch) => updateRadial('radial1', patch)}
          />
        </Section>

        {/* Radial 2 */}
        <Section title="Radial 2 (bottom-left glow)">
          <RadialControls
            radial={config.radial2}
            onChange={(patch) => updateRadial('radial2', patch)}
          />
        </Section>

        {/* Noise */}
        <Section title="Noise overlay">
          <SliderRow
            label="opacity"
            min={0}
            max={0.2}
            step={0.005}
            value={config.noiseOpacity}
            onChange={(v) => update('noiseOpacity', v)}
            display={config.noiseOpacity.toFixed(3)}
          />
        </Section>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full bg-orange-600 hover:bg-orange-500 text-black font-bold py-2 rounded text-xs uppercase tracking-wider"
        >
          {copied ? '✓ copied to clipboard' : 'copy css snippet'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-20 text-white/60">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-6 bg-transparent border-0 cursor-pointer p-0 rounded"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white font-mono"
      />
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  display?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-20 text-white/60">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-orange-500"
      />
      <span className="w-12 text-right text-white/80 tabular-nums text-[10px]">
        {display ?? value}
      </span>
    </div>
  );
}

function RadialControls({
  radial,
  onChange,
}: {
  radial: RadialLayer;
  onChange: (patch: Partial<RadialLayer>) => void;
}) {
  return (
    <>
      <ColorRow
        label="color"
        value={radial.color}
        onChange={(v) => onChange({ color: v })}
      />
      <SliderRow
        label="opacity"
        min={0}
        max={1}
        step={0.01}
        value={radial.opacity}
        onChange={(v) => onChange({ opacity: v })}
        display={radial.opacity.toFixed(2)}
      />
      <SliderRow
        label="width"
        min={100}
        max={2000}
        step={20}
        value={radial.width}
        onChange={(v) => onChange({ width: v })}
        display={`${radial.width}px`}
      />
      <SliderRow
        label="height"
        min={100}
        max={2000}
        step={20}
        value={radial.height}
        onChange={(v) => onChange({ height: v })}
        display={`${radial.height}px`}
      />
      <SliderRow
        label="x pos"
        min={-20}
        max={120}
        step={1}
        value={radial.x}
        onChange={(v) => onChange({ x: v })}
        display={`${radial.x}%`}
      />
      <SliderRow
        label="y pos"
        min={-20}
        max={120}
        step={1}
        value={radial.y}
        onChange={(v) => onChange({ y: v })}
        display={`${radial.y}%`}
      />
      <SliderRow
        label="fade end"
        min={20}
        max={100}
        step={1}
        value={radial.fadeEnd}
        onChange={(v) => onChange({ fadeEnd: v })}
        display={`${radial.fadeEnd}%`}
      />
    </>
  );
}

function buildSnippet(c: BackgroundConfig): string {
  return `// In WaitlistClient.tsx, replace the bg-[#...] class + the radial style + the noise opacity.

// Base color (className):
bg-[${c.baseColor}]

// Radials (style.background):
background:
  '${backgroundToCss(c)}',

// Noise overlay opacity (className):
opacity-[${c.noiseOpacity.toFixed(3)}]
`;
}
