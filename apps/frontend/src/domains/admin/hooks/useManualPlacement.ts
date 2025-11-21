import { useState, useCallback, useMemo } from 'react';
import type { ParsedMeasure, MidiNoteEvent } from './useMidiParsing';
import type { GeneratedExerciseNote } from './useMidiConversion';
import {
  validatePlacement,
  createExerciseNote,
  isMeasureComplete,
} from '../utils/fretboardCalculations';

/**
 * Placement for a single note (string + fret position)
 */
export interface NotePlacement {
  noteIndex: number; // Index within measure (0 = first note)
  string: number;
  fret: number;
}

/**
 * Hook for managing manual MIDI-to-fretboard placement state
 *
 * Tracks:
 * - Which measure is currently being edited
 * - Which notes have been placed in each measure
 * - Progress through the placement workflow
 */
export function useManualPlacement(
  measures: ParsedMeasure[],
  bassType: '4' | '5' | '6' = '4',
  existingNotes?: GeneratedExerciseNote[]
) {
  // Initialize placements from existing notes if provided
  const initialPlacements = useMemo(() => {
    if (!existingNotes || existingNotes.length === 0) {
      return new Map<number, Map<number, { string: number; fret: number }>>();
    }

    // Convert existing notes back to placements structure
    const placementsMap = new Map<number, Map<number, { string: number; fret: number }>>();

    existingNotes.forEach((note, index) => {
      const measureNumber = note.measureNumber || note.position.measure;
      if (!placementsMap.has(measureNumber)) {
        placementsMap.set(measureNumber, new Map());
      }

      // Find the note index within the measure
      const measure = measures.find(m => m.measureNumber === measureNumber);
      if (measure) {
        // Match note by position/timing to get the correct noteIndex
        const noteIndex = measure.notes.findIndex(midiNote =>
          midiNote.position.measure === note.position.measure &&
          midiNote.position.beat === note.position.beat &&
          midiNote.position.subdivision === note.position.subdivision
        );

        if (noteIndex >= 0) {
          placementsMap.get(measureNumber)!.set(noteIndex, {
            string: note.string,
            fret: note.fret,
          });
        }
      }
    });

    return placementsMap;
  }, [existingNotes, measures]);

  // Map of measureNumber -> Map of noteIndex -> {string, fret}
  const [placements, setPlacements] = useState<Map<number, Map<number, { string: number; fret: number }>>>(
    initialPlacements
  );

  // Current measure being edited (1-indexed)
  const [currentMeasureNumber, setCurrentMeasureNumber] = useState(1);

  /**
   * Get the current measure being edited
   */
  const currentMeasure = useMemo(() => {
    return measures.find((m) => m.measureNumber === currentMeasureNumber);
  }, [measures, currentMeasureNumber]);

  /**
   * Get placements for the current measure
   */
  const currentMeasurePlacements = useMemo(() => {
    return placements.get(currentMeasureNumber) || new Map();
  }, [placements, currentMeasureNumber]);

  /**
   * Get the index of the next note to place in current measure
   */
  const currentNoteIndex = useMemo(() => {
    if (!currentMeasure) return 0;

    const measurePlacements = placements.get(currentMeasureNumber) || new Map();

    // Find first note without placement
    for (let i = 0; i < currentMeasure.notes.length; i++) {
      if (!measurePlacements.has(i)) {
        return i;
      }
    }

    // All notes placed
    return currentMeasure.notes.length;
  }, [placements, currentMeasureNumber, currentMeasure]);

  /**
   * Get the current note to place (or undefined if measure complete)
   */
  const currentNote = useMemo(() => {
    if (!currentMeasure || currentNoteIndex >= currentMeasure.notes.length) {
      return undefined;
    }
    return currentMeasure.notes[currentNoteIndex];
  }, [currentMeasure, currentNoteIndex]);

  /**
   * Check if current measure is complete
   */
  const isCurrentMeasureComplete = useMemo(() => {
    if (!currentMeasure) return false;
    const measurePlacements = placements.get(currentMeasureNumber) || new Map();
    return isMeasureComplete(currentMeasure.notes.length, measurePlacements);
  }, [placements, currentMeasureNumber, currentMeasure]);

  /**
   * Check if all measures are complete
   */
  const areAllMeasuresComplete = useMemo(() => {
    return measures.every((measure) => {
      const measurePlacements = placements.get(measure.measureNumber) || new Map();
      return isMeasureComplete(measure.notes.length, measurePlacements);
    });
  }, [measures, placements]);

  /**
   * Get completion statistics
   */
  const stats = useMemo(() => {
    const totalNotes = measures.reduce((sum, m) => sum + m.notes.length, 0);
    let placedNotes = 0;

    measures.forEach((measure) => {
      const measurePlacements = placements.get(measure.measureNumber) || new Map();
      placedNotes += measurePlacements.size;
    });

    const completedMeasures = measures.filter((measure) => {
      const measurePlacements = placements.get(measure.measureNumber) || new Map();
      return isMeasureComplete(measure.notes.length, measurePlacements);
    }).length;

    return {
      totalNotes,
      placedNotes,
      completedMeasures,
      totalMeasures: measures.length,
      percentComplete: totalNotes > 0 ? Math.round((placedNotes / totalNotes) * 100) : 0,
    };
  }, [measures, placements]);

  /**
   * Place a note at a string/fret position
   * Note: We allow any placement - admin has full control
   */
  const placeNote = useCallback(
    (string: number, fret: number): boolean => {
      if (!currentNote || !currentMeasure) {
        console.warn('[useManualPlacement] Cannot place note: no current note or measure');
        return false;
      }

      // Optional: Warn if placement doesn't match expected pitch (but still allow it)
      const isValid = validatePlacement(currentNote.pitch, string, fret, bassType);
      if (!isValid) {
        console.log('[useManualPlacement] Placing note at non-standard position (admin override)', {
          notePitch: currentNote.pitch,
          noteName: currentNote.name,
          string,
          fret,
          bassType,
        });
      }

      // Add placement (always succeeds - admin knows what they're doing!)
      setPlacements((prev) => {
        const newPlacements = new Map(prev);
        const measurePlacements = new Map(newPlacements.get(currentMeasureNumber) || new Map());

        measurePlacements.set(currentNoteIndex, { string, fret });
        newPlacements.set(currentMeasureNumber, measurePlacements);

        return newPlacements;
      });

      return true;
    },
    [currentNote, currentMeasure, currentMeasureNumber, currentNoteIndex, bassType]
  );

  /**
   * Remove the last placed note in current measure (undo)
   */
  const undoLastPlacement = useCallback(() => {
    setPlacements((prev) => {
      const newPlacements = new Map(prev);
      const measurePlacements = new Map(newPlacements.get(currentMeasureNumber) || new Map());

      if (measurePlacements.size === 0) {
        return prev; // Nothing to undo
      }

      // Find highest note index and remove it
      const indices = Array.from(measurePlacements.keys()).sort((a, b) => b - a);
      const lastIndex = indices[0];
      measurePlacements.delete(lastIndex);

      newPlacements.set(currentMeasureNumber, measurePlacements);
      return newPlacements;
    });
  }, [currentMeasureNumber]);

  /**
   * Clear all placements for current measure
   */
  const clearCurrentMeasure = useCallback(() => {
    setPlacements((prev) => {
      const newPlacements = new Map(prev);
      newPlacements.delete(currentMeasureNumber);
      return newPlacements;
    });
  }, [currentMeasureNumber]);

  /**
   * Navigate to next measure
   */
  const goToNextMeasure = useCallback(() => {
    const nextMeasureNumber = currentMeasureNumber + 1;
    const nextMeasure = measures.find((m) => m.measureNumber === nextMeasureNumber);

    if (nextMeasure) {
      setCurrentMeasureNumber(nextMeasureNumber);
    }
  }, [currentMeasureNumber, measures]);

  /**
   * Navigate to previous measure
   */
  const goToPreviousMeasure = useCallback(() => {
    const prevMeasureNumber = currentMeasureNumber - 1;
    const prevMeasure = measures.find((m) => m.measureNumber === prevMeasureNumber);

    if (prevMeasure) {
      setCurrentMeasureNumber(prevMeasureNumber);
    }
  }, [currentMeasureNumber, measures]);

  /**
   * Jump to a specific measure
   */
  const goToMeasure = useCallback(
    (measureNumber: number) => {
      const measure = measures.find((m) => m.measureNumber === measureNumber);
      if (measure) {
        setCurrentMeasureNumber(measureNumber);
      }
    },
    [measures]
  );

  /**
   * Convert all placements to final GeneratedExerciseNote[] array
   */
  const generateExerciseNotes = useCallback((): GeneratedExerciseNote[] => {
    const notes: GeneratedExerciseNote[] = [];
    let noteIdCounter = 1;

    measures.forEach((measure) => {
      const measurePlacements = placements.get(measure.measureNumber);

      if (!measurePlacements) {
        console.warn(`[useManualPlacement] No placements for measure ${measure.measureNumber}`);
        return;
      }

      // Generate notes in order (0, 1, 2, ...)
      measure.notes.forEach((midiNote, index) => {
        const placement = measurePlacements.get(index);

        if (!placement) {
          console.warn(
            `[useManualPlacement] Missing placement for note ${index} in measure ${measure.measureNumber}`
          );
          return;
        }

        const exerciseNote = createExerciseNote(
          midiNote,
          placement.string,
          placement.fret,
          measure.measureNumber,
          `note-${noteIdCounter++}`
        );

        notes.push(exerciseNote);
      });
    });

    return notes;
  }, [measures, placements]);

  return {
    // State
    currentMeasureNumber,
    currentMeasure,
    currentNoteIndex,
    currentNote,
    currentMeasurePlacements,
    isCurrentMeasureComplete,
    areAllMeasuresComplete,
    stats,

    // Actions
    placeNote,
    undoLastPlacement,
    clearCurrentMeasure,
    goToNextMeasure,
    goToPreviousMeasure,
    goToMeasure,
    generateExerciseNotes,
  };
}
