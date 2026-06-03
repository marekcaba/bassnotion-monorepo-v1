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
  | 'explain'
  | 'task';

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
 *
 * Only the musical stems are uploaded per key set: `bass`, `drums`,
 * `harmony`. The metronome **click is NOT a per-groove stem** — it's a
 * fixed two-sample metronome shared by every groove. In `/app` the
 * click toggle / countdown reuses the existing MIDI metronome track; on
 * the waitlist it uses a single bundled `countdown-click.ogg`. The
 * engine still has an `audio-click` channel (see `AudioInstrumentType`)
 * for the waitlist's bundled sample, but admins never upload it.
 */
export interface GrooveCardStemSet {
  bass: string;
  drums: string;
  harmony: string;
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
 * A groove brick's role inside a DRILL session (the "bricklayer" flow):
 *   - 'groove'     — the new skill to conquer (the spotlight brick)
 *   - 'connecting' — a chord-to-chord link ("same brick, different face")
 *   - 'review'     — a past groove re-served to chase the next tier
 * When present, the card behaves as a drill brick: free-vs-member caps are
 * enforced and conquering it advances the session. Absent on plain
 * tutorial/marketing groove cards (they just play).
 */
export type GrooveBrickRole = 'groove' | 'connecting' | 'review';

/**
 * Mastery tier earned/targeted on a conquer. v1 ships 'bronze'; silver/gold
 * arrive with real scoring (the Bridge). Contract-level home so both the
 * block config and the frontend drill store share one definition.
 */
export type MasteryTier = 'bronze' | 'silver' | 'gold';

/**
 * What a drill block measures to count as "done" (the "result"). Exactly one
 * per block. When met, the brick's Next button unlocks (student taps; no
 * auto-advance). Every brick also offers a release valve ("too hard → lay it
 * anyway") that advances with a `released` result.
 *   - 'time'    — practice for `target` minutes (groove brick: only while
 *                 playing; task block: wall-clock)
 *   - 'loops'   — play the loop `target` times (groove bricks)
 *   - 'conquer' — a clean pass to `targetTier` (self-report v1; Bridge later)
 *   - 'manual'  — the student taps "I'm done"
 */
export type DrillCriterionType = 'time' | 'loops' | 'conquer' | 'manual';

export interface DrillCompletionCriterion {
  type: DrillCriterionType;
  /** 'time' → minutes; 'loops' → loop count. Ignored for conquer/manual. */
  target?: number;
  /** 'conquer' only — the tier the author prescribes as this brick's goal. */
  targetTier?: MasteryTier;
}

/**
 * How a drill brick completion ended. Written into `block_completions.data`.
 *   - 'conquered' — passed the conquer criterion (carries achievedTier)
 *   - 'completed' — met a time/loops/manual criterion
 *   - 'released'  — advanced via the "too hard" release valve (laid, not won)
 */
export type DrillCompletionResult = 'conquered' | 'completed' | 'released';

/**
 * The payload a drill brick writes into `block_completions.data` (JSONB) when
 * the student completes it, and reads back to render the session summary.
 * Both the groove brick (GrooveCardBlockView) and the task block
 * (TaskBlockView) write exactly this shape.
 *
 * Stored loosely (the column is free-form JSONB), so every field is optional on
 * read — old rows, or non-drill block_completions, won't carry it.
 */
export interface DrillCompletionData {
  /** How the brick ended. Absent on non-drill completions. */
  result?: DrillCompletionResult;
  /** Which criterion was in play (undefined for plain cards / no criterion). */
  criterion?: DrillCriterionType;
  /** Tier reached for a 'conquered' result; null otherwise. */
  achievedTier?: MasteryTier | null;
  /** ISO timestamp the student completed it (client clock). */
  at?: string;
}

/**
 * Configuration for a `'groove-card'` block. Stored in the existing
 * JSONB `blocks` column on `tutorials` — no DB migration.
 *
 * Single-key-set + PitchShift architecture (LAUNCH-02.5e): the admin
 * uploads ONE stem set (bass / drums / harmony) in the original key.
 * The key stepper (±6 semitones) is applied at runtime via the
 * pitch-shift engine on the bass + harmony stems; drums and click are
 * not transposed. The legacy 5-key-set tuple was replaced because the
 * empirical sound quality of WSOLA across ±6 was indistinguishable from
 * the multi-key-set delivery while halving storage and removing the
 * cross-key stitching cliff at offsets ±2 / ±6.
 */
export interface GrooveCardBlockConfig {
  /** LIBRARY REFERENCE (preferred): id of a row in `groove_library`. When set,
   *  the intrinsic fields (title/subtitle/originalBpm/originalKey/lengthBars/
   *  stems) are RESOLVED from the library entity and the inline copies below
   *  are optional/ignored. Lets one groove be authored once and reused across
   *  many drills. Absent on legacy inline blocks (which carry their own
   *  intrinsic fields). */
  grooveId?: string;
  /** PER-USE OVERRIDE: starting key (semitone offset from the groove's
   *  originalKey) for THIS reference. Only meaningful with `grooveId`. */
  keyOverride?: number;
  /** PER-USE OVERRIDE: starting tempo (BPM) for THIS reference. Only
   *  meaningful with `grooveId`. */
  tempoOverride?: number;
  /** Display title (e.g. "Greasy Pocket"). Optional when `grooveId` is set
   *  (resolved from the library); required for legacy inline blocks. */
  title: string;
  /** Short tag (e.g. "Funk in E") */
  subtitle: string;
  /** Original tempo in BPM. UI clamps the user-facing tempo control to [50, 180]. */
  originalBpm: number;
  /** Display label for the original key (e.g. "E"). The audio is baked
   *  in this key; the runtime pitch-shift renders ±6 semitones around it. */
  originalKey: string;
  /** Groove length in bars; the engine loops the stems indefinitely. */
  lengthBars: number;
  /** The single stem set delivered at `originalKey`. Bass + harmony are
   *  pitch-shifted at runtime; drums + click are not. Resolved from the
   *  library when `grooveId` is set. */
  stems: GrooveCardStemSet;
  /** Caption shown beneath the waveform when nothing is happening. */
  previewCaption?: string;
  /** Reactive copy per state change. */
  stateCaptions?: GrooveCardStateCaptions;
  /** Contract-only for the future; bookmarks UI is out of scope for v1. */
  allowBookmark?: boolean;
  /** Optional YouTube video URL or 11-char ID rendered above the card. */
  youtubeUrl?: string;
  /** DRILL: this brick's role in a session. Presence turns the card into a
   *  drill brick (caps enforced, conquering advances the session). Absent on
   *  ordinary tutorial/marketing cards. */
  role?: GrooveBrickRole;
  /** DRILL: the per-brick timebox in minutes (the "5 min" clock). Drives the
   *  session clock + the rail segment. Optional; absent = untimed.
   *  NOTE: distinct from a `'time'` completionCriterion — timeboxMinutes is the
   *  display/clock hint; the criterion's `target` is the completion threshold.
   *  When both exist, the criterion target is authoritative for completion. */
  timeboxMinutes?: number;
  /** DRILL: how this brick completes (time/loops/conquer/manual). Presence (or
   *  `role`) makes the card a drill brick. Absent on plain tutorial cards. */
  completionCriterion?: DrillCompletionCriterion;
}

/**
 * Configuration for a `'task'` block — a no-audio drill brick: instruction
 * text + a completion criterion (usually a wall-clock timer). The free-tier
 * staple ("practice C major triads for 5 min"); the student plays their own
 * instrument while the timer runs. No groove, no stems, no playback.
 */
export interface TaskBlockConfig {
  /** The thing to practice, e.g. "Practice C major scale triads, slowly." */
  instruction: string;
  /** Optional short heading above the instruction. */
  heading?: string;
  /** How the task completes — typically `{ type: 'time', target }` (wall-clock)
   *  but `'manual'` is also valid. */
  completionCriterion: DrillCompletionCriterion;
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
  task: TaskBlockConfig;
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
export type TaskBlock = TutorialBlock<'task'>;

/** Union of all concrete block types */
export type AnyBlock =
  | VideoBlock
  | ExerciseBlock
  | GrooveBlock
  | GrooveCardBlock
  | TextBlock
  | CelebrationBlock
  | ExplainBlock
  | TaskBlock;

// =====================================================
// Block Progress Tracking
// =====================================================

/** Per-block completion status */
export interface BlockProgress {
  blockId: string;
  completed: boolean;
  completedAt?: string;
  /**
   * Block-type-specific completion payload. For drill bricks this is a
   * {@link DrillCompletionData} (result / criterion / achievedTier / at).
   */
  data?: DrillCompletionData;
}
