/**
 * Fretboard calculation utilities for manual MIDI-to-fretboard placement
 *
 * Provides functions to:
 * - Calculate MIDI pitch for any string/fret position
 * - Validate if a note can be played at a position
 * - Convert note names to MIDI pitches
 * - Generate exercise notes from manual placements
 */

import type { MidiNoteEvent } from '../hooks/useMidiParsing';
import type { GeneratedExerciseNote } from '../hooks/useMidiConversion';

/**
 * Bass tuning configuration
 * Open string MIDI pitches indexed by string number (string 1 = index 0)
 *
 * String numbering:
 * - String 1 = Highest pitch (top of fretboard display) = G string
 * - String N = Lowest pitch (bottom of fretboard display) = E/B string
 */
export const BASS_TUNINGS = {
  '4': [43, 38, 33, 28], // String 1-4: G2(43), D2(38), A1(33), E1(28)
  '5': [43, 38, 33, 28, 23], // String 1-5: G2(43), D2(38), A1(33), E1(28), B0(23)
  '6': [48, 43, 38, 33, 28, 23], // String 1-6: C3(48), G2(43), D2(38), A1(33), E1(28), B0(23)
} as const;

/**
 * Note names in chromatic scale (sharps)
 */
const NOTE_NAMES_SHARP = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

/**
 * Note names in chromatic scale (flats)
 */
const NOTE_NAMES_FLAT = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * Legacy export for backward compatibility
 */
const NOTE_NAMES = NOTE_NAMES_SHARP;

/**
 * Enharmonic equivalents mapping
 * Maps sharp notes to their flat equivalents and vice versa
 */
export const ENHARMONIC_MAP: Record<string, string> = {
  // Sharp to Flat
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
  // Flat to Sharp
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

/**
 * Display preference for note accidentals
 */
export type AccidentalPreference = 'sharps' | 'flats';

/**
 * Parse a note name into its components
 *
 * @param noteName - Note name with optional accidental and octave (e.g., "C#4", "Db3", "E2")
 * @returns Object with base note, accidental, and octave
 *
 * @example
 * parseNoteName("C#4") // { base: "C", accidental: "#", octave: 4 }
 * parseNoteName("Db3") // { base: "D", accidental: "b", octave: 3 }
 * parseNoteName("E2")  // { base: "E", accidental: null, octave: 2 }
 */
export function parseNoteName(noteName: string): {
  base: string;
  accidental: '#' | 'b' | null;
  octave: number | null;
} {
  // Handle 's' suffix format (e.g., "Cs4" -> "C#4")
  const normalizedName = noteName.replace(/([A-G])s(\d)/i, '$1#$2');

  const match = normalizedName.match(/^([A-G])([#b])?(-?\d+)?$/i);
  if (!match) {
    return {
      base: noteName[0]?.toUpperCase() || 'C',
      accidental: null,
      octave: null,
    };
  }

  return {
    base: match[1].toUpperCase(),
    accidental: (match[2] as '#' | 'b') || null,
    octave: match[3] ? parseInt(match[3], 10) : null,
  };
}

/**
 * Get the enharmonic equivalent of a note
 *
 * @param noteName - Note name with accidental (e.g., "C#4", "Db3")
 * @returns Enharmonic equivalent or original if no equivalent exists
 *
 * @example
 * getEnharmonicEquivalent("C#4") // "Db4"
 * getEnharmonicEquivalent("Db3") // "C#3"
 * getEnharmonicEquivalent("E2")  // "E2" (no enharmonic)
 */
export function getEnharmonicEquivalent(noteName: string): string {
  const { base, accidental, octave } = parseNoteName(noteName);

  if (!accidental) {
    return noteName; // Natural notes have no enharmonic equivalent
  }

  const noteWithAccidental = `${base}${accidental}`;
  const equivalent = ENHARMONIC_MAP[noteWithAccidental];

  if (!equivalent) {
    return noteName; // No mapping found
  }

  return octave !== null ? `${equivalent}${octave}` : equivalent;
}

/**
 * Convert a note name to use the specified accidental preference
 *
 * @param noteName - Note name (e.g., "C#4", "Db3", "E2")
 * @param preference - Desired accidental style ('sharps' or 'flats')
 * @returns Note name in preferred format
 *
 * @example
 * convertToPreference("C#4", "flats")  // "Db4"
 * convertToPreference("Db3", "sharps") // "C#3"
 * convertToPreference("E2", "flats")   // "E2" (no change for naturals)
 */
export function convertToPreference(
  noteName: string,
  preference: AccidentalPreference,
): string {
  const { base, accidental, octave } = parseNoteName(noteName);

  if (!accidental) {
    return noteName; // Natural notes unchanged
  }

  const isSharp = accidental === '#';
  const isFlat = accidental === 'b';

  // Already in correct format
  if (
    (preference === 'sharps' && isSharp) ||
    (preference === 'flats' && isFlat)
  ) {
    return noteName;
  }

  // Need to convert
  return getEnharmonicEquivalent(noteName);
}

/**
 * Convert a note name to the internal storage format (always sharps with 's' suffix)
 *
 * This is used for sample file lookups where samples are named like "Cs4.wav"
 *
 * @param noteName - Note name in any format (e.g., "C#4", "Db4", "Cs4")
 * @returns Note name with 's' suffix for sharps (e.g., "Cs4")
 *
 * @example
 * toInternalFormat("C#4") // "Cs4"
 * toInternalFormat("Db4") // "Cs4"
 * toInternalFormat("Cs4") // "Cs4"
 * toInternalFormat("E2")  // "E2"
 */
export function toInternalFormat(noteName: string): string {
  // First convert to sharps if it's a flat
  const sharpNote = convertToPreference(noteName, 'sharps');

  // Then convert # to s for sample file lookup
  const { base, accidental, octave } = parseNoteName(sharpNote);

  if (accidental === '#') {
    return octave !== null ? `${base}s${octave}` : `${base}s`;
  }

  return sharpNote;
}

/**
 * Convert internal 's' format to display format with # or b
 *
 * @param noteName - Note name in internal format (e.g., "Cs4")
 * @param preference - Desired accidental style ('sharps' or 'flats')
 * @returns Note name for display (e.g., "C#4" or "Db4")
 *
 * @example
 * toDisplayFormat("Cs4", "sharps") // "C#4"
 * toDisplayFormat("Cs4", "flats")  // "Db4"
 * toDisplayFormat("E2", "sharps")  // "E2"
 */
export function toDisplayFormat(
  noteName: string,
  preference: AccidentalPreference,
): string {
  // Convert 's' to '#' first
  const normalizedName = noteName.replace(/([A-G])s(\d)/i, '$1#$2');

  // Then apply preference
  return convertToPreference(normalizedName, preference);
}

/**
 * Check if a note has an enharmonic equivalent
 *
 * @param noteName - Note name to check
 * @returns true if note has an enharmonic equivalent
 */
export function hasEnharmonic(noteName: string): boolean {
  const { accidental } = parseNoteName(noteName);
  return accidental !== null;
}

/**
 * Calculate MIDI pitch for a given string and fret position
 *
 * @param string - String number (1 = highest/thinnest on fretboard display, 4/5/6 = lowest/thickest)
 * @param fret - Fret number (0 = open, 1-24 = frets)
 * @param bassType - Bass type ('4', '5', or '6' string)
 * @returns MIDI pitch number (e.g., 60 = C4)
 *
 * @example
 * calculatePitch(4, 0, '4') // E1 open string = MIDI 28
 * calculatePitch(1, 3, '4') // G2 + 3 frets = A#2 = MIDI 46
 */
export function calculatePitch(
  string: number,
  fret: number,
  bassType: '4' | '5' | '6',
): number {
  const tuning = BASS_TUNINGS[bassType];

  // Validate string number
  if (string < 1 || string > tuning.length) {
    throw new Error(
      `Invalid string number ${string} for ${bassType}-string bass`,
    );
  }

  // Validate fret number
  if (fret < 0 || fret > 24) {
    throw new Error(`Invalid fret number ${fret} (must be 0-24)`);
  }

  // String 1 is highest pitch (index 0 in tuning array)
  // String N is lowest pitch (index N-1 in tuning array)
  const openStringPitch = tuning[string - 1];
  const calculatedPitch = openStringPitch + fret;

  return calculatedPitch;
}

/**
 * Validate if a note with given MIDI pitch can be played at a string/fret position
 *
 * @param notePitch - MIDI pitch of the note to place (e.g., 40)
 * @param string - Target string number
 * @param fret - Target fret number
 * @param bassType - Bass type
 * @returns true if placement is valid, false otherwise
 *
 * @example
 * validatePlacement(40, 2, 7, '4') // Is E2 playable on string 2, fret 7?
 */
export function validatePlacement(
  notePitch: number,
  string: number,
  fret: number,
  bassType: '4' | '5' | '6',
): boolean {
  try {
    const calculatedPitch = calculatePitch(string, fret, bassType);
    return calculatedPitch === notePitch;
  } catch {
    return false;
  }
}

/**
 * Convert MIDI pitch to note name (e.g., 40 -> "E2", 69 -> "A4")
 *
 * @param pitch - MIDI pitch number
 * @returns Note name with octave (e.g., "C#3")
 */
export function midiPitchToNoteName(pitch: number): string {
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Find all valid fretboard positions where a note can be played
 *
 * @param notePitch - MIDI pitch of the note
 * @param bassType - Bass type
 * @returns Array of {string, fret} positions where note can be played
 *
 * @example
 * findAllPositions(40, '4') // Find all positions for E2
 * // Returns: [{string: 4, fret: 12}, {string: 3, fret: 7}, {string: 2, fret: 2}]
 */
export function findAllPositions(
  notePitch: number,
  bassType: '4' | '5' | '6',
): Array<{ string: number; fret: number }> {
  const tuning = BASS_TUNINGS[bassType];
  const positions: Array<{ string: number; fret: number }> = [];

  for (let string = 1; string <= tuning.length; string++) {
    const openPitch = tuning[string - 1];
    const fret = notePitch - openPitch;

    // Check if playable on this string (fret 0-24)
    if (fret >= 0 && fret <= 24) {
      positions.push({ string, fret });
    }
  }

  return positions;
}

/**
 * Create a GeneratedExerciseNote from a manual placement
 *
 * @param midiNote - Original MIDI note event from parser
 * @param string - Placed string position
 * @param fret - Placed fret position
 * @param measureNumber - Measure number
 * @param noteId - Unique note ID
 * @returns Complete GeneratedExerciseNote object
 */
export function createExerciseNote(
  midiNote: MidiNoteEvent,
  string: number,
  fret: number,
  measureNumber: number,
  noteId: string,
): GeneratedExerciseNote {
  return {
    id: noteId,

    // Fretboard position
    string,
    fret,
    note: midiNote.name,

    // Musical timing (from MIDI parser)
    position: midiNote.position,
    noteDuration: midiNote.noteDuration,
    durationTicks: midiNote.durationTicks,

    // Performance data
    pitch: midiNote.pitch,
    velocity: midiNote.velocity,
    measureNumber,

    // Metadata (manual placement = high confidence)
    confidence: 'high',
    alternatives: [],
    warnings: [],
    score: 100, // Manual placement is always "perfect"
  };
}

/**
 * Calculate the display string number (visual order)
 * Converts between internal string numbering and visual display
 *
 * @param internalString - Internal string number (1 = highest pitch)
 * @param bassType - Bass type
 * @returns Display string number (1 = top of fretboard visually)
 */
export function getDisplayStringNumber(
  internalString: number,
  bassType: '4' | '5' | '6',
): number {
  // Internal numbering: 1 = highest pitch (G string)
  // Visual numbering: 1 = top string on display (G string)
  // They're the same! Just return as-is
  return internalString;
}

/**
 * Validate that all notes in a measure have been placed
 *
 * @param totalNotes - Total number of notes in measure
 * @param placements - Map of note index to placement
 * @returns true if all notes placed, false otherwise
 */
export function isMeasureComplete(
  totalNotes: number,
  placements: Map<number, { string: number; fret: number }>,
): boolean {
  if (placements.size !== totalNotes) {
    return false;
  }

  // Check all indices from 0 to totalNotes-1 are present
  for (let i = 0; i < totalNotes; i++) {
    if (!placements.has(i)) {
      return false;
    }
  }

  return true;
}
