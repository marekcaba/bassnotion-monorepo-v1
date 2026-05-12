/**
 * VexFlow Converter Utilities
 *
 * Functions for converting note durations and formats between
 * BassNotion's internal representation and VexFlow's notation format.
 *
 * These utilities are used for rendering sheet music in the
 * GlobalControls and SheetMusicDisplay components.
 */

import type { ExerciseNote, NoteDuration } from '@bassnotion/contracts';

/**
 * Converts BassNotion NoteDuration enum to VexFlow duration string.
 *
 * @param duration - The note duration in BassNotion format
 * @returns VexFlow duration string (e.g., 'w', 'h', 'q', '8', '16')
 *
 * @example
 * convertNoteDurationToVexFlow('quarter') // Returns 'q'
 * convertNoteDurationToVexFlow('dotted-half') // Returns 'hd'
 */
export function convertNoteDurationToVexFlow(
  duration: NoteDuration | undefined
): string {
  // Validate and provide default
  if (!duration) {
    return 'q';
  }

  switch (duration) {
    case 'whole':
      return 'w';
    case 'half':
      return 'h';
    case 'quarter':
      return 'q';
    case 'eighth':
      return '8';
    case 'sixteenth':
      return '16';
    case 'thirty-second':
      return '32';
    case 'sixty-fourth':
      return '64';
    case 'dotted-half':
      return 'hd';
    case 'dotted-quarter':
      return 'qd';
    case 'dotted-eighth':
      return '8d';
    case 'dotted-sixteenth':
      return '16d';
    case 'triplet-quarter':
      return 'q';
    case 'triplet-eighth':
      return '8';
    case 'triplet-sixteenth':
      return '16';
    case 'triplet-half':
      return 'h';
    case 'triplet-whole':
      return 'w';
    case 'dotted-whole':
      return 'wd';
    case 'tied':
      return 'q'; // Default to quarter for tied notes
    default:
      return 'q'; // Always return a valid duration
  }
}

/**
 * Extracts the octave number from a note name string.
 *
 * @param noteName - Note name with octave (e.g., 'A2', 'C#3', 'Bb4')
 * @returns The octave number, defaults to 2 if not found
 *
 * @example
 * getOctaveFromNote('A2') // Returns 2
 * getOctaveFromNote('C#3') // Returns 3
 */
export function getOctaveFromNote(noteName: string): number {
  // Extract octave from note name (e.g., "A2" -> 2)
  const match = noteName.match(/\d+/);
  return match ? parseInt(match[0]) : 2;
}

/**
 * Converts a BassNotion ExerciseNote to VexFlow note format.
 *
 * Bass guitar notation is written one octave higher than sounding pitch.
 * This function handles the octave transposition and format conversion.
 *
 * @param note - The exercise note to convert
 * @returns VexFlow note string (e.g., 'a/3', 'd#/4', 'bb/3')
 *
 * @example
 * convertNoteToVexFlow({ note: 'A2', ... }) // Returns 'a/3' (transposed up)
 */
export function convertNoteToVexFlow(note: ExerciseNote): string {
  // Convert note name to VexFlow format (e.g., "A2" -> "a/3", "A#2" -> "a#/3")
  // Bass guitar notation: written one octave higher than sounding pitch
  const noteName = note.note;
  const soundingOctave = getOctaveFromNote(noteName);
  const writtenOctave = soundingOctave + 1; // Transpose up one octave for notation

  // Handle sharps and flats
  let vexFlowNote = noteName.replace(/\d+$/, '').toLowerCase();

  // Convert flat notation to sharp for VexFlow
  if (vexFlowNote.includes('b')) {
    vexFlowNote = vexFlowNote.replace('b', 'b');
  }

  return `${vexFlowNote}/${writtenOctave}`;
}

/**
 * Determines the stem direction based on staff position.
 *
 * Follows professional engraving standards for bass clef:
 * - Notes on or above middle line (D/3) get stem down
 * - Notes below middle line get stem up
 *
 * @param noteKey - VexFlow note format (e.g., 'c/3', 'd#/4', 'bb/3')
 * @returns VexFlow stem direction: 1 = stem up, -1 = stem down
 *
 * @example
 * getStemDirection('c/3') // Returns 1 (stem up - below middle line)
 * getStemDirection('e/3') // Returns -1 (stem down - above middle line)
 */
export function getStemDirection(noteKey: string): number {
  // Parse VexFlow note format (e.g., "c/3", "d#/4", "bb/3")
  const [noteName, octaveStr] = noteKey.split('/');
  const octave = parseInt(octaveStr);

  // Extract just the note letter (first character), preserving 'b' as B natural
  // Remove sharp (#) or flat (b/bb) symbols that come AFTER the note letter
  const note = noteName.charAt(0).toLowerCase();

  // Bass clef middle line is D/3
  // Standard rule: above or on middle line = stem down, below = stem up
  const noteValues: { [key: string]: number } = {
    c: 0,
    d: 1,
    e: 2,
    f: 3,
    g: 4,
    a: 5,
    b: 6,
  };

  const noteValue = (octave - 3) * 7 + (noteValues[note] || 0);
  const middleLineValue = 1; // D/3 in bass clef

  const stemDirection = noteValue >= middleLineValue ? -1 : 1;

  // Return VexFlow stem direction constants
  // 1 = stem up, -1 = stem down
  return stemDirection; // On or above middle = down, below = up
}

/**
 * Gets the duration of a note in quarter note units.
 *
 * Useful for calculating timing and rest placement in sheet music.
 *
 * @param duration - The note duration to convert
 * @returns Duration value in quarter notes (e.g., 4 for whole, 1 for quarter)
 *
 * @example
 * getDurationInQuarterNotes('whole') // Returns 4
 * getDurationInQuarterNotes('eighth') // Returns 0.5
 * getDurationInQuarterNotes('triplet-quarter') // Returns 0.67
 */
export function getDurationInQuarterNotes(duration: NoteDuration): number {
  switch (duration) {
    case 'whole':
      return 4;
    case 'dotted-whole':
      return 6;
    case 'half':
      return 2;
    case 'dotted-half':
      return 3;
    case 'quarter':
      return 1;
    case 'dotted-quarter':
      return 1.5;
    case 'eighth':
      return 0.5;
    case 'dotted-eighth':
      return 0.75;
    case 'sixteenth':
      return 0.25;
    case 'dotted-sixteenth':
      return 0.375;
    case 'thirty-second':
      return 0.125;
    case 'sixty-fourth':
      return 0.0625;
    case 'triplet-whole':
      return 8 / 3; // 2.67
    case 'triplet-half':
      return 4 / 3; // 1.33
    case 'triplet-quarter':
      return 2 / 3; // 0.67
    case 'triplet-eighth':
      return 1 / 3; // 0.33
    case 'triplet-sixteenth':
      return 1 / 6; // 0.17
    default:
      return 1; // Default to quarter
  }
}

/**
 * Converts a duration value into an array of rest notations.
 *
 * Used to fill empty space in measures with appropriate rest symbols.
 * Follows industry-standard approach of using largest possible rest values
 * for proper visual representation.
 *
 * @param duration - Duration in quarter note units to fill with rests
 * @returns Array of VexFlow rest duration strings (e.g., ['w'], ['h', 'q'])
 *
 * @example
 * convertDurationToRests(4) // Returns ['w'] (whole rest)
 * convertDurationToRests(3) // Returns ['h', 'q'] (half + quarter rests)
 * convertDurationToRests(0.5) // Returns ['8'] (eighth rest)
 */
export function convertDurationToRests(duration: number): string[] {
  const rests: string[] = [];
  let remaining = duration;
  const epsilon = 0.001; // Small tolerance for floating point comparisons

  // Break down duration into standard rest values - industry standard approach
  // Start with largest possible rest durations for proper visual representation
  while (remaining > epsilon) {
    if (remaining >= 3.75) {
      rests.push('w');
      remaining -= 4;
    } else if (remaining >= 1.75) {
      rests.push('h');
      remaining -= 2;
    } else if (remaining >= 0.875) {
      rests.push('q');
      remaining -= 1;
    } else if (remaining >= 0.4375) {
      rests.push('8');
      remaining -= 0.5;
    } else if (remaining >= 0.21875) {
      rests.push('16');
      remaining -= 0.25;
    } else if (remaining >= 0.109375) {
      rests.push('32');
      remaining -= 0.125;
    } else {
      // For very small remainders, round to smallest rest
      if (remaining > epsilon) {
        rests.push('32');
      }
      remaining = 0;
    }
  }

  // If no rests were added but duration was requested, add a quarter rest
  if (rests.length === 0 && duration > epsilon) {
    rests.push('q');
  }

  return rests;
}
