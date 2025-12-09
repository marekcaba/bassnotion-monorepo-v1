/**
 * usePlaybackSession - React Hook for Managing Playback Session Lifecycle
 *
 * This hook provides a clean interface to the PlaybackSessionManager, handling:
 * - Session creation when exercise changes
 * - Session disposal on component unmount
 * - Cleanup of all transient state (timers, scheduled events, audio sources)
 *
 * Usage:
 * ```typescript
 * const { session, createNewSession, disposeSession } = usePlaybackSession();
 *
 * // When exercise changes
 * useEffect(() => {
 *   if (exercise) {
 *     createNewSession({
 *       exerciseId: exercise.id,
 *       exercise: exercise,
 *     });
 *   }
 * }, [exercise?.id]);
 * ```
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { getLogger } from '@/utils/logger.js';
import {
  PlaybackSession,
  PlaybackSessionConfig,
  getPlaybackSessionManager,
  SessionMetrics,
} from '../services/core/index.js';

const logger = getLogger('usePlaybackSession');

export interface UsePlaybackSessionReturn {
  /** Current active session (or null if none) */
  session: PlaybackSession | null;
  /** Create a new session (disposes previous automatically) */
  createNewSession: (config: PlaybackSessionConfig) => PlaybackSession;
  /** Dispose current session without creating new */
  disposeSession: () => void;
  /** Check if there's an active session */
  hasActiveSession: boolean;
  /** Check if session is currently playing */
  isPlaying: boolean;
  /** Get session metrics for debugging */
  getMetrics: () => SessionMetrics;
}

/**
 * Hook for managing playback session lifecycle.
 * Automatically disposes session on component unmount.
 */
export function usePlaybackSession(): UsePlaybackSessionReturn {
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const mountedRef = useRef(true);

  // Get session manager instance
  const manager = getPlaybackSessionManager();

  // Create new session
  const createNewSession = useCallback(
    (config: PlaybackSessionConfig): PlaybackSession => {
      logger.info('Creating new playback session', {
        exerciseId: config.exerciseId,
        previousSessionId: session?.id ?? null,
      });

      const newSession = manager.createSession(config);

      if (mountedRef.current) {
        setSession(newSession);
      }

      return newSession;
    },
    [manager, session?.id],
  );

  // Dispose current session
  const disposeSession = useCallback(() => {
    logger.info('Disposing playback session', {
      sessionId: session?.id ?? null,
    });

    manager.disposeCurrentSession();

    if (mountedRef.current) {
      setSession(null);
    }
  }, [manager, session?.id]);

  // Sync session state from manager (in case external code modifies it)
  useEffect(() => {
    const currentSession = manager.getCurrentSession();
    if (currentSession !== session) {
      setSession(currentSession);
    }
  }, [manager, session]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Dispose session on unmount to prevent leaks
      const currentSession = manager.getCurrentSession();
      if (currentSession) {
        logger.info('Disposing session on unmount', {
          sessionId: currentSession.id,
        });
        manager.disposeCurrentSession();
      }
    };
  }, [manager]);

  // Get metrics
  const getMetrics = useCallback(() => {
    return manager.getMetrics();
  }, [manager]);

  return {
    session,
    createNewSession,
    disposeSession,
    hasActiveSession: manager.hasActiveSession(),
    isPlaying: manager.isPlaying(),
    getMetrics,
  };
}

/**
 * Hook for automatic session creation based on exercise.
 * Creates a new session when exercise ID changes.
 */
export function useExerciseSession(
  exerciseId: string | undefined,
  exercise: PlaybackSessionConfig['exercise'] | undefined,
  options: {
    countdownEnabled?: boolean;
    countdownBeats?: number;
  } = {},
): UsePlaybackSessionReturn {
  const sessionReturn = usePlaybackSession();
  const prevExerciseIdRef = useRef<string | undefined>(undefined);

  // Create session when exercise changes
  useEffect(() => {
    if (!exerciseId || !exercise) {
      // No exercise selected - dispose any existing session
      if (sessionReturn.hasActiveSession) {
        logger.info('No exercise selected, disposing session');
        sessionReturn.disposeSession();
      }
      prevExerciseIdRef.current = undefined;
      return;
    }

    // Check if exercise actually changed (not just re-render)
    if (exerciseId === prevExerciseIdRef.current) {
      return;
    }

    logger.info('Exercise changed, creating new session', {
      prevExerciseId: prevExerciseIdRef.current,
      newExerciseId: exerciseId,
    });

    prevExerciseIdRef.current = exerciseId;

    sessionReturn.createNewSession({
      exerciseId,
      exercise,
      countdownEnabled: options.countdownEnabled,
      countdownBeats: options.countdownBeats,
    });
  }, [
    exerciseId,
    exercise,
    options.countdownEnabled,
    options.countdownBeats,
    sessionReturn,
  ]);

  return sessionReturn;
}

export default usePlaybackSession;
