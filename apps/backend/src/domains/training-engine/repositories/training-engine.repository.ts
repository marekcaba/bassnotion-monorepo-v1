import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  RepResult,
  GoalEnrollment,
  ClimbState,
  Goal,
  AdminGoalSummary,
  GoalSnapshot,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';
import type {
  RepResultRow,
  GoalEnrollmentRow,
  ClimbStateRow,
  GoalRow,
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
        topic_id: input.topicId ?? null,
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

  // ── training_goals ──────────────────────────────────────────────────────────

  /** Fetch an ENROLLABLE goal template by slug, or null: active AND not
   *  archived. An archived goal is never enrollable (the soft-delete contract),
   *  so a new enroll on an archived slug returns null → 404 upstream. */
  async findGoalBySlug(slug: string): Promise<Goal | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .is('archived_at', null)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch training goal', error as Error, {
        slug,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapGoalRow(data as GoalRow) : null;
  }

  /** All ENROLLABLE goals (active AND not archived), newest first — the
   *  student-facing goal picker. Same filter as findGoalBySlug, just unscoped. */
  async listEnrollableGoals(): Promise<Goal[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .select('*')
      .eq('is_active', true)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      logger.error('Failed to list enrollable goals', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return (data ?? []).map((r) => this.mapGoalRow(r as GoalRow));
  }

  // ── training_goals admin CRUD (Phase 5a) ────────────────────────────────────

  /** All goals incl. inactive, newest first (the admin table), each with its
   *  live enrollment count. EXCLUDES archived goals unless `includeArchived`
   *  (the soft-delete contract — archived goals drop off the admin list). The
   *  count drives the lifecycle UI (edit blast-radius banner + which delete
   *  affordance to show). */
  async listAllGoals(
    includeArchived = false,
  ): Promise<AdminGoalSummary[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    let query = this.supabaseService
      .getClient()
      .from('training_goals')
      .select('*')
      .order('created_at', { ascending: false });
    if (!includeArchived) query = query.is('archived_at', null);
    const { data, error } = await query;
    if (error) {
      logger.error('Failed to list training goals', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    const goals = (data ?? []).map((r) => this.mapGoalRow(r as GoalRow));
    const counts = await this.enrollmentCountsByGoal(goals.map((g) => g.id));
    return goals.map((g) => ({ ...g, enrollmentCount: counts.get(g.id) ?? 0 }));
  }

  /** Enrollment count per goal id, for the admin list (batched — one read for
   *  all goals, not N). Any-status enrollments count (all FK-cascade on delete). */
  private async enrollmentCountsByGoal(
    goalIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (goalIds.length === 0) return counts;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('goal_id')
      .in('goal_id', goalIds);
    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      logger.error('Failed to count enrollments by goal', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    for (const row of data ?? []) {
      const id = (row as { goal_id: string }).goal_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  /** Whether ANY goal (active or not) owns this slug — for admin slug collision. */
  async goalSlugExists(slug: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      logger.error('Failed to check goal slug', error as Error, {
        slug,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return !!data;
  }

  /** One goal by id (admin edit view), or null. */
  async findGoalById(id: string): Promise<Goal | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      logger.error('Failed to fetch training goal by id', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapGoalRow(data as GoalRow) : null;
  }

  /** Insert a goal row (admin authoring). `row` is already snake_cased. */
  async insertGoal(row: Record<string, unknown>): Promise<Goal> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .insert(row)
      .select()
      .single();
    if (error) {
      logger.error('Failed to insert training goal', error as Error, {
        slug: row.slug,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return this.mapGoalRow(data as GoalRow);
  }

  /** Patch a goal row by id (only the supplied snake_cased columns). */
  async updateGoal(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Goal | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      logger.error('Failed to update training goal', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapGoalRow(data as GoalRow) : null;
  }

  /** How many enrollments reference this goal (any status). Guards delete. */
  async countEnrollmentsForGoal(goalId: string): Promise<number> {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId);
    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      logger.error('Failed to count enrollments for goal', error as Error, {
        goalId,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return count ?? 0;
  }

  /** Is this user an admin? (profiles.role === 'admin'.) Mirrors
   *  EntitlementService.isAdmin — admins bypass the gym membership gate, matching
   *  how the rest of the app treats admins (full entitlement). */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    return !error && (data as { role?: string } | null)?.role === 'admin';
  }

  /** Delete a goal by id. Cascades to goal_enrollments + climb_states +
   *  rep_results via the FKs — the service guards this against accidental data
   *  loss (only on zero enrollments, or an explicit admin force-delete). */
  async deleteGoal(id: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .delete()
      .eq('id', id);
    if (error) {
      logger.error('Failed to delete training goal', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
  }

  /** Archive / unarchive a goal (soft-delete). Sets archived_at to now / null.
   *  Reversible, never cascades — the safe "take it off the shelf" action. */
  async setGoalArchived(id: string, archived: boolean): Promise<Goal | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('training_goals')
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      logger.error('Failed to set goal archived', error as Error, {
        id,
        archived,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapGoalRow(data as GoalRow) : null;
  }

  // ── goal_enrollments ────────────────────────────────────────────────────────

  /** All of a user's enrollments, newest first. */
  async listEnrollments(userId: string): Promise<GoalEnrollment[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list goal enrollments', error as Error, {
        userId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []).map((r) =>
      this.mapEnrollmentRow(r as GoalEnrollmentRow),
    );
  }

  /** Find a user's enrollment in a specific goal (idempotency check). */
  async findEnrollmentByGoal(
    userId: string,
    goalId: string,
  ): Promise<GoalEnrollment | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .maybeSingle();

    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      logger.error('Failed to find enrollment by goal', error as Error, {
        userId,
        goalId,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapEnrollmentRow(data as GoalEnrollmentRow) : null;
  }

  /** Create an enrollment with a frozen goal snapshot. */
  async createEnrollment(
    userId: string,
    goalId: string,
    snapshot: GoalSnapshot,
    placement: Record<string, unknown>,
  ): Promise<GoalEnrollment> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .insert({
        user_id: userId,
        goal_id: goalId,
        status: 'active',
        goal_snapshot: snapshot,
        placement,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create enrollment', error as Error, {
        userId,
        goalId,
        correlationId,
      });
      throw error;
    }
    return this.mapEnrollmentRow(data as GoalEnrollmentRow);
  }

  /** Create the one mutable climb_state row for an enrollment. */
  async createClimbState(
    userId: string,
    goalEnrollmentId: string,
    currentPosition: Record<string, unknown>,
  ): Promise<ClimbState> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('climb_states')
      .insert({
        goal_enrollment_id: goalEnrollmentId,
        user_id: userId,
        current_position: currentPosition,
        difficulty_scalar: 1.0,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create climb state', error as Error, {
        userId,
        goalEnrollmentId,
        correlationId,
      });
      throw error;
    }
    return this.mapClimbStateRow(data as ClimbStateRow);
  }

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

  /** Patch enrollment columns (status/started_at/graduated_at/goal_snapshot),
   *  user-scoped. Returns the updated row. (The graduation 3-door fork.) */
  async updateEnrollment(
    userId: string,
    enrollmentId: string,
    patch: Record<string, unknown>,
  ): Promise<GoalEnrollment | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', enrollmentId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) {
      logger.error('Failed to update enrollment', error as Error, {
        userId,
        enrollmentId,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapEnrollmentRow(data as GoalEnrollmentRow) : null;
  }

  /** Patch the climb_state's current_position (e.g. raising the tempo on Go Deeper). */
  async updateClimbPosition(
    userId: string,
    goalEnrollmentId: string,
    currentPosition: Record<string, unknown>,
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { error } = await this.supabaseService
      .getClient()
      .from('climb_states')
      .update({
        current_position: currentPosition,
        updated_at: new Date().toISOString(),
      })
      .eq('goal_enrollment_id', goalEnrollmentId)
      .eq('user_id', userId);
    if (error) {
      logger.error('Failed to update climb position', error as Error, {
        userId,
        goalEnrollmentId,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
  }

  /** Patch arbitrary climb_state columns (already snake_cased), user-scoped.
   *  The advance writer (Story 2) uses this to persist current_position +
   *  difficulty_scalar + backoff_count + last_rep_date in one write. */
  async patchClimbState(
    userId: string,
    goalEnrollmentId: string,
    patch: Record<string, unknown>,
    opts?: {
      /**
       * Race guard: only apply the update if last_rep_date is NULL or strictly
       * before this YYYY-MM-DD. Lets concurrent rep completions collapse to a
       * single climb advance per day at the DB level (the losing writes match
       * zero rows — a no-op, not an error).
       */
      onlyIfLastRepDateBefore?: string;
    },
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    let query = this.supabaseService
      .getClient()
      .from('climb_states')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('goal_enrollment_id', goalEnrollmentId)
      .eq('user_id', userId);

    if (opts?.onlyIfLastRepDateBefore) {
      // NULL (never advanced) OR an earlier day. A row already stamped today
      // matches neither → the update applies to zero rows (idempotent no-op).
      query = query.or(
        `last_rep_date.is.null,last_rep_date.lt.${opts.onlyIfLastRepDateBefore}`,
      );
    }

    const { error } = await query;
    if (error) {
      logger.error('Failed to patch climb state', error as Error, {
        userId,
        goalEnrollmentId,
        correlationId: this.requestContext?.getCorrelationId(),
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
      topicId: row.topic_id ?? null,
      signal: (row.signal_value as RepResult['signal']) ?? null,
      result: row.result,
      achievedTier: row.achieved_tier,
      completedAt: row.completed_at,
    };
  }

  private mapGoalRow(row: GoalRow): Goal {
    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      title: row.title,
      description: row.description,
      target: row.target ?? {},
      assessmentConfig: row.assessment_config ?? {},
      blockSet: row.block_set ?? [],
      topics: row.topics ?? [],
      prerequisites: row.prerequisites ?? [],
      day30Milestone: row.day30_milestone ?? {},
      forkConfig: row.fork_config ?? {},
      isActive: row.is_active,
      archivedAt: row.archived_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
