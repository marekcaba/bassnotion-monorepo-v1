/**
 * useAudio Hook - AudioEngine Integration
 * Story 3.18.6: Widget Integration & Enhancement
 *
 * Professional React hook for audio operations with:
 * - ServiceRegistry integration
 * - Error handling and loading states
 * - Type-safe sampler creation
 * - Clean abstraction over AudioEngine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceRegistry } from '../services/core/ServiceRegistry.js';
import {
  AudioEngine,
  SamplerConfig,
  AudioSampler,
} from '../services/core/AudioEngine.js';
import { AudioError } from '../errors/AudioErrors.js';
import { getLogger } from '@/utils/logger';

// Create logger instance for this hook
const fallbackLogger = getLogger('useAudio');

// Use fallback logger directly to avoid dynamic require issues
const logger = fallbackLogger;

export interface UseAudioResult {
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  createSampler: (config: SamplerConfig) => Promise<AudioSampler>;
  getTone: () => any;
  audioContext: AudioContext | null;
  initialize: () => Promise<void>;
}

export function useAudio(serviceRegistry?: ServiceRegistry): UseAudioResult {
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Get AudioEngine from ServiceRegistry or CoreServices
  useEffect(() => {
    const checkAudioEngine = () => {
      try {
        // If serviceRegistry was provided, use it (for testing)
        if (serviceRegistry) {
          const engine = serviceRegistry.get<AudioEngine>('audioEngine');
          if (engine) {
            audioEngineRef.current = engine;
            if (engine.isReady()) {
              setIsReady(true);
              logger.info(
                'useAudio: Got AudioEngine from provided ServiceRegistry',
              );
            }
            return true;
          }
        }

        // Try CoreServices first (new approach)
        const coreServices = window.__globalCoreServices;
        if (coreServices) {
          audioEngineRef.current = coreServices.getAudioEngine();
          // Check if already initialized using the public isReady() method
          if (audioEngineRef.current?.isReady()) {
            setIsReady(true);
            logger.info(
              'useAudio: Got AudioEngine from CoreServices, ready:',
              true,
            );
          } else {
            logger.info(
              'useAudio: Got AudioEngine from CoreServices but not initialized yet',
            );
          }
          return true;
        } else {
          // CoreServices not ready yet - this is normal during initial render
          logger.info(
            'useAudio: CoreServices not available yet, will check again...',
          );
          return false;
        }
      } catch (err) {
        logger.error('useAudio: Error getting AudioEngine:', err);
        setError(err as Error);
        return false;
      }
    };

    // Check immediately
    let found = checkAudioEngine();

    // If not found, check periodically until it's available
    if (!found) {
      const checkInterval = setInterval(() => {
        found = checkAudioEngine();
        if (found) {
          clearInterval(checkInterval);
        }
      }, 50); // Check every 50ms

      // Also listen for audioServicesReady event
      const handleAudioServicesReady = () => {
        logger.info('useAudio: audioServicesReady event received');
        clearInterval(checkInterval);
        checkAudioEngine();
      };

      window.addEventListener('audioServicesReady', handleAudioServicesReady);

      return () => {
        clearInterval(checkInterval);
        window.removeEventListener(
          'audioServicesReady',
          handleAudioServicesReady,
        );
      };
    }
  }, [serviceRegistry]);

  // Initialize audio engine
  const initialize = useCallback(async () => {
    // CRITICAL: When using CoreServices, initialization should be done through CoreServices.initialize()
    // NOT by calling audioEngine.initialize() directly!
    // This ensures all services (including UnifiedTransport) are properly initialized

    // If we have a direct AudioEngine reference from serviceRegistry, use it
    if (serviceRegistry && audioEngineRef.current) {
      logger.info(
        'useAudio.initialize(): Using AudioEngine from ServiceRegistry',
      );
      setIsInitializing(true);
      setError(null);

      try {
        if (!audioEngineRef.current.isReady()) {
          await audioEngineRef.current.initialize();
        }
        setIsReady(true);
        setIsInitializing(false);
        logger.info(
          'useAudio: AudioEngine initialized successfully via ServiceRegistry',
        );
        return;
      } catch (err) {
        setError(err as Error);
        setIsInitializing(false);
        throw err;
      }
    }

    // Check if we have CoreServices
    const coreServices = window.__globalCoreServices;
    logger.info('useAudio.initialize(): Checking for CoreServices:', {
      hasGlobalCoreServices: !!window.__globalCoreServices,
      hasCoreServices: !!window.__coreServices,
      hasServiceRegistry: !!window.__serviceRegistry,
      coreServicesValue: coreServices,
    });

    if (coreServices) {
      // If CoreServices exists, ALWAYS use it for initialization
      // Don't check isReady() here - that's for checking if already initialized
      if (coreServices.isReady()) {
        logger.info('useAudio: CoreServices already initialized');
        setIsReady(true);
        return;
      }

      logger.info('useAudio: Delegating initialization to CoreServices...');

      // Prevent multiple simultaneous initialization attempts
      if (initPromiseRef.current) {
        return initPromiseRef.current;
      }

      setIsInitializing(true);
      setError(null);

      const initPromise = (async () => {
        try {
          // Initialize through CoreServices which will initialize ALL services properly
          await coreServices.initialize();

          // Now get the AudioEngine reference again
          const audioEngine = coreServices.getAudioEngine();
          audioEngineRef.current = audioEngine;
          setIsReady(true);
          logger.info(
            'useAudio: CoreServices (including AudioEngine) initialized successfully',
          );
        } catch (err) {
          const audioError =
            err instanceof AudioError
              ? err
              : new Error(
                  `CoreServices initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                );
          setError(audioError);
          throw audioError;
        } finally {
          setIsInitializing(false);
          initPromiseRef.current = null;
        }
      })();

      initPromiseRef.current = initPromise;
      return initPromise;
    }

    // If we have CoreServices but it's already ready, just update our state
    if (coreServices && coreServices.isReady()) {
      // CoreServices exists and is ready, but we haven't updated our local state
      const audioEngine = coreServices.getAudioEngine();
      audioEngineRef.current = audioEngine;
      setIsReady(true);
      logger.info(
        'useAudio: CoreServices already initialized, updating local state',
      );
      return;
    }

    // If no CoreServices available yet, it means we're being called too early
    // Set error and return without throwing
    const errorMsg =
      'CoreServices not available - this indicates an initialization order issue';
    logger.error(errorMsg);
    setError(new Error(errorMsg));
    setIsInitializing(false);
  }, [serviceRegistry]);

  // Create sampler with error handling
  const createSampler = useCallback(
    async (config: SamplerConfig): Promise<AudioSampler> => {
      if (!audioEngineRef.current) {
        throw new Error('AudioEngine not available');
      }

      if (!isReady) {
        throw new Error('Audio not ready. Call initialize() first.');
      }

      try {
        return await audioEngineRef.current.createSampler(config);
      } catch (err) {
        const audioError =
          err instanceof AudioError
            ? err
            : new Error(
                `Failed to create sampler: ${err instanceof Error ? err.message : 'Unknown error'}`,
              );
        throw audioError;
      }
    },
    [isReady],
  );

  // Get Tone.js instance
  const getTone = useCallback(() => {
    if (!audioEngineRef.current) {
      throw new Error('Audio not ready');
    }

    if (!isReady) {
      throw new Error('Audio not ready');
    }

    return audioEngineRef.current.getTone();
  }, [isReady]);

  // Get audio context - only if AudioEngine is fully initialized
  const audioContext = (() => {
    if (!audioEngineRef.current || !isReady) {
      return null;
    }
    try {
      return audioEngineRef.current.getContext();
    } catch (error) {
      // AudioEngine not fully initialized yet
      return null;
    }
  })();

  return {
    isReady,
    isInitializing,
    error,
    createSampler,
    getTone,
    audioContext,
    initialize,
  };
}
