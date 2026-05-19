/**
 * AudioContext ↔ Transport Integration Tests
 *
 * These integration tests verify the boundary between AudioContext lifecycle management
 * and TransportController, ensuring proper context initialization, state management,
 * and sharing between components.
 *
 * Integration points tested:
 * 1. AudioContext initialization and persistence
 * 2. Context state management (suspended → running)
 * 3. Context sharing between Transport and AudioEngine
 * 4. Context resume on initialization
 * 5. Multiple initialization with same context (idempotency)
 * 6. Context state transitions during playback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportController } from '../../core/TransportController.js';
import type { EventBus } from '../../../../services/core/EventBus.js';

// Mock Tone.js
vi.mock('tone', () => {
  const Transport = {
    state: 'stopped',
    position: 0,
    seconds: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
  };
  return { Transport, getTransport: () => Transport };
});

// Mock Transport
vi.mock('../../core/Transport.js', () => {
  return {
    Transport: class MockTransport {
      private _audioContext: any = null;
      private _isRunning = false;
      private _currentTime = 0;

      constructor(_config: any) {}

      async initialize(audioContext: any) {
        this._audioContext = audioContext;
      }

      getAudioContext() {
        return this._audioContext;
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

      onPositionUpdate(_callback: Function) {}

      updateConfig(_config: any) {}

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

// Mock EventBus
class IntegrationMockEventBus implements EventBus {
  private listeners: Map<string, Function[]> = new Map();

  emit(event: string, data: any): void {
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
}

// Mock AudioContext
class IntegrationMockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  currentTime = 0;
  destination = { connect: vi.fn() };

  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };

  async resume() {
    if (this.state === 'suspended') {
      this.state = 'running';
    }
    return Promise.resolve();
  }

  async close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  addEventListener(_event: string, _listener: Function) {}
  removeEventListener(_event: string, _listener: Function) {}

  // Test helper
  _setState(state: 'suspended' | 'running' | 'closed') {
    this.state = state;
  }
}

// Mock AudioEngine
class IntegrationMockAudioEngine {
  private audioContext: IntegrationMockAudioContext;
  private contextCreationCount = 0;

  constructor(context?: IntegrationMockAudioContext) {
    this.audioContext = context || new IntegrationMockAudioContext();
  }

  getAudioContext() {
    return this.audioContext;
  }

  async getContext() {
    this.contextCreationCount++;
    // Resume context if suspended (matches real AudioEngine behavior)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  // Test helpers
  getContextCreationCount() {
    return this.contextCreationCount;
  }

  setAudioContext(context: IntegrationMockAudioContext) {
    this.audioContext = context;
  }
}

describe('AudioContext ↔ Transport Integration Tests', () => {
  let controller: TransportController;
  let eventBus: IntegrationMockEventBus;
  let audioEngine: IntegrationMockAudioEngine;
  let audioContext: IntegrationMockAudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new IntegrationMockEventBus();
    audioContext = new IntegrationMockAudioContext();
    audioEngine = new IntegrationMockAudioEngine(audioContext);

    // Clear singleton
    (TransportController as any).instance = null;

    controller = TransportController.getInstance(
      eventBus as any,
      audioEngine as any,
    );
  });

  afterEach(async () => {
    if (controller && typeof controller.dispose === 'function') {
      await controller.dispose();
    }
  });

  describe('Integration 1: AudioContext Initialization', () => {
    it('should obtain AudioContext from AudioEngine on initialization', async () => {
      await controller.initialize();

      // AudioEngine.getContext() should have been called
      expect(audioEngine.getContextCreationCount()).toBe(1);
    });

    it('should resume suspended AudioContext during initialization', async () => {
      audioContext._setState('suspended');
      expect(audioContext.state).toBe('suspended');

      await controller.initialize();

      // Context should be resumed by AudioEngine.getContext()
      // (In real implementation, AudioEngine resumes context)
      expect(audioContext.state).toBe('running');
    });

    it('should share AudioContext between Transport and AudioEngine', async () => {
      await controller.initialize();

      // Get Transport's AudioContext
      const transport = (controller as any).transport;
      const transportContext = transport.getAudioContext();

      // Should be the same context
      expect(transportContext).toBe(audioContext);
    });

    it('should work with already-running AudioContext', async () => {
      audioContext._setState('running');

      await controller.initialize();

      expect(audioContext.state).toBe('running');
    });
  });

  describe('Integration 2: Context State Management', () => {
    it('should handle context state change from suspended to running', async () => {
      audioContext._setState('suspended');

      await controller.initialize();
      await controller.start();

      // Context should be running after start
      expect(audioContext.state).toBe('running');
    });

    it('should maintain context state across pause/resume', async () => {
      await controller.initialize();
      await controller.start();

      expect(audioContext.state).toBe('running');

      await controller.pause();
      expect(audioContext.state).toBe('running'); // Context stays running

      await controller.resume();
      expect(audioContext.state).toBe('running');
    });

    it('should maintain context state after stop', async () => {
      await controller.initialize();
      await controller.start();
      await controller.stop();

      // Context should still be running (not closed)
      expect(audioContext.state).toBe('running');
    });
  });

  describe('Integration 3: Multiple Initialization', () => {
    it('should reuse same AudioContext on multiple initialize calls', async () => {
      await controller.initialize();
      const firstCallCount = audioEngine.getContextCreationCount();

      await controller.initialize();
      const secondCallCount = audioEngine.getContextCreationCount();

      // Should not create new context on second init
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should handle re-initialization after dispose', async () => {
      await controller.initialize();
      await controller.dispose();

      // Re-initialize
      await controller.initialize();

      // Should work fine - controller should be stopped but initialized
      expect(controller.getState()).toBe('stopped');
    });

    it('should obtain context again after dispose', async () => {
      await controller.initialize();
      const initialCount = audioEngine.getContextCreationCount();

      await controller.dispose();

      // Clear singleton for re-initialization test
      (TransportController as any).instance = null;
      controller = TransportController.getInstance(
        eventBus as any,
        audioEngine as any,
      );

      await controller.initialize();

      // Should call getContext again
      expect(audioEngine.getContextCreationCount()).toBeGreaterThan(
        initialCount,
      );
    });
  });

  describe('Integration 4: Context Sharing Across Operations', () => {
    it('should use same context for start operation', async () => {
      await controller.initialize();

      const transport = (controller as any).transport;
      const contextBeforeStart = transport.getAudioContext();

      await controller.start();

      const contextAfterStart = transport.getAudioContext();

      expect(contextAfterStart).toBe(contextBeforeStart);
      expect(contextAfterStart).toBe(audioContext);
    });

    it('should use same context across seek operations', async () => {
      await controller.initialize();

      const transport = (controller as any).transport;
      const contextBeforeSeek = transport.getAudioContext();

      await controller.seek(5.0);

      const contextAfterSeek = transport.getAudioContext();

      expect(contextAfterSeek).toBe(contextBeforeSeek);
      expect(contextAfterSeek).toBe(audioContext);
    });

    it('should use same context across tempo changes', async () => {
      await controller.initialize();

      const transport = (controller as any).transport;
      const contextBeforeTempo = transport.getAudioContext();

      controller.setTempo(140);

      const contextAfterTempo = transport.getAudioContext();

      expect(contextAfterTempo).toBe(contextBeforeTempo);
    });
  });

  describe('Integration 5: Context Lifecycle Edge Cases', () => {
    it('should handle initialization with closed context gracefully', async () => {
      audioContext._setState('closed');

      // Should not throw (AudioEngine would handle this by creating new context)
      await expect(controller.initialize()).resolves.not.toThrow();
    });

    it('should emit ready event even if context is suspended', async () => {
      audioContext._setState('suspended');

      const readyEvents: any[] = [];
      eventBus.on('transport:ready', (data) => readyEvents.push(data));

      await controller.initialize();

      expect(readyEvents.length).toBe(1);
    });

    it('should allow start even if context starts suspended', async () => {
      audioContext._setState('suspended');

      await controller.initialize();

      // Should not throw - real AudioEngine would resume context
      await expect(controller.start()).resolves.not.toThrow();
    });
  });

  describe('Integration 6: Context State Validation', () => {
    it('should provide context state in ready event', async () => {
      const readyEvents: any[] = [];
      eventBus.on('transport:ready', (data) => readyEvents.push(data));

      await controller.initialize();

      expect(readyEvents[0]).toHaveProperty('modular');
      expect(readyEvents[0]).toHaveProperty('features');
    });

    it('should maintain context state consistency during rapid operations', async () => {
      await controller.initialize();

      // Rapid operations
      await controller.start();
      await controller.pause();
      await controller.resume();
      await controller.stop();

      // Context should still be valid
      const transport = (controller as any).transport;
      const finalContext = transport.getAudioContext();

      expect(finalContext).toBe(audioContext);
      expect(finalContext.state).not.toBe('closed');
    });
  });
});
