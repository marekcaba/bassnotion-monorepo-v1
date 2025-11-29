/**
 * FadeoutManager Tests
 *
 * Comprehensive test coverage for musical fadeout automation
 * Tests normal fadeouts, last-note fadeouts, and gain automation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FadeoutManager } from '../FadeoutManager.js';

// Mock GainNode with automation methods
function createMockGainNode(): GainNode {
  const gain = {
    value: 1.0,
    setValueAtTime: vi.fn().mockReturnThis(),
    linearRampToValueAtTime: vi.fn().mockReturnThis(),
    exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
  };

  return {
    gain,
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as any;
}

describe('FadeoutManager', () => {
  let mockGainNode: GainNode;

  beforeEach(() => {
    mockGainNode = createMockGainNode();
    vi.clearAllMocks();
  });

  // ============================================================================
  // NORMAL FADEOUT (30ms Exponential)
  // ============================================================================
  describe('Normal Fadeout (30ms exponential)', () => {
    it('should schedule normal fadeout with correct timing', () => {
      const targetGain = 0.8;
      const noteEndTime = 5.0;

      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        false, // Not last note
      );

      expect(result.type).toBe('normal');
      expect(result.duration).toBe(0.03); // 30ms
      expect(result.stopTime).toBe(5.04); // 5.0 + 0.03 + 0.01
      expect(result.debugInfo.fadeStartTime).toBe(5.0);
      expect(result.debugInfo.fadeEndTime).toBe(5.03);
    });

    it('should hold gain constant until note end', () => {
      const targetGain = 0.8;
      const noteEndTime = 5.0;

      FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        false,
      );

      // Should call linearRampToValueAtTime to hold gain until fade starts
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        targetGain,
        noteEndTime,
      );
    });

    it('should exponentially fade to silence over 30ms', () => {
      const targetGain = 0.8;
      const noteEndTime = 5.0;

      FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        false,
      );

      // Should call exponentialRampToValueAtTime for smooth fade
      expect(
        mockGainNode.gain.exponentialRampToValueAtTime,
      ).toHaveBeenCalledWith(
        0.001,
        5.03, // noteEndTime + 0.03
      );
    });

    it('should handle different target gains', () => {
      const testCases = [
        { gain: 0.5, noteEnd: 3.0 },
        { gain: 1.0, noteEnd: 10.0 },
        { gain: 0.25, noteEnd: 1.5 },
      ];

      testCases.forEach(({ gain, noteEnd }) => {
        const mockNode = createMockGainNode();
        const result = FadeoutManager.scheduleFadeout(
          mockNode,
          gain,
          noteEnd,
          false,
        );

        expect(mockNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
          gain,
          noteEnd,
        );
        expect(result.stopTime).toBeCloseTo(noteEnd + 0.04, 5); // +0.03 fade + 0.01 buffer
      });
    });
  });

  // ============================================================================
  // LAST NOTE FADEOUT (3-Stage Musical Ring-Out)
  // ============================================================================
  describe('Last Note Fadeout (3-stage ring-out)', () => {
    it('should schedule last-note fadeout with correct timing', () => {
      const targetGain = 0.8;
      const noteEndTime = 10.0; // Exercise ends at 10s

      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        true, // Is last note
      );

      expect(result.type).toBe('last-note');
      expect(result.duration).toBe(4.0); // 1s hold + 1s quick + 2s smooth
      expect(result.stopTime).toBe(10.01); // noteEndTime + 0.01
      expect(result.debugInfo.stages).toEqual([
        'hold',
        'quick-drop',
        'smooth-fade',
      ]);
    });

    it('should implement 3-stage fadeout: hold → quick drop → smooth fade', () => {
      const targetGain = 0.8;
      const noteEndTime = 10.0;

      FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        true,
      );

      // Calculate expected time points
      const ringOutStart = noteEndTime - 3.0; // 7.0s
      const fadeStartTime = ringOutStart + 1.0; // 8.0s (Stage 2 starts)
      const midFadeTime = fadeStartTime + 1.0; // 9.0s (Stage 3 starts)

      // Stage 1: Hold gain for 1 second
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        targetGain,
        fadeStartTime, // 8.0s
      );

      // Stage 2: Quick linear drop to 50% over 1 second
      expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        targetGain * 0.5,
        midFadeTime, // 9.0s
      );

      // Stage 3: Smooth exponential fade to silence over 2 seconds
      expect(
        mockGainNode.gain.exponentialRampToValueAtTime,
      ).toHaveBeenCalledWith(
        0.001,
        noteEndTime, // 10.0s
      );
    });

    it('should calculate ring-out time points correctly', () => {
      const targetGain = 0.8;
      const noteEndTime = 15.0;

      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        true,
      );

      // Expected time points:
      // Ring-out starts: 15.0 - 3.0 = 12.0s
      // Stage 1 (hold): 12.0s - 13.0s (1 second)
      // Stage 2 (quick drop): 13.0s - 14.0s (1 second to 50%)
      // Stage 3 (smooth fade): 14.0s - 15.0s (2 seconds to silence)
      expect(result.debugInfo.fadeStartTime).toBe(13.0);
      expect(result.debugInfo.fadeEndTime).toBe(15.0);
    });

    it('should handle different target gains in 3-stage fadeout', () => {
      const testCases = [
        { gain: 0.5, noteEnd: 10.0 },
        { gain: 1.0, noteEnd: 12.0 },
        { gain: 0.7, noteEnd: 8.0 },
      ];

      testCases.forEach(({ gain, noteEnd }) => {
        const mockNode = createMockGainNode();
        FadeoutManager.scheduleFadeout(mockNode, gain, noteEnd, true);

        const fadeStartTime = noteEnd - 3.0 + 1.0; // 1s into ring-out
        const midFadeTime = fadeStartTime + 1.0; // 2s into ring-out

        // Stage 1: Hold at full gain
        expect(mockNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
          gain,
          fadeStartTime,
        );

        // Stage 2: Drop to 50%
        expect(mockNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
          gain * 0.5,
          midFadeTime,
        );
      });
    });
  });

  // ============================================================================
  // LAST NOTE DETECTION
  // ============================================================================
  describe('Last Note Detection', () => {
    it('should detect note held until exercise end (within threshold)', () => {
      const noteEndTime = 10.0;
      const exerciseEndTime = 10.2; // Within 0.25s threshold
      const isLast = FadeoutManager.isLastNote(noteEndTime, exerciseEndTime);
      expect(isLast).toBe(true);
    });

    it('should detect note exactly at exercise end', () => {
      const noteEndTime = 10.0;
      const exerciseEndTime = 10.0; // Exact match
      const isLast = FadeoutManager.isLastNote(noteEndTime, exerciseEndTime);
      expect(isLast).toBe(true);
    });

    it('should reject note that ends too early (outside threshold)', () => {
      const noteEndTime = 9.5;
      const exerciseEndTime = 10.0; // 0.5s difference > 0.25s threshold
      const isLast = FadeoutManager.isLastNote(noteEndTime, exerciseEndTime);
      expect(isLast).toBe(false);
    });

    it('should reject note that ends after exercise', () => {
      const noteEndTime = 10.5;
      const exerciseEndTime = 10.0; // Note ends 0.5s after exercise
      const isLast = FadeoutManager.isLastNote(noteEndTime, exerciseEndTime);
      expect(isLast).toBe(false);
    });

    it('should return false when exercise end time not set', () => {
      const noteEndTime = 10.0;
      const exerciseEndTime = 0; // Not set
      const isLast = FadeoutManager.isLastNote(noteEndTime, exerciseEndTime);
      expect(isLast).toBe(false);
    });

    it('should use custom threshold if provided', () => {
      const noteEndTime = 9.6;
      const exerciseEndTime = 10.0;

      // Default threshold (0.25s) would reject this
      const isLastDefault = FadeoutManager.isLastNote(
        noteEndTime,
        exerciseEndTime,
      );
      expect(isLastDefault).toBe(false);

      // Custom threshold (0.5s) accepts it
      const isLastCustom = FadeoutManager.isLastNote(
        noteEndTime,
        exerciseEndTime,
        0.5,
      );
      expect(isLastCustom).toBe(true);
    });

    it('should handle edge case: note at boundary of threshold', () => {
      const noteEndTime = 9.75;
      const exerciseEndTime = 10.0;
      const threshold = 0.25;

      // Exactly at threshold boundary (10.0 - 9.75 = 0.25)
      const isLast = FadeoutManager.isLastNote(
        noteEndTime,
        exerciseEndTime,
        threshold,
      );
      expect(isLast).toBe(true);
    });
  });

  // ============================================================================
  // FADEOUT TYPE SELECTION
  // ============================================================================
  describe('Fadeout Type Selection', () => {
    it('should select normal fadeout when isLastNote=false', () => {
      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        0.8,
        5.0,
        false,
      );
      expect(result.type).toBe('normal');
      expect(result.duration).toBe(0.03);
    });

    it('should select last-note fadeout when isLastNote=true', () => {
      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        0.8,
        10.0,
        true,
      );
      expect(result.type).toBe('last-note');
      expect(result.duration).toBe(4.0);
    });

    it('should use different stop times for normal vs last-note', () => {
      const noteEndTime = 10.0;
      const targetGain = 0.8;

      const normalResult = FadeoutManager.scheduleFadeout(
        createMockGainNode(),
        targetGain,
        noteEndTime,
        false,
      );

      const lastNoteResult = FadeoutManager.scheduleFadeout(
        createMockGainNode(),
        targetGain,
        noteEndTime,
        true,
      );

      // Normal: 10.0 + 0.03 + 0.01 = 10.04
      expect(normalResult.stopTime).toBe(10.04);

      // Last note: 10.0 + 0.01 = 10.01
      expect(lastNoteResult.stopTime).toBe(10.01);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle zero target gain', () => {
      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        0.0,
        5.0,
        false,
      );
      expect(result.stopTime).toBeGreaterThan(5.0);
    });

    it('should handle very short note durations', () => {
      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        0.8,
        0.1,
        false,
      );
      expect(result.stopTime).toBe(0.14); // 0.1 + 0.03 + 0.01
    });

    it('should handle very long note durations', () => {
      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        0.8,
        100.0,
        true,
      );
      expect(result.stopTime).toBe(100.01); // Long note still gets 4s ring-out
    });

    it('should handle maximum target gain (1.0)', () => {
      const mockNode = createMockGainNode();
      FadeoutManager.scheduleFadeout(mockNode, 1.0, 5.0, true);

      // Stage 2 should drop to 0.5 (1.0 * 0.5)
      expect(mockNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.5,
        4.0,
      );
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================
  describe('Real-World Scenarios', () => {
    it('should handle typical piano chord progression (non-last notes)', () => {
      const chordNotes = [
        { gain: 0.7, end: 2.0 },
        { gain: 0.8, end: 2.0 },
        { gain: 0.75, end: 2.0 },
      ];

      chordNotes.forEach(({ gain, end }) => {
        const mockNode = createMockGainNode();
        const result = FadeoutManager.scheduleFadeout(
          mockNode,
          gain,
          end,
          false,
        );
        expect(result.type).toBe('normal');
        expect(result.duration).toBe(0.03);
      });
    });

    it('should handle final chord ring-out (last notes)', () => {
      const finalChord = [
        { gain: 0.6, end: 10.0 },
        { gain: 0.8, end: 10.0 },
        { gain: 0.7, end: 10.0 },
      ];

      finalChord.forEach(({ gain, end }) => {
        const mockNode = createMockGainNode();
        const result = FadeoutManager.scheduleFadeout(
          mockNode,
          gain,
          end,
          true,
        );
        expect(result.type).toBe('last-note');
        expect(result.duration).toBe(4.0);
      });
    });

    it('should handle sustained note with CC64 extension', () => {
      // MIDI note-off at 2.0s, but CC64 extends to 5.0s
      const noteEndTime = 5.0; // After CC64 extension
      const targetGain = 0.8;

      const result = FadeoutManager.scheduleFadeout(
        mockGainNode,
        targetGain,
        noteEndTime,
        false,
      );

      expect(result.type).toBe('normal');
      expect(result.stopTime).toBe(5.04); // Fade after sustained note
    });

    it('should handle last note detection for exercise end', () => {
      const exerciseEndTime = 10.0;

      // Last beat: note ends at 9.9s (within 0.25s threshold)
      const isLastBeat = FadeoutManager.isLastNote(9.9, exerciseEndTime);
      expect(isLastBeat).toBe(true);

      // Earlier beat: note ends at 8.0s (outside threshold)
      const isEarlierBeat = FadeoutManager.isLastNote(8.0, exerciseEndTime);
      expect(isEarlierBeat).toBe(false);
    });
  });
});
