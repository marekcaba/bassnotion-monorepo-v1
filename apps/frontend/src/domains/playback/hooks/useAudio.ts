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
import { AudioEngine, SamplerConfig, AudioSampler } from '../services/core/AudioEngine.js';
import { AudioError } from '../errors/AudioErrors.js';

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
        // Try CoreServices first (new approach)
        const coreServices = (window as any).__globalCoreServices;
        if (coreServices) {
          audioEngineRef.current = coreServices.getAudioEngine();
          // Check if already initialized
          if ((audioEngineRef.current as any).isInitialized) {
            setIsReady(true);
            console.log('useAudio: Got AudioEngine from CoreServices, ready:', true);
          } else {
            console.log('useAudio: Got AudioEngine from CoreServices but not initialized yet');
          }
          return true;
        } else {
          // CoreServices not ready yet - this is normal during initial render
          console.log('useAudio: CoreServices not available yet, will check again...');
          return false;
        }
      } catch (err) {
        console.error('useAudio: Error getting AudioEngine:', err);
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
        console.log('useAudio: audioServicesReady event received');
        clearInterval(checkInterval);
        checkAudioEngine();
      };
      
      window.addEventListener('audioServicesReady', handleAudioServicesReady);
      
      return () => {
        clearInterval(checkInterval);
        window.removeEventListener('audioServicesReady', handleAudioServicesReady);
      };
    }
  }, []);

  // Initialize audio engine
  const initialize = useCallback(async () => {
    // CRITICAL: When using CoreServices, initialization should be done through CoreServices.initialize()
    // NOT by calling audioEngine.initialize() directly!
    // This ensures all services (including UnifiedTransport) are properly initialized
    
    // Check if we have CoreServices
    const coreServices = (window as any).__globalCoreServices;
    console.log('useAudio.initialize(): Checking for CoreServices:', {
      hasGlobalCoreServices: !!(window as any).__globalCoreServices,
      hasCoreServices: !!(window as any).__coreServices,
      hasServiceRegistry: !!(window as any).__serviceRegistry,
      coreServicesValue: coreServices
    });
    
    if (coreServices) {
      // If CoreServices exists, ALWAYS use it for initialization
      // Don't check isReady() here - that's for checking if already initialized
      if (coreServices.isReady()) {
        console.log('useAudio: CoreServices already initialized');
        setIsReady(true);
        return;
      }
      
      console.log('useAudio: Delegating initialization to CoreServices...');
      
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
          console.log('useAudio: CoreServices (including AudioEngine) initialized successfully');
        } catch (err) {
          const audioError = err instanceof AudioError ? err : 
            new Error(`CoreServices initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      console.log('useAudio: CoreServices already initialized, updating local state');
      return;
    }
    
    // If no CoreServices available yet, it means we're being called too early
    // This should not happen as the effect above ensures CoreServices is available
    throw new Error('CoreServices not available - this indicates an initialization order issue');
  }, []);

  // Create sampler with error handling
  const createSampler = useCallback(async (config: SamplerConfig): Promise<AudioSampler> => {
    if (!audioEngineRef.current) {
      throw new Error('AudioEngine not available');
    }

    if (!isReady) {
      throw new Error('Audio not ready. Call initialize() first.');
    }

    try {
      return await audioEngineRef.current.createSampler(config);
    } catch (err) {
      const audioError = err instanceof AudioError ? err :
        new Error(`Failed to create sampler: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw audioError;
    }
  }, [isReady]);

  // Get Tone.js instance
  const getTone = useCallback(() => {
    if (!audioEngineRef.current) {
      console.warn('useAudio: AudioEngine not available');
      return null;
    }

    if (!isReady) {
      console.warn('useAudio: Audio not ready yet');
      return null;
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