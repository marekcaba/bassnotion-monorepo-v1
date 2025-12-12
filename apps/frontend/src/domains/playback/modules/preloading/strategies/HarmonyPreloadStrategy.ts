/**
 * Harmony Preload Strategy
 *
 * Handles preloading of harmony/piano samples
 */

import { PreloadStrategy } from './PreloadStrategy.js';
import { PreloadConfig, PreloadResult } from '../types/index.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton.js';
import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@/domains/exercises/entities/exercise.entity.js';
import grandPianoConfig from '@/domains/playback/data/instruments/piano/grand-piano.json';
import grandPianoKeyboardMap from '@/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json';
import wurlitzerConfig from '@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json';
import rhodesConfig from '@/domains/playback/data/instruments/rhodes/rhodes-piano.json';
import { midiToNoteName } from '@/domains/playback/utils/midiUtils';

const logger = getLogger('HarmonyPreloadStrategy');

/**
 * Velocity range configuration for a specific note
 */
interface VelocityRange {
  min: number;
  max: number;
  layer: string;
}

/**
 * Instrument sample configuration from JSON files
 */
interface InstrumentSampleConfig {
  name: string;
  globalVelocityRanges?: VelocityRange[];
  perNoteVelocityRanges?: Record<string, VelocityRange[]>;
  sampleMapping?: Record<string, string>; // Maps note names to file paths (e.g., "C4" -> "{layer}/C4_{layer}.ogg")
  storage?: {
    baseUrl: string;
    bucketPath: string;
  };
}

export class HarmonyPreloadStrategy implements PreloadStrategy {
  readonly name = 'harmony';
  private harmonyInstrument: any = null;
  private loaded = 0;
  private total = 0;
  private sampleToRequestedNotes: Map<string, Set<string>> = new Map(); // Physical sample → requested notes mapping

  async loadEssentialSamples(_config?: PreloadConfig): Promise<PreloadResult> {
    logger.info('Loading essential harmony samples...');

    try {
      // Check if CoreServices and AudioEngine are available
      const coreServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;

      if (!coreServices) {
        // Use generic essential notes when no exercise data available
        return this.fallbackToGenericSamples();
      }

      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        return this.fallbackToGenericSamples();
      }

      // Get AudioContext from AudioEngine
      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        return this.fallbackToGenericSamples();
      }

      // Create WamKeyboard instance through singleton
      this.harmonyInstrument =
        await wamPluginSingleton.getOrCreateKeyboardPlugin(context);

      // CRITICAL FIX: DO NOT connect to destination during preloading!
      // Connection happens when exercise is actually played (in HarmonyWidget)
      // Connecting here causes double instrument playback when switching exercises
      // because multiple instruments get loaded and connected during preload phase
      // if (
      //   this.harmonyInstrument.audioNode &&
      //   !this.harmonyInstrument.audioNode.isConnected
      // ) {
      //   this.harmonyInstrument.audioNode.connect(context.destination);
      // }

      // Store in global cache
      GlobalSampleCache.getInstance().cacheInstrument(
        'harmony-preloaded',
        this.harmonyInstrument,
      );

      // Essential samples count (v10 layer)
      this.loaded = 24; // Approximate count for essential notes
      this.total = 24;

      logger.info('Essential harmony samples loaded');

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to load essential harmony samples', error);
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
    logger.info(
      '🎹 Optimized harmony sample loading from pre-converted data...',
      {
        exerciseId: exercise?.id,
        exerciseTitle: exercise?.title,
        hasHarmonyNotes:
          !!exercise?.harmonyNotes && exercise.harmonyNotes.length > 0,
        harmonyInstrument: exercise?.harmonyInstrument,
      },
    );

    try {
      // FAANG SOLUTION: Use pre-converted harmonyNotes from database
      // No exercise or no harmony notes = no samples loaded
      if (!exercise?.harmonyNotes || exercise.harmonyNotes.length === 0) {
        logger.info('✅ No harmony notes - skipping harmony sample loading', {
          exerciseId: exercise?.id,
          reason: exercise
            ? 'no harmonyNotes in exercise'
            : 'no exercise provided',
        });

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // 1. Extract unique pitches from pre-converted harmony notes
      const uniquePitches = [
        ...new Set(exercise.harmonyNotes.map((note) => note.pitch)),
      ].sort((a, b) => a - b);

      if (uniquePitches.length === 0) {
        logger.warn('⚠️ No unique pitches found in harmony notes', {
          exerciseId: exercise.id,
        });

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // CHECKPOINT 8: Preload strategy - verify instrument resolution
      // console.log('[DEBUG][Checkpoint-8] HarmonyPreloadStrategy.loadFullSamples:', {
      //   exerciseId: exercise.id,
      //   exerciseTitle: exercise.title,
      //   exerciseHarmonyInstrument: exercise.harmonyInstrument,
      //   hasHarmonyInstrument: !!exercise.harmonyInstrument,
      //   harmonyInstrumentType: typeof exercise.harmonyInstrument,
      //   willResolveAs: exercise.harmonyInstrument || 'grandpiano',
      // });

      // 2. Load instrument configuration to determine per-note velocity ranges
      const instrument = exercise.harmonyInstrument || 'grandpiano';

      // console.log('[DEBUG][Checkpoint-8] Instrument resolved for preloading:', {
      //   instrument,
      //   fromExercise: exercise.harmonyInstrument,
      //   wasDefaulted: !exercise.harmonyInstrument,
      // });

      const instrumentConfig = await this.loadInstrumentConfig(instrument);

      if (!instrumentConfig) {
        logger.error(
          'Failed to load instrument config - cannot determine sample requirements',
        );
        return {
          success: false,
          error: 'Failed to load instrument configuration',
          loaded: 0,
          total: 0,
        };
      }

      // 3. Build smart sample map using per-note velocity configuration
      // For Grand Piano, this uses keyboard-note-map.json to determine which samples to load
      const sampleMap = await this.buildSmartSampleMap(
        exercise,
        instrumentConfig,
        instrument,
      );

      if (sampleMap.size === 0) {
        logger.warn('⚠️ No samples to load after building smart sample map', {
          exerciseId: exercise.id,
        });

        return {
          success: true,
          loaded: 0,
          total: 0,
        };
      }

      // Calculate total samples to load from smart map
      const totalSamplesToLoad = Array.from(sampleMap.values()).reduce(
        (sum, layers) => sum + layers.size,
        0,
      );

      // Analyze velocity range for logging
      const velocities = exercise.harmonyNotes.map((n) => n.velocity);
      const minVelocity = Math.min(...velocities);
      const maxVelocity = Math.max(...velocities);

      logger.info(
        '📊 Exercise data analysis complete - loading optimized samples with per-note config',
        {
          uniqueNotes: sampleMap.size,
          pitchRange: `${uniquePitches[0]} to ${uniquePitches[uniquePitches.length - 1]}`,
          velocityRange: `${minVelocity} to ${maxVelocity}`,
          instrument,
          totalSamplesToLoad,
          optimizationSavings: `${Math.round((1 - totalSamplesToLoad / (88 * 16)) * 100)}%`,
        },
      );

      // CRITICAL FIX: Skip AudioContext retrieval entirely for on-demand loading
      // AudioContext requires user interaction (play button click), but on-demand loading
      // happens automatically when switching exercises (no user interaction yet).
      // Use OfflineAudioContext instead (in fallbackToBufferCaching) which doesn't require user gesture.

      logger.info(
        '🎹 Using buffer caching with OfflineAudioContext (no user interaction required)',
        {
          instrument,
          totalSamplesToLoad,
        },
      );

      return this.fallbackToBufferCaching(sampleMap, instrument);
    } catch (error) {
      logger.error('❌ Failed to load optimized harmony samples', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  /**
   * Determine which velocity layers are required based on min/max velocity
   * This enables loading only necessary sample layers (major optimization)
   */
  private determineVelocityLayers(
    minVelocity: number,
    maxVelocity: number,
    instrument: string,
  ): string[] {
    // Velocity layer configurations matching backend HarmonyMapperService
    const VELOCITY_LAYER_CONFIG: Record<
      string,
      {
        totalLayers: number;
        ranges: Array<{ min: number; max: number; layer: string }>;
      }
    > = {
      salamander: {
        totalLayers: 16,
        ranges: [
          { min: 0, max: 8, layer: 'v1' },
          { min: 9, max: 16, layer: 'v2' },
          { min: 17, max: 24, layer: 'v3' },
          { min: 25, max: 32, layer: 'v4' },
          { min: 33, max: 40, layer: 'v5' },
          { min: 41, max: 48, layer: 'v6' },
          { min: 49, max: 56, layer: 'v7' },
          { min: 57, max: 64, layer: 'v8' },
          { min: 65, max: 72, layer: 'v9' },
          { min: 73, max: 80, layer: 'v10' },
          { min: 81, max: 88, layer: 'v11' },
          { min: 89, max: 96, layer: 'v12' },
          { min: 97, max: 104, layer: 'v13' },
          { min: 105, max: 112, layer: 'v14' },
          { min: 113, max: 120, layer: 'v15' },
          { min: 121, max: 127, layer: 'v16' },
        ],
      },
      rhodes: {
        totalLayers: 4,
        ranges: [
          { min: 0, max: 31, layer: 'v1' },
          { min: 32, max: 63, layer: 'v2' },
          { min: 64, max: 95, layer: 'v3' },
          { min: 96, max: 127, layer: 'v4' },
        ],
      },
      wurlitzer: {
        totalLayers: 5,
        ranges: [
          { min: 0, max: 25, layer: 'v1' },
          { min: 26, max: 51, layer: 'v2' },
          { min: 52, max: 76, layer: 'v3' },
          { min: 77, max: 102, layer: 'v4' },
          { min: 103, max: 127, layer: 'v5' },
        ],
      },
      pad: {
        totalLayers: 4,
        ranges: [
          { min: 0, max: 31, layer: 'v1' },
          { min: 32, max: 63, layer: 'v2' },
          { min: 64, max: 95, layer: 'v3' },
          { min: 96, max: 127, layer: 'v4' },
        ],
      },
    };

    const config = VELOCITY_LAYER_CONFIG[instrument];
    if (!config) {
      logger.warn(
        `Unknown instrument type: ${instrument}, defaulting to all layers`,
      );
      return [];
    }

    const requiredLayers: string[] = [];

    for (const range of config.ranges) {
      // Check if this velocity range overlaps with [minVelocity, maxVelocity]
      const overlaps = range.min <= maxVelocity && range.max >= minVelocity;

      if (overlaps) {
        requiredLayers.push(range.layer);
      }
    }

    logger.debug(
      `Velocity range ${minVelocity}-${maxVelocity} requires ${requiredLayers.length}/${config.totalLayers} layers: ${requiredLayers.join(', ')}`,
    );

    return requiredLayers;
  }

  async clear(): Promise<void> {
    this.harmonyInstrument = null;
    this.loaded = 0;
    this.total = 0;
  }

  getProgress() {
    return {
      loaded: this.loaded,
      total: this.total,
      progress: this.total > 0 ? this.loaded / this.total : 0,
    };
  }

  /**
   * Convert MIDI pitch to note name for JSON config lookup (e.g., 60 -> 'C4', 61 -> 'C#4')
   * Uses '#' for sharps to match the perNoteVelocityRanges keys in instrument JSON configs
   */
  private midiToNoteNameForConfig(midi: number): string {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[midi % 12];
    return `${noteName}${octave}`;
  }

  // Phase 4.1: midiToNoteName() extracted to shared utils/midiUtils.ts

  /**
   * Load instrument configuration from imported JSON modules
   * Returns configuration with perNoteVelocityRanges for smart sample loading
   */
  private async loadInstrumentConfig(
    instrument: string,
  ): Promise<InstrumentSampleConfig | null> {
    try {
      // Map instrument names to their imported configurations
      const configs: Record<string, InstrumentSampleConfig> = {
        grandpiano: grandPianoConfig as InstrumentSampleConfig,
        wurlitzer: wurlitzerConfig as InstrumentSampleConfig,
        rhodes: rhodesConfig as InstrumentSampleConfig,
      };

      const config = configs[instrument];
      if (!config) {
        logger.warn(`No config found for instrument: ${instrument}`);
        return null;
      }

      logger.info('✅ Loaded instrument configuration', {
        instrument,
        hasPerNoteRanges: !!config.perNoteVelocityRanges,
        hasGlobalRanges: !!config.globalVelocityRanges,
      });

      return config;
    } catch (error) {
      logger.error('Failed to load instrument config', error);
      return null;
    }
  }

  /**
   * Normalize note name to match instrument config format
   * MIDI parsers use # (sharp) like "C#4", but our configs use 's' like "Cs4"
   * to avoid URL fragment issues with the # character
   */
  private normalizeNoteName(noteName: string): string {
    // Convert # to s (e.g., "C#4" → "Cs4", "A#2" → "As2")
    return noteName.replace(/#/g, 's');
  }

  /**
   * Determine the correct velocity layer for a specific note and velocity
   * Uses perNoteVelocityRanges if available, otherwise falls back to globalVelocityRanges
   *
   * @param noteName - Note name (e.g., 'F4', 'Gs2')
   * @param velocity - MIDI velocity (0-127)
   * @param config - Instrument configuration with perNoteVelocityRanges or globalVelocityRanges
   * @returns Layer name (e.g., 'v2', 'v3') or null if not found
   */
  private getLayerForNoteVelocity(
    noteName: string,
    velocity: number,
    config: InstrumentSampleConfig,
  ): string | null {
    // Try per-note velocity ranges first (most accurate)
    if (config.perNoteVelocityRanges) {
      // Normalize note name to match config format (# → s)
      const normalizedNoteName = this.normalizeNoteName(noteName);

      // Get velocity ranges for this specific note
      const noteRanges = config.perNoteVelocityRanges[normalizedNoteName];
      if (noteRanges) {
        // Find which range this velocity falls into
        for (const range of noteRanges) {
          if (velocity >= range.min && velocity <= range.max) {
            return range.layer;
          }
        }
      }
    }

    // Fallback to global velocity ranges (applies to all notes)
    if (config.globalVelocityRanges) {
      for (const range of config.globalVelocityRanges) {
        if (velocity >= range.min && velocity <= range.max) {
          return range.layer;
        }
      }
    }

    logger.warn('Could not determine layer for note/velocity', {
      noteName,
      velocity,
      hasPerNoteRanges: !!config.perNoteVelocityRanges,
      hasGlobalRanges: !!config.globalVelocityRanges,
    });
    return null;
  }

  /**
   * Load Grand Piano keyboard note map (static mapping of all 88 keys A0-C8)
   * Maps every piano key to its nearest sample + pre-calculated playbackRate
   */
  private async loadGrandPianoKeyboardMap(): Promise<Record<
    string,
    any
  > | null> {
    try {
      // Use imported JSON module instead of fetch
      return (grandPianoKeyboardMap as any).noteMap;
    } catch (error) {
      logger.error('Error loading Grand Piano keyboard map:', error);
      return null;
    }
  }

  /**
   * Build a smart sample map that knows exactly which samples to load
   * For Grand Piano: Uses keyboard-note-map.json to determine which sample to load for each note
   * For other instruments: Loads notes directly from exercise
   *
   * @param exercise - Exercise with harmonyNotes containing pitch and velocity
   * @param config - Instrument configuration with perNoteVelocityRanges and optional sampleMapping
   * @param instrument - Instrument name (e.g., 'grandpiano', 'wurlitzer')
   * @returns Map of note names to sets of layer names (e.g., {'F4': Set(['v2', 'v3'])})
   */
  private async buildSmartSampleMap(
    exercise: Exercise,
    config: InstrumentSampleConfig,
    instrument: string,
  ): Promise<Map<string, Set<string>>> {
    const sampleMap = new Map<string, Set<string>>();

    if (!exercise.harmonyNotes || exercise.harmonyNotes.length === 0) {
      return sampleMap;
    }

    // Load keyboard map for Grand Piano
    const keyboardMap =
      instrument === 'grandpiano'
        ? await this.loadGrandPianoKeyboardMap()
        : null;

    // Track reverse mapping: physical sample → requested notes (for caching)
    // Example: "A2" → ["A2", "As2", "Gs2"] (all notes that need A2.ogg)
    this.sampleToRequestedNotes.clear();

    // Process each harmony note in the exercise
    let noteCount = 0;
    for (const note of exercise.harmonyNotes) {
      // INSTRUMENT-SPECIFIC OCTAVE SHIFT:
      // - Wurlitzer: Lower by 1 octave (12 semitones) to match Logic export
      // - Grand Piano: No octave shift (use MIDI note as-is)
      const octaveShift = instrument === 'wurlitzer' ? 12 : 0;
      const adjustedPitch = note.pitch - octaveShift;

      // DEBUG: Log first 3 notes to verify octave shifting
      if (noteCount < 3 && octaveShift !== 0) {
        logger.info(
          `[PRELOAD OCTAVE SHIFT] ${instrument}: MIDI ${note.pitch} → ${adjustedPitch} (shift: -${octaveShift})`,
        );
      }
      noteCount++;

      // Use # notation for config lookup (matches JSON keys like "C#4")
      const noteNameForConfig = this.midiToNoteNameForConfig(adjustedPitch);
      const layer = this.getLayerForNoteVelocity(
        noteNameForConfig,
        note.velocity,
        config,
      );

      if (!layer) {
        // Skip notes where we can't determine the layer
        continue;
      }

      // Use 's' notation for file URLs (Cs4.ogg instead of C#4.ogg)
      const noteNameForFile = midiToNoteName(adjustedPitch);

      // CRITICAL: Also track original note name BEFORE octave shift (needed for Wurlitzer cache aliases)
      // Example: Exercise has MIDI 46 (As2), after shift becomes MIDI 34 (As1)
      //          We load As1.ogg but need alias As2 → As1 for RegionProcessor
      const originalNoteName =
        octaveShift !== 0 ? midiToNoteName(note.pitch) : noteNameForFile;

      // DEBUG: Log first 3 converted note names
      if (noteCount <= 3 && octaveShift !== 0) {
        logger.info(
          `[PRELOAD NOTE CONVERT] ${instrument}: ${noteNameForConfig} / ${noteNameForFile} (layer: ${layer}), original: ${originalNoteName}`,
        );
      }

      // SIMPLE APPROACH: For Grand Piano, use keyboard map to find which sample to load
      if (keyboardMap && keyboardMap[noteNameForFile]) {
        const mapping = keyboardMap[noteNameForFile];
        const sampleToLoad = mapping.sample; // e.g., "A2" for "As2"

        if (!sampleMap.has(sampleToLoad)) {
          sampleMap.set(sampleToLoad, new Set());
        }
        sampleMap.get(sampleToLoad)!.add(layer);

        // Track reverse mapping: physical sample → requested notes
        if (!this.sampleToRequestedNotes.has(sampleToLoad)) {
          this.sampleToRequestedNotes.set(sampleToLoad, new Set());
        }
        this.sampleToRequestedNotes.get(sampleToLoad)!.add(noteNameForFile);
        continue;
      }

      // For other instruments (Wurlitzer), just load the note directly
      if (!sampleMap.has(noteNameForFile)) {
        sampleMap.set(noteNameForFile, new Set());
      }
      sampleMap.get(noteNameForFile)!.add(layer);

      // CRITICAL FIX: Track reverse mapping for Wurlitzer (needed for cache aliasing)
      // Map: octave-shifted sample name → original requested note names
      // Example: "As1" → ["As2"] (As1.ogg will be cached with alias "As2")
      if (!this.sampleToRequestedNotes.has(noteNameForFile)) {
        this.sampleToRequestedNotes.set(noteNameForFile, new Set());
      }
      // Add both the shifted and original note names
      this.sampleToRequestedNotes.get(noteNameForFile)!.add(originalNoteName);
      if (originalNoteName !== noteNameForFile) {
        this.sampleToRequestedNotes.get(noteNameForFile)!.add(noteNameForFile);
      }
    }

    // Log the smart sample map for debugging
    const totalSamples = Array.from(sampleMap.values()).reduce(
      (sum, layers) => sum + layers.size,
      0,
    );

    logger.info('🧠 Built smart sample map', {
      uniqueNotes: sampleMap.size,
      totalSamples,
      hasSampleMapping: !!config.sampleMapping,
      availableSampleNotes: config.sampleMapping
        ? Object.keys(config.sampleMapping).length
        : 'N/A',
      samples: Array.from(sampleMap.entries()).map(([note, layers]) => ({
        note,
        layers: Array.from(layers).sort(),
      })),
    });

    return sampleMap;
  }

  /**
   * Fallback method that pre-downloads and caches AudioBuffers for exercise-specific harmony samples
   * Uses smart sample map to only load samples that exist
   * @param sampleMap - Map of note names to sets of layer names (e.g., {'F4': Set(['v2', 'v3'])})
   * @param instrument - Instrument type (e.g., 'wurlitzer', 'salamander')
   */
  private async fallbackToBufferCaching(
    sampleMap: Map<string, Set<string>>,
    instrument: string,
  ): Promise<PreloadResult> {
    const startTime = performance.now();

    // FAANG FIX: Cache keyboard map for RegionProcessor if Grand Piano
    // This ensures keyboard map is available BEFORE playback starts
    // RegionProcessor needs it to map requested notes (e.g., Gs3) to physical samples (e.g., A3)
    if (instrument === 'grandpiano') {
      console.log(
        '[SAMPLES][Keyboard-Map] Loading keyboard map for Grand Piano...',
      );
      const keyboardMap = await this.loadGrandPianoKeyboardMap();
      if (keyboardMap) {
        console.log(
          '[SAMPLES][Keyboard-Map] Loaded, caching in GlobalSampleCache...',
          {
            totalKeys: Object.keys(keyboardMap).length,
            sampleKeys: Object.keys(keyboardMap).slice(0, 5), // Show first 5 keys
          },
        );
        GlobalSampleCache.getInstance().cacheMetadata(
          'grandpiano-keyboard-map',
          keyboardMap,
        );

        logger.info('📋 Cached Grand Piano keyboard map for RegionProcessor', {
          totalKeys: Object.keys(keyboardMap).length,
        });
      } else {
        console.error(
          '[SAMPLES][Keyboard-Map] Failed to load keyboard map - got null/undefined',
        );
        logger.error('Failed to load Grand Piano keyboard map');
      }
    }

    // Calculate total samples from map
    const totalSamples = Array.from(sampleMap.values()).reduce(
      (sum, layers) => sum + layers.size,
      0,
    );

    // EVIDENCE: Start of preloading
    console.log('🎹 [SAMPLES] Downloading harmony samples as AudioBuffers', {
      timestamp: new Date().toISOString(),
      uniqueNotes: sampleMap.size,
      instrument,
      totalSamplesToLoad: totalSamples,
      sampleMap: Array.from(sampleMap.entries()).map(([note, layers]) => ({
        note,
        layers: Array.from(layers),
      })),
    });

    logger.info(
      '🎹 Pre-downloading harmony samples as AudioBuffers using smart sample map',
      {
        uniqueNotes: sampleMap.size,
        instrument,
        totalSamplesToLoad: totalSamples,
      },
    );

    try {
      // ✅ BUG #2 FIX: Removed OfflineAudioContext creation
      // We now cache raw ArrayBuffer data instead of decoding with OfflineContext
      // The real AudioContext will handle decoding during playback

      const { supabase } = await import('@/infrastructure/supabase/client');

      // Map instrument type to sample bucket, path, and file format
      const instrumentConfig: Record<
        string,
        { bucket: string; path: string; extension: string; format: string }
      > = {
        grandpiano: {
          bucket: 'audio-samples',
          path: 'Keyboards/grand-piano',
          extension: 'ogg',
          format: '{note}_v{layer}',
        },
        wurlitzer: {
          bucket: 'audio-samples',
          path: 'Keyboards/wurlitzer',
          extension: 'ogg',
          format: '{note}_v{layer}',
        },
        rhodes: {
          bucket: 'audio-samples',
          path: 'Keyboards/nice-keys-rhodes',
          extension: 'ogg',
          format: '{note}_v{layer}',
        },
        pad: {
          bucket: 'audio-samples',
          path: 'Keyboards/pad',
          extension: 'ogg',
          format: '{note}',
        },
      };

      const config = instrumentConfig[instrument];
      if (!config) {
        logger.error(
          `Unknown instrument type: ${instrument}, cannot download samples`,
        );
        return {
          success: false,
          error: `Unknown instrument: ${instrument}`,
          loaded: 0,
          total: 0,
        };
      }

      let samplesLoaded = 0;

      // Download and cache each sample from the smart sample map
      // This only loads samples that actually exist per the instrument's perNoteVelocityRanges
      for (const [noteName, layers] of sampleMap.entries()) {
        for (const layer of layers) {
          // Build filename based on instrument format
          // For wurlitzer: layer is "v3" but filename needs just "3" -> "G2_v3"
          const layerNumber = layer.replace('v', '');
          const filename = config.format
            .replace('{note}', noteName)
            .replace('{layer}', layerNumber);

          try {
            // CRITICAL: Check IndexedDB cache BEFORE network fetch
            const cacheKey = `${instrument}-${layer}-${noteName}`;
            const cachedBuffer =
              await GlobalSampleCache.getInstance().getCachedRawBuffer(
                cacheKey,
              );

            let arrayBuffer: ArrayBuffer;

            if (cachedBuffer) {
              console.log(
                `💾 [SAMPLES][IndexedDB-HIT] Using cached sample: ${cacheKey}`,
              );
              logger.info(`💾 IndexedDB cache HIT: ${cacheKey}`);
              arrayBuffer = cachedBuffer;

              // 🔍 DIAGNOSTIC: Log ALL cache hits with exact byte sizes
              console.log(`🔍 [CACHE-HIT] ${instrument}-${layer}-${noteName}: ${arrayBuffer.byteLength} bytes`);
            } else {
              // Not in cache, fetch from network
              const url = supabase.storage
                .from(config.bucket)
                .getPublicUrl(
                  `${config.path}/${layer}/${filename}.${config.extension}`,
                ).data.publicUrl;

              logger.info(`📥 Fetching ${instrument}/${layer}/${noteName}...`);

              const response = await fetch(url);
              if (!response.ok) {
                logger.error(
                  `❌ Failed to fetch ${noteName}/${layer}: ${response.status} (This should not happen with smart sample map!)`,
                );
                continue; // Skip this sample but continue with others
              }

              arrayBuffer = await response.arrayBuffer();

              // 🔍 DIAGNOSTIC: Log ALL downloads with exact byte sizes
              console.log(`🔍 [DOWNLOAD] ${instrument}-${layer}-${noteName}: ${arrayBuffer.byteLength} bytes from ${url}`);
            }

            // ✅ BUG #2 FIX: Cache raw ArrayBuffer, NOT decoded AudioBuffer from OfflineContext
            // OfflineContext-decoded buffers are incompatible with the real AudioContext
            // The real AudioContext will decode these when needed during playback

            // Only cache if we fetched from network (not from IndexedDB)
            if (!cachedBuffer) {
              // CHECKPOINT 9: Buffer caching - log each cache operation
              console.log('[SAMPLES] Caching buffer:', {
                cacheKey,
                instrument,
                layer,
                noteName,
                bufferSizeKB: Math.round(arrayBuffer.byteLength / 1024),
              });

              // CRITICAL FIX: Cache raw ArrayBuffer (not decoded AudioBuffer)
              // This allows the real AudioContext to decode it later at the correct sample rate
              // PERSISTENT CACHE: Also stores to IndexedDB for cross-session persistence
              await GlobalSampleCache.getInstance().cacheBuffer(
                cacheKey,
                arrayBuffer, // ✅ BUG #2 FIX: Pass ArrayBuffer, not AudioBuffer
              );

              console.log(
                '[SAMPLES] Buffer cached successfully (memory + IndexedDB):',
                cacheKey,
              );
            } else {
              // Already in cache, just restore to memory if needed
              const memoryCache =
                GlobalSampleCache.getInstance().getCachedBuffer(cacheKey);
              if (!memoryCache) {
                console.log(
                  '[SAMPLES][IndexedDB-Restore] Restoring from IndexedDB to memory cache:',
                  cacheKey,
                );
              }
            }

            // CRITICAL FIX: For Grand Piano, create cache aliases for ALL notes that map to this physical sample
            // (not just notes in current exercise - allows instant switching between exercises)
            // FIX: Create aliases for BOTH network-fetched AND cached samples (needed after page reload)
            let aliasCount = 0; // Declare outside if block for logging
            if (instrument === 'grandpiano') {
              // Get keyboard map from cache (already loaded above at line 614)
              const keyboardMap =
                GlobalSampleCache.getInstance().getCachedMetadata(
                  'grandpiano-keyboard-map',
                );

              if (keyboardMap) {
                // Find ALL notes that map to this physical sample
                // Example: Physical sample "A3" should have aliases for "Gs3", "A3", "As3", etc.
                for (const [requestedNote, mapping] of Object.entries(
                  keyboardMap,
                )) {
                  if (mapping.sample === noteName) {
                    if (requestedNote !== noteName) {
                      // Cache under requested note name (e.g., "grandpiano-v3-Gs3" → same buffer as "grandpiano-v3-A3")
                      // Mark as context-compatible so AudioContextCompatibility doesn't clear it
                      await GlobalSampleCache.getInstance().cacheBuffer(
                        `${instrument}-${layer}-${requestedNote}`,
                        arrayBuffer,
                        { isContextCompatible: true },
                      );
                      aliasCount++;
                    }
                  }
                }

                if (aliasCount > 0) {
                  logger.info(
                    `🔗 CACHE ALIAS: ${aliasCount} aliases for ${instrument}-${layer}-${noteName}`,
                  );
                }
              } else {
                logger.warn(
                  `🔗 No keyboard map found for ${instrument} alias creation`,
                );
              }
            }
            // NOTE: Wurlitzer/Rhodes do NOT create aliases - each note has its own sample file

            samplesLoaded++;

            // EVIDENCE: Show detailed caching progress
            const aliasInfo =
              instrument === 'grandpiano'
                ? `${aliasCount || 0} from keyboard map`
                : this.sampleToRequestedNotes.get(noteName)
                  ? Array.from(this.sampleToRequestedNotes.get(noteName)!)
                  : [];

            console.log(
              `[SAMPLES] Cached: ${instrument}-${layer}-${noteName}`,
              {
                progress: `${samplesLoaded}/${totalSamples}`,
                bufferSizeKB: Math.round(arrayBuffer.byteLength / 1024),
                aliases: aliasInfo,
              },
            );

            // DIAGNOSTIC: Show progress every 5 samples
            if (samplesLoaded % 5 === 0) {
              console.log(
                `[SAMPLES][Progress] ${samplesLoaded}/${totalSamples} samples loaded (${Math.round((samplesLoaded / totalSamples) * 100)}%)`,
              );
            }

            logger.info(
              `🔊 CACHE BUFFER: ${instrument}-${layer}-${noteName} cached (${samplesLoaded}/${totalSamples})`,
            );
          } catch (error) {
            logger.error(`❌ Failed to cache ${noteName}/${layer}:`, error);
            // Continue with other samples even if one fails
          }
        }
      }

      this.loaded = samplesLoaded;
      this.total = totalSamples;

      const duration = performance.now() - startTime;

      // EVIDENCE: End of preloading
      console.log('✅ [SAMPLES] Harmony samples preloaded', {
        timestamp: new Date().toISOString(),
        durationMs: duration.toFixed(2),
        samplesLoaded,
        totalSamples,
        successRate: `${Math.round((samplesLoaded / totalSamples) * 100)}%`,
        instrument,
      });

      logger.info(
        '✅ Exercise-specific harmony samples preloaded as AudioBuffers',
        {
          duration: `${duration.toFixed(2)}ms`,
          samplesLoaded,
          totalSamples,
          successRate: `${Math.round((samplesLoaded / totalSamples) * 100)}%`,
        },
      );

      return {
        success: true,
        loaded: this.loaded,
        total: this.total,
      };
    } catch (error) {
      logger.error('Failed to pre-cache harmony samples:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        loaded: 0,
        total: 0,
      };
    }
  }

  /**
   * Fallback for loadEssentialSamples when no exercise data is available
   * Loads a generic set of essential harmony notes
   */
  private async fallbackToGenericSamples(): Promise<PreloadResult> {
    logger.info('Loading generic essential harmony samples');

    // Use generic essential MIDI pitches (every 3 semitones from C2 to C5)
    const genericPitches = [
      36, 39, 43, 46, 48, 51, 55, 58, 60, 63, 67, 70, 72, 75, 79, 82, 84,
    ];

    // Build a simple map with mid-range velocity layer
    const genericSampleMap = new Map<string, Set<string>>();
    for (const pitch of genericPitches) {
      const noteName = midiToNoteName(pitch);
      genericSampleMap.set(noteName, new Set(['v10']));
    }

    // Use grandpiano as default
    return this.fallbackToBufferCaching(genericSampleMap, 'grandpiano');
  }
}
