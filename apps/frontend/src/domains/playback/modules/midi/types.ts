/**
 * MIDI Event Types
 *
 * Core types for MIDI events used in exercise loading and playback.
 * These types are specifically designed for the ExerciseLoader pipeline.
 */

import type { ExerciseNote } from '@bassnotion/contracts';

/**
 * Base MIDI event with common properties
 */
export interface MidiEvent {
  /** Event type: noteOn, noteOff, etc. */
  type: 'noteOn' | 'noteOff' | 'cc' | 'programChange' | 'pitchBend';

  /** Time in seconds relative to start */
  time: number;

  /** MIDI channel (0-15) */
  channel: number;

  /** MIDI note number (0-127) */
  note?: number;

  /** Velocity (0-127) */
  velocity?: number;

  /** Note duration in seconds */
  duration?: number;
}

/**
 * Bass-specific MIDI event with fretboard position data
 */
export interface BassMidiEvent extends MidiEvent {
  /** String number (1-5, where 1 is highest G string) */
  string?: number;

  /** Fret number (0-24) */
  fret?: number;

  /** Note name (e.g., "C#", "Eb") */
  noteName?: string;

  /** MIDI note number (redundant with note, for explicit bass scheduling) */
  midiNote?: number;

  /** Duration in beats for tempo-relative playback */
  durationInBeats?: number;

  /** Original BPM when duration was calculated */
  originalBpm?: number;
}

/**
 * Drum-specific MIDI event with drum type
 */
export interface DrumMidiEvent extends MidiEvent {
  /** Drum type identifier (kick, snare, hihat, etc.) */
  drumType?: string;
}

/**
 * Tempo change event
 */
export interface TempoEvent {
  type: 'tempo';
  time: number;
  bpm: number;
  microsecondsPerBeat?: number;
}

/**
 * Key signature event
 */
export interface KeySignatureEvent {
  type: 'keySignature';
  time: number;
  sharpsOrFlats: number;
  scale: 'major' | 'minor';
}

/**
 * Meta event union for tempo, key signature, etc.
 */
export type MidiMetaEvent = TempoEvent | KeySignatureEvent;

/**
 * Type guard to check if event is a tempo event
 */
export function isTempoEvent(event: unknown): event is TempoEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    (event as { type: unknown }).type === 'tempo' &&
    'bpm' in event
  );
}

/**
 * Union type for all MIDI event types used in ExerciseLoader
 */
export type ExerciseMidiEvent = MidiEvent | BassMidiEvent | DrumMidiEvent;

/**
 * Type guard to check if event is a bass event
 */
export function isBassMidiEvent(event: MidiEvent): event is BassMidiEvent {
  return 'string' in event || 'fret' in event || 'noteName' in event;
}

/**
 * Type guard to check if event is a drum event
 */
export function isDrumMidiEvent(event: MidiEvent): event is DrumMidiEvent {
  return 'drumType' in event;
}

/**
 * ExerciseNote with extended duration properties
 * Used when loading bass notes from exercise data
 */
export interface ExerciseNoteWithDuration {
  string: number;
  fret: number;
  note: string;
  duration: string;
  position?: {
    measure?: number;
    beat?: number;
    subdivision?: number;
    tick?: number;
  };
  /** Duration in ticks (480 PPQ) */
  durationTicks?: number;
  /** Note duration name for lookup */
  noteDuration?: string;
}
