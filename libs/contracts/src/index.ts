// Validation schemas and types
export * from './validation/index.js';

// All types
export * from './types/index.js';

// Utilities
export * from './utils/index.js';

// Musical timing types and utilities (explicit exports for better IDE support)
export type {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
  SwingConfig,
  MusicalTimingConfig,
} from './types/musical-timing.js';
export { MusicalTimeConverter } from './utils/musical-time-converter.js';
export { ExerciseMigration } from './utils/exercise-migration.js';

// MusicXML types and utilities (explicit exports for better IDE support)
export type {
  MusicXMLDocument,
  MusicXMLMetadata,
  MusicXMLNoteData,
  MusicXMLConversionResult,
  MusicXMLConversionConfig,
  BassString as MusicXMLBassString,
  Note as MusicXMLNote,
  Pitch as MusicXMLPitch,
} from './types/musicxml.js';
export { MusicXMLParser } from './utils/musicxml-parser.js';

// MIDI File types and utilities (explicit exports for better IDE support)
export type {
  MIDIFileParsingConfig,
  MIDIFileMetadata,
  MIDIFileParsingResult,
  MIDITrackData,
  MIDIFileNote,
  BassMIDIConversionConfig,
  BassString,
  MIDIFileUploadConfig,
  MIDIFileError,
  MIDIFileProcessingError,
} from './types/midifile.js';
export {
  BASS_TUNINGS,
  DEFAULT_MIDI_FILE_CONFIG,
  DEFAULT_BASS_CONVERSION_CONFIG,
  DEFAULT_MIDI_UPLOAD_CONFIG,
} from './types/midifile.js';
export { MIDIFileParser } from './utils/midifile-parser.js';

// Common types
export type { MetronomeSettings } from './types/common.js';
