/**
 * useCorePlaybackEngine - Primary React Hook for Widget Consumption
 *
 * Provides unified interface for widgets to interact with the Core Audio Engine
 * while managing state synchronization and lifecycle.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { usePlaybackStore, playbackSelectors } from '../store/playbackStore';
// Epic 3.18: CorePlaybackEngine removed - use new core services
// import { CorePlaybackEngine } from '../services/CorePlaybackEngine/CorePlaybackEngine';
import { ServiceRegistry, AudioEngine, UnifiedTransport, EventBus } from '../services/core/index.js';

// Adapter class to maintain API compatibility with CorePlaybackEngine
class CorePlaybackEngine {
  private static instance: CorePlaybackEngine | null = null;
  private audioEngine: AudioEngine | null = null;
  private transportController: UnifiedTransport | null = null;
  private eventBus: EventBus | null = null;
  private listeners = new Map<string, Set<Function>>();
  
  static getInstance(): CorePlaybackEngine {
    if (!this.instance) {
      this.instance = new CorePlaybackEngine();
    }
    return this.instance;
  }
  
  async initialize(): Promise<void> {
    // Check if services are already available - try CoreServices first
    const coreServices = (window as any).__globalCoreServices;
    if (coreServices) {
      try {
        console.log('CoreServices already available! Getting services...');
        
        this.audioEngine = coreServices.getAudioEngine();
        this.transportController = coreServices.getUnifiedTransport();
        this.eventBus = coreServices.getEventBus();
        
        console.log('Successfully retrieved core services from CoreServices', {
          hasAudioEngine: !!this.audioEngine,
          hasTransportController: !!this.transportController,
          hasEventBus: !!this.eventBus
        });
        return; // Success, exit early
      } catch (error) {
        console.warn('Error getting services from CoreServices:', error);
      }
    }
    
    // Fallback to registry approach
    const registry = (window as any).__serviceRegistry as ServiceRegistry;
    if (registry) {
      try {
        console.log('Trying ServiceRegistry fallback...', {
          availableServices: registry.getServiceNames ? registry.getServiceNames() : 'getServiceNames not available',
          registryType: typeof registry,
          registryKeys: Object.keys(registry || {}),
          hasMethod: typeof registry.get === 'function'
        });
        
        // Check if registry has the services
        const serviceNames = registry.getServiceNames ? registry.getServiceNames() : [];
        console.log('Available service names:', serviceNames);
        
        try {
          this.audioEngine = registry.get('audioEngine') as AudioEngine;
          console.log('Got audioEngine:', !!this.audioEngine);
        } catch (e) {
          console.error('Failed to get audioEngine:', e);
        }
        
        try {
          this.transportController = registry.get('unifiedTransport') as UnifiedTransport;
          console.log('Got transportController:', !!this.transportController);
        } catch (e) {
          console.error('Failed to get transportController:', e);
        }
        
        try {
          this.eventBus = registry.get('eventBus') as EventBus;
          console.log('Got eventBus:', !!this.eventBus);
        } catch (e) {
          console.error('Failed to get eventBus:', e);
        }
        
        console.log('Successfully retrieved core services from registry');
      } catch (error) {
        console.warn('Error getting core services:', error);
        return;
      }
    } else {
      // Wait for audioServicesReady event
      console.log('Waiting for audioServicesReady event...');
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('Timeout waiting for audioServicesReady, using stub implementations');
          resolve();
        }, 5000);
        
        const handleReady = () => {
          clearTimeout(timeout);
          try {
            // Try CoreServices first
            const coreServices = (window as any).__globalCoreServices;
            if (coreServices) {
              console.log('CoreServices ready! Getting services...');
              this.audioEngine = coreServices.getAudioEngine();
              this.transportController = coreServices.getUnifiedTransport();
              this.eventBus = coreServices.getEventBus();
              console.log('Successfully retrieved core services from CoreServices after ready event');
            } else {
              // Fallback to registry
              const registry = (window as any).__serviceRegistry as ServiceRegistry;
              if (registry) {
                console.log('ServiceRegistry ready! Getting services...', {
                  availableServices: registry.getServiceNames ? registry.getServiceNames() : 'getServiceNames not available',
                  registryType: typeof registry,
                  hasMethod: typeof registry.get === 'function'
                });
                
                // Check if registry has the services
                const serviceNames = registry.getServiceNames ? registry.getServiceNames() : [];
                console.log('Available service names after ready event:', serviceNames);
                
                this.audioEngine = registry.get('audioEngine') as AudioEngine;
                this.transportController = registry.get('unifiedTransport') as UnifiedTransport;
                this.eventBus = registry.get('eventBus') as EventBus;
                console.log('Successfully retrieved core services from registry');
              } else {
                console.warn('Neither CoreServices nor ServiceRegistry found on window after ready event');
              }
            }
          } catch (error) {
            console.warn('Error getting core services:', error);
          }
          resolve();
        };
        
        window.addEventListener('audioServicesReady', handleReady, { once: true });
      });
    }
    
    if (!this.audioEngine || !this.transportController || !this.eventBus) {
      console.log('Core services not yet initialized, will retry on event bus access', {
        hasAudioEngine: !!this.audioEngine,
        hasTransportController: !!this.transportController,
        hasEventBus: !!this.eventBus,
        registry: (window as any).__serviceRegistry
      });
      // Don't throw error, just return - services might not be available yet
      // The adapter methods will handle the retry logic
      return;
    }
    
    // Forward events from new system to old API
    this.eventBus.on('transport:state-changed', ({ state }) => {
      this.emit('stateChange', state);
    });
    
    this.eventBus.on('audio:context-state-changed', ({ state }) => {
      this.emit('audioContextChange', state);
    });
    
    this.eventBus.on('transport:tempo-changed', ({ bpm }) => {
      this.emit('tempoChange', bpm);
    });
    
    this.eventBus.on('audio:volume-changed', ({ volume }) => {
      this.emit('masterVolumeChange', volume);
    });
  }
  
  async dispose(): Promise<void> {
    this.listeners.clear();
  }
  
  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }
  
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(handler => handler(...args));
  }
  
  private ensureServices(): boolean {
    if (this.audioEngine && this.transportController && this.eventBus) {
      return true;
    }
    
    // Try to get services again
    const coreServices = (window as any).__coreServices;
    if (coreServices) {
      this.audioEngine = coreServices.getAudioEngine();
      this.transportController = coreServices.getTransportController();
      this.eventBus = coreServices.getEventBus();
      return !!(this.audioEngine && this.transportController && this.eventBus);
    }
    
    return false;
  }
  
  async play(): Promise<void> {
    if (!this.ensureServices()) {
      console.warn('Services not available for play operation');
      return;
    }
    await this.transportController?.play();
  }
  
  async pause(): Promise<void> {
    if (!this.ensureServices()) {
      console.warn('Services not available for pause operation');
      return;
    }
    await this.transportController?.pause();
  }
  
  async stop(): Promise<void> {
    if (!this.ensureServices()) {
      console.warn('Services not available for stop operation');
      return;
    }
    await this.transportController?.stop();
  }
  
  setMasterVolume(volume: number): void {
    if (!this.ensureServices()) {
      console.warn('Services not available for setMasterVolume operation');
      return;
    }
    this.audioEngine?.setMasterVolume(volume);
  }
  
  setTempo(bpm: number): void {
    if (!this.ensureServices()) {
      console.warn('Services not available for setTempo operation');
      return;
    }
    this.transportController?.setTempo(bpm);
  }
  
  setPitch(semitones: number): void {
    // Not implemented in new system yet
  }
  
  setSwingFactor(factor: number): void {
    // Not implemented in new system yet
  }
  
  async registerAudioSource(config: AudioSourceConfig): Promise<void> {
    // Not directly supported - would need plugin registration
  }
  
  unregisterAudioSource(sourceId: string): void {
    // Not directly supported
  }
  
  setSourceVolume(sourceId: string, volume: number): void {
    // Not directly supported
  }
  
  setSourceMute(sourceId: string, muted: boolean): void {
    // Not directly supported  
  }
  
  setSourceSolo(sourceId: string, solo: boolean): void {
    // Not directly supported
  }
  
  getPerformanceMetrics(): AudioPerformanceMetrics | null {
    if (!this.ensureServices()) {
      return null;
    }
    return this.audioEngine?.getPerformanceMetrics() || null;
  }
}
import type {
  PlaybackState,
  AudioContextState,
  CorePlaybackEngineConfig,
  AudioSourceConfig,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from '../types/audio';

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

export interface UseCorePlaybackEngineReturn {
  // State
  state: PlaybackEngineState;

  // Controls
  controls: PlaybackControls;

  // Engine instance (for advanced use)
  engine: CorePlaybackEngine | null;

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
const selectAddAudioSource = (state: any) => state.addAudioSource;
const selectRemoveAudioSource = (state: any) => state.removeAudioSource;
const selectUpdateAudioSource = (state: any) => state.updateAudioSource;
const selectUpdatePerformanceMetrics = (state: any) =>
  state.updatePerformanceMetrics;
const selectAddPerformanceAlert = (state: any) => state.addPerformanceAlert;

// Stable computed selectors
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

  // Use stable selectors to prevent infinite loops
  const playbackState = usePlaybackStore(selectPlaybackState);
  const audioContextState = usePlaybackStore(selectAudioContextState);
  const isInitialized = usePlaybackStore(selectIsInitialized);
  const isLoading = usePlaybackStore(selectIsLoading);
  const error = usePlaybackStore(selectError);
  const config = usePlaybackStore(selectConfig);
  const performanceMetrics = usePlaybackStore(selectPerformanceMetrics);
  const performanceAlerts = usePlaybackStore(selectPerformanceAlerts);

  // Action selectors
  const setInitialized = usePlaybackStore(selectSetInitialized);
  const setPlaybackState = usePlaybackStore(selectSetPlaybackState);
  const setAudioContextState = usePlaybackStore(selectSetAudioContextState);
  const setLoading = usePlaybackStore(selectSetLoading);
  const setError = usePlaybackStore(selectSetError);
  const updateConfig = usePlaybackStore(selectUpdateConfig);
  const addAudioSource = usePlaybackStore(selectAddAudioSource);
  const removeAudioSource = usePlaybackStore(selectRemoveAudioSource);
  const updateAudioSource = usePlaybackStore(selectUpdateAudioSource);
  const updatePerformanceMetrics = usePlaybackStore(
    selectUpdatePerformanceMetrics,
  );
  const addPerformanceAlert = usePlaybackStore(selectAddPerformanceAlert);

  // Computed state using stable selectors
  const canPlay = usePlaybackStore(selectCanPlay);
  const isPlaying = usePlaybackStore(selectIsPlaying);
  const hasError = usePlaybackStore(selectHasError);
  const criticalAlertsLength = usePlaybackStore(selectCriticalAlertsLength);

  // Engine instance ref
  const engineRef = useRef<CorePlaybackEngine | null>(null);
  const unsubscribeRefs = useRef<Array<() => void>>([]);
  const isUpdatingRef = useRef(false);

  // Initialize engine
  const initialize = useCallback(async () => {
    if (isInitialized || isLoading) return;

    try {
      setLoading(true);
      setError(null);

      // Get engine instance
      // TODO: Review non-null assertion - consider null safety
      if (!engineRef.current) {
        engineRef.current = CorePlaybackEngine.getInstance();
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
        // Prevent recursive updates
        if (isUpdatingRef.current) {
          return;
        }

        // Only update store if tempo actually changed to prevent loops
        const currentTempo = playbackSelectors.getConfig(
          usePlaybackStore.getState(),
        ).tempo;
        if (currentTempo !== tempo) {
          isUpdatingRef.current = true;
          updateConfig({ tempo });
          // Reset flag after a brief delay to allow update to complete
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 10);
        }
      });

      const unsubscribeMasterVolumeChange = engine.on(
        'masterVolumeChange',
        (volume) => {
          // Prevent recursive updates
          if (isUpdatingRef.current) {
            return;
          }

          // Only update store if volume actually changed to prevent loops
          const currentVolume = playbackSelectors.getConfig(
            usePlaybackStore.getState(),
          ).masterVolume;
          if (currentVolume !== volume) {
            isUpdatingRef.current = true;
            updateConfig({ masterVolume: volume });
            // Reset flag after a brief delay to allow update to complete
            setTimeout(() => {
              isUpdatingRef.current = false;
            }, 10);
          }
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
    // TODO: Review non-null assertion - consider null safety
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
      // TODO: Review non-null assertion - consider null safety
      if (!engineRef.current || !canPlay) return;
      await engineRef.current.play();
    }, [canPlay]),

    pause: useCallback(async () => {
      // TODO: Review non-null assertion - consider null safety
      if (!engineRef.current || !isInitialized) return;
      await engineRef.current.pause();
    }, [isInitialized]),

    stop: useCallback(async () => {
      // TODO: Review non-null assertion - consider null safety
      if (!engineRef.current || !isInitialized) return;
      await engineRef.current.stop();
    }, [isInitialized]),

    setMasterVolume: useCallback(
      (volume: number) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        // Set flag to prevent recursive updates from engine events
        isUpdatingRef.current = true;
        engineRef.current.setMasterVolume(volume);

        // Reset flag after a brief delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 50);
      },
      [isInitialized],
    ),

    setTempo: useCallback(
      (bpm: number) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        // Set flag to prevent recursive updates from engine events
        isUpdatingRef.current = true;
        engineRef.current.setTempo(bpm);

        // Reset flag after a brief delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 50);
      },
      [isInitialized],
    ),

    setPitch: useCallback(
      (semitones: number) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;
        engineRef.current.setPitch(semitones);
      },
      [isInitialized],
    ),

    setSwingFactor: useCallback(
      (factor: number) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;
        updateConfig({ swingFactor: factor });
      },
      [isInitialized, updateConfig],
    ),

    registerAudioSource: useCallback(
      async (sourceConfig: AudioSourceConfig) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.registerAudioSource(sourceConfig);
        addAudioSource(sourceConfig);
      },
      [isInitialized, addAudioSource],
    ),

    unregisterAudioSource: useCallback(
      (sourceId: string) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.unregisterAudioSource(sourceId);
        removeAudioSource(sourceId);
      },
      [isInitialized, removeAudioSource],
    ),

    setSourceVolume: useCallback(
      (sourceId: string, volume: number) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceVolume(sourceId, volume);
        updateAudioSource(sourceId, { volume });
      },
      [isInitialized, updateAudioSource],
    ),

    setSourceMute: useCallback(
      (sourceId: string, muted: boolean) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceMute(sourceId, muted);
        updateAudioSource(sourceId, { muted });
      },
      [isInitialized, updateAudioSource],
    ),

    setSourceSolo: useCallback(
      (sourceId: string, solo: boolean) => {
        // TODO: Review non-null assertion - consider null safety
        if (!engineRef.current || !isInitialized) return;

        engineRef.current.setSourceSolo(sourceId, solo);
        updateAudioSource(sourceId, { solo });
      },
      [isInitialized, updateAudioSource],
    ),
  };

  // Auto-initialize on mount if enabled
  useEffect(() => {
    // TODO: Review non-null assertion - consider null safety
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
    hasCriticalAlerts: criticalAlertsLength > 0,
  };

  return {
    state,
    controls,
    engine: engineRef.current,
    initialize,
    dispose,
  };
}
