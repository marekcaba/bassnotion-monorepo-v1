/**
 * MusicalTruthAuthority Unit Tests
 *
 * Tests the single source of truth for all musical timing parameters.
 * This is the core component that ensures BPM, time signature, and duration
 * are consistent across all playback systems.
 *
 * Coverage:
 * 1. setFromExercise() sets all musical parameters correctly
 * 2. Tone.Transport.bpm is synchronized immediately
 * 3. Listeners are notified on changes
 * 4. Getter methods return correct values
 * 5. Time conversion utilities work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Tone from 'tone';

// Mock Tone.js Transport
vi.mock('tone', () => ({
  Transport: {
    bpm: { value: 120 },
    timeSignature: 4,
  },
}));

// Import after mock setup
import {
  MusicalTruthAuthority,
  musicalTruth,
  type Exercise,
  type MusicalTruth,
} from '../MusicalTruthAuthority';

describe('MusicalTruthAuthority', () => {
  let authority: MusicalTruthAuthority;

  beforeEach(() => {
    // Create fresh instance for each test
    authority = new MusicalTruthAuthority();
    // Reset Tone.Transport mock
    Tone.Transport.bpm.value = 120;
    Tone.Transport.timeSignature = 4;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(authority.getBPM()).toBe(120);
      expect(authority.getTimeSignature()).toEqual({
        numerator: 4,
        denominator: 4,
      });
      expect(authority.getDurationBars()).toBe(4);
      expect(authority.getCountdownBars()).toBe(1);
      expect(authority.getTotalBars()).toBe(5);
    });

    it('should export singleton instance', () => {
      expect(musicalTruth).toBeInstanceOf(MusicalTruthAuthority);
    });
  });

  // ============================================================================
  // setFromExercise() Tests
  // ============================================================================

  describe('setFromExercise()', () => {
    it('should set BPM from exercise', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getBPM()).toBe(69);
    });

    it('should set time signature from exercise', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getTimeSignature()).toEqual({
        numerator: 3,
        denominator: 4,
      });
    });

    it('should calculate duration from total_bars', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 8,
      };

      authority.setFromExercise(exercise);

      expect(authority.getDurationBars()).toBe(8);
      expect(authority.getTotalBars()).toBe(9); // 8 + 1 countdown
    });

    it('should calculate duration from duration_beats', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        duration_beats: 16, // 16 beats = 4 bars in 4/4
      };

      authority.setFromExercise(exercise);

      expect(authority.getDurationBars()).toBe(4);
    });

    it('should calculate duration from notes array (with +1 for 0-indexed positions)', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        notes: [
          { position: { measure: 1 } },
          { position: { measure: 2 } },
          { position: { measure: 6 } }, // Last note in measure 6 (0-indexed)
        ],
      };

      authority.setFromExercise(exercise);

      // Duration is lastMeasure + 1 because positions may be 0-indexed
      // lastMeasure = 6, so duration = 6 + 1 = 7
      expect(authority.getDurationBars()).toBe(7);
    });

    it('should default to 4 bars if no duration info', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getDurationBars()).toBe(4);
    });

    it('should always set countdown to 1 bar', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 16,
      };

      authority.setFromExercise(exercise);

      expect(authority.getCountdownBars()).toBe(1);
    });

    it('should synchronize Tone.Transport.bpm immediately', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(Tone.Transport.bpm.value).toBe(69);
    });

    it('should synchronize Tone.Transport.timeSignature immediately', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 6, denominator: 8 },
      };

      authority.setFromExercise(exercise);

      expect(Tone.Transport.timeSignature).toBe(6);
    });
  });

  // ============================================================================
  // Listener/Subscription Tests
  // ============================================================================

  describe('Subscriptions', () => {
    it('should notify listeners when exercise is set', () => {
      const listener = vi.fn();
      authority.subscribe(listener);

      const exercise: Exercise = {
        bpm: 90,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          bpm: 90,
          timeSignature: { numerator: 4, denominator: 4 },
        }),
      );
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      authority.subscribe(listener1);
      authority.subscribe(listener2);

      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = authority.subscribe(listener);

      unsubscribe();

      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Getter Methods Tests
  // ============================================================================

  describe('Getter Methods', () => {
    beforeEach(() => {
      const exercise: Exercise = {
        bpm: 90,
        timeSignature: { numerator: 3, denominator: 4 },
        total_bars: 8,
      };
      authority.setFromExercise(exercise);
    });

    it('getBPM() returns current tempo', () => {
      expect(authority.getBPM()).toBe(90);
    });

    it('getTimeSignature() returns current meter', () => {
      expect(authority.getTimeSignature()).toEqual({
        numerator: 3,
        denominator: 4,
      });
    });

    it('getDurationBars() returns exercise duration without countdown', () => {
      expect(authority.getDurationBars()).toBe(8);
    });

    it('getDurationBeats() returns duration in beats', () => {
      // 8 bars * 3 beats per bar (3/4 time) = 24 beats
      expect(authority.getDurationBeats()).toBe(24);
    });

    it('getCountdownBars() returns countdown duration', () => {
      expect(authority.getCountdownBars()).toBe(1);
    });

    it('getCountdownBeats() returns countdown in beats', () => {
      // 1 bar * 3 beats per bar (3/4 time) = 3 beats
      expect(authority.getCountdownBeats()).toBe(3);
    });

    it('getTotalBars() returns exercise + countdown', () => {
      expect(authority.getTotalBars()).toBe(9); // 8 + 1
    });

    it('getTotalBeats() returns total in beats', () => {
      // 9 bars * 3 beats per bar = 27 beats
      expect(authority.getTotalBeats()).toBe(27);
    });

    it('getTruth() returns complete readonly object', () => {
      const truth = authority.getTruth();
      expect(truth).toEqual({
        bpm: 90,
        timeSignature: { numerator: 3, denominator: 4 },
        durationBars: 8,
        countdownBars: 1,
        totalBars: 9,
      });
    });
  });

  // ============================================================================
  // Time Conversion Utilities Tests
  // ============================================================================

  describe('Time Conversion Utilities', () => {
    beforeEach(() => {
      const exercise: Exercise = {
        bpm: 120, // 2 beats per second
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);
    });

    it('secondsToBeats() converts correctly', () => {
      // At 120 BPM, 2 beats per second
      expect(authority.secondsToBeats(1)).toBe(2);
      expect(authority.secondsToBeats(0.5)).toBe(1);
      expect(authority.secondsToBeats(30)).toBe(60);
    });

    it('beatsToSeconds() converts correctly', () => {
      // At 120 BPM, 1 beat = 0.5 seconds
      expect(authority.beatsToSeconds(2)).toBe(1);
      expect(authority.beatsToSeconds(1)).toBe(0.5);
      expect(authority.beatsToSeconds(60)).toBe(30);
    });

    it('barsToBeats() converts correctly', () => {
      // 4/4 time, 4 beats per bar
      expect(authority.barsToBeats(1)).toBe(4);
      expect(authority.barsToBeats(2)).toBe(8);
      expect(authority.barsToBeats(0.5)).toBe(2);
    });

    it('beatsToBars() converts correctly', () => {
      // 4/4 time, 4 beats per bar
      expect(authority.beatsToBars(4)).toBe(1);
      expect(authority.beatsToBars(8)).toBe(2);
      expect(authority.beatsToBars(2)).toBe(0.5);
    });

    it('conversions work with different time signatures', () => {
      const exercise: Exercise = {
        bpm: 60, // 1 beat per second
        timeSignature: { numerator: 6, denominator: 8 },
      };
      authority.setFromExercise(exercise);

      // 6/8 time, 6 beats per bar
      expect(authority.barsToBeats(1)).toBe(6);
      expect(authority.beatsToBars(6)).toBe(1);

      // At 60 BPM, 1 beat = 1 second
      expect(authority.secondsToBeats(6)).toBe(6);
      expect(authority.beatsToSeconds(6)).toBe(6);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle exercise with 0 notes gracefully', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        notes: [],
      };

      authority.setFromExercise(exercise);

      expect(authority.getDurationBars()).toBe(4); // Default fallback
    });

    it('should handle notes without position.measure', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        notes: [{ position: {} }, { position: undefined }] as any,
      };

      authority.setFromExercise(exercise);

      expect(authority.getDurationBars()).toBe(4); // Default fallback
    });

    it('should handle very slow tempo', () => {
      const exercise: Exercise = {
        bpm: 20,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getBPM()).toBe(20);
      expect(Tone.Transport.bpm.value).toBe(20);
    });

    it('should handle very fast tempo', () => {
      const exercise: Exercise = {
        bpm: 300,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getBPM()).toBe(300);
      expect(Tone.Transport.bpm.value).toBe(300);
    });

    it('should handle unusual time signatures', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 7, denominator: 8 },
      };

      authority.setFromExercise(exercise);

      expect(authority.getTimeSignature()).toEqual({
        numerator: 7,
        denominator: 8,
      });
      expect(Tone.Transport.timeSignature).toBe(7);
    });
  });
});
