import type { ExerciseNote } from '../types/fretboard.js';

// Valid ranges for bass guitar
export const BASS_CONSTRAINTS = {
  minFret: 0,
  maxFret: 24,
  minString: 1,
  maxString: 4,
  minDuration: 50, // milliseconds
  maxDuration: 10000, // 10 seconds
  minVelocity: 0,
  maxVelocity: 127,
} as const;

// Note names for each string and fret
const NOTE_NAMES = {
  1: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'], // E string
  2: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'], // A string
  3: ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#'], // D string
  4: ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#'], // G string
} as const;

export interface NoteEditResult {
  success: boolean;
  note?: ExerciseNote;
  error?: string;
}

export interface NoteValidationResult {
  valid: boolean;
  errors: string[];
}

export class NoteEditor {
  /**
   * Validates note parameters against bass guitar constraints
   */
  validateNote(
    fret: number,
    string: number,
    duration = 500,
    velocity = 64,
  ): NoteValidationResult {
    const errors: string[] = [];

    // Validate fret
    if (fret < BASS_CONSTRAINTS.minFret || fret > BASS_CONSTRAINTS.maxFret) {
      errors.push(
        `Fret must be between ${BASS_CONSTRAINTS.minFret} and ${BASS_CONSTRAINTS.maxFret}`,
      );
    }

    // Validate string
    if (
      string < BASS_CONSTRAINTS.minString ||
      string > BASS_CONSTRAINTS.maxString
    ) {
      errors.push(
        `String must be between ${BASS_CONSTRAINTS.minString} and ${BASS_CONSTRAINTS.maxString}`,
      );
    }

    // Validate duration
    if (
      duration < BASS_CONSTRAINTS.minDuration ||
      duration > BASS_CONSTRAINTS.maxDuration
    ) {
      errors.push(
        `Duration must be between ${BASS_CONSTRAINTS.minDuration}ms and ${BASS_CONSTRAINTS.maxDuration}ms`,
      );
    }

    // Validate velocity
    if (
      velocity < BASS_CONSTRAINTS.minVelocity ||
      velocity > BASS_CONSTRAINTS.maxVelocity
    ) {
      errors.push(
        `Velocity must be between ${BASS_CONSTRAINTS.minVelocity} and ${BASS_CONSTRAINTS.maxVelocity}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets the note name for a given string and fret
   */
  getNoteName(string: number, fret: number): string {
    if (string < 1 || string > 4) return 'Unknown';
    if (fret < 0 || fret > 24) return 'Unknown';

    const noteIndex = fret % 12;
    // Standard bass tuning octaves: E=1, A=1, D=2, G=2 for open strings
    // But the naming convention often uses E2, A2, D3, G3 in musical contexts
    const baseOctave =
      string === 1 ? 2 : string === 2 ? 2 : string === 3 ? 3 : 3;
    const octave = baseOctave + Math.floor(fret / 12);

    return `${NOTE_NAMES[string as keyof typeof NOTE_NAMES][noteIndex]}${octave}`;
  }

  /**
   * Creates a new note with validation
   */
  createNote(
    fret: number,
    string: number,
    timestamp: number,
    duration = 500,
    velocity = 64,
  ): NoteEditResult {
    const validation = this.validateNote(fret, string, duration, velocity);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const note: ExerciseNote = {
      id: this.generateNoteId(),
      timestamp,
      string,
      fret,
      duration,
      note: this.getNoteName(string, fret),
      velocity,
    };

    return {
      success: true,
      note,
    };
  }

  /**
   * Updates an existing note's position
   */
  moveNote(
    note: ExerciseNote,
    newFret: number,
    newString: number,
    newTimestamp?: number,
  ): NoteEditResult {
    const validation = this.validateNote(
      newFret,
      newString,
      note.duration,
      note.velocity,
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const updatedNote: ExerciseNote = {
      ...note,
      fret: newFret,
      string: newString,
      timestamp: newTimestamp ?? note.timestamp,
      note: this.getNoteName(newString, newFret),
    };

    return {
      success: true,
      note: updatedNote,
    };
  }

  /**
   * Updates note duration
   */
  setNoteDuration(note: ExerciseNote, duration: number): NoteEditResult {
    const validation = this.validateNote(
      note.fret,
      note.string,
      duration,
      note.velocity,
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const updatedNote: ExerciseNote = {
      ...note,
      duration,
    };

    return {
      success: true,
      note: updatedNote,
    };
  }

  /**
   * Updates note velocity
   */
  setNoteVelocity(note: ExerciseNote, velocity: number): NoteEditResult {
    const validation = this.validateNote(
      note.fret,
      note.string,
      note.duration,
      velocity,
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      };
    }

    const updatedNote: ExerciseNote = {
      ...note,
      velocity,
    };

    return {
      success: true,
      note: updatedNote,
    };
  }

  /**
   * Duplicates a note with a new timestamp
   */
  duplicateNote(note: ExerciseNote, newTimestamp: number): NoteEditResult {
    const duplicatedNote: ExerciseNote = {
      ...note,
      id: this.generateNoteId(),
      timestamp: newTimestamp,
    };

    return {
      success: true,
      note: duplicatedNote,
    };
  }

  /**
   * Checks if two notes would overlap (same fret and string at similar time)
   */
  checkNoteConflict(
    note: ExerciseNote,
    existingNotes: ExerciseNote[],
    toleranceMs = 100,
  ): boolean {
    return existingNotes.some(
      (existing) =>
        existing.id !== note.id &&
        existing.fret === note.fret &&
        existing.string === note.string &&
        Math.abs(existing.timestamp - note.timestamp) < toleranceMs,
    );
  }

  /**
   * Generates a unique note ID
   */
  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
