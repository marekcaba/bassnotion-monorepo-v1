'use client';

/**
 * FretboardCalibrationPanel — DEV-ONLY live calibration for the gym fretboard's
 * positioning/centering. Drag the sliders, watch the fretboard move, and when it
 * looks right, copy the printed values into fretboardViewConfig.ts. Gated by
 * NEXT_PUBLIC_FRETBOARD_CALIBRATION so it never ships to players.
 *
 * It owns a small set of overlay3DConfig overrides (the ones that affect horizontal
 * centering + the edge fades that were clipping the right side) layered on top of the
 * base config from getFretboardOverlayConfig.
 */

import React from 'react';

export interface FretboardCalibrationValues {
  sceneX: number;
  tiltAxisOffsetX: number;
  contentScale: number;
  contentScaleX: number;
  /** Independent VERTICAL scale of the content (corrects vertical stretch/squash). */
  contentScaleY: number;
  /** Scene ROTATION in DEGREES (the canvas converts to radians). X = tilt toward/away,
   *  Y = turn left/right (yaw), Z = roll in-plane. */
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  leftFadeZone: number;
  rightFadeZone: number;
  offsetX: number;
  /** The PRIMARY window (inner canvas) width in px. HIGHER = the right hard-cut moves
   *  RIGHT, showing more frets (left edge stays anchored). Scene was hardcoded to 580. */
  viewportWidth: number;
  /** WINDOW: canvas height in px. */
  windowHeight: number;
}

const SLIDERS: {
  key: keyof FretboardCalibrationValues;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  // ── PRIMARY WINDOW: widen to push the RIGHT CUT right (left edge stays anchored) ──
  {
    key: 'viewportWidth',
    label: '★ PRIMARY width (right cut→)',
    min: 580,
    max: 1800,
    step: 10,
  },
  {
    key: 'windowHeight',
    label: 'window HEIGHT px',
    min: 200,
    max: 480,
    step: 5,
  },
  // ── SCENE (content inside the canvas) ──
  { key: 'sceneX', label: 'sceneX (slide L/R)', min: -1500, max: 500, step: 1 },
  {
    key: 'offsetX',
    label: 'offsetX (canvas px)',
    min: -800,
    max: 800,
    step: 1,
  },
  {
    key: 'tiltAxisOffsetX',
    label: 'tiltAxisOffsetX',
    min: 0,
    max: 900,
    step: 1,
  },
  {
    key: 'contentScale',
    label: 'contentScale',
    min: 0.6,
    max: 2.2,
    step: 0.01,
  },
  {
    key: 'contentScaleX',
    label: 'contentScaleX',
    min: 0.6,
    max: 1.4,
    step: 0.001,
  },
  {
    key: 'contentScaleY',
    label: 'contentScaleY',
    min: 0.6,
    max: 1.4,
    step: 0.001,
  },
  // ── ROTATION (degrees) — X tilt, Y yaw, Z roll ──
  { key: 'rotationX', label: 'rotationX° (tilt)', min: -180, max: 180, step: 0.5 },
  { key: 'rotationY', label: 'rotationY° (yaw)', min: -180, max: 180, step: 0.5 },
  { key: 'rotationZ', label: 'rotationZ° (roll)', min: -180, max: 180, step: 0.5 },
  { key: 'leftFadeZone', label: 'leftFadeZone %', min: 0, max: 30, step: 0.5 },
  {
    key: 'rightFadeZone',
    label: 'rightFadeZone %',
    min: 0,
    max: 30,
    step: 0.5,
  },
];

export const CALIBRATION_ENABLED =
  process.env.NEXT_PUBLIC_FRETBOARD_CALIBRATION === 'true';

export function FretboardCalibrationPanel({
  values,
  onChange,
}: {
  values: FretboardCalibrationValues;
  onChange: (v: FretboardCalibrationValues) => void;
}) {
  // Draggable position — grab the header to move the panel out of the way of the board.
  const [pos, setPos] = React.useState({ x: -1, y: 16 }); // x:-1 = "anchor top-right"
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
    // Resolve the current left from the live rect so the first drag doesn't jump when
    // we're still right-anchored (x === -1).
    const rect = (
      e.currentTarget.parentElement as HTMLElement
    ).getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!CALIBRATION_ENABLED) return null;

  // Before the first drag, stay pinned to the top-right (x === -1); after, use x/y.
  const placement: React.CSSProperties =
    pos.x < 0 ? { top: pos.y, right: 16 } : { top: pos.y, left: pos.x };

  return (
    <div
      style={{
        position: 'fixed',
        ...placement,
        zIndex: 9999,
        width: 280,
        paddingBottom: 14,
        background: 'rgba(14,16,20,0.95)',
        border: '1px solid #2b3038',
        borderRadius: 10,
        color: '#e6e8ec',
        fontFamily: 'monospace',
        fontSize: 12,
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
        }}
      >
        ⠿ Fretboard calibration
      </div>
      <div style={{ padding: '12px 14px 0' }}>
        {SLIDERS.map((s) => (
          <div key={s.key} style={{ marginBottom: 10 }}>
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
              '[fretboard-calibration] paste into fretboardViewConfig.ts:',
              JSON.stringify(values, null, 2),
            );
          }}
          style={{
            width: '100%',
            marginTop: 4,
            padding: '6px 10px',
            background: '#6ad08c',
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
