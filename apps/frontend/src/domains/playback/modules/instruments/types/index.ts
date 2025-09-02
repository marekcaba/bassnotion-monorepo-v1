/**
 * Instruments Module Types
 * 
 * Type definitions for the instruments module.
 */

export * from '../base/Instrument.js';
export * from '../base/Sampler.js';

/**
 * Drum-specific types
 */
export interface DrumEvent {
  drum: 'kick' | 'snare' | 'hihat' | 'openHihat' | 'crash' | 'ride' | 'tom1' | 'tom2' | 'tom3' | string;
  velocity?: number;
  time: number;
  duration?: string;
}

export interface DrumKitConfig {
  name: string;
  samples: {
    [drum: string]: string | string[];
  };
  velocityLayers?: number;
  roundRobin?: boolean;
}

/**
 * Bass-specific types
 */
export interface BassEvent {
  note: string;
  velocity?: number;
  time: number;
  duration?: string;
  technique?: 'normal' | 'slap' | 'pick' | 'fingerstyle';
  articulation?: 'legato' | 'staccato' | 'slide' | 'hammer' | 'pull';
}

export interface BassConfig {
  noteRange: {
    lowest: string;
    highest: string;
  };
  samples?: Record<string, string[]>;
  useSynth?: boolean;
  synthType?: 'sawtooth' | 'square' | 'triangle' | 'sine';
}

/**
 * Harmony/Chord-specific types
 */
export interface ChordEvent {
  chord: string;
  notes: string[];
  velocity?: number;
  time: number;
  duration?: string;
  voicing?: 'close' | 'open' | 'drop2' | 'drop3';
}

export interface HarmonyConfig {
  instrument?: 'piano' | 'rhodes' | 'wurlitzer' | 'organ';
  samples?: Record<string, string>;
  useWAM?: boolean;
  wamPlugin?: string;
}

/**
 * Metronome-specific types
 */
export interface MetronomeEvent {
  type: 'click' | 'accent';
  pitch?: string;
  velocity?: number;
  time: number;
  beat?: number;
  subdivision?: number;
}

export interface MetronomeConfig {
  clickSounds: {
    click: string;
    accent: string;
  };
  clickPitch?: string;
  accentPitch?: string;
  clickVolume?: number;
  accentVolume?: number;
  tempo?: number;
  timeSignature?: string;
}

/**
 * MIDI-related types
 */
export interface MidiNoteEvent {
  note: number;
  velocity: number;
  channel?: number;
  time: number;
  duration?: string;
}

export interface MidiControlEvent {
  controller: number;
  value: number;
  channel?: number;
  time: number;
}

export interface MidiProgramChangeEvent {
  program: number;
  channel?: number;
  time: number;
}

export interface MidiPitchBendEvent {
  value: number; // -8192 to 8191
  channel?: number;
  time: number;
}

/**
 * Sample loading and caching types
 */
export interface SampleLoadOptions {
  /** Priority for loading (higher = load first) */
  priority?: number;
  /** Whether to cache the sample */
  cache?: boolean;
  /** Crossfade duration for sample switching */
  crossfade?: number;
  /** Preload neighboring samples */
  preloadNeighbors?: boolean;
}

export interface SampleMetadata {
  url: string;
  size?: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
}

/**
 * Instrument factory types
 */
export type InstrumentFactory<T = any> = (config: T) => Promise<Instrument>;

export interface InstrumentRegistry {
  register(type: string, factory: InstrumentFactory): void;
  unregister(type: string): void;
  create(type: string, config: any): Promise<Instrument>;
  getAvailableTypes(): string[];
  hasType(type: string): boolean;
}

/**
 * Re-export base types
 */
export type { Instrument, InstrumentConfig, InstrumentEvent, InstrumentMetrics, InstrumentState } from '../base/Instrument.js';
export type { Sampler, SamplerConfig, SampleMap, LoadedSample } from '../base/Sampler.js';
export type { InstrumentAdapter, LegacyProcessor } from '../base/InstrumentAdapter.js';