import {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
} from './musical-timing.js';

// Re-export types from musical-timing for better module independence
export type {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
} from './musical-timing.js';

export type ExerciseDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

// Epic 4 Advanced Technique Types
export const TechniqueTypes = [
  'hammer_on',
  'pull_off',
  'slide_up',
  'slide_down',
  'slap',
  'pop',
  'tap',
  'harmonic',
  'vibrato',
  'bend',
] as const;

export type TechniqueType = (typeof TechniqueTypes)[number];

// Epic 4 Compatible Note Schema (Epic 3 + Epic 4 Forward Compatible)
export interface ExerciseNote {
  // Epic 3 Core Properties
  id: string; // note identifier within the exercise (e.g., "note-1")
  string: 1 | 2 | 3 | 4 | 5 | 6; // 1=E, 2=A, 3=D, 4=G (+ 5=B, 6=E for 5/6 string basses)
  fret: number; // 0-24
  note: string; // e.g., "A#", "C", "D"
  color: string; // red, green, blue, yellow, purple

  // Musical Timing (NEW)
  duration: NoteDuration; // 'quarter', 'eighth', etc.
  noteDuration?: NoteDuration; // Alias for duration (from MIDI conversion)
  durationTicks?: number; // Duration in MIDI ticks (480 PPQ) - most precise from MIDI conversion
  position: MusicalPosition; // {measure: 1, beat: 1, subdivision: 0}

  // Legacy timing (DEPRECATED - for backwards compatibility)
  timestamp?: number; // milliseconds - will be calculated from position
  duration_ms?: number; // milliseconds - will be calculated from duration

  // Epic 4 Advanced Technique Properties (Optional in Epic 3)
  techniques?: TechniqueType[]; // Array of techniques applied to this note
  target_note_id?: string; // For hammer-ons, pull-offs, ties
  slide_to_fret?: number; // Target fret for slides
  slide_type?: 'legato' | 'shift';

  is_ghost_note?: boolean;
  is_accented?: boolean;
  accent_level?: 'light' | 'medium' | 'heavy';

  is_muted?: boolean;
  mute_type?: 'palm_mute' | 'fretting_hand_mute' | 'dead_note';

  is_tapped?: boolean;
  tapping_hand?: 'right' | 'left' | 'both';

  bend_target_pitch?: 'half_step' | 'full_step';
  vibrato_intensity?: 'light' | 'medium' | 'heavy';
  is_harmonic?: boolean;
  pluck_position?: 'neck' | 'middle' | 'bridge';
  finger_index?: 1 | 2 | 3 | 4 | 'T'; // 1=index, 2=middle, 3=ring, 4=pinky, T=thumb

  display_symbol?: string; // "h", "p", "/", "\", "x", "()", "~", ">", "T", "P"
}

// Multi-track configuration for unified exercise data architecture
export interface TrackConfiguration {
  tracks: {
    bass: {
      enabled: boolean;
      volume: number;
      pan: number;
    };
    drums: {
      enabled: boolean;
      volume: number;
      pan: number;
    };
    harmony: {
      enabled: boolean;
      volume: number;
      pan: number;
    };
  };
  globalSettings: {
    masterVolume: number;
    tempo: number;
    metronome: {
      enabled: boolean;
      volume: number;
    };
  };
}

// Drum pattern data structure
export interface DrumPattern {
  enabled: boolean;
  pattern: Array<{
    timestamp: number;
    type: 'kick' | 'snare' | 'hihat' | 'crash' | 'ride' | 'tom';
    velocity: number;
  }>;
}

// Harmony voicing data structure
export interface HarmonyVoicing {
  enabled: boolean;
  voicing: Array<{
    timestamp: number;
    chord: string;
    notes: string[];
  }>;
}

// Generated harmony note (from MIDI conversion)
export interface GeneratedHarmonyNote {
  id: string;
  pitch: number; // MIDI note number (0-127)
  velocity: number; // MIDI velocity (0-127)
  noteName: string; // e.g., "C4", "D#3"
  position: MusicalPosition; // {measure, beat, subdivision, tick}
  noteDuration: NoteDuration; // 'whole', 'half', 'quarter', etc.
  durationTicks: number; // Duration in MIDI ticks (480 PPQ)
  measureNumber: number; // 1-based measure number
  voiceIndex?: number; // For polyphonic tracking (0 = bass, 1 = tenor, etc.)
}

// MIDI control change event (sustain pedal, expression, etc.)
export interface HarmonyControlChange {
  cc: number; // Control change number (64 = sustain, 11 = expression, etc.)
  value: number; // Control value (0-127)
  position: MusicalPosition; // {measure, beat, subdivision, tick}
  ticks: number; // Absolute tick position (480 PPQ)
  measureNumber: number; // 1-based measure number
}

// Harmony instrument types
export type HarmonyInstrumentType =
  | 'grandpiano' // Grand Piano (7 velocity layers)
  | 'rhodes' // Fender Rhodes Electric Piano
  | 'wurlitzer' // Wurlitzer Electric Piano
  | 'pad'; // Synth Pad

// Fretboard view configuration types
export type FretboardViewPreset = 'default' | 'octave';
export type FretboardScrollMode = 'locked' | 'follow';

export interface FretboardViewConfig {
  preset: FretboardViewPreset;
  // Optional overrides (for future extensibility)
  scrollMode?: FretboardScrollMode;
  zoomLevel?: number; // 0.5 - 2.0
  initialFret?: number; // 0 - 24
  visibleFretRange?: {
    start: number; // 0 - 24
    end: number; // 0 - 24
  };
  sceneX?: number; // Override default scene positioning
}

// Epic 4 Compatible Exercise Schema (with multi-track support)
export interface Exercise {
  id: string;
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty;

  // Musical duration - simple and clear
  total_bars?: number; // Total number of measures/bars (e.g., 2, 4, 8) - optional for backward compatibility

  // Legacy fields (deprecated but kept for backward compatibility)
  duration_beats?: number; // DEPRECATED: Use total_bars instead
  duration?: number; // DEPRECATED: milliseconds - use total_bars with BPM to calculate runtime

  bpm: number;
  key: string;
  timeSignature: TimeSignature; // NEW: e.g., {numerator: 4, denominator: 4}
  chord_progression?: string[]; // Epic 3 Widget integration - array of chord names
  chord_durations?: number[]; // Duration in beats for each chord
  chord_positions?: MusicalPosition[]; // Musical position for each chord start
  youtube_video_id?: string; // Epic 3 YouTube integration
  start_timestamp?: number; // YouTube start time in seconds
  end_timestamp?: number; // YouTube end time in seconds
  notes: ExerciseNote[]; // JSON array of Epic 4 compatible notes with musical timing
  teaching_summary?: string; // Epic 3 teaching takeaway

  // Multi-track data (unified exercise-centric architecture)
  drum_pattern?: DrumPattern; // Drum track data
  harmony_voicing?: HarmonyVoicing; // Harmony track data (legacy/manual entry)
  harmony_notes?: GeneratedHarmonyNote[]; // Harmony track data (converted from MIDI)
  harmony_control_changes?: HarmonyControlChange[]; // MIDI control events (sustain, expression)
  harmony_instrument?: HarmonyInstrumentType; // Default harmony instrument
  track_configuration?: TrackConfiguration; // Multi-track configuration

  // Fretboard display configuration
  fretboard_view_config?: FretboardViewConfig; // Per-exercise fretboard view settings

  // MIDI Files (uploaded to Supabase storage)
  harmony_midi_url?: string; // URL to uploaded MIDI file for harmony/keys track
  bassline_midi_url?: string; // URL to uploaded MIDI file for bass track
  drummer_midi_url?: string; // URL to uploaded MIDI file for drum track
  metronome_midi_url?: string; // URL to uploaded MIDI file for metronome track

  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility
export type ExerciseWithNotes = Exercise;

// API Response types
export interface GetExercisesResponse {
  exercises: Exercise[];
}

export interface GetExerciseResponse {
  exercise: Exercise;
}

// Epic 3 Widget-Specific Types
export interface CustomBassline {
  id: string;
  exercise_id: string;
  user_id: string;
  title: string;
  notes: ExerciseNote[];
  created_at: string;
  updated_at: string;
}

export interface GetCustomBasslinesResponse {
  basslines: CustomBassline[];
}

// Epic 5 Admin Types (Forward Compatible)
export interface CreateExerciseRequest {
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty;
  duration: number;
  bpm: number;
  key: string;
  youtube_video_id?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  notes: ExerciseNote[];
  teaching_summary?: string;
}

export interface UpdateExerciseRequest extends Partial<CreateExerciseRequest> {
  id: string;
}

// Backward compatibility
export type GetExerciseWithNotesResponse = GetExerciseResponse;

// Note: Removed FretboardNote, MockExercise, and exerciseToMockExercise
// as they were only used by the old fretboard component.
// These will be replaced with new types when implementing the new fretboard.

// Story 3.8: Enhanced Bassline Persistence Types

// Bassline Metadata Interface
export interface BasslineMetadata {
  tempo: number;
  timeSignature: string;
  key: string;
  difficulty: ExerciseDifficulty;
  tags: string[];
}

// Enhanced Saved Bassline Interface (Story 3.8)
export interface SavedBassline {
  id: string;
  userId: string;
  name: string;
  description?: string;
  notes: ExerciseNote[];
  metadata: BasslineMetadata;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Auto-save Configuration Interface
export interface AutoSaveConfig {
  interval: number; // Auto-save every N milliseconds
  changeThreshold: number; // Save after N note changes
  idleTimeout: number; // Save after N milliseconds of inactivity
  maxRetries: number; // Retry failed saves N times
}

// Save Bassline Request Interface
export interface SaveBasslineRequest {
  name: string;
  description?: string;
  notes: ExerciseNote[];
  metadata: BasslineMetadata;
  overwriteExisting: boolean;
}

// Auto-save Request Interface
export interface AutoSaveRequest {
  basslineId?: string; // null for new basslines
  name: string;
  notes: ExerciseNote[];
  metadata: BasslineMetadata;
  isAutoSave: boolean;
}

// Bassline Management Interfaces
export interface RenameBasslineRequest {
  newName: string;
}

export interface DuplicateBasslineRequest {
  newName: string;
  includeDescription: boolean;
}

export interface BasslineListFilters {
  search?: string;
  difficulty?: ExerciseDifficulty;
  tags?: string[];
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'difficulty';
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
}

// Response Interfaces
export interface SavedBasslinesResponse {
  basslines: SavedBassline[];
  total: number;
  page: number;
  limit: number;
}

export interface SaveBasslineResponse {
  bassline: SavedBassline;
  message: string;
}

export interface AutoSaveResponse {
  basslineId: string;
  lastSaved: string;
  message: string;
}

// Sharing Capabilities (Epic 5 preparation)
export interface SharingOptions {
  isPublic: boolean;
  shareLink?: string;
  allowComments: boolean;
  allowRemixing: boolean;
  expiresAt?: string;
}

export interface SharedBassline extends SavedBassline {
  sharingOptions?: SharingOptions;
  shareCount: number;
  remixCount: number;
}
