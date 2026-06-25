'use client';

/**
 * ScalePicker — the Scales station's skill-specific panel: choose the scale TYPE to
 * practice. The ROOT is NOT here — it comes from the playback key switcher (the
 * `< E >` control), so there's one source of truth for the key. Open by design.
 */

import React from 'react';
import type { ScaleType } from './scaleGenerator';

const SCALE_LABELS: { value: ScaleType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural_minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'minor_pentatonic', label: 'Minor Pent.' },
  { value: 'major_pentatonic', label: 'Major Pent.' },
];

export interface ScalePickerProps {
  scaleType: ScaleType;
  onScaleTypeChange: (scaleType: ScaleType) => void;
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: active ? '1px solid #6ad08c' : '1px solid #2b3038',
  background: active ? '#6ad08c' : 'transparent',
  color: active ? '#0a0a0a' : '#c8ccd2',
  transition: 'all 0.12s',
});

export function ScalePicker({
  scaleType,
  onScaleTypeChange,
}: ScalePickerProps) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 11,
          color: '#8a8f98',
          marginBottom: 6,
          letterSpacing: 0.4,
        }}
      >
        SCALE
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SCALE_LABELS.map((s) => (
          <button
            key={s.value}
            type="button"
            style={chip(s.value === scaleType)}
            onClick={() => onScaleTypeChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
