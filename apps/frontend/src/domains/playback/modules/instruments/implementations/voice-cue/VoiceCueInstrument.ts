/**
 * VoiceCueInstrument - Voice Countdown Track
 *
 * Plays voice samples ("one", "two", "three", "four") during countdown
 * to provide verbal guidance alongside the metronome clicks.
 *
 * Features:
 * - Sample-based playback using Tone.js Samplers
 * - Synchronized with metronome countdown
 * - Supports multiple time signatures
 * - Fixed volume (no user controls in Phase 1)
 * - Samples loaded from Supabase audio bucket
 */

import { loadGlobalTone } from '../../../shared/loaders/toneLoader.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('VoiceCueInstrument');

// Dynamic import to avoid AudioContext initialization before user gesture
let Tone: any = null;

/**
 * Voice cue configuration
 */
export interface VoiceCueConfig {
  volume: number; // 0-1
  enabled: boolean;
  samples: Map<string, string>; // cue name -> URL
}

/**
 * Voice cue trigger parameters
 */
export interface VoiceCueTriggerParams {
  cue: 'one' | 'two' | 'three' | 'four' | 'ready' | 'go';
  time: number; // Scheduled time in Tone.js context
  velocity?: number; // 0-1
}

/**
 * Voice Cue Instrument Processor
 */
export class VoiceCueInstrument {
  private samplers: Map<string, any> = new Map(); // Tone.Sampler for each cue
  private audioDestination: any; // Tone.js destination node
  private config: VoiceCueConfig;
  private isInitialized = false;

  constructor(config?: Partial<VoiceCueConfig>) {
    this.config = {
      volume: config?.volume ?? 0.8,
      enabled: config?.enabled ?? true,
      samples: config?.samples ?? new Map(),
    };
  }

  /**
   * Ensure Tone.js is loaded dynamically
   */
  private async ensureToneLoaded(audioEngine?: any): Promise<void> {
    if (!Tone) {
      Tone = await loadGlobalTone(undefined, audioEngine);
      logger.info('🎵 Using global Tone.js instance in VoiceCueInstrument', {
        hasAudioEngine: !!audioEngine,
      });
    }
  }

  /**
   * Initialize the voice cue instrument with samples
   */
  public async initialize(
    samples: Map<string, string>,
    destination: any,
    audioEngine?: any,
  ): Promise<void> {
    try {
      // Ensure Tone is loaded
      await this.ensureToneLoaded(audioEngine);

      this.audioDestination = destination;
      this.config.samples = samples;

      // Load all voice cue samples
      await this.loadVoiceSamples(samples);

      this.isInitialized = true;
      logger.info('VoiceCueInstrument initialized successfully', {
        sampleCount: samples.size,
      });
    } catch (error) {
      logger.error('Failed to initialize VoiceCueInstrument:', error);
      throw error;
    }
  }

  /**
   * Load voice samples as Tone.js Samplers
   */
  private async loadVoiceSamples(samples: Map<string, string>): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [cue, url] of samples.entries()) {
      loadPromises.push(
        new Promise((resolve, reject) => {
          const sampler = new Tone.Sampler(
            { C4: url }, // Map sample to middle C
            {
              onload: () => {
                logger.info(`Voice cue sample loaded: ${cue}`);
                resolve();
              },
              onerror: (error: any) => {
                logger.error(`Failed to load voice cue sample: ${cue}`, error);
                reject(error);
              },
            },
          );

          // Connect to destination
          if (this.audioDestination) {
            sampler.connect(this.audioDestination);
          } else {
            sampler.toDestination();
          }

          this.samplers.set(cue, sampler);
        }),
      );
    }

    await Promise.all(loadPromises);
    logger.info('All voice cue samples loaded successfully');
  }

  /**
   * Trigger a voice cue at a specific time
   */
  public trigger(params: VoiceCueTriggerParams): void {
    if (!this.isInitialized || !Tone) {
      logger.warn('VoiceCueInstrument not initialized');
      return;
    }

    if (!this.config.enabled) {
      return;
    }

    const sampler = this.samplers.get(params.cue);
    if (!sampler) {
      logger.warn(`Voice cue sampler not found: ${params.cue}`);
      return;
    }

    if (!sampler.loaded) {
      logger.warn(`Voice cue sampler not loaded: ${params.cue}`);
      return;
    }

    const velocity = params.velocity ?? 1.0;
    const adjustedVolume = velocity * this.config.volume;

    // Trigger the sample at the scheduled time
    // Duration '0.5' allows the full sample to play
    sampler.triggerAttackRelease('C4', '0.5', params.time, adjustedVolume);

    logger.debug(`Voice cue triggered: ${params.cue}`, {
      time: params.time,
      velocity: adjustedVolume,
    });
  }

  /**
   * Set volume (for future use)
   */
  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    logger.info('Voice cue volume updated', { volume: this.config.volume });
  }

  /**
   * Enable/disable voice cues (for future use)
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info('Voice cues enabled state changed', { enabled });
  }

  /**
   * Get current configuration
   */
  public getConfig(): VoiceCueConfig {
    return { ...this.config };
  }

  /**
   * Check if instrument is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.samplers.size > 0;
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    logger.info('Disposing VoiceCueInstrument');

    this.samplers.forEach((sampler, cue) => {
      try {
        if (typeof sampler.dispose === 'function') {
          sampler.dispose();
        } else {
          logger.warn(
            `🎵 Sampler.dispose() not available for ${cue}, likely in test environment`,
          );
        }
      } catch (error) {
        logger.warn(
          `🎵 Sampler disposal failed for ${cue}, likely in test environment:`,
          error,
        );
      }
    });

    this.samplers.clear();
    this.isInitialized = false;
    logger.info('VoiceCueInstrument disposed');
  }
}
