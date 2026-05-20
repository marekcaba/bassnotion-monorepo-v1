import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** Raw row returned from block_completions table */
export interface BlockCompletionRow {
  user_id: string;
  tutorial_id: string;
  block_id: string;
  completed_at: string;
  data: Record<string, unknown> | null;
}

/** Raw row returned from practice_progress table */
export interface PracticeProgressRow {
  user_id: string;
  tutorial_id: string;
  exercise_id: string;
  completion_count: number;
  last_tempo_bpm: number | null;
}

/**
 * Repository for the per-user progress tables:
 * - `block_completions` (one row per (user, tutorial, block))
 * - `practice_progress` (one row per (user, tutorial, exercise))
 *
 * Both are RLS-protected; reads use the user-scoped Supabase client so
 * the database enforces the user-id check, not the application layer.
 */
@Injectable()
export class ProgressRepository {
  private readonly staticLogger = createStructuredLogger(
    ProgressRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /** Fetch every completed block for (user, tutorial). Empty array on no rows. */
  async getBlockCompletions(
    userId: string,
    tutorialId: string,
  ): Promise<BlockCompletionRow[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('block_completions')
      .select('*')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId);

    if (error) {
      logger.error('Failed to fetch block completions', error, {
        userId,
        tutorialId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []) as BlockCompletionRow[];
  }

  /** Fetch every practice_progress row for (user, tutorial). Empty array on no rows. */
  async getPracticeProgress(
    userId: string,
    tutorialId: string,
  ): Promise<PracticeProgressRow[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('practice_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId);

    if (error) {
      logger.error('Failed to fetch practice progress', error, {
        userId,
        tutorialId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []) as PracticeProgressRow[];
  }

  /**
   * Mark a block complete. Idempotent — PRIMARY KEY (user_id, tutorial_id,
   * block_id) means a duplicate insert is a no-op (with ON CONFLICT DO
   * NOTHING). Returns the resulting row (existing or newly-inserted).
   */
  async insertBlockCompletion(
    userId: string,
    tutorialId: string,
    blockId: string,
    data?: Record<string, unknown>,
  ): Promise<BlockCompletionRow> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Upsert with ignoreDuplicates so re-completing is a safe no-op.
    // Using upsert (not insert) because Supabase JS returns the row on
    // conflict-skip when onConflict is supplied; plain insert with
    // ignoreDuplicates returns null on conflict and we'd need a follow-up
    // select.
    const { data: rows, error } = await this.supabaseService
      .getClient()
      .from('block_completions')
      .upsert(
        {
          user_id: userId,
          tutorial_id: tutorialId,
          block_id: blockId,
          data: data ?? null,
        },
        { onConflict: 'user_id,tutorial_id,block_id', ignoreDuplicates: false },
      )
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert block completion', error, {
        userId,
        tutorialId,
        blockId,
        correlationId,
      });
      throw error;
    }

    return rows as BlockCompletionRow;
  }

  /**
   * Record one practice rep for an exercise. Increments `completion_count`
   * (capped at 10 by the CHECK constraint on the column) and updates
   * `last_tempo_bpm` if supplied.
   *
   * Uses a Postgres-side increment so concurrent requests don't lose count.
   * Implemented via two queries (select-then-upsert) because Supabase JS
   * doesn't expose a fluent `+= 1` — for higher concurrency we'd move this
   * to a SECURITY DEFINER RPC, but practice writes are user-driven and
   * single-threaded per session, so the SELECT/UPSERT race is acceptable.
   */
  async incrementPracticeCompletion(
    userId: string,
    tutorialId: string,
    exerciseId: string,
    tempoBpm?: number,
  ): Promise<PracticeProgressRow> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Read current count (null = no row yet, treat as 0).
    const { data: existing, error: readErr } = await this.supabaseService
      .getClient()
      .from('practice_progress')
      .select('completion_count, last_tempo_bpm')
      .eq('user_id', userId)
      .eq('tutorial_id', tutorialId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (readErr) {
      logger.error('Failed to read practice progress', readErr, {
        userId,
        tutorialId,
        exerciseId,
        correlationId,
      });
      throw readErr;
    }

    const currentCount = existing?.completion_count ?? 0;
    // CHECK (completion_count BETWEEN 0 AND 10) — clamp to satisfy.
    const nextCount = Math.min(currentCount + 1, 10);
    const nextTempo = tempoBpm ?? existing?.last_tempo_bpm ?? null;

    const { data: row, error: writeErr } = await this.supabaseService
      .getClient()
      .from('practice_progress')
      .upsert(
        {
          user_id: userId,
          tutorial_id: tutorialId,
          exercise_id: exerciseId,
          completion_count: nextCount,
          last_tempo_bpm: nextTempo,
        },
        { onConflict: 'user_id,tutorial_id,exercise_id' },
      )
      .select()
      .single();

    if (writeErr) {
      logger.error('Failed to increment practice progress', writeErr, {
        userId,
        tutorialId,
        exerciseId,
        correlationId,
      });
      throw writeErr;
    }

    return row as PracticeProgressRow;
  }
}
