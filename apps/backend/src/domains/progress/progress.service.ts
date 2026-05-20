import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  createStructuredLogger,
  type AnyBlock,
  type ExerciseBlock,
  type ExerciseBlockConfig,
  type GetTutorialProgressResponse,
  type BlockProgressEntry,
  type ExerciseProgressEntry,
  type Tutorial as TutorialContract,
} from '@bassnotion/contracts';
import { ProgressRepository } from './repositories/progress.repository.js';
import { TutorialsService } from '../tutorials/tutorials.service.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

/**
 * Default required completions for an exercise to count as "complete" in the
 * scope of the parent exercise block. Mirrors the historical client-side
 * REQUIRED_COMPLETIONS constant. An exercise block exposes
 * `config.requiredCompletions` to override per-block.
 */
const DEFAULT_REQUIRED_COMPLETIONS = 4;

@Injectable()
export class ProgressService {
  private readonly staticLogger = createStructuredLogger(ProgressService.name);

  constructor(
    private readonly progressRepository: ProgressRepository,
    private readonly tutorialsService: TutorialsService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get a user's progress for a tutorial, with server-computed unlock state.
   *
   * The endpoint resolves `slug → tutorialId` server-side so the frontend
   * never has to know the UUID. Block unlock state is derived from
   * `block.order` and the user's `block_completions` rows — a block is
   * unlocked iff every block with a strictly lower `order` value is
   * completed. (Block 0 — the lowest-order block — is always unlocked.)
   *
   * Exercise block auto-completion: when ALL `config.exerciseIds` referenced
   * by an `exercise`-typed block have `completionCount >= requiredCompletions`
   * (default 4), the block is reported as completed even if no explicit
   * block_completions row exists. The write endpoint (PR 3) will materialise
   * the row at the moment of threshold crossing.
   */
  async getTutorialProgress(
    userId: string,
    slug: string,
  ): Promise<GetTutorialProgressResponse> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Getting tutorial progress', { userId, slug, correlationId });

    // Resolve slug → tutorial. Throws NotFoundException if missing/inactive.
    const tutorial = await this.tutorialsService.findBySlug(slug);
    const blocks = (tutorial as TutorialContract).blocks ?? [];

    if (blocks.length === 0) {
      // Tutorial has no block-based structure yet. Return empty progress.
      return {
        tutorialId: tutorial.id,
        blocks: [],
        exercises: [],
      };
    }

    // Parallel reads — the two tables are independent.
    const [completions, practice] = await Promise.all([
      this.progressRepository.getBlockCompletions(userId, tutorial.id),
      this.progressRepository.getPracticeProgress(userId, tutorial.id),
    ]);

    const completedById = new Map(
      completions.map((row) => [row.block_id, row.completed_at]),
    );
    const practiceById = new Map(
      practice.map((row) => [
        row.exercise_id,
        { count: row.completion_count, tempo: row.last_tempo_bpm },
      ]),
    );

    // Compute per-block completed state, then unlock state.
    const blocksByOrder = [...blocks].sort((a, b) => a.order - b.order);

    const blockEntries: BlockProgressEntry[] = blocksByOrder.map((block) =>
      this.buildBlockEntry(block, completedById, practiceById),
    );

    // Linear unlock rule: a block is unlocked iff every preceding block
    // (lower order) is completed. Pre-compute against the sorted array.
    let allPreviousCompleted = true;
    for (const entry of blockEntries) {
      entry.unlocked = allPreviousCompleted;
      if (!entry.completed) {
        allPreviousCompleted = false;
      }
    }

    // Exercise progress: union of all exerciseIds referenced by any
    // exercise-typed block in this tutorial, joined with practice rows.
    const exerciseIds = new Set<string>();
    for (const block of blocks) {
      if (block.type === 'exercise') {
        const config = block.config as ExerciseBlockConfig;
        for (const id of config.exerciseIds ?? []) {
          exerciseIds.add(id);
        }
      }
    }

    const exerciseEntries: ExerciseProgressEntry[] = Array.from(
      exerciseIds,
    ).map((exerciseId) => {
      const row = practiceById.get(exerciseId);
      return {
        exerciseId,
        completionCount: row?.count ?? 0,
        lastTempoBpm: row?.tempo ?? null,
      };
    });

    return {
      tutorialId: tutorial.id,
      blocks: blockEntries,
      exercises: exerciseEntries,
    };
  }

  /**
   * Compute a single block's completion state. Exercise blocks auto-complete
   * when all their exercises hit the rep threshold; other block types only
   * complete when an explicit block_completions row exists.
   */
  private buildBlockEntry(
    block: AnyBlock,
    completedById: Map<string, string>,
    practiceById: Map<string, { count: number; tempo: number | null }>,
  ): BlockProgressEntry {
    const explicitCompletedAt = completedById.get(block.id) ?? null;

    if (block.type === 'exercise') {
      const config = block.config as ExerciseBlockConfig;
      const required = config.requiredCompletions ?? DEFAULT_REQUIRED_COMPLETIONS;
      const exerciseIds = config.exerciseIds ?? [];

      const allMeetThreshold =
        exerciseIds.length > 0 &&
        exerciseIds.every(
          (id) => (practiceById.get(id)?.count ?? 0) >= required,
        );

      const completed = !!explicitCompletedAt || allMeetThreshold;

      return {
        blockId: block.id,
        completed,
        unlocked: false, // filled in by caller after sorting
        completedAt: explicitCompletedAt,
      };
    }

    return {
      blockId: block.id,
      completed: !!explicitCompletedAt,
      unlocked: false,
      completedAt: explicitCompletedAt,
    };
  }

  /**
   * Mark a block complete for the current user. Idempotent — re-completing
   * is a no-op. Returns the full updated progress so the frontend can
   * replace its cached state without a follow-up GET.
   *
   * Validates that the block belongs to the named tutorial (404 otherwise)
   * and that the user is actually allowed to complete it (i.e. all prior
   * blocks are completed — the same unlock rule enforced server-side).
   * Without this check, a malicious client could POST to any blockId and
   * skip ahead.
   */
  async completeBlock(
    userId: string,
    slug: string,
    blockId: string,
    data?: Record<string, unknown>,
  ): Promise<GetTutorialProgressResponse> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Completing block', { userId, slug, blockId, correlationId });

    const tutorial = await this.tutorialsService.findBySlug(slug);
    const blocks = (tutorial as TutorialContract).blocks ?? [];

    const target = blocks.find((b) => b.id === blockId);
    if (!target) {
      throw new NotFoundException(
        `Block "${blockId}" not found in tutorial "${slug}"`,
      );
    }

    // Enforce the unlock rule: every block with a strictly lower order
    // must be completed before this one can be completed. Fetch current
    // completions to validate.
    const completions = await this.progressRepository.getBlockCompletions(
      userId,
      tutorial.id,
    );
    const completedSet = new Set(completions.map((r) => r.block_id));
    const previousBlocks = blocks.filter((b) => b.order < target.order);
    const allPreviousComplete = previousBlocks.every((b) =>
      completedSet.has(b.id),
    );

    if (!allPreviousComplete) {
      // Use 404 rather than 403 to avoid leaking which specific blocks
      // are gating — the user isn't authorised to interact with this
      // resource yet, so it's effectively "not found".
      throw new NotFoundException(
        `Block "${blockId}" is not yet unlocked for this user`,
      );
    }

    await this.progressRepository.insertBlockCompletion(
      userId,
      tutorial.id,
      blockId,
      data,
    );

    // Return the freshly computed full state.
    return this.getTutorialProgress(userId, slug);
  }

  /**
   * Record one practice rep for an exercise. Increments completion_count
   * (capped at 10 by the column constraint) and refreshes last_tempo_bpm.
   *
   * Side effect: if this rep causes the parent exercise block to reach the
   * "all exercises meet threshold" condition, materialise a
   * block_completions row for that exercise block. This is what lets the
   * unlock rule cascade — the next block becomes accessible the moment
   * the threshold is crossed, without the frontend having to send a
   * separate /complete request.
   */
  async recordPractice(
    userId: string,
    slug: string,
    exerciseId: string,
    tempoBpm?: number,
  ): Promise<GetTutorialProgressResponse> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Recording practice rep', {
      userId,
      slug,
      exerciseId,
      tempoBpm,
      correlationId,
    });

    const tutorial = await this.tutorialsService.findBySlug(slug);
    const blocks = (tutorial as TutorialContract).blocks ?? [];

    // Validate the exercise belongs to some exercise block in this tutorial.
    // Without this, a malicious client could log practice for any exercise
    // id under any tutorial slug.
    const owningBlock = blocks.find(
      (b): b is ExerciseBlock =>
        b.type === 'exercise' &&
        (b.config as ExerciseBlockConfig).exerciseIds?.includes(exerciseId),
    );
    if (!owningBlock) {
      throw new NotFoundException(
        `Exercise "${exerciseId}" is not part of tutorial "${slug}"`,
      );
    }

    await this.progressRepository.incrementPracticeCompletion(
      userId,
      tutorial.id,
      exerciseId,
      tempoBpm,
    );

    // After the rep, check whether the owning exercise block now meets
    // the auto-complete threshold. If so, materialise the block_completions
    // row so downstream queries (and the unlock cascade) see it.
    const practice = await this.progressRepository.getPracticeProgress(
      userId,
      tutorial.id,
    );
    const practiceById = new Map(
      practice.map((r) => [r.exercise_id, r.completion_count]),
    );

    const required =
      owningBlock.config.requiredCompletions ?? DEFAULT_REQUIRED_COMPLETIONS;
    const exerciseIds = owningBlock.config.exerciseIds ?? [];
    const allMeetThreshold =
      exerciseIds.length > 0 &&
      exerciseIds.every((id) => (practiceById.get(id) ?? 0) >= required);

    if (allMeetThreshold) {
      // Idempotent — already-completed blocks are a no-op via the PK.
      await this.progressRepository.insertBlockCompletion(
        userId,
        tutorial.id,
        owningBlock.id,
      );
      logger.info('Exercise block auto-completed', {
        userId,
        tutorialId: tutorial.id,
        blockId: owningBlock.id,
        correlationId,
      });
    }

    return this.getTutorialProgress(userId, slug);
  }
}
