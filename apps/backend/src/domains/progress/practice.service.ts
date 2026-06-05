import { Injectable } from '@nestjs/common';
import {
  createStructuredLogger,
  type GetPracticeStreakResponse,
} from '@bassnotion/contracts';
import { PracticeStreakRepository } from './repositories/practice-streak.repository.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

/**
 * PracticeService — Practice Bridge streak logic.
 *
 * A "streak day" = the user completed a drill session (reached the summary) on
 * that calendar day. This is a Practice Bridge concern (sessions/streaks), kept
 * behind a service so it can extract to a standalone platform later without
 * callers changing (see CLAUDE.md product boundary).
 *
 * Streak rules (idempotent per day):
 *   - first ever practice            → streak = 1
 *   - practiced again the SAME day   → no change (idempotent)
 *   - practiced the NEXT day         → streak + 1
 *   - gap of ≥ 2 days                → streak resets to 1
 *
 * Dates are handled as UTC YYYY-MM-DD strings to avoid timezone drift between
 * the server clock and the stored `last_practiced_on` date column.
 */
@Injectable()
export class PracticeService {
  private readonly logger = createStructuredLogger(PracticeService.name);

  constructor(
    private readonly streakRepo: PracticeStreakRepository,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Today's date as a UTC YYYY-MM-DD string. */
  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Read the user's streak without mutating it. `current` lapses to 0 if the
   * last practice was before yesterday (the stored count is stale once a day
   * is missed; we don't write on read, just report the effective value).
   */
  async getStreak(userId: string): Promise<GetPracticeStreakResponse> {
    const row = await this.streakRepo.getStreak(userId);
    const today = this.todayUtc();
    const effective = effectiveStreak(
      row.practice_streak_days,
      row.last_practiced_on,
      today,
    );
    return {
      current: effective,
      lastPracticedOn: row.last_practiced_on,
      isActiveToday: row.last_practiced_on === today,
    };
  }

  /**
   * Record that the user practiced today (completed a drill session) and return
   * the updated streak. Idempotent within a calendar day — completing a second
   * session today doesn't change the count. Best-effort: never throws back into
   * the caller's flow (a streak write must not break finishing a drill); on
   * error it logs and returns a safe value.
   */
  async recordSessionCompleted(
    userId: string,
  ): Promise<GetPracticeStreakResponse> {
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      const row = await this.streakRepo.getStreak(userId);
      const today = this.todayUtc();

      // Append to the durable practice log (idempotent per day) regardless of
      // whether the counter changes — the day was practiced either way. This is
      // the journal streak history / calendars are derived from.
      await this.streakRepo.recordPracticeDay(userId, today);

      if (row.last_practiced_on === today) {
        // Already counted today — counter no-op, report current.
        return {
          current: row.practice_streak_days,
          lastPracticedOn: today,
          isActiveToday: true,
        };
      }

      const next = nextStreak(
        row.practice_streak_days,
        row.last_practiced_on,
        today,
      );
      await this.streakRepo.setStreak(userId, next, today);

      this.logger.info('Practice streak updated', {
        userId,
        previous: row.practice_streak_days,
        next,
        correlationId,
      });

      return { current: next, lastPracticedOn: today, isActiveToday: true };
    } catch (error) {
      this.logger.error('Failed to record session completion', error as Error, {
        userId,
        correlationId,
      });
      // Don't break the drill flow on a streak write failure.
      return { current: 0, lastPracticedOn: null, isActiveToday: false };
    }
  }
}

// ── Pure streak math (exported for unit tests) ──────────────────────────────

/** Difference in whole days between two UTC YYYY-MM-DD strings (b - a). */
export function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * The streak count AFTER recording a practice on `today`, given the stored
 * count + last-practiced date. Assumes today != lastPracticedOn (same-day is
 * handled by the caller as a no-op).
 */
export function nextStreak(
  storedDays: number,
  lastPracticedOn: string | null,
  today: string,
): number {
  if (!lastPracticedOn) return 1; // first practice ever
  const gap = dayDiff(lastPracticedOn, today);
  if (gap === 1) return storedDays + 1; // consecutive day
  return 1; // gap ≥ 2 (or any anomaly) → restart
}

/**
 * The streak count to REPORT on read (no write). Returns the stored count if
 * the last practice was today or yesterday; otherwise the streak has lapsed and
 * the effective current value is 0.
 */
export function effectiveStreak(
  storedDays: number,
  lastPracticedOn: string | null,
  today: string,
): number {
  if (!lastPracticedOn) return 0;
  const gap = dayDiff(lastPracticedOn, today);
  if (gap <= 1) return storedDays; // today or yesterday → still alive
  return 0; // missed a day → lapsed
}
