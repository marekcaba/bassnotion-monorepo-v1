'use client';

/**
 * useHarmonyPlugin Hook
 *
 * Manages the WAM keyboard plugin lifecycle:
 * - Plugin class loading via PluginManager
 * - Audio node creation with proper AudioContext
 * - Connection to mixer/destination
 * - Plugin activation with correct instrument
 * - Cleanup on unmount
 *
 * This hook encapsulates all the complex plugin initialization logic
 * that was previously in the HarmonyWidget component.
 *
 * @example
 * const {
 *   wamPluginLoaded,
 *   keyboardPluginRef,
 *   createAudioNodeAttempt,
 *   testChord,
 * } = useHarmonyPlugin({
 *   trackIsReady,
 *   currentInstrumentRef,
 *   exercise,
 *   volume,
 *   isMuted,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import { getPersistentAudioContext } from '@/domains/playback/utils/audioContext';
import { isVerboseDebugEnabled } from '@/config/debug';
import type {
  KeyboardInstrumentType,
  WamKeyboardPlugin,
  HarmonyExercise,
} from '../types.js';

/**
 * Options for the useHarmonyPlugin hook
 */
export interface UseHarmonyPluginOptions {
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Ref to current instrument (avoids stale closures) */
  currentInstrumentRef: React.RefObject<KeyboardInstrumentType | undefined>;
  /** Current instrument state (for state updates) */
  currentInstrument?: KeyboardInstrumentType;
  /** Set current instrument callback */
  setCurrentInstrument?: (instrument: KeyboardInstrumentType) => void;
  /** Exercise data */
  exercise?: HarmonyExercise;
  /** Current volume (0-100) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Trigger to re-attempt plugin creation (from sample loading) */
  samplesLoadedTrigger?: number;
}

/**
 * Return type for the useHarmonyPlugin hook
 */
export interface UseHarmonyPluginReturn {
  /** Whether the WAM plugin is loaded and ready */
  wamPluginLoaded: boolean;
  /** Whether plugin class is loaded */
  pluginClassLoaded: boolean;
  /** Whether audio services are ready */
  audioServicesReady: boolean;
  /** Reference to the keyboard plugin instance */
  keyboardPluginRef: React.MutableRefObject<WamKeyboardPlugin | null>;
  /** Attempt to create the audio node */
  createAudioNodeAttempt: () => Promise<void>;
  /** Test chord playback function */
  testChord: () => Promise<void>;
  /** Retry count for loading */
  retryCount: number;
}

const MAX_PLUGIN_RETRIES = 50;
const PLUGIN_RETRY_DELAY_MS = 100;

/**
 * Hook for managing the WAM keyboard plugin lifecycle
 */
export function useHarmonyPlugin(
  options: UseHarmonyPluginOptions,
): UseHarmonyPluginReturn {
  const {
    trackIsReady,
    currentInstrumentRef,
    currentInstrument,
    setCurrentInstrument,
    exercise,
    volume,
    isMuted,
    samplesLoadedTrigger = 0,
  } = options;

  const { logger } = useCorrelation('useHarmonyPlugin');

  // Plugin state
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const keyboardPluginRef = useRef<WamKeyboardPlugin | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCreatingPluginRef = useRef<boolean>(false);
  const pluginCreationRetryCountRef = useRef(0);

  /**
   * Phase 1: Check for pre-loaded instrument and mark plugin class as ready
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const checkPreloadedAndLoadClass = async () => {
      logger.info('Checking for pre-loaded instrument...');

      // Check if there's a pre-loaded harmony instrument
      const preloadedHarmony =
        GlobalSampleCache.getCachedInstrument('harmony-preloaded');
      if (preloadedHarmony) {
        logger.info('Found pre-loaded harmony instrument!', {
          hasAudioNode: !!preloadedHarmony.audioNode,
          audioNodeType: preloadedHarmony.audioNode?.constructor?.name,
        });
      } else {
        logger.info('No pre-loaded harmony instrument found');
      }

      // Mark as ready to create plugin
      setPluginClassLoaded(true);
      lifecycle.checkpoint('HARMONY_PLUGIN_LOADING');
      logger.info('Ready to use WAM plugin singleton');
    };

    checkPreloadedAndLoadClass();
  }, [pluginClassLoaded, logger]);

  /**
   * Get audio context from various sources
   */
  const getAudioContext = useCallback((): AudioContext | null => {
    // Try CoreServices AudioContext first (preferred)
    const coreServices = WindowRegistry.getCoreServices();
    if (coreServices) {
      const audioEngine = coreServices.getAudioEngine();
      if (audioEngine && audioEngine.isReady()) {
        const context = audioEngine.getContext();
        if (context) {
          logger.debug('Got context from AudioEngine', {
            contextState: context.state,
          });
          return context;
        }
      }
    }

    // Fallback to persistent context
    let context = getPersistentAudioContext();
    if (context) {
      logger.debug('Got persistent context', { contextState: context.state });
      return context;
    }

    // Try window.__audioContext
    if (window.__audioContext) {
      context = window.__audioContext;
      logger.debug('Got context from window.__audioContext', {
        contextState: context?.state,
      });
      return context;
    }

    // Try Tone.getContext()
    if (window.Tone && window.Tone.getContext) {
      const toneContext = window.Tone.getContext();
      context = toneContext?.rawContext || toneContext?._context || toneContext;
      logger.debug('Got context from Tone.getContext()', {
        contextState: context?.state,
      });
      return context;
    }

    return null;
  }, [logger]);

  /**
   * Create the audio node for the keyboard plugin
   */
  const createAudioNodeAttempt = useCallback(async () => {
    logger.debug('createAudioNodeAttempt called', {
      isCreatingPluginRef: isCreatingPluginRef.current,
      hasKeyboardPlugin: !!keyboardPluginRef.current,
      wamPluginLoaded,
    });

    // Prevent multiple simultaneous creation attempts
    if (
      isCreatingPluginRef.current ||
      keyboardPluginRef.current ||
      wamPluginLoaded
    ) {
      logger.debug(
        'Skipping - plugin creation already in progress or completed',
      );
      return;
    }

    logger.info('Attempting to create audio node...', {
      trackIsReady,
      wamPluginLoaded,
      pluginClassLoaded,
    });

    isCreatingPluginRef.current = true;

    const context = getAudioContext();

    lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
      widget: 'harmony',
      contextState: context?.state || 'no-context',
    });

    // Allow plugin creation with suspended AudioContext (browser autoplay policy)
    if (context && context.state === 'suspended') {
      logger.info(
        'Audio context is suspended (autoplay policy), creating plugin anyway',
      );
    }

    if (context && context instanceof AudioContext) {
      try {
        // Read currentInstrument from ref to get the LATEST value
        const desiredInstrument = currentInstrumentRef.current;

        logger.debug('Instrument resolution', {
          desiredInstrument,
          hasExercise: !!exercise,
          exerciseId: exercise?.id,
        });

        // Don't create plugin until we have a valid instrument
        if (!desiredInstrument) {
          logger.warn(
            'No harmonyInstrument specified, waiting for exercise to load',
          );
          isCreatingPluginRef.current = false;
          return;
        }

        // Get PluginManager from CoreServices
        const coreServices = WindowRegistry.getCoreServices();
        if (!coreServices) {
          throw new Error('CoreServices not available');
        }

        // Initialize CoreServices if needed
        const isInitialized = coreServices.isReady?.();
        if (!isInitialized) {
          logger.info('CoreServices not initialized, initializing...');
          try {
            await coreServices.initialize();
            logger.info('CoreServices initialized successfully');
          } catch (initError) {
            logger.error('CoreServices initialization failed:', initError);
            isCreatingPluginRef.current = false;
            return;
          }
        }

        const pluginManager = coreServices.getPluginManager();
        if (!pluginManager) {
          throw new Error('PluginManager not available');
        }

        // Get WamKeyboardPlugin from PluginManager
        let keyboardPlugin = null;
        try {
          keyboardPlugin = pluginManager.getPlugin('wam-keyboard');
        } catch (error) {
          // Check retry limit
          const currentRetries = pluginCreationRetryCountRef.current;

          if (currentRetries >= MAX_PLUGIN_RETRIES) {
            logger.error(
              `Plugin not registered after ${MAX_PLUGIN_RETRIES} attempts - giving up`,
            );
            isCreatingPluginRef.current = false;
            pluginCreationRetryCountRef.current = 0;
            return;
          }

          logger.info(
            `Plugin not registered yet, retrying... (attempt ${currentRetries + 1}/${MAX_PLUGIN_RETRIES})`,
          );
          isCreatingPluginRef.current = false;
          pluginCreationRetryCountRef.current++;

          setTimeout(() => {
            if (!wamPluginLoaded && !keyboardPluginRef.current) {
              createAudioNodeAttempt();
            }
          }, PLUGIN_RETRY_DELAY_MS);
          return;
        }

        // Reset retry counter on success
        pluginCreationRetryCountRef.current = 0;

        if (!keyboardPlugin) {
          logger.error('WamKeyboardPlugin not found in PluginManager');
          isCreatingPluginRef.current = false;
          return;
        }

        // Load and activate plugin if needed
        if (keyboardPlugin.state === 'unloaded') {
          logger.info('Loading WamKeyboardPlugin...');
          await pluginManager.loadPlugin('wam-keyboard');
        }

        if (
          keyboardPlugin.state === 'loaded' ||
          keyboardPlugin.state === 'inactive'
        ) {
          logger.info('Activating WamKeyboardPlugin with instrument:', {
            desiredInstrument,
          });
          await pluginManager.activatePlugin('wam-keyboard', {
            instrument: desiredInstrument,
          });
        }

        // Get the underlying WamKeyboard instance
        const plugin = keyboardPlugin.getWamKeyboard();
        if (!plugin) {
          logger.error(
            'WamKeyboard instance not initialized in plugin wrapper',
          );
          isCreatingPluginRef.current = false;
          return;
        }

        logger.info('Got WamKeyboard from PluginManager');
        keyboardPluginRef.current = plugin;

        // Connect to master bus for proper mixing
        const audioNode = plugin.audioNode;
        try {
          const { Mixer } =
            await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
          const mixer = Mixer.getInstance();
          const masterBusInput = mixer.getMasterBusInputAsAudioNode();
          if (masterBusInput) {
            audioNode.connect(masterBusInput);
            logger.info('Connected to master bus for mixing');
          } else {
            audioNode.connect(context.destination);
            logger.info('Connected to destination (master bus not ready)');
          }
        } catch (e) {
          audioNode.connect(context.destination);
          logger.info('Connected to destination (mixer not available)');
        }

        // Check if loaded instrument matches desired
        const loadedInstrument = audioNode.currentInstrument;
        logger.info('Checking loaded instrument vs desired', {
          loadedInstrument,
          desiredInstrument,
          needsReload: loadedInstrument !== desiredInstrument,
        });

        if (loadedInstrument !== desiredInstrument) {
          logger.info('Loading desired instrument (mismatch detected)...', {
            from: loadedInstrument,
            to: desiredInstrument,
          });

          if (audioNode.clearEvents) {
            audioNode.clearEvents();
          }

          await audioNode.loadInstrument(desiredInstrument);

          if (setCurrentInstrument) {
            setCurrentInstrument(desiredInstrument);
          }

          logger.info('Desired instrument loaded!', {
            instrument: desiredInstrument,
          });
        } else {
          logger.info('Correct instrument already loaded', {
            instrument: loadedInstrument,
          });

          if (setCurrentInstrument && currentInstrument !== loadedInstrument) {
            setCurrentInstrument(loadedInstrument as KeyboardInstrumentType);
          }
        }

        setWamPluginLoaded(true);
        lifecycle.checkpoint('HARMONY_PLUGIN_LOADED', {
          instrument: loadedInstrument || 'unknown',
        });
        logger.info(
          'WAM Keyboard plugin loaded and connected for HarmonyWidget',
        );

        // Set initial volume
        await audioNode.setParameterValues({
          volume: isMuted ? 0 : volume / 100,
        });

        if (audioNode.gainNode && !isMuted) {
          audioNode.gainNode.gain.value = volume / 100;
          logger.info('Set gain node to:', volume / 100);
        }

        isCreatingPluginRef.current = false;
      } catch (error) {
        logger.error('Failed to create WAM Keyboard plugin:', error);
        isCreatingPluginRef.current = false;
      }
    } else {
      logger.info('AudioContext not ready yet', {
        hasContext: !!context,
        contextState: context?.state,
      });
      isCreatingPluginRef.current = false;
    }
  }, [
    trackIsReady,
    wamPluginLoaded,
    pluginClassLoaded,
    currentInstrumentRef,
    currentInstrument,
    setCurrentInstrument,
    exercise,
    volume,
    isMuted,
    getAudioContext,
    logger,
  ]);

  /**
   * Phase 2: Create plugin when conditions are met
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check all conditions
    const samplesReady = WindowRegistry.getSamplesReady();
    if (
      !pluginClassLoaded ||
      !trackIsReady ||
      wamPluginLoaded ||
      !samplesReady
    ) {
      logger.debug('Plugin creation conditions not met', {
        pluginClassLoaded,
        trackIsReady,
        wamPluginLoaded,
        samplesReady,
      });
      return;
    }

    // Guard against multiple instances
    if (keyboardPluginRef.current) {
      logger.info('Plugin already loaded, skipping creation');
      return;
    }

    createAudioNodeAttempt();
  }, [
    trackIsReady,
    wamPluginLoaded,
    pluginClassLoaded,
    createAudioNodeAttempt,
    samplesLoadedTrigger,
    logger,
  ]);

  /**
   * Listen for audio services ready event
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logger.info('Setting up audio service listeners...');

    // Check if services are already ready
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.info('Audio services already ready');
          setAudioServicesReady(true);
        }
      } catch (e) {
        logger.info('Audio services not ready yet');
      }
    }

    const handleAudioReady = () => {
      logger.info('Audio services ready event received');
      setAudioServicesReady(true);

      if (
        !wamPluginLoaded &&
        pluginClassLoaded &&
        trackIsReady &&
        WindowRegistry.getSamplesReady()
      ) {
        logger.info('Audio ready, attempting to create plugin...');
        createAudioNodeAttempt();
      }
    };

    const handleAudioContextStarted = () => {
      logger.info('AudioContext started event received');
      setAudioServicesReady(true);
      setRetryCount((prev) => prev + 1);

      if (
        !wamPluginLoaded &&
        pluginClassLoaded &&
        trackIsReady &&
        WindowRegistry.getSamplesReady()
      ) {
        logger.info('Audio context started, attempting to create plugin...');
        createAudioNodeAttempt();
      }
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
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
  }, [
    wamPluginLoaded,
    pluginClassLoaded,
    trackIsReady,
    createAudioNodeAttempt,
    logger,
  ]);

  /**
   * Retry plugin loading when audio services become ready
   */
  useEffect(() => {
    if (
      audioServicesReady &&
      trackIsReady &&
      !wamPluginLoaded &&
      pluginClassLoaded &&
      WindowRegistry.getSamplesReady()
    ) {
      logger.info('Audio services ready, retrying plugin load...');
      createAudioNodeAttempt();
    }
  }, [
    audioServicesReady,
    trackIsReady,
    wamPluginLoaded,
    pluginClassLoaded,
    createAudioNodeAttempt,
    retryCount,
    logger,
  ]);

  /**
   * Cleanup on unmount
   * IMPORTANT: Reset plugin state fully on unmount to ensure clean state
   * for the next tutorial. Uses resetState() which clears events, releases
   * all notes, resets sustain pedal, and resets to default instrument.
   */
  useEffect(() => {
    return () => {
      logger.info('Component unmounting, cleaning up...');

      isCreatingPluginRef.current = false;

      // Reset plugin state fully - this ensures no stale state persists
      // when navigating between tutorials (Next.js App Router remounts)
      if (keyboardPluginRef.current) {
        try {
          // Prefer resetState() for complete cleanup (sustain, notes, instrument)
          if (typeof keyboardPluginRef.current.resetState === 'function') {
            keyboardPluginRef.current.resetState();
            logger.info(
              'Plugin state reset on unmount (clears events, sustain, instrument)',
            );
          } else if (keyboardPluginRef.current.audioNode) {
            // Fallback to clearEvents if resetState not available
            keyboardPluginRef.current.audioNode.clearEvents();
            logger.info('Plugin events cleared on unmount (fallback)');
          }
          keyboardPluginRef.current = null;
          logger.info(
            'Local ref cleared (plugin kept in singleton cache for reuse)',
          );
        } catch (error) {
          logger.error('Error cleaning up HarmonyWidget:', error);
        }
      }

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [logger]);

  /**
   * Test chord function
   */
  const testChord = useCallback(
    withAudioContext(async () => {
      logger.info('testChord called:', {
        plugin: keyboardPluginRef.current,
        audioServicesReady,
        trackIsReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      // Check for pre-loaded instrument if plugin isn't loaded
      if (!keyboardPluginRef.current) {
        logger.info('Plugin not loaded, checking for pre-loaded instrument...');

        const preloadedInstrument =
          GlobalSampleCache.getCachedInstrument('harmony-preloaded');
        if (preloadedInstrument && preloadedInstrument.audioNode) {
          logger.info(
            'Found pre-loaded harmony instrument! Using it for TEST.',
          );
          keyboardPluginRef.current = preloadedInstrument;
          setWamPluginLoaded(true);
          lifecycle.checkpoint('HARMONY_PLUGIN_LOADED', {
            instrument: 'preloaded',
          });

          await preloadedInstrument.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });
        } else if (!wamPluginLoaded && pluginClassLoaded) {
          logger.info('Creating new instrument...');
          await createAudioNodeAttempt();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (keyboardPluginRef.current && keyboardPluginRef.current.audioNode) {
        const audioNode = keyboardPluginRef.current.audioNode;
        // Play a C major chord (C3, E3, G3)
        const notes = [
          { note: 60, velocity: 80 },
          { note: 64, velocity: 80 },
          { note: 67, velocity: 80 },
        ];

        const context = audioNode.context;
        const currentTime = context.currentTime;

        notes.forEach((noteData, index) => {
          const noteTime = currentTime + 0.05 + index * 0.01;
          audioNode.triggerNote(noteData.note, noteData.velocity, noteTime);
          logger.info(`Triggering note ${noteData.note} at time ${noteTime}`);
        });

        logger.info('Test chord triggered');

        // Release notes after 1 second
        setTimeout(() => {
          notes.forEach((noteData) => {
            audioNode.releaseNote(noteData.note);
          });
        }, 1000);
      } else {
        logger.info('Cannot play test chord - plugin not ready');
      }
    }),
    [
      wamPluginLoaded,
      pluginClassLoaded,
      audioServicesReady,
      trackIsReady,
      volume,
      isMuted,
      createAudioNodeAttempt,
      logger,
    ],
  );

  return {
    wamPluginLoaded,
    pluginClassLoaded,
    audioServicesReady,
    keyboardPluginRef,
    createAudioNodeAttempt,
    testChord,
    retryCount,
  };
}
