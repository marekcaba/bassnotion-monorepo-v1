/**
 * MIDI Parser Module
 *
 * Modular MIDI parsing components
 */

// Core parser
export { MidiFileParser } from './MidiFileParser.js';
export type {
  MidiHeader,
  MidiEvent,
  MidiTrack,
  ParsedMidiFile,
} from './MidiFileParser.js';

// Event factory
export { MidiEventFactory } from './MidiEventFactory.js';
export type {
  MidiNoteEvent,
  MidiControlChangeEvent,
  MidiProgramChangeEvent,
  MidiPitchBendEvent,
  MidiTempoEvent,
  MidiTimeSignatureEvent,
  MidiKeySignatureEvent,
  MidiTextEvent,
  TypedMidiEvent,
} from './MidiEventFactory.js';

// Header parser
export { MidiHeaderParser } from './MidiHeaderParser.js';
export type { MidiFileMetadata } from './MidiHeaderParser.js';

// Stream parser
export { MidiStreamParser } from './MidiStreamParser.js';
export type { StreamParserOptions } from './MidiStreamParser.js';
