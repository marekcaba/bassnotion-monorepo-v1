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
import type { ExerciseNote } from './exercise.js';
import type { TimeSignature } from './musical-timing.js';

// =====================================================
// Block Type Discriminator
// =====================================================

/** All possible block types */
export type BlockType =
  | 'video'
  | 'exercise'
  | 'groove'
  | 'groove-card'
  | 'scales'
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
/**
 * An alternate bassline a member can swap in during playback ("Lines & Fills").
 * Each variant is a COMPLETE, full-length bass take of the EXACT same sample
 * length / loop grid as the default `bass` stem — the engine swaps the bass
 * worklet's PCM in place at the loop seam, so a different-length variant would
 * desync the shared grid (drums/harmony). Same-length is enforced at upload.
 *
 * `feature` is the entitlement key that unlocks it (default `linesAndFills`).
 * `url` may point at the private premium-basslines bucket (signed-URL gated),
 * unlike the free bass/drums/harmony which live in the public bucket.
 */
export interface BasslineVariant {
  /** Stable id (used as the preload cache key; survives URL re-minting). */
  id: string;
  /** Display label, e.g. "Bassline B" or "Walking". */
  title: string;
  /** Storage path / URL of the variant's full-length bass take. */
  url: string;
  /** Entitlement feature key that unlocks it. Defaults to 'linesAndFills'. */
  feature?: string;
  /**
   * "Lines & Fills" combo tags. Each variant is a pre-rendered full take of a
   * (line, fill) combination — the player resolves the active take from the two
   * selections:
   *  - `lineId`: which bassline this take belongs to (e.g. "A", "B"). Absent =
   *    the default bass's line (shown as "Default" in the Lines row).
   *  - `fillId`: which fill this take includes (e.g. "fill1"). Absent = no fill
   *    (the "None" option in the Fills row).
   * A groove with no fills simply leaves `fillId` unset on every variant, and
   * the card behaves as the original single-row bassline swap.
   */
  lineId?: string;
  fillId?: string;
  /**
   * Where this fill happens in the loop, for the waveform highlight. Bar + beat
   * are both 1-indexed (bar 1..lengthBars, beat 1..4 in 4/4) — the way a player
   * counts. Only meaningful on a fill take (a variant with a `fillId`); the
   * player draws a blue region on the waveform spanning [start..end] when this
   * fill is the active selection. Absent = no highlight (the swap still works).
   */
  fillRegion?: {
    startBar: number;
    startBeat: number;
    endBar: number;
    endBeat: number;
  };
  /**
   * This take's bass-line SHEET notation (pre-parsed from an admin-imported
   * MusicXML). When this variant is the active selection, the card's sheet view
   * shows THESE notes. Absent = the sheet view empty-states for this take. (The
   * built-in default bass / "Bass A" carries its own score on
   * `GrooveCardBlockConfig.bassNotation` instead, since it is the main stem, not
   * a variant.)
   */
  notes?: ExerciseNote[];
}

export interface GrooveCardStemSet {
  bass: string;
  drums: string;
  harmony: string;
  /**
   * Optional premium alternate basslines (Lines & Fills). When present and the
   * user is entitled, the groove card shows a swap row; selecting one swaps the
   * bass take in place at the next loop seam. All variants MUST match the
   * default `bass` length exactly.
   */
  bassVariants?: BasslineVariant[];
}

/**
 * One chord change in a groove's chord chart. The chart is SPARSE — an entry is
 * placed only where the harmony CHANGES; the chord holds until the next entry.
 *
 * Position is bar + sixteenth-note slot (the chart grid is 16 slots per bar in
 * 4/4, the only metre the engine supports). slot 0 = beat 1, 1 = beat 1-e, 2 =
 * beat 1-and, 3 = beat 1-a, 4 = beat 2, … 15 = beat 4-a. So "G7 on beats 3-4 of
 * bar 2" is { bar: 2, slot: 8 }.
 */
export interface ChordChartEntry {
  /** 1-based bar number, 1..lengthBars. */
  bar: number;
  /** Sixteenth-note slot within the bar, 0..15 (0 = beat 1). */
  slot: number;
  /** The chord symbol, stored + displayed verbatim (e.g. "A7", "Dm7b5"). */
  symbol: string;
}

/** A groove's chord chart — sparse changes, ordered by position. */
export type ChordChart = ChordChartEntry[];

/** Sixteenth-note slots per bar (4/4 is hardcoded throughout the engine). */
export const CHORD_SLOTS_PER_BAR = 16;

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
  /** Chord chart — sparse harmony changes over the groove's bars, shown to the
   *  player as they play along. Resolved from the library when `grooveId` is
   *  set; undefined/empty = no chart. */
  chordChart?: ChordChart;
  /** Bass-line notation (sheet music) for this groove. When present, the card's
   *  waveform window can switch to a bass-clef score that follows playback. The
   *  notes are pre-parsed (admin imports MusicXML/MIDI → ExerciseNote[]), so the
   *  player renders them directly without re-parsing. Absent = no sheet view
   *  (the toggle still shows an empty state). */
  bassNotation?: {
    notes: ExerciseNote[];
    /** Defaults to 4/4 when omitted. */
    timeSignature?: TimeSignature;
  };
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
  /** DRILL: Reference-Drop pulse-steadiness drill (Lock The Pocket). When
   *  enabled, the chosen reference stem(s) fade OUT for `dropForBars` and back
   *  IN on a bar boundary every `everyBars` — the return reveals tempo drift.
   *  Trains Pulse·Steadiness + Timing·Awareness. ALL behaviour is admin-authored
   *  here (nothing hardcoded); absent/disabled = the drill doesn't run. */
  referenceDrop?: ReferenceDropConfig;
}

/** What a Reference-Drop drill fades, and on what cadence. Admin-authored on the
 *  groove-card block; the playback hook reads it and schedules the gain ramps on
 *  bar boundaries (no values are baked into the engine). */
export interface ReferenceDropConfig {
  /** Off unless true — the feature never runs implicitly. */
  enabled: boolean;
  /** WHICH bars of the groove's loop the reference is dropped on — 1-based bar
   *  numbers within the `lengthBars`-bar loop. The pattern IS the loop, so it
   *  repeats identically every loop and CANNOT desync (unlike a rolling
   *  every-N/drop-M rate, which mismatches when its cycle doesn't tile the
   *  loop). e.g. an 8-bar loop with `dropBars: [1, 2, 5, 6]` drops bars 1,2,5,6
   *  every loop. Empty = nothing drops. Bars outside [1..lengthBars] are
   *  ignored. */
  dropBars: number[];
  /** Which reference stem(s) fade. The whole band can drop so NOTHING keeps the
   *  time (the real test): 'drums', 'harmony', 'bass', and/or the 'click'
   *  metronome. At least one. Dropping all of drums+harmony+bass = play to
   *  silence (hold the pulse alone). */
  dropTargets: Array<'drums' | 'harmony' | 'bass' | 'click'>;
  /** Gain-ramp duration in ms for the fade out/in. Optional; the hook falls
   *  back to a short default (~80ms) when omitted. */
  fadeMs?: number;
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

/**
 * A SCALES block — mounts the gym Scales tool (fretboard + drone + pickers) inside the block
 * player, LOCKED to a preset. The gym Scales tool is the first fully-built gym equipment tool;
 * this block is how it's served as a rep brick (and, later, other authored surfaces). The preset
 * fields mirror GymToolPreset; the tool consumes them via its `context` prop. ATTENDED completion
 * for now (see the training-engine context contract) — a scale rep is "did you run it", not a
 * graded take.
 */
export interface ScalesBlockConfig {
  /** The authored gym exercise to run (GymExercise.id). Null = tool default / open. */
  exerciseId: string | null;
  /** Optional exercise name for labelling. */
  exerciseName?: string | null;
  /** Locked key as an ASCII PathKey, e.g. "Gb". Null = tool default. */
  scaleKey?: string | null;
  /** Locked tempo (BPM). Null = tool default. */
  tempoBpm?: number | null;
  /** Take length in loops (1-8). Default 2. */
  recordLoops?: number;
  /** How the brick completes — attended (time/manual), like the other rep bricks. */
  completionCriterion?: DrillCompletionCriterion;
}

// =====================================================
// Block Type Map (discriminated union helper)
// =====================================================

export interface BlockConfigMap {
  video: VideoBlockConfig;
  exercise: ExerciseBlockConfig;
  groove: GrooveBlockConfig;
  'groove-card': GrooveCardBlockConfig;
  scales: ScalesBlockConfig;
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

  // ── Training-engine contract labels (spec §13) ──────────────────────────────
  // Optional + backward-compatible: absent on ordinary tutorial blocks; the
  // engine reads only these LABELS, never inside `config`. Stored in the same
  // `tutorials.blocks` JSONB → ZERO migration. Add fields here only as the goal
  // types that need them land (SPEED needs tempoRange; ladderPosition is generic).
  /** Which ladder level this block is authored for (or inferred from order). */
  ladderPosition?: 'L1' | 'L2' | 'L3';
  /** The musically-valid BPM band for this block (lifts PatternLibraryItem.bpmRange).
   *  generateRep clamps emitted tempos into this band when present. */
  tempoRange?: { min: number; max: number };
}

/** Type-safe block aliases */
export type VideoBlock = TutorialBlock<'video'>;
export type ExerciseBlock = TutorialBlock<'exercise'>;
export type GrooveBlock = TutorialBlock<'groove'>;
export type GrooveCardBlock = TutorialBlock<'groove-card'>;
export type ScalesBlock = TutorialBlock<'scales'>;
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
  | ScalesBlock
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
