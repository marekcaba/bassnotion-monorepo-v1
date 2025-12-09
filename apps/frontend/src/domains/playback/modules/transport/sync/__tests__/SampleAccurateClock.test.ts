import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SampleAccurateClock } from '../SampleAccurateClock.js';
import type { TimingUpdate } from '../../worklets/AudioWorkletManager.js';

// Mock AudioWorkletManager
vi.mock('../../worklets/AudioWorkletManager.js', () => {
  return {
    AudioWorkletManager: class MockAudioWorkletManager {
      private callbacks: Map<string, Function> = new Map();
      private _isActive = false;

      constructor(config: any) {}

      async initialize(audioContext: AudioContext) {
        this._isActive = true;
      }

      start(fromFrame?: number) {
        this._isActive = true;
      }

      stop() {
        this._isActive = false;
      }

      pause() {}

      seek(seconds: number) {}

      destroy() {
        this._isActive = false;
        this.callbacks.clear();
      }

      isActive() {
        return this._isActive;
      }

      on(event: string, callback: Function) {
        this.callbacks.set(event, callback);
      }

      updateConfig(config: any) {}

      // Test helper to simulate timing updates
      _simulateTimingUpdate(update: TimingUpdate) {
        const callback = this.callbacks.get('timing-update');
        if (callback) {
          callback(update);
        }
      }

      // Test helper to simulate warning
      _simulateWarning(warning: any) {
        const callback = this.callbacks.get('timing-warning');
        if (callback) {
          callback(warning);
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

  async resume() {
    this.state = 'running';
  }
}

describe('SampleAccurateClock', () => {
  let clock: SampleAccurateClock;
  let mockAudioContext: MockAudioContext;

  beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    clock = new SampleAccurateClock({
      updateInterval: 0.00267,
      lookAheadTime: 0.2,
      driftThreshold: 1,
    });
  });

  afterEach(() => {
    clock.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with AudioContext', async () => {
      await clock.initialize(mockAudioContext as any);

      expect(clock.isActive()).toBe(true);
    });

    it('should not start timing updates until start() is called', async () => {
      await clock.initialize(mockAudioContext as any);

      const currentTime = clock.getCurrentTime();
      expect(currentTime).toBe(0);
    });
  });

  describe('State Transitions', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should transition from stopped → playing', () => {
      const state1 = clock.getState();
      expect(state1.isRunning).toBe(false);

      clock.start();

      const state2 = clock.getState();
      expect(state2.isRunning).toBe(true);
    });

    it('should transition from playing → paused', () => {
      clock.start();
      expect(clock.getState().isRunning).toBe(true);

      clock.pause();

      const state = clock.getState();
      expect(state.isRunning).toBe(false);
    });

    it('should transition from paused → playing (resume)', () => {
      clock.start();
      clock.pause();
      expect(clock.getState().isRunning).toBe(false);

      clock.resume();

      expect(clock.getState().isRunning).toBe(true);
    });

    it('should transition from playing → stopped', () => {
      clock.start();
      expect(clock.getState().isRunning).toBe(true);

      clock.stop();

      const state = clock.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.currentFrame).toBe(0);
    });
  });

  describe('Idempotent Operations', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should handle multiple start() calls gracefully', () => {
      clock.start();
      const state1 = clock.getState();

      clock.start(); // Second call should be no-op

      const state2 = clock.getState();
      expect(state2.isRunning).toBe(true);
      expect(state2.currentTime).toBe(state1.currentTime);
    });

    it('should handle multiple stop() calls gracefully', () => {
      clock.start();
      clock.stop();

      clock.stop(); // Second call should be no-op

      const state = clock.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
    });

    it('should handle multiple pause() calls gracefully', () => {
      clock.start();
      clock.pause();

      clock.pause(); // Second call should be no-op

      expect(clock.getState().isRunning).toBe(false);
    });
  });

  describe('waitForFirstUpdate()', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should resolve when first update is received', async () => {
      clock.start();

      // Simulate timing update after 50ms
      setTimeout(() => {
        const manager = (clock as any).workletManager;
        manager._simulateTimingUpdate({
          time: 0.002667,
          audioContextTime: 0.032,
          frame: 128,
          playbackFrame: 128,
          isPlaying: true,
          updateCount: 1,
        });
      }, 50);

      await expect(clock.waitForFirstUpdate(200)).resolves.toBeUndefined();
      expect(clock.getUpdateCount()).toBe(1);
    });

    it('should timeout if no update received within timeout period', async () => {
      clock.start();

      await expect(clock.waitForFirstUpdate(50)).rejects.toThrow(
        'AudioWorklet first update timeout after 50ms'
      );
    });

    it('should return immediately if updates already received', async () => {
      clock.start();

      // Simulate first update
      const manager = (clock as any).workletManager;
      manager._simulateTimingUpdate({
        time: 0.002667,
        audioContextTime: 0.032,
        frame: 128,
        playbackFrame: 128,
        isPlaying: true,
        updateCount: 1,
      });

      // Should resolve immediately
      const startTime = performance.now();
      await clock.waitForFirstUpdate(200);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(10); // Should be near-instant
    });
  });

  describe('Timing Update Handling', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
      clock.start();
    });

    it('should update state when receiving timing updates', () => {
      const manager = (clock as any).workletManager;

      manager._simulateTimingUpdate({
        time: 0.002667,
        audioContextTime: 0.032,
        frame: 128,
        playbackFrame: 128,
        isPlaying: true,
        updateCount: 1,
      });

      const state = clock.getState();
      expect(state.currentTime).toBe(0.002667);
      expect(state.currentFrame).toBe(128);
      expect(state.updateCount).toBe(1);
    });

    it('should emit onTick callback when update received', () => {
      const onTickSpy = vi.fn();
      clock.setOnTick(onTickSpy);

      const manager = (clock as any).workletManager;
      manager._simulateTimingUpdate({
        time: 0.002667,
        audioContextTime: 0.032,
        frame: 128,
        playbackFrame: 128,
        isPlaying: true,
        updateCount: 1,
      });

      expect(onTickSpy).toHaveBeenCalledWith(0.002667, 128);
    });
  });

  describe('Drift Tracking', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
      clock.start();
    });

    it('should track drift history', () => {
      const manager = (clock as any).workletManager;
      const onDriftSpy = vi.fn();
      clock.setOnDrift(onDriftSpy);

      // First update (no drift calculated)
      manager._simulateTimingUpdate({
        time: 0.002667,
        audioContextTime: 0.032,
        frame: 128,
        playbackFrame: 128,
        isPlaying: true,
        updateCount: 1,
      });

      // Wait for interval to pass
      const now = performance.now();
      while (performance.now() - now < 10) {} // 10ms delay

      // Second update (drift will be > threshold due to 10ms delay)
      manager._simulateTimingUpdate({
        time: 0.005333,
        audioContextTime: 0.042,
        frame: 256,
        playbackFrame: 256,
        isPlaying: true,
        updateCount: 2,
      });

      const avgDrift = clock.getAverageDrift();
      const maxDrift = clock.getMaxDrift();

      expect(avgDrift).toBeGreaterThan(0);
      expect(maxDrift).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should return timing metrics', () => {
      const metrics = clock.getMetrics();

      expect(metrics).toHaveProperty('avgDrift');
      expect(metrics).toHaveProperty('maxDrift');
      expect(metrics).toHaveProperty('stability');
      expect(metrics).toHaveProperty('updateRate');

      expect(metrics.updateRate).toBeCloseTo(1 / 0.00267, 1);
    });

    it('should report 100% stability with zero drift', () => {
      const metrics = clock.getMetrics();

      expect(metrics.stability).toBe(100);
      expect(metrics.avgDrift).toBe(0);
      expect(metrics.maxDrift).toBe(0);
    });
  });

  describe('Seek', () => {
    beforeEach(async () => {
      await clock.initialize(mockAudioContext as any);
    });

    it('should call seek on worklet manager', () => {
      clock.seek(5.0);

      // Seek delegates to AudioWorkletManager
      // The actual time update comes from the worklet via timing updates
      // So we just verify the method doesn't throw
      expect(clock.getCurrentTime()).toBe(0); // Not updated until timing update received
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy()', async () => {
      await clock.initialize(mockAudioContext as any);
      clock.start();

      clock.destroy();

      expect(clock.isActive()).toBe(false);
    });

    it('should clear callbacks on destroy()', async () => {
      const onTickSpy = vi.fn();
      const onDriftSpy = vi.fn();

      await clock.initialize(mockAudioContext as any);
      clock.setOnTick(onTickSpy);
      clock.setOnDrift(onDriftSpy);
      clock.start();

      clock.destroy();

      // Simulate update after destroy
      const manager = (clock as any).workletManager;
      manager?._simulateTimingUpdate?.({
        time: 0.002667,
        audioContextTime: 0.032,
        frame: 128,
        playbackFrame: 128,
        isPlaying: true,
        updateCount: 1,
      });

      // Callbacks should not be called
      expect(onTickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle initialization with suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended';

      await clock.initialize(mockAudioContext as any);

      // The clock initializes successfully even with suspended context
      // The actual resume happens when user interacts with the page
      expect(clock.isActive()).toBe(true);
    });

    it('should handle start before initialization gracefully', () => {
      expect(() => clock.start()).not.toThrow();
    });

    it('should handle pause when not playing', async () => {
      await clock.initialize(mockAudioContext as any);

      expect(() => clock.pause()).not.toThrow();
    });

    it('should handle resume when not paused', async () => {
      await clock.initialize(mockAudioContext as any);

      expect(() => clock.resume()).not.toThrow();
    });
  });
});
