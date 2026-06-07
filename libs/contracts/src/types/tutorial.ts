import type { AnyBlock } from './block.js';

/**
 * Question option for understand quizzes
 */
export interface UnderstandQuestionOption {
  id: string;
  text: string;
}

/**
 * Interactive question shown during understand video
 * Video pauses at timestamp, user answers, video continues
 */
export interface UnderstandQuestion {
  id: string;
  question: string;
  options: UnderstandQuestionOption[];
  correct_option_id: string;
  /** Timestamp in seconds. If not set, questions are auto-distributed across video */
  timestamp?: number;
}

export interface Tutorial {
  id: string;
  slug: string;
  title: string;
  artist: string;
  youtube_url?: string;
  youtube_id?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: string;
  description?: string;
  headline?: string;
  concepts?: string[];
  thumbnail?: string;
  /** Custom thumbnail URL from Supabase storage. Takes precedence over YouTube thumbnails. */
  thumbnail_url?: string;
  rating?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
  creator_subscriber_count?: number;

  /** Ordered array of lesson blocks (modular tutorial structure) */
  blocks?: AnyBlock[];

  // Act 1: Understand content (legacy — kept for backward compat during migration)
  /** Bunny Stream video ID for the understand/explanation video */
  understand_video_url?: string;
  /** Bunny Stream library ID */
  understand_video_library_id?: string;
  /** One-line pitch shown below title (e.g., "Before you play anything, you need to know where your notes live.") */
  understand_headline?: string;
  /** Interactive quiz questions shown during video. Empty array = video only, no quizzes */
  understand_questions?: UnderstandQuestion[];
  /** Words in the title to highlight with gradient styling */
  title_highlight_words?: string[];
  /** Short title for sidebar display (e.g., "Find Notes" instead of "How to Find Notes on the Bass Fretboard") */
  sidebar_title?: string;

  /** Publication status enum (`draft` | `published` | `archived`).
   *  Mirrors the `tutorials.status` Postgres column. Optional because
   *  legacy rows + older API responses may omit it; callers should
   *  treat `undefined` as "unknown" rather than "draft". */
  status?: 'draft' | 'published' | 'archived';
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
  /** Custom thumbnail URL from Supabase storage */
  thumbnail_url?: string;
  rating?: number;
  creator_name?: string;
  creator_channel_url?: string;
  creator_avatar_url?: string;
  creator_subscriber_count?: number;
  /** Ordered array of lesson blocks */
  blocks?: AnyBlock[];
  // Act 1: Understand content
  understand_video_url?: string;
  understand_video_library_id?: string;
  understand_headline?: string;
  understand_questions?: UnderstandQuestion[];
  title_highlight_words?: string[];
  sidebar_title?: string;
}

export interface UpdateTutorialDto extends Partial<CreateTutorialDto> {
  id: string;
}
