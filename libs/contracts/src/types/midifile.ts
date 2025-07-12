/**
 * MIDI File Upload Types
 * Extends existing MIDI infrastructure for file-based operations
 */

import type { Exercise } from './exercise.js';

// MIDI-related types (re-defined here to avoid circular dependencies)
export interface ParsedMidiData {
  tracks: ParsedTrackCollection;
  metadata: MidiMetadata;
  expression: ExpressionData;
  performance: PerformanceMetrics;
  musicTheory: MusicTheoryAnalysis;
}

export interface ParsedTrackCollection {
  bass: ParsedTrack[];
  drums: ParsedTrack[];
  chords: ParsedTrack[];
  melody: ParsedTrack[];
  other: ParsedTrack[];
}

export interface ParsedTrack {
  id: string;
  name: string;
  channel: number;
  type: TrackType;
  notes: ParsedNote[];
  controllers: ControllerEvent[];
  articulations: ArticulationEvent[];
  confidence: TrackConfidence;
}

export interface ParsedNote {
  note: string;
  octave: number;
  velocity: number;
  duration: number;
  startTime: number;
  endTime: number;
  articulation?: ArticulationType;
  expression?: ExpressionType;
}

export enum TrackType {
  BASS = 'BASS',
  DRUMS = 'DRUMS',
  CHORDS = 'CHORDS',
  MELODY = 'MELODY',
  OTHER = 'OTHER',
}

export enum ArticulationType {
  GHOST = 'GHOST',
  ACCENT = 'ACCENT',
  HAMMER_ON = 'HAMMER_ON',
  PULL_OFF = 'PULL_OFF',
  LEGATO = 'LEGATO',
  STACCATO = 'STACCATO',
  SLIDE = 'SLIDE',
}

export enum ExpressionType {
  VIBRATO = 'VIBRATO',
  TREMOLO = 'TREMOLO',
  BEND = 'BEND',
  TRILL = 'TRILL',
}

export interface TrackConfidence {
  overall: number;
  byFeature: {
    channelAnalysis: number;
    nameAnalysis: number;
    noteRangeAnalysis: number;
    patternAnalysis: number;
  };
}

export interface ControllerEvent {
  type: ControllerType;
  value: number;
  time: number;
  channel: number;
}

export interface ArticulationEvent {
  type: ArticulationType;
  time: number;
  duration: number;
  intensity: number;
}

export enum ControllerType {
  MODULATION = 'MODULATION',
  VOLUME = 'VOLUME',
  PAN = 'PAN',
  EXPRESSION = 'EXPRESSION',
  SUSTAIN = 'SUSTAIN',
  PORTAMENTO = 'PORTAMENTO',
  REVERB = 'REVERB',
  CHORUS = 'CHORUS',
  DELAY = 'DELAY',
}

export interface MidiMetadata {
  trackCount: number;
  totalNotes: number;
  duration: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  tempo: number;
  key: string;
}

export interface ExpressionData {
  vibrato: number;
  tremolo: number;
  bend: number;
  trill: number;
}

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

export interface MusicTheoryAnalysis {
  keySignature: KeySignature;
  detectedChords: DetectedChord[];
  scaleAnalysis: ScaleAnalysis;
  harmonicProgression: HarmonicProgression;
  musicalContext: MusicalContext;
}

export interface KeySignature {
  key: string;
  mode: 'major' | 'minor';
  confidence: number;
  sharpsFlats: number;
}

export interface DetectedChord {
  symbol: string;
  root: string;
  quality: ChordQuality;
  extensions: string[];
  inversion: number;
  time: number;
  duration: number;
  confidence: number;
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
  cadences: Cadence[];
  modulations: Modulation[];
}

export interface MusicalContext {
  genre: string;
  style: string;
  complexity: number;
  jazzContent: number;
  classicalContent: number;
}

export interface Cadence {
  type: 'authentic' | 'plagal' | 'deceptive' | 'half';
  location: number;
  strength: number;
}

export interface Modulation {
  fromKey: string;
  toKey: string;
  location: number;
  type: 'pivot' | 'common-tone' | 'chromatic' | 'direct';
}

export enum ChordQuality {
  MAJOR = 'major',
  MINOR = 'minor',
  DIMINISHED = 'diminished',
  AUGMENTED = 'augmented',
  DOMINANT = 'dominant',
  MAJOR_SEVENTH = 'major7',
  MINOR_SEVENTH = 'minor7',
  DIMINISHED_SEVENTH = 'diminished7',
  HALF_DIMINISHED = 'half-diminished',
}

// MIDI File Parsing Configuration
export interface MIDIFileParsingConfig {
  targetFormat: 'exercise' | 'bass_track' | 'full_analysis';
  bassDetection: {
    enabled: boolean;
    channelHints?: number[];
    noteRangeFilter: {
      min: number; // MIDI note number (e.g., 28 for E1)
      max: number; // MIDI note number (e.g., 67 for G4)
    };
    velocityThreshold?: number;
  };
  timingConversion: {
    targetResolution: number; // Ticks per quarter note for output
    quantization?: 'none' | 'eighth' | 'sixteenth' | 'thirty_second';
    swingFactor?: number; // 0-1, where 0.5 = straight, 0.67 = jazz swing
  };
  trackSelection: {
    autoSelectBass: boolean;
    includeChannels?: number[];
    excludeChannels?: number[];
    priorityOrder: TrackType[];
  };
}

// MIDI File Metadata
export interface MIDIFileMetadata {
  filename: string;
  fileSize: number;
  format: 'type0' | 'type1' | 'type2';
  trackCount: number;
  division: number; // Ticks per quarter note
  durationSeconds: number;
  tempoMap: TempoEvent[];
  timeSignatureMap: TimeSignatureEvent[];
  keySignatureMap: KeySignatureEvent[];
  originalChannels: number[];
  instrumentMap: Record<number, string>; // Channel -> Instrument name
}

// MIDI Tempo Events
export interface TempoEvent {
  tick: number;
  time: number; // Seconds from start
  bpm: number;
  microsecondsPerQuarter: number;
}

// MIDI Time Signature Events
export interface TimeSignatureEvent {
  tick: number;
  time: number;
  numerator: number;
  denominator: number;
  clocksPerClick: number;
  notated32ndsPerQuarter: number;
}

// MIDI Key Signature Events
export interface KeySignatureEvent {
  tick: number;
  time: number;
  key: string; // e.g., "C", "G", "Bb"
  mode: 'major' | 'minor';
  sharpsFlats: number; // Positive for sharps, negative for flats
}

// MIDI File Parsing Result
export interface MIDIFileParsingResult {
  success: boolean;
  metadata: MIDIFileMetadata;
  parsedData?: ParsedMidiData;
  bassTrack?: MIDITrackData;
  exercise?: Exercise;
  errors: string[];
  warnings: string[];
  conversionStats: {
    originalNotes: number;
    convertedNotes: number;
    droppedNotes: number;
    quantizedNotes: number;
    durationMs: number;
  };
}

// MIDI Track Data specific to file operations
export interface MIDITrackData {
  trackIndex: number;
  channel: number;
  name: string;
  instrument: string;
  notes: MIDIFileNote[];
  controlChanges: MIDIControlChange[];
  confidence: number; // 0-1, confidence this is a bass track
  characteristics: {
    averagePitch: number;
    pitchRange: { min: number; max: number };
    noteCount: number;
    rhythmComplexity: number;
    playingStyle: 'fingerstyle' | 'pick' | 'slap' | 'unknown';
  };
}

// MIDI Note with file-specific timing
export interface MIDIFileNote {
  pitch: number; // MIDI note number (0-127)
  velocity: number; // 0-127
  startTick: number;
  endTick: number;
  startTime: number; // Seconds from file start
  duration: number; // Seconds
  channel: number;
  articulation?: ArticulationType;
  bassString?: number; // 1-6 for bass strings (calculated)
  bassFret?: number; // 0-24 for bass frets (calculated)
}

// MIDI Control Change Events
export interface MIDIControlChange {
  tick: number;
  time: number;
  channel: number;
  controller: number;
  value: number;
  controllerName?: string;
}

// Bass-specific configuration for MIDI conversion
export interface BassMIDIConversionConfig {
  tuning: readonly BassString[];
  maxFret: number;
  preferredStrings?: number[]; // Preferred string order for note assignment
  openStringPreference: number; // 0-1, preference for open strings vs fretted
  techniqueDetection: {
    enabled: boolean;
    hammerOnVelocityThreshold: number;
    pullOffTimingThreshold: number; // ms
    slideDetection: boolean;
    deadNoteVelocityThreshold: number;
  };
  difficultyAnalysis: {
    enabled: boolean;
    factors: {
      tempo: number;
      fretSpread: number;
      stringJumps: number;
      rhythmComplexity: number;
      articulations: number;
    };
  };
}

// Bass String Definition
export interface BassString {
  stringNumber: number; // 1-6
  openNote: string; // e.g., "E", "A", "D", "G"
  openPitch: number; // MIDI note number
  midiRange: { min: number; max: number }; // Playable MIDI range on this string
}

// Standard bass tunings
export const BASS_TUNINGS = {
  standard4: [
    {
      stringNumber: 1,
      openNote: 'G',
      openPitch: 43,
      midiRange: { min: 43, max: 67 },
    }, // G2
    {
      stringNumber: 2,
      openNote: 'D',
      openPitch: 38,
      midiRange: { min: 38, max: 62 },
    }, // D2
    {
      stringNumber: 3,
      openNote: 'A',
      openPitch: 33,
      midiRange: { min: 33, max: 57 },
    }, // A1
    {
      stringNumber: 4,
      openNote: 'E',
      openPitch: 28,
      midiRange: { min: 28, max: 52 },
    }, // E1
  ] as const,
  standard5: [
    {
      stringNumber: 1,
      openNote: 'G',
      openPitch: 43,
      midiRange: { min: 43, max: 67 },
    }, // G2
    {
      stringNumber: 2,
      openNote: 'D',
      openPitch: 38,
      midiRange: { min: 38, max: 62 },
    }, // D2
    {
      stringNumber: 3,
      openNote: 'A',
      openPitch: 33,
      midiRange: { min: 33, max: 57 },
    }, // A1
    {
      stringNumber: 4,
      openNote: 'E',
      openPitch: 28,
      midiRange: { min: 28, max: 52 },
    }, // E1
    {
      stringNumber: 5,
      openNote: 'B',
      openPitch: 23,
      midiRange: { min: 23, max: 47 },
    }, // B0
  ] as const,
  dropD: [
    {
      stringNumber: 1,
      openNote: 'G',
      openPitch: 43,
      midiRange: { min: 43, max: 67 },
    }, // G2
    {
      stringNumber: 2,
      openNote: 'D',
      openPitch: 38,
      midiRange: { min: 38, max: 62 },
    }, // D2
    {
      stringNumber: 3,
      openNote: 'A',
      openPitch: 33,
      midiRange: { min: 33, max: 57 },
    }, // A1
    {
      stringNumber: 4,
      openNote: 'D',
      openPitch: 26,
      midiRange: { min: 26, max: 50 },
    }, // D1
  ] as const,
} as const;

// Default conversion configurations
export const DEFAULT_MIDI_FILE_CONFIG: MIDIFileParsingConfig = {
  targetFormat: 'exercise',
  bassDetection: {
    enabled: true,
    noteRangeFilter: {
      min: 23, // B0 (low B on 5-string bass)
      max: 67, // G4 (high G on bass)
    },
    velocityThreshold: 10, // Minimum velocity to consider as real note
  },
  timingConversion: {
    targetResolution: 480, // Standard MIDI resolution
    quantization: 'sixteenth',
    swingFactor: 0.5, // Straight timing by default
  },
  trackSelection: {
    autoSelectBass: true,
    priorityOrder: [
      TrackType.BASS,
      TrackType.MELODY,
      TrackType.CHORDS,
      TrackType.OTHER,
      TrackType.DRUMS,
    ],
  },
};

export const DEFAULT_BASS_CONVERSION_CONFIG: BassMIDIConversionConfig = {
  tuning: BASS_TUNINGS.standard4,
  maxFret: 24,
  preferredStrings: [4, 3, 2, 1], // Low to high
  openStringPreference: 0.3, // Slight preference for open strings
  techniqueDetection: {
    enabled: true,
    hammerOnVelocityThreshold: 30,
    pullOffTimingThreshold: 100, // ms
    slideDetection: true,
    deadNoteVelocityThreshold: 20,
  },
  difficultyAnalysis: {
    enabled: true,
    factors: {
      tempo: 0.2,
      fretSpread: 0.25,
      stringJumps: 0.2,
      rhythmComplexity: 0.2,
      articulations: 0.15,
    },
  },
};

// MIDI File Upload Configuration
export interface MIDIFileUploadConfig {
  maxFileSize: number; // Bytes
  allowedExtensions: string[];
  enablePreview: boolean;
  autoConvert: boolean;
  conversionConfig: MIDIFileParsingConfig;
  bassConfig: BassMIDIConversionConfig;
}

export const DEFAULT_MIDI_UPLOAD_CONFIG: MIDIFileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.mid', '.midi'],
  enablePreview: true,
  autoConvert: false, // Let user review before converting
  conversionConfig: DEFAULT_MIDI_FILE_CONFIG,
  bassConfig: DEFAULT_BASS_CONVERSION_CONFIG,
};

// Error types for MIDI file processing
export type MIDIFileError =
  | 'INVALID_FILE_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'PARSE_ERROR'
  | 'NO_BASS_TRACK_FOUND'
  | 'INVALID_TIMING'
  | 'UNSUPPORTED_FEATURES'
  | 'CONVERSION_FAILED';

export interface MIDIFileProcessingError {
  type: MIDIFileError;
  message: string;
  details?: any;
  track?: number;
  position?: number; // Tick or time position where error occurred
}
