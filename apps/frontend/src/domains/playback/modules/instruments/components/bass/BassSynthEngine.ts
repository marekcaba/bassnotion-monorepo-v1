/**
 * Bass Synth Engine
 *
 * Synthesis engine for bass sounds with multiple oscillator types
 */

import { getTone } from '@/domains/playback/utils/tone';
import type * as ToneTypes from 'tone';
import {
  BaseInstrumentCore,
  ISynthCore,
} from '../../architecture/IInstrumentCore.js';
import type { Note, SynthOptions } from '../../architecture/IInstrumentCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('BassSynthEngine');

export interface BassNote extends Note {
  technique?: 'fingered' | 'picked' | 'slapped' | 'muted' | 'harmonics';
  string?: number; // Which string (1-4 for standard bass)
  fret?: number; // Fret position
  slide?: { to: number; duration: number }; // Slide to fret
  vibrato?: { rate: number; depth: number };
}

export interface BassSynthOptions extends SynthOptions {
  oscillatorType?: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'custom';
  filterCutoff?: number;
  filterResonance?: number;
  envelopeAttack?: number;
  envelopeDecay?: number;
  envelopeSustain?: number;
  envelopeRelease?: number;
  detune?: number;
  subOscillatorLevel?: number;
}

export interface BassPreset {
  id: string;
  name: string;
  description?: string;
  synthOptions: BassSynthOptions;
  effectSettings?: {
    chorus?: boolean;
    distortion?: number;
    compression?: boolean;
  };
}

/**
 * Synthesis engine for bass sounds
 */
export class BassSynthEngine extends BaseInstrumentCore implements ISynthCore {
  readonly id = 'bass-synth-engine';
  readonly type = 'bass';
  readonly name = 'Bass Synth Engine';

  private synth: ToneTypes.PolySynth | null = null;
  private subOscillator: ToneTypes.Oscillator | null = null;
  private filter: ToneTypes.Filter | null = null;
  private envelope: ToneTypes.AmplitudeEnvelope | null = null;
  private volume: ToneTypes.Volume | null = null;

  // Synthesis options
  private options: BassSynthOptions = {
    oscillatorType: 'sawtooth',
    filterCutoff: 800,
    filterResonance: 2,
    envelopeAttack: 0.01,
    envelopeDecay: 0.1,
    envelopeSustain: 0.6,
    envelopeRelease: 0.5,
    detune: 0,
    subOscillatorLevel: 0.3,
  };

  // Technique-specific modifiers
  private techniqueModifiers = {
    fingered: { attack: 0.01, brightness: 0.7 },
    picked: { attack: 0.005, brightness: 0.9 },
    slapped: { attack: 0.001, brightness: 1.0, percussive: true },
    muted: { attack: 0.005, brightness: 0.3, sustain: 0.1 },
    harmonics: { attack: 0.02, brightness: 1.2, harmonic: true },
  };

  constructor(options?: BassSynthOptions) {
    super();

    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Volume will be created during initialization
  }

  async initialize(): Promise<void> {
    if (this.state.initialized) return;

    this.state.loading = true;

    try {
      const Tone = await getTone();

      // Create output volume
      this.volume = new Tone.Volume(-6);
      this.output = this.volume;

      // Create main synthesizer
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: this.options.oscillatorType || 'sawtooth',
        },
        envelope: {
          attack: this.options.envelopeAttack,
          decay: this.options.envelopeDecay,
          sustain: this.options.envelopeSustain,
          release: this.options.envelopeRelease,
        },
      });

      // Create sub-oscillator for deeper bass
      this.subOscillator = new Tone.Oscillator({
        frequency: 0, // Will be set per note
        type: 'sine',
        volume: -12,
      });

      // Create filter
      this.filter = new Tone.Filter({
        frequency: this.options.filterCutoff,
        Q: this.options.filterResonance,
        type: 'lowpass',
      });

      // Create amplitude envelope for sub-oscillator
      this.envelope = new Tone.AmplitudeEnvelope({
        attack: this.options.envelopeAttack,
        decay: this.options.envelopeDecay,
        sustain: this.options.envelopeSustain,
        release: this.options.envelopeRelease,
      });

      // Connect signal chain
      this.synth.connect(this.filter);
      this.subOscillator.connect(this.envelope);
      this.envelope.connect(this.filter);
      this.filter.connect(this.volume);

      // Start sub-oscillator (but keep it silent until triggered)
      await this.subOscillator.start();

      this.state.initialized = true;
      this.state.loading = false;
      this.state.ready = true;

      logger.info('BassSynthEngine initialized', {
        oscillator: this.options.oscillatorType,
        polyphony: this.synth.maxPolyphony,
      });
    } catch (error) {
      this.state.error = error as Error;
      this.state.loading = false;
      logger.error('Failed to initialize BassSynthEngine', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    // Stop all active notes
    this.releaseAll();

    // Dispose audio nodes
    this.synth?.dispose();
    this.subOscillator?.dispose();
    this.filter?.dispose();
    this.envelope?.dispose();
    this.volume?.dispose();

    this.synth = null;
    this.subOscillator = null;
    this.filter = null;
    this.envelope = null;
    this.volume = null;

    this.state.ready = false;
    this.state.initialized = false;

    logger.info('BassSynthEngine disposed');
  }

  /**
   * Trigger a bass note
   */
  async trigger(note: Note): Promise<void> {
    if (!this.synth || !this.state.ready) return;

    const Tone = await getTone();
    const bassNote = note as BassNote;
    const frequency = await this.getFrequency(bassNote);
    const time = bassNote.time || Tone.now();

    // Apply technique modifiers
    if (bassNote.technique) {
      this.applyTechnique(bassNote.technique);
    }

    // Trigger main synth
    this.synth.triggerAttack(frequency, time, bassNote.velocity / 127);

    // Trigger sub-oscillator
    if (this.subOscillator && this.envelope) {
      this.subOscillator.frequency.setValueAtTime(frequency / 2, time);
      this.envelope.triggerAttack(time, bassNote.velocity / 127);
    }

    // Handle slide
    // Note: PolySynth doesn't support frequency ramp directly; slide effects
    // would need a monophonic synth or per-voice control. For now, we log
    // the slide request but the effect is not implemented for PolySynth.
    if (bassNote.slide && this.synth) {
      const targetFreq = this.getFrequencyFromFret(
        bassNote.string || 3,
        bassNote.slide.to,
      );
      logger.debug('Slide effect requested but not implemented for PolySynth', {
        targetFreq,
        duration: bassNote.slide.duration,
      });
    }

    // Handle vibrato
    if (bassNote.vibrato && this.synth) {
      await this.applyVibrato(bassNote.vibrato, time);
    }

    // Track active note
    const noteEvent = {
      id: this.generateNoteId(note),
      ...bassNote,
      frequency,
      startTime: time,
      active: true,
    };

    this.state.activeNotes.set(noteEvent.id, noteEvent);
  }

  /**
   * Release a bass note
   */
  async release(note: Note): Promise<void> {
    if (!this.synth || !this.state.ready) return;

    const Tone = await getTone();
    const bassNote = note as BassNote;
    const frequency = await this.getFrequency(bassNote);
    const time = bassNote.time || Tone.now();

    // Release main synth
    this.synth.triggerRelease(frequency, time);

    // Release sub-oscillator
    if (this.envelope) {
      this.envelope.triggerRelease(time);
    }

    // Remove from active notes
    const noteId = this.generateNoteId(note);
    this.state.activeNotes.delete(noteId);
  }

  // ISynthCore implementation
  updateSynthOptions(options: SynthOptions): void {
    const bassOptions = options as BassSynthOptions;
    this.options = { ...this.options, ...bassOptions };

    // Update synth parameters
    if (this.synth) {
      this.synth.set({
        oscillator: {
          type: this.options.oscillatorType || 'sawtooth',
        },
        envelope: {
          attack: this.options.envelopeAttack,
          decay: this.options.envelopeDecay,
          sustain: this.options.envelopeSustain,
          release: this.options.envelopeRelease,
        },
      });
    }

    // Update filter
    if (this.filter) {
      this.filter.frequency.value = this.options.filterCutoff || 800;
      this.filter.Q.value = this.options.filterResonance || 2;
    }

    // Update envelope
    if (this.envelope) {
      this.envelope.attack = this.options.envelopeAttack || 0.01;
      this.envelope.decay = this.options.envelopeDecay || 0.1;
      this.envelope.sustain = this.options.envelopeSustain || 0.6;
      this.envelope.release = this.options.envelopeRelease || 0.5;
    }
  }

  getSynthOptions(): SynthOptions {
    return { ...this.options };
  }

  releaseAll(): void {
    if (!this.synth) return;

    // Release all notes
    this.synth.releaseAll();

    if (this.envelope) {
      this.envelope.triggerRelease();
    }

    this.state.activeNotes.clear();
  }

  /**
   * Apply technique-specific modifications
   */
  private applyTechnique(technique: BassNote['technique']): void {
    if (!technique || !this.techniqueModifiers[technique]) return;

    const mods = this.techniqueModifiers[technique];

    if (this.synth) {
      // Adjust envelope attack
      this.synth.envelope.attack = mods.attack;

      // Adjust filter brightness
      if (this.filter) {
        const baseCutoff = this.options.filterCutoff || 800;
        this.filter.frequency.value = baseCutoff * mods.brightness;
      }

      // Special handling for slapped bass
      if (technique === 'slapped' && mods.percussive) {
        this.synth.envelope.decay = 0.05;
        this.synth.envelope.sustain = 0.1;
      }

      // Special handling for muted
      if (technique === 'muted' && mods.sustain !== undefined) {
        this.synth.envelope.sustain = mods.sustain;
      }
    }
  }

  /**
   * Apply vibrato effect
   * Note: PolySynth doesn't expose a global detune parameter, so vibrato
   * is not directly applicable. This would require a monophonic synth or
   * per-voice detune modulation. For now, we log the request.
   */
  private async applyVibrato(
    vibrato: { rate: number; depth: number },
    _time: number,
  ): Promise<void> {
    if (!this.synth) return;

    // PolySynth doesn't expose detune for LFO modulation.
    // Vibrato would need to be implemented at the voice level or
    // by using a monophonic synth instead.
    logger.debug('Vibrato effect requested but not implemented for PolySynth', {
      rate: vibrato.rate,
      depth: vibrato.depth,
    });
  }

  /**
   * Get frequency from bass note
   */
  private async getFrequency(note: BassNote): Promise<number> {
    // If pitch is specified as frequency
    if (typeof note.pitch === 'number') {
      return note.pitch;
    }

    // If string and fret are specified
    if (note.string !== undefined && note.fret !== undefined) {
      return this.getFrequencyFromFret(note.string, note.fret);
    }

    // Parse note name
    if (typeof note.pitch === 'string') {
      const Tone = await getTone();
      return Tone.Frequency(note.pitch).toFrequency();
    }

    // Default to low E
    return 82.41; // E1
  }

  /**
   * Calculate frequency from string and fret
   */
  private getFrequencyFromFret(string: number, fret: number): number {
    // Standard 4-string bass tuning: E-A-D-G
    const openStringFrequencies = [
      82.41, // E1
      110.0, // A1
      146.83, // D2
      196.0, // G2
    ];

    // Get open string frequency
    const stringIndex = Math.max(0, Math.min(3, string - 1));
    const openFreq = openStringFrequencies[stringIndex];

    // Calculate fretted frequency
    return openFreq * Math.pow(2, fret / 12);
  }

  /**
   * Set filter parameters
   */
  setFilter(cutoff: number, resonance: number): void {
    if (this.filter) {
      this.filter.frequency.rampTo(cutoff, 0.05);
      this.filter.Q.rampTo(resonance, 0.05);
    }

    this.options.filterCutoff = cutoff;
    this.options.filterResonance = resonance;
  }

  /**
   * Set oscillator type
   */
  setOscillatorType(type: BassSynthOptions['oscillatorType']): void {
    if (this.synth && type) {
      this.synth.set({ oscillator: { type } });
      this.options.oscillatorType = type;
    }
  }

  /**
   * Set sub-oscillator level
   */
  setSubOscillatorLevel(level: number): void {
    if (this.subOscillator) {
      const dbLevel = 20 * Math.log10(level);
      this.subOscillator.volume.rampTo(dbLevel, 0.05);
      this.options.subOscillatorLevel = level;
    }
  }

  /**
   * Load a preset
   */
  loadPreset(preset: BassPreset): void {
    this.updateSynthOptions(preset.synthOptions);
    logger.info(`Loaded bass preset: ${preset.name}`);
  }
}

/**
 * Common bass presets
 */
export const BassPresets: Record<string, BassPreset> = {
  classic: {
    id: 'classic',
    name: 'Classic Bass',
    description: 'Warm, rounded bass tone',
    synthOptions: {
      oscillatorType: 'sawtooth',
      filterCutoff: 600,
      filterResonance: 2,
      envelopeAttack: 0.01,
      envelopeDecay: 0.1,
      envelopeSustain: 0.7,
      envelopeRelease: 0.4,
      subOscillatorLevel: 0.3,
    },
  },

  funky: {
    id: 'funky',
    name: 'Funky Bass',
    description: 'Bright, punchy bass for funk and disco',
    synthOptions: {
      oscillatorType: 'square',
      filterCutoff: 1200,
      filterResonance: 5,
      envelopeAttack: 0.005,
      envelopeDecay: 0.05,
      envelopeSustain: 0.4,
      envelopeRelease: 0.2,
      subOscillatorLevel: 0.2,
    },
  },

  deep: {
    id: 'deep',
    name: 'Deep Sub Bass',
    description: 'Deep, sub-heavy bass',
    synthOptions: {
      oscillatorType: 'sine',
      filterCutoff: 400,
      filterResonance: 1,
      envelopeAttack: 0.02,
      envelopeDecay: 0.2,
      envelopeSustain: 0.8,
      envelopeRelease: 0.8,
      subOscillatorLevel: 0.6,
    },
  },

  acid: {
    id: 'acid',
    name: 'Acid Bass',
    description: '303-style acid bass',
    synthOptions: {
      oscillatorType: 'sawtooth',
      filterCutoff: 2000,
      filterResonance: 15,
      envelopeAttack: 0.001,
      envelopeDecay: 0.3,
      envelopeSustain: 0.0,
      envelopeRelease: 0.1,
      subOscillatorLevel: 0.0,
    },
    effectSettings: {
      distortion: 0.6,
    },
  },

  modern: {
    id: 'modern',
    name: 'Modern Bass',
    description: 'Contemporary bass sound with clarity',
    synthOptions: {
      oscillatorType: 'triangle',
      filterCutoff: 1000,
      filterResonance: 3,
      envelopeAttack: 0.008,
      envelopeDecay: 0.15,
      envelopeSustain: 0.5,
      envelopeRelease: 0.3,
      subOscillatorLevel: 0.4,
    },
    effectSettings: {
      compression: true,
      chorus: true,
    },
  },
};
