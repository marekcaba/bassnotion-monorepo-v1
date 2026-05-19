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

// Set up mock Tone.Transport on window BEFORE importing MusicalTruthAuthority
// We set it up on the real window object (provided by jsdom)
const setupWindowTone = () => {
  const transport = {
    bpm: { value: 120 },
    timeSignature: 4,
  };
  // Expose via both the legacy singleton and the Tone v15 factory accessor
  // so prod code observes a single source of truth regardless of which API
  // path it uses.
  (window as any).Tone = {
    Transport: transport,
    getTransport: () => transport,
  };
  return transport;
};

// Set up the mock - this happens before imports due to ES module evaluation
const mockTransport = setupWindowTone();

// Import after mock setup
import {
  MusicalTruthAuthority,
  musicalTruth,
  type Exercise,
  type MusicalTruth,
} from '../MusicalTruthAuthority';

describe('MusicalTruthAuthority', () => {
  let authority: MusicalTruthAuthority;

  // Access the mock Transport via window.Tone (same object the code uses)
  const getToneTransport = () => (window as any).Tone.Transport;

  beforeEach(() => {
    // Create fresh instance for each test
    authority = new MusicalTruthAuthority();
    // Reset mock Tone.Transport values before each test
    const transport = getToneTransport();
    transport.bpm.value = 120;
    transport.timeSignature = 4;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper alias for cleaner test assertions
  const Tone = {
    get Transport() {
      return getToneTransport();
    },
  };

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

  // ============================================================================
  // setBPM() Tests
  // ============================================================================

  describe('setBPM()', () => {
    it('should set BPM and sync with Tone.Transport', () => {
      authority.setBPM(100);

      expect(authority.getBPM()).toBe(100);
      expect(Tone.Transport.bpm.value).toBe(100);
    });

    it('should reject BPM below 20', () => {
      authority.setBPM(100); // Set initial valid value
      authority.setBPM(19); // Try to set invalid value

      expect(authority.getBPM()).toBe(100); // Should remain unchanged
    });

    it('should reject BPM above 300', () => {
      authority.setBPM(100); // Set initial valid value
      authority.setBPM(301); // Try to set invalid value

      expect(authority.getBPM()).toBe(100); // Should remain unchanged
    });

    it('should accept BPM at boundary values (20 and 300)', () => {
      authority.setBPM(20);
      expect(authority.getBPM()).toBe(20);

      authority.setBPM(300);
      expect(authority.getBPM()).toBe(300);
    });

    it('should notify listeners when BPM changes', () => {
      const listener = vi.fn();
      authority.subscribe(listener);

      authority.setBPM(95);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ bpm: 95 }),
      );
    });

    it('should automatically set userHasModifiedTempo flag to true', () => {
      expect(authority.hasUserModifiedTempo()).toBe(false);

      authority.setBPM(100);

      expect(authority.hasUserModifiedTempo()).toBe(true);
    });
  });

  // ============================================================================
  // User Tempo Modification Tracking Tests
  // ============================================================================

  describe('User Tempo Modification Tracking', () => {
    it('hasUserModifiedTempo() should return false initially', () => {
      expect(authority.hasUserModifiedTempo()).toBe(false);
    });

    it('hasUserModifiedTempo() should return true after setBPM()', () => {
      authority.setBPM(100);
      expect(authority.hasUserModifiedTempo()).toBe(true);
    });

    it('setUserModifiedTempo() should manually set the flag', () => {
      authority.setUserModifiedTempo(true);
      expect(authority.hasUserModifiedTempo()).toBe(true);

      authority.setUserModifiedTempo(false);
      expect(authority.hasUserModifiedTempo()).toBe(false);
    });

    it('resetUserModifiedTempo() should reset the flag and original BPM', () => {
      // First load an exercise
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      // Then modify tempo
      authority.setBPM(100);
      expect(authority.hasUserModifiedTempo()).toBe(true);
      expect(authority.getOriginalExerciseBpm()).toBe(69);

      // Reset
      authority.resetUserModifiedTempo();

      expect(authority.hasUserModifiedTempo()).toBe(false);
      expect(authority.getOriginalExerciseBpm()).toBeNull();
    });

    it('getOriginalExerciseBpm() should return null initially', () => {
      expect(authority.getOriginalExerciseBpm()).toBeNull();
    });

    it('getOriginalExerciseBpm() should return exercise BPM after setFromExercise()', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      expect(authority.getOriginalExerciseBpm()).toBe(69);
    });

    it('getOriginalExerciseBpm() should NOT update when preserveBPM is true', () => {
      // First load an exercise
      const exercise1: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise1);
      expect(authority.getOriginalExerciseBpm()).toBe(69);

      // Modify tempo
      authority.setBPM(100);

      // Load same exercise again with preserveBPM
      authority.setFromExercise(exercise1, { preserveBPM: true });

      // Original should still be 69 (not updated to exercise.bpm again)
      expect(authority.getOriginalExerciseBpm()).toBe(69);
      expect(authority.getBPM()).toBe(100); // User's tempo preserved
    });
  });

  // ============================================================================
  // preserveBPM Option Tests
  // ============================================================================

  describe('preserveBPM Option', () => {
    it('should use exercise BPM when preserveBPM is false', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setBPM(100); // Set different tempo first
      authority.setFromExercise(exercise, { preserveBPM: false });

      expect(authority.getBPM()).toBe(69);
    });

    it('should preserve current BPM when preserveBPM is true', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setBPM(100); // Set different tempo first
      authority.setFromExercise(exercise, { preserveBPM: true });

      expect(authority.getBPM()).toBe(100);
    });

    it('should auto-detect user modification when preserveBPM not specified', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      // Load exercise initially
      authority.setFromExercise(exercise);
      expect(authority.getBPM()).toBe(69);

      // User modifies tempo
      authority.setBPM(100);
      expect(authority.hasUserModifiedTempo()).toBe(true);

      // Load same exercise again without specifying preserveBPM
      // Should auto-detect and preserve user's tempo
      authority.setFromExercise(exercise);

      expect(authority.getBPM()).toBe(100);
    });

    it('should use exercise BPM when user has NOT modified tempo (auto-detect)', () => {
      const exercise1: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      const exercise2: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      // Load first exercise
      authority.setFromExercise(exercise1);
      expect(authority.getBPM()).toBe(69);

      // Reset flag (simulating exercise change)
      authority.resetUserModifiedTempo();

      // Load second exercise - should use its BPM since user hasn't modified
      authority.setFromExercise(exercise2);

      expect(authority.getBPM()).toBe(120);
    });

    it('should sync Tone.Transport.bpm even when preserving user tempo', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      authority.setBPM(100);
      authority.setFromExercise(exercise, { preserveBPM: true });

      // Tone.Transport should still be synced with the truth (100)
      expect(Tone.Transport.bpm.value).toBe(100);
    });
  });

  // ============================================================================
  // MusicalTruthScope Tests
  // ============================================================================

  describe('MusicalTruthScope', () => {
    it('should create a scope with automatic cleanup', () => {
      const scope = authority.createScope('test-scope');
      const listener = vi.fn();

      scope.subscribe(listener);
      expect(authority.getListenerCount()).toBe(1);

      // Dispose should remove listener
      scope.dispose();
      expect(authority.getListenerCount()).toBe(0);
    });

    it('scope should delegate getBPM() to authority', () => {
      const exercise: Exercise = {
        bpm: 95,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      const scope = authority.createScope();

      expect(scope.getBPM()).toBe(95);
    });

    it('scope should delegate getTimeSignature() to authority', () => {
      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      const scope = authority.createScope();

      expect(scope.getTimeSignature()).toEqual({
        numerator: 3,
        denominator: 4,
      });
    });

    it('scope should delegate time conversion methods', () => {
      const exercise: Exercise = {
        bpm: 120, // 2 beats per second
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      const scope = authority.createScope();

      expect(scope.secondsToBeats(1)).toBe(2);
      expect(scope.beatsToSeconds(2)).toBe(1);
    });

    it('disposed scope should not add new subscriptions', () => {
      const scope = authority.createScope();
      scope.dispose();

      const listener = vi.fn();
      scope.subscribe(listener);

      const exercise: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Complete Flow Tests (Integration-style)
  // ============================================================================

  describe('Complete User Flow', () => {
    it('should handle full tempo modification lifecycle', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 8,
      };

      // 1. Initial exercise load
      authority.setFromExercise(exercise);
      expect(authority.getBPM()).toBe(69);
      expect(authority.hasUserModifiedTempo()).toBe(false);
      expect(authority.getOriginalExerciseBpm()).toBe(69);

      // 2. User modifies tempo via slider
      authority.setBPM(100);
      expect(authority.getBPM()).toBe(100);
      expect(authority.hasUserModifiedTempo()).toBe(true);
      expect(authority.getOriginalExerciseBpm()).toBe(69);

      // 3. User clicks Play again (same exercise)
      authority.setFromExercise(exercise);
      expect(authority.getBPM()).toBe(100); // Preserved!
      expect(authority.hasUserModifiedTempo()).toBe(true);

      // 4. User selects different exercise
      authority.resetUserModifiedTempo();
      const exercise2: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 4,
      };
      authority.setFromExercise(exercise2);
      expect(authority.getBPM()).toBe(120); // New exercise tempo
      expect(authority.hasUserModifiedTempo()).toBe(false);
      expect(authority.getOriginalExerciseBpm()).toBe(120);
    });

    it('should maintain Tone.Transport sync throughout lifecycle', () => {
      const exercise: Exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      // 1. Load exercise
      authority.setFromExercise(exercise);
      expect(Tone.Transport.bpm.value).toBe(69);

      // 2. User changes tempo
      authority.setBPM(100);
      expect(Tone.Transport.bpm.value).toBe(100);

      // 3. Replay with preserved tempo
      authority.setFromExercise(exercise, { preserveBPM: true });
      expect(Tone.Transport.bpm.value).toBe(100);

      // 4. Reset and load new exercise
      authority.resetUserModifiedTempo();
      const exercise2: Exercise = {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      authority.setFromExercise(exercise2);
      expect(Tone.Transport.bpm.value).toBe(120);
    });
  });
});
