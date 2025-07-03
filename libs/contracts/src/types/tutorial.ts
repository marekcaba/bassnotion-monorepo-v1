export interface Tutorial {
  id: string;
  slug: string;
  title: string;
  artist: string;
  youtube_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: string;
  description?: string;
  headline?: string;
  concepts?: string[];
  thumbnail?: string;
  rating?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
}

export interface TutorialWithExercises extends Tutorial {
  exercises: Exercise[];
  exercise_count?: number;
}

export interface TutorialSummary extends Tutorial {
  exercise_count: number;
}

// Import Exercise type from existing contracts
import type { Exercise } from './exercise.js';

// API Response types
export interface TutorialsResponse {
  tutorials: TutorialSummary[];
  total: number;
}

export interface TutorialResponse {
  tutorial: Tutorial;
}

export interface TutorialExercisesResponse {
  tutorial: Tutorial;
  exercises: Exercise[];
}

// DTO types for API requests
export interface CreateTutorialDto {
  slug: string;
  title: string;
  artist: string;
  youtube_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: string;
  description?: string;
  headline?: string;
  concepts?: string[];
  thumbnail?: string;
  rating?: number;
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
}

export interface UpdateTutorialDto extends Partial<CreateTutorialDto> {
  id: string;
}
