/**
 * PollingStrategy Unit Tests
 *
 * Tests for the polling-based position update strategy that uses
 * setInterval for ~50Hz updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PollingStrategy } from '../strategies/PollingStrategy.js';
import type { Clock } from '../../core/Clock.js';
import type { Timeline } from '../../core/Timeline.js';
import type { PositionUpdate } from '../types/scheduler.types.js';

// Mock Clock
const createMockClock = (): Clock => {
  let audioTime = 0;
  return {
    getAudioTime: vi.fn(() => audioTime),
    setAudioTime: (time: number) => {
      audioTime = time;
    },
    isUsingAudioWorklet: vi.fn().mockReturnValue(false),
    setOnTick: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as Clock;
};

// Mock Timeline
const createMockTimeline = (): Timeline =>
  ({
    updatePositionFromSeconds: vi.fn(),
    getTransportPosition: vi.fn().mockReturnValue({
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    }),
  }) as unknown as Timeline;

describe('PollingStrategy', () => {
  let strategy: PollingStrategy;
  let mockClock: Clock & { setAudioTime: (time: number) => void };
  let mockTimeline: Timeline;
  let receivedUpdates: PositionUpdate[];

  beforeEach(() => {
    vi.useFakeTimers();
    receivedUpdates = [];
    mockClock = createMockClock() as Clock & {
      setAudioTime: (time: number) => void;
    };
    mockTimeline = createMockTimeline();

    strategy = new PollingStrategy(mockClock, mockTimeline, {
      pollingIntervalMs: 20,
      eventDrivenThrottleMs: 8.33,
      preferEventDriven: false,
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
      expect(strategy.name).toBe('polling');
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

    it('should stop and become inactive', () => {
      strategy.start();
      strategy.stop();
      expect(strategy.isActive).toBe(false);
    });

    it('should be idempotent for multiple start calls', () => {
      strategy.start();
      strategy.start(); // Should not throw or create multiple intervals
      expect(strategy.isActive).toBe(true);
    });

    it('should be idempotent for multiple stop calls', () => {
      strategy.start();
      strategy.stop();
      strategy.stop(); // Should not throw
      expect(strategy.isActive).toBe(false);
    });
  });

  describe('updates', () => {
    it('should emit initial update on start', () => {
      strategy.setTransportStartTime(0);
      strategy.start();

      expect(receivedUpdates.length).toBeGreaterThanOrEqual(1);
      expect(receivedUpdates[0].source).toBe('polling');
    });

    it('should emit updates at configured interval', () => {
      strategy.setTransportStartTime(0);
      strategy.start();

      const initialCount = receivedUpdates.length;

      // Advance by 100ms (should trigger ~5 updates at 20ms interval)
      vi.advanceTimersByTime(100);

      expect(receivedUpdates.length).toBeGreaterThan(initialCount);
    });

    it('should include correct source in updates', () => {
      strategy.setTransportStartTime(0);
      strategy.start();

      vi.advanceTimersByTime(50);

      receivedUpdates.forEach((update) => {
        expect(update.source).toBe('polling');
      });
    });

    it('should calculate elapsed time correctly', () => {
      // Set transport start time to 1 second
      strategy.setTransportStartTime(1);
      // Mock clock returns 1.5 seconds
      mockClock.setAudioTime(1.5);

      strategy.start();

      // The elapsed time should be 0.5 seconds (1.5 - 1.0)
      expect(receivedUpdates[0].seconds).toBeCloseTo(0.5, 2);
    });
  });

  describe('pause/resume', () => {
    it('should pause updates', () => {
      strategy.setTransportStartTime(0);
      strategy.start();

      const countBeforePause = receivedUpdates.length;
      strategy.pause();

      vi.advanceTimersByTime(100);

      // Should not receive new updates while paused
      expect(receivedUpdates.length).toBe(countBeforePause);
    });

    it('should resume updates after pause', () => {
      strategy.setTransportStartTime(0);
      strategy.start();
      strategy.pause();

      const countAfterPause = receivedUpdates.length;
      strategy.resume();

      vi.advanceTimersByTime(100);

      // Should receive new updates after resume
      expect(receivedUpdates.length).toBeGreaterThan(countAfterPause);
    });
  });

  describe('negative elapsed time handling', () => {
    it('should emit 0 for negative elapsed time', () => {
      // Transport start time is ahead of current time (race condition scenario)
      strategy.setTransportStartTime(2);
      mockClock.setAudioTime(1); // Clock returns time before start

      strategy.start();

      // Should emit 0 instead of negative value
      expect(receivedUpdates[0].seconds).toBe(0);
    });
  });

  describe('timeline updates', () => {
    it('should update timeline with elapsed time', () => {
      strategy.setTransportStartTime(0);
      mockClock.setAudioTime(0.5);

      strategy.start();

      expect(mockTimeline.updatePositionFromSeconds).toHaveBeenCalledWith(0.5);
    });
  });

  describe('dispose', () => {
    it('should clean up on dispose', () => {
      strategy.start();
      strategy.dispose();

      expect(strategy.isActive).toBe(false);
    });

    it('should clear callback on dispose', () => {
      strategy.start();
      const countBeforeDispose = receivedUpdates.length;

      strategy.dispose();
      vi.advanceTimersByTime(100);

      // Should not receive updates after dispose
      expect(receivedUpdates.length).toBe(countBeforeDispose);
    });
  });
});
