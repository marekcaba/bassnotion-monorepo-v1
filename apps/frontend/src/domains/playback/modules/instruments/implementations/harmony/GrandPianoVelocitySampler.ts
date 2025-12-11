/**
 * Professional Grand Piano sampler
 * Based on Wurlitzer architecture with 7 velocity layers
 * Features: CC64 sustain pedal, flat EQ, smart preloading
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
import grandPianoConfig from '../../../../data/instruments/piano/grand-piano.json';

const logger = createStructuredLogger('GrandPianoVelocitySampler');

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

// Import configuration directly (Next.js can't serve JSON from src/)
const CONFIG: InstrumentSampleConfig =
  grandPianoConfig as InstrumentSampleConfig;

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
      logger.info('🎹 GrandPiano: Loading Tone.js independently...');
      Tone = await InstrumentDependencyManager.getTone();
      logger.info('🎹 GrandPiano: Tone.js loaded successfully');

      if (!Tone || !Tone.context) {
        throw new Error('Tone.js loaded but has no context');
      }

      ensureToneUsesPersistentContext();
    } catch (error) {
      logger.error('🎹 GrandPiano: Failed to load Tone.js', { error });
      throw new Error(
        `Failed to load Tone.js for Grand Piano: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export class GrandPianoVelocitySampler {
  private samplers: Map<string, any> = new Map();
  private config: InstrumentSampleConfig | null = null;
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: any | null = null;
  private eq: any | null = null; // EQ3 for piano tone shaping
  private activeNotes: Map<string, number> = new Map();
  private sustainPedal = false; // Sustain pedal state (CC64)
  private sustainedNotes: Set<string> = new Set(); // Notes held by sustain pedal
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
    logger.info('🎹 GrandPianoVelocitySampler: Preferred AudioContext set');
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
      // Use imported configuration (no need to fetch from server)
      this.config = CONFIG;
      const velocityRanges =
        this.config.velocityRanges || (this.config as any).globalVelocityRanges;

      logger.info('🎹 Loaded Grand Piano configuration', {
        name: this.config.name,
        version: this.config.version,
        velocityLayers: velocityRanges?.length || 0,
        samples: Object.keys(this.config.sampleMapping).length,
      });

      // Check preloaded samples
      const checkPreloadedSamples = () => {
        let preloadedCount = 0;
        const layersToCheck = velocityLayers ||
          this.config!.defaultLayers || ['v3', 'v4', 'v5'];

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
      logger.info('🎹 Initializing Grand Piano', {
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

      // Set up EQ if configured (flat by default)
      if (this.config.effects?.eq) {
        this.setupEQ();
      }

      // CRITICAL: DO NOT connect directly to destination (speakers)!
      // This creates a ROGUE AUDIO PATH that bypasses gain control
      // Audio flows through: WamKeyboard.gainNode → Channel/Bus → Destination
      // Connection happens via connect() method when WamKeyboard initializes

      logger.debug(
        '🎹 Initializing without direct toDestination (proper routing)',
      );

      // Load optimized velocity layers based on config
      const layersToLoad = velocityLayers ||
        this.config.optimization?.preloadPriority ||
        this.config.defaultLayers || ['v3', 'v4', 'v5'];

      logger.info('🎹 Loading initial velocity layers', {
        layers: layersToLoad,
        smartLoading: !!requiredNotes,
        notesToLoad: requiredNotes?.length || 'all',
      });

      await this.loadInitialVelocityLayers(layersToLoad, requiredNotes);

      this.isInitialized = true;
      logger.info('✅ Grand Piano ready!', {
        loadedLayers: Array.from(this.loadedLayers),
        destination: !!this.destination,
        eq: !!this.eq,
      });

      // Wait for everything to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      await this.ensureReady();
    } catch (error) {
      logger.error(
        'Failed to initialize Grand Piano:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Set up EQ effect (flat by default, adjustable later)
   */
  private setupEQ(): void {
    if (!this.config?.effects?.eq) return;

    try {
      const eqConfig = this.config.effects.eq;

      // Create EQ3 (3-band equalizer)
      this.eq = new (Tone as any).EQ3({
        low: eqConfig.low || 0, // Flat by default
        mid: eqConfig.mid || 0, // Flat by default
        high: eqConfig.high || 0, // Flat by default
        lowFrequency: eqConfig.lowFrequency || 400,
        highFrequency: eqConfig.highFrequency || 2500,
      });

      // Connect EQ to destination
      this.eq.connect(this.destination);

      logger.info('✅ EQ configured (flat)', {
        low: eqConfig.low || 0,
        mid: eqConfig.mid || 0,
        high: eqConfig.high || 0,
      });
    } catch (error) {
      logger.warn('Failed to set up EQ', { error });
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

        logger.info(`🎹 Loading Grand Piano layer ${layer}`, {
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
        // IMPORTANT: Convert note names back to # format for Tone.js (As0 → A#0)
        // The URLs already have encoded filenames (As0.mp3), but Tone.js needs # in keys
        const sampleUrls: Record<string, string> = {};
        for (const [note, url] of layerUrls.entries()) {
          if (!requiredNotes || requiredNotes.includes(note)) {
            // Convert 's' back to '#' for Tone.js compatibility (e.g., "As0" → "A#0")
            const toneJsNote = note.replace(/([A-G])s(\d)/g, '$1#$2');
            sampleUrls[toneJsNote] = url;
          }
        }

        logger.info(
          `🎹 Loading ${Object.keys(sampleUrls).length} samples for layer ${layer}`,
        );

        // DEBUG: Log first few URLs to check format
        const firstFewUrls = Object.entries(sampleUrls).slice(0, 3);
        logger.info('🔍 Sample URLs for layer (first 3):', {
          layer,
          urls: firstFewUrls,
        });

        // Create Tone.js Sampler
        const sampler = await this.createSampler(sampleUrls);

        // Connect to EQ or destination
        if (this.eq) {
          sampler.connect(this.eq);
        } else if (this.destination) {
          sampler.connect(this.destination);
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);

        logger.info(`✅ Loaded Grand Piano layer ${layer}`);
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
        release: this.config?.samplerConfig?.release || 0.5,
        attack: this.config?.samplerConfig?.attack || 0.001,
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
   * Uses global velocity ranges (equally distributed across 0-127)
   */
  private getLayerForVelocity(velocity: number): string {
    if (!this.config) return 'v4'; // Default to middle layer

    const v = Math.max(0, Math.min(127, velocity));

    // Use global velocity ranges (simple, equal distribution)
    const velocityRanges =
      this.config.velocityRanges || (this.config as any).globalVelocityRanges;
    const range = velocityRanges?.find((r: any) => v >= r.min && v <= r.max);
    return range ? range.layer : 'v4';
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
      logger.warn('🎹 Grand Piano not initialized, cannot play');
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
    // DIAGNOSTIC: Log every Grand Piano note trigger to identify dual playback source
    console.log(
      '[PLAYBACK-PATH] GrandPianoVelocitySampler.triggerAttack() called:',
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
   * If sustain pedal is down, notes are held until pedal is released
   */
  triggerRelease(note: string | string[], time?: any): void {
    if (!this.isInitialized) return;

    const notes = Array.isArray(note) ? note : [note];

    for (const n of notes) {
      const velocity = this.activeNotes.get(n);
      if (velocity !== undefined) {
        // If sustain pedal is down, hold the note instead of releasing it
        if (this.sustainPedal) {
          this.sustainedNotes.add(n);
          logger.debug(`🎹 Sustaining note ${n} (pedal down)`);
          continue;
        }

        // Normal release (no sustain)
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
   * Release all currently playing notes across all layers
   * CRITICAL for stop button functionality
   */
  releaseAll(time?: any): void {
    // Release all notes across all velocity layers
    for (const [layerName, sampler] of this.samplers.entries()) {
      if (sampler && sampler.releaseAll) {
        sampler.releaseAll(time || 0);
      }
    }

    // Clear active notes tracking
    this.activeNotes.clear();
    // Also clear sustained notes
    this.sustainedNotes.clear();
  }

  /**
   * Set sustain pedal state (CC64)
   * @param value - Sustain value (0-127, >63 = on)
   * @param time - Optional time to apply the change
   */
  setSustain(value: number, time?: any): void {
    const pedalDown = value >= 64; // MIDI convention: 64+ = pedal down

    if (this.sustainPedal === pedalDown) {
      return; // No state change
    }

    this.sustainPedal = pedalDown;
    logger.info(
      `🎹 Sustain pedal ${pedalDown ? 'DOWN' : 'UP'} (value: ${value})`,
    );

    // If pedal is released, release all sustained notes
    if (!pedalDown && this.sustainedNotes.size > 0) {
      logger.info(`🎹 Releasing ${this.sustainedNotes.size} sustained notes`);

      for (const note of this.sustainedNotes) {
        const velocity = this.activeNotes.get(note);
        if (velocity !== undefined) {
          const layer = this.getLayerForVelocity(velocity);
          const sampler = this.samplers.get(layer);

          if (sampler) {
            sampler.triggerRelease(note, time);
          }

          this.activeNotes.delete(note);
        }
      }

      this.sustainedNotes.clear();
    }
  }

  /**
   * Set EQ parameters
   */
  setEQ(low: number, mid: number, high: number): void {
    if (this.eq) {
      this.eq.low.value = low;
      this.eq.mid.value = mid;
      this.eq.high.value = high;
      logger.info('🎹 EQ updated', { low, mid, high });
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

    const velocityRanges =
      this.config.velocityRanges || (this.config as any).globalVelocityRanges;
    const allLayers = velocityRanges?.map((r: any) => r.layer) || [];
    await this.preloadLayers(allLayers);
  }

  /**
   * Connect to audio destination
   */
  connect(destination: any): void {
    this.destination = destination;

    // CRITICAL FIX: Wrap ALL sampler connections in try-catch
    // AudioContext mismatches can occur if samplers were created in different context
    for (const sampler of this.samplers.values()) {
      if (sampler) {
        try {
          sampler.disconnect();
        } catch (e) {
          // Ignore disconnect errors - sampler may not be connected
        }

        try {
          if (this.eq) {
            sampler.connect(this.eq);
          } else {
            sampler.connect(destination);
          }
        } catch (error) {
          logger.warn('⚠️ Sampler AudioContext mismatch - bypassing EQ', {
            error,
          });
          console.warn(
            '⚠️ [CONNECT] Sampler AudioContext mismatch, connecting directly to destination',
          );
          // If EQ connection fails, try direct connection
          try {
            sampler.connect(destination);
          } catch (directError) {
            logger.error('❌ Failed to connect sampler even directly', {
              directError,
            });
            console.error(
              '❌ [CONNECT] Complete sampler connection failure:',
              directError,
            );
          }
        }
      }
    }

    if (this.eq) {
      try {
        this.eq.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }

      try {
        this.eq.connect(destination);
      } catch (error) {
        // CRITICAL FIX: EQ may be in different AudioContext than destination
        // This happens when connect() is called before initialize() completes
        // Solution: Dispose of EQ and bypass it
        logger.warn(
          '⚠️ EQ AudioContext mismatch - disposing and bypassing EQ',
          { error },
        );
        console.warn(
          '⚠️ [CONNECT] EQ AudioContext mismatch, disposing EQ and connecting samplers directly',
        );
        try {
          this.eq.dispose();
        } catch (disposeError) {
          logger.warn('Failed to dispose EQ', { disposeError });
        }
        this.eq = null;

        // Reconnect all samplers directly to destination (bypass EQ)
        for (const sampler of this.samplers.values()) {
          if (sampler) {
            try {
              sampler.disconnect();
              sampler.connect(destination);
            } catch (reconnectError) {
              logger.error('Failed to reconnect sampler after EQ bypass', {
                reconnectError,
              });
            }
          }
        }
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

    if (this.eq) {
      this.eq.disconnect();
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
    const memoryUsage = this.loadedLayers.size * 50; // ~50MB per layer estimate (larger than Wurlitzer)
    const velocityRanges =
      this.config?.velocityRanges || (this.config as any)?.globalVelocityRanges;

    return {
      isInitialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers),
      totalLayers: velocityRanges?.length || 0,
      memoryEstimate: `~${memoryUsage}MB`,
      isReady: this.isInitialized && this.loadedLayers.size > 0,
      eq: !!this.eq,
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

    if (this.eq) {
      this.eq.dispose();
    }

    this.samplers.clear();
    this.loadedLayers.clear();
    this.activeNotes.clear();
    this.isInitialized = false;

    logger.info('💀 Grand Piano disposed');
  }
}

/**
 * Singleton instance for global use
 */
export const grandPiano = new GrandPianoVelocitySampler();
