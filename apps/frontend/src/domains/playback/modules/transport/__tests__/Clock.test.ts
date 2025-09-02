/**
 * Clock tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../core/Clock.js';
import { ClockSyncError } from '../types/errors.js';

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;

  constructor() {
    // Simulate time progression
    setInterval(() => {
      this.currentTime += 0.001;
    }, 1);
  }
}

describe('Clock', () => {
  let clock: Clock;
  let mockAudioContext: MockAudioContext;

  beforeEach(() => {
    clock = new Clock();
    mockAudioContext = new MockAudioContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clock.dispose();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with audio context', () => {
      expect(clock.isInitialized()).toBe(false);
      
      clock.initialize(mockAudioContext as any);
      
      expect(clock.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      clock.initialize(mockAudioContext as any);
      const consoleSpy = vi.spyOn(console, 'warn');
      
      clock.initialize(mockAudioContext as any);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
    });

    it('should throw error when accessing time before initialization', () => {
      expect(() => clock.getCurrentTime()).toThrow(ClockSyncError);
      expect(() => clock.getSampleRate()).toThrow(ClockSyncError);
    });
  });

  describe('time management', () => {
    beforeEach(() => {
      clock.initialize(mockAudioContext as any);
    });

    it('should get current time from audio context', () => {
      mockAudioContext.currentTime = 1.5;
      
      const time = clock.getCurrentTime();
      
      expect(time).toBeCloseTo(1.5, 2);
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
    beforeEach(() => {
      clock.initialize(mockAudioContext as any);
    });

    it('should sync with hardware clock', () => {
      const initialOffset = clock.getClockOffset();
      
      clock.syncWithHardware();
      
      const newOffset = clock.getClockOffset();
      expect(typeof newOffset).toBe('number');
    });

    it('should maintain sync history', () => {
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
    beforeEach(() => {
      clock.initialize(mockAudioContext as any);
    });

    it('should start periodic sync', () => {
      const syncSpy = vi.spyOn(clock as any, 'syncWithHardware');
      
      clock.startSync();
      
      // Initial sync
      expect(syncSpy).toHaveBeenCalledTimes(1);
      
      // Advance time to trigger periodic sync
      vi.advanceTimersByTime(1000);
      expect(syncSpy).toHaveBeenCalledTimes(2);
      
      vi.advanceTimersByTime(1000);
      expect(syncSpy).toHaveBeenCalledTimes(3);
    });

    it('should stop sync', () => {
      clock.startSync();
      clock.stopSync();
      
      const syncSpy = vi.spyOn(clock as any, 'syncWithHardware');
      vi.advanceTimersByTime(5000);
      
      expect(syncSpy).not.toHaveBeenCalled();
    });

    it('should not start sync twice', () => {
      clock.startSync();
      const consoleSpy = vi.spyOn(console, 'warn');
      
      clock.startSync();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));
    });
  });

  describe('reset and disposal', () => {
    beforeEach(() => {
      clock.initialize(mockAudioContext as any);
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
      
      expect(clock.isInitialized()).toBe(false);
      expect(() => clock.getCurrentTime()).toThrow(ClockSyncError);
    });
  });

  describe('sync data', () => {
    beforeEach(() => {
      clock.initialize(mockAudioContext as any);
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