/**
 * Universal Platform Audio Hook
 * Enhanced Platform Audio Integration - Phase 1
 * 
 * Provides consistent access to audio services across ALL pages:
 * - Tutorial pages ✅
 * - Test pages ✅  
 * - Widget components ✅
 * - Any component anywhere ✅
 * 
 * Uses hybrid pattern:
 * 1. Try React context first (cleanest)
 * 2. Fallback to global singleton (universal)
 * 
 * This ensures your 4-day audio system works identically everywhere.
 */

import { useState, useEffect } from 'react';
import { useAudioServices } from '../providers/AudioProvider.js';
import { BackgroundSampleLoader } from '../services/BackgroundSampleLoader.js';
import type { CoreServices } from '../services/core/CoreServices.js';
import type { UnifiedTransport } from '../services/core/UnifiedTransport.js';

export interface PlatformAudioState {
  /** Core services instance (from AudioProvider or global) */
  coreServices: CoreServices | null;
  
  /** UnifiedTransport - same instance everywhere */
  transport: UnifiedTransport | null;
  
  /** BackgroundSampleLoader - automatic sample loading */
  sampleLoader: BackgroundSampleLoader | null;
  
  /** Loading states */
  isAudioReady: boolean;
  isLoading: boolean;
  
  /** Error state */
  error: string | null;
  
  /** Audio context info */
  audioContextState: 'suspended' | 'running' | 'closed' | 'unknown';
  
  /** Sample loading progress */
  sampleProgress: {
    harmony: number;
    drums: number;
    bass: number;
    metronome: number;
    overall: number;
  };
}

/**
 * Universal Platform Audio Hook
 * 
 * Works everywhere - with or without AudioProvider:
 * - Inside AudioProvider: Uses React context (cleanest)
 * - Outside AudioProvider: Uses global singleton (fallback)
 * - Handles loading states and errors gracefully
 * - Provides consistent API across entire platform
 */
export function usePlatformAudio(): PlatformAudioState {
  const [audioState, setAudioState] = useState<PlatformAudioState>({
    coreServices: null,
    transport: null,
    sampleLoader: null,
    isAudioReady: false,
    isLoading: true,
    error: null,
    audioContextState: 'unknown',
    sampleProgress: {
      harmony: 0,
      drums: 0,
      bass: 0,
      metronome: 0,
      overall: 0,
    }
  });

  // Strategy 1: Try React context first (cleanest approach) - must be at hook level
  let contextServices: any = null;
  let contextError: any = null;
  
  try {
    contextServices = useAudioServices();
  } catch (e) {
    contextError = e;
    // Not within AudioProvider - this is fine, we'll use global fallback
  }

  useEffect(() => {
    let mounted = true;
    
    async function initializeAudioServices() {
      try {
        let coreServices: CoreServices | null = null;
        let fromContext = false;
        
        // Use context services if available
        if (contextServices?.coreServices) {
          coreServices = contextServices.coreServices;
          fromContext = true;
          console.log('🎵 usePlatformAudio: Using services from React context (AudioProvider)');
        } else if (contextError) {
          console.log('🎵 usePlatformAudio: No AudioProvider context, trying global fallback...');
        }
        
        // Strategy 2: Fallback to global singleton (universal access)
        if (!coreServices) {
          const globalServices = (window as any).__globalCoreServices as CoreServices;
          if (globalServices) {
            coreServices = globalServices;
            console.log('🎵 usePlatformAudio: Using global CoreServices singleton');
          } else {
            // Wait for global services to become available
            console.log('🎵 usePlatformAudio: Waiting for global CoreServices...');
            
            // Listen for the audioServicesReady event
            const waitForServices = new Promise<CoreServices>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Audio services not available after 10 seconds'));
              }, 10000);
              
              const checkServices = () => {
                const services = (window as any).__globalCoreServices as CoreServices;
                if (services) {
                  clearTimeout(timeout);
                  window.removeEventListener('audioServicesReady', checkServices);
                  resolve(services);
                }
              };
              
              // Check immediately
              checkServices();
              
              // Listen for event
              window.addEventListener('audioServicesReady', checkServices);
            });
            
            try {
              coreServices = await waitForServices;
              console.log('🎵 usePlatformAudio: Global CoreServices became available');
            } catch (waitError) {
              console.error('🎵 usePlatformAudio: Failed to get audio services:', waitError);
              if (mounted) {
                setAudioState(prev => ({
                  ...prev,
                  isLoading: false,
                  error: 'Audio services not available. Please refresh the page.',
                }));
              }
              return;
            }
          }
        }
        
        if (!coreServices) {
          throw new Error('No audio services available');
        }
        
        // Get transport and sample loader
        const transport = coreServices.getUnifiedTransport();
        const sampleLoader = BackgroundSampleLoader.getInstance();
        
        // Get audio context state
        let audioContextState: 'suspended' | 'running' | 'closed' | 'unknown' = 'unknown';
        try {
          const audioEngine = coreServices.getAudioEngine();
          if (audioEngine && audioEngine.getTone()) {
            const tone = audioEngine.getTone();
            audioContextState = tone.context.state;
          }
        } catch (e) {
          console.warn('Could not get audio context state:', e);
        }
        
        // Get initial sample progress
        const getSampleProgress = () => ({
          harmony: sampleLoader?.getSampleStatus('harmony')?.progress || 0,
          drums: sampleLoader?.getSampleStatus('drums')?.progress || 0,
          bass: sampleLoader?.getSampleStatus('bass')?.progress || 0,
          metronome: sampleLoader?.getSampleStatus('metronome')?.progress || 0,
          overall: sampleLoader?.getOverallProgress() || 0,
        });
        
        if (mounted) {
          setAudioState({
            coreServices,
            transport,
            sampleLoader,
            isAudioReady: true,
            isLoading: false,
            error: null,
            audioContextState,
            sampleProgress: getSampleProgress(),
          });
          
          console.log('🎵 usePlatformAudio: Successfully initialized', {
            source: fromContext ? 'React Context' : 'Global Singleton',
            transportReady: !!transport,
            sampleLoaderReady: !!sampleLoader,
            audioContextState,
          });
        }
        
        // Set up sample loading progress updates
        if (sampleLoader) {
          const progressInterval = setInterval(() => {
            if (mounted) {
              setAudioState(prev => ({
                ...prev,
                sampleProgress: getSampleProgress(),
              }));
            } else {
              clearInterval(progressInterval);
            }
          }, 1000);
        }
        
      } catch (error) {
        console.error('🎵 usePlatformAudio: Initialization failed:', error);
        if (mounted) {
          setAudioState(prev => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown audio initialization error',
          }));
        }
      }
    }
    
    initializeAudioServices();
    
    return () => {
      mounted = false;
    };
  }, [contextServices, contextError]);

  return audioState;
}

/**
 * Convenience hooks for specific audio services
 */

export function usePlatformTransport() {
  const { transport, isAudioReady, error } = usePlatformAudio();
  
  if (!isAudioReady && !error) {
    return { transport: null, isLoading: true, error: null };
  }
  
  if (error) {
    return { transport: null, isLoading: false, error };
  }
  
  return { transport, isLoading: false, error: null };
}

export function usePlatformSamples() {
  const { sampleLoader, sampleProgress, isAudioReady, error } = usePlatformAudio();
  
  if (!isAudioReady && !error) {
    return { 
      sampleLoader: null, 
      progress: { harmony: 0, drums: 0, bass: 0, metronome: 0, overall: 0 },
      isLoading: true, 
      error: null 
    };
  }
  
  if (error) {
    return { 
      sampleLoader: null, 
      progress: { harmony: 0, drums: 0, bass: 0, metronome: 0, overall: 0 },
      isLoading: false, 
      error 
    };
  }
  
  return { 
    sampleLoader, 
    progress: sampleProgress,
    isLoading: false, 
    error: null 
  };
}

/**
 * Hook to check if platform audio is ready
 */
export function usePlatformAudioStatus() {
  const { isAudioReady, isLoading, error, audioContextState } = usePlatformAudio();
  
  return {
    isReady: isAudioReady,
    isLoading,
    error,
    audioContextState,
    canPlay: isAudioReady && audioContextState === 'running',
    needsUserGesture: isAudioReady && audioContextState === 'suspended',
  };
}