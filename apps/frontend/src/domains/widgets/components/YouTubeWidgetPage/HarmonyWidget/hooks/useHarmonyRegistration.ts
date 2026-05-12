'use client';

/**
 * useHarmonyRegistration Hook
 *
 * Manages harmony registration with PlaybackEngine:
 * - Converts exercise harmony notes to PlaybackEngine events
 * - Injects harmony buffers from GlobalSampleCache
 * - Handles CC64 (sustain pedal) events
 * - Manages exercise switching and cleanup
 * - Handles manual chord progression scheduling (fallback)
 *
 * This hook encapsulates the complex PlaybackEngine registration logic
 * that was previously in the HarmonyWidget component.
 *
 * @example
 * const { registerHarmonyWithPlaybackEngine } = useHarmonyRegistration({
 *   exercise,
 *   exerciseRef,
 *   keyboardPluginRef,
 *   trackIsReady,
 *   samplesLoadedTrigger,
 * });
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority.js';
import { DEFAULT_HARMONY_INSTRUMENT } from '@/domains/playback/constants';
import { isVerboseDebugEnabled } from '@/config/debug';
import type {
  KeyboardInstrumentType,
  WamKeyboardPlugin,
  HarmonyExercise,
  HarmonyEvent,
  HarmonyRegion,
  HarmonyTrackData,
  PerNoteVelocityRanges,
} from '../types.js';
import { CHORD_PROGRESSIONS } from './useChordProgression.js';

/**
 * Options for the useHarmonyRegistration hook
 */
export interface UseHarmonyRegistrationOptions {
  /** Exercise data */
  exercise?: HarmonyExercise;
  /** Ref to current exercise (avoids stale closures) */
  exerciseRef: React.RefObject<HarmonyExercise | undefined>;
  /** Reference to the keyboard plugin */
  keyboardPluginRef: React.RefObject<WamKeyboardPlugin | null>;
  /** Current instrument state */
  currentInstrument?: KeyboardInstrumentType;
  /** Set current instrument callback */
  setCurrentInstrument?: (instrument: KeyboardInstrumentType) => void;
  /** Whether the track is ready */
  trackIsReady: boolean;
  /** Whether the WAM plugin is loaded */
  wamPluginLoaded: boolean;
  /** Trigger counter for sample loading */
  samplesLoadedTrigger: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Ref to isPlaying (avoids stale closures) */
  isPlayingRef: React.RefObject<boolean>;
  /** Harmony note count (for performance optimization) */
  harmonyNoteCount: number;
  /** Volume level (0-100) */
  volume: number;
  /** Whether audio is muted */
  isMuted: boolean;
  /** Selected chord progression name */
  selectedProgression: string;
  /** Callback when chord advances */
  onNextChord: () => void;
}

/**
 * Return type for the useHarmonyRegistration hook
 */
export interface UseHarmonyRegistrationReturn {
  /** Register harmony with PlaybackEngine */
  registerHarmonyWithPlaybackEngine: () => Promise<void>;
  /** Schedule manual chord progression (fallback) */
  scheduleProgression: () => void;
}

/**
 * Convert MIDI note number to note name (e.g., 60 -> 'C4')
 */
function midiToNoteName(midi: number): string {
  const noteNames = [
    'C', 'Cs', 'D', 'Ds', 'E', 'F',
    'Fs', 'G', 'Gs', 'A', 'As', 'B',
  ];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = noteNames[midi % 12];
  return `${noteName}${octave}`;
}

/**
 * Hook for managing harmony registration with PlaybackEngine
 */
export function useHarmonyRegistration(
  options: UseHarmonyRegistrationOptions
): UseHarmonyRegistrationReturn {
  const {
    exercise,
    exerciseRef,
    keyboardPluginRef,
    currentInstrument,
    setCurrentInstrument,
    trackIsReady,
    wamPluginLoaded,
    samplesLoadedTrigger,
    isPlaying,
    isPlayingRef,
    harmonyNoteCount,
    volume,
    isMuted,
    selectedProgression,
    onNextChord,
  } = options;

  const { correlationId, logger } = useCorrelation('useHarmonyRegistration');

  // Refs for preventing duplicate registrations
  const lastRegisteredExerciseIdRef = useRef<string | null>(null);
  const isRegisteringRef = useRef(false);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<Array<{ chord: string; time: number; duration: number }>>([]);
  const previousExerciseIdRef = useRef<string | null>(null);

  /**
   * Register harmony with PlaybackEngine
   */
  const registerHarmonyWithPlaybackEngine = useCallback(async () => {
    const currentExercise = exerciseRef.current;

    // Prevent multiple simultaneous registrations
    if (isRegisteringRef.current) {
      if (isVerboseDebugEnabled()) {
        console.log('[HARMONY-WIDGET] Registration already in progress, skipping');
      }
      return;
    }

    // Skip if already registered for this exercise + trigger combo
    const registrationKey = `${currentExercise?.id?.value || currentExercise?.id}-${samplesLoadedTrigger}`;
    if (lastRegisteredExerciseIdRef.current === registrationKey) {
      if (isVerboseDebugEnabled()) {
        console.log('[HARMONY-WIDGET] Already registered for this exercise+trigger, skipping');
      }
      return;
    }

    isRegisteringRef.current = true;

    // Read BPM from MusicalTruthAuthority (the ONE source of truth)
    const currentBpm = musicalTruth.getBPM();
    if (isVerboseDebugEnabled()) {
      console.log(`[TEMPO] HarmonyWidget using BPM from musicalTruth: ${currentBpm}`);
    }

    const plugin = keyboardPluginRef.current;

    // Plugin is optional - Scheduler handles harmony directly
    if (!plugin || !plugin.audioNode) {
      console.warn(
        '[HARMONY-WIDGET] No WAM plugin available - using Scheduler-only mode'
      );
    }

    if (!currentExercise?.harmonyNotes || currentExercise.harmonyNotes.length === 0) {
      console.error('[HARMONY-WIDGET] No harmony notes to register');
      isRegisteringRef.current = false;
      return;
    }

    // Get CoreServices and PlaybackEngine
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      console.error('[HARMONY-WIDGET] No core services available');
      isRegisteringRef.current = false;
      return;
    }

    const playbackEngine = coreServices.getPlaybackEngine();
    if (!playbackEngine) {
      console.error('[HARMONY-WIDGET] No PlaybackEngine available');
      isRegisteringRef.current = false;
      return;
    }

    try {
      // Import and check GlobalSampleCache
      const { GlobalSampleCache } = await import(
        '@/domains/playback/modules/storage/cache/GlobalSampleCache.js'
      );

      // Re-check if exercise has changed after async import
      const exerciseAfterImport = exerciseRef.current;
      const originalExerciseId = currentExercise?.id?.value || currentExercise?.id;
      const latestExerciseId = exerciseAfterImport?.id?.value || exerciseAfterImport?.id;

      if (originalExerciseId !== latestExerciseId) {
        if (isVerboseDebugEnabled()) {
          console.log('[HARMONY-WIDGET] Exercise changed during import, aborting');
        }
        isRegisteringRef.current = false;

        // Schedule new registration for the latest exercise
        setTimeout(() => {
          const stillCurrentExercise = exerciseRef.current;
          const stillCurrentId = stillCurrentExercise?.id?.value || stillCurrentExercise?.id;
          if (stillCurrentId === latestExerciseId && !isRegisteringRef.current) {
            registerHarmonyWithPlaybackEngine();
          }
        }, 0);
        return;
      }

      const latestExercise = exerciseAfterImport;
      const sampleCache = GlobalSampleCache.getInstance();

      // Get instrument name
      const instrument = latestExercise?.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT;

      // Get cached keys for this instrument
      const allCachedKeys = sampleCache.getAllSampleKeys();
      const harmonyCachedKeys = allCachedKeys.filter((key: string) =>
        key.startsWith(`${instrument}-`)
      );

      // Check sample coverage
      const octaveShift = instrument === 'wurlitzer' ? 12 : 0;
      const requiredNotes = (latestExercise?.harmonyNotes || []).map((note: any) =>
        midiToNoteName(note.pitch - octaveShift)
      );
      const uniqueRequiredNotes = [...new Set(requiredNotes)];

      const cachedNoteNames = new Set(
        harmonyCachedKeys.map((key: string) => key.split('-').pop()).filter(Boolean)
      );

      const cachedCount = uniqueRequiredNotes.filter((noteName) =>
        cachedNoteNames.has(noteName)
      ).length;
      const coveragePercentage = (cachedCount / uniqueRequiredNotes.length) * 100;
      const minCoverageRequired = 50;

      if (coveragePercentage < minCoverageRequired) {
        console.warn('[HARMONY-WIDGET] Insufficient samples - waiting for preload');
        isRegisteringRef.current = false;
        return;
      }

      // Build harmony buffers map
      const harmonyBuffers = new Map<string, AudioBuffer>();
      const audioEngine = coreServices.getAudioEngine();
      const audioContext = await audioEngine.getContext();

      let buffersFound = 0;
      let buffersDecoded = 0;

      for (const cacheKey of harmonyCachedKeys) {
        let buffer = sampleCache.getCachedBuffer(cacheKey);

        if (!buffer && audioContext) {
          const rawBuffer = await sampleCache.getCachedRawBuffer(cacheKey);
          if (rawBuffer) {
            try {
              buffer = await audioContext.decodeAudioData(rawBuffer.slice(0));
              buffersDecoded++;
              await sampleCache.cacheBuffer(cacheKey, buffer, {
                isContextCompatible: true,
              });
            } catch (decodeError) {
              console.error(`[HARMONY-WIDGET] Failed to decode ${cacheKey}:`, decodeError);
            }
          }
        }

        if (buffer) {
          const keyWithoutPrefix = cacheKey.replace(`${instrument}-`, '');
          harmonyBuffers.set(keyWithoutPrefix, buffer);
          buffersFound++;
        }
      }

      if (buffersFound > 0 && audioContext?.destination) {
        // Load instrument config for velocity ranges
        let perNoteVelocityRanges: PerNoteVelocityRanges | undefined;
        try {
          if (instrument === 'wurlitzer') {
            const config = await import(
              '@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json'
            );
            perNoteVelocityRanges = config.default.perNoteVelocityRanges;
          } else if (instrument === 'grandpiano') {
            const config = await import(
              '@/domains/playback/data/instruments/piano/grand-piano.json'
            );
            perNoteVelocityRanges = config.default.perNoteVelocityRanges;
          } else if (instrument === 'rhodes') {
            const config = await import(
              '@/domains/playback/data/instruments/rhodes/rhodes-piano.json'
            );
            perNoteVelocityRanges = config.default.perNoteVelocityRanges;
          }
        } catch (error) {
          console.error('[HARMONY-WIDGET] Failed to load instrument config', error);
        }

        // Get or create instrument gain node
        const harmonyGainNode = playbackEngine.getOrCreateInstrumentGainNode('harmony');
        const destination = harmonyGainNode || audioContext.destination;

        playbackEngine.setHarmonyBuffers(
          harmonyBuffers,
          destination,
          perNoteVelocityRanges,
          instrument
        );

        // Apply volume/mute state
        const effectiveVolume = isMuted ? 0 : volume / 100;
        playbackEngine.setInstrumentVolume('harmony', effectiveVolume);
        playbackEngine.setInstrumentMuted('harmony', isMuted);

        console.log('[HARMONY-WIDGET] Harmony buffers injected into PlaybackEngine', {
          instrument,
          buffersInjected: buffersFound,
        });

        // Switch WAM plugin instrument if needed
        if (
          keyboardPluginRef.current?.audioNode &&
          instrument !== currentInstrument
        ) {
          try {
            if (keyboardPluginRef.current.audioNode.loadInstrument) {
              await keyboardPluginRef.current.audioNode.loadInstrument(instrument);
              if (setCurrentInstrument) {
                setCurrentInstrument(instrument);
              }
            }
          } catch (error) {
            console.error('[HARMONY-WIDGET] Failed to switch WAM plugin instrument:', error);
          }
        }
      } else if (audioContext?.destination) {
        // Clear old buffers
        playbackEngine.setHarmonyBuffers(
          new Map(),
          audioContext.destination,
          undefined,
          instrument
        );
        console.warn('[HARMONY-WIDGET] No harmony buffers found - cleared old buffers');
      }

      // Convert harmony notes to events
      const allEventPositions = [
        ...(latestExercise?.harmonyNotes || [])
          .map((note: any) => note.position)
          .filter((pos: any) => pos && typeof pos.measure === 'number'),
        ...(latestExercise?.harmonyControlChanges || [])
          .map((cc: any) => cc.position)
          .filter((pos: any) => pos && typeof pos.measure === 'number'),
      ];

      // Find earliest event for normalization
      const firstEvent = allEventPositions.reduce<any>((earliest, pos) => {
        if (!earliest) return pos;
        const earliestTotal = earliest.measure * 16 + earliest.beat * 4;
        const currentTotal = pos.measure * 16 + pos.beat * 4;
        return currentTotal < earliestTotal ? pos : earliest;
      }, null);

      const measureOffset = firstEvent ? firstEvent.measure : 0;
      const beatOffset = firstEvent ? firstEvent.beat : 0;
      const subdivisionOffset = firstEvent ? firstEvent.subdivision || 0 : 0;
      const tickOffset = firstEvent ? firstEvent.tick || 0 : 0;

      // Convert notes to events
      const harmonyEvents: HarmonyEvent[] = (latestExercise?.harmonyNotes || [])
        .filter((note: any) => note.position && typeof note.position.measure === 'number')
        .map((note: any) => ({
          position: {
            measure: note.position.measure - measureOffset,
            beat: note.position.beat - beatOffset,
            subdivision: (note.position.subdivision || 0) - subdivisionOffset,
            tick: (note.position.tick || 0) - tickOffset,
          },
          type: 'harmony-note' as const,
          velocity: note.velocity / 127,
          durationTicks: note.durationTicks || 960,
          data: {
            pitch: note.pitch,
            noteName: note.noteName || '',
            midiNote: note.pitch,
            velocity: note.velocity,
            ticks: note.ticks,
            durationTicks: note.durationTicks || 960,
            originalBpm: latestExercise?.bpm,
          },
        }));

      // Add control change events
      const controlChangeEvents: HarmonyEvent[] = (latestExercise?.harmonyControlChanges || [])
        .map((cc: any) => {
          const rawPosition = {
            measure: cc.position.measure - measureOffset,
            beat: cc.position.beat - beatOffset,
            subdivision: (cc.position.subdivision || 0) - subdivisionOffset,
            tick: (cc.position.tick || 0) - tickOffset,
          };

          return {
            position: {
              measure: Math.max(0, rawPosition.measure),
              beat: Math.max(0, rawPosition.beat),
              subdivision: Math.max(0, rawPosition.subdivision),
              tick: Math.max(0, rawPosition.tick),
            },
            type: 'harmony-control-change' as const,
            velocity: 0,
            data: {
              cc: cc.cc,
              value: cc.value,
              ticks: cc.ticks,
              originalBpm: latestExercise?.bpm,
            },
          };
        });

      const allHarmonyEvents = [...harmonyEvents, ...controlChangeEvents];

      // Create region
      const harmonyRegion: HarmonyRegion = {
        id: `harmony-region-${latestExercise?.id?.value || 'default'}`,
        trackId: 'harmony-widget-track',
        startTime: 0,
        duration: latestExercise?.durationBeats || 32,
        pattern: {
          id: `harmony-pattern-${latestExercise?.id?.value || 'default'}`,
          name: 'Harmony Pattern',
          type: 'harmony',
          events: allHarmonyEvents,
        },
      };

      // Register track with PlaybackEngine
      const trackData: HarmonyTrackData[] = [
        {
          id: 'harmony-widget-track',
          name: 'Harmony',
          instrumentType: 'harmony',
          exerciseId: latestExercise?.id?.value,
          regions: [harmonyRegion],
          audioNode: plugin?.audioNode,
        },
      ];

      const isRunning = (playbackEngine as any).isRunning;
      const exerciseMetadata = {
        harmonyInstrument: latestExercise?.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT,
      };

      if (isRunning) {
        playbackEngine.updateTracks(trackData, exerciseMetadata);
      } else {
        playbackEngine.registerTracks(trackData);
        (playbackEngine as any).currentHarmonyInstrument = exerciseMetadata.harmonyInstrument;
      }

      console.log('[HARMONY-WIDGET] Harmony registered with PlaybackEngine', {
        eventsCount: harmonyEvents.length,
        duration: harmonyRegion.duration,
        currentBpm,
      });

      logger.info('Harmony registered with PlaybackEngine', {
        noteCount: harmonyEvents.length,
        exerciseId: latestExercise?.id?.value,
        currentBpm,
      });

      lastRegisteredExerciseIdRef.current = registrationKey;
    } catch (error) {
      console.error('[HARMONY-WIDGET] Failed to register harmony:', error);
      logger.error('Failed to register harmony with PlaybackEngine', error as Error);
    } finally {
      isRegisteringRef.current = false;
    }
  }, [
    exerciseRef,
    keyboardPluginRef,
    currentInstrument,
    setCurrentInstrument,
    samplesLoadedTrigger,
    volume,
    isMuted,
    logger,
  ]);

  /**
   * Schedule manual chord progression (fallback when no exercise harmony notes)
   */
  const scheduleProgression = useCallback(() => {
    const plugin = keyboardPluginRef.current;
    if (!plugin || !isPlayingRef.current) return;

    const selectedProg = CHORD_PROGRESSIONS[selectedProgression];
    if (!selectedProg) return;

    const audioContext = plugin.audioNode?.context;
    if (!audioContext) return;

    const currentBpm = musicalTruth.getBPM();
    const currentTime = audioContext.currentTime;
    const beatDuration = 60 / currentBpm;

    currentPatternRef.current = [];

    let scheduleTime = currentTime + 0.1;

    selectedProg.forEach((item) => {
      const chordDuration = item.duration * beatDuration;

      if (plugin.playChord) {
        plugin.playChord(item.chord, 70, chordDuration - 0.05, 4);
      }

      currentPatternRef.current.push({
        chord: item.chord,
        time: scheduleTime,
        duration: chordDuration,
      });

      setTimeout(
        () => {
          if (isPlayingRef.current) {
            onNextChord();
          }
        },
        (scheduleTime - currentTime) * 1000
      );

      scheduleTime += chordDuration;
    });

    lastScheduledTimeRef.current = scheduleTime;
  }, [keyboardPluginRef, isPlayingRef, selectedProgression, onNextChord]);

  /**
   * Handle exercise switching - reset WAM plugin and registration state
   *
   * FAANG FIX: Track/region cleanup is now handled centrally by PlaybackEngine.switchExercise()
   * We only need to reset WAM plugin state and local registration refs here.
   *
   * Why WAM plugin reset is still needed here:
   * - WAM plugins have internal state (scheduled events, sustain pedal, active notes)
   * - This state isn't managed by PlaybackEngine, so we must clear it locally
   */
  useEffect(() => {
    const handleExerciseSwitched = () => {
      console.log('[HARMONY-WIDGET] exercise:switched event received, resetting state');

      // Reset WAM plugin state (scheduled events, sustain pedal, active notes)
      if (keyboardPluginRef.current?.resetState) {
        keyboardPluginRef.current.resetState();
        console.log('[HARMONY-WIDGET] Reset WAM plugin state');
      } else {
        // Fallback: Clear WAM plugin internals directly
        if (keyboardPluginRef.current?.audioNode?.clearEvents) {
          keyboardPluginRef.current.audioNode.clearEvents();
        }
        if (keyboardPluginRef.current?.audioNode?.activeSampler?.releaseAll) {
          keyboardPluginRef.current.audioNode.activeSampler.releaseAll();
        }
        console.log('[HARMONY-WIDGET] Cleared WAM plugin (fallback)');
      }

      // Reset registration tracking to allow fresh registration
      lastRegisteredExerciseIdRef.current = null;
    };

    window.addEventListener('exercise:switched', handleExerciseSwitched);

    return () => {
      window.removeEventListener('exercise:switched', handleExerciseSwitched);
    };
  }, [keyboardPluginRef]);

  // Track exercise ID for logging (not for triggering cleanup)
  useEffect(() => {
    const currentExercise = exerciseRef.current;
    const exerciseId = currentExercise?.id?.value || currentExercise?.id;
    if (exerciseId !== previousExerciseIdRef.current) {
      console.log('[HARMONY-WIDGET] Exercise ID changed', {
        previousExerciseId: previousExerciseIdRef.current,
        newExerciseId: exerciseId,
      });
      previousExerciseIdRef.current = exerciseId || null;
    }
  }, [exercise?.id, exerciseRef]);

  // Clear WAM plugin if exercise has no harmony notes
  useEffect(() => {
    const currentExercise = exerciseRef.current;
    const exerciseId = currentExercise?.id?.value || currentExercise?.id;

    if (harmonyNoteCount === 0 && exerciseId) {
      if (keyboardPluginRef.current?.resetState) {
        keyboardPluginRef.current.resetState();
      } else {
        if (keyboardPluginRef.current?.audioNode?.clearEvents) {
          keyboardPluginRef.current.audioNode.clearEvents();
        }
        if (keyboardPluginRef.current?.audioNode?.activeSampler?.releaseAll) {
          keyboardPluginRef.current.audioNode.activeSampler.releaseAll();
        }
      }
    }
  }, [harmonyNoteCount, exerciseRef, keyboardPluginRef]);

  /**
   * Registration effect - register when conditions are met
   *
   * Note: The actual duplicate prevention is handled inside registerHarmonyWithPlaybackEngine
   * via isRegisteringRef and lastRegisteredExerciseIdRef guards. This effect may fire
   * multiple times due to React strict mode or dependency changes, but the guards ensure
   * actual registration only happens once per exercise+trigger combo.
   */
  useEffect(() => {
    const currentExercise = exerciseRef.current;
    const shouldRegister = trackIsReady && harmonyNoteCount > 0;

    if (shouldRegister) {
      // Only log in verbose mode to reduce console noise
      if (isVerboseDebugEnabled()) {
        console.log('[HARMONY-WIDGET] Conditions met - attempting harmony registration', {
          exerciseId: currentExercise?.id,
          harmonyNotesCount: harmonyNoteCount,
        });
      }
      registerHarmonyWithPlaybackEngine();
    }
  }, [
    trackIsReady,
    harmonyNoteCount,
    wamPluginLoaded,
    registerHarmonyWithPlaybackEngine,
    exercise?.id,
    samplesLoadedTrigger,
    exerciseRef,
  ]);

  /**
   * Manual chord progression playback (fallback)
   *
   * DISABLED: This was causing unwanted "high-pitched keyboard" sounds when switching
   * between tutorials. When the new tutorial has harmonyNoteCount === 0, this effect
   * would trigger and play a hardcoded chord progression (Jazz Standard, Blues in C, etc.)
   * that has nothing to do with the actual exercise.
   *
   * This feature was originally intended for demo/testing purposes but was never
   * properly gated. To re-enable, add an explicit "enableManualChordProgression" prop
   * that the user must activate via the UI (e.g., expanding the widget and selecting
   * a chord progression).
   */
  // useEffect(() => {
  //   if (
  //     isPlaying &&
  //     trackIsReady &&
  //     wamPluginLoaded &&
  //     keyboardPluginRef.current &&
  //     harmonyNoteCount === 0
  //   ) {
  //     console.log('[HARMONY-WIDGET] Using manual chord progression');
  //     logger.info('Using manual chord progression for playback');
  //     scheduleProgression();
  //   }
  // }, [
  //   isPlaying,
  //   trackIsReady,
  //   wamPluginLoaded,
  //   harmonyNoteCount,
  //   scheduleProgression,
  //   keyboardPluginRef,
  //   logger,
  // ]);

  /**
   * EventBus subscription for transport:stop
   */
  useEffect(() => {
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      return;
    }

    const eventBus = coreServices.getEventBus();
    if (!eventBus) {
      return;
    }

    const handleTransportStop = () => {
      logger.debug('Transport stopped event received', { correlationId });

      if (keyboardPluginRef.current?.audioNode) {
        keyboardPluginRef.current.audioNode.clearEvents();
        if (keyboardPluginRef.current.audioNode.activeSampler?.releaseAll) {
          keyboardPluginRef.current.audioNode.activeSampler.releaseAll();
        }
      }
    };

    const unsubStop = eventBus.on('transport:stop', handleTransportStop);

    return () => {
      unsubStop();
    };
  }, [logger, correlationId, keyboardPluginRef]);

  return {
    registerHarmonyWithPlaybackEngine,
    scheduleProgression,
  };
}
