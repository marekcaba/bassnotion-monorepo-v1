import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus, EventBusError } from '../EventBus.js';

// Mock CircuitBreaker
vi.mock('../errors/CircuitBreaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn((operation) => operation()),
    getMetrics: vi.fn(() => ({
      state: 'closed',
      failureCount: 0,
      successCount: 10,
      rejectedCount: 0,
    })),
  })),
}));

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('event subscription', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test-event', handler);

      expect(eventBus.getHandlerCount('test-event')).toBe(1);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);

      expect(eventBus.getHandlerCount('test-event')).toBe(2);
    });

    it('should unsubscribe handlers', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.on('test-event', handler);

      unsubscribe();

      expect(eventBus.getHandlerCount('test-event')).toBe(0);
    });

    it('should support subscribe alias', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test-event', handler);

      expect(eventBus.getHandlerCount('test-event')).toBe(1);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('event emission', () => {
    it('should emit events to handlers', async () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await eventBus.emit('test-event', { value: 42 });

      expect(handler).toHaveBeenCalledWith(
        { value: 42 },
        expect.objectContaining({
          eventId: expect.stringMatching(/^evt-\d+-\d+$/),
          timestamp: expect.any(Number),
          source: undefined,
        }),
      );
    });

    it('should emit events with source', async () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await eventBus.emit('test-event', { value: 42 }, 'TestService');

      expect(handler).toHaveBeenCalledWith(
        { value: 42 },
        expect.objectContaining({
          source: 'TestService',
        }),
      );
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      eventBus.on('test-event', handler);

      await eventBus.emit('test-event', {});

      expect(handler).toHaveBeenCalled();
    });

    it('should not throw if no handlers registered', async () => {
      await expect(eventBus.emit('unknown-event', {})).resolves.not.toThrow();
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      eventBus.on('test-event', errorHandler);
      eventBus.on('test-event', goodHandler);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await eventBus.emit('test-event', {});

      expect(goodHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should emit handler errors', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const errorEventHandler = vi.fn();

      eventBus.on('test-event', errorHandler);
      eventBus.on('eventbus:handler-error', errorEventHandler);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await eventBus.emit('test-event', {});

      expect(errorEventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'test-event',
          error: 'Handler error',
        }),
        expect.any(Object),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('event history', () => {
    it('should store event history', async () => {
      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });
      await eventBus.emit('other-event', { value: 3 });

      const history = eventBus.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should filter history by event', async () => {
      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });
      await eventBus.emit('other-event', { value: 3 });

      const history = eventBus.getHistory('test-event');
      expect(history).toHaveLength(2);
      expect(history[0].data).toEqual({ value: 1 });
      expect(history[1].data).toEqual({ value: 2 });
    });

    it('should respect max history size', async () => {
      const smallBus = new EventBus({ maxEventHistory: 3 });

      for (let i = 0; i < 5; i++) {
        await smallBus.emit('test-event', { value: i });
      }

      const history = smallBus.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].data).toEqual({ value: 2 });
      expect(history[2].data).toEqual({ value: 4 });
    });

    it('should clear history', async () => {
      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('other-event', { value: 2 });

      eventBus.clearHistory('test-event');
      expect(eventBus.getHistory('test-event')).toHaveLength(0);
      expect(eventBus.getHistory('other-event')).toHaveLength(1);

      eventBus.clearHistory();
      expect(eventBus.getHistory()).toHaveLength(0);
    });

    it('should return empty history when replay is disabled', () => {
      const noReplayBus = new EventBus({ enableReplay: false });
      expect(noReplayBus.getHistory()).toEqual([]);
    });
  });

  describe('event replay', () => {
    it('should replay filtered events', async () => {
      const handler = vi.fn();

      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });
      await eventBus.emit('other-event', { value: 3 });

      eventBus.on('test-event', handler);

      const replayCount = await eventBus.replay(
        (event) => event.event === 'test-event',
      );

      expect(replayCount).toBe(2);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should replay to specific handler', async () => {
      const originalHandler = vi.fn();
      const replayHandler = vi.fn();

      eventBus.on('test-event', originalHandler);
      await eventBus.emit('test-event', { value: 1 });

      vi.clearAllMocks();

      await eventBus.replay(
        (event) => event.event === 'test-event',
        replayHandler,
      );

      expect(replayHandler).toHaveBeenCalledOnce();
      expect(originalHandler).not.toHaveBeenCalled();
    });

    it('should add correlation ID to replayed events', async () => {
      const handler = vi.fn();

      await eventBus.emit('test-event', { value: 1 });

      await eventBus.replay((event) => event.event === 'test-event', handler);

      expect(handler).toHaveBeenCalledWith(
        { value: 1 },
        expect.objectContaining({
          correlationId: expect.stringMatching(/^replay-evt-\d+-\d+$/),
        }),
      );
    });

    it('should throw error if replay is disabled', async () => {
      const noReplayBus = new EventBus({ enableReplay: false });

      await expect(noReplayBus.replay(() => true)).rejects.toThrow(
        EventBusError,
      );
    });
  });

  describe('handler management', () => {
    it('should get registered events', () => {
      eventBus.on('event1', vi.fn());
      eventBus.on('event2', vi.fn());
      eventBus.on('event3', vi.fn());

      const events = eventBus.getRegisteredEvents();
      expect(events).toHaveLength(3);
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
    });

    it('should remove all handlers for an event', () => {
      eventBus.on('test-event', vi.fn());
      eventBus.on('test-event', vi.fn());
      eventBus.on('other-event', vi.fn());

      eventBus.removeAllHandlers('test-event');

      expect(eventBus.getHandlerCount('test-event')).toBe(0);
      expect(eventBus.getHandlerCount('other-event')).toBe(1);
    });

    it('should remove all handlers', () => {
      eventBus.on('event1', vi.fn());
      eventBus.on('event2', vi.fn());

      eventBus.removeAllHandlers();

      expect(eventBus.getRegisteredEvents()).toHaveLength(0);
    });
  });

  describe('circuit breaker integration', () => {
    it('should get circuit breaker metrics', async () => {
      eventBus.on('test-event', vi.fn());
      await eventBus.emit('test-event', {});

      const metrics = eventBus.getCircuitBreakerMetrics();
      expect(metrics['test-event']).toBeDefined();
      expect(metrics['test-event'].state).toBe('closed');
    });
  });

  describe('service interface', () => {
    it('should implement initialize', async () => {
      await expect(eventBus.initialize()).resolves.not.toThrow();
    });

    it('should implement start', async () => {
      await expect(eventBus.start()).resolves.not.toThrow();
    });

    it('should implement stop', async () => {
      eventBus.on('test-event', vi.fn());
      await eventBus.stop();

      expect(eventBus.getRegisteredEvents()).toHaveLength(0);
    });

    it('should implement dispose', async () => {
      eventBus.on('test-event', vi.fn());
      await eventBus.emit('test-event', {});

      await eventBus.dispose();

      expect(eventBus.getRegisteredEvents()).toHaveLength(0);
      expect(eventBus.getHistory()).toHaveLength(0);
    });
  });

  describe('emitAndWait', () => {
    it('should emit and wait for all handlers', async () => {
      const handler1 = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10)),
        );
      const handler2 = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 20)),
        );

      eventBus.on('test-event', handler1);
      eventBus.on('test-event', handler2);

      const start = Date.now();
      await eventBus.emitAndWait('test-event', {});
      const duration = Date.now() - start;

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(duration).toBeGreaterThanOrEqual(15); // Should wait for all handlers
    });
  });

  describe('edge cases', () => {
    it('should handle empty data emission', async () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await eventBus.emit('test-event');

      expect(handler).toHaveBeenCalledWith({}, expect.any(Object));
    });

    it('should handle concurrent emissions', async () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await Promise.all([
        eventBus.emit('test-event', { id: 1 }),
        eventBus.emit('test-event', { id: 2 }),
        eventBus.emit('test-event', { id: 3 }),
      ]);

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should handle handler that throws non-Error objects', async () => {
      const handler = vi.fn(() => {
        throw 'string error';
      });

      eventBus.on('test-event', handler);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await eventBus.emit('test-event', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        'string error',
      );

      consoleSpy.mockRestore();
    });
  });
});
