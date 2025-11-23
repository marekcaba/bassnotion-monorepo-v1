/**
 * timeUtils.ts - Pure Time Conversion Functions
 *
 * Phase 1, Task 1.3: Standalone time utilities (no state, no dependencies)
 *
 * Extracted from TimePositionConverter.ts and MusicalTimeConverter.ts.
 * All functions are pure - no side effects, no state, no Tone.js dependency.
 *
 * Responsibilities:
 * - Parse musical positions (string and object formats)
 * - Convert between beats and seconds based on BPM
 * - Parse musical durations (4n, 8n, etc.)
 * - Handle tick precision (480 PPQ MIDI standard)
 *
 * Design Principles:
 * - Pure functions (no state, no side effects)
 * - No Tone.js dependency (BPM passed as parameter)
 * - No logging (callers handle errors)
 * - Standalone module (no imports from other playback modules)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed musical position result
 */
export interface ParsedPosition {
  bars: number;
  beats: number;
  sixteenths: number;
}

/**
 * Position input formats (string or object)
 */
export type PositionInput =
  | string
  | { measure: number; beat: number; subdivision?: number; tick?: number };

// ============================================================================
// Constants
// ============================================================================

/** MIDI standard PPQ (Pulses Per Quarter note) */
const TICKS_PER_BEAT = 480;

/** Ticks per sixteenth note (480 / 4) */
const TICKS_PER_SIXTEENTH = 120;

/** Default time signature (4/4) */
const DEFAULT_BEATS_PER_BAR = 4;

// ============================================================================
// Position Parsing Functions
// ============================================================================

/**
 * Parse musical position to absolute beats
 *
 * Converts from musical coordinates (bars, beats, ticks) to absolute beat count.
 * Handles both string ("bar:beat:sixteenth:tick") and object formats.
 *
 * @param position - Musical position in string or object format
 * @param beatsPerBar - Time signature (default: 4)
 * @returns Absolute beat count (with tick precision as decimal)
 *
 * @example
 * parsePositionToBeats("1:0:0:0", 4) // => 4.0 (start of bar 2)
 * parsePositionToBeats({ measure: 0, beat: 0, tick: 240 }, 4) // => 0.5 (half beat)
 */
export function parsePositionToBeats(
  position: PositionInput,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): number {
  let bars = 0;
  let beats = 0;
  let ticks = 0;

  // Handle object format (from exercise.harmonyNotes)
  if (typeof position === 'object' && position !== null) {
    bars = position.measure || 0;
    beats = position.beat || 0;
    // Use ONLY tick field - subdivision is redundant (derived from tick)
    // The subdivision field causes quantization because it rounds to 16th notes
    ticks = position.tick || 0;
  }
  // Handle string format
  else if (typeof position === 'string') {
    if (position.includes(':')) {
      // Parse "bar:beat:sixteenth" or "bar:beat:sixteenth:tick" format
      const parts = position.split(':');
      bars = parseInt(parts[0] || '0', 10);
      beats = parseInt(parts[1] || '0', 10);
      const sixteenths = parseInt(parts[2] || '0', 10);
      const ticksPart = parseInt(parts[3] || '0', 10);

      // Convert sixteenths to ticks first, then add tick precision
      // This ensures we use tick as single source of truth for sub-beat timing
      ticks = sixteenths * TICKS_PER_SIXTEENTH + ticksPart;
    } else {
      // Assume it's a beat number
      return parseFloat(position);
    }
  } else {
    // Invalid format
    return 0;
  }

  // Calculate total beats WITH TICK PRECISION
  const tickFraction = ticks / TICKS_PER_BEAT;

  // Use ONLY tick precision - don't double-count subdivision
  // The tick field contains the complete sub-beat position (0-479)
  const totalBeats = bars * beatsPerBar + beats + tickFraction;

  return totalBeats;
}

/**
 * Parse position to audio time (seconds)
 *
 * Converts from musical coordinates (bars, beats, ticks) to hardware audio time.
 *
 * @param position - Musical position in string or object format
 * @param bpm - Current tempo in beats per minute
 * @param beatsPerBar - Time signature (default: 4)
 * @returns Audio time in seconds
 *
 * @example
 * parsePosition("0:0:0:0", 120, 4) // => 0.0 (start)
 * parsePosition("1:0:0:0", 120, 4) // => 2.0 (bar 2 at 120 BPM)
 * parsePosition({ measure: 0, beat: 1, tick: 0 }, 120, 4) // => 0.5 (second beat)
 */
export function parsePosition(
  position: PositionInput,
  bpm: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): number {
  const totalBeats = parsePositionToBeats(position, beatsPerBar);
  return beatsToSeconds(totalBeats, bpm);
}

/**
 * Parse position into comparable object structure for sorting
 *
 * Handles both string ("bar:beat:sixteenth") and object formats.
 * Useful for sorting musical events by their position.
 *
 * @param position - Musical position in string or object format
 * @returns Parsed position object
 *
 * @example
 * parsePositionToObject("1:2:3") // => { bars: 1, beats: 2, sixteenths: 3 }
 * parsePositionToObject({ measure: 1, beat: 2, subdivision: 3 }) // => { bars: 1, beats: 2, sixteenths: 3 }
 */
export function parsePositionToObject(position: PositionInput): ParsedPosition {
  if (typeof position === 'object' && position !== null) {
    return {
      bars: position.measure || 0,
      beats: position.beat || 0,
      sixteenths: position.subdivision || 0,
    };
  }

  // Parse string format: "bar:beat:sixteenth" or "bar:beat:sixteenth:tick"
  if (typeof position === 'string' && position.includes(':')) {
    const parts = position.split(':');
    return {
      bars: parseInt(parts[0] || '0', 10),
      beats: parseInt(parts[1] || '0', 10),
      sixteenths: parseInt(parts[2] || '0', 10),
    };
  }

  // Fallback for unknown formats
  return { bars: 0, beats: 0, sixteenths: 0 };
}

// ============================================================================
// Time Conversion Functions
// ============================================================================

/**
 * Convert beats to seconds based on BPM
 *
 * @param beats - Number of beats
 * @param bpm - Tempo in beats per minute
 * @returns Time in seconds
 *
 * @example
 * beatsToSeconds(4, 120) // => 2.0 (4 beats at 120 BPM = 2 seconds)
 * beatsToSeconds(1, 60) // => 1.0 (1 beat at 60 BPM = 1 second)
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  const secondsPerBeat = 60 / bpm;
  return beats * secondsPerBeat;
}

/**
 * Convert seconds to beats based on BPM
 *
 * @param seconds - Time in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Number of beats
 *
 * @example
 * secondsToBeats(2.0, 120) // => 4.0 (2 seconds at 120 BPM = 4 beats)
 * secondsToBeats(1.0, 60) // => 1.0 (1 second at 60 BPM = 1 beat)
 */
export function secondsToBeats(seconds: number, bpm: number): number {
  const beatsPerSecond = bpm / 60;
  return seconds * beatsPerSecond;
}

// ============================================================================
// Duration Parsing Functions
// ============================================================================

/**
 * Parse musical duration to seconds
 *
 * Converts note duration strings (4n, 8n, 2n, etc.) to seconds based on BPM.
 *
 * @param duration - Musical duration (e.g., "4n", "8n", "2n")
 * @param bpm - Current tempo in beats per minute
 * @returns Duration in seconds
 *
 * @example
 * parseDuration("4n", 120) // => 0.5 (quarter note at 120 BPM)
 * parseDuration("8n", 120) // => 0.25 (eighth note at 120 BPM)
 * parseDuration("2n", 120) // => 1.0 (half note at 120 BPM)
 */
export function parseDuration(duration: string, bpm: number): number {
  // Parse note duration (4n = quarter note, 8n = eighth note, etc.)
  if (duration.endsWith('n') && duration.length > 1) {
    const noteValue = parseInt(duration.slice(0, -1), 10);
    // Check if noteValue is valid (not NaN, not zero)
    if (!isNaN(noteValue) && noteValue > 0) {
      const beats = 4 / noteValue; // 4n = 1 beat, 8n = 0.5 beats, etc.
      return beatsToSeconds(beats, bpm);
    }
  }

  // Unknown format
  return 0;
}

/**
 * Calculate total duration in seconds for a region
 *
 * Calculates the time span from start position to end position.
 *
 * @param startPosition - Starting musical position
 * @param endPosition - Ending musical position
 * @param bpm - Current tempo in beats per minute
 * @param beatsPerBar - Time signature (default: 4)
 * @returns Duration in seconds
 *
 * @example
 * calculateDuration("0:0:0:0", "1:0:0:0", 120, 4) // => 2.0 (one bar at 120 BPM)
 * calculateDuration({ measure: 0, beat: 0 }, { measure: 0, beat: 4 }, 120, 4) // => 2.0
 */
export function calculateDuration(
  startPosition: PositionInput,
  endPosition: PositionInput,
  bpm: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): number {
  const startBeats = parsePositionToBeats(startPosition, beatsPerBar);
  const endBeats = parsePositionToBeats(endPosition, beatsPerBar);
  const durationBeats = endBeats - startBeats;
  return beatsToSeconds(durationBeats, bpm);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert bars to beats
 *
 * @param bars - Number of bars
 * @param beatsPerBar - Time signature (default: 4)
 * @returns Number of beats
 *
 * @example
 * barsToBeats(2, 4) // => 8 (2 bars of 4/4 = 8 beats)
 * barsToBeats(1, 3) // => 3 (1 bar of 3/4 = 3 beats)
 */
export function barsToBeats(
  bars: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): number {
  return bars * beatsPerBar;
}

/**
 * Convert beats to bars
 *
 * @param beats - Number of beats
 * @param beatsPerBar - Time signature (default: 4)
 * @returns Number of bars (decimal)
 *
 * @example
 * beatsToBars(8, 4) // => 2.0 (8 beats = 2 bars of 4/4)
 * beatsToBars(6, 4) // => 1.5 (6 beats = 1.5 bars of 4/4)
 */
export function beatsToBars(
  beats: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR,
): number {
  return beats / beatsPerBar;
}
