/**
 * TimePositionConverter - Converts between musical time and audio time
 *
 * Phase 2.2: Merged MusicalTimeConverter + PositionParser
 *
 * CRITICAL MODULE: All timing calculations flow through here.
 * Handles conversion from musical positions (bars:beats:sixteenths) to
 * hardware audio time (seconds) using the current BPM.
 *
 * Responsibilities:
 * - Parse string positions ("bar:beat:sixteenth:tick")
 * - Parse object positions ({measure, beat, subdivision, tick})
 * - Convert to absolute seconds using current BPM
 * - Handle tick precision (480 PPQ MIDI standard)
 * - Convert positions to comparable objects for sorting
 * - Parse musical durations (4n, 8n, etc.)
 * - Provide current BPM accessor
 *
 * Note: Uses Tone.Transport.bpm as single source of truth for tempo.
 * This ensures tempo changes work correctly.
 */

import { getLogger } from '@/utils/logger.js';
import type { ParsedPosition } from '../types/region.types.js';

// Helper to get Tone from window (must be initialized before TimePositionConverter is used)
function getTone(): NonNullable<typeof window.Tone> {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'TimePositionConverter: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

const logger = getLogger('TimePositionConverter');

export type PositionInput =
  | string
  | { measure: number; beat: number; subdivision?: number; tick?: number };

export class TimePositionConverter {
  private readonly TICKS_PER_BEAT = 480; // MIDI standard PPQ
  private readonly TICKS_PER_SIXTEENTH = 120; // 480 / 4
  private beatsPerBar = 4; // Default time signature

  constructor() {
    // Empty constructor
  }

  /**
   * Set time signature (beats per bar)
   */
  setTimeSignature(beatsPerBar: number): void {
    this.beatsPerBar = beatsPerBar;
  }

  /**
   * Parse musical position to audio time (seconds)
   *
   * Converts from musical coordinates (bars, beats, ticks) to hardware audio time.
   * Uses current BPM from Tone.Transport as single source of truth.
   *
   * @param position - Musical position in string or object format
   * @returns Audio time in seconds
   */
  parsePosition(position: PositionInput): number {
    try {
      // Get current BPM from Tone.Transport (single source of truth)
      const Tone = getTone();
      const currentBpm = Tone.getTransport().bpm.value;
      const secondsPerBeat = 60 / currentBpm;

      let bars: number,
        beats: number,
        ticks = 0;

      // NEW: Handle object format (from exercise.harmonyNotes)
      if (typeof position === 'object' && position !== null) {
        bars = position.measure || 0;
        beats = position.beat || 0;
        // FIX: Use ONLY tick field - subdivision is redundant (derived from tick)
        // The subdivision field causes quantization because it rounds to 16th notes
        ticks = position.tick || 0;
      }
      // Legacy: Handle string format
      else if (typeof position === 'string') {
        if (position.includes(':')) {
          // Parse "bar:beat:sixteenth" or "bar:beat:sixteenth:tick" format
          const parts = position.split(':');
          bars = parseInt(parts[0] || '0', 10);
          beats = parseInt(parts[1] || '0', 10);
          const sixteenths = parseInt(parts[2] || '0', 10);
          const ticksPart = parseInt(parts[3] || '0', 10);

          // FIX: Convert sixteenths to ticks first, then add tick precision
          // This ensures we use tick as single source of truth for sub-beat timing
          ticks = sixteenths * this.TICKS_PER_SIXTEENTH + ticksPart;
        } else {
          // Assume it's a beat number
          const beat = parseFloat(position);
          return beat * secondsPerBeat;
        }
      } else {
        logger.warn(`Invalid position format: ${position}`);
        return 0;
      }

      // Calculate total beats WITH TICK PRECISION
      const tickFraction = ticks / this.TICKS_PER_BEAT;

      // FIX: Use ONLY tick precision - don't double-count subdivision
      // The tick field contains the complete sub-beat position (0-479)
      const totalBeats = bars * this.beatsPerBar + beats + tickFraction; // Single source of truth for sub-beat precision

      // Convert to seconds using CURRENT BPM
      const seconds = totalBeats * secondsPerBeat;

      return seconds;
    } catch (error) {
      logger.warn(`Failed to parse position: ${position}`, error);
      return 0;
    }
  }

  /**
   * Parse position into comparable object structure for sorting
   * Handles both string ("bar:beat:sixteenth") and object ({measure, beat, subdivision, tick}) formats
   *
   * @param position - Musical position in string or object format
   * @returns Parsed position object
   */
  parsePositionToObject(position: PositionInput): ParsedPosition {
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

  /**
   * Get current BPM from Tone.Transport
   */
  getCurrentBPM(): number {
    const Tone = getTone();
    return Tone.getTransport().bpm.value;
  }

  /**
   * Calculate duration in seconds from musical duration string
   *
   * @param duration - Musical duration (e.g., "4n", "8n", "2n")
   * @returns Duration in seconds
   */
  parseDuration(duration: string): number {
    try {
      const Tone = getTone();
      const currentBpm = Tone.getTransport().bpm.value;
      const secondsPerBeat = 60 / currentBpm;

      // Parse note duration (4n = quarter note, 8n = eighth note, etc.)
      if (duration.endsWith('n')) {
        const noteValue = parseInt(duration.slice(0, -1), 10);
        const beats = 4 / noteValue; // 4n = 1 beat, 8n = 0.5 beats, etc.
        return beats * secondsPerBeat;
      }

      logger.warn(`Unknown duration format: ${duration}`);
      return 0;
    } catch (error) {
      logger.warn(`Failed to parse duration: ${duration}`, error);
      return 0;
    }
  }
}
