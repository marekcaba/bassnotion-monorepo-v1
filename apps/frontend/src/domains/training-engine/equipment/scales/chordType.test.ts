import { describe, it, expect } from 'vitest';
import {
  CHORD_TYPES,
  CHORD_DRONE_QUALITY,
  CHORD_PARENT_SCALE,
  chordDroneSymbol,
  parentScaleFor,
  chordTypeForScale,
  type ChordType,
} from './chordType';
import { SCALE_INTERVALS } from './scaleGenerator';

describe('chordType — chord-sound vocabulary for the scales tool', () => {
  it('every chord type has a drone quality AND a parent scale', () => {
    for (const { value } of CHORD_TYPES) {
      expect(CHORD_DRONE_QUALITY[value]).toBeTruthy();
      expect(CHORD_PARENT_SCALE[value]).toBeTruthy();
    }
  });

  it('every parent scale is a REAL generatable scale (in SCALE_INTERVALS)', () => {
    for (const chord of Object.keys(CHORD_PARENT_SCALE) as ChordType[]) {
      const scale = CHORD_PARENT_SCALE[chord];
      expect(SCALE_INTERVALS[scale]).toBeDefined();
    }
  });

  it('the standard chord-scale relationships hold', () => {
    expect(parentScaleFor('maj7')).toBe('major');
    expect(parentScaleFor('7')).toBe('mixolydian');
    expect(parentScaleFor('m7')).toBe('dorian');
    expect(parentScaleFor('m')).toBe('natural_minor');
    expect(parentScaleFor('m9')).toBe('dorian');
    expect(parentScaleFor('m11')).toBe('dorian');
    expect(parentScaleFor('13')).toBe('mixolydian');
    expect(parentScaleFor('sus13')).toBe('mixolydian');
    expect(parentScaleFor('13#11')).toBe('lydian_b7');
    expect(parentScaleFor('7alt')).toBe('altered');
  });

  it('builds the drone symbol root+quality (sharps preserved; loader folds # later)', () => {
    expect(chordDroneSymbol('C', 'maj7')).toBe('Cmaj7');
    expect(chordDroneSymbol('A', '7')).toBe('A7');
    expect(chordDroneSymbol('F#', '13#11')).toBe('F#13#11');
    // m11 defaults to the first voicing's file suffix so the loader finds it.
    expect(chordDroneSymbol('C', 'm11')).toBe('Cm11_1');
  });

  it('reverse-maps legacy ScaleTypes to a sensible chord type (back-compat)', () => {
    expect(chordTypeForScale('major')).toBe('maj7');
    expect(chordTypeForScale('mixolydian')).toBe('7');
    expect(chordTypeForScale('natural_minor')).toBe('m');
    expect(chordTypeForScale('dorian')).toBe('m7');
    expect(chordTypeForScale('lydian_b7')).toBe('13#11');
    expect(chordTypeForScale('altered')).toBe('7alt');
  });

  it('the new parent scales are 7-note and well-formed', () => {
    expect(SCALE_INTERVALS.lydian_b7).toEqual([0, 2, 4, 6, 7, 9, 10]);
    expect(SCALE_INTERVALS.altered).toEqual([0, 1, 3, 4, 6, 8, 10]);
  });
});
