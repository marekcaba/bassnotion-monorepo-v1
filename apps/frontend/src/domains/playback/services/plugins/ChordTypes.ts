/**
 * Chord Types - Shared types for chord processing
 * Separated from ChordInstrumentProcessor to avoid early Tone.js initialization
 */

export enum ChordPreset {
  PAD = 'pad',
  RHODES = 'rhodes',
  ORGAN = 'organ',
  STRINGS = 'strings',
  BRASS = 'brass',
  PIANO = 'piano',
  SYNTH_LEAD = 'synthLead',
  WARM_PAD = 'warmPad',
  WURLITZER = 'wurlitzer',
  LONG_PAD = 'longPad',
  RHODES_VELOCITY = 'rhodesVelocity',
  THE_SAW = 'theSaw',
}

export enum ChordQuality {
  MAJOR = 'major',
  MINOR = 'minor',
  DOMINANT = 'dominant',
  MAJOR_SEVENTH = 'major7',
  MINOR_SEVENTH = 'minor7',
  DIMINISHED = 'diminished',
  AUGMENTED = 'augmented',
  HALF_DIMINISHED = 'halfDiminished',
  SUSPENDED_SECOND = 'sus2',
  SUSPENDED_FOURTH = 'sus4',
  SIXTH = 'sixth',
  MINOR_SIXTH = 'minor6',
  NINTH = 'ninth',
  MINOR_NINTH = 'minor9',
  ELEVENTH = 'eleventh',
  THIRTEENTH = 'thirteenth',
}

export interface ChordSymbol {
  root: string;
  quality: ChordQuality;
  extensions?: string[];
  bass?: string;
  alterations?: string[];
}

// Type alias for export compatibility
export type ChordSymbolType = ChordSymbol;

export enum VoicingStyle {
  CLOSE = 'close',
  DROP2 = 'drop2',
  DROP3 = 'drop3',
  QUARTAL = 'quartal',
  SPREAD = 'spread',
  ROOTLESS = 'rootless',
  SHELL = 'shell',
  STRIDE = 'stride',
}

export interface HarmonicContext {
  key: string;
  mode: 'major' | 'minor';
  previousChord?: ChordSymbol;
  nextChord?: ChordSymbol;
  progression?: string[];
  bassNote?: string;
}

export interface ChordInstrumentConfig {
  preset: ChordPreset;
  volume: number;
  polyphony: number;
  voicingStyle: VoicingStyle;
  harmonicContext?: HarmonicContext;
  effects: {
    reverb: { wet: number; decay: number };
    chorus: { wet: number; frequency: number; depth: number };
    stereoWidth: number;
    eq: { low: number; mid: number; high: number };
  };
}

export interface ChordProgression {
  chords: ChordSymbol[];
  durations: number[];
  key: string;
  mode: 'major' | 'minor';
  tempo?: number;
}
