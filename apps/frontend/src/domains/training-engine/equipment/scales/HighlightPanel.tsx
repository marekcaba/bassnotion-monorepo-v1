'use client';

/**
 * HighlightPanel — DEV-ONLY live tuner for the rolling DOT HIGHLIGHT window (the eased dim↔bright
 * green animation while playing). Tune the window size, how fast the highlight fades in/out, the
 * bright + dim greens (normal + root), and the root-ring dim depth. When it looks right, copy the
 * printed values into playheadConfig.ts. Shares the playhead panel's flag (NEXT_PUBLIC_PLAYHEAD_PANEL).
 *
 * Mirrors the other panels' draggable shell; pins to the LEFT-LOWER so the three don't overlap.
 */

import React from 'react';
import { type PlayheadConfig } from './playheadConfig';

export const HIGHLIGHT_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_PLAYHEAD_PANEL === 'true';

type NumKey = 'litWindowAhead' | 'litSmoothing' | 'rootRingDimFactor';

const SLIDERS: {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'litWindowAhead', label: 'notes ahead lit', min: 0, max: 6, step: 1 },
  {
    key: 'litSmoothing',
    label: 'fade speed (↑=snappier)',
    min: 0.02,
    max: 1,
    step: 0.02,
  },
  {
    key: 'rootRingDimFactor',
    label: 'root-ring dim ×',
    min: 0,
    max: 1,
    step: 0.05,
  },
];

const COLORS: { key: keyof PlayheadConfig; label: string }[] = [
  { key: 'litBrightColor', label: 'bright note' },
  { key: 'litDimColor', label: 'dim note' },
  { key: 'litBrightRootColor', label: 'bright root' },
  { key: 'litDimRootColor', label: 'dim root' },
];

const ColorRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    }}
  >
    <span>{label}</span>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 44, height: 24, background: 'transparent', border: 'none' }}
    />
  </div>
);

export function HighlightPanel({
  values,
  onChange,
}: {
  values: PlayheadConfig;
  onChange: (v: PlayheadConfig) => void;
}) {
  const [pos, setPos] = React.useState({ x: 16, y: 360 });
  const drag = React.useRef<{ dx: number; dy: number } | null>(null);

  const onPointerMove = React.useCallback((e: PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy });
  }, []);
  const onPointerUp = React.useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);
  const onHeaderDown = (e: React.PointerEvent) => {
    const rect = (
      e.currentTarget.parentElement as HTMLElement
    ).getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!HIGHLIGHT_PANEL_ENABLED) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        zIndex: 9999,
        width: 270,
        paddingBottom: 14,
        background: 'rgba(14,16,20,0.95)',
        border: '1px solid #2b3038',
        borderRadius: 10,
        color: '#e6e8ec',
        fontFamily: 'monospace',
        fontSize: 12,
        maxHeight: '92vh',
        overflowY: 'auto',
      }}
    >
      <div
        onPointerDown={onHeaderDown}
        style={{
          cursor: 'grab',
          padding: '10px 14px',
          borderBottom: '1px solid #262a31',
          fontWeight: 700,
          userSelect: 'none',
          position: 'sticky',
          top: 0,
          background: 'rgba(14,16,20,0.98)',
        }}
      >
        ⠿ Highlight window (dim↔bright)
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        {SLIDERS.map((s) => (
          <div key={s.key} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.label}</span>
              <span style={{ color: '#6ad08c' }}>{values[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={values[s.key]}
              onChange={(e) =>
                onChange({ ...values, [s.key]: Number(e.target.value) })
              }
              style={{ width: '100%' }}
            />
          </div>
        ))}

        <div style={{ height: 8 }} />
        {COLORS.map((c) => (
          <ColorRow
            key={c.key}
            label={c.label}
            value={values[c.key] as string}
            onChange={(v) => onChange({ ...values, [c.key]: v })}
          />
        ))}

        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log(
              '[highlight] paste into playheadConfig.ts DEFAULT_PLAYHEAD_CONFIG:',
              JSON.stringify(values, null, 2),
            );
          }}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '6px 10px',
            background: '#fbbf24',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 7,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Log values → console
        </button>
      </div>
    </div>
  );
}
