import { MusicalPosition, NoteDuration } from '@bassnotion/contracts';

/**
 * Represents a MIDI control change event (e.g., sustain pedal, expression)
 */
export interface HarmonyControlChange {
  /** Control change number (64 = sustain pedal, 11 = expression, etc.) */
  cc: number;

  /** Control value (0-127) */
  value: number;

  /** Musical position where this CC event occurs */
  position: MusicalPosition;

  /** Absolute tick position (at 480 PPQ resolution) */
  ticks: number;

  /** Measure number where this CC event occurs (1-based) */
  measureNumber: number;
}

/**
 * Represents a single harmony note extracted from MIDI
 * Similar to GeneratedExerciseNote but for keyboard/piano instruments
 */
export interface GeneratedHarmonyNote {
  /** Unique identifier for this note */
  id: string;

  /** MIDI note number (0-127) - used for sample playback */
  pitch: number;

  /** MIDI velocity (0-127) - determines velocity layer to use */
  velocity: number;

  /** Musical note name (e.g., "C4", "D#3", "Bb2") */
  noteName: string;

  /** Musical position (measure, beat, subdivision, tick) */
  position: MusicalPosition;

  /** Musical note duration (whole, half, quarter, eighth, etc.) */
  noteDuration: NoteDuration;

  /** Duration in MIDI ticks (at 480 PPQ resolution) */
  durationTicks: number;

  /** Absolute tick position from file start (at 480 PPQ resolution) - critical for consistent timing with CC64 */
  ticks?: number;

  /** Measure number (1-based) */
  measureNumber: number;

  /**
   * Voice index for polyphonic tracking (optional)
   * Useful for tracking simultaneous notes (chords)
   * 0 = bass voice, 1 = tenor, 2 = alto, 3 = soprano
   */
  voiceIndex?: number;
}

/**
 * Analysis of harmony MIDI file for optimization
 */
export interface HarmonyAnalysis {
  /** Minimum velocity value found in MIDI (0-127) */
  minVelocity: number;

  /** Maximum velocity value found in MIDI (0-127) */
  maxVelocity: number;

  /** Required velocity layers based on velocity range and instrument */
  requiredVelocityLayers: string[];

  /** Array of unique MIDI pitches used (for sample preloading) */
  uniquePitches: number[];

  /** Total number of notes in the exercise */
  noteCount: number;

  /** Octave range (min/max octave numbers) */
  octaveRange: {
    min: number;
    max: number;
  };

  /** Average velocity (for dynamics analysis) */
  averageVelocity: number;

  /** Whether the piece is polyphonic (has simultaneous notes) */
  isPolyphonic: boolean;

  /** Maximum number of simultaneous notes (voice count) */
  maxVoiceCount: number;
}

/**
 * Response DTO for harmony MIDI conversion
 */
export interface ConvertHarmonyResponseDto {
  /** Array of converted harmony notes */
  notes: GeneratedHarmonyNote[];

  /** Array of MIDI control change events (sustain pedal, expression, etc.) */
  controlChanges: HarmonyControlChange[];

  /** Analysis metadata for optimization */
  analysis: HarmonyAnalysis;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}
