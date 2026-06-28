'use client';

/**
 * AnticipationPanel — DEV-ONLY live tuner for the playhead ANTICIPATION layers (the runway
 * of upcoming-note previews + the approach ring). Pick the ghost SHAPE (spheres vs flat dots
 * on the ground), how many ahead, opacity, colors, the connecting lines, and the approach
 * ring. When it looks right, copy the printed values into playheadConfig.ts. Gated by
 * NEXT_PUBLIC_PLAYHEAD_PANEL (shares the playhead panel's flag) — it's part of the playhead.
 *
 * Mirrors the playhead panel's draggable shell; pins to the RIGHT so the two don't overlap.
 */

import React from 'react';
import { type PlayheadConfig, GHOST_SHAPES } from './playheadConfig';

export const ANTICIPATION_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_PLAYHEAD_PANEL === 'true';

// number-valued config keys this panel exposes
type NumKey =
  | 'runwayOn'
  | 'runwayCount'
  | 'runwayOpacity'
  | 'runwaySize'
  | 'runwayTracer'
  | 'tracerCount'
  | 'tracerThickness'
  | 'runwayTempoCap'
  | 'approachOn'
  | 'approachLead'
  | 'approachStart'
  | 'approachOpacity'
  | 'rootRingOn';

const SLIDERS: {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  // ── Runway (upcoming-note previews) ──
  { key: 'runwayOn', label: '▸ runway ON (0/1)', min: 0, max: 1, step: 1 },
  { key: 'runwayCount', label: 'notes ahead', min: 1, max: 6, step: 1 },
  {
    key: 'runwayOpacity',
    label: 'preview opacity',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'runwaySize',
    label: 'preview size ×',
    min: 0.2,
    max: 1.5,
    step: 0.05,
  },
  { key: 'runwayTracer', label: 'line opacity', min: 0, max: 1, step: 0.05 },
  { key: 'tracerCount', label: 'line count', min: 0, max: 6, step: 1 },
  {
    key: 'tracerThickness',
    label: 'line thickness ×',
    min: 0.02,
    max: 1.5,
    step: 0.02,
  },
  {
    key: 'runwayTempoCap',
    label: 'declutter ≥ BPM (0=off)',
    min: 0,
    max: 250,
    step: 5,
  },
  // ── Approach ring (timing) ──
  {
    key: 'approachOn',
    label: '◎ approach ring ON (0/1)',
    min: 0,
    max: 1,
    step: 1,
  },
  {
    key: 'approachLead',
    label: 'ring lead (beats)',
    min: 0.25,
    max: 4,
    step: 0.25,
  },
  {
    key: 'approachStart',
    label: 'ring start size ×',
    min: 1.5,
    max: 8,
    step: 0.1,
  },
  { key: 'approachOpacity', label: 'ring opacity', min: 0, max: 1, step: 0.05 },
  // ── Root marker rings (static, around the roots/octaves — same mesh as the old yellow ring) ──
  {
    key: 'rootRingOn',
    label: '◉ root rings ON (0/1)',
    min: 0,
    max: 1,
    step: 1,
  },
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
      style={{
        width: 44,
        height: 24,
        background: 'transparent',
        border: 'none',
      }}
    />
  </div>
);

export function AnticipationPanel({
  values,
  onChange,
}: {
  values: PlayheadConfig;
  onChange: (v: PlayheadConfig) => void;
}) {
  const [pos, setPos] = React.useState({ x: -1, y: 16 }); // x:-1 = anchor top-right
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

  if (!ANTICIPATION_PANEL_ENABLED) return null;

  // Pins top-RIGHT until first drag (the playhead sphere panel pins top-left).
  const placement: React.CSSProperties =
    pos.x < 0 ? { top: pos.y, right: 16 } : { top: pos.y, left: pos.x };

  return (
    <div
      style={{
        position: 'fixed',
        ...placement,
        zIndex: 9999,
        width: 290,
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
        ⠿ Anticipation (runway + ring)
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        {/* GHOST SHAPE */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4, color: '#9aa3ad' }}>preview shape</div>
          <select
            value={values.runwayShape}
            onChange={(e) =>
              onChange({
                ...values,
                runwayShape: e.target.value as PlayheadConfig['runwayShape'],
              })
            }
            style={{
              width: '100%',
              background: '#11141a',
              color: '#e6e8ec',
              border: '1px solid #2b3038',
              borderRadius: 6,
              padding: '5px 8px',
            }}
          >
            {GHOST_SHAPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* COLORS */}
        <ColorRow
          label="preview color"
          value={values.runwayColor}
          onChange={(v) => onChange({ ...values, runwayColor: v })}
        />
        <ColorRow
          label="line color"
          value={values.tracerColor}
          onChange={(v) => onChange({ ...values, tracerColor: v })}
        />
        <ColorRow
          label="ring color"
          value={values.approachColor}
          onChange={(v) => onChange({ ...values, approachColor: v })}
        />
        <ColorRow
          label="root ring color"
          value={values.rootRingColor}
          onChange={(v) => onChange({ ...values, rootRingColor: v })}
        />

        {/* SLIDERS */}
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

        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log(
              '[anticipation] paste into playheadConfig.ts DEFAULT_PLAYHEAD_CONFIG:',
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
