/**
 * API Data Transfer Objects (DTOs)
 *
 * Shared type definitions for API request/response objects.
 * These types support both snake_case (backend) and camelCase (frontend) formats
 * to facilitate seamless frontend-backend communication.
 *
 * NOTE: Moved from frontend domains to break circular dependencies between
 * exercises and tutorials domains.
 */

import type { TimeSignature } from './musical-timing.js';

/**
 * Exercise DTO from API responses
 * Supports both snake_case (backend) and camelCase formats
 */
export interface ExerciseDTO {
  id?: string;
  tutorial_id?: string;
  title: string;
  description?: string;
  difficulty?: string;
  duration?: number;
  duration_beats?: number;
  durationBeats?: number;
  total_bars?: number;
  totalBars?: number;
  bpm: number;
  key?: string;
  time_signature?: TimeSignature;
  timeSignature?: TimeSignature;
  notes?: unknown[];
  tags?: string[];
  is_active?: boolean;
  midi_file_path?: string;
  original_filename?: string;
  order_index?: number;
  start_time?: number;
  end_time?: number;
  drum_hits?: unknown[];
  chord_changes?: unknown[];
  status?: string;
  created_at?: string;
  updated_at?: string;
  // MIDI URLs
  drummer_midi_url?: string;
  harmony_midi_url?: string;
  metronome_midi_url?: string;
  bassline_midi_url?: string;
  // Harmony-specific
  harmony_notes?: unknown[];
  harmony_control_changes?: unknown[];
  harmony_instrument?: string;
  // Temp MIDI paths for backend migration
  temp_bassline_midi_path?: string;
  temp_drummer_midi_path?: string;
  temp_harmony_midi_path?: string;
  temp_metronome_midi_path?: string;
}

/**
 * Tutorial level/difficulty type
 */
export type TutorialLevelType = 'beginner' | 'intermediate' | 'advanced';

/**
 * Tutorial status type
 */
export type TutorialStatusType = 'draft' | 'published' | 'archived';

/**
 * Tutorial section interface (for structured content)
 */
export interface TutorialSectionDTO {
  id: string;
  title: string;
  type: 'intro' | 'exercise' | 'explanation' | 'summary';
  content?: string;
  start_time?: number;
  end_time?: number;
  order_index: number;
}

/**
 * Tutorial DTO from API responses
 */
export interface TutorialDTO {
  id: string;
  title: string;
  slug: string;
  description: string;
  youtube_id?: string;
  youtubeId?: string; // Alternative format
  duration: number;
  author_name?: string;
  authorName?: string; // Alternative format
  thumbnail_url?: string;
  thumbnailUrl?: string; // Alternative format
  level?: TutorialLevelType;
  difficulty?: TutorialLevelType; // Legacy field
  tags?: string[];
  is_active?: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  sections?: TutorialSectionDTO[];
  view_count?: number;
  status?: TutorialStatusType;
  last_modified?: string;
  auto_save_version?: number;
  drummer_midi_url?: string;
  bassline_midi_url?: string;
  harmony_midi_url?: string;
  deleted_at?: string;
  core_concept_description?: string;
  core_concept_points?: string[];
  teaching_takeaway?: Record<string, unknown>;
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
  creator_subscriber_count?: number;
  exercise_count?: number;
}

/**
 * API response for tutorials list
 */
export interface TutorialListResponseDTO {
  items?: TutorialDTO[];
  tutorials?: TutorialDTO[]; // Alternative format
  total?: number;
  page?: number;
  limit?: number;
}

/**
 * API response for tutorial with exercises
 */
export interface TutorialWithExercisesResponseDTO {
  tutorial: TutorialDTO;
  exercises: ExerciseDTO[];
}

/**
 * API response for batch save
 */
export interface SaveWithExercisesResponseDTO {
  tutorial: TutorialDTO;
  exercises: ExerciseDTO[];
}

/**
 * API response for paginated results
 */
export interface PaginatedResponseDTO<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
