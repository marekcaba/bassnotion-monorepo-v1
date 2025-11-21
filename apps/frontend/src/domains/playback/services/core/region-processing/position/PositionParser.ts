/**
 * PositionParser - Converts musical positions to absolute time
 *
 * Responsibilities:
 * - Parse string positions ("bar:beat:sixteenth:tick")
 * - Parse object positions ({measure, beat, subdivision, tick})
 * - Convert to absolute seconds using current BPM
 * - Handle tick precision (480 PPQ MIDI standard)
 * - Convert positions to comparable objects for sorting
 *
 * Note: Uses Tone.Transport.bpm as single source of truth for tempo
 */

import * as Tone from 'tone';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('PositionParser');

export type Position =
  | string
  | { measure: number; beat: number; subdivision?: number; tick?: number };

export interface ParsedPosition {
  measure: number;
  beat: number;
  subdivision: number;
  tick: number;
}

export class PositionParser {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Parse position to absolute time in seconds
   * Uses current Tone.Transport BPM for calculation
   *
   * @param position - String ("bar:beat:sixteenth:tick") or object format
   * @returns Absolute time in seconds
   */
  parsePosition(position: Position): number {
    try {
      // Get current BPM from Tone.Transport (single source of truth)
      const currentBpm = Tone.Transport.bpm.value;
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
          const ticksPer16th = 120; // 480 PPQ / 4 = 120 ticks per 16th note
          ticks = sixteenths * ticksPer16th + ticksPart;
        } else {
          // Assume it's a beat number
          const beat = parseFloat(position);
          return beat * secondsPerBeat;
        }
      } else {
        logger.warn(`Invalid position format: ${position}`);
        return 0;
      }

      // Get time signature (assume 4/4 for now, can be made dynamic)
      const beatsPerBar = 4;

      // Calculate total beats WITH TICK PRECISION
      // MIDI standard: 480 PPQ (Pulses Per Quarter note)
      const ticksPerBeat = 480;
      const tickFraction = ticks / ticksPerBeat;

      // FIX: Use ONLY tick precision - don't double-count subdivision
      // The tick field contains the complete sub-beat position (0-479)
      const totalBeats = bars * beatsPerBar + beats + tickFraction; // Single source of truth for sub-beat precision

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
   * @param position - String or object format
   * @returns Normalized position object
   */
  parsePositionToObject(position: Position): ParsedPosition {
    if (typeof position === 'object' && position !== null) {
      return {
        measure: position.measure || 0,
        beat: position.beat || 0,
        subdivision: position.subdivision || 0,
        tick: position.tick || 0,
      };
    }

    // Parse string format: "bar:beat:sixteenth" or "bar:beat:sixteenth:tick"
    if (typeof position === 'string' && position.includes(':')) {
      const parts = position.split(':');
      return {
        measure: parseInt(parts[0] || '0', 10),
        beat: parseInt(parts[1] || '0', 10),
        subdivision: parseInt(parts[2] || '0', 10),
        tick: parseInt(parts[3] || '0', 10),
      };
    }

    // Fallback for unknown formats
    return { measure: 0, beat: 0, subdivision: 0, tick: 0 };
  }
}
