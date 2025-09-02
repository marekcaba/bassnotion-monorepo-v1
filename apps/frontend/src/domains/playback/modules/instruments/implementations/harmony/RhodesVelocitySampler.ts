import { loadGlobalTone } from '../../../../services/plugins/toneLoader.js';
import { createStructuredLogger } from '@bassnotion/contracts';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

/**
 * Professional Fender Rhodes sampler with 4 velocity layers
 * Samples: p (piano/soft), mp (mezzo-piano), mf (mezzo-forte), f (forte)
 */

export interface RhodesVelocityInfo {
  note: string;
  velocityLayers: number;
}

export class RhodesVelocitySampler {
  private samplers: Map<string, Tone.Sampler> = new Map();
  private velocityRanges: Array<{ min: number; max: number; layer: string }> =
    [];
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: Tone.InputNode | null = null;
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';

  // Sample mapping - using flat notes for Tone.js compatibility
  private readonly sampleMapping: { [key: string]: string } = {};

  constructor() {
    // Initialize velocity ranges for 4 layers
    this.velocityRanges = [
      { min: 0, max: 31, layer: 'v1' }, // p (piano/soft)
      { min: 32, max: 63, layer: 'v2' }, // mp (mezzo-piano)
      { min: 64, max: 95, layer: 'v3' }, // mf (mezzo-forte)
      { min: 96, max: 127, layer: 'v4' }, // f (forte)
    ];

    // Build sample mapping for Rhodes range (A0 to C6)
    // We need to map BOTH sharp and flat notations to the same files
    const noteData = [
      // Octave 0
      { notes: ['A0'], file: 'A0.mp3' },
      { notes: ['A#0', 'Bb0'], file: 'As0.mp3' },
      { notes: ['B0'], file: 'B0.mp3' },
      // Octave 1
      { notes: ['C1'], file: 'C1.mp3' },
      { notes: ['C#1', 'Db1'], file: 'Cs1.mp3' },
      { notes: ['D1'], file: 'D1.mp3' },
      { notes: ['D#1', 'Eb1'], file: 'Ds1.mp3' },
      { notes: ['E1'], file: 'E1.mp3' },
      { notes: ['F1'], file: 'F1.mp3' },
      { notes: ['F#1', 'Gb1'], file: 'Fs1.mp3' },
      { notes: ['G1'], file: 'G1.mp3' },
      { notes: ['G#1', 'Ab1'], file: 'Gs1.mp3' },
      { notes: ['A1'], file: 'A1.mp3' },
      { notes: ['A#1', 'Bb1'], file: 'As1.mp3' },
      { notes: ['B1'], file: 'B1.mp3' },
      // Octave 2
      { notes: ['C2'], file: 'C2.mp3' },
      { notes: ['C#2', 'Db2'], file: 'Cs2.mp3' },
      { notes: ['D2'], file: 'D2.mp3' },
      { notes: ['D#2', 'Eb2'], file: 'Ds2.mp3' },
      { notes: ['E2'], file: 'E2.mp3' },
      { notes: ['F2'], file: 'F2.mp3' },
      { notes: ['F#2', 'Gb2'], file: 'Fs2.mp3' },
      { notes: ['G2'], file: 'G2.mp3' },
      { notes: ['G#2', 'Ab2'], file: 'Gs2.mp3' },
      { notes: ['A2'], file: 'A2.mp3' },
      { notes: ['A#2', 'Bb2'], file: 'As2.mp3' },
      { notes: ['B2'], file: 'B2.mp3' },
      // Octave 3
      { notes: ['C3'], file: 'C3.mp3' },
      { notes: ['C#3', 'Db3'], file: 'Cs3.mp3' },
      { notes: ['D3'], file: 'D3.mp3' },
      { notes: ['D#3', 'Eb3'], file: 'Ds3.mp3' },
      { notes: ['E3'], file: 'E3.mp3' },
      { notes: ['F3'], file: 'F3.mp3' },
      { notes: ['F#3', 'Gb3'], file: 'Fs3.mp3' },
      { notes: ['G3'], file: 'G3.mp3' },
      { notes: ['G#3', 'Ab3'], file: 'Gs3.mp3' },
      { notes: ['A3'], file: 'A3.mp3' },
      { notes: ['A#3', 'Bb3'], file: 'As3.mp3' },
      { notes: ['B3'], file: 'B3.mp3' },
      // Octave 4
      { notes: ['C4'], file: 'C4.mp3' },
      { notes: ['C#4', 'Db4'], file: 'Cs4.mp3' },
      { notes: ['D4'], file: 'D4.mp3' },
      { notes: ['D#4', 'Eb4'], file: 'Ds4.mp3' },
      { notes: ['E4'], file: 'E4.mp3' },
      { notes: ['F4'], file: 'F4.mp3' },
      { notes: ['F#4', 'Gb4'], file: 'Fs4.mp3' },
      { notes: ['G4'], file: 'G4.mp3' },
      { notes: ['G#4', 'Ab4'], file: 'Gs4.mp3' },
      { notes: ['A4'], file: 'A4.mp3' },
      { notes: ['A#4', 'Bb4'], file: 'As4.mp3' },
      { notes: ['B4'], file: 'B4.mp3' },
      // Octave 5
      { notes: ['C5'], file: 'C5.mp3' },
      { notes: ['C#5', 'Db5'], file: 'Cs5.mp3' },
      { notes: ['D5'], file: 'D5.mp3' },
      { notes: ['D#5', 'Eb5'], file: 'Ds5.mp3' },
      { notes: ['E5'], file: 'E5.mp3' },
      { notes: ['F5'], file: 'F5.mp3' },
      { notes: ['F#5', 'Gb5'], file: 'Fs5.mp3' },
      { notes: ['G5'], file: 'G5.mp3' },
      { notes: ['G#5', 'Ab5'], file: 'Gs5.mp3' },
      { notes: ['A5'], file: 'A5.mp3' },
      { notes: ['A#5', 'Bb5'], file: 'As5.mp3' },
      { notes: ['B5'], file: 'B5.mp3' },
      // Octave 6
      { notes: ['C6'], file: 'C6.mp3' },
    ];

    // Build the sample mapping - map all note variations to the same file
    noteData.forEach(({ notes, file }) => {
      notes.forEach((note) => {
        this.sampleMapping[note] = file;
      });
    });
  }

  /**
   * Ensure Tone.js is loaded dynamically
   */
  private async ensureToneLoaded(): Promise<void> {
    if (!Tone) {
      Tone = await loadGlobalTone();
      logger.info('🎵 Using global Tone.js instance in RhodesVelocitySampler');
    }
  }

  /**
   * Initialize with commonly used velocity layers
   * Loads v2 (mp) and v3 (mf) by default
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🎹 Initializing Fender Rhodes...');

    try {
      // Ensure Tone is loaded before initializing
      await this.ensureToneLoaded();

      // Ensure Tone.js context is started
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      // Load middle velocity layers first (mp and mf)
      const initialLayers = ['v2', 'v3'];
      await Promise.all(initialLayers.map((layer) => this.loadLayer(layer)));

      this.isInitialized = true;
      logger.info('✅ Rhodes ready with initial layers');
    } catch (error) {
      logger.error('Failed to initialize Rhodes:', error);
      throw error;
    }
  }

  /**
   * Load a specific velocity layer
   */
  private async loadLayer(layer: string): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    // Check if already loading
    const existingPromise = this.loadingPromises.get(layer);
    if (existingPromise) return existingPromise;

    logger.info(`Loading Rhodes velocity layer ${layer}...`);

    const loadPromise = (async () => {
      try {
        // Only load a subset of samples for faster loading and let Tone.js interpolate
        const sampleSubset: { [key: string]: string } = {};
        const noteData = [
          { notes: ['C1'], file: 'C1.mp3' },
          { notes: ['C2'], file: 'C2.mp3' },
          { notes: ['C3'], file: 'C3.mp3' },
          { notes: ['C4'], file: 'C4.mp3' },
          { notes: ['C5'], file: 'C5.mp3' },
          { notes: ['C6'], file: 'C6.mp3' },
          { notes: ['A1'], file: 'A1.mp3' },
          { notes: ['A2'], file: 'A2.mp3' },
          { notes: ['A3'], file: 'A3.mp3' },
          { notes: ['A4'], file: 'A4.mp3' },
          { notes: ['A5'], file: 'A5.mp3' },
          { notes: ['E1'], file: 'E1.mp3' },
          { notes: ['E2'], file: 'E2.mp3' },
          { notes: ['E3'], file: 'E3.mp3' },
          { notes: ['E4'], file: 'E4.mp3' },
          { notes: ['E5'], file: 'E5.mp3' },
        ];

        noteData.forEach(({ notes, file }) => {
          notes.forEach((note) => {
            sampleSubset[note] = file;
          });
        });

        logger.info(
          `Loading Rhodes ${layer} with samples:`,
          Object.keys(sampleSubset),
        );

        const sampler = new Tone.Sampler({
          urls: sampleSubset,
          baseUrl: `${this.supabaseUrl}/Keyboards/rhodes/${layer}/`,
          release: 0.2, // Shorter release for tighter sound
          attack: 0.005,
          onload: () => {
            logger.info(`✅ Rhodes ${layer} loaded successfully`);
          },
          onerror: (error) => {
            logger.error(`❌ Error loading Rhodes ${layer}:`, error);
            throw error;
          },
        });

        // Wait for the sampler to be fully loaded
        await sampler.loaded;

        logger.info(`Rhodes ${layer} loaded, testing sample availability...`);

        // Test if we can access a sample
        try {
          const hasC4 = sampler.has('C4');
          logger.info(`Rhodes ${layer} has C4: ${hasC4}`);
        } catch (e) {
          logger.info(`Rhodes ${layer} sample test failed:`, e);
        }

        // Connect to destination if we have one
        if (this.destination) {
          sampler.connect(this.destination);
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);
      } catch (error) {
        logger.error(`❌ Failed to load Rhodes layer ${layer}:`, error);
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
    return range ? range.layer : 'v3'; // Default to mf
  }

  /**
   * Play a note with velocity
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity = 64,
  ): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Rhodes not initialized');
      return;
    }

    const notes = Array.isArray(note) ? note : [note];
    const layer = this.getLayerForVelocity(velocity);

    // Load layer if not already loaded
    if (!this.loadedLayers.has(layer)) {
      await this.loadLayer(layer);
    }

    const sampler = this.samplers.get(layer);
    if (sampler) {
      try {
        // Ensure the sampler is fully loaded
        await sampler.loaded;

        const normalizedVelocity = velocity / 127;
        sampler.triggerAttackRelease(notes, duration, time, normalizedVelocity);
      } catch (error) {
        logger.error(
          `Error playing Rhodes note ${notes} in layer ${layer}:`,
          error,
        );
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
    if (!this.isInitialized) return;

    const notes = Array.isArray(note) ? note : [note];
    const layer = this.getLayerForVelocity(velocity);

    if (!this.loadedLayers.has(layer)) {
      await this.loadLayer(layer);
    }

    const sampler = this.samplers.get(layer);
    if (sampler) {
      try {
        await sampler.loaded;

        const normalizedVelocity = velocity / 127;
        sampler.triggerAttack(notes, time, normalizedVelocity);
      } catch (error) {
        logger.error(
          `Error triggering Rhodes attack for ${notes} in layer ${layer}:`,
          error,
        );
      }
    }
  }

  /**
   * Trigger release (note off)
   */
  triggerRelease(note: string | string[], time?: Tone.Unit.Time): void {
    if (!this.isInitialized) return;

    // Release on all loaded samplers
    this.samplers.forEach((sampler) => {
      sampler.triggerRelease(note, time);
    });
  }

  /**
   * Connect to audio destination
   */
  connect(destination: Tone.InputNode): this {
    this.destination = destination;
    this.samplers.forEach((sampler) => {
      if (sampler) {
        sampler.connect(destination);
      }
    });
    return this;
  }

  /**
   * Disconnect from audio
   */
  disconnect(): this {
    this.samplers.forEach((sampler) => {
      if (sampler) {
        sampler.disconnect();
      }
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
   * Preload all 4 velocity layers
   */
  async preloadAll(): Promise<void> {
    const allLayers = this.velocityRanges.map((r) => r.layer);
    await this.preloadLayers(allLayers);
  }

  /**
   * Get loading status
   */
  getStatus(): {
    initialized: boolean;
    loadedLayers: string[];
    totalLayers: number;
    memoryEstimate: string;
  } {
    const loadedCount = this.loadedLayers.size;
    const memoryMB = loadedCount * 15; // ~15MB per layer estimate

    return {
      initialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers).sort(),
      totalLayers: this.velocityRanges.length,
      memoryEstimate: `~${memoryMB.toFixed(0)}MB`,
    };
  }

  /**
   * Stop all currently playing notes immediately
   */
  stopAll(): void {
    // Release all notes on all velocity layers
    this.samplers.forEach((sampler) => {
      if (sampler && sampler.loaded) {
        try {
          // Store original envelope
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

          // Restore envelope after a brief moment
          setTimeout(() => {
            sampler.attack = originalEnvelope.attack;
            sampler.decay = originalEnvelope.decay;
            sampler.sustain = originalEnvelope.sustain;
            sampler.release = originalEnvelope.release;
          }, 50);
        } catch (error) {
          logger.warn('Failed to release notes on Rhodes sampler:', error);
        }
      }
    });
  }

  /**
   * Dispose all samplers and free memory
   */
  dispose(): void {
    // Stop all notes first
    this.stopAll();

    this.samplers.forEach((sampler) => sampler.dispose());
    this.samplers.clear();
    this.loadedLayers.clear();
    this.loadingPromises.clear();
    this.isInitialized = false;
    logger.info('🗑️ Disposed Rhodes sampler');
  }
}

/**
 * Singleton instance for global use
 */
export const rhodesPiano = new RhodesVelocitySampler();

const logger = createStructuredLogger('RhodesVelocitySampler');
