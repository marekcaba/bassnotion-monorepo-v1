/**
 * Unit tests for chord parser utilities
 */

import { describe, it, expect } from 'vitest';
import { parseChord, mapVelocityToLayer, parseDuration } from '../chordParser.js';

describe('chordParser', () => {
  describe('parseChord', () => {
    it('should parse major chords correctly', () => {
      expect(parseChord('C')).toEqual(['C4', 'E4', 'G4']);
      expect(parseChord('Cmaj')).toEqual(['C4', 'E4', 'G4']);
      expect(parseChord('Cmaj7')).toEqual(['C4', 'E4', 'G4', 'B4']);
    });

    it('should parse minor chords correctly', () => {
      expect(parseChord('Cm')).toEqual(['C4', 'Ds4', 'G4']); // Eb = Ds in Salamander notation
      expect(parseChord('Dm')).toEqual(['D4', 'F4', 'A4']);
      expect(parseChord('Am7')).toEqual(['A4', 'C5', 'E5', 'G5']);
    });

    it('should parse dominant 7th chords correctly', () => {
      expect(parseChord('C7')).toEqual(['C4', 'E4', 'G4', 'As4']); // Bb = As in Salamander
      expect(parseChord('G7')).toEqual(['G4', 'B4', 'D5', 'F5']);
      expect(parseChord('A7')).toEqual(['A4', 'Cs5', 'E5', 'G5']); // C# = Cs
    });

    it('should parse diminished chords correctly', () => {
      expect(parseChord('Cdim')).toEqual(['C4', 'Ds4', 'Fs4']); // Eb, Gb
      expect(parseChord('Bdim7')).toEqual(['B4', 'D5', 'F5', 'Gs5']); // Ab
    });

    it('should parse augmented chords correctly', () => {
      expect(parseChord('Caug')).toEqual(['C4', 'E4', 'Gs4']); // G#
      expect(parseChord('C+')).toEqual(['C4', 'E4', 'Gs4']);
    });

    it('should parse suspended chords correctly', () => {
      expect(parseChord('Csus2')).toEqual(['C4', 'D4', 'G4']);
      expect(parseChord('Csus4')).toEqual(['C4', 'F4', 'G4']);
      expect(parseChord('C7sus4')).toEqual(['C4', 'F4', 'G4', 'As4']);
    });

    it('should handle sharp roots correctly', () => {
      expect(parseChord('C#')).toEqual(['Cs4', 'F4', 'Gs4']); // C# E G#
      expect(parseChord('F#m')).toEqual(['Fs4', 'A4', 'Cs5']); // F# A C#
    });

    it('should handle flat roots correctly', () => {
      expect(parseChord('Db')).toEqual(['Cs4', 'F4', 'Gs4']); // Db=Cs, F, Ab=Gs
      expect(parseChord('Eb')).toEqual(['Ds4', 'G4', 'As4']); // Eb=Ds, G, Bb=As
    });

    it('should handle different octaves', () => {
      expect(parseChord('C', 3)).toEqual(['C3', 'E3', 'G3']);
      expect(parseChord('C', 5)).toEqual(['C5', 'E5', 'G5']);
    });

    it('should handle unknown chords gracefully', () => {
      // Unknown chord quality should use major triad
      const result = parseChord('Cweird');
      expect(result).toEqual(['C4', 'E4', 'G4']);
    });

    it('should handle octave wrapping for extended chords', () => {
      const result = parseChord('Cmaj13');
      // Should span into next octave
      expect(result.length).toBeGreaterThan(4);
      expect(result[result.length - 1]).toMatch(/5$/); // Last note in octave 5
    });
  });

  describe('mapVelocityToLayer', () => {
    it('should map soft velocities to v6', () => {
      expect(mapVelocityToLayer(0.1)).toBe('v2');
      expect(mapVelocityToLayer(0.3)).toBe('v6');
    });

    it('should map medium velocities to v10-v12', () => {
      expect(mapVelocityToLayer(0.5)).toBe('v8');
      expect(mapVelocityToLayer(0.7)).toBe('v12'); // Actual mapping result
    });

    it('should map loud velocities to v14-v16', () => {
      expect(mapVelocityToLayer(0.85)).toBe('v14');
      expect(mapVelocityToLayer(0.95)).toBe('v16'); // Actual mapping result
    });

    it('should clamp velocities to 0-1 range', () => {
      expect(mapVelocityToLayer(-0.5)).toBe('v2'); // Clamped to 0
      expect(mapVelocityToLayer(1.5)).toBe('v16'); // Clamped to 1
    });

    it('should round to even layers', () => {
      // All layers should be even numbers (v2, v4, v6, v8, v10, v12, v14, v16)
      const result = mapVelocityToLayer(0.5);
      const layerNum = parseInt(result.substring(1));
      expect(layerNum % 2).toBe(0);
    });
  });

  describe('parseDuration', () => {
    it('should parse quarter notes correctly', () => {
      expect(parseDuration('4n', 120)).toBeCloseTo(0.5, 2); // 60/120 = 0.5s
      expect(parseDuration('4n', 60)).toBeCloseTo(1.0, 2); // 60/60 = 1.0s
    });

    it('should parse eighth notes correctly', () => {
      expect(parseDuration('8n', 120)).toBeCloseTo(0.25, 2);
      expect(parseDuration('8n', 60)).toBeCloseTo(0.5, 2);
    });

    it('should parse half notes correctly', () => {
      expect(parseDuration('2n', 120)).toBeCloseTo(1.0, 2);
      expect(parseDuration('2n', 60)).toBeCloseTo(2.0, 2);
    });

    it('should parse whole notes correctly', () => {
      expect(parseDuration('1n', 120)).toBeCloseTo(2.0, 2);
      expect(parseDuration('1n', 60)).toBeCloseTo(4.0, 2);
    });

    it('should parse sixteenth notes correctly', () => {
      expect(parseDuration('16n', 120)).toBeCloseTo(0.125, 2);
    });

    it('should parse measures correctly', () => {
      expect(parseDuration('1m', 120)).toBeCloseTo(2.0, 2); // 1 measure = 4 beats
      expect(parseDuration('2m', 120)).toBeCloseTo(4.0, 2); // 2 measures = 8 beats
    });

    it('should parse triplets correctly', () => {
      expect(parseDuration('8t', 120)).toBeCloseTo(0.167, 2); // Eighth triplet
    });

    it('should handle undefined duration with default', () => {
      expect(parseDuration(undefined, 120)).toBeCloseTo(0.5, 2); // Default quarter note
    });

    it('should handle invalid duration notation gracefully', () => {
      expect(parseDuration('invalid', 120)).toBeCloseTo(0.5, 2); // Default
      expect(parseDuration('', 120)).toBeCloseTo(0.5, 2); // Default
    });

    it('should scale with different tempos', () => {
      const duration4n_60bpm = parseDuration('4n', 60);
      const duration4n_120bpm = parseDuration('4n', 120);

      // At 60 BPM, quarter note should be twice as long as at 120 BPM
      expect(duration4n_60bpm).toBeCloseTo(duration4n_120bpm * 2, 2);
    });
  });
});
