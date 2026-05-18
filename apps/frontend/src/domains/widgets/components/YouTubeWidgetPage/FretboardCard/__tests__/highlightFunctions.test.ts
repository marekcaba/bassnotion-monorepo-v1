import { describe, it, expect } from 'vitest';
import type { ExerciseNote } from '@/domains/playback/types/exercise.types';
import type { Fret } from '../types';

/**
 * Tests for the highlight helper functions used in FretboardGrid
 *
 * These functions determine:
 * 1. isDotPlayedInCurrentMeasure - Has a note at this position been played?
 * 2. isDotInNextMeasure - Does a note exist at this position in the next measure?
 *
 * These are critical for the "highlighting wave" effect and avoiding flicker.
 */

// Helper to create exercise notes for testing
function createExerciseNote(
  measure: number,
  beat: number,
  stringIndex: number,
  fret: number | 'open',
  noteIndex: number,
): ExerciseNote {
  return {
    id: `note-${noteIndex}`,
    string: stringIndex + 1,
    fret: fret === 'open' ? 0 : fret,
    duration: 1,
    position: {
      measure,
      beat,
      subdivision: 0,
    },
  };
}

// Build position to note indices map (same logic as FretboardGrid)
function buildPositionToNoteIndices(
  exerciseNotes: ExerciseNote[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();

  exerciseNotes.forEach((note, index) => {
    // Convert 1-based string to 0-based stringIndex
    const stringIndex = note.string - 1;
    // Handle fret 0 as 'open'
    const fret = note.fret === 0 ? 'open' : note.fret;
    const positionKey = `${stringIndex},${fret}`;

    const existing = map.get(positionKey) || [];
    existing.push(index);
    map.set(positionKey, existing);
  });

  return map;
}

// Extracted logic from FretboardGrid for testing
function isDotPlayedInCurrentMeasure(
  stringIndex: number,
  fret: Fret,
  measure: number,
  nextNoteToPlay: { noteIndex: number } | null,
  positionToNoteIndices: Map<string, number[]>,
  exerciseNotes: ExerciseNote[],
): boolean {
  if (!nextNoteToPlay) {
    return false;
  }

  const positionKey = `${stringIndex},${fret}`;
  const noteIndices = positionToNoteIndices.get(positionKey);

  if (!noteIndices || noteIndices.length === 0) {
    return false;
  }

  for (const noteIdx of noteIndices) {
    const note = exerciseNotes[noteIdx];
    const noteMeasure = note?.position?.measure ?? 0;

    if (noteMeasure === measure) {
      if (noteIdx < nextNoteToPlay.noteIndex) {
        return true;
      }
    }
  }

  return false;
}

// Extracted logic from FretboardGrid for testing
function isDotInNextMeasure(
  stringIndex: number,
  fret: Fret,
  measure: number,
  positionToNoteIndices: Map<string, number[]>,
  exerciseNotes: ExerciseNote[],
): boolean {
  const positionKey = `${stringIndex},${fret}`;
  const noteIndices = positionToNoteIndices.get(positionKey);

  if (!noteIndices || noteIndices.length === 0) {
    return false;
  }

  const nextMeasure0Based = measure + 1;

  for (const noteIdx of noteIndices) {
    const note = exerciseNotes[noteIdx];
    const noteMeasure = note?.position?.measure ?? 0;

    if (noteMeasure === nextMeasure0Based) {
      return true;
    }
  }

  return false;
}

describe('isDotPlayedInCurrentMeasure', () => {
  // Create test exercise:
  // Measure 0: note 0 at (0,3), note 1 at (1,3)
  // Measure 1: note 2 at (2,1), note 3 at (2,2)
  // Measure 2: note 4 at (1,3), note 5 at (3,3) - Note: (1,3) also in measure 0
  const exerciseNotes: ExerciseNote[] = [
    createExerciseNote(0, 0, 0, 3, 0), // note 0
    createExerciseNote(0, 2, 1, 3, 1), // note 1
    createExerciseNote(1, 0, 2, 1, 2), // note 2
    createExerciseNote(1, 2, 2, 2, 3), // note 3
    createExerciseNote(2, 0, 1, 3, 4), // note 4 - same position as note 1
    createExerciseNote(2, 2, 3, 3, 5), // note 5
  ];

  const positionMap = buildPositionToNoteIndices(exerciseNotes);

  describe('when nextNoteToPlay is null', () => {
    it('should return false for any position', () => {
      expect(
        isDotPlayedInCurrentMeasure(0, 3, 0, null, positionMap, exerciseNotes),
      ).toBe(false);
    });
  });

  describe('in measure 0', () => {
    it('should return false when on note 0 (nothing played yet)', () => {
      const result = isDotPlayedInCurrentMeasure(
        0,
        3,
        0,
        { noteIndex: 0 },
        positionMap,
        exerciseNotes,
      );
      expect(result).toBe(false);
    });

    it('should return true for note 0 position when on note 1', () => {
      const result = isDotPlayedInCurrentMeasure(
        0,
        3,
        0,
        { noteIndex: 1 },
        positionMap,
        exerciseNotes,
      );
      expect(result).toBe(true);
    });

    it('should return true for both notes when moving to measure 1', () => {
      // When nextNoteToPlay is note 2 (first of measure 1)
      const note0Played = isDotPlayedInCurrentMeasure(
        0,
        3,
        0,
        { noteIndex: 2 },
        positionMap,
        exerciseNotes,
      );
      const note1Played = isDotPlayedInCurrentMeasure(
        1,
        3,
        0,
        { noteIndex: 2 },
        positionMap,
        exerciseNotes,
      );
      expect(note0Played).toBe(true);
      expect(note1Played).toBe(true);
    });
  });

  describe('in measure 1', () => {
    it('should return false for measure 0 notes (different measure)', () => {
      const result = isDotPlayedInCurrentMeasure(
        0,
        3,
        1, // Checking measure 0 note but currentMeasure is 1
        { noteIndex: 2 },
        positionMap,
        exerciseNotes,
      );
      expect(result).toBe(false);
    });

    it('should return false when on first note of measure 1', () => {
      const result = isDotPlayedInCurrentMeasure(
        2,
        1,
        1,
        { noteIndex: 2 },
        positionMap,
        exerciseNotes,
      );
      expect(result).toBe(false);
    });

    it('should return true for first note when on second note', () => {
      const result = isDotPlayedInCurrentMeasure(
        2,
        1,
        1,
        { noteIndex: 3 },
        positionMap,
        exerciseNotes,
      );
      expect(result).toBe(true);
    });
  });

  describe('with notes appearing in multiple measures', () => {
    it('should only mark as played in the current measure context', () => {
      // Position (1,3) appears in both measure 0 (note 1) and measure 2 (note 4)

      // In measure 0, when past note 1
      const playedInMeasure0 = isDotPlayedInCurrentMeasure(
        1,
        3,
        0,
        { noteIndex: 2 }, // Past note 1
        positionMap,
        exerciseNotes,
      );
      expect(playedInMeasure0).toBe(true);

      // In measure 2, when on note 4 (same position but different measure)
      const playedInMeasure2 = isDotPlayedInCurrentMeasure(
        1,
        3,
        2,
        { noteIndex: 4 }, // On note 4
        positionMap,
        exerciseNotes,
      );
      expect(playedInMeasure2).toBe(false); // Not played yet in measure 2

      // In measure 2, when past note 4
      const playedInMeasure2After = isDotPlayedInCurrentMeasure(
        1,
        3,
        2,
        { noteIndex: 5 }, // Past note 4
        positionMap,
        exerciseNotes,
      );
      expect(playedInMeasure2After).toBe(true);
    });
  });
});

describe('isDotInNextMeasure', () => {
  const exerciseNotes: ExerciseNote[] = [
    createExerciseNote(0, 0, 0, 3, 0),
    createExerciseNote(0, 2, 1, 3, 1),
    createExerciseNote(1, 0, 2, 1, 2),
    createExerciseNote(1, 2, 2, 2, 3),
    createExerciseNote(2, 0, 1, 3, 4), // Same position as note 1
    createExerciseNote(2, 2, 3, 3, 5),
  ];

  const positionMap = buildPositionToNoteIndices(exerciseNotes);

  describe('in measure 0', () => {
    it('should return true for measure 1 notes', () => {
      expect(isDotInNextMeasure(2, 1, 0, positionMap, exerciseNotes)).toBe(
        true,
      );
      expect(isDotInNextMeasure(2, 2, 0, positionMap, exerciseNotes)).toBe(
        true,
      );
    });

    it('should return false for measure 0 notes', () => {
      expect(isDotInNextMeasure(0, 3, 0, positionMap, exerciseNotes)).toBe(
        false,
      );
    });

    it('should return false for measure 2 notes (too far ahead)', () => {
      expect(isDotInNextMeasure(3, 3, 0, positionMap, exerciseNotes)).toBe(
        false,
      );
    });
  });

  describe('in measure 1', () => {
    it('should return true for measure 2 notes', () => {
      expect(isDotInNextMeasure(1, 3, 1, positionMap, exerciseNotes)).toBe(
        true,
      ); // Note 4
      expect(isDotInNextMeasure(3, 3, 1, positionMap, exerciseNotes)).toBe(
        true,
      ); // Note 5
    });

    it('should return false for measure 1 notes (current measure)', () => {
      expect(isDotInNextMeasure(2, 1, 1, positionMap, exerciseNotes)).toBe(
        false,
      );
    });

    it('should return false for measure 0 notes (past)', () => {
      expect(isDotInNextMeasure(0, 3, 1, positionMap, exerciseNotes)).toBe(
        false,
      );
    });
  });

  describe('with notes in multiple measures', () => {
    it('should return true for (1,3) in measure 1 since it exists in measure 2', () => {
      // Position (1,3) has notes in measure 0 and 2
      // When in measure 1, next measure is 2, so it should return true
      expect(isDotInNextMeasure(1, 3, 1, positionMap, exerciseNotes)).toBe(
        true,
      );
    });

    it('should return false for (1,3) in measure 0 since next is measure 1', () => {
      // Position (1,3) has notes in measure 0 and 2 (NOT measure 1)
      expect(isDotInNextMeasure(1, 3, 0, positionMap, exerciseNotes)).toBe(
        false,
      );
    });
  });
});

describe('shouldShowAsHighlighted logic', () => {
  // Test the combined logic:
  // shouldShowAsHighlighted = isSelected && measureHighlight.shouldHighlight &&
  //   (!hasBeenPlayedInCurrentMeasure || positionExistsInNextMeasure)

  const exerciseNotes: ExerciseNote[] = [
    createExerciseNote(0, 0, 0, 3, 0),
    createExerciseNote(0, 2, 1, 3, 1),
    createExerciseNote(1, 0, 1, 3, 2), // Same position as note 1, different measure
    createExerciseNote(1, 2, 2, 2, 3),
  ];

  const positionMap = buildPositionToNoteIndices(exerciseNotes);

  function shouldShowAsHighlighted(
    isSelected: boolean,
    measureHighlightShouldHighlight: boolean,
    hasBeenPlayedInCurrentMeasure: boolean,
    positionExistsInNextMeasure: boolean,
  ): boolean {
    return (
      isSelected &&
      measureHighlightShouldHighlight &&
      (!hasBeenPlayedInCurrentMeasure || positionExistsInNextMeasure)
    );
  }

  describe('basic cases', () => {
    it('should not highlight if not selected', () => {
      expect(shouldShowAsHighlighted(false, true, false, false)).toBe(false);
    });

    it('should not highlight if measureHighlight says no', () => {
      expect(shouldShowAsHighlighted(true, false, false, false)).toBe(false);
    });

    it('should highlight if selected, in measure, and not played', () => {
      expect(shouldShowAsHighlighted(true, true, false, false)).toBe(true);
    });

    it('should NOT highlight if played and NOT in next measure', () => {
      expect(shouldShowAsHighlighted(true, true, true, false)).toBe(false);
    });

    it('should highlight if played BUT ALSO in next measure', () => {
      // This is the 30% preview case
      expect(shouldShowAsHighlighted(true, true, true, true)).toBe(true);
    });
  });

  describe('measure transition scenario', () => {
    it('should handle position (1,3) which appears in measure 0 and 1', () => {
      // When in measure 0, playing note 1:
      // - Position (1,3) is selected
      // - measureHighlight says shouldHighlight=true (it's in current measure)
      // - hasBeenPlayedInCurrentMeasure = false (we're on note 1)
      // - positionExistsInNextMeasure = true (note 2 is at same position in measure 1)
      expect(shouldShowAsHighlighted(true, true, false, true)).toBe(true);

      // When note 1 finishes and we move to note 2:
      // - hasBeenPlayedInCurrentMeasure = true (note 1 is now played)
      // - positionExistsInNextMeasure = true (it's in measure 1)
      // Should STILL show as highlighted (30% preview)
      expect(shouldShowAsHighlighted(true, true, true, true)).toBe(true);
    });

    it('should NOT flash when transitioning measures', () => {
      // The key scenario:
      // 1. We're at end of measure 0
      // 2. Position (1,3) has note 1 (measure 0) and note 2 (measure 1)
      // 3. When note 1 is played, we should see:
      //    - If currentMeasure is still 0: played=true, inNext=true → highlighted (30%)
      //    - If currentMeasure becomes 1: played=false (new measure), inNext=? → highlighted

      // The FLICKER would occur if:
      // - played becomes true
      // - But measure hasn't updated yet
      // - And inNext is calculated as false (wrong measure)

      // With correct implementation, inNext should always be calculated from same measure:
      const measure = 0;
      const hasBeenPlayed = isDotPlayedInCurrentMeasure(
        1,
        3,
        measure,
        { noteIndex: 2 },
        positionMap,
        exerciseNotes,
      );
      const inNext = isDotInNextMeasure(
        1,
        3,
        measure,
        positionMap,
        exerciseNotes,
      );

      // Note 1 is played (index 1 < 2), and note 2 is in measure 1 (next)
      expect(hasBeenPlayed).toBe(true);
      expect(inNext).toBe(true);

      // So it should still be highlighted
      expect(shouldShowAsHighlighted(true, true, hasBeenPlayed, inNext)).toBe(
        true,
      );
    });
  });
});

describe('Measure Consistency Tests', () => {
  // These tests verify that all measure-related calculations use the same value

  const exerciseNotes: ExerciseNote[] = [
    createExerciseNote(0, 0, 0, 3, 0),
    createExerciseNote(0, 2, 1, 3, 1),
    createExerciseNote(1, 0, 2, 1, 2),
    createExerciseNote(1, 2, 2, 2, 3),
  ];

  const positionMap = buildPositionToNoteIndices(exerciseNotes);

  it('should produce consistent results when measure is passed as parameter', () => {
    // Test that passing the same measure value produces correct results
    const currentMeasure = 0;
    const nextNoteToPlay = { noteIndex: 1 };

    // All calculations should use measure 0
    const played = isDotPlayedInCurrentMeasure(
      0,
      3,
      currentMeasure,
      nextNoteToPlay,
      positionMap,
      exerciseNotes,
    );
    const inNext = isDotInNextMeasure(
      0,
      3,
      currentMeasure,
      positionMap,
      exerciseNotes,
    );

    // Note 0 at (0,3) is in measure 0, and we're on note 1
    expect(played).toBe(true); // Note 0 has been played

    // Measure 1 doesn't have a note at (0,3)
    expect(inNext).toBe(false);
  });

  it('should never produce inconsistent states at measure boundaries', () => {
    // Simulate the exact moment of measure transition
    // currentMeasure = 1 (just transitioned from 0)
    // nextNoteToPlay = { noteIndex: 2 } (first note of measure 1)

    const currentMeasure = 1;
    const nextNoteToPlay = { noteIndex: 2 };

    // Check all positions with this consistent measure value
    const positions = [
      { s: 0, f: 3 as Fret }, // Measure 0 note
      { s: 1, f: 3 as Fret }, // Measure 0 note
      { s: 2, f: 1 as Fret }, // Measure 1 note
      { s: 2, f: 2 as Fret }, // Measure 1 note
    ];

    positions.forEach(({ s, f }) => {
      const played = isDotPlayedInCurrentMeasure(
        s,
        f,
        currentMeasure,
        nextNoteToPlay,
        positionMap,
        exerciseNotes,
      );
      const inNext = isDotInNextMeasure(
        s,
        f,
        currentMeasure,
        positionMap,
        exerciseNotes,
      );

      // In measure 1:
      // - Measure 0 notes should NOT be marked as "played in current measure" (they're in measure 0)
      // - Measure 1 notes should NOT be marked as played (we're on the first note)
      // - Only notes in measure 2 should be marked as "in next" (but there are none)

      if (s === 0 || (s === 1 && f === 3)) {
        // Measure 0 notes - not in current measure 1
        expect(played).toBe(false);
      }

      if (s === 2 && f === 1) {
        // First note of measure 1 - not played yet
        expect(played).toBe(false);
      }

      // No notes in measure 2, so inNext should be false for all
      expect(inNext).toBe(false);
    });
  });
});
