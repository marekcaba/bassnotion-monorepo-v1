/**
 * Bass Preload Strategy
 *
 * Handles preloading of bass samples using FAANG MIDI-based smart loading
 * Only loads samples for notes actually used in the exercise's bassline MIDI file
 *
 * Phase 3 Enhancement: Now actually loads samples using BassSampleLoader
 * and injects them into PlaybackEngine for playback
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '../../../services/WindowRegistry.js';
import {
  BassSampleLoader,
  BASS_TUNING,
  STRING_NUMBER_TO_NAME,
  getSampleForMidiNote,
  buildSampleUrl,
  type BassString,
} from '../../instruments/implementations/bass-sampler/index.js';
import type { Exercise, ExerciseNote } from '@bassnotion/contracts';

/**
 * Convert exercise string number (guitar-style: 1=G highest) to sample manifest string name
 *
 * IMPORTANT: Exercise data uses "guitar-style" string numbering where:
 * - String 1 = G (highest pitch, thinnest string)
 * - String 2 = D
 * - String 3 = A
 * - String 4 = E (lowest pitch on 4-string)
 * - String 5 = B (5-string bass low B)
 *
 * Sample manifest uses string names: B, E, A, D, G
 */
const EXERCISE_STRING_TO_SAMPLE_STRING: Record<number, BassString> = {
  1: 'G', // Highest string (thinnest)
  2: 'D',
  3: 'A',
  4: 'E', // Lowest on 4-string
  5: 'B', // 5-string bass low B
};

const logger = getLogger('BassPreloadStrategy');

/**
 * Calculate MIDI note number from bass string and fret position
 *
 * IMPORTANT: Exercise data uses "guitar-style" string numbering where:
 * - String 1 = G (highest pitch, thinnest string) = MIDI 43
 * - String 2 = D = MIDI 38
 * - String 3 = A = MIDI 33
 * - String 4 = E (lowest pitch on 4-string) = MIDI 28
 * - String 5 = B (5-string bass low B) = MIDI 23
 *
 * This matches the fretboard visualizer and admin UI conventions.
 */
function getMidiFromStringAndFret(stringNum: number, fret: number): number {
  // String number to OPEN STRING MIDI note (guitar-style: 1 = highest pitch)
  const STRING_TO_OPEN_MIDI: Record<number, number> = {
    1: 43, // G2 (highest string on 4-string)
    2: 38, // D2
    3: 33, // A1
    4: 28, // E1 (lowest string on 4-string)
    5: 23, // B0 (5-string bass low B)
  };

  const openStringMidi = STRING_TO_OPEN_MIDI[stringNum];
  if (openStringMidi === undefined) {
    logger.warn('Invalid string number', { stringNum });
    return 40; // Default to E2
  }
  return openStringMidi + fret;
}

/**
 * Sample request with MIDI note and the STRING it should be played on
 * The string info is critical for correct timbre - same MIDI note sounds different on different strings
 */
interface SampleRequest {
  midiNote: number;
  sampleString: BassString; // Which string folder to load from
  exerciseString: number;   // Original exercise string number (for logging)
  fret: number;             // Fret position (for logging)
}

/**
 * Extract unique MIDI notes with STRING INFO from exercise.notes
 * This is CRITICAL - the same pitch played on different strings has different timbre!
 *
 * Example: MIDI 43 (G2) can be:
 * - G string open (fret 0) - bright, punchy tone
 * - D string fret 5 - warmer, rounder tone
 * - A string fret 10 - darker, more muted tone
 *
 * We MUST load the sample from the CORRECT string folder.
 */
function extractSampleRequestsFromExerciseNotes(notes: ExerciseNote[]): SampleRequest[] {
  const seen = new Set<string>(); // Track unique midi+string combos
  const requests: SampleRequest[] = [];

  for (const note of notes) {
    // Only process notes on bass strings (1-5 for 5-string bass)
    if (note.string >= 1 && note.string <= 5) {
      const midiNote = getMidiFromStringAndFret(note.string, note.fret);
      const sampleString = EXERCISE_STRING_TO_SAMPLE_STRING[note.string];

      // Key by MIDI note + string to allow same pitch from different strings
      const key = `${midiNote}-${sampleString}`;
      if (!seen.has(key)) {
        seen.add(key);
        requests.push({
          midiNote,
          sampleString,
          exerciseString: note.string,
          fret: note.fret,
        });
      }
    }
  }

  // Sort by MIDI note for consistent ordering
  return requests.sort((a, b) => a.midiNote - b.midiNote);
}

/**
 * Legacy function for getting just MIDI notes (for compatibility)
 */
function extractMidiNotesFromExerciseNotes(notes: ExerciseNote[]): number[] {
  const midiNotes = new Set<number>();

  for (const note of notes) {
    // Only process notes on bass strings (1-5 for 5-string bass)
    if (note.string >= 1 && note.string <= 5) {
      const midiNote = getMidiFromStringAndFret(note.string, note.fret);
      midiNotes.add(midiNote);
    }
  }

  return Array.from(midiNotes).sort((a, b) => a - b);
}

export class BassPreloadStrategy implements PreloadStrategy {
  readonly name = 'bass';
  private bassLoader: BassSampleLoader | null = null;
  private decodedBuffers: Record<string, AudioBuffer> | null = null;
  private loaded = 0;
  private total = 0;
  private onProgressCallback: ((loaded: number, total: number) => void) | null = null;

  /**
   * Set a callback to receive progress updates during loading
   */
  setProgressCallback(callback: (loaded: number, total: number) => void): void {
    this.onProgressCallback = callback;
  }

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential bass samples...');

    try {
      // For bass, essential samples are typically not needed in Phase 2
      // Bass loading is exercise-specific and happens in Phase 3 (loadFullSamples)
      logger.info(
        '✅ Skipping essential bass samples - will load on-demand in Phase 3',
      );

      return {
        success: true,
        loaded: 0,
        total: 0,
      };
    } catch (error) {
      logger.error('Failed to load essential bass samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  async loadFullSamples(
    _config?: PreloadConfig,
    exercise?: Exercise,
  ): Promise<PreloadResult> {
    logger.info('🎸 Bass sample loading from exercise.notes...', {
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      hasNotes: !!(exercise?.notes && exercise.notes.length > 0),
      noteCount: exercise?.notes?.length ?? 0,
    });

    try {
      // FAANG SOLUTION: Load ONLY samples needed for this exercise's bass notes
      // Bass notes are stored in exercise.notes (fretboard data from database)
      if (!exercise?.notes || exercise.notes.length === 0) {
        logger.info('✅ No bass notes in exercise - skipping bass sample loading', {
          exerciseId: exercise?.id,
          reason: exercise ? 'no notes array' : 'no exercise provided',
        });

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // 1. Extract sample requests with STRING INFO from exercise.notes
      // This is CRITICAL for correct timbre - same MIDI note sounds different on different strings!
      const sampleRequests = extractSampleRequestsFromExerciseNotes(exercise.notes);

      if (sampleRequests.length === 0) {
        logger.info(
          '✅ No bass string notes found in exercise - skipping sample loading',
          {
            exerciseId: exercise?.id,
            totalNotes: exercise.notes.length,
          },
        );

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // Get MIDI notes for compatibility (legacy code paths)
      const midiNotes = sampleRequests.map(r => r.midiNote);

      // Convert MIDI notes to note names for logging
      const requiredNotes = sampleRequests.map(r => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(r.midiNote / 12) - 1;
        const noteName = noteNames[r.midiNote % 12];
        return `${noteName}${octave}`;
      });

      // Log detailed sample mapping for debugging
      console.log('🎸 [BASS-PRELOAD] Sample requests with STRING INFO:', sampleRequests.map(r => ({
        midi: r.midiNote,
        sampleString: r.sampleString,
        exerciseString: r.exerciseString,
        fret: r.fret,
      })));

      logger.info(
        '📊 Bass notes analysis complete - downloading STRING-SPECIFIC samples',
        {
          uniqueNotes: requiredNotes.length,
          noteRange: `${requiredNotes[0]} to ${requiredNotes[requiredNotes.length - 1]}`,
          midiRange: `${Math.min(...midiNotes)} to ${Math.max(...midiNotes)}`,
          totalSamplesToLoad: sampleRequests.length,
          stringDistribution: sampleRequests.reduce((acc, r) => {
            acc[r.sampleString] = (acc[r.sampleString] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          savedSamples: 110 - sampleRequests.length,
          savingsPercentage: `${Math.round((1 - sampleRequests.length / 110) * 100)}%`,
        },
      );

      // 2. Download and cache raw ArrayBuffer data WITH STRING INFO
      // This ensures we load samples from the CORRECT string folder!
      const loadResult = await this.downloadAndCacheBassSamplesWithStrings(sampleRequests, exercise.id);

      this.total = sampleRequests.length;
      this.loaded = loadResult.loaded;

      // 3. Cache metadata for later use (include string info)
      this.cacheMetadataForLater(exercise.id, requiredNotes, midiNotes, sampleRequests);

      // 4. Try to inject into PlaybackEngine if AudioContext is available
      // This is optional - if not available now, loadFromCachedMetadata() will do it later
      const coreServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;

      if (coreServices) {
        const audioEngine = coreServices.getAudioEngine?.();
        const context = audioEngine?.getContext?.();

        if (context && context.state === 'running') {
          // AudioContext is available - decode and inject buffers now
          await this.decodeAndInjectBuffersWithStrings(sampleRequests, context, coreServices);
        } else {
          logger.info('🎸 Bass samples cached as ArrayBuffer - will decode when AudioContext starts');
        }
      }

      logger.info('✅ Exercise-specific bass samples downloaded and cached (STRING-SPECIFIC)', {
        loaded: loadResult.loaded,
        failed: loadResult.failed,
        total: this.total,
        savingsVsFullLoad: `${Math.round((1 - this.total / 110) * 100)}%`,
      });

      // CRITICAL: Dispatch bass-samples-loaded event to trigger BassLineWidget re-registration
      // This is the same pattern as harmony-samples-loaded for HarmonyWidget
      if (typeof window !== 'undefined') {
        console.log('📢 [BASS-PRELOAD] Emitting bass-samples-loaded event for BassLineWidget');
        const event = new CustomEvent('bass-samples-loaded', {
          detail: {
            exerciseId: exercise.id,
            samplesLoaded: loadResult.loaded,
            total: this.total,
            midiNotes,
            sampleRequests, // Include string info for debugging
          },
        });
        window.dispatchEvent(event);
      }

      return {
        success: loadResult.success,
        loaded: loadResult.loaded,
        total: this.total,
        metadata: { requiredNotes, midiNotes, errors: loadResult.errors },
      };
    } catch (error) {
      logger.error('❌ Failed to load bass samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  /**
   * Cache metadata for later use by widgets or deferred loading
   * NOW includes sampleRequests with STRING INFO for correct timbre
   */
  private cacheMetadataForLater(
    exerciseId: string,
    requiredNotes: string[],
    midiNotes: number[],
    sampleRequests?: SampleRequest[],
  ): void {
    GlobalSampleCache.getInstance().cacheMetadata('bass-required-notes', {
      exerciseId,
      requiredNotes,
      midiNotes,
      sampleRequests: sampleRequests || [], // Include string info for deferred loading
      noteCount: midiNotes.length,
      cachedAt: Date.now(),
    });

    logger.info('✅ Bass sample metadata cached (with string info)', {
      cacheKey: 'bass-required-notes',
      noteCount: midiNotes.length,
      hasStringInfo: !!sampleRequests && sampleRequests.length > 0,
    });
  }

  /**
   * Load samples from cached metadata (for deferred loading)
   * Called by widgets when AudioContext becomes available
   * Uses cached ArrayBuffers from downloadAndCacheBassSamplesWithStrings()
   * NOW uses sampleRequests with STRING INFO for correct timbre
   */
  async loadFromCachedMetadata(audioContext: AudioContext): Promise<PreloadResult> {
    const cache = GlobalSampleCache.getInstance();
    const metadata = cache.getMetadata('bass-required-notes');

    if (!metadata || !metadata.midiNotes || metadata.midiNotes.length === 0) {
      logger.info('No cached bass metadata to load');
      return { success: true, loaded: 0, total: 0 };
    }

    // Get sampleRequests with string info if available
    const sampleRequests = metadata.sampleRequests as SampleRequest[] | undefined;
    const hasSampleRequests = sampleRequests && sampleRequests.length > 0;

    logger.info('🎸 Decoding bass samples from cached ArrayBuffers', {
      noteCount: metadata.midiNotes.length,
      exerciseId: metadata.exerciseId,
      contextState: audioContext.state,
      hasStringInfo: hasSampleRequests,
    });

    const buffers: Record<string, AudioBuffer> = {};
    let decoded = 0;
    const midiNotes = metadata.midiNotes as number[];

    // If we have sampleRequests with string info, use them for proper sample selection
    if (hasSampleRequests) {
      for (const request of sampleRequests!) {
        const { midiNote, sampleString } = request;
        try {
          const cacheKey = `bass-${midiNote}`;

          // Get raw ArrayBuffer from cache
          const rawBuffer = await cache.getCachedRawBuffer(cacheKey);

          if (!rawBuffer) {
            // ArrayBuffer not cached yet - download using STRING-SPECIFIC URL
            const sampleUrl = buildSampleUrl(midiNote, sampleString);
            console.log(`📥 [CACHE-MISS] Downloading bass sample from ${sampleString} string:`, sampleUrl);

            const response = await fetch(sampleUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              await cache.cacheBuffer(cacheKey, arrayBuffer);

              const bufferCopy = arrayBuffer.slice(0);
              const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
              buffers[String(midiNote)] = audioBuffer;
              decoded++;
            }
            continue;
          }

          // Decode with real AudioContext
          const bufferCopy = rawBuffer.slice(0);
          const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
          buffers[String(midiNote)] = audioBuffer;
          decoded++;

          this.loaded = decoded;
          this.total = sampleRequests.length;
          this.onProgressCallback?.(decoded, sampleRequests.length);

        } catch (error) {
          logger.error(`Failed to decode bass sample ${midiNote} (${sampleString}):`, error);
        }
      }
    } else {
      // Fallback: no string info available (legacy path)
      logger.warn('🎸 No string info in cached metadata - using legacy getSampleForMidiNote()');
      for (const midiNote of midiNotes) {
        try {
          const cacheKey = `bass-${midiNote}`;

          // Get raw ArrayBuffer from cache
          const rawBuffer = await cache.getCachedRawBuffer(cacheKey);

          if (!rawBuffer) {
            // ArrayBuffer not cached yet - try to download it now (legacy: no string info)
            const sampleConfig = getSampleForMidiNote(midiNote);
            if (sampleConfig) {
              const response = await fetch(sampleConfig.url);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                await cache.cacheBuffer(cacheKey, arrayBuffer);

                const bufferCopy = arrayBuffer.slice(0);
                const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
                buffers[String(midiNote)] = audioBuffer;
                decoded++;
              }
            }
            continue;
          }

          // Decode with real AudioContext
          const bufferCopy = rawBuffer.slice(0);
          const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
          buffers[String(midiNote)] = audioBuffer;
          decoded++;

          this.loaded = decoded;
          this.total = midiNotes.length;
          this.onProgressCallback?.(decoded, midiNotes.length);

        } catch (error) {
          logger.error(`Failed to decode bass sample ${midiNote}:`, error);
        }
      }
    }

    // Store decoded buffers for later retrieval
    if (decoded > 0) {
      this.decodedBuffers = buffers;
      logger.info('🎸 Decoded buffers stored for retrieval', {
        bufferCount: decoded,
        bufferKeys: Object.keys(buffers),
      });
    }

    // Try to inject via CoreServices if available (use WindowRegistry for proper lookup)
    const coreServices = WindowRegistry.getCoreServices();

    logger.info('🎸 Attempting to inject bass buffers', {
      decoded,
      hasCoreServices: !!coreServices,
      hasDestination: !!audioContext.destination,
    });

    if (coreServices && decoded > 0) {
      const playbackEngine = coreServices.getPlaybackEngine?.();
      logger.info('🎸 Got PlaybackEngine for buffer injection', {
        hasPlaybackEngine: !!playbackEngine,
      });
      if (playbackEngine) {
        playbackEngine.setBassBuffers(buffers, audioContext.destination);

        logger.info('✅ Bass AudioBuffers decoded and injected from cached metadata', {
          bufferCount: decoded,
          totalRequested: midiNotes.length,
        });
      } else {
        logger.warn('⚠️ No PlaybackEngine available - caller should inject buffers manually');
      }
    } else {
      logger.info('ℹ️ CoreServices not available - caller should inject buffers using getLoadedBuffers()');
    }

    return {
      success: decoded > 0,
      loaded: decoded,
      total: midiNotes.length,
      metadata: {
        buffers: decoded > 0 ? buffers : undefined,
        destination: audioContext.destination,
      },
    };
  }

  /**
   * Get the loaded buffers (for direct injection)
   * Returns buffers from either the loader or the decoded cache
   */
  getLoadedBuffers(): Record<string, AudioBuffer> | null {
    // First check decoded buffers (from loadFromCachedMetadata)
    if (this.decodedBuffers && Object.keys(this.decodedBuffers).length > 0) {
      return this.decodedBuffers;
    }
    // Fall back to loader buffers
    return this.bassLoader?.getBuffers() ?? null;
  }

  async clear(): Promise<void> {
    if (this.bassLoader) {
      this.bassLoader.dispose();
      this.bassLoader = null;
    }
    this.decodedBuffers = null;
    this.loaded = 0;
    this.total = 0;
    this.onProgressCallback = null;

    // Clear cached metadata
    GlobalSampleCache.getInstance().clearMetadata('bass-required-notes');
  }

  getProgress() {
    return {
      loaded: this.loaded,
      total: this.total,
      progress: this.total > 0 ? this.loaded / this.total : 0,
    };
  }

  /**
   * Download bass samples and cache as raw ArrayBuffer (NO AudioContext required!)
   * Uses PARALLEL downloads with Promise.allSettled for maximum performance
   */
  private async downloadAndCacheBassSamples(
    midiNotes: number[],
    exerciseId: string,
  ): Promise<{ success: boolean; loaded: number; failed: number; errors: string[] }> {
    const startTime = performance.now();
    const errors: string[] = [];

    console.log('🎸 [SAMPLES] Downloading bass samples in PARALLEL', {
      timestamp: new Date().toISOString(),
      exerciseId,
      totalSamplesToLoad: midiNotes.length,
      midiNotes,
    });

    logger.info('🎸 Downloading bass samples in PARALLEL', {
      exerciseId,
      noteCount: midiNotes.length,
    });

    // Create download tasks for all MIDI notes
    const downloadTasks = midiNotes.map(async (midiNote) => {
      try {
        // Get sample config (includes URL)
        const sampleConfig = getSampleForMidiNote(midiNote);
        if (!sampleConfig) {
          logger.warn(`No sample config for MIDI note ${midiNote}`);
          return { midiNote, success: false, error: `No sample for MIDI ${midiNote}` };
        }

        // Build cache key: bass-{midiNote}
        const cacheKey = `bass-${midiNote}`;

        // Check IndexedDB cache first (like Harmony does)
        const cachedBuffer = await GlobalSampleCache.getInstance().getCachedRawBuffer(cacheKey);

        if (cachedBuffer) {
          console.log(`💾 [SAMPLES][IndexedDB-HIT] Using cached bass sample: ${cacheKey}`);
          logger.info(`💾 IndexedDB cache HIT: ${cacheKey}`);
          return { midiNote, success: true, cached: true };
        }

        // Fetch from network
        logger.info(`📥 Fetching bass sample: ${sampleConfig.url}`);

        const response = await fetch(sampleConfig.url);
        if (!response.ok) {
          logger.error(`❌ Failed to fetch bass sample ${midiNote}: ${response.status}`);
          return { midiNote, success: false, error: `Failed to fetch: ${response.status}` };
        }

        const arrayBuffer = await response.arrayBuffer();

        // Cache raw ArrayBuffer to memory + IndexedDB
        await GlobalSampleCache.getInstance().cacheBuffer(cacheKey, arrayBuffer);

        console.log(`[SAMPLES] Bass sample cached: ${cacheKey}`, {
          bufferSizeKB: Math.round(arrayBuffer.byteLength / 1024),
        });

        return { midiNote, success: true, cached: false, size: arrayBuffer.byteLength };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to cache bass sample ${midiNote}:`, error);
        return { midiNote, success: false, error: errorMsg };
      }
    });

    // Execute all downloads in parallel
    const results = await Promise.allSettled(downloadTasks);

    // Process results
    let loaded = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          loaded++;
        } else {
          failed++;
          errors.push(result.value.error || 'Unknown error');
        }
      } else {
        // Promise rejected
        failed++;
        errors.push(result.reason?.message || 'Promise rejected');
      }
    }

    // Final progress update
    this.onProgressCallback?.(loaded, midiNotes.length);

    const duration = performance.now() - startTime;

    console.log('✅ [SAMPLES] Bass samples downloaded in PARALLEL', {
      timestamp: new Date().toISOString(),
      durationMs: duration.toFixed(2),
      loaded,
      failed,
      total: midiNotes.length,
      successRate: `${Math.round((loaded / midiNotes.length) * 100)}%`,
    });

    logger.info('✅ Bass samples cached (PARALLEL)', {
      duration: `${duration.toFixed(2)}ms`,
      loaded,
      failed,
      total: midiNotes.length,
    });

    return {
      success: failed === 0,
      loaded,
      failed,
      errors,
    };
  }

  /**
   * Decode cached ArrayBuffers and inject into PlaybackEngine
   * Called when AudioContext becomes available
   */
  private async decodeAndInjectBuffers(
    midiNotes: number[],
    audioContext: AudioContext,
    coreServices: any,
  ): Promise<void> {
    logger.info('🎸 Decoding bass ArrayBuffers with real AudioContext', {
      noteCount: midiNotes.length,
      contextState: audioContext.state,
      sampleRate: audioContext.sampleRate,
    });

    const buffers: Record<string, AudioBuffer> = {};
    let decoded = 0;

    for (const midiNote of midiNotes) {
      try {
        const cacheKey = `bass-${midiNote}`;

        // Get raw ArrayBuffer from cache
        const rawBuffer = await GlobalSampleCache.getInstance().getCachedRawBuffer(cacheKey);

        if (!rawBuffer) {
          logger.warn(`No cached ArrayBuffer for bass sample ${midiNote}`);
          continue;
        }

        // Decode with real AudioContext
        // IMPORTANT: Make a copy because decodeAudioData detaches the ArrayBuffer
        const bufferCopy = rawBuffer.slice(0);
        const audioBuffer = await audioContext.decodeAudioData(bufferCopy);

        // Store with MIDI note as key (string)
        buffers[String(midiNote)] = audioBuffer;
        decoded++;

      } catch (error) {
        logger.error(`Failed to decode bass sample ${midiNote}:`, error);
      }
    }

    // Inject buffers into PlaybackEngine
    if (decoded > 0) {
      const playbackEngine = coreServices.getPlaybackEngine?.();
      if (playbackEngine) {
        playbackEngine.setBassBuffers(buffers, audioContext.destination);

        logger.info('✅ Bass AudioBuffers decoded and injected into PlaybackEngine', {
          decodedCount: decoded,
          totalRequested: midiNotes.length,
          bufferKeys: Object.keys(buffers),
        });
      } else {
        logger.warn('PlaybackEngine not available - buffers decoded but not injected');
      }
    }
  }

  /**
   * Download bass samples WITH STRING INFO and cache as raw ArrayBuffer
   * This ensures we load samples from the CORRECT string folder for proper timbre!
   *
   * CRITICAL: The same MIDI note played on different strings has different timbre:
   * - G2 on G string open = bright, punchy
   * - G2 on D string fret 5 = warmer, rounder
   * - G2 on A string fret 10 = darker, more muted
   */
  private async downloadAndCacheBassSamplesWithStrings(
    sampleRequests: SampleRequest[],
    exerciseId: string,
  ): Promise<{ success: boolean; loaded: number; failed: number; errors: string[] }> {
    const startTime = performance.now();
    const errors: string[] = [];

    console.log('🎸 [SAMPLES] Downloading bass samples with STRING INFO in PARALLEL', {
      timestamp: new Date().toISOString(),
      exerciseId,
      totalSamplesToLoad: sampleRequests.length,
      sampleRequests: sampleRequests.map(r => ({
        midi: r.midiNote,
        string: r.sampleString,
        fret: r.fret,
      })),
    });

    logger.info('🎸 Downloading bass samples with STRING INFO in PARALLEL', {
      exerciseId,
      noteCount: sampleRequests.length,
    });

    // Create download tasks for all sample requests
    const downloadTasks = sampleRequests.map(async (request) => {
      const { midiNote, sampleString, fret } = request;
      try {
        // Build URL directly using the CORRECT string from exercise data
        // This is the KEY FIX - we use the exercise's string, not the first available
        const sampleUrl = buildSampleUrl(midiNote, sampleString);

        // Build cache key: bass-{midiNote} (same as before for compatibility)
        const cacheKey = `bass-${midiNote}`;

        // Check IndexedDB cache first
        const cachedBuffer = await GlobalSampleCache.getInstance().getCachedRawBuffer(cacheKey);

        if (cachedBuffer) {
          console.log(`💾 [SAMPLES][IndexedDB-HIT] Using cached bass sample: ${cacheKey} (${sampleString} string)`);
          logger.info(`💾 IndexedDB cache HIT: ${cacheKey}`);
          return { midiNote, sampleString, success: true, cached: true };
        }

        // Fetch from network using the STRING-SPECIFIC URL
        console.log(`📥 [SAMPLES] Fetching bass sample from ${sampleString} string:`, sampleUrl);
        logger.info(`📥 Fetching bass sample: ${sampleUrl}`);

        const response = await fetch(sampleUrl);
        if (!response.ok) {
          logger.error(`❌ Failed to fetch bass sample ${midiNote} from ${sampleString} string: ${response.status}`);
          return { midiNote, sampleString, success: false, error: `Failed to fetch: ${response.status}` };
        }

        const arrayBuffer = await response.arrayBuffer();

        // Cache raw ArrayBuffer to memory + IndexedDB
        await GlobalSampleCache.getInstance().cacheBuffer(cacheKey, arrayBuffer);

        console.log(`✅ [SAMPLES] Bass sample cached: ${cacheKey} from ${sampleString} string, fret ${fret}`, {
          bufferSizeKB: Math.round(arrayBuffer.byteLength / 1024),
        });

        return { midiNote, sampleString, success: true, cached: false, size: arrayBuffer.byteLength };

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to cache bass sample ${midiNote} from ${sampleString}:`, error);
        return { midiNote, sampleString, success: false, error: errorMsg };
      }
    });

    // Execute all downloads in parallel
    const results = await Promise.allSettled(downloadTasks);

    // Process results
    let loaded = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          loaded++;
        } else {
          failed++;
          errors.push(result.value.error || 'Unknown error');
        }
      } else {
        failed++;
        errors.push(result.reason?.message || 'Promise rejected');
      }
    }

    // Final progress update
    this.onProgressCallback?.(loaded, sampleRequests.length);

    const duration = performance.now() - startTime;

    console.log('✅ [SAMPLES] Bass samples downloaded with STRING INFO in PARALLEL', {
      timestamp: new Date().toISOString(),
      durationMs: duration.toFixed(2),
      loaded,
      failed,
      total: sampleRequests.length,
      successRate: `${Math.round((loaded / sampleRequests.length) * 100)}%`,
    });

    logger.info('✅ Bass samples cached with STRING INFO (PARALLEL)', {
      duration: `${duration.toFixed(2)}ms`,
      loaded,
      failed,
      total: sampleRequests.length,
    });

    return {
      success: failed === 0,
      loaded,
      failed,
      errors,
    };
  }

  /**
   * Decode cached ArrayBuffers WITH STRING INFO and inject into PlaybackEngine
   * Called when AudioContext becomes available
   */
  private async decodeAndInjectBuffersWithStrings(
    sampleRequests: SampleRequest[],
    audioContext: AudioContext,
    coreServices: any,
  ): Promise<void> {
    logger.info('🎸 Decoding bass ArrayBuffers with STRING INFO', {
      noteCount: sampleRequests.length,
      contextState: audioContext.state,
      sampleRate: audioContext.sampleRate,
    });

    const buffers: Record<string, AudioBuffer> = {};
    let decoded = 0;

    for (const request of sampleRequests) {
      const { midiNote, sampleString } = request;
      try {
        const cacheKey = `bass-${midiNote}`;

        // Get raw ArrayBuffer from cache
        const rawBuffer = await GlobalSampleCache.getInstance().getCachedRawBuffer(cacheKey);

        if (!rawBuffer) {
          logger.warn(`No cached ArrayBuffer for bass sample ${midiNote} (${sampleString} string)`);
          continue;
        }

        // Decode with real AudioContext
        const bufferCopy = rawBuffer.slice(0);
        const audioBuffer = await audioContext.decodeAudioData(bufferCopy);

        // Store with MIDI note as key (string)
        buffers[String(midiNote)] = audioBuffer;
        decoded++;

        console.log(`🎸 [DECODE] Decoded bass sample MIDI ${midiNote} from ${sampleString} string`);

      } catch (error) {
        logger.error(`Failed to decode bass sample ${midiNote} (${sampleString}):`, error);
      }
    }

    // Inject buffers into PlaybackEngine
    if (decoded > 0) {
      const playbackEngine = coreServices.getPlaybackEngine?.();
      if (playbackEngine) {
        playbackEngine.setBassBuffers(buffers, audioContext.destination);

        logger.info('✅ Bass AudioBuffers decoded with STRING INFO and injected', {
          decodedCount: decoded,
          totalRequested: sampleRequests.length,
          bufferKeys: Object.keys(buffers),
        });
      } else {
        logger.warn('PlaybackEngine not available - buffers decoded but not injected');
      }
    }
  }
}
