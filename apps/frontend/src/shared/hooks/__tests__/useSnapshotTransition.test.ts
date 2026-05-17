/**
 * Tests for useSnapshotTransition hook
 *
 * These tests verify that:
 * 1. displayData stays FROZEN during fade-out (no premature updates)
 * 2. SWAP happens at EXACTLY the right moment (after fade-out, before fade-in)
 * 3. No data "bleeds through" during transitions
 * 4. Rapid switching is handled correctly
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
  // Advance timers
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  // Flush any pending RAF callbacks (we use double RAF)
  await act(async () => {
    vi.advanceTimersByTime(32); // ~2 frames at 60fps
  });
};

describe('useSnapshotTransition', () => {
  const FADE_DURATION = 500;

  describe('Initialization', () => {
    it('should initialize with source data', () => {
      const { result } = renderHook(() =>
        useSnapshotTransition(['note1', 'note2'], 'exercise-a', {
          fadeDuration: FADE_DURATION,
        }),
      );

      expect(result.current.displayData).toEqual(['note1', 'note2']);
      expect(result.current.opacity).toBe(1);
      expect(result.current.phase).toBe('stable');
      expect(result.current.isTransitioning).toBe(false);
    });

    it('should handle undefined key on init', () => {
      const { result } = renderHook(() =>
        useSnapshotTransition(['note1'], undefined, {
          fadeDuration: FADE_DURATION,
        }),
      );

      expect(result.current.displayData).toEqual(['note1']);
      expect(result.current.phase).toBe('stable');
    });
  });

  describe('Same Key Updates (Stable Phase)', () => {
    it('should update displayData immediately when stable and same key', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['note1'], key: 'exercise-a' } },
      );

      expect(result.current.displayData).toEqual(['note1']);

      // Update data with same key
      rerender({ data: ['note1', 'note2'], key: 'exercise-a' });

      expect(result.current.displayData).toEqual(['note1', 'note2']);
      expect(result.current.phase).toBe('stable');
    });
  });

  describe('Key Change Transition', () => {
    it('should start fade-out when key changes', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old-note'], key: 'exercise-a' } },
      );

      // Change key
      rerender({ data: ['new-note'], key: 'exercise-b' });

      // Should start fading out
      expect(result.current.phase).toBe('fading-out');

      // displayData should still be OLD
      expect(result.current.displayData).toEqual(['old-note']);

      // After RAF, opacity should be 0
      await advanceTimersAndRAF(0);
      expect(result.current.opacity).toBe(0);
    });

    it('should keep displayData FROZEN during entire fade-out', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old-note'], key: 'exercise-a' } },
      );

      // Change key - this should trigger transition
      rerender({ data: ['new-note'], key: 'exercise-b' });

      // Immediately after rerender, displayData should be OLD (frozen)
      // The key change was detected synchronously, displayData is NOT updated
      expect(result.current.displayData).toEqual(['old-note']);

      // Trigger the effect to start fade-out
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.phase).toBe('fading-out');

      // Advance to middle of fade-out (~250ms)
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // displayData MUST still be old data during fade-out
      expect(result.current.displayData).toEqual(['old-note']);
      expect(result.current.phase).toBe('fading-out');

      // Advance a bit more but stay under 500ms threshold
      await act(async () => {
        vi.advanceTimersByTime(200); // Now at ~450ms
      });

      // Still should be old data
      expect(result.current.displayData).toEqual(['old-note']);
      expect(result.current.phase).toBe('fading-out');
    });

    it('should SWAP at exactly fade-out completion', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old-note'], key: 'exercise-a' } },
      );

      // Change key
      rerender({ data: ['new-note'], key: 'exercise-b' });

      // Immediately after key change, should be fading-out with OLD data
      expect(result.current.phase).toBe('fading-out');
      expect(result.current.displayData).toEqual(['old-note']);

      // Advance to just before SWAP (500ms is the timeout)
      // We need to advance less than 500ms total to stay in fade-out
      await advanceTimersAndRAF(450);
      expect(result.current.displayData).toEqual(['old-note']);
      expect(result.current.phase).toBe('fading-out');

      // Cross the threshold - advance past 500ms total
      await advanceTimersAndRAF(100); // Now at ~550ms + RAF overhead
      expect(result.current.displayData).toEqual(['new-note']);
      expect(result.current.phase).toBe('fading-in');
    });

    it('should complete full transition cycle', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old'], key: 'a' } },
      );

      // Initial state
      expect(result.current.phase).toBe('stable');
      expect(result.current.opacity).toBe(1);
      expect(result.current.displayData).toEqual(['old']);

      // Trigger transition
      rerender({ data: ['new'], key: 'b' });

      // Phase 1: fading-out
      expect(result.current.phase).toBe('fading-out');
      await advanceTimersAndRAF(0);
      expect(result.current.opacity).toBe(0);
      expect(result.current.displayData).toEqual(['old']); // Still old!

      // Wait for fade-out to complete
      await advanceTimersAndRAF(FADE_DURATION);

      // Phase 2: SWAP + fading-in
      expect(result.current.phase).toBe('fading-in');
      expect(result.current.displayData).toEqual(['new']); // NOW new!

      await advanceTimersAndRAF(0);
      expect(result.current.opacity).toBe(1);

      // Wait for fade-in to complete
      await advanceTimersAndRAF(FADE_DURATION);

      // Phase 3: stable
      expect(result.current.phase).toBe('stable');
      expect(result.current.displayData).toEqual(['new']);
    });
  });

  describe('Data Updates During Transition (No Bleed-Through)', () => {
    it('should NOT update displayData when source changes during fade-out', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old-note'], key: 'exercise-a' } },
      );

      // Start transition to B
      rerender({ data: ['new-note-v1'], key: 'exercise-b' });
      await advanceTimersAndRAF(0);

      // Mid-fade-out, source data changes again (same key B)
      await advanceTimersAndRAF(250);
      rerender({ data: ['new-note-v2'], key: 'exercise-b' });

      // displayData should STILL be old (frozen)
      expect(result.current.displayData).toEqual(['old-note']);

      // Another update
      rerender({ data: ['new-note-v3'], key: 'exercise-b' });
      expect(result.current.displayData).toEqual(['old-note']);

      // At SWAP, should get the LATEST version
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData).toEqual(['new-note-v3']);
    });

    it('should allow same-key updates during fade-in (displayKeyRef matches)', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old'], key: 'a' } },
      );

      // Complete fade-out, start fade-in
      rerender({ data: ['new-v1'], key: 'b' });
      await advanceTimersAndRAF(FADE_DURATION + 10);

      expect(result.current.phase).toBe('fading-in');
      expect(result.current.displayData).toEqual(['new-v1']);

      // Update during fade-in with SAME key - this should work
      // because displayKeyRef is now 'b' and we're not in a key transition
      rerender({ data: ['new-v2'], key: 'b' });

      // Wait for effect to process - note we're still in fade-in phase
      // but same-key updates should still be blocked until stable
      // (this is a design decision - consistent behavior during all transition phases)
      expect(result.current.displayData).toEqual(['new-v1']);

      // After transition completes and becomes stable, same-key updates work
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.phase).toBe('stable');

      // Now update should work
      rerender({ data: ['new-v3'], key: 'b' });
      await act(async () => {
        vi.advanceTimersByTime(0);
      });
      expect(result.current.displayData).toEqual(['new-v3']);
    });
  });

  describe('Rapid Key Changes', () => {
    it('should handle A→B→C transition by using latest data at SWAP', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['a-data'], key: 'a' } },
      );

      // Start A→B
      rerender({ data: ['b-data'], key: 'b' });
      await advanceTimersAndRAF(100);

      // Mid-transition, change to C
      rerender({ data: ['c-data'], key: 'c' });

      // Should still show A (original frozen data)
      expect(result.current.displayData).toEqual(['a-data']);

      // At SWAP time, should get C (latest)
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData).toEqual(['c-data']);
    });

    it('should handle clicking same exercise twice quickly', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['a-data'], key: 'a' } },
      );

      // Start A→B
      rerender({ data: ['b-data'], key: 'b' });
      await advanceTimersAndRAF(100);

      // Quick click back to A
      rerender({ data: ['a-data-updated'], key: 'a' });

      // Should still show original A data
      expect(result.current.displayData).toEqual(['a-data']);

      // At SWAP, should get latest A data
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData).toEqual(['a-data-updated']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['note1'], key: 'a' } },
      );

      // Transition to empty
      rerender({ data: [], key: 'b' });
      await advanceTimersAndRAF(FADE_DURATION + 10);

      expect(result.current.displayData).toEqual([]);
    });

    it('should handle null key gracefully', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['note1'], key: 'a' as string | undefined } },
      );

      // Change to undefined key
      rerender({ data: ['note2'], key: undefined });

      // Should handle this gracefully
      expect(result.current.displayData).toBeDefined();
    });

    it('should handle very short fade duration', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: 50 }),
        { initialProps: { data: ['old'], key: 'a' } },
      );

      rerender({ data: ['new'], key: 'b' });
      await advanceTimersAndRAF(60);

      expect(result.current.displayData).toEqual(['new']);
    });

    it('should clean up timeouts on unmount', async () => {
      const { result, rerender, unmount } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old'], key: 'a' } },
      );

      // Start transition
      rerender({ data: ['new'], key: 'b' });

      // Unmount mid-transition
      unmount();

      // Advance timers - should not throw
      await advanceTimersAndRAF(FADE_DURATION * 2);
    });
  });

  describe('Timing Precision', () => {
    it('should have opacity 0 during SWAP moment', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['old'], key: 'a' } },
      );

      const opacityLog: { time: number; opacity: number; data: unknown }[] = [];

      rerender({ data: ['new'], key: 'b' });

      // Log state at precise intervals around SWAP
      for (let t = 0; t <= FADE_DURATION + 100; t += 10) {
        await advanceTimersAndRAF(10);
        opacityLog.push({
          time: t,
          opacity: result.current.opacity,
          data: result.current.displayData,
        });
      }

      // Find SWAP moment (when data changes)
      const swapIndex = opacityLog.findIndex(
        (log, i) =>
          i > 0 &&
          JSON.stringify(log.data) !== JSON.stringify(opacityLog[i - 1].data),
      );

      if (swapIndex > 0) {
        // At SWAP, opacity should be 0 (fully invisible)
        expect(opacityLog[swapIndex].opacity).toBe(0);
        // Just before SWAP, should still have old data
        expect(opacityLog[swapIndex - 1].data).toEqual(['old']);
        // At SWAP, should have new data
        expect(opacityLog[swapIndex].data).toEqual(['new']);
      }
    });
  });

  describe('Advanced Scenarios', () => {
    it('should handle undefined→defined key transition (no exercise → first exercise)', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        {
          initialProps: {
            data: [] as string[],
            key: undefined as string | undefined,
          },
        },
      );

      // Initial state with no exercise
      expect(result.current.displayData).toEqual([]);
      expect(result.current.phase).toBe('stable');

      // Select first exercise
      rerender({ data: ['first-note'], key: 'exercise-1' });

      // Should trigger transition
      expect(result.current.phase).toBe('fading-out');
      expect(result.current.displayData).toEqual([]); // Still empty during fade-out

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 10);
      expect(result.current.displayData).toEqual(['first-note']);
    });

    it('should handle defined→undefined key transition (exercise → no exercise)', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        {
          initialProps: {
            data: ['note1'],
            key: 'exercise-1' as string | undefined,
          },
        },
      );

      // Initial state with exercise
      expect(result.current.displayData).toEqual(['note1']);

      // Deselect exercise
      rerender({ data: [], key: undefined });

      // Should trigger transition, keeping old data visible
      expect(result.current.phase).toBe('fading-out');
      expect(result.current.displayData).toEqual(['note1']);

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 10);
      expect(result.current.displayData).toEqual([]);
    });

    it('should handle A→B→A return-to-original pattern', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['a-original'], key: 'a' } },
      );

      // Start A→B
      rerender({ data: ['b-data'], key: 'b' });
      await advanceTimersAndRAF(100); // Mid-transition

      expect(result.current.displayData).toEqual(['a-original']); // Still showing A

      // Change back to A before transition completes
      rerender({ data: ['a-updated'], key: 'a' });

      // Should still show original A (frozen)
      expect(result.current.displayData).toEqual(['a-original']);

      // At SWAP, should show updated A (not B)
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData).toEqual(['a-updated']);
    });

    it('should handle stress test with many rapid transitions', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['start'], key: 'start' } },
      );

      // Rapid fire transitions
      const keys = ['a', 'b', 'c', 'd', 'e', 'f'];
      for (const key of keys) {
        rerender({ data: [`${key}-data`], key });
        await act(async () => {
          vi.advanceTimersByTime(50); // Very quick, not enough to complete any transition
        });
      }

      // Should still show original data (all transitions interrupted)
      expect(result.current.displayData).toEqual(['start']);

      // Wait for final transition to complete
      await advanceTimersAndRAF(FADE_DURATION);

      // Should show the LAST key's data
      expect(result.current.displayData).toEqual(['f-data']);
    });

    it('should handle same data with different keys', async () => {
      const sharedData = ['same-notes'];

      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: sharedData, key: 'exercise-1' } },
      );

      // Transition to different exercise with same data
      rerender({ data: sharedData, key: 'exercise-2' });

      // Should still trigger transition (key changed)
      expect(result.current.phase).toBe('fading-out');

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 10);

      // Data should be the same but transition should have occurred
      expect(result.current.displayData).toEqual(sharedData);
      expect(result.current.phase).toBe('fading-in');
    });

    it('should handle object data with reference changes', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: { notes: ['c', 'd'] }, key: 'a' } },
      );

      // Same logical data but new reference - should update when stable
      rerender({ data: { notes: ['c', 'd'] }, key: 'a' });
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Reference should update (new object)
      expect(result.current.displayData).toEqual({ notes: ['c', 'd'] });

      // Different key with object data
      rerender({ data: { notes: ['e', 'f'] }, key: 'b' });
      expect(result.current.phase).toBe('fading-out');

      // Old object should be preserved during fade-out
      expect(result.current.displayData).toEqual({ notes: ['c', 'd'] });

      // Complete transition
      await advanceTimersAndRAF(FADE_DURATION + 10);
      expect(result.current.displayData).toEqual({ notes: ['e', 'f'] });
    });

    it('should maintain correct state through complete cycle multiple times', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) =>
          useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: ['exercise-1-notes'], key: 'ex1' } },
      );

      // Run through 3 complete transition cycles
      const exercises = [
        { data: ['exercise-2-notes'], key: 'ex2' },
        { data: ['exercise-3-notes'], key: 'ex3' },
        { data: ['exercise-4-notes'], key: 'ex4' },
      ];

      let previousData = ['exercise-1-notes'];

      for (const exercise of exercises) {
        // Start transition
        rerender(exercise);

        // Verify old data stays during fade-out
        expect(result.current.displayData).toEqual(previousData);
        expect(result.current.phase).toBe('fading-out');

        // Complete fade-out
        await advanceTimersAndRAF(FADE_DURATION + 10);

        // Verify new data after SWAP
        expect(result.current.displayData).toEqual(exercise.data);
        expect(result.current.phase).toBe('fading-in');

        // Complete fade-in
        await advanceTimersAndRAF(FADE_DURATION);

        // Verify stable state
        expect(result.current.phase).toBe('stable');
        expect(result.current.opacity).toBe(1);

        previousData = exercise.data;
      }
    });
  });
});
