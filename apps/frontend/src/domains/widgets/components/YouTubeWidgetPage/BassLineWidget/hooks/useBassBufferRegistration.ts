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
import { isVerboseDebugEnabled, verboseLog } from '@/config/debug';
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
 * Convert exercise's string number (guitar-style: 1=G highest, 5=B lowest)
 * to the sample manifest's string name. Mirrors the constant of the same
 * name in BassPreloadStrategy — both consumer and preloader MUST use this
 * to keep cache keys aligned (`bass-${midi}-${string}`).
 *
 * Without this, the consumer was using `getSampleForMidiNote(midi)` which
 * picks the first valid string in manifest order (B → E → A → D → G) —
 * for any MIDI in the B-string's range that mismatched the exercise's
 * actual string, the consumer would compute e.g. `bass-31-B` while the
 * preload had written `bass-31-E`, producing
 * "No cached buffer for bass-31-B" warnings + silent bass on that note.
 */
const EXERCISE_STRING_TO_SAMPLE_STRING: Record<number, BassString> = {
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
};

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
        verboseLog(
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
        verboseLog('[BASS-WIDGET] Exercise ID changed', {
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
        verboseLog('[BASS-WIDGET] Registration already in progress, skipping');
      }
      return;
    }

    // Skip if already registered for this exercise
    // NOTE: Do NOT include samplesLoadedTrigger in the key - it causes duplicate registrations
    // when BassPreloadStrategy dispatches 'bass-samples-loaded' event
    const registrationKey = exercise?.id;
    if (lastRegisteredExerciseIdRef.current === registrationKey) {
      if (isVerboseDebugEnabled()) {
        verboseLog(
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
      verboseLog('[BASS-WIDGET] registerBassWithPlaybackEngine CALLED', {
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
      verboseLog(
        '[BASS-WIDGET] PlaybackEngine available, starting buffer injection...',
      );
    }

    try {
      const sampleCache = GlobalSampleCache.getInstance();
      const metadata = sampleCache.getMetadata('bass-required-notes');

      // Determine which MIDI notes to load
      let midiNotesToLoad: number[] = [];
      // Map of midi → exercise-chosen sample string. The preloader writes
      // cache keys as `bass-${midi}-${string}` using THIS string (derived
      // from the exercise's note.string), not from getSampleForMidiNote().
      // The consumer must read with the same string to find the buffer.
      // If a metadata-only path doesn't supply per-note string info, the
      // consumer falls back to getSampleForMidiNote() — which works when
      // it happens to match what the preloader picked, but mismatches for
      // notes in the B-string overlap range.
      const midiToSampleString = new Map<number, BassString>();

      if (
        metadata &&
        metadata.exerciseId === exercise?.id &&
        metadata.midiNotes?.length > 0
      ) {
        // Metadata matches current exercise - use it
        midiNotesToLoad = metadata.midiNotes;
        // If metadata also carries sampleRequests (midi+string pairs),
        // prefer those so the cache key derivation is exact. Otherwise
        // we'll fall back to getSampleForMidiNote() below.
        const metaWithRequests = metadata as unknown as {
          sampleRequests?: Array<{
            midiNote: number;
            sampleString: BassString;
          }>;
        };
        if (metaWithRequests.sampleRequests?.length) {
          for (const req of metaWithRequests.sampleRequests) {
            midiToSampleString.set(req.midiNote, req.sampleString);
          }
        }
        if (isVerboseDebugEnabled()) {
          verboseLog(
            '[BASS-WIDGET] Using cached metadata for current exercise:',
            {
              exerciseId: exercise?.id,
              noteCount: midiNotesToLoad.length,
              hasSampleRequests:
                (metaWithRequests.sampleRequests?.length ?? 0) > 0,
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
            // Remember which sample-string the exercise picked for this
            // MIDI note. Same pitch can sit on multiple strings (e.g.
            // MIDI 31 = B-fret-8 OR E-fret-3) and the preloader wrote
            // the buffer under the exercise's chosen string only.
            const sampleString = EXERCISE_STRING_TO_SAMPLE_STRING[note.string];
            if (sampleString) {
              midiToSampleString.set(midiNote, sampleString);
            }
          }
        });

        midiNotesToLoad = Array.from(midiNoteSet).sort((a, b) => a - b);
        if (isVerboseDebugEnabled()) {
          verboseLog('[BASS-WIDGET] Derived MIDI notes from exercise.notes:', {
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
          verboseLog(
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
        // different. Prefer the exercise's chosen string (from
        // midiToSampleString, populated above from exercise.notes or
        // sampleRequests metadata) so we read the SAME key
        // BassPreloadStrategy wrote. Fall back to getSampleForMidiNote()
        // only when we have no exercise context — that picks the first
        // valid string in manifest order (B → E → A → D → G) which
        // mismatches the preloader for any MIDI in the B-string overlap.
        let sampleString = midiToSampleString.get(midiNote);
        if (!sampleString) {
          const sampleConfig = getSampleForMidiNote(midiNote);
          if (!sampleConfig) continue;
          sampleString = sampleConfig.string as BassString;
        }
        const cacheKey = `bass-${midiNote}-${sampleString}`;
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
              verboseLog(`[BASS DECODE] Decoded ${cacheKey}`, {
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
        verboseLog('[BASS-WIDGET] Buffer decoding complete:', {
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
          verboseLog(
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
          verboseLog(
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
                // CRITICAL: Inject buffers into PlaybackEngine's bass
                // scheduler. Without this, the scheduler stays empty and
                // every bass note lookup MISSes — silent playback on
                // tutorial-to-tutorial navigation when the cache misses.
                const bassGainNode =
                  playbackEngine.getOrCreateInstrumentGainNode('bass');
                const destination = bassGainNode || audioContext.destination;
                playbackEngine.setBassBuffers(loadedBuffers, destination);

                const effectiveVolume = isMuted ? 0 : volume / 100;
                playbackEngine.setInstrumentVolume('bass', effectiveVolume);
                playbackEngine.setInstrumentMuted('bass', isMuted);

                bassBuffersRef.current = loadedBuffers;
                onSamplesLoadedRef.current(loadResult.loaded, loadResult.total);
                onSamplerReadyRef.current(true);
                WindowRegistry.setBassBuffersReady(true, exercise?.id);

                if (isVerboseDebugEnabled()) {
                  verboseLog(
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
      verboseLog('[BASS-CHECKPOINT] Should register bass:', {
        shouldRegister,
        trackIsReady,
        bassNoteCount,
        exerciseId: exercise?.id,
      });
    }

    if (shouldRegister) {
      if (isVerboseDebugEnabled()) {
        verboseLog(
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
