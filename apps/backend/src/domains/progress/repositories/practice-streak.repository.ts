import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** The streak-relevant slice of a profiles row. */
export interface StreakRow {
  practice_streak_days: number;
  last_practiced_on: string | null; // YYYY-MM-DD or null
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
      .select('practice_streak_days, last_practiced_on')
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
    };
  }

  /** Persist a new streak count + last-practiced date for the user. */
  async setStreak(
    userId: string,
    streakDays: number,
    lastPracticedOn: string,
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({
        practice_streak_days: streakDays,
        last_practiced_on: lastPracticedOn,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to write practice streak', error, {
        userId,
        streakDays,
        lastPracticedOn,
        correlationId,
      });
      throw error;
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
}
