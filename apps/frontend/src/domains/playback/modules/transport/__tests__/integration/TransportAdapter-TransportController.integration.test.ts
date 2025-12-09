/**
 * TransportAdapter ↔ TransportController Integration Tests (Phase 3.1)
 *
 * These integration tests verify the adapter layer that bridges the old
 * UnifiedTransport API to the new TransportController, ensuring backward
 * compatibility and smooth migration path.
 *
 * Integration points tested:
 * 1. API Compatibility - UnifiedTransport methods map correctly
 * 2. State Synchronization - States sync through adapter
 * 3. Event Translation - EventBus events translate correctly
 * 4. Timing Coordination - setTransportStartTime() syncs correctly
 * 5. Lifecycle Management - Initialize/dispose work correctly
 * 6. Configuration Forwarding - Config passes through correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportAdapter } from '../../../../services/core/TransportAdapter.js';
import { TransportController } from '../../core/TransportController.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { AudioEngine } from '../../../audio-engine/core/AudioEngine.js';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    state: 'stopped',
    position: 0,
    seconds: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
  },
}));

// Mock Transport
vi.mock('../../core/Transport.js', () => {
  return {
    Transport: class MockTransport {
      private _isRunning = false;
      private _currentTime = 0;
      private _transportStartTime = 0;

      constructor(config: any) {}

      async initialize(audioContext: any) {}

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

      getCurrentTime() {
        return this._currentTime;
      }

      getState() {
        return this._isRunning ? 'playing' : 'stopped';
      }

      getClock() {
        return { getCurrentTime: () => this._currentTime };
      }

      getTimeline() {
        return { getExerciseDurationSeconds: () => 0 };
      }

      onPositionUpdate(callback: Function) {}

      updateConfig(config: any) {}

      setTransportStartTime(time: number) {
        this._transportStartTime = time;
      }

      isUsingAudioWorklet() {
        return true;
      }

      isUsingWebWorker() {
        return false;
      }

      destroy() {}
    },
  };
});

// Mock EventBus for integration testing
class AdapterMockEventBus implements EventBus {
  private listeners: Map<string, Function[]> = new Map();
  private emittedEvents: Array<{ event: string; data: any }> = [];

  emit(event: string, data: any): void {
    this.emittedEvents.push({ event, data });
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        // Swallow errors
      }
    });
  }

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Test helpers
  getEmittedEvents() {
    return this.emittedEvents;
  }

  clearEmittedEvents() {
    this.emittedEvents = [];
  }
}

// Mock AudioEngine
class AdapterMockAudioEngine {
  private audioContext = {
    state: 'running' as const,
    sampleRate: 48000,
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
  };

  getAudioContext() {
    return this.audioContext;
  }

  async getContext() {
    return this.audioContext;
  }
}

describe('TransportAdapter ↔ TransportController Integration Tests (Phase 3.1)', () => {
  let adapter: TransportAdapter;
  let eventBus: AdapterMockEventBus;
  let audioEngine: AdapterMockAudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new AdapterMockEventBus();
    audioEngine = new AdapterMockAudioEngine();

    // Clear singletons
    (TransportAdapter as any).instance = null;
    (TransportController as any).instance = null;

    adapter = TransportAdapter.getInstance(
      eventBus as any,
      audioEngine as any,
    );
  });

  afterEach(async () => {
    // Clean up adapter
    if (adapter && typeof (adapter as any).dispose === 'function') {
      await (adapter as any).dispose();
    }

    // Clear singletons
    (TransportAdapter as any).instance = null;
    (TransportController as any).instance = null;
  });

  describe('Integration 1: API Compatibility', () => {
    it('should provide UnifiedTransport-compatible initialize() method', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible start() method', async () => {
      await adapter.initialize();
      await expect(adapter.start()).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible stop() method', async () => {
      await adapter.initialize();
      await adapter.start();
      await expect(adapter.stop()).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible pause() method', async () => {
      await adapter.initialize();
      await adapter.start();
      await expect(adapter.pause()).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible resume() method', async () => {
      await adapter.initialize();
      await adapter.start();
      await adapter.pause();
      await expect(adapter.resume()).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible seek() method', async () => {
      await adapter.initialize();
      // seek() expects MusicalPosition in TransportAdapter
      const seekPosition = { bars: 2, beats: 0, sixteenths: 0, ticks: 0 };
      await expect(adapter.seek(seekPosition)).resolves.not.toThrow();
    });

    it('should provide UnifiedTransport-compatible setTempo() method', () => {
      expect(() => adapter.setTempo(140)).not.toThrow();
    });

    it('should provide UnifiedTransport-compatible setTimeSignature() method', () => {
      // setTimeSignature() takes two parameters: numerator and denominator
      expect(() => adapter.setTimeSignature(3, 4)).not.toThrow();
    });
  });

  describe('Integration 2: State Synchronization', () => {
    it('should sync state through adapter: stopped → playing', async () => {
      await adapter.initialize();

      expect(adapter.getState()).toBe('stopped');

      await adapter.start();

      expect(adapter.getState()).toBe('playing');
    });

    it('should sync state through adapter: playing → paused', async () => {
      await adapter.initialize();
      await adapter.start();

      await adapter.pause();

      expect(adapter.getState()).toBe('paused');
    });

    it('should sync state through adapter: paused → playing', async () => {
      await adapter.initialize();
      await adapter.start();
      await adapter.pause();

      await adapter.resume();

      expect(adapter.getState()).toBe('playing');
    });

    it('should sync state through adapter: playing → stopped', async () => {
      await adapter.initialize();
      await adapter.start();

      await adapter.stop();

      expect(adapter.getState()).toBe('stopped');
    });

    it('should maintain state consistency across multiple operations', async () => {
      await adapter.initialize();

      await adapter.start();
      expect(adapter.getState()).toBe('playing');

      await adapter.pause();
      expect(adapter.getState()).toBe('paused');

      await adapter.resume();
      expect(adapter.getState()).toBe('playing');

      await adapter.stop();
      expect(adapter.getState()).toBe('stopped');
    });
  });

  describe('Integration 3: Event Translation', () => {
    it('should translate transport:ready event', async () => {
      eventBus.clearEmittedEvents();

      await adapter.initialize();

      const events = eventBus.getEmittedEvents();
      const readyEvent = events.find((e) => e.event === 'transport:ready');

      expect(readyEvent).toBeDefined();
      expect(readyEvent?.data).toHaveProperty('modular');
    });

    it('should translate transport:start event', async () => {
      await adapter.initialize();
      eventBus.clearEmittedEvents();

      await adapter.start();

      const events = eventBus.getEmittedEvents();
      const startEvent = events.find((e) => e.event === 'transport:start');

      expect(startEvent).toBeDefined();
      expect(startEvent?.data).toHaveProperty('position');
    });

    it('should translate transport:stop event', async () => {
      await adapter.initialize();
      await adapter.start();
      eventBus.clearEmittedEvents();

      await adapter.stop();

      const events = eventBus.getEmittedEvents();
      const stopEvent = events.find((e) => e.event === 'transport:stop');

      expect(stopEvent).toBeDefined();
      expect(stopEvent?.data).toHaveProperty('timestamp');
    });

    it('should translate transport:pause event', async () => {
      await adapter.initialize();
      await adapter.start();
      eventBus.clearEmittedEvents();

      await adapter.pause();

      const events = eventBus.getEmittedEvents();
      const pauseEvent = events.find((e) => e.event === 'transport:pause');

      expect(pauseEvent).toBeDefined();
    });

    it('should translate transport:resume event', async () => {
      await adapter.initialize();
      await adapter.start();
      await adapter.pause();
      eventBus.clearEmittedEvents();

      await adapter.resume();

      const events = eventBus.getEmittedEvents();
      const resumeEvent = events.find((e) => e.event === 'transport:resume');

      expect(resumeEvent).toBeDefined();
    });
  });

  describe('Integration 4: Timing Coordination', () => {
    it('should forward setTransportStartTime() to TransportController', () => {
      const startTime = 2.5;

      expect(() => adapter.setTransportStartTime(startTime)).not.toThrow();
    });

    it('should allow setting transport start time before playback', async () => {
      await adapter.initialize();

      adapter.setTransportStartTime(1.5);

      await expect(adapter.start()).resolves.not.toThrow();
    });

    it('should coordinate timing with PlaybackEngine pattern', async () => {
      await adapter.initialize();

      // Simulate PlaybackEngine pattern:
      // 1. Set transport start time (for audio scheduling anchor)
      const audioContextTime = 0.03;
      const lookAhead = 0.3;
      const transportStartTime = audioContextTime + lookAhead;

      adapter.setTransportStartTime(transportStartTime);

      // 2. Start transport
      await adapter.start();

      expect(adapter.getState()).toBe('playing');
    });
  });

  describe('Integration 5: Lifecycle Management', () => {
    it('should initialize adapter and controller', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should handle re-initialization gracefully', async () => {
      await adapter.initialize();
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should allow operations after initialization', async () => {
      await adapter.initialize();

      await expect(adapter.start()).resolves.not.toThrow();
      await expect(adapter.pause()).resolves.not.toThrow();
      await expect(adapter.resume()).resolves.not.toThrow();
      await expect(adapter.stop()).resolves.not.toThrow();
    });
  });

  describe('Integration 6: Configuration Forwarding', () => {
    it('should forward tempo configuration to controller', () => {
      // Use existing adapter but update tempo
      adapter.setTempo(140);

      expect(adapter.getTempo()).toBe(140);
    });

    it('should forward time signature configuration to controller', () => {
      // Use existing adapter but update time signature
      adapter.setTimeSignature(3, 4);

      const timeSignature = adapter.getTimeSignature();
      expect(timeSignature.numerator).toBe(3);
      expect(timeSignature.denominator).toBe(4);
    });

    it('should use default configuration when not provided', () => {
      // Adapter was created with default config in beforeEach
      expect(adapter.getTempo()).toBe(120);

      const timeSignature = adapter.getTimeSignature();
      expect(timeSignature.numerator).toBe(4);
      expect(timeSignature.denominator).toBe(4);
    });
  });

  describe('Integration 7: Singleton Pattern', () => {
    it('should return same instance on multiple getInstance() calls', () => {
      const instance1 = TransportAdapter.getInstance();
      const instance2 = TransportAdapter.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should throw error if getInstance() called without dependencies on first call', () => {
      // Clear singleton
      (TransportAdapter as any).instance = null;

      expect(() => TransportAdapter.getInstance()).toThrow(
        'EventBus and AudioEngine required for first initialization',
      );
    });

    it('should allow getInstance() without parameters after first initialization', () => {
      const instance1 = TransportAdapter.getInstance(
        eventBus as any,
        audioEngine as any,
      );
      const instance2 = TransportAdapter.getInstance();

      expect(instance2).toBe(instance1);
    });
  });

  describe('Integration 8: Error Handling', () => {
    it('should handle errors from controller gracefully', async () => {
      await adapter.initialize();

      // The adapter should handle operations gracefully
      const seekPosition = { bars: 10, beats: 0, sixteenths: 0, ticks: 0 };
      await expect(adapter.seek(seekPosition)).resolves.not.toThrow();
    });

    it('should allow recovery after error', async () => {
      await adapter.initialize();

      // Perform operations after potential error
      await expect(adapter.start()).resolves.not.toThrow();
      await expect(adapter.stop()).resolves.not.toThrow();
    });
  });
});
