/**
 * SustainPedalHandler Tests
 *
 * Comprehensive test coverage for CC64 sustain pedal logic
 * Tests all scenarios from legacy HarmonyScheduler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SustainPedalHandler } from '../SustainPedalHandler.js';

// Helper to create mock AudioBuffer
function createMockBuffer(duration: number): AudioBuffer {
  return {
    duration,
    length: duration * 48000,
    numberOfChannels: 2,
    sampleRate: 48000,
  } as AudioBuffer;
}

describe('SustainPedalHandler', () => {
  let handler: SustainPedalHandler;

  beforeEach(() => {
    handler = new SustainPedalHandler();
  });

  // ============================================================================
  // NO TIMELINE - Baseline Behavior
  // ============================================================================
  describe('No CC64 Timeline', () => {
    it('should return MIDI duration when no timeline set', () => {
      const buffer = createMockBuffer(2.0);
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5);
      expect(result.shouldEnableLooping).toBe(false);
      expect(result.wasPedalExtended).toBe(false);
      expect(result.debugInfo.reason).toBe('no-timeline');
    });

    it('should return MIDI duration when timeline is empty', () => {
      handler.setCC64Timeline(new Map());
      const buffer = createMockBuffer(2.0);
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5);
      expect(result.shouldEnableLooping).toBe(false);
    });
  });

  // ============================================================================
  // PEDAL NEVER AFFECTS NOTE
  // ============================================================================
  describe('Pedal Never Affects Note', () => {
    it('should use MIDI duration when pedal is always UP', () => {
      const timeline = new Map<number, boolean>([
        [0.0, false], // Pedal UP
        [2.0, false], // Still UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5);
      expect(result.wasPedalExtended).toBe(false);
      expect(result.debugInfo.reason).toBe('pedal-never-down');
    });

    it('should use MIDI duration when pedal DOWN but after note ends', () => {
      const timeline = new Map<number, boolean>([
        [0.0, false], // Pedal UP
        [2.0, true], // Pedal DOWN after note
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // Note: 1.0s - 1.5s, pedal goes DOWN at 2.0s
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5);
      expect(result.wasPedalExtended).toBe(false);
    });
  });

  // ============================================================================
  // PEDAL EXTENDS NOTE (Traditional Sustain)
  // ============================================================================
  describe('Pedal Extends Note', () => {
    it('should extend note when pedal DOWN before note and UP after MIDI note-off', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN before note
        [2.0, false], // Pedal UP after MIDI note-off
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // Note: 1.0s - 1.5s (MIDI), pedal UP at 2.0s
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(1.0); // Extended to pedal UP (2.0 - 1.0)
      expect(result.wasPedalExtended).toBe(true);
      expect(result.shouldEnableLooping).toBe(false); // 1.0s < 2.0s buffer
      expect(result.debugInfo.reason).toBe('pedal-extends');
      expect(result.debugInfo.sustainExtension).toBe(0.5); // 1.0 - 0.5
    });

    it('should enable looping when sustained duration exceeds buffer duration', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN
        [5.0, false], // Pedal UP after long sustain
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0); // Short buffer
      // Note: 1.0s - 1.5s (MIDI), pedal UP at 5.0s
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(4.0); // 5.0 - 1.0
      expect(result.shouldEnableLooping).toBe(true);
      expect(result.loopStart).toBe(1.6); // 80% of 2.0s buffer
      expect(result.loopEnd).toBe(2.0);
    });
  });

  // ============================================================================
  // SYNCOPATED PEDALING (Pedal DOWN During Note)
  // ============================================================================
  describe('Syncopated Pedaling', () => {
    it('should handle pedal going DOWN after note starts', () => {
      const timeline = new Map<number, boolean>([
        [0.0, false], // Pedal UP
        [1.2, true], // Pedal goes DOWN during note (syncopated)
        [2.5, false], // Pedal UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(3.0);
      // Note: 1.0s - 1.5s (MIDI), pedal goes DOWN at 1.2s, UP at 2.5s
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(1.5); // 2.5 - 1.0
      expect(result.wasPedalExtended).toBe(true);
      expect(result.debugInfo.reason).toBe('syncopated-pedaling');
      expect(result.debugInfo.pedalDownTime).toBe(1.2);
      expect(result.debugInfo.sustainExtension).toBe(1.0); // 1.5 - 0.5
    });

    it('should use LATEST pedal DOWN for complex pedaling', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // First pedal DOWN
        [0.8, false], // Pedal UP
        [1.2, true], // Second pedal DOWN (during note)
        [2.5, false], // Pedal UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(3.0);
      // Note: 1.0s - 1.5s, should use second pedal DOWN at 1.2s
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(1.5); // 2.5 - 1.0
      expect(result.debugInfo.pedalDownTime).toBe(1.2); // LATEST pedal DOWN
    });
  });

  // ============================================================================
  // LEGATO PEDALING (Pedal UP While Note Held)
  // ============================================================================
  describe('Legato Pedaling', () => {
    it('should ignore pedal when UP before MIDI note-off (note still held)', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN
        [1.2, false], // Pedal UP while note still held
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // Note: 1.0s - 1.5s (MIDI), pedal UP at 1.2s (before 1.5s)
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5); // Use MIDI duration
      expect(result.wasPedalExtended).toBe(false);
      expect(result.debugInfo.reason).toBe('legato-pedaling');
    });

    it('should handle overlapping chords with legato pedaling', () => {
      const timeline = new Map<number, boolean>([
        [0.0, true], // Old chord with pedal
        [1.0, false], // Pedal UP to separate chords
        [1.2, true], // Pedal DOWN again for new chord
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // New chord: 1.1s - 2.0s (MIDI), pedal UP at 1.0s (before note)
      // Then pedal DOWN again at 1.2s during note
      const result = handler.analyzeSustain(1.1, 0.9, 'D4', buffer);

      // Pedal at 1.0s is UP (before note), but goes DOWN again at 1.2s
      // Should use syncopated pedaling logic
      expect(result.sustainedDuration).toBeGreaterThan(0.9);
    });
  });

  // ============================================================================
  // NO PEDAL UP (Exercise End Capping)
  // ============================================================================
  describe('No Pedal UP - Exercise End Capping', () => {
    beforeEach(() => {
      handler.setExerciseTiming(10.0, 9.0); // Exercise ends at 10s, last beat at 9s
    });

    it('should cap at exercise end + 3s for notes in last beat', () => {
      const timeline = new Map<number, boolean>([
        [8.0, true], // Pedal DOWN, never goes UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(5.0);
      // Note in last beat: 9.5s - 10.0s (MIDI)
      const result = handler.analyzeSustain(9.5, 0.5, 'C4', buffer);

      // Should cap at exercise end + 3s = 13.0s
      // Duration: 13.0 - 9.5 = 3.5s, but capped by buffer (5.0s)
      expect(result.sustainedDuration).toBe(3.5); // Min(3.5, 5.0)
      expect(result.wasPedalExtended).toBe(true);
      expect(result.debugInfo.reason).toBe('capped-at-exercise-end');
    });

    it('should use buffer duration for notes NOT in last beat', () => {
      const timeline = new Map<number, boolean>([
        [2.0, true], // Pedal DOWN, never goes UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(3.0);
      // Note NOT in last beat: 5.0s - 5.5s (MIDI)
      const result = handler.analyzeSustain(5.0, 0.5, 'C4', buffer);

      // Should use buffer duration (3.0s)
      expect(result.sustainedDuration).toBe(3.0); // Max(0.5, 3.0)
      expect(result.wasPedalExtended).toBe(true);
      expect(result.debugInfo.reason).toBe('no-pedal-up-using-buffer');
    });

    it('should not cap when exercise end time not set', () => {
      handler.setExerciseTiming(0, 0); // No exercise timing

      const timeline = new Map<number, boolean>([
        [8.0, true], // Pedal DOWN
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(5.0);
      const result = handler.analyzeSustain(9.5, 0.5, 'C4', buffer);

      // Should use buffer duration
      expect(result.sustainedDuration).toBe(5.0);
      expect(result.debugInfo.reason).toBe('no-pedal-up-using-buffer');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle pedal UP in the past (safety check)', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN
        [0.8, false], // Pedal UP before note starts
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // Note starts at 1.0s, but pedal UP at 0.8s (in the past)
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(0.5); // Use MIDI duration
      expect(result.debugInfo.reason).toBe('pedal-never-down');
    });

    it('should handle MIDI duration of 0 (zero-length note)', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true],
        [2.0, false],
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      const result = handler.analyzeSustain(1.0, 0, 'C4', buffer);

      // Should extend to pedal UP
      expect(result.sustainedDuration).toBe(1.0); // 2.0 - 1.0
      expect(result.wasPedalExtended).toBe(true);
    });

    it('should handle very long buffer (8+ seconds)', () => {
      const timeline = new Map<number, boolean>([
        [0.5, true], // Pedal DOWN
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(8.5);
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      // No pedal UP, should use buffer duration
      expect(result.sustainedDuration).toBe(8.5);
      expect(result.shouldEnableLooping).toBe(false); // Doesn't exceed buffer
    });
  });

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  describe('Utility Methods', () => {
    it('should clear timeline', () => {
      const timeline = new Map<number, boolean>([[1.0, true]]);
      handler.setCC64Timeline(timeline);
      expect(handler.getTimelineSize()).toBe(1);

      handler.clear();
      expect(handler.getTimelineSize()).toBe(0);
    });

    it('should get timeline size', () => {
      const timeline = new Map<number, boolean>([
        [1.0, true],
        [2.0, false],
        [3.0, true],
      ]);
      handler.setCC64Timeline(timeline);
      expect(handler.getTimelineSize()).toBe(3);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS (from legacy tests)
  // ============================================================================
  describe('Real-World Scenarios', () => {
    it('should handle typical piano sustain: note → pedal extends → release', () => {
      const timeline = new Map<number, boolean>([
        [1.0, true], // Pedal DOWN when note starts
        [2.5, false], // Pedal UP
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(2.0);
      // Play C4: 1.0s - 1.5s (MIDI)
      const result = handler.analyzeSustain(1.0, 0.5, 'C4', buffer);

      expect(result.sustainedDuration).toBe(1.5); // Extended to 2.5s
      expect(result.wasPedalExtended).toBe(true);
      expect(result.shouldEnableLooping).toBe(false);
    });

    it('should handle chord progression with pedal changes', () => {
      const timeline = new Map<number, boolean>([
        [0.0, true], // Pedal for C major chord
        [2.0, false], // Release
        [2.1, true], // Press for G major chord
        [4.0, false], // Release
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(3.0);

      // First chord (C4): 0.5s - 1.0s
      const result1 = handler.analyzeSustain(0.5, 0.5, 'C4', buffer);
      expect(result1.sustainedDuration).toBe(1.5); // 2.0 - 0.5

      // Second chord (G4): 2.5s - 3.0s
      const result2 = handler.analyzeSustain(2.5, 0.5, 'G4', buffer);
      expect(result2.sustainedDuration).toBe(1.5); // 4.0 - 2.5
    });

    it('should handle Grand Piano final chord ring-out', () => {
      handler.setExerciseTiming(10.0, 9.0);

      const timeline = new Map<number, boolean>([
        [9.0, true], // Final chord with pedal
        // No pedal UP - let it ring
      ]);
      handler.setCC64Timeline(timeline);

      const buffer = createMockBuffer(6.0);
      // Final chord: 9.5s - 10.0s (exercise ends at 10.0s)
      const result = handler.analyzeSustain(9.5, 0.5, 'C2', buffer);

      // Should cap at exercise end + 3s = 13.0s
      // Duration: 13.0 - 9.5 = 3.5s (< buffer 6.0s)
      expect(result.sustainedDuration).toBe(3.5);
      expect(result.shouldEnableLooping).toBe(false); // 3.5s does NOT exceed 6.0s buffer
    });
  });
});
