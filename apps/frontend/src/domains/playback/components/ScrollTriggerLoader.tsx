'use client';

import { useEffect, useRef } from 'react';
import { getSamplePreloader } from '../services/InitialSamplePreloader.bridge';
import { CoreServices } from '../services/core/CoreServices.js';
import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@bassnotion/contracts';
import { WindowRegistry } from '../services/WindowRegistry.js';
import { lifecycle } from '../utils/InitializationLifecycleLogger.js';

const logger = getLogger('scroll-trigger-loader');

export interface ScrollTriggerLoaderProps {
  exercises?: Exercise[];
  tutorialId?: string;
}

/**
 * ScrollTriggerLoader - Initialization Orchestrator
 *
 * CRITICAL: This component controls the initialization sequence to prevent
 * race conditions between useCoreServices and sample loading.
 *
 * Initialization sequence on first user interaction (scroll/touch/click):
 * 1. Create and pre-initialize CoreServices (loads Tone.js, NO AudioContext)
 * 2. Load all tutorial samples (if exercises provided)
 * 3. Emit 'samples-ready' event → triggers buffer injection listener
 *
 * NOTE: AudioContext creation is deferred to play button click because:
 * - Browser policy requires a trusted user gesture (click/touch) for AudioContext
 * - Scroll may not be accepted as a trusted gesture in all browsers
 * - By deferring, we ensure samples are ready, making play click nearly instant
 *
 * This prevents Bug #1 (Race Condition) by ensuring CoreServices always exists
 * before any sample loading occurs.
 */
export function ScrollTriggerLoader({
  exercises,
  tutorialId,
}: ScrollTriggerLoaderProps = {}) {
  const hasTriggeredRef = useRef(false);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    const triggerInitialization = async () => {
      if (hasTriggeredRef.current || isLoadingRef.current) return;

      hasTriggeredRef.current = true;
      isLoadingRef.current = true;

      logger.info(
        '🚀 First user interaction detected - starting initialization sequence',
      );
      lifecycle.checkpoint('USER_INTERACTION_DETECTED');

      try {
        // STEP 1: Ensure CoreServices exists (preInitialize only, no AudioContext)
        logger.info('[1/3] Ensuring CoreServices is pre-initialized...');
        // ✅ BUG #8 FIX: Get CoreServices using WindowRegistry
        let coreServices = WindowRegistry.getCoreServices();

        if (!coreServices) {
          logger.info('CoreServices not found, creating new instance...');
          lifecycle.checkpoint('CORESERVICES_CREATING');
          coreServices = new CoreServices({
            enableHighPrecisionTiming: true,
            enablePerformanceMonitoring: true,
            autoLoadPlugins: true,
            audioLatencyHint: 'interactive',
            sampleRate: 48000,
          });

          // Pre-initialize (loads Tone.js, NO AudioContext)
          lifecycle.checkpoint('CORESERVICES_PREINIT_START');
          await coreServices.preInitialize();
          lifecycle.checkpoint('CORESERVICES_PREINIT_COMPLETE');

          // ✅ BUG #8 FIX: Store globally using WindowRegistry
          WindowRegistry.setCoreServices(coreServices);
          WindowRegistry.setServiceRegistry(coreServices.getServiceRegistry());
          lifecycle.checkpoint('CORESERVICES_CREATED');
          logger.info('✅ CoreServices pre-initialized and stored globally');
        } else {
          logger.info('✅ CoreServices already exists');
          lifecycle.checkpoint('CORESERVICES_CREATED', { reused: true });
        }

        // STEP 2: Load samples (essential or tutorial-level)
        const preloader = getSamplePreloader();

        if (exercises && exercises.length > 0) {
          // Tutorial-level loading: Load all samples for all exercises
          logger.info(
            `[2/3] Loading samples for all ${exercises.length} exercises in tutorial...`,
          );
          lifecycle.checkpoint('TUTORIAL_SAMPLES_START', { exerciseCount: exercises.length });
          await preloader.loadTutorialSamples(exercises, tutorialId);
          lifecycle.checkpoint('TUTORIAL_SAMPLES_COMPLETE', { exerciseCount: exercises.length });
          logger.info('✅ All tutorial samples loaded');
        } else {
          // Fallback: Load only essential samples
          logger.info(
            '[2/3] Loading essential samples (no exercises provided)...',
          );
          lifecycle.checkpoint('ESSENTIAL_SAMPLES_START');
          await preloader.loadEssentialSamples();
          lifecycle.checkpoint('ESSENTIAL_SAMPLES_COMPLETE');
          logger.info('✅ Essential samples loaded');
        }

        // STEP 3: Mark samples as ready
        logger.info('[3/3] Emitting samples-ready event...');
        // ✅ BUG #8 FIX: Use WindowRegistry for initialization flags
        WindowRegistry.setSamplesReady(true);
        WindowRegistry.setEssentialSamplesLoaded(true);

        if (typeof window !== 'undefined') {
          // Emit both events
          window.dispatchEvent(new Event('samplesReady'));
          window.dispatchEvent(new Event('essentialSamplesLoaded')); // Backward compatibility
          lifecycle.checkpoint('SAMPLES_READY_EVENT');
        }

        // NOTE: AudioContext initialization is NOT done here.
        // Browser policy requires a "trusted" user gesture (click/touch) for AudioContext.
        // Scroll may not qualify as a trusted gesture in all browsers.
        //
        // Instead, we've optimized so that when user clicks play:
        // 1. Samples are already loaded (done above) ✅
        // 2. Buffer injection listener is ready (set in preInitialize) ✅
        // 3. Only AudioContext creation + buffer injection remains (~100-200ms)
        //
        // This gives near-instant playback on first click.

        logger.info('✅ Initialization sequence complete (AudioContext deferred to play click)');
      } catch (error) {
        logger.error('❌ Failed to initialize:', error);
        // ✅ BUG #8 FIX: Mark initialization as failed using WindowRegistry
        WindowRegistry.setInitializationFailed(true);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('initializationError', { detail: error }),
          );
        }
      } finally {
        isLoadingRef.current = false;
      }

      // Remove all event listeners after triggering
      removeAllListeners();
    };

    const removeAllListeners = () => {
      window.removeEventListener('scroll', triggerInitialization);
      window.removeEventListener('touchstart', triggerInitialization);
      window.removeEventListener('mouseenter', triggerInitialization);
      window.removeEventListener('click', triggerInitialization);
    };

    // Add passive listeners for various user interactions
    const options = { passive: true, once: true };

    // Scroll is most common first interaction
    window.addEventListener('scroll', triggerInitialization, options);

    // Touch for mobile users
    window.addEventListener('touchstart', triggerInitialization, options);

    // Mouse movement for desktop users
    window.addEventListener('mouseenter', triggerInitialization, options);

    // Click as fallback
    window.addEventListener('click', triggerInitialization, options);

    // Cleanup on unmount
    return () => {
      removeAllListeners();
    };
  }, [exercises, tutorialId]);

  // This component doesn't render anything
  return null;
}
