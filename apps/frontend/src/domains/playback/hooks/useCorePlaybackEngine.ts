/**
 * useCorePlaybackEngine - Compatibility Wrapper
 *
 * This is a compatibility wrapper that maintains the old API while using
 * the new useCoreServices hook internally. This allows for gradual migration
 * of widgets to the new API.
 *
 * @deprecated Use useCoreServices instead for new code
 */

import { useMemo } from 'react';
import { useCoreServices } from './useCoreServices.js';
import { logger } from '../utils/logger.js';
import type {
  PlaybackState,
  AudioContextState,
  CorePlaybackEngineConfig,
  AudioSourceConfig,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from '../types/audio';

// Log deprecation warning once
let hasLoggedDeprecation = false;

export interface UseCorePlaybackEngineOptions {
  autoInitialize?: boolean;
  enablePerformanceMonitoring?: boolean;
  mobileOptimized?: boolean;
  onError?: (error: Error) => void;
  onPerformanceAlert?: (alert: PerformanceAlert) => void;
}

export interface PlaybackControls {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setMasterVolume: (volume: number) => void;
  setTempo: (bpm: number) => void;
  setPitch: (semitones: number) => void;
  setSwingFactor: (factor: number) => void;
  registerAudioSource: (config: AudioSourceConfig) => Promise<void>;
  unregisterAudioSource: (sourceId: string) => void;
  setSourceVolume: (sourceId: string, volume: number) => void;
  setSourceMute: (sourceId: string, muted: boolean) => void;
  setSourceSolo: (sourceId: string, solo: boolean) => void;
}

export interface PlaybackEngineState {
  playbackState: PlaybackState;
  audioContextState: AudioContextState;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  config: CorePlaybackEngineConfig;
  performanceMetrics: AudioPerformanceMetrics | null;
  performanceAlerts: PerformanceAlert[];
  canPlay: boolean;
  isPlaying: boolean;
  hasError: boolean;
  hasCriticalAlerts: boolean;
}

export interface UseCorePlaybackEngineReturn {
  state: PlaybackEngineState;
  controls: PlaybackControls;
  engine: any | null; // Legacy compatibility
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
}

/**
 * Legacy hook for backward compatibility
 * @deprecated Use useCoreServices instead
 */
export function useCorePlaybackEngine(
  options: UseCorePlaybackEngineOptions = {},
): UseCorePlaybackEngineReturn {
  // Log deprecation warning once
  if (!hasLoggedDeprecation) {
    logger.warn(
      '⚠️ useCorePlaybackEngine is deprecated. Please migrate to useCoreServices for better performance and features.',
    );
    hasLoggedDeprecation = true;
  }

  // Use the new hook internally
  const { state, controls, services, initialize, dispose } =
    useCoreServices(options);

  // Create a fake engine object for backward compatibility
  const fakeEngine = useMemo(
    () => ({
      // Provide methods that might be called on the engine directly
      play: controls.play,
      pause: controls.pause,
      stop: controls.stop,
      seek: controls.seek,
      setMasterVolume: controls.setMasterVolume,
      setTempo: controls.setTempo,
      setPitch: controls.setPitch,
      setSwingFactor: controls.setSwingFactor,
      registerAudioSource: controls.registerAudioSource,
      unregisterAudioSource: controls.unregisterAudioSource,
      setSourceVolume: controls.setSourceVolume,
      setSourceMute: controls.setSourceMute,
      setSourceSolo: controls.setSourceSolo,
      getPerformanceMetrics: () => state.performanceMetrics,
      // Add event emitter methods for compatibility
      on: () => () => {}, // Return empty unsubscribe
      emit: () => {},
      // Instance method
      getInstance: () => fakeEngine,
    }),
    [controls, state.performanceMetrics],
  );

  // Return in the old format
  return {
    state,
    controls,
    engine: state.isInitialized ? fakeEngine : null,
    initialize,
    dispose,
  };
}
