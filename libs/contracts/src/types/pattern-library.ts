/**
 * Pattern Library Types
 * Shared contracts for the drum pattern library feature
 *
 * The pattern library allows users to browse and select pre-made drum patterns
 * that can be loaded into the drum pattern editor.
 */

import type { DrumHit, DrumPatternStats } from './drum-pattern.js';

/**
 * Time signature for a pattern
 */
export interface PatternTimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Single MIDI event in a pattern
 * Represents a note-on event with timing and velocity
 */
export interface PatternEvent {
  /** Tick position (using 480 PPQ) */
  tick: number;
  /** MIDI note number (35-81 for drums) */
  midiNote: number;
  /** Velocity (0-127) */
  velocity: number;
  /** Duration in ticks */
  durationTicks: number;
}

/**
 * MIDI data structure for a pattern
 * Contains the raw MIDI events that can be converted to DrumHit[]
 */
export interface PatternMidiData {
  /** Time signature */
  timeSignature: PatternTimeSignature;
  /** Pulses per quarter note (typically 480) */
  ppq: number;
  /** All MIDI events in the pattern */
  events: PatternEvent[];
}

/**
 * Genre/style category for patterns
 */
export type PatternGenre =
  | 'rock'
  | 'pop'
  | 'jazz'
  | 'funk'
  | 'blues'
  | 'latin'
  | 'electronic'
  | 'metal'
  | 'reggae'
  | 'country'
  | 'rnb'
  | 'hiphop'
  | 'world'
  | 'other';

/**
 * Difficulty level for patterns
 */
export type PatternDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * A drum pattern in the library
 */
export interface PatternLibraryItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the pattern */
  description: string;
  /** Genre/style category */
  genre: PatternGenre;
  /** Difficulty level */
  difficulty: PatternDifficulty;
  /** Number of bars/measures */
  bars: number;
  /** Time signature */
  timeSignature: PatternTimeSignature;
  /** Suggested BPM range */
  bpmRange: {
    min: number;
    max: number;
  };
  /** Tags for searchability */
  tags: string[];
  /** Preview image URL (optional) */
  previewImageUrl?: string;
  /** Creator attribution (optional) */
  createdBy?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Whether the pattern is featured/promoted */
  isFeatured: boolean;
  /** Number of times the pattern has been used */
  usageCount: number;
  /** Pre-converted drum hits for quick loading */
  drumHits?: DrumHit[];
  /** Raw MIDI data for conversion */
  midiData?: PatternMidiData;
  /** Pattern statistics (optional, computed from drumHits) */
  stats?: DrumPatternStats;
}

/**
 * Filter options for browsing the pattern library
 */
export interface PatternLibraryFilter {
  /** Filter by genre */
  genre?: PatternGenre;
  /** Filter by difficulty */
  difficulty?: PatternDifficulty;
  /** Filter by time signature numerator */
  timeSignatureNumerator?: number;
  /** Filter by time signature denominator */
  timeSignatureDenominator?: number;
  /** Filter by number of bars */
  bars?: number;
  /** Filter by BPM (patterns suitable for this BPM) */
  bpm?: number;
  /** Search by name or description */
  search?: string;
  /** Filter by tags */
  tags?: string[];
  /** Only show featured patterns */
  featured?: boolean;
  /** Sort by field */
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'difficulty';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Pagination: page number (1-indexed) */
  page?: number;
  /** Pagination: items per page */
  limit?: number;
}

/**
 * Response for listing patterns
 */
export interface PatternLibraryResponse {
  /** List of patterns matching the filter */
  patterns: PatternLibraryItem[];
  /** Total count of matching patterns */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Response for getting a single pattern
 */
export interface PatternLibraryItemResponse {
  pattern: PatternLibraryItem;
}

/**
 * Input for creating a new pattern in the library
 */
export interface CreatePatternInput {
  /** Display name */
  name: string;
  /** Description of the pattern */
  description: string;
  /** Genre/style category */
  genre: PatternGenre;
  /** Difficulty level */
  difficulty: PatternDifficulty;
  /** Number of bars/measures */
  bars: number;
  /** Time signature */
  timeSignature: PatternTimeSignature;
  /** Suggested BPM range */
  bpmRange: {
    min: number;
    max: number;
  };
  /** Tags for searchability */
  tags: string[];
  /** Pre-converted drum hits */
  drumHits: DrumHit[];
}

/**
 * Display names for genres
 */
export const GENRE_DISPLAY_NAMES: Record<PatternGenre, string> = {
  rock: 'Rock',
  pop: 'Pop',
  jazz: 'Jazz',
  funk: 'Funk',
  blues: 'Blues',
  latin: 'Latin',
  electronic: 'Electronic',
  metal: 'Metal',
  reggae: 'Reggae',
  country: 'Country',
  rnb: 'R&B',
  hiphop: 'Hip Hop',
  world: 'World',
  other: 'Other',
};

/**
 * Genre colors for UI visualization
 */
export const GENRE_COLORS: Record<PatternGenre, string> = {
  rock: '#E53935',
  pop: '#E91E63',
  jazz: '#9C27B0',
  funk: '#673AB7',
  blues: '#3F51B5',
  latin: '#FF9800',
  electronic: '#00BCD4',
  metal: '#424242',
  reggae: '#4CAF50',
  country: '#795548',
  rnb: '#FF5722',
  hiphop: '#607D8B',
  world: '#009688',
  other: '#9E9E9E',
};
