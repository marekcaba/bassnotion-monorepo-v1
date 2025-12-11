/**
 * Unit tests for ExerciseAnalyzer
 * Tests MIDI parsing and exercise-specific audio requirements analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExerciseAnalyzer } from '../ExerciseAnalyzer.js';
import { Exercise } from '@/domains/exercises/entities/exercise.entity.js';
import { ExerciseId } from '@/domains/exercises/value-objects/exercise-id.vo.js';
import { Difficulty } from '@/domains/exercises/value-objects/difficulty.vo.js';

describe('ExerciseAnalyzer', () => {
  let analyzer: ExerciseAnalyzer;

  beforeEach(() => {
    analyzer = new ExerciseAnalyzer();
  });

  describe('midiNumberToNoteName', () => {
    it('should convert MIDI note numbers to Salamander notation', () => {
      // Access private method for testing via any cast
      const converter = (analyzer as any).midiNumberToNoteName.bind(analyzer);

      expect(converter(60)).toBe('C4'); // Middle C
      expect(converter(61)).toBe('Cs4'); // C# (Salamander uses 's' for sharps)
      expect(converter(62)).toBe('D4');
      expect(converter(72)).toBe('C5'); // One octave up
      expect(converter(48)).toBe('C3'); // One octave down
    });

    it('should handle low and high MIDI notes', () => {
      const converter = (analyzer as any).midiNumberToNoteName.bind(analyzer);

      expect(converter(21)).toBe('A0'); // Bass range
      expect(converter(108)).toBe('C8'); // High range
    });
  });

  describe('determineVelocityLayers', () => {
    it('should return single layer for narrow velocity range', () => {
      const velocities = [0.65, 0.7, 0.72, 0.68]; // Range: 0.07 (< 0.3)
      const layers = analyzer.determineVelocityLayers(velocities);

      expect(layers).toHaveLength(1);
      expect(layers[0]).toBe('v10'); // Medium velocity
    });

    it('should return soft layer for low velocities', () => {
      const velocities = [0.2, 0.25, 0.3, 0.35]; // Avg: 0.275 (< 0.4)
      const layers = analyzer.determineVelocityLayers(velocities);

      expect(layers).toHaveLength(1);
      expect(layers[0]).toBe('v6'); // Soft
    });

    it('should return loud layer for high velocities', () => {
      const velocities = [0.8, 0.85, 0.9, 0.95]; // Avg: 0.875 (> 0.7)
      const layers = analyzer.determineVelocityLayers(velocities);

      expect(layers).toHaveLength(1);
      expect(layers[0]).toBe('v14'); // Loud
    });

    it('should return 2 layers for medium velocity range', () => {
      const velocities = [0.4, 0.5, 0.6, 0.7]; // Range: 0.3, Avg: 0.55
      const layers = analyzer.determineVelocityLayers(velocities);

      expect(layers).toHaveLength(2);
      expect(layers).toEqual(['v10', 'v14']); // Medium to loud
    });

    it('should return 3 layers for wide velocity range', () => {
      const velocities = [0.2, 0.5, 0.8]; // Range: 0.6 (>= 0.5)
      const layers = analyzer.determineVelocityLayers(velocities);

      expect(layers).toHaveLength(3);
      expect(layers).toContain('v6'); // Soft
      expect(layers).toContain('v10'); // Medium
      expect(layers).toContain('v14'); // Loud
    });

    it('should handle empty velocity array', () => {
      const layers = analyzer.determineVelocityLayers([]);
      expect(layers).toEqual(['v10']); // Default to medium
    });
  });

  describe('analyzeExercise', () => {
    it('should analyze exercise with bass notes from fretboard', async () => {
      const exercise = Exercise.create({
        id: ExerciseId.create('test-1'),
        title: 'Test Exercise',
        description: 'Test',
        difficulty: Difficulty.fromString('beginner'),
        duration: 8,
        bpm: 120,
        key: 'C',
        notes: [
          {
            id: 'note-1',
            string: 1,
            fret: 5,
            note: 'D2',
            color: 'red',
            duration: 'quarter',
            position: { measure: 1, beat: 1, subdivision: 0 },
          },
          {
            id: 'note-2',
            string: 2,
            fret: 7,
            note: 'A2',
            color: 'blue',
            duration: 'quarter',
            position: { measure: 1, beat: 2, subdivision: 0 },
          },
        ],
        tags: [],
        isActive: true,
      });

      const requirements = await analyzer.analyzeExercise(exercise);

      // Should identify bass notes from fretboard
      expect(requirements.bass.notes).toContain('D2');
      expect(requirements.bass.notes).toContain('A2');
      expect(requirements.bass.bufferCount).toBe(2); // 2 notes × 1 articulation
      expect(requirements.bass.articulations).toEqual(['normal']);

      // Should have memory estimate
      expect(requirements.totalMemoryMB).toBeGreaterThan(0);
    });

    it('should handle exercise with no notes', async () => {
      const exercise = Exercise.create({
        id: ExerciseId.create('test-2'),
        title: 'Empty Exercise',
        description: 'Test',
        difficulty: Difficulty.fromString('beginner'),
        duration: 8,
        bpm: 120,
        key: 'C',
        notes: [],
        tags: [],
        isActive: true,
      });

      const requirements = await analyzer.analyzeExercise(exercise);

      // No bass notes
      expect(requirements.bass.notes).toHaveLength(0);
      expect(requirements.bass.bufferCount).toBe(0);

      // No harmony notes (no MIDI)
      expect(requirements.harmony.notes).toHaveLength(0);
      expect(requirements.harmony.bufferCount).toBe(0);
    });

    it('should estimate memory requirements correctly', async () => {
      const exercise = Exercise.create({
        id: ExerciseId.create('test-3'),
        title: 'Memory Test',
        description: 'Test',
        difficulty: Difficulty.fromString('intermediate'),
        duration: 8,
        bpm: 120,
        key: 'C',
        notes: [
          {
            id: '1',
            string: 1,
            fret: 5,
            note: 'D2',
            color: 'red',
            duration: 'quarter',
            position: { measure: 1, beat: 1, subdivision: 0 },
          },
          {
            id: '2',
            string: 1,
            fret: 7,
            note: 'E2',
            color: 'blue',
            duration: 'quarter',
            position: { measure: 1, beat: 2, subdivision: 0 },
          },
          {
            id: '3',
            string: 2,
            fret: 5,
            note: 'A2',
            color: 'green',
            duration: 'quarter',
            position: { measure: 1, beat: 3, subdivision: 0 },
          },
        ],
        tags: [],
        isActive: true,
      });

      const requirements = await analyzer.analyzeExercise(exercise);

      // 3 bass notes × 1 articulation × ~50KB = ~0.15 MB
      expect(requirements.totalMemoryMB).toBeGreaterThan(0);
      expect(requirements.totalMemoryMB).toBeLessThan(5); // Should be efficient
    });

    it('should handle MIDI parsing errors gracefully', async () => {
      // Mock fetch to simulate MIDI parsing error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const exercise = Exercise.create({
        id: ExerciseId.create('test-4'),
        title: 'MIDI Error Test',
        description: 'Test',
        difficulty: Difficulty.fromString('beginner'),
        duration: 8,
        bpm: 120,
        key: 'C',
        notes: [],
        tags: [],
        isActive: true,
        harmonyMidiUrl: 'https://example.com/harmony.mid',
      });

      const requirements = await analyzer.analyzeExercise(exercise);

      // Should return empty harmony requirements on error
      expect(requirements.harmony.notes).toHaveLength(0);
      expect(requirements.harmony.bufferCount).toBe(0);
    });
  });

  describe('extractNotesFromMidi', () => {
    it('should extract unique notes from MIDI data', () => {
      // Create mock MIDI structure
      const mockMidi = {
        tracks: [
          {
            notes: [
              { midi: 60, velocity: 0.7 }, // C4
              { midi: 64, velocity: 0.8 }, // E4
              { midi: 67, velocity: 0.75 }, // G4
              { midi: 60, velocity: 0.6 }, // C4 again (duplicate)
            ],
          },
        ],
      };

      const noteSet = new Set<string>();
      const velocities: number[] = [];

      (analyzer as any).extractNotesFromMidi(mockMidi, noteSet, velocities);

      // Should extract unique notes
      expect(noteSet.size).toBe(3); // C4, E4, G4 (no duplicate)
      expect(noteSet.has('C4')).toBe(true);
      expect(noteSet.has('E4')).toBe(true);
      expect(noteSet.has('G4')).toBe(true);

      // Should collect all velocities (including duplicate note)
      expect(velocities).toHaveLength(4);
      expect(velocities).toEqual([0.7, 0.8, 0.75, 0.6]);
    });
  });
});
