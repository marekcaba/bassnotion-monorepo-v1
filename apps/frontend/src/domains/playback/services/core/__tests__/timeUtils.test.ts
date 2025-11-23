/**
 * timeUtils.test.ts - Comprehensive test suite for pure time utilities
 *
 * Test Coverage:
 * - Position parsing (string and object formats)
 * - Beat/second conversions
 * - Duration parsing
 * - Tick precision handling
 * - Edge cases (tempo changes, time signatures)
 * - Comparison tests against TimePositionConverter
 */

import { describe, it, expect } from 'vitest';
import {
  parsePositionToBeats,
  parsePosition,
  parsePositionToObject,
  beatsToSeconds,
  secondsToBeats,
  parseDuration,
  calculateDuration,
  barsToBeats,
  beatsToBars,
  type ParsedPosition,
  type PositionInput,
} from '../timeUtils.js';

describe('timeUtils', () => {
  // ============================================================================
  // Position Parsing Tests
  // ============================================================================

  describe('parsePositionToBeats', () => {
    it('should parse string position "0:0:0:0" as 0 beats', () => {
      expect(parsePositionToBeats('0:0:0:0', 4)).toBe(0);
    });

    it('should parse string position "1:0:0:0" as 4 beats (4/4 time)', () => {
      expect(parsePositionToBeats('1:0:0:0', 4)).toBe(4);
    });

    it('should parse string position "0:1:0:0" as 1 beat', () => {
      expect(parsePositionToBeats('0:1:0:0', 4)).toBe(1);
    });

    it('should parse string position with sixteenths "0:0:2:0" as 0.5 beats', () => {
      // 2 sixteenths = 2 * 120 ticks = 240 ticks = 0.5 beats
      expect(parsePositionToBeats('0:0:2:0', 4)).toBe(0.5);
    });

    it('should parse string position with tick precision "0:0:0:240"', () => {
      // 240 ticks = 0.5 beats (480 ticks per beat)
      expect(parsePositionToBeats('0:0:0:240', 4)).toBe(0.5);
    });

    it('should handle combined sixteenths and ticks "0:0:1:60"', () => {
      // 1 sixteenth (120 ticks) + 60 ticks = 180 ticks = 0.375 beats
      expect(parsePositionToBeats('0:0:1:60', 4)).toBe(0.375);
    });

    it('should parse object position {measure: 0, beat: 0, tick: 0}', () => {
      expect(parsePositionToBeats({ measure: 0, beat: 0, tick: 0 }, 4)).toBe(0);
    });

    it('should parse object position {measure: 1, beat: 0, tick: 0} as 4 beats', () => {
      expect(parsePositionToBeats({ measure: 1, beat: 0, tick: 0 }, 4)).toBe(4);
    });

    it('should parse object position with tick precision', () => {
      expect(parsePositionToBeats({ measure: 0, beat: 0, tick: 240 }, 4)).toBe(
        0.5,
      );
    });

    it('should ignore subdivision field in object (use tick only)', () => {
      // subdivision is redundant - tick is the single source of truth
      const result = parsePositionToBeats(
        { measure: 0, beat: 0, subdivision: 2, tick: 240 },
        4,
      );
      expect(result).toBe(0.5); // Should use tick (240) only, not subdivision
    });

    it('should handle 3/4 time signature', () => {
      expect(parsePositionToBeats('1:0:0:0', 3)).toBe(3); // 1 bar = 3 beats in 3/4
    });

    it('should handle 6/8 time signature', () => {
      expect(parsePositionToBeats('1:0:0:0', 6)).toBe(6); // 1 bar = 6 beats in 6/8
    });

    it('should parse plain beat number string', () => {
      expect(parsePositionToBeats('4.5', 4)).toBe(4.5);
    });

    it('should return 0 for invalid position', () => {
      expect(parsePositionToBeats(null as any, 4)).toBe(0);
      expect(parsePositionToBeats(undefined as any, 4)).toBe(0);
    });
  });

  describe('parsePosition', () => {
    const BPM_120 = 120;
    const BPM_60 = 60;

    it('should convert position "0:0:0:0" to 0 seconds', () => {
      expect(parsePosition('0:0:0:0', BPM_120, 4)).toBe(0);
    });

    it('should convert position "1:0:0:0" to correct seconds at 120 BPM', () => {
      // 1 bar (4 beats) at 120 BPM = 2 seconds
      expect(parsePosition('1:0:0:0', BPM_120, 4)).toBe(2);
    });

    it('should convert position "0:1:0:0" to 0.5 seconds at 120 BPM', () => {
      // 1 beat at 120 BPM = 0.5 seconds
      expect(parsePosition('0:1:0:0', BPM_120, 4)).toBe(0.5);
    });

    it('should handle tempo changes correctly', () => {
      const position = '1:0:0:0'; // 1 bar (4 beats)

      // At 120 BPM: 4 beats = 2 seconds
      expect(parsePosition(position, 120, 4)).toBe(2);

      // At 60 BPM: 4 beats = 4 seconds
      expect(parsePosition(position, 60, 4)).toBe(4);

      // At 240 BPM: 4 beats = 1 second
      expect(parsePosition(position, 240, 4)).toBe(1);
    });

    it('should handle tick precision at different tempos', () => {
      const position = '0:0:0:240'; // 240 ticks = 0.5 beats

      // At 120 BPM: 0.5 beats = 0.25 seconds
      expect(parsePosition(position, 120, 4)).toBe(0.25);

      // At 60 BPM: 0.5 beats = 0.5 seconds
      expect(parsePosition(position, 60, 4)).toBe(0.5);
    });

    it('should handle object position format', () => {
      const position = { measure: 0, beat: 1, tick: 0 };
      // 1 beat at 120 BPM = 0.5 seconds
      expect(parsePosition(position, BPM_120, 4)).toBe(0.5);
    });
  });

  describe('parsePositionToObject', () => {
    it('should parse string position "1:2:3" to object', () => {
      const result = parsePositionToObject('1:2:3');
      expect(result).toEqual({ bars: 1, beats: 2, sixteenths: 3 });
    });

    it('should parse string position "1:2:3:120" and ignore ticks', () => {
      const result = parsePositionToObject('1:2:3:120');
      expect(result).toEqual({ bars: 1, beats: 2, sixteenths: 3 });
    });

    it('should convert object position to standard format', () => {
      const result = parsePositionToObject({
        measure: 1,
        beat: 2,
        subdivision: 3,
      });
      expect(result).toEqual({ bars: 1, beats: 2, sixteenths: 3 });
    });

    it('should handle missing fields in object position', () => {
      const result = parsePositionToObject({ measure: 1, beat: 0 });
      expect(result).toEqual({ bars: 1, beats: 0, sixteenths: 0 });
    });

    it('should return zero object for plain beat string', () => {
      const result = parsePositionToObject('4.5');
      expect(result).toEqual({ bars: 0, beats: 0, sixteenths: 0 });
    });

    it('should return zero object for invalid input', () => {
      const result = parsePositionToObject(null as any);
      expect(result).toEqual({ bars: 0, beats: 0, sixteenths: 0 });
    });
  });

  // ============================================================================
  // Time Conversion Tests
  // ============================================================================

  describe('beatsToSeconds', () => {
    it('should convert 4 beats at 120 BPM to 2 seconds', () => {
      expect(beatsToSeconds(4, 120)).toBe(2);
    });

    it('should convert 1 beat at 60 BPM to 1 second', () => {
      expect(beatsToSeconds(1, 60)).toBe(1);
    });

    it('should convert 0.5 beats at 120 BPM to 0.25 seconds', () => {
      expect(beatsToSeconds(0.5, 120)).toBe(0.25);
    });

    it('should handle very slow tempos', () => {
      expect(beatsToSeconds(1, 30)).toBe(2); // 1 beat at 30 BPM = 2 seconds
    });

    it('should handle very fast tempos', () => {
      expect(beatsToSeconds(1, 300)).toBe(0.2); // 1 beat at 300 BPM = 0.2 seconds
    });

    it('should handle zero beats', () => {
      expect(beatsToSeconds(0, 120)).toBe(0);
    });

    it('should handle fractional beats', () => {
      expect(beatsToSeconds(2.5, 120)).toBe(1.25);
    });
  });

  describe('secondsToBeats', () => {
    it('should convert 2 seconds at 120 BPM to 4 beats', () => {
      expect(secondsToBeats(2, 120)).toBe(4);
    });

    it('should convert 1 second at 60 BPM to 1 beat', () => {
      expect(secondsToBeats(1, 60)).toBe(1);
    });

    it('should convert 0.25 seconds at 120 BPM to 0.5 beats', () => {
      expect(secondsToBeats(0.25, 120)).toBe(0.5);
    });

    it('should handle zero seconds', () => {
      expect(secondsToBeats(0, 120)).toBe(0);
    });

    it('should be inverse of beatsToSeconds', () => {
      const beats = 7.5;
      const bpm = 135;
      const seconds = beatsToSeconds(beats, bpm);
      const roundTrip = secondsToBeats(seconds, bpm);
      expect(roundTrip).toBeCloseTo(beats, 10);
    });
  });

  // ============================================================================
  // Duration Parsing Tests
  // ============================================================================

  describe('parseDuration', () => {
    it('should parse quarter note "4n" at 120 BPM', () => {
      // Quarter note = 1 beat = 0.5 seconds at 120 BPM
      expect(parseDuration('4n', 120)).toBe(0.5);
    });

    it('should parse eighth note "8n" at 120 BPM', () => {
      // Eighth note = 0.5 beats = 0.25 seconds at 120 BPM
      expect(parseDuration('8n', 120)).toBe(0.25);
    });

    it('should parse half note "2n" at 120 BPM', () => {
      // Half note = 2 beats = 1 second at 120 BPM
      expect(parseDuration('2n', 120)).toBe(1);
    });

    it('should parse whole note "1n" at 120 BPM', () => {
      // Whole note = 4 beats = 2 seconds at 120 BPM
      expect(parseDuration('1n', 120)).toBe(2);
    });

    it('should parse sixteenth note "16n" at 120 BPM', () => {
      // Sixteenth note = 0.25 beats = 0.125 seconds at 120 BPM
      expect(parseDuration('16n', 120)).toBe(0.125);
    });

    it('should handle tempo changes', () => {
      const duration = '4n'; // Quarter note

      // At 120 BPM: 1 beat = 0.5 seconds
      expect(parseDuration(duration, 120)).toBe(0.5);

      // At 60 BPM: 1 beat = 1 second
      expect(parseDuration(duration, 60)).toBe(1);

      // At 240 BPM: 1 beat = 0.25 seconds
      expect(parseDuration(duration, 240)).toBe(0.25);
    });

    it('should return 0 for unknown duration format', () => {
      expect(parseDuration('unknown', 120)).toBe(0);
      expect(parseDuration('', 120)).toBe(0);
      expect(parseDuration('4x', 120)).toBe(0);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration of one bar at 120 BPM', () => {
      const duration = calculateDuration('0:0:0:0', '1:0:0:0', 120, 4);
      expect(duration).toBe(2); // 4 beats at 120 BPM = 2 seconds
    });

    it('should calculate duration between two positions', () => {
      const duration = calculateDuration('0:0:0:0', '0:2:0:0', 120, 4);
      expect(duration).toBe(1); // 2 beats at 120 BPM = 1 second
    });

    it('should handle object positions', () => {
      const start = { measure: 0, beat: 0, tick: 0 };
      const end = { measure: 0, beat: 4, tick: 0 };
      const duration = calculateDuration(start, end, 120, 4);
      expect(duration).toBe(2); // 4 beats at 120 BPM = 2 seconds
    });

    it('should handle tick precision', () => {
      const start = '0:0:0:0';
      const end = '0:0:0:240'; // 240 ticks = 0.5 beats
      const duration = calculateDuration(start, end, 120, 4);
      expect(duration).toBe(0.25); // 0.5 beats at 120 BPM = 0.25 seconds
    });

    it('should handle different time signatures', () => {
      const duration = calculateDuration('0:0:0:0', '1:0:0:0', 120, 3);
      expect(duration).toBe(1.5); // 3 beats at 120 BPM = 1.5 seconds
    });

    it('should handle tempo changes', () => {
      const start = '0:0:0:0';
      const end = '1:0:0:0'; // 1 bar (4 beats)

      // At 120 BPM: 4 beats = 2 seconds
      expect(calculateDuration(start, end, 120, 4)).toBe(2);

      // At 60 BPM: 4 beats = 4 seconds
      expect(calculateDuration(start, end, 60, 4)).toBe(4);
    });
  });

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================

  describe('barsToBeats', () => {
    it('should convert 2 bars to 8 beats in 4/4', () => {
      expect(barsToBeats(2, 4)).toBe(8);
    });

    it('should convert 1 bar to 3 beats in 3/4', () => {
      expect(barsToBeats(1, 3)).toBe(3);
    });

    it('should convert 0 bars to 0 beats', () => {
      expect(barsToBeats(0, 4)).toBe(0);
    });

    it('should handle fractional bars', () => {
      expect(barsToBeats(1.5, 4)).toBe(6);
    });

    it('should use default 4/4 time signature', () => {
      expect(barsToBeats(2)).toBe(8);
    });
  });

  describe('beatsToBars', () => {
    it('should convert 8 beats to 2 bars in 4/4', () => {
      expect(beatsToBars(8, 4)).toBe(2);
    });

    it('should convert 3 beats to 1 bar in 3/4', () => {
      expect(beatsToBars(3, 3)).toBe(1);
    });

    it('should convert 6 beats to 1.5 bars in 4/4', () => {
      expect(beatsToBars(6, 4)).toBe(1.5);
    });

    it('should convert 0 beats to 0 bars', () => {
      expect(beatsToBars(0, 4)).toBe(0);
    });

    it('should use default 4/4 time signature', () => {
      expect(beatsToBars(8)).toBe(2);
    });

    it('should be inverse of barsToBeats', () => {
      const bars = 3.5;
      const beatsPerBar = 4;
      const beats = barsToBeats(bars, beatsPerBar);
      const roundTrip = beatsToBars(beats, beatsPerBar);
      expect(roundTrip).toBe(bars);
    });
  });

  // ============================================================================
  // Edge Cases and Integration Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very large positions', () => {
      const position = '100:0:0:0'; // 100 bars
      const beats = parsePositionToBeats(position, 4);
      expect(beats).toBe(400); // 100 bars * 4 beats = 400 beats
    });

    it('should handle very small tick values', () => {
      const position = '0:0:0:1'; // 1 tick
      const beats = parsePositionToBeats(position, 4);
      expect(beats).toBeCloseTo(0.00208333, 5); // 1/480 beats
    });

    it('should handle maximum tick precision', () => {
      const position = '0:0:0:479'; // Maximum tick value (0-479)
      const beats = parsePositionToBeats(position, 4);
      expect(beats).toBeCloseTo(0.998, 3); // Almost 1 beat
    });

    it('should handle negative values gracefully', () => {
      // Functions should handle negative inputs (even if unusual)
      expect(beatsToSeconds(-1, 120)).toBe(-0.5);
      expect(secondsToBeats(-0.5, 120)).toBe(-1);
    });

    it('should maintain precision across conversions', () => {
      const originalPosition = '2:3:1:250';
      const beats = parsePositionToBeats(originalPosition, 4);
      const seconds = beatsToSeconds(beats, 135);
      const roundTripBeats = secondsToBeats(seconds, 135);

      expect(roundTripBeats).toBeCloseTo(beats, 10);
    });

    it('should handle all time signature variations', () => {
      const position = '1:0:0:0';

      expect(parsePositionToBeats(position, 2)).toBe(2); // 2/4
      expect(parsePositionToBeats(position, 3)).toBe(3); // 3/4
      expect(parsePositionToBeats(position, 4)).toBe(4); // 4/4
      expect(parsePositionToBeats(position, 5)).toBe(5); // 5/4
      expect(parsePositionToBeats(position, 6)).toBe(6); // 6/8
      expect(parsePositionToBeats(position, 7)).toBe(7); // 7/8
    });

    it('should handle extreme tempo values', () => {
      const beats = 4;

      // Very slow tempo (30 BPM)
      expect(beatsToSeconds(beats, 30)).toBe(8);

      // Very fast tempo (400 BPM)
      expect(beatsToSeconds(beats, 400)).toBe(0.6);
    });
  });

  // ============================================================================
  // Comparison Tests (validate against TimePositionConverter behavior)
  // ============================================================================

  describe('TimePositionConverter Compatibility', () => {
    it('should match TimePositionConverter position parsing', () => {
      // Test cases from actual usage
      const testCases: Array<{
        position: PositionInput;
        bpm: number;
        expected: number;
      }> = [
        { position: '0:0:0:0', bpm: 120, expected: 0 },
        { position: '1:0:0:0', bpm: 120, expected: 2 },
        { position: '0:1:0:0', bpm: 120, expected: 0.5 },
        { position: '0:0:2:0', bpm: 120, expected: 0.25 }, // 2 sixteenths
        { position: { measure: 0, beat: 0, tick: 240 }, bpm: 120, expected: 0.25 },
      ];

      for (const { position, bpm, expected } of testCases) {
        const result = parsePosition(position, bpm, 4);
        expect(result).toBeCloseTo(expected, 5);
      }
    });

    it('should match TimePositionConverter duration parsing', () => {
      const testCases: Array<{ duration: string; bpm: number; expected: number }> =
        [
          { duration: '1n', bpm: 120, expected: 2 }, // Whole note
          { duration: '2n', bpm: 120, expected: 1 }, // Half note
          { duration: '4n', bpm: 120, expected: 0.5 }, // Quarter note
          { duration: '8n', bpm: 120, expected: 0.25 }, // Eighth note
          { duration: '16n', bpm: 120, expected: 0.125 }, // Sixteenth note
        ];

      for (const { duration, bpm, expected } of testCases) {
        const result = parseDuration(duration, bpm);
        expect(result).toBeCloseTo(expected, 5);
      }
    });

    it('should match TimePositionConverter tick precision handling', () => {
      // TimePositionConverter uses 480 PPQ MIDI standard
      const TICKS_PER_BEAT = 480;

      // Test that our implementation matches this precision
      expect(parsePositionToBeats('0:0:0:480', 4)).toBe(1); // 480 ticks = 1 beat
      expect(parsePositionToBeats('0:0:0:240', 4)).toBe(0.5); // 240 ticks = 0.5 beats
      expect(parsePositionToBeats('0:0:0:120', 4)).toBe(0.25); // 120 ticks = 0.25 beats
    });

    it('should ignore subdivision field like TimePositionConverter', () => {
      // TimePositionConverter comment: "Use ONLY tick field - subdivision is redundant"
      const withSubdivision = {
        measure: 0,
        beat: 0,
        subdivision: 2, // Should be ignored
        tick: 240,
      };

      const result = parsePositionToBeats(withSubdivision, 4);
      expect(result).toBe(0.5); // Should use tick (240) only
    });
  });
});
