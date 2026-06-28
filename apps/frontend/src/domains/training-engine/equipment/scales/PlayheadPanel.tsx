'use client';

/**
 * PlayheadPanel — DEV-ONLY live tuner for the gliding orange playhead sphere on the gym
 * Scales fretboard. Drag the sliders, pick an animation type, shape the bezier easing, and
 * when it looks right copy the printed values into playheadConfig.ts (DEFAULT_PLAYHEAD_CONFIG).
 * Gated by NEXT_PUBLIC_PLAYHEAD_PANEL so it never ships to players.
 *
 * Mirrors FretboardCalibrationPanel's draggable shell.
 */

import React from 'react';
import {
  type PlayheadConfig,
  PLAYHEAD_ANIMS,
  cubicBezier,
} from './playheadConfig';

export const PLAYHEAD_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_PLAYHEAD_PANEL === 'true';

type NumKey = Exclude<
  keyof PlayheadConfig,
  'anim' | 'color' | 'rippleColor' | 'ripple2Color' | 'bezier'
>;

const SLIDERS: {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'radius', label: 'sphere radius', min: 2, max: 20, step: 0.5 },
  { key: 'opacity', label: 'opacity', min: 0.1, max: 1, step: 0.05 },
  {
    key: 'emissiveIntensity',
    label: 'glow (emissive)',
    min: 0,
    max: 2,
    step: 0.05,
  },
  { key: 'zOffset', label: 'z lift', min: 0, max: 14, step: 0.5 },
  { key: 'pulseAmount', label: 'on-beat pulse', min: 0, max: 1, step: 0.05 },
  {
    key: 'holdFrac',
    label: 'hold fraction (glide+hold)',
    min: 0,
    max: 0.95,
    step: 0.05,
  },
  { key: 'glideFrac', label: 'glide fraction', min: 0.05, max: 1, step: 0.05 },
  { key: 'hopHeight', label: 'arc hop height', min: 0, max: 60, step: 1 },
  // ── Landing ripple ("dartboard") ──
  { key: 'rippleOn', label: '◎ ripple ON (0/1)', min: 0, max: 1, step: 1 },
  {
    key: 'rippleRings',
    label: 'ripple density (rings)',
    min: 1,
    max: 6,
    step: 1,
  },
  { key: 'rippleExpand', label: 'ripple expand ×', min: 1, max: 8, step: 0.1 },
  {
    key: 'rippleSpeed',
    label: 'ripple speed',
    min: 0.01,
    max: 0.3,
    step: 0.01,
  },
  { key: 'rippleOpacity', label: 'ripple opacity', min: 0, max: 1, step: 0.05 },
  // ── Trailing second ripple ──
  {
    key: 'ripple2On',
    label: '◎◎ 2nd ripple ON (0/1)',
    min: 0,
    max: 1,
    step: 1,
  },
  {
    key: 'ripple2Delay',
    label: '2nd ripple delay',
    min: 0,
    max: 0.9,
    step: 0.02,
  },
];

/** Tiny SVG preview of the current bezier easing curve. */
function BezierPreview({
  bezier,
}: {
  bezier: [number, number, number, number];
}) {
  const W = 120;
  const H = 60;
  const pts: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = i / 24;
    const y = cubicBezier(bezier[0], bezier[1], bezier[2], bezier[3], x);
    pts.push(`${(x * W).toFixed(1)},${((1 - y) * H).toFixed(1)}`);
  }
  return (
    <svg
      width={W}
      height={H}
      style={{
        background: '#11141a',
        border: '1px solid #262a31',
        borderRadius: 6,
      }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
      />
    </svg>
  );
}

export function PlayheadPanel({
  values,
  onChange,
}: {
  values: PlayheadConfig;
  onChange: (v: PlayheadConfig) => void;
}) {
  const [pos, setPos] = React.useState({ x: -1, y: 16 }); // x:-1 = anchor top-left
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

  if (!PLAYHEAD_PANEL_ENABLED) return null;

  // Before the first drag, pin to the top-LEFT (the fretboard panel pins top-right).
  const placement: React.CSSProperties =
    pos.x < 0 ? { top: pos.y, left: 16 } : { top: pos.y, left: pos.x };

  const setBezier = (i: number, v: number) => {
    const next = [...values.bezier] as [number, number, number, number];
    next[i] = v;
    onChange({ ...values, bezier: next });
  };

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
        ⠿ Playhead sphere
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        {/* ANIMATION TYPE */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4, color: '#9aa3ad' }}>animation</div>
          <select
            value={values.anim}
            onChange={(e) =>
              onChange({
                ...values,
                anim: e.target.value as PlayheadConfig['anim'],
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
            {PLAYHEAD_ANIMS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* COLORS — sphere + ripple */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span>sphere color</span>
          <input
            type="color"
            value={values.color}
            onChange={(e) => onChange({ ...values, color: e.target.value })}
            style={{
              width: 44,
              height: 24,
              background: 'transparent',
              border: 'none',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span>ripple color</span>
          <input
            type="color"
            value={values.rippleColor}
            onChange={(e) =>
              onChange({ ...values, rippleColor: e.target.value })
            }
            style={{
              width: 44,
              height: 24,
              background: 'transparent',
              border: 'none',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span>2nd ripple color</span>
          <input
            type="color"
            value={values.ripple2Color}
            onChange={(e) =>
              onChange({ ...values, ripple2Color: e.target.value })
            }
            style={{
              width: 44,
              height: 24,
              background: 'transparent',
              border: 'none',
            }}
          />
        </div>

        {/* NUMERIC SLIDERS */}
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

        {/* BEZIER HANDLES + live curve */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 8,
            borderTop: '1px solid #262a31',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <span style={{ color: '#9aa3ad' }}>bezier easing</span>
            <BezierPreview bezier={values.bezier} />
          </div>
          {(['x1', 'y1', 'x2', 'y2'] as const).map((lbl, i) => (
            <div key={lbl} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{lbl}</span>
                <span style={{ color: '#6ad08c' }}>
                  {(values.bezier[i] ?? 0).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={i % 2 === 0 ? 0 : -0.5} // x in [0,1]; y can overshoot for bounce
                max={i % 2 === 0 ? 1 : 1.5}
                step={0.01}
                value={values.bezier[i] ?? 0}
                onChange={(e) => setBezier(i, Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log(
              '[playhead] paste into playheadConfig.ts DEFAULT_PLAYHEAD_CONFIG:',
              JSON.stringify(values, null, 2),
            );
          }}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '6px 10px',
            background: '#f97316',
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
