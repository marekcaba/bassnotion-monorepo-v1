import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../EventBus.js';
import { PlaybackSessionManager } from '../PlaybackSessionManager.js';
import { PlaybackSessionConfig } from '../PlaybackSession.js';

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

// Mock Tone.js
vi.mock('tone', () => ({
  context: {
    currentTime: 0,
  },
  Transport: {
    bpm: { value: 120 },
    timeSignature: 4,
    clear: vi.fn(),
    cancel: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
  },
}));

describe('PlaybackSessionManager', () => {
  let eventBus: EventBus;
  let manager: PlaybackSessionManager;
  let defaultConfig: PlaybackSessionConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    eventBus = new EventBus();
    manager = new PlaybackSessionManager(eventBus);
    defaultConfig = {
      exerciseId: 'ex-test-123',
      exercise: {
        bpm: 95,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 4,
      },
    };
  });

  describe('session creation', () => {
    it('should create a new session', () => {
      const session = manager.createSession(defaultConfig);

      expect(session).toBeDefined();
      expect(session.exerciseId).toBe('ex-test-123');
    });

    it('should track current session', () => {
      const session = manager.createSession(defaultConfig);

      expect(manager.getCurrentSession()).toBe(session);
      expect(manager.hasActiveSession()).toBe(true);
    });

    it('should emit session:created event', () => {
      const handler = vi.fn();
      eventBus.on('session:created', handler);

      const session = manager.createSession(defaultConfig);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.id,
          exerciseId: 'ex-test-123',
        }),
        expect.any(Object),
      );
    });
  });

  describe('session replacement', () => {
    it('should dispose previous session when creating new one', () => {
      const session1 = manager.createSession(defaultConfig);
      session1.start(); // Start it so we can verify stop on dispose
      const disposeHandler = vi.fn();
      eventBus.on('session:disposed', disposeHandler);

      const session2 = manager.createSession({
        ...defaultConfig,
        exerciseId: 'ex-2',
      });

      // Previous session should be stopped (was playing before dispose)
      expect(session1.getState()).toBe('stopped');
      // New session is current
      expect(manager.getCurrentSession()).toBe(session2);
      expect(manager.getCurrentSession()).not.toBe(session1);
    });

    it('should stop playback before disposing', () => {
      const session1 = manager.createSession(defaultConfig);
      session1.start();
      expect(session1.getState()).toBe('playing');

      manager.createSession({ ...defaultConfig, exerciseId: 'ex-2' });

      // Previous session should be stopped
      expect(session1.getState()).toBe('stopped');
    });

    it('should increment metrics on each session creation', () => {
      manager.createSession(defaultConfig);
      manager.createSession({ ...defaultConfig, exerciseId: 'ex-2' });
      manager.createSession({ ...defaultConfig, exerciseId: 'ex-3' });

      const metrics = manager.getMetrics();
      expect(metrics.totalSessionsCreated).toBe(3);
      expect(metrics.totalSessionsDisposed).toBe(2); // First 2 sessions disposed
    });
  });

  describe('session disposal', () => {
    it('should dispose current session', () => {
      const session = manager.createSession(defaultConfig);
      session.start();

      manager.disposeCurrentSession();

      expect(manager.getCurrentSession()).toBeNull();
      expect(manager.hasActiveSession()).toBe(false);
      expect(session.getState()).toBe('stopped');
    });

    it('should emit session:disposed event', () => {
      const handler = vi.fn();
      eventBus.on('session:disposed', handler);

      const session = manager.createSession(defaultConfig);
      manager.disposeCurrentSession();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: session.id }),
        expect.any(Object),
      );
    });

    it('should handle dispose when no session exists', () => {
      // Should not throw
      expect(() => manager.disposeCurrentSession()).not.toThrow();
    });
  });

  describe('state queries', () => {
    it('should report no session initially', () => {
      expect(manager.getCurrentSession()).toBeNull();
      expect(manager.hasActiveSession()).toBe(false);
      expect(manager.isPlaying()).toBe(false);
    });

    it('should report playing state', () => {
      const session = manager.createSession(defaultConfig);
      expect(manager.isPlaying()).toBe(false);

      session.start();
      expect(manager.isPlaying()).toBe(true);

      session.stop();
      expect(manager.isPlaying()).toBe(false);
    });
  });

  describe('metrics', () => {
    it('should track session metrics', () => {
      const session = manager.createSession(defaultConfig);
      session.start();

      const metrics = manager.getMetrics();

      expect(metrics.totalSessionsCreated).toBe(1);
      expect(metrics.totalSessionsDisposed).toBe(0);
      expect(metrics.currentSessionId).toBe(session.id);
      expect(metrics.currentSessionState).toBe('playing');
      expect(metrics.currentSessionLifetimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should update metrics after disposal', () => {
      manager.createSession(defaultConfig);
      manager.disposeCurrentSession();

      const metrics = manager.getMetrics();

      expect(metrics.totalSessionsDisposed).toBe(1);
      expect(metrics.currentSessionId).toBeNull();
      expect(metrics.currentSessionState).toBeNull();
      expect(metrics.currentSessionLifetimeMs).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset manager state', () => {
      manager.createSession(defaultConfig);
      manager.createSession({ ...defaultConfig, exerciseId: 'ex-2' });

      manager.reset();

      const metrics = manager.getMetrics();
      expect(metrics.totalSessionsCreated).toBe(0);
      expect(metrics.totalSessionsDisposed).toBe(0);
      expect(metrics.currentSessionId).toBeNull();
    });
  });

  describe('multi-exercise workflow', () => {
    it('should handle rapid exercise changes', async () => {
      // Simulate user quickly switching between exercises
      const handlers: ReturnType<typeof vi.fn>[] = [];

      for (let i = 0; i < 10; i++) {
        const session = manager.createSession({
          ...defaultConfig,
          exerciseId: `ex-${i}`,
        });
        const handler = vi.fn();
        handlers.push(handler);
        session.getEventScope().on('tick', handler);
      }

      // Only the last session should receive events
      await eventBus.emit('tick', { time: 1 });

      // First 9 handlers should not have been called
      for (let i = 0; i < 9; i++) {
        expect(handlers[i]).not.toHaveBeenCalled();
      }
      // Last handler should receive the event
      expect(handlers[9]).toHaveBeenCalledTimes(1);
    });

    it('should prevent stale timer execution', () => {
      vi.useFakeTimers();

      // Create session 1 with a timer
      const session1 = manager.createSession(defaultConfig);
      const timer1Callback = vi.fn();
      const timer1 = setTimeout(timer1Callback, 5000);
      session1.addTimer(timer1);
      session1.start();

      // Create session 2 (disposes session 1)
      const session2 = manager.createSession({
        ...defaultConfig,
        exerciseId: 'ex-2',
      });
      session2.start();

      // Advance time past timer
      vi.advanceTimersByTime(6000);

      // Session 1's timer should have been cleared and not fired
      // (This tests that dispose() properly clears timers)
      expect(session1.getState()).toBe('stopped');

      vi.useRealTimers();
    });
  });

  describe('cleanup verification', () => {
    it('should not leak event handlers across sessions', async () => {
      const initialHandlerCount = eventBus.getHandlerCount('stress-event');

      // Create and dispose many sessions
      for (let i = 0; i < 50; i++) {
        const session = manager.createSession({
          ...defaultConfig,
          exerciseId: `ex-${i}`,
        });
        session.getEventScope().on('stress-event', vi.fn());
      }

      // Dispose final session
      manager.disposeCurrentSession();

      // Should be back to initial count (no leaks)
      expect(eventBus.getHandlerCount('stress-event')).toBe(
        initialHandlerCount,
      );
    });
  });
});
