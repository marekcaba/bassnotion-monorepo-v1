/**
 * EventDrivenStrategy Unit Tests
 *
 * Tests for the event-driven position update strategy that uses
 * Clock.onTick subscription with throttling to 120Hz.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventDrivenStrategy } from '../strategies/EventDrivenStrategy.js';
import type { Clock } from '../../core/Clock.js';
import type { PositionUpdate } from '../types/scheduler.types.js';

// Mock Clock with controllable onTick callback
const createMockClock = (): Clock & {
  triggerTick: (time: number, frame?: number) => void;
  _onTickCallback?: (time: number, frame?: number) => void;
} => {
  let storedCallback: ((time: number, frame?: number) => void) | undefined;

  const mock = {
    isUsingAudioWorklet: vi.fn().mockReturnValue(true),
    setOnTick: vi
      .fn()
      .mockImplementation(
        (callback: ((time: number, frame?: number) => void) | undefined) => {
          storedCallback = callback;
        },
      ),
    triggerTick: (time: number, frame?: number) => {
      if (storedCallback) {
        storedCallback(time, frame);
      }
    },
    get _onTickCallback() {
      return storedCallback;
    },
    getAudioTime: vi.fn().mockReturnValue(0),
    start: vi.fn(),
    stop: vi.fn(),
  };

  return mock as unknown as Clock & {
    triggerTick: (time: number, frame?: number) => void;
    _onTickCallback?: (time: number, frame?: number) => void;
  };
};

describe('EventDrivenStrategy', () => {
  let strategy: EventDrivenStrategy;
  let mockClock: Clock & {
    triggerTick: (time: number, frame?: number) => void;
  };
  let receivedUpdates: PositionUpdate[];

  beforeEach(() => {
    vi.useFakeTimers();
    receivedUpdates = [];
    mockClock = createMockClock();

    strategy = new EventDrivenStrategy(mockClock, {
      pollingIntervalMs: 20,
      eventDrivenThrottleMs: 8.33, // 120Hz
      preferEventDriven: true,
    });

    strategy.setCallback((update) => {
      receivedUpdates.push(update);
    });
  });

  afterEach(() => {
    strategy.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('event-driven');
    });

    it('should not be active initially', () => {
      expect(strategy.isActive).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should start and become active', () => {
      strategy.start();
      expect(strategy.isActive).toBe(true);
    });

    it('should subscribe to Clock.onTick on start', () => {
      strategy.start();
      expect(mockClock.setOnTick).toHaveBeenCalled();
    });

    it('should stop and become inactive', () => {
      strategy.start();
      strategy.stop();
      expect(strategy.isActive).toBe(false);
    });

    it('should clear Clock.onTick subscription on stop', () => {
      strategy.start();
      strategy.stop();
      // setOnTick should be called with undefined or cleared
      expect(mockClock.setOnTick).toHaveBeenCalledTimes(2); // Once for start, once for stop
    });

    it('should be idempotent for multiple start calls', () => {
      strategy.start();
      strategy.start(); // Should not throw
      expect(strategy.isActive).toBe(true);
    });
  });

  describe('tick handling', () => {
    it('should emit update on tick', () => {
      // Mock performance.now to always return a time past the throttle interval
      vi.spyOn(performance, 'now').mockReturnValue(100);

      strategy.start();
      mockClock.triggerTick(0.5);

      expect(receivedUpdates.length).toBe(1);
      expect(receivedUpdates[0].source).toBe('event-driven');
      expect(receivedUpdates[0].seconds).toBe(0.5);
    });

    it('should include frame number when provided', () => {
      // Mock performance.now to always return a time past the throttle interval
      vi.spyOn(performance, 'now').mockReturnValue(100);

      strategy.start();
      mockClock.triggerTick(0.5, 24000);

      expect(receivedUpdates[0].frame).toBe(24000);
    });

    it('should not emit when not active', () => {
      mockClock.triggerTick(0.5);
      expect(receivedUpdates.length).toBe(0);
    });
  });

  describe('throttling', () => {
    it('should throttle updates to configured rate', () => {
      strategy.start();

      // Simulate rapid ticks (faster than throttle interval)
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0) // First tick
        .mockReturnValueOnce(5) // Second tick (too soon, should be dropped)
        .mockReturnValueOnce(10); // Third tick (still too soon)

      mockClock.triggerTick(0.1);
      mockClock.triggerTick(0.2);
      mockClock.triggerTick(0.3);

      // Only first should be emitted (others within throttle window)
      expect(receivedUpdates.length).toBe(1);
    });

    it('should emit after throttle interval passes', () => {
      // Each tick calls performance.now() twice:
      // 1. In handleTick() for throttle check
      // 2. In emitUpdate() for the timestamp
      // Start time must be > 8.33ms (throttle interval) from lastEmitTime (0)
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(100) // First tick - throttle check (100ms > 8.33ms from 0)
        .mockReturnValueOnce(100) // First tick - timestamp (sets lastEmitTime = 100)
        .mockReturnValueOnce(110) // Second tick - throttle check (110 - 100 = 10ms > 8.33ms)
        .mockReturnValueOnce(110); // Second tick - timestamp

      strategy.start();

      mockClock.triggerTick(0.1);
      mockClock.triggerTick(0.2);

      expect(receivedUpdates.length).toBe(2);
    });
  });

  describe('pause/resume', () => {
    it('should not emit updates while paused', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100);
      strategy.start();
      strategy.pause();

      mockClock.triggerTick(0.5);

      expect(receivedUpdates.length).toBe(0);
    });

    it('should resume emitting updates after resume', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100);
      strategy.start();
      strategy.pause();
      strategy.resume();

      mockClock.triggerTick(0.5);

      expect(receivedUpdates.length).toBe(1);
    });
  });

  describe('negative time handling', () => {
    it('should emit 0 for negative elapsed time', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100);
      strategy.start();
      mockClock.triggerTick(-0.5); // Negative time (race condition)

      expect(receivedUpdates[0].seconds).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up on dispose', () => {
      strategy.start();
      strategy.dispose();

      expect(strategy.isActive).toBe(false);
    });

    it('should not emit after dispose', () => {
      strategy.start();
      strategy.dispose();

      mockClock.triggerTick(0.5);

      expect(receivedUpdates.length).toBe(0);
    });
  });

  describe('transport start time', () => {
    it('should accept transport start time', () => {
      vi.spyOn(performance, 'now').mockReturnValue(100);
      // EventDrivenStrategy receives time directly from Clock.onTick
      // which is already elapsed time, so transportStartTime is informational
      strategy.setTransportStartTime(1.5);
      strategy.start();

      mockClock.triggerTick(0.5);

      // The time from Clock.onTick is used directly
      expect(receivedUpdates[0].seconds).toBe(0.5);
    });
  });
});
