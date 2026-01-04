/**
 * useTrackMigration Hook
 *
 * Migration adapter that provides a usePlaybackState-compatible interface
 * while using the modern useTrack hook underneath.
 *
 * This allows widgets to migrate gradually from usePlaybackState to useTrack.
 */

import { useMemo, useCallback } from 'react';
import { useTrack } from './useTrack.js';
import { usePlaybackStore } from '../store/playbackStore';
import type { InstrumentType } from '../types/track.js';
import type { PlaybackState, AudioPerformanceMetrics } from '../types/audio';
import { createStructuredLogger } from '../modules/shared/index.js';

const logger = createStructuredLogger('useTrackMigration');

export interface UseTrackMigrationOptions {
  /** Widget ID for backward compatibility */
  widgetId: string;
  /** Track type - defaults to 'instrument' */
  trackType?: InstrumentType;
  /** Enable debug mode */
  debug?: boolean;
}

export interface UseTrackMigrationReturn {
  // State (matching usePlaybackState)
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

  // New useTrack features exposed
  track: ReturnType<typeof useTrack>['track'];
  trackId: string;
  regions: ReturnType<typeof useTrack>['regions'];
  addRegion: ReturnType<typeof useTrack>['addRegion'];
  removeRegion: ReturnType<typeof useTrack>['removeRegion'];
}

/**
 * Migration hook that provides backward compatibility for widgets
 * transitioning from usePlaybackState to useTrack
 *
 * @example
 * ```tsx
 * // Old way:
 * const playback = usePlaybackState('drum-widget');
 *
 * // Migration way:
 * const playback = useTrackMigration({ widgetId: 'drum-widget' });
 *
 * // New way (final):
 * const { track, play, stop } = useTrack({
 *   trackId: 'drum-widget',
 *   name: 'Drums',
 *   type: 'drums'
 * });
 * ```
 */
export function useTrackMigration(
  options: UseTrackMigrationOptions,
): UseTrackMigrationReturn {
  const { widgetId, trackType = 'instrument', debug = false } = options;

  // Use the modern useTrack hook
  const trackData = useTrack({
    trackId: widgetId,
    name: widgetId,
    type: trackType,
    autoInit: true,
    debugMode: debug,
  });

  // Get global store data for backward compatibility
  const performanceMetrics = usePlaybackStore(
    (state) => state.performanceMetrics,
  );
  const globalConfig = usePlaybackStore((state) => state.config);
  const globalSyncEvents = usePlaybackStore((state) => state.syncEvents);
  const setGlobalTempo = usePlaybackStore((state) => state.setTempo);
  const setPitch = usePlaybackStore((state) => state.setPitch);

  // Map track state to playback state
  const playbackState = useMemo<PlaybackState>(() => {
    if (trackData.isPlaying) return 'playing';
    if (trackData.state === 4) return 'paused'; // TrackState.PAUSED
    return 'stopped';
  }, [trackData.isPlaying, trackData.state]);

  // Error handling
  const errorString = useMemo(() => {
    return trackData.error?.message || null;
  }, [trackData.error]);

  // Convenience getters
  const isPlaying = trackData.isPlaying;
  const isPaused = playbackState === 'paused';
  const isStopped = playbackState === 'stopped';

  // Actions with logging
  const play = useCallback(() => {
    trackData.play();
    if (debug) {
      logger.debug(`Widget ${widgetId} started playback (via migration)`);
    }
  }, [trackData, widgetId, debug]);

  const pause = useCallback(() => {
    trackData.pause();
    if (debug) {
      logger.debug(`Widget ${widgetId} paused playback (via migration)`);
    }
  }, [trackData, widgetId, debug]);

  const stop = useCallback(() => {
    trackData.stop();
    if (debug) {
      logger.debug(`Widget ${widgetId} stopped playback (via migration)`);
    }
  }, [trackData, widgetId, debug]);

  const setVolume = useCallback(
    (volume: number) => {
      trackData.setVolume(volume);
      if (debug) {
        logger.debug(
          `Widget ${widgetId} set volume to ${volume} (via migration)`,
        );
      }
    },
    [trackData, widgetId, debug],
  );

  const setTempo = useCallback(
    (bpm: number) => {
      // Set global tempo (affects all tracks)
      if (bpm >= 40 && bpm <= 220) {
        setGlobalTempo(bpm);
        if (debug) {
          logger.debug(
            `Widget ${widgetId} set tempo to ${bpm} BPM (via migration)`,
          );
        }
      }
    },
    [setGlobalTempo, widgetId, debug],
  );

  const seek = useCallback(
    (position: number) => {
      // Transport seek is not directly available in track
      // This would need to be implemented through transport
      logger.warn('Seek not implemented in migration layer', {
        widgetId,
        position,
      });
    },
    [widgetId],
  );

  // Build sync events from track data
  const syncEvents = useMemo(
    () => ({
      beatCount: trackData.currentTime * (trackData.tempo / 60), // Convert time to beats
      barCount: Math.floor(
        (trackData.currentTime * (trackData.tempo / 60)) / 4,
      ), // 4/4 time
      currentPosition: trackData.currentTime,
      timeSignature: globalSyncEvents.timeSignature,
    }),
    [trackData.currentTime, trackData.tempo, globalSyncEvents.timeSignature],
  );

  return {
    // State (backward compatible)
    playbackState,
    isInitialized: trackData.isInitialized,
    isLoading: !trackData.isReady,
    error: errorString,

    // Performance
    performanceMetrics,

    // Actions
    play,
    pause,
    stop,
    setTempo,
    setPitch,
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
    tempo: trackData.tempo,
    currentTime: trackData.currentTime, // CRITICAL: Pass through currentTime for measure highlighting
    masterVolume: trackData.track?.mixing.volume || globalConfig.masterVolume,
    pitch: globalConfig.pitch,
    swingFactor: globalConfig.swingFactor,

    // New features exposed
    track: trackData.track,
    trackId: trackData.trackId,
    regions: trackData.regions,
    addRegion: trackData.addRegion,
    removeRegion: trackData.removeRegion,
  };
}

/**
 * Compatibility export - allows drop-in replacement
 */
export const usePlaybackStateMigrated = useTrackMigration;
