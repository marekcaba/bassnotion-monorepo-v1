/**
 * Professional Rhodes Piano sampler - REFACTORED
 * Now loads configuration from external JSON file
 * Reduced from 2,200+ lines to ~500 lines
 */

import {
  loadGlobalTone,
  CachedToneBufferLoader,
  getPersistentAudioContext,
  ensureToneUsesPersistentContext,
} from '../../../shared/index.js';
import { GlobalSampleCache } from '../../../storage/cache/GlobalSampleCache.js';
import { SampleMappingLoader } from '../../loaders/SampleMappingLoader.js';
import type {
  InstrumentSampleConfig,
  VelocityRange,
} from '../../types/sample-mapping.js';
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('RhodesVelocitySampler');

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

// Configuration file path
const CONFIG_PATH = 'instruments/piano/nice-keys-rhodes.json';

// FAANG-STYLE: Helper to ensure Tone.js is loaded independently
async function ensureToneLoaded(
  preferredContext?: AudioContext,
  audioEngine?: any,
): Promise<void> {
  // Use InstrumentDependencyManager for independent loading
  const { InstrumentDependencyManager } =
    await import('@/domains/playback/services/InstrumentDependencyManager.js');

  if (!Tone || preferredContext) {
    try {
      logger.info('🎵 Rhodes: Loading Tone.js independently...');
      Tone = await InstrumentDependencyManager.getTone();
      logger.info('🎵 Rhodes: Tone.js loaded successfully');

      if (!Tone || !Tone.context) {
        throw new Error('Tone.js loaded but has no context');
      }

      ensureToneUsesPersistentContext();
    } catch (error) {
      logger.error('🎵 Rhodes: Failed to load Tone.js', { error });
      throw new Error(
        `Failed to load Tone.js for Rhodes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export class RhodesVelocitySampler {
  private samplers: Map<string, any> = new Map();
  private config: InstrumentSampleConfig | null = null;
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: any | null = null;
  private activeNotes: Map<string, number> = new Map();
  private audioEngine?: any;
  private volumeWasMuted = false;
  private preferredContext: AudioContext | null = null;
  private audioContext: AudioContext | null = null;
  private useLocalSamples = false;
  private loader: SampleMappingLoader;

  constructor(audioEngine?: any) {
    this.audioEngine = audioEngine;
    this.loader = SampleMappingLoader.getInstance({
      basePath: '/src/domains/playback/data/',
      cache: true,
      validate: true,
    });
  }

  /**
   * Set the preferred AudioContext to use for all Tone.js operations
   */
  setPreferredContext(context: AudioContext): void {
    this.preferredContext = context;
    logger.info('🎹 RhodesVelocitySampler: Preferred AudioContext set');
  }

  /**
   * Initialize with commonly used velocity layers
   */
  async initialize(
    requiredNotes?: string[],
    velocityLayers?: string[],
    audioEngine?: any,
  ): Promise<void> {
    if (this.isInitialized) return;

    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    try {
      // Load configuration
      this.config = await this.loader.loadInstrumentConfig(CONFIG_PATH);
      logger.info('🎹 Loaded Rhodes configuration', {
        name: this.config.name,
        version: this.config.version,
        velocityRanges: this.config.velocityRanges.length,
        samples: Object.keys(this.config.sampleMapping).length,
      });

      // Check preloaded samples
      const checkPreloadedSamples = () => {
        let preloadedCount = 0;
        const layersToCheck = velocityLayers ||
          this.config!.defaultLayers || ['v1', 'v5', 'v9', 'v13', 'v16'];

        for (const layer of layersToCheck) {
          for (const note of Object.keys(this.config!.sampleMapping)) {
            const path = `${this.config!.storage.bucketPath}/${layer}/${note}.mp3`;
            if (GlobalSampleCache.getCachedUrl(path)) {
              preloadedCount++;
            }
          }
        }
        return preloadedCount;
      };

      const preloaded = checkPreloadedSamples();
      logger.info('🎹 Initializing Nice Keys Rhodes', {
        smartLoading: !!requiredNotes,
        notesCount: requiredNotes?.length || 'all',
        layers: velocityLayers || 'default',
        preloadedSamples: preloaded,
        expectedSamples:
          (velocityLayers?.length || this.config.defaultLayers?.length || 5) *
          Object.keys(this.config.sampleMapping).length,
      });

      await ensureToneLoaded(
        this.preferredContext || undefined,
        this.audioEngine,
      );

      // Tone.js validation removed - ensureToneLoaded() already handles loading and throws on failure

      this.audioContext =
        this.preferredContext ||
        getPersistentAudioContext() ||
        Tone?.context?._context ||
        (Tone as any)?._context;

      // Ensure Tone.js context is started
      try {
        if (!Tone.context) {
          throw new Error('Tone.js context is not initialized');
        }
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }
      } catch (error) {
        logger.error('Failed to start Tone.js context', { error });
      }

      // Create destination node
      this.destination = new (Tone as any).Gain(1);

      // CRITICAL FIX: DO NOT connect directly to destination (speakers)!
      // This was creating a ROGUE AUDIO PATH that bypassed gain control
      // Audio should only flow through: WamKeyboard.gainNode → Channel/Bus → Destination
      // Connection happens via connect() method when WamKeyboard initializes
      // this.destination.toDestination(); // ← REMOVED - was causing dual instrument playback

      logger.debug(
        '🎹 Initializing without direct toDestination (proper routing)',
      );

      // Check for InitialSamplePreloader usage
      const cachedBufferLoader = CachedToneBufferLoader.getInstance();
      const usesCachedLoader = cachedBufferLoader ? true : false;
      logger.info('🎹 Using CachedToneBufferLoader', {
        enabled: usesCachedLoader,
      });

      // Load optimized velocity layers based on config
      const layersToLoad = velocityLayers ||
        this.config.optimization?.preloadPriority ||
        this.config.defaultLayers || ['v9', 'v1', 'v16'];

      logger.info('🎹 Loading initial velocity layers', {
        layers: layersToLoad,
        smartLoading: !!requiredNotes,
        notesToLoad: requiredNotes?.length || 'all',
      });

      await this.loadInitialVelocityLayers(layersToLoad, requiredNotes);

      this.isInitialized = true;
      logger.info('✅ Rhodes Piano ready!', {
        loadedLayers: Array.from(this.loadedLayers),
        destination: !!this.destination,
      });

      // Wait a moment for everything to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.ensureReady();
    } catch (error) {
      logger.error(
        'Failed to initialize Rhodes:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Load initial velocity layers
   */
  private async loadInitialVelocityLayers(
    layersToLoad: string[],
    requiredNotes?: string[],
  ): Promise<void> {
    const loadPromises = layersToLoad.map((layer) =>
      this.loadLayer(layer, requiredNotes),
    );

    await Promise.all(loadPromises);

    for (const layer of layersToLoad) {
      const sampler = this.samplers.get(layer);
      if (sampler) {
        try {
          await sampler.loaded;
          logger.info(`✅ Layer ${layer} loaded`);
        } catch (error) {
          logger.error(`❌ Layer ${layer} failed to load`, { error });
        }
      }
    }
  }

  /**
   * Load a specific velocity layer
   */
  private async loadLayer(
    layer: string,
    requiredNotes?: string[],
  ): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    if (this.loadingPromises.has(layer)) {
      return this.loadingPromises.get(layer);
    }

    const loadPromise = (async () => {
      try {
        if (!this.config) {
          throw new Error('Configuration not loaded');
        }

        logger.info(`🎹 Loading Rhodes layer ${layer}`, {
          requiredNotes: requiredNotes?.length || 'all',
        });

        // Get sample URLs from loader
        const layerUrls = this.loader
          .getAllSampleUrls(this.config, [layer])
          .get(layer);
        if (!layerUrls) {
          throw new Error(`No URLs found for layer ${layer}`);
        }

        // Convert Map to object and filter by required notes if specified
        const sampleUrls: Record<string, string> = {};
        for (const [note, url] of layerUrls.entries()) {
          if (!requiredNotes || requiredNotes.includes(note)) {
            sampleUrls[note] = url;
          }
        }

        logger.info(
          `🎹 Loading ${Object.keys(sampleUrls).length} samples for layer ${layer}`,
        );

        // Create Tone.js Sampler
        const sampler = await this.createSampler(sampleUrls);

        // Connect to destination
        if (this.destination) {
          sampler.connect(this.destination);
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);

        logger.info(`✅ Loaded Rhodes layer ${layer}`);
      } catch (error) {
        logger.error(
          `❌ Failed to load layer ${layer}:`,
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      } finally {
        this.loadingPromises.delete(layer);
      }
    })();

    this.loadingPromises.set(layer, loadPromise);
    return loadPromise;
  }

  /**
   * Create a Tone.js Sampler with the provided samples
   */
  private async createSampler(urls: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const baseUrl = this.useLocalSamples
        ? this.config?.storage.localPath || ''
        : '';

      const sampler = new (Tone as any).Sampler({
        urls,
        baseUrl,
        release: this.config?.samplerConfig?.release || 0.3,
        attack: this.config?.samplerConfig?.attack || 0.005,
        onload: () => {
          logger.info('✅ Sampler loaded successfully');
          resolve(sampler);
        },
        onerror: (error: any) => {
          logger.error(
            '❌ Error loading sampler:',
            error instanceof Error ? error : new Error(String(error)),
          );
          reject(error);
        },
      });
    });
  }

  /**
   * Get the appropriate layer for a velocity value
   */
  private getLayerForVelocity(velocity: number): string {
    if (!this.config) return 'v9';

    const v = Math.max(0, Math.min(127, velocity));
    const range = this.config.velocityRanges.find(
      (r) => v >= r.min && v <= r.max,
    );
    return range ? range.layer : 'v9';
  }

  /**
   * Play a note
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: any,
    time?: any,
    velocity = 80,
  ): Promise<void> {
    if (!this.isInitialized || !this.config) {
      logger.warn('🎹 Rhodes not initialized, cannot play');
      return;
    }

    const notes = Array.isArray(note) ? note : [note];
    let layer = this.getLayerForVelocity(velocity);

    // Ensure layer is loaded
    if (!this.loadedLayers.has(layer)) {
      const fallbackLayer = Array.from(this.loadedLayers)[0];
      if (fallbackLayer) {
        logger.info(`🎹 Layer ${layer} not ready, using ${fallbackLayer}`);
        layer = fallbackLayer;
      } else {
        logger.warn('🎹 No layers loaded yet');
        return;
      }
    }

    const sampler = this.samplers.get(layer);
    if (sampler && sampler.loaded) {
      try {
        const normalizedVelocity = velocity / 127;
        sampler.triggerAttackRelease(notes, duration, time, normalizedVelocity);

        // Track notes
        for (const n of notes) {
          this.activeNotes.set(n, velocity);
        }

        // Clean up after note ends
        if (typeof duration === 'number') {
          setTimeout(() => {
            for (const n of notes) {
              this.activeNotes.delete(n);
            }
          }, duration * 1000);
        }
      } catch (error) {
        logger.error('Error playing note', { error, note: notes, layer });
      }
    }
  }

  /**
   * Trigger attack (note on)
   */
  async triggerAttack(
    note: string | string[],
    time?: any,
    velocity = 80,
  ): Promise<void> {
    // DIAGNOSTIC: Log every Rhodes note trigger to identify dual playback source
    console.log(
      '[PLAYBACK-PATH] RhodesVelocitySampler.triggerAttack() called:',
      {
        note,
        velocity,
        time: time?.toFixed(3) || 'immediate',
        isInitialized: this.isInitialized,
      },
    );

    if (!this.isInitialized || !this.config) return;

    const notes = Array.isArray(note) ? note : [note];
    let layer = this.getLayerForVelocity(velocity);

    if (!this.loadedLayers.has(layer)) {
      layer = Array.from(this.loadedLayers)[0];
      if (!layer) return;
    }

    const sampler = this.samplers.get(layer);
    if (sampler && sampler.loaded) {
      const normalizedVelocity = velocity / 127;
      sampler.triggerAttack(notes, time, normalizedVelocity);

      for (const n of notes) {
        this.activeNotes.set(n, velocity);
      }
    }
  }

  /**
   * Trigger release (note off)
   */
  triggerRelease(note: string | string[], time?: any): void {
    if (!this.isInitialized) return;

    const notes = Array.isArray(note) ? note : [note];

    for (const n of notes) {
      const velocity = this.activeNotes.get(n);
      if (velocity !== undefined) {
        const layer = this.getLayerForVelocity(velocity);
        const sampler = this.samplers.get(layer);

        if (sampler) {
          sampler.triggerRelease(n, time);
        }

        this.activeNotes.delete(n);
      }
    }
  }

  /**
   * Ensure all loaded samplers are ready to play
   */
  async ensureReady(): Promise<void> {
    logger.info('🎹 Ensuring all samplers are ready...');

    for (const [layer, sampler] of this.samplers) {
      if (sampler) {
        try {
          await sampler.loaded;
          logger.info(`🎹 Layer ${layer} ready`);
        } catch (err: unknown) {
          logger.warn(`🎹 Layer ${layer} load failed`, {
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    logger.info('🎹 All samplers checked and ready!');
  }

  /**
   * Preload additional layers
   */
  async preloadLayers(layers: string[]): Promise<void> {
    const promises = layers.map((layer) => this.loadLayer(layer));
    await Promise.all(promises);
  }

  /**
   * Preload all layers
   */
  async preloadAll(): Promise<void> {
    if (!this.config) return;

    const allLayers = this.config.velocityRanges.map((r) => r.layer);
    await this.preloadLayers(allLayers);
  }

  /**
   * Connect to audio destination
   */
  connect(destination: any): void {
    this.destination = destination;

    for (const sampler of this.samplers.values()) {
      if (sampler) {
        sampler.connect(destination);
      }
    }
  }

  /**
   * Disconnect from audio destination
   */
  disconnect(): void {
    for (const sampler of this.samplers.values()) {
      if (sampler) {
        sampler.disconnect();
      }
    }
  }

  /**
   * Set volume
   */
  setVolume(volumeDb: number): void {
    if (this.destination) {
      this.destination.gain.value = Math.pow(10, volumeDb / 20);
    }
  }

  /**
   * Get status
   */
  getStatus(): any {
    const memoryUsage = this.loadedLayers.size * 12; // ~12MB per layer estimate

    return {
      isInitialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers),
      totalLayers: this.config?.velocityRanges.length || 0,
      memoryEstimate: `~${memoryUsage}MB`,
      isReady: this.isInitialized && this.loadedLayers.size > 0,
    };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.disconnect();

    for (const sampler of this.samplers.values()) {
      if (sampler) {
        sampler.dispose();
      }
    }

    this.samplers.clear();
    this.loadedLayers.clear();
    this.activeNotes.clear();
    this.isInitialized = false;

    logger.info('💀 Rhodes disposed');
  }
}

/**
 * Singleton instance for global use
 */
export const rhodesPiano = new RhodesVelocitySampler();

// Export sample configuration for those who need it
export const rhodesPianoSamples = {
  v1: { C3: 'v1/C3.mp3', C4: 'v1/C4.mp3', C5: 'v1/C5.mp3' },
  v5: { C3: 'v5/C3.mp3', C4: 'v5/C4.mp3', C5: 'v5/C5.mp3' },
  v9: { C3: 'v9/C3.mp3', C4: 'v9/C4.mp3', C5: 'v9/C5.mp3' },
  v13: { C3: 'v13/C3.mp3', C4: 'v13/C4.mp3', C5: 'v13/C5.mp3' },
  v16: { C3: 'v16/C3.mp3', C4: 'v16/C4.mp3', C5: 'v16/C5.mp3' },
} as const;
