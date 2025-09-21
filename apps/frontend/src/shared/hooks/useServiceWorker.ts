/**
 * Service Worker Hook
 *
 * Manages service worker registration and provides cache management
 */

import { useEffect, useState, useCallback } from 'react';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdating: boolean;
  cacheSize: {
    sampleCount: number;
    staticCount: number;
    totalCount: number;
  };
  error: Error | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdating: false,
    cacheSize: {
      sampleCount: 0,
      staticCount: 0,
      totalCount: 0,
    },
    error: null,
  });

  // Check if service workers are supported
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isSupported: 'serviceWorker' in navigator,
    }));
  }, []);

  // Register service worker
  useEffect(() => {
    if (!state.isSupported) return;

    let registration: ServiceWorkerRegistration;

    const registerSW = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          error: null,
        }));

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              setState((prev) => ({
                ...prev,
                isUpdating: false,
              }));

              // Notify user about update
              if (window.confirm('New version available! Reload to update?')) {
                window.location.reload();
              }
            } else if (newWorker.state === 'installing') {
              setState((prev) => ({
                ...prev,
                isUpdating: true,
              }));
            }
          });
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isRegistered: false,
          error: error as Error,
        }));
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    return () => {
      // Cleanup
      if (registration) {
        // Don't unregister, just remove listeners
      }
    };
  }, [state.isSupported]);

  // Pre-cache audio samples
  const cacheSamples = useCallback(
    async (urls: string[]) => {
      if (!state.isRegistered || !navigator.serviceWorker.controller) {
        console.warn('Service worker not ready for caching');
        return;
      }

      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_SAMPLES',
        urls,
      });
    },
    [state.isRegistered],
  );

  // Clear sample cache
  const clearSampleCache = useCallback(async () => {
    if (!state.isRegistered || !navigator.serviceWorker.controller) {
      console.warn('Service worker not ready');
      return;
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_SAMPLE_CACHE',
    });
  }, [state.isRegistered]);

  // Get cache size
  const getCacheSize = useCallback(async () => {
    if (!state.isRegistered || !navigator.serviceWorker.controller) {
      return;
    }

    const channel = new MessageChannel();

    return new Promise<void>((resolve) => {
      channel.port1.onmessage = (event) => {
        setState((prev) => ({
          ...prev,
          cacheSize: event.data,
        }));
        resolve();
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [channel.port2],
      );
    });
  }, [state.isRegistered]);

  // Update cache size periodically
  useEffect(() => {
    if (!state.isRegistered) return;

    getCacheSize();
    const interval = setInterval(getCacheSize, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [state.isRegistered, getCacheSize]);

  return {
    ...state,
    cacheSamples,
    clearSampleCache,
    getCacheSize,
  };
}

/**
 * Pre-cache critical audio samples
 */
export function useSamplePreloader() {
  const { cacheSamples, isRegistered } = useServiceWorker();

  useEffect(() => {
    if (!isRegistered) return;

    // Pre-cache essential samples
    const essentialSamples = [
      '/samples/metronome/click.mp3',
      '/samples/metronome/accent.mp3',
      '/samples/bass/E1.mp3',
      '/samples/bass/A1.mp3',
      '/samples/bass/D2.mp3',
      '/samples/bass/G2.mp3',
    ];

    cacheSamples(essentialSamples);
  }, [isRegistered, cacheSamples]);
}
