import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExerciseDto {
  @IsOptional()
  @IsString()
  id?: string; // If present, update; if not, create

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  difficulty!: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  total_bars?: number;

  @IsOptional()
  @IsNumber()
  duration_beats?: number;

  @IsOptional()
  time_signature?: { numerator: number; denominator: number };

  @IsOptional()
  @IsNumber()
  bpm?: number;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsArray()
  notes?: any[]; // Fretboard notes from MIDI conversion (JSONB in DB)

  @IsOptional()
  @IsArray()
  drum_pattern?: any[]; // Drum hits from drummer MIDI conversion (JSONB in DB)

  @IsOptional()
  @IsArray()
  harmony_notes?: any[]; // Pre-converted harmony notes from MIDI (JSONB in DB)

  @IsOptional()
  @IsArray()
  harmony_control_changes?: any[]; // MIDI control change events (sustain pedal, expression, etc.) (JSONB in DB)

  @IsOptional()
  @IsString()
  harmony_instrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad'; // Harmony instrument type

  @IsOptional()
  @IsString()
  bassline_midi_url?: string;

  @IsOptional()
  @IsString()
  drums_midi_url?: string; // Legacy field name

  @IsOptional()
  @IsString()
  drummer_midi_url?: string; // Correct DB column name

  @IsOptional()
  @IsString()
  harmony_midi_url?: string;

  @IsOptional()
  @IsString()
  metronome_midi_url?: string;

  // Story 4.4 - Task 3.4: Temp MIDI paths for migration from temp to permanent storage
  @IsOptional()
  @IsString()
  temp_bassline_midi_path?: string;

  @IsOptional()
  @IsString()
  temp_drummer_midi_path?: string;

  @IsOptional()
  @IsString()
  temp_harmony_midi_path?: string;

  @IsOptional()
  @IsString()
  temp_metronome_midi_path?: string;

  @IsOptional()
  @IsNumber()
  order_index?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  fretboard_view_config?: {
    preset: 'default' | 'octave';
    scrollMode?: 'locked' | 'follow';
    zoomLevel?: number;
    initialFret?: number;
    visibleFretRange?: { start: number; end: number };
    sceneX?: number;
  };
}

export class SaveTutorialWithExercisesDto {
  @IsString()
  id!: string; // Tutorial ID

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  youtube_id?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  author_name?: string;

  @IsOptional()
  @IsString()
  thumbnail_url?: string; // Custom thumbnail URL from Supabase storage

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  core_concept_description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  core_concept_points?: string[];

  @IsOptional()
  @IsString()
  teaching_takeaway?: string;

  @IsOptional()
  @IsString()
  creator_name?: string;

  @IsOptional()
  @IsString()
  creator_channel_url?: string;

  @IsOptional()
  @IsString()
  creator_avatar_url?: string;

  @IsOptional()
  @IsNumber()
  creator_subscriber_count?: number;

  // Modular block system
  @IsOptional()
  @IsArray()
  blocks?: any[];

  // Act 1: Understand fields (legacy)
  @IsOptional()
  @IsString()
  understand_video_url?: string;

  @IsOptional()
  @IsString()
  understand_video_library_id?: string;

  @IsOptional()
  @IsString()
  understand_headline?: string;

  @IsOptional()
  @IsArray()
  understand_questions?: any[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  title_highlight_words?: string[];

  @IsOptional()
  @IsString()
  sidebar_title?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises!: ExerciseDto[];
}
