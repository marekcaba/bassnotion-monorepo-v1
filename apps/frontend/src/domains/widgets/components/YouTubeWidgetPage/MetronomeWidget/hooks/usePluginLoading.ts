'use client';

/**
 * usePluginLoading Hook
 *
 * Handles Phase 1 of metronome initialization: Loading the WAM plugin class.
 * This can be done before AudioContext is available.
 *
 * Also checks for preloaded metronome from GlobalSampleCache on mount.
 *
 * @example
 * const { pluginClassLoaded } = usePluginLoading({
 *   pluginClassLoaded,
 *   onPluginClassLoaded: (PluginClass) => {
 *     wamPluginClassRef.current = PluginClass;
 *     setPluginClassLoaded(true);
 *   },
 * });
 */

import { useEffect, useCallback, useRef } from 'react';
import { getLogger } from '@/utils/logger.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';

const logger = getLogger('metronome-widget');

export interface UsePluginLoadingOptions {
  /** Whether the plugin class is already loaded */
  pluginClassLoaded: boolean;
  /** Reference to store the WAM plugin class */
  wamPluginClassRef: React.MutableRefObject<any>;
  /** Reference to store the metronome plugin instance */
  metronomePluginRef: React.MutableRefObject<any>;
  /** Callback when plugin class is loaded */
  onPluginClassLoaded: () => void;
  /** Callback when preloaded plugin is found */
  onPreloadedPluginFound: (volume: number, isMuted: boolean) => Promise<void>;
  /** Current volume */
  volume: number;
  /** Current mute state */
  isMuted: boolean;
}

export interface UsePluginLoadingReturn {
  // No direct return values - all state updates via callbacks and refs
}

/**
 * Hook for loading WAM plugin class and checking for preloaded metronome
 */
export function usePluginLoading(
  options: UsePluginLoadingOptions,
): UsePluginLoadingReturn {
  const {
    pluginClassLoaded,
    wamPluginClassRef,
    metronomePluginRef,
    onPluginClassLoaded,
    onPreloadedPluginFound,
    volume,
    isMuted,
  } = options;

  // Track if we've already checked for preloaded metronome
  const checkedPreloadRef = useRef(false);

  /**
   * Check for preloaded metronome on mount
   */
  useEffect(() => {
    if (checkedPreloadRef.current) return;
    checkedPreloadRef.current = true;

    const checkPreloadedMetronome = async () => {
      try {
        const { GlobalSampleCache } =
          await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
        const preloadedMetronome = GlobalSampleCache.getCachedInstrument(
          'metronome-preloaded',
        );

        if (preloadedMetronome) {
          logger.debug(
            'Metronome instrument found in GlobalSampleCache on mount!',
          );
          metronomePluginRef.current = preloadedMetronome;
          await onPreloadedPluginFound(volume, isMuted);
        }
      } catch (error) {
        logger.debug('Failed to check preloaded metronome', { error });
      }
    };

    checkPreloadedMetronome();
  }, [metronomePluginRef, onPreloadedPluginFound, volume, isMuted]);

  /**
   * Load the plugin class
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');
      lifecycle.checkpoint('METRONOME_PLUGIN_LOADING');

      try {
        const { default: WamMetronome } =
          await import('@/domains/playback/modules/instruments/adapters/wam/WamMetronome');
        wamPluginClassRef.current = WamMetronome;
        onPluginClassLoaded();
        logger.debug('WAM Metronome plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Metronome plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded, wamPluginClassRef, onPluginClassLoaded]);

  return {};
}
