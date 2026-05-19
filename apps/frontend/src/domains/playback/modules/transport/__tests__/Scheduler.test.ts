/**
 * Scheduler tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scheduler, SchedulerConfig } from '../core/Scheduler.js';
import { SchedulingError } from '../types/errors.js';
import * as Tone from 'tone';

// Mock Tone.js Transport
vi.mock('tone', () => {
  const scheduledCallbacks = new Map<
    number,
    { callback: Function; time: number }
  >();
  let scheduleIdCounter = 0;
  let transportState = 'stopped';
  let currentTime = 0;

  const Transport = {
    schedule: vi.fn((callback: Function, time: number) => {
      const id = ++scheduleIdCounter;
      scheduledCallbacks.set(id, { callback, time });
      return id;
    }),
    scheduleRepeat: vi.fn(
      (callback: Function, interval: string | number, startTime?: number) => {
        const id = ++scheduleIdCounter;
        scheduledCallbacks.set(id, { callback, time: startTime || 0 });
        return id;
      },
    ),
    clear: vi.fn((id: number) => {
      scheduledCallbacks.delete(id);
    }),
    get state() {
      return transportState;
    },
    set state(value: string) {
      transportState = value;
    },
    get seconds() {
      return currentTime;
    },
    set seconds(value: number) {
      currentTime = value;
    },
    _reset: () => {
      scheduledCallbacks.clear();
      scheduleIdCounter = 0;
      transportState = 'stopped';
      currentTime = 0;
    },
    _getScheduled: () => scheduledCallbacks,
  };

  return { Transport, getTransport: () => Transport };
});

describe('Scheduler', () => {
  let scheduler: Scheduler;
  const config: SchedulerConfig = {
    lookAheadTime: 0.1, // 100ms
    scheduleInterval: 0.025, // 25ms
    maxQueueSize: 1000,
  };

  beforeEach(() => {
    scheduler = new Scheduler(config);
    vi.useFakeTimers();
    (Tone.Transport as any)._reset();
    // Production Scheduler reads Tone from `window.Tone` (via the
    // internal getTone() helper). The vi.mock('tone') sets up the
    // mocked Transport for the imported `Tone` here, but production
    // never imports the npm module — so spies on Tone.Transport.*
    // never fire. Mirror our test-mocked Transport onto window.Tone
    // under BOTH the legacy `Transport` singleton AND the v15
    // `getTransport()` factory accessor so spies fire regardless of
    // which API production walks. setup.ts's default window.Tone is
    // preserved for anything else (Gain, Volume, etc).
    if (typeof window !== 'undefined') {
      const existingWindowTone = (window as any).Tone || {};
      const mockedTransport = (Tone as any).Transport;
      (window as any).Tone = {
        ...existingWindowTone,
        Transport: mockedTransport,
        getTransport: () => mockedTransport,
      };
    }
  });

  afterEach(() => {
    scheduler.reset();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create scheduler with config', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.getPendingCount()).toBe(0);
      expect(scheduler.getScheduledCount()).toBe(0);
    });
  });

  describe('event scheduling', () => {
    it('should schedule a single event', () => {
      const callback = vi.fn();
      const eventId = scheduler.scheduleEvent({
        time: 1.0,
        callback,
        priority: 'normal',
      });

      expect(eventId).toMatch(/^event_\d+$/);
      expect(scheduler.getPendingCount()).toBe(1);
    });

    it('should maintain events sorted by time', () => {
      const callback = vi.fn();

      scheduler.scheduleEvent({ time: 2.0, callback, priority: 'normal' });
      scheduler.scheduleEvent({ time: 1.0, callback, priority: 'normal' });
      scheduler.scheduleEvent({ time: 1.5, callback, priority: 'normal' });

      expect(scheduler.getPendingCount()).toBe(3);
      // Events should be internally sorted by time
    });

    it('should respect queue size limit', () => {
      const smallScheduler = new Scheduler({ ...config, maxQueueSize: 2 });
      const callback = vi.fn();

      smallScheduler.scheduleEvent({ time: 1.0, callback, priority: 'normal' });
      smallScheduler.scheduleEvent({ time: 2.0, callback, priority: 'normal' });

      expect(() => {
        smallScheduler.scheduleEvent({
          time: 3.0,
          callback,
          priority: 'normal',
        });
      }).toThrow(SchedulingError);
    });

    it('should schedule repeating events', () => {
      const callback = vi.fn();
      const eventId = scheduler.scheduleRepeat(callback, '4n', 0);

      expect(eventId).toMatch(/^repeat_\d+$/);
      expect(scheduler.getScheduledCount()).toBe(1);
      expect(Tone.Transport.scheduleRepeat).toHaveBeenCalledWith(
        expect.any(Function),
        '4n',
        0,
      );
    });
  });

  describe('event cancellation', () => {
    it('should cancel a pending event', () => {
      const callback = vi.fn();
      const eventId = scheduler.scheduleEvent({
        time: 1.0,
        callback,
        priority: 'normal',
      });

      scheduler.cancelEvent(eventId);
      expect(scheduler.getPendingCount()).toBe(0);
    });

    it('should cancel a scheduled event', () => {
      const callback = vi.fn();
      scheduler.start();
      (Tone.Transport as any).state = 'started';

      const eventId = scheduler.scheduleEvent({
        time: 0.05, // Within lookahead
        callback,
        priority: 'normal',
      });

      // Trigger scheduling
      vi.advanceTimersByTime(1);

      scheduler.cancelEvent(eventId);
      expect(Tone.Transport.clear).toHaveBeenCalled();
    });

    it('should clear all events', () => {
      const callback = vi.fn();

      scheduler.scheduleEvent({ time: 1.0, callback, priority: 'normal' });
      scheduler.scheduleEvent({ time: 2.0, callback, priority: 'normal' });
      scheduler.scheduleRepeat(callback, '4n');

      scheduler.clearAllScheduledEvents();

      expect(scheduler.getPendingCount()).toBe(0);
      expect(scheduler.getScheduledCount()).toBe(0);
    });
  });

  describe('scheduler lifecycle', () => {
    it('should start and stop', () => {
      expect(scheduler.getStats().isRunning).toBe(false);

      scheduler.start();
      expect(scheduler.getStats().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStats().isRunning).toBe(false);
    });

    it('should not start twice', () => {
      scheduler.start();
      const consoleSpy = vi.spyOn(console, 'warn');

      scheduler.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already running'),
      );
    });

    it('should process events when running', () => {
      const callback = vi.fn();
      scheduler.start();
      (Tone.Transport as any).state = 'started';
      (Tone.Transport as any).seconds = 0;

      // Schedule event within lookahead
      scheduler.scheduleEvent({
        time: 0.05,
        callback,
        priority: 'normal',
      });

      // Advance time to trigger processing
      vi.advanceTimersByTime(25);

      expect(Tone.Transport.schedule).toHaveBeenCalled();
      expect(scheduler.getScheduledCount()).toBe(1);
    });
  });

  describe('priority handling', () => {
    it('should process high priority events first', () => {
      const callbacks: string[] = [];
      scheduler.start();
      (Tone.Transport as any).state = 'started';

      // Schedule events at same time with different priorities
      scheduler.scheduleEvent({
        time: 0.05,
        callback: () => callbacks.push('low'),
        priority: 'low',
      });
      scheduler.scheduleEvent({
        time: 0.05,
        callback: () => callbacks.push('high'),
        priority: 'high',
      });
      scheduler.scheduleEvent({
        time: 0.05,
        callback: () => callbacks.push('normal'),
        priority: 'normal',
      });

      // Events should be scheduled in priority order
      vi.advanceTimersByTime(25);

      // Check that high priority was scheduled first
      const scheduled = (Tone.Transport as any)._getScheduled();
      expect(scheduled.size).toBe(3);
    });
  });

  describe('utility methods', () => {
    it('should schedule once', () => {
      const callback = vi.fn();
      const eventId = scheduler.scheduleOnce(callback, 1.5);

      expect(eventId).toBeDefined();
      expect(scheduler.getPendingCount()).toBe(1);
    });

    it('should schedule immediate', () => {
      const callback = vi.fn();
      (Tone.Transport as any).seconds = 1.0;

      const eventId = scheduler.scheduleImmediate(callback);

      expect(eventId).toBeDefined();
      expect(scheduler.getPendingCount()).toBe(1);
      // Should be scheduled slightly in the future
    });

    it('should provide statistics', () => {
      const callback = vi.fn();
      scheduler.scheduleEvent({ time: 1.0, callback, priority: 'normal' });
      scheduler.scheduleRepeat(callback, '4n');

      const stats = scheduler.getStats();

      expect(stats).toEqual({
        queueLength: 1,
        scheduledCount: 1,
        scheduledUntil: 0,
        isRunning: false,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle past events', () => {
      const callback = vi.fn();
      scheduler.start();
      (Tone.Transport as any).state = 'started';
      (Tone.Transport as any).seconds = 2.0;

      // Schedule event in the past
      scheduler.scheduleEvent({
        time: 1.0,
        callback,
        priority: 'normal',
      });

      // Process queue
      vi.advanceTimersByTime(25);

      // Past events should be removed
      expect(scheduler.getPendingCount()).toBe(0);
    });

    it('should handle callback errors', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      scheduler.start();
      (Tone.Transport as any).state = 'started';

      scheduler.scheduleEvent({
        time: 0.05,
        callback: errorCallback,
        priority: 'normal',
      });

      // Should not throw when processing
      expect(() => {
        vi.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const callback = vi.fn();

      scheduler.start();
      scheduler.scheduleEvent({ time: 1.0, callback, priority: 'normal' });
      scheduler.scheduleRepeat(callback, '4n');

      scheduler.reset();

      expect(scheduler.getStats()).toEqual({
        queueLength: 0,
        scheduledCount: 0,
        scheduledUntil: 0,
        isRunning: false,
      });
    });
  });
});
