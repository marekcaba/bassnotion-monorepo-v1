'use client';

/**
 * usePlaybackMachine - React hook for XState playback machine
 *
 * Phase 5: Enhanced with DevTools integration
 *
 * This hook provides React integration for the playback state machine.
 * In shadow mode, it runs alongside the existing PlaybackEngine for comparison.
 *
 * Features:
 * - Full XState machine integration
 * - DevTools inspector connection for visual debugging
 * - State history tracking with timing metrics
 * - Shadow mode comparison with real PlaybackEngine
 */

import { useMachine } from '@xstate/react';
import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  playbackMachine,
  type MachineTrack,
  type PlaybackMachineContext,
  type PlaybackMachineInput,
} from './playbackMachine.js';
import type { EventBus } from '../services/core/EventBus.js';
import {
  getInspector,
  isDevToolsInitialized,
  createStateLogger,
  registerActor,
  unregisterActor,
  type StateHistoryTracker,
} from './devtools.js';

// ============================================================================
// Types
// ============================================================================

export interface UsePlaybackMachineOptions {
  eventBus?: EventBus | null;
  instanceId?: string;
  /** Enable shadow mode logging (compares with real PlaybackEngine) */
  shadowMode?: boolean;
  /** Enable DevTools inspector connection */
  enableInspector?: boolean;
  /** External state history tracker (from XStateDevToolsProvider) */
  historyTracker?: StateHistoryTracker | null;
}

export interface UsePlaybackMachineReturn {
  // Current state
  state: string;
  context: PlaybackMachineContext;

  // State checks
  isIdle: boolean;
  isLoading: boolean;
  isReady: boolean;
  isStarting: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isStopping: boolean;
  isStopped: boolean;
  isError: boolean;
  isDisposing: boolean;

  // Derived state
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;

  // Actions
  initialize: (audioContext: AudioContext, audioDestination: AudioNode) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dispose: () => void;
  registerTrack: (track: MachineTrack) => void;
  unregisterTrack: (trackId: string) => void;
  updateTracks: (tracks: MachineTrack[], harmonyInstrument?: string) => void;
  setTempo: (bpm: number) => void;
  setCountdown: (beats: number, enabled: boolean) => void;
  retry: () => void;
  forceReady: () => void;

  // For advanced usage / debugging
  send: ReturnType<typeof useMachine<typeof playbackMachine>>[1];
  actorRef: ReturnType<typeof useMachine<typeof playbackMachine>>[2];
}

// ============================================================================
// Constants
// ============================================================================

const MACHINE_NAME = 'PlaybackMachine';
const logger = createStateLogger(MACHINE_NAME, '#7c3aed');

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePlaybackMachine(
  options: UsePlaybackMachineOptions = {},
): UsePlaybackMachineReturn {
  const {
    eventBus,
    instanceId,
    shadowMode = true,
    enableInspector = true,
    historyTracker,
  } = options;

  // Track previous state for transition logging
  const prevStateRef = useRef<string | null>(null);
  const actorIdRef = useRef<string>(instanceId || `playback-${Date.now()}`);

  // Create machine input
  const input: PlaybackMachineInput = useMemo(
    () => ({
      eventBus: eventBus ?? undefined,
      instanceId,
    }),
    [eventBus, instanceId],
  );

  // Get inspector for DevTools connection
  const inspector =
    enableInspector && isDevToolsInitialized() ? getInspector() : null;

  // Create machine with input and optional inspector
  const [state, send, actorRef] = useMachine(playbackMachine, {
    input,
    inspect: inspector?.inspect,
  });

  // Register actor with DevTools on mount
  useEffect(() => {
    if (actorRef && enableInspector && isDevToolsInitialized()) {
      registerActor(actorIdRef.current, actorRef);
      logger.log(`Actor registered: ${actorIdRef.current}`);
    }

    return () => {
      if (enableInspector && isDevToolsInitialized()) {
        unregisterActor(actorIdRef.current);
      }
    };
  }, [actorRef, enableInspector]);

  // Track state transitions and log to history
  useEffect(() => {
    const currentState = state.value as string;
    const prevState = prevStateRef.current;

    if (prevState && prevState !== currentState) {
      // Log transition
      logger.logTransition(prevState, currentState);

      // Record in history tracker if available
      if (historyTracker) {
        historyTracker.record(currentState, undefined, {
          instanceId: state.context.instanceId,
          tracksCount: state.context.tracks.size,
          tempo: state.context.currentTempo,
        });
      }

      // Also record in global window tracker if available
      if (
        typeof window !== 'undefined' &&
        (window as WindowWithHistory).__xstatePlaybackHistory
      ) {
        (window as WindowWithHistory).__xstatePlaybackHistory.record(
          currentState,
          undefined,
          {
            instanceId: state.context.instanceId,
            tracksCount: state.context.tracks.size,
            tempo: state.context.currentTempo,
          },
        );
      }
    }

    prevStateRef.current = currentState;
  }, [state, historyTracker]);

  // Shadow mode: Log state changes for comparison
  useEffect(() => {
    if (shadowMode) {
      console.log('[PlaybackMachine Shadow]', {
        state: state.value,
        context: {
          instanceId: state.context.instanceId,
          tracksCount: state.context.tracks.size,
          tempo: state.context.currentTempo,
          hasAudioContext: !!state.context.audioContext,
          error: state.context.error?.message,
        },
      });
    }
  }, [state, shadowMode]);

  // State checks using selectors for performance
  const isIdle = state.matches('idle');
  const isLoading = state.matches('loading');
  const isReady = state.matches('ready');
  const isStarting = state.matches('starting');
  const isPlaying = state.matches('playing');
  const isPaused = state.matches('paused');
  const isStopping = state.matches('stopping');
  const isStopped = state.matches('stopped');
  const isError = state.matches('error');
  const isDisposing = state.matches('disposing');

  // Derived state
  const canStart = isReady || isStopped;
  const canPause = isPlaying;
  const canResume = isPaused;
  const canStop = isPlaying || isPaused || isStarting;

  // Memoized action creators with event logging
  const initialize = useCallback(
    (audioContext: AudioContext, audioDestination: AudioNode) => {
      logger.logEvent('INITIALIZE', { hasAudioContext: !!audioContext });
      send({ type: 'INITIALIZE', audioContext, audioDestination });
    },
    [send],
  );

  const start = useCallback(() => {
    logger.logEvent('START');
    send({ type: 'START' });
  }, [send]);

  const pause = useCallback(() => {
    logger.logEvent('PAUSE');
    send({ type: 'PAUSE' });
  }, [send]);

  const resume = useCallback(() => {
    logger.logEvent('RESUME');
    send({ type: 'RESUME' });
  }, [send]);

  const stop = useCallback(() => {
    logger.logEvent('STOP');
    send({ type: 'STOP' });
  }, [send]);

  const dispose = useCallback(() => {
    logger.logEvent('DISPOSE');
    send({ type: 'DISPOSE' });
  }, [send]);

  const registerTrack = useCallback(
    (track: MachineTrack) => {
      logger.logEvent('REGISTER_TRACK', {
        trackId: track.id,
        type: track.type,
      });
      send({ type: 'REGISTER_TRACK', track });
    },
    [send],
  );

  const unregisterTrack = useCallback(
    (trackId: string) => {
      logger.logEvent('UNREGISTER_TRACK', { trackId });
      send({ type: 'UNREGISTER_TRACK', trackId });
    },
    [send],
  );

  const updateTracks = useCallback(
    (tracks: MachineTrack[], harmonyInstrument?: string) => {
      logger.logEvent('UPDATE_TRACKS', {
        tracksCount: tracks.length,
        harmonyInstrument,
      });
      send({ type: 'UPDATE_TRACKS', tracks, harmonyInstrument });
    },
    [send],
  );

  const setTempo = useCallback(
    (bpm: number) => {
      logger.logEvent('SET_TEMPO', { bpm });
      send({ type: 'SET_TEMPO', bpm });
    },
    [send],
  );

  const setCountdown = useCallback(
    (beats: number, enabled: boolean) => {
      logger.logEvent('SET_COUNTDOWN', { beats, enabled });
      send({ type: 'SET_COUNTDOWN', beats, enabled });
    },
    [send],
  );

  const retry = useCallback(() => {
    logger.logEvent('RETRY');
    send({ type: 'RETRY' });
  }, [send]);

  const forceReady = useCallback(() => {
    logger.logEvent('FORCE_READY');
    send({ type: 'FORCE_READY' });
  }, [send]);

  return {
    // Current state
    state: state.value as string,
    context: state.context,

    // State checks
    isIdle,
    isLoading,
    isReady,
    isStarting,
    isPlaying,
    isPaused,
    isStopping,
    isStopped,
    isError,
    isDisposing,

    // Derived state
    canStart,
    canPause,
    canResume,
    canStop,

    // Actions
    initialize,
    start,
    pause,
    resume,
    stop,
    dispose,
    registerTrack,
    unregisterTrack,
    updateTracks,
    setTempo,
    setCountdown,
    retry,
    forceReady,

    // For advanced usage
    send,
    actorRef,
  };
}

// ============================================================================
// Shadow Mode Comparison Hook
// ============================================================================

/**
 * useShadowComparison - Compares XState machine state with real PlaybackEngine
 *
 * Use this hook during migration to verify state consistency.
 *
 * State Equivalences:
 * - XState 'idle' (not initialized) is equivalent to real engine 'stopped' (initial state)
 * - XState 'starting' is an intermediate state while real engine is still in 'ready' or transitioning to 'playing'
 * - XState 'stopping' is an intermediate state while real engine transitions to 'stopped'
 * - XState 'loading' is an intermediate state during initialization
 * - XState 'disposing' is an intermediate state transitioning back to 'idle'
 */
export function useShadowComparison(
  machineState: string,
  realEngineState: string | undefined,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !realEngineState) return;

    // Check for valid state equivalences
    // These are cases where XState and real engine can legitimately differ
    const isValidEquivalence = (): boolean => {
      // XState 'idle' (uninitialized) is equivalent to real engine 'stopped' (initial state)
      // This occurs at startup before the machine has been initialized with an AudioContext
      if (machineState === 'idle' && realEngineState === 'stopped') {
        return true;
      }

      // XState 'loading' can occur while real engine is in any initializing state
      if (machineState === 'loading') {
        return true;
      }

      // XState 'starting' is an async transition state
      // Real engine might be 'ready' (just started) or 'playing' (already transitioned)
      if (
        machineState === 'starting' &&
        (realEngineState === 'ready' || realEngineState === 'playing')
      ) {
        return true;
      }

      // XState 'stopping' is an async transition state
      // Real engine might be 'playing' (just stopped) or 'stopped' (already transitioned)
      if (
        machineState === 'stopping' &&
        (realEngineState === 'playing' || realEngineState === 'stopped')
      ) {
        return true;
      }

      // XState 'ready' can briefly occur when real engine is 'stopped'
      // This happens after initialization but before first play, or after stop
      if (machineState === 'ready' && realEngineState === 'stopped') {
        return true;
      }

      // XState 'disposing' is an async cleanup state transitioning to idle
      if (machineState === 'disposing') {
        return true;
      }

      // Direct state matches
      const directMatches: Record<string, string[]> = {
        idle: ['idle'],
        ready: ['ready'],
        playing: ['playing'],
        paused: ['paused'],
        stopped: ['stopped'],
        error: ['error'],
      };

      const validMatches = directMatches[machineState];
      if (validMatches && validMatches.includes(realEngineState)) {
        return true;
      }

      return false;
    };

    if (!isValidEquivalence()) {
      console.warn('[PlaybackMachine Shadow] State mismatch!', {
        xstate: machineState,
        realEngine: realEngineState,
        hint: 'This may indicate a state synchronization issue between XState and PlaybackEngine',
      });
    }
  }, [machineState, realEngineState, enabled]);
}

// ============================================================================
// Window Type Extension
// ============================================================================

interface WindowWithHistory extends Window {
  __xstatePlaybackHistory?: {
    record: (
      state: string,
      event?: string,
      context?: Record<string, unknown>,
    ) => void;
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { MachineTrack, PlaybackMachineContext };
