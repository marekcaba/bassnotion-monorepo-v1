'use client';

/**
 * useBassBufferRegistration Hook
 *
 * CRITICAL: Registers bass buffers with PlaybackEngine before playback starts.
 * This ensures buffers are injected BEFORE playback begins, preventing silent playback.
 *
 * Responsibilities:
 * - Decodes cached ArrayBuffers to AudioBuffers
 * - Injects buffers into PlaybackEngine's bass scheduler
 * - Handles exercise changes and re-registration
 * - Falls back to BassPreloadStrategy if buffers aren't cached
 *
 * @example
 * const { registerBassWithPlaybackEngine } = useBassBufferRegistration({
 *   exercise,
 *   samplesLoadedTrigger,
 *   trackIsReady,
 *   bassNoteCount,
 *   volume,
 *   isMuted,
 *   bassBuffersRef,
 *   onSamplesLoaded,
 *   onSamplerReady,
 * });
 */

import { useCallback, useEffect, useRef } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache';
import { isVerboseDebugEnabled } from '@/config/debug';
import {
  getSampleForMidiNote,
  type BassString,
} from '@/domains/playback/modules/instruments/implementations/bass-sampler/index.js';
import { STRING_TO_BASE_MIDI } from '../types.js';
import type {
  UseBassBufferRegistrationOptions,
  UseBassBufferRegistrationReturn,
} from '../types.js';

/**
 * Hook for registering bass buffers with PlaybackEngine
 */
export function useBassBufferRegistration(
  options: UseBassBufferRegistrationOptions,
): UseBassBufferRegistrationReturn {
  const {
    exercise,
    samplesLoadedTrigger,
    trackIsReady,
    bassNoteCount,
    volume,
    isMuted,
    bassBuffersRef,
    onSamplesLoaded,
    onSamplerReady,
  } = options;

  // Refs to prevent multiple registrations
  const lastRegisteredExerciseIdRef = useRef<string | null>(null);
  const isRegisteringRef = useRef(false);
  const prevExerciseIdRef = useRef<string | undefined>(undefined);

  // ✅ FAANG FIX: Store callback props in refs to prevent infinite re-registrations
  // These callbacks change on every parent render, causing registerBassWithPlaybackEngine
  // to be recreated, triggering the useEffect to run again, which can clear buffers
  const onSamplesLoadedRef = useRef(onSamplesLoaded);
  const onSamplerReadyRef = useRef(onSamplerReady);

  // Update refs when callbacks change
  useEffect(() => {
    onSamplesLoadedRef.current = onSamplesLoaded;
  }, [onSamplesLoaded]);

  useEffect(() => {
    onSamplerReadyRef.current = onSamplerReady;
  }, [onSamplerReady]);

  /**
   * Reset registration state when exercise changes
   *
   * FAANG FIX: Now listens for 'exercise:switched' event from PlaybackEngine
   * instead of doing its own exercise-change detection. This ensures all widgets
   * reset in sync when PlaybackEngine.switchExercise() is called.
   *
   * The WindowRegistry.clearBassBuffersReady() is now called centrally by
   * PlaybackEngine.switchExercise() - we just need to reset local refs here.
   */
  useEffect(() => {
    const handleExerciseSwitched = () => {
      if (isVerboseDebugEnabled()) {
        console.log(
          '[BASS-WIDGET] exercise:switched event received, resetting registration state',
        );
      }
      // Reset registration refs to allow fresh registration for new exercise
      lastRegisteredExerciseIdRef.current = null;
      isRegisteringRef.current = false;
    };

    // Listen for centralized exercise switch event
    window.addEventListener('exercise:switched', handleExerciseSwitched);

    return () => {
      window.removeEventListener('exercise:switched', handleExerciseSwitched);
    };
  }, []);

  // Track exercise ID changes for logging (not for triggering cleanup)
  useEffect(() => {
    if (exercise?.id !== prevExerciseIdRef.current) {
      if (isVerboseDebugEnabled()) {
        console.log('[BASS-WIDGET] Exercise ID changed', {
          prevExerciseId: prevExerciseIdRef.current,
          newExerciseId: exercise?.id,
        });
      }
      prevExerciseIdRef.current = exercise?.id;
    }
  }, [exercise?.id]);

  /**
   * Register bass buffers with PlaybackEngine
   * Decodes cached ArrayBuffers and injects them into the bass scheduler
   */
  const registerBassWithPlaybackEngine = useCallback(async () => {
    // Prevent multiple simultaneous registrations
    if (isRegisteringRef.current) {
      if (isVerboseDebugEnabled()) {
        console.log('[BASS-WIDGET] Registration already in progress, skipping');
      }
      return;
    }

    // Skip if already registered for this exercise
    // NOTE: Do NOT include samplesLoadedTrigger in the key - it causes duplicate registrations
    // when BassPreloadStrategy dispatches 'bass-samples-loaded' event
    const registrationKey = exercise?.id;
    if (lastRegisteredExerciseIdRef.current === registrationKey) {
      if (isVerboseDebugEnabled()) {
        console.log(
          '[BASS-WIDGET] Already registered for this exercise, skipping',
          {
            registrationKey,
          },
        );
      }
      return;
    }

    isRegisteringRef.current = true;

    if (isVerboseDebugEnabled()) {
      console.log('[BASS-WIDGET] registerBassWithPlaybackEngine CALLED', {
        timestamp: new Date().toISOString(),
        exerciseId: exercise?.id,
        hasNotes: !!exercise?.notes?.length,
      });
    }

    // Get CoreServices and PlaybackEngine
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      console.error('[BASS-WIDGET] No core services available');
      isRegisteringRef.current = false;
      return;
    }

    const playbackEngine = coreServices.getPlaybackEngine?.();
    if (!playbackEngine) {
      console.error('[BASS-WIDGET] No PlaybackEngine available');
      isRegisteringRef.current = false;
      return;
    }

    if (isVerboseDebugEnabled()) {
      console.log(
        '[BASS-WIDGET] PlaybackEngine available, starting buffer injection...',
      );
    }

    try {
      const sampleCache = GlobalSampleCache.getInstance();
      const metadata = sampleCache.getMetadata('bass-required-notes');

      // Determine which MIDI notes to load
      let midiNotesToLoad: number[] = [];

      if (
        metadata &&
        metadata.exerciseId === exercise?.id &&
        metadata.midiNotes?.length > 0
      ) {
        // Metadata matches current exercise - use it
        midiNotesToLoad = metadata.midiNotes;
        if (isVerboseDebugEnabled()) {
          console.log(
            '[BASS-WIDGET] Using cached metadata for current exercise:',
            {
              exerciseId: exercise?.id,
              noteCount: midiNotesToLoad.length,
            },
          );
        }
      } else if (exercise?.notes && exercise.notes.length > 0) {
        // Derive from exercise.notes
        const bassNotes = exercise.notes.filter(
          (note: { string: number }) => note.string >= 1 && note.string <= 5,
        );

        const midiNoteSet = new Set<number>();
        bassNotes.forEach((note: { string: number; fret?: number }) => {
          const baseMidi = STRING_TO_BASE_MIDI[note.string];
          if (baseMidi !== undefined) {
            const midiNote = baseMidi + (note.fret || 0);
            midiNoteSet.add(midiNote);
          }
        });

        midiNotesToLoad = Array.from(midiNoteSet).sort((a, b) => a - b);
        if (isVerboseDebugEnabled()) {
          console.log('[BASS-WIDGET] Derived MIDI notes from exercise.notes:', {
            exerciseId: exercise?.id,
            uniqueMidiNotes: midiNotesToLoad.length,
          });
        }
      }

      if (midiNotesToLoad.length === 0) {
        console.warn(
          '[BASS-WIDGET] No bass notes to load, skipping buffer injection',
        );
        isRegisteringRef.current = false;
        return;
      }

      // Get AudioContext for decoding
      const audioEngine = coreServices.getAudioEngine?.();

      if (!audioEngine?.isInitialized) {
        if (isVerboseDebugEnabled()) {
          console.log(
            '[BASS-WIDGET] AudioEngine not initialized yet, will retry when user interacts',
          );
        }
        isRegisteringRef.current = false;
        return;
      }

      const audioContext = audioEngine.getContext();

      if (!audioContext?.destination) {
        console.error('[BASS-WIDGET] No audioContext.destination available');
        isRegisteringRef.current = false;
        return;
      }

      // Decode cached ArrayBuffers and collect into a Record
      const bassBuffers: Record<string, AudioBuffer> = {};
      let buffersDecoded = 0;

      for (const midiNote of midiNotesToLoad) {
        // Cache key must include the sample-string (e.g. "bass-60-D" vs
        // "bass-60-G") — same MIDI note on different strings sounds
        // different. Derive the string here from the sample manifest so we
        // read the same key BassPreloadStrategy wrote.
        const sampleConfig = getSampleForMidiNote(midiNote);
        if (!sampleConfig) continue;
        const cacheKey = `bass-${midiNote}-${sampleConfig.string as BassString}`;
        const rawBuffer = await sampleCache.getCachedRawBuffer(cacheKey);

        if (rawBuffer) {
          try {
            const buffer = await audioContext.decodeAudioData(
              rawBuffer.slice(0),
            );

            if (isVerboseDebugEnabled()) {
              // Analyze decoded buffer for diagnostics
              const channelData = buffer.getChannelData(0);
              let maxAmplitude = 0;
              for (let i = 0; i < Math.min(4800, channelData.length); i++) {
                maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
              }
              console.log(`[BASS DECODE] Decoded ${cacheKey}`, {
                midiNote,
                duration: buffer.duration.toFixed(2) + 's',
                hasStrongAttack: maxAmplitude > 0.1 ? 'YES' : 'WEAK/MISSING',
              });
            }

            bassBuffers[String(midiNote)] = buffer;
            buffersDecoded++;
          } catch (decodeError) {
            console.error(
              `[BASS-WIDGET] Failed to decode ${cacheKey}:`,
              decodeError,
            );
          }
        } else {
          console.warn(
            `[BASS-WIDGET] No cached buffer for ${cacheKey} - sample may not have been preloaded`,
          );
        }
      }

      if (isVerboseDebugEnabled()) {
        console.log('[BASS-WIDGET] Buffer decoding complete:', {
          exerciseId: exercise?.id,
          totalNotes: midiNotesToLoad.length,
          buffersDecoded,
        });
      }

      if (buffersDecoded > 0) {
        // Get or create instrument gain node for volume control
        const bassGainNode =
          playbackEngine.getOrCreateInstrumentGainNode('bass');
        const destination = bassGainNode || audioContext.destination;

        // Inject bass buffers into PlaybackEngine
        playbackEngine.setBassBuffers(bassBuffers, destination);

        // Apply initial volume/mute state
        const effectiveVolume = isMuted ? 0 : volume / 100;
        playbackEngine.setInstrumentVolume('bass', effectiveVolume);
        playbackEngine.setInstrumentMuted('bass', isMuted);

        // Store locally for test playback
        bassBuffersRef.current = bassBuffers;

        if (isVerboseDebugEnabled()) {
          console.log(
            '[BASS-WIDGET] Bass buffers injected into PlaybackEngine',
            {
              exerciseId: exercise?.id,
              buffersInjected: buffersDecoded,
              midiNoteRange: `${Math.min(...midiNotesToLoad)}-${Math.max(...midiNotesToLoad)}`,
            },
          );
        }

        // Set the bass buffers ready flag
        WindowRegistry.setBassBuffersReady(true, exercise?.id);

        // Update state for UI feedback (use refs to avoid dep array instability)
        onSamplesLoadedRef.current(buffersDecoded, midiNotesToLoad.length);
        onSamplerReadyRef.current(true);
      } else if (midiNotesToLoad.length > 0) {
        // No buffers decoded - trigger the preload strategy
        if (isVerboseDebugEnabled()) {
          console.log(
            '[BASS-WIDGET] No cached buffers - triggering BassPreloadStrategy...',
          );
        }

        try {
          const { BassPreloadStrategy } =
            await import('@/domains/playback/modules/preloading/strategies/BassPreloadStrategy.js');
          const bassStrategy = new BassPreloadStrategy();

          const result = await bassStrategy.loadFullSamples(
            undefined,
            exercise,
          );

          if (result.success && result.loaded > 0) {
            // Samples are now cached - decode and inject
            const loadResult =
              await bassStrategy.loadFromCachedMetadata(audioContext);

            if (loadResult.success && loadResult.loaded > 0) {
              const loadedBuffers = bassStrategy.getLoadedBuffers();
              if (loadedBuffers) {
                bassBuffersRef.current = loadedBuffers;
                onSamplesLoadedRef.current(loadResult.loaded, loadResult.total);
                onSamplerReadyRef.current(true);
                WindowRegistry.setBassBuffersReady(true, exercise?.id);

                if (isVerboseDebugEnabled()) {
                  console.log(
                    '[BASS-WIDGET] Bass buffers loaded via preload strategy',
                    {
                      exerciseId: exercise?.id,
                      buffersLoaded: Object.keys(loadedBuffers).length,
                    },
                  );
                }
              }
            }
          } else {
            console.warn(
              '[BASS-WIDGET] BassPreloadStrategy failed to load samples',
            );
          }
        } catch (preloadError) {
          console.error(
            '[BASS-WIDGET] Failed to trigger BassPreloadStrategy:',
            preloadError,
          );
        }
      } else {
        console.warn('[BASS-WIDGET] No bass buffers decoded');
      }

      // Mark registration complete for this exercise
      // NOTE: Do NOT include samplesLoadedTrigger - it caused duplicate registrations
      lastRegisteredExerciseIdRef.current = exercise?.id ?? null;
    } catch (error) {
      console.error('[BASS-WIDGET] Failed to inject bass buffers', error);
    } finally {
      isRegisteringRef.current = false;
    }
    // ✅ FAANG FIX: Removed onSamplesLoaded and onSamplerReady from deps - they're in refs now
    // bassBuffersRef is also removed - refs don't need to be in dependency arrays
  }, [exercise, samplesLoadedTrigger, volume, isMuted]);

  /**
   * Trigger registration when conditions are met
   */
  useEffect(() => {
    const shouldRegister = trackIsReady && bassNoteCount > 0;

    if (isVerboseDebugEnabled()) {
      console.log('[BASS-CHECKPOINT] Should register bass:', {
        shouldRegister,
        trackIsReady,
        bassNoteCount,
        exerciseId: exercise?.id,
      });
    }

    if (shouldRegister) {
      if (isVerboseDebugEnabled()) {
        console.log(
          '[BASS-WIDGET] ALL CONDITIONS MET - Registering bass buffers!',
          {
            exerciseId: exercise?.id,
            bassNoteCount,
          },
        );
      }
      registerBassWithPlaybackEngine();
    }
  }, [
    trackIsReady,
    bassNoteCount,
    exercise?.id,
    samplesLoadedTrigger,
    registerBassWithPlaybackEngine,
  ]);

  return {
    registerBassWithPlaybackEngine,
  };
}
