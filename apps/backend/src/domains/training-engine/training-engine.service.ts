import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type { RepResult, TutorialBlock } from '@bassnotion/contracts';
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
 * NOT in Phase 1 (deferred to Phase 2, when goal content + climb_states reads
 * land): the orchestration that READS climb_states, resolves a goal's
 * block_set into a BlockPool, and CALLS the pure `generateRep`. That needs
 * authored goals to exist. Here, generation output is injected (callers pass
 * bricks), so the seam is exercisable against stub widgets without content.
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
}
