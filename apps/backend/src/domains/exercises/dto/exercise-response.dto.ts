import type { DrumHit } from '@bassnotion/contracts';

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
  created_by?: string;
  // Legacy single MIDI file (kept for backward compatibility)
  midi_file_path?: string;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
  // New separate MIDI files for each widget (Story 4.4)
  drummer_midi_url?: string;
  bassline_midi_url?: string;
  harmony_midi_url?: string;
  metronome_midi_url?: string;
  // Pre-converted patterns (Story 4.4 - avoid re-parsing MIDI on client)
  drum_pattern?: DrumHit[];
  harmony_notes?: any[]; // Pre-converted harmony notes from MIDI
  harmony_control_changes?: any[]; // MIDI control change events (sustain, expression)
  harmony_instrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad'; // Harmony instrument type
  // Musical metadata
  duration_beats?: number;
  total_bars?: number;
  time_signature?: { numerator: number; denominator: number };
  tutorial_id?: string;
}

export interface ExercisesResponseDto {
  exercises: ExerciseDto[];
  total: number;
  cached?: boolean;
}

export interface ExerciseResponseDto {
  exercise: ExerciseDto;
}
