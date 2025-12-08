/**
 * Timeline tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Timeline } from '../core/Timeline.js';
import { TimelineError } from '../types/errors.js';
import { MusicalPosition, TimeSignature } from '../types/index.js';

describe('Timeline', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = new Timeline();
  });

  describe('tempo management', () => {
    // DEPRECATED: setTempo() is now a no-op - use musicalTruth.setFromExercise() instead
    it.skip('should set and get tempo', () => {
      timeline.setTempo(140);
      expect(timeline.getTempo()).toBe(140);
    });

    // DEPRECATED: setTempo() no longer validates - use musicalTruth.setFromExercise() instead
    it.skip('should throw error for invalid tempo', () => {
      expect(() => timeline.setTempo(0)).toThrow(TimelineError);
      expect(() => timeline.setTempo(-1)).toThrow(TimelineError);
      expect(() => timeline.setTempo(1000)).toThrow(TimelineError);
    });

    it('should default to 120 BPM', () => {
      expect(timeline.getTempo()).toBe(120);
    });
  });

  describe('time signature management', () => {
    // DEPRECATED: setTimeSignature() is now a no-op - use musicalTruth.setFromExercise() instead
    it.skip('should set and get time signature', () => {
      const sig: TimeSignature = { numerator: 3, denominator: 4 };
      timeline.setTimeSignature(sig);
      expect(timeline.getTimeSignature()).toEqual(sig);
    });

    // DEPRECATED: setTimeSignature() no longer validates - use musicalTruth.setFromExercise() instead
    it.skip('should throw error for invalid time signature', () => {
      expect(() =>
        timeline.setTimeSignature({ numerator: 0, denominator: 4 }),
      ).toThrow(TimelineError);
      expect(() =>
        timeline.setTimeSignature({ numerator: 4, denominator: 0 }),
      ).toThrow(TimelineError);
    });

    it('should default to 4/4', () => {
      expect(timeline.getTimeSignature()).toEqual({
        numerator: 4,
        denominator: 4,
      });
    });
  });

  describe('position management', () => {
    it('should set and get position', () => {
      const position: MusicalPosition = {
        bars: 2,
        beats: 3,
        sixteenths: 1,
        ticks: 240,
      };
      timeline.setPosition(position);
      expect(timeline.getPosition()).toEqual(position);
    });

    it('should start at position 0:0:0', () => {
      expect(timeline.getPosition()).toEqual({
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      });
    });
  });

  describe('position conversions', () => {
    beforeEach(() => {
      timeline.setTempo(120); // 2 beats per second
      timeline.setTimeSignature({ numerator: 4, denominator: 4 });
    });

    it('should convert position to seconds', () => {
      timeline.setPosition({ bars: 1, beats: 0, sixteenths: 0, ticks: 0 });
      expect(timeline.positionToSeconds()).toBe(2); // 1 bar = 4 beats = 2 seconds at 120 BPM

      timeline.setPosition({ bars: 0, beats: 2, sixteenths: 0, ticks: 0 });
      expect(timeline.positionToSeconds()).toBe(1); // 2 beats = 1 second at 120 BPM
    });

    it('should convert position to sixteenths', () => {
      timeline.setPosition({ bars: 1, beats: 2, sixteenths: 3, ticks: 0 });
      const sixteenths = timeline.positionToSixteenths();
      expect(sixteenths).toBe(16 + 8 + 3); // 1 bar (16) + 2 beats (8) + 3 sixteenths
    });

    it('should convert sixteenths to position', () => {
      const position = timeline.sixteenthsToPosition(27); // 1 bar + 2 beats + 3 sixteenths
      expect(position).toEqual({
        bars: 1,
        beats: 2,
        sixteenths: 3,
        ticks: 720, // 3 * 240
      });
    });

    it('should update position from seconds', () => {
      timeline.updatePositionFromSeconds(3); // 6 beats at 120 BPM
      const position = timeline.getPosition();
      expect(position.bars).toBe(1);
      expect(position.beats).toBe(2);
    });

    it('should update position from Tone format', () => {
      timeline.updatePositionFromTone('2:3:1');
      const position = timeline.getPosition();
      expect(position).toEqual({
        bars: 2,
        beats: 3,
        sixteenths: 1,
        ticks: 240,
      });
    });

    it('should convert position to Tone format', () => {
      timeline.setPosition({ bars: 2, beats: 3, sixteenths: 1, ticks: 0 });
      expect(timeline.positionToToneFormat()).toBe('2:3:1');
    });
  });

  describe('looping', () => {
    const loopStart: MusicalPosition = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };
    const loopEnd: MusicalPosition = {
      bars: 2,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };

    beforeEach(() => {
      timeline.setLoopPoints(loopStart, loopEnd);
    });

    it('should set loop points', () => {
      // No direct getter, but we can test by enabling loop and checking behavior
      timeline.setLoopEnabled(true);
      timeline.setPosition({ bars: 2, beats: 0, sixteenths: 0, ticks: 0 });
      timeline.updatePositionFromSeconds(0.001); // Tiny increment

      // Should have wrapped to start
      const position = timeline.getPosition();
      expect(position.bars).toBe(0);
    });

    it('should throw error for invalid loop points', () => {
      expect(() => {
        timeline.setLoopPoints(loopEnd, loopStart);
      }).toThrow(TimelineError);
    });

    it('should handle looping when enabled', () => {
      timeline.setLoopEnabled(true);
      timeline.setTempo(120);

      // Position at loop end
      timeline.updatePositionFromSeconds(4); // 2 bars at 120 BPM

      // Should wrap to loop start
      const position = timeline.getPosition();
      expect(position.bars).toBe(0);
    });

    it('should not loop when disabled', () => {
      timeline.setLoopEnabled(false);
      timeline.setTempo(120);

      // Position past loop end (5 seconds = 2.5 bars at 120 BPM)
      timeline.updatePositionFromSeconds(5);

      // Should continue past loop (at 2 bars and 2 beats)
      const position = timeline.getPosition();
      expect(position.bars).toBeGreaterThanOrEqual(2);

      // More precise check: should be at 2 bars, 2 beats
      if (position.bars === 2) {
        expect(position.beats).toBeGreaterThan(0);
      }
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      timeline.setTempo(120);
      timeline.setTimeSignature({ numerator: 4, denominator: 4 });
    });

    it('should calculate bar duration', () => {
      expect(timeline.getBarDuration()).toBe(2); // 4 beats at 120 BPM = 2 seconds
    });

    it('should calculate beat duration', () => {
      expect(timeline.getBeatDuration()).toBe(0.5); // 120 BPM = 0.5 seconds per beat
    });

    it('should get transport position with seconds', () => {
      timeline.setPosition({ bars: 1, beats: 0, sixteenths: 0, ticks: 0 });
      const transportPos = timeline.getTransportPosition();

      expect(transportPos).toEqual({
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
        seconds: 2,
      });
    });
  });

  describe('quantization', () => {
    it('should quantize to 16th notes', () => {
      const position: MusicalPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 1,
        ticks: 120,
      };
      const quantized = timeline.quantizePosition(position, '16n');

      expect(quantized.sixteenths).toBe(1);
      expect(quantized.ticks).toBe(240); // Fully quantized
    });

    it('should quantize to 8th notes', () => {
      const position: MusicalPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 1,
        ticks: 0,
      };
      const quantized = timeline.quantizePosition(position, '8n');

      expect(quantized.sixteenths).toBe(2); // Rounded up to nearest 8th
    });

    it('should quantize to quarter notes', () => {
      const position: MusicalPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 3,
        ticks: 0,
      };
      const quantized = timeline.quantizePosition(position, '4n');

      expect(quantized.sixteenths).toBe(0); // Rounded to nearest beat
      expect(quantized.beats).toBe(1);
    });

    it('should throw error for invalid subdivision', () => {
      const position: MusicalPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };
      expect(() => timeline.quantizePosition(position, 'invalid')).toThrow(
        TimelineError,
      );
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      timeline.setTempo(140);
      timeline.setTimeSignature({ numerator: 3, denominator: 4 });
      timeline.setPosition({ bars: 5, beats: 2, sixteenths: 1, ticks: 100 });
      timeline.setLoopEnabled(true);

      timeline.reset();

      expect(timeline.getTempo()).toBe(120);
      expect(timeline.getTimeSignature()).toEqual({
        numerator: 4,
        denominator: 4,
      });
      expect(timeline.getPosition()).toEqual({
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      });
    });
  });
});
