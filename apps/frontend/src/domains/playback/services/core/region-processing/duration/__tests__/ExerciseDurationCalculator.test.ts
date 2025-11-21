/**
 * ExerciseDurationCalculator Tests
 *
 * Tests exercise duration calculation and last beat threshold logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExerciseDurationCalculator,
  Track,
} from '../ExerciseDurationCalculator.js';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    bpm: {
      value: 120,
    },
  },
}));

describe('ExerciseDurationCalculator', () => {
  let calculator: ExerciseDurationCalculator;

  beforeEach(() => {
    calculator = new ExerciseDurationCalculator('test-instance');
  });

  // ============================================================================
  // BASIC DURATION CALCULATION TESTS
  // ============================================================================

  describe('Basic duration calculation', () => {
    it('should calculate duration for single track with one region', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 4, // 4 beats
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      // 4 beats * 0.5s/beat (120 BPM) = 2s
      expect(result.exerciseEndTime).toBe(2.0);
      // Last beat threshold = 2s - 0.5s = 1.5s
      expect(result.lastBeatThreshold).toBe(1.5);
    });

    it('should calculate duration for multiple tracks', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 4, // 4 beats = 2s
            },
          ],
        },
        {
          regions: [
            {
              startTime: 0,
              duration: 8, // 8 beats = 4s (longer)
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      // Should use longest region (8 beats = 4s)
      expect(result.exerciseEndTime).toBe(4.0);
      expect(result.lastBeatThreshold).toBe(3.5);
    });

    it('should calculate duration for track with multiple regions', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 4, // Ends at 2s
            },
            {
              startTime: 2, // Starts at 2s
              duration: 4, // Ends at 4s
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      // Last region ends at 2s + 2s = 4s
      expect(result.exerciseEndTime).toBe(4.0);
      expect(result.lastBeatThreshold).toBe(3.5);
    });
  });

  // ============================================================================
  // COUNTDOWN OFFSET TESTS
  // ============================================================================

  describe('Countdown offset', () => {
    it('should add countdown offset when enabled (4 beats)', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 4, // 4 beats = 2s
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, true, 4);

      // 2s + (4 beats * 0.5s/beat) = 2s + 2s = 4s
      expect(result.exerciseEndTime).toBe(4.0);
      // Last beat threshold = 4s - 0.5s = 3.5s
      expect(result.lastBeatThreshold).toBe(3.5);
    });

    it('should not add countdown offset when disabled', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 4, // 4 beats = 2s
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 4);

      // No offset added
      expect(result.exerciseEndTime).toBe(2.0);
      expect(result.lastBeatThreshold).toBe(1.5);
    });

    it('should handle different countdown beat counts', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 8, // 8 beats = 4s
            },
          ],
        },
      ];

      // 2 beat countdown
      const result2 = calculator.calculateDuration(tracks, true, 2);
      expect(result2.exerciseEndTime).toBe(5.0); // 4s + 1s
      expect(result2.lastBeatThreshold).toBe(4.5);

      // 8 beat countdown
      const result8 = calculator.calculateDuration(tracks, true, 8);
      expect(result8.exerciseEndTime).toBe(8.0); // 4s + 4s
      expect(result8.lastBeatThreshold).toBe(7.5);
    });
  });

  // ============================================================================
  // LAST BEAT THRESHOLD TESTS
  // ============================================================================

  describe('Last beat threshold', () => {
    it('should calculate last beat as final 1 beat before end', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 16, // 16 beats = 8s
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      expect(result.exerciseEndTime).toBe(8.0);
      // Last beat starts 0.5s before end (1 beat @ 120 BPM)
      expect(result.lastBeatThreshold).toBe(7.5);
    });

    it('should never return negative last beat threshold', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 0.5, // 0.5 beats = 0.25s (shorter than 1 beat)
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      // Last beat threshold clamped to 0 (Math.max)
      expect(result.lastBeatThreshold).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle empty track list', () => {
      const tracks: Track[] = [];

      const result = calculator.calculateDuration(tracks, false, 0);

      expect(result.exerciseEndTime).toBe(0);
      expect(result.lastBeatThreshold).toBe(0);
    });

    it('should handle track with no regions', () => {
      const tracks: Track[] = [{ regions: [] }];

      const result = calculator.calculateDuration(tracks, false, 0);

      expect(result.exerciseEndTime).toBe(0);
      expect(result.lastBeatThreshold).toBe(0);
    });

    it('should handle zero duration region', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 0,
              duration: 0,
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      expect(result.exerciseEndTime).toBe(0);
      expect(result.lastBeatThreshold).toBe(0);
    });

    it('should handle region with non-zero startTime', () => {
      const tracks: Track[] = [
        {
          regions: [
            {
              startTime: 2, // Starts at 2s
              duration: 4, // 4 beats = 2s
            },
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, false, 0);

      // Region ends at 2s + 2s = 4s
      expect(result.exerciseEndTime).toBe(4.0);
      expect(result.lastBeatThreshold).toBe(3.5);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle realistic multi-track exercise', () => {
      const tracks: Track[] = [
        // Bass track
        {
          regions: [
            { startTime: 0, duration: 16 }, // 8s
          ],
        },
        // Harmony track
        {
          regions: [
            { startTime: 0, duration: 16 }, // 8s
          ],
        },
        // Drums track
        {
          regions: [
            { startTime: 0, duration: 16 }, // 8s
          ],
        },
        // Metronome track (might be shorter)
        {
          regions: [
            { startTime: 0, duration: 12 }, // 6s
          ],
        },
      ];

      const result = calculator.calculateDuration(tracks, true, 4);

      // Longest region is 8s, + 2s countdown = 10s
      expect(result.exerciseEndTime).toBe(10.0);
      expect(result.lastBeatThreshold).toBe(9.5);
    });
  });
});
