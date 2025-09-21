/**
 * MIDI Parser Types
 * Core types for MIDI parsing and processing
 */

import { ChordQuality } from '../../instruments/implementations/harmony/ChordTypes.js';

export { ChordQuality };

// Track type definitions
export enum TrackType {
  BASS = 'bass',
  DRUMS = 'drums',
  CHORDS = 'chords',
  MELODY = 'melody',
  OTHER = 'other',
}

// Articulation types
export enum ArticulationType {
  NORMAL = 'normal',
  STACCATO = 'staccato',
  LEGATO = 'legato',
  ACCENT = 'accent',
  GHOST = 'ghost',
  HAMMER_ON = 'hammerOn',
  PULL_OFF = 'pullOff',
  SLIDE = 'slide',
  BEND = 'bend',
  VIBRATO = 'vibrato',
  TREMOLO = 'tremolo',
  TRILL = 'trill',
  GLISSANDO = 'glissando',
  PORTAMENTO = 'portamento',
  HARMONICS = 'harmonics',
  PALM_MUTE = 'palmMute',
  TAP = 'tap',
  SLAP = 'slap',
  POP = 'pop',
}

// Controller types
export enum ControllerType {
  MODULATION = 'modulation',
  VOLUME = 'volume',
  PAN = 'pan',
  EXPRESSION = 'expression',
  SUSTAIN = 'sustain',
  PORTAMENTO = 'portamento',
  REVERB = 'reverb',
  CHORUS = 'chorus',
  DELAY = 'delay',
}

// Expression types
export enum ExpressionType {
  VIBRATO = 'vibrato',
  TREMOLO = 'tremolo',
  PITCH_BEND = 'pitchBend',
  TRILL = 'trill',
  GLISSANDO = 'glissando',
  PORTAMENTO = 'portamento',
}

// Meta event types
export enum MetaEventType {
  TEMPO = 'tempo',
  TIME_SIGNATURE = 'timeSignature',
  KEY_SIGNATURE = 'keySignature',
  TEXT = 'text',
  TRACK_NAME = 'trackName',
  MARKER = 'marker',
  CUE_POINT = 'cuePoint',
  COPYRIGHT = 'copyright',
  LYRIC = 'lyric',
}

// Note data structure
export interface ParsedNote {
  note: string;
  octave: number;
  velocity: number;
  duration: number;
  startTime: number;
  endTime: number;
  articulations?: ArticulationType[];
  pitchBend?: number;
  vibrato?: number;
  channel?: number;
}

// Controller event
export interface ControllerEvent {
  type: ControllerType;
  value: number;
  time: number;
  channel: number;
}

// Articulation event
export interface ArticulationEvent {
  type: ArticulationType;
  intensity: number;
  time: number;
  duration?: number;
}

// Track confidence scoring
export interface TrackConfidence {
  channelAnalysis: number;
  nameAnalysis: number;
  noteRangeAnalysis: number;
  patternAnalysis: number;
}

// Parsed track data
export interface ParsedTrack {
  trackType: TrackType;
  confidence: TrackConfidence;
  notes: ParsedNote[];
  controllers: ControllerEvent[];
  articulations: ArticulationEvent[];
  channel: number;
  trackName?: string;
  instrument?: string;
  programChange?: number;
}

// Track collection
export interface ParsedTrackCollection {
  bass: ParsedTrack[];
  drums: ParsedTrack[];
  chords: ParsedTrack[];
  melody: ParsedTrack[];
  other: ParsedTrack[];
}

// Meta events
export interface MetaEvent {
  type: MetaEventType;
  time: number;
  data: any;
}

// SysEx events
export interface SysExEvent {
  time: number;
  data: Uint8Array;
  manufacturerId?: number;
  deviceId?: number;
}

// MIDI metadata
export interface MidiMetadata {
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  tempo: number;
  trackCount: number;
  totalNotes: number;
  duration: number;
  key: string;
}

// Expression data
export interface ExpressionData {
  vibrato: number;
  tremolo: number;
  bend: number;
  trill: number;
}

// Performance metrics
export interface PerformanceMetrics {
  timing: {
    accuracy: number;
    consistency: number;
  };
  dynamics: {
    range: number;
    consistency: number;
  };
  articulation: {
    variety: number;
    consistency: number;
  };
}

// Music theory types
export interface KeySignature {
  key: string;
  mode: 'major' | 'minor';
  confidence: number;
  sharpsFlats: number;
}

export interface DetectedChord {
  root: string;
  quality: ChordQuality;
  time: number;
  duration: number;
  confidence: number;
  notes: string[];
  inversion?: number;
  extensions?: string[];
}

export interface ScaleAnalysis {
  primaryScale: string;
  alternativeScales: string[];
  modeUsage: Record<string, number>;
  chromaticUsage: number;
}

export interface HarmonicProgression {
  romanNumerals: string[];
  functionalAnalysis: string[];
  cadences: Array<{
    type: 'authentic' | 'plagal' | 'deceptive' | 'half';
    location: number;
    strength: number;
  }>;
  modulations: Array<{
    fromKey: string;
    toKey: string;
    location: number;
    type: 'pivot' | 'direct' | 'chromatic';
  }>;
}

export interface MusicTheoryAnalysis {
  keySignature: KeySignature;
  detectedChords: DetectedChord[];
  scaleAnalysis: ScaleAnalysis;
  harmonicProgression: HarmonicProgression;
  musicalContext: {
    genre: string;
    style: string;
    complexity: number;
    jazzContent: number;
    classicalContent: number;
  };
}

// Main parsed data structure
export interface ParsedMidiData {
  tracks: ParsedTrackCollection;
  metadata: MidiMetadata;
  expression: ExpressionData;
  performance: PerformanceMetrics;
  musicTheory: MusicTheoryAnalysis;
}
