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
}
