'use client';

import { useEffect, useRef } from 'react';
import { getSamplePreloader } from '../services/InitialSamplePreloader.bridge';
import { CoreServices } from '../services/core/CoreServices.js';
import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@bassnotion/contracts';
import { WindowRegistry } from '../services/WindowRegistry.js';

const logger = getLogger('scroll-trigger-loader');

export interface ScrollTriggerLoaderProps {
  exercises?: Exercise[];
  tutorialId?: string;
}

/**
 * ScrollTriggerLoader - Initialization Orchestrator
 *
 * CRITICAL: This component now controls the ENTIRE initialization sequence to prevent
 * race conditions between useCoreServices and sample loading.
 *
 * Initialization sequence on first user interaction:
 * 1. Create and pre-initialize CoreServices (if not exists)
 * 2. Load all tutorial samples (if exercises provided)
 * 3. Emit 'samples-ready' event
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

      try {
        // STEP 1: Ensure CoreServices exists (preInitialize only, no AudioContext)
        logger.info('[1/3] Ensuring CoreServices is pre-initialized...');
        // ✅ BUG #8 FIX: Get CoreServices using WindowRegistry
        let coreServices = WindowRegistry.getCoreServices();

        if (!coreServices) {
          logger.info('CoreServices not found, creating new instance...');
          coreServices = new CoreServices({
            enableHighPrecisionTiming: true,
            enablePerformanceMonitoring: true,
            autoLoadPlugins: true,
            audioLatencyHint: 'interactive',
            sampleRate: 48000,
          });

          // Pre-initialize (loads Tone.js, NO AudioContext)
          await coreServices.preInitialize();

          // ✅ BUG #8 FIX: Store globally using WindowRegistry
          WindowRegistry.setCoreServices(coreServices);
          logger.info('✅ CoreServices pre-initialized and stored globally');
        } else {
          logger.info('✅ CoreServices already exists');
        }

        // STEP 2: Load samples (essential or tutorial-level)
        const preloader = getSamplePreloader();

        if (exercises && exercises.length > 0) {
          // Tutorial-level loading: Load all samples for all exercises
          logger.info(
            `[2/3] Loading samples for all ${exercises.length} exercises in tutorial...`,
          );
          await preloader.loadTutorialSamples(exercises, tutorialId);
          logger.info('✅ All tutorial samples loaded');
        } else {
          // Fallback: Load only essential samples
          logger.info('[2/3] Loading essential samples (no exercises provided)...');
          await preloader.loadEssentialSamples();
          logger.info('✅ Essential samples loaded');
        }

        // STEP 3: Mark as ready
        logger.info('[3/3] Emitting samples-ready event...');
        // ✅ BUG #8 FIX: Use WindowRegistry for initialization flags
        WindowRegistry.setSamplesReady(true);
        WindowRegistry.setEssentialSamplesLoaded(true);

        if (typeof window !== 'undefined') {
          // Emit both events
          window.dispatchEvent(new Event('samplesReady'));
          window.dispatchEvent(new Event('essentialSamplesLoaded')); // Backward compatibility
        }

        logger.info('✅ Initialization sequence complete!');
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
