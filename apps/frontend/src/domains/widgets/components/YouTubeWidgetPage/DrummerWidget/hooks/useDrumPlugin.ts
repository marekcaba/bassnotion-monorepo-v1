'use client';

/**
 * useDrumPlugin Hook
 *
 * Manages the WAM drum plugin lifecycle:
 * - Plugin class loading
 * - Audio node creation
 * - Connection to mixer/destination
 * - Volume/mute control
 * - InstrumentRegistry integration
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Exercise } from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import type { WamPluginInstance } from '../types.js';

const logger = getLogger('useDrumPlugin');

/**
 * Options for the useDrumPlugin hook
 */
export interface UseDrumPluginOptions {
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Exercise (to check if it has drum data) */
  exercise?: Exercise;
  /** Volume level (0-100) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
}

/**
 * Return type for the useDrumPlugin hook
 */
export interface UseDrumPluginReturn {
  /** Whether the WAM plugin is loaded and ready */
  wamPluginLoaded: boolean;
  /** Whether plugin class is loaded */
  pluginClassLoaded: boolean;
  /** Whether audio services are ready */
  audioServicesReady: boolean;
  /** Reference to the plugin instance */
  drummerPluginRef: React.MutableRefObject<WamPluginInstance | null>;
  /** Test a drum sound by pad number */
  testDrumSound: (padNum: number) => Promise<void>;
  /** Trigger retry of plugin loading */
  triggerPluginRetry: () => void;
}

/**
 * Hook for managing the WAM drum plugin lifecycle
 */
export function useDrumPlugin(
  options: UseDrumPluginOptions,
): UseDrumPluginReturn {
  const { trackIsReady, exercise, volume, isMuted } = options;

  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);

  // Reference to the plugin class and instance
  const wamPluginClassRef = useRef<any>(null);
  const drummerPluginRef = useRef<WamPluginInstance | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');
      lifecycle.checkpoint('DRUMMER_PLUGIN_LOADING');

      try {
        const { default: WamDrummer } =
          await import('@/domains/playback/modules/instruments/adapters/wam/WamDrummer');
        wamPluginClassRef.current = WamDrummer;
        setPluginClassLoaded(true);
        logger.debug('WAM Drummer plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Drummer plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !trackIsReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (drummerPluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    const createAudioNode = async () => {
      logger.debug('Attempting to create audio node...', {
        trackIsReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      try {
        const WamDrummer = wamPluginClassRef.current;
        if (!WamDrummer) {
          logger.error('Plugin class not loaded');
          return;
        }

        // Get audio context from global audio system
        let context = null;

        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getAudioEngine) {
          const audioEngine = globalServices.getAudioEngine();
          if (audioEngine && audioEngine.getContext) {
            try {
              context = audioEngine.getContext();
            } catch (e) {
              logger.debug('AudioEngine not ready yet, will retry...');
              return;
            }
          }
        }

        logger.debug('Got context:', context, {
          type: context?.constructor?.name,
          isAudioContext: context instanceof AudioContext,
          contextState: context?.state,
        });

        if (context && context instanceof AudioContext) {
          lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
            widget: 'drummer',
            contextState: context.state,
          });

          if (context.state === 'suspended') {
            logger.debug(
              'AudioContext is suspended, waiting for user gesture...',
            );
            lifecycle.checkpoint('PLUGIN_CREATION_BLOCKED', {
              widget: 'drummer',
              reason: 'AudioContext suspended',
              contextState: context.state,
            });
            return;
          }

          // Create plugin instance
          const plugin = await WamDrummer.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          drummerPluginRef.current = plugin;

          // Create the audio node
          const audioNode = await plugin.createAudioNode();
          logger.debug('Created audio node:', audioNode);

          // Connect to master bus for proper mixing
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
            audioNode.connect(context.destination);
            logger.debug('Connected to destination (mixer not available)');
          }

          plugin.audioNode = audioNode;
          setWamPluginLoaded(true);

          logger.debug('WAM Drummer plugin loaded and connected');
          lifecycle.checkpoint('DRUMMER_PLUGIN_LOADED');

          // Load default kit
          if (plugin.loadDefaultKit) {
            await plugin.loadDefaultKit();
            logger.debug('Default drum kit loaded');
          }

          // Register the plugin with InstrumentRegistry
          if (globalServices && globalServices.getInstrumentRegistry) {
            const instrumentRegistry = globalServices.getInstrumentRegistry();
            instrumentRegistry.setActive('drums', plugin);
            logger.debug('Registered WAM Drummer with InstrumentRegistry');
          }
        } else {
          logger.debug('AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      } catch (error) {
        logger.error('Failed to create WAM Drummer audio node:', error);
      }
    };

    createAudioNode();
  }, [trackIsReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);

  // Handle volume changes
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;

    // Update WAM plugin volume
    if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
      const audioNode = drummerPluginRef.current.audioNode;
      if (audioNode.setVolume) {
        audioNode.setVolume(effectiveVolume);
        audioNode.setMute(isMuted);
      }
    }

    // Update PlaybackEngine drums volume
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('drums', effectiveVolume);
      playbackEngine.setInstrumentMuted('drums', isMuted);
    }
  }, [volume, isMuted]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      setAudioServicesReady(true);
    };

    // Check if services are already ready
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.debug('Audio services already ready');
          setAudioServicesReady(true);
        }
      } catch (e) {
        // Not ready yet
      }
    }

    window.addEventListener('audioServicesReady', handleAudioReady);

    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
    };
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted,
      );
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);

  // Retry plugin loading when audio services become ready
  useEffect(() => {
    if (audioServicesReady && trackIsReady && !wamPluginLoaded) {
      logger.debug('Audio services ready, retrying plugin load...');
      retryTimeoutRef.current = setTimeout(() => {
        setWamPluginLoaded(false);
      }, 100);
    }
  }, [audioServicesReady, trackIsReady, wamPluginLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const globalServices =
        window.__globalCoreServices || window.__coreServices;
      if (globalServices && globalServices.getInstrumentRegistry) {
        const instrumentRegistry = globalServices.getInstrumentRegistry();
        if (
          instrumentRegistry.getActive('drums') === drummerPluginRef.current
        ) {
          instrumentRegistry.removeActive('drums');
          logger.debug(
            'Removed WAM Drummer from InstrumentRegistry on unmount',
          );
        }
      }
    };
  }, []);

  // Test drum function
  const testDrumSound = useCallback(
    withAudioContext(async (padNum: number) => {
      logger.debug('testDrumSound called:', {
        padNum,
        plugin: drummerPluginRef.current,
      });

      // If plugin isn't loaded, trigger a load attempt
      if (!drummerPluginRef.current && !wamPluginLoaded) {
        logger.debug('Plugin not loaded, triggering load attempt...');
        setPluginLoadAttempts((prev) => prev + 1);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
        const audioNode = drummerPluginRef.current.audioNode;
        if (audioNode.triggerPad) {
          logger.debug('Triggering pad:', padNum);
          audioNode.triggerPad(padNum, 0.8);
        } else {
          logger.warn(
            'Cannot trigger pad - audio node has no triggerPad method',
          );
        }
      } else {
        logger.warn('Cannot trigger pad - plugin not ready', {
          hasPlugin: !!drummerPluginRef.current,
          hasAudioNode: drummerPluginRef.current?.audioNode,
        });
      }
    }),
    [wamPluginLoaded],
  );

  const triggerPluginRetry = useCallback(() => {
    setPluginLoadAttempts((prev) => prev + 1);
  }, []);

  return {
    wamPluginLoaded,
    pluginClassLoaded,
    audioServicesReady,
    drummerPluginRef,
    testDrumSound,
    triggerPluginRetry,
  };
}
