export interface ExerciseNoteDto {
  id: string;
  timestamp: number;
  string: number; // 1=E, 2=A, 3=D, 4=G
  fret: number; // 0-24
  duration: number;
  note: string; // Musical note name (e.g., "A#")
  color: string;
}

export interface ExerciseDto {
  id: string;
  title: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // milliseconds
  bpm: number;
  key: string;
  notes: ExerciseNoteDto[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ExercisesResponseDto {
  exercises: ExerciseDto[];
  total: number;
  cached?: boolean;
}

export interface ExerciseResponseDto {
  exercise: ExerciseDto;
}
