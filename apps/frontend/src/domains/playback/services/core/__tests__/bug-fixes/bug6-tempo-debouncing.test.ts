/**
 * bug6-tempo-debouncing.test.ts
 *
 * Bug #6 Verification: Tempo Debouncing
 *
 * Original Issue: Rapid tempo slider changes caused UI freezing and
 * double-triggering of scheduling events.
 *
 * Root Cause: Each tempo change immediately rescheduled all events,
 * causing overlapping rescheduling operations that froze the UI.
 *
 * Original Fix: [RegionProcessor.ts:224-403]
 * - 50ms debounce threshold prevents overlapping rescheduling
 * - Clear previous timer ensures only last change triggers reschedule
 * - Single rescheduling operation after debounce period
 * - Timer cleanup on dispose prevents orphaned timers
 *
 * Preservation: PlaybackEngine.updateTempo() uses identical debouncing logic
 *
 * Pass Criteria:
 * - All 7 existing tests in PlaybackEngine.test.ts pass
 * - No UI freeze with 10 changes/second (stress test)
 * - Only 1 rescheduling operation per debounce period
 * - Smooth tempo changes during playback
 * - No double-triggering of tempo events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackEngine } from '../../PlaybackEngine.js';
import type { EventBus } from '../../EventBus.js';

// Mock dependencies
const createMockEventBus = (): EventBus => ({
  emit: vi.fn(),
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
});

const createMockAudioContext = (): AudioContext => {
  const mockContext = {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBufferSource: vi.fn(),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return mockContext as unknown as AudioContext;
};

const createMockAudioDestination = (): AudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: createMockAudioContext(),
  numberOfInputs: 1,
  numberOfOutputs: 1,
  channelCount: 2,
  channelCountMode: 'max',
  channelInterpretation: 'speakers',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('Bug #6: Tempo Debouncing Verification', () => {
  let eventBus: EventBus;
  let audioContext: AudioContext;
  let audioDestination: AudioNode;
  let engine: PlaybackEngine;

  beforeEach(async () => {
    vi.useFakeTimers();
    eventBus = createMockEventBus();
    audioContext = createMockAudioContext();
    audioDestination = createMockAudioDestination();
    engine = new PlaybackEngine(eventBus);
    await engine.initialize(audioContext, audioDestination);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // Stress Test: Rapid Tempo Changes (10 changes/second)
  // ============================================================================

  describe('Stress Test: Rapid Tempo Changes', () => {
    it('should handle 10 tempo changes per second without UI freeze', () => {
      const startBpm = 100;
      const numChanges = 100; // 10 changes/second over 10 seconds
      const changeInterval = 100; // ms between changes

      // Simulate rapid tempo slider movements
      for (let i = 0; i < numChanges; i++) {
        const bpm = startBpm + i;
        engine.updateTempo(bpm);

        // Advance time to simulate rapid changes
        if (i < numChanges - 1) {
          vi.advanceTimersByTime(changeInterval);
        }
      }

      // Get emission count during rapid changes
      const emitsDuringChanges = (eventBus.emit as any).mock.calls.filter(
        (call: any[]) => call[0] === 'playback:tempo-change',
      ).length;

      // During rapid changes, should only emit when debounce expires
      // With 100ms intervals and 50ms debounce, should emit periodically
      expect(emitsDuringChanges).toBeLessThan(numChanges);

      // Fast-forward to let final debounce complete
      vi.advanceTimersByTime(50);

      // Final emit should have the last tempo value
      const finalEmitCall = (eventBus.emit as any).mock.calls
        .filter((call: any[]) => call[0] === 'playback:tempo-change')
        .pop();

      expect(finalEmitCall).toBeDefined();
      expect(finalEmitCall[1].bpm).toBe(startBpm + numChanges - 1);
    });

    it('should emit maximum once every 50ms during rapid changes', () => {
      // Simulate very rapid changes (20 changes/second)
      for (let i = 0; i < 20; i++) {
        engine.updateTempo(120 + i);
        vi.advanceTimersByTime(10); // 10ms intervals (very rapid)
      }

      const emitCount = (eventBus.emit as any).mock.calls.filter(
        (call: any[]) => call[0] === 'playback:tempo-change',
      ).length;

      // With 20 changes over 200ms (20 * 10ms), should emit ~4 times max
      // (every 50ms debounce window)
      expect(emitCount).toBeLessThanOrEqual(5);
    });

    it('should not double-trigger rescheduling', () => {
      const tempoValues = [120, 125, 130, 135, 140];

      // Rapidly set multiple tempos
      tempoValues.forEach((bpm) => {
        engine.updateTempo(bpm);
      });

      vi.clearAllMocks();

      // Let debounce complete
      vi.advanceTimersByTime(50);

      // Should only emit once with final value
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 140,
        instanceId: expect.any(String),
      });
    });

    it('should handle tempo changes during playback without freezing', () => {
      engine.start();
      vi.clearAllMocks();

      // Simulate rapid tempo changes during playback
      for (let i = 0; i < 50; i++) {
        engine.updateTempo(100 + i);
        vi.advanceTimersByTime(20); // 20ms intervals
      }

      // Should still be in playing state
      expect(engine.getState()).toBe('playing');

      // Fast-forward final debounce
      vi.advanceTimersByTime(50);

      // Should have emitted tempo changes (but not 50 times)
      const tempoChangeEmits = (eventBus.emit as any).mock.calls.filter(
        (call: any[]) => call[0] === 'playback:tempo-change',
      ).length;

      expect(tempoChangeEmits).toBeGreaterThan(0);
      expect(tempoChangeEmits).toBeLessThan(50);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle tempo changes with immediate disposal', () => {
      for (let i = 0; i < 10; i++) {
        engine.updateTempo(120 + i * 5);
      }

      // Dispose immediately without waiting for debounce
      engine.dispose();

      // Advance timers - should not emit after disposal
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
    });

    it('should handle very small tempo increments', () => {
      const baseTempo = 120;

      // Simulate fine-grained tempo adjustments (0.1 BPM increments)
      for (let i = 0; i < 100; i++) {
        engine.updateTempo(baseTempo + i * 0.1);
        vi.advanceTimersByTime(5); // Very rapid
      }

      // Fast-forward final debounce
      vi.advanceTimersByTime(50);

      // Should emit final precise value
      const finalEmit = (eventBus.emit as any).mock.calls
        .filter((call: any[]) => call[0] === 'playback:tempo-change')
        .pop();

      expect(finalEmit[1].bpm).toBeCloseTo(baseTempo + 99 * 0.1, 1);
    });

    it('should handle tempo changes from different sources simultaneously', () => {
      // Simulate multiple sources changing tempo (UI slider, MIDI, keyboard)
      engine.updateTempo(120); // UI slider
      vi.advanceTimersByTime(10);
      engine.updateTempo(125); // MIDI input
      vi.advanceTimersByTime(10);
      engine.updateTempo(130); // Keyboard shortcut
      vi.advanceTimersByTime(10);
      engine.updateTempo(135); // Tap tempo

      // Fast-forward debounce
      vi.advanceTimersByTime(50);

      // Should only emit once with final value
      const tempoEmits = (eventBus.emit as any).mock.calls.filter(
        (call: any[]) => call[0] === 'playback:tempo-change',
      );

      expect(tempoEmits).toHaveLength(1);
      expect(tempoEmits[0][1].bpm).toBe(135);
    });

    it('should maintain 50ms debounce threshold consistently', () => {
      const measurements: number[] = [];

      // Test debounce threshold multiple times
      for (let test = 0; test < 5; test++) {
        vi.clearAllMocks();

        engine.updateTempo(120 + test);

        // Measure exact time when event fires
        let emitTime = 0;
        for (let ms = 0; ms <= 100; ms++) {
          vi.advanceTimersByTime(1);
          if (
            (eventBus.emit as any).mock.calls.some(
              (call: any[]) => call[0] === 'playback:tempo-change',
            )
          ) {
            emitTime = ms;
            break;
          }
        }

        measurements.push(emitTime);

        // Wait for debounce to complete before next test
        vi.advanceTimersByTime(50);
      }

      // All measurements should be 50ms (±1ms tolerance for timer precision)
      measurements.forEach((time) => {
        expect(time).toBeGreaterThanOrEqual(49);
        expect(time).toBeLessThanOrEqual(51);
      });
    });
  });

  // ============================================================================
  // Performance & Stability
  // ============================================================================

  describe('Performance & Stability', () => {
    it('should not accumulate timers over many changes', () => {
      // Simulate 1000 tempo changes
      for (let i = 0; i < 1000; i++) {
        engine.updateTempo(100 + (i % 100));
      }

      // Should only have 1 active timer (the last one)
      // Verify by checking that only 1 emit happens after debounce
      vi.advanceTimersByTime(50);

      const emitCount = (eventBus.emit as any).mock.calls.filter(
        (call: any[]) => call[0] === 'playback:tempo-change',
      ).length;

      expect(emitCount).toBe(1);
    });

    it('should handle tempo changes across state transitions', () => {
      // Ready state
      engine.updateTempo(120);
      vi.advanceTimersByTime(50);
      expect(eventBus.emit).toHaveBeenCalled();
      vi.clearAllMocks();

      // Playing state
      engine.start();
      engine.updateTempo(130);
      vi.advanceTimersByTime(50);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
      vi.clearAllMocks();

      // Paused state
      engine.pause();
      engine.updateTempo(140);
      vi.advanceTimersByTime(50);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
      vi.clearAllMocks();

      // Stopped state
      engine.stop();
      engine.updateTempo(150);
      vi.advanceTimersByTime(50);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
    });
  });
});
