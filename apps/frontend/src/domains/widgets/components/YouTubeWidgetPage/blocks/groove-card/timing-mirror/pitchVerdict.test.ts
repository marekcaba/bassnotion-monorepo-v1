import { describe, it, expect } from 'vitest';
import { expectedPitch, pitchVerdict } from './pitchVerdict';
import type { PitchResult } from './verifyPitch';

const det = (midi: number, cents = 0): PitchResult => ({
  midi,
  hz: 440 * 2 ** ((midi - 69) / 12),
  confidence: 0.9,
  cents,
});

describe('expectedPitch — authored string+fret → pitch', () => {
  it('string 3 (A1) fret 0 = MIDI 33; fret 5 = D2 = MIDI 38', () => {
    expect(expectedPitch({ string: 3, fret: 0 }, '4')).toBe(33);
    expect(expectedPitch({ string: 3, fret: 5 }, '4')).toBe(38);
  });
  it('null when string/fret missing or role is pitchless', () => {
    expect(expectedPitch({ string: 3, fret: null }, '4')).toBeNull();
    expect(expectedPitch({ string: null, fret: 5 }, '4')).toBeNull();
    expect(expectedPitch({ string: 3, fret: 0, role: 'ghost' }, '4')).toBeNull();
    expect(expectedPitch({ string: 3, fret: 0, role: 'dead' }, '4')).toBeNull();
  });
});

describe('pitchVerdict — student detection vs authored note', () => {
  const note = { string: 3 as const, fret: 0 }; // A1 = MIDI 33

  it('CORRECT when detected matches the expected pitch', () => {
    expect(pitchVerdict(det(33), note, '4').verdict).toBe('correct');
  });
  it('CORRECT within ±1 semitone (noisy onset tolerance)', () => {
    expect(pitchVerdict(det(34), note, '4').verdict).toBe('correct');
    expect(pitchVerdict(det(32), note, '4').verdict).toBe('correct');
  });
  it('OCTAVE when an octave off (same pitch-class) — a detector slip, graded as right', () => {
    expect(pitchVerdict(det(45), note, '4').verdict).toBe('octave'); // A2
    expect(pitchVerdict(det(21), note, '4').verdict).toBe('octave'); // A0
  });
  it('WRONG when a confident detection at a different note', () => {
    expect(pitchVerdict(det(38), note, '4').verdict).toBe('wrong'); // D2, a 5th up
  });
  it('UNKNOWN when no confident detection — not penalised', () => {
    expect(pitchVerdict(null, note, '4').verdict).toBe('unknown');
  });
  it('N/A for a pitchless ghost note — pitch not graded', () => {
    expect(pitchVerdict(det(99), { string: 3, fret: 0, role: 'ghost' }, '4').verdict).toBe('n/a');
  });
  it('N/A for an unauthored marker (no string/fret)', () => {
    expect(pitchVerdict(det(33), { string: null, fret: null }, '4').verdict).toBe('n/a');
  });
  it('carries the cents-off for an in-tune-ness read', () => {
    expect(pitchVerdict(det(33, 12), note, '4').centsOff).toBe(12);
  });
});
