/**
 * Professional Wurlitzer sampler - REFACTORED
 * Now loads configuration from external JSON file
 * Reduced from 2,000+ lines to ~500 lines
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

const logger = createStructuredLogger('WurlitzerVelocitySampler');

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

// Configuration file path
const CONFIG_PATH = 'instruments/piano/wurlitzer.json';

// Helper to ensure Tone.js is loaded from global instance
async function ensureToneLoaded(
  preferredContext?: AudioContext,
  audioEngine?: any,
): Promise<void> {
  const persistentContext = getPersistentAudioContext();
  const contextToUse = preferredContext || persistentContext || undefined;

  if (!Tone || preferredContext || persistentContext) {
    Tone = await loadGlobalTone(contextToUse, audioEngine);
    if (!Tone || !Tone.context) {
      logger.error('🎵 Failed to load global Tone.js instance');
    } else {
      ensureToneUsesPersistentContext();
    }
  }
}

export class WurlitzerVelocitySampler {
  private samplers: Map<string, any> = new Map();
  private config: InstrumentSampleConfig | null = null;
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: any | null = null;
  private tremoloLFO: any | null = null;
  private tremoloGain: any | null = null;
  private tremoloEnabled = false;
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
    logger.info('🎹 WurlitzerVelocitySampler: Preferred AudioContext set');
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
      logger.info('🎹 Loaded Wurlitzer configuration', {
        name: this.config.name,
        version: this.config.version,
        velocityRanges: this.config.velocityRanges.length,
        samples: Object.keys(this.config.sampleMapping).length,
      });

      // Check preloaded samples
      const checkPreloadedSamples = () => {
        let preloadedCount = 0;
        const layersToCheck = velocityLayers ||
          this.config!.defaultLayers || ['v1', 'v3', 'v5'];

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
      logger.info('🎹 Initializing Wurlitzer', {
        smartLoading: !!requiredNotes,
        notesCount: requiredNotes?.length || 'all',
        layers: velocityLayers || 'default',
        preloadedSamples: preloaded,
        expectedSamples:
          (velocityLayers?.length || this.config.defaultLayers?.length || 3) *
          Object.keys(this.config.sampleMapping).length,
      });

      await ensureToneLoaded(
        this.preferredContext || undefined,
        this.audioEngine,
      );

      if (!Tone || typeof Tone === 'undefined') {
        throw new Error('Tone.js is not loaded');
      }

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

      // Set up tremolo effect if configured
      if (this.config.effects?.tremolo) {
        this.setupTremolo();
      }

      this.destination.toDestination();

      // Check for InitialSamplePreloader usage
      const cachedBufferLoader = CachedToneBufferLoader.getInstance();
      const usesCachedLoader = cachedBufferLoader ? true : false;
      logger.info('🎹 Using CachedToneBufferLoader', {
        enabled: usesCachedLoader,
      });

      // Load optimized velocity layers based on config
      const layersToLoad = velocityLayers ||
        this.config.optimization?.preloadPriority ||
        this.config.defaultLayers || ['v3', 'v1', 'v5'];

      logger.info('🎹 Loading initial velocity layers', {
        layers: layersToLoad,
        smartLoading: !!requiredNotes,
        notesToLoad: requiredNotes?.length || 'all',
      });

      await this.loadInitialVelocityLayers(layersToLoad, requiredNotes);

      this.isInitialized = true;
      logger.info('✅ Wurlitzer ready!', {
        loadedLayers: Array.from(this.loadedLayers),
        destination: !!this.destination,
        tremolo: this.tremoloEnabled,
      });

      // Wait a moment for everything to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.ensureReady();
    } catch (error) {
      logger.error(
        'Failed to initialize Wurlitzer:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Set up tremolo effect
   */
  private setupTremolo(): void {
    if (!this.config?.effects?.tremolo) return;

    try {
      const tremoloConfig = this.config.effects.tremolo;

      // Create LFO for tremolo
      this.tremoloLFO = new (Tone as any).LFO({
        frequency: tremoloConfig.rate,
        min: 1 - tremoloConfig.depth,
        max: 1,
      });

      // Create gain node for tremolo modulation
      this.tremoloGain = new (Tone as any).Gain(1);

      // Connect LFO to gain
      this.tremoloLFO.connect(this.tremoloGain.gain);

      // Connect gain to destination
      this.tremoloGain.connect(this.destination);

      // Start LFO
      this.tremoloLFO.start();

      this.tremoloEnabled = true;
      logger.info('✅ Tremolo effect configured');
    } catch (error) {
      logger.warn('Failed to set up tremolo', { error });
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

        logger.info(`🎹 Loading Wurlitzer layer ${layer}`, {
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

        // Connect to tremolo or destination
        if (this.tremoloEnabled && this.tremoloGain) {
          sampler.connect(this.tremoloGain);
        } else if (this.destination) {
          sampler.connect(this.destination);
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);

        logger.info(`✅ Loaded Wurlitzer layer ${layer}`);
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
        release: this.config?.samplerConfig?.release || 0.4,
        attack: this.config?.samplerConfig?.attack || 0.01,
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
    if (!this.config) return 'v3';

    const v = Math.max(0, Math.min(127, velocity));
    const range = this.config.velocityRanges.find(
      (r) => v >= r.min && v <= r.max,
    );
    return range ? range.layer : 'v3';
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
      logger.warn('🎹 Wurlitzer not initialized, cannot play');
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
   * Enable or disable tremolo effect
   */
  setTremoloEnabled(enabled: boolean): void {
    this.tremoloEnabled = enabled;

    if (this.tremoloLFO) {
      if (enabled) {
        this.tremoloLFO.start();
      } else {
        this.tremoloLFO.stop();
      }
    }
  }

  /**
   * Set tremolo rate
   */
  setTremoloRate(rate: number): void {
    if (this.tremoloLFO) {
      this.tremoloLFO.frequency.value = rate;
    }
  }

  /**
   * Set tremolo depth
   */
  setTremoloDepth(depth: number): void {
    if (this.tremoloLFO) {
      this.tremoloLFO.min = 1 - depth;
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
        sampler.disconnect();
        if (this.tremoloEnabled && this.tremoloGain) {
          sampler.connect(this.tremoloGain);
        } else {
          sampler.connect(destination);
        }
      }
    }

    if (this.tremoloGain) {
      this.tremoloGain.disconnect();
      this.tremoloGain.connect(destination);
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

    if (this.tremoloGain) {
      this.tremoloGain.disconnect();
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
    const memoryUsage = this.loadedLayers.size * 10; // ~10MB per layer estimate

    return {
      isInitialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers),
      totalLayers: this.config?.velocityRanges.length || 0,
      memoryEstimate: `~${memoryUsage}MB`,
      isReady: this.isInitialized && this.loadedLayers.size > 0,
      tremolo: this.tremoloEnabled,
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

    if (this.tremoloLFO) {
      this.tremoloLFO.dispose();
    }

    if (this.tremoloGain) {
      this.tremoloGain.dispose();
    }

    this.samplers.clear();
    this.loadedLayers.clear();
    this.activeNotes.clear();
    this.isInitialized = false;

    logger.info('💀 Wurlitzer disposed');
  }
}

/**
 * Singleton instance for global use
 */
export const wurlitzerPiano = new WurlitzerVelocitySampler();
