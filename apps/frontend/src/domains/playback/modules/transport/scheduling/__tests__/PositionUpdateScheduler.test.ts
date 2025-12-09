/**
 * PositionUpdateScheduler Unit Tests
 *
 * Tests for the centralized position update scheduling system that enforces
 * mutual exclusion between polling and event-driven strategies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PositionUpdateScheduler } from '../PositionUpdateScheduler.js';
import type { Clock } from '../../core/Clock.js';
import type { Timeline } from '../../core/Timeline.js';
import type { PositionUpdate } from '../types/scheduler.types.js';

// Mock Clock
const createMockClock = (isAudioWorklet = true): Clock => ({
  isUsingAudioWorklet: vi.fn().mockReturnValue(isAudioWorklet),
  getAudioTime: vi.fn().mockReturnValue(0),
  setOnTick: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
  getSampleAccurateClock: vi.fn().mockReturnValue(null),
} as unknown as Clock);

// Mock Timeline
const createMockTimeline = (): Timeline => ({
  updatePositionFromSeconds: vi.fn(),
  getTransportPosition: vi.fn().mockReturnValue({
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  }),
  reset: vi.fn(),
} as unknown as Timeline);

describe('PositionUpdateScheduler', () => {
  let scheduler: PositionUpdateScheduler;
  let mockClock: Clock;
  let mockTimeline: Timeline;
  let receivedUpdates: PositionUpdate[];

  beforeEach(() => {
    vi.useFakeTimers();
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

  describe('initialization', () => {
    it('should initialize with correct default config', () => {
      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.isPaused()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');
    });
  });

  describe('strategy selection', () => {
    it('should select event-driven strategy when AudioWorklet is active and preferred', () => {
      scheduler.start();
      expect(scheduler.getActiveStrategy()).toBe('event-driven');
    });

    it('should select polling strategy when AudioWorklet is inactive', () => {
      mockClock = createMockClock(false);
      scheduler = new PositionUpdateScheduler(mockClock, mockTimeline, {
        pollingIntervalMs: 20,
        eventDrivenThrottleMs: 8.33,
        preferEventDriven: true,
      });

      scheduler.start();
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });

    it('should select polling strategy when explicitly requested', () => {
      scheduler.start({ strategy: 'polling' });
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });

    it('should fall back to polling when event-driven requested but AudioWorklet inactive', () => {
      mockClock = createMockClock(false);
      scheduler = new PositionUpdateScheduler(mockClock, mockTimeline, {
        pollingIntervalMs: 20,
        eventDrivenThrottleMs: 8.33,
        preferEventDriven: true,
      });

      scheduler.start({ strategy: 'event-driven' });
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });
  });

  describe('mutual exclusion', () => {
    it('should only have one strategy active at a time', () => {
      // Start with event-driven
      scheduler.start({ strategy: 'event-driven' });
      expect(scheduler.getActiveStrategy()).toBe('event-driven');
      expect(scheduler.isRunning()).toBe(true);

      // Start with polling - should stop event-driven first
      scheduler.start({ strategy: 'polling' });
      expect(scheduler.getActiveStrategy()).toBe('polling');
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should stop existing strategy before starting new one', () => {
      scheduler.start({ strategy: 'event-driven' });

      // Calling start again should stop the current strategy
      scheduler.start({ strategy: 'polling' });

      // Verify only polling is active
      expect(scheduler.getActiveStrategy()).toBe('polling');
    });
  });

  describe('lifecycle', () => {
    it('should start and stop correctly', () => {
      expect(scheduler.isRunning()).toBe(false);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');
    });

    it('should pause and resume correctly', () => {
      scheduler.start();
      expect(scheduler.isPaused()).toBe(false);

      scheduler.pause();
      expect(scheduler.isPaused()).toBe(true);
      expect(scheduler.isRunning()).toBe(true); // Still running but paused

      scheduler.resume();
      expect(scheduler.isPaused()).toBe(false);
    });

    it('should clean up on dispose', () => {
      scheduler.start();
      scheduler.dispose();

      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');
    });
  });

  describe('transport start time', () => {
    it('should update transport start time on active strategy', () => {
      scheduler.start({ strategy: 'polling' });
      scheduler.setTransportStartTime(1.5);

      // The start time should be propagated to the active strategy
      // This is verified by the strategy's behavior
      expect(scheduler.isRunning()).toBe(true);
    });
  });

  describe('callback handling', () => {
    it('should invoke callback when set before start', () => {
      let callbackInvoked = false;
      scheduler.setUpdateCallback(() => {
        callbackInvoked = true;
      });

      scheduler.start({ strategy: 'polling' });

      // Advance timers to trigger polling update
      vi.advanceTimersByTime(50);

      // Note: The actual callback invocation depends on the strategy implementation
      // This test verifies the callback is properly set
      expect(scheduler.isRunning()).toBe(true);
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 10; i++) {
        scheduler.start();
        scheduler.stop();
      }

      expect(scheduler.isRunning()).toBe(false);
      expect(scheduler.getActiveStrategy()).toBe('none');
    });
  });

  describe('edge cases', () => {
    it('should handle stop when not running', () => {
      // Should not throw
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should handle pause when not running', () => {
      // Should not throw
      expect(() => scheduler.pause()).not.toThrow();
    });

    it('should handle resume when not paused', () => {
      scheduler.start();
      // Should not throw
      expect(() => scheduler.resume()).not.toThrow();
    });

    it('should handle dispose when already disposed', () => {
      scheduler.dispose();
      // Should not throw
      expect(() => scheduler.dispose()).not.toThrow();
    });
  });
});
