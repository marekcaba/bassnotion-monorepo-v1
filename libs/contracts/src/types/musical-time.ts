/**
 * Professional Musical Time Types
 *
 * Industry-standard musical time representation for professional DAW-like functionality.
 * Compatible with Logic Pro X, Ableton Live, and MIDI standards.
 *
 * Story 3.15: Professional Musical Time System
 */

import type { TimeSignature } from './musical-timing.js';

// Re-export musical timing types for convenience
export type { TimeSignature } from './musical-timing.js';

// Re-export MusicalPosition from musical-timing for consistency
export type { MusicalPosition } from './musical-timing.js';

/**
 * Tick-based timing position
 * Uses industry-standard 480 ticks per quarter note
 */
export interface TickPosition {
  tick: number; // Absolute tick position from start
  tempo: number; // Current tempo in BPM
  resolution: number; // Ticks per quarter note (typically 480)
}

/**
 * Musical time configuration
 */
export interface MusicalTimeConfig {
  tempo: number; // BPM (beats per minute)
  timeSignature: TimeSignature; // Time signature
  resolution?: number; // Ticks per quarter note (default: 480)
}

/**
 * Professional drum pattern event
 * Tick-based timing with MIDI-style velocity
 */
export interface DrumEvent {
  tick: number; // Tick position within pattern
  drum: DrumType; // Drum type
  velocity: number; // 0-127 MIDI velocity
}

/**
 * Drum pattern with professional timing
 */
export interface DrumPattern {
  name: string; // Pattern name (e.g., "main_groove", "fill_1")
  bars: number; // Pattern length in bars
  events: DrumEvent[]; // Drum events within pattern
}

/**
 * Drum arrangement system
 */
export interface DrumArrangement {
  patterns: DrumPattern[]; // Available patterns
  arrangement: string[]; // Pattern names in playback order
}

/**
 * Professional drum track data
 */
export interface DrumTrackData {
  enabled: boolean; // Track enabled/disabled
  resolution: number; // Ticks per quarter note (480 standard)
  patterns: DrumPattern[]; // Available patterns
  arrangement: string[]; // Pattern arrangement
}

/**
 * Bass note with musical position
 */
export interface BassNote {
  measure: number; // Measure position
  beat: number; // Beat position
  subdivision: number; // Subdivision position
  note: string; // Note name (e.g., "E2", "A#3")
  duration: NoteDuration; // Note duration
  string: number; // Bass string (1-6)
  fret: number; // Fret position (0-24)
  techniques?: TechniqueType[]; // Playing techniques
}

/**
 * Professional bass track data
 */
export interface BassTrackData {
  enabled: boolean; // Track enabled/disabled
  notes: BassNote[]; // Bass notes with musical timing
}

/**
 * Harmony chord change
 */
export interface HarmonyChange {
  measure: number; // Measure where chord changes
  chord: string; // Chord name (e.g., "Em7", "C/G")
  duration: number; // Duration in measures
  notes?: string[]; // Optional chord voicing
}

/**
 * Professional harmony track data
 */
export interface HarmonyTrackData {
  enabled: boolean; // Track enabled/disabled
  progression: HarmonyChange[]; // Chord progression
}

/**
 * Professional musical content structure
 */
export interface MusicalContent {
  bass: BassTrackData; // Bass track
  drums: DrumTrackData; // Drum track
  harmony: HarmonyTrackData; // Harmony track
}

/**
 * Professional mix settings
 */
export interface MixSettings {
  levels: {
    bass: number; // Bass level (0-1)
    drums: number; // Drums level (0-1)
    harmony: number; // Harmony level (0-1)
  };
  master: number; // Master level (0-1)
}

/**
 * Professional exercise with musical timing
 */
export interface ProfessionalExercise {
  id: string;
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty;

  // Professional musical metadata
  total_bars: number; // Total bars in exercise
  tempo: number; // Tempo in BPM
  key_signature: string; // Key signature
  time_signature: TimeSignature; // Time signature

  // Professional musical content
  musical_content: MusicalContent; // All track data
  mix_settings: MixSettings; // Mixing settings

  // Standard fields
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Drum types supported by the system
 */
export type DrumType =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'crash'
  | 'ride'
  | 'tom'
  | 'tom1'
  | 'tom2'
  | 'tom3'
  | 'splash'
  | 'china'
  | 'bell';

/**
 * Note durations with triplet support
 */
export type NoteDuration =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'thirty-second'
  | 'sixty-fourth'
  | 'quarter-triplet'
  | 'eighth-triplet'
  | 'sixteenth-triplet';

/**
 * Exercise difficulty levels
 */
export type ExerciseDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

/**
 * Bass playing techniques
 */
export type TechniqueType =
  | 'hammer_on'
  | 'pull_off'
  | 'slide_up'
  | 'slide_down'
  | 'slap'
  | 'pop'
  | 'tap'
  | 'harmonic'
  | 'vibrato'
  | 'bend';

/**
 * Swing timing configuration
 */
export interface SwingConfig {
  enabled: boolean; // Swing enabled/disabled
  amount: number; // Swing amount (0-1)
  note_value: 'eighth' | 'sixteenth'; // Note value for swing
}

/**
 * Professional timing features
 */
export interface TimingFeatures {
  swing?: SwingConfig; // Swing timing
  humanize?: number; // Humanization amount (0-1)
  quantization?: number; // Quantization strength (0-1)
}

/**
 * Musical time utilities
 */
export class MusicalTimeConstants {
  /** Industry standard ticks per quarter note */
  public static readonly TICKS_PER_QUARTER = 480;

  /** Common time signatures */
  public static readonly TIME_SIGNATURES = {
    '4/4': { numerator: 4, denominator: 4 },
    '3/4': { numerator: 3, denominator: 4 },
    '2/4': { numerator: 2, denominator: 4 },
    '6/8': { numerator: 6, denominator: 8 },
    '12/8': { numerator: 12, denominator: 8 },
    '7/8': { numerator: 7, denominator: 8 },
    '5/4': { numerator: 5, denominator: 4 },
  } as const;

  /** Common tempos */
  public static readonly COMMON_TEMPOS = {
    LARGO: 60,
    ADAGIO: 70,
    ANDANTE: 90,
    MODERATO: 108,
    ALLEGRO: 132,
    PRESTO: 168,
    PRESTISSIMO: 200,
  } as const;

  /** Triplet tick values for common note durations */
  public static readonly TRIPLET_TICKS = {
    QUARTER: (this.TICKS_PER_QUARTER * 2) / 3, // 320 ticks
    EIGHTH: this.TICKS_PER_QUARTER / 3, // 160 ticks
    SIXTEENTH: this.TICKS_PER_QUARTER / 6, // 80 ticks
  } as const;
}
