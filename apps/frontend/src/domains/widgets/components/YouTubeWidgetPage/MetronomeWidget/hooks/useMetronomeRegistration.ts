'use client';

/**
 * useMetronomeRegistration Hook
 *
 * Handles metronome pattern registration with the track and PlaybackEngine.
 * Updates patterns when time signature, subdivisions, or sound changes.
 * Also handles tempo synchronization and cleanup on unmount.
 *
 * @example
 * useMetronomeRegistration({
 *   metronomePluginRef,
 *   wamPluginLoaded,
 *   beats,
 *   noteValue,
 *   createMetronomePattern,
 *   currentRegionRef,
 *   track,
 * });
 */

import { useEffect, useCallback, useRef } from 'react';
import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import type {
  MetronomePattern,
  MetronomeSoundType,
  MetronomeSound,
} from '../types.js';

const logger = getLogger('metronome-widget');

// Stable identity for track methods to prevent infinite loops
interface StableTrackMethods {
  removeRegion: (regionId: string) => void;
  createRegionFromPattern: (pattern: MetronomePattern, config?: any) => any;
}

export interface UseMetronomeRegistrationOptions {
  /** Reference to the metronome plugin */
  metronomePluginRef: React.RefObject<any>;
  /** Whether the plugin is loaded */
  wamPluginLoaded: boolean;
  /** Number of beats per measure */
  beats: number;
  /** Note value (denominator) */
  noteValue: number;
  /** Current tempo from transport */
  bpm: number;
  /** Number of subdivisions */
  subdivisions: number;
  /** Current sound preset */
  currentSound: MetronomeSoundType;
  /** Function to create metronome pattern */
  createMetronomePattern: () => MetronomePattern;
  /** Reference to current region ID */
  currentRegionRef: React.MutableRefObject<string | null>;
  /** Track instance for pattern registration */
  track: any;
  /** Callback to set current sound */
  setCurrentSound: (sound: MetronomeSoundType) => void;
  /** MetronomeSound enum for sound index lookup */
  MetronomeSound: typeof MetronomeSound;
}

export interface UseMetronomeRegistrationReturn {
  /** Handler for sound changes */
  handleSoundChange: (sound: MetronomeSoundType) => void;
  /** Handler for subdivision changes */
  handleSubdivisionChange: (subdiv: number) => void;
  /** Test click function */
  testClick: () => void;
}

/**
 * Hook for managing metronome registration with track and PlaybackEngine
 */
export function useMetronomeRegistration(
  options: UseMetronomeRegistrationOptions
): UseMetronomeRegistrationReturn {
  const {
    metronomePluginRef,
    wamPluginLoaded,
    beats,
    noteValue,
    bpm,
    subdivisions,
    currentSound,
    createMetronomePattern,
    currentRegionRef,
    track,
    setCurrentSound,
    MetronomeSound,
  } = options;

  // Track retry timeout for cleanup
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * FAANG FIX: Listen for exercise:switched event from PlaybackEngine
   * This ensures metronome resets its local state when switching tutorials,
   * consistent with bass, drums, and harmony widgets.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleExerciseSwitched = () => {
      logger.debug('[METRONOME-WIDGET] exercise:switched event received, resetting local state');
      // Reset current region ref to allow fresh region creation for new exercise
      currentRegionRef.current = null;
    };

    window.addEventListener('exercise:switched', handleExerciseSwitched);

    return () => {
      window.removeEventListener('exercise:switched', handleExerciseSwitched);
    };
  }, [currentRegionRef]);

  // Store track methods in refs to prevent dependency changes from causing infinite loops
  // The track object changes on every render, but its methods remain functionally equivalent
  const trackMethodsRef = useRef<StableTrackMethods | null>(null);

  // Update ref when track becomes available (but don't trigger re-renders)
  useEffect(() => {
    if (track && track.removeRegion && track.createRegionFromPattern) {
      trackMethodsRef.current = {
        removeRegion: track.removeRegion,
        createRegionFromPattern: track.createRegionFromPattern,
      };
    }
  }, [track]);

  // Store createMetronomePattern in ref to avoid dependency changes
  const createPatternRef = useRef(createMetronomePattern);
  useEffect(() => {
    createPatternRef.current = createMetronomePattern;
  }, [createMetronomePattern]);

  // Store beats in ref to use in callback without causing re-renders
  const beatsRef = useRef(beats);
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);

  /**
   * Update pattern in track and PlaybackEngine
   * Uses refs for track methods to prevent infinite loops
   */
  const updatePatternRegistration = useCallback(() => {
    const trackMethods = trackMethodsRef.current;
    if (
      !trackMethods ||
      !wamPluginLoaded ||
      !currentRegionRef.current
    ) {
      return;
    }

    const pattern = createPatternRef.current();
    const currentBeats = beatsRef.current;

    // Remove old region and create new one
    trackMethods.removeRegion(currentRegionRef.current);
    const region = trackMethods.createRegionFromPattern(pattern, {
      name: 'Metronome Pattern',
      startPosition: '0:0:0',
      duration: `${currentBeats}:0:0`,
      loopCount: 0, // Infinite loop
    });
    currentRegionRef.current = region.id;

    // Update PlaybackEngine with new pattern
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getPlaybackEngine) {
      const playbackEngine = globalServices.getPlaybackEngine();
      if (playbackEngine) {
        // Unregister old track, then register new one (use consistent ID 'metronome')
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
              duration: currentBeats * 4,
              pattern: {
                id: 'metronome-pattern',
                name: 'Metronome Pattern',
                type: 'metronome',
                events: pattern.events,
              },
            },
          ],
        });
      }
    }

    return { pattern, region };
  }, [wamPluginLoaded, currentRegionRef]); // Removed track, createMetronomePattern, beats from deps - using refs instead

  /**
   * Handle time signature changes and update pattern
   * Note: updatePatternRegistration uses refs internally so it's safe to exclude from deps
   */
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTimeSignature(beats, noteValue);
    }

    // Only update if we have already created an initial pattern
    if (currentRegionRef.current) {
      const result = updatePatternRegistration();
      if (result) {
        logger.debug('Updated metronome pattern for time signature change', {
          beats,
          noteValue,
          pattern: result.pattern,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updatePatternRegistration uses refs internally
  }, [beats, noteValue, wamPluginLoaded]);

  /**
   * Handle tempo changes
   */
  useEffect(() => {
    logger.info('MetronomeWidget: BPM changed', {
      bpm,
      hasPlugin: !!metronomePluginRef.current,
    });
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTempo(bpm);
      logger.info('MetronomeWidget: Called plugin.setTempo', { bpm });
    }
  }, [bpm, metronomePluginRef]);

  /**
   * Handle sound changes
   */
  const handleSoundChange = useCallback(
    withAudioContext(async (sound: MetronomeSoundType) => {
      setCurrentSound(sound);
      if (metronomePluginRef.current) {
        const soundIndex = Object.values(MetronomeSound).indexOf(sound);
        await metronomePluginRef.current.audioNode?.setParameterValues({
          sound: soundIndex,
        });
      }
    }),
    [setCurrentSound, metronomePluginRef, MetronomeSound]
  );

  /**
   * Handle subdivision changes
   * Note: updatePatternRegistration uses refs internally so it's safe to exclude from deps
   */
  const handleSubdivisionChange = useCallback(
    async (subdiv: number) => {
      if (metronomePluginRef.current) {
        await metronomePluginRef.current.audioNode?.setParameterValues({
          subdivisions: subdiv,
        });
      }

      // Update pattern when subdivisions change
      if (currentRegionRef.current) {
        const result = updatePatternRegistration();
        if (result) {
          logger.debug('Updated metronome pattern for subdivision change', {
            subdiv,
            pattern: result.pattern,
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updatePatternRegistration uses refs internally
    [metronomePluginRef]
  );

  /**
   * Test click function
   */
  const testClick = useCallback(
    withAudioContext(
      async () => {
        logger.debug('testClick called:', {
          plugin: metronomePluginRef.current,
        });

        if (metronomePluginRef.current) {
          logger.debug('Calling plugin.click()');
          metronomePluginRef.current.click(false);
        } else {
          logger.warn('Cannot trigger click - plugin not ready');
        }
      },
      { lightweight: true }
    ),
    [metronomePluginRef]
  );

  /**
   * Listen for audio services ready event
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
    };

    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted
      );
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);

  /**
   * Cleanup effect to unregister from InstrumentRegistry on unmount
   */
  useEffect(() => {
    return () => {
      if (metronomePluginRef.current) {
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getInstrumentRegistry) {
          const instrumentRegistry = globalServices.getInstrumentRegistry();
          if (
            instrumentRegistry.getActive('metronome') ===
            metronomePluginRef.current
          ) {
            instrumentRegistry.removeActive('metronome');
            logger.debug(
              'Removed WAM Metronome from InstrumentRegistry on unmount'
            );
          }
        }
      }
    };
  }, [metronomePluginRef]);

  return {
    handleSoundChange,
    handleSubdivisionChange,
    testClick,
  };
}
