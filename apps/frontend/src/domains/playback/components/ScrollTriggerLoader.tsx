'use client';

import { useEffect, useRef } from 'react';
import { getSamplePreloader } from '../services/InitialSamplePreloader.bridge';
import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@bassnotion/contracts';
import { WindowRegistry } from '../services/WindowRegistry.js';
import { lifecycle } from '../utils/InitializationLifecycleLogger.js';

// Use the 'info' category (which is enabled by default in dev) so these
// logs actually appear. Custom category names like 'scroll-trigger-loader'
// get filtered out by the dev logger's enabledCategories allow-list.
const logger = getLogger('info');

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
 * Initialization sequence — kicked off on mount:
 * 1. Create and pre-initialize CoreServices (loads Tone.js, NO AudioContext)
 * 2. Load all tutorial samples (if exercises provided)
 * 3. Emit 'samples-ready' event → triggers buffer injection listener
 *
 * Why on mount and not on first user gesture:
 * - Sample fetching does NOT need a user gesture — only AudioContext
 *   creation does, and that's deferred to the play button.
 * - Starting the fetch on mount gives the user a 2-3 second head start so
 *   pressing play after reading the tutorial copy is near-instant.
 *
 * Gesture listeners remain as a defensive fallback in case the mount path
 * ever no-ops (e.g. CoreServices was already created elsewhere and we want
 * to confirm samples are loading).
 *
 * NOTE: AudioContext creation is NOT done here. Browser policy requires a
 * "trusted" user gesture (click/touch) for AudioContext. When the user
 * clicks play, samples are already loaded — only AudioContext + buffer
 * injection remain (~100-200ms).
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
        // STEP 1: CoreServices is OWNED by AudioProvider (singleton mounted at
        // app root). We just wait for it. Previously this code created a
        // duplicate instance if WindowRegistry was empty — racing AudioProvider
        // and producing two CoreServices each with their own samplesReady
        // listener, which decoded the same ArrayBuffer in parallel and
        // detached it mid-flight (resulting in silent drums/metronome).
        //
        // If you see "CoreServices not yet ready" warnings here in dev, it
        // means AudioProvider is mounted too late in the tree or this
        // component is mounted outside its scope.
        logger.info('[1/3] Waiting for CoreServices (owned by AudioProvider)…');
        let coreServices = WindowRegistry.getCoreServices();
        if (!coreServices) {
          // Brief wait — AudioProvider's mount effect should populate this
          // within a tick or two of our own mount.
          const startedAt = Date.now();
          while (!coreServices && Date.now() - startedAt < 2000) {
            await new Promise((r) => setTimeout(r, 50));
            coreServices = WindowRegistry.getCoreServices();
          }
        }
        if (!coreServices) {
          logger.warn(
            'CoreServices still not ready after 2s — sample preload will retry on user gesture',
          );
          lifecycle.checkpoint('CORESERVICES_CREATED', { reused: false });
          return;
        }
        logger.info('✅ CoreServices available (from AudioProvider)');
        lifecycle.checkpoint('CORESERVICES_CREATED', { reused: true });

        // STEP 2: Load samples (essential or tutorial-level)
        const preloader = getSamplePreloader();

        if (exercises && exercises.length > 0) {
          // Tutorial-level loading: Load all samples for all exercises
          logger.info(
            `[2/3] Loading samples for all ${exercises.length} exercises in tutorial...`,
          );
          lifecycle.checkpoint('TUTORIAL_SAMPLES_START', {
            exerciseCount: exercises.length,
          });
          await preloader.loadTutorialSamples(exercises, tutorialId);
          lifecycle.checkpoint('TUTORIAL_SAMPLES_COMPLETE', {
            exerciseCount: exercises.length,
          });
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

        // STEP 3: Mark samples as ready (flags only).
        // The `samplesReady` event is dispatched by useActAwarePreload (the
        // single dispatcher). ScrollTriggerLoader only sets the registry
        // flags so that consumers polling WindowRegistry.getSamplesReady()
        // see the ready state.
        logger.info('[3/3] Sample load complete — flags set');
        WindowRegistry.setSamplesReady(true);
        WindowRegistry.setEssentialSamplesLoaded(true);
        lifecycle.checkpoint('SAMPLES_READY_EVENT');

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

        logger.info(
          '✅ Initialization sequence complete (AudioContext deferred to play click)',
        );
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

    // Kick off the load immediately on mount — sample fetching doesn't
    // require a user gesture, and the previous gesture-gated path left the
    // user staring at a "Loading…" toast on first play.
    triggerInitialization();

    // Defensive fallback: if mount-path init no-ops or races, the first
    // user gesture will still kick it off. These listeners are passive +
    // once, so they cost nothing if init has already fired.
    const options = { passive: true, once: true };
    window.addEventListener('scroll', triggerInitialization, options);
    window.addEventListener('touchstart', triggerInitialization, options);
    window.addEventListener('mouseenter', triggerInitialization, options);
    window.addEventListener('click', triggerInitialization, options);

    // Cleanup on unmount
    return () => {
      removeAllListeners();
    };
  }, [exercises, tutorialId]);

  // This component doesn't render anything
  return null;
}
