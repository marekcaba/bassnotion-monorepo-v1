/**
 * Core Instrument Interface
 *
 * Base interface for all instrument implementations
 */

import type * as Tone from 'tone';

export interface Note {
  pitch: string | number; // e.g., 'C4' or MIDI note number
  velocity: number; // 0-127
  duration?: number; // in seconds
  time?: number; // when to play (in seconds)
  channel?: number; // MIDI channel
}

export interface NoteEvent extends Note {
  id: string;
  startTime: number;
  endTime?: number;
  active: boolean;
}

export interface InstrumentOptions {
  volume?: number; // in dB
  pan?: number; // -1 to 1
  mute?: boolean;
  solo?: boolean;
}

export interface InstrumentState {
  initialized: boolean;
  loading: boolean;
  ready: boolean;
  error?: Error;
  activeNotes: Map<string, NoteEvent>;
  options: InstrumentOptions;
}

/**
 * Core instrument functionality
 */
export interface IInstrumentCore {
  // Lifecycle
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  reset(): void;

  // Playback
  trigger(note: Note): void;
  release(note: Note): void;
  releaseAll(): void;

  // State
  getState(): InstrumentState;
  setState(state: Partial<InstrumentState>): void;

  // Audio
  connect(destination: Tone.ToneAudioNode): void;
  disconnect(): void;
  toDestination(): void;

  // Properties
  readonly id: string;
  readonly type: string;
  readonly name: string;
}

/**
 * Extended core with sample support
 */
export interface ISamplerCore extends IInstrumentCore {
  loadSamples(urls: Record<string, string>): Promise<void>;
  unloadSamples(): void;
  getSampleStatus(): Map<string, 'loading' | 'ready' | 'error'>;
}

/**
 * Extended core with synthesis support
 */
export interface ISynthCore extends IInstrumentCore {
  setOscillatorType(type: OscillatorType): void;
  setEnvelope(envelope: Partial<EnvelopeOptions>): void;
  setFilter(filter: Partial<FilterOptions>): void;
}

export type OscillatorType =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'custom';

export interface EnvelopeOptions {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  attackCurve?: 'linear' | 'exponential';
  decayCurve?: 'linear' | 'exponential';
  releaseCurve?: 'linear' | 'exponential';
}

export interface FilterOptions {
  type:
    | 'lowpass'
    | 'highpass'
    | 'bandpass'
    | 'lowshelf'
    | 'highshelf'
    | 'notch'
    | 'allpass'
    | 'peaking';
  frequency: number;
  Q?: number;
  gain?: number;
  rolloff?: -12 | -24 | -48 | -96;
}

/**
 * Instrument capabilities
 */
export interface InstrumentCapabilities {
  polyphonic: boolean;
  velocitySensitive: boolean;
  pitchBend: boolean;
  modulation: boolean;
  sustain: boolean;
  expression: boolean;
  aftertouch: boolean;
  maxPolyphony?: number;
  noteRange?: {
    min: number; // MIDI note number
    max: number;
  };
}

/**
 * Base abstract class for instruments
 */
export abstract class BaseInstrumentCore implements IInstrumentCore {
  abstract readonly id: string;
  abstract readonly type: string;
  abstract readonly name: string;

  protected state: InstrumentState = {
    initialized: false,
    loading: false,
    ready: false,
    activeNotes: new Map(),
    options: {
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
    },
  };

  protected output: Tone.ToneAudioNode | null = null;

  abstract initialize(): Promise<void>;
  abstract dispose(): Promise<void>;
  abstract trigger(note: Note): void;
  abstract release(note: Note): void;

  reset(): void {
    this.releaseAll();
    this.state.activeNotes.clear();
  }

  releaseAll(): void {
    for (const noteEvent of this.state.activeNotes.values()) {
      this.release({
        pitch: noteEvent.pitch,
        velocity: noteEvent.velocity,
      });
    }
  }

  getState(): InstrumentState {
    return { ...this.state };
  }

  setState(state: Partial<InstrumentState>): void {
    this.state = { ...this.state, ...state };
  }

  connect(destination: Tone.ToneAudioNode): void {
    if (this.output) {
      this.output.connect(destination);
    }
  }

  disconnect(): void {
    if (this.output) {
      this.output.disconnect();
    }
  }

  toDestination(): void {
    if (this.output) {
      this.output.toDestination();
    }
  }

  protected generateNoteId(note: Note): string {
    const pitch =
      typeof note.pitch === 'string' ? note.pitch : `N${note.pitch}`;
    return `${pitch}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
