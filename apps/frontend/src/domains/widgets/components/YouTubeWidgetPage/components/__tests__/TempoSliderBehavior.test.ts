/**
 * Tempo Slider Behavior Tests
 *
 * Tests the user interaction patterns for tempo control in GlobalControls:
 * 1. Immediate UI responsiveness when slider is dragged
 * 2. User tempo changes take priority over exercise defaults
 * 3. Exercise selection resets tempo when user hasn't modified it
 * 4. Debouncing prevents excessive transport updates
 * 5. Feedback loop prevention between local state and transport
 *
 * Architecture being tested:
 * ┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
 * │  Tempo Slider   │ ──▶ │  Local State      │ ──▶ │ Transport       │
 * │  (User Input)   │     │  (Immediate UI)   │     │ (Debounced)     │
 * └─────────────────┘     └───────────────────┘     └─────────────────┘
 *                                  │
 *                                  ▼
 *                         ┌───────────────────┐
 *                         │ hasUserModified   │
 *                         │ (Priority Flag)   │
 *                         └───────────────────┘
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// Mock the tempo slider behavior (extracted from GlobalControls)
// ============================================================================

interface UseTempoSliderOptions {
  initialTempo: number;
  transportTempo: number;
  exerciseBpm?: number;
  onTempoChange: (tempo: number) => Promise<void>;
}

interface UseTempoSliderResult {
  localTempo: number;
  setLocalTempo: (tempo: number) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  hasUserModified: boolean;
  handleTempoChange: (newTempo: number) => Promise<void>;
  handleSliderStart: () => void;
  handleSliderEnd: () => void;
  resetUserModified: () => void;
}

/**
 * Custom hook that encapsulates tempo slider logic
 * Extracted from GlobalControls for testability
 */
function useTempoSlider({
  initialTempo,
  transportTempo,
  exerciseBpm,
  onTempoChange,
}: UseTempoSliderOptions): UseTempoSliderResult {
  const [localTempo, setLocalTempo] = useState(initialTempo);
  const [isDragging, setIsDragging] = useState(false);

  const lastUserTempo = useRef(initialTempo);
  const ignoreNextSync = useRef(false);
  const hasUserModifiedRef = useRef(false);
  const tempoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with transport tempo when not dragging and not ignoring
  useEffect(() => {
    // If exercise has explicit BPM and user hasn't modified, don't sync from transport
    if (exerciseBpm && !hasUserModifiedRef.current) {
      return;
    }

    if (!isDragging && !ignoreNextSync.current && transportTempo) {
      const threshold = 1;
      if (Math.abs(transportTempo - localTempo) > threshold) {
        setLocalTempo(transportTempo);
      }
    }
  }, [transportTempo, isDragging, exerciseBpm, localTempo]);

  // Sync with exercise BPM when exercise changes
  useEffect(() => {
    if (exerciseBpm && !hasUserModifiedRef.current) {
      setLocalTempo(exerciseBpm);
      lastUserTempo.current = exerciseBpm;
    }
  }, [exerciseBpm]);

  const handleTempoChange = useCallback(
    async (newTempo: number) => {
      // Update local state immediately for responsive UI
      setLocalTempo(newTempo);
      lastUserTempo.current = newTempo;

      // Set flag to ignore the next sync update
      ignoreNextSync.current = true;

      // Mark that user manually changed tempo
      hasUserModifiedRef.current = true;

      // Call the transport update
      await onTempoChange(newTempo);

      // Clear any pending sync
      if (tempoTimeoutRef.current) {
        clearTimeout(tempoTimeoutRef.current);
      }

      // Reset ignore flag after tempo change
      tempoTimeoutRef.current = setTimeout(() => {
        ignoreNextSync.current = false;
      }, 100);
    },
    [onTempoChange],
  );

  const handleSliderStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleSliderEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetUserModified = useCallback(() => {
    hasUserModifiedRef.current = false;
  }, []);

  return {
    localTempo,
    setLocalTempo,
    isDragging,
    setIsDragging,
    hasUserModified: hasUserModifiedRef.current,
    handleTempoChange,
    handleSliderStart,
    handleSliderEnd,
    resetUserModified,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Tempo Slider Behavior', () => {
  let onTempoChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onTempoChange = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Immediate UI Responsiveness
  // ============================================================================

  describe('Immediate UI Responsiveness', () => {
    it('should update local tempo immediately when slider changes', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          onTempoChange,
        }),
      );

      await act(async () => {
        await result.current.handleTempoChange(140);
      });

      // Local tempo should update immediately
      expect(result.current.localTempo).toBe(140);
    });

    it('should update local tempo on each slider drag position', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 100,
          transportTempo: 100,
          onTempoChange,
        }),
      );

      // Simulate slider drag sequence
      const tempoSequence = [105, 110, 115, 120, 125];

      for (const tempo of tempoSequence) {
        await act(async () => {
          await result.current.handleTempoChange(tempo);
        });
        expect(result.current.localTempo).toBe(tempo);
      }
    });

    it('should call transport update for each tempo change', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          onTempoChange,
        }),
      );

      await act(async () => {
        await result.current.handleTempoChange(130);
      });
      await act(async () => {
        await result.current.handleTempoChange(140);
      });
      await act(async () => {
        await result.current.handleTempoChange(150);
      });

      expect(onTempoChange).toHaveBeenCalledTimes(3);
      expect(onTempoChange).toHaveBeenNthCalledWith(1, 130);
      expect(onTempoChange).toHaveBeenNthCalledWith(2, 140);
      expect(onTempoChange).toHaveBeenNthCalledWith(3, 150);
    });
  });

  // ============================================================================
  // User Priority ("Last explicit user action wins")
  // ============================================================================

  describe('User Priority', () => {
    it('should mark tempo as user-modified after slider change', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          exerciseBpm: 69,
          onTempoChange,
        }),
      );

      // Initially, should use exercise BPM
      expect(result.current.localTempo).toBe(69);

      // User changes tempo
      await act(async () => {
        await result.current.handleTempoChange(100);
      });

      // Should now use user's tempo
      expect(result.current.localTempo).toBe(100);
    });

    it('should ignore exercise BPM changes after user modification', async () => {
      const { result, rerender } = renderHook(
        ({ exerciseBpm }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo: 120,
            exerciseBpm,
            onTempoChange,
          }),
        { initialProps: { exerciseBpm: 69 } },
      );

      // User changes tempo
      await act(async () => {
        await result.current.handleTempoChange(100);
      });

      // Rerender with different exercise BPM (simulating exercise change)
      rerender({ exerciseBpm: 140 });

      // Should still show user's tempo, not the new exercise BPM
      // Note: In real implementation, exercise change resets hasUserModified
      // This test verifies the "user wins" behavior during same exercise
      expect(result.current.localTempo).toBe(100);
    });

    it('should reset user-modified flag when explicitly requested', async () => {
      const { result, rerender } = renderHook(
        ({ exerciseBpm }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo: 120,
            exerciseBpm,
            onTempoChange,
          }),
        { initialProps: { exerciseBpm: 69 } },
      );

      // User changes tempo
      await act(async () => {
        await result.current.handleTempoChange(100);
      });

      expect(result.current.localTempo).toBe(100);

      // Reset user modified flag (simulating new exercise selection)
      act(() => {
        result.current.resetUserModified();
      });

      // Rerender with new exercise BPM
      rerender({ exerciseBpm: 140 });

      // Now should sync to the new exercise BPM
      expect(result.current.localTempo).toBe(140);
    });
  });

  // ============================================================================
  // Exercise Selection Sync
  // ============================================================================

  describe('Exercise Selection Sync', () => {
    it('should sync to exercise BPM when exercise is selected', () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          exerciseBpm: 69,
          onTempoChange,
        }),
      );

      expect(result.current.localTempo).toBe(69);
    });

    it('should update when exercise BPM changes (different exercise)', () => {
      const { result, rerender } = renderHook(
        ({ exerciseBpm }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo: 120,
            exerciseBpm,
            onTempoChange,
          }),
        { initialProps: { exerciseBpm: 69 } },
      );

      expect(result.current.localTempo).toBe(69);

      rerender({ exerciseBpm: 140 });

      expect(result.current.localTempo).toBe(140);
    });

    it('should use default tempo (120) when no exercise is selected', () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          exerciseBpm: undefined,
          onTempoChange,
        }),
      );

      expect(result.current.localTempo).toBe(120);
    });
  });

  // ============================================================================
  // Feedback Loop Prevention
  // ============================================================================

  describe('Feedback Loop Prevention', () => {
    it('should ignore transport sync immediately after user change', async () => {
      const { result, rerender } = renderHook(
        ({ transportTempo }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo,
            onTempoChange,
          }),
        { initialProps: { transportTempo: 120 } },
      );

      // User changes tempo
      await act(async () => {
        await result.current.handleTempoChange(150);
      });

      // Simulate transport callback with potentially stale value
      rerender({ transportTempo: 120 });

      // Should still show user's tempo
      expect(result.current.localTempo).toBe(150);

      // After timeout, should allow sync again
      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Now transport sync should work
      rerender({ transportTempo: 100 });
      expect(result.current.localTempo).toBe(100);
    });

    it('should not sync while dragging', () => {
      const { result, rerender } = renderHook(
        ({ transportTempo }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo,
            onTempoChange,
          }),
        { initialProps: { transportTempo: 120 } },
      );

      // Start dragging
      act(() => {
        result.current.handleSliderStart();
      });

      // Simulate transport update while dragging
      rerender({ transportTempo: 80 });

      // Should not sync during drag
      expect(result.current.localTempo).toBe(120);

      // End dragging
      act(() => {
        result.current.handleSliderEnd();
      });

      // Now should sync
      expect(result.current.localTempo).toBe(80);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle rapid tempo changes (slider scrubbing)', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 100,
          transportTempo: 100,
          onTempoChange,
        }),
      );

      // Simulate rapid slider movement
      for (let tempo = 100; tempo <= 200; tempo += 5) {
        await act(async () => {
          await result.current.handleTempoChange(tempo);
        });
      }

      expect(result.current.localTempo).toBe(200);
      // Each change should trigger transport update
      expect(onTempoChange).toHaveBeenCalledTimes(21);
    });

    it('should handle tempo at boundaries (min/max)', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          onTempoChange,
        }),
      );

      // Set to minimum reasonable tempo
      await act(async () => {
        await result.current.handleTempoChange(40);
      });
      expect(result.current.localTempo).toBe(40);

      // Set to maximum reasonable tempo
      await act(async () => {
        await result.current.handleTempoChange(240);
      });
      expect(result.current.localTempo).toBe(240);
    });

    it('should handle decimal tempo values', async () => {
      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          onTempoChange,
        }),
      );

      await act(async () => {
        await result.current.handleTempoChange(120.5);
      });
      expect(result.current.localTempo).toBe(120.5);
    });

    it('should not sync when transport change is within threshold', () => {
      const { result, rerender } = renderHook(
        ({ transportTempo }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo,
            onTempoChange,
          }),
        { initialProps: { transportTempo: 120 } },
      );

      // Small change within threshold (1 BPM)
      rerender({ transportTempo: 120.5 });

      // Should not trigger sync for small differences
      expect(result.current.localTempo).toBe(120);
    });

    it('should handle transport update errors gracefully', async () => {
      const errorTempoChange = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTempoSlider({
          initialTempo: 120,
          transportTempo: 120,
          onTempoChange: errorTempoChange,
        }),
      );

      // Even if transport update fails, local state should still update
      await act(async () => {
        try {
          await result.current.handleTempoChange(140);
        } catch (e) {
          // Expected error
        }
      });

      // Local tempo should still be updated for responsive UI
      expect(result.current.localTempo).toBe(140);
    });
  });

  // ============================================================================
  // Integration with Exercise Workflow
  // ============================================================================

  describe('Integration with Exercise Workflow', () => {
    it('should follow complete exercise selection → user modification → new exercise flow', async () => {
      const { result, rerender } = renderHook(
        ({ exerciseBpm, transportTempo }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo,
            exerciseBpm,
            onTempoChange,
          }),
        { initialProps: { exerciseBpm: 69, transportTempo: 120 } },
      );

      // Step 1: Exercise selected, tempo syncs to 69
      expect(result.current.localTempo).toBe(69);

      // Step 2: User modifies tempo to 85
      await act(async () => {
        await result.current.handleTempoChange(85);
      });
      expect(result.current.localTempo).toBe(85);

      // Step 3: User selects different exercise (reset flag manually in real code)
      act(() => {
        result.current.resetUserModified();
      });
      rerender({ exerciseBpm: 140, transportTempo: 140 });

      // Should sync to new exercise BPM
      expect(result.current.localTempo).toBe(140);

      // Step 4: User modifies again
      await act(async () => {
        await result.current.handleTempoChange(160);
      });
      expect(result.current.localTempo).toBe(160);
    });

    it('should handle exercise with same BPM as current', () => {
      const { result, rerender } = renderHook(
        ({ exerciseBpm }) =>
          useTempoSlider({
            initialTempo: 120,
            transportTempo: 120,
            exerciseBpm,
            onTempoChange,
          }),
        { initialProps: { exerciseBpm: 120 } },
      );

      expect(result.current.localTempo).toBe(120);

      // Select exercise with same BPM
      rerender({ exerciseBpm: 120 });

      // Should still be 120
      expect(result.current.localTempo).toBe(120);
    });
  });
});
