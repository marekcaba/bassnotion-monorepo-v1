/**
 * Progress contract types — shared between backend and frontend.
 *
 * The backend computes unlock state server-side so the frontend doesn't
 * have to duplicate the rule logic. A block is `unlocked` iff every block
 * with a lower `order` value is `completed` (linear progression).
 */

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
