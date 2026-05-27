/**
 * Block-based tutorial system types.
 *
 * Tutorials are composed of ordered blocks. Each block has a discriminated
 * `type` field and type-specific `config` data.
 */

import type {
  UnderstandQuestion,
  UnderstandQuestionOption,
} from './tutorial.js';

// =====================================================
// Block Type Discriminator
// =====================================================

/** All possible block types */
export type BlockType =
  | 'video'
  | 'exercise'
  | 'groove'
  | 'groove-card'
  | 'text'
  | 'celebration'
  | 'explain';

/** Video overlay modes for Video blocks */
export type VideoOverlayType =
  | 'PREP'
  | 'RECORD'
  | 'LISTEN'
  | 'UPLOAD'
  | 'QUIZ'
  | 'REFLECT';

// =====================================================
// Video Overlay Event Types
// =====================================================

/** Quiz overlay content: multiple-choice question */
export interface QuizOverlayContent {
  question: string;
  options: UnderstandQuestionOption[];
  correct_option_id: string;
}

/** Prep overlay: instruction to prepare before playing */
export interface PrepOverlayContent {
  instruction: string;
  detail?: string;
}

/** Record overlay: instruction to record themselves */
export interface RecordOverlayContent {
  instruction: string;
  durationHint?: number;
}

/** Listen overlay: instruction to actively listen */
export interface ListenOverlayContent {
  instruction: string;
  listenFor?: string;
}

/** Upload overlay: prompt to upload a recording */
export interface UploadOverlayContent {
  instruction: string;
}

/** Reflect overlay: open-ended reflection prompt */
export interface ReflectOverlayContent {
  prompt: string;
  placeholder?: string;
}

/** Maps each overlay type to its content interface */
export interface OverlayContentMap {
  QUIZ: QuizOverlayContent;
  PREP: PrepOverlayContent;
  RECORD: RecordOverlayContent;
  LISTEN: ListenOverlayContent;
  UPLOAD: UploadOverlayContent;
  REFLECT: ReflectOverlayContent;
}

/** A single timed overlay event on the video timeline */
export interface VideoOverlayEvent<
  T extends VideoOverlayType = VideoOverlayType,
> {
  /** Unique event ID */
  id: string;
  /** Overlay type discriminator */
  type: T;
  /** Timestamp in seconds where this overlay triggers */
  timestamp: number;
  /** Admin-friendly label */
  label?: string;
  /** Type-specific content */
  content: OverlayContentMap[T];
}

/** Union of all concrete overlay event types */
export type AnyVideoOverlayEvent =
  | VideoOverlayEvent<'QUIZ'>
  | VideoOverlayEvent<'PREP'>
  | VideoOverlayEvent<'RECORD'>
  | VideoOverlayEvent<'LISTEN'>
  | VideoOverlayEvent<'UPLOAD'>
  | VideoOverlayEvent<'REFLECT'>;

// =====================================================
// Block Config Types (per block type)
// =====================================================

/** Video block: Bunny Stream video with overlays */
export interface VideoBlockConfig {
  /** Bunny Stream video ID */
  videoUrl: string;
  /** Bunny Stream library ID */
  videoLibraryId: string;
  /** One-line pitch shown below title */
  headline?: string;
  /** Timed overlay events on the video timeline */
  overlayEvents?: AnyVideoOverlayEvent[];
  /** @deprecated Use overlayEvents with type='QUIZ' instead */
  questions?: UnderstandQuestion[];
  /** @deprecated Use overlayEvents instead */
  overlayTypes?: VideoOverlayType[];
}

/** Exercise block: Interactive practice with fretboard + 4-track playback */
export interface ExerciseBlockConfig {
  /** IDs of exercises to include (references exercises table) */
  exerciseIds: string[];
  /** Required completions per exercise to mark block complete (default 4) */
  requiredCompletions?: number;
  /** Difficulties that are locked behind completion */
  lockedDifficulties?: string[];
}

/** Groove block: Full performance mode with YouTube sync */
export interface GrooveBlockConfig {
  /** YouTube video URL or ID for sync mode */
  youtubeUrl?: string;
  /** Exercise ID for the groove exercise */
  grooveExerciseId?: string;
  /** Whether this block requires previous exercise blocks to be complete */
  requiresPreviousCompletion?: boolean;
}

/** Text block: Rich text/markdown content */
export interface TextBlockConfig {
  /** Markdown content */
  content: string;
  /** Optional heading */
  heading?: string;
  /** Layout variant */
  variant?: 'default' | 'callout' | 'tip' | 'warning';
}

/** Explain block: Multimedia carousel with slides */
export type ExplainMediaType = 'text' | 'image' | 'video' | 'audio';

/** A single media item within an explain slide */
export interface ExplainMediaItem {
  /** Unique item ID */
  id: string;
  /** Media type discriminator */
  type: ExplainMediaType;
  /** Markdown content (for text items) */
  content?: string;
  /** Image URL — Supabase storage or external (for image items) */
  imageUrl?: string;
  /** Image caption */
  caption?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Bunny Stream video ID (for video items) */
  videoUrl?: string;
  /** Bunny Stream library ID (for video items) */
  videoLibraryId?: string;
  /** Audio file URL (for audio items) */
  audioUrl?: string;
  /** Audio label, e.g. "Listen to this riff" (for audio items) */
  audioLabel?: string;
}

/** A single slide in the explain carousel — can contain multiple media items */
export interface ExplainSlide {
  /** Unique slide ID */
  id: string;
  /** Optional slide title */
  title?: string;
  /** Ordered media items on this slide */
  items: ExplainMediaItem[];
}

/** Explain block config: carousel of rich multimedia slides */
export interface ExplainBlockConfig {
  /** Optional heading shown above the carousel */
  heading?: string;
  /** Ordered slides */
  slides: ExplainSlide[];
}

/** Celebration block: Fullscreen milestone moment */
export interface CelebrationBlockConfig {
  /** Title shown during celebration */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Type of celebration animation */
  animationType?: 'confetti' | 'glow' | 'fireworks';
  /** Sound effect to play */
  soundEffect?: 'success' | 'unlock' | 'fanfare';
  /** CTA button text */
  ctaText?: string;
  /** CTA action: next block, navigate to dashboard, go to a custom URL, or navigate to next tutorial */
  ctaAction?: 'next' | 'dashboard' | 'url' | 'next-tutorial';
  /** URL for CTA when ctaAction is 'url' */
  ctaUrl?: string;
  /** Tutorial slug to navigate to when ctaAction is 'next-tutorial' */
  nextTutorialSlug?: string;
}

// =====================================================
// Groove Card Block (LAUNCH-02.5c)
// =====================================================

/**
 * One stem set per audio instrument. Each URL points at a file in the
 * `audio-samples` Supabase storage bucket (admin-only write per
 * `20250720000000_create_audio_samples_bucket.sql`).
 */
export interface GrooveCardStemSet {
  bass: string;
  drums: string;
  harmony: string;
  click: string;
}

/**
 * One of the 5 key sets a Groove Card delivers. The full tuple sits at
 * fixed semitone offsets [-8, -4, 0, +4, +8] from the original key; the
 * one with `isDefault: true` is the 0-offset set.
 */
export interface GrooveCardKeySet {
  /** Display label (e.g. "E", "G♯", "C") */
  label: string;
  /** Semitone offset from originalKey. Must be one of -8, -4, 0, +4, +8. */
  semitoneOffset: -8 | -4 | 0 | 4 | 8;
  /** Exactly one key set in the tuple has `isDefault: true`. */
  isDefault: boolean;
  /** The 4 stem URLs (bass / drums / harmony / click). */
  stems: GrooveCardStemSet;
}

/**
 * Reactive copy shown beneath the waveform when a control fires. Keys
 * map to state-changes the card can broadcast; admin authors the copy.
 */
export interface GrooveCardStateCaptions {
  'mute-bass'?: string;
  'solo-drums'?: string;
  'key-change'?: string;
  'tempo-change'?: string;
}

/**
 * Configuration for a `'groove-card'` block. Stored in the existing
 * JSONB `blocks` column on `tutorials` — no DB migration.
 */
export interface GrooveCardBlockConfig {
  /** Display title (e.g. "Greasy Pocket") */
  title: string;
  /** Short tag (e.g. "Funk in E") */
  subtitle: string;
  /** Original tempo in BPM. UI clamps the user-facing tempo control to [50, 180]. */
  originalBpm: number;
  /** Display label for the original key (e.g. "E"). The actual pitch of
   * each delivered key set is baked into the audio. */
  originalKey: string;
  /** Groove length in bars; the engine loops the stems indefinitely. */
  lengthBars: number;
  /** Exactly 5 key sets at offsets [-8, -4, 0, +4, +8]; one isDefault. */
  keys: [
    GrooveCardKeySet,
    GrooveCardKeySet,
    GrooveCardKeySet,
    GrooveCardKeySet,
    GrooveCardKeySet,
  ];
  /** Caption shown beneath the waveform when nothing is happening. */
  previewCaption?: string;
  /** Reactive copy per state change. */
  stateCaptions?: GrooveCardStateCaptions;
  /** Contract-only for the future; bookmarks UI is out of scope for v1. */
  allowBookmark?: boolean;
}

// =====================================================
// Block Type Map (discriminated union helper)
// =====================================================

export interface BlockConfigMap {
  video: VideoBlockConfig;
  exercise: ExerciseBlockConfig;
  groove: GrooveBlockConfig;
  'groove-card': GrooveCardBlockConfig;
  text: TextBlockConfig;
  celebration: CelebrationBlockConfig;
  explain: ExplainBlockConfig;
}

// =====================================================
// Tutorial Block (core data structure)
// =====================================================

/** A single block in a tutorial's lesson flow */
export interface TutorialBlock<T extends BlockType = BlockType> {
  /** Unique block ID (UUID) */
  id: string;
  /** Block type discriminator */
  type: T;
  /** Display title for this block (shown in nav dock) */
  title: string;
  /** Block-specific configuration */
  config: BlockConfigMap[T];
  /** Position in the tutorial (0-based) */
  order: number;
  /** Whether this block appears in the Dynamic Island navigation (default: true for video/exercise/groove, false for text/celebration) */
  showInIsland?: boolean;
}

/** Type-safe block aliases */
export type VideoBlock = TutorialBlock<'video'>;
export type ExerciseBlock = TutorialBlock<'exercise'>;
export type GrooveBlock = TutorialBlock<'groove'>;
export type GrooveCardBlock = TutorialBlock<'groove-card'>;
export type TextBlock = TutorialBlock<'text'>;
export type CelebrationBlock = TutorialBlock<'celebration'>;
export type ExplainBlock = TutorialBlock<'explain'>;

/** Union of all concrete block types */
export type AnyBlock =
  | VideoBlock
  | ExerciseBlock
  | GrooveBlock
  | GrooveCardBlock
  | TextBlock
  | CelebrationBlock
  | ExplainBlock;

// =====================================================
// Block Progress Tracking
// =====================================================

/** Per-block completion status */
export interface BlockProgress {
  blockId: string;
  completed: boolean;
  completedAt?: string;
  /** Block-type-specific progress data */
  data?: Record<string, unknown>;
}
