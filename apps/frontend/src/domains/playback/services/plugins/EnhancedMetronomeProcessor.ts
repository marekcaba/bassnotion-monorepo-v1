/**
 * Story 3.16: Enhanced Metronome Processor with Admin-Curated Sample Support
 * Updated for Story 3.18.3: Removed direct Tone import
 *
 * Extends the existing MetronomeInstrumentProcessor to support:
 * - Loading admin-curated click samples from Supabase
 * - Seamless switching between built-in and admin samples
 * - Integration with AudioSampleManager for caching and quality adaptation
 */

import {
  MetronomeInstrumentProcessor,
  ClickSoundType,
  ClickSound,
} from './MetronomeInstrumentProcessor.js';
import { AudioSampleManager } from '../storage/AudioSampleManager.js';
import { getTone } from '../ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../../config/featureFlags.js';
import { AudioEngineFactory } from '../AudioEngine.js'; // Story 3.18.3

export interface AdminMetronomeSample {
  id: string;
  name: string;
  description: string;
  category: 'wood' | 'metal' | 'electronic' | 'acoustic' | 'synthetic';
  url: string;
  isDefault?: boolean;
  metadata?: {
    pitch?: number;
    envelope?: {
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    };
  };
}

export class EnhancedMetronomeProcessor extends MetronomeInstrumentProcessor {
  private audioSampleManager: AudioSampleManager;
  private adminSamples: Map<string, AdminMetronomeSample> = new Map();
  private adminSamplers: Map<string, any> = new Map(); // Tone.Sampler
  private currentAdminSampleId: string | null = null;
  private Tone: any; // Will be initialized when needed

  constructor(audioSampleManager: AudioSampleManager, config?: any) {
    super(config);
    this.audioSampleManager = audioSampleManager;
  }
  
  /**
   * Get Tone instance through dependency injection
   */
  private getToneInstance(): any {
    if (!this.Tone) {
      const flags = getAudioArchitectureFlags();
      try {
        this.Tone = getTone();
        if (flags.ENABLE_MIGRATION_MONITORING) {
          console.log('[EnhancedMetronomeProcessor] Using Tone from dependency injection');
        }
      } catch (error) {
        console.error('[EnhancedMetronomeProcessor] Failed to get Tone from DI:', error);
        throw new Error('Tone.js not available. Ensure AudioEngine is initialized.');
      }
    }
    return this.Tone;
  }

  /**
   * Load admin-curated metronome samples from Supabase
   */
  public async loadAdminSamples(): Promise<void> {
    try {
      // Load the metronome samples index
      const indexResult = await this.audioSampleManager.loadSample(
        'metronome/index.json',
      );

      if (!indexResult.success || !(indexResult.data instanceof ArrayBuffer)) {
        console.warn('No admin metronome samples index found, using defaults');
        return;
      }

      // Parse the index
      const indexText = new TextDecoder().decode(indexResult.data);
      const samplesIndex = JSON.parse(indexText) as {
        samples: AdminMetronomeSample[];
      };

      // Store sample metadata
      samplesIndex.samples.forEach((sample) => {
        this.adminSamples.set(sample.id, sample);
      });

      console.log(`Loaded ${this.adminSamples.size} admin metronome samples`);
    } catch (error) {
      console.error('Failed to load admin metronome samples:', error);
    }
  }

  /**
   * Switch to an admin-curated sample
   */
  public async setAdminSample(sampleId: string): Promise<void> {
    const sample = this.adminSamples.get(sampleId);
    if (!sample) {
      console.warn(`Admin sample not found: ${sampleId}`);
      return;
    }

    try {
      // Check if sampler already loaded
      if (!this.adminSamplers.has(sampleId)) {
        // Load the sample using AudioSampleManager
        const audioResult = await this.audioSampleManager.loadSample(
          `metronome/${sample.url}`,
        );

        if (
          !audioResult.success ||
          !(audioResult.data instanceof ArrayBuffer)
        ) {
          throw new Error('Failed to load admin sample audio');
        }

        // Convert ArrayBuffer to AudioBuffer
        // Story 3.18.3: Get AudioContext from AudioEngine instead of creating new one
        const audioEngine = AudioEngineFactory.getInstance();
        if (!audioEngine) {
          throw new Error('[EnhancedMetronomeProcessor] AudioEngine not initialized');
        }

        const audioContext = audioEngine.getContext();
        if (!audioContext) {
          throw new Error('[EnhancedMetronomeProcessor] AudioContext not available from AudioEngine');
        }

        const audioBuffer = await audioContext.decodeAudioData(
          audioResult.data,
        );

        // Create a Tone.js sampler with the loaded sample
        const Tone = this.getToneInstance();
        const sampler = new Tone.Sampler({
          urls: {
            C4: audioBuffer,
          },
          onload: () => {
            console.log(`Admin metronome sample loaded: ${sample.name}`);
          },
        }).toDestination();

        this.adminSamplers.set(sampleId, sampler);
      }

      // Update current sample
      this.currentAdminSampleId = sampleId;

      // Create custom click sound configuration
      const customSound: ClickSound = {
        type: ClickSoundType.CUSTOM_SAMPLE,
        url: sample.url,
        volume: 0.8,
        pitch: sample.metadata?.pitch || 0,
        envelope: sample.metadata?.envelope || {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.1,
        },
      };

      // Apply to all click types (accent, regular, subdivision)
      this.setCustomClickSound(ClickSoundType.CUSTOM_SAMPLE, customSound);

      // Update the config to use custom sample
      const config = this.getConfig();
      config.clickSounds.accent.type = ClickSoundType.CUSTOM_SAMPLE;
      config.clickSounds.regular.type = ClickSoundType.CUSTOM_SAMPLE;
      config.clickSounds.subdivision.type = ClickSoundType.CUSTOM_SAMPLE;

      console.log(`Switched to admin metronome sample: ${sample.name}`);
    } catch (error) {
      console.error(`Failed to set admin sample ${sampleId}:`, error);
    }
  }

  /**
   * Get available admin samples
   */
  public getAdminSamples(): AdminMetronomeSample[] {
    return Array.from(this.adminSamples.values());
  }

  /**
   * Get current admin sample
   */
  public getCurrentAdminSample(): AdminMetronomeSample | null {
    if (!this.currentAdminSampleId) return null;
    return this.adminSamples.get(this.currentAdminSampleId) || null;
  }

  /**
   * Preview an admin sample without switching
   */
  public async previewAdminSample(sampleId: string): Promise<void> {
    const sample = this.adminSamples.get(sampleId);
    if (!sample) {
      console.warn(`Admin sample not found for preview: ${sampleId}`);
      return;
    }

    try {
      // Load sample if not already loaded
      if (!this.adminSamplers.has(sampleId)) {
        await this.setAdminSample(sampleId);
      }

      // Play a quick preview
      const sampler = this.adminSamplers.get(sampleId);
      if (sampler) {
        sampler.triggerAttackRelease('C4', '8n', undefined, 0.8);
      }
    } catch (error) {
      console.error(`Failed to preview admin sample ${sampleId}:`, error);
    }
  }

  /**
   * Switch back to built-in click sounds
   */
  public useBuiltInSounds(preset?: string): void {
    this.currentAdminSampleId = null;

    // Reset to default preset
    if (preset) {
      this.setClickPreset(preset as any);
    } else {
      // Reset to electronic beep
      const config = this.getConfig();
      config.clickSounds.accent.type = ClickSoundType.ELECTRONIC_BEEP;
      config.clickSounds.regular.type = ClickSoundType.ELECTRONIC_BEEP;
      config.clickSounds.subdivision.type = ClickSoundType.ELECTRONIC_BEEP;
    }
  }

  /**
   * Override playClickEvent to support admin samples
   */
  protected playClickEvent(event: any, time: number): void {
    // Check if we're using an admin sample
    if (
      this.currentAdminSampleId &&
      event.clickSound === ClickSoundType.CUSTOM_SAMPLE
    ) {
      const sampler = this.adminSamplers.get(this.currentAdminSampleId);
      if (sampler) {
        const clickSound = this.getClickSoundConfig(event.clickSound);
        sampler.triggerAttackRelease(
          'C4',
          '16n',
          time,
          event.velocity * clickSound.volume,
        );
        return;
      }
    }

    // Fall back to parent implementation
    super.playClickEvent(event, time);
  }

  /**
   * Helper to get click sound config (protected method in parent)
   */
  private getClickSoundConfig(clickType: ClickSoundType): ClickSound {
    const config = this.getConfig();

    // Check for custom sounds first
    if (config.clickSounds.customSounds.has(clickType)) {
      return config.clickSounds.customSounds.get(clickType)!;
    }

    // Return default config based on type
    switch (clickType) {
      case config.clickSounds.accent.type:
        return config.clickSounds.accent;
      case config.clickSounds.subdivision.type:
        return config.clickSounds.subdivision;
      default:
        return config.clickSounds.regular;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Dispose admin samplers
    this.adminSamplers.forEach((sampler) => {
      try {
        sampler.dispose();
      } catch (error) {
        console.warn('Failed to dispose admin sampler:', error);
      }
    });
    this.adminSamplers.clear();
    this.adminSamples.clear();
    this.currentAdminSampleId = null;

    // Call parent dispose
    super.dispose();
  }
}

/**
 * Factory function to create enhanced metronome processor
 */
export async function createEnhancedMetronome(
  audioSampleManager: AudioSampleManager,
  config?: any,
): Promise<EnhancedMetronomeProcessor> {
  const processor = new EnhancedMetronomeProcessor(audioSampleManager, config);

  // Initialize with default samples
  await processor.initialize();

  // Load admin samples
  await processor.loadAdminSamples();

  return processor;
}
