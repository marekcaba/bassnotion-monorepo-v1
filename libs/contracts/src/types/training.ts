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
 * Deep copy of a goal's climb-relevant fields, taken at enrollment. Frozen
 * against EXTERNAL change — an admin's draft→publish edit to the training_goal
 * never mutates an in-flight climb (the one genuinely-new modeling decision in
 * the spec).
 *
 * NOTE: the player's OWN deliberate "Go Deeper" at graduation DOES raise
 * `target.tempoBpm` here (§7). That isn't an admin edit leaking in — it's the
 * enrollment advancing its own state. Safe because the climb's tempo is driven
 * by `climb_states.current_position`, not by this snapshot target — the target
 * here only feeds the rep title + the graduation summary display.
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
  /** Attendance over the graduation window (Treadmill epic Story 7): how many
   *  distinct calendar days the player practised, and the window length — the
   *  "you showed up X of N days" proof. Optional (a summary built without the
   *  attendance read omits them); the gym/graduation screen renders when present. */
  daysPracticedInWindow?: number;
  windowDays?: number;
}

// =====================================================
// MonthInReview — the day-30 recap (Treadmill epic Story 6). The journey screen:
// level then→now, the practice pattern, reps/grooves conquered, streak. Assembled
// read-time at graduation from the engine's own data + the shared streak/practice
// services. A recap, "always a win" — never pass/fail.
// =====================================================

/** A groove/lane conquered this cycle, with the player's best tier in it. */
export interface ConqueredGroove {
  /** Display name (the goal/groove title, e.g. "Lock the Pocket"). */
  title: string;
  /** Best tier reached across this cycle's conquered reps, or null. */
  bestTier: MasteryTier | null;
  /** How many reps were conquered in this lane. */
  conqueredReps: number;
}

export interface MonthInReview {
  goalEnrollmentId: string;
  /** Level then → now (BPM for SPEED; null when unknown). */
  startTempoBpm: number | null;
  currentTempoBpm: number | null;
  /** current − start (null if either unknown). */
  gainedBpm: number | null;

  /** Practice pattern. */
  daysPracticed: number;
  windowDays: number;
  /** The distinct days practised (YYYY-MM-DD, ascending) — drives the calendar. */
  practicedDays: string[];
  /** 0=Sun…6=Sat, the weekday the player practised most (null if no days). */
  strongestWeekday: number | null;

  /** Reps & grooves. */
  totalReps: number;
  conqueredReps: number;
  grooves: ConqueredGroove[];

  /** Streak snapshot at graduation. */
  streakDays: number;
  ceilingDays: number;
  freezeTokens: number;
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
// StudentState — the whole-student read-model (Bass Gym Treadmill epic, Story 1;
// designed + adversarially verified in BASS_GYM_CURRICULUM_SPEC_v1 §2.5).
//
// A read-only, DERIVED, fully-serializable snapshot of one student against one
// goal — assembled IMPURELY on the backend (TrainingEngineService) and handed as
// PLAIN DATA into the pure planners (generateRep today, advanceClimb next) so the
// engine makes coach-like decisions instead of last-rep-only ones.
//
// PURITY CONTRACT: there is NO clock, NO DB handle, NO service reference in here.
// Every time-relative fact (daysSince*, daysPracticedInWindow, isActiveToday) is a
// number/boolean the assembler PRE-COMPUTED from the single frozen `assembledAt`.
// The pure consumers read those fields; they never call a clock or diff a raw
// timestamp.
//
// FUTURE-PROOF: goal.target + climb.currentPosition stay opaque (no top-level
// `bpm`) so knowledge/vocabulary/feel goals ride the same shape; new signals are
// optional + derived → adding one is a code change, never a migration.
// =====================================================

/** Coach signals DERIVED from repHistory at assembly time (window anchored to
 *  `assembledAt`), pre-computed so the pure consumers don't re-walk the array. */
export interface StudentSignals {
  /** Leading run of `conquered` from newest → advanceClimb raises the position. */
  consecutiveWins: number;
  /** `too_hard` in the recent window → the back-off ladder (§4). */
  recentTooHardCount: number;
  /** Tail of repHistory outcomes (newest-first) → back-off + dip reasoning. */
  lastNOutcomes: RepResultOutcome[];
  /** today − last conquered completedAt (null if never conquered). */
  daysSinceLastConquered: number | null;
  /** Consecutive same-tempo conquered reps → week-3 plateau/dip targeting. */
  plateauRepCount?: number;
}

/** Attendance + streak — sourced via the shared PracticeService (boundary owner),
 *  never a direct `practice_days` / `profiles` query from the engine domain. */
export interface StudentAttendance {
  /** getStreak().current — the lapse-aware floor streak ("showed up"). */
  streakDays: number;
  /** getStreak().ceiling — full-focused-rep streak. NOTE: `ceiling`, not `streakCeiling`. */
  ceiling: number;
  isActiveToday: boolean;
  lastPracticedOn: string | null;
  freezeTokens: number;
  /** NET-NEW windowed COUNT on practice_days (the "28/30 days" number). */
  daysPracticedInWindow: number;
  /** The window the count was taken over (e.g. 30). */
  windowDays: number;
}

/** A lightweight per-(other goal) summary for multi-goal coaching. Not a full
 *  StudentState — promote to full only when the user switches to that goal. */
export interface SiblingGoalSummary {
  enrollmentId: string;
  type: GoalType;
  status: EnrollmentStatus;
  daysSinceLastRep: number | null;
}

export interface StudentState {
  /** The ONE frozen "now" the assembler stamped (ISO). Pure fns derive nothing
   *  from a live clock — every days-since / window field below came from this. */
  assembledAt: string;

  goal: {
    enrollmentId: string;
    type: GoalType;
    /** Opaque target ({ tempoBpm?; [k]: unknown }) — NOT tempo-only. */
    target: GoalTarget;
    status: EnrollmentStatus;
    /** placement.startTempoBpm (the audit of where the climb began), or null.
     *  (`placement.placed` is intentionally NOT surfaced — written but read nowhere.) */
    startTempoBpm: number | null;
    /** PRE-COMPUTED: today − started_at (drives the week-3 dip ∈ [14,28]). */
    daysSinceStart: number;
    /** GRADUATION_DAYS − daysSinceStart, floored at 0 (the fork clock). */
    graduationDaysRemaining: number;
  };

  /** The climb_states row VERBATIM — carries currentPosition, difficultyScalar,
   *  backoffCount, spacedReviewQueue, lastRepDate. generateRep already takes a
   *  ClimbState as arg 1, so generateRep(ss.climb, …) is a drop-in. */
  climb: ClimbState;

  /** This goal's rep_results, newest-first (the repository's order). */
  repHistory: RepResult[];
  /** repHistory[0] — the outcome that moves the climb / triggers a check-in. */
  lastRep: RepResult | null;
  /** PRE-COMPUTED: today − lastRep.completedAt (null if no reps yet). */
  daysSinceLastRep: number | null;

  derived: StudentSignals;

  /** Lifetime mastery across ALL goals/tutorials — from block_completions via
   *  ProgressService (a NET-NEW read; existing public methods drop the tier).
   *  Keyed by blockId alone so the same block conquered under a virtual training
   *  tutorial and elsewhere collapse to one entry. */
  lifetimeMastery: Record<string, { bestTier: MasteryTier; lastSeenAt: string }>;

  attendance: StudentAttendance;

  /** Multi-goal coaching — absent in v1 (single active goal). */
  siblingGoals?: SiblingGoalSummary[];
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
  /** Rep shape (Treadmill epic Story 5). 'full' = the 3-brick 2+2+2 (6-min)
   *  rep. 'floor' = the short "wrecked after work" session: ONE brick at today's
   *  tempo for 3 min ("just loop one groove") — protects the floor streak, not
   *  the ceiling. Defaults to 'full' when omitted. */
  mode?: 'full' | 'floor';
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
