import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMeasureOpacity from '../hooks/useMeasureOpacity';
import type { ExerciseNote } from '@/domains/playback/types/exercise.types';

/**
 * Comprehensive tests for useMeasureOpacity hook
 *
 * This hook is responsible for:
 * 1. Determining which notes should be highlighted based on current measure
 * 2. Managing opacity for current (100%) and next (30%) measure notes
 * 3. Handling measure transitions without flicker
 *
 * String mapping for 4-string bass (default):
 * - string 1 (G) -> stringIndex 4 (5 - 1)
 * - string 2 (D) -> stringIndex 3 (5 - 2)
 * - string 3 (A) -> stringIndex 2 (5 - 3)
 * - string 4 (E) -> stringIndex 1 (5 - 4)
 */

// Helper to create exercise notes for testing
// Note: string is 1-based (1=G, 2=D, 3=A, 4=E for 4-string bass)
function createExerciseNote(
  measure: number,
  beat: number,
  string: number, // 1-based string number
  fret: number,
  noteIndex: number
): ExerciseNote {
  return {
    id: `note-${noteIndex}`,
    string, // 1-based string number
    fret,
    duration: 1,
    position: {
      measure,
      beat,
      subdivision: 0,
    },
  };
}

// Calculate the stringIndex from 1-based string number (for 4-string bass)
function stringToIndex(string: number): number {
  return 5 - string; // string 1 -> 4, string 2 -> 3, etc.
}

// Create a simple exercise with notes in each measure
// For testing, we use simple positions that are easy to track
function createTestExercise(): ExerciseNote[] {
  const notes: ExerciseNote[] = [];
  let noteIndex = 0;

  // Measure 0: Notes on string 1 (G) fret 3, string 2 (D) fret 3
  notes.push(createExerciseNote(0, 0, 1, 3, noteIndex++)); // stringIndex=4, fret=3
  notes.push(createExerciseNote(0, 2, 2, 3, noteIndex++)); // stringIndex=3, fret=3

  // Measure 1: Notes on string 3 (A) fret 1, fret 2
  notes.push(createExerciseNote(1, 0, 3, 1, noteIndex++)); // stringIndex=2, fret=1
  notes.push(createExerciseNote(1, 2, 3, 2, noteIndex++)); // stringIndex=2, fret=2

  // Measure 2: Notes on string 2 (D) fret 3 (same as measure 0!), string 4 (E) fret 3
  notes.push(createExerciseNote(2, 0, 2, 3, noteIndex++)); // stringIndex=3, fret=3 - SAME AS MEASURE 0
  notes.push(createExerciseNote(2, 2, 4, 3, noteIndex++)); // stringIndex=1, fret=3

  // Measure 3: Notes on string 1 fret 5, string 2 fret 5
  notes.push(createExerciseNote(3, 0, 1, 5, noteIndex++)); // stringIndex=4, fret=5
  notes.push(createExerciseNote(3, 2, 2, 5, noteIndex++)); // stringIndex=3, fret=5

  return notes;
}

describe('useMeasureOpacity', () => {
  // SINGLE SOURCE OF TRUTH FIX: currentMeasure is now required (0-based)
  // It comes from useFretboardNoteSync.getCurrentMeasure() at 60fps during playback
  const defaultProps = {
    exerciseNotes: createTestExercise(),
    currentTime: 0,
    isPlaying: false,
    tempo: 120, // 120 BPM = 500ms per beat, 2000ms per measure (4/4)
    timeSignature: { numerator: 4, denominator: 4 },
    stringCount: 4 as const,
    currentMeasure: 0, // Default to measure 0 (0-based)
  };

  describe('getMeasureHighlight', () => {
    // NOTE: getMeasureHighlight now requires 3 parameters: (stringIndex, fret, measure)
    // The measure parameter is explicitly passed to avoid stale closure issues.

    describe('when not playing', () => {
      it('should highlight notes in measure 0 as current', () => {
        const { result } = renderHook(() => useMeasureOpacity(defaultProps));

        // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
        // Pass measure 0 (from defaultProps.currentMeasure)
        const highlight = result.current.getMeasureHighlight(4, 3, 0);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('current');
        expect(highlight.opacity).toBe(1.0);
      });

      it('should highlight notes in measure 1 as next', () => {
        const { result } = renderHook(() => useMeasureOpacity(defaultProps));

        // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
        // Current is measure 0, so measure 1 notes should be 'next'
        const highlight = result.current.getMeasureHighlight(2, 1, 0);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('next');
        expect(highlight.opacity).toBe(0.3);
      });

      it('should mark notes in measure 2+ as other (not highlighted)', () => {
        const { result } = renderHook(() => useMeasureOpacity(defaultProps));

        // Measure 2: string 4 (E), fret 3 → stringIndex = 5 - 4 = 1
        // Current is measure 0, so measure 2 notes should be 'other'
        const highlight = result.current.getMeasureHighlight(1, 3, 0);
        expect(highlight.shouldHighlight).toBe(false);
        expect(highlight.state).toBe('other');
      });

      it('should return not highlighted for positions with no notes', () => {
        const { result } = renderHook(() => useMeasureOpacity(defaultProps));

        // Position (4,10) has no notes in any measure
        const highlight = result.current.getMeasureHighlight(4, 10, 0);
        expect(highlight.shouldHighlight).toBe(false);
        expect(highlight.state).toBe('other');
      });
    });

    describe('when playing in measure 0', () => {
      it('should highlight measure 0 notes as current at 100% opacity', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 500, // 500ms into measure 0
            currentMeasure: 0, // Explicitly in measure 0
          })
        );

        // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
        const highlight = result.current.getMeasureHighlight(4, 3, 0);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('current');
        expect(highlight.opacity).toBe(1.0);
      });

      it('should highlight measure 1 notes as next at 30% opacity', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 500,
            currentMeasure: 0, // Explicitly in measure 0
          })
        );

        // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
        const highlight = result.current.getMeasureHighlight(2, 1, 0);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('next');
        expect(highlight.opacity).toBe(0.3);
      });
    });

    describe('when playing in measure 1', () => {
      it('should highlight measure 1 notes as current', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 2500, // 500ms into measure 1 (measure 0 = 0-2000ms)
            currentMeasure: 1, // Explicitly in measure 1 (0-based)
          })
        );

        // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
        const highlight = result.current.getMeasureHighlight(2, 1, 1);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('current');
      });

      it('should highlight measure 2 notes as next', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 2500,
            currentMeasure: 1, // Explicitly in measure 1 (0-based)
          })
        );

        // Measure 2: string 2 (D), fret 3 → stringIndex = 5 - 2 = 3
        const highlight = result.current.getMeasureHighlight(3, 3, 1);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('next');
      });

      it('should NOT highlight measure 0 notes (they are in the past)', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 2500,
            currentMeasure: 1, // Explicitly in measure 1 (0-based)
          })
        );

        // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
        const highlight = result.current.getMeasureHighlight(4, 3, 1);
        expect(highlight.shouldHighlight).toBe(false);
        expect(highlight.state).toBe('other');
      });
    });

    describe('with measureOverride parameter', () => {
      it('should use measureOverride instead of time-based calculation', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 500, // Would normally be measure 0
          })
        );

        // Pass measureOverride=1 to force measure 1 as current
        // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
        const highlight = result.current.getMeasureHighlight(2, 1, 1);
        expect(highlight.state).toBe('current'); // Should be current because override=1

        // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
        // Measure 0 note should now be 'other' (past)
        const measure0Highlight = result.current.getMeasureHighlight(4, 3, 1);
        expect(measure0Highlight.state).toBe('other');
      });

      it('should show measure 2 as next when override is 1', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 500,
          })
        );

        // Measure 2: string 2 (D), fret 3 → stringIndex = 5 - 2 = 3
        const highlight = result.current.getMeasureHighlight(3, 3, 1);
        expect(highlight.state).toBe('next'); // Measure 2 is next when override=1
      });
    });

    describe('notes appearing in multiple measures', () => {
      it('should handle position (3,3) which appears in both measure 0 and 2', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 500, // Measure 0
            currentMeasure: 0, // Explicitly in measure 0
          })
        );

        // String 2 (D), fret 3 → stringIndex = 5 - 2 = 3
        // In measure 0, (3,3) should be highlighted as current
        const highlight = result.current.getMeasureHighlight(3, 3, 0);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('current');
      });

      it('should show (3,3) as next when in measure 1', () => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            ...defaultProps,
            isPlaying: true,
            currentTime: 2500, // Time for beat calculation
            currentMeasure: 1, // Explicitly in measure 1 (0-based)
          })
        );

        // String 2 (D), fret 3 → stringIndex = 5 - 2 = 3
        // Position (3,3) exists in measure 2, which is next when current is 1
        const highlight = result.current.getMeasureHighlight(3, 3, 1);
        expect(highlight.shouldHighlight).toBe(true);
        expect(highlight.state).toBe('next');
      });
    });
  });

  describe('currentMeasure property', () => {
    // SINGLE SOURCE OF TRUTH FIX: The hook now returns the exact measure it receives (0-based)
    // Previously it calculated measure from time, but this caused desync with 60fps DOM updates.
    // Now the caller (FretboardGrid) is responsible for providing the correct measure.

    it('should return 0 when not playing (0-based, same as input)', () => {
      const { result } = renderHook(() => useMeasureOpacity(defaultProps));
      // Returns the same currentMeasure that was passed in (0)
      expect(result.current.currentMeasure).toBe(0);
    });

    it('should return the measure passed in (0-based)', () => {
      const { result } = renderHook(() =>
        useMeasureOpacity({
          ...defaultProps,
          isPlaying: true,
          currentTime: 2500, // Time is now only used for beat calculation
          currentMeasure: 1, // Measure 1 (0-based) - provided by caller
        })
      );
      expect(result.current.currentMeasure).toBe(1); // Returns what was passed in (0-based)
    });

    it('should always return the currentMeasure from config', () => {
      const { result } = renderHook(() =>
        useMeasureOpacity({
          ...defaultProps,
          isPlaying: true,
          currentTime: 500,
          currentMeasure: 2, // Measure 2 (0-based)
        })
      );
      expect(result.current.currentMeasure).toBe(2); // Returns what was passed in (0-based)
    });
  });
});

describe('Measure Transition Edge Cases', () => {
  const exerciseNotes = createTestExercise();
  const msPerMeasure = 2000; // 120 BPM, 4/4 time

  describe('at exact measure boundary', () => {
    it('should transition cleanly from measure 0 to 1', () => {
      // Just before transition (measure 0)
      const { result: beforeResult } = renderHook(() =>
        useMeasureOpacity({
          exerciseNotes,
          currentTime: 1999,
          isPlaying: true,
          tempo: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          stringCount: 4,
          currentMeasure: 0, // In measure 0 (0-based)
        })
      );

      // Just after transition (measure 1)
      const { result: afterResult } = renderHook(() =>
        useMeasureOpacity({
          exerciseNotes,
          currentTime: 2001,
          isPlaying: true,
          tempo: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          stringCount: 4,
          currentMeasure: 1, // In measure 1 (0-based)
        })
      );

      // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
      // Before: measure 0 note should be current
      expect(beforeResult.current.getMeasureHighlight(4, 3, 0).state).toBe('current');
      // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
      // Before: measure 1 note should be next
      expect(beforeResult.current.getMeasureHighlight(2, 1, 0).state).toBe('next');

      // After: measure 0 note should be other (past)
      expect(afterResult.current.getMeasureHighlight(4, 3, 1).state).toBe('other');
      // After: measure 1 note should be current
      expect(afterResult.current.getMeasureHighlight(2, 1, 1).state).toBe('current');
    });

    it('should never show notes from measure N-1 as highlighted when in measure N', () => {
      // Test at various points in measure 2 (0-based)
      const testTimes = [4001, 4500, 5000, 5500, 5999];

      testTimes.forEach((time) => {
        const { result } = renderHook(() =>
          useMeasureOpacity({
            exerciseNotes,
            currentTime: time,
            isPlaying: true,
            tempo: 120,
            timeSignature: { numerator: 4, denominator: 4 },
            stringCount: 4,
            currentMeasure: 2, // In measure 2 (0-based)
          })
        );

        // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4
        // Measure 0 notes should never be highlighted when in measure 2
        const measure0Highlight = result.current.getMeasureHighlight(4, 3, 2);
        expect(measure0Highlight.state).toBe('other');
        expect(measure0Highlight.shouldHighlight).toBe(false);

        // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2
        // Measure 1 notes should also not be highlighted when in measure 2
        const measure1Highlight = result.current.getMeasureHighlight(2, 1, 2);
        expect(measure1Highlight.state).toBe('other');
        expect(measure1Highlight.shouldHighlight).toBe(false);
      });
    });
  });

  describe('with currentMeasure synchronization', () => {
    it('should use currentMeasure prop for determining note states', () => {
      const currentTime = 2500; // Time is in measure 1 range

      // Hook uses the provided currentMeasure prop as SINGLE SOURCE OF TRUTH
      const { result } = renderHook(() =>
        useMeasureOpacity({
          exerciseNotes,
          currentTime,
          isPlaying: true,
          tempo: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          stringCount: 4,
          currentMeasure: 1, // Explicitly set to measure 1 (0-based)
        })
      );

      // currentMeasure should be exactly what we passed
      expect(result.current.currentMeasure).toBe(1);

      // Test positions based on the measure we're in
      // Measure 0: string 1 (G), fret 3 → stringIndex = 5 - 1 = 4 (should be 'other' - past)
      const measure0Note = result.current.getMeasureHighlight(4, 3, 1);
      expect(measure0Note.state).toBe('other');
      expect(measure0Note.shouldHighlight).toBe(false);

      // Measure 1: string 3 (A), fret 1 → stringIndex = 5 - 3 = 2 (should be 'current')
      const measure1Note = result.current.getMeasureHighlight(2, 1, 1);
      expect(measure1Note.state).toBe('current');
      expect(measure1Note.shouldHighlight).toBe(true);

      // Measure 2: string 2 (D), fret 3 → stringIndex = 5 - 2 = 3 (should be 'next')
      const measure2Note = result.current.getMeasureHighlight(3, 3, 1);
      expect(measure2Note.state).toBe('next');
      expect(measure2Note.shouldHighlight).toBe(true);
    });
  });
});
