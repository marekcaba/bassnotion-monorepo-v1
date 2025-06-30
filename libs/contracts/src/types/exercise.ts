export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

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
  timestamp: number; // milliseconds
  string: 1 | 2 | 3 | 4 | 5 | 6; // 1=E, 2=A, 3=D, 4=G (+ 5=B, 6=E for 5/6 string basses)
  fret: number; // 0-24
  duration: number; // milliseconds
  note: string; // e.g., "A#", "C", "D"
  color: string; // red, green, blue, yellow, purple

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
  finger_index?: number; // 1-4, T for thumb

  display_symbol?: string; // "h", "p", "/", "\", "x", "()", "~", ">", "T", "P"
}

// Epic 4 Compatible Exercise Schema
export interface Exercise {
  id: string;
  title: string;
  description?: string;
  difficulty: ExerciseDifficulty;
  duration: number; // milliseconds
  bpm: number;
  key: string;
  chord_progression?: string[]; // Epic 3 Widget integration - array of chord names
  youtube_video_id?: string; // Epic 3 YouTube integration
  start_timestamp?: number; // YouTube start time in seconds
  end_timestamp?: number; // YouTube end time in seconds
  notes: ExerciseNote[]; // JSON array of Epic 4 compatible notes
  teaching_summary?: string; // Epic 3 teaching takeaway
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
