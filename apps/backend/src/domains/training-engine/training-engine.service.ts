import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  createStructuredLogger,
  generateRep,
  advanceClimb,
  clampRepTempo,
  deriveTopicProgress,
  GRADUATION_DAYS,
} from '@bassnotion/contracts';
import type {
  RepResult,
  RepResultOutcome,
  TutorialBlock,
  BlockPool,
  GoalEnrollment,
  GoalSnapshot,
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  ConqueredGroove,
  MasteryTier,
  StudentState,
  StudentSignals,
  TopicProgress,
  EnrollableGoal,
  ClimbState,
} from '@bassnotion/contracts';

/** Whole days between two UTC YYYY-MM-DD strings (b − a). Local copy to avoid a
 *  cross-domain import of progress/practice.service (same trivial date math). */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';
import { PracticeService } from '../progress/practice.service.js';
import { ProgressService } from '../progress/progress.service.js';
import { SubscriptionRepository } from '../billing/repositories/subscription.repository.js';
import type { InsertRepResult } from './types/training-engine.types.js';

/** Default attendance window for StudentState (matches the 30-day graduation
 *  clock — "showed up X of 30 days"). */
const ATTENDANCE_WINDOW_DAYS = GRADUATION_DAYS;
/** How many recent rep outcomes derived.lastNOutcomes carries. */
const RECENT_OUTCOME_WINDOW = 5;
/** A subscription period ending beyond this is treated as "lifetime" (the
 *  founder/lifetime grant stamps ~2099-12-31). Such a goal can't span decades,
 *  so it falls back to the normal 30-day cycle. ~5 years out (in ms) is well
 *  past any real monthly/annual period but short of the 2099 sentinel. */
const LIFETIME_PERIOD_CUTOFF_MS = Date.now() + 5 * 365 * 24 * 60 * 60 * 1000;

/**
 * TrainingEngineService — the backend surface of the Bass Gym Training Engine.
 *
 * Phase 1 responsibilities (the seam):
 *   1. recordRepResult — the RepResultSink's server side. Appends to the
 *      engine's own append-only `rep_results` (a SIBLING write to the drill
 *      executor's `block_completions`, spec §7a). Source of truth for
 *      generateRep.
 *   2. mintVirtualTutorial — writes already-generated rep bricks into the
 *      reserved `tutorials` row the executor renders through (spec §7a) and
 *      stamps the slug back onto the enrollment.
 *
 * Phase 2 adds `getTodayRep` — the orchestration that READS the enrollment +
 * climb_state, resolves the goal snapshot's block_set into a BlockPool, CALLS
 * the pure `generateRep`, mints the virtual tutorial, and returns the slug the
 * frontend renders the daily rep through. Goal content now exists (the SPEED
 * seed), so this is no longer deferred.
 */
@Injectable()
export class TrainingEngineService {
  private readonly staticLogger = createStructuredLogger(
    TrainingEngineService.name,
  );

  constructor(
    private readonly repository: TrainingEngineRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    // Shared-service seam (product boundary): attendance/streak + lifetime
    // mastery are read THROUGH these, never via a direct cross-domain query.
    private readonly practiceService: PracticeService,
    private readonly progressService: ProgressService,
    // The gym IS the monthly membership product's entitlement: enroll +
    // today-rep require an active subscription, and the goal window binds to the
    // subscription's billing period. Read through the billing domain's repo.
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  /**
   * Append a rep result for the authenticated user. Validates that the named
   * enrollment exists and belongs to them before writing (the backend client
   * is service-role and bypasses RLS, so this check is the authorization).
   */
  async recordRepResult(
    userId: string,
    input: Omit<InsertRepResult, 'userId'>,
  ): Promise<RepResult> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const enrollment = await this.repository.findEnrollmentById(
      userId,
      input.goalEnrollmentId,
    );
    if (!enrollment) {
      logger.warn('Rep result rejected: enrollment not found for user', {
        userId,
        goalEnrollmentId: input.goalEnrollmentId,
        correlationId,
      });
      throw new ForbiddenException('Goal enrollment not found for this user');
    }

    const result = await this.repository.insertRepResult({
      ...input,
      userId,
    });

    logger.info('Recorded rep result', {
      userId,
      goalEnrollmentId: input.goalEnrollmentId,
      blockId: input.blockId,
      result: input.result,
      correlationId,
    });

    return result;
  }

  /** Read the engine's history for an enrollment (what generateRep consumes). */
  async getRepHistory(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<RepResult[]> {
    return this.repository.getRepResultsForEnrollment(userId, goalEnrollmentId);
  }

  /**
   * Assemble the whole-student read-model for one enrollment (Treadmill epic
   * Story 1; designed in BASS_GYM_CURRICULUM_SPEC_v1 §2.5). This is the IMPURE
   * boundary: it reads the DB + shared services and freezes `now` ONCE, then
   * hands a plain, serializable StudentState to the pure planners. Every
   * time-relative field is pre-computed here — the pure consumers never call a
   * clock.
   *
   * The engine's own tables are read directly via the repository; attendance +
   * streak + lifetime mastery are read THROUGH PracticeService/ProgressService
   * (the product boundary — never a direct cross-domain query).
   */
  async assembleStudentState(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<StudentState> {
    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }
    const climb = await this.repository.findClimbState(
      userId,
      goalEnrollmentId,
    );
    if (!climb) {
      throw new NotFoundException('Climb state not found for this enrollment');
    }

    // Freeze "now" once — the single anchor every daysSince*/window derives from.
    const assembledAt = new Date().toISOString();
    const todayUtc = assembledAt.slice(0, 10);

    const repHistory = await this.repository.getRepResultsForEnrollment(
      userId,
      goalEnrollmentId,
    );

    // Cross-boundary reads, through the shared services (best-effort: a coaching
    // signal must never break planning the rep — both degrade to empty/zero).
    const [streak, daysPracticedInWindow, lifetimeMastery] = await Promise.all([
      this.practiceService.getStreak(userId),
      this.practiceService.countPracticeDaysInWindow(
        userId,
        ATTENDANCE_WINDOW_DAYS,
      ),
      this.progressService.getLifetimeMasteryByBlock(userId),
    ]);

    const lastRep = repHistory[0] ?? null;
    const daysSinceLastRep = lastRep
      ? dayDiff(lastRep.completedAt.slice(0, 10), todayUtc)
      : null;

    const startedDay = enrollment.startedAt.slice(0, 10);
    const daysSinceStart = Math.max(0, dayDiff(startedDay, todayUtc));

    const startTempoBpm =
      typeof enrollment.placement?.startTempoBpm === 'number'
        ? (enrollment.placement.startTempoBpm as number)
        : null;

    // The goal's deadline (founder: bind the goal to the billing period). When
    // the enrollment captured a billing-period end (`placement.goalDeadline`),
    // the days-remaining counts to THAT — the goal closes cleanly at renewal,
    // not a fixed day-30. Absent (lifetime / pre-gate enrollments) → the
    // existing 30-day clock. Floored at 0.
    const goalDeadline =
      typeof enrollment.placement?.goalDeadline === 'string'
        ? (enrollment.placement.goalDeadline as string)
        : null;
    const graduationDaysRemaining = goalDeadline
      ? Math.max(0, dayDiff(todayUtc, goalDeadline.slice(0, 10)))
      : Math.max(0, GRADUATION_DAYS - daysSinceStart);

    // Content-ladder (epic §3 Build A): per-topic quota tallies + current stage,
    // a pure derivation from the frozen topics + the rep history (topicId). Only
    // present on a multi-topic goal — single-focal SPEED goals leave it absent.
    const topics = enrollment.goalSnapshot.topics;
    const topicProgress =
      topics && topics.length > 0
        ? deriveTopicProgress(topics, repHistory)
        : undefined;

    return {
      assembledAt,
      goal: {
        enrollmentId: enrollment.id,
        type: enrollment.goalSnapshot.type,
        target: enrollment.goalSnapshot.target,
        status: enrollment.status,
        startTempoBpm,
        daysSinceStart,
        graduationDaysRemaining,
      },
      climb,
      repHistory,
      lastRep,
      daysSinceLastRep,
      derived: deriveStudentSignals(repHistory, climb, todayUtc),
      lifetimeMastery,
      attendance: {
        streakDays: streak.current,
        ceiling: streak.ceiling,
        isActiveToday: streak.isActiveToday,
        lastPracticedOn: streak.lastPracticedOn,
        freezeTokens: streak.freezeTokens,
        daysPracticedInWindow,
        windowDays: ATTENDANCE_WINDOW_DAYS,
      },
      topicProgress,
    };
  }

  /**
   * The treadmill step (Story 2): run the pure advanceClimb against the frozen
   * StudentState, persist the delta, and return the (possibly) advanced climb so
   * today's rep plans from it. Idempotent per calendar day — guarded on
   * climb.lastRepDate so re-opening the gym twice today advances once. Returns
   * the unchanged climb when not due or when the climb didn't move.
   */
  private async maybeAdvanceClimb(
    userId: string,
    goalEnrollmentId: string,
    student: StudentState,
  ): Promise<ClimbState> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const climb = student.climb;
    const today = student.assembledAt.slice(0, 10);

    // Already advanced today → don't double-advance (re-open is a no-op).
    if (climb.lastRepDate === today) return climb;

    const delta = advanceClimb(student, { goalType: student.goal.type });

    // Stamp last_rep_date even on a hold, so a no-op day still closes the window
    // (a day with no win shouldn't re-trigger advance attempts on every re-open).
    const patch: Record<string, unknown> = { last_rep_date: today };
    if (delta.changed) {
      if (delta.currentPosition) patch.current_position = delta.currentPosition;
      if (typeof delta.difficultyScalar === 'number') {
        patch.difficulty_scalar = delta.difficultyScalar;
      }
      if (typeof delta.backoffCount === 'number') {
        patch.backoff_count = delta.backoffCount;
      }
    }

    await this.repository.patchClimbState(userId, goalEnrollmentId, patch);

    logger.info('Advanced climb', {
      userId,
      goalEnrollmentId,
      changed: delta.changed,
      nextTempoBpm: (delta.currentPosition?.tempoBpm as number) ?? null,
      difficultyScalar: delta.difficultyScalar ?? null,
      correlationId,
    });

    // Apply the delta in-memory so the rep plans from the advanced position
    // without a re-read.
    return {
      ...climb,
      currentPosition: delta.currentPosition ?? climb.currentPosition,
      difficultyScalar: delta.difficultyScalar ?? climb.difficultyScalar,
      backoffCount: delta.backoffCount ?? climb.backoffCount,
      lastRepDate: today,
    };
  }

  /** All of a user's goal enrollments (the gym's "my goals" list). */
  async listMyEnrollments(userId: string): Promise<GoalEnrollment[]> {
    return this.repository.listEnrollments(userId);
  }

  /** The student-facing goal picker — enrollable goals (active + not archived),
   *  trimmed to public-safe fields + a content-ladder summary. */
  async listEnrollableGoals(): Promise<EnrollableGoal[]> {
    const goals = await this.repository.listEnrollableGoals();
    return goals.map((g) => {
      const topics = g.topics ?? [];
      return {
        slug: g.slug,
        type: g.type,
        title: g.title,
        description: g.description ?? null,
        targetTempoBpm:
          typeof g.target?.tempoBpm === 'number' ? g.target.tempoBpm : null,
        topicCount: topics.length,
        totalQuota: topics.reduce((n, t) => n + (t.repQuota || 0), 0),
      };
    });
  }

  /**
   * Enroll the user in a goal by slug: freeze a goal_snapshot, create the
   * enrollment + its climb_state. Idempotent — returns the existing enrollment
   * if the user is already in this goal (the UNIQUE(user_id, goal_id) contract).
   *
   * Placement (Phase 5b): if the caller passes a measured starting tempo (the
   * gym's "what tempo can you play this cleanly?" step, spec §5), the climb
   * STARTS there. Otherwise it falls back to the goal target, then the engine
   * floor. The chosen value is recorded in goal_enrollments.placement as the
   * audit of where the player started. The picked value is clamped to the
   * engine's valid band so a bad input can't seed an out-of-range climb.
   */
  async enrollInGoal(
    userId: string,
    goalSlug: string,
    placement?: { startTempoBpm?: number },
  ): Promise<GoalEnrollment> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // GATE: the gym is the monthly-membership product's entitlement. Only an
    // active subscriber may enroll. (Resolves the period window too — see below.)
    const window = await this.resolveMembershipWindow(userId);
    if (!window.hasAccess) {
      throw new ForbiddenException(
        'The Bass Gym is part of the membership — an active subscription is ' +
          'required to set a goal.',
      );
    }

    const goal = await this.repository.findGoalBySlug(goalSlug);
    if (!goal) {
      throw new NotFoundException(`Training goal "${goalSlug}" not found`);
    }

    // Starting tempo: the player's placement if given (clamped), else the goal
    // target, else the engine floor.
    const picked = placement?.startTempoBpm;
    const startTempoBpm =
      typeof picked === 'number'
        ? clampRepTempo(picked)
        : (goal.target?.tempoBpm ?? 60);
    // Record where the player started (audit) + the goal's DEADLINE: the goal is
    // bound to the membership's billing period (founder: don't cut a goal mid-
    // rep at month end — close it cleanly at the period boundary). Stored on the
    // opaque placement JSONB → zero migration. null = the 30-day fallback
    // (lifetime/no-period members; see resolveMembershipWindow).
    const placementRecord = {
      startTempoBpm,
      placed: typeof picked === 'number',
      goalDeadline: window.periodEnd, // ISO string or null
    };

    const existing = await this.repository.findEnrollmentByGoal(
      userId,
      goal.id,
    );
    if (existing) {
      // SELF-HEAL: createEnrollment + createClimbState are two writes (no cross-
      // table transaction in the JS client). If a prior call died between them,
      // the enrollment exists but its climb_state is missing — which would make
      // getTodayRep 404 forever, and UNIQUE(user_id, goal_id) makes re-enroll a
      // no-op. So repair the climb_state here before returning. (We do NOT
      // re-place an existing enrollment — placement is a one-time start; repair
      // uses the original placed tempo when available.)
      const existingStart =
        typeof existing.placement?.startTempoBpm === 'number'
          ? (existing.placement.startTempoBpm as number)
          : startTempoBpm;
      await this.ensureClimbState(userId, existing.id, existingStart);
      logger.info('Enroll is a no-op: user already enrolled', {
        userId,
        goalSlug,
        enrollmentId: existing.id,
        correlationId,
      });
      return existing;
    }

    const snapshot: GoalSnapshot = {
      type: goal.type,
      target: goal.target,
      blockSet: goal.blockSet,
      // Freeze the content-ladder topics too (epic §3) — without this a
      // multi-topic goal would enroll with no topics and the engine would never
      // serve them. Frozen here so a later admin edit can't change an in-flight
      // climb's topics/quotas.
      topics: goal.topics,
      assessmentConfig: goal.assessmentConfig,
      day30Milestone: goal.day30Milestone,
      forkConfig: goal.forkConfig,
    };

    const enrollment = await this.repository.createEnrollment(
      userId,
      goal.id,
      snapshot,
      placementRecord,
    );
    await this.ensureClimbState(userId, enrollment.id, startTempoBpm);

    logger.info('Enrolled user in goal', {
      userId,
      goalSlug,
      enrollmentId: enrollment.id,
      startTempoBpm,
      placed: placementRecord.placed,
      correlationId,
    });

    return enrollment;
  }

  /**
   * Resolve the caller's membership window — the gym IS the monthly membership
   * product's entitlement (founder: the membership is the first product, the
   * goal lives inside it).
   *
   * Returns:
   *   - hasAccess: an ACTIVE / TRIALING subscription? (the gate)
   *   - periodEnd: the goal's deadline = the subscription's billing period end
   *     (ISO), so the goal closes cleanly at renewal — NOT a fixed day-30 — and
   *     a fresh goal can emerge. null falls back to the 30-day window for a
   *     LIFETIME member (synthetic period far in the future → an open-ended goal
   *     makes no sense; they run normal 30-day cycles on repeat).
   *
   * Accelerator is a DIFFERENT product with its own (future) gym access — it is
   * intentionally NOT a path to membership-gym here.
   */
  private async resolveMembershipWindow(
    userId: string,
  ): Promise<{ hasAccess: boolean; periodEnd: string | null }> {
    // Admins bypass the gate (matching the rest of the app — admins get full
    // entitlement). No billing period → the normal 30-day goal cycle.
    if (await this.repository.isAdmin(userId)) {
      return { hasAccess: true, periodEnd: null };
    }

    const sub = await this.subscriptionRepository.findByUserId(userId);
    const active =
      !!sub && (sub.status === 'active' || sub.status === 'trialing');
    if (!active) return { hasAccess: false, periodEnd: null };

    // A lifetime/founder grant carries a synthetic far-future period end; a goal
    // can't span ~73 years, so treat it as no period → the 30-day cycle.
    const end = sub.currentPeriodEnd;
    const periodEnd =
      end && end.getTime() < LIFETIME_PERIOD_CUTOFF_MS
        ? end.toISOString()
        : null;
    return { hasAccess: true, periodEnd };
  }

  /** Create the enrollment's climb_state only if it doesn't already exist. */
  private async ensureClimbState(
    userId: string,
    goalEnrollmentId: string,
    startTempoBpm: number,
  ): Promise<void> {
    const existing = await this.repository.findClimbState(
      userId,
      goalEnrollmentId,
    );
    if (existing) return;
    await this.repository.createClimbState(userId, goalEnrollmentId, {
      tempoBpm: startTempoBpm,
    });
  }

  /**
   * The reserved virtual-tutorial slug for an enrollment (spec §7a). Stable +
   * deterministic so a re-mint targets the same row (idempotent upsert).
   */
  virtualTutorialSlug(enrollmentId: string): string {
    return `training-rep-${enrollmentId}`;
  }

  /**
   * Write generated rep bricks into the enrollment's reserved virtual-tutorial
   * row and stamp the slug back onto the enrollment. Idempotent: minting again
   * for the same enrollment overwrites the bricks (e.g. a new day's rep).
   *
   * `bricks` are the output of the pure `generateRep` (assembled by the caller
   * in Phase 1; orchestrated server-side in Phase 2 once goals exist).
   */
  async mintVirtualTutorial(
    userId: string,
    goalEnrollmentId: string,
    bricks: TutorialBlock[],
    title = 'Daily Rep',
  ): Promise<string> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }

    const slug = this.virtualTutorialSlug(goalEnrollmentId);

    await this.repository.upsertVirtualTutorial({
      slug,
      title,
      blocks: bricks,
    });
    await this.repository.setEnrollmentVirtualSlug(
      userId,
      goalEnrollmentId,
      slug,
    );

    logger.info('Minted virtual tutorial for enrollment', {
      userId,
      goalEnrollmentId,
      slug,
      brickCount: bricks.length,
      correlationId,
    });

    return slug;
  }

  /**
   * Plan today's rep for an enrollment and make it renderable: read the
   * enrollment + climb_state, resolve the goal snapshot's block_set into a
   * BlockPool, run the pure `generateRep`, mint the virtual tutorial, and
   * return the slug the frontend renders the daily rep through.
   *
   * Idempotent per call — re-running re-plans from the current climb_state and
   * overwrites the virtual tutorial's bricks (a fresh rep for a new day / after
   * a tempo advance).
   */
  async getTodayRep(
    userId: string,
    goalEnrollmentId: string,
    /** Rep shape (Story 5): 'full' = the 6-min 2+2+2; 'floor' = the short 3-min
     *  "loop one groove" session. Defaults to 'full'. */
    mode: 'full' | 'floor' = 'full',
  ): Promise<{
    slug: string;
    bricks: TutorialBlock[];
    /** Content-ladder (epic §3 Build B): per-topic quota bars for the gym path
     *  view. Present only on a multi-topic goal; absent for single-focal SPEED.
     *  Already assembled on StudentState — surfaced here so the gym gets it in
     *  the same round-trip it already makes to plan the rep. */
    topicProgress?: TopicProgress[];
  }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // GATE: planning a rep is gym access — gate it on an active subscription
    // too (not just enroll), so a lapsed member can't keep pulling new reps.
    // The in-flight goal still CLOSES cleanly at its period deadline (the rep
    // they're mid-way through isn't yanked); this just stops NEW reps once the
    // membership has ended.
    const window = await this.resolveMembershipWindow(userId);
    if (!window.hasAccess) {
      throw new ForbiddenException(
        'The Bass Gym is part of the membership — renew to keep training.',
      );
    }

    // The enrollment is still needed for the block_set → BlockPool resolution
    // (StudentState carries the climb + history + goalType the planner needs,
    // but not the goal's content recipe).
    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }

    // The whole-student read-model (Story 1). It freezes `now` once and supplies
    // the climb + history + goalType the pure planner consumes; advanceClimb
    // reads its `derived` signals. generateRep's signature is UNCHANGED — we
    // destructure StudentState into the same args it always took.
    const student = await this.assembleStudentState(userId, goalEnrollmentId);

    // Mat -> treadmill (Story 2): move the climb based on how the LAST rep(s)
    // landed, BEFORE planning today's. Guarded to once per calendar day via
    // last_rep_date (the read-time / dayDiff pattern — re-opening the gym twice
    // a day advances once). The pure advanceClimb decides the delta; we persist
    // it and apply it in-memory so today's rep plans from the new position.
    const climb = await this.maybeAdvanceClimb(
      userId,
      goalEnrollmentId,
      student,
    );

    const pool = this.resolveBlockPool(enrollment);
    // Content-ladder (epic §3 Build A): a multi-topic goal carries frozen topics
    // on its snapshot. Passing them (+ the derived per-topic progress) routes
    // generateRep down the topic-aware path: pick today's topic, climb its
    // stage, stamp the topicId. Absent → the single-focal SPEED path, unchanged.
    const topics = enrollment.goalSnapshot.topics;
    const bricks = generateRep(climb, pool, student.repHistory, {
      goalType: student.goal.type,
      mode,
      // Admin-authored bracket width (target.tempoNotchBpm); generateRep clamps
      // + falls back to the default when unset.
      tempoNotchBpm: student.goal.target?.tempoNotchBpm as number | undefined,
      topics,
      topicProgress: student.topicProgress,
    });

    const title =
      mode === 'floor'
        ? 'Daily Rep — floor (short session)'
        : student.goal.target?.tempoBpm
          ? `Daily Rep — target ${student.goal.target.tempoBpm} BPM`
          : 'Daily Rep';

    const slug = await this.mintVirtualTutorial(
      userId,
      goalEnrollmentId,
      bricks,
      title,
    );

    logger.info('Planned today rep', {
      userId,
      goalEnrollmentId,
      slug,
      brickCount: bricks.length,
      correlationId,
    });

    return { slug, bricks, topicProgress: student.topicProgress };
  }

  /**
   * Resolve a goal snapshot's block_set into a BlockPool the engine plans from.
   *
   * v1 (the SPEED seed): each block_set entry embeds the full TutorialBlock
   * inline under `block` (self-contained — no groove_library / content lookups,
   * works on empty staging). When library-referenced content lands (Phase 5),
   * this is where blockId → groove_library / tutorials resolution slots in,
   * with `generateRep` itself unchanged (it only ever sees a BlockPool).
   */
  private resolveBlockPool(enrollment: GoalEnrollment): BlockPool {
    const blockSet = enrollment.goalSnapshot.blockSet ?? [];
    const blocks: TutorialBlock[] = [];
    for (const ref of blockSet) {
      if (ref.block) blocks.push(ref.block);
    }
    return { blocks };
  }

  // ── Graduation: the day-30 3-door fork (Phase 5c, spec §7) ─────────────────

  /**
   * A read-time view of where an enrollment stands against its 30-day window.
   * Computed from started_at (NOT a cron — the dayDiff pattern). The gym
   * surfaces the fork when `isDue`; it never blocks the rep.
   */
  async getGraduation(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<GraduationSummary> {
    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }
    const climb = await this.repository.findClimbState(
      userId,
      goalEnrollmentId,
    );
    // Attendance (Story 7) via the shared service (boundary-clean) — the
    // "showed up X of N days" proof. Best-effort: a read failure must not break
    // the graduation summary, so it degrades to omitting the count.
    let attendance:
      | { daysPracticedInWindow: number; windowDays: number }
      | undefined;
    try {
      const daysPracticedInWindow =
        await this.practiceService.countPracticeDaysInWindow(
          userId,
          ATTENDANCE_WINDOW_DAYS,
        );
      attendance = {
        daysPracticedInWindow,
        windowDays: ATTENDANCE_WINDOW_DAYS,
      };
    } catch {
      attendance = undefined;
    }
    return buildGraduationSummary(
      enrollment,
      climb?.currentPosition ?? null,
      attendance,
    );
  }

  /**
   * The day-30 month-in-review recap (Story 6): the player's journey through the
   * cycle — level then→now, practice pattern, reps/grooves conquered, streak.
   * Assembled read-time from the engine's own rep_results + the enrollment/climb
   * + the shared practice/streak services (boundary-clean). A recap, always a
   * win. Each cross-boundary read is best-effort so a stat outage can't break it.
   */
  async getMonthInReview(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<MonthInReview> {
    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }
    const climb = await this.repository.findClimbState(
      userId,
      goalEnrollmentId,
    );
    const history = await this.repository.getRepResultsForEnrollment(
      userId,
      goalEnrollmentId,
    );

    // Cross-boundary reads (shared services), best-effort.
    let practicedDays: string[] = [];
    let streak: {
      current: number;
      ceiling: number;
      freezeTokens: number;
    } = { current: 0, ceiling: 0, freezeTokens: 0 };
    try {
      [practicedDays, streak] = await Promise.all([
        this.practiceService.listPracticeDaysInWindow(
          userId,
          ATTENDANCE_WINDOW_DAYS,
        ),
        this.practiceService.getStreak(userId).then((s) => ({
          current: s.current,
          ceiling: s.ceiling,
          freezeTokens: s.freezeTokens,
        })),
      ]);
    } catch {
      // leave the safe defaults
    }

    return buildMonthInReview({
      enrollment,
      currentPosition: climb?.currentPosition ?? null,
      history,
      practicedDays,
      windowDays: ATTENDANCE_WINDOW_DAYS,
      streak,
    });
  }

  /**
   * Walk through one of the 3 doors at graduation (spec §7):
   *   - go_deeper   → raise the goal target + RESET the 30-day clock (keep
   *                   climbing, the same enrollment continues).
   *   - lock_it_in  → mark graduated (a win; no new climb).
   *   - switch_lanes→ mark graduated; the frontend re-places into a new goal.
   *
   * Idempotent-ish: acting on an already-graduated enrollment is a no-op return.
   */
  async walkThroughDoor(
    userId: string,
    goalEnrollmentId: string,
    door: GraduationDoor,
  ): Promise<GoalEnrollment> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }
    if (enrollment.status === 'graduated') {
      return enrollment; // already walked through a door
    }

    // The fork is only actionable AT graduation. Guarding here means a player
    // can't reset their clock / ratchet the target mid-cycle by hammering the
    // endpoint — go_deeper resets the window at most once per completed 30-day
    // cycle (the natural cadence), not daily. (Read-time check; no cron.)
    const climb = await this.repository.findClimbState(userId, goalEnrollmentId);
    const summary = buildGraduationSummary(
      enrollment,
      climb?.currentPosition ?? null,
    );
    if (!summary.isDue) {
      throw new BadRequestException(
        'Graduation is not due yet for this enrollment',
      );
    }

    const nowIso = new Date().toISOString();

    if (door === 'go_deeper') {
      // Raise the target a notch and restart the 30-day window. The climb
      // continues from where it landed (current_position untouched), now
      // chasing a higher target.
      const currentTarget =
        (enrollment.goalSnapshot.target?.tempoBpm as number | undefined) ??
        null;
      const landed =
        (climb?.currentPosition?.tempoBpm as number | undefined) ?? null;
      // New target: a clear step above wherever the player actually landed
      // (or the old target), clamped to the engine ceiling.
      const base = Math.max(landed ?? 0, currentTarget ?? 0);
      const newTarget = clampRepTempo(base + GO_DEEPER_STEP_BPM);
      const newSnapshot = {
        ...enrollment.goalSnapshot,
        target: { ...enrollment.goalSnapshot.target, tempoBpm: newTarget },
      };
      const updated = await this.repository.updateEnrollment(
        userId,
        goalEnrollmentId,
        { started_at: nowIso, goal_snapshot: newSnapshot, status: 'active' },
      );
      logger.info('Graduation: go_deeper', {
        userId,
        goalEnrollmentId,
        newTarget,
        correlationId,
      });
      return updated ?? enrollment;
    }

    // lock_it_in + switch_lanes both graduate the current enrollment. The
    // difference is what the FRONTEND does next (switch_lanes re-places).
    const updated = await this.repository.updateEnrollment(
      userId,
      goalEnrollmentId,
      { status: 'graduated', graduated_at: nowIso },
    );
    logger.info('Graduation: ' + door, {
      userId,
      goalEnrollmentId,
      correlationId,
    });
    return updated ?? enrollment;
  }
}

/** Days above which the window has elapsed and the fork is offered. */
const GO_DEEPER_STEP_BPM = 10;

/**
 * Pure derivation of the coach signals from rep history (exported for tests).
 * No I/O, no clock — `todayUtc` is passed in. Mirrors the §2.5 design: a leading
 * run of conquered reps, the recent too_hard count, the recent-outcome tail, and
 * days-since-last-conquered. Plateau (consecutive same-tempo wins) is computed
 * from the leading conquered run at the same tempo.
 *
 * `history` is newest-first (the repository's order).
 */
export function deriveStudentSignals(
  history: RepResult[],
  climb: ClimbState,
  todayUtc: string,
): StudentSignals {
  // Leading run of conquered reps from the newest end.
  let consecutiveWins = 0;
  for (const r of history) {
    if (r.result === 'conquered') consecutiveWins++;
    else break;
  }

  // Plateau: of that leading conquered run, how many share the newest rep's
  // tempo (a "stuck at the same speed" signal for the week-3 dip).
  let plateauRepCount = 0;
  const newestTempo = history[0]?.tempoBpm ?? null;
  if (newestTempo != null) {
    for (let i = 0; i < consecutiveWins; i++) {
      if (history[i]?.tempoBpm === newestTempo) plateauRepCount++;
      else break;
    }
  }

  // Struggle signal for the back-off ladder (Story 4): the "too hard — lay it
  // anyway" release valve records 'released' (the only struggle signal the drill
  // UI actually emits — 'too_hard' is an engine-only enum reserved for a future
  // explicit signal). Count BOTH so the back-off fires from real play.
  const recentTooHardCount = history
    .slice(0, RECENT_OUTCOME_WINDOW)
    .filter((r) => r.result === 'too_hard' || r.result === 'released').length;

  const lastNOutcomes: RepResultOutcome[] = history
    .slice(0, RECENT_OUTCOME_WINDOW)
    .map((r) => r.result);

  const lastConquered = history.find((r) => r.result === 'conquered') ?? null;
  const daysSinceLastConquered = lastConquered
    ? dayDiff(lastConquered.completedAt.slice(0, 10), todayUtc)
    : null;

  // climb is part of the signature so future signals (e.g. backoffCount-aware)
  // can read it without a re-plumb; v1 derives purely from history.
  void climb;

  return {
    consecutiveWins,
    recentTooHardCount,
    lastNOutcomes,
    daysSinceLastConquered,
    plateauRepCount,
  };
}

/**
 * Pure read-time graduation summary (exported for tests). daysElapsed from
 * started_at; isDue at GRADUATION_DAYS. The landing is a mirror, not pass/fail.
 */
export function buildGraduationSummary(
  enrollment: GoalEnrollment,
  currentPosition: Record<string, unknown> | null,
  /** Attendance over the window (Story 7), if the caller read it. Omitted →
   *  the summary leaves daysPracticedInWindow/windowDays undefined. */
  attendance?: { daysPracticedInWindow: number; windowDays: number },
): GraduationSummary {
  const today = new Date().toISOString().slice(0, 10);
  const started = enrollment.startedAt.slice(0, 10);
  const daysElapsed = Math.max(0, dayDiff(started, today));
  const start =
    (enrollment.placement?.startTempoBpm as number | undefined) ?? null;
  const current = (currentPosition?.tempoBpm as number | undefined) ?? null;
  const target =
    (enrollment.goalSnapshot.target?.tempoBpm as number | undefined) ?? null;
  return {
    goalEnrollmentId: enrollment.id,
    daysElapsed,
    daysRemaining: Math.max(0, GRADUATION_DAYS - daysElapsed),
    isDue: daysElapsed >= GRADUATION_DAYS,
    graduated: enrollment.status === 'graduated',
    startTempoBpm: start,
    currentTempoBpm: current,
    targetTempoBpm: target,
    ...(attendance
      ? {
          daysPracticedInWindow: attendance.daysPracticedInWindow,
          windowDays: attendance.windowDays,
        }
      : {}),
  };
}

const TIER_RANK: Record<MasteryTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
};

/**
 * Pure month-in-review assembly (exported for tests). No I/O, no clock — every
 * input is passed in. Derives the level delta, the strongest practice weekday,
 * rep/groove counts, and the best tier per lane (the groove's display name comes
 * from the goal's block title — the gym has one groove per goal, so the recap
 * groups by goal, not by ephemeral per-level brick ids).
 */
export function buildMonthInReview(input: {
  enrollment: GoalEnrollment;
  currentPosition: Record<string, unknown> | null;
  history: RepResult[];
  practicedDays: string[];
  windowDays: number;
  streak: { current: number; ceiling: number; freezeTokens: number };
}): MonthInReview {
  const { enrollment, currentPosition, history, practicedDays, windowDays } =
    input;

  const start =
    (enrollment.placement?.startTempoBpm as number | undefined) ?? null;
  const current = (currentPosition?.tempoBpm as number | undefined) ?? null;
  const gainedBpm =
    typeof start === 'number' && typeof current === 'number'
      ? current - start
      : null;

  // Strongest weekday: the day-of-week with the most practice days (0=Sun).
  const weekdayCounts = new Array(7).fill(0) as number[];
  for (const d of practicedDays) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow >= 0 && dow <= 6) weekdayCounts[dow]++;
  }
  let strongestWeekday: number | null = null;
  let best = 0;
  for (let i = 0; i < 7; i++) {
    if (weekdayCounts[i] > best) {
      best = weekdayCounts[i];
      strongestWeekday = i;
    }
  }

  const conquered = history.filter((r) => r.result === 'conquered');
  // Best tier across the conquered reps (the goal's single lane in v1).
  let bestTier: MasteryTier | null = null;
  for (const r of conquered) {
    const t = r.achievedTier;
    if (t && (bestTier === null || TIER_RANK[t] > TIER_RANK[bestTier])) {
      bestTier = t;
    }
  }

  // The lane's display name = the goal's focal block title (the groove), falling
  // back to a generic label. One lane per goal in v1.
  const focalTitle =
    enrollment.goalSnapshot.blockSet?.[0]?.block?.title ?? 'Your groove';
  const grooves: ConqueredGroove[] =
    conquered.length > 0
      ? [{ title: focalTitle, bestTier, conqueredReps: conquered.length }]
      : [];

  return {
    goalEnrollmentId: enrollment.id,
    startTempoBpm: start,
    currentTempoBpm: current,
    gainedBpm,
    daysPracticed: practicedDays.length,
    windowDays,
    practicedDays,
    strongestWeekday,
    totalReps: history.length,
    conqueredReps: conquered.length,
    grooves,
    streakDays: input.streak.current,
    ceilingDays: input.streak.ceiling,
    freezeTokens: input.streak.freezeTokens,
  };
}
