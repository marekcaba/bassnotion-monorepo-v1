import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** The streak-relevant slice of a profiles row. */
export interface StreakRow {
  practice_streak_days: number;
  last_practiced_on: string | null; // YYYY-MM-DD or null
  // Phase 4: streak protection.
  practice_streak_ceiling: number;
  /** Loose policy blob. v1 shape: { tokens, lastCeilingOn }. */
  streak_freeze_state: Record<string, unknown> | null;
}

/** The fields a streak write persists (Phase 4). */
export interface StreakWrite {
  streakDays: number;
  lastPracticedOn: string;
  ceiling: number;
  freezeState: Record<string, unknown>;
}

/**
 * Reads/writes the streak columns on `profiles` (practice_streak_days +
 * last_practiced_on). Uses the service-role client (RLS-bypassing) because the
 * streak write is a server-side side-effect of completing a drill session, not
 * a user-initiated profile edit.
 */
@Injectable()
export class PracticeStreakRepository {
  private readonly staticLogger = createStructuredLogger(
    PracticeStreakRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /** Read the user's current streak count + last-practiced date. */
  async getStreak(userId: string): Promise<StreakRow> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select(
        'practice_streak_days, last_practiced_on, practice_streak_ceiling, streak_freeze_state',
      )
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to read practice streak', error, {
        userId,
        correlationId,
      });
      throw error;
    }

    return {
      practice_streak_days: data?.practice_streak_days ?? 0,
      last_practiced_on: data?.last_practiced_on ?? null,
      practice_streak_ceiling: data?.practice_streak_ceiling ?? 0,
      streak_freeze_state:
        (data?.streak_freeze_state as Record<string, unknown> | null) ?? null,
    };
  }

  /** Persist the full streak state (floor + ceiling + freeze) for the user. */
  async setStreak(userId: string, w: StreakWrite): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({
        practice_streak_days: w.streakDays,
        last_practiced_on: w.lastPracticedOn,
        practice_streak_ceiling: w.ceiling,
        streak_freeze_state: w.freezeState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to write practice streak', error, {
        userId,
        ...w,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Record a streak milestone (7/30/100/365) best-effort. Idempotent via the
   * UNIQUE(user_id, milestone_type) on user_milestones — re-reaching the same
   * milestone is a no-op. Never throws into the caller's flow.
   */
  async recordMilestone(userId: string, milestone: number): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('user_milestones')
      .upsert(
        {
          user_id: userId,
          milestone_type: `streak_${milestone}`,
          data: { streak: milestone },
        },
        { onConflict: 'user_id,milestone_type', ignoreDuplicates: true },
      );

    if (error) {
      logger.error('Failed to record milestone', error, {
        userId,
        milestone,
        correlationId,
      });
      // best-effort — swallow.
    }
  }

  /**
   * Append a practice day to the durable log (practice_days). Idempotent per
   * calendar day via the (user_id, practiced_on) PK — re-practising the same
   * day is a no-op. This is the journal streak history is derived from.
   */
  async recordPracticeDay(userId: string, practicedOn: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('practice_days')
      .upsert(
        { user_id: userId, practiced_on: practicedOn },
        { onConflict: 'user_id,practiced_on', ignoreDuplicates: true },
      );

    if (error) {
      logger.error('Failed to record practice day', error, {
        userId,
        practicedOn,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Count the distinct calendar days the user practised on/after `sinceDate`
   * (inclusive, YYYY-MM-DD). The first-ever READ on practice_days — powers the
   * "showed up X of N days" number, the missed-day check-in, and the week-3 dip.
   * Uses a head COUNT (no rows transferred); the (user_id, practiced_on DESC)
   * index serves it.
   */
  async countPracticeDaysSince(
    userId: string,
    sinceDate: string,
  ): Promise<number> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { count, error } = await this.supabaseService
      .getClient()
      .from('practice_days')
      .select('practiced_on', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('practiced_on', sinceDate);

    if (error) {
      logger.error('Failed to count practice days', error, {
        userId,
        sinceDate,
        correlationId,
      });
      throw error;
    }
    return count ?? 0;
  }

  /**
   * The distinct calendar days the user practised on/after `sinceDate`
   * (YYYY-MM-DD, ascending). Powers the month-in-review practice PATTERN (the
   * 30-day calendar + "strongest weekday"); distinct from the head-count above.
   */
  async listPracticeDaysSince(
    userId: string,
    sinceDate: string,
  ): Promise<string[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('practice_days')
      .select('practiced_on')
      .eq('user_id', userId)
      .gte('practiced_on', sinceDate)
      .order('practiced_on', { ascending: true });

    if (error) {
      logger.error('Failed to list practice days', error, {
        userId,
        sinceDate,
        correlationId,
      });
      throw error;
    }
    return (data ?? []).map((r) => (r as { practiced_on: string }).practiced_on);
  }
}
