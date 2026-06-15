import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  createStructuredLogger,
  generateRep,
  clampRepTempo,
  GRADUATION_DAYS,
} from '@bassnotion/contracts';
import type {
  RepResult,
  TutorialBlock,
  BlockPool,
  GoalEnrollment,
  GoalSnapshot,
  GraduationSummary,
  GraduationDoor,
} from '@bassnotion/contracts';

/** Whole days between two UTC YYYY-MM-DD strings (b − a). Local copy to avoid a
 *  cross-domain import of progress/practice.service (same trivial date math). */
function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { TrainingEngineRepository } from './repositories/training-engine.repository.js';
import type { InsertRepResult } from './types/training-engine.types.js';

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

  /** All of a user's goal enrollments (the gym's "my goals" list). */
  async listMyEnrollments(userId: string): Promise<GoalEnrollment[]> {
    return this.repository.listEnrollments(userId);
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
    // Record where the player started (audit). `placed` distinguishes a real
    // placement from the target/floor fallback.
    const placementRecord = {
      startTempoBpm,
      placed: typeof picked === 'number',
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
  ): Promise<{ slug: string; bricks: TutorialBlock[] }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const enrollment = await this.repository.findEnrollmentById(
      userId,
      goalEnrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException('Goal enrollment not found for this user');
    }

    const climbState = await this.repository.findClimbState(
      userId,
      goalEnrollmentId,
    );
    if (!climbState) {
      throw new NotFoundException('Climb state not found for this enrollment');
    }

    const pool = this.resolveBlockPool(enrollment);
    const history = await this.repository.getRepResultsForEnrollment(
      userId,
      goalEnrollmentId,
    );

    const bricks = generateRep(climbState, pool, history, {
      goalType: enrollment.goalSnapshot.type,
    });

    const title = enrollment.goalSnapshot.target?.tempoBpm
      ? `Daily Rep — target ${enrollment.goalSnapshot.target.tempoBpm} BPM`
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

    return { slug, bricks };
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
    return buildGraduationSummary(enrollment, climb?.currentPosition ?? null);
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

    const nowIso = new Date().toISOString();

    if (door === 'go_deeper') {
      // Raise the target a notch and restart the 30-day window. The climb
      // continues from where it landed (current_position untouched), now
      // chasing a higher target.
      const currentTarget =
        (enrollment.goalSnapshot.target?.tempoBpm as number | undefined) ??
        null;
      const climb = await this.repository.findClimbState(
        userId,
        goalEnrollmentId,
      );
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
 * Pure read-time graduation summary (exported for tests). daysElapsed from
 * started_at; isDue at GRADUATION_DAYS. The landing is a mirror, not pass/fail.
 */
export function buildGraduationSummary(
  enrollment: GoalEnrollment,
  currentPosition: Record<string, unknown> | null,
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
  };
}
