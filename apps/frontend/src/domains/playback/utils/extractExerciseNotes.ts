/**
 * Extract all unique notes required for an exercise
 */

import type { Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Map of chord symbols to their component notes
const CHORD_NOTE_MAP: Record<string, string[]> = {
  // Major chords
  C: ['C4', 'E4', 'G4'],
  D: ['D4', 'F#4', 'A4'],
  E: ['E4', 'G#4', 'B4'],
  F: ['F4', 'A4', 'C5'],
  G: ['G4', 'B4', 'D5'],
  A: ['A4', 'C#5', 'E5'],
  B: ['B4', 'D#5', 'F#5'],

  // Minor chords
  Am: ['A4', 'C5', 'E5'],
  Bm: ['B4', 'D5', 'F#5'],
  Cm: ['C4', 'Eb4', 'G4'],
  Dm: ['D4', 'F4', 'A4'],
  Em: ['E4', 'G4', 'B4'],
  Fm: ['F4', 'Ab4', 'C5'],
  Gm: ['G4', 'Bb4', 'D5'],

  // 7th chords
  C7: ['C4', 'E4', 'G4', 'Bb4'],
  D7: ['D4', 'F#4', 'A4', 'C5'],
  E7: ['E4', 'G#4', 'B4', 'D5'],
  F7: ['F4', 'A4', 'C5', 'Eb5'],
  G7: ['G4', 'B4', 'D5', 'F5'],
  A7: ['A4', 'C#5', 'E5', 'G5'],
  B7: ['B4', 'D#5', 'F#5', 'A5'],

  // Major 7th
  Cmaj7: ['C4', 'E4', 'G4', 'B4'],
  Dmaj7: ['D4', 'F#4', 'A4', 'C#5'],
  Emaj7: ['E4', 'G#4', 'B4', 'D#5'],
  Fmaj7: ['F4', 'A4', 'C5', 'E5'],
  Gmaj7: ['G4', 'B4', 'D5', 'F#5'],
  Amaj7: ['A4', 'C#5', 'E5', 'G#5'],
  Bmaj7: ['B4', 'D#5', 'F#5', 'A#5'],

  // Minor 7th
  Am7: ['A4', 'C5', 'E5', 'G5'],
  Bm7: ['B4', 'D5', 'F#5', 'A5'],
  Cm7: ['C4', 'Eb4', 'G4', 'Bb4'],
  Dm7: ['D4', 'F4', 'A4', 'C5'],
  Em7: ['E4', 'G4', 'B4', 'D5'],
  Fm7: ['F4', 'Ab4', 'C5', 'Eb5'],
  Gm7: ['G4', 'Bb4', 'D5', 'F5'],
};

/**
 * Extract unique notes from an exercise's chord progression
 */
export function extractExerciseNotes(exercise: Exercise | undefined): string[] {
  if (!exercise?.chord_progression || exercise.chord_progression.length === 0) {
    logger.warn('No chord progression found in exercise');
    return [];
  }

  logger.info('📝 Extracting notes from exercise:', {
    title: exercise.title,
    chords: exercise.chord_progression,
  });

  const uniqueNotes = new Set<string>();

  // Extract notes from chord progression
  for (const chord of exercise.chord_progression) {
    const notes = CHORD_NOTE_MAP[chord];
    if (notes) {
      logger.info(`📝 Chord ${chord} maps to notes:`, notes);
      notes.forEach((note) => uniqueNotes.add(note));
    } else {
      logger.warn(`Unknown chord: ${chord}`);
      // For unknown chords, add some common notes as fallback
      ['C4', 'E4', 'G4', 'A4'].forEach((note) => uniqueNotes.add(note));
    }
  }

  // Also check if exercise has specific notes defined
  if (exercise.notes && exercise.notes.length > 0) {
    for (const noteData of exercise.notes) {
      if (noteData.note) {
        // Convert note name to note with octave
        const noteWithOctave =
          noteData.note.length === 1
            ? `${noteData.note}4` // Default to octave 4
            : noteData.note;
        uniqueNotes.add(noteWithOctave);
      }
    }
  }

  // Add octave variations for smoother voicings
  const notesArray = Array.from(uniqueNotes);
  const extendedNotes = new Set(notesArray);

  // Add one octave up and down for each note
  notesArray.forEach((note) => {
    const [noteName, octaveStr] = note.match(/([A-G]#?)(\d)/)?.slice(1) || [];
    if (noteName && octaveStr) {
      const octave = parseInt(octaveStr);
      // Add octave below (if reasonable)
      if (octave > 2) {
        extendedNotes.add(`${noteName}${octave - 1}`);
      }
      // Add octave above (if reasonable)
      if (octave < 6) {
        extendedNotes.add(`${noteName}${octave + 1}`);
      }
    }
  });

  const result = Array.from(extendedNotes).sort();
  logger.info(
    `📝 Extracted ${result.length} unique notes from exercise:`,
    result,
  );

  return result;
}

/**
 * Get velocity layers based on exercise difficulty
 */
export function getVelocityLayersForExercise(
  exercise: Exercise | undefined,
): string[] {
  if (!exercise) {
    return ['v8', 'v10', 'v12']; // Default to mf, f, ff
  }

  switch (exercise.difficulty) {
    case 'beginner':
      return ['v6', 'v8', 'v10']; // p, mf, f
    case 'intermediate':
      return ['v8', 'v10', 'v12']; // mf, f, ff
    case 'advanced':
      return ['v10', 'v12', 'v14', 'v16']; // f, ff, fff, ffff
    default:
      return ['v8', 'v10', 'v12'];
  }
}
