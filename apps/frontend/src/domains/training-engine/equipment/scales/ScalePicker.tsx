'use client';

/**
 * ScalePicker — the Scales station's skill-specific panel: choose the root + scale
 * type to practice. Open by design — the tool reconfigures live; nothing is locked.
 */

import React from 'react';
import type { PitchClass, ScaleType } from './scaleGenerator';

const ROOTS: PitchClass[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const SCALE_LABELS: { value: ScaleType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural_minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'minor_pentatonic', label: 'Minor Pent.' },
  { value: 'major_pentatonic', label: 'Major Pent.' },
];

export interface ScalePickerProps {
  root: PitchClass;
  scaleType: ScaleType;
  onRootChange: (root: PitchClass) => void;
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
  root,
  scaleType,
  onRootChange,
  onScaleTypeChange,
}: ScalePickerProps) {
  return (
    <div
      style={{
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            color: '#8a8f98',
            marginBottom: 6,
            letterSpacing: 0.4,
          }}
        >
          ROOT
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ROOTS.map((r) => (
            <button
              key={r}
              type="button"
              style={chip(r === root)}
              onClick={() => onRootChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
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
    </div>
  );
}
