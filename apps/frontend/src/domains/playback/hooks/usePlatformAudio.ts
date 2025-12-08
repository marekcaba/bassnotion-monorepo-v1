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
 *
 * FAANG FIX (Issue #5): Uses threshold-based progress updates to prevent
 * unnecessary rerenders. Progress is only updated if changed by >1%.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioServices } from '../providers/AudioProvider.js';
import {
  getSamplePreloader,
  InitialSamplePreloader,
} from '../services/InitialSamplePreloader.js';
import type { CoreServices } from '../services/core/CoreServices.js';
import type { TransportAdapter } from '../services/core/TransportAdapter.js';
import { WindowRegistry } from '../services/WindowRegistry.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('usePlatformAudio');

/** Threshold for sample progress updates (1% = 0.01) */
const PROGRESS_UPDATE_THRESHOLD = 0.01;

export interface PlatformAudioState {
  /** Core services instance (from AudioProvider or global) */
  coreServices: CoreServices | null;

  /** UnifiedTransport - same instance everywhere */
  transport: TransportAdapter | null;

  /** InitialSamplePreloader - automatic sample loading */
  sampleLoader: InitialSamplePreloader | null;

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
    },
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
          logger.info(
            '🎵 usePlatformAudio: Using services from React context (AudioProvider)',
          );
        } else if (contextError) {
          logger.info(
            '🎵 usePlatformAudio: No AudioProvider context, trying global fallback...',
          );
        }

        // Strategy 2: Fallback to global singleton (universal access)
        if (!coreServices) {
          const globalServices = WindowRegistry.getCoreServices() as CoreServices;
          if (globalServices) {
            coreServices = globalServices;
            logger.info(
              '🎵 usePlatformAudio: Using global CoreServices singleton',
            );
          } else {
            // Wait for global services to become available
            logger.info(
              '🎵 usePlatformAudio: Waiting for global CoreServices...',
            );

            // Listen for the audioServicesReady event
            const waitForServices = new Promise<CoreServices>(
              (resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(
                    new Error('Audio services not available after 10 seconds'),
                  );
                }, 10000);

                const checkServices = () => {
                  const services = WindowRegistry.getCoreServices() as CoreServices;
                  if (services) {
                    clearTimeout(timeout);
                    window.removeEventListener(
                      'audioServicesReady',
                      checkServices,
                    );
                    resolve(services);
                  }
                };

                // Check immediately
                checkServices();

                // Listen for event
                window.addEventListener('audioServicesReady', checkServices);
              },
            );

            try {
              coreServices = await waitForServices;
              logger.info(
                '🎵 usePlatformAudio: Global CoreServices became available',
              );
            } catch (waitError) {
              logger.error(
                '🎵 usePlatformAudio: Failed to get audio services:',
                waitError,
              );
              if (mounted) {
                setAudioState((prev) => ({
                  ...prev,
                  isLoading: false,
                  error:
                    'Audio services not available. Please refresh the page.',
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
        const sampleLoader = getSamplePreloader();

        // Get audio context state
        let audioContextState: 'suspended' | 'running' | 'closed' | 'unknown' =
          'unknown';
        try {
          const audioEngine = coreServices.getAudioEngine();
          if (audioEngine && audioEngine.getTone()) {
            const tone = audioEngine.getTone();
            audioContextState = tone.context.state;
          }
        } catch (e) {
          logger.warn('Could not get audio context state:', e);
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

          logger.info('🎵 usePlatformAudio: Successfully initialized', {
            source: fromContext ? 'React Context' : 'Global Singleton',
            transportReady: !!transport,
            sampleLoaderReady: !!sampleLoader,
            audioContextState,
          });
        }

        // Set up sample loading progress updates with threshold-based updates
        // FAANG FIX: Only update if progress changed significantly (>1%)
        if (sampleLoader) {
          let lastProgress = getSampleProgress();

          const progressInterval = setInterval(() => {
            if (!mounted) {
              clearInterval(progressInterval);
              return;
            }

            const newProgress = getSampleProgress();

            // Only update state if overall progress changed significantly
            if (
              Math.abs(newProgress.overall - lastProgress.overall) >
              PROGRESS_UPDATE_THRESHOLD
            ) {
              lastProgress = newProgress;
              setAudioState((prev) => ({
                ...prev,
                sampleProgress: newProgress,
              }));
            }
          }, 1000);
        }
      } catch (error) {
        logger.error('🎵 usePlatformAudio: Initialization failed:', error);
        if (mounted) {
          setAudioState((prev) => ({
            ...prev,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown audio initialization error',
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
  const { sampleLoader, sampleProgress, isAudioReady, error } =
    usePlatformAudio();

  if (!isAudioReady && !error) {
    return {
      sampleLoader: null,
      progress: { harmony: 0, drums: 0, bass: 0, metronome: 0, overall: 0 },
      isLoading: true,
      error: null,
    };
  }

  if (error) {
    return {
      sampleLoader: null,
      progress: { harmony: 0, drums: 0, bass: 0, metronome: 0, overall: 0 },
      isLoading: false,
      error,
    };
  }

  return {
    sampleLoader,
    progress: sampleProgress,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook to check if platform audio is ready
 */
export function usePlatformAudioStatus() {
  const { isAudioReady, isLoading, error, audioContextState } =
    usePlatformAudio();

  return {
    isReady: isAudioReady,
    isLoading,
    error,
    audioContextState,
    canPlay: isAudioReady && audioContextState === 'running',
    needsUserGesture: isAudioReady && audioContextState === 'suspended',
  };
}
