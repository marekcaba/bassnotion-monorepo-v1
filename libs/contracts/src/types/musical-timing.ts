/**
 * Musical Timing Types for BassNotion Platform
 *
 * Provides musical duration and timing types for representing
 * rhythm in musical terms rather than milliseconds.
 */

// ============================================================================
// CORE MUSICAL DURATION TYPES
// ============================================================================

/**
 * Musical note duration values
 * Represents standard note lengths in musical notation
 */
export type NoteDuration =
  // Standard note values
  | 'whole' // 4 beats in 4/4 time
  | 'half' // 2 beats
  | 'quarter' // 1 beat (standard beat in 4/4)
  | 'eighth' // 0.5 beats
  | 'sixteenth' // 0.25 beats
  | 'thirty-second' // 0.125 beats
  | 'sixty-fourth' // 0.0625 beats

  // Dotted notes (1.5x the original duration)
  | 'dotted-whole' // 6 beats
  | 'dotted-half' // 3 beats
  | 'dotted-quarter' // 1.5 beats
  | 'dotted-eighth' // 0.75 beats
  | 'dotted-sixteenth' // 0.375 beats

  // Triplets (3 notes in the space of 2)
  | 'triplet-whole' // 2.667 beats
  | 'triplet-half' // 1.333 beats
  | 'triplet-quarter' // 0.667 beats
  | 'triplet-eighth' // 0.333 beats
  | 'triplet-sixteenth' // 0.167 beats

  // Tied notes (for custom durations)
  | 'tied'; // Extends previous note

/**
 * Time signature representation
 */
export interface TimeSignature {
  numerator: number; // Top number (beats per measure)
  denominator: number; // Bottom number (note value that gets the beat)
}

/**
 * Musical position within a piece
 * Uses 1-based indexing to match musical convention
 */
export interface MusicalPosition {
  measure: number; // Which measure (1-based)
  beat: number; // Which beat in measure (1-based)
  subdivision: number; // Subdivision of beat (0-based, typically 0-3 for sixteenths)
  tick?: number; // Precise position within beat (0-479 at 480 PPQ) - preserves sub-16th timing
}

/**
 * Swing feel configuration
 */
export interface SwingConfig {
  enabled: boolean;
  ratio: number; // 0.5 = straight, 0.67 = triplet swing, 0.75 = hard swing
}

/**
 * Musical timing configuration for an exercise or piece
 */
export interface MusicalTimingConfig {
  bpm: number;
  timeSignature: TimeSignature;
  swing?: SwingConfig;
}

// ============================================================================
// DURATION VALUE MAPPINGS
// ============================================================================

/**
 * Duration to beat value mapping
 * Based on standard 4/4 time where quarter note = 1 beat
 */
export const DURATION_BEAT_VALUES: Record<NoteDuration, number> = {
  // Standard notes
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
  'thirty-second': 0.125,
  'sixty-fourth': 0.0625,

  // Dotted notes
  'dotted-whole': 6,
  'dotted-half': 3,
  'dotted-quarter': 1.5,
  'dotted-eighth': 0.75,
  'dotted-sixteenth': 0.375,

  // Triplets
  'triplet-whole': 8 / 3, // 2.667
  'triplet-half': 4 / 3, // 1.333
  'triplet-quarter': 2 / 3, // 0.667
  'triplet-eighth': 1 / 3, // 0.333
  'triplet-sixteenth': 1 / 6, // 0.167

  // Tied (handled specially)
  tied: 0,
};

/**
 * Common time signatures
 */
export const COMMON_TIME_SIGNATURES: Record<string, TimeSignature> = {
  '4/4': { numerator: 4, denominator: 4 },
  '3/4': { numerator: 3, denominator: 4 },
  '6/8': { numerator: 6, denominator: 8 },
  '12/8': { numerator: 12, denominator: 8 },
  '5/4': { numerator: 5, denominator: 4 },
  '7/8': { numerator: 7, denominator: 8 },
  '2/4': { numerator: 2, denominator: 4 },
  '2/2': { numerator: 2, denominator: 2 },
};

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Musical articulation types that can modify note playback
 */
export type Articulation =
  | 'staccato' // Short, detached
  | 'legato' // Smooth, connected
  | 'accent' // Emphasized
  | 'tenuto' // Held full value
  | 'marcato'; // Strong accent

/**
 * Dynamics (volume/intensity)
 */
export type Dynamic =
  | 'ppp' // Pianississimo
  | 'pp' // Pianissimo
  | 'p' // Piano
  | 'mp' // Mezzo-piano
  | 'mf' // Mezzo-forte
  | 'f' // Forte
  | 'ff' // Fortissimo
  | 'fff'; // Fortississimo

/**
 * Rest duration (silence)
 */
export type RestDuration = NoteDuration;

/**
 * Complete note timing information
 */
export interface NoteTimingInfo {
  duration: NoteDuration;
  position: MusicalPosition;
  articulation?: Articulation;
  dynamic?: Dynamic;
  isTied?: boolean; // Tied to next note
  isRest?: boolean; // Silence instead of note
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a position is valid within a time signature
 */
export function isValidPosition(
  position: MusicalPosition,
  timeSignature: TimeSignature,
): boolean {
  return (
    position.measure >= 1 &&
    position.beat >= 1 &&
    position.beat <= timeSignature.numerator &&
    position.subdivision >= 0 &&
    position.subdivision < 4
  ); // Assuming sixteenth note subdivisions
}

/**
 * Get the next musical position
 */
export function getNextPosition(
  currentPosition: MusicalPosition,
  duration: NoteDuration,
  timeSignature: TimeSignature,
): MusicalPosition {
  const beats = DURATION_BEAT_VALUES[duration];
  const totalBeats =
    currentPosition.beat - 1 + currentPosition.subdivision / 4 + beats;

  const newMeasure =
    currentPosition.measure + Math.floor(totalBeats / timeSignature.numerator);
  const newBeat = (totalBeats % timeSignature.numerator) + 1;
  const newSubdivision = (newBeat % 1) * 4;

  return {
    measure: newMeasure,
    beat: Math.floor(newBeat),
    subdivision: Math.round(newSubdivision),
  };
}
