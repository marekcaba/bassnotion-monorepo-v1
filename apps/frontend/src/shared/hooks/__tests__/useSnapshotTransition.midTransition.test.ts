/**
 * Tests for useSnapshotTransition Mid-Transition Handling
 *
 * These tests specifically verify the behavior when exercise switches happen
 * DURING an ongoing transition. This is a critical scenario for rapid user
 * interactions that was causing stuck UI issues.
 *
 * KEY SCENARIOS TESTED:
 * 1. Key change during fading-out phase
 * 2. Key change during fading-in phase (requires restart)
 * 3. Multiple rapid key changes in sequence
 * 4. Return to original exercise mid-transition
 * 5. Stress testing with many rapid switches
 * 6. Race conditions with async data updates
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSnapshotTransition } from '../useSnapshotTransition';

// Mock timers for precise control
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to advance time and flush RAF
const advanceTimersAndRAF = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {
    vi.advanceTimersByTime(32); // ~2 frames at 60fps
  });
};

// Simple exercise data type for tests
interface TestExerciseData {
  id: string;
  name: string;
  notes: string[];
  tempo: number;
}

// Test exercises
const exerciseA: TestExerciseData = { id: 'ex-a', name: 'Exercise A', notes: ['a1', 'a2'], tempo: 60 };
const exerciseB: TestExerciseData = { id: 'ex-b', name: 'Exercise B', notes: ['b1', 'b2', 'b3'], tempo: 120 };
const exerciseC: TestExerciseData = { id: 'ex-c', name: 'Exercise C', notes: ['c1'], tempo: 180 };
const exerciseD: TestExerciseData = { id: 'ex-d', name: 'Exercise D', notes: ['d1', 'd2', 'd3', 'd4'], tempo: 90 };
const exerciseE: TestExerciseData = { id: 'ex-e', name: 'Exercise E', notes: ['e1', 'e2'], tempo: 100 };

describe('useSnapshotTransition - Mid-Transition Handling', () => {
  const FADE_DURATION = 500;

  describe('Key Change During Fading-Out Phase', () => {
    it('should redirect to new target when key changes during fade-out', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Start A→B transition
      rerender({ data: exerciseB, key: exerciseB.id });
      expect(result.current.phase).toBe('fading-out');
      expect(result.current.displayData).toEqual(exerciseA); // Frozen on A

      // Mid fade-out (~200ms), change to C
      await advanceTimersAndRAF(200);
      rerender({ data: exerciseC, key: exerciseC.id });

      // Should still show A (frozen during transition)
      expect(result.current.displayData).toEqual(exerciseA);

      // Complete transition - should SWAP to C, not B
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData).toEqual(exerciseC);
      expect(result.current.displayData.id).toBe('ex-c');
    });

    it('should use latest data when same key is updated during fade-out', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Start A→B transition
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(100);

      // Update B's data while transitioning (same key B)
      const updatedB = { ...exerciseB, notes: ['b1-updated', 'b2-updated'] };
      rerender({ data: updatedB, key: exerciseB.id });

      // Still showing A
      expect(result.current.displayData).toEqual(exerciseA);

      // At SWAP, should get the UPDATED B
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.notes).toEqual(['b1-updated', 'b2-updated']);
    });
  });

  describe('Key Change During Fading-In Phase', () => {
    it('should restart transition when key changes during fade-in', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Start and complete A→B fade-out, now in fade-in with B visible
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(FADE_DURATION + 50); // Past fade-out, in fade-in

      expect(result.current.phase).toBe('fading-in');
      expect(result.current.displayData).toEqual(exerciseB); // SWAP happened

      // Now during fade-in, switch to C
      rerender({ data: exerciseC, key: exerciseC.id });

      // Should detect mid-transition and restart
      await advanceTimersAndRAF(50); // Allow effect to process

      // After restart and full new transition
      await advanceTimersAndRAF(FADE_DURATION + 100);
      await advanceTimersAndRAF(FADE_DURATION + 100);

      expect(result.current.displayData).toEqual(exerciseC);
      expect(result.current.phase).toBe('stable');
    });

    it('should show correct exercise after fade-in key change', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Complete A→B transition to fade-in phase
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(FADE_DURATION + 50);
      expect(result.current.phase).toBe('fading-in');

      // Change to D during fade-in
      rerender({ data: exerciseD, key: exerciseD.id });

      // Wait for full restart and new transition
      await advanceTimersAndRAF(FADE_DURATION * 3);

      // Should end up at D
      expect(result.current.displayData.id).toBe('ex-d');
      expect(result.current.displayData.tempo).toBe(90);
    });
  });

  describe('Multiple Rapid Key Changes', () => {
    it('should handle A→B→C→D sequence with only A and D visible', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Rapid sequence: A→B→C→D with minimal time between
      rerender({ data: exerciseB, key: exerciseB.id });
      await act(async () => { vi.advanceTimersByTime(30); });

      rerender({ data: exerciseC, key: exerciseC.id });
      await act(async () => { vi.advanceTimersByTime(30); });

      rerender({ data: exerciseD, key: exerciseD.id });
      await act(async () => { vi.advanceTimersByTime(30); });

      // Still showing A during all transitions
      expect(result.current.displayData.id).toBe('ex-a');

      // Wait for transition to complete
      await advanceTimersAndRAF(FADE_DURATION);

      // Should show D (final destination)
      expect(result.current.displayData.id).toBe('ex-d');
    });

    it('should handle 5 rapid switches and land on correct exercise', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      const exercises = [exerciseB, exerciseC, exerciseD, exerciseE, exerciseA];

      for (const ex of exercises) {
        rerender({ data: ex, key: ex.id });
        await act(async () => { vi.advanceTimersByTime(20); });
      }

      // Still showing original A
      expect(result.current.displayData.id).toBe('ex-a');

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION);

      // Should end at A (last in sequence)
      expect(result.current.displayData.id).toBe('ex-a');
    });
  });

  describe('Return to Original Exercise Mid-Transition', () => {
    it('should handle A→B→A pattern correctly', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Start A→B
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(150);

      // Return to A before transition completes
      const updatedA = { ...exerciseA, notes: ['a1-updated'] };
      rerender({ data: updatedA, key: exerciseA.id });

      // Still showing original A
      expect(result.current.displayData.notes).toEqual(['a1', 'a2']);

      // After SWAP, should show UPDATED A
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.notes).toEqual(['a1-updated']);
    });

    it('should handle A→B→C→A pattern correctly', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Rapid A→B→C→A
      rerender({ data: exerciseB, key: exerciseB.id });
      await act(async () => { vi.advanceTimersByTime(50); });

      rerender({ data: exerciseC, key: exerciseC.id });
      await act(async () => { vi.advanceTimersByTime(50); });

      rerender({ data: exerciseA, key: exerciseA.id });

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION);

      // Should end at A
      expect(result.current.displayData.id).toBe('ex-a');
    });
  });

  describe('Stress Testing', () => {
    it('should survive 20 rapid exercise switches', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      const allExercises = [exerciseA, exerciseB, exerciseC, exerciseD, exerciseE];

      // 20 rapid switches with random exercises
      for (let i = 0; i < 20; i++) {
        const ex = allExercises[i % allExercises.length];
        rerender({ data: ex, key: ex.id });
        await act(async () => { vi.advanceTimersByTime(15); }); // Very fast - 15ms apart
      }

      // Should still be showing original A (transition not complete)
      expect(result.current.displayData.id).toBe('ex-a');

      // Wait for transition to complete
      await advanceTimersAndRAF(FADE_DURATION + 100);
      await advanceTimersAndRAF(FADE_DURATION + 100);

      // Should show last exercise in sequence
      // 20 iterations: i=0..19, exercises[i % 5] = B,C,D,E,A,B,C,D,E,A,B,C,D,E,A,B,C,D,E,A
      // Last one is i=19, 19 % 5 = 4, exercises[4] = exerciseE
      expect(result.current.displayData.id).toBe('ex-e');
    });

    it('should handle alternating between two exercises rapidly', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Rapidly alternate A↔B 10 times
      for (let i = 0; i < 10; i++) {
        const ex = i % 2 === 0 ? exerciseB : exerciseA;
        rerender({ data: ex, key: ex.id });
        await act(async () => { vi.advanceTimersByTime(25); });
      }

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 100);
      await advanceTimersAndRAF(FADE_DURATION + 100);

      // Should end at A (10 iterations: 0,2,4,6,8 are B, 1,3,5,7,9 are A, last is A)
      expect(result.current.displayData.id).toBe('ex-a');
    });
  });

  describe('Atomic Data Consistency During Mid-Transition', () => {
    it('should never mix data from different exercises', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Track all displayed states
      const displayedStates: TestExerciseData[] = [];
      const captureState = () => {
        displayedStates.push({ ...result.current.displayData as TestExerciseData });
      };

      captureState(); // Initial

      // Rapid switches
      rerender({ data: exerciseB, key: exerciseB.id });
      captureState();
      await act(async () => { vi.advanceTimersByTime(50); });
      captureState();

      rerender({ data: exerciseC, key: exerciseC.id });
      captureState();
      await act(async () => { vi.advanceTimersByTime(50); });
      captureState();

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION);
      captureState();

      // Verify each captured state is internally consistent
      // (id matches the rest of the data)
      for (const state of displayedStates) {
        if (state.id === 'ex-a') {
          expect(state.tempo).toBe(60);
          expect(state.name).toBe('Exercise A');
        } else if (state.id === 'ex-b') {
          expect(state.tempo).toBe(120);
          expect(state.name).toBe('Exercise B');
        } else if (state.id === 'ex-c') {
          expect(state.tempo).toBe(180);
          expect(state.name).toBe('Exercise C');
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined key during transition', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id as string | undefined } }
      );

      // Start transition
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(100);

      // Set key to undefined (deselect)
      const emptyData: TestExerciseData = { id: '', name: '', notes: [], tempo: 0 };
      rerender({ data: emptyData, key: undefined });

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION);

      expect(result.current.displayData.id).toBe('');
    });

    it('should handle same exercise with updated data mid-transition to different exercise', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Start A→B
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(100);

      // Update A's data (but we're transitioning to B)
      const updatedA = { ...exerciseA, notes: ['a1-new'] };
      rerender({ data: updatedA, key: exerciseA.id });

      // After transition, should show updated A (redirected back)
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.notes).toEqual(['a1-new']);
    });

    it('should handle transition start exactly at end of previous transition', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Complete A→B transition
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(FADE_DURATION + 50);
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.phase).toBe('stable');
      expect(result.current.displayData.id).toBe('ex-b');

      // Immediately start B→C
      rerender({ data: exerciseC, key: exerciseC.id });
      expect(result.current.phase).toBe('fading-out');

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 50);
      expect(result.current.displayData.id).toBe('ex-c');
    });
  });

  describe('Phase State Consistency', () => {
    it('should have consistent phase through transition lifecycle', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      const phases: string[] = [];
      const capturePhase = () => phases.push(result.current.phase);

      capturePhase(); // 'stable'

      rerender({ data: exerciseB, key: exerciseB.id });
      capturePhase(); // 'fading-out'

      await advanceTimersAndRAF(FADE_DURATION + 50);
      capturePhase(); // 'fading-in'

      await advanceTimersAndRAF(FADE_DURATION + 50);
      capturePhase(); // 'stable'

      expect(phases).toEqual(['stable', 'fading-out', 'fading-in', 'stable']);
    });

    it('should correctly report isTransitioning', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      expect(result.current.isTransitioning).toBe(false);

      rerender({ data: exerciseB, key: exerciseB.id });
      expect(result.current.isTransitioning).toBe(true);

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 50);
      expect(result.current.isTransitioning).toBe(true); // Still fading-in

      await advanceTimersAndRAF(FADE_DURATION + 50);
      expect(result.current.isTransitioning).toBe(false);
    });
  });

  describe('Opacity Behavior During Mid-Transition', () => {
    it('should keep opacity at 1 before first RAF after key change', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      expect(result.current.opacity).toBe(1);

      rerender({ data: exerciseB, key: exerciseB.id });

      // Immediately after key change, opacity should still be 1
      // (RAF hasn't run yet to set it to 0)
      expect(result.current.opacity).toBe(1);

      // After RAF, opacity goes to 0
      await advanceTimersAndRAF(0);
      expect(result.current.opacity).toBe(0);
    });

    it('should reset opacity to 1 when restarting from fading-in', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exerciseA, key: exerciseA.id } }
      );

      // Complete fade-out, now in fade-in
      rerender({ data: exerciseB, key: exerciseB.id });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.phase).toBe('fading-in');
      expect(result.current.opacity).toBe(1); // Opacity is back to 1 during fade-in

      // Change key during fade-in (should restart)
      rerender({ data: exerciseC, key: exerciseC.id });
      await advanceTimersAndRAF(50); // Allow restart processing

      // Opacity should reset for new transition
      // After restart is processed
      await advanceTimersAndRAF(100);

      // Eventually should complete to stable with opacity 1
      await advanceTimersAndRAF(FADE_DURATION * 2);
      expect(result.current.opacity).toBe(1);
      expect(result.current.phase).toBe('stable');
    });
  });
});
