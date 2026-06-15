/**
 * Bass Gym Training Engine — contract types (Phase 0).
 *
 * These mirror the `20260613000002_create_training_engine_tables.sql` schema
 * (snake_case columns → camelCase fields; the repository layer maps explicitly).
 *
 * The engine's brain — `generateRep` — is a PURE function of
 * (ClimbState, BlockPool, RepResult[]) → TutorialBlock[]. It reads the engine's
 * OWN append-only `rep_results` history, never `block_completions`. See
 * BASS_GYM_TRAINING_ENGINE_SPEC_v3 §11–§12.
 */

import type {
  TutorialBlock,
  MasteryTier,
  DrillCompletionResult,
  DrillCompletionData,
} from './block.js';

// =====================================================
// Enums (declared as TS type + PG CHECK + z.enum — see training-schemas.ts)
// =====================================================

/** The four goal types — each selects its own climb recipe + graduation. */
export type GoalType = 'speed' | 'knowledge' | 'vocabulary' | 'feel';

/** The 2+2+2 ladder: L1 (easier/review) → L2 (today) → L3 (a notch harder). */
export type LadderLevel = 'L1' | 'L2' | 'L3';

/** Enrollment lifecycle. */
export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'graduated'
  | 'abandoned';

/**
 * How a rep ended. Reuses the drill executor's DrillCompletionResult
 * (conquered | completed | released) and adds the engine-only `'too_hard'`
 * back-off signal (§4). NOTE: `'too_hard'` is intentionally NOT added to
 * DrillCompletionResult itself — the drill UI never emits it; only the engine
 * records it on a rep.
 */
export type RepResultOutcome = DrillCompletionResult | 'too_hard';

// =====================================================
// ProgressSignal — source-abstracted (the engine reads THIS, never a raw
// column / audio worklet). Button + completion exist as code today; tap_proxy
// and audio_analysis (the Bridge) are future implementations of the same port.
// =====================================================

export type ProgressSignal =
  | { kind: 'button'; value: number; at: number }
  | { kind: 'completion'; value: number; at: number }
  | {
      kind: 'tap_proxy';
      value: number;
      at: number;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'audio_analysis';
      value: number;
      at: number;
      meta?: Record<string, unknown>;
    };

export type ProgressSignalKind = ProgressSignal['kind'];

// =====================================================
// Goal (template) — admin-authored; the climb recipe (data, not code).
// =====================================================

/** A prerequisite expressed as an ability threshold (suggest, never block). */
export interface PrereqThreshold {
  signalType: string;
  minValue: number;
}

/** What the goal aims at, e.g. { tempoBpm: 120 }. Shape varies by type. */
export interface GoalTarget {
  tempoBpm?: number;
  [key: string]: unknown;
}

/** An ordered content reference inside a goal's block_set (the recipe). */
export interface BlockRef {
  /** id of a block / groove the engine assembles into the rep. */
  blockId: string;
  ladderPosition?: LadderLevel;
  /** Self-contained content: the full block embedded inline (the v1 seed shape).
   *  When present, the resolver uses it directly — no library lookup. Library
   *  references (blockId → groove_library/tutorials) resolve at Phase 5 instead. */
  block?: TutorialBlock;
  [key: string]: unknown;
}

export interface Goal {
  id: string;
  slug: string;
  type: GoalType;
  title: string;
  description?: string | null;
  target: GoalTarget;
  assessmentConfig: Record<string, unknown>;
  blockSet: BlockRef[];
  prerequisites: PrereqThreshold[];
  day30Milestone: Record<string, unknown>;
  forkConfig: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin authoring payload to CREATE a training goal (Phase 5a). Server-derived
 * fields (id, slug, timestamps) are omitted — slug is generated from the title.
 */
export interface CreateGoalInput {
  type: GoalType;
  title: string;
  description?: string | null;
  target?: GoalTarget;
  assessmentConfig?: Record<string, unknown>;
  blockSet?: BlockRef[];
  prerequisites?: PrereqThreshold[];
  day30Milestone?: Record<string, unknown>;
  forkConfig?: Record<string, unknown>;
  isActive?: boolean;
}

/** Admin authoring payload to UPDATE a goal — every field optional (a patch). */
export type UpdateGoalInput = Partial<CreateGoalInput>;

/**
 * Deep copy of a goal's climb-relevant fields, frozen at enrollment so
 * draft→publish edits never mutate an in-flight climb (the one genuinely-new
 * modeling decision in the spec).
 */
export interface GoalSnapshot {
  type: GoalType;
  target: GoalTarget;
  blockSet: BlockRef[];
  assessmentConfig: Record<string, unknown>;
  day30Milestone: Record<string, unknown>;
  forkConfig: Record<string, unknown>;
}

// =====================================================
// Enrollment — one per (user, goal); the graduation clock.
// =====================================================

export interface GoalEnrollment {
  id: string;
  userId: string;
  goalId: string;
  /** Graduation clock anchor; graduationDueAt = startedAt + 30 days (NOT Stripe). */
  startedAt: string;
  status: EnrollmentStatus;
  /** Immutable for the life of the climb. */
  goalSnapshot: GoalSnapshot;
  placement: Record<string, unknown>;
  /** Reserved tutorials-row slug the rep bricks render through (§7a). */
  virtualTutorialSlug: string | null;
  graduatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// Graduation — the day-30 3-door fork (spec §7). Computed read-time from
// started_at + the climb landing; NOT a cron. "Reflects reality, always a win."
// =====================================================

/** The 30-day window length (the graduation clock). */
export const GRADUATION_DAYS = 30;

/** Which of the 3 doors the player picked at graduation. */
export type GraduationDoor = 'go_deeper' | 'lock_it_in' | 'switch_lanes';

/**
 * A read-time view of where an enrollment stands against its 30-day window.
 * `isDue` flips at day 30; the gym surfaces the fork then (it never blocks the
 * rep). start/current/target describe the landing (a mirror, not pass/fail).
 */
export interface GraduationSummary {
  goalEnrollmentId: string;
  /** Whole days elapsed since started_at. */
  daysElapsed: number;
  /** Days left in the window (0 once due). */
  daysRemaining: number;
  /** True at/after day 30 — the fork is offered. */
  isDue: boolean;
  /** Already walked through a door (status 'graduated'). */
  graduated: boolean;
  /** Where the climb started (placement) and where it landed (current). */
  startTempoBpm: number | null;
  currentTempoBpm: number | null;
  targetTempoBpm: number | null;
}

// =====================================================
// RepResult — append-only history; the engine's source of truth.
// =====================================================

export interface RepResult {
  id: string;
  userId: string;
  goalEnrollmentId: string;
  drillSessionId?: string | null;
  blockId: string;
  ladderLevel: LadderLevel;
  tempoBpm?: number | null;
  signal: ProgressSignal | null;
  result: RepResultOutcome;
  achievedTier?: MasteryTier | null;
  completedAt: string;
}

// =====================================================
// ClimbState — one mutable row per enrollment (position + back-off).
// =====================================================

export interface ClimbState {
  id: string;
  goalEnrollmentId: string;
  userId: string;
  /** REP-driven position, e.g. { tempoBpm, blockIndex }. JSONB, not INT[]. */
  currentPosition: Record<string, unknown>;
  spacedReviewQueue: string[];
  /** §4 back-off multiplier applied to L1/L2/L3 deltas (default 1.0, floored). */
  difficultyScalar: number;
  backoffCount: number;
  /** Drives the missed-day re-plan (read as today − lastRepDate at read time). */
  lastRepDate?: string | null;
  recommendations: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// user_milestones — append-only trophy case.
// =====================================================

export interface UserMilestone {
  id: string;
  userId: string;
  milestoneType: string;
  achievedAt: string;
  data?: Record<string, unknown> | null;
}

// =====================================================
// generateRep I/O — the pure function's inputs & output.
// =====================================================

/** The content the engine assembles a rep from (data-not-code). */
export interface BlockPool {
  /** Candidate bricks the goal's block_set resolves to. */
  blocks: TutorialBlock[];
  /** Optional library metadata the selector may consult (kept opaque in v1). */
  grooves?: unknown[];
}

/**
 * Options carried alongside the (state, content, history) inputs.
 * `goalType` is NOT on ClimbState (which is per-enrollment runtime state) — it
 * lives on the enrollment's immutable `goalSnapshot.type`, so the caller passes
 * it explicitly. Keeping it out of ClimbState preserves the snapshot as the
 * single source of truth for the goal's identity.
 */
export interface GenerateRepOptions {
  goalType: GoalType;
}

/**
 * `generateRep(state, content, history, options) → TutorialBlock[]` — PURE.
 * Returns 6 ordered drill bricks (L1a, L1b, L2a, L2b, L3a, L3b). No I/O, no
 * clock, no playback, no randomness. `history` is the engine's own
 * `rep_results` rows (never `block_completions`).
 */
export type GenerateRep = (
  state: ClimbState,
  content: BlockPool,
  history: RepResult[],
  options: GenerateRepOptions,
) => TutorialBlock[];

// =====================================================
// Phase 1 — the seam ports (source-abstracted I/O between engine & executor).
// The engine subscribes to a ProgressSignalSource and writes through a
// RepResultSink. Button/completion sources exist as code today; tap_proxy and
// audio_analysis (the Bridge) are future implementations of the SAME port —
// the engine never changes when a new source arrives. See spec §10 seams 1+4.
// =====================================================

/**
 * A source of ProgressSignals (a port). Subscribe to receive signals; the
 * returned function unsubscribes. The engine reads THIS, never a raw audio
 * worklet or DB column.
 */
export interface ProgressSignalSource {
  subscribe(cb: (s: ProgressSignal) => void): () => void;
}

/**
 * Where a completed rep is recorded (a port). The drill executor keeps calling
 * its own `completeBlock` (writes `block_completions` for the UI's unlock/
 * summary state); the engine ADDITIONALLY appends a RepResult through this sink
 * (its own append-only source of truth). Two writes, two purposes (spec §7a).
 */
export interface RepResultSink {
  append(r: RepResultInput): Promise<void>;
}

/**
 * The payload the frontend sends to append a rep result. Server-derived fields
 * (`id`, `userId`, `completedAt`) are omitted — the backend stamps them.
 */
export interface RepResultInput {
  goalEnrollmentId: string;
  drillSessionId?: string | null;
  blockId: string;
  ladderLevel: LadderLevel;
  tempoBpm?: number | null;
  signal: ProgressSignal | null;
  result: RepResultOutcome;
  achievedTier?: MasteryTier | null;
}

// =====================================================
// Pure mappers — translate the drill executor's vocabulary into the engine's.
// No I/O; safe to use on either side of the wire.
// =====================================================

/**
 * Map a drill brick's completion (the `DrillCompletionData` the executor
 * already emits) into the engine's source-abstracted ProgressSignal.
 *
 *   - 'conquered'/'released' come from a button → `kind: 'button'`
 *     (value: 1 conquered, 0 released — a coarse pass/lay signal v1).
 *   - 'completed' from a measured time/loops criterion → `kind: 'completion'`.
 *
 * `atMs` is the caller's clock (the executor stamps `data.at` as an ISO string;
 * pass Date.parse(data.at) or the live ms). This stays pure — it never reads a
 * clock itself.
 */
export function drillCompletionToSignal(
  data: DrillCompletionData,
  atMs: number,
): ProgressSignal | null {
  switch (data.result) {
    case 'conquered':
      return { kind: 'button', value: 1, at: atMs };
    case 'released':
      return { kind: 'button', value: 0, at: atMs };
    case 'completed':
      return { kind: 'completion', value: 1, at: atMs };
    default:
      return null;
  }
}
