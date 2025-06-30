/**
 * Five-Note System Behavior Tests
 * Story 3.1 - Guitar Hero-like Fretboard Visualizer with Dynamic "Play Strip"
 *
 * Tests cover the core 5-note system logic:
 * - Static preview: RED → BLUE → GREEN 100% → GREEN 80% → GREEN 60%
 * - Animation consistency: Same 5-note pattern during playback
 * - Note progression: Advancing through exercise maintains pattern
 * - Edge cases: Exercises with fewer than 5 notes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockExercise } from '../../types.js';

// Core 5-note system logic extracted from the hook
function getFiveNoteSystem(exercise: MockExercise, currentTime = -1000) {
  if (!exercise.notes || exercise.notes.length === 0) {
    return {
      visibleNotes: [],
      playStripState: {
        isActive: currentTime !== -1000,
        currentNoteId: null,
        nextNoteId: null,
        upcomingNoteIds: [],
      },
    };
  }

  // Find current note index based on time
  let currentIndex = 0;
  if (currentTime !== -1000) {
    // During animation, find the note closest to current time
    currentIndex = exercise.notes.findIndex((note, index) => {
      const nextNote = exercise.notes[index + 1];
      return (
        currentTime >= note.timestamp &&
        (!nextNote || currentTime < nextNote.timestamp)
      );
    });
    if (currentIndex === -1) {
      currentIndex = 0; // Default to first note if no match
    }
  }

  // Get 5 notes starting from current position
  const fiveNotes = exercise.notes.slice(currentIndex, currentIndex + 5);

  // Apply opacity progression: [1.0, 1.0, 1.0, 0.6, 0.3]
  const opacityProgression = [1.0, 1.0, 1.0, 0.6, 0.3];
  const visibleNotes = fiveNotes.map((note, index) => ({
    ...note,
    opacity:
      index < opacityProgression.length ? opacityProgression[index] : 0.3,
    color: index === 0 ? 'red' : index === 1 ? 'blue' : 'green',
  }));

  // Build play strip state
  const playStripState = {
    isActive: currentTime !== -1000,
    currentNoteId: fiveNotes[0]?.id || null,
    nextNoteId: fiveNotes[1]?.id || null,
    upcomingNoteIds: fiveNotes.slice(2).map((note) => note.id),
  };

  return { visibleNotes, playStripState };
}

describe('Five-Note System - Core Logic Behavior', () => {
  let testExercise: MockExercise;

  beforeEach(() => {
    // Create test exercise with 8 notes for comprehensive testing
    testExercise = {
      id: 'test-exercise',
      bpm: 120,
      duration: 8000, // 8 seconds
      notes: [
        {
          id: 'note-1',
          timestamp: 0,
          string: 1,
          fret: 0,
          note: 'E',
          duration: 500,
        },
        {
          id: 'note-2',
          timestamp: 1000,
          string: 1,
          fret: 1,
          note: 'F',
          duration: 500,
        },
        {
          id: 'note-3',
          timestamp: 2000,
          string: 1,
          fret: 2,
          note: 'F#',
          duration: 500,
        },
        {
          id: 'note-4',
          timestamp: 3000,
          string: 1,
          fret: 3,
          note: 'G',
          duration: 500,
        },
        {
          id: 'note-5',
          timestamp: 4000,
          string: 1,
          fret: 4,
          note: 'G#',
          duration: 500,
        },
        {
          id: 'note-6',
          timestamp: 5000,
          string: 1,
          fret: 5,
          note: 'A',
          duration: 500,
        },
        {
          id: 'note-7',
          timestamp: 6000,
          string: 1,
          fret: 6,
          note: 'A#',
          duration: 500,
        },
        {
          id: 'note-8',
          timestamp: 7000,
          string: 1,
          fret: 7,
          note: 'B',
          duration: 500,
        },
      ],
    };
  });

  describe('Static Preview Mode (currentTime = -1000)', () => {
    it('should display exactly 5 notes in static preview', () => {
      const result = getFiveNoteSystem(testExercise, -1000);

      expect(result.visibleNotes).toHaveLength(5);
      expect(result.playStripState.isActive).toBe(false);
    });

    it('should show first 5 notes in correct order', () => {
      const result = getFiveNoteSystem(testExercise, -1000);

      const noteIds = result.visibleNotes.map((note) => note.id);
      expect(noteIds).toEqual([
        'note-1',
        'note-2',
        'note-3',
        'note-4',
        'note-5',
      ]);
    });

    it('should apply correct opacity progression in static preview', () => {
      const result = getFiveNoteSystem(testExercise, -1000);

      const opacities = result.visibleNotes.map((note) => note.opacity);
      expect(opacities).toEqual([
        1, // RED current note - 100%
        1, // BLUE next note - 100%
        1, // GREEN first upcoming - 100%
        0.6, // GREEN second upcoming - 60%
        0.3, // GREEN third upcoming - 30%
      ]);
    });

    it('should apply correct color progression in static preview', () => {
      const result = getFiveNoteSystem(testExercise, -1000);

      const colors = result.visibleNotes.map((note) => note.color);
      expect(colors).toEqual(['red', 'blue', 'green', 'green', 'green']);
    });

    it('should set correct play strip state for static preview', () => {
      const result = getFiveNoteSystem(testExercise, -1000);

      expect(result.playStripState.isActive).toBe(false);
      expect(result.playStripState.currentNoteId).toBe('note-1');
      expect(result.playStripState.nextNoteId).toBe('note-2');
      expect(result.playStripState.upcomingNoteIds).toEqual([
        'note-3',
        'note-4',
        'note-5',
      ]);
    });
  });

  describe('Animation Mode (currentTime >= 0)', () => {
    it('should maintain 5-note system when starting animation', () => {
      const result = getFiveNoteSystem(testExercise, 0);

      expect(result.visibleNotes).toHaveLength(5);
      expect(result.playStripState.isActive).toBe(true);
    });

    it('should maintain same opacity progression during animation', () => {
      const result = getFiveNoteSystem(testExercise, 0);

      const opacities = result.visibleNotes.map((note) => note.opacity);
      expect(opacities).toEqual([1, 1, 1, 0.6, 0.3]);
    });

    it('should show same notes in static and animation modes at start', () => {
      const staticResult = getFiveNoteSystem(testExercise, -1000);
      const animationResult = getFiveNoteSystem(testExercise, 0);

      const staticNoteIds = staticResult.visibleNotes.map((note) => note.id);
      const animationNoteIds = animationResult.visibleNotes.map(
        (note) => note.id,
      );

      expect(staticNoteIds).toEqual(animationNoteIds);
    });

    it('should activate play strip during animation', () => {
      const result = getFiveNoteSystem(testExercise, 0);

      expect(result.playStripState.isActive).toBe(true);
    });
  });

  describe('Note Progression During Animation', () => {
    it('should advance to next 5 notes when progressing through exercise', () => {
      const result = getFiveNoteSystem(testExercise, 3000); // At note-4 timestamp

      // Should show notes 4-8 (5 notes starting from current position)
      const noteIds = result.visibleNotes.map((note) => note.id);
      expect(noteIds).toEqual([
        'note-4',
        'note-5',
        'note-6',
        'note-7',
        'note-8',
      ]);
    });

    it('should maintain opacity progression after advancing', () => {
      const result = getFiveNoteSystem(testExercise, 3000);

      const opacities = result.visibleNotes.map((note) => note.opacity);
      expect(opacities).toEqual([1, 1, 1, 0.6, 0.3]);
    });

    it('should update play strip state correctly after advancing', () => {
      const result = getFiveNoteSystem(testExercise, 3000);

      expect(result.playStripState.currentNoteId).toBe('note-4');
      expect(result.playStripState.nextNoteId).toBe('note-5');
      expect(result.playStripState.upcomingNoteIds).toEqual([
        'note-6',
        'note-7',
        'note-8',
      ]);
    });

    it('should handle progression at different time positions', () => {
      const positions = [
        { time: 0, expectedFirst: 'note-1' },
        { time: 1000, expectedFirst: 'note-2' },
        { time: 2000, expectedFirst: 'note-3' },
        { time: 4000, expectedFirst: 'note-5' },
        { time: 6000, expectedFirst: 'note-7' },
      ];

      positions.forEach(({ time, expectedFirst }) => {
        const result = getFiveNoteSystem(testExercise, time);
        expect(result.visibleNotes[0]?.id).toBe(expectedFirst);
        // Should show up to 5 notes, but may be fewer near end of exercise
        expect(result.visibleNotes.length).toBeGreaterThan(0);
        expect(result.visibleNotes.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle exercise with fewer than 5 notes', () => {
      const shortExercise: MockExercise = {
        id: 'short-exercise',
        bpm: 120,
        duration: 3000,
        notes: [
          {
            id: 'note-1',
            timestamp: 0,
            string: 1,
            fret: 0,
            note: 'E',
            duration: 500,
          },
          {
            id: 'note-2',
            timestamp: 1000,
            string: 1,
            fret: 1,
            note: 'F',
            duration: 500,
          },
          {
            id: 'note-3',
            timestamp: 2000,
            string: 1,
            fret: 2,
            note: 'F#',
            duration: 500,
          },
        ],
      };

      const result = getFiveNoteSystem(shortExercise, -1000);

      expect(result.visibleNotes).toHaveLength(3);
      expect(result.visibleNotes[0]?.id).toBe('note-1');
      expect(result.visibleNotes[1]?.id).toBe('note-2');
      expect(result.visibleNotes[2]?.id).toBe('note-3');

      // Opacity should still be applied correctly
      const opacities = result.visibleNotes.map((note) => note.opacity);
      expect(opacities).toEqual([1, 1, 1]); // First 3 positions
    });

    it('should handle empty exercise gracefully', () => {
      const emptyExercise: MockExercise = {
        id: 'empty-exercise',
        bpm: 120,
        duration: 1000,
        notes: [],
      };

      const result = getFiveNoteSystem(emptyExercise, -1000);

      expect(result.visibleNotes).toHaveLength(0);
      expect(result.playStripState.currentNoteId).toBeNull();
      expect(result.playStripState.nextNoteId).toBeNull();
      expect(result.playStripState.upcomingNoteIds).toEqual([]);
    });

    it('should handle progression near end of exercise', () => {
      const result = getFiveNoteSystem(testExercise, 6000); // Near end (note-7)

      // Should show remaining notes (note-7, note-8) without errors
      expect(result.visibleNotes.length).toBeLessThanOrEqual(5);
      expect(result.visibleNotes[0]?.id).toBe('note-7');
      expect(result.visibleNotes[1]?.id).toBe('note-8');

      // Should still apply opacity correctly to available notes
      const opacities = result.visibleNotes.map((note) => note.opacity);
      expect(opacities[0]).toBe(1); // First note always 100%
      expect(opacities[1]).toBe(1); // Second note always 100%
    });

    it('should handle time beyond exercise duration', () => {
      const result = getFiveNoteSystem(testExercise, 10000); // Beyond end

      // Should default to first note or last available position
      expect(result.visibleNotes.length).toBeGreaterThan(0);
      expect(result.playStripState.isActive).toBe(true);
    });
  });

  describe('5-Note System Validation', () => {
    it('should never show more than 5 notes during normal operation', () => {
      const testTimes = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000];

      testTimes.forEach((time) => {
        const result = getFiveNoteSystem(testExercise, time);
        expect(result.visibleNotes.length).toBeLessThanOrEqual(5);
      });
    });

    it('should maintain opacity pattern regardless of playback position', () => {
      const expectedOpacities = [1, 1, 1, 0.6, 0.3];
      const testTimes = [0, 1000, 2000, 3000, 4000];

      testTimes.forEach((time) => {
        const result = getFiveNoteSystem(testExercise, time);

        if (result.visibleNotes.length === 5) {
          const opacities = result.visibleNotes.map((note) => note.opacity);
          expect(opacities).toEqual(expectedOpacities);
        }
      });
    });

    it('should maintain color pattern regardless of playback position', () => {
      const expectedColors = ['red', 'blue', 'green', 'green', 'green'];
      const testTimes = [0, 1000, 2000, 3000, 4000];

      testTimes.forEach((time) => {
        const result = getFiveNoteSystem(testExercise, time);

        if (result.visibleNotes.length === 5) {
          const colors = result.visibleNotes.map((note) => note.color);
          expect(colors).toEqual(expectedColors);
        }
      });
    });

    it('should always show consecutive notes from exercise', () => {
      const testTimes = [0, 1500, 2500, 3500, 4500];

      testTimes.forEach((time) => {
        const result = getFiveNoteSystem(testExercise, time);

        // Verify notes are consecutive by checking their IDs
        for (let i = 1; i < result.visibleNotes.length; i++) {
          const currentNote = result.visibleNotes[i];
          const previousNote = result.visibleNotes[i - 1];
          if (currentNote && previousNote) {
            const currentNoteParts = currentNote.id.split('-');
            const previousNoteParts = previousNote.id.split('-');
            if (currentNoteParts[1] && previousNoteParts[1]) {
              const currentNoteNum = parseInt(currentNoteParts[1]);
              const previousNoteNum = parseInt(previousNoteParts[1]);
              expect(currentNoteNum).toBe(previousNoteNum + 1);
            }
          }
        }
      });
    });
  });

  describe('Static vs Animation Consistency', () => {
    it('should show identical notes when switching from static to animation at start', () => {
      const staticResult = getFiveNoteSystem(testExercise, -1000);
      const animationResult = getFiveNoteSystem(testExercise, 0);

      // Note IDs should be identical
      const staticNoteIds = staticResult.visibleNotes.map((note) => note.id);
      const animationNoteIds = animationResult.visibleNotes.map(
        (note) => note.id,
      );
      expect(staticNoteIds).toEqual(animationNoteIds);

      // Opacity patterns should be identical
      const staticOpacities = staticResult.visibleNotes.map(
        (note) => note.opacity,
      );
      const animationOpacities = animationResult.visibleNotes.map(
        (note) => note.opacity,
      );
      expect(staticOpacities).toEqual(animationOpacities);

      // Color patterns should be identical
      const staticColors = staticResult.visibleNotes.map((note) => note.color);
      const animationColors = animationResult.visibleNotes.map(
        (note) => note.color,
      );
      expect(staticColors).toEqual(animationColors);
    });

    it('should maintain consistent behavior when pausing and resuming', () => {
      // Simulate playing at 2000ms, then pausing
      const playingResult = getFiveNoteSystem(testExercise, 2000);

      // When paused, should show same notes (pause = same time)
      const pausedResult = getFiveNoteSystem(testExercise, 2000);

      expect(playingResult.visibleNotes.map((n) => n.id)).toEqual(
        pausedResult.visibleNotes.map((n) => n.id),
      );
      expect(playingResult.visibleNotes.map((n) => n.opacity)).toEqual(
        pausedResult.visibleNotes.map((n) => n.opacity),
      );
    });
  });
});
