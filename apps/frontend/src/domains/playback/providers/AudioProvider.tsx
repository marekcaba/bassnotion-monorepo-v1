'use client';

/**
 * AudioProvider - Enhanced Audio Context Provider
 * Story 3.18.6: Widget Integration & Enhancement
 *
 * Provides ServiceRegistry-based audio services to React components:
 * - Initializes and manages ServiceRegistry
 * - Provides global access to audio services
 * - Handles initialization and error states gracefully
 * - Replaces old ToneProvider with clean implementation
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  CoreServices,
  createCoreServicesWithPreInit,
  GlobalAudioSystem,
  ServiceRegistry,
  AudioEngine,
  UnifiedTransport,
  EventBus,
  PluginManager,
  type CoreServicesConfig,
} from '../services/core/index.js';
import type { PlaybackEngine } from '../services/core/PlaybackEngine.js';
import {
  getAudioArchitectureFlags,
  logMigrationEvent,
  isNewAudioArchitectureEnabled,
} from '../config/featureFlags.js';
import { ToneProvider } from './ToneProvider.js';
import { AudioContextManager } from '../modules/audio-engine/core/AudioContextManager.js';
import { GlobalSampleCache } from '../modules/storage/cache/GlobalSampleCache.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '../services/WindowRegistry.js';

interface AudioContextValue {
  /** Core services instance */
  coreServices: CoreServices | null;

  /** Quick access to commonly used services */
  audioEngine: AudioEngine | null;
  transportController: UnifiedTransport | null;
  eventBus: EventBus | null;
  pluginManager: PluginManager | null;
  serviceRegistry: ServiceRegistry | null;

  /** Phase 1 Task 1.4: New PlaybackEngine (feature flag controlled) */
  playbackEngine: PlaybackEngine | null;

  /** Initialization state */
  isInitialized: boolean;
  error: Error | null;

  /** ✅ BUG #1 FIX: Flag to indicate CoreServices is ready to use */
  coreServicesReady: boolean;

  /** Get Tone.js instance (compatibility layer) */
  getTone: () => any;
}

const AudioContext = createContext<AudioContextValue>({
  coreServices: null,
  audioEngine: null,
  transportController: null,
  eventBus: null,
  pluginManager: null,
  serviceRegistry: null,
  playbackEngine: null, // Phase 1 Task 1.4
  isInitialized: false,
  error: null,
  coreServicesReady: false,
  getTone: () => null,
});

interface AudioProviderProps {
  children: React.ReactNode;
  config?: Partial<CoreServicesConfig>;
}

/**
 * AudioProvider component
 * Provides clean dependency injection for all audio services
 */
export function AudioProvider({ children, config }: AudioProviderProps) {
  const { logger } = useCorrelation('AudioProvider');
  const flags = getAudioArchitectureFlags();
  // Only log feature flags on first render
  const [hasLoggedFlags, setHasLoggedFlags] = useState(false);

  // Always declare all hooks at the top level
  const [coreServices, setCoreServices] = useState<CoreServices | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);
  const [_servicesReady, setServicesReady] = useState(false);
  const cleanupRef = useRef(false); // Prevent StrictMode double cleanup
  // ✅ BUG #1 FIX: Track when CoreServices is ready to prevent race conditions
  const [coreServicesReady, setCoreServicesReady] = useState(false);
  // ✅ BUG #7 FIX: Store unsubscribe function for audio:initialized event
  const unsubscribeAudioInitRef = useRef<(() => void) | null>(null);

  const shouldUseLegacyProvider = !isNewAudioArchitectureEnabled();

  useEffect(() => {
    if (!hasLoggedFlags) {
      logger.info('AudioProvider: Feature flags:', { ...flags });
      setHasLoggedFlags(true);
    }
  }, [hasLoggedFlags, flags, logger]);

  useEffect(() => {
    // Skip initialization if using legacy provider
    if (shouldUseLegacyProvider) return;
    // Prevent double initialization in development
    if (initRef.current) return;
    initRef.current = true;

    let services: CoreServices | null = null;

    async function initializeServices() {
      try {
        // Check if we already have a global instance (handles React re-mounts gracefully)
        const existingInstance = GlobalAudioSystem.getCurrentInstance();
        if (existingInstance) {
          logger.info(
            'AudioProvider: Using existing global audio system instance',
          );
          services = existingInstance;

          // Immediately update React state with existing services
          setCoreServices(services);
          setIsInitialized(true);
          setServicesReady(true);
          // ✅ BUG #1 FIX: Mark CoreServices as ready
          setCoreServicesReady(true);
          logger.info(
            'AudioProvider: Context state updated with existing services - isInitialized: true, coreServicesReady: true',
          );

          logMigrationEvent('AudioProvider reusing existing global instance');
          return;
        }

        logMigrationEvent(
          'Initializing new AudioProvider with global singleton',
        );

        // Add timeout to detect if initialization hangs
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error('createCoreServices timed out after 10 seconds'),
              ),
            10000,
          );
        });

        logger.info('AudioProvider: Starting createCoreServicesWithPreInit...');

        try {
          // Get the global pre-initialized instance (creates only once)
          services = await Promise.race([
            createCoreServicesWithPreInit({
              ...config,
              autoLoadPlugins: false, // Disable to avoid plugin initialization errors
            }),
            timeoutPromise,
          ]);

          logger.info(
            'AudioProvider: createCoreServicesWithPreInit completed successfully',
          );
        } catch (timeoutError) {
          logger.error(
            'AudioProvider: createCoreServicesWithPreInit timed out or failed',
            timeoutError as Error,
          );
          throw timeoutError;
        }

        // Set global service registry and core services for hooks
        const registry = services.getServiceRegistry();

        // ✅ BUG #8 FIX: Use WindowRegistry instead of direct window assignments
        WindowRegistry.setServiceRegistry(registry);
        WindowRegistry.setCoreServices(services);

        // ✅ BUG #1 FIX: Update state atomically to prevent race conditions
        setCoreServices(services);
        setIsInitialized(true);
        setServicesReady(true);
        setCoreServicesReady(true);

        // Dispatch a custom event to notify waiting hooks
        window.dispatchEvent(new Event('audioServicesReady'));

        // Set up listener for when AudioContext is ready (after user gesture)
        const handleAudioInitialized = async () => {
          logger.info(
            'AudioProvider: audio:initialized event received, fully initializing services...',
          );

          // Check if services are already fully initialized
          if (services && services.isReady()) {
            logger.info(
              'AudioProvider: Services already fully initialized, skipping duplicate initialization',
            );
            return;
          }

          // Clean up any incompatible cached buffers before initializing
          const { AudioContextCompatibility } = await import(
            '../services/storage/AudioContextCompatibility.js'
          );
          AudioContextCompatibility.cleanupIncompatibleBuffers();

          // BUG #4 FIX: Subscribe to AudioContext state changes (event-driven, not polling!)
          const unsubscribe = AudioContextManager.onGlobalStateChange((state) => {
            logger.info('AudioContext state changed (event-driven)', { state });

            // Clear incompatible buffers if context changes
            if (state === 'closed') {
              logger.warn('AudioContext closed - clearing cached buffers');
              GlobalSampleCache.clearAllBuffers();
            }
          });

          // ✅ BUG #8 FIX: Store unsubscribe function using WindowRegistry
          WindowRegistry.setAudioContextUnsubscribe(unsubscribe);

          try {
            // Now fully initialize all services (including UnifiedTransport)
            if (services && !services.isReady()) {
              await services.initialize();
              logger.info(
                'AudioProvider: All services fully initialized after user gesture',
              );
            }
          } catch (error) {
            logger.error(
              'AudioProvider: Failed to fully initialize services',
              error as Error,
            );
          }
        };

        // Listen for audio initialization
        // ✅ BUG #7 FIX: Store unsubscribe function for cleanup
        const eventBus = services.getEventBus();
        unsubscribeAudioInitRef.current = eventBus.on('audio:initialized', handleAudioInitialized);

        logger.info(
          'AudioProvider: Context state updated - isInitialized: true',
        );

        logMigrationEvent('AudioProvider initialized successfully', {
          services: registry.getServiceNames ? registry.getServiceNames() : [],
        });
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to initialize audio services');
        logger.error('AudioProvider: Initialization failed', error, {
          message: error.message,
          stack: error.stack,
          originalError: err,
        });
        setError(error);
        logMigrationEvent('AudioProvider initialization failed', {
          error: error.message,
        });
      }
    }

    initializeServices().catch((err) => {
      logger.error(
        'AudioProvider: Failed to initialize services',
        err as Error,
      );
      // Still set error state even if promise rejects
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to initialize audio services');
      setError(error);
    });

    // Cleanup on unmount - but avoid cleanup in StrictMode
    return () => {
      // Prevent double cleanup in React StrictMode
      if (cleanupRef.current) {
        logger.info('AudioProvider: Skipping cleanup (already cleaned up)');
        return;
      }

      // ✅ BUG #4 & #8 FIX: Unsubscribe from AudioContext state changes
      const unsubscribe = WindowRegistry.getAudioContextUnsubscribe();
      if (typeof unsubscribe === 'function') {
        unsubscribe();
        logger.info('AudioProvider: Unsubscribed from AudioContext state changes');
        WindowRegistry.setAudioContextUnsubscribe(undefined);
      }

      // ✅ BUG #7 FIX: Unsubscribe from audio:initialized event
      if (unsubscribeAudioInitRef.current) {
        unsubscribeAudioInitRef.current();
        logger.info('AudioProvider: Unsubscribed from audio:initialized event');
        unsubscribeAudioInitRef.current = null;
      }

      if (services) {
        logMigrationEvent('Cleaning up AudioProvider');
        cleanupRef.current = true;

        // Only dispose if we're actually unmounting (not just StrictMode re-render)
        setTimeout(() => {
          if (cleanupRef.current) {
            // DON'T dispose or delete globals - CoreServices is a singleton!
            // The GlobalAudioSystem pattern ensures only one instance exists
            // Deleting these breaks the singleton pattern and causes initialization errors
            logger.info(
              'AudioProvider: Cleanup called but preserving global singleton',
            );
          }
        }, 100); // Small delay to see if component re-mounts
      }
    };
  }, [config, logger, shouldUseLegacyProvider]);

  // Use old provider if feature flags are disabled or rollback is active
  if (shouldUseLegacyProvider) {
    logMigrationEvent('Using legacy ToneProvider', {
      reason: 'feature flags disabled',
    });
    return <ToneProvider>{children}</ToneProvider>;
  }

  // Build context value
  const contextValue: AudioContextValue = {
    coreServices,
    audioEngine: coreServices?.getAudioEngine() || null,
    transportController: coreServices?.getUnifiedTransport() || null,
    eventBus: coreServices?.getEventBus() || null,
    pluginManager: coreServices?.getPluginManager() || null,
    serviceRegistry: coreServices?.getServiceRegistry() || null,
    playbackEngine: coreServices?.getPlaybackEngine() || null, // Phase 1 Task 1.4
    isInitialized,
    error,
    coreServicesReady, // ✅ BUG #1 FIX: Include ready flag
    getTone: () => coreServices?.getAudioEngine().getTone() || null,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

/**
 * Hook to access audio services
 */
export function useAudioServices() {
  const context = useContext(AudioContext);

  if (!context) {
    throw new Error('useAudioServices must be used within AudioProvider');
  }

  return context;
}

/**
 * Hook to access AudioEngine
 */
export function useAudioEngine() {
  const { audioEngine, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('AudioEngine not yet initialized');
  }

  if (!audioEngine) {
    throw new Error('AudioEngine not available');
  }

  return audioEngine;
}

/**
 * Hook to access UnifiedTransport
 */
export function useUnifiedTransport() {
  const { transportController, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('UnifiedTransport not yet initialized');
  }

  if (!transportController) {
    throw new Error('UnifiedTransport not available');
  }

  return transportController;
}

/**
 * Hook to access EventBus
 */
export function useEventBus() {
  const { eventBus, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('EventBus not yet initialized');
  }

  if (!eventBus) {
    throw new Error('EventBus not available');
  }

  return eventBus;
}

/**
 * Hook to access PluginManager
 */
export function usePluginManager() {
  const { pluginManager, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('PluginManager not yet initialized');
  }

  if (!pluginManager) {
    throw new Error('PluginManager not available');
  }

  return pluginManager;
}

/**
 * Hook to access ServiceRegistry
 */
export function useServiceRegistry() {
  const { serviceRegistry, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('ServiceRegistry not yet initialized');
  }

  if (!serviceRegistry) {
    throw new Error('ServiceRegistry not available');
  }

  return serviceRegistry;
}

/**
 * Hook to access PlaybackEngine (Phase 1 Task 1.4)
 * Returns null if feature flag is disabled
 *
 * @returns PlaybackEngine instance or null
 * @throws Error if AudioProvider is not initialized
 */
export function usePlaybackEngine(): PlaybackEngine | null {
  const { playbackEngine, isInitialized } = useAudioServices();

  if (!isInitialized) {
    throw new Error('PlaybackEngine not yet initialized');
  }

  // PlaybackEngine may be null if feature flag is disabled - this is expected
  return playbackEngine;
}

/**
 * Compatibility hook for components still using useTone
 * This provides a migration path for existing components
 */
export function useTone() {
  const { getTone, isInitialized } = useAudioServices();

  if (!isInitialized) {
    return { Tone: null, isReady: false };
  }

  return { Tone: getTone(), isReady: true };
}
