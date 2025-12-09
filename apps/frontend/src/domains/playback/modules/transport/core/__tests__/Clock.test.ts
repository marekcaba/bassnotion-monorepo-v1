import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Clock } from '../Clock.js';
import type { SampleAccurateClock } from '../../sync/SampleAccurateClock.js';
import type { WorkerTimingManager } from '../../sync/WorkerTimingManager.js';

// Mock SampleAccurateClock
vi.mock('../../sync/SampleAccurateClock.js', () => {
  return {
    SampleAccurateClock: class MockSampleAccurateClock {
      private callbacks: Map<string, Function> = new Map();
      private _isActive = false;
      private _currentTime = 0;
      private _currentFrame = 0;
      private _updateCount = 0;
      private _lastUpdateTime = 0;
      private _isRunning = false;

      constructor(config: any) {}

      async initialize(audioContext: AudioContext) {
        this._isActive = true;
      }

      start() {
        this._isRunning = true;
      }

      stop() {
        this._isRunning = false;
        this._currentTime = 0;
        this._currentFrame = 0;
      }

      pause() {
        this._isRunning = false;
      }

      resume() {
        this._isRunning = true;
      }

      seek(seconds: number) {
        this._currentTime = seconds;
      }

      destroy() {
        this._isActive = false;
        this.callbacks.clear();
      }

      dispose() {
        this.destroy();
      }

      isActive() {
        return this._isActive;
      }

      getCurrentTime() {
        return this._currentTime;
      }

      getUpdateCount() {
        return this._updateCount;
      }

      getLastUpdateTime() {
        return this._lastUpdateTime;
      }

      getState() {
        return {
          isRunning: this._isRunning,
          currentTime: this._currentTime,
          currentFrame: this._currentFrame,
        };
      }

      getMetrics() {
        return {
          avgDrift: 0.5,
          maxDrift: 1.2,
          stability: 95,
          updateRate: 375,
        };
      }

      setOnTick(callback: Function) {
        this.callbacks.set('tick', callback);
      }

      setOnDrift(callback: Function) {
        this.callbacks.set('drift', callback);
      }

      // Test helper to simulate timing updates
      _simulateUpdate(time: number, frame: number) {
        this._currentTime = time;
        this._currentFrame = frame;
        this._updateCount++;
        this._lastUpdateTime = performance.now();

        const tickCallback = this.callbacks.get('tick');
        if (tickCallback) {
          tickCallback(time, frame);
        }
      }
    },
  };
});

// Mock WorkerTimingManager
vi.mock('../../sync/WorkerTimingManager.js', () => {
  return {
    WorkerTimingManager: class MockWorkerTimingManager {
      private callbacks: Map<string, Function> = new Map();
      private _isActive = false;
      private _currentTime = 0;
      private _isRunning = false;

      constructor(config: any) {}

      async initialize() {
        this._isActive = true;
      }

      start() {
        this._isRunning = true;
      }

      stop() {
        this._isRunning = false;
        this._currentTime = 0;
      }

      pause() {
        this._isRunning = false;
      }

      resume() {
        this._isRunning = true;
      }

      seek(seconds: number) {
        this._currentTime = seconds;
      }

      destroy() {
        this._isActive = false;
        this.callbacks.clear();
      }

      dispose() {
        this.destroy();
      }

      isActive() {
        return this._isActive;
      }

      getCurrentTime() {
        return this._currentTime;
      }

      getMetrics() {
        return {
          avgDrift: 1.5,
          maxDrift: 3.0,
          stability: 85,
          updateRate: 100,
        };
      }

      setOnTick(callback: Function) {
        this.callbacks.set('tick', callback);
      }

      // Test helper to simulate timing updates
      _simulateUpdate(time: number) {
        this._currentTime = time;

        const tickCallback = this.callbacks.get('tick');
        if (tickCallback) {
          tickCallback(time);
        }
      }
    },
  };
});

// Mock AudioContext
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  currentTime = 0;
  private stateChangeListeners: Function[] = [];

  async resume() {
    this.state = 'running';
    this.stateChangeListeners.forEach((listener) => listener());
    return Promise.resolve();
  }

  addEventListener(event: string, listener: Function) {
    if (event === 'statechange') {
      this.stateChangeListeners.push(listener);
    }
  }

  removeEventListener(event: string, listener: Function) {
    if (event === 'statechange') {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index !== -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    }
  }

  // Test helper to simulate state change
  _simulateStateChange(newState: 'suspended' | 'running' | 'closed') {
    this.state = newState;
    this.stateChangeListeners.forEach((listener) => listener());
  }
}

describe('Clock', () => {
  let clock: Clock;
  let mockAudioContext: MockAudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = new MockAudioContext();

    // Clear global window objects before each test
    if (typeof window !== 'undefined') {
      (window as any).__bassnotion_audioContext = undefined;
      (window as any).__persistentAudioContext = undefined;
    }
  });

  afterEach(() => {
    clock?.destroy();
  });

  describe('Construction and Configuration', () => {
    it('should create Clock with default config', () => {
      clock = new Clock();

      expect(clock).toBeDefined();
      expect(clock.getIsInitialized()).toBe(false);
    });

    it('should create Clock with custom config', () => {
      clock = new Clock({
        useAudioWorklet: true,
        useWebWorker: false,
        useHardwareClock: true,
        syncIntervalMs: 500,
        driftCompensation: 'basic',
      });

      expect(clock).toBeDefined();
      expect(clock.getIsInitialized()).toBe(false);
    });

    it('should handle legacy config options', () => {
      const legacyConfig = {
        enableAudioWorklet: true,
        enableWebWorker: false,
        driftCompensation: 'none' as any,
      };

      clock = new Clock(legacyConfig);

      expect(clock).toBeDefined();
    });

    it('should default to AudioWorklet enabled', () => {
      clock = new Clock({});

      expect(clock.isUsingAudioWorklet()).toBe(false); // Not active until initialized
    });

    it('should default to WebWorker disabled (FIGHTING CLOCKS FIX)', () => {
      clock = new Clock({});

      // WebWorker is disabled by default to prevent timing conflicts
      expect(clock).toBeDefined();
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      clock = new Clock({
        useAudioWorklet: true,
        useWebWorker: false,
      });
    });

    it('should initialize with running AudioContext', async () => {
      mockAudioContext.state = 'running';

      await clock.initialize(mockAudioContext as any);

      expect(clock.getIsInitialized()).toBe(true);
      expect(clock.isUsingAudioWorklet()).toBe(true);
    });

    it('should defer AudioWorklet initialization with suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';

      await clock.initialize(mockAudioContext as any);

      expect(clock.getIsInitialized()).toBe(true);
      expect(clock.isUsingAudioWorklet()).toBe(false); // Deferred until context resumes
    });

    it('should skip duplicate initialization', async () => {
      await clock.initialize(mockAudioContext as any);

      // Try to initialize again
      await clock.initialize(mockAudioContext as any);

      expect(clock.getIsInitialized()).toBe(true);
    });

    it('should set up statechange listener for deferred AudioWorklet init', async () => {
      mockAudioContext.state = 'suspended';

      await clock.initialize(mockAudioContext as any);

      expect(clock.isUsingAudioWorklet()).toBe(false);

      // Simulate context resuming
      mockAudioContext._simulateStateChange('running');

      // Give async initialization time to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clock.isUsingAudioWorklet()).toBe(true);
    });
  });

  describe('Timing Sources', () => {
    it('should report AudioWorklet mode when active', async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';

      await clock.initialize(mockAudioContext as any);

      // Simulate receiving updates
      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(1.5, 72000);

      const timeSource = clock.getCurrentTimeSource();
      expect(timeSource).toBe('AudioWorklet (active)');
    });

    it('should report fallback mode when AudioWorklet inactive', async () => {
      clock = new Clock({ useAudioWorklet: false, useWebWorker: false });

      await clock.initialize(mockAudioContext as any);

      const timeSource = clock.getCurrentTimeSource();
      expect(timeSource).toBe('AudioContext (fallback)');
    });

    it('should get metrics from AudioWorklet mode', async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';

      await clock.initialize(mockAudioContext as any);

      const metrics = clock.getMetrics();
      expect(metrics.mode).toBe('AudioWorklet');
      expect(metrics).toHaveProperty('avgDrift');
      expect(metrics).toHaveProperty('maxDrift');
      expect(metrics).toHaveProperty('stability');
      expect(metrics).toHaveProperty('sampleRate');
    });

    it('should get metrics from Basic mode', async () => {
      clock = new Clock({ useAudioWorklet: false, useWebWorker: false });

      await clock.initialize(mockAudioContext as any);

      const metrics = clock.getMetrics();
      expect(metrics.mode).toBe('Basic');
      expect(metrics).toHaveProperty('avgDrift');
      expect(metrics).toHaveProperty('maxDrift');
      expect(metrics).toHaveProperty('stability');
    });
  });

  describe('State Control', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should start timing updates', () => {
      expect(() => clock.start()).not.toThrow();

      const sampleClock = clock.getSampleAccurateClock() as any;
      expect(sampleClock.getState().isRunning).toBe(true);
    });

    it('should stop timing updates', () => {
      clock.start();

      clock.stop();

      const sampleClock = clock.getSampleAccurateClock() as any;
      expect(sampleClock.getState().isRunning).toBe(false);
    });

    it('should pause timing updates', () => {
      clock.start();

      clock.pause();

      const sampleClock = clock.getSampleAccurateClock() as any;
      expect(sampleClock.getState().isRunning).toBe(false);
    });

    it('should resume timing updates', () => {
      clock.start();
      clock.pause();

      clock.resume();

      const sampleClock = clock.getSampleAccurateClock() as any;
      expect(sampleClock.getState().isRunning).toBe(true);
    });
  });

  describe('Seeking', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should seek in AudioWorklet mode', () => {
      clock.seek(5.0);

      const sampleClock = clock.getSampleAccurateClock() as any;
      expect(sampleClock.getCurrentTime()).toBe(5.0);
    });

    it('should seek in Basic mode', async () => {
      clock.destroy();

      clock = new Clock({ useAudioWorklet: false, useWebWorker: false });
      await clock.initialize(mockAudioContext as any);

      expect(() => clock.seek(5.0)).not.toThrow();
    });
  });

  describe('onTick Callbacks', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should register onTick callback', () => {
      const onTickSpy = vi.fn();

      clock.setOnTick(onTickSpy);

      // Simulate timing update from underlying clock
      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(1.5, 72000);

      expect(onTickSpy).toHaveBeenCalledWith(1.5);
    });

    it('should invoke onTick callback on each timing update', () => {
      const onTickSpy = vi.fn();
      clock.setOnTick(onTickSpy);

      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(0.5, 24000);
      sampleClock._simulateUpdate(1.0, 48000);
      sampleClock._simulateUpdate(1.5, 72000);

      expect(onTickSpy).toHaveBeenCalledTimes(3);
      expect(onTickSpy).toHaveBeenNthCalledWith(1, 0.5);
      expect(onTickSpy).toHaveBeenNthCalledWith(2, 1.0);
      expect(onTickSpy).toHaveBeenNthCalledWith(3, 1.5);
    });
  });

  describe('Time Retrieval', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should get current time from AudioWorklet', () => {
      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(2.5, 120000);

      const currentTime = clock.getCurrentTime();
      expect(currentTime).toBe(2.5);
    });

    it('should get audio time from AudioWorklet', () => {
      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(3.0, 144000);

      const audioTime = clock.getAudioTime();
      expect(audioTime).toBe(3.0);
    });

    it('should fallback to AudioContext when AudioWorklet stuck', () => {
      mockAudioContext.currentTime = 5.0;

      // Don't simulate any updates - worklet appears stuck
      const audioTime = clock.getAudioTime();

      // Should fallback to AudioContext.currentTime
      expect(audioTime).toBe(5.0);
    });

    it('should get raw AudioContext time', () => {
      mockAudioContext.currentTime = 7.5;

      const rawTime = clock.getRawAudioTime();
      expect(rawTime).toBe(7.5);
    });

    it('should get hardware time', () => {
      const hardwareTime = clock.getHardwareTime();

      expect(hardwareTime).toBeGreaterThan(0);
      expect(typeof hardwareTime).toBe('number');
    });

    it('should get sample rate', () => {
      const sampleRate = clock.getSampleRate();

      expect(sampleRate).toBe(48000);
    });
  });

  describe('Reinitialization', () => {
    beforeEach(() => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
    });

    it('should reinitialize with newer AudioContext', async () => {
      // Initialize with suspended context
      mockAudioContext.state = 'suspended';
      await clock.initialize(mockAudioContext as any);

      expect(clock.isUsingAudioWorklet()).toBe(false);

      // Create a newer running context and set it globally
      const newerContext = new MockAudioContext();
      newerContext.state = 'running';
      (window as any).__bassnotion_audioContext = newerContext;

      // Reinitialize
      await clock.reinitializeIfNeeded();

      expect(clock.isUsingAudioWorklet()).toBe(true);
    });

    it('should detect newer context from __persistentAudioContext', async () => {
      mockAudioContext.state = 'suspended';
      await clock.initialize(mockAudioContext as any);

      const newerContext = new MockAudioContext();
      newerContext.state = 'running';
      (window as any).__persistentAudioContext = newerContext;

      await clock.reinitializeIfNeeded();

      expect(clock.isUsingAudioWorklet()).toBe(true);
    });

    it('should not reinitialize if already using AudioWorklet', async () => {
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);

      expect(clock.isUsingAudioWorklet()).toBe(true);

      // Try to reinitialize
      await clock.reinitializeIfNeeded();

      // Should still be using AudioWorklet (no duplicate initialization)
      expect(clock.isUsingAudioWorklet()).toBe(true);
    });
  });

  describe('Legacy Clock Sync', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: false, useWebWorker: false });
      await clock.initialize(mockAudioContext as any);
    });

    it('should start clock sync in Basic mode', () => {
      expect(() => clock.startSync()).not.toThrow();
    });

    it('should stop clock sync', () => {
      clock.startSync();

      expect(() => clock.stopSync()).not.toThrow();
    });

    it('should not start sync if AudioWorklet active', async () => {
      clock.destroy();

      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);

      expect(() => clock.startSync()).not.toThrow();
      // Should be no-op since AudioWorklet handles timing
    });

    it('should sync with hardware clock', () => {
      expect(() => clock.syncWithHardware()).not.toThrow();
    });

    it('should calculate clock offset', () => {
      clock.syncWithHardware();

      const offset = clock.calculateClockOffset();
      expect(typeof offset).toBe('number');
    });

    it('should get clock offset (alias)', () => {
      clock.syncWithHardware();

      const offset = clock.getClockOffset();
      expect(typeof offset).toBe('number');
    });

    it('should get sync data', () => {
      clock.syncWithHardware();

      const syncData = clock.getSyncData();
      expect(syncData).toHaveProperty('audioTime');
      expect(syncData).toHaveProperty('systemTime');
      expect(syncData).toHaveProperty('offset');
      expect(syncData).toHaveProperty('confidence');
    });

    it('should calculate stability metric', () => {
      const stability = clock.getStability();

      expect(typeof stability).toBe('number');
      expect(stability).toBeGreaterThanOrEqual(0);
      expect(stability).toBeLessThanOrEqual(1);
    });
  });

  describe('Configuration', () => {
    it('should set use hardware clock', async () => {
      clock = new Clock({ useHardwareClock: true });
      await clock.initialize(mockAudioContext as any);

      clock.setUseHardwareClock(false);

      // Should now use performance.now() instead
      const time = clock.getCurrentTime();
      expect(typeof time).toBe('number');
    });

    it('should start periodic sync', async () => {
      clock = new Clock({ useAudioWorklet: false, useWebWorker: false });
      await clock.initialize(mockAudioContext as any);

      expect(() => clock.startPeriodicSync()).not.toThrow();

      // Should be idempotent
      expect(() => clock.startPeriodicSync()).not.toThrow();

      clock.stopSync();
    });
  });

  describe('Reset', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should reset clock state', () => {
      const sampleClock = clock.getSampleAccurateClock() as any;
      sampleClock._simulateUpdate(5.0, 240000);

      clock.reset();

      // Internal state should be reset to 0
      // (Note: We can't directly check private properties, but reset shouldn't throw)
      expect(() => clock.reset()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'running';
      await clock.initialize(mockAudioContext as any);
    });

    it('should dispose resources', () => {
      expect(() => clock.dispose()).not.toThrow();

      expect(clock.getIsInitialized()).toBe(false);
    });

    it('should destroy clock', () => {
      expect(() => clock.destroy()).not.toThrow();

      expect(clock.isUsingAudioWorklet()).toBe(false);
      expect(clock.getIsInitialized()).toBe(false);
    });

    it('should clean up underlying SampleAccurateClock', () => {
      const sampleClock = clock.getSampleAccurateClock();
      expect(sampleClock).not.toBeNull();

      clock.destroy();

      expect(clock.getSampleAccurateClock()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle getCurrentTime before initialization', () => {
      clock = new Clock({ useAudioWorklet: false });

      expect(() => clock.getCurrentTime()).toThrow('AudioContext not initialized');
    });

    it('should handle getAudioTime before initialization', () => {
      clock = new Clock({ useAudioWorklet: false });

      expect(() => clock.getAudioTime()).toThrow('AudioContext not initialized');
    });

    it('should handle getSampleRate before initialization', () => {
      clock = new Clock({ useAudioWorklet: false });

      expect(() => clock.getSampleRate()).toThrow('AudioContext not initialized');
    });

    it('should handle getRawAudioTime before initialization', () => {
      clock = new Clock({ useAudioWorklet: false });

      expect(() => clock.getRawAudioTime()).toThrow('AudioContext not initialized');
    });

    it('should handle getHardwareTime before initialization', () => {
      clock = new Clock({ useAudioWorklet: false });

      expect(() => clock.getHardwareTime()).toThrow('AudioContext not initialized');
    });

    it('should handle operations on uninitialized clock gracefully', () => {
      clock = new Clock({ useAudioWorklet: true });

      expect(() => clock.start()).not.toThrow();
      expect(() => clock.stop()).not.toThrow();
      expect(() => clock.pause()).not.toThrow();
      expect(() => clock.resume()).not.toThrow();
      expect(() => clock.seek(5.0)).not.toThrow();
    });

    it('should handle context state change to closed', async () => {
      clock = new Clock({ useAudioWorklet: true });
      await clock.initialize(mockAudioContext as any);

      mockAudioContext._simulateStateChange('closed');

      // Should handle gracefully
      expect(clock.getIsInitialized()).toBe(true);
    });
  });

  describe('Integration - AudioContext State Transitions', () => {
    it('should upgrade from Basic to AudioWorklet when context resumes', async () => {
      clock = new Clock({ useAudioWorklet: true, useWebWorker: false });
      mockAudioContext.state = 'suspended';

      await clock.initialize(mockAudioContext as any);

      expect(clock.isUsingAudioWorklet()).toBe(false);
      expect(clock.getCurrentTimeSource()).toBe('AudioContext (fallback)');

      // Simulate user interaction causing context to resume
      mockAudioContext._simulateStateChange('running');

      // Give async initialization time to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(clock.isUsingAudioWorklet()).toBe(true);
      const timeSource = clock.getCurrentTimeSource();
      expect(timeSource).toContain('AudioWorklet');
    });
  });
});
