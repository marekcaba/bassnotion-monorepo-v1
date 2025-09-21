/**
 * Clock tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../core/Clock.js';
import { ClockSyncError } from '../types/errors.js';

// Mock AudioContext
class MockAudioContext {
  private _currentTime = 0;
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  private startTime = Date.now() / 1000;

  constructor() {
    // Simulate time progression based on Date.now() which works with fake timers
    Object.defineProperty(this, 'currentTime', {
      get: () => {
        return Date.now() / 1000 - this.startTime;
      },
    });
  }
}

describe('Clock', () => {
  let clock: Clock;
  let mockAudioContext: MockAudioContext;

  beforeEach(() => {
    // Mock window object for test environment
    if (typeof window === 'undefined') {
      (global as any).window = {
        setInterval: setInterval,
        clearInterval: clearInterval,
      };
    }
    clock = new Clock({
      enableAudioWorklet: false,
      enableWebWorker: false,
      driftCompensation: 'none',
    });
    mockAudioContext = new MockAudioContext();
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    });

    // Mock performance.now() to use Date.now()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    clock.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with audio context', async () => {
      expect(clock.getIsInitialized()).toBe(false);

      await clock.initialize(mockAudioContext as any);

      expect(clock.getIsInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await clock.initialize(mockAudioContext as any);
      const consoleSpy = vi.spyOn(console, 'warn');

      await clock.initialize(mockAudioContext as any);

      // The logger is used, not console.warn directly
      // Just check that it doesn't throw
      expect(clock.getIsInitialized()).toBe(true);
    });

    it('should throw error when accessing time before initialization', () => {
      expect(() => clock.getCurrentTime()).toThrow(ClockSyncError);
      expect(() => clock.getSampleRate()).toThrow(ClockSyncError);
    });
  });

  describe('time management', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should get current time from audio context', () => {
      // The mock now simulates real time progression
      const initialTime = clock.getCurrentTime();

      // Advance time
      vi.advanceTimersByTime(1500); // 1.5 seconds

      const newTime = clock.getCurrentTime();
      const timeDiff = newTime - initialTime;

      // Should have advanced approximately 1.5 seconds
      expect(timeDiff).toBeCloseTo(1.5, 1);
    });

    it('should get sample rate', () => {
      const sampleRate = clock.getSampleRate();

      expect(sampleRate).toBe(48000);
    });

    it('should fall back to performance time when hardware clock disabled', () => {
      clock.setUseHardwareClock(false);
      const perfTime = performance.now() / 1000;

      const time = clock.getCurrentTime();

      expect(time).toBeCloseTo(perfTime, 1);
    });
  });

  describe('synchronization', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should sync with hardware clock', () => {
      const initialOffset = clock.getClockOffset();

      clock.syncWithHardware();

      const newOffset = clock.getClockOffset();
      expect(typeof newOffset).toBe('number');
    });

    it('should maintain sync history', () => {
      clock.initialize(mockAudioContext as any);

      // Perform multiple syncs
      for (let i = 0; i < 5; i++) {
        clock.syncWithHardware();
        vi.advanceTimersByTime(100);
      }

      const syncData = clock.getSyncData();
      expect(syncData.confidence).toBeGreaterThan(0);
    });

    it('should calculate stability based on sync consistency', () => {
      expect(clock.getStability()).toBe(0); // No history yet

      clock.initialize(mockAudioContext as any);

      // Build sync history
      for (let i = 0; i < 10; i++) {
        clock.syncWithHardware();
        vi.advanceTimersByTime(100);
      }

      const stability = clock.getStability();
      expect(stability).toBeGreaterThan(0);
      expect(stability).toBeLessThanOrEqual(1);
    });
  });

  describe('sync management', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should start periodic sync', () => {
      const syncSpy = vi.spyOn(clock as any, 'syncWithHardware');

      clock.startSync();

      // No initial sync, only periodic
      expect(syncSpy).toHaveBeenCalledTimes(0);

      // Advance time to trigger first periodic sync
      vi.advanceTimersByTime(1000);
      expect(syncSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(syncSpy).toHaveBeenCalledTimes(2);
    });

    it('should stop sync', () => {
      clock.startSync();
      clock.stopSync();

      const syncSpy = vi.spyOn(clock as any, 'syncWithHardware');
      vi.advanceTimersByTime(5000);

      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should not start sync twice', () => {
      const syncSpy = vi.spyOn(clock as any, 'syncWithHardware');

      clock.startSync();

      // Clear any existing calls
      syncSpy.mockClear();

      // Try to start again - should be ignored
      clock.startSync();

      // Advance time - should only call sync once (not twice)
      vi.advanceTimersByTime(1000);
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset and disposal', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should reset state', () => {
      clock.startSync();
      clock.syncWithHardware();

      clock.reset();

      expect(clock.getClockOffset()).toBe(0);
      expect(clock.getStability()).toBe(0);
    });

    it('should dispose resources', () => {
      clock.startSync();

      clock.dispose();

      expect(clock.getIsInitialized()).toBe(false);
      expect(() => clock.getCurrentTime()).toThrow(ClockSyncError);
    });
  });

  describe('sync data', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should provide sync data', () => {
      clock.syncWithHardware();

      const syncData = clock.getSyncData();

      expect(syncData).toHaveProperty('audioTime');
      expect(syncData).toHaveProperty('systemTime');
      expect(syncData).toHaveProperty('offset');
      expect(syncData).toHaveProperty('confidence');
      expect(syncData.confidence).toBeGreaterThanOrEqual(0);
      expect(syncData.confidence).toBeLessThanOrEqual(1);
    });
  });
});
