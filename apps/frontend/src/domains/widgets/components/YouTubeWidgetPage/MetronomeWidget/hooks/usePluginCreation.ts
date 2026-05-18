'use client';

/**
 * usePluginCreation Hook
 *
 * Handles Phase 2 of metronome initialization: Creating the audio node
 * when AudioContext is available. This includes:
 * - Checking GlobalSampleCache for preloaded metronome
 * - Creating WAM plugin instance
 * - Connecting to master bus or destination
 * - Loading default samples
 * - Registering with InstrumentRegistry and PlaybackEngine
 *
 * @example
 * usePluginCreation({
 *   pluginClassLoaded,
 *   wamPluginClassRef,
 *   metronomePluginRef,
 *   trackIsReady,
 *   wamPluginLoaded,
 *   pluginLoadAttempts,
 *   beats,
 *   volume,
 *   isMuted,
 *   createMetronomePattern,
 *   onPluginLoaded,
 *   currentRegionRef,
 * });
 */

import { useEffect, useRef } from 'react';
import { getLogger } from '@/utils/logger.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import type { MetronomePattern } from '../types.js';

const logger = getLogger('metronome-widget');

export interface UsePluginCreationOptions {
  /** Whether the plugin class is loaded */
  pluginClassLoaded: boolean;
  /** Reference to the WAM plugin class */
  wamPluginClassRef: React.RefObject<any>;
  /** Reference to the metronome plugin instance */
  metronomePluginRef: React.MutableRefObject<any>;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Whether the plugin is already loaded */
  wamPluginLoaded: boolean;
  /** Number of plugin load attempts (for retry) */
  pluginLoadAttempts: number;
  /** Number of beats per measure */
  beats: number;
  /** Current volume (0-100) */
  volume: number;
  /** Whether muted */
  isMuted: boolean;
  /** Function to create metronome pattern */
  createMetronomePattern: () => MetronomePattern;
  /** Callback when plugin is loaded */
  onPluginLoaded: () => void;
  /** Reference to current region ID */
  currentRegionRef: React.MutableRefObject<string | null>;
  /** Track instance for pattern registration */
  track: any;
}

export interface UsePluginCreationReturn {
  // No direct return values - state updates via callbacks and refs
}

/**
 * Hook for creating the metronome audio node when AudioContext is available
 */
export function usePluginCreation(
  options: UsePluginCreationOptions,
): UsePluginCreationReturn {
  const {
    pluginClassLoaded,
    wamPluginClassRef,
    metronomePluginRef,
    trackIsReady,
    wamPluginLoaded,
    pluginLoadAttempts,
    beats,
    volume,
    isMuted,
    createMetronomePattern,
    onPluginLoaded,
    currentRegionRef,
    track,
  } = options;

  // Track if creation is in progress to prevent duplicate attempts
  const creationInProgressRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !trackIsReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (metronomePluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    // Prevent concurrent creation attempts
    if (creationInProgressRef.current) {
      logger.debug('Plugin creation already in progress, skipping');
      return;
    }

    const createAudioNode = async () => {
      creationInProgressRef.current = true;

      logger.debug('Attempting to create audio node...', {
        trackIsReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      // Check GlobalSampleCache first for preloaded metronome
      try {
        const { GlobalSampleCache } =
          await import('@/domains/playback/modules/storage/cache/GlobalSampleCache');
        const preloadedMetronome = GlobalSampleCache.getCachedInstrument(
          'metronome-preloaded',
        );

        if (preloadedMetronome && preloadedMetronome.audioNode) {
          logger.debug(
            'Found pre-loaded metronome instrument in GlobalSampleCache!',
          );
          metronomePluginRef.current = preloadedMetronome;
          onPluginLoaded();

          // Set initial volume
          await preloadedMetronome.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });

          creationInProgressRef.current = false;
          return;
        }
      } catch (error) {
        logger.debug(
          'GlobalSampleCache check failed, proceeding with normal loading',
        );
      }

      try {
        const WamMetronome = wamPluginClassRef.current;
        if (!WamMetronome) {
          logger.error('Plugin class not loaded');
          creationInProgressRef.current = false;
          return;
        }

        // Get audio context from global audio system
        let context: AudioContext | null = null;

        // Try to get context from global audio services
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getAudioEngine) {
          const audioEngine = globalServices.getAudioEngine();
          if (audioEngine && audioEngine.getContext) {
            try {
              context = audioEngine.getContext();
            } catch (e) {
              logger.debug('AudioEngine not ready yet, will retry...');
              creationInProgressRef.current = false;
              return;
            }
          }
        }

        if (context && context instanceof AudioContext) {
          lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
            widget: 'metronome',
            contextState: context.state,
          });

          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            logger.debug(
              'AudioContext is suspended, waiting for user gesture...',
            );
            lifecycle.checkpoint('PLUGIN_CREATION_BLOCKED', {
              widget: 'metronome',
              reason: 'AudioContext suspended',
              contextState: context.state,
            });
            creationInProgressRef.current = false;
            return;
          }

          // Create plugin instance
          const plugin = await WamMetronome.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          // Store the plugin instance
          metronomePluginRef.current = plugin;

          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          logger.debug('Created audio node:', audioNode);

          // Connect to master bus for proper mixing (with fallback to destination)
          try {
            const { Mixer } =
              await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
            const mixer = Mixer.getInstance();
            const masterBusInput = mixer.getMasterBusInputAsAudioNode();
            if (masterBusInput) {
              audioNode.connect(masterBusInput);
              logger.debug('Connected to master bus for mixing');
            } else {
              audioNode.connect(context.destination);
              logger.debug('Connected to destination (master bus not ready)');
            }
          } catch (e) {
            // Fallback to direct destination if mixer not available
            audioNode.connect(context.destination);
            logger.debug('Connected to destination (mixer not available)');
          }

          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;

          onPluginLoaded();

          logger.debug('WAM Metronome plugin loaded and connected');
          lifecycle.checkpoint('METRONOME_PLUGIN_LOADED');

          // Register with InstrumentRegistry so AudioEventRouter can use it
          if (globalServices && globalServices.getInstrumentRegistry) {
            const instrumentRegistry = globalServices.getInstrumentRegistry();
            instrumentRegistry.setActive('metronome', plugin);
            logger.debug('Registered WAM Metronome with InstrumentRegistry');
          }

          // Load default samples
          if (plugin.loadDefaultSamples) {
            try {
              await plugin.loadDefaultSamples();
              logger.debug('Default metronome samples loaded successfully');
            } catch (error) {
              logger.error('Failed to load metronome samples:', error);
              logger.warn('Metronome will use fallback oscillators');
            }
          } else {
            logger.warn(
              'loadDefaultSamples method not available on metronome plugin',
            );
          }

          // Register initial pattern with track
          if (track && track.createRegionFromPattern) {
            const pattern = createMetronomePattern();
            const region = track.createRegionFromPattern(pattern, {
              name: 'Metronome Pattern',
              startPosition: '0:0:0',
              duration: `${beats}:0:0`,
              loopCount: 0, // Infinite loop
            });
            currentRegionRef.current = region.id;
            logger.debug('Registered metronome pattern with track', {
              pattern,
              region,
            });

            // Register track with PlaybackEngine to enable pattern playback
            if (globalServices && globalServices.getPlaybackEngine) {
              const playbackEngine = globalServices.getPlaybackEngine();
              if (playbackEngine) {
                // Use consistent track ID 'metronome' to prevent duplicate track registration
                playbackEngine.unregisterTrack('metronome');
                playbackEngine.registerTrack({
                  id: 'metronome',
                  name: 'Metronome',
                  instrumentType: 'metronome',
                  regions: [
                    {
                      id: region.id,
                      trackId: 'metronome',
                      startTime: 0,
                      duration: beats * 4,
                      pattern: {
                        id: 'metronome-pattern',
                        name: 'Metronome Pattern',
                        type: 'metronome',
                        events: pattern.events,
                      },
                    },
                  ],
                });
                logger.debug('Registered track with PlaybackEngine');
              }
            }
          }
        } else {
          logger.debug('AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      } catch (error) {
        logger.error('Failed to create WAM Metronome audio node:', error);
      }

      creationInProgressRef.current = false;
    };

    createAudioNode();
  }, [
    trackIsReady,
    wamPluginLoaded,
    pluginClassLoaded,
    pluginLoadAttempts,
    beats,
    volume,
    isMuted,
    wamPluginClassRef,
    metronomePluginRef,
    createMetronomePattern,
    onPluginLoaded,
    currentRegionRef,
    track,
  ]);

  return {};
}
