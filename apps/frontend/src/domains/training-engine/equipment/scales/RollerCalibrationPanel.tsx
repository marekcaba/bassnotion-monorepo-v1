'use client';

/**
 * RollerCalibrationPanel — DEV-ONLY draggable panel to tune the RollerPicker animation
 * live. Drag the header to move it; adjust sliders; when it feels right, hit "Log" and
 * paste the values into rollerConfig.ts (ROLLER_ANIM). Gated by
 * NEXT_PUBLIC_ROLLER_CALIBRATION so it never ships to players.
 */

import React from 'react';
import {
  type RollerAnimConfig,
  ROLLER_CALIBRATION_ENABLED,
  EASINGS,
} from './rollerConfig';

const SLIDERS: {
  key: keyof RollerAnimConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'durationMs', label: 'duration (ms)', min: 40, max: 600, step: 10 },
  { key: 'rowHeightPx', label: 'row height (px)', min: 12, max: 36, step: 1 },
  { key: 'bandHalfPct', label: 'band nudge ±%', min: -10, max: 15, step: 1 },
  { key: 'edgeOpacity', label: 'edge opacity', min: 0, max: 1, step: 0.05 },
  { key: 'edge2Opacity', label: 'edge2 opacity', min: 0, max: 1, step: 0.05 },
  {
    key: 'currentFontPx',
    label: 'current font (px)',
    min: 11,
    max: 22,
    step: 1,
  },
  { key: 'edgeFontPx', label: 'edge font (px)', min: 9, max: 18, step: 1 },
];

export function RollerCalibrationPanel({
  config,
  onChange,
}: {
  config: RollerAnimConfig;
  onChange: (c: RollerAnimConfig) => void;
}) {
  const [pos, setPos] = React.useState({ x: 16, y: 16 });
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
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!ROLLER_CALIBRATION_ENABLED) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 10000,
        width: 280,
        background: 'rgba(14,16,20,0.96)',
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
        ⠿ Roller animation
      </div>

      <div style={{ padding: 14 }}>
        {SLIDERS.map((s) => (
          <div key={s.key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.label}</span>
              <span style={{ color: '#6ad08c' }}>
                {config[s.key] as number}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={config[s.key] as number}
              onChange={(e) =>
                onChange({ ...config, [s.key]: Number(e.target.value) })
              }
              style={{ width: '100%' }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 4 }}>easing</div>
          <select
            value={config.easing}
            onChange={(e) => onChange({ ...config, easing: e.target.value })}
            style={{
              width: '100%',
              background: '#0e1014',
              color: '#e6e8ec',
              border: '1px solid #2b3038',
              borderRadius: 6,
              padding: '4px 6px',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {EASINGS.map((ez) => (
              <option key={ez} value={ez}>
                {ez}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log(
              '[roller-calibration] paste into rollerConfig.ts ROLLER_ANIM:',
              JSON.stringify(config, null, 2),
            );
          }}
          style={{
            width: '100%',
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
