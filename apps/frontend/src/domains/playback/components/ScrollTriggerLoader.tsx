'use client';

import { useEffect, useRef } from 'react';
import { getSamplePreloader } from '../services/InitialSamplePreloader';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('scroll-trigger-loader');

/**
 * ScrollTriggerLoader - Progressive Sample Loading Component
 *
 * Triggers audio sample loading on first user interaction to maintain
 * perfect page load performance while ensuring samples are ready when needed.
 *
 * Loading stages:
 * 1. First interaction: Load essential samples (harmony v10, basic drums, metronome)
 * 2. Exercise visible: Load full quality samples (all velocity layers)
 */
export function ScrollTriggerLoader() {
  const hasTriggeredRef = useRef(false);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    const triggerEssentialSamples = async () => {
      if (hasTriggeredRef.current || isLoadingRef.current) return;

      hasTriggeredRef.current = true;
      isLoadingRef.current = true;

      logger.info(
        '🚀 First user interaction detected - loading essential samples',
      );

      try {
        const preloader = getSamplePreloader();

        // Load only essential samples on first interaction
        await preloader.loadEssentialSamples();

        logger.info('✅ Essential samples loaded successfully');

        // Mark that essential samples are ready
        if (typeof window !== 'undefined') {
          (window as any).__essentialSamplesLoaded = true;
          window.dispatchEvent(new Event('essentialSamplesLoaded'));
        }
      } catch (error) {
        logger.error('❌ Failed to load essential samples:', error);
      } finally {
        isLoadingRef.current = false;
      }

      // Remove all event listeners after triggering
      removeAllListeners();
    };

    const removeAllListeners = () => {
      window.removeEventListener('scroll', triggerEssentialSamples);
      window.removeEventListener('touchstart', triggerEssentialSamples);
      window.removeEventListener('mouseenter', triggerEssentialSamples);
      window.removeEventListener('click', triggerEssentialSamples);
    };

    // Add passive listeners for various user interactions
    const options = { passive: true, once: true };

    // Scroll is most common first interaction
    window.addEventListener('scroll', triggerEssentialSamples, options);

    // Touch for mobile users
    window.addEventListener('touchstart', triggerEssentialSamples, options);

    // Mouse movement for desktop users
    window.addEventListener('mouseenter', triggerEssentialSamples, options);

    // Click as fallback
    window.addEventListener('click', triggerEssentialSamples, options);

    // Cleanup on unmount
    return () => {
      removeAllListeners();
    };
  }, []);

  // This component doesn't render anything
  return null;
}
