/**
 * GrandPianoMapper Tests
 *
 * Comprehensive test coverage for Grand Piano keyboard mapping
 * Tests sparse sampling detection and note→sample mapping
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GrandPianoMapper, type KeyboardMap } from '../GrandPianoMapper.js';

// Mock keyboard map (subset of real Grand Piano map)
const mockKeyboardMap: KeyboardMap = {
  // Octave 4 - shows sparse sampling pattern
  A4: { sample: 'A4', semitones: 0, playbackRate: 1.0 },
  As4: { sample: 'A4', semitones: 1, playbackRate: 1.059463094 },
  B4: { sample: 'C5', semitones: -1, playbackRate: 0.943874313 },
  C4: { sample: 'C4', semitones: 0, playbackRate: 1.0 },
  Cs4: { sample: 'C4', semitones: 1, playbackRate: 1.059463094 },
  D4: { sample: 'Ds4', semitones: -1, playbackRate: 0.943874313 },
  Ds4: { sample: 'Ds4', semitones: 0, playbackRate: 1.0 },
  E4: { sample: 'Ds4', semitones: 1, playbackRate: 1.059463094 },
  F4: { sample: 'Fs4', semitones: -1, playbackRate: 0.943874313 },
  Fs4: { sample: 'Fs4', semitones: 0, playbackRate: 1.0 },
  G4: { sample: 'Fs4', semitones: 1, playbackRate: 1.059463094 },
  Gs4: { sample: 'A4', semitones: -1, playbackRate: 0.943874313 },
  // Octave 3
  A3: { sample: 'A3', semitones: 0, playbackRate: 1.0 },
  C3: { sample: 'C3', semitones: 0, playbackRate: 1.0 },
  Ds3: { sample: 'Ds3', semitones: 0, playbackRate: 1.0 },
  Fs3: { sample: 'Fs3', semitones: 0, playbackRate: 1.0 },
};

describe('GrandPianoMapper', () => {
  let mapper: GrandPianoMapper;

  beforeEach(() => {
    mapper = new GrandPianoMapper();
  });

  // ============================================================================
  // KEYBOARD MAP LOADING
  // ============================================================================
  describe('Keyboard Map Loading', () => {
    it('should start with no keyboard map loaded', () => {
      expect(mapper.hasKeyboardMap()).toBe(false);
      expect(mapper.getKeyboardMap()).toBeNull();
    });

    it('should return null when mapping note without loaded map', () => {
      const mapping = mapper.mapNote('C4');
      expect(mapping).toBeNull();
    });

    it('should clear keyboard map', () => {
      // Manually set map for testing
      (mapper as any).keyboardMap = mockKeyboardMap;
      expect(mapper.hasKeyboardMap()).toBe(true);

      mapper.clear();
      expect(mapper.hasKeyboardMap()).toBe(false);
      expect(mapper.getKeyboardMap()).toBeNull();
    });
  });

  // ============================================================================
  // NOTE MAPPING - Exact Matches (No Pitch-Shift)
  // ============================================================================
  describe('Note Mapping - Exact Matches', () => {
    beforeEach(() => {
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should map C4 to C4 with no pitch-shift', () => {
      const mapping = mapper.mapNote('C4');
      expect(mapping).toEqual({
        sample: 'C4',
        semitones: 0,
        playbackRate: 1.0,
      });
    });

    it('should map A4 to A4 with no pitch-shift', () => {
      const mapping = mapper.mapNote('A4');
      expect(mapping).toEqual({
        sample: 'A4',
        semitones: 0,
        playbackRate: 1.0,
      });
    });

    it('should map Ds4 to Ds4 with no pitch-shift', () => {
      const mapping = mapper.mapNote('Ds4');
      expect(mapping).toEqual({
        sample: 'Ds4',
        semitones: 0,
        playbackRate: 1.0,
      });
    });

    it('should map Fs4 to Fs4 with no pitch-shift', () => {
      const mapping = mapper.mapNote('Fs4');
      expect(mapping).toEqual({
        sample: 'Fs4',
        semitones: 0,
        playbackRate: 1.0,
      });
    });
  });

  // ============================================================================
  // NOTE MAPPING - Pitch-Shift UP (+1 semitone)
  // ============================================================================
  describe('Note Mapping - Pitch-Shift UP', () => {
    beforeEach(() => {
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should map G4 → Fs4 with +1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('G4');
      expect(mapping).toEqual({
        sample: 'Fs4',
        semitones: 1,
        playbackRate: 1.059463094,
      });
    });

    it('should map Cs4 → C4 with +1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('Cs4');
      expect(mapping).toEqual({
        sample: 'C4',
        semitones: 1,
        playbackRate: 1.059463094,
      });
    });

    it('should map E4 → Ds4 with +1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('E4');
      expect(mapping).toEqual({
        sample: 'Ds4',
        semitones: 1,
        playbackRate: 1.059463094,
      });
    });

    it('should map As4 → A4 with +1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('As4');
      expect(mapping).toEqual({
        sample: 'A4',
        semitones: 1,
        playbackRate: 1.059463094,
      });
    });
  });

  // ============================================================================
  // NOTE MAPPING - Pitch-Shift DOWN (-1 semitone)
  // ============================================================================
  describe('Note Mapping - Pitch-Shift DOWN', () => {
    beforeEach(() => {
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should map D4 → Ds4 with -1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('D4');
      expect(mapping).toEqual({
        sample: 'Ds4',
        semitones: -1,
        playbackRate: 0.943874313,
      });
    });

    it('should map F4 → Fs4 with -1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('F4');
      expect(mapping).toEqual({
        sample: 'Fs4',
        semitones: -1,
        playbackRate: 0.943874313,
      });
    });

    it('should map Gs4 → A4 with -1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('Gs4');
      expect(mapping).toEqual({
        sample: 'A4',
        semitones: -1,
        playbackRate: 0.943874313,
      });
    });

    it('should map B4 → C5 with -1 semitone pitch-shift', () => {
      const mapping = mapper.mapNote('B4');
      expect(mapping).toEqual({
        sample: 'C5',
        semitones: -1,
        playbackRate: 0.943874313,
      });
    });
  });

  // ============================================================================
  // SPARSE SAMPLING DETECTION
  // ============================================================================
  describe('Sparse Sampling Detection', () => {
    it('should detect Grand Piano as sparse (4 notes per octave)', () => {
      const grandPianoNotes = new Set([
        'A3',
        'C3',
        'Ds3',
        'Fs3', // Octave 3 - only 4 notes
        'A4',
        'C4',
        'Ds4',
        'Fs4', // Octave 4 - only 4 notes
      ]);

      const isSparse = GrandPianoMapper.detectSparseSampling(grandPianoNotes);
      expect(isSparse).toBe(true);
    });

    it('should detect Wurlitzer as full chromatic (all 12 notes)', () => {
      const wurlitzerNotes = new Set([
        'C4',
        'Cs4',
        'D4',
        'Ds4',
        'E4',
        'F4',
        'Fs4',
        'G4',
        'Gs4',
        'A4',
        'As4',
        'B4', // Full chromatic octave
      ]);

      const isSparse = GrandPianoMapper.detectSparseSampling(wurlitzerNotes);
      expect(isSparse).toBe(false);
    });

    it('should detect sparse even with multiple octaves', () => {
      const notes = new Set([
        // Octave 3 - sparse
        'A3',
        'C3',
        'Ds3',
        'Fs3',
        // Octave 4 - sparse
        'A4',
        'C4',
        'Ds4',
        'Fs4',
        // Octave 5 - sparse
        'A5',
        'C5',
        'Ds5',
        'Fs5',
      ]);

      const isSparse = GrandPianoMapper.detectSparseSampling(notes);
      expect(isSparse).toBe(true);
    });

    it('should detect full chromatic if ANY octave has all 12 notes', () => {
      const notes = new Set([
        // Octave 3 - sparse
        'A3',
        'C3',
        'Ds3',
        'Fs3',
        // Octave 4 - FULL chromatic (this makes it non-sparse)
        'C4',
        'Cs4',
        'D4',
        'Ds4',
        'E4',
        'F4',
        'Fs4',
        'G4',
        'Gs4',
        'A4',
        'As4',
        'B4',
      ]);

      const isSparse = GrandPianoMapper.detectSparseSampling(notes);
      expect(isSparse).toBe(false);
    });

    it('should handle empty set', () => {
      const emptyNotes = new Set<string>();
      const isSparse = GrandPianoMapper.detectSparseSampling(emptyNotes);
      expect(isSparse).toBe(false);
    });

    it('should handle invalid note names gracefully', () => {
      const invalidNotes = new Set(['invalid', 'C', 'note']);
      const isSparse = GrandPianoMapper.detectSparseSampling(invalidNotes);
      // Should not crash, invalid notes filtered out → empty map → sparse (true)
      expect(isSparse).toBe(true);
    });
  });

  // ============================================================================
  // HELPER - Get Note Names From Buffers
  // ============================================================================
  describe('getNoteNamesFromBuffers', () => {
    it('should extract note names from buffer map', () => {
      const bufferMap = new Map<string, Map<string, AudioBuffer>>([
        [
          'v1',
          new Map([
            ['C4', {} as AudioBuffer],
            ['D4', {} as AudioBuffer],
          ]),
        ],
        [
          'v2',
          new Map([
            ['C4', {} as AudioBuffer],
            ['E4', {} as AudioBuffer],
          ]),
        ],
      ]);

      const noteNames = GrandPianoMapper.getNoteNamesFromBuffers(bufferMap);
      expect(noteNames).toEqual(new Set(['C4', 'D4', 'E4']));
    });

    it('should handle empty buffer map', () => {
      const emptyMap = new Map<string, Map<string, AudioBuffer>>();
      const noteNames = GrandPianoMapper.getNoteNamesFromBuffers(emptyMap);
      expect(noteNames).toEqual(new Set());
    });

    it('should deduplicate note names across velocity layers', () => {
      const bufferMap = new Map<string, Map<string, AudioBuffer>>([
        [
          'v1',
          new Map([
            ['C4', {} as AudioBuffer],
            ['D4', {} as AudioBuffer],
          ]),
        ],
        [
          'v2',
          new Map([
            ['C4', {} as AudioBuffer], // Duplicate
            ['D4', {} as AudioBuffer], // Duplicate
          ]),
        ],
      ]);

      const noteNames = GrandPianoMapper.getNoteNamesFromBuffers(bufferMap);
      expect(noteNames.size).toBe(2); // Only unique notes
      expect(noteNames).toEqual(new Set(['C4', 'D4']));
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    beforeEach(() => {
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should return null for note not in keyboard map', () => {
      const mapping = mapper.mapNote('Z9'); // Invalid note
      expect(mapping).toBeNull();
    });

    it('should handle lowercase note names (case-sensitive)', () => {
      const mapping = mapper.mapNote('c4'); // lowercase
      expect(mapping).toBeNull(); // Map uses 'C4'
    });

    it('should handle sharp notation variations (Cs vs C#)', () => {
      // Map uses 'Cs4', not 'C#4'
      const mapping = mapper.mapNote('Cs4');
      expect(mapping).not.toBeNull();

      const mappingSharp = mapper.mapNote('C#4');
      expect(mappingSharp).toBeNull(); // Not in map
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================
  describe('Real-World Scenarios', () => {
    beforeEach(() => {
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should map a C major chord (C4, E4, G4)', () => {
      const c4 = mapper.mapNote('C4');
      expect(c4?.sample).toBe('C4');
      expect(c4?.playbackRate).toBe(1.0);

      const e4 = mapper.mapNote('E4');
      expect(e4?.sample).toBe('Ds4'); // Pitch-shifted
      expect(e4?.playbackRate).toBeCloseTo(1.059, 3);

      const g4 = mapper.mapNote('G4');
      expect(g4?.sample).toBe('Fs4'); // Pitch-shifted
      expect(g4?.playbackRate).toBeCloseTo(1.059, 3);
    });

    it('should map a D minor chord (D4, F4, A4)', () => {
      const d4 = mapper.mapNote('D4');
      expect(d4?.sample).toBe('Ds4'); // Pitch-shifted down
      expect(d4?.playbackRate).toBeCloseTo(0.944, 3);

      const f4 = mapper.mapNote('F4');
      expect(f4?.sample).toBe('Fs4'); // Pitch-shifted down
      expect(f4?.playbackRate).toBeCloseTo(0.944, 3);

      const a4 = mapper.mapNote('A4');
      expect(a4?.sample).toBe('A4'); // Exact match
      expect(a4?.playbackRate).toBe(1.0);
    });

    it('should map low bass notes (octave 3)', () => {
      const a3 = mapper.mapNote('A3');
      expect(a3?.sample).toBe('A3');
      expect(a3?.playbackRate).toBe(1.0);

      const c3 = mapper.mapNote('C3');
      expect(c3?.sample).toBe('C3');
      expect(c3?.playbackRate).toBe(1.0);
    });
  });
});
