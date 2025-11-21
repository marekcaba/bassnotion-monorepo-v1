import { MusicalPosition, NoteDuration } from './musical-timing.js';

/**
 * Bass playing techniques
 */
export type BassTechnique = 'normal' | 'slap' | 'muted';

/**
 * Bass articulation types
 */
export type BassArticulationType =
  | 'normal'
  | 'ghost-note'
  | 'accent'
  | 'hammer-on'
  | 'pull-off'
  | 'slide-up'
  | 'slide-down'
  | 'bend'
  | 'trill';

/**
 * Bass articulation metadata
 * Defines how a note should be played and any transition information
 */
export interface BassArticulation {
  /** Type of articulation */
  type: BassArticulationType;

  /** Source note for transition articulations (e.g., "E2" in E2→F#2 hammer-on) */
  fromNote?: string;

  /** Target note for transition articulations (e.g., "F#2" in E2→F#2 hammer-on) */
  toNote?: string;

  /**
   * DEPRECATED: Timing offset no longer used with pre-recorded full transition samples
   * Kept for backward compatibility
   */
  transitionOffset?: number;

  /**
   * Crossfade duration in seconds for blending articulation to sustained note
   * Only used when articulation sample is shorter than total note duration
   */
  crossfadeDuration?: number;
}

/**
 * Generated bass note from MIDI conversion
 * Extends the base note structure with bass-specific metadata
 */
export interface GeneratedBassNote {
  /** Unique identifier */
  id: string;

  /** MIDI note number (0-127, where 60 = middle C) */
  pitch: number;

  /** MIDI velocity (0-127) */
  velocity: number;

  /** Note name (e.g., "E1", "A2") */
  noteName: string;

  /** Musical position (measure, beat, subdivision, tick) */
  position: MusicalPosition;

  /** Note duration as musical value */
  noteDuration: NoteDuration;

  /** Duration in MIDI ticks (480 PPQ) */
  durationTicks: number;

  /** Absolute tick position from MIDI file start (480 PPQ) */
  ticks: number;

  /** 1-based measure number */
  measureNumber: number;

  /** Bass string number (1=E, 2=A, 3=D, 4=G, 5=B, 6=high E) */
  string: 1 | 2 | 3 | 4 | 5 | 6;

  /** Fret number (0-24) */
  fret: number;

  /** Playing technique */
  technique: BassTechnique;

  /** Articulation metadata */
  articulation: BassArticulation;

  /** Display color for fretboard visualization */
  color?: string;
}

/**
 * Admin articulation matrix entry
 * Used by admin to define articulations during MIDI upload
 */
export interface ArticulationMatrixEntry {
  /** MIDI note number */
  pitch: number;

  /** Note name */
  noteName: string;

  /** Musical position */
  position: MusicalPosition;

  /** Absolute tick position */
  ticks: number;

  /** Duration in ticks */
  durationTicks: number;

  /** Playing technique selected by admin */
  technique: BassTechnique;

  /** Articulation type selected by admin */
  articulationType: BassArticulationType;

  /** Source note for transitions (optional) */
  fromNote?: string;

  /** Whether this entry was auto-suggested */
  isAutoSuggested?: boolean;
}

/**
 * Articulation suggestion from auto-detection
 * System generates these as helpers for admin to accept/reject
 */
export interface ArticulationSuggestion {
  /** Index of note in parsed MIDI */
  noteIndex: number;

  /** Suggested articulation type */
  suggestedType: BassArticulationType;

  /** Source note if transition detected */
  fromNote?: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reason for suggestion */
  reason: string;
}
