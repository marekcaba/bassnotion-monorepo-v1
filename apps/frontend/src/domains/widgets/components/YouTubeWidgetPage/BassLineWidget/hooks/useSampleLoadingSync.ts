'use client';

/**
 * useSampleLoadingSync Hook (Bass-specific)
 *
 * Listens for bass sample loading events and triggers re-registration:
 * - Window events: bass-samples-loaded, samplesReady
 * - Ensures the BassLineWidget re-registers with PlaybackEngine
 *   after samples are fully loaded
 *
 * @example
 * const { samplesLoadedTrigger } = useSampleLoadingSync();
 */

import { useState, useEffect } from 'react';
import { isVerboseDebugEnabled } from '@/config/debug';
import type {
  UseSampleLoadingSyncOptions,
  UseSampleLoadingSyncReturn,
} from '../types.js';

/**
 * Hook for listening to bass sample loading events
 */
export function useSampleLoadingSync(
  options: UseSampleLoadingSyncOptions = {},
): UseSampleLoadingSyncReturn {
  const { subscribeToEvent } = options;

  // State to track when samples are loaded (triggers re-registration)
  const [samplesLoadedTrigger, setSamplesLoadedTrigger] = useState(0);

  /**
   * Listen for bass-samples-loaded event from various sources
   */
  useEffect(() => {
    // Window event handler for bass-samples-loaded
    const handleBassSamplesLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (isVerboseDebugEnabled()) {
        console.log(
          '[BASS-WIDGET] Received bass-samples-loaded event:',
          customEvent.detail,
        );
      }
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // samplesReady from ScrollTriggerLoader
    const handleSamplesReady = () => {
      if (isVerboseDebugEnabled()) {
        console.log(
          '[BASS-WIDGET] Received samplesReady event from ScrollTriggerLoader',
        );
      }
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // Add window event listeners
    window.addEventListener('bass-samples-loaded', handleBassSamplesLoaded);
    window.addEventListener('samplesReady', handleSamplesReady);

    // Subscribe to sync context event if available
    let unsubscribe: (() => void) | undefined;
    if (subscribeToEvent) {
      unsubscribe = subscribeToEvent(
        'bass-samples-loaded',
        (payload: unknown) => {
          if (isVerboseDebugEnabled()) {
            console.log(
              '[BASS-WIDGET] Received bass-samples-loaded event (sync):',
              payload,
            );
          }
          setSamplesLoadedTrigger((prev) => prev + 1);
        },
      );
    }

    return () => {
      window.removeEventListener(
        'bass-samples-loaded',
        handleBassSamplesLoaded,
      );
      window.removeEventListener('samplesReady', handleSamplesReady);
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToEvent]);

  return {
    samplesLoadedTrigger,
  };
}
