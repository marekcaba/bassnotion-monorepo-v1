'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { verboseLog } from '@/config/debug';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { getSamplePreloader } from '@/domains/playback/services/InitialSamplePreloader.js';
// CoreServices import removed — this hook no longer creates instances.
// AudioProvider is the sole owner; see comment in loadSamples().
import { getLogger } from '@/utils/logger.js';
import type { ActName } from './useCurrentAct.js';

const logger = getLogger('useActAwarePreload');

type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

interface UseActAwarePreloadParams {
  exercises: any[];
  tutorialId?: string;
  currentAct: ActName;
}

interface UseActAwarePreloadResult {
  loadingState: LoadingState;
  progress: number;
  samplesReady: boolean;
  error?: Error;
  forceLoad: () => Promise<void>;
}

/**
 * Act-aware sample preloading hook
 *
 * Starts preloading Act 2 samples immediately when Act 1 is visible.
 * Uses requestIdleCallback to avoid blocking the main thread.
 *
 * Since /app/* routes are behind AuthGuard (not SEO crawlable),
 * we can load immediately without waiting for user interaction.
 */
export function useActAwarePreload({
  exercises,
  tutorialId,
  currentAct,
}: UseActAwarePreloadParams): UseActAwarePreloadResult {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | undefined>();

  const hasStartedRef = useRef(false);
  const idleCallbackIdRef = useRef<number | null>(null);
  const exercisesRef = useRef(exercises);
  const prevTutorialIdRef = useRef(tutorialId);
  exercisesRef.current = exercises;

  // ✅ CRITICAL FIX: Reset hasStartedRef when tutorial changes OR on first mount
  // Without this, samples only load once and never reload when switching tutorials
  // ALSO: We need to check if samples are actually ready - if not, allow reload
  useEffect(() => {
    const samplesCurrentlyReady =
      typeof window !== 'undefined' ? window.__samplesReady : false;
    verboseLog('🔍 [DEBUG] Tutorial/mount check', {
      prev: prevTutorialIdRef.current,
      current: tutorialId,
      changed: prevTutorialIdRef.current !== tutorialId,
      samplesCurrentlyReady,
      hasStarted: hasStartedRef.current,
    });

    // Reset if tutorial changed OR if samples aren't ready yet
    if (prevTutorialIdRef.current !== tutorialId || !samplesCurrentlyReady) {
      verboseLog('🔍 [DEBUG] Resetting hasStartedRef and loadingState', {
        reason:
          prevTutorialIdRef.current !== tutorialId
            ? 'tutorial-change'
            : 'samples-not-ready',
      });
      logger.info('Resetting sample preload state', {
        from: prevTutorialIdRef.current,
        to: tutorialId,
        samplesReady: samplesCurrentlyReady,
      });
      hasStartedRef.current = false;
      setLoadingState('idle');
      prevTutorialIdRef.current = tutorialId;
    }
  }, [tutorialId]);

  // Progress callback for InitialSamplePreloader
  const handleProgress = useCallback((pct: number) => {
    setProgress(pct);
    WindowRegistry.setAct2PreloadProgress(pct);

    if (pct >= 100) {
      setLoadingState('ready');
      WindowRegistry.setAct2SamplesReady(true);
      WindowRegistry.setSamplesReady(true);
    }
  }, []);

  // Core loading function
  const loadSamples = useCallback(async () => {
    verboseLog('🔍 [DEBUG] loadSamples called', { loadingState });
    if (loadingState === 'loading' || loadingState === 'ready') {
      verboseLog('🔍 [DEBUG] Skipping loadSamples - already loading or ready');
      return;
    }

    verboseLog('🔍 [DEBUG] Setting loadingState to "loading"');
    setLoadingState('loading');
    logger.info('Starting Act 2 sample preload', {
      exerciseCount: exercisesRef.current?.length,
      tutorialId,
    });

    try {
      // Step 1: CoreServices is OWNED by AudioProvider — just wait for it.
      // Previously this hook created a duplicate CoreServices, racing
      // AudioProvider AND ScrollTriggerLoader; each instance had its own
      // samplesReady listener, and three concurrent decodes of the same
      // shared ArrayBuffer detached it mid-flight (silent drums/metronome).
      let coreServices = WindowRegistry.getCoreServices();
      if (!coreServices) {
        const startedAt = Date.now();
        while (!coreServices && Date.now() - startedAt < 2000) {
          await new Promise((r) => setTimeout(r, 50));
          coreServices = WindowRegistry.getCoreServices();
        }
      }
      if (!coreServices) {
        logger.warn(
          'CoreServices still not ready after 2s — Act 2 preload aborted, will retry on user gesture',
        );
        setLoadingState('idle');
        return;
      }

      // Step 2: Load samples with progress tracking
      const preloader = getSamplePreloader();

      if (exercisesRef.current?.length > 0) {
        await preloader.loadTutorialSamples(
          exercisesRef.current,
          tutorialId,
          handleProgress,
        );
      } else {
        await preloader.loadEssentialSamples();
        handleProgress(100);
      }

      verboseLog('🔍 [DEBUG] Samples loaded successfully, setting flags');
      setLoadingState('ready');
      WindowRegistry.setSamplesReady(true);
      WindowRegistry.setAct2SamplesReady(true);
      WindowRegistry.setEssentialSamplesLoaded(true);

      // SINGLE DISPATCHER: useActAwarePreload (mounted inside YouTubeWidgetPage)
      // is the one place that dispatches `samplesReady`. The singleflight
      // guard in CoreServices.reinjectAllBuffers prevents parallel decodes
      // even if this fires twice during Strict Mode mount-unmount-mount.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('samplesReady'));
        window.dispatchEvent(new Event('essentialSamplesLoaded'));
      }

      logger.info('Act 2 samples ready');
    } catch (err) {
      logger.error('Failed to preload Act 2 samples', err as Error);
      setError(err as Error);
      setLoadingState('error');
      WindowRegistry.setInitializationFailed(true);
    }
  }, [loadingState, tutorialId, handleProgress]);

  // Start preloading immediately when page loads
  // ✅ FIX: Load samples on ANY act, not just 'understand'
  // This fixes the timeout issue when progress-based navigation lands on Act 2 or Act 3
  useEffect(() => {
    verboseLog('🔍 [DEBUG] useActAwarePreload effect running', {
      exercisesLength: exercises?.length,
      hasStarted: hasStartedRef.current,
      loadingState,
      currentAct,
      tutorialId,
      windowSamplesReady:
        typeof window !== 'undefined' ? window.__samplesReady : 'N/A',
    });

    // Only start if:
    // 1. We have exercises to load
    // 2. We haven't already started
    if (
      !exercises?.length ||
      hasStartedRef.current ||
      loadingState !== 'idle'
    ) {
      verboseLog('🔍 [DEBUG] Skipping preload:', {
        noExercises: !exercises?.length,
        alreadyStarted: hasStartedRef.current,
        notIdle: loadingState !== 'idle',
      });
      return;
    }

    hasStartedRef.current = true;

    verboseLog('🔍 [DEBUG] Starting sample preload', { currentAct });
    logger.info('Scheduling sample preload', { currentAct });

    // ✅ FIX: Call loadSamples directly - requestIdleCallback was being canceled by re-renders
    // We want samples to load immediately, not on idle
    verboseLog(
      '🔍 [DEBUG] Calling loadSamples() directly (no requestIdleCallback)',
    );
    loadSamples();

    return () => {
      if (idleCallbackIdRef.current && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackIdRef.current);
      }
    };
  }, [currentAct, exercises?.length, loadingState, loadSamples]);

  // Listen for act2SamplesReady event (for cross-component sync)
  useEffect(() => {
    const handleReady = () => {
      if (loadingState !== 'ready') {
        setLoadingState('ready');
        setProgress(100);
      }
    };

    window.addEventListener('act2SamplesReady', handleReady);
    return () => window.removeEventListener('act2SamplesReady', handleReady);
  }, [loadingState]);

  // Reset state when navigating away (cleanup)
  useEffect(() => {
    return () => {
      WindowRegistry.resetAct2PreloadState();
    };
  }, []);

  return {
    loadingState,
    progress,
    samplesReady: loadingState === 'ready',
    error,
    forceLoad: loadSamples,
  };
}
