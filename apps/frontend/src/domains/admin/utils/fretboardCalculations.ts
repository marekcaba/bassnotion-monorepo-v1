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
 * Note names in chromatic scale
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
  bassType: '4' | '5' | '6'
): number {
  const tuning = BASS_TUNINGS[bassType];

  // Validate string number
  if (string < 1 || string > tuning.length) {
    throw new Error(`Invalid string number ${string} for ${bassType}-string bass`);
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
  bassType: '4' | '5' | '6'
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
  bassType: '4' | '5' | '6'
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
  noteId: string
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
  bassType: '4' | '5' | '6'
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
  placements: Map<number, { string: number; fret: number }>
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
