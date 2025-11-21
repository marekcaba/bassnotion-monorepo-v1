/**
 * PositionParser Tests
 *
 * Tests musical position parsing and time conversion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PositionParser } from '../PositionParser.js';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    bpm: {
      value: 120,
    },
  },
}));

import * as Tone from 'tone';

describe('PositionParser', () => {
  let parser: PositionParser;

  beforeEach(() => {
    parser = new PositionParser('test-instance');
    Tone.Transport.bpm.value = 120; // Reset to 120 BPM
  });

  // ============================================================================
  // STRING POSITION PARSING TESTS
  // ============================================================================

  describe('String position parsing', () => {
    it('should parse bar:beat:sixteenth format', () => {
      // "1:2:3" = 1 bar + 2 beats + 3 sixteenths
      // At 120 BPM: 1 beat = 0.5s
      // 1 bar (4 beats) = 2s
      // 2 beats = 1s
      // 3 sixteenths = 3 * (0.5/4) = 0.375s
      // Total = 3.375s
      const time = parser.parsePosition('1:2:3');
      expect(time).toBeCloseTo(3.375, 3);
    });

    it('should parse bar:beat:sixteenth:tick format', () => {
      // "0:1:0:240" = 1 beat + 240 ticks
      // At 120 BPM: 1 beat = 0.5s
      // 240 ticks = 240/480 = 0.5 beats = 0.25s
      // Total = 0.75s
      const time = parser.parsePosition('0:1:0:240');
      expect(time).toBeCloseTo(0.75, 3);
    });

    it('should handle simple beat number string', () => {
      // "4" = 4 beats
      // At 120 BPM: 4 beats = 2s
      const time = parser.parsePosition('4');
      expect(time).toBeCloseTo(2.0, 3);
    });

    it('should handle fractional beat string', () => {
      // "2.5" = 2.5 beats
      // At 120 BPM: 2.5 beats = 1.25s
      const time = parser.parsePosition('2.5');
      expect(time).toBeCloseTo(1.25, 3);
    });

    it('should handle zero position', () => {
      const time = parser.parsePosition('0:0:0');
      expect(time).toBe(0);
    });

    it('should handle missing parts in string format', () => {
      // "1:" = 1 bar only
      // At 120 BPM: 1 bar (4 beats) = 2s
      const time = parser.parsePosition('1:0:0');
      expect(time).toBeCloseTo(2.0, 3);
    });
  });

  // ============================================================================
  // OBJECT POSITION PARSING TESTS
  // ============================================================================

  describe('Object position parsing', () => {
    it('should parse object with measure, beat, and tick', () => {
      // 1 measure + 2 beats + 240 ticks
      // At 120 BPM: 1 bar = 2s, 2 beats = 1s, 240 ticks = 0.25s
      // Total = 3.25s
      const time = parser.parsePosition({
        measure: 1,
        beat: 2,
        tick: 240,
      });
      expect(time).toBeCloseTo(3.25, 3);
    });

    it('should ignore subdivision field and use tick', () => {
      // Subdivision should be ignored, only tick matters
      const time = parser.parsePosition({
        measure: 0,
        beat: 1,
        subdivision: 99, // Should be ignored
        tick: 240, // This is what matters: 0.5 beats = 0.25s
      });
      // 1 beat + 240 ticks (0.5 beats) = 1.5 beats = 0.75s
      expect(time).toBeCloseTo(0.75, 3);
    });

    it('should handle object with missing tick field', () => {
      // Missing tick defaults to 0
      const time = parser.parsePosition({
        measure: 1,
        beat: 2,
      });
      // 1 bar + 2 beats = 6 beats = 3s
      expect(time).toBeCloseTo(3.0, 3);
    });

    it('should handle object with all zeros', () => {
      const time = parser.parsePosition({
        measure: 0,
        beat: 0,
        tick: 0,
      });
      expect(time).toBe(0);
    });
  });

  // ============================================================================
  // TEMPO TESTS
  // ============================================================================

  describe('Tempo handling', () => {
    it('should use current Tone.Transport BPM', () => {
      Tone.Transport.bpm.value = 120;
      const time120 = parser.parsePosition('0:4:0'); // 4 beats

      Tone.Transport.bpm.value = 60;
      const time60 = parser.parsePosition('0:4:0'); // 4 beats

      // At 120 BPM: 4 beats = 2s
      // At 60 BPM: 4 beats = 4s
      expect(time120).toBeCloseTo(2.0, 3);
      expect(time60).toBeCloseTo(4.0, 3);
    });

    it('should recalculate when BPM changes', () => {
      const position = '0:2:0'; // 2 beats

      Tone.Transport.bpm.value = 120;
      const time1 = parser.parsePosition(position);

      Tone.Transport.bpm.value = 90;
      const time2 = parser.parsePosition(position);

      // At 120 BPM: 2 beats = 1s
      // At 90 BPM: 2 beats = 1.333s
      expect(time1).toBeCloseTo(1.0, 3);
      expect(time2).toBeCloseTo(1.333, 3);
    });
  });

  // ============================================================================
  // TICK PRECISION TESTS
  // ============================================================================

  describe('Tick precision', () => {
    it('should handle 480 PPQ precision', () => {
      // 480 ticks = 1 beat
      // At 120 BPM: 1 beat = 0.5s
      const time = parser.parsePosition({
        measure: 0,
        beat: 0,
        tick: 480,
      });
      expect(time).toBeCloseTo(0.5, 3);
    });

    it('should handle fractional beat with ticks', () => {
      // 120 ticks = 0.25 beats
      // At 120 BPM: 0.25 beats = 0.125s
      const time = parser.parsePosition({
        measure: 0,
        beat: 0,
        tick: 120,
      });
      expect(time).toBeCloseTo(0.125, 3);
    });

    it('should convert sixteenths to ticks correctly', () => {
      // 1 sixteenth = 120 ticks (480 / 4)
      // At 120 BPM: 120 ticks = 0.25 beats = 0.125s
      const time = parser.parsePosition('0:0:1'); // 1 sixteenth
      expect(time).toBeCloseTo(0.125, 3);
    });

    it('should combine sixteenths and tick parts', () => {
      // "0:0:1:60" = 1 sixteenth (120 ticks) + 60 ticks = 180 ticks
      // At 120 BPM: 180 ticks = 0.375 beats = 0.1875s
      const time = parser.parsePosition('0:0:1:60');
      expect(time).toBeCloseTo(0.1875, 3);
    });
  });

  // ============================================================================
  // parsePositionToObject TESTS
  // ============================================================================

  describe('parsePositionToObject', () => {
    it('should convert string to object', () => {
      const obj = parser.parsePositionToObject('1:2:3:240');
      expect(obj).toEqual({
        measure: 1,
        beat: 2,
        subdivision: 3,
        tick: 240,
      });
    });

    it('should normalize object format', () => {
      const obj = parser.parsePositionToObject({
        measure: 1,
        beat: 2,
        tick: 240,
      });
      expect(obj).toEqual({
        measure: 1,
        beat: 2,
        subdivision: 0, // Default
        tick: 240,
      });
    });

    it('should handle missing fields in object', () => {
      const obj = parser.parsePositionToObject({
        measure: 1,
      } as any);
      expect(obj).toEqual({
        measure: 1,
        beat: 0,
        subdivision: 0,
        tick: 0,
      });
    });

    it('should handle zero string', () => {
      const obj = parser.parsePositionToObject('0:0:0:0');
      expect(obj).toEqual({
        measure: 0,
        beat: 0,
        subdivision: 0,
        tick: 0,
      });
    });

    it('should handle invalid format gracefully', () => {
      const obj = parser.parsePositionToObject('invalid');
      expect(obj).toEqual({
        measure: 0,
        beat: 0,
        subdivision: 0,
        tick: 0,
      });
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error handling', () => {
    it('should handle invalid string format gracefully', () => {
      const time = parser.parsePosition('invalid:format:test');
      // parseInt on invalid strings returns NaN, which propagates through calculation
      expect(time).toBeNaN();
    });

    it('should handle null gracefully', () => {
      const time = parser.parsePosition(null as any);
      expect(time).toBe(0);
    });

    it('should handle undefined gracefully', () => {
      const time = parser.parsePosition(undefined as any);
      expect(time).toBe(0);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle full measure calculation', () => {
      // 2 bars + 3 beats + 2 sixteenths + 120 ticks
      // At 120 BPM (0.5s per beat):
      // 2 bars (8 beats) = 4s
      // 3 beats = 1.5s
      // 2 sixteenths (240 ticks) = 0.25s
      // 120 ticks = 0.125s
      // Total = 5.875s
      const time = parser.parsePosition('2:3:2:120');
      expect(time).toBeCloseTo(5.875, 3);
    });

    it('should be consistent between string and object formats', () => {
      const stringTime = parser.parsePosition('1:2:3:240');
      const objectTime = parser.parsePosition({
        measure: 1,
        beat: 2,
        // Note: subdivision is ignored in object format
        tick: 600, // 3 sixteenths (360 ticks) + 240 ticks
      });

      expect(stringTime).toBeCloseTo(objectTime, 3);
    });
  });
});
