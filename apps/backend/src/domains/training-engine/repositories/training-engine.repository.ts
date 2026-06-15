import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  RepResult,
  GoalEnrollment,
  ClimbState,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';
import type {
  RepResultRow,
  GoalEnrollmentRow,
  ClimbStateRow,
  InsertRepResult,
  MintVirtualTutorial,
} from '../types/training-engine.types.js';

/**
 * Repository for the training-engine tables:
 *   - `rep_results`     (append-only — the engine's own history)
 *   - `goal_enrollments`(read for the sink; updated to stamp the virtual slug)
 *   - `tutorials`       (mint the reserved virtual-tutorial row, spec §7a)
 *
 * The backend Supabase client uses the SERVICE-ROLE key, so it bypasses RLS;
 * the row-level user check is enforced at the service layer (every method is
 * scoped to the authenticated user's id). All mapping is explicit snake↔camel
 * (no generic transformers — the `rep_plan_id` vs `repPlanId` trap is real).
 */
@Injectable()
export class TrainingEngineRepository {
  private readonly staticLogger = createStructuredLogger(
    TrainingEngineRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  // ── rep_results (append-only) ──────────────────────────────────────────────

  /** Append one rep result. Never updates — the table has no UPDATE policy. */
  async insertRepResult(input: InsertRepResult): Promise<RepResult> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('rep_results')
      .insert({
        user_id: input.userId,
        goal_enrollment_id: input.goalEnrollmentId,
        drill_session_id: input.drillSessionId ?? null,
        block_id: input.blockId,
        ladder_level: input.ladderLevel,
        tempo_bpm: input.tempoBpm ?? null,
        signal_kind: input.signal?.kind ?? null,
        signal_value: input.signal ?? null,
        result: input.result,
        achieved_tier: input.achievedTier ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert rep result', error as Error, {
        userId: input.userId,
        goalEnrollmentId: input.goalEnrollmentId,
        blockId: input.blockId,
        correlationId,
      });
      throw error;
    }

    return this.mapRepResultRow(data as RepResultRow);
  }

  /** All rep results for an enrollment, newest first (what generateRep reads). */
  async getRepResultsForEnrollment(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<RepResult[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('rep_results')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_enrollment_id', goalEnrollmentId)
      .order('completed_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch rep results', error as Error, {
        userId,
        goalEnrollmentId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []).map((row) => this.mapRepResultRow(row as RepResultRow));
  }

  // ── goal_enrollments ────────────────────────────────────────────────────────

  /** Fetch one enrollment scoped to the user, or null if it isn't theirs. */
  async findEnrollmentById(
    userId: string,
    enrollmentId: string,
  ): Promise<GoalEnrollment | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch goal enrollment', error as Error, {
        userId,
        enrollmentId,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapEnrollmentRow(data as GoalEnrollmentRow) : null;
  }

  // ── climb_states ────────────────────────────────────────────────────────────

  /** The mutable climb state for an enrollment (one row), or null if absent. */
  async findClimbState(
    userId: string,
    goalEnrollmentId: string,
  ): Promise<ClimbState | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('climb_states')
      .select('*')
      .eq('goal_enrollment_id', goalEnrollmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch climb state', error as Error, {
        userId,
        goalEnrollmentId,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapClimbStateRow(data as ClimbStateRow) : null;
  }

  /** Stamp the reserved virtual-tutorial slug onto an enrollment. */
  async setEnrollmentVirtualSlug(
    userId: string,
    enrollmentId: string,
    slug: string,
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .update({ virtual_tutorial_slug: slug })
      .eq('id', enrollmentId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to set enrollment virtual slug', error as Error, {
        userId,
        enrollmentId,
        slug,
        correlationId,
      });
      throw error;
    }
  }

  // ── tutorials (the virtual-tutorial seam, §7a) ──────────────────────────────

  /**
   * Mint (or update) the reserved virtual-tutorial row the rep bricks render
   * through. Idempotent on `slug` (UNIQUE) via upsert so a re-mint on the same
   * day overwrites the day's bricks rather than 23505-ing. `is_active=true`,
   * `status='published'` so findBySlug resolves it; `tags:['training-engine']`
   * keeps the storefront/library from surfacing it.
   */
  async upsertVirtualTutorial(input: MintVirtualTutorial): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    const now = new Date().toISOString();

    const { error } = await this.supabaseService
      .getClient()
      .from('tutorials')
      .upsert(
        {
          slug: input.slug,
          title: input.title,
          blocks: input.blocks,
          is_active: true,
          status: 'published',
          tags: ['training-engine'],
          updated_at: now,
          last_modified: now,
        },
        { onConflict: 'slug', ignoreDuplicates: false },
      );

    if (error) {
      logger.error('Failed to upsert virtual tutorial', error as Error, {
        slug: input.slug,
        correlationId,
      });
      throw error;
    }
  }

  // ── mappers (explicit snake↔camel) ──────────────────────────────────────────

  private mapRepResultRow(row: RepResultRow): RepResult {
    return {
      id: row.id,
      userId: row.user_id,
      goalEnrollmentId: row.goal_enrollment_id,
      drillSessionId: row.drill_session_id,
      blockId: row.block_id,
      ladderLevel: row.ladder_level,
      tempoBpm: row.tempo_bpm,
      signal: (row.signal_value as RepResult['signal']) ?? null,
      result: row.result,
      achievedTier: row.achieved_tier,
      completedAt: row.completed_at,
    };
  }

  private mapClimbStateRow(row: ClimbStateRow): ClimbState {
    return {
      id: row.id,
      goalEnrollmentId: row.goal_enrollment_id,
      userId: row.user_id,
      currentPosition: row.current_position ?? {},
      spacedReviewQueue: row.spaced_review_queue ?? [],
      difficultyScalar: row.difficulty_scalar,
      backoffCount: row.backoff_count,
      lastRepDate: row.last_rep_date,
      recommendations: row.recommendations ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEnrollmentRow(row: GoalEnrollmentRow): GoalEnrollment {
    return {
      id: row.id,
      userId: row.user_id,
      goalId: row.goal_id,
      startedAt: row.started_at,
      status: row.status,
      // Pass the JSONB through verbatim: its keys are ALREADY camelCase (the
      // seed/writer builds blockSet/assessmentConfig/etc.), so unlike the
      // top-level columns there is no snake↔camel remap to do here.
      goalSnapshot: row.goal_snapshot,
      placement: row.placement ?? {},
      virtualTutorialSlug: row.virtual_tutorial_slug,
      graduatedAt: row.graduated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
