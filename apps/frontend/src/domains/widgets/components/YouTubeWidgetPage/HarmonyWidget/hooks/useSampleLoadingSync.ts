'use client';

/**
 * useSampleLoadingSync Hook
 *
 * Listens for sample loading events and triggers re-registration:
 * - Window events: harmony-samples-loaded, samplesReady, samplesPreloaded
 * - SyncContext events (for widget coordination)
 *
 * This hook ensures the HarmonyWidget re-registers with PlaybackEngine
 * after samples are fully loaded.
 *
 * @example
 * const { samplesLoadedTrigger } = useSampleLoadingSync({
 *   subscribeToEvent: syncContext?.subscribeToEvent,
 * });
 */

import { useState, useEffect } from 'react';

/**
 * Options for the useSampleLoadingSync hook
 */
export interface UseSampleLoadingSyncOptions {
  /** Subscribe function from SyncContext (optional) */
  subscribeToEvent?: (
    eventName: string,
    callback: (payload: unknown) => void
  ) => () => void;
}

/**
 * Return type for the useSampleLoadingSync hook
 */
export interface UseSampleLoadingSyncReturn {
  /** Trigger counter that increments when samples are loaded */
  samplesLoadedTrigger: number;
}

/**
 * Hook for listening to sample loading events
 */
export function useSampleLoadingSync(
  options: UseSampleLoadingSyncOptions
): UseSampleLoadingSyncReturn {
  const { subscribeToEvent } = options;

  // State to track when samples are loaded (triggers re-registration)
  const [samplesLoadedTrigger, setSamplesLoadedTrigger] = useState(0);

  /**
   * Listen for harmony-samples-loaded event from various sources
   */
  useEffect(() => {
    // Window event handler (from ExerciseSelector)
    const handleWindowEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(
        '[HARMONY-WIDGET] Received harmony-samples-loaded event (window):',
        customEvent.detail
      );
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // samplesReady from ScrollTriggerLoader (handles initial load after scroll)
    const handleSamplesReady = () => {
      console.log(
        '[HARMONY-WIDGET] Received samplesReady event from ScrollTriggerLoader'
      );
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // samplesPreloaded from InitialSamplePreloader (full exercise-specific samples)
    const handleSamplesPreloaded = () => {
      console.log(
        '[HARMONY-WIDGET] Received samplesPreloaded event - full samples loaded!'
      );
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // Add window event listeners
    window.addEventListener('harmony-samples-loaded', handleWindowEvent);
    window.addEventListener('samplesReady', handleSamplesReady);
    window.addEventListener('samplesPreloaded', handleSamplesPreloaded);

    // Subscribe to sync context event if available
    let unsubscribe: (() => void) | undefined;
    if (subscribeToEvent) {
      unsubscribe = subscribeToEvent(
        'harmony-samples-loaded',
        (payload: unknown) => {
          console.log(
            '[HARMONY-WIDGET] Received harmony-samples-loaded event (sync):',
            payload
          );
          setSamplesLoadedTrigger((prev) => prev + 1);
        }
      );
    }

    return () => {
      window.removeEventListener('harmony-samples-loaded', handleWindowEvent);
      window.removeEventListener('samplesReady', handleSamplesReady);
      window.removeEventListener('samplesPreloaded', handleSamplesPreloaded);
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToEvent]);

  return {
    samplesLoadedTrigger,
  };
}
