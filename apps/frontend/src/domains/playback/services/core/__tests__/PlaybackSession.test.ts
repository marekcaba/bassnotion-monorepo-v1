import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../EventBus.js';
import { PlaybackSession, PlaybackSessionConfig } from '../PlaybackSession.js';

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

describe('PlaybackSession', () => {
  let eventBus: EventBus;
  let defaultConfig: PlaybackSessionConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    eventBus = new EventBus();
    defaultConfig = {
      exerciseId: 'ex-test-123',
      exercise: {
        bpm: 95,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 4,
      },
      countdownEnabled: true,
      countdownBeats: 4,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('creation', () => {
    it('should create session with unique ID', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      expect(session.id).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(session.exerciseId).toBe('ex-test-123');
    });

    it('should start in idle state', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      expect(session.getState()).toBe('idle');
    });

    it('should apply default config values', () => {
      const minimalConfig: PlaybackSessionConfig = {
        exerciseId: 'minimal',
        exercise: {
          bpm: 120,
          timeSignature: { numerator: 4, denominator: 4 },
        },
      };

      const session = new PlaybackSession(minimalConfig, eventBus);

      // Session should be created without throwing
      expect(session.getState()).toBe('idle');
    });
  });

  describe('lifecycle - start', () => {
    it('should transition to playing state on start', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      session.start();

      expect(session.getState()).toBe('playing');
    });

    it('should emit session:start event', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:start', handler);

      session.start();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.id,
          exerciseId: 'ex-test-123',
        }),
        expect.any(Object),
      );
    });

    it('should ignore duplicate start calls', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:start', handler);

      session.start();
      session.start(); // Should be ignored

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle - stop', () => {
    it('should transition to stopped state', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      session.stop();

      expect(session.getState()).toBe('stopped');
    });

    it('should emit session:stop event', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:stop', handler);
      session.start();

      session.stop();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.id,
          graceful: false,
        }),
        expect.any(Object),
      );
    });

    it('should support graceful stop', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:stop', handler);
      session.start();

      session.stop(true);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ graceful: true }),
        expect.any(Object),
      );
    });

    it('should ignore duplicate stop calls', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:stop', handler);
      session.start();

      session.stop();
      session.stop(); // Should be ignored

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle - pause/resume', () => {
    it('should transition to paused state', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      session.pause();

      expect(session.getState()).toBe('paused');
    });

    it('should resume from paused state', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();
      session.pause();

      session.resume();

      expect(session.getState()).toBe('playing');
    });

    it('should not pause if not playing', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:pause', handler);

      session.pause(); // Should be ignored

      expect(session.getState()).toBe('idle');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not resume if not paused', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const handler = vi.fn();
      eventBus.on('session:resume', handler);
      session.start();

      session.resume(); // Should be ignored (already playing)

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle - dispose', () => {
    it('should stop playback on dispose', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      session.dispose();

      expect(session.getState()).toBe('stopped');
    });

    it('should clear all tracks', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.setTrack('track1', { type: 'bass' });
      session.setTrack('track2', { type: 'drums' });

      session.dispose();

      expect(session.getTrackIds()).toHaveLength(0);
    });
  });

  describe('timer management', () => {
    it('should track and clear timers on stop', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      // Add tracked timers
      const timer1 = setTimeout(() => {}, 10000);
      const timer2 = setTimeout(() => {}, 20000);
      session.addTimer(timer1);
      session.addTimer(timer2);

      session.stop();

      // Timers should have been cleared
      expect(session.getMetrics().timerCount).toBe(0);
    });
  });

  describe('scheduled event management', () => {
    it('should track and clear scheduled IDs on stop', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      // Add tracked scheduled IDs
      session.addScheduledId(100);
      session.addScheduledId(101);
      session.addScheduledId(102);

      session.stop();

      expect(session.getMetrics().scheduledCount).toBe(0);
    });
  });

  describe('audio source management', () => {
    it('should track and stop audio sources on stop', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      // Create mock audio sources
      const mockSource1 = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      } as unknown as AudioBufferSourceNode;
      const mockSource2 = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      } as unknown as AudioBufferSourceNode;

      session.addAudioSource(mockSource1);
      session.addAudioSource(mockSource2);

      session.stop();

      expect(mockSource1.stop).toHaveBeenCalledWith(0);
      expect(mockSource2.stop).toHaveBeenCalledWith(0);
      expect(session.getMetrics().sourceCount).toBe(0);
    });

    it('should auto-remove sources when they end naturally', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      const mockSource = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      } as unknown as AudioBufferSourceNode;

      session.addAudioSource(mockSource);
      expect(session.getMetrics().sourceCount).toBe(1);

      // Simulate natural end
      mockSource.onended?.();

      expect(session.getMetrics().sourceCount).toBe(0);
    });
  });

  describe('track management', () => {
    it('should store and retrieve tracks', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      const bassTrack = { type: 'bass', volume: 0.8 };
      session.setTrack('bass', bassTrack);

      expect(session.getTrack('bass')).toBe(bassTrack);
    });

    it('should list track IDs', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      session.setTrack('bass', {});
      session.setTrack('drums', {});
      session.setTrack('harmony', {});

      const ids = session.getTrackIds();
      expect(ids).toContain('bass');
      expect(ids).toContain('drums');
      expect(ids).toContain('harmony');
    });

    it('should return undefined for missing tracks', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      expect(session.getTrack('nonexistent')).toBeUndefined();
    });
  });

  describe('metrics', () => {
    it('should provide session metrics', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      session.start();

      session.setTrack('bass', {});
      session.addScheduledId(100);

      const mockSource = {
        stop: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      } as unknown as AudioBufferSourceNode;
      session.addAudioSource(mockSource);

      const metrics = session.getMetrics();

      expect(metrics.sessionId).toBe(session.id);
      expect(metrics.state).toBe('playing');
      expect(metrics.trackCount).toBe(1);
      expect(metrics.scheduledCount).toBe(1);
      expect(metrics.sourceCount).toBe(1);
      expect(metrics.lifetimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('event scope integration', () => {
    it('should provide event scope for scoped subscriptions', () => {
      const session = new PlaybackSession(defaultConfig, eventBus);

      const scope = session.getEventScope();

      expect(scope).toBeDefined();
      expect(typeof scope.on).toBe('function');
      expect(typeof scope.dispose).toBe('function');
    });

    it('should clean up event handlers on dispose', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const scope = session.getEventScope();

      const handler = vi.fn();
      scope.on('custom-event', handler);

      session.dispose();

      // Handler should be removed
      await eventBus.emit('custom-event', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('tempo change handling', () => {
    it('should handle tempo changes while playing', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const rescheduleHandler = vi.fn();
      eventBus.on('session:reschedule', rescheduleHandler);

      session.start();

      // Add some state to be cleared
      session.addScheduledId(100);
      session.addScheduledId(101);

      // Emit tempo change
      await eventBus.emit('transport:tempo-change', { bpm: 120 });

      // Should emit reschedule event
      expect(rescheduleHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.id,
          reason: 'tempo-change',
          newBpm: 120,
        }),
        expect.any(Object),
      );

      // Old scheduled events should be cleared
      expect(session.getMetrics().scheduledCount).toBe(0);
    });

    it('should ignore tempo changes when not playing', async () => {
      const session = new PlaybackSession(defaultConfig, eventBus);
      const rescheduleHandler = vi.fn();
      eventBus.on('session:reschedule', rescheduleHandler);

      // Not playing - in idle state
      await eventBus.emit('transport:tempo-change', { bpm: 120 });

      expect(rescheduleHandler).not.toHaveBeenCalled();
    });
  });

  describe('multi-session lifecycle', () => {
    it('should support multiple sequential sessions', async () => {
      // Simulate the workflow the architecture is designed for
      const session1Handler = vi.fn();
      const session2Handler = vi.fn();

      // Session 1
      const session1 = new PlaybackSession(defaultConfig, eventBus);
      session1.getEventScope().on('playback:tick', session1Handler);
      session1.start();

      await eventBus.emit('playback:tick', { time: 1 });
      expect(session1Handler).toHaveBeenCalledTimes(1);

      // Dispose session 1 (critical!)
      session1.dispose();

      // Session 2
      const session2 = new PlaybackSession(
        { ...defaultConfig, exerciseId: 'ex-2' },
        eventBus,
      );
      session2.getEventScope().on('playback:tick', session2Handler);
      session2.start();

      await eventBus.emit('playback:tick', { time: 2 });

      // Session 1 handler should NOT receive the second event
      expect(session1Handler).toHaveBeenCalledTimes(1);
      // Session 2 handler should receive its event
      expect(session2Handler).toHaveBeenCalledTimes(1);
    });
  });
});
