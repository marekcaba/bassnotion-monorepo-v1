/**
 * Professional 16-velocity Salamander Grand Piano sampler
 * Optimized for performance with lazy loading and memory management
 */

import { loadGlobalTone } from '../../../../services/plugins/toneLoader.js';
import { GlobalSampleCache } from '../../../../services/storage/GlobalSampleCache.js';
import { CachedToneBufferLoader } from '../../../../services/storage/CachedToneBufferLoader.js';
import { getPersistentAudioContext, ensureToneUsesPersistentContext } from '../../../../utils/audioContext.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

export interface VelocityRange {
  min: number;
  max: number;
  layer: string;
}

// Helper to ensure Tone.js is loaded from global instance
async function ensureToneLoaded(
  preferredContext?: AudioContext,
): Promise<void> {
  // Always try to get the persistent context first
  const persistentContext = getPersistentAudioContext();
  const contextToUse = preferredContext || persistentContext || undefined;
  
  if (!Tone || preferredContext || persistentContext) {
    Tone = await loadGlobalTone(contextToUse);
    // Only log if there's an issue
    if (!Tone || !Tone.context) {
      logger.error('🎵 Failed to load global Tone.js instance');
    } else {
      // Ensure Tone is using the persistent context
      ensureToneUsesPersistentContext();
    }
  }
}

// Helper to sync Tone.js context with a provided AudioContext
function syncToneContext(audioContext?: BaseAudioContext): void {
  if (!Tone || !audioContext) return;

  // Check if contexts are different
  const toneContext = Tone.context?._context || Tone.context?._nativeAudioContext || Tone.context?.rawContext || Tone.context;
  const persistentContext = (window as any).__persistentAudioContext;
  
  if (toneContext !== audioContext) {
    // Check if both are the same persistent context
    if (persistentContext && (toneContext === persistentContext || audioContext === persistentContext)) {
      // Using persistent context, this is OK
      return;
    }
    
    logger.info('🎹 AudioContext provided but NOT switching Tone.js context to avoid buffer invalidation');
    // DO NOT call Tone.setContext() - it invalidates all cached buffers!
    // Instead, we'll ensure proper context usage through connection
  }
}

// Helper to safely connect Tone.js nodes
function safeConnect(source: any, destination: any, label?: string): boolean {
  try {
    // Validate source
    if (!source || typeof source.connect !== 'function') {
      logger.error(`Invalid source for connection ${label || ''}:`, source);
      return false;
    }

    // Validate destination
    if (!destination) {
      logger.error(
        `Invalid destination (null/undefined) for connection ${label || ''}`,
      );
      return false;
    }

    // Check if Tone is loaded
    if (!Tone) {
      logger.error('Tone.js not loaded, cannot check node types');
      return false;
    }

    // Special handling for Tone.js Volume nodes - they might be disposed
    if (destination?.constructor?.name === 'Volume') {
      // Check if the Volume node is disposed
      if (destination.disposed === true) {
        logger.error(
          `Destination Volume node is disposed for connection ${label || ''}`,
        );
        return false;
      }
      // Volume nodes are valid destinations
      source.connect(destination);
      return true;
    }

    // Check if destination is a valid audio node
    const isValidDest =
      destination === Tone?.Destination ||
      (destination?.constructor &&
        destination.constructor.name?.includes('ToneAudioNode')) ||
      (destination &&
        typeof destination === 'object' &&
        (destination.input ||
          destination._internalChannels ||
          destination.numberOfInputs !== undefined));

    if (!isValidDest) {
      logger.error(`Invalid destination type for connection ${label || ''}:`, {
        destination,
        constructor: destination?.constructor?.name,
        hasInput: !!destination?.input,
        type: typeof destination,
      });
      return false;
    }

    // Debug: Check AudioContext before connecting
    const sourceContext = source.context || source._context;
    const destContext = destination.context || destination._context;

    if (sourceContext && destContext && sourceContext !== destContext) {
      // Check if it's Tone.js Context vs native AudioContext
      const isSourceTone = sourceContext?.constructor?.name === 'Context';
      const isDestTone = destContext?.constructor?.name === 'Context';
      const isSourceNative = sourceContext instanceof AudioContext;
      const isDestNative = destContext instanceof AudioContext;

      // Get the underlying native contexts
      const sourceNativeContext = isSourceTone 
        ? (sourceContext._context || sourceContext.rawContext || sourceContext._nativeAudioContext)
        : sourceContext;
      const destNativeContext = isDestTone
        ? (destContext._context || destContext.rawContext || destContext._nativeAudioContext)
        : destContext;

      // Check if we're using the persistent global context
      const persistentContext = (window as any).__persistentAudioContext;
      
      // If the underlying native contexts match, or if either uses the persistent context, 
      // this is expected behavior and we should NOT warn
      const contextsMatch = sourceNativeContext === destNativeContext;
      const usesPersistentContext = persistentContext && 
        (sourceNativeContext === persistentContext || destNativeContext === persistentContext);
      
      // Also check if both are using the same Tone.js instance
      const globalTone = (window as any).Tone;
      const bothUseTone = globalTone && 
        ((isSourceTone && sourceContext === globalTone.context) ||
         (isDestTone && destContext === globalTone.context));

      if (!contextsMatch && !usesPersistentContext && !bothUseTone) {
        // Only warn if we have a genuine mismatch that isn't explained by:
        // 1. Tone.js wrapper differences with matching underlying contexts
        // 2. Use of the persistent global context
        // 3. Use of the global Tone.js instance
        logger.warn(`⚠️ AudioContext mismatch in ${label || 'connection'}, but proceeding anyway`, {
          sourceType: sourceContext?.constructor?.name,
          destType: destContext?.constructor?.name,
          sourceNative: sourceNativeContext?.constructor?.name,
          destNative: destNativeContext?.constructor?.name,
        });
      }
      // Otherwise, this is normal operation - proceed silently
    }

    // Attempt connection
    try {
      source.connect(destination);
      return true;
    } catch (connectError: any) {
      // Check if this is an InvalidAccessError because nodes are already connected
      if (connectError.name === 'InvalidAccessError') {
        // This is fine - nodes are already connected
        logger.debug(`${label || 'Nodes'} already connected, skipping reconnection`);
        return true;
      }
      // Re-throw other errors
      throw connectError;
    }
  } catch (error: any) {
    logger.error(`Failed to connect ${label || 'nodes'}:`, {
      name: error.name,
      message: error.message,
      sourceType: source?.constructor?.name,
      destType: destination?.constructor?.name,
      hasSourceConnect: typeof source?.connect === 'function',
      hasDestConnect: typeof destination?.connect === 'function'
    });
    return false;
  }
}

export class SalamanderVelocitySampler {
  private samplers: Map<string, any> = new Map(); // Will be Tone.Sampler
  private velocityRanges: VelocityRange[] = [];
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: any | null = null; // Will be Tone.InputNode
  private damperReleaseSampler: any | null = null; // Will be Tone.Player
  private mechanicalVolumeDb = -10; // Base volume for mechanical sounds in dB
  private damperReleaseOffset = 0; // Play immediately when note ends
  private activeNotes: Map<string, number> = new Map(); // Track active notes and their velocities
  private volumeWasMuted = false; // Track if volume was muted by panic
  // Use Supabase samples
  private useLocalSamples = false;
  private localSamplesPath = '/samples/salamander-mp3';
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';
  private preferredContext: AudioContext | null = null; // Store the preferred AudioContext
  private audioContext: AudioContext | null = null; // Store the actual AudioContext for fallback oscillators

  // Sample mapping for all layers
  // Using exact file names as they are in the directory
  private readonly sampleMapping = {
    A0: 'A0.mp3',
    C1: 'C1.mp3',
    Eb1: 'Ds1.mp3', // Tone.js prefers flats
    Gb1: 'Fs1.mp3',
    A1: 'A1.mp3',
    C2: 'C2.mp3',
    Eb2: 'Ds2.mp3',
    Gb2: 'Fs2.mp3',
    A2: 'A2.mp3',
    C3: 'C3.mp3',
    Eb3: 'Ds3.mp3',
    Gb3: 'Fs3.mp3',
    A3: 'A3.mp3',
    C4: 'C4.mp3',
    Eb4: 'Ds4.mp3',
    Gb4: 'Fs4.mp3',
    A4: 'A4.mp3',
    C5: 'C5.mp3',
    Eb5: 'Ds5.mp3',
    Gb5: 'Fs5.mp3',
    A5: 'A5.mp3',
    C6: 'C6.mp3',
    Eb6: 'Ds6.mp3',
    Gb6: 'Fs6.mp3',
    A6: 'A6.mp3',
    C7: 'C7.mp3',
    Eb7: 'Ds7.mp3',
    Gb7: 'Fs7.mp3',
    A7: 'A7.mp3',
    C8: 'C8.mp3',
  };

  /**
   * Set the preferred AudioContext to use for all Tone.js operations
   * This should be called BEFORE initialize()
   */
  setPreferredContext(context: AudioContext): void {
    this.preferredContext = context;
    logger.info('🎹 SalamanderVelocitySampler: Preferred AudioContext set');
  }

  constructor() {
    // Initialize velocity ranges
    this.velocityRanges = [
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
    ];
  }

  /**
   * Ensure all loaded samplers are ready to play
   */
  async ensureReady(): Promise<void> {
    logger.info('🎹 Ensuring all samplers are ready...');

    for (const [layer, sampler] of this.samplers) {
      if (sampler) {
        try {
          // Wait for the loaded promise
          await sampler.loaded;
          logger.info(`🎹 Layer ${layer} ready`);
        } catch (err) {
          logger.warn(`🎹 Layer ${layer} load failed:`, err);
        }
      }
    }

    logger.info('🎹 All samplers checked and ready!');
  }

  /**
   * Initialize with commonly used velocity layers
   * Loads v1, v8, v16 by default (pp, mf, ff)
   * @param requiredNotes - If provided, only load these specific notes (smart loading)
   * @param velocityLayers - If provided, only load these velocity layers
   */
  async initialize(
    requiredNotes?: string[],
    velocityLayers?: string[],
  ): Promise<void> {
    if (this.isInitialized) return;
    
    // Check if InitialSamplePreloader has already loaded samples
    const checkPreloadedSamples = () => {
      let preloadedCount = 0;
      const layersToCheck = velocityLayers || this.defaultVelocityLayers.map(v => v.layer);
      
      for (const layer of layersToCheck) {
        for (const note of Object.keys(this.sampleMapping)) {
          const path = `Keyboards/salamander/${layer}/${note}.mp3`;
          if (GlobalSampleCache.getCachedUrl(path)) {
            preloadedCount++;
          }
        }
      }
      return preloadedCount;
    };
    
    const preloaded = checkPreloadedSamples();
    logger.info('🎹 Initializing Salamander Grand Piano', {
      smartLoading: !!requiredNotes,
      notesCount: requiredNotes?.length || 'all',
      layers: velocityLayers || 'default',
      preloadedSamples: preloaded,
      expectedSamples: (velocityLayers?.length || this.defaultVelocityLayers.length) * 30,
    });

    // Ensure Tone.js is loaded with the preferred context if available
    await ensureToneLoaded(this.preferredContext || undefined);

    // Check if Tone is available after loading
    if (!Tone || typeof Tone === 'undefined') {
      throw new Error('Tone.js is not loaded');
    }

    // Store the audio context for emergency fallback oscillators
    // Use persistent context if available
    this.audioContext = this.preferredContext || getPersistentAudioContext() || Tone?.context?._context || (Tone as any)?._context;

    // Ensure Tone.js context is started
    try {
      if (!Tone.context) {
        throw new Error('Tone.js context is not initialized');
      }
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (error) {
      logger.error('❌ Failed to start Tone.js context:', error);
      throw error;
    }

    // We don't need to initialize a separate mechanical volume node anymore
    // The volume will be calculated and applied directly when playing damper sounds

    // Load damper release sound first
    await this.loadDamperReleaseSound();

    // Determine which layers to load
    let layersToLoad: string[];

    if (velocityLayers && velocityLayers.length > 0) {
      // Use provided velocity layers
      layersToLoad = velocityLayers;
    } else {
      // Load optimized velocity layers - v10 FIRST for test button
      // v10 is priority because test chord uses velocity 80
      layersToLoad = [
        'v10', // mezzo-forte (velocity 73-80) - LOAD FIRST for test button!
        'v6', // piano (velocity 41-48)
        'v14', // forte (velocity 105-112)
        'v1', // pianissimo (velocity 0-8)
        'v16', // fortissimo (velocity 121-127)
      ];
    }

    logger.info('🎹 Loading velocity layers:', layersToLoad.join(', '));

    // Load layers with smart loading support
    const loadPromises = layersToLoad.map(async (layer) => {
      try {
        if (requiredNotes && requiredNotes.length > 0) {
          // Smart loading: only load specific notes
          logger.info(
            `🎹 Smart loading layer ${layer} with ONLY ${requiredNotes.length} notes`,
          );
          await this.loadLayerWithNotes(layer, requiredNotes);
        } else {
          // Full loading: load all 30 samples
          logger.info(`🎹 Full loading layer ${layer} with ALL 30 samples`);
          await this.loadLayer(layer);
        }
        logger.info(`✅ Layer ${layer} loaded successfully`);
      } catch (error) {
        logger.debug(`❌ Failed to load layer ${layer}:`, error);
      }
    });

    await Promise.all(loadPromises);

    // CRITICAL: Wait for Tone.js to finish loading ALL buffers
    // This is a global wait that ensures all Tone.Sampler instances have their buffers ready
    logger.info(
      '🎹 Waiting for Tone.loaded() to ensure all buffers are ready...',
    );
    try {
      await Tone.loaded();
      logger.info('🎹 Tone.loaded() resolved - all buffers should be ready');
    } catch (error) {
      logger.error('🎹 Tone.loaded() failed:', error);
    }

    // Extra wait to ensure all buffers are fully loaded
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify that samplers are actually loaded
    for (const layer of layersToLoad) {
      const sampler = this.samplers.get(layer);
      if (sampler && !sampler.loaded) {
        logger.warn(
          `🎹 Layer ${layer} sampler exists but not fully loaded, waiting...`,
        );
        try {
          await sampler.loaded;
        } catch (e) {
          logger.error(`🎹 Failed to wait for layer ${layer} to load:`, e);
        }
      }
    }

    this.isInitialized = true;
    // logger.info('✅ Salamander Grand Piano ready with initial layers');

    // Final check to ensure all samplers are ready
    await this.ensureReady();
  }

  /**
   * Load a specific velocity layer with only certain notes (smart loading)
   */
  private async loadLayerWithNotes(
    layer: string,
    notes: string[],
  ): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    logger.info(`🎹 Smart loading layer ${layer} with ${notes.length} notes`);

    const loadPromise = (async () => {
      const layerStartTime = performance.now();
      try {
        // Ensure Tone.js context is running before creating sampler
        if (Tone.context.state !== 'running') {
          try {
            await Tone.start();
          } catch (e) {
            // Context will be resumed when user interacts
          }
        }

        // Context should already be set from preferredContext in initialize()

        // Map notes to actual Salamander sample files
        // Salamander uses sparse sampling: only certain notes have samples
        const actualSamples = new Set<string>();
        const urls: Record<string, string> = {};

        notes.forEach((note) => {
          // Find the nearest available sample for this note
          let sampleFile: string | null = null;

          // Direct match
          if (this.sampleMapping[note as keyof typeof this.sampleMapping]) {
            sampleFile =
              this.sampleMapping[note as keyof typeof this.sampleMapping];
          } else {
            // Find nearest sample (Tone.js will pitch-shift)
            // For notes between samples, use the nearest lower sample
            const noteNum = parseInt(note.match(/\d+/)?.[0] || '0');
            const noteName = note.replace(/\d+/, '');

            // Check same octave samples
            const octaveSamples = Object.keys(this.sampleMapping).filter((k) =>
              k.includes(noteNum.toString()),
            );

            if (octaveSamples.length > 0) {
              // Use first available in same octave
              sampleFile =
                this.sampleMapping[
                  octaveSamples[0] as keyof typeof this.sampleMapping
                ];
            } else {
              // Use C4 as fallback (middle of range)
              sampleFile = 'C4.mp3';
            }
          }

          if (sampleFile) {
            urls[note] = sampleFile;
            actualSamples.add(sampleFile);
          }
        });

        logger.info(
          `🎹 Layer ${layer}: Mapped ${notes.length} notes to ${actualSamples.size} unique sample files`,
        );

        const baseUrl = this.useLocalSamples
          ? `${this.localSamplesPath}/${layer}/`
          : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`;

        logger.info(`🎹 Smart loading from: ${baseUrl}`);

        // Build full URLs for cache checking
        const fullUrls: Record<string, string> = {};
        Object.entries(urls).forEach(([note, filename]) => {
          fullUrls[note] = `${baseUrl}${filename}`;
        });

        // Check if samples are cached
        const allCached = CachedToneBufferLoader.areAllSamplesCached(fullUrls);

        let sampler: Tone.Sampler;

        if (allCached) {
          logger.info(`🎹 Smart loading layer ${layer} from cache!`);
          sampler = await CachedToneBufferLoader.createCachedSampler(
            fullUrls,
            {
              release: 0.05,
              attack: 0.002,
            },
            'SalamanderPiano',
          );

          const loadTime = (
            (performance.now() - layerStartTime) /
            1000
          ).toFixed(2);
          logger.info(
            `✅ Smart loaded layer ${layer} from CACHE: ${actualSamples.size} samples in ${loadTime}s`,
          );
        } else {
          logger.info(`🎹 Smart loading layer ${layer} from network`);
          sampler = new Tone.Sampler({
            urls,
            baseUrl,
            release: 0.05,
            attack: 0.002,
            onload: () => {
              const loadTime = (
                (performance.now() - layerStartTime) /
                1000
              ).toFixed(2);
              logger.info(
                `✅ Smart loaded layer ${layer}: ${actualSamples.size} samples in ${loadTime}s`,
              );
            },
            onerror: (error) => {
              logger.error(`❌ Failed to smart load layer ${layer}:`, error);
            },
          });
        }

        // Wait for sampler to load
        await sampler.loaded;

        // Store the sampler
        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);
        this.loadingPromises.delete(layer);
      } catch (error) {
        logger.error(`Failed to smart load layer ${layer}:`, error);
        this.loadingPromises.delete(layer);
        throw error;
      }
    })();

    this.loadingPromises.set(layer, loadPromise);
    return loadPromise;
  }

  /**
   * Load a specific velocity layer
   */
  private async loadLayer(layer: string): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    // Check if already loading
    const existingPromise = this.loadingPromises.get(layer);
    if (existingPromise) return existingPromise;

    // Loading velocity layer

    const loadPromise = (async () => {
      try {
        // Ensure Tone.js context is running before creating sampler
        logger.info(`🎹 Tone.context state before creating sampler: ${Tone.context.state}`);
        logger.info(`🎹 Tone.context info:`, {
          sampleRate: Tone.context.sampleRate,
          currentTime: Tone.context.currentTime,
          rawContext: Tone.context.rawContext || Tone.context._context,
          isPersistent: Tone.context.rawContext === (window as any).__persistentAudioContext
        });
        
        if (Tone.context.state !== 'running') {
          logger.info('🎹 Context suspended, attempting to start...');
          try {
            await Tone.start();
            logger.info('🎹 Tone.start() completed, state:', Tone.context.state);
          } catch (e) {
            logger.warn('🎹 Tone.start() failed:', e);
            // Context will be resumed when user interacts
          }
        }

        // Context should already be set from preferredContext in initialize()

        // Creating sampler for layer
        let sampler: Tone.Sampler;

        try {
          // logger.info(`🎹 Creating sampler for layer ${layer}`);

          // Try local samples first
          const baseUrl = this.useLocalSamples
            ? `${this.localSamplesPath}/${layer}/`
            : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`;

          logger.info(
            `🎹 Creating Tone.Sampler for layer ${layer} from: ${baseUrl}`,
          );
          logger.info(
            `🎹 Sample mapping has ${Object.keys(this.sampleMapping).length} entries`,
          );
          
          // Log a few sample URLs for debugging
          const firstFewNotes = Object.keys(this.sampleMapping).slice(0, 3);
          firstFewNotes.forEach(note => {
            logger.info(`🎹   ${note}: ${baseUrl}${this.sampleMapping[note]}`);
          });
          
          // Test if we can fetch one sample to check network/CORS
          const testNote = 'C4' as keyof typeof this.sampleMapping;
          const testUrl = `${baseUrl}${this.sampleMapping[testNote]}`;
          try {
            logger.info(`🎹 Testing fetch for ${testUrl}`);
            const response = await fetch(testUrl, { method: 'HEAD' });
            if (!response.ok) {
              logger.error(`❌ Failed to fetch test sample: ${response.status} ${response.statusText}`);
            } else {
              logger.info(`✅ Test fetch successful for ${testNote}`);
            }
          } catch (fetchError) {
            logger.error(`❌ Network error fetching test sample:`, fetchError);
          }

          // Check if samples are already cached
          const sampleUrls: Record<string, string> = {};
          Object.entries(this.sampleMapping).forEach(([note, filename]) => {
            const fullUrl = `${baseUrl}${filename}`;
            sampleUrls[note] = fullUrl;
          });

          // Check if all samples for this layer are cached
          const allCached =
            CachedToneBufferLoader.areAllSamplesCached(sampleUrls);

          if (allCached) {
            logger.info(
              `🎹 All samples for layer ${layer} are cached! Using CachedToneBufferLoader`,
            );

            // Use cached buffer loader
            sampler = await CachedToneBufferLoader.createCachedSampler(
              sampleUrls,
              {
                release: 0.05, // Very short release (50ms) so the damper sound is audible
                attack: 0.002,
              },
              'SalamanderPiano',
            );

            logger.info(`✅ Sampler layer ${layer} loaded from cache!`);
          } else {
            logger.info(
              `🎹 Some samples for layer ${layer} not cached, using normal loading`,
            );

            // Create a promise to track loading completion
            let loadResolve: () => void;
            let loadReject: (error: any) => void;
            const loadPromise = new Promise<void>((resolve, reject) => {
              loadResolve = resolve;
              loadReject = reject;
            });
            
            sampler = new Tone.Sampler({
              urls: this.sampleMapping,
              baseUrl,
              release: 0.05, // Very short release (50ms) so the damper sound is audible
              attack: 0.002,
              onload: () => {
                logger.info(
                  `✅ Sampler layer ${layer} loaded successfully from ${this.useLocalSamples ? 'local' : 'Supabase'}`,
                );
                loadResolve();
              },
              onerror: (error) => {
                logger.error(
                  `❌ Error loading sampler for layer ${layer} from ${this.useLocalSamples ? 'local' : 'Supabase'}:`,
                  error,
                );
                
                // Log the actual error details
                if (error instanceof Error) {
                  logger.error(`Error details:`, {
                    message: error.message,
                    stack: error.stack
                  });
                }

                // If local loading failed, try Supabase as fallback
                if (this.useLocalSamples) {
                  logger.info(`🔄 Retrying layer ${layer} from Supabase...`);
                  this.useLocalSamples = false;
                  // Don't create fallback sampler here - just reject
                  // The retry logic will handle it
                }
                
                loadReject(error);
              },
            });
            
            // Set a timeout for loading
            const loadTimeout = setTimeout(() => {
              loadReject(new Error(`Timeout loading layer ${layer} after 30 seconds`));
            }, 30000);
            
            // Wait for the load promise
            try {
              await loadPromise;
              clearTimeout(loadTimeout);
            } catch (loadError) {
              clearTimeout(loadTimeout);
              logger.error(`Failed to load sampler for layer ${layer}:`, loadError);
              // Continue anyway - the sampler might still work
            }
          }
        } catch (samplerError) {
          logger.error(
            `Failed to create Tone.Sampler for layer ${layer}:`,
            samplerError,
          );
          // Try creating a basic sampler without any options
          try {
            sampler = new Tone.Sampler();
            logger.warn(
              `Created basic sampler for layer ${layer} as fallback`,
            );
          } catch (fallbackError) {
            logger.error(
              `Failed to create even basic sampler:`,
              fallbackError,
            );
            throw fallbackError;
          }
        }

        // Important: Do NOT connect the sampler to any destination here
        // Tone.Sampler might have internal connections that fail if destination isn't ready

        // Wait for sampler to be loaded before attempting any connections
        try {
          logger.info(
            `🎹 Waiting for layer ${layer} sampler.loaded promise...`,
          );
          await sampler.loaded;
          logger.info(`🎹 Layer ${layer} sampler.loaded promise resolved`);

          // CRITICAL: Also wait for global Tone.loaded() to ensure this new sampler's buffers are ready
          logger.info(`🎹 Waiting for Tone.loaded() for layer ${layer}...`);
          try {
            await Tone.loaded();
            logger.info(`🎹 Tone.loaded() resolved for layer ${layer}`);
          } catch (error) {
            // Silently handle encoding errors - samples may still be usable
            logger.debug(`🎹 Tone.loaded() had issues for layer ${layer}, but continuing:`, error);
          }
        } catch (loadError) {
          logger.debug(`Sampler load failed for layer ${layer}:`, loadError);
          throw loadError; // Re-throw to handle at higher level
        }

        // Ensure sampler is properly initialized
        if (!sampler) {
          throw new Error(
            `Sampler for layer ${layer} is not properly initialized`,
          );
        }
        
        // CRITICAL: Ensure the sampler has proper audio output
        if (!sampler.output) {
          logger.error(`🎹 CRITICAL: Sampler for layer ${layer} has no output property!`);
          logger.info(`🎹 Sampler properties:`, Object.keys(sampler));
          
          // For Tone.js Sampler, the output should be created automatically
          // If it's missing, there's a serious issue with Tone.js initialization
          logger.info(`🎹 Checking Tone.js status:`, {
            hasTone: typeof Tone !== 'undefined',
            contextState: Tone?.context?.state,
            contextSampleRate: Tone?.context?.sampleRate,
            ToneVersion: Tone?.version
          });
        }

        // Connect the sampler to destination if we have one
        if (this.destination) {
          try {
            // CRITICAL FIX: Use Tone's connect method instead of safeConnect for proper audio routing
            if (sampler && sampler.connect) {
              logger.info(`🎹 Connecting layer ${layer} sampler to destination...`);
              sampler.connect(this.destination);
              logger.info(`✅ Connected newly loaded layer ${layer} to destination`);
              
              // Verify the connection
              logger.info(`🎹 Audio chain for layer ${layer}:`, {
                samplerConnectedTo: this.destination,
                destinationType: this.destination?.constructor?.name,
                destinationContext: this.destination?.context,
                samplerContext: sampler?.context?._context || sampler?.context,
                samplerHasOutput: !!sampler.output,
                samplerOutputType: sampler.output?.constructor?.name
              });
            }
          } catch (err) {
            logger.error(
              `Failed to connect newly loaded layer ${layer}:`,
              err,
            );
            // Try fallback connection
            try {
              logger.info(`🎹 Trying fallback connection for layer ${layer}...`);
              sampler.toDestination();
              logger.info(`✅ Connected layer ${layer} to Tone.Destination as fallback`);
            } catch (fallbackErr) {
              logger.error(`Failed fallback connection:`, fallbackErr);
            }
          }
        } else {
          logger.info(
            `Sampler layer ${layer} created - will be connected when connect() is called`,
          );
          
          // Connect to Tone.Destination as fallback
          logger.info(`🎹 No destination specified, connecting to Tone.Destination`);
          sampler.toDestination();
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);

        // Velocity layer loaded
      } catch (error) {
        logger.debug(`❌ Failed to load layer ${layer}:`, error);
        throw error;
      } finally {
        this.loadingPromises.delete(layer);
      }
    })();

    this.loadingPromises.set(layer, loadPromise);
    return loadPromise;
  }


  /**
   * Get the appropriate layer for a velocity value
   */
  private getLayerForVelocity(velocity: number): string {
    const v = Math.max(0, Math.min(127, velocity));
    const range = this.velocityRanges.find((r) => v >= r.min && v <= r.max);
    const layer = range ? range.layer : 'v10'; // Default to v10 (our priority layer)

    // Debug logging
    if (velocity > 85) {
      logger.info(
        `🎹 Velocity ${velocity} -> layer ${layer} (range: ${range?.min}-${range?.max})`,
      );
    }

    return layer;
  }

  /**
   * Load the damper release sound
   */
  private async loadDamperReleaseSound(): Promise<void> {
    try {
      // Ensure Tone is loaded
      await ensureToneLoaded();

      // Try local file first
      const damperUrl = this.useLocalSamples
        ? `${this.localSamplesPath}/AT2035 XY Angle Dn RTN A2.wav`
        : `${this.supabaseUrl}/Keyboards/salamander/AT2035 XY Angle Dn RTN A2.wav`;

      this.damperReleaseSampler = new Tone.Player({
        url: damperUrl,
        onload: () => {
          logger.info('Damper release sound loaded successfully');
        },
        onerror: (error) => {
          logger.warn('Failed to load damper release sound:', error);
          // Non-critical - piano will work without mechanical sounds
        },
      });

      // Player with url in constructor loads automatically, just wait for it
      await this.damperReleaseSampler.loaded;

      // Don't connect damper release sampler here - we'll create connections on demand
      // This avoids AudioNode connection issues during initialization
      logger.info('Damper release sampler ready (not connected yet)');
    } catch (error) {
      logger.error('Failed to load damper release sound:', error);
      // Don't throw - allow piano to work without mechanical sounds
    }
  }

  /**
   * Play a note with velocity
   * Automatically loads required layer if not already loaded
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity = 64,
    playMechanicalSounds = true,
  ): Promise<void> {
    // Restore volume if it was muted by panic
    if (this.volumeWasMuted) {
      logger.info('🎹 Restoring sampler volumes after panic');
      this.samplers.forEach((sampler, layer) => {
        if (sampler && sampler.loaded) {
          if (sampler.volume && sampler.volume.value !== undefined) {
            // Don't force volume changes - let it use its default value
            // The sampler's volume control is handled through the gain node chain
            const currentValue = sampler.volume.value;
            logger.info(`🎹 Sampler ${layer} volume: ${currentValue}dB (not modifying)`);
            
            // If volume is extremely low or muted, warn but don't change
            if (currentValue === -Infinity || currentValue < -40) {
              logger.warn(`🎹 WARNING: Sampler ${layer} volume is very low: ${currentValue}dB`);
              logger.warn(`🎹 If no sound is heard, check the audio routing and gain stages`);
            }
          } else if (sampler.volume && typeof sampler.volume.gain !== 'undefined') {
            // Some samplers might have gain instead of value
            if (sampler.volume.gain.value === 0) {
              sampler.volume.gain.value = 1; // Linear gain: 1 = unity gain
              logger.info(
                `🎹 Restored sampler.volume.gain.value to 1 (linear) for layer ${layer}`,
              );
            }
          }
        }
      });
      this.volumeWasMuted = false;
    }

    // Ensure Tone is loaded before we proceed
    if (!Tone) {
      await ensureToneLoaded();
    }

    const notes = Array.isArray(note) ? note : [note];
    // CRITICAL FIX: Don't convert time parameter here - pass it through as-is
    // This preserves Transport-relative timing like "+0.05"

    // Play each note individually
    for (let i = 0; i < notes.length; i++) {
      const currentNote = notes[i];
      let layer = this.getLayerForVelocity(velocity);
      const originalLayer = layer;

      // CRITICAL: Use v10 as default fallback for instant playback
      if (!this.loadedLayers.has(layer) || !this.samplers.has(layer)) {
        // Check if v10 is available (it loads first)
        if (this.loadedLayers.has('v10') && this.samplers.has('v10')) {
          logger.info(`🎹 Layer ${layer} not ready, using v10 for instant playback`);
          layer = 'v10';
        } else {
          // If v10 isn't ready, use any available layer
          const availableLayers = Array.from(this.loadedLayers);
          if (availableLayers.length > 0) {
            layer = availableLayers[0];
            logger.info(`🎹 Using available layer: ${layer}`);
          } else {
            // No layers ready, must load original
            logger.info(`🎹 No layers ready, loading ${originalLayer}...`);
            await this.loadLayer(originalLayer);
            layer = originalLayer;
          }
        }
      }

      // Get the sampler for selected layer
      let sampler = this.samplers.get(layer);

      if (sampler) {
        try {
          // Wait for the sampler to be fully loaded
          try {
            await sampler.loaded;

          } catch (e) {
            // If the loaded promise fails, try to reload
            logger.warn(
              `🎹 Sampler loaded promise failed for layer ${layer}, reloading...`,
            );
            await this.loadLayer(layer);
            sampler = this.samplers.get(layer);
            if (sampler) {
              try {
                await sampler.loaded;
              } catch (reloadError) {
                logger.error(
                  `🎹 Failed to reload layer ${layer}:`,
                  reloadError,
                );
                continue; // Skip this note
              }
            }
          }

          // Playing note

          // Convert MIDI velocity to Tone.js velocity (0-1)
          const normalizedVelocity = velocity / 127;

          // Store the velocity for this note
          this.activeNotes.set(currentNote, velocity);

          // Schedule the note
          // CRITICAL FIX: Use the original time parameter, not baseTime
          // This preserves Transport-relative timing like "+0.05"
          const noteTime = time;

          // For triggerAttackRelease, we need to handle the release manually
          // since we want to trigger the mechanical sound
          const noteDurationSeconds = Tone.Time(duration).toSeconds();
          // Only convert to absolute time when we need it for calculations
          const actualNoteTime =
            noteTime !== undefined
              ? Tone.Time(noteTime).toSeconds()
              : Tone.now();
          const releaseTime = actualNoteTime + noteDurationSeconds;

          // Debug log scheduling
          if (noteTime !== undefined) {
            logger.info(
              `🎹 Scheduling note ${currentNote} at time ${noteTime} (current: ${Tone.now()})`,
            );
          } else {
            logger.info(
              `🎹 Playing note ${currentNote} immediately at ${Tone.now()}`,
            );
          }

          // Use triggerAttackRelease but also schedule our custom release handling
          try {
            logger.info(
              `🎹🎵 SalamanderVelocitySampler.triggerAttackRelease: note=${currentNote}, time=${noteTime}, Transport.state=${Tone.Transport.state}, Transport.seconds=${Tone.Transport.seconds}`,
            );

            // Ensure sampler is connected before playing
            if (this.destination && !sampler.numberOfOutputs) {
              logger.info(`🎹 Connecting sampler ${layer} before playing`);
              safeConnect(sampler, this.destination, `sampler-${layer}-play`);
            }

            // Trust that Tone.Sampler's onload callback means it's ready
            // No need to check internal _buffers

            // For test/preview playback, use immediate timing if Transport is stopped
            let finalTime = noteTime;
            if (typeof noteTime === 'string' && noteTime.startsWith('+')) {
              // Check if Tone is available in the correct scope
              if (
                Tone &&
                Tone.Transport &&
                Tone.Transport.state === 'stopped'
              ) {
                // Use immediate timing for stopped transport
                finalTime = Tone.now();
              }
            }

            // DEBUG: Check sampler state before playing
            logger.info(`🎹 Sampler state check for ${layer}:`, {
              samplerLoaded: sampler.loaded,
              hasVolume: !!sampler.volume,
              samplerType: sampler.constructor.name,
              isConnected: !!this.destination
            });
            
            // Check if sampler has volume control
            if (sampler.volume) {
              logger.info(`🎹 Sampler volume details for ${layer}:`, {
                volumeValue: sampler.volume.value,
                volumeMuted: sampler.volume.mute,
                volumeType: typeof sampler.volume.value
              });
              
              // Force unmute if needed
              if (sampler.volume.mute) {
                logger.warn(`🎹 WARNING: Sampler ${layer} is muted! Unmuting...`);
                sampler.volume.mute = false;
              }
              
              // Don't force volume changes - let it use its default value
              // The sampler's volume control is handled through the gain node chain
              if (sampler.volume.value !== undefined) {
                logger.info(`🎹 Sampler ${layer} volume: ${sampler.volume.value}dB (not modifying)`);
                
                // If volume is extremely low or muted, warn but don't change
                if (sampler.volume.value === -Infinity || sampler.volume.value < -40) {
                  logger.warn(`🎹 WARNING: Sampler ${layer} volume is very low: ${sampler.volume.value}dB`);
                  logger.warn(`🎹 If no sound is heard, check the audio routing and gain stages`);
                }
              }
            } else {
              logger.info(`🎹 Sampler ${layer} has no volume property - volume controlled through gain node chain`);
            }
            
            
            sampler.triggerAttackRelease(
              currentNote,
              duration,
              finalTime,
              normalizedVelocity,
            );
            
            logger.info(`🎹 SUCCESS: triggerAttackRelease completed for ${currentNote} on layer ${layer}`, {
              samplerVolume: sampler.volume?.value,
              samplerMuted: sampler.volume?.mute,
              samplerLoaded: sampler.loaded,
              destination: this.destination,
              isConnected: sampler._output !== undefined,
              hasOutput: !!sampler.output,
              outputType: sampler.output?.constructor?.name,
              internalChannels: sampler.output?._internalChannels?.length
            });
            
            // DEBUG: Check if sampler is actually connected to output chain
            if (sampler._output) {
              logger.info('🎹 Sampler _output exists:', {
                outputType: sampler._output.constructor?.name,
                hasConnect: typeof sampler._output.connect === 'function'
              });
            }
            
          } catch (error) {
            // Don't log buffer errors to console.error - they're expected during loading
            if (error instanceof Error && error.message.includes('buffer')) {
              logger.info(
                `🎹 Buffer not ready for note ${currentNote} in layer ${layer}, using fallback...`,
              );
            } else {
              logger.error(
                `Error playing note ${currentNote} in layer ${layer}:`,
                error,
              );
            }

            // If the error is about buffer not loaded, try to use a fallback layer
            if (error instanceof Error && error.message.includes('buffer')) {
              logger.info(`🎹 Layer ${layer} not loaded, trying fallback...`);

              // Find a loaded layer close to the desired velocity
              let fallbackLayer = null;
              const velocityRange = this.getLayerForVelocity(velocity);

              // Try common layers first - optimized to match our default loading
              const commonLayers = ['v1', 'v6', 'v10', 'v14', 'v16'];
              logger.info(
                `🎹 Looking for fallback layer for ${currentNote}...`,
              );
              for (const commonLayer of commonLayers) {
                const candidateSampler = this.samplers.get(commonLayer);
                if (candidateSampler) {
                  logger.info(
                    `🎹 Checking layer ${commonLayer}: exists=true`,
                  );
                  fallbackLayer = commonLayer;
                  break;
                }
              }

              // If no common layer can play this note, try all loaded layers
              if (!fallbackLayer) {
                for (const [layerName, candidateSampler] of this.samplers) {
                  if (candidateSampler) {
                    fallbackLayer = layerName;
                    break;
                  }
                }
              }

              if (fallbackLayer) {
                const fallbackSampler = this.samplers.get(fallbackLayer);
                if (fallbackSampler) {
                  try {
                    logger.info(
                      `🎹 Using fallback layer ${fallbackLayer} for note ${currentNote}`,
                    );
                    fallbackSampler.triggerAttackRelease(
                      currentNote,
                      duration,
                      noteTime,
                      normalizedVelocity,
                    );
                    // Don't return - continue with other notes
                  } catch (fallbackError) {
                    logger.error(
                      `🎹 Fallback also failed for ${currentNote}:`,
                      fallbackError,
                    );
                  }
                }
              } else {
                logger.error(
                  `🎹 No loaded sampler can play note ${currentNote}`,
                );
                logger.info(
                  `🎹 Checked samplers:`,
                  Array.from(this.samplers.keys()).join(', '),
                );
                
                // Emergency fallback: Create a simple sine wave for the note
                logger.info(`🎹 Creating emergency sine wave fallback for ${currentNote}`);
                try {
                  // Simple MIDI to frequency conversion (A4 = 440Hz, MIDI 69)
                  const noteNum = parseInt(currentNote.replace(/[A-G#]/g, '')) || 60; // Default to C4
                  const freq = 440 * Math.pow(2, (noteNum - 69) / 12);
                  // Get the audio context from persistent context first
                  const ctx = this.audioContext || getPersistentAudioContext() || this.preferredContext || Tone?.context?._context || Tone?.getContext?.()?._context;
                  if (!ctx) {
                    throw new Error('No audio context available for emergency fallback');
                  }
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  
                  osc.frequency.value = freq;
                  osc.type = 'sine';
                  gain.gain.setValueAtTime(normalizedVelocity * 0.1, noteTime); // Quiet fallback
                  gain.gain.exponentialRampToValueAtTime(0.001, noteTime + parseFloat(duration));
                  
                  osc.start(noteTime);
                  osc.stop(noteTime + parseFloat(duration));
                  
                  logger.info(`🎹 Emergency fallback played for ${currentNote} at ${freq}Hz`);
                } catch (emergencyError) {
                  logger.error(`🎹 Emergency fallback also failed for ${currentNote}:`, emergencyError);
                }
                logger.info(
                  `🎹 Loaded layers:`,
                  Array.from(this.loadedLayers).join(', '),
                );
              }
            }

            // Try loading this specific layer for future use
            if (!this.loadedLayers.has(layer)) {
              logger.info(
                `🎹 Queuing layer ${layer} for background loading...`,
              );
              this.loadLayer(layer).catch((err) =>
                logger.error(
                  `🎹 Background loading of layer ${layer} failed:`,
                  err,
                ),
              );
            }
          }

          // Schedule the mechanical release sound
          if (
            playMechanicalSounds &&
            this.damperReleaseSampler &&
            this.damperReleaseSampler.loaded
          ) {
            const releaseDelay = noteDurationSeconds * 1000; // Convert to milliseconds

            setTimeout(() => {
              try {
                // Play the mechanical damper release sound
                const mechanicalVolumeDb =
                  this.calculateMechanicalVolume(velocity);

                // Create a one-shot player for the damper release
                const releasePlayer = new Tone.Player(
                  this.damperReleaseSampler!.buffer,
                );

                // Track volume node for cleanup
                let volumeNode: Tone.Volume | null = null;

                // Calculate combined volume: mechanical volume + velocity-based adjustment
                const totalVolumeDb =
                  mechanicalVolumeDb + this.mechanicalVolumeDb;

                // Create a single volume node with the combined volume
                volumeNode = new Tone.Volume(totalVolumeDb);

                // Connect the chain: releasePlayer -> volumeNode -> destination
                if (
                  safeConnect(
                    releasePlayer,
                    volumeNode,
                    'releasePlayer->volumeNode',
                  )
                ) {
                  volumeNode.toDestination();
                } else {
                  // If connection fails, go direct
                  releasePlayer.toDestination();
                }

                // Play immediately (with small offset)
                const damperTime = Tone.now() + this.damperReleaseOffset;
                releasePlayer.start(damperTime);

                // Clean up after 1 second
                setTimeout(() => {
                  releasePlayer.dispose();
                  // Also dispose of the volume node we created
                  if (volumeNode) {
                    volumeNode.dispose();
                  }
                }, 1000);
              } catch (error) {
                logger.warn('Failed to play damper release sound:', error);
              }

              // Remove from active notes
              this.activeNotes.delete(currentNote);
            }, releaseDelay);
          }
        } catch (error) {
          logger.error(
            `Error playing note ${currentNote} in layer ${layer}:`,
            error,
          );
        }
      } else {
        logger.warn(`Sampler for layer ${layer} not found`);
      }
    }
  }

  /**
   * Trigger attack (note on)
   */
  async triggerAttack(
    note: string | string[],
    time?: Tone.Unit.Time,
    velocity = 64,
  ): Promise<void> {
    const notes = Array.isArray(note) ? note : [note];
    const layer = this.getLayerForVelocity(velocity);

    if (!this.loadedLayers.has(layer)) {
      await this.loadLayer(layer);
    }

    const sampler = this.samplers.get(layer);
    if (sampler) {
      const normalizedVelocity = velocity / 127;
      sampler.triggerAttack(notes, time, normalizedVelocity);

      // Store the velocity for each note so we can use it for release
      for (const n of notes) {
        this.activeNotes.set(n, velocity);
      }
    }
  }

  /**
   * Trigger release (note off) with mechanical damper sound
   */
  triggerRelease(
    note: string | string[],
    time?: Tone.Unit.Time,
    playMechanicalSounds = true,
  ): void {
    const notes = Array.isArray(note) ? note : [note];
    const releaseTime = time !== undefined ? time : Tone.now();

    // Release on all loaded samplers to handle velocity changes
    this.samplers.forEach((sampler) => {
      sampler.triggerRelease(notes, releaseTime);
    });

    // Play mechanical damper release sounds for each note
    if (
      playMechanicalSounds &&
      this.damperReleaseSampler &&
      this.damperReleaseSampler.loaded
    ) {
      for (const currentNote of notes) {
        try {
          // Get the velocity that was used when this note was played
          const velocity = this.activeNotes.get(currentNote) || 64;

          // Schedule the mechanical damper release sound
          const damperTime = releaseTime + this.damperReleaseOffset;
          const mechanicalVolumeDb = this.calculateMechanicalVolume(velocity);

          // Create a one-shot player for the damper release
          const releasePlayer = new Tone.Player(
            this.damperReleaseSampler.buffer,
          );

          // Track volume node for cleanup
          let volumeNode: Tone.Volume | null = null;

          // Calculate combined volume: mechanical volume + velocity-based adjustment
          const totalVolumeDb = mechanicalVolumeDb + this.mechanicalVolumeDb;

          // Create a single volume node with the combined volume
          volumeNode = new Tone.Volume(totalVolumeDb);

          // Connect the chain: releasePlayer -> volumeNode -> destination
          if (
            safeConnect(releasePlayer, volumeNode, 'releasePlayer->volumeNode')
          ) {
            volumeNode.toDestination();
          } else {
            // If connection fails, go direct
            releasePlayer.toDestination();
          }

          releasePlayer.start(damperTime);

          // Clean up after 1 second
          setTimeout(() => {
            releasePlayer.dispose();
            // Also dispose of the volume node we created
            if (volumeNode) {
              volumeNode.dispose();
            }
          }, 1000);
        } catch (error) {
          logger.warn(
            'Failed to play damper release sound for note:',
            currentNote,
            error,
          );
        }

        // Remove from active notes
        this.activeNotes.delete(currentNote);
      }
    }
  }

  /**
   * Calculate mechanical volume based on velocity
   * Similar to Wurlitzer but adapted for grand piano characteristics
   */
  private calculateMechanicalVolume(velocity: number): number {
    // Salamander piano: Scale from 0dB at velocity 127 down to -30dB at velocity 1
    const normalized = velocity / 127;
    // Linear scaling from -30dB to 0dB
    const scaledVolume = -30 + 30 * normalized;
    return scaledVolume;
  }

  /**
   * Set mechanical sounds base volume (in dB)
   */
  setMechanicalVolume(volumeDb: number): void {
    this.mechanicalVolumeDb = volumeDb;
  }

  /**
   * Set damper release timing offset (in seconds after note release)
   * Typical value for acoustic grand piano: 0.080 (80ms)
   */
  setDamperReleaseOffset(offsetSeconds: number): void {
    this.damperReleaseOffset = offsetSeconds;
  }

  /**
   * Connect all samplers to destination
   */
  connect(destination: Tone.InputNode): this {
    logger.info('SalamanderVelocitySampler.connect called with:', destination);

    // Validate destination
    if (!destination) {
      logger.error('Cannot connect to null/undefined destination');
      return this;
    }
    
    // DEBUG: Check what type of destination we're connecting to
    logger.info('🎹 SalamanderVelocitySampler destination info:', {
      destinationType: destination.constructor?.name,
      isGainNode: destination instanceof GainNode,
      isToneNode: destination._nativeAudioNode !== undefined,
      nativeNode: destination._nativeAudioNode,
      hasInputProperty: destination.input !== undefined
    });

    // Check if destination is a native Web Audio API node and ensure Tone uses the same context
    if (
      destination &&
      (destination instanceof GainNode || destination instanceof AudioNode)
    ) {
      const destinationContext = destination.context;
      if (destinationContext) {
        // Ensure Tone.js is loaded with the correct context
        (async () => {
          await ensureToneLoaded(destinationContext);

          if (
            Tone &&
            Tone.context &&
            destinationContext !== Tone.context._context
          ) {
            // Don't log - this is expected when using persistent context
            // DO NOT call Tone.setContext() - it invalidates all cached buffers!
            // The connection will handle context bridging
          }
        })();
      }
    }

    // Check if destination is a valid audio node
    // Accept Tone.js nodes, native Web Audio API nodes, or objects with input property
    const isValidDestination =
      (Tone &&
        (destination instanceof Tone.ToneAudioNode ||
          destination === Tone.Destination)) ||
      (destination &&
        typeof destination === 'object' &&
        ('input' in destination ||
          destination.constructor?.name === 'GainNode' ||
          destination.constructor?.name === 'AudioNode' ||
          destination instanceof GainNode ||
          destination instanceof AudioNode ||
          typeof destination.connect === 'function'));

    if (!isValidDestination) {
      logger.error('Invalid destination type:', destination);
      return this;
    }

    this.destination = destination;

    // Connect all loaded samplers
    this.samplers.forEach((sampler, layer) => {
      if (sampler) {
        try {
          logger.info(`🎹 Connecting sampler layer ${layer} to destination`);
          
          // CRITICAL FIX: Use Tone.js native connect method
          if (sampler.connect) {
            // First disconnect if already connected
            try {
              sampler.disconnect();
            } catch (e) {
              // Ignore disconnect errors
            }
            
            // Connect using Tone's method which handles context bridging
            sampler.connect(destination);
            logger.info(`✅ Connected sampler layer ${layer} to destination using Tone.connect()`);
            
            // Verify connection
            logger.info(`🎹 Verifying connection for layer ${layer}:`, {
              hasOutput: !!sampler.output,
              outputConnected: sampler.output?._internalChannels?.length > 0,
              destination: destination?.constructor?.name
            });
          } else {
            logger.error(`Sampler layer ${layer} has no connect method`);
          }
        } catch (err) {
          logger.error(`Failed to connect sampler layer ${layer}:`, err);
          
          // Try fallback to Tone.Destination
          try {
            sampler.toDestination();
            logger.info(`✅ Connected layer ${layer} to Tone.Destination as fallback`);
          } catch (fallbackErr) {
            logger.error(`Failed fallback connection:`, fallbackErr);
          }
        }
      }
    });

    // No need to reconnect mechanical volume since we're calculating it per-note now

    return this;
  }

  /**
   * Disconnect all samplers
   */
  disconnect(): this {
    this.samplers.forEach((sampler) => {
      sampler.disconnect();
    });
    return this;
  }

  /**
   * Preload specific velocity layers
   */
  async preloadLayers(layers: string[]): Promise<void> {
    await Promise.all(layers.map((layer) => this.loadLayer(layer)));
  }

  /**
   * Smart loading: Preload only specific notes needed for an exercise
   * This dramatically reduces loading time from Supabase
   */
  async preloadNotes(notes: string[]): Promise<void> {
    logger.info('🎹 Smart loading: Preloading only notes:', notes);

    // Determine which velocity layers to load based on typical dynamics
    const velocityLayers = ['v6', 'v10', 'v14']; // p, mf, f - most common for practice

    // Load layers if not already loaded
    for (const layer of velocityLayers) {
      if (!this.loadedLayers.has(layer)) {
        logger.info(`🎹 Loading velocity layer ${layer} for smart loading...`);

        try {
          // Create a minimal sampler with only the required notes
          const sampler = new Tone.Sampler({
            urls: notes.reduce(
              (acc, note) => {
                // Map note to sample file (e.g., C4 -> C4.mp3)
                acc[note] = `${note}.mp3`;
                return acc;
              },
              {} as Record<string, string>,
            ),
            baseUrl: this.useLocalSamples
              ? `${this.localSamplesPath}/${layer}/`
              : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`,
            release: 0.05,
            attack: 0.002,
            onload: () => {
              logger.info(
                `✅ Smart loaded ${notes.length} notes for layer ${layer}`,
              );
            },
            onerror: (error) => {
              logger.error(`❌ Failed to smart load layer ${layer}:`, error);
            },
          });

          await sampler.loaded;
          this.samplers.set(layer, sampler);
          this.loadedLayers.add(layer);
        } catch (error) {
          logger.error(
            `❌ Failed to create sampler for layer ${layer}:`,
            error,
          );
        }
      }
    }

    logger.info('✅ Smart loading complete!');
  }

  /**
   * Preload specific velocity layers based on velocity values
   */
  async preloadVelocities(velocities: number[]): Promise<void> {
    const layersToLoad = new Set<string>();

    // Determine which layers we need
    for (const velocity of velocities) {
      const layer = this.getLayerForVelocity(velocity);
      layersToLoad.add(layer);
    }

    // Load all required layers
    await this.preloadLayers(Array.from(layersToLoad));
  }

  /**
   * Preload all 16 velocity layers
   * Warning: This will use ~150MB of memory
   */
  async preloadAll(): Promise<void> {
    const allLayers = this.velocityRanges.map((r) => r.layer);
    await this.preloadLayers(allLayers);
  }

  /**
   * Unload specific layers to free memory
   */
  unloadLayers(layers: string[]): void {
    layers.forEach((layer) => {
      const sampler = this.samplers.get(layer);
      if (sampler) {
        sampler.dispose();
        this.samplers.delete(layer);
        this.loadedLayers.delete(layer);
        // Unloaded velocity layer
      }
    });
  }

  /**
   * Get loading status
   */
  getStatus(): {
    initialized: boolean;
    loadedLayers: string[];
    totalLayers: number;
    memoryEstimate: string;
    isReady?: boolean;
  } {
    const loadedCount = this.loadedLayers.size;
    const memoryMB = loadedCount * 9.5; // ~9.5MB per layer


    return {
      initialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers).sort(),
      totalLayers: this.velocityRanges.length,
      memoryEstimate: `~${memoryMB.toFixed(0)}MB`,
      isReady: this.isInitialized && this.loadedLayers.size > 0,
      isV10Ready: this.loadedLayers.has('v10') // Critical for test button
    };
  }

  /**
   * Check if a specific velocity layer is ready
   * Useful for checking if critical layers are loaded before playback
   */
  isLayerReady(layer: string): boolean {
    return this.loadedLayers.has(layer) && this.samplers.has(layer);
  }

  /**
   * Stop all active notes immediately without mechanical sounds
   * Professional DAW implementation - cuts sound regardless of scheduled duration
   */
  stopAll(): void {
    // logger.info(
    //   '🚨 SalamanderVelocitySampler.stopAll() - PROFESSIONAL DAW STOP - cuts scheduled duration active notes:',
    //   'active notes:', this.activeNotes.size,
    // );

    // CRITICAL: Cancel all scheduled Transport events to prevent future notes
    if (Tone && Tone.Transport) {
      try {
        // Cancel all events starting from slightly in the past to catch any that might be "in flight"
        const now = Tone.Transport.seconds;
        const cancelFrom = Math.max(0, now - 0.1); // Go back 100ms to catch in-flight events
        Tone.Transport.cancel(cancelFrom);
        // logger.info(`🚨 Cancelled all Transport events from ${cancelFrom} (now: ${now})`);
      } catch (error) {
        logger.warn('Failed to cancel Transport events:', error);
      }
    }

    // Stop all notes on all samplers immediately - PROFESSIONAL DAW APPROACH
    this.samplers.forEach((sampler, layer) => {
      try {
        // logger.info(`🚨 EMERGENCY STOP: layer ${layer} - cutting volume and stopping all voices`);

        // CRITICAL: IMMEDIATE GAIN CUTTING - This stops sound instantly regardless of scheduled duration
        if (sampler.volume && sampler.volume.value !== undefined) {
          sampler.volume.value = -Infinity; // Immediate silence
          // logger.info(`🚨 Set sampler.volume.value = -Infinity for layer ${layer}`);
        } else if (sampler.volume && sampler.volume.gain) {
          sampler.volume.gain.value = 0; // Immediate silence
          // logger.info(`🚨 Set sampler.volume.gain.value = 0 for layer ${layer}`);
        }

        // Set envelope to immediate release
        const originalEnvelope = {
          attack: sampler.attack,
          decay: sampler.decay,
          sustain: sampler.sustain,
          release: sampler.release,
        };

        // Set to immediate silence
        sampler.attack = 0;
        sampler.decay = 0;
        sampler.sustain = 0;
        sampler.release = 0;

        // Release all notes
        sampler.releaseAll(Tone.immediate());

        // Also try to access internal voices for more aggressive stopping
        if (sampler._voices && Array.isArray(sampler._voices)) {
          logger.info(
            `🚨 Found ${sampler._voices.length} internal voices to stop in layer ${layer}`,
          );
          sampler._voices.forEach((voice: any, idx: number) => {
            // IMMEDIATE GAIN CUTTING on individual voices
            if (voice && voice.volume) {
              if (voice.volume.value !== undefined) {
                voice.volume.value = -Infinity;
                logger.info(`🚨 Set voice[${idx}].volume.value = -Infinity`);
              } else if (voice.volume.gain) {
                voice.volume.gain.value = 0;
                logger.info(`🚨 Set voice[${idx}].volume.gain.value = 0`);
              }
            }
            if (voice && voice.stop) {
              voice.stop(Tone.immediate());
              logger.info(`🚨 Called voice[${idx}].stop(immediate)`);
            }
          });
        }

        // Try to clear any internal scheduled events
        if (
          (sampler as any)._scheduled &&
          Array.isArray((sampler as any)._scheduled)
        ) {
          logger.info(
            `🚨 Clearing ${(sampler as any)._scheduled.length} scheduled events`,
          );
          (sampler as any)._scheduled.length = 0;
        }

        // Force disconnect and reconnect to ensure clean state
        try {
          sampler.disconnect();
          if (this.destination) {
            safeConnect(
              sampler,
              this.destination,
              `sampler-${layer}-reconnect`,
            );
          }
        } catch (err) {
          logger.warn(`Failed to disconnect/reconnect sampler ${layer}:`, err);
        }

        // Also manually stop all voices if available
        if (sampler.voice && typeof sampler.voice === 'function') {
          const voices = sampler.voice(-1); // Get all voices
          if (voices && voices.stop) {
            voices.stop(Tone.immediate());
          }
        }

        // Restore envelope and volume after emergency stop
        setTimeout(() => {
          sampler.attack = originalEnvelope.attack;
          sampler.decay = originalEnvelope.decay;
          sampler.sustain = originalEnvelope.sustain;
          sampler.release = originalEnvelope.release;

          // DO NOT restore volume here - it will be restored when playing next note
          // This prevents scheduled notes from resuming after panic
          // logger.info(`🎹 Volume remains muted for layer ${layer} until next play`);
          this.volumeWasMuted = true;
        }, 100);
      } catch (error) {
        logger.warn(`Failed to stop voices on layer ${layer}:`, error);
      }
    });

    // Clear active notes tracking
    this.activeNotes.clear();
    // logger.info('🚨 PROFESSIONAL STOP: All samplers emergency stopped - sound cut regardless of scheduled duration');
  }

  /**
   * MIDI Panic - All Notes Off (Professional DAW implementation)
   * Implements CC#123 (All Notes Off)
   */
  public allNotesOff(): void {
    // logger.info('🚨 SalamanderVelocitySampler.allNotesOff() - MIDI CC#123');
    this.stopAll();
  }

  /**
   * MIDI Panic - All Sound Off (Professional DAW implementation)
   * Implements CC#120 (All Sound Off) - immediate silence
   */
  public allSoundOff(): void {
    // logger.info('🚨 SalamanderVelocitySampler.allSoundOff() - MIDI CC#120 - IMMEDIATE GAIN CUTTING');
    // logger.info(`🚨 BEFORE allSoundOff: activeNotes=${this.activeNotes.size}, samplers=${this.samplers.size}`);

    // CRITICAL: IMMEDIATE GAIN CUTTING - Set volume to 0 immediately to stop ALL sound
    this.samplers.forEach((sampler, layer) => {
      if (sampler && sampler.loaded) {
        try {
          // logger.info(`🚨 EMERGENCY: Cutting gain to 0 for layer ${layer}`);

          // 1. IMMEDIATE GAIN CUTTING - This stops the sound instantly
          if (sampler.volume && sampler.volume.value !== undefined) {
            sampler.volume.value = -Infinity; // Immediate silence
            // logger.info(`🚨 Set sampler.volume.value = -Infinity for layer ${layer}`);
          } else if (sampler.volume && sampler.volume.gain) {
            sampler.volume.gain.value = 0; // Immediate silence
            // logger.info(`🚨 Set sampler.volume.gain.value = 0 for layer ${layer}`);
          }

          // 2. Force immediate stop of all voices without release envelope
          sampler.releaseAll(0); // Immediate release
          // logger.info(`🚨 Called releaseAll(0) for layer ${layer}`);

          // 3. Try to access and stop internal voices directly
          if (sampler._voices && Array.isArray(sampler._voices)) {
            logger.info(
              `🚨 Found ${sampler._voices.length} internal voices in layer ${layer}`,
            );
            sampler._voices.forEach((voice: any, idx: number) => {
              if (voice && voice.volume) {
                if (voice.volume.value !== undefined) {
                  voice.volume.value = -Infinity;
                  logger.info(`🚨 Set voice[${idx}].volume.value = -Infinity`);
                } else if (voice.volume.gain) {
                  voice.volume.gain.value = 0;
                  logger.info(`🚨 Set voice[${idx}].volume.gain.value = 0`);
                }
              }
              if (voice && voice.stop) {
                voice.stop(Tone.immediate());
                logger.info(`🚨 Called voice[${idx}].stop(immediate)`);
              }
            });
          }

          // logger.info(`🚨 Emergency gain cutting completed for layer ${layer}`);
        } catch (error) {
          logger.error(`🚨 Failed to emergency stop layer ${layer}:`, error);
        }
      }
    });

    // Clear active notes tracking
    this.activeNotes.clear();
    // logger.info(`🚨 AFTER allSoundOff: activeNotes cleared, samplers processed`);
  }

  /**
   * MIDI Panic - General panic button
   * Combines CC#120 (All Sound Off) and CC#123 (All Notes Off)
   */
  public panic(): void {
    // logger.info('🚨 SalamanderVelocitySampler.panic() - Professional MIDI Panic');
    this.allSoundOff();
    this.allNotesOff();
  }

  /**
   * MIDI Panic - Emergency stop with node disposal
   * Nuclear option when normal panic doesn't work
   */
  public midiPanic(): void {
    // logger.info('🚨 SalamanderVelocitySampler.midiPanic() - Emergency MIDI Panic');

    try {
      // 1. Immediate stop all
      this.allSoundOff();

      // 2. Cancel all scheduled Transport events
      if (Tone && Tone.getTransport) {
        const transport = Tone.getTransport();
        if (transport) {
          transport.cancel(0);
          logger.info('🚨 Cancelled all Salamander Transport events');
        }
      }

      // 3. Emergency: Disconnect and reconnect samplers to force audio cessation
      setTimeout(() => {
        this.samplers.forEach((sampler, layer) => {
          if (sampler && sampler.loaded) {
            try {
              // Force disconnect and reconnect to destination
              sampler.disconnect();
              if (this.destination) {
                sampler.connect(this.destination);
              }
              // logger.info(`🚨 Emergency reconnected layer ${layer}`);
            } catch (error) {
              logger.warn(
                `🚨 Emergency reconnection failed for layer ${layer}:`,
                error,
              );
            }
          }
        });
      }, 10);
    } catch (error) {
      logger.error('🚨 SalamanderVelocitySampler.midiPanic() failed:', error);
    }
  }

  /**
   * Preview a note - plays sound even when in STOP/panic state
   * This allows auditioning sounds while transport is stopped
   */
  public previewNote(note: string, velocity = 127, duration = '8n'): void {
    logger.info(
      `🎹 SalamanderVelocitySampler.previewNote(${note}, velocity=${velocity}) - PREVIEW MODE`,
    );

    if (!this.isInitialized) {
      logger.warn('🎹 Cannot preview - sampler not initialized');
      return;
    }

    // Check if we're currently in a STOP/panic state (volume muted)
    const isInPanicState = Array.from(this.samplers.values()).some(
      (sampler) => {
        if (sampler && sampler.volume) {
          return (
            sampler.volume.value === -Infinity ||
            (sampler.volume.gain && sampler.volume.gain.value === 0)
          );
        }
        return false;
      },
    );

    if (isInPanicState) {
      logger.info(
        '🎹 Preview: Temporarily restoring volume for preview playback',
      );

      // Temporarily restore volume for all samplers
      this.samplers.forEach((sampler, layer) => {
        if (sampler && sampler.loaded && sampler.volume) {
          try {
            // Restore to a reasonable preview volume (slightly lower than normal)
            const previewVolume = -6; // -6dB for preview
            if (sampler.volume.value !== undefined) {
              sampler.volume.value = previewVolume;
            } else if (sampler.volume.gain) {
              sampler.volume.gain.value = Math.pow(10, previewVolume / 20); // Convert dB to linear gain
            }
            logger.info(`🎹 Restored preview volume for layer ${layer}`);
          } catch (error) {
            logger.warn(
              `🎹 Failed to restore preview volume for layer ${layer}:`,
              error,
            );
          }
        }
      });
    }

    // Play the preview note
    try {
      this.triggerAttackRelease(note, duration, '+0.01', velocity);
      logger.info(`🎹 Preview note played: ${note}`);
    } catch (error) {
      logger.warn('🎹 Failed to play preview note:', error);
    }

    // If we were in panic state, restore the muted state after preview
    if (isInPanicState) {
      setTimeout(() => {
        logger.info('🎹 Preview: Restoring STOP muting after preview');
        this.samplers.forEach((sampler, layer) => {
          if (sampler && sampler.loaded && sampler.volume) {
            try {
              if (sampler.volume.value !== undefined) {
                sampler.volume.value = -Infinity;
              } else if (sampler.volume.gain) {
                sampler.volume.gain.value = 0;
              }
              logger.info(`🎹 Restored STOP muting for layer ${layer}`);
            } catch (error) {
              logger.warn(
                `🎹 Failed to restore STOP muting for layer ${layer}:`,
                error,
              );
            }
          }
        });
      }, 800); // Allow enough time for the note to be heard
    }
  }

  /**
   * Dispose all samplers and free memory
   */
  dispose(): void {
    // Stop all active notes first
    this.stopAll();

    this.samplers.forEach((sampler) => sampler.dispose());
    this.samplers.clear();
    this.loadedLayers.clear();
    this.loadingPromises.clear();

    if (this.damperReleaseSampler) {
      this.damperReleaseSampler.dispose();
      this.damperReleaseSampler = null;
    }

    // No mechanical volume node to dispose anymore

    this.isInitialized = false;
    // Disposed sampler
  }
}

/**
 * Singleton instance for global use
 */
export const salamanderPiano = new SalamanderVelocitySampler();
