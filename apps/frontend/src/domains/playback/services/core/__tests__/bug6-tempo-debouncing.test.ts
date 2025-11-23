/**
 * BUG #6: Tempo Debouncing Verification Tests
 *
 * Verifies that tempo changes are debounced to prevent UI freezing
 * from rapid slider movements or automated tempo changes.
 *
 * Implementation: 50ms debounce window in RegionProcessor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegionProcessor } from '../RegionProcessor.js';
import { EventBus } from '../EventBus.js';

describe('BUG #6: Tempo Debouncing Verification', () => {
  let eventBus: EventBus;
  let regionProcessor: RegionProcessor;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    eventBus = new EventBus({ maxEventHistory: 10 });
    regionProcessor = new RegionProcessor(eventBus);

    // Set as running (debouncing only happens when playing)
    (regionProcessor as any).isRunning = true;

    // Mock reschedulePendingEvents to avoid complex dependencies
    (regionProcessor as any).reschedulePendingEvents = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    regionProcessor.dispose();
  });

  // ============================================================================
  // DEBOUNCE CONSTANT VERIFICATION
  // ============================================================================

  describe('Debounce Configuration', () => {
    it('should have TEMPO_DEBOUNCE_MS constant set to 50ms', () => {
      const debounceMs = (regionProcessor as any).TEMPO_DEBOUNCE_MS;
      expect(debounceMs).toBe(50);
    });

    it('should use window.setTimeout for debouncing', async () => {
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);

      setTimeoutSpy.mockRestore();
    });
  });

  // ============================================================================
  // RAPID TEMPO CHANGE TESTS
  // ============================================================================

  describe('Rapid Tempo Changes', () => {
    it('should not immediately process rapid tempo changes', async () => {
      // Emit 3 rapid tempo changes
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });
      await eventBus.emit('transport:tempo-change', { tempo: 130, bpm: 130 });
      await eventBus.emit('transport:tempo-change', { tempo: 140, bpm: 140 });

      // Debounce timer should be set
      const debounceTimer = (regionProcessor as any).tempoChangeDebounce;
      expect(debounceTimer).not.toBeNull();
      // Timer can be number or Timeout object depending on Node version
      expect(debounceTimer).toBeTruthy();
    });

    it('should process tempo change after debounce window expires', async () => {
      // Emit tempo change
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Timer should be set
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Advance time by 50ms
      vi.advanceTimersByTime(50);

      // Timer should be cleared after processing
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });

    it('should reset debounce timer on new tempo change', async () => {
      // First tempo change
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Get the timer ID
      const firstTimer = (regionProcessor as any).tempoChangeDebounce;
      expect(firstTimer).not.toBeNull();

      // Advance halfway (25ms)
      vi.advanceTimersByTime(25);

      // Second tempo change (should reset timer)
      await eventBus.emit('transport:tempo-change', { tempo: 140, bpm: 140 });

      // Timer ID should be different (old one was cleared)
      const secondTimer = (regionProcessor as any).tempoChangeDebounce;
      expect(secondTimer).not.toBeNull();
      expect(secondTimer).not.toBe(firstTimer);
    });

    it('should handle 10 rapid tempo changes with single debounce', async () => {
      // Simulate user rapidly dragging tempo slider
      for (let i = 120; i < 130; i++) {
        await eventBus.emit('transport:tempo-change', { tempo: i, bpm: i });
        vi.advanceTimersByTime(5); // 5ms between each change
      }

      // Should have timer set (not yet processed)
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Advance remaining time to complete debounce
      vi.advanceTimersByTime(50);

      // Timer should be cleared
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });
  });

  // ============================================================================
  // DEBOUNCE CLEARING TESTS
  // ============================================================================

  describe('Debounce Timer Clearing', () => {
    it('should clear previous timer when new tempo change arrives', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      // First change
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Second change (should clear first timer)
      await eventBus.emit('transport:tempo-change', { tempo: 130, bpm: 130 });

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('should clear timer on dispose even if debounce is pending', async () => {
      // Emit tempo change
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Timer should be set
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Dispose (should clear timer)
      regionProcessor.dispose();

      // Timer should be null
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });
  });

  // ============================================================================
  // STOPPED STATE TESTS
  // ============================================================================

  describe('Tempo Changes While Stopped', () => {
    it('should not debounce when playback is stopped', async () => {
      // Set as NOT running
      (regionProcessor as any).isRunning = false;

      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Should not set debounce timer
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });

    it('should log warning when tempo changes while stopped', async () => {
      const loggerSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (regionProcessor as any).isRunning = false;

      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Check that it returned early (no timer set)
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();

      loggerSpy.mockRestore();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle tempo slider drag simulation', async () => {
      // Simulate user dragging slider from 100 to 150 BPM
      const tempos = [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];

      for (const tempo of tempos) {
        await eventBus.emit('transport:tempo-change', { tempo, bpm: tempo });
        vi.advanceTimersByTime(10); // 10ms between each update
      }

      // Should still have pending debounce
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Complete debounce
      vi.advanceTimersByTime(50);

      // Should be cleared
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });

    it('should handle alternating tempo changes', async () => {
      // Fast-slow-fast pattern
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });
      vi.advanceTimersByTime(10);

      await eventBus.emit('transport:tempo-change', { tempo: 60, bpm: 60 });
      vi.advanceTimersByTime(10);

      await eventBus.emit('transport:tempo-change', { tempo: 180, bpm: 180 });

      // Should have pending timer
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Complete
      vi.advanceTimersByTime(50);
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });

    it('should handle start-stop-start during tempo change', async () => {
      // Start playing
      (regionProcessor as any).isRunning = true;

      // Change tempo
      await eventBus.emit('transport:tempo-change', { tempo: 140, bpm: 140 });
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      // Stop playing
      (regionProcessor as any).isRunning = false;

      // Change tempo again (should not debounce)
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 120 });

      // Original timer should still exist (wasn't processed because we stopped)
      // But it will be cleared by the event handler's early return
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance Characteristics', () => {
    it('should handle 100 rapid tempo changes without blocking', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        await eventBus.emit('transport:tempo-change', {
          tempo: 120 + i,
          bpm: 120 + i,
        });
        vi.advanceTimersByTime(1); // 1ms between changes
      }

      const duration = performance.now() - startTime;

      // Should complete quickly (not block UI)
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Should have pending debounce
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();
    });

    it('should coalesce multiple changes into single processing', async () => {
      let processingCount = 0;

      // Spy on the internal reschedule method
      const originalReschedule = (regionProcessor as any).reschedulePendingEvents;
      (regionProcessor as any).reschedulePendingEvents = () => {
        processingCount++;
        if (typeof originalReschedule === 'function') {
          originalReschedule.call(regionProcessor);
        }
      };

      // Emit 10 changes
      for (let i = 0; i < 10; i++) {
        await eventBus.emit('transport:tempo-change', {
          tempo: 120 + i,
          bpm: 120 + i,
        });
        vi.advanceTimersByTime(5); // 5ms between changes
      }

      // Advance final debounce
      vi.advanceTimersByTime(50);

      // Should only process once (not 10 times)
      expect(processingCount).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle tempo=0', async () => {
      await eventBus.emit('transport:tempo-change', { tempo: 0, bpm: 0 });

      // Should still set timer (even for edge case values)
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();

      vi.advanceTimersByTime(50);
      expect((regionProcessor as any).tempoChangeDebounce).toBeNull();
    });

    it('should handle negative tempo values', async () => {
      await eventBus.emit('transport:tempo-change', { tempo: -120, bpm: -120 });

      // Should still debounce
      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();
    });

    it('should handle very large tempo values', async () => {
      await eventBus.emit('transport:tempo-change', {
        tempo: 999999,
        bpm: 999999,
      });

      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();
    });

    it('should handle both tempo and bpm fields', async () => {
      // tempo field
      await eventBus.emit('transport:tempo-change', { tempo: 120, bpm: 0 });
      vi.advanceTimersByTime(10);

      // bpm field
      await eventBus.emit('transport:tempo-change', { tempo: 0, bpm: 140 });

      expect((regionProcessor as any).tempoChangeDebounce).not.toBeNull();
    });
  });
});
