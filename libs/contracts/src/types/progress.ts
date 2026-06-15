/**
 * Progress contract types — shared between backend and frontend.
 *
 * The backend computes unlock state server-side so the frontend doesn't
 * have to duplicate the rule logic. A block is `unlocked` iff every block
 * with a lower `order` value is `completed` (linear progression).
 */

import type { DrillCompletionData } from './block.js';

/** Per-block progress entry inside a TutorialProgress response */
export interface BlockProgressEntry {
  /** Block id (matches TutorialBlock.id) */
  blockId: string;
  /** Whether the user has marked this block complete */
  completed: boolean;
  /** Whether the block can be accessed — derived from completed-prevailing rule */
  unlocked: boolean;
  /** When the user completed the block. null if not completed. */
  completedAt: string | null;
  /**
   * The free-form payload persisted at completion (`block_completions.data`).
   * For drill bricks this is a {@link DrillCompletionData} (result / criterion /
   * achievedTier / at) — the session summary reads it. null when the block
   * isn't completed or carries no payload (e.g. exercise auto-completion).
   */
  data: DrillCompletionData | null;
}

/** Per-exercise practice progress entry inside a TutorialProgress response */
export interface ExerciseProgressEntry {
  /** Exercise id (matches Exercise.id) */
  exerciseId: string;
  /** Number of times the user has completed this exercise (0..10) */
  completionCount: number;
  /** Last tempo the user practiced at, in BPM. null if never practiced. */
  lastTempoBpm: number | null;
}

/** GET /api/v1/tutorials/:slug/progress response */
export interface GetTutorialProgressResponse {
  /** Resolved tutorial id (slug → id translation done server-side) */
  tutorialId: string;
  /** Per-block progress, one entry per block in tutorial.blocks */
  blocks: BlockProgressEntry[];
  /** Per-exercise practice progress for exercises referenced by exercise blocks */
  exercises: ExerciseProgressEntry[];
}

/** Per-tutorial rollup summary entry for library / sidebar views */
export interface TutorialCompletionSummary {
  /** Tutorial id (the underlying UUID) */
  tutorialId: string;
  /** Tutorial slug — handy for callers that key by slug */
  slug: string;
  /** True if every block in tutorial.blocks is completed */
  isComplete: boolean;
  /** How many of the tutorial's blocks are completed */
  completedBlockCount: number;
  /** Total blocks in the tutorial */
  totalBlockCount: number;
  /** Per-block completion map keyed by blockId — drives sidebar dots */
  blockCompletions: Record<string, boolean>;
}

/** GET /api/v1/users/me/tutorial-completions response */
export interface GetUserTutorialCompletionsResponse {
  /** Summary entry per tutorial. Missing entry == no progress. */
  tutorials: TutorialCompletionSummary[];
}

/**
 * GET /api/v1/users/me/practice-streak response.
 *
 * A "streak day" = the user completed a drill session (reached the summary) on
 * that calendar day. `current` is the count of consecutive days ending today
 * (or yesterday — see `isActiveToday`). `lastPracticedOn` is the ISO date
 * (YYYY-MM-DD) of the most recent practice, or null if they've never practiced.
 */
export interface GetPracticeStreakResponse {
  /** The FLOOR streak: consecutive days the user showed up (any deliberate
   *  practice). 0 if never practiced or the streak lapsed. */
  current: number;
  /** Most recent practice date (YYYY-MM-DD), or null. */
  lastPracticedOn: string | null;
  /** True if the user has already logged a practice today (drives "keep it up"
   *  vs "practice today to keep your streak" copy). */
  isActiveToday: boolean;

  // ── Training-engine streak protection (Phase 4, spec §8) ───────────────────
  /** The CEILING streak: consecutive days the user completed a FULL focused rep
   *  (all ladder bricks). A subset of the floor — reaching the ceiling pays the
   *  floor automatically. */
  ceiling: number;
  /** Freeze tokens currently banked (auto-shield a missed day). */
  freezeTokens: number;
  /** True when a missed day was just auto-shielded by a freeze token (so the UI
   *  can surface "we saved your streak"). */
  freezeUsed: boolean;
  /** A milestone reached on THIS completion (7/30/100/365…), or null. Lets the
   *  client fire a celebration without a separate fetch. */
  milestoneReached: number | null;
}
