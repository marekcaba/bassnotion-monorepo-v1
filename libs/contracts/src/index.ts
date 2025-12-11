// Validation schemas and types
export * from './validation/index.js';

// All types
export * from './types/index.js';

// Re-export Exercise type directly for convenience
export type { Exercise } from './types/exercise.js';
// Alias for backward compatibility
export type { Exercise as DatabaseExercise } from './types/exercise.js';

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
// export { MusicalTimeConverter } from './utils/musical-time-converter.js'; // Moved to services
export { ExerciseMigration } from './utils/exercise-migration.js';

// Professional Musical Time System (Story 3.15)
export type {
  DrumPattern,
  DrumEvent,
  DrumArrangement,
  DrumType,
  DrumTrackData,
  BassNote,
  BassTrackData,
  HarmonyChange,
  HarmonyTrackData,
  MusicalContent,
  MixSettings,
  ProfessionalExercise,
  TickPosition,
  MusicalTimeConfig,
  TimingFeatures,
  SwingConfig as ProfessionalSwingConfig,
} from './types/musical-time.js';
export {
  MusicalTimeConstants,
  ticksToMs,
  msToTicks,
  positionToAbsoluteTick,
  absoluteTickToPosition,
  inferNoteDurationFromTicks,
  noteDurationToTicks,
} from './types/musical-time.js';
export { MusicalTimeConverter } from './services/MusicalTimeConverter.js';
export { ProfessionalDrumProcessor } from './services/ProfessionalDrumProcessor.js';

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

// User types
export type { BassConfiguration } from './types/user.js';

// Drum Pattern types (Story 4.4 - Drummer MIDI Conversion)
export type {
  DrumHit,
  MidiDrumType,
  MusicalPosition as DrumMusicalPosition,
  DrumPatternStats,
  DrumPatternValidation,
} from './types/drum-pattern.js';
export {
  DRUM_DISPLAY_NAMES,
  DRUM_COLORS,
  GENERAL_MIDI_DRUM_MAP,
} from './types/drum-pattern.js';
