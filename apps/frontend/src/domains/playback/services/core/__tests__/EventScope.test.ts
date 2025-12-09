import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../EventBus.js';
import { EventScope } from '../EventScope.js';

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

describe('EventScope', () => {
  let eventBus: EventBus;
  let scope: EventScope;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    scope = new EventScope(eventBus, { name: 'test-scope' });
  });

  describe('scoped subscriptions', () => {
    it('should subscribe through parent event bus', async () => {
      const handler = vi.fn();
      scope.on('test-event', handler);

      await eventBus.emit('test-event', { value: 42 });

      expect(handler).toHaveBeenCalledWith(
        { value: 42 },
        expect.objectContaining({ eventId: expect.any(String) }),
      );
    });

    it('should track subscription count', () => {
      scope.on('event1', vi.fn());
      scope.on('event2', vi.fn());
      scope.on('event3', vi.fn());

      expect(scope.getSubscriptionCount()).toBe(3);
    });

    it('should allow manual unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = scope.on('test-event', handler);

      unsubscribe();

      await eventBus.emit('test-event', { value: 42 });

      expect(handler).not.toHaveBeenCalled();
      expect(scope.getSubscriptionCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should unsubscribe all handlers on dispose', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      scope.on('event1', handler1);
      scope.on('event2', handler2);
      scope.on('event3', handler3);

      expect(scope.getSubscriptionCount()).toBe(3);

      scope.dispose();

      // All handlers should be removed
      await eventBus.emit('event1', {});
      await eventBus.emit('event2', {});
      await eventBus.emit('event3', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
      expect(scope.getSubscriptionCount()).toBe(0);
    });

    it('should prevent new subscriptions after dispose', () => {
      scope.dispose();

      const unsubscribe = scope.on('test-event', vi.fn());

      // Should return a no-op function
      expect(typeof unsubscribe).toBe('function');
      expect(scope.getSubscriptionCount()).toBe(0);
    });

    it('should be idempotent', () => {
      scope.on('test-event', vi.fn());
      scope.on('other-event', vi.fn());

      scope.dispose();
      scope.dispose(); // Should not throw
      scope.dispose(); // Should not throw

      expect(scope.getIsDisposed()).toBe(true);
    });

    it('should mark scope as disposed', () => {
      expect(scope.getIsDisposed()).toBe(false);
      scope.dispose();
      expect(scope.getIsDisposed()).toBe(true);
    });
  });

  describe('emit', () => {
    it('should emit through parent bus', async () => {
      const handler = vi.fn();
      eventBus.on('scoped-event', handler);

      await scope.emit('scoped-event', { source: 'scope' });

      expect(handler).toHaveBeenCalledWith(
        { source: 'scope' },
        expect.any(Object),
      );
    });
  });

  describe('lifecycle tracking', () => {
    it('should provide scope name', () => {
      const namedScope = new EventScope(eventBus, { name: 'my-scope' });
      expect(namedScope.getName()).toBe('my-scope');
    });

    it('should generate scope ID automatically', () => {
      const anonymousScope = new EventScope(eventBus);
      expect(anonymousScope.getScopeId()).toMatch(/^scope-\d+-[a-z0-9]+$/);
    });
  });

  describe('cleanup scenarios', () => {
    it('should handle playback session lifecycle', async () => {
      // Simulate creating a new scope for each playback run
      const run1Handler = vi.fn();
      const run1Scope = new EventScope(eventBus, { name: 'session-1' });
      run1Scope.on('playback:tick', run1Handler);

      // First run receives events
      await eventBus.emit('playback:tick', { time: 1 });
      expect(run1Handler).toHaveBeenCalledTimes(1);

      // Dispose first session
      run1Scope.dispose();

      // Create second session
      const run2Handler = vi.fn();
      const run2Scope = new EventScope(eventBus, { name: 'session-2' });
      run2Scope.on('playback:tick', run2Handler);

      // Second run receives events, first does not
      await eventBus.emit('playback:tick', { time: 2 });
      expect(run1Handler).toHaveBeenCalledTimes(1); // Still 1, not called again
      expect(run2Handler).toHaveBeenCalledTimes(1);

      run2Scope.dispose();
    });

    it('should handle tempo change scenario', async () => {
      // Multiple tempo changes in same session
      const tempoHandlers: ReturnType<typeof vi.fn>[] = [];

      for (let i = 0; i < 5; i++) {
        const sessionScope = new EventScope(eventBus, {
          name: `tempo-session-${i}`,
        });
        const handler = vi.fn();
        tempoHandlers.push(handler);
        sessionScope.on('transport:tempo-change', handler);

        // Dispose after each tempo change (simulating session recreation)
        await eventBus.emit('transport:tempo-change', { bpm: 100 + i * 10 });
        sessionScope.dispose();
      }

      // Each handler should only have been called once
      tempoHandlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('integration with EventBus', () => {
    it('should not leak handlers after multiple scope creations', async () => {
      const initialCount = eventBus.getHandlerCount('stress-event');

      // Create and dispose many scopes
      for (let i = 0; i < 100; i++) {
        const tempScope = new EventScope(eventBus, { name: `stress-${i}` });
        tempScope.on('stress-event', vi.fn());
        tempScope.dispose();
      }

      // Handler count should be back to initial
      expect(eventBus.getHandlerCount('stress-event')).toBe(initialCount);
    });
  });
});
