import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportController } from '../TransportController.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { AudioEngine } from '../../../../services/core/AudioEngine.js';
import * as Tone from 'tone';

// Mock Tone.js FIRST (before other mocks that reference it)
// Use factory function to avoid hoisting issues
vi.mock('tone', () => ({
  Transport: {
    state: 'stopped',
    position: 0,
    seconds: 0,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    start: vi.fn(function () {
      this.state = 'started';
    }),
    stop: vi.fn(function () {
      this.state = 'stopped';
    }),
    pause: vi.fn(function () {
      this.state = 'paused';
    }),
  },
}));

// Mock dependencies
vi.mock('../Transport.js', () => {
  return {
    Transport: class MockTransport {
      private callbacks: Map<string, Function> = new Map();
      private _currentTime = 0;
      private _isRunning = false;
      private _timeline: any = {
        getExerciseDurationSeconds: () => 0,
        getExerciseDurationBeats: () => 0,
        setExerciseDuration: vi.fn(),
        updatePositionFromSeconds: vi.fn(),
        getTransportPosition: vi.fn().mockReturnValue({
          bars: 0,
          beats: 0,
          sixteenths: 0,
          ticks: 0,
        }),
        reset: vi.fn(),
      };
      private _clock: any = {
        setOnTick: vi.fn((callback: Function) => {
          this._tickCallback = callback;
        }),
        isUsingAudioWorklet: vi.fn().mockReturnValue(false),
        getAudioTime: vi.fn().mockReturnValue(0),
        start: vi.fn(),
        stop: vi.fn(),
      };
      private _tickCallback: Function | null = null;

      constructor(config: any) {}

      async initialize(audioContext: any) {}

      start(options?: any) {
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

      setTransportStartTime(time: number) {}

      setCountdownOffset(duration: number) {}

      updateConfig(config: any) {}

      getCurrentTime() {
        return this._currentTime;
      }

      getMetrics() {
        return {
          avgDrift: 0.5,
          maxDrift: 1.0,
          stability: 95,
        };
      }

      getTimeline() {
        return this._timeline;
      }

      getClock() {
        return this._clock;
      }

      isUsingAudioWorklet() {
        return true;
      }

      onPositionUpdate(callback: Function) {
        this.callbacks.set('position', callback);
      }

      destroy() {}

      // Test helper to simulate position updates
      _simulatePositionUpdate(seconds: number) {
        const callback = this.callbacks.get('position');
        if (callback) {
          callback(seconds);
        }
      }

      // Test helper to simulate Clock.onTick
      _simulateClockTick(time: number) {
        if (this._tickCallback) {
          this._tickCallback(time);
        }
      }
    },
  };
});

vi.mock('../../../position/MusicalPositionManager.js', () => {
  return {
    MusicalPositionManager: class MockMusicalPositionManager {
      private tempo = 120;
      private timeSignature = { numerator: 4, denominator: 4 };
      private countdownBeats = 0;
      private position = { bars: 1, beats: 0, sixteenths: 0 };
      private callbacks: Map<string, Function> = new Map();

      constructor(config: any) {
        this.tempo = config.tempo || 120;
        this.timeSignature = config.timeSignature || {
          numerator: 4,
          denominator: 4,
        };
      }

      updatePosition(seconds: number) {
        // Simple position calculation for testing
        const beatsPerSecond = this.tempo / 60;
        const totalBeats = seconds * beatsPerSecond;
        const bars = Math.floor(totalBeats / this.timeSignature.numerator) + 1;
        const beats = Math.floor(totalBeats % this.timeSignature.numerator);
        this.position = { bars, beats, sixteenths: 0 };
      }

      getPosition() {
        return this.position;
      }

      getDisplayPosition() {
        // Apply countdown adjustment
        const adjustedBars =
          this.position.bars -
          Math.floor(this.countdownBeats / this.timeSignature.numerator);
        return {
          bars: adjustedBars,
          beats: this.position.beats,
          sixteenths: this.position.sixteenths,
        };
      }

      setPosition(pos: any) {
        this.position = pos;
      }

      resetToStart() {
        this.position = { bars: 1, beats: 0, sixteenths: 0 };
      }

      reset() {
        this.resetToStart();
      }

      setCountdownBeats(beats: number) {
        this.countdownBeats = beats;
      }

      getCountdownBeats() {
        return this.countdownBeats;
      }

      getTempo() {
        return this.tempo;
      }

      setTempo(bpm: number) {
        this.tempo = bpm;
      }

      getTimeSignature() {
        return this.timeSignature;
      }

      setTimeSignature(ts: any) {
        this.timeSignature = ts;
      }

      setLoop(start: any, end: any, enabled: boolean) {}

      setLoopEnabled(enabled: boolean) {}

      getLoop() {
        return {
          enabled: false,
          start: { bars: 1, beats: 0, sixteenths: 0 },
          end: { bars: 4, beats: 0, sixteenths: 0 },
        };
      }

      secondsToPosition(seconds: number) {
        const beatsPerSecond = this.tempo / 60;
        const totalBeats = seconds * beatsPerSecond;
        const bars = Math.floor(totalBeats / this.timeSignature.numerator) + 1;
        const beats = Math.floor(totalBeats % this.timeSignature.numerator);
        return { bars, beats, sixteenths: 0 };
      }

      positionToSeconds(position: any) {
        const totalBeats =
          (position.bars - 1) * this.timeSignature.numerator + position.beats;
        return (totalBeats / this.tempo) * 60;
      }

      getQuantumDuration(quantum: string) {
        return 1.0; // Simplified for testing
      }

      on(event: string, callback: Function) {
        this.callbacks.set(event, callback);
      }

      destroy() {}
    },
  };
});

// Mock EventBus
class MockEventBus {
  private listeners: Map<string, Function[]> = new Map();

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => cb(data));
  }

  on(event: string, callback: Function) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
}

// Mock AudioEngine
class MockAudioEngine {
  private audioContext: any = {
    state: 'running',
    sampleRate: 48000,
    baseLatency: 0.01,
    outputLatency: 0.02,
    currentTime: 0,
  };

  async getContext() {
    return this.audioContext;
  }

  async initialize() {}
}

describe('TransportController', () => {
  let controller: TransportController;
  let mockEventBus: MockEventBus;
  let mockAudioEngine: MockAudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventBus = new MockEventBus();
    mockAudioEngine = new MockAudioEngine();

    // Clear singleton
    (TransportController as any).instance = null;

    // Reset Tone mock state
    Tone.Transport.state = 'stopped';
    Tone.Transport.position = 0;
    Tone.Transport.seconds = 0;

    // Clear env variables for clean tests
    delete process.env.NEXT_PUBLIC_USE_CLOCK_ONTICK;
    delete process.env.NEXT_PUBLIC_POSITION_UPDATE_HZ;

    // Suppress console.log for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    controller?.dispose();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should create singleton instance', () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );

      expect(controller).toBeDefined();
      expect(controller.name).toBe('TransportController');
      expect(controller.type).toBe('core');
    });

    it('should return same instance on subsequent calls', () => {
      const instance1 = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      const instance2 = TransportController.getInstance();

      expect(instance1).toBe(instance2);

      instance1.dispose();
    });

    it('should throw error if no dependencies on first call', () => {
      expect(() => {
        TransportController.getInstance();
      }).toThrow('EventBus and AudioEngine required for first initialization');
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
    });

    it('should initialize transport system', async () => {
      await controller.initialize();

      expect(controller.getState()).toBe('stopped');
    });

    it('should skip duplicate initialization', async () => {
      await controller.initialize();

      // Try to initialize again
      await controller.initialize();

      expect(controller.getState()).toBe('stopped');
    });

    it('should emit transport:ready event', async () => {
      const readySpy = vi.fn();
      mockEventBus.on('transport:ready', readySpy);

      await controller.initialize();

      expect(readySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          modular: true,
          features: expect.any(Array),
        }),
      );
    });
  });

  describe('Playback Control', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should start playback', async () => {
      await controller.start();

      expect(controller.getState()).toBe('playing');
    });

    it('should emit transport:start event', async () => {
      const startSpy = vi.fn();
      mockEventBus.on('transport:start', startSpy);

      await controller.start();

      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          position: expect.any(Object),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should stop playback', async () => {
      await controller.start();

      await controller.stop();

      expect(controller.getState()).toBe('stopped');
    });

    it('should emit transport:stop event', async () => {
      await controller.start();

      const stopSpy = vi.fn();
      mockEventBus.on('transport:stop', stopSpy);

      await controller.stop();

      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          graceful: false,
        }),
      );
    });

    it('should handle graceful stop', async () => {
      await controller.start();

      const stopSpy = vi.fn();
      mockEventBus.on('transport:stop', stopSpy);

      await controller.stop(true);

      expect(stopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          graceful: true,
        }),
      );
    });

    it('should be idempotent on duplicate stop calls', async () => {
      await controller.start();
      await controller.stop();

      // Second stop should be no-op
      await controller.stop();

      expect(controller.getState()).toBe('stopped');
    });

    it('should pause playback', async () => {
      await controller.start();

      await controller.pause();

      expect(controller.getState()).toBe('paused');
    });

    it('should emit transport:pause event', async () => {
      await controller.start();

      const pauseSpy = vi.fn();
      mockEventBus.on('transport:pause', pauseSpy);

      await controller.pause();

      expect(pauseSpy).toHaveBeenCalled();
    });

    it('should resume playback', async () => {
      await controller.start();
      await controller.pause();

      await controller.resume();

      expect(controller.getState()).toBe('playing');
    });

    it('should emit transport:resume event', async () => {
      await controller.start();
      await controller.pause();

      const resumeSpy = vi.fn();
      mockEventBus.on('transport:resume', resumeSpy);

      await controller.resume();

      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  describe('Position Management', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should get current position', () => {
      const position = controller.getPosition();

      expect(position).toHaveProperty('bars');
      expect(position).toHaveProperty('beats');
      expect(position).toHaveProperty('sixteenths');
    });

    it('should get display position', () => {
      const displayPosition = controller.getDisplayPosition();

      expect(displayPosition).toHaveProperty('bars');
      expect(displayPosition).toHaveProperty('beats');
      expect(displayPosition).toHaveProperty('sixteenths');
    });

    it('should set countdown beats', () => {
      controller.setCountdownBeats(4);

      // Countdown should affect display position
      const displayPosition = controller.getDisplayPosition();
      expect(displayPosition).toBeDefined();
    });

    it('should emit position updates during playback', async () => {
      const positionSpy = vi.fn();
      mockEventBus.on('transport:position-updated', positionSpy);

      await controller.start();

      // Simulate position update from Transport
      const transport = (controller as any).transport;
      transport._simulatePositionUpdate(1.0);

      expect(positionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          position: expect.any(Object),
          seconds: expect.any(Number),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should ignore position updates when not playing', async () => {
      const positionSpy = vi.fn();
      mockEventBus.on('transport:position-updated', positionSpy);

      // Simulate position update while stopped
      const transport = (controller as any).transport;
      transport._simulatePositionUpdate(1.0);

      expect(positionSpy).not.toHaveBeenCalled();
    });

    it('should seek to position', async () => {
      await controller.seek({ bars: 2, beats: 0, sixteenths: 0 });

      // Seek should emit event
      // (Position is set internally)
      expect(controller.getPosition().bars).toBe(2);
    });

    it('should seek to seconds', async () => {
      const seekSpy = vi.fn();
      mockEventBus.on('transport:seek', seekSpy);

      await controller.seek(5.0);

      expect(seekSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          seconds: 5.0,
          position: expect.any(Object),
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should get current time in seconds', () => {
      const currentTime = controller.getCurrentTime();

      expect(typeof currentTime).toBe('number');
      expect(currentTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Tempo and Time Signature', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should set tempo', async () => {
      const tempoSpy = vi.fn();
      mockEventBus.on('transport:tempo-change', tempoSpy);

      await controller.setTempo(140);

      expect(tempoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tempo: 140,
          bpm: 140,
        }),
      );
    });

    it('should reject invalid tempo', async () => {
      await expect(controller.setTempo(10)).rejects.toThrow('Invalid tempo');
      await expect(controller.setTempo(1000)).rejects.toThrow('Invalid tempo');
    });

    it('should support setBPM alias', async () => {
      await expect(controller.setBPM(130)).resolves.toBeUndefined();
    });

    it('should set time signature', async () => {
      const timeSigSpy = vi.fn();
      mockEventBus.on('transport:time-signature-change', timeSigSpy);

      await controller.setTimeSignature({ numerator: 3, denominator: 4 });

      expect(timeSigSpy).toHaveBeenCalledWith({ numerator: 3, denominator: 4 });
    });
  });

  describe('Exercise Duration and Auto-Stop', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should set exercise duration', () => {
      controller.setExerciseDuration(8, 4);

      const timeline = (controller as any).transport.getTimeline();
      expect(timeline.setExerciseDuration).toHaveBeenCalledWith(8, 4);
    });

    it('should set transport start time', () => {
      controller.setTransportStartTime(1.5);

      // Should not throw
      expect(controller).toBeDefined();
    });
  });

  describe('Loop Control', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should set loop', async () => {
      const loopSpy = vi.fn();
      mockEventBus.on('transport:loop-change', loopSpy);

      const start = { bars: 1, beats: 0, sixteenths: 0 };
      const end = { bars: 4, beats: 0, sixteenths: 0 };

      await controller.setLoop(start, end);

      expect(loopSpy).toHaveBeenCalledWith({
        start,
        end,
        enabled: true,
      });
    });

    it('should disable loop', async () => {
      const loopSpy = vi.fn();
      mockEventBus.on('transport:loop-change', loopSpy);

      await controller.disableLoop();

      expect(loopSpy).toHaveBeenCalledWith({ enabled: false });
    });
  });

  describe('Clock.onTick Integration (Phase 2)', () => {
    beforeEach(() => {
      // Clear singleton
      (TransportController as any).instance = null;

      // Enable Clock.onTick mode
      process.env.NEXT_PUBLIC_USE_CLOCK_ONTICK = 'true';
      process.env.NEXT_PUBLIC_POSITION_UPDATE_HZ = '120';
    });

    it('should enable Clock.onTick when env variable set', async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();

      const useClockOnTick = (controller as any).useClockOnTick;
      expect(useClockOnTick).toBe(true);
    });

    it('should configure update rate from env variable', async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();

      // Check the positionUpdateInterval directly - it's calculated as 1000 / updateHz
      // Default updateHz is 120, so interval = 1000 / 120 ≈ 8.33ms
      const positionUpdateInterval = (controller as any).positionUpdateInterval;
      expect(positionUpdateInterval).toBeCloseTo(1000 / 120, 1);
    });

    it('should handle Clock.onTick position updates', async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();

      const positionSpy = vi.fn();
      mockEventBus.on('transport:position-updated', positionSpy);

      await controller.start();

      // Simulate Clock.onTick callback
      const transport = (controller as any).transport;
      transport._simulateClockTick(1.5);

      // Should emit position update
      expect(positionSpy).toHaveBeenCalled();
    });

    it('should throttle Clock.onTick updates', async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();

      const positionSpy = vi.fn();
      mockEventBus.on('transport:position-updated', positionSpy);

      await controller.start();

      const transport = (controller as any).transport;

      // Simulate rapid ticks
      transport._simulateClockTick(1.0);
      transport._simulateClockTick(1.001); // 1ms later - should be throttled
      transport._simulateClockTick(1.002); // 2ms later - should be throttled

      // Should only emit first update due to throttling
      expect(positionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metrics', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should get timing metrics', () => {
      const metrics = controller.getMetrics();

      expect(metrics).toHaveProperty('avgDrift');
      expect(metrics).toHaveProperty('maxDrift');
      expect(metrics).toHaveProperty('stability');
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );
      await controller.initialize();
    });

    it('should dispose resources', async () => {
      await controller.dispose();

      expect(controller.getState()).toBe('stopped');
    });

    it('should clear singleton on dispose', async () => {
      await controller.dispose();

      expect((TransportController as any).instance).toBeNull();
    });

    it('should allow creating new instance after dispose', async () => {
      await controller.dispose();

      const newController = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
      );

      expect(newController).toBeDefined();
      expect(newController).not.toBe(controller);

      newController.dispose();
    });
  });

  describe('Legacy Compatibility', () => {
    beforeEach(async () => {
      controller = TransportController.getInstance(
        mockEventBus as any,
        mockAudioEngine as any,
        { enableLegacyCompatibility: true },
      );
      await controller.initialize();
    });

    it('should sync with Tone.js on start', async () => {
      await controller.start();

      expect(Tone.Transport.start).toHaveBeenCalled();
    });

    it('should sync with Tone.js on stop', async () => {
      await controller.start();
      await controller.stop();

      expect(Tone.Transport.stop).toHaveBeenCalled();
    });

    it('should sync with Tone.js on pause', async () => {
      await controller.start();
      await controller.pause();

      expect(Tone.Transport.pause).toHaveBeenCalled();
    });

    it('should support pauseAtQuantum', async () => {
      await expect(controller.pauseAtQuantum('1m')).resolves.toBeUndefined();
    });

    it('should support resumeAtQuantum', async () => {
      await expect(controller.resumeAtQuantum('1m')).resolves.toBeUndefined();
    });
  });
});
