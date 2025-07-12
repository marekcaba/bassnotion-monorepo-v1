/**
 * Exercise Migration Utilities
 *
 * Utilities for migrating existing millisecond-based exercise data
 * to the new musical timing system.
 */

import {
  NoteDuration,
  TimeSignature,
  DURATION_BEAT_VALUES,
} from '../types/musical-timing.js';
import { ExerciseNote, Exercise } from '../types/exercise.js';
import { MusicalTimeConverter } from './musical-time-converter.js';

/**
 * Legacy exercise note format (for migration)
 */
interface LegacyExerciseNote {
  id: string;
  timestamp: number; // milliseconds
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  duration: number; // milliseconds
  note: string;
  color: string;
  // ... other properties
}

/**
 * Legacy exercise format (for migration)
 */
interface LegacyExercise {
  id: string;
  title: string;
  bpm: number;
  notes: LegacyExerciseNote[];
  // ... other properties
}

export class ExerciseMigration {
  /**
   * Detect the most likely note duration from milliseconds
   */
  static detectNoteDuration(
    durationMs: number,
    bpm: number,
    tolerance = 0.1,
  ): NoteDuration {
    // Calculate beat duration in ms
    const beatMs = 60000 / bpm;

    // Check each duration type to find the closest match
    const durations: Array<[NoteDuration, number]> = [
      ['whole', 4],
      ['dotted-half', 3],
      ['half', 2],
      ['dotted-quarter', 1.5],
      ['quarter', 1],
      ['dotted-eighth', 0.75],
      ['triplet-quarter', 2 / 3],
      ['eighth', 0.5],
      ['triplet-eighth', 1 / 3],
      ['sixteenth', 0.25],
      ['triplet-sixteenth', 1 / 6],
      ['thirty-second', 0.125],
      ['sixty-fourth', 0.0625],
    ];

    let closestDuration: NoteDuration = 'quarter';
    let closestDifference = Infinity;

    for (const [duration, beats] of durations) {
      const expectedMs = beats * beatMs;
      const difference = Math.abs(durationMs - expectedMs);
      const relativeDifference = difference / expectedMs;

      if (relativeDifference < tolerance && difference < closestDifference) {
        closestDuration = duration;
        closestDifference = difference;
      }
    }

    return closestDuration;
  }

  /**
   * Detect time signature from note patterns
   */
  static detectTimeSignature(
    notes: LegacyExerciseNote[],
    bpm: number,
  ): TimeSignature {
    // Default to 4/4
    let timeSignature: TimeSignature = { numerator: 4, denominator: 4 };

    if (notes.length < 4) {
      return timeSignature;
    }

    // Calculate beat positions for all notes
    const beatPositions = notes.map((note) =>
      MusicalTimeConverter.msToBeats(note.timestamp, bpm),
    );

    // Look for patterns that repeat every N beats
    const possibleNumerators = [3, 4, 5, 6, 7, 8, 12];

    for (const numerator of possibleNumerators) {
      let isValidPattern = true;

      // Check if notes align with this time signature
      for (const beatPos of beatPositions) {
        const measurePosition = beatPos % numerator;
        // Allow some tolerance for human timing
        if (measurePosition % 0.25 > 0.1 && measurePosition % 0.25 < 0.15) {
          isValidPattern = false;
          break;
        }
      }

      if (isValidPattern) {
        // Special cases for compound time
        if (numerator === 6) {
          timeSignature = { numerator: 6, denominator: 8 };
        } else if (numerator === 12) {
          timeSignature = { numerator: 12, denominator: 8 };
        } else {
          timeSignature = { numerator, denominator: 4 };
        }
        break;
      }
    }

    return timeSignature;
  }

  /**
   * Migrate a single note from milliseconds to musical timing
   */
  static migrateNote(
    legacyNote: LegacyExerciseNote,
    bpm: number,
    timeSignature: TimeSignature,
  ): ExerciseNote {
    // Convert timestamp to musical position
    const position = MusicalTimeConverter.msToPosition(
      legacyNote.timestamp,
      timeSignature,
      bpm,
    );

    // Detect note duration
    const duration = this.detectNoteDuration(legacyNote.duration, bpm);

    // Create migrated note
    const migratedNote: ExerciseNote = {
      id: legacyNote.id,
      string: legacyNote.string,
      fret: legacyNote.fret,
      note: legacyNote.note,
      color: legacyNote.color,
      duration,
      position,
      // Keep legacy fields for backwards compatibility
      timestamp: legacyNote.timestamp,
      duration_ms: legacyNote.duration,
    };

    return migratedNote;
  }

  /**
   * Migrate an entire exercise
   */
  static migrateExercise(legacyExercise: LegacyExercise): Exercise {
    // Detect time signature if not provided
    const timeSignature = this.detectTimeSignature(
      legacyExercise.notes,
      legacyExercise.bpm,
    );

    // Migrate all notes
    const migratedNotes = legacyExercise.notes.map((note) =>
      this.migrateNote(note, legacyExercise.bpm, timeSignature),
    );

    // Calculate total duration in measures
    const lastNote = migratedNotes[migratedNotes.length - 1];
    const endPosition = lastNote
      ? MusicalTimeConverter.getEndPosition(
          lastNote.position,
          lastNote.duration,
          timeSignature,
        )
      : { measure: 1, beat: 1, subdivision: 0 };

    const totalMeasures = endPosition.measure;
    const totalBeats = totalMeasures * timeSignature.numerator;
    const totalDurationMs = MusicalTimeConverter.beatsToMs(
      totalBeats,
      legacyExercise.bpm,
    );

    // Create migrated exercise
    const migratedExercise: Exercise = {
      ...(legacyExercise as any), // Copy all existing fields
      timeSignature,
      notes: migratedNotes,
      duration: totalDurationMs,
    };

    return migratedExercise;
  }

  /**
   * Validate migrated data
   */
  static validateMigration(exercise: Exercise): string[] {
    const errors: string[] = [];

    // Check time signature
    if (
      !exercise.timeSignature ||
      !exercise.timeSignature.numerator ||
      !exercise.timeSignature.denominator
    ) {
      errors.push('Invalid or missing time signature');
    }

    // Check notes
    exercise.notes.forEach((note, index) => {
      if (!note.duration || !DURATION_BEAT_VALUES[note.duration]) {
        errors.push(`Note ${index} has invalid duration: ${note.duration}`);
      }

      if (
        !note.position ||
        !note.position.measure ||
        !note.position.beat ||
        note.position.subdivision === undefined
      ) {
        errors.push(`Note ${index} has invalid position`);
      }

      // Check position is within time signature bounds
      if (note.position && exercise.timeSignature) {
        if (note.position.beat > exercise.timeSignature.numerator) {
          errors.push(
            `Note ${index} beat ${note.position.beat} exceeds time signature`,
          );
        }
      }
    });

    // Check note order
    for (let i = 1; i < exercise.notes.length; i++) {
      const prev = exercise.notes[i - 1];
      const curr = exercise.notes[i];

      if (
        MusicalTimeConverter.comparePositions(curr.position, prev.position) < 0
      ) {
        errors.push(`Note ${i} is out of order (before note ${i - 1})`);
      }
    }

    return errors;
  }

  /**
   * Create a simple exercise builder for testing
   */
  static createSimpleExercise(
    title: string,
    bpm: number,
    noteData: Array<{
      string: 1 | 2 | 3 | 4 | 5;
      fret: number;
      duration: NoteDuration;
      measure: number;
      beat: number;
    }>,
  ): Exercise {
    const timeSignature: TimeSignature = { numerator: 4, denominator: 4 };

    const notes: ExerciseNote[] = noteData.map((data, index) => ({
      id: `note-${index + 1}`,
      string: data.string,
      fret: data.fret,
      note: 'A', // Simplified - would calculate from string/fret
      color: 'green',
      duration: data.duration,
      position: {
        measure: data.measure,
        beat: data.beat,
        subdivision: 0,
      },
    }));

    // Calculate total duration
    const lastNote = notes[notes.length - 1];
    const endPosition = MusicalTimeConverter.getEndPosition(
      lastNote.position,
      lastNote.duration,
      timeSignature,
    );
    const totalBeats = endPosition.measure * timeSignature.numerator;
    const totalDurationMs = MusicalTimeConverter.beatsToMs(totalBeats, bpm);

    return {
      id: `exercise-${Date.now()}`,
      title,
      difficulty: 'beginner',
      duration: totalDurationMs,
      bpm,
      key: 'C',
      timeSignature,
      notes,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}
