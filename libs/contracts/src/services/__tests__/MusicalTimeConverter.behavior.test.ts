/**
 * Musical Time Converter - Behavior Tests
 *
 * Comprehensive behavior tests for the professional musical time system.
 * Tests Story 3.15 implementation with industry-standard 480 ticks per quarter note.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MusicalTimeConverter } from '../MusicalTimeConverter';
import type { MusicalPosition, TimeSignature } from '../../types/musical-time';

describe('MusicalTimeConverter - Story 3.15 Behavior Tests', () => {
  const defaultTimeSignature: TimeSignature = { numerator: 4, denominator: 4 };

  describe('Professional Time Standards', () => {
    it('should use 480 ticks per quarter note industry standard', () => {
      expect(MusicalTimeConverter.TICKS_PER_QUARTER).toBe(480);
    });

    it('should maintain precision with floating point calculations', () => {
      const tick = 240; // Half quarter note
      const tempo = 120;
      const milliseconds = MusicalTimeConverter.tickToMilliseconds(tick, tempo);

      // At 120 BPM, quarter note = 500ms, so half quarter = 250ms
      expect(milliseconds).toBe(250);
    });
  });

  describe('Tick to Milliseconds Conversion', () => {
    it('should convert quarter note at 120 BPM correctly', () => {
      const quarterNoteTick = 480;
      const tempo = 120;
      const result = MusicalTimeConverter.tickToMilliseconds(
        quarterNoteTick,
        tempo,
      );

      // 120 BPM = 2 beats per second = 500ms per beat
      expect(result).toBe(500);
    });

    it('should convert at different tempos correctly', () => {
      const quarterNoteTick = 480;

      // 60 BPM = 1 beat per second = 1000ms per beat
      expect(MusicalTimeConverter.tickToMilliseconds(quarterNoteTick, 60)).toBe(
        1000,
      );

      // 240 BPM = 4 beats per second = 250ms per beat
      expect(
        MusicalTimeConverter.tickToMilliseconds(quarterNoteTick, 240),
      ).toBe(250);
    });

    it('should handle partial ticks (subdivisions)', () => {
      const eighthNoteTick = 240; // Half of 480
      const tempo = 120;
      const result = MusicalTimeConverter.tickToMilliseconds(
        eighthNoteTick,
        tempo,
      );

      expect(result).toBe(250); // Half of 500ms
    });

    it('should handle triplet timing', () => {
      const tripletEighthTick = 160; // 480/3
      const tempo = 120;
      const result = MusicalTimeConverter.tickToMilliseconds(
        tripletEighthTick,
        tempo,
      );

      expect(result).toBeCloseTo(166.67, 1); // 500ms / 3
    });
  });

  describe('Milliseconds to Tick Conversion', () => {
    it('should convert milliseconds back to ticks correctly', () => {
      const milliseconds = 500; // Quarter note at 120 BPM
      const tempo = 120;
      const result = MusicalTimeConverter.millisecondsToTick(
        milliseconds,
        tempo,
      );

      expect(result).toBe(480);
    });

    it('should be reversible with tick to milliseconds', () => {
      const originalTick = 360; // Dotted eighth note
      const tempo = 140;

      const milliseconds = MusicalTimeConverter.tickToMilliseconds(
        originalTick,
        tempo,
      );
      const backToTick = MusicalTimeConverter.millisecondsToTick(
        milliseconds,
        tempo,
      );

      expect(backToTick).toBeCloseTo(originalTick, 0.1);
    });
  });

  describe('Musical Position to Tick Conversion', () => {
    it('should convert bar 1 beat 1 to tick 0', () => {
      const position: MusicalPosition = { measure: 1, beat: 1, subdivision: 0 };
      const result = MusicalTimeConverter.musicalPositionToTick(
        position,
        defaultTimeSignature,
      );

      expect(result).toBe(0);
    });

    it('should convert bar 2 beat 1 to tick 1920 (4 beats * 480)', () => {
      const position: MusicalPosition = { measure: 2, beat: 1, subdivision: 0 };
      const result = MusicalTimeConverter.musicalPositionToTick(
        position,
        defaultTimeSignature,
      );

      expect(result).toBe(1920);
    });

    it('should handle subdivisions correctly', () => {
      const position: MusicalPosition = { measure: 1, beat: 1, subdivision: 2 };
      const result = MusicalTimeConverter.musicalPositionToTick(
        position,
        defaultTimeSignature,
      );

      // 2 subdivisions = 2 * (480/4) = 240 ticks
      expect(result).toBe(240);
    });

    it('should work with different time signatures', () => {
      const threeFourTime: TimeSignature = { numerator: 3, denominator: 4 };
      const position: MusicalPosition = { measure: 2, beat: 1, subdivision: 0 };
      const result = MusicalTimeConverter.musicalPositionToTick(
        position,
        threeFourTime,
      );

      // 3/4 time: 1 bar = 3 beats = 3 * 480 = 1440 ticks
      expect(result).toBe(1440);
    });
  });

  describe('Tick to Musical Position Conversion', () => {
    it('should convert tick 0 to bar 1 beat 1', () => {
      const result = MusicalTimeConverter.tickToMusicalPosition(
        0,
        defaultTimeSignature,
      );

      expect(result).toEqual({ measure: 1, beat: 1, subdivision: 0 });
    });

    it('should convert tick 1920 to bar 2 beat 1', () => {
      const result = MusicalTimeConverter.tickToMusicalPosition(
        1920,
        defaultTimeSignature,
      );

      expect(result).toEqual({ measure: 2, beat: 1, subdivision: 0 });
    });

    it('should handle subdivisions correctly', () => {
      const result = MusicalTimeConverter.tickToMusicalPosition(
        240,
        defaultTimeSignature,
      );

      expect(result).toEqual({ measure: 1, beat: 1, subdivision: 2 });
    });

    it('should handle mid-beat positions', () => {
      const result = MusicalTimeConverter.tickToMusicalPosition(
        720,
        defaultTimeSignature,
      );

      // 720 ticks = 1 beat + 240 ticks = bar 1, beat 2, subdivision 2
      expect(result).toEqual({ measure: 1, beat: 2, subdivision: 2 });
    });
  });

  describe('Exercise Duration Calculations', () => {
    it('should calculate total duration for 4 bar exercise', () => {
      const totalBars = 4;
      const tempo = 120;
      const result = MusicalTimeConverter.calculateExerciseDuration(
        totalBars,
        defaultTimeSignature,
        tempo,
      );

      // 4 bars * 4 beats * 500ms = 8000ms
      expect(result).toBe(8000);
    });

    it('should work with different time signatures', () => {
      const threeFourTime: TimeSignature = { numerator: 3, denominator: 4 };
      const totalBars = 2;
      const tempo = 120;
      const result = MusicalTimeConverter.calculateExerciseDuration(
        totalBars,
        threeFourTime,
        tempo,
      );

      // 2 bars * 3 beats * 500ms = 3000ms
      expect(result).toBe(3000);
    });

    it('should handle different tempos', () => {
      const totalBars = 1;
      const tempo = 60; // Slower tempo
      const result = MusicalTimeConverter.calculateExerciseDuration(
        totalBars,
        defaultTimeSignature,
        tempo,
      );

      // 1 bar * 4 beats * 1000ms = 4000ms
      expect(result).toBe(4000);
    });
  });

  describe('Tempo Independence', () => {
    it('should maintain musical relationships at different tempos', () => {
      const position: MusicalPosition = { measure: 1, beat: 2, subdivision: 1 };
      const tick = MusicalTimeConverter.musicalPositionToTick(
        position,
        defaultTimeSignature,
      );

      // Should be same tick value regardless of tempo
      expect(tick).toBe(600); // 480 + 120

      // But milliseconds should differ
      const ms120 = MusicalTimeConverter.tickToMilliseconds(tick, 120);
      const ms60 = MusicalTimeConverter.tickToMilliseconds(tick, 60);

      expect(ms120).toBe(625);
      expect(ms60).toBe(1250);
      expect(ms60).toBe(ms120 * 2); // Double the time at half tempo
    });
  });

  describe('Quantization Support', () => {
    it('should quantize to nearest subdivision', () => {
      const tick = 125; // Between subdivisions
      const result = MusicalTimeConverter.quantizeToSubdivision(tick, 4); // 16th note grid

      expect(result).toBe(120); // 480/4 = 120 ticks per 16th note
    });

    it('should handle triplet quantization', () => {
      const tick = 170; // Close to triplet
      const result = MusicalTimeConverter.quantizeToTriplet(tick);

      expect(result).toBe(160); // 480/3 = 160 ticks per triplet
    });
  });

  describe('Complex Musical Patterns', () => {
    it('should handle swing feel calculation', () => {
      const straightEighthTick = 240;
      const swingFactor = 0.6; // 60% swing
      const result = MusicalTimeConverter.applySwingFeel(
        straightEighthTick,
        swingFactor,
      );

      // Swing should delay off-beats
      expect(result).toBeGreaterThan(straightEighthTick);
    });

    it('should support polyrhythm calculations', () => {
      const quarterNoteTick = 480; // One quarter note

      // 3 against 2 polyrhythm
      const polyrhythmTick = MusicalTimeConverter.calculatePolyrhythm(
        quarterNoteTick,
        3,
        2,
      );

      expect(polyrhythmTick).toBe(320); // 480 * 2/3
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tempo values gracefully', () => {
      expect(() => {
        MusicalTimeConverter.tickToMilliseconds(480, 0);
      }).toThrow('Invalid tempo: must be greater than 0');
    });

    it('should handle negative ticks', () => {
      const result = MusicalTimeConverter.tickToMusicalPosition(
        -240,
        defaultTimeSignature,
      );

      expect(result.measure).toBe(1);
      expect(result.beat).toBe(1);
      expect(result.subdivision).toBe(0);
    });

    it('should handle invalid time signatures', () => {
      const invalidTimeSignature: TimeSignature = {
        numerator: 0,
        denominator: 4,
      };

      expect(() => {
        MusicalTimeConverter.musicalPositionToTick(
          { measure: 1, beat: 1, subdivision: 0 },
          invalidTimeSignature,
        );
      }).toThrow('Invalid time signature');
    });
  });

  describe('Performance Requirements', () => {
    it('should process conversions within performance requirements', () => {
      const startTime = performance.now();

      // Process 1000 conversions
      for (let i = 0; i < 1000; i++) {
        MusicalTimeConverter.tickToMilliseconds(i * 120, 120);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 10ms for 1000 conversions
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Integration with Story 3.15 Components', () => {
    it('should provide tick values for drum pattern scheduling', () => {
      const kickPosition: MusicalPosition = {
        measure: 1,
        beat: 1,
        subdivision: 0,
      };
      const snarePosition: MusicalPosition = {
        measure: 1,
        beat: 2,
        subdivision: 0,
      };

      const kickTick = MusicalTimeConverter.musicalPositionToTick(
        kickPosition,
        defaultTimeSignature,
      );
      const snareTick = MusicalTimeConverter.musicalPositionToTick(
        snarePosition,
        defaultTimeSignature,
      );

      expect(kickTick).toBe(0);
      expect(snareTick).toBe(480);
      expect(snareTick - kickTick).toBe(480); // One beat apart
    });

    it('should support bass note timing with techniques', () => {
      const noteStart: MusicalPosition = {
        measure: 1,
        beat: 1,
        subdivision: 0,
      };
      const slideTarget: MusicalPosition = {
        measure: 1,
        beat: 1,
        subdivision: 1,
      };

      const startTick = MusicalTimeConverter.musicalPositionToTick(
        noteStart,
        defaultTimeSignature,
      );
      const slideTick = MusicalTimeConverter.musicalPositionToTick(
        slideTarget,
        defaultTimeSignature,
      );

      expect(slideTick - startTick).toBe(120); // One subdivision
    });

    it('should handle harmony chord changes at bar boundaries', () => {
      const chordChanges = [
        { measure: 1, beat: 1, subdivision: 0 },
        { measure: 2, beat: 1, subdivision: 0 },
        { measure: 3, beat: 1, subdivision: 0 },
        { measure: 4, beat: 1, subdivision: 0 },
      ];

      const ticks = chordChanges.map((pos) =>
        MusicalTimeConverter.musicalPositionToTick(pos, defaultTimeSignature),
      );

      expect(ticks).toEqual([0, 1920, 3840, 5760]);
    });
  });
});
