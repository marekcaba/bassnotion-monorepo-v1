/**
 * useCoreServices - Modern React Hook for Core Audio Services
 *
 * Direct integration with CoreServices without adapter patterns.
 * This replaces the legacy useCorePlaybackEngine hook.
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlaybackStore } from '../store/playbackStore';
import {
  CoreServices,
  AudioEngine,
  UnifiedTransport,
  EventBus,
  PluginManager,
} from '../services/core/index.js';
import { logger } from '../utils/logger.js';
import type {
  PlaybackState,
  AudioContextState,
  CorePlaybackEngineConfig,
  AudioSourceConfig,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from '../types/audio';

export interface UseCoreServicesOptions {
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
  seek: (position: number) => Promise<void>;

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

export interface CoreServicesState {
  // Engine state
  playbackState: PlaybackState;
  audioContextState: AudioContextState;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Configuration
  config: CorePlaybackEngineConfig;

  // Performance metrics
  performanceMetrics: AudioPerformanceMetrics | null;
  performanceAlerts: PerformanceAlert[];

  // Computed state
  canPlay: boolean;
  isPlaying: boolean;
  hasError: boolean;
  hasCriticalAlerts: boolean;
}

export interface UseCoreServicesReturn {
  // State
  state: CoreServicesState;

  // Controls
  controls: PlaybackControls;

  // Direct service access (for advanced use)
  services: {
    coreServices: CoreServices | null;
    audioEngine: AudioEngine | null;
    transport: UnifiedTransport | null;
    eventBus: EventBus | null;
    pluginManager: PluginManager | null;
  };

  // Initialization
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
}

// Stable selector functions to prevent recreation
const selectPlaybackState = (state: any) => state.playbackState;
const selectAudioContextState = (state: any) => state.audioContextState;
const selectIsInitialized = (state: any) => state.isInitialized;
const selectIsLoading = (state: any) => state.isLoading;
const selectError = (state: any) => state.error;
const selectConfig = (state: any) => state.config;
const selectPerformanceMetrics = (state: any) => state.performanceMetrics;
const selectPerformanceAlerts = (state: any) => state.performanceAlerts;
const selectSetInitialized = (state: any) => state.setInitialized;
const selectSetPlaybackState = (state: any) => state.setPlaybackState;
const selectSetAudioContextState = (state: any) => state.setAudioContextState;
const selectSetLoading = (state: any) => state.setLoading;
const selectSetError = (state: any) => state.setError;
const selectUpdateConfig = (state: any) => state.updateConfig;
const selectUpdatePerformanceMetrics = (state: any) =>
  state.updatePerformanceMetrics;
const selectAddPerformanceAlert = (state: any) => state.addPerformanceAlert;

// Computed selectors
const selectCanPlay = (state: any) =>
  state.isInitialized &&
  !state.isLoading &&
  state.audioContextState === 'running' &&
  state.playbackState !== 'loading';

const selectIsPlaying = (state: any) => state.playbackState === 'playing';
const selectHasError = (state: any) => state.error !== null;
const selectCriticalAlertsLength = (state: any) =>
  state.performanceAlerts.filter((alert: any) => alert.severity === 'critical')
    .length;

export function useCoreServices(
  options: UseCoreServicesOptions = {},
): UseCoreServicesReturn {
  const {
    autoInitialize: _autoInitialize = true,
    enablePerformanceMonitoring = true,
    mobileOptimized = true,
    onError,
    onPerformanceAlert,
  } = options;

  // Store selectors
  const playbackState = usePlaybackStore(selectPlaybackState);
  const audioContextState = usePlaybackStore(selectAudioContextState);
  const isInitialized = usePlaybackStore(selectIsInitialized);
  const isLoading = usePlaybackStore(selectIsLoading);
  const error = usePlaybackStore(selectError);
  // Use useShallow for object/array selectors to prevent unnecessary re-renders
  const config = usePlaybackStore(useShallow(selectConfig));
  const performanceMetrics = usePlaybackStore(selectPerformanceMetrics);
  const performanceAlerts = usePlaybackStore(
    useShallow(selectPerformanceAlerts),
  );

  // Action selectors
  const setInitialized = usePlaybackStore(selectSetInitialized);
  const setPlaybackState = usePlaybackStore(selectSetPlaybackState);
  const setAudioContextState = usePlaybackStore(selectSetAudioContextState);
  const setLoading = usePlaybackStore(selectSetLoading);
  const setError = usePlaybackStore(selectSetError);
  const updateConfig = usePlaybackStore(selectUpdateConfig);
  const updatePerformanceMetrics = usePlaybackStore(
    selectUpdatePerformanceMetrics,
  );
  const addPerformanceAlert = usePlaybackStore(selectAddPerformanceAlert);

  // Computed state using stable selectors
  const canPlay = usePlaybackStore(selectCanPlay);
  const isPlaying = usePlaybackStore(selectIsPlaying);
  const hasError = usePlaybackStore(selectHasError);
  const criticalAlertsLength = usePlaybackStore(selectCriticalAlertsLength);

  // Service refs
  const coreServicesRef = useRef<CoreServices | null>(null);
  const unsubscribeRefs = useRef<Array<() => void>>([]);
  const isUpdatingRef = useRef(false);

  // Initialize services
  const initialize = useCallback(async () => {
    if (isInitialized || isLoading) return;

    try {
      setLoading(true);
      setError(null);

      // Check if services already exist globally.
      // CoreServices is OWNED by AudioProvider — this hook only consumes.
      // Previously, if services were absent, this hook created a duplicate
      // CoreServices, which:
      //  - raced AudioProvider's mount,
      //  - registered a second samplesReady listener,
      //  - and caused parallel ArrayBuffer decodes that detached the
      //    shared raw buffers (silent drums/metronome).
      //
      // Now we wait briefly for AudioProvider to populate the singleton
      // and fail loudly if it never arrives — that signals a missing
      // <AudioProvider> in the tree above the consumer.
      let services = window.__globalCoreServices as CoreServices | undefined;
      if (!services) {
        const startedAt = Date.now();
        while (!services && Date.now() - startedAt < 2000) {
          await new Promise((r) => setTimeout(r, 50));
          services = window.__globalCoreServices as CoreServices | undefined;
        }
      }
      if (!services) {
        const error = new Error(
          'useCoreServices: CoreServices not available after 2s. Ensure <AudioProvider> is mounted above this consumer.',
        );
        logger.error(error.message);
        throw error;
      }

      coreServicesRef.current = services;

      // Initialize with user interaction
      await services.initialize();

      // Get services
      const eventBus = services.getEventBus();
      const audioEngine = services.getAudioEngine();

      // Set up event listeners
      const unsubscribeStateChange = eventBus.on(
        'transport:state-changed',
        ({ state }: { state: PlaybackState }) => {
          setPlaybackState(state);
        },
      );

      const unsubscribeAudioContextChange = eventBus.on(
        'audio:context-state-changed',
        ({ state }: { state: AudioContextState }) => {
          setAudioContextState(state);
        },
      );

      const unsubscribeTempoChange = eventBus.on(
        'transport:tempo-change',
        ({ bpm }: { bpm: number }) => {
          if (!isUpdatingRef.current) {
            isUpdatingRef.current = true;
            updateConfig({ tempo: bpm });
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 10);
          }
        },
      );

      const unsubscribeVolumeChange = eventBus.on(
        'audio:volume-changed',
        ({ volume }: { volume: number }) => {
          if (!isUpdatingRef.current) {
            isUpdatingRef.current = true;
            updateConfig({ masterVolume: volume });
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 10);
          }
        },
      );

      const unsubscribePerformanceAlert = eventBus.on(
        'performance:alert',
        (alert: PerformanceAlert) => {
          addPerformanceAlert(alert);
          if (enablePerformanceMonitoring && onPerformanceAlert) {
            onPerformanceAlert(alert);
          }
        },
      );

      // Store unsubscribe functions
      unsubscribeRefs.current = [
        unsubscribeStateChange,
        unsubscribeAudioContextChange,
        unsubscribeTempoChange,
        unsubscribeVolumeChange,
        unsubscribePerformanceAlert,
      ];

      // Set up performance monitoring
      if (enablePerformanceMonitoring) {
        const updateMetrics = () => {
          const metrics = audioEngine.getPerformanceMetrics();
          if (metrics) {
            updatePerformanceMetrics(metrics);
          }
        };

        const metricsInterval = setInterval(updateMetrics, 1000);
        unsubscribeRefs.current.push(() => clearInterval(metricsInterval));
      }

      setInitialized(true);
      setLoading(false);

      logger.info('CoreServices initialized successfully');
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
    updateConfig,
    updatePerformanceMetrics,
    addPerformanceAlert,
    enablePerformanceMonitoring,
    mobileOptimized,
    onError,
    onPerformanceAlert,
  ]);

  // Dispose services
  const dispose = useCallback(async () => {
    if (!coreServicesRef.current || !isInitialized) return;

    try {
      // Clean up event listeners
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
      unsubscribeRefs.current = [];

      // Tell WidgetSyncService to drop its EventBus subscriptions so it can
      // reconnect cleanly if CoreServices is recreated later. Done via dynamic
      // import to avoid a hard cross-domain coupling at module init time.
      try {
        const { widgetSyncService } =
          await import('../../widgets/services/WidgetSyncService.js');
        widgetSyncService.disconnectFromEventBus();
      } catch (err) {
        logger.warn(
          'Could not notify WidgetSyncService of CoreServices dispose',
          err as any,
        );
      }

      // Dispose services
      await coreServicesRef.current.dispose();

      // Remove from global
      if (window.__globalCoreServices === coreServicesRef.current) {
        window.__globalCoreServices = undefined;
      }

      coreServicesRef.current = null;

      // Reset store state
      setInitialized(false);
      setPlaybackState('stopped');
      setAudioContextState('suspended');
      setError(null);
    } catch (error) {
      logger.error('Error disposing CoreServices:', error);
    }
  }, [
    isInitialized,
    setInitialized,
    setPlaybackState,
    setAudioContextState,
    setError,
  ]);

  // Create refs for state values to avoid recreating callbacks
  const stateRef = useRef({ canPlay, isInitialized });

  useEffect(() => {
    stateRef.current = { canPlay, isInitialized };
  }, [canPlay, isInitialized]);

  // Get current services
  const getServices = useCallback(() => {
    const services = coreServicesRef.current;
    if (!services || !stateRef.current.isInitialized) {
      return {
        audioEngine: null,
        transport: null,
        eventBus: null,
        pluginManager: null,
      };
    }

    return {
      audioEngine: services.getAudioEngine(),
      transport: services.getUnifiedTransport(),
      eventBus: services.getEventBus(),
      pluginManager: services.getPluginManager(),
    };
  }, []);

  // Memoize control methods
  const play = useCallback(async () => {
    const { transport } = getServices();
    if (!transport || !stateRef.current.canPlay) return;
    await transport.start();
  }, [getServices]);

  const pause = useCallback(async () => {
    const { transport } = getServices();
    if (!transport || !stateRef.current.isInitialized) return;
    await transport.pause();
  }, [getServices]);

  const stop = useCallback(async () => {
    const { transport } = getServices();
    if (!transport || !stateRef.current.isInitialized) return;
    await transport.stop();
  }, [getServices]);

  const seek = useCallback(
    async (position: number) => {
      const { transport } = getServices();
      if (!transport || !stateRef.current.isInitialized) return;
      // Transport expects MusicalPosition object, not number
      await transport.setPosition({
        bars: Math.floor(position / 4),
        beats: position % 4,
        subdivisions: 0,
        ticks: 0,
      });
    },
    [getServices],
  );

  const setMasterVolume = useCallback(
    (volume: number) => {
      const { audioEngine } = getServices();
      if (!audioEngine || !stateRef.current.isInitialized) return;

      isUpdatingRef.current = true;
      // AudioEngine uses setVolume, not setMasterVolume
      audioEngine.setVolume(volume);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    },
    [getServices],
  );

  const setTempo = useCallback(
    (bpm: number) => {
      const { transport } = getServices();
      if (!transport || !stateRef.current.isInitialized) return;

      isUpdatingRef.current = true;
      transport.setTempo(bpm);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    },
    [getServices],
  );

  const setPitch = useCallback((_semitones: number) => {
    // Not implemented in current system
    logger.warn('setPitch not implemented');
  }, []);

  const setSwingFactor = useCallback(
    (factor: number) => {
      // Store in config but not implemented in transport yet
      updateConfig({ swingFactor: factor });
    },
    [updateConfig],
  );

  // Audio source management (plugin-based in new system)
  const registerAudioSource = useCallback(
    async (_sourceConfig: AudioSourceConfig) => {
      const { pluginManager } = getServices();
      if (!pluginManager || !stateRef.current.isInitialized) return;

      // Would need to create a plugin from the source config
      logger.warn('registerAudioSource needs plugin implementation');
    },
    [getServices],
  );

  const unregisterAudioSource = useCallback((_sourceId: string) => {
    logger.warn('unregisterAudioSource needs plugin implementation');
  }, []);

  const setSourceVolume = useCallback((_sourceId: string, _volume: number) => {
    logger.warn('setSourceVolume needs plugin implementation');
  }, []);

  const setSourceMute = useCallback((_sourceId: string, _muted: boolean) => {
    logger.warn('setSourceMute needs plugin implementation');
  }, []);

  const setSourceSolo = useCallback((_sourceId: string, _solo: boolean) => {
    logger.warn('setSourceSolo needs plugin implementation');
  }, []);

  // Memoize controls object
  const controls: PlaybackControls = useMemo(
    () => ({
      play,
      pause,
      stop,
      seek,
      setMasterVolume,
      setTempo,
      setPitch,
      setSwingFactor,
      registerAudioSource,
      unregisterAudioSource,
      setSourceVolume,
      setSourceMute,
      setSourceSolo,
    }),
    [
      play,
      pause,
      stop,
      seek,
      setMasterVolume,
      setTempo,
      setPitch,
      setSwingFactor,
      registerAudioSource,
      unregisterAudioSource,
      setSourceVolume,
      setSourceMute,
      setSourceSolo,
    ],
  );

  // REMOVED: Auto-initialize logic moved to ScrollTriggerLoader
  // This prevents race condition between useCoreServices and ScrollTriggerLoader
  // ScrollTriggerLoader now controls the initialization sequence:
  // 1. First interaction → CoreServices.preInitialize()
  // 2. Load tutorial samples
  // 3. Emit 'samples-ready' event
  // 4. Play button calls initialize() to create AudioContext
  //
  // Note: initialize() is still available for manual calls

  // Cleanup on unmount — only unsubscribe THIS hook instance's event listeners.
  //
  // CoreServices is a process-lifetime singleton stored in window.__globalCoreServices.
  // Multiple consumer hooks share it. Calling dispose() here would tear down the global
  // singleton on every page navigation, breaking other consumers (notably
  // WidgetSyncService, whose isConnected flag never resets, leaving the EventBus link
  // permanently broken on subsequent tutorial visits — audio plays but playhead and
  // fretboard freeze).
  //
  // Explicit `dispose()` calls (returned from the hook) still tear everything down
  // when the caller genuinely wants that.
  useEffect(() => {
    return () => {
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe());
      unsubscribeRefs.current = [];
    };
  }, []);

  // Assembled state
  const state: CoreServicesState = {
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
    hasCriticalAlerts: criticalAlertsLength > 0,
  };

  // Get current services for return
  const currentServices = getServices();

  return {
    state,
    controls,
    services: {
      coreServices: coreServicesRef.current,
      ...currentServices,
    },
    initialize,
    dispose,
  };
}
