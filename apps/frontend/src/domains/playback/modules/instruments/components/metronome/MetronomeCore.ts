/**
 * Metronome Core
 *
 * Core metronome functionality - click generation and sample playback
 */

import type * as ToneTypes from 'tone';
import { BaseInstrumentCore } from '../../architecture/IInstrumentCore.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';

// Helper to get Tone from window (must be initialized before MetronomeCore is used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone as typeof import('tone');
    }
  }
  throw new Error(
    'MetronomeCore: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

const logger = createStructuredLogger('MetronomeCore');

export interface MetronomeNote extends Note {
  clickType: 'accent' | 'regular' | 'subdivision';
  beat: number;
  subdivision?: number;
}

export interface ClickSound {
  name: string;
  url?: string;
  synth?: 'membrane' | 'metal' | 'noise';
  synthParams?: any;
}

export interface MetronomeConfig {
  accentClick: ClickSound;
  regularClick: ClickSound;
  subdivisionClick: ClickSound;
  volume: number; // in dB
  pan: number; // -1 to 1
}

/**
 * Core metronome implementation
 */
export class MetronomeCore extends BaseInstrumentCore {
  readonly id = 'metronome-core';
  readonly type = 'metronome';
  readonly name = 'Metronome Core';

  private config: MetronomeConfig;
  private samplers: Map<string, ToneTypes.Sampler> = new Map();
  private synths: Map<
    string,
    | ToneTypes.Synth
    | ToneTypes.MembraneSynth
    | ToneTypes.MetalSynth
    | ToneTypes.NoiseSynth
  > = new Map();
  private volume: ToneTypes.Volume | null = null;
  private panner: ToneTypes.Panner | null = null;

  constructor(config: Partial<MetronomeConfig> = {}) {
    super();

    this.config = {
      accentClick: {
        name: 'accent',
        synth: 'membrane',
        synthParams: {
          pitchDecay: 0.008,
          octaves: 2,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0,
          },
        },
      },
      regularClick: {
        name: 'regular',
        synth: 'membrane',
        synthParams: {
          pitchDecay: 0.005,
          octaves: 1.5,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0,
          },
        },
      },
      subdivisionClick: {
        name: 'subdivision',
        synth: 'noise',
        synthParams: {
          noise: { type: 'white' },
          envelope: {
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
          },
        },
      },
      volume: -6,
      pan: 0,
      ...config,
    };

    // Audio nodes will be created during initialization
  }

  async initialize(): Promise<void> {
    if (this.state.initialized) return;

    this.state.loading = true;

    try {
      const Tone = getTone();

      // Create audio nodes
      this.volume = new Tone.Volume(this.config.volume);
      this.panner = new Tone.Panner(this.config.pan);

      // Connect chain
      this.panner.connect(this.volume);
      this.output = this.volume;

      // Create synths for each click type
      await this.createClickSound('accent', this.config.accentClick);
      await this.createClickSound('regular', this.config.regularClick);
      await this.createClickSound('subdivision', this.config.subdivisionClick);

      this.state.initialized = true;
      this.state.loading = false;
      this.state.ready = true;

      logger.info('MetronomeCore initialized');
    } catch (error) {
      this.state.error = error as Error;
      this.state.loading = false;
      logger.error('Failed to initialize MetronomeCore', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    // Dispose samplers
    for (const sampler of this.samplers.values()) {
      sampler.dispose();
    }
    this.samplers.clear();

    // Dispose synths
    for (const synth of this.synths.values()) {
      synth.dispose();
    }
    this.synths.clear();

    // Dispose audio nodes
    this.volume?.dispose();
    this.panner?.dispose();

    this.volume = null;
    this.panner = null;

    this.state.ready = false;
    this.state.initialized = false;

    logger.info('MetronomeCore disposed');
  }

  trigger(note: Note): void {
    const Tone = getTone();
    const metronomeNote = note as MetronomeNote;
    const clickType = metronomeNote.clickType || 'regular';
    const time = metronomeNote.time || Tone.now();
    const velocity = note.velocity / 127;

    // Get the appropriate sound source
    const sampler = this.samplers.get(clickType);
    const synth = this.synths.get(clickType);

    if (sampler && sampler.loaded) {
      // Use sampler if available
      sampler.triggerAttackRelease(note.pitch || 'C4', '8n', time, velocity);
    } else if (synth) {
      // Use synth - check by synth type string in config instead of instanceof
      const synthConfig = this.getSynthConfigForType(clickType);
      if (synthConfig?.synth === 'membrane') {
        (synth as ToneTypes.MembraneSynth).triggerAttackRelease(
          note.pitch || 'C2',
          '8n',
          time,
          velocity,
        );
      } else if (
        synthConfig?.synth === 'metal' ||
        synthConfig?.synth === 'noise'
      ) {
        (
          synth as ToneTypes.MetalSynth | ToneTypes.NoiseSynth
        ).triggerAttackRelease('8n', time, velocity);
      } else {
        (synth as ToneTypes.Synth).triggerAttackRelease(
          note.pitch || 'C4',
          '8n',
          time,
          velocity,
        );
      }
    }

    // Track active note
    const noteEvent = {
      id: this.generateNoteId(note),
      ...metronomeNote,
      startTime: time,
      active: true,
    };

    this.state.activeNotes.set(noteEvent.id, noteEvent);

    // Auto-release after duration
    Tone.Transport.schedule(() => {
      this.state.activeNotes.delete(noteEvent.id);
    }, time + 0.1);
  }

  private getSynthConfigForType(type: string): ClickSound | null {
    switch (type) {
      case 'accent':
        return this.config.accentClick;
      case 'regular':
        return this.config.regularClick;
      case 'subdivision':
        return this.config.subdivisionClick;
      default:
        return null;
    }
  }

  release(note: Note): void {
    // Metronome clicks are typically one-shot, so release is a no-op
    // But we'll clear from active notes if needed
    const noteId = this.generateNoteId(note);
    this.state.activeNotes.delete(noteId);
  }

  /**
   * Create a click sound from configuration
   */
  private async createClickSound(
    type: string,
    config: ClickSound,
  ): Promise<void> {
    const Tone = getTone();
    if (config.url) {
      // Load sample
      const sampler = new Tone.Sampler({
        urls: {
          C4: config.url,
        },
        onload: () => {
          logger.info(`Loaded sample for ${type}`, { url: config.url });
        },
      }).connect(this.panner!);

      this.samplers.set(type, sampler);
    } else if (config.synth) {
      // Create synth
      let synth:
        | ToneTypes.Synth
        | ToneTypes.MembraneSynth
        | ToneTypes.MetalSynth
        | ToneTypes.NoiseSynth;

      switch (config.synth) {
        case 'membrane':
          synth = new Tone.MembraneSynth(config.synthParams);
          break;
        case 'metal':
          synth = new Tone.MetalSynth(config.synthParams);
          break;
        case 'noise':
          synth = new Tone.NoiseSynth(config.synthParams);
          break;
        default:
          synth = new Tone.Synth(config.synthParams);
      }

      synth.connect(this.panner!);
      this.synths.set(type, synth);
    }
  }

  /**
   * Update click sound configuration
   */
  async updateClickSound(
    type: 'accent' | 'regular' | 'subdivision',
    config: ClickSound,
  ): Promise<void> {
    // Dispose existing
    const existingSampler = this.samplers.get(type);
    if (existingSampler) {
      existingSampler.dispose();
      this.samplers.delete(type);
    }

    const existingSynth = this.synths.get(type);
    if (existingSynth) {
      existingSynth.dispose();
      this.synths.delete(type);
    }

    // Create new
    await this.createClickSound(type, config);

    // Update config
    switch (type) {
      case 'accent':
        this.config.accentClick = config;
        break;
      case 'regular':
        this.config.regularClick = config;
        break;
      case 'subdivision':
        this.config.subdivisionClick = config;
        break;
    }
  }

  /**
   * Set volume
   */
  setVolume(volumeDb: number): void {
    this.config.volume = volumeDb;
    if (this.volume) {
      this.volume.volume.value = volumeDb;
    }
  }

  /**
   * Set pan
   */
  setPan(pan: number): void {
    this.config.pan = Math.max(-1, Math.min(1, pan));
    if (this.panner) {
      this.panner.pan.value = this.config.pan;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MetronomeConfig {
    return { ...this.config };
  }
}
