/**
 * useCorePlaybackEngine - Primary React Hook for Widget Consumption
 *
 * Provides unified interface for widgets to interact with the Core Audio Engine
 * while managing state synchronization and lifecycle.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

import { useEffect, useCallback, useRef } from 'react';
import { usePlaybackStore, playbackSelectors } from '../store/playbackStore.js';
import { CoreAudioEngine } from '../services/CoreAudioEngine.js';
import type {
  PlaybackState,
  AudioContextState,
  CoreAudioEngineConfig,
  AudioSourceConfig,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from '../types/audio.js';

export interface UseCorePlaybackEngineOptions {
  autoInitialize?: boolean; // Auto-initialize on first user interaction
  enablePerformanceMonitoring?: boolean; // Enable performance alerts
  mobileOptimized?: boolean; // Apply mobile-specific optimizations
  onError?: (error: Error) => void; // Error callback
  onPerformanceAlert?: (alert: PerformanceAlert) => void; // Performance alert callback
}

export interface PlaybackControls {
  // Playback control methods
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;

  // Configuration methods
  setMasterVolume: (volume: number) => void;
  setTempo: (bpm: number) => void;
  setPitch: (semitones: number) => void;
  setSwingFactor: (factor: number) => void;

  // Audio source management
  registerAudioSource: (config: AudioSourceConfig) => Promise<void>;
  unregisterAudioSource: (sourceId: string) => void;
  setSourceVolume: (sourceId: string, volume: number) => void;
  setSourceMute: (sourceId: string, muted: boolean) => void;
  setSourceSolo: (sourceId: string, solo: boolean) => void;
}

export interface PlaybackEngineState {
  // Engine state
  playbackState: PlaybackState;
  audioContextState: AudioContextState;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Configuration
  config: CoreAudioEngineConfig;

  // Performance metrics
  performanceMetrics: AudioPerformanceMetrics | null;
  performanceAlerts: PerformanceAlert[];

  // Computed state
  canPlay: boolean;
  isPlaying: boolean;
  hasError: boolean;
  hasCriticalAlerts: boolean;
}

export interface UseCorePlaybackEngineReturn {
  // State
  state: PlaybackEngineState;

  // Controls
  controls: PlaybackControls;

  // Engine instance (for advanced use)
  engine: CoreAudioEngine | null;

  // Initialization
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
}

export function useCorePlaybackEngine(
  options: UseCorePlaybackEngineOptions = {},
): UseCorePlaybackEngineReturn {
  const {
    autoInitialize = true,
    enablePerformanceMonitoring = true,
    mobileOptimized = true,
    onError,
    onPerformanceAlert,
  } = options;

  // Zustand store selectors
  const playbackState = usePlaybackStore((state) => state.playbackState);
  const audioContextState = usePlaybackStore(
    (state) => state.audioContextState,
  );
  const isInitialized = usePlaybackStore((state) => state.isInitialized);
  const isLoading = usePlaybackStore((state) => state.isLoading);
  const error = usePlaybackStore((state) => state.error);
  const config = usePlaybackStore((state) => state.config);
  const performanceMetrics = usePlaybackStore(
    (state) => state.performanceMetrics,
  );
  const performanceAlerts = usePlaybackStore(
    (state) => state.performanceAlerts,
  );

  // Zustand store actions
  const setInitialized = usePlaybackStore((state) => state.setInitialized);
  const setPlaybackState = usePlaybackStore((state) => state.setPlaybackState);
  const setAudioContextState = usePlaybackStore(
    (state) => state.setAudioContextState,
  );
  const setLoading = usePlaybackStore((state) => state.setLoading);
  const setError = usePlaybackStore((state) => state.setError);
  const updateConfig = usePlaybackStore((state) => state.updateConfig);
  const addAudioSource = usePlaybackStore((state) => state.addAudioSource);
  const removeAudioSource = usePlaybackStore(
    (state) => state.removeAudioSource,
  );
  const updateAudioSource = usePlaybackStore(
    (state) => state.updateAudioSource,
  );
  const updatePerformanceMetrics = usePlaybackStore(
    (state) => state.updatePerformanceMetrics,
  );
  const addPerformanceAlert = usePlaybackStore(
    (state) => state.addPerformanceAlert,
  );

  // Computed state using selectors
  const canPlay = usePlaybackStore(playbackSelectors.canPlay);
  const isPlaying = usePlaybackStore(playbackSelectors.isPlaying);
  const hasError = usePlaybackStore(playbackSelectors.hasError);
  const criticalAlerts = usePlaybackStore(playbackSelectors.criticalAlerts);

  // Engine instance ref
  const engineRef = useRef<CoreAudioEngine | null>(null);
  const unsubscribeRefs = useRef<Array<() => void>>([]);

  // Initialize engine
  const initialize = useCallback(async () => {
    if (isInitialized || isLoading) return;

    try {
      setLoading(true);
      setError(null);

      // Get engine instance
      if (!engineRef.current) {
        engineRef.current = CoreAudioEngine.getInstance();
      }

      const engine = engineRef.current;

      // Initialize engine
      await engine.initialize();

      // Set up event listeners
      const unsubscribeStateChange = engine.on('stateChange', (state) => {
        setPlaybackState(state);
      });

      const unsubscribeAudioContextChange = engine.on(
        'audioContextChange',
        (state) => {
          setAudioContextState(state);
        },
      );

      const unsubscribePerformanceAlert = engine.on(
        'performanceAlert',
        (alert) => {
          addPerformanceAlert(alert);
          if (enablePerformanceMonitoring && onPerformanceAlert) {
            onPerformanceAlert(alert);
          }
        },
      );

      const unsubscribeTempoChange = engine.on('tempoChange', (tempo) => {
        updateConfig({ tempo });
      });

      const unsubscribeMasterVolumeChange = engine.on(
        'masterVolumeChange',
        (volume) => {
          updateConfig({ masterVolume: volume });
        },
      );

      // Store unsubscribe functions
      unsubscribeRefs.current = [
        unsubscribeStateChange,
        unsubscribeAudioContextChange,
        unsubscribePerformanceAlert,
        unsubscribeTempoChange,
        unsubscribeMasterVolumeChange,
      ];

      // Set up performance monitoring
      if (enablePerformanceMonitoring) {
        const updateMetrics = () => {
          const metrics = engine.getPerformanceMetrics();
          updatePerformanceMetrics(metrics);
        };

        const metricsInterval = setInterval(updateMetrics, 1000);
        unsubscribeRefs.current.push(() => clearInterval(metricsInterval));
      }

      // Apply mobile optimizations
      if (mobileOptimized) {
        // Mobile-specific configurations can be applied here
        // This will be expanded in Task 5
      }

      setInitialized(true);
      setLoading(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown initialization error';
      setError(errorMessage);
      setLoading(false);

      if (onError && error instanceof Error) {
        onError(error);
      }

      throw error;
    }
  }, [
    isInitialized,
    isLoading,
    setLoading,
    setError,
    setInitialized,
    setPlaybackState,
    setAudioContextState,
    addPerformanceAlert,
    updateConfig,
    updatePerformanceMetrics,
    enablePerformanceMonitoring,
    mobileOptimized,
    onError,
    onPerformanceAlert,
  ]);

  // Dispose engine
  const dispose = useCallback(async () => {
    if (!engineRef.current || !isInitialized) return;

    try {
      // Clean up event listeners
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
      unsubscribeRefs.current = [];

      // Dispose engine
      await engineRef.current.dispose();
      engineRef.current = null;

      // Reset store state
      setInitialized(false);
      setPlaybackState('stopped');
      setAudioContextState('suspended');
      setError(null);
    } catch (error) {
      console.error('Error disposing audio engine:', error);
    }
  }, [
    isInitialized,
    setInitialized,
    setPlaybackState,
    setAudioContextState,
    setError,
  ]);

  // Playback controls
  const controls: PlaybackControls = {
    play: useCallback(async () => {
      if (!engineRef.current || !canPlay) return;
      await engineRef.current.play();
    }, [canPlay]),

    pause: useCallback(async () => {
      if (!engineRef.current || !isInitialized) return;
      await engineRef.current.pause();
    }, [isInitialized]),

    stop: useCallback(async () => {
      if (!engineRef.current || !isInitialized) return;
      await engineRef.current.stop();
    }, [isInitialized]),

    setMasterVolume: useCallback(
      (volume: number) => {
        if (!engineRef.current || !isInitialized) return;
        engineRef.current.setMasterVolume(volume);
      },
      [isInitialized],
    ),

    setTempo: useCallback(
      (bpm: number) => {
        if (!engineRef.current || !isInitialized) return;
        engineRef.current.setTempo(bpm);
      },
      [isInitialized],
    ),

    setPitch: useCallback(
      (semitones: number) => {
        if (!engineRef.current || !isInitialized) return;
        engineRef.current.setPitch(semitones);
      },
      [isInitialized],
    ),

    setSwingFactor: useCallback(
      (factor: number) => {
        if (!engineRef.current || !isInitialized) return;
        updateConfig({ swingFactor: factor });
      },
      [isInitialized, updateConfig],
    ),

    registerAudioSource: useCallback(
      async (sourceConfig: AudioSourceConfig) => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.registerAudioSource(sourceConfig);
        addAudioSource(sourceConfig);
      },
      [isInitialized, addAudioSource],
    ),

    unregisterAudioSource: useCallback(
      (sourceId: string) => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.unregisterAudioSource(sourceId);
        removeAudioSource(sourceId);
      },
      [isInitialized, removeAudioSource],
    ),

    setSourceVolume: useCallback(
      (sourceId: string, volume: number) => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceVolume(sourceId, volume);
        updateAudioSource(sourceId, { volume });
      },
      [isInitialized, updateAudioSource],
    ),

    setSourceMute: useCallback(
      (sourceId: string, muted: boolean) => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceMute(sourceId, muted);
        updateAudioSource(sourceId, { muted });
      },
      [isInitialized, updateAudioSource],
    ),

    setSourceSolo: useCallback(
      (sourceId: string, solo: boolean) => {
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceSolo(sourceId, solo);
        updateAudioSource(sourceId, { solo });
      },
      [isInitialized, updateAudioSource],
    ),
  };

  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      // Wait for first user interaction to initialize
      const handleFirstInteraction = () => {
        initialize().catch(console.error);
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
      };

      document.addEventListener('click', handleFirstInteraction);
      document.addEventListener('touchstart', handleFirstInteraction);

      return () => {
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
      };
    }
    
    // Return undefined explicitly when condition is not met
    return undefined;
  }, [autoInitialize, isInitialized, isLoading, initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose().catch(console.error);
    };
  }, [dispose]);

  // Assembled state
  const state: PlaybackEngineState = {
    playbackState,
    audioContextState,
    isInitialized,
    isLoading,
    error,
    config,
    performanceMetrics,
    performanceAlerts,
    canPlay,
    isPlaying,
    hasError,
    hasCriticalAlerts: criticalAlerts.length > 0,
  };

  return {
    state,
    controls,
    engine: engineRef.current,
    initialize,
    dispose,
  };
}
