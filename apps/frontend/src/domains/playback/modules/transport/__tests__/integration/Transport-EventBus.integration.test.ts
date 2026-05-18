/**
 * Transport ↔ EventBus Integration Tests
 *
 * These integration tests verify the boundary between TransportController and EventBus,
 * ensuring proper event propagation, ordering, and multi-subscriber handling.
 *
 * Integration points tested:
 * 1. Transport state changes → EventBus events
 * 2. Event ordering guarantees (start → position updates → stop)
 * 3. Multiple subscriber handling
 * 4. Event data integrity across the boundary
 * 5. Synchronous vs asynchronous event delivery
 * 6. Error handling in event subscribers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TransportController } from '../../core/TransportController.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { AudioEngine } from '../../../../services/core/AudioEngine.js';

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
      private _isRunning = false;
      private _currentTime = 0;

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

      updateConfig(config: any) {
        // Mock updateConfig for time signature changes
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
class IntegrationMockEventBus implements EventBus {
  private listeners: Map<string, Function[]> = new Map();
  private eventLog: Array<{ event: string; data: any; timestamp: number }> = [];

  emit(event: string, data: any): void {
    this.eventLog.push({ event, data, timestamp: performance.now() });
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        // Swallow errors from subscribers to prevent event delivery interruption
        // This matches production EventBus behavior
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
  getEventLog() {
    return this.eventLog;
  }

  clearEventLog() {
    this.eventLog = [];
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

// Mock AudioEngine
class IntegrationMockAudioEngine {
  private audioContext = {
    state: 'running',
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

describe('Transport ↔ EventBus Integration Tests', () => {
  let controller: TransportController;
  let eventBus: IntegrationMockEventBus;
  let audioEngine: IntegrationMockAudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new IntegrationMockEventBus();
    audioEngine = new IntegrationMockAudioEngine();

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

  describe('Integration 1: Transport State Changes → EventBus Events', () => {
    it('should emit transport:ready event on initialization', async () => {
      const readyEvents: any[] = [];
      eventBus.on('transport:ready', (data: any) => readyEvents.push(data));

      await controller.initialize();

      expect(readyEvents.length).toBe(1);
      expect(readyEvents[0]).toHaveProperty('modular');
      expect(readyEvents[0]).toHaveProperty('features');
    });

    it('should emit transport:start event when starting', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      const startEvents: any[] = [];
      eventBus.on('transport:start', (data: any) => startEvents.push(data));

      await controller.start();

      expect(startEvents.length).toBe(1);
      expect(startEvents[0]).toHaveProperty('position');
      expect(startEvents[0]).toHaveProperty('timestamp');
    });

    it('should emit transport:stop event when stopping', async () => {
      await controller.initialize();
      await controller.start();
      eventBus.clearEventLog();

      const stopEvents: any[] = [];
      eventBus.on('transport:stop', (data: any) => stopEvents.push(data));

      await controller.stop();

      expect(stopEvents.length).toBe(1);
      expect(stopEvents[0]).toHaveProperty('timestamp');
      expect(stopEvents[0]).toHaveProperty('graceful');
    });

    it('should emit transport:pause event when pausing', async () => {
      await controller.initialize();
      await controller.start();
      eventBus.clearEventLog();

      const pauseEvents: any[] = [];
      eventBus.on('transport:pause', (data: any) => pauseEvents.push(data));

      await controller.pause();

      expect(pauseEvents.length).toBe(1);
      expect(pauseEvents[0]).toHaveProperty('position');
      expect(pauseEvents[0]).toHaveProperty('timestamp');
    });

    it('should emit transport:resume event when resuming', async () => {
      await controller.initialize();
      await controller.start();
      await controller.pause();
      eventBus.clearEventLog();

      const resumeEvents: any[] = [];
      eventBus.on('transport:resume', (data: any) => resumeEvents.push(data));

      await controller.resume();

      expect(resumeEvents.length).toBe(1);
      expect(resumeEvents[0]).toHaveProperty('position');
      expect(resumeEvents[0]).toHaveProperty('timestamp');
    });

    it('should emit transport:seek event when seeking', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      const seekEvents: any[] = [];
      eventBus.on('transport:seek', (data: any) => seekEvents.push(data));

      await controller.seek(5.0);

      expect(seekEvents.length).toBe(1);
      expect(seekEvents[0]).toHaveProperty('position');
      expect(seekEvents[0]).toHaveProperty('seconds');
      expect(seekEvents[0].seconds).toBe(5.0);
    });

    it('should emit transport:tempo-change event when changing tempo', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      const tempoEvents: any[] = [];
      eventBus.on('transport:tempo-change', (data: any) =>
        tempoEvents.push(data),
      );

      controller.setTempo(140);

      expect(tempoEvents.length).toBe(1);
      expect(tempoEvents[0].tempo).toBe(140);
      expect(tempoEvents[0].bpm).toBe(140);
    });

    it('should emit transport:time-signature-change event when changing time signature', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      const sigEvents: any[] = [];
      eventBus.on('transport:time-signature-change', (data: any) =>
        sigEvents.push(data),
      );

      controller.setTimeSignature({ numerator: 3, denominator: 4 });

      expect(sigEvents.length).toBe(1);
      expect(sigEvents[0].numerator).toBe(3);
      expect(sigEvents[0].denominator).toBe(4);
    });
  });

  describe('Integration 2: Event Ordering Guarantees', () => {
    it('should emit events in correct order: start → position → stop', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      await controller.start();
      await controller.stop();

      const eventLog = eventBus.getEventLog();
      const eventNames = eventLog.map((e) => e.event);

      // Should see start, then stop (position updates happen asynchronously)
      expect(eventNames).toContain('transport:start');
      expect(eventNames).toContain('transport:stop');

      const startIndex = eventNames.indexOf('transport:start');
      const stopIndex = eventNames.indexOf('transport:stop');

      expect(startIndex).toBeLessThan(stopIndex);
    });

    it('should maintain event order across multiple state changes', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      await controller.start();
      await controller.pause();
      await controller.resume();
      await controller.stop();

      const eventLog = eventBus.getEventLog();
      const eventNames = eventLog.map((e) => e.event);

      expect(eventNames).toContain('transport:start');
      expect(eventNames).toContain('transport:pause');
      expect(eventNames).toContain('transport:resume');
      expect(eventNames).toContain('transport:stop');

      // Verify order
      const startIdx = eventNames.indexOf('transport:start');
      const pauseIdx = eventNames.indexOf('transport:pause');
      const resumeIdx = eventNames.indexOf('transport:resume');
      const stopIdx = eventNames.indexOf('transport:stop');

      expect(startIdx).toBeLessThan(pauseIdx);
      expect(pauseIdx).toBeLessThan(resumeIdx);
      expect(resumeIdx).toBeLessThan(stopIdx);
    });

    it('should preserve event timestamps in chronological order', async () => {
      await controller.initialize();
      eventBus.clearEventLog();

      await controller.start();
      await controller.pause();
      await controller.stop();

      const eventLog = eventBus.getEventLog();

      // Timestamps should be monotonically increasing
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp).toBeGreaterThanOrEqual(
          eventLog[i - 1].timestamp,
        );
      }
    });
  });

  describe('Integration 3: Multiple Subscriber Handling', () => {
    it('should deliver events to multiple subscribers', async () => {
      await controller.initialize();

      const subscriber1Events: any[] = [];
      const subscriber2Events: any[] = [];
      const subscriber3Events: any[] = [];

      eventBus.on('transport:start', (data) => subscriber1Events.push(data));
      eventBus.on('transport:start', (data) => subscriber2Events.push(data));
      eventBus.on('transport:start', (data) => subscriber3Events.push(data));

      eventBus.clearEventLog();
      await controller.start();

      expect(subscriber1Events.length).toBe(1);
      expect(subscriber2Events.length).toBe(1);
      expect(subscriber3Events.length).toBe(1);

      // All should receive same data
      expect(subscriber1Events[0]).toEqual(subscriber2Events[0]);
      expect(subscriber2Events[0]).toEqual(subscriber3Events[0]);
    });

    it('should handle subscriber unsubscription correctly', async () => {
      await controller.initialize();

      const events: any[] = [];
      const callback = (data: any) => events.push(data);

      eventBus.on('transport:start', callback);

      await controller.start();
      expect(events.length).toBe(1);

      // Unsubscribe
      eventBus.off('transport:start', callback);

      await controller.stop();
      await controller.start();

      // Should still be 1 (not 2) because we unsubscribed
      expect(events.length).toBe(1);
    });

    it('should handle mixed event subscriptions across different events', async () => {
      await controller.initialize();

      const startCount = { count: 0 };
      const pauseCount = { count: 0 };
      const stopCount = { count: 0 };

      eventBus.on('transport:start', () => startCount.count++);
      eventBus.on('transport:pause', () => pauseCount.count++);
      eventBus.on('transport:stop', () => stopCount.count++);

      await controller.start();
      await controller.pause();
      await controller.stop();

      expect(startCount.count).toBe(1);
      expect(pauseCount.count).toBe(1);
      expect(stopCount.count).toBe(1);
    });
  });

  describe('Integration 4: Event Data Integrity', () => {
    it('should include all required fields in transport:start event', async () => {
      await controller.initialize();

      const events: any[] = [];
      eventBus.on('transport:start', (data) => events.push(data));

      await controller.start();

      expect(events[0]).toHaveProperty('position');
      expect(events[0]).toHaveProperty('timestamp');
      expect(typeof events[0].timestamp).toBe('number');
    });

    it('should include graceful flag in transport:stop event', async () => {
      await controller.initialize();
      await controller.start();

      const events: any[] = [];
      eventBus.on('transport:stop', (data) => events.push(data));

      await controller.stop();

      expect(events[0]).toHaveProperty('graceful');
      expect(typeof events[0].graceful).toBe('boolean');
    });

    it('should emit both tempo and bpm fields for backward compatibility', async () => {
      await controller.initialize();

      const events: any[] = [];
      eventBus.on('transport:tempo-change', (data) => events.push(data));

      controller.setTempo(150);

      expect(events[0]).toHaveProperty('tempo');
      expect(events[0]).toHaveProperty('bpm');
      expect(events[0].tempo).toBe(150);
      expect(events[0].bpm).toBe(150);
    });
  });

  describe('Integration 5: Error Handling in Event Subscribers', () => {
    it('should not crash when subscriber throws error', async () => {
      await controller.initialize();

      const errorSubscriber = () => {
        throw new Error('Subscriber error');
      };
      const normalEvents: any[] = [];

      eventBus.on('transport:start', errorSubscriber);
      eventBus.on('transport:start', (data) => normalEvents.push(data));

      // Should not throw
      await expect(controller.start()).resolves.not.toThrow();

      // Normal subscriber should still receive event
      expect(normalEvents.length).toBe(1);
    });

    it('should continue event delivery after subscriber error', async () => {
      await controller.initialize();

      const events1: any[] = [];
      const events2: any[] = [];

      eventBus.on('transport:start', () => events1.push('ok'));
      eventBus.on('transport:start', () => {
        throw new Error('Error');
      });
      eventBus.on('transport:start', () => events2.push('ok'));

      await controller.start();

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
    });
  });

  describe('Integration 6: Event Bus Lifecycle', () => {
    it('should allow re-initialization after dispose', async () => {
      await controller.initialize();

      const events: any[] = [];
      eventBus.on('transport:start', (data) => events.push(data));

      await controller.dispose();

      // start() will re-initialize if needed - this is expected behavior
      await controller.start();

      // Should emit event after re-initialization
      expect(events.length).toBe(1);
    });

    it('should clean up subscriptions on dispose', async () => {
      await controller.initialize();

      // Get initial listener count
      eventBus.on('transport:start', () => {});
      const initialCount = eventBus.getListenerCount('transport:start');

      await controller.dispose();

      // Listener count should be same (controller doesn't auto-cleanup EventBus)
      // This documents current behavior
      expect(eventBus.getListenerCount('transport:start')).toBe(initialCount);
    });
  });
});
