/**
 * Professional Musical Time Types
 *
 * Industry-standard musical time representation for professional DAW-like functionality.
 * Compatible with Logic Pro X, Ableton Live, and MIDI standards.
 *
 * Story 3.15: Professional Musical Time System
 */

import type { TimeSignature, MusicalPosition } from './musical-timing.js';

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
 * Note durations with triplet and dotted support
 */
export type NoteDuration =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | 'sixteenth'
  | 'thirty-second'
  | 'sixty-fourth'
  | 'whole-dotted'
  | 'half-dotted'
  | 'quarter-dotted'
  | 'eighth-dotted'
  | 'sixteenth-dotted'
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
  /**
   * Industry standard ticks per quarter note
   * Standard MIDI resolution: 480 PPQ
   * Divisible by 2, 3, 4, 5, 6, 8 for triplets/tuplets
   */
  public static readonly PPQ = 480;
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

  /** Tick values for common note durations at 480 PPQ */
  public static readonly DURATION_TICKS = {
    whole: 1920, // 480 * 4
    half: 960, // 480 * 2
    quarter: 480, // 480 * 1
    eighth: 240, // 480 / 2
    sixteenth: 120, // 480 / 4
    'thirty-second': 60, // 480 / 8
    'sixty-fourth': 30, // 480 / 16
    'whole-dotted': 2880, // 480 * 4 * 1.5
    'half-dotted': 1440, // 480 * 2 * 1.5
    'quarter-dotted': 720, // 480 * 1 * 1.5
    'eighth-dotted': 360, // 480 / 2 * 1.5
    'sixteenth-dotted': 180, // 480 / 4 * 1.5
    'quarter-triplet': 320, // (480 * 2) / 3
    'eighth-triplet': 160, // (480 * 1) / 3
    'sixteenth-triplet': 80, // (480 / 2) / 3
  } as const;

  /** Triplet tick values (for backward compatibility) */
  public static readonly TRIPLET_TICKS = {
    QUARTER: 320, // (480 * 2) / 3
    EIGHTH: 160, // 480 / 3
    SIXTEENTH: 80, // (480 / 2) / 3
  } as const;
}

/**
 * Convert ticks to milliseconds
 * @param ticks Number of ticks
 * @param bpm Tempo in beats per minute
 * @returns Duration in milliseconds
 */
export function ticksToMs(ticks: number, bpm: number): number {
  const msPerQuarter = 60000 / bpm;
  return (ticks / MusicalTimeConstants.PPQ) * msPerQuarter;
}

/**
 * Convert milliseconds to ticks
 * @param ms Duration in milliseconds
 * @param bpm Tempo in beats per minute
 * @returns Number of ticks (rounded)
 */
export function msToTicks(ms: number, bpm: number): number {
  const msPerQuarter = 60000 / bpm;
  return Math.round((ms / msPerQuarter) * MusicalTimeConstants.PPQ);
}

/**
 * Convert musical position to absolute tick
 * @param position Musical position (measure, beat, tick)
 * @param timeSignature Time signature
 * @returns Absolute tick from start
 */
export function positionToAbsoluteTick(
  position: MusicalPosition,
  timeSignature: TimeSignature,
): number {
  const ticksPerBeat = MusicalTimeConstants.TICKS_PER_QUARTER;
  const ticksPerMeasure = ticksPerBeat * timeSignature.numerator;
  const ticksPer16th = ticksPerBeat / 4; // 240 ticks per 16th note

  // Position uses 0-based indexing for measures and beats
  // Subdivision is in 16th notes (0-3), convert to ticks
  return (
    position.measure * ticksPerMeasure +
    position.beat * ticksPerBeat +
    position.subdivision * ticksPer16th
  );
}

/**
 * Convert absolute tick to musical position
 * @param tick Absolute tick from start
 * @param timeSignature Time signature
 * @returns Musical position (measure, beat, subdivision)
 */
export function absoluteTickToPosition(
  tick: number,
  timeSignature: TimeSignature,
): MusicalPosition {
  const ticksPerBeat = MusicalTimeConstants.TICKS_PER_QUARTER;
  const ticksPerMeasure = ticksPerBeat * timeSignature.numerator;

  // Use 0-based indexing for measures and beats (not 1-based)
  const measure = Math.floor(tick / ticksPerMeasure);
  const remainingTicks = tick % ticksPerMeasure;
  const beat = Math.floor(remainingTicks / ticksPerBeat);

  // Convert tick subdivision to 16th note subdivision (0-3)
  // ticksPerBeat = 480 (PPQ), so 480/4 = 120 ticks per 16th note
  const ticksWithinBeat = remainingTicks % ticksPerBeat;
  const ticksPer16th = ticksPerBeat / 4; // 120 ticks per 16th note
  const subdivision = Math.floor(ticksWithinBeat / ticksPer16th);

  return {
    measure,
    beat,
    subdivision,
    tick: ticksWithinBeat, // FIX: Preserve precise tick position within beat (0-479)
  };
}

/**
 * Infer NoteDuration from tick count
 * @param ticks Duration in ticks
 * @returns Closest NoteDuration
 */
export function inferNoteDurationFromTicks(ticks: number): NoteDuration {
  const tickMap = MusicalTimeConstants.DURATION_TICKS;

  // Find closest match with 5% tolerance
  const tolerance = 0.05;

  for (const [duration, expectedTicks] of Object.entries(tickMap)) {
    const diff = Math.abs(ticks - expectedTicks);
    if (diff / expectedTicks < tolerance) {
      return duration as NoteDuration;
    }
  }

  // Default to closest match (check dotted notes before regular notes)
  if (ticks >= 2880) return 'whole-dotted';
  if (ticks >= 1920) return 'whole';
  if (ticks >= 1440) return 'half-dotted';
  if (ticks >= 960) return 'half';
  if (ticks >= 720) return 'quarter-dotted';
  if (ticks >= 480) return 'quarter';
  if (ticks >= 360) return 'eighth-dotted';
  if (ticks >= 240) return 'eighth';
  if (ticks >= 180) return 'sixteenth-dotted';
  if (ticks >= 120) return 'sixteenth';
  if (ticks >= 60) return 'thirty-second';
  return 'sixty-fourth';
}

/**
 * Get tick duration for a NoteDuration
 * @param duration Musical note duration
 * @returns Duration in ticks
 */
export function noteDurationToTicks(duration: NoteDuration): number {
  return (
    MusicalTimeConstants.DURATION_TICKS[duration] ??
    MusicalTimeConstants.TICKS_PER_QUARTER
  );
}
