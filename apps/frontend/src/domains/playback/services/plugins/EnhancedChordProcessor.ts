/**
 * Story 3.16: Enhanced Chord Processor with Professional Soundfonts
 * Updated for Story 3.18.3: Removed direct Tone import
 *
 * Extends the existing ChordInstrumentProcessor to support:
 * - Professional soundfonts from Supabase (Salamander Piano, Nice Keys Rhodes, etc.)
 * - Hybrid loading (admin-curated + local soundfonts)
 * - Advanced sampling and quality management
 * - Integration with AudioSampleManager for caching
 */

import {
  ChordInstrumentProcessor,
  ChordPreset,
} from './ChordInstrumentProcessor.js';
import { AudioSampleManager } from '../storage/AudioSampleManager.js';
import { getTone } from '../ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../../config/featureFlags.js';

export interface ProfessionalSoundfont {
  id: string;
  name: string;
  description: string;
  category:
    | 'acoustic_piano'
    | 'electric_piano'
    | 'organ'
    | 'strings'
    | 'brass'
    | 'pads';
  format: 'sf2' | 'sf3' | 'samples';
  path: string;
  size: number;
  license: string;
  author: string;
  quality: 'studio' | 'high' | 'standard';
}

export interface SoundfontMetadata {
  generated: string;
  instruments: ProfessionalSoundfont[];
}

export class EnhancedChordProcessor extends ChordInstrumentProcessor {
  private audioSampleManager: AudioSampleManager;
  private professionalSoundfonts: Map<string, ProfessionalSoundfont> =
    new Map();
  private loadedSoundfonts: Map<string, any> = new Map(); // Tone.Sampler
  private currentProfessionalPreset: string | null = null;
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
          console.log('[EnhancedChordProcessor] Using Tone from dependency injection');
        }
      } catch (error) {
        console.error('[EnhancedChordProcessor] Failed to get Tone from DI:', error);
        throw new Error('Tone.js not available. Ensure AudioEngine is initialized.');
      }
    }
    return this.Tone;
  }

  /**
   * Load professional soundfont metadata from Supabase
   */
  public async loadProfessionalSoundfonts(): Promise<void> {
    try {
      // Load the soundfont instruments index
      const indexResult = await this.audioSampleManager.loadSample(
        'metadata/keyboard-instruments.json',
      );

      if (!indexResult.success || !(indexResult.data instanceof ArrayBuffer)) {
        console.warn('No professional soundfonts index found, using defaults');
        return;
      }

      // Parse the index
      const indexText = new TextDecoder().decode(indexResult.data);
      const soundfontIndex = JSON.parse(indexText) as SoundfontMetadata;

      // Store soundfont metadata
      soundfontIndex.instruments.forEach((soundfont) => {
        this.professionalSoundfonts.set(soundfont.id, soundfont);
      });

      console.log(
        `Loaded ${this.professionalSoundfonts.size} professional soundfonts`,
      );
    } catch (error) {
      console.error('Failed to load professional soundfonts:', error);
    }
  }

  /**
   * Switch to a professional soundfont
   */
  public async setProfessionalSoundfont(soundfontId: string): Promise<void> {
    const soundfont = this.professionalSoundfonts.get(soundfontId);
    if (!soundfont) {
      console.warn(`Professional soundfont not found: ${soundfontId}`);
      return;
    }

    try {
      // Check if soundfont already loaded
      if (!this.loadedSoundfonts.has(soundfontId)) {
        await this.loadProfessionalSoundfontSamples(soundfont);
      }

      // Update current preset
      this.currentProfessionalPreset = soundfontId;

      console.log(`Switched to professional soundfont: ${soundfont.name}`);
    } catch (error) {
      console.error(
        `Failed to set professional soundfont ${soundfontId}:`,
        error,
      );
    }
  }

  /**
   * Load professional soundfont samples
   */
  private async loadProfessionalSoundfontSamples(
    soundfont: ProfessionalSoundfont,
  ): Promise<void> {
    if (soundfont.format === 'sf2' || soundfont.format === 'sf3') {
      // For SF2/SF3 files, we need to either convert to samples or serve them via CDN
      // For now, we'll create a note about CDN serving
      console.log(
        `Professional soundfont ${soundfont.name} is a large SF2 file.`,
      );
      console.log(
        'For production, serve this from CDN or convert to individual samples.',
      );

      // Create a fallback sampler with frequency mapping for simulation
      const sampler = new this.getToneInstance().Sampler(
        this.createProfessionalFrequencyMap(soundfont),
        {
          onload: () => {
            console.log(
              `Professional soundfont sampler ready: ${soundfont.name}`,
            );
          },
        },
      ).toDestination();

      this.loadedSoundfonts.set(soundfont.id, sampler);
    } else if (soundfont.format === 'samples') {
      // Load individual samples (when we have them converted)
      await this.loadIndividualSamples(soundfont);
    }
  }

  /**
   * Create professional frequency mapping for different instrument types
   */
  private createProfessionalFrequencyMap(
    soundfont: ProfessionalSoundfont,
  ): Record<string, string> {
    // For now, create synthetic samples that simulate the professional instruments
    // In production, these would be actual sample URLs

    const baseFrequencies: Record<string, number> = {};

    switch (soundfont.category) {
      case 'acoustic_piano':
        // Salamander Piano - warm, rich acoustic piano
        baseFrequencies['C2'] = 65.4;
        baseFrequencies['C3'] = 130.8;
        baseFrequencies['C4'] = 261.6; // Middle C
        baseFrequencies['C5'] = 523.3;
        baseFrequencies['C6'] = 1046.5;
        break;

      case 'electric_piano':
        // Nice Keys Rhodes - vintage electric piano
        baseFrequencies['C2'] = 65.4;
        baseFrequencies['C3'] = 130.8;
        baseFrequencies['C4'] = 261.6;
        baseFrequencies['C5'] = 523.3;
        baseFrequencies['C6'] = 1046.5;
        break;

      case 'organ':
        // Professional organ sounds
        baseFrequencies['C2'] = 65.4;
        baseFrequencies['C3'] = 130.8;
        baseFrequencies['C4'] = 261.6;
        baseFrequencies['C5'] = 523.3;
        break;

      default:
        // General MIDI frequency mapping
        baseFrequencies['C4'] = 261.6;
    }

    // Convert frequencies to synthetic oscillator URLs for now
    // In production, these would be actual sample file URLs
    const sampleUrls: Record<string, string> = {};
    Object.entries(baseFrequencies).forEach(([note, freq]) => {
      sampleUrls[note] = this.createSyntheticSampleUrl(freq, soundfont);
    });

    return sampleUrls;
  }

  /**
   * Create synthetic sample URL (placeholder for real samples)
   */
  private createSyntheticSampleUrl(
    frequency: number,
    soundfont: ProfessionalSoundfont,
  ): string {
    // This is a placeholder - in production this would return actual sample URLs
    // For now, we return a data URL or use Tone.js oscillators
    return `synthetic://${soundfont.category}/${frequency}`;
  }

  /**
   * Load individual samples from Supabase
   */
  private async loadIndividualSamples(
    soundfont: ProfessionalSoundfont,
  ): Promise<void> {
    // This would load converted individual samples
    // For now, placeholder implementation
    console.log(
      `Loading individual samples for ${soundfont.name} (placeholder)`,
    );

    const sampler = new this.getToneInstance().Sampler(
      {},
      {
        onload: () => {
          console.log(`Individual samples loaded: ${soundfont.name}`);
        },
      },
    ).toDestination();

    this.loadedSoundfonts.set(soundfont.id, sampler);
  }

  /**
   * Get available professional soundfonts
   */
  public getProfessionalSoundfonts(): ProfessionalSoundfont[] {
    return Array.from(this.professionalSoundfonts.values());
  }

  /**
   * Get soundfonts by category
   */
  public getProfessionalSoundfontsByCategory(
    category: ProfessionalSoundfont['category'],
  ): ProfessionalSoundfont[] {
    return Array.from(this.professionalSoundfonts.values()).filter(
      (sf) => sf.category === category,
    );
  }

  /**
   * Get current professional soundfont
   */
  public getCurrentProfessionalSoundfont(): ProfessionalSoundfont | null {
    if (!this.currentProfessionalPreset) return null;
    return (
      this.professionalSoundfonts.get(this.currentProfessionalPreset) || null
    );
  }

  /**
   * Preview a professional soundfont
   */
  public async previewProfessionalSoundfont(
    soundfontId: string,
  ): Promise<void> {
    const soundfont = this.professionalSoundfonts.get(soundfontId);
    if (!soundfont) {
      console.warn(
        `Professional soundfont not found for preview: ${soundfontId}`,
      );
      return;
    }

    try {
      // Load soundfont if not already loaded
      if (!this.loadedSoundfonts.has(soundfontId)) {
        await this.loadProfessionalSoundfontSamples(soundfont);
      }

      // Play a chord preview
      const sampler = this.loadedSoundfonts.get(soundfontId);
      if (sampler) {
        // Play a C major chord
        const chordNotes = ['C4', 'E4', 'G4'];
        chordNotes.forEach((note, index) => {
          sampler.triggerAttackRelease(note, '2n', `+${index * 0.1}`, 0.6);
        });
      }
    } catch (error) {
      console.error(
        `Failed to preview professional soundfont ${soundfontId}:`,
        error,
      );
    }
  }

  /**
   * Enhanced chord preset that includes professional soundfonts
   */
  public async setEnhancedChordPreset(
    preset: ChordPreset | string,
  ): Promise<void> {
    // Check if it's a professional soundfont ID
    if (typeof preset === 'string' && this.professionalSoundfonts.has(preset)) {
      await this.setProfessionalSoundfont(preset);
      return;
    }

    // Map traditional presets to professional soundfonts if available
    const professionalMapping: Record<ChordPreset, string> = {
      [ChordPreset.PIANO]: 'salamander-piano',
      [ChordPreset.RHODES]: 'nice-keys-rhodes',
      [ChordPreset.ORGAN]: 'fluid-gm', // Use GM soundfont for organ sounds
      [ChordPreset.PAD]: 'fluid-gm',
      [ChordPreset.STRINGS]: 'fluid-gm',
      [ChordPreset.BRASS]: 'fluid-gm',
      [ChordPreset.SYNTH_LEAD]: 'fluid-gm',
      [ChordPreset.WARM_PAD]: 'fluid-gm',
    };

    const professionalId = professionalMapping[preset as ChordPreset];
    if (professionalId && this.professionalSoundfonts.has(professionalId)) {
      await this.setProfessionalSoundfont(professionalId);
    } else {
      // Fall back to original chord preset
      this.setChordPreset(preset as ChordPreset);
    }
  }

  /**
   * Override chord triggering to use professional soundfonts when available
   */
  public async triggerChordAttack(
    chordSymbol: string,
    velocity = 0.7,
    duration = 1000,
  ): Promise<string> {
    // If we have a professional soundfont loaded, prefer it
    if (
      this.currentProfessionalPreset &&
      this.loadedSoundfonts.has(this.currentProfessionalPreset)
    ) {
      return this.triggerProfessionalChord(chordSymbol, velocity, duration);
    }

    // Fall back to parent implementation
    return super.triggerChordAttack(chordSymbol, velocity, duration);
  }

  /**
   * Trigger chord using professional soundfont
   */
  private async triggerProfessionalChord(
    chordSymbol: string,
    velocity: number,
    duration: number,
  ): Promise<string> {
    const sampler = this.loadedSoundfonts.get(this.currentProfessionalPreset!);
    if (!sampler) {
      throw new Error('Professional soundfont not loaded');
    }

    // Parse chord and get voicing (use parent methods)
    const chordId = `chord_${Date.now()}_${Math.random()}`;

    try {
      // Use parent's chord parsing and voicing logic
      const parsedChord = this.parseChordSymbol(chordSymbol);
      const voicing = this.generateVoicing(parsedChord.symbol);

      console.log(`🎹 Playing professional chord: ${chordSymbol}`, {
        voicing,
        soundfont: this.currentProfessionalPreset,
        velocity,
        duration,
      });

      // Play chord with professional samples
      voicing.forEach((note, index) => {
        const noteDelay = index * 0.01; // Slight spread for richness
        sampler.triggerAttackRelease(
          note,
          duration / 1000,
          `+${noteDelay}`,
          velocity,
        );
      });

      return chordId;
    } catch (error) {
      console.error('Failed to trigger professional chord:', error);
      throw error;
    }
  }

  /**
   * Switch back to built-in sounds
   */
  public useBuiltInSounds(preset?: ChordPreset): void {
    this.currentProfessionalPreset = null;

    if (preset) {
      this.setChordPreset(preset);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Dispose professional samplers
    this.loadedSoundfonts.forEach((sampler) => {
      try {
        sampler.dispose();
      } catch (error) {
        console.warn('Failed to dispose professional sampler:', error);
      }
    });
    this.loadedSoundfonts.clear();
    this.professionalSoundfonts.clear();
    this.currentProfessionalPreset = null;

    // Call parent dispose
    super.dispose();
  }
}

/**
 * Factory function to create enhanced chord processor
 */
export async function createEnhancedChordProcessor(
  audioSampleManager: AudioSampleManager,
  config?: any,
): Promise<EnhancedChordProcessor> {
  const processor = new EnhancedChordProcessor(audioSampleManager, config);

  // Initialize with default sounds
  await processor.initialize();

  // Load professional soundfonts
  await processor.loadProfessionalSoundfonts();

  return processor;
}
