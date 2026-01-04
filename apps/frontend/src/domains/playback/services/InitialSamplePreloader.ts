/**
 * Initial Sample Preloader
 *
 * Preloads and decodes audio samples on page load using OfflineAudioContext
 * to avoid any delays when user clicks play. This runs before any user
 * interaction is required.
 */

import { GlobalSampleCache } from '../modules/storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton.js';
import {
  getPreloadableRegistry,
  type InstrumentConfig,
} from './core/PreloadableInstrumentRegistry.js';
import {
  protectedSampleFetch,
  isSampleLoadingAvailable,
} from './core/SampleLoadingCircuitBreaker.js';
import { FALLBACK_KIT_PATH as FALLBACK_DRUM_KIT_PATH, DEFAULT_KIT_SAMPLES } from '@/domains/playback/data/drums/index.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger';
import { DEFAULT_HARMONY_INSTRUMENT } from '@/domains/playback/constants';

// Instrument configs with perNoteVelocityRanges for accurate velocity layer selection
import wurlitzerConfig from '@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json';
import grandPianoConfig from '@/domains/playback/data/instruments/piano/grand-piano.json';
import rhodesConfig from '@/domains/playback/data/instruments/rhodes/rhodes-piano.json';

const logger = getLogger('InitialSamplePreloader');

interface _PreloadConfig {
  drums: {
    pad: number;
    file: string;
    name: string;
  }[];
  harmony: string[];
  bass?: string[];
}

export class InitialSamplePreloader {
  private static instance: InitialSamplePreloader;
  private isPreloading = false;
  private preloadComplete = false;
  private harmonyInstrument: any = null; // WamKeyboard instance
  private _drumInstrument: any = null; // WamDrummer instance

  // 🆕 DEDUPLICATION: Track in-flight loading requests per instrument
  // Prevents duplicate loads when user rapidly switches exercises
  private loadingPromises = new Map<string, Promise<any>>();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): InitialSamplePreloader {
    if (!InitialSamplePreloader.instance) {
      InitialSamplePreloader.instance = new InitialSamplePreloader();
    }
    return InitialSamplePreloader.instance;
  }

  /**
   * Check if preloading is complete
   */
  isComplete(): boolean {
    return this.preloadComplete;
  }

  /**
   * Load only essential samples for basic functionality
   * Called on first user interaction (like scroll)
   * IMPORTANT: This should NOT start AudioContext, only download samples
   */
  async loadEssentialSamples(): Promise<void> {
    if (this.isPreloading) {
      logger.info('⏭️ Essential sample loading already in progress');
      return;
    }

    logger.info(
      '🚀 Phase 2: Registering instrument configurations (no AudioContext required)...',
    );

    this.isPreloading = true;

    try {
      // Register instrument configurations that can be instantiated later
      await Promise.all([
        this.registerVoiceCueConfig(), // Register voice cue config (first for countdown)
        this.registerHarmonyConfig(), // Register harmony instrument config
        this.registerDrumConfig(), // Register drum instrument config
        this.registerMetronomeConfig(), // Register metronome instrument config
      ]);

      // CRITICAL: CoreServices is now GUARANTEED to exist
      // ScrollTriggerLoader ensures CoreServices.preInitialize() runs first
      // Use WindowRegistry to access CoreServices (supports both new and legacy keys)
      const { WindowRegistry } = await import('./WindowRegistry.js');
      const coreServices = WindowRegistry.getCoreServices();

      if (!coreServices) {
        // This should NEVER happen now, but adding defensive check
        logger.error(
          '❌ CRITICAL: CoreServices not found! This indicates a bug in initialization sequence.',
        );
        throw new Error(
          'CoreServices must be initialized before loadEssentialSamples()',
        );
      }

      const audioEngine = coreServices.getAudioEngine();

      // Check if AudioEngine is ready (AudioContext may not be created yet - that requires user gesture)
      if (audioEngine?.isReady?.()) {
        try {
          const context = audioEngine.getContext();
          if (context?.state === 'running') {
            logger.info(
              'AudioContext is running, attempting to create instruments...',
            );
            await Promise.all([
              this.loadEssentialHarmonyInstrument(),
              this.loadEssentialDrumInstrument(),
              this.loadEssentialMetronomeInstrument(),
            ]);
          } else {
            logger.info(
              `AudioContext state: ${context?.state || 'unavailable'}, instruments will be created on demand`,
            );
          }
        } catch (error) {
          logger.info(
            'AudioContext not yet available, instruments will be created on demand',
          );
        }
      } else {
        logger.info(
          'AudioEngine not ready, instruments will be created on demand',
        );
      }

      logger.info('✅ Instrument configurations registered!');

      // Phase 3.1: Set up PlaybackEngine with tracks
      logger.info('🎯 Setting up PlaybackEngine for instant playback...');
      await this.setupRegionProcessorWithTracks();

      // PHASE 2 ENHANCEMENT: Download and cache sample files
      logger.info('📥 Pre-downloading sample files...');
      await this.downloadAndCacheSampleFiles();

      // Log registry status
      const registry = getPreloadableRegistry();
      logger.info(
        '📊 PreloadableInstrumentRegistry status:',
        registry.getStatus(),
      );

      // Dispatch events to notify that essential samples are ready
      if (typeof window !== 'undefined') {
        // Set window flag for backward compatibility
        (window as any).__samplesReady = true;

        // Dispatch both events
        window.dispatchEvent(new Event('essentialSamplesReady'));
        window.dispatchEvent(new Event('samplesReady')); // GlobalControls waits for this

        logger.info(
          '✅ Dispatched samplesReady and essentialSamplesReady events',
        );
      }
    } catch (error) {
      logger.error('❌ Failed to register instrument configs:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load exercise-specific samples using FAANG MIDI-based smart loading
   * Called when ExerciseSelector becomes visible
   * @param exercise - Exercise to load samples for (uses MIDI files to determine required samples)
   * @param options.skipBufferInjection - If true, only cache samples without injecting into PlaybackEngine
   *                                      Use this for background preloading to avoid race conditions
   */
  async loadFullSamples(
    exercise?: any,
    options?: { skipBufferInjection?: boolean },
  ): Promise<any> {
    const skipBufferInjection = options?.skipBufferInjection ?? false;

    logger.info('🚀 Phase 3: FAANG MIDI-based smart sample loading...', {
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      hasHarmonyMidi: !!exercise?.harmonyMidiUrl,
      hasDrummerMidi: !!exercise?.drummerMidiUrl,
      hasBasslineMidi: !!exercise?.basslineMidiUrl,
      harmonyInstrument: exercise?.harmonyInstrument,
      skipBufferInjection,
    });

    // 🆕 DEDUPLICATION: Check if already loading this instrument
    const instrument = exercise?.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT;
    const loadingKey = `harmony-${instrument}`;

    if (this.loadingPromises.has(loadingKey)) {
      logger.info(
        'Samples already loading for instrument, waiting for completion:',
        {
          instrument,
        },
      );
      // Return existing promise to avoid duplicate loads
      return this.loadingPromises.get(loadingKey);
    }

    // Create loading promise and store it
    const loadingPromise = this.executeLoadFullSamples(
      exercise,
      instrument,
      loadingKey,
      skipBufferInjection,
    );
    this.loadingPromises.set(loadingKey, loadingPromise);

    try {
      const result = await loadingPromise;
      return result; // 🆕 CRITICAL: Return the result to caller
    } finally {
      // Clean up after loading completes (success or failure)
      this.loadingPromises.delete(loadingKey);
    }
  }

  /**
   * Load all samples for a tutorial
   * Analyzes all exercises in tutorial and loads all required samples upfront
   * This eliminates loading delays when switching between exercises
   *
   * @param exercises - Array of exercises in the tutorial
   * @param tutorialId - Tutorial ID (for logging)
   */
  async loadTutorialSamples(
    exercises: any[],
    tutorialId?: string,
  ): Promise<void> {
    logger.info('🎯 Tutorial-level sample loading started', {
      tutorialId,
      exerciseCount: exercises.length,
    });

    // Analyze all exercises to determine required samples
    const requiredSamples = this.analyzeTutorialSamples(exercises);

    logger.info('📊 Tutorial sample analysis complete', {
      tutorialId,
      uniqueInstruments: Object.keys(requiredSamples.harmony).length,
      totalHarmonyNotes: Object.values(requiredSamples.harmony).reduce(
        (sum: number, notes: any) => sum + notes.length,
        0,
      ),
      hasBass: requiredSamples.bassExercises.length > 0,
      bassExerciseCount: requiredSamples.bassExercises.length,
      hasDrums: requiredSamples.drums,
    });

    try {
      // Load all samples in parallel
      const loadingTasks = [];

      // Load harmony samples for each instrument used in tutorial
      // CRITICAL: Pass skipBufferInjection=true to prevent overwriting active instrument's buffers
      // Tutorial loading should ONLY cache samples, HarmonyWidget is responsible for buffer injection
      for (const [instrument, notes] of Object.entries(
        requiredSamples.harmony,
      )) {
        if (notes.length > 0) {
          loadingTasks.push(
            this.loadHarmonyForInstrument(
              instrument,
              notes as { pitch: number; velocity: number }[],
              true,
            ),
          );
        }
      }

      // Load bass samples for each exercise that has bass notes
      // Bass samples come from exercise.notes (fretboard data stored in database)
      for (const exercise of requiredSamples.bassExercises) {
        loadingTasks.push(this.loadBassSamplesForExercise(exercise));
      }

      // Load drums, metronome, voice cues (essential for all exercises)
      loadingTasks.push(this.loadEssentialSamples());

      // Wait for all samples to load
      await Promise.all(loadingTasks);

      logger.info('✅ Tutorial samples loaded successfully', {
        tutorialId,
        exerciseCount: exercises.length,
      });

      this.preloadComplete = true;
    } catch (error) {
      logger.error('❌ Failed to load tutorial samples:', error);
      throw error;
    }
  }

  /**
   * Analyze all exercises in a tutorial to determine which samples are needed
   * Returns a manifest of all unique samples required across all exercises
   *
   * FIX: Now preserves full harmonyNotes (including velocities) instead of just pitches
   * This ensures correct velocity layers are preloaded for each note
   */
  private analyzeTutorialSamples(exercises: any[]): {
    harmony: Record<string, { pitch: number; velocity: number }[]>; // instrument -> notes with velocities
    bassExercises: any[]; // exercises that have bass notes
    drums: boolean; // always true
  } {
    const manifest: {
      harmony: Record<string, Map<string, { pitch: number; velocity: number }>>;
      bassExercises: any[];
      drums: boolean;
    } = {
      harmony: {},
      bassExercises: [],
      drums: true,
    };

    // Analyze each exercise
    for (const exercise of exercises) {
      // Extract harmony notes WITH velocities
      if (exercise.harmonyNotes && exercise.harmonyNotes.length > 0) {
        const instrument = exercise.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT;

        if (!manifest.harmony[instrument]) {
          manifest.harmony[instrument] = new Map();
        }

        // Extract notes with velocities, keeping highest velocity per pitch
        // (different velocities map to different layers, we need to load the correct layer)
        for (const note of exercise.harmonyNotes) {
          if (note.pitch) {
            const key = `${note.pitch}-${note.velocity}`;
            // Store unique pitch+velocity combinations to load correct layers
            if (!manifest.harmony[instrument].has(key)) {
              manifest.harmony[instrument].set(key, {
                pitch: note.pitch,
                velocity: note.velocity || 80, // Default velocity if missing
              });
            }
          }
        }
      }

      // Check if exercise has bass notes (stored in exercise.notes array)
      if (exercise.notes && exercise.notes.length > 0) {
        // Check if any notes are on bass strings (1-5 for 5-string bass)
        const hasBassNotes = exercise.notes.some(
          (note: any) => note.string >= 1 && note.string <= 5
        );
        if (hasBassNotes) {
          manifest.bassExercises.push(exercise);
        }
      }
    }

    // Convert Maps to Arrays for easier handling
    const result: {
      harmony: Record<string, { pitch: number; velocity: number }[]>;
      bassExercises: any[];
      drums: boolean;
    } = {
      harmony: {},
      bassExercises: manifest.bassExercises,
      drums: manifest.drums,
    };

    for (const [instrument, noteMap] of Object.entries(manifest.harmony)) {
      result.harmony[instrument] = Array.from(noteMap.values());
    }

    return result;
  }

  /**
   * Load harmony samples for a specific instrument
   * @param notes - Array of notes with pitch and velocity (from analyzeTutorialSamples)
   * @param skipBufferInjection - If true, only cache samples without injecting into PlaybackEngine
   *                              Used for background tutorial preloading to avoid overwriting active instrument
   *
   * FIX: Now uses actual exercise velocities instead of hardcoded 1/127
   * This ensures the correct velocity layers are preloaded for each note
   */
  private async loadHarmonyForInstrument(
    instrument: string,
    notes: { pitch: number; velocity: number }[],
    skipBufferInjection: boolean = false,
  ): Promise<void> {
    logger.info(`Loading harmony samples for ${instrument}`, {
      noteCount: notes.length,
      notes: notes.slice(0, 10), // Log first 10 notes
      skipBufferInjection,
    });

    // Create a mock exercise with the required notes
    // This allows us to reuse the existing HarmonyPreloadStrategy
    // FIX: Use actual velocities from exercise data to load correct layers
    const mockExercise = {
      harmonyInstrument: instrument,
      harmonyNotes: notes.map((note) => ({
        pitch: note.pitch,
        velocity: note.velocity,
        time: 0,
        duration: 1,
      })),
    };

    // Use existing loadFullSamples logic
    await this.executeLoadFullSamples(
      mockExercise,
      instrument,
      `tutorial-${instrument}`,
      skipBufferInjection,
    );
  }

  /**
   * Load bass samples for a specific exercise
   * Uses exercise.notes (fretboard data from database)
   */
  private async loadBassSamplesForExercise(exercise: any): Promise<void> {
    logger.info('🎸 Loading bass samples for exercise', {
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      noteCount: exercise?.notes?.length ?? 0,
    });

    try {
      const { BassPreloadStrategy } = await import(
        '../modules/preloading/strategies/BassPreloadStrategy.js'
      );
      const bassStrategy = new BassPreloadStrategy();

      const bassResult = await bassStrategy.loadFullSamples(undefined, exercise);

      if (bassResult.success) {
        logger.info('✅ Bass FAANG smart loading complete', {
          exerciseId: exercise?.id,
          samplesLoaded: bassResult.loaded,
          savingsVsFullLoad:
            bassResult.loaded > 0
              ? `${Math.round((1 - bassResult.loaded / 110) * 100)}%`
              : 'N/A',
        });
      } else {
        logger.warn('⚠️ Bass sample loading completed with warnings', {
          exerciseId: exercise?.id,
          error: bassResult.error,
        });
      }
    } catch (error) {
      logger.error('❌ Failed to load bass samples', error as Error);
    }
  }

  /**
   * Internal method that actually performs the sample loading
   * Extracted to enable deduplication in loadFullSamples
   * @param skipBufferInjection - If true, only cache samples without injecting into PlaybackEngine
   */
  private async executeLoadFullSamples(
    exercise: any,
    _instrument: string,
    _loadingKey: string,
    skipBufferInjection: boolean = false,
  ): Promise<void> {
    try {
      // FAANG SOLUTION: Use HarmonyPreloadStrategy with exercise data
      // This will extract notes from MIDI and load ONLY required samples
      const { HarmonyPreloadStrategy } =
        await import('../modules/preloading/strategies/HarmonyPreloadStrategy.js');
      const harmonyStrategy = new HarmonyPreloadStrategy();

      // Load ONLY harmony samples required by exercise MIDI file
      const harmonyResult = await harmonyStrategy.loadFullSamples(
        undefined,
        exercise,
      );

      if (harmonyResult.success) {
        logger.info('✅ Harmony FAANG smart loading complete', {
          samplesLoaded: harmonyResult.loaded,
          savingsVsFullLoad:
            harmonyResult.loaded > 0
              ? `${Math.round((1 - harmonyResult.loaded / 120) * 100)}%`
              : 'N/A',
        });

        // NOTE: Bass samples are now loaded through loadBassSamplesForExercise()
        // which uses exercise.notes (fretboard data from database) instead of MIDI files

        // CRITICAL: Inject harmony buffers into PlaybackEngine immediately after loading
        // This enables direct AudioBufferSourceNode scheduling for instant stop functionality
        // RACE CONDITION FIX: Skip injection for background preloading to avoid overwriting active instrument
        if (skipBufferInjection) {
          logger.info(
            '⏭️ Skipping buffer injection (background preload mode)',
            {
              instrument: exercise?.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT,
              exerciseId: exercise?.id,
            },
          );
          // Return early - samples are cached but not injected
          return;
        }

        try {
          // ✅ FIX: Use WindowRegistry key instead of legacy __globalCoreServices
          const coreServices =
            (window as any).__bassnotion_coreServices ||
            (window as any).__globalCoreServices;

          if (!coreServices) {
            logger.warn(
              '⚠️ CoreServices not initialized yet - harmony buffers will be injected later',
            );
          } else {
            // Phase 3.1: Use PlaybackEngine instead of RegionProcessor
            const playbackEngine = coreServices.getPlaybackEngine();
            if (!playbackEngine) {
              logger.warn(
                '⚠️ PlaybackEngine not available - harmony buffers will be injected later',
              );
              return;
            }
            const sampleCache = GlobalSampleCache.getInstance();

            // Get the instrument that was just preloaded
            // FIX: Use shared constant to ensure consistency with HarmonyPreloadStrategy
            const instrument = exercise?.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT;

            const harmonyBuffers = new Map<string, AudioBuffer>();

            // ✅ FIX: Get actually cached keys instead of iterating through all possibilities
            // This matches what HarmonyWidget does (line 1414)
            const allCachedKeys = Array.from(
              (sampleCache as any).samples?.keys() || [],
            );
            const harmonyCachedKeys = allCachedKeys.filter((key) =>
              key.startsWith(`${instrument}-`),
            );

            // Get audioContext for decoding raw buffers from CoreServices
            const audioEngine = coreServices.getAudioEngine();
            const audioContext = audioEngine.getContext();

            let buffersFound = 0;

            // Iterate only through actually cached keys
            for (const cacheKey of harmonyCachedKeys) {
              // ✅ FIX: Try decoded buffer first, fallback to raw buffer + decode
              let buffer = sampleCache.getCachedBuffer(cacheKey);

              if (!buffer) {
                // Buffer not decoded yet - get raw ArrayBuffer and decode it
                const rawBuffer =
                  await sampleCache.getCachedRawBuffer(cacheKey);
                if (rawBuffer && audioContext) {
                  try {
                    buffer = await audioContext.decodeAudioData(
                      rawBuffer.slice(0),
                    );
                    // Cache the decoded buffer for next time
                    await sampleCache.cacheBuffer(cacheKey, buffer, {
                      isContextCompatible: true,
                    });
                  } catch (error) {
                    logger.error(`Failed to decode buffer ${cacheKey}`, error as Error);
                  }
                }
              }

              if (buffer) {
                // Convert 'wurlitzer-v3-C4' to 'v3-C4' for PlaybackEngine
                // Remove the instrument prefix to get the layer-note format
                const keyWithoutPrefix = cacheKey.replace(`${instrument}-`, '');
                harmonyBuffers.set(keyWithoutPrefix, buffer);
                buffersFound++;
              }
            }

            if (buffersFound > 0 && playbackEngine) {
              // audioContext already obtained above before the loop
              // Phase 3.1: Use PlaybackEngine.setHarmonyBuffers()
              // FIX: Pass perNoteVelocityRanges from instrument config for accurate velocity layer selection
              const instrumentConfigs: Record<string, any> = {
                wurlitzer: wurlitzerConfig,
                grandpiano: grandPianoConfig,
                rhodes: rhodesConfig,
              };
              const perNoteVelocityRanges = instrumentConfigs[instrument]?.perNoteVelocityRanges;

              playbackEngine.setHarmonyBuffers(
                harmonyBuffers,
                audioContext.destination,
                perNoteVelocityRanges, // Accurate per-note velocity ranges from instrument config
                instrument, // instrumentName - CRITICAL for correct sample playback
              );
              logger.info('✅ Harmony buffers injected into PlaybackEngine', {
                instrument,
                buffersInjected: buffersFound,
                cachedKeys: harmonyCachedKeys.length,
                hasPerNoteVelocityRanges: !!perNoteVelocityRanges,
              });
            } else {
              logger.warn('⚠️ No harmony buffers available for injection', {
                instrument,
                buffersFound,
              });
            }
          }
        } catch (error) {
          logger.error(
            'Failed to inject harmony buffers into PlaybackEngine',
            error as Error,
          );
        }

        // CRITICAL FIX: Inject voice cue buffers into PlaybackEngine
        // Voice cue samples are preloaded (lines 1518-1533) but were never injected
        try {
          const coreServices =
            (window as any).__bassnotion_coreServices ||
            (window as any).__globalCoreServices;

          if (coreServices) {
            // Phase 3.1: Use PlaybackEngine instead of RegionProcessor
            const playbackEngine = coreServices.getPlaybackEngine();
            const sampleCache = GlobalSampleCache.getInstance();
            const audioEngine = coreServices.getAudioEngine();
            const audioContext = audioEngine.getContext();

            if (playbackEngine && audioContext) {
              const voiceCueBuffers = new Map<string, AudioBuffer>();
              const cueNames = ['one', 'two', 'three', 'four'];

              for (const cueName of cueNames) {
                const cacheKey = `voice-cue-${cueName}`;

                // Try decoded buffer first, fallback to raw buffer + decode
                let buffer = sampleCache.getCachedBuffer(cacheKey);

                if (!buffer) {
                  // Buffer not decoded yet - get raw ArrayBuffer and decode it
                  const rawBuffer =
                    await sampleCache.getCachedRawBuffer(cacheKey);
                  if (rawBuffer && audioContext) {
                    try {
                      buffer = await audioContext.decodeAudioData(
                        rawBuffer.slice(0),
                      );
                      // Cache the decoded buffer for next time
                      await sampleCache.cacheBuffer(cacheKey, buffer, {
                        isContextCompatible: true,
                      });
                    } catch (error) {
                      logger.error(`Failed to decode voice cue ${cacheKey}`, error as Error);
                    }
                  }
                }

                if (buffer) {
                  // Map 'voice-cue-one' to 'one' for PlaybackEngine
                  voiceCueBuffers.set(cueName, buffer);
                }
              }

              if (voiceCueBuffers.size > 0 && playbackEngine) {
                // Phase 3.1: Use PlaybackEngine.setVoiceCueBuffers()
                // Convert Map<string, AudioBuffer> to Record<string, AudioBuffer>
                // Fix: Object.entries(Map) returns [] - must convert to plain object
                const voiceCueRecord: Record<string, AudioBuffer> = {};
                voiceCueBuffers.forEach((buffer, key) => {
                  voiceCueRecord[key] = buffer;
                });

                playbackEngine.setVoiceCueBuffers(
                  voiceCueRecord,
                  audioContext.destination,
                );
                logger.info(
                  '✅ Voice cue buffers injected into PlaybackEngine',
                  {
                    buffersInjected: Object.keys(voiceCueRecord).length,
                    bufferKeys: Object.keys(voiceCueRecord),
                  },
                );
              } else {
                logger.warn('⚠️ No voice cue buffers available for injection');
              }
            }
          }
        } catch (error) {
          logger.error(
            'Failed to inject voice cue buffers into PlaybackEngine',
            error as Error,
          );
        }
      } else {
        logger.warn('⚠️ Harmony sample loading completed with warnings', {
          error: harmonyResult.error,
        });
      }

      // Note: Bass loading is now handled earlier in this function (before skipBufferInjection check)
      // to ensure bass samples are cached even in background preload mode

      this.preloadComplete = true;

      // Log final cache stats
      const stats = GlobalSampleCache.getInstance().getStats();
      logger.info('📊 Final GlobalSampleCache stats:', {
        instruments: stats.instrumentsCount,
        samples: stats.samplesCount,
        totalCached: stats.totalSize,
      });

      // Dispatch event to notify that all samples are ready
      if (typeof window !== 'undefined') {
        (window as any).__samplesPreloaded = true;
        window.dispatchEvent(new Event('samplesPreloaded'));
      }

      return harmonyResult;
    } catch (error) {
      logger.error('Failed to load exercise samples', error as Error);
      throw error;
    }
  }

  /**
   * Start preloading samples immediately on page load
   * Uses OfflineAudioContext which doesn't require user gesture
   * @deprecated Use loadEssentialSamples() and loadFullSamples() instead
   */
  async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadComplete) {
      logger.info('⏭️ Sample preloading already started or complete');
      return;
    }

    logger.info(
      '🚀 Starting initial sample preloading (no user gesture required)...',
    );
    this.isPreloading = true;

    try {
      // Create OfflineAudioContext for decoding (no user gesture needed)
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);

      // Preload in parallel
      await Promise.all([
        this.preloadDrumSamples(offlineContext),
        this.preloadHarmonySamples(offlineContext),
        // Add bass samples when implemented
      ]);

      this.preloadComplete = true;
      logger.info('✅ Initial sample preloading complete!');

      // Dispatch event to notify that samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('samplesPreloaded'));
      }
    } catch (error) {
      logger.error('❌ Failed to preload samples:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load only essential harmony samples (v10 layer, critical notes)
   */
  /**
   * Create harmony instrument and load essential samples
   * This creates the WamKeyboard instance with initial samples
   */
  private async loadEssentialHarmonyInstrument(): Promise<void> {
    logger.info('🎹 Creating harmony instrument with essential samples...');

    try {
      // Step 1: Check if CoreServices are available
      // After Bug #1 fix, CoreServices MUST exist (ScrollTriggerLoader creates it first)
      const { WindowRegistry } = await import('../services/WindowRegistry.js');
      const coreServices = WindowRegistry.getCoreServices();

      if (!coreServices) {
        const error = new Error(
          'CRITICAL: CoreServices must be pre-initialized before loadEssentialSamples(). ' +
            'This indicates Bug #1 (Race Condition) was not properly fixed. ' +
            'ScrollTriggerLoader should create CoreServices before calling this method.',
        );
        logger.error('❌ CoreServices not found:', error);
        throw error;
      }

      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.warn(
          'AudioEngine not ready yet, will retry after initialization',
        );
        // Return early - samples will load on-demand when needed
        return;
      }

      // Step 3: Get AudioContext from AudioEngine - this is now persistent!
      const context = audioEngine.getContext();
      logger.info(`🎹 Phase 2 - AudioContext check:`, {
        hasContext: !!context,
        contextState: context?.state,
        contextType: context?.constructor?.name,
        isOffline: context instanceof OfflineAudioContext,
      });

      if (!context || context.state !== 'running') {
        logger.warn(
          `AudioContext state: ${context?.state || 'null'}, cannot load samples yet. ` +
            `Samples will load on-demand when AudioContext is running.`,
        );
        // Return early - don't use OfflineContext fallback!
        // Samples will be loaded later when user clicks play and AudioContext is running
        return;
      }

      // Step 4: Create WamKeyboard instance through singleton
      logger.info(
        'AudioContext is running! Creating WamKeyboard instance for preloading...',
      );
      this.harmonyInstrument =
        await wamPluginSingleton.getOrCreateKeyboardPlugin(context);

      // Connect to destination if needed
      if (
        this.harmonyInstrument.audioNode &&
        !this.harmonyInstrument.audioNode.isConnected
      ) {
        this.harmonyInstrument.audioNode.connect(context.destination);
        logger.info('Connected harmony instrument to destination');
      }

      // The WamKeyboard will load its default samples automatically
      logger.info(
        '🎹 Harmony instrument created, samples downloading in background...',
      );

      // Store in global cache immediately so widgets can access it
      GlobalSampleCache.getInstance().cacheInstrument(
        'harmony-preloaded',
        this.harmonyInstrument,
      );
      logger.info(
        '✅ Instrument cached in GlobalSampleCache as "harmony-preloaded"',
      );

      // Start monitoring download progress but DON'T WAIT
      // This allows scroll trigger to complete quickly while downloads continue
      if (
        this.harmonyInstrument.audioNode &&
        this.harmonyInstrument.audioNode.hasInstrumentLoaded()
      ) {
        // Monitor v10 layer specifically since it's needed for test button
        setTimeout(async () => {
          const audioNode = this.harmonyInstrument.audioNode;
          if (audioNode.activeSampler) {
            const sampler = audioNode.activeSampler;
            if (sampler.samplers && sampler.samplers.has('v10')) {
              const v10Sampler = sampler.samplers.get('v10');
              if (v10Sampler && v10Sampler.loaded) {
                try {
                  await v10Sampler.loaded;
                  logger.info(
                    '✅ Priority layer v10 loaded - test button ready!',
                  );
                } catch {
                  logger.debug('v10 layer still loading...');
                }
              }
            }
          }
        }, 100); // Check after 100ms
      }
    } catch (error) {
      logger.error('Failed to create harmony instrument:', error);
      // Don't fall back to OfflineContext - samples will load on-demand
      // This prevents Bug #2 (OfflineContext buffer incompatibility)
      logger.warn('Harmony samples will load on-demand when needed');
    }
  }

  private async loadEssentialHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Loading essential harmony samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Load v10 (medium velocity) layer with ALL notes
      const layer = 'v10';
      const essentialNotes = [
        'A0',
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
        'C8',
      ];

      const loadPromises = essentialNotes.map(async (note) => {
        const path = `Keyboards/salamander/${layer}/${note}.mp3`;
        const url = supabase.storage.from('audio-samples').getPublicUrl(path)
          .data.publicUrl;

        // Cache URL
        GlobalSampleCache.getInstance().cacheUrl(path, url);
        GlobalSampleCache.getInstance().cacheUrl(`piano-${layer}-${note}`, url);

        try {
          // Use circuit breaker protected fetch with 10s timeout
          const response = await protectedSampleFetch(
            url,
            `harmony-${note}-${layer}`,
          );

          const arrayBuffer = await response.arrayBuffer();

          // Just verify we can decode it, but don't cache the buffer
          // because it's decoded with OfflineAudioContext, not Tone's context
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // Only the URL is cached above
          // GlobalSampleCache.cacheBuffer(path, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

          logger.info(
            `  ✓ Essential harmony: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load essential ${note}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Essential harmony samples loaded');
    } catch (error) {
      logger.error('Failed to load essential harmony samples:', error);
    }
  }

  /**
   * Load essential drum samples (kick, snare, hihat only)
   */
  /**
   * Create drum instrument and load essential samples
   * This creates Tone.Player instances for kick, snare, and hihat
   */
  private async loadEssentialDrumInstrument(): Promise<void> {
    logger.info('🥁 Creating drum instrument with essential samples...');

    try {
      // Step 1: Check if CoreServices are available
      // After Bug #1 fix, CoreServices MUST exist
      const { WindowRegistry } = await import('../services/WindowRegistry.js');
      const coreServices = WindowRegistry.getCoreServices();

      if (!coreServices) {
        const error = new Error(
          'CRITICAL: CoreServices must be pre-initialized before loadEssentialDrumInstrument().',
        );
        logger.error('❌ CoreServices not found:', error);
        throw error;
      }

      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.warn('AudioEngine not ready, drums will load on-demand');
        return;
      }

      // Step 3: Get Tone.js from AudioEngine first
      const ToneInstance = audioEngine.getTone();
      if (!ToneInstance) {
        logger.warn('Tone.js not available, drums will load on-demand');
        return;
      }

      // Step 4: Use Tone's context to ensure compatibility
      const context = ToneInstance.context;
      if (!context || context.state !== 'running') {
        logger.warn(
          `Tone context state: ${context?.state || 'null'}, drums will load on-demand`,
        );
        return;
      }

      // Step 5: Create drum samplers
      logger.info('AudioContext is running! Creating drum samplers...');
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = FALLBACK_DRUM_KIT_PATH;

      const drumPads: Record<number, any> = {};
      const essentialDrums = [
        { pad: 1, file: DEFAULT_KIT_SAMPLES.kick, name: 'kick' },
        { pad: 3, file: DEFAULT_KIT_SAMPLES.snare, name: 'snare' },
        { pad: 5, file: DEFAULT_KIT_SAMPLES.hihat, name: 'hihat' },
      ];

      // Create Players for each drum
      const loadPromises: Promise<void>[] = [];

      for (const drum of essentialDrums) {
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(`${kitPath}/${drum.file}`).data.publicUrl;

        logger.info(`Loading drum pad ${drum.pad} (${drum.name}): ${url}`);

        // Create a promise that resolves when this drum is loaded
        const loadPromise = new Promise<void>((resolve, reject) => {
          drumPads[drum.pad] = new ToneInstance.Player({
            url,
            volume: -12, // Balanced volume for drum samples
            onload: () => {
              logger.info(`✅ Drum pad ${drum.pad} (${drum.name}) loaded`);
              resolve();
            },
            onerror: (error: any) => {
              logger.error(
                `❌ Failed to load drum pad ${drum.pad} (${drum.name}):`,
                error,
              );
              reject(error);
            },
          }).toDestination();
        });

        loadPromises.push(loadPromise);
      }

      // Wait for all drums to load individually
      try {
        await Promise.all(loadPromises);
        logger.info('✅ All drum samples loaded successfully');
      } catch (error) {
        logger.error('Failed to load some drum samples:', error);
        // Continue anyway - some drums might have loaded
      }

      // Add trigger method for AudioEventRouter compatibility
      drumPads.trigger = function (event: any) {
        const drumName = event.data?.drum || event.drum;
        const drumToPad: Record<string, number> = {
          kick: 1,
          snare: 3,
          hihat: 5,
        };
        const pad = drumToPad[drumName];

        if (pad && this[pad]) {
          try {
            // Stop the previous sound if it's still playing to avoid conflicts
            if (this[pad].state === 'started') {
              this[pad].stop();
            }

            if (event.audioTime !== undefined && event.audioTime > 0) {
              this[pad].start(event.audioTime);
            } else {
              this[pad].start();
            }
          } catch (error) {
            logger.error(`Failed to trigger drum pad ${pad}:`, error);
          }
        } else {
          logger.warn(`No drum pad found for ${drumName} (pad ${pad})`);
        }
      };

      // Store in global cache for widgets to access
      GlobalSampleCache.getInstance().cacheInstrument(
        'drums-preloaded',
        drumPads,
      );
      logger.info('✅ Drums cached in GlobalSampleCache as "drums-preloaded"');

      // Also store for legacy compatibility
      this._drumInstrument = drumPads;
    } catch (error) {
      logger.error('Failed to create drum instrument:', error);
      logger.warn('Drum samples will load on-demand when needed');
    }
  }

  private async loadEssentialDrumSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    const startTime = performance.now();
    logger.info('🥁 Loading essential drum samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = FALLBACK_DRUM_KIT_PATH;

      const essentialDrums = [
        { pad: 1, file: DEFAULT_KIT_SAMPLES.kick, name: 'kick' },
        { pad: 3, file: DEFAULT_KIT_SAMPLES.snare, name: 'snare' },
        { pad: 5, file: DEFAULT_KIT_SAMPLES.hihat, name: 'hihat' },
      ];

      logger.info('📥 Loading essential drum samples:', {
        count: essentialDrums.length,
        drums: essentialDrums.map((d) => d.name),
      });

      const loadPromises = essentialDrums.map(async (sample) => {
        const fullPath = `${kitPath}/${sample.file}`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;

        GlobalSampleCache.getInstance().cacheUrl(fullPath, url);
        GlobalSampleCache.getInstance().cacheUrl(`drum-pad-${sample.pad}`, url);

        try {
          logger.info(`📥 Fetching ${sample.name}...`);
          // Use circuit breaker protected fetch with 10s timeout
          const response = await protectedSampleFetch(
            url,
            `drum-${sample.name}`,
          );

          const arrayBuffer = await response.arrayBuffer();

          // Decode AND cache the buffer - this is what WamDrummer needs!
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // Cache with multiple keys for WamDrummer compatibility
          GlobalSampleCache.getInstance().cacheBuffer(
            `drum-${sample.name}`,
            audioBuffer,
          );
          GlobalSampleCache.getInstance().cacheBuffer(
            `drum-pad-${sample.pad}`,
            audioBuffer,
          );
          logger.info(`✅ ${sample.name} cached`);

          logger.info(
            `  ✓ Essential drum: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load drum ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);

      const duration = performance.now() - startTime;
      logger.info(
        '✅ Essential drum samples loaded and cached as AudioBuffers',
        {
          duration: `${duration.toFixed(2)}ms`,
          samplesLoaded: essentialDrums.length,
          averagePerSample: `${(duration / essentialDrums.length).toFixed(2)}ms`,
          drums: essentialDrums.map((d) => d.name),
        },
      );
    } catch (error) {
      logger.error('Failed to load essential drum samples:', error);
    }
  }

  /**
   * Create metronome instrument and load samples
   * This creates the WamMetronome instance with samples loaded
   */
  private async loadEssentialMetronomeInstrument(): Promise<void> {
    logger.info('🔔 Creating metronome instrument with essential samples...');

    try {
      // Step 1: Check if CoreServices are available
      const { WindowRegistry } = await import('../services/WindowRegistry.js');
      const coreServices = WindowRegistry.getCoreServices();

      if (!coreServices) {
        const error = new Error(
          'CRITICAL: CoreServices must be pre-initialized before loadEssentialMetronomeInstrument(). ' +
            'This indicates Bug #1 (Race Condition) was not properly fixed. ' +
            'ScrollTriggerLoader should create CoreServices before calling this method.',
        );
        logger.error('❌ CoreServices not found:', error);
        throw error;
      }

      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.warn(
          'AudioEngine not ready yet, metronome samples will load on-demand when AudioContext is running',
        );
        return; // Early return - samples will load on-demand
      }

      // Step 3: Get AudioContext from AudioEngine
      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        logger.warn(
          `AudioContext state: ${context?.state || 'null'}, cannot load metronome samples yet. ` +
            `Samples will load on-demand when AudioContext is running.`,
        );
        return; // Early return - samples will load on-demand
      }

      // Step 4: Create WamMetronome instance
      logger.info('AudioContext is running! Creating WamMetronome instance...');
      const { default: WamMetronome } =
        await import('@/domains/playback/modules/instruments/adapters/wam/WamMetronome');

      // Create the metronome plugin
      const metronomePlugin = await WamMetronome.createInstance(context);

      // Create audio node - this will load the default sample
      await metronomePlugin.createAudioNode();

      // Connect to destination
      if (metronomePlugin.audioNode) {
        metronomePlugin.audioNode.connect(context.destination);
        logger.info('Connected metronome to destination');
      }

      // The WamMetronome loads its default sample automatically
      logger.info('✅ Metronome instrument created with samples');

      // Store in global cache for widgets to access
      GlobalSampleCache.getInstance().cacheInstrument(
        'metronome-preloaded',
        metronomePlugin,
      );
      logger.info(
        '✅ Metronome cached in GlobalSampleCache as "metronome-preloaded"',
      );
    } catch (error) {
      logger.error('Failed to create metronome instrument:', error);
      logger.warn('Metronome samples will load on-demand when needed');
    }
  }

  /**
   * Register metronome instrument configuration
   */
  private async registerMetronomeConfig(): Promise<void> {
    logger.info('🔔 Registering metronome instrument configuration...');

    const registry = getPreloadableRegistry();

    const metronomeConfig: InstrumentConfig = {
      type: 'metronome',
      id: 'metronome-default',
      priority: 10,
      factory: async (context: AudioContext) => {
        logger.info('Creating WamMetronome with AudioContext...');
        const { default: WamMetronome } =
          await import('@/domains/playback/modules/instruments/adapters/wam/WamMetronome');

        // Create the metronome plugin
        const metronomePlugin = await WamMetronome.createInstance(context);

        // Create audio node - this will load the default sample
        await metronomePlugin.createAudioNode();

        // Connect to destination
        if (metronomePlugin.audioNode) {
          metronomePlugin.audioNode.connect(context.destination);
          logger.info('Connected metronome to destination');
        }

        return metronomePlugin;
      },
      metadata: {
        name: 'Default Metronome',
        category: 'timing',
        samples: [
          'metronome/Click_low2_fixed.mp3',
          'metronome/Click_high2_fixed.mp3',
        ],
      },
    };

    registry.registerConfig(metronomeConfig);
    logger.info('✅ Metronome config registered');
  }

  /**
   * Register drum instrument configuration
   */
  private async registerDrumConfig(): Promise<void> {
    logger.info('🥁 Registering drum instrument configuration...');

    const registry = getPreloadableRegistry();

    const drumConfig: InstrumentConfig = {
      type: 'drums',
      id: 'drums-default',
      priority: 10,
      factory: async (context: AudioContext, audioEngine: any) => {
        logger.info('Creating drum samplers with AudioContext...');

        // Get Tone.js from AudioEngine
        const ToneInstance = audioEngine.getTone();
        if (!ToneInstance) {
          throw new Error('Tone.js not available from AudioEngine');
        }

        const { supabase } = await import('@/infrastructure/supabase/client');
        const kitPath = FALLBACK_DRUM_KIT_PATH;

        const drumPads: Record<number, any> = {};
        const essentialDrums = [
          { pad: 1, file: DEFAULT_KIT_SAMPLES.kick, name: 'kick' },
          { pad: 3, file: DEFAULT_KIT_SAMPLES.snare, name: 'snare' },
          { pad: 5, file: DEFAULT_KIT_SAMPLES.hihat, name: 'hihat' },
        ];

        // Create Players for each drum
        const loadPromises: Promise<void>[] = [];

        for (const drum of essentialDrums) {
          const url = supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${kitPath}/${drum.file}`).data.publicUrl;

          const loadPromise = new Promise<void>((resolve, reject) => {
            drumPads[drum.pad] = new ToneInstance.Player({
              url,
              volume: -10,
              onload: () => {
                logger.info(`✅ Drum pad ${drum.pad} (${drum.name}) loaded`);
                resolve();
              },
              onerror: (error: any) => {
                logger.error(`❌ Failed to load drum pad ${drum.pad}:`, error);
                reject(error);
              },
            }).toDestination();
          });

          loadPromises.push(loadPromise);
        }

        await Promise.all(loadPromises);
        logger.info('✅ All drum samples loaded');

        // Add trigger method for AudioEventRouter compatibility
        drumPads.trigger = function (event: any) {
          const drumName = event.data?.drum || event.drum;
          const drumToPad: Record<string, number> = {
            kick: 1,
            snare: 3,
            hihat: 5,
          };
          const pad = drumToPad[drumName];

          logger.debug(
            `🥁 Drum trigger: ${drumName} -> pad ${pad}, time: ${event.audioTime}`,
          );

          if (pad && this[pad]) {
            try {
              // Stop the previous sound if it's still playing to avoid conflicts
              if (this[pad].state === 'started') {
                this[pad].stop();
              }

              if (event.audioTime !== undefined && event.audioTime > 0) {
                this[pad].start(event.audioTime);
              } else {
                this[pad].start();
              }
              logger.debug(`✅ Triggered drum pad ${pad} (${drumName})`);
            } catch (error) {
              logger.error(`Failed to trigger drum pad ${pad}:`, error);
            }
          } else {
            logger.warn(`No drum pad found for ${drumName} (pad ${pad})`);
          }
        };

        return drumPads;
      },
      metadata: {
        name: 'Boss DR-110 Kit',
        category: 'drums',
        samples: ['dr110kik.mp3', 'dr110clp.mp3', 'dr110cht.mp3'],
      },
    };

    registry.registerConfig(drumConfig);
    logger.info('✅ Drums config registered');
  }

  /**
   * Register harmony instrument configuration
   */
  private async registerHarmonyConfig(): Promise<void> {
    logger.info('🎹 Registering harmony instrument configuration...');

    const registry = getPreloadableRegistry();

    const harmonyConfig: InstrumentConfig = {
      type: 'harmony',
      id: 'harmony-default',
      priority: 10,
      factory: async (context: AudioContext) => {
        logger.info('Creating WamKeyboard with AudioContext...');
        const harmonyInstrument =
          await wamPluginSingleton.getOrCreateKeyboardPlugin(context);

        // Connect to destination if needed
        if (
          harmonyInstrument.audioNode &&
          !harmonyInstrument.audioNode.isConnected
        ) {
          harmonyInstrument.audioNode.connect(context.destination);
          logger.info('Connected harmony instrument to destination');
        }

        return harmonyInstrument;
      },
      metadata: {
        name: 'Salamander Piano',
        category: 'harmony',
        samples: [], // Will be loaded by WamKeyboard
      },
    };

    registry.registerConfig(harmonyConfig);
    logger.info('✅ Harmony config registered');
  }

  /**
   * Register voice cue instrument configuration
   */
  private async registerVoiceCueConfig(): Promise<void> {
    logger.info('🗣️ Registering voice cue instrument configuration...');

    const registry = getPreloadableRegistry();

    const voiceCueConfig: InstrumentConfig = {
      type: 'voice-cue',
      id: 'voice-cue-default',
      priority: 100, // Highest priority - needed for countdown
      factory: async (context: AudioContext, audioEngine: any) => {
        logger.info('Creating VoiceCueInstrument with AudioContext...');

        const { VoiceCueInstrument } =
          await import('../modules/instruments/implementations/voice-cue/VoiceCueInstrument.js');

        // Get Supabase client to construct URLs
        const { supabase } = await import('@/infrastructure/supabase/client');
        const basePath = 'metronome/Cues';

        // Build sample URLs from Supabase
        const samples = new Map<string, string>();
        const cues = ['one', 'two', 'three', 'four'];

        for (const cue of cues) {
          const url = supabase.storage
            .from('audio-samples')
            .getPublicUrl(`${basePath}/${cue}.ogg`).data.publicUrl;
          samples.set(cue, url);
          logger.info(`Voice cue URL: ${cue} -> ${url}`);
        }

        // Create the voice cue instrument
        const voiceCueInstrument = new VoiceCueInstrument({
          volume: 0.8,
          enabled: true,
        });

        // Initialize with samples and connect to destination
        await voiceCueInstrument.initialize(
          samples,
          context.destination,
          audioEngine,
        );

        logger.info('✅ VoiceCueInstrument created and initialized');

        return voiceCueInstrument;
      },
      metadata: {
        name: 'Voice Countdown Cues',
        category: 'timing',
        samples: [
          'voice-cues/one.mp3',
          'voice-cues/two.mp3',
          'voice-cues/three.mp3',
          'voice-cues/four.mp3',
        ],
      },
    };

    registry.registerConfig(voiceCueConfig);
    logger.info('✅ Voice cue config registered');
  }

  /**
   * Phase 3.1: Set up PlaybackEngine with tracks ready for instant playback
   * This runs during sample preloading without needing AudioContext
   * (Function name retained for backward compatibility during refactor)
   */
  private async setupRegionProcessorWithTracks(): Promise<void> {
    try {
      const coreServices =
        (window as any).__globalCoreServices ||
        (window as any).__coreServices ||
        (window as any).__bassnotion_coreServices;

      if (!coreServices) {
        logger.info(
          'CoreServices not available yet, setup will be done on play',
        );
        return;
      }

      const eventBus = coreServices?.getEventBus?.();
      if (!eventBus) {
        logger.info(
          'EventBus not available yet, PlaybackEngine will be set up on play',
        );
        return;
      }

      // Phase 3.1: Use PlaybackEngine instead of RegionProcessor
      // PlaybackEngine is at 100% rollout, RegionProcessor is legacy
      const playbackEngine = coreServices.getPlaybackEngine();
      if (!playbackEngine) {
        logger.warn(
          'PlaybackEngine not available, skipping buffer pre-configuration',
        );
        return;
      }

      logger.info(
        '✅ Using PlaybackEngine for buffer preloading (Phase 3.1 refactor)',
      );

      // Store configuration for play button to use
      (window as any).__tracksPreConfigured = true;
    } catch (error) {
      logger.error('Failed to setup PlaybackEngine:', error);
    }
  }

  /**
   * Generate standard metronome events in Tone.js format
   */
  private generateMetronomeEvents() {
    const events = [];
    const beatsPerMeasure = 4;
    const totalBeats = 16; // 4 measures (matching typical exercise length)

    for (let beat = 0; beat < totalBeats; beat++) {
      const measure = Math.floor(beat / beatsPerMeasure);
      const beatInMeasure = beat % beatsPerMeasure;
      const isDownbeat = beatInMeasure === 0;

      events.push({
        position: `${measure}:${beatInMeasure}:0`, // Tone.js format: bar:beat:sixteenth
        type: isDownbeat ? 'accent' : 'click',
        velocity: isDownbeat ? 1.0 : 0.8,
        data: {
          beat: beatInMeasure + 1,
          isDownbeat,
        },
      });
    }

    logger.info(
      `Generated ${events.length} metronome events for preloading (4 measures)`,
    );
    return events;
  }

  /**
   * Generate drum pattern events from exercise metadata
   * @param regions - The drum regions from the selected exercise
   */
  private generateDrumEvents(regions?: any[]): any[] {
    // If no regions provided, return empty array (no drum pattern)
    if (!regions || regions.length === 0) {
      logger.info('No drum regions provided, skipping drum event generation');
      return [];
    }

    const events: any[] = [];

    // Convert exercise regions to drum events
    regions.forEach((region) => {
      if (!region.pattern || !region.pattern.events) {
        logger.warn('Drum region missing pattern or events:', region);
        return;
      }

      region.pattern.events.forEach((event: any) => {
        // Map event data from exercise to drum trigger format
        const drumEvent = {
          position:
            event.position ||
            event.time ||
            `${event.measure || 0}:${event.beat || 0}:${event.subdivision || 0}`,
          type: event.type || event.drum || 'kick',
          velocity: event.velocity || 0.7,
          data: {
            drum: event.type || event.drum || event.data?.drum || 'kick',
            ...event.data,
          },
        };
        events.push(drumEvent);
      });
    });

    logger.info(
      `Generated ${events.length} drum events from ${regions.length} exercise regions`,
    );
    if (events.length > 0) {
      logger.debug('Sample drum events:', events.slice(0, 3));
    }

    return events;
  }

  /**
   * Download and cache sample files without creating AudioContext
   */
  private async downloadAndCacheSampleFiles(): Promise<void> {
    const startTime = performance.now();
    logger.info('📥 Pre-downloading sample files...');

    lifecycle.checkpoint('SAMPLE_TYPE_LOADING_START', {
      type: 'essential',
      phase: 'downloadAndCacheSampleFiles',
    });

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      const sampleFiles = [
        // Voice cues (highest priority - needed for countdown)
        {
          path: 'metronome/Cues/one.ogg',
          cacheKeys: ['voice-cue-one'],
        },
        {
          path: 'metronome/Cues/two.ogg',
          cacheKeys: ['voice-cue-two'],
        },
        {
          path: 'metronome/Cues/three.ogg',
          cacheKeys: ['voice-cue-three'],
        },
        {
          path: 'metronome/Cues/four.ogg',
          cacheKeys: ['voice-cue-four'],
        },
        // Metronome clicks
        {
          path: 'metronome/Click_low2_fixed.mp3',
          cacheKeys: ['metronome-low'],
        },
        {
          path: 'metronome/Click_high2_fixed.mp3',
          cacheKeys: ['metronome-high'],
        },
        // Essential drum samples (using admin-uploaded default kit)
        {
          path: `${FALLBACK_DRUM_KIT_PATH}/${DEFAULT_KIT_SAMPLES.kick}`,
          cacheKeys: ['drum-kick', 'drum-pad-1'],
        },
        {
          path: `${FALLBACK_DRUM_KIT_PATH}/${DEFAULT_KIT_SAMPLES.snare}`,
          cacheKeys: ['drum-snare', 'drum-pad-3'],
        },
        {
          path: `${FALLBACK_DRUM_KIT_PATH}/${DEFAULT_KIT_SAMPLES.hihat}`,
          cacheKeys: ['drum-hihat', 'drum-pad-5'],
        },
      ];

      let successCount = 0;

      // Download in parallel
      const downloadPromises = sampleFiles.map(async (sample) => {
        const sampleStartTime = performance.now();
        try {
          // Use first cache key to check IndexedDB
          const primaryCacheKey = sample.cacheKeys[0];

          // CRITICAL: Check IndexedDB cache BEFORE network fetch
          const cachedBuffer =
            await GlobalSampleCache.getInstance().getCachedRawBuffer(
              primaryCacheKey,
            );

          let arrayBuffer: ArrayBuffer;

          if (cachedBuffer) {
            logger.info(`IndexedDB cache HIT: ${sample.path}`);
            lifecycle.checkpoint('SAMPLE_CACHE_HIT', {
              key: primaryCacheKey,
              path: sample.path,
            });
            arrayBuffer = cachedBuffer;
            successCount++;
          } else {
            lifecycle.checkpoint('SAMPLE_CACHE_MISS', {
              key: primaryCacheKey,
              path: sample.path,
            });
            // Not in cache, fetch from network
            const url = supabase.storage
              .from('audio-samples')
              .getPublicUrl(sample.path).data.publicUrl;

            // Cache the URL
            GlobalSampleCache.getInstance().cacheUrl(sample.path, url);

            // Download the file with circuit breaker protection
            logger.info(`📥 Fetching ${sample.path}...`);
            const response = await protectedSampleFetch(
              url,
              `essential-${sample.path}`,
            );

            arrayBuffer = await response.arrayBuffer();

            // BUG #2 FIX: DO NOT decode or cache buffers from OfflineAudioContext!
            // OfflineContext-decoded buffers are incompatible with the real AudioContext.
            // Instead, we just download and cache the raw ArrayBuffer data.
            // The real AudioContext will decode these when needed.

            logger.debug(
              `📦 PRELOADER: Downloaded raw audio data for ${sample.path}:`,
              {
                sizeKB: Math.round(arrayBuffer.byteLength / 1024),
                willCacheWith: sample.cacheKeys,
              },
            );

            // Cache the raw ArrayBuffer with all the keys that instruments will look for
            // The AudioEngine will decode these using the REAL AudioContext when needed
            // PERSISTENT CACHE: Also stores to IndexedDB for cross-session persistence
            for (const key of sample.cacheKeys) {
              logger.debug(
                `📦 PRELOADER: Caching raw ArrayBuffer with key: "${key}"`,
              );
              // Store as ArrayBuffer, not decoded AudioBuffer
              await GlobalSampleCache.getInstance().cacheBuffer(
                key,
                arrayBuffer.slice(0),
              );
            }

            const sampleDuration = performance.now() - sampleStartTime;
            logger.debug(
              `✅ Downloaded and cached: ${sample.path} (${sampleDuration.toFixed(2)}ms)`,
            );
            successCount++;
          }
        } catch (error) {
          logger.warn(`⚠️ Failed to download ${sample.path}:`, error);
        }
      });

      await Promise.all(downloadPromises);

      const totalDuration = performance.now() - startTime;
      logger.info('✅ Sample file downloading completed', {
        duration: `${totalDuration.toFixed(2)}ms`,
        samplesLoaded: successCount,
        samplesTotal: sampleFiles.length,
        averagePerSample: `${(totalDuration / successCount).toFixed(2)}ms`,
      });

      lifecycle.checkpoint('SAMPLE_TYPE_LOADING_COMPLETE', {
        type: 'essential',
        loaded: successCount,
        total: sampleFiles.length,
        durationMs: totalDuration,
      });

      // Mark samples as downloaded
      (window as any).__sampleFilesDownloaded = true;
    } catch (error) {
      logger.error('Failed to download sample files:', error);
    }
  }

  /**
   * Load essential metronome samples (fallback)
   */
  private async loadEssentialMetronomeSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    const startTime = performance.now();
    logger.info('🔔 Loading essential metronome samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      const samples = [
        {
          name: 'click_hi',
          file: 'metronome/Click_high2_fixed.mp3',
          cacheKey: 'metronome-high',
        }, // High pitched
        {
          name: 'click_lo',
          file: 'metronome/Click_low2_fixed.mp3',
          cacheKey: 'metronome-low',
        }, // Low pitched
      ];

      const loadPromises = samples.map(async (sample) => {
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(sample.file).data.publicUrl;

        GlobalSampleCache.getInstance().cacheUrl(sample.file, url);
        GlobalSampleCache.getInstance().cacheUrl(
          `metronome-${sample.name}`,
          url,
        );

        try {
          logger.info(`📥 Fetching ${sample.name}...`);
          // Use circuit breaker protected fetch with 10s timeout
          const response = await protectedSampleFetch(
            url,
            `metronome-${sample.name}`,
          );

          const arrayBuffer = await response.arrayBuffer();

          // Decode AND cache the buffer - this is what WamMetronome needs!
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // Cache with the key that WamMetronome expects
          GlobalSampleCache.getInstance().cacheBuffer(
            sample.cacheKey,
            audioBuffer,
          );
          logger.info(`✅ ${sample.name} cached as '${sample.cacheKey}'`);

          logger.info(
            `  ✓ Essential metronome: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load metronome ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);

      const duration = performance.now() - startTime;
      logger.info(
        '✅ Essential metronome samples loaded and cached as AudioBuffers',
        {
          duration: `${duration.toFixed(2)}ms`,
          samplesLoaded: samples.length,
          averagePerSample: `${(duration / samples.length).toFixed(2)}ms`,
        },
      );
    } catch (error) {
      logger.error('Failed to load essential metronome samples:', error);
    }
  }

  /**
   * Load remaining harmony samples into existing instrument
   * This adds the additional velocity layers for full quality
   */
  private async loadFullHarmonyInstrument(): Promise<void> {
    logger.info('🎹 Loading full harmony samples into instrument...');

    try {
      // Check if we have a pre-created instrument
      if (!this.harmonyInstrument) {
        // Try to get from cache
        this.harmonyInstrument =
          GlobalSampleCache.getInstance().getCachedInstrument(
            'harmony-preloaded',
          );

        if (!this.harmonyInstrument) {
          logger.warn(
            'No harmony instrument found - samples were not preloaded. ' +
              'They will load on-demand when first needed.',
          );
          return; // Early return - samples will load on-demand
        }
      }

      // The instrument already has default samples loaded
      // In phase 3, we don't need to do anything extra as WamKeyboard
      // loads all velocity layers by default
      logger.info('✅ Harmony instrument already has full samples loaded');
    } catch (error) {
      logger.error('Failed to load full harmony samples:', error);
      logger.warn('Full harmony samples will load on-demand when needed');
    }
  }

  /**
   * Load remaining harmony samples for full quality (legacy)
   */
  private async loadFullHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Loading full harmony samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Load remaining velocity layers to match SalamanderVelocitySampler defaults
      // v10 is already loaded in essential, so load v1, v6, v14, v16
      const remainingLayers = ['v1', 'v6', 'v14', 'v16'];

      // Load ALL 30 samples that SalamanderVelocitySampler expects
      const allNotes = [
        'A0',
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
        'C8',
      ];

      const loadPromises: Promise<void>[] = [];

      for (const layer of remainingLayers) {
        for (const note of allNotes) {
          const loadPromise = (async () => {
            const path = `Keyboards/salamander/${layer}/${note}.mp3`;

            // Skip if already cached
            if (GlobalSampleCache.getInstance().getCachedBuffer(path)) {
              return;
            }

            const url = supabase.storage
              .from('audio-samples')
              .getPublicUrl(path).data.publicUrl;

            GlobalSampleCache.getInstance().cacheUrl(path, url);
            GlobalSampleCache.getInstance().cacheUrl(
              `piano-${layer}-${note}`,
              url,
            );

            try {
              // Use circuit breaker protected fetch with 10s timeout
              const response = await protectedSampleFetch(
                url,
                `full-harmony-${note}-${layer}`,
              );

              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await offlineContext.decodeAudioData(
                arrayBuffer.slice(0),
              );

              // DON'T cache the decoded buffer - it won't work with Tone.js!
              // GlobalSampleCache.cacheBuffer(path, audioBuffer);
              // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

              logger.info(
                `  ✓ Full harmony: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
              );
            } catch (error) {
              // Log at warn level - sample may be missing or circuit breaker open
              logger.warn(`Failed to load harmony sample ${note}/${layer}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                note,
                layer,
              });
            }
          })();

          loadPromises.push(loadPromise);
        }
      }

      // Load in batches to avoid overwhelming the browser
      const batchSize = 10;
      for (let i = 0; i < loadPromises.length; i += batchSize) {
        const batch = loadPromises.slice(i, i + batchSize);
        await Promise.all(batch);

        // Use requestIdleCallback if available
        if ('requestIdleCallback' in window) {
          await new Promise((resolve) => requestIdleCallback(resolve));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      logger.info('✅ Full harmony samples loaded');
    } catch (error) {
      logger.error('Failed to load full harmony samples:', error);
    }
  }

  /**
   * Preload drum samples
   * @deprecated Use loadEssentialDrumSamples() instead
   */
  private async preloadDrumSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🥁 Preloading drum samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = FALLBACK_DRUM_KIT_PATH;

      const samples = [
        { pad: 1, file: DEFAULT_KIT_SAMPLES.kick, name: 'kick' },
        { pad: 3, file: DEFAULT_KIT_SAMPLES.snare, name: 'snare' },
        { pad: 5, file: DEFAULT_KIT_SAMPLES.hihat, name: 'hihat' },
      ];

      const loadPromises = samples.map(async (sample) => {
        const fullPath = `${kitPath}/${sample.file}`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;

        // Cache URL
        GlobalSampleCache.getInstance().cacheUrl(fullPath, url);
        GlobalSampleCache.getInstance().cacheUrl(`drum-pad-${sample.pad}`, url);

        try {
          // Use circuit breaker protected fetch with 10s timeout
          const response = await protectedSampleFetch(
            url,
            `preload-drum-${sample.name}`,
          );

          const arrayBuffer = await response.arrayBuffer();

          // Decode using OfflineAudioContext (no user gesture needed)
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // GlobalSampleCache.cacheBuffer(fullPath, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`drum-pad-${sample.pad}`, audioBuffer);

          logger.info(
            `  ✓ Preloaded drum: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to preload drum ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Drum samples preloaded');
    } catch (error) {
      logger.error('Failed to preload drum samples:', error);
    }
  }

  /**
   * Preload harmony/piano samples AND create Tone.js Samplers
   */
  private async preloadHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Preloading harmony samples and creating samplers...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Preload essential piano notes for all 4 velocity layers
      // Salamander piano uses sparse sampling: C, Ds, Fs, A per octave
      const velocityLayers = ['v1', 'v8', 'v10', 'v16']; // pp, mf, f, ff
      const notePatterns = [
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
      ];

      const loadPromises: Promise<void>[] = [];

      // Load samples for each velocity layer
      for (const layer of velocityLayers) {
        for (const note of notePatterns) {
          const loadPromise = (async () => {
            const path = `Keyboards/salamander/${layer}/${note}.mp3`;
            const url = supabase.storage
              .from('audio-samples')
              .getPublicUrl(path).data.publicUrl;

            // Cache URL with layer info
            GlobalSampleCache.getInstance().cacheUrl(path, url);
            GlobalSampleCache.getInstance().cacheUrl(
              `piano-${layer}-${note}`,
              url,
            );

            try {
              // Use circuit breaker protected fetch with 10s timeout
              const response = await protectedSampleFetch(
                url,
                `preload-harmony-${note}-${layer}`,
              );

              const arrayBuffer = await response.arrayBuffer();

              // Decode using OfflineAudioContext (no user gesture needed)
              const audioBuffer = await offlineContext.decodeAudioData(
                arrayBuffer.slice(0),
              );

              // Cache the decoded buffer
              // DON'T cache the decoded buffer - it won't work with Tone.js!
              // GlobalSampleCache.cacheBuffer(path, audioBuffer);
              // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

              logger.info(
                `  ✓ Preloaded piano: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
              );
            } catch (error) {
              // Log at debug level - Salamander doesn't have all notes in all layers
              logger.debug(`Sample not available: ${note}/${layer}`, {
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          })();

          loadPromises.push(loadPromise);
        }
      }

      await Promise.all(loadPromises);
      logger.info('✅ Harmony samples preloaded');
    } catch (error) {
      logger.error('Failed to preload harmony samples:', error);
    }
  }

  /**
   * Get statistics about preloaded samples
   */
  getStats(): {
    isComplete: boolean;
    isPreloading: boolean;
    cacheStats: any; // GlobalSampleCache stats
  } {
    return {
      isComplete: this.preloadComplete,
      isPreloading: this.isPreloading,
      cacheStats: GlobalSampleCache.getInstance().getStats(),
    };
  }

  /**
   * Check if sample loading is available (circuit not open)
   * Call this before starting playback to block if samples unavailable
   */
  canPlayback(): boolean {
    return isSampleLoadingAvailable();
  }

  /**
   * Get circuit breaker status for UI display
   */
  getLoadingStatus(): { available: boolean; message?: string } {
    if (isSampleLoadingAvailable()) {
      return { available: true };
    }
    return {
      available: false,
      message:
        'Audio samples temporarily unavailable. Please try again shortly.',
    };
  }
}

// Export singleton getter
export const getSamplePreloader = () => InitialSamplePreloader.getInstance();

/**
 * Get pre-loaded harmony instrument if available
 */
export function getPreloadedHarmonyInstrument(): any {
  return GlobalSampleCache.getInstance().getCachedInstrument(
    'harmony-preloaded',
  );
}

/**
 * Check if tracks are pre-configured
 */
export function areTracksPreConfigured(): boolean {
  return !!(window as any).__tracksPreConfigured;
}

/**
 * Check if sample files are downloaded
 */
export function areSampleFilesDownloaded(): boolean {
  return !!(window as any).__sampleFilesDownloaded;
}
