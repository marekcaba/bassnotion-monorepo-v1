/**
 * PlaybackSessionManager - Lifecycle Controller for Playback Sessions
 *
 * Part of the PlaybackSession architecture to solve the "Singleton Soup" problem.
 *
 * KEY INVARIANT:
 * Only ONE session can be active at a time. Creating a new session MUST
 * dispose the old one first. This prevents state leakage between runs.
 *
 * LIFECYCLE:
 * 1. createSession(config) → Disposes old session, creates fresh one
 * 2. getCurrentSession() → Returns active session (or null)
 * 3. disposeCurrentSession() → Explicitly dispose without creating new
 *
 * USAGE:
 * ```typescript
 * import { playbackSessionManager } from './PlaybackSessionManager';
 *
 * // On exercise load/change
 * const session = playbackSessionManager.createSession({
 *   exerciseId: 'ex-123',
 *   exercise: exerciseData,
 * });
 *
 * // Start playback
 * session.start();
 *
 * // On component unmount or exercise change
 * playbackSessionManager.disposeCurrentSession();
 * ```
 */

import { EventBus } from './EventBus.js';
import { PlaybackSession, PlaybackSessionConfig } from './PlaybackSession.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('PlaybackSessionManager');

export interface SessionMetrics {
  totalSessionsCreated: number;
  totalSessionsDisposed: number;
  currentSessionId: string | null;
  currentSessionState: string | null;
  currentSessionLifetimeMs: number | null;
}

export class PlaybackSessionManager {
  private currentSession: PlaybackSession | null = null;
  private eventBus: EventBus;

  // Metrics for debugging
  private totalSessionsCreated = 0;
  private totalSessionsDisposed = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    logger.info('PlaybackSessionManager initialized');
  }

  /**
   * Create a new playback session.
   *
   * CRITICAL: This disposes any existing session FIRST to prevent
   * state leakage from previous runs.
   */
  createSession(config: PlaybackSessionConfig): PlaybackSession {
    logger.info('Creating new session', {
      exerciseId: config.exerciseId,
      previousSession: this.currentSession?.id ?? null,
    });

    // CRITICAL: Dispose previous session BEFORE creating new one
    if (this.currentSession) {
      logger.info('Disposing previous session before creating new', {
        previousSessionId: this.currentSession.id,
        previousState: this.currentSession.getState(),
        previousMetrics: this.currentSession.getMetrics(),
      });

      this.currentSession.dispose();
      this.totalSessionsDisposed++;
    }

    // Create fresh session with clean state
    this.currentSession = new PlaybackSession(config, this.eventBus);
    this.totalSessionsCreated++;

    logger.info('New session created', {
      sessionId: this.currentSession.id,
      totalCreated: this.totalSessionsCreated,
      totalDisposed: this.totalSessionsDisposed,
    });

    // Emit session change event for systems that need to react
    this.eventBus.emit('session:created', {
      sessionId: this.currentSession.id,
      exerciseId: config.exerciseId,
    });

    return this.currentSession;
  }

  /**
   * Get the current active session.
   * Returns null if no session is active.
   */
  getCurrentSession(): PlaybackSession | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active session.
   */
  hasActiveSession(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Check if the current session is playing.
   */
  isPlaying(): boolean {
    return this.currentSession?.getState() === 'playing';
  }

  /**
   * Dispose the current session without creating a new one.
   * Use this on component unmount or when leaving a page.
   */
  disposeCurrentSession(): void {
    if (!this.currentSession) {
      logger.debug('No session to dispose');
      return;
    }

    logger.info('Disposing current session', {
      sessionId: this.currentSession.id,
      state: this.currentSession.getState(),
      metrics: this.currentSession.getMetrics(),
    });

    const sessionId = this.currentSession.id;
    this.currentSession.dispose();
    this.currentSession = null;
    this.totalSessionsDisposed++;

    // Emit session disposed event
    this.eventBus.emit('session:disposed', { sessionId });

    logger.info('Session disposed', {
      sessionId,
      totalCreated: this.totalSessionsCreated,
      totalDisposed: this.totalSessionsDisposed,
    });
  }

  /**
   * Get metrics for debugging.
   */
  getMetrics(): SessionMetrics {
    return {
      totalSessionsCreated: this.totalSessionsCreated,
      totalSessionsDisposed: this.totalSessionsDisposed,
      currentSessionId: this.currentSession?.id ?? null,
      currentSessionState: this.currentSession?.getState() ?? null,
      currentSessionLifetimeMs: this.currentSession
        ? Date.now() - this.currentSession.createdAt
        : null,
    };
  }

  /**
   * Reset manager state (for testing only).
   */
  reset(): void {
    logger.warn(
      'Resetting PlaybackSessionManager - this should only be used in tests',
    );
    this.disposeCurrentSession();
    this.totalSessionsCreated = 0;
    this.totalSessionsDisposed = 0;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

// Lazy initialization to avoid circular dependency issues
let _instance: PlaybackSessionManager | null = null;

/**
 * Get the singleton PlaybackSessionManager instance.
 * Lazily initialized to avoid circular dependencies during module loading.
 */
export function getPlaybackSessionManager(): PlaybackSessionManager {
  if (!_instance) {
    // Import EventBus lazily to avoid circular dependency
    // Use getGlobalInstance() which is the correct way to get the EventBus singleton
    const { EventBus: EventBusClass } = require('./EventBus.js');
    const eventBus = EventBusClass.getGlobalInstance();
    _instance = new PlaybackSessionManager(eventBus);

    // Expose to window for debugging
    if (typeof window !== 'undefined') {
      (
        window as unknown as Record<string, unknown>
      ).__bassnotion_sessionManager = _instance;
    }
  }
  return _instance;
}

/**
 * Convenience export for direct import.
 * Note: Use getPlaybackSessionManager() if you need guaranteed initialization order.
 */
export const playbackSessionManager = {
  get instance(): PlaybackSessionManager {
    return getPlaybackSessionManager();
  },

  createSession(config: PlaybackSessionConfig): PlaybackSession {
    return getPlaybackSessionManager().createSession(config);
  },

  getCurrentSession(): PlaybackSession | null {
    return getPlaybackSessionManager().getCurrentSession();
  },

  hasActiveSession(): boolean {
    return getPlaybackSessionManager().hasActiveSession();
  },

  isPlaying(): boolean {
    return getPlaybackSessionManager().isPlaying();
  },

  disposeCurrentSession(): void {
    getPlaybackSessionManager().disposeCurrentSession();
  },

  getMetrics(): SessionMetrics {
    return getPlaybackSessionManager().getMetrics();
  },
};
