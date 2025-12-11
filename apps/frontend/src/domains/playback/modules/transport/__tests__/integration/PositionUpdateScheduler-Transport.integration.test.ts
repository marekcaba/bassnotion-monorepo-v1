/**
 * PositionUpdateScheduler Integration Tests
 *
 * Tests the integration between PositionUpdateScheduler and the Transport system,
 * verifying that position updates flow correctly through the system.
 *
 * These tests address Issue #4: Ensuring mutual exclusion between polling and
 * event-driven strategies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PositionUpdateScheduler } from '../../scheduling/PositionUpdateScheduler.js';
import type { Clock } from '../../core/Clock.js';
import type { Timeline } from '../../core/Timeline.js';
import type { PositionUpdate } from '../../scheduling/types/scheduler.types.js';

// Mock Clock factory
const createMockClock = (
  isAudioWorklet = true,
): Clock & {
  triggerTick: (time: number, frame?: number) => void;
  setAudioTimeValue: (time: number) => void;
} => {
  let audioTime = 0;
  let storedCallback: ((time: number, frame?: number) => void) | undefined;

  const mock = {
    isUsingAudioWorklet: vi.fn().mockReturnValue(isAudioWorklet),
    getAudioTime: vi.fn(() => audioTime),
    setOnTick: vi.fn().mockImplementation((callback) => {
      storedCallback = callback;
    }),
    triggerTick: (time: number, frame?: number) => {
      if (storedCallback) {
        storedCallback(time, frame);
      }
    },
    setAudioTimeValue: (time: number) => {
      audioTime = time;
    },
    start: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    getSampleAccurateClock: vi.fn().mockReturnValue(null),
  };

  return mock as unknown as Clock & {
    triggerTick: (time: number, frame?: number) => void;
    setAudioTimeValue: (time: number) => void;
  };
};

// Mock Timeline factory
const createMockTimeline = (): Timeline =>
  ({
    updatePositionFromSeconds: vi.fn(),
    getTransportPosition: vi.fn().mockReturnValue({
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    }),
    reset: vi.fn(),
  }) as unknown as Timeline;

describe('PositionUpdateScheduler Integration', () => {
  let scheduler: PositionUpdateScheduler;
  let mockClock: Clock & {
    triggerTick: (time: number, frame?: number) => void;
    setAudioTimeValue: (time: number) => void;
  };
  let mockTimeline: Timeline;
  let receivedUpdates: PositionUpdate[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(100);
    receivedUpdates = [];
    mockClock = createMockClock(true);
    mockTimeline = createMockTimeline();

    scheduler = new PositionUpdateScheduler(mockClock, mockTimeline, {
      pollingIntervalMs: 20,
      eventDrivenThrottleMs: 8.33,
      preferEventDriven: true,
    });

    scheduler.setUpdateCallback((update) => {
      receivedUpdates.push(update);
    });
  });

  afterEach(() => {
    scheduler.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('mutual exclusion', () => {
    it('should never have both strategies active simultaneously', () => {
      // Start with event-driven (default when AudioWorklet is active)
      scheduler.start();
      const firstStrategy = scheduler.getActiveStrategy();
      expect(firstStrategy).toBe('event-driven');

      // Switch to polling
      scheduler.start({ strategy: 'polling' });
      const secondStrategy = scheduler.getActiveStrategy();
      expect(secondStrategy).toBe('polling');

      // Verify only one active at a time
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop previous strategy when switching', () => {
      scheduler.start({ strategy: 'event-driven' });

      // Verify event-driven is active
      mockClock.triggerTick(0.5);
      expect(receivedUpdates.length).toBe(1);
      expect(receivedUpdates[0].source).toBe('event-driven');

      // Switch to polling
      scheduler.start({ strategy: 'polling' });
      receivedUpdates = [];

      // Event-driven ticks should no longer produce updates
      mockClock.triggerTick(1.0);
      expect(receivedUpdates.every((u) => u.source === 'polling')).toBe(true);
    });

    it('should select event-driven when AudioWorklet is active and preferred', () => {
      scheduler.start(); // Auto-select
      expect(scheduler.getActiveStrategy()).toBe('event-driven');
    });

    it('should fall back to polling when AudioWorklet is inactive', () => {
      // Create scheduler with inactive AudioWorklet
      mockClock = createMockClock(false);
      scheduler.dispose();
      scheduler = new PositionUpdateScheduler(mockClock, mockTimeline, {
        pollingIntervalMs: 20,
        eventDrivenThrottleMs: 8.33,
        preferEventDriven: true,
      });

      scheduler.start();
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });
  });

  describe('position update flow', () => {
    it('should emit updates with correct PositionUpdate shape', () => {
      scheduler.start({ strategy: 'event-driven' });
      mockClock.triggerTick(0.5);

      expect(receivedUpdates.length).toBe(1);
      const update = receivedUpdates[0];

      expect(update).toHaveProperty('seconds');
      expect(update).toHaveProperty('source');
      expect(update).toHaveProperty('timestamp');
      expect(update.seconds).toBe(0.5);
      expect(update.source).toBe('event-driven');
      expect(typeof update.timestamp).toBe('number');
    });

    it('should include frame number when provided by Clock.onTick', () => {
      scheduler.start({ strategy: 'event-driven' });
      mockClock.triggerTick(0.5, 24000);

      expect(receivedUpdates[0].frame).toBe(24000);
    });

    it('should stop updates when scheduler stops', () => {
      scheduler.start({ strategy: 'event-driven' });
      mockClock.triggerTick(0.5);
      expect(receivedUpdates.length).toBe(1);

      scheduler.stop();
      receivedUpdates = [];

      mockClock.triggerTick(1.0);
      expect(receivedUpdates.length).toBe(0);
    });

    it('should pause updates without stopping', () => {
      scheduler.start({ strategy: 'event-driven' });
      mockClock.triggerTick(0.5);
      expect(receivedUpdates.length).toBe(1);

      scheduler.pause();
      expect(scheduler.isRunning()).toBe(true);
      expect(scheduler.isPaused()).toBe(true);

      receivedUpdates = [];
      mockClock.triggerTick(1.0);
      expect(receivedUpdates.length).toBe(0);
    });

    it('should resume updates after pause', () => {
      scheduler.start({ strategy: 'event-driven' });
      scheduler.pause();
      scheduler.resume();

      expect(scheduler.isPaused()).toBe(false);

      mockClock.triggerTick(0.5);
      expect(receivedUpdates.length).toBe(1);
    });
  });

  describe('polling strategy integration', () => {
    it('should emit updates at polling interval', () => {
      scheduler.start({ strategy: 'polling' });
      scheduler.setTransportStartTime(0);

      const initialCount = receivedUpdates.length;

      // Advance by 100ms (should trigger ~5 updates at 20ms interval)
      vi.advanceTimersByTime(100);

      expect(receivedUpdates.length).toBeGreaterThan(initialCount);
      expect(receivedUpdates.every((u) => u.source === 'polling')).toBe(true);
    });

    it('should calculate elapsed time from Clock.getAudioTime()', () => {
      scheduler.setTransportStartTime(1);
      mockClock.setAudioTimeValue(1.5);

      scheduler.start({ strategy: 'polling' });

      // Should calculate 1.5 - 1.0 = 0.5 seconds elapsed
      expect(receivedUpdates[0].seconds).toBeCloseTo(0.5, 2);
    });
  });

  describe('event-driven strategy integration', () => {
    it('should throttle updates to configured rate', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        // Each tick calls performance.now() twice:
        // 1. In handleTick() for throttle check
        // 2. In emitUpdate() for the timestamp
        // Start at 100ms (past throttle interval from lastEmitTime=0)
        if (callCount <= 2) return 100; // First tick - should emit
        if (callCount <= 4) return 105; // Second tick - 5ms later, throttled (< 8.33ms)
        return 108; // Third tick - 8ms later, still throttled (< 8.33ms)
      });

      scheduler.start({ strategy: 'event-driven' });

      // Simulate rapid ticks
      mockClock.triggerTick(0.1);
      mockClock.triggerTick(0.2);
      mockClock.triggerTick(0.3);

      // Only first should be emitted (others within throttle window of 8.33ms)
      expect(receivedUpdates.length).toBe(1);
    });
  });

  describe('rapid lifecycle operations', () => {
    it('should handle rapid start/stop cycles without errors', () => {
      for (let i = 0; i < 10; i++) {
        scheduler.start();
        scheduler.stop();
      }

      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');
    });

    it('should handle rapid strategy switching', () => {
      for (let i = 0; i < 5; i++) {
        scheduler.start({ strategy: 'event-driven' });
        scheduler.start({ strategy: 'polling' });
      }

      expect(scheduler.isRunning()).toBe(true);
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });

    it('should clean up properly on dispose', () => {
      scheduler.start();
      scheduler.dispose();

      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');

      // Should not throw on second dispose
      expect(() => scheduler.dispose()).not.toThrow();
    });
  });
});
