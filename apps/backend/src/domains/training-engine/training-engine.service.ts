import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createStructuredLogger, generateRep } from '@bassnotion/contracts';
import type {
  RepResult,
  TutorialBlock,
  BlockPool,
  GoalEnrollment,
  GoalSnapshot,
} from '@bassnotion/contracts';
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
   * The starting climb position seeds from the goal target tempo (placement
   * proper lands in Phase 5).
   */
  async enrollInGoal(
    userId: string,
    goalSlug: string,
  ): Promise<GoalEnrollment> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const goal = await this.repository.findGoalBySlug(goalSlug);
    if (!goal) {
      throw new NotFoundException(`Training goal "${goalSlug}" not found`);
    }

    const existing = await this.repository.findEnrollmentByGoal(
      userId,
      goal.id,
    );
    if (existing) {
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

    // v1 starting tempo: the goal target if present, else the engine floor.
    // (Real placement assessment sets this for real in Phase 5.)
    const startTempoBpm = goal.target?.tempoBpm ?? 60;

    const enrollment = await this.repository.createEnrollment(
      userId,
      goal.id,
      snapshot,
      { startTempoBpm },
    );
    await this.repository.createClimbState(userId, enrollment.id, {
      tempoBpm: startTempoBpm,
    });

    logger.info('Enrolled user in goal', {
      userId,
      goalSlug,
      enrollmentId: enrollment.id,
      correlationId,
    });

    return enrollment;
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
}
