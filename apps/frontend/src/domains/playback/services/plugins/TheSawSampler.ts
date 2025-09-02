import { loadGlobalTone } from './toneLoader';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

/**
 * The Saw synthesizer sampler with ADSR envelope and filter controls
 * Uses JiKay's "The Saw" samples with interpolation between sampled notes
 */

export interface SawADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterSettings {
  cutoff: number; // Hz (20-20000)
  resonance: number; // Q factor (0-30)
}

export class TheSawSampler {
  private sampler: Tone.Sampler | null = null;
  private filter: Tone.Filter | null = null;
  private isInitialized = false;
  private destination: Tone.InputNode | null = null;
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';

  // ADSR envelope for amplitude
  private envelope: SawADSREnvelope = {
    attack: 0.005, // Fast attack
    decay: 0.1, // Quick decay
    sustain: 0.7, // 70% sustain level
    release: 0.5, // Medium release
  };

  // Filter settings - default to fully open for clean samples
  private filterSettings: FilterSettings = {
    cutoff: 20000, // Fully open by default
    resonance: 0, // No resonance by default
  };

  // Note mapping based on available samples
  private readonly sampleMapping = {
    C0: 'C0.mp3',
    G0: 'G0.mp3',
    D1: 'D1.mp3',
    A1: 'A1.mp3',
    E2: 'E2.mp3',
    B2: 'B2.mp3',
    'F#3': 'Fs3.mp3', // Rename for URL compatibility
    'C#4': 'Cs4.mp3', // Rename for URL compatibility
    'G#4': 'Gs4.mp3', // Rename for URL compatibility
    'D#5': 'Ds5.mp3', // Rename for URL compatibility
    'A#5': 'As5.mp3', // Rename for URL compatibility
  };

  constructor() {
    // Initialize with classic saw lead settings
  }

  /**
   * Ensure Tone.js is loaded dynamically
   */
  private async ensureToneLoaded(): Promise<void> {
    if (!Tone) {
      Tone = await loadGlobalTone();
      logger.info('🎵 Using global Tone.js instance in TheSawSampler');
    }
  }

  /**
   * Initialize The Saw sampler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🎹 Initializing The Saw...');

    try {
      // Ensure Tone is loaded before initializing
      await this.ensureToneLoaded();

      // Ensure Tone.js context is started
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      // Create the filter (24dB/octave lowpass)
      this.filter = new Tone.Filter({
        frequency: this.filterSettings.cutoff,
        type: 'lowpass',
        rolloff: -24,
        Q: this.filterSettings.resonance,
      });

      // Create sampler with all available notes
      this.sampler = new Tone.Sampler({
        urls: this.sampleMapping,
        baseUrl: `${this.supabaseUrl}/Keyboards/thesaw/`,
        attack: this.envelope.attack,
        release: this.envelope.release,
        curve: 'exponential',
        onload: () => {
          logger.info('✅ The Saw samples loaded successfully');
        },
        onerror: (error: any) => {
          logger.error('❌ Error loading The Saw samples:', error);
        },
      });

      // Wait for sampler to load
      await this.sampler.loaded;

      // Connect signal chain: Sampler -> Filter -> Destination
      this.sampler.connect(this.filter);

      // Connect to destination if available
      if (this.destination) {
        this.filter.connect(this.destination);
      }

      this.isInitialized = true;
      logger.info('✅ The Saw ready');
    } catch (error) {
      logger.error('Failed to initialize The Saw:', error);
      throw error;
    }
  }

  /**
   * Set ADSR envelope parameters
   */
  setEnvelope(envelope: Partial<SawADSREnvelope>): void {
    this.envelope = { ...this.envelope, ...envelope };

    if (this.sampler) {
      // Update sampler envelope
      if (envelope.attack !== undefined) {
        this.sampler.attack = envelope.attack;
      }
      if (envelope.release !== undefined) {
        this.sampler.release = envelope.release;
      }
      // Note: Decay and Sustain need custom implementation for Sampler
    }
  }

  /**
   * Set filter cutoff frequency (20Hz - 20kHz)
   */
  setFilterCutoff(frequency: number): void {
    this.filterSettings.cutoff = Math.max(20, Math.min(20000, frequency));
    if (this.filter) {
      this.filter.frequency.value = this.filterSettings.cutoff;
    }
  }

  /**
   * Set filter resonance (Q factor)
   * 0-10 for mild to strong resonance
   */
  setFilterResonance(resonance: number): void {
    this.filterSettings.resonance = Math.max(0, Math.min(10, resonance));
    if (this.filter) {
      this.filter.Q.value = this.filterSettings.resonance;
    }
  }

  /**
   * Get current envelope settings
   */
  getEnvelope(): SawADSREnvelope {
    return { ...this.envelope };
  }

  /**
   * Get current filter settings
   */
  getFilterSettings(): FilterSettings {
    return JSON.parse(JSON.stringify(this.filterSettings));
  }

  /**
   * Play a note with The Saw sound
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity = 0.7,
  ): Promise<void> {
    if (!this.sampler || !this.isInitialized) {
      logger.warn('The Saw not initialized');
      return;
    }

    try {
      const notes = Array.isArray(note) ? note : [note];
      const noteTime = time !== undefined ? time : Tone.now();

      // Trigger the sampler
      this.sampler.triggerAttackRelease(notes, duration, noteTime, velocity);
    } catch (error) {
      logger.error('Error playing The Saw note:', error);
    }
  }

  /**
   * Trigger attack (note on)
   */
  async triggerAttack(
    note: string | string[],
    time?: Tone.Unit.Time,
    velocity = 0.7,
  ): Promise<void> {
    if (!this.sampler || !this.isInitialized) {
      logger.warn('The Saw not initialized');
      return;
    }

    try {
      const noteTime = time !== undefined ? time : Tone.now();
      this.sampler.triggerAttack(note, noteTime, velocity);
    } catch (error) {
      logger.error('Error triggering The Saw attack:', error);
    }
  }

  /**
   * Trigger release (note off)
   */
  triggerRelease(note: string | string[], time?: Tone.Unit.Time): void {
    if (!this.sampler) return;

    const releaseTime = time !== undefined ? time : Tone.now();
    this.sampler.triggerRelease(note, releaseTime);
  }

  /**
   * Connect to audio destination
   */
  connect(destination: Tone.InputNode): this {
    this.destination = destination;

    if (this.filter) {
      this.filter.connect(destination);
    }

    return this;
  }

  /**
   * Disconnect from audio
   */
  disconnect(): this {
    if (this.filter) {
      this.filter.disconnect();
    }

    return this;
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      envelope: this.envelope,
      filterSettings: this.filterSettings,
      sampledNotes: Object.keys(this.sampleMapping).length,
    };
  }

  /**
   * Stop all currently playing notes immediately
   */
  stopAll(): void {
    if (this.sampler && this.sampler.loaded) {
      try {
        // Store original envelope
        const originalEnvelope = {
          attack: this.sampler.attack,
          decay: this.sampler.decay,
          sustain: this.sampler.sustain,
          release: this.sampler.release,
        };

        // Set to immediate silence
        this.sampler.attack = 0;
        this.sampler.decay = 0;
        this.sampler.sustain = 0;
        this.sampler.release = 0;

        // Release all notes
        this.sampler.releaseAll(Tone.immediate());

        // Restore envelope after a brief moment
        setTimeout(() => {
          if (this.sampler) {
            this.sampler.attack = originalEnvelope.attack;
            this.sampler.decay = originalEnvelope.decay;
            this.sampler.sustain = originalEnvelope.sustain;
            this.sampler.release = originalEnvelope.release;
          }
        }, 50);
      } catch (error) {
        logger.warn('Failed to release notes on The Saw sampler:', error);
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Stop all notes first
    this.stopAll();

    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }

    if (this.filter) {
      this.filter.dispose();
      this.filter = null;
    }

    this.isInitialized = false;
    logger.info('🗑️ Disposed The Saw sampler');
  }

  /**
   * Preset: Classic Saw Lead
   */
  loadPresetClassicLead(): void {
    this.setEnvelope({
      attack: 0.005,
      decay: 0.1,
      sustain: 0.7,
      release: 0.5,
    });
    this.setFilterCutoff(5000);
    this.setFilterResonance(5);
  }

  /**
   * Preset: Warm Pad
   */
  loadPresetWarmPad(): void {
    this.setEnvelope({
      attack: 0.8,
      decay: 0.5,
      sustain: 0.8,
      release: 2.0,
    });
    this.setFilterCutoff(2000);
    this.setFilterResonance(1);
  }

  /**
   * Preset: Aggressive Bass
   */
  loadPresetBass(): void {
    this.setEnvelope({
      attack: 0.001,
      decay: 0.2,
      sustain: 0.3,
      release: 0.3,
    });
    this.setFilterCutoff(500);
    this.setFilterResonance(8);
  }

  /**
   * Preset: Bright Pluck
   */
  loadPresetPluck(): void {
    this.setEnvelope({
      attack: 0.001,
      decay: 0.05,
      sustain: 0.0,
      release: 0.5,
    });
    this.setFilterCutoff(8000);
    this.setFilterResonance(5);
  }
}

/**
 * Singleton instance for global use
 */
export const theSawSampler = new TheSawSampler();
