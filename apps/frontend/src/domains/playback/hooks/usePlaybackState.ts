/**
 * usePlaybackState Hook
 *
 * Provides widgets with easy access to playback state and controls.
 * Optimized for widget consumption with minimal re-renders.
 *
 * Part of Story 2.1, Task 15: Enhanced Export Structure & Integration
 * Subtask 15.3: Enhance hook exports for widget consumption
 */

import { useCallback, useMemo } from 'react';
import { usePlaybackStore } from '../store/playbackStore.js';
import type { PlaybackState, AudioPerformanceMetrics } from '../types/audio.js';

// ============================================================================
// HOOK INTERFACE
// ============================================================================

export interface UsePlaybackStateReturn {
  // State
  playbackState: PlaybackState;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Performance
  performanceMetrics: AudioPerformanceMetrics | null;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  setTempo: (bpm: number) => void;
  setPitch: (semitones: number) => void;
  setVolume: (volume: number) => void;

  // Transport controls
  seek: (position: number) => void;

  // Convenience getters
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;

  // Sync information
  syncEvents: {
    beatCount: number;
    barCount: number;
    currentPosition: number;
    timeSignature: { numerator: number; denominator: number };
  };

  // Configuration access
  tempo: number;
  masterVolume: number;
  pitch: number;
  swingFactor: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for widgets to access and control playback state
 *
 * @param widgetId - Optional widget ID for tracking widget-specific state
 * @returns Playback state and control functions
 *
 * @example
 * ```tsx
 * function RhythmWidget() {
 *   const {
 *     isPlaying,
 *     play,
 *     pause,
 *     setTempo,
 *     tempo,
 *     isInitialized
 *   } = usePlaybackState('rhythm-widget');
 *
 *   const handlePlayPause = () => {
 *     if (isInitialized) {
 *       if (isPlaying) {
 *         pause();
 *       } else {
 *         play();
 *       }
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handlePlayPause}>
 *         {isPlaying ? 'Pause' : 'Play'}
 *       </button>
 *       <input
 *         type="range"
 *         value={tempo}
 *         onChange={(e) => setTempo(Number(e.target.value))}
 *         min={40}
 *         max={220}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlaybackState(widgetId?: string): UsePlaybackStateReturn {
  // State selectors - optimized to prevent unnecessary re-renders
  const playbackState = usePlaybackStore((state) => state.playbackState);
  const isInitialized = usePlaybackStore((state) => state.isInitialized);
  const isLoading = usePlaybackStore((state) => state.isLoading);
  const error = usePlaybackStore((state) => state.error);
  const performanceMetrics = usePlaybackStore(
    (state) => state.performanceMetrics,
  );
  const syncEvents = usePlaybackStore((state) => state.syncEvents);
  const config = usePlaybackStore((state) => state.config);

  // Action selectors
  const setPlaybackState = usePlaybackStore((state) => state.setPlaybackState);
  const setTempo = usePlaybackStore((state) => state.setTempo);
  const setPitch = usePlaybackStore((state) => state.setPitch);
  const setMasterVolume = usePlaybackStore((state) => state.setMasterVolume);
  const updateSyncPosition = usePlaybackStore(
    (state) => state.updateSyncPosition,
  );

  // Convenience state calculations
  const isPlaying = useMemo(() => playbackState === 'playing', [playbackState]);
  const isPaused = useMemo(() => playbackState === 'paused', [playbackState]);
  const isStopped = useMemo(() => playbackState === 'stopped', [playbackState]);

  // Control functions - memoized to prevent recreation on every render
  const play = useCallback(() => {
    if (isInitialized && !isPlaying) {
      setPlaybackState('playing');

      // Log widget usage for analytics if widgetId provided
      if (widgetId) {
        console.debug(`Widget ${widgetId} started playback`);
      }
    }
  }, [isInitialized, isPlaying, setPlaybackState, widgetId]);

  const pause = useCallback(() => {
    if (isInitialized && isPlaying) {
      setPlaybackState('paused');

      if (widgetId) {
        console.debug(`Widget ${widgetId} paused playback`);
      }
    }
  }, [isInitialized, isPlaying, setPlaybackState, widgetId]);

  const stop = useCallback(() => {
    if (isInitialized) {
      setPlaybackState('stopped');

      if (widgetId) {
        console.debug(`Widget ${widgetId} stopped playback`);
      }
    }
  }, [isInitialized, setPlaybackState, widgetId]);

  const setTempoWrapper = useCallback(
    (bpm: number) => {
      if (bpm >= 40 && bpm <= 220) {
        setTempo(bpm);

        if (widgetId) {
          console.debug(`Widget ${widgetId} set tempo to ${bpm} BPM`);
        }
      }
    },
    [setTempo, widgetId],
  );

  const setPitchWrapper = useCallback(
    (semitones: number) => {
      if (semitones >= -12 && semitones <= 12) {
        setPitch(semitones);

        if (widgetId) {
          console.debug(
            `Widget ${widgetId} set pitch to ${semitones} semitones`,
          );
        }
      }
    },
    [setPitch, widgetId],
  );

  const setVolume = useCallback(
    (volume: number) => {
      if (volume >= 0 && volume <= 1) {
        setMasterVolume(volume);

        if (widgetId) {
          console.debug(`Widget ${widgetId} set volume to ${volume}`);
        }
      }
    },
    [setMasterVolume, widgetId],
  );

  const seek = useCallback(
    (position: number) => {
      if (position >= 0) {
        updateSyncPosition(position);

        if (widgetId) {
          console.debug(`Widget ${widgetId} seeked to position ${position}`);
        }
      }
    },
    [updateSyncPosition, widgetId],
  );

  // Memoized return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      // State
      playbackState,
      isInitialized,
      isLoading,
      error,

      // Performance
      performanceMetrics,

      // Actions
      play,
      pause,
      stop,
      setTempo: setTempoWrapper,
      setPitch: setPitchWrapper,
      setVolume,

      // Transport controls
      seek,

      // Convenience getters
      isPlaying,
      isPaused,
      isStopped,

      // Sync information
      syncEvents,

      // Configuration access
      tempo: config.tempo,
      masterVolume: config.masterVolume,
      pitch: config.pitch,
      swingFactor: config.swingFactor,
    }),
    [
      playbackState,
      isInitialized,
      isLoading,
      error,
      performanceMetrics,
      play,
      pause,
      stop,
      setTempoWrapper,
      setPitchWrapper,
      setVolume,
      seek,
      isPlaying,
      isPaused,
      isStopped,
      syncEvents,
      config.tempo,
      config.masterVolume,
      config.pitch,
      config.swingFactor,
    ],
  );
}
