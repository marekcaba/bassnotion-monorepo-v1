/**
 * Velocity-based sampler implementation for Salamander Grand Piano
 * Updated for Story 3.18.3: Removed direct Tone import
 * This extends the existing ChordInstrumentProcessor functionality
 */

import { logInfo, logError } from '@/domains/playback/utils/logger.js';
import { getTone } from '../ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../../config/featureFlags.js';

export interface VelocityLayer {
  sampler: any; // Tone.Sampler
  velocityRange: [number, number];
  name: string;
}

export class VelocitySampler {
  private velocityLayers: VelocityLayer[] = [];
  private isLoaded = false;
  private Tone: any; // Will be initialized when needed

  constructor() {}
  
  /**
   * Get Tone instance through dependency injection
   */
  private getToneInstance(): any {
    if (!this.Tone) {
      const flags = getAudioArchitectureFlags();
      try {
        this.Tone = getTone();
        if (flags.ENABLE_MIGRATION_MONITORING) {
          console.log('[VelocitySampler] Using Tone from dependency injection');
        }
      } catch (error) {
        console.error('[VelocitySampler] Failed to get Tone from DI:', error);
        throw new Error('Tone.js not available. Ensure AudioEngine is initialized.');
      }
    }
    return this.Tone;
  }

  /**
   * Load multi-velocity Salamander Grand Piano
   */
  async loadVelocityLayers(): Promise<boolean> {
    try {
      logInfo('🎹 Chord', 'Loading Salamander Grand Piano with velocity layers...');

      // Dispose existing samplers
      this.dispose();

      // Define sample mapping (same for all velocity layers)
      const sampleMapping = {
        A0: 'A0.mp3',
        C1: 'C1.mp3',
        'D#1': 'Ds1.mp3',
        'F#1': 'Fs1.mp3',
        A1: 'A1.mp3',
        C2: 'C2.mp3',
        'D#2': 'Ds2.mp3',
        'F#2': 'Fs2.mp3',
        A2: 'A2.mp3',
        C3: 'C3.mp3',
        'D#3': 'Ds3.mp3',
        'F#3': 'Fs3.mp3',
        A3: 'A3.mp3',
        C4: 'C4.mp3',
        'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3',
        A4: 'A4.mp3',
        C5: 'C5.mp3',
        'D#5': 'Ds5.mp3',
        'F#5': 'Fs5.mp3',
        A5: 'A5.mp3',
        C6: 'C6.mp3',
        'D#6': 'Ds6.mp3',
        'F#6': 'Fs6.mp3',
        A6: 'A6.mp3',
        C7: 'C7.mp3',
        'D#7': 'Ds7.mp3',
        'F#7': 'Fs7.mp3',
        A7: 'A7.mp3',
        C8: 'C8.mp3',
      };

      // Define velocity layers (3-velocity version)
      const velocityConfig = [
        { name: 'pp', dir: 'v1', range: [0, 42] as [number, number] },
        { name: 'mf', dir: 'v8', range: [43, 85] as [number, number] },
        { name: 'ff', dir: 'v16', range: [86, 127] as [number, number] },
      ];

      // Load each velocity layer
      const loadPromises = velocityConfig.map(async (config) => {
        const sampler = new this.getToneInstance().Sampler({
          urls: sampleMapping,
          baseUrl: `/samples/salamander-3vel/${config.dir}/`,
          release: 1,
        });

        await sampler.loaded;

        return {
          sampler,
          velocityRange: config.range,
          name: config.name,
        };
      });

      // Wait for all layers to load
      this.velocityLayers = await Promise.all(loadPromises);
      this.isLoaded = true;

      logInfo('🎹 Chord', `Loaded ${this.velocityLayers.length} velocity layers`);
      return true;
    } catch (error) {
      logError('🎹 Chord', 'Failed to load velocity layers:', error);
      return false;
    }
  }

  /**
   * Get the appropriate sampler for a given velocity
   */
  getSamplerForVelocity(velocity: number): any | null {
    if (!this.isLoaded || this.velocityLayers.length === 0) {
      return null;
    }

    // Clamp velocity to valid range
    const v = Math.max(0, Math.min(127, velocity));

    // Find the appropriate layer
    const layer = this.velocityLayers.find(
      (l) => v >= l.velocityRange[0] && v <= l.velocityRange[1],
    );

    return layer ? layer.sampler : this.velocityLayers[0].sampler;
  }

  /**
   * Play a note with velocity
   */
  triggerAttackRelease(
    note: string | string[],
    duration: any,
    time?: any,
    velocity?: number,
  ): void {
    const vel = velocity ?? 64; // Default to medium velocity
    const sampler = this.getSamplerForVelocity(vel);

    if (sampler) {
      // Convert MIDI velocity (0-127) to Tone.js velocity (0-1)
      const normalizedVelocity = vel / 127;
      sampler.triggerAttackRelease(note, duration, time, normalizedVelocity);
    }
  }

  /**
   * Connect all samplers to an audio node
   */
  connect(destination: any): void {
    this.velocityLayers.forEach((layer) => {
      layer.sampler.connect(destination);
    });
  }

  /**
   * Dispose all samplers
   */
  dispose(): void {
    this.velocityLayers.forEach((layer) => {
      layer.sampler.dispose();
    });
    this.velocityLayers = [];
    this.isLoaded = false;
  }

  /**
   * Check if velocity layers are loaded
   */
  get loaded(): boolean {
    return this.isLoaded;
  }
}

/**
 * Helper function to determine velocity from musical context
 */
export function getVelocityFromDynamic(dynamic: string): number {
  const dynamicMap: Record<string, number> = {
    ppp: 16,
    pp: 32,
    p: 48,
    mp: 64,
    mf: 80,
    f: 96,
    ff: 112,
    fff: 120,
  };

  return dynamicMap[dynamic] ?? 64;
}

/**
 * Helper to convert chord voicing to velocities based on voice leading
 */
export function getVelocitiesForVoicing(
  notes: string[],
  voiceType: 'bass' | 'tenor' | 'alto' | 'soprano' = 'alto',
): number[] {
  const baseVelocities = {
    bass: 90,
    tenor: 75,
    alto: 65,
    soprano: 70,
  };

  const baseVel = baseVelocities[voiceType];

  // Add slight variations for naturalness
  return notes.map((_, index) => {
    const variation = Math.random() * 10 - 5; // ±5 velocity
    return Math.round(baseVel + variation);
  });
}
