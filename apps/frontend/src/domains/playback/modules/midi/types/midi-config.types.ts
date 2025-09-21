/**
 * MIDI Configuration Types
 *
 * Type definitions for all MIDI configuration files
 */

// General MIDI Instruments
export interface GMInstrumentConfig {
  name: string;
  version: string;
  description: string;
  instruments: GMInstrument[];
  categories: Record<string, InstrumentCategory>;
  families: Record<string, InstrumentFamily>;
}

export interface GMInstrument {
  program: number;
  name: string;
  category: string;
  family: string;
}

export interface InstrumentCategory {
  name: string;
  defaultRange: [number, number];
  typicalVelocity: number;
}

export interface InstrumentFamily {
  name: string;
  polyphonic: boolean;
  sustainPedal: boolean;
}

// MIDI Meta Events
export interface MetaEventConfig {
  name: string;
  version: string;
  description: string;
  events: Record<string, MetaEventDef>;
  categories: Record<string, MetaEventCategory>;
  keySignatures: Record<string, KeySignatureDef>;
  commonTempos: Record<string, TempoDef>;
}

export interface MetaEventDef {
  name: string;
  type: string;
  category: string;
  dataFormat: DataFormat;
}

export interface DataFormat {
  length: number | 'variable';
  encoding?: string;
  fields?: DataField[];
}

export interface DataField {
  name: string;
  bytes: number | 'variable' | 'remaining';
  type: string;
  range?: [number, number];
  values?: Record<string, string>;
  description?: string;
  conversion?: string;
  default?: number;
}

export interface MetaEventCategory {
  name: string;
  description: string;
}

export interface KeySignatureDef {
  major: string;
  minor: string;
}

export interface TempoDef {
  bpm: [number, number];
  description: string;
}

// MIDI Note Mappings
export interface NoteMapConfig {
  name: string;
  version: string;
  description: string;
  notes: Record<string, NoteDef>;
  octaves: Record<string, OctaveDef>;
  specialNotes: Record<string, number>;
  noteNames: string[];
  alternateNames: Record<string, string[]>;
}

export interface NoteDef {
  name: string;
  frequency: number;
}

export interface OctaveDef {
  range: [number, number];
  name: string;
}

// MIDI Config Result
export interface MidiConfigResult {
  cc?: import('./midi-cc.types.js').MidiCCConfig;
  instruments?: GMInstrumentConfig;
  metaEvents?: MetaEventConfig;
  notes?: NoteMapConfig;
}

// Extended configs (like bass-specific)
export interface ExtendedMidiConfig {
  name: string;
  version: string;
  description: string;
  extends?: string;
  mappings?: Record<string, any>;
  presets?: Record<string, any>;
  [key: string]: any;
}
