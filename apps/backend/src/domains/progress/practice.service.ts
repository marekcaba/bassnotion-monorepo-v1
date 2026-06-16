import { Injectable } from '@nestjs/common';
import {
  createStructuredLogger,
  type GetPracticeStreakResponse,
} from '@bassnotion/contracts';
import { PracticeStreakRepository } from './repositories/practice-streak.repository.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

// The pure streak helpers below are defined at the bottom of this file and used
// by the service methods above. (advanceStreakWithFreeze, nextCeiling,
// milestoneCrossed, parseFreezeState — all exported for unit tests.)

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
    const freeze = parseFreezeState(row.streak_freeze_state);
    const lastCeilingOn =
      (row.streak_freeze_state as { lastCeilingOn?: string } | null)
        ?.lastCeilingOn ?? null;
    // Ceiling lapses the same way the floor does on read (no write).
    const effectiveCeiling = effectiveStreak(
      row.practice_streak_ceiling,
      lastCeilingOn,
      today,
    );
    return {
      current: effective,
      lastPracticedOn: row.last_practiced_on,
      isActiveToday: row.last_practiced_on === today,
      ceiling: effectiveCeiling,
      freezeTokens: freeze.tokens,
      freezeUsed: false,
      milestoneReached: null,
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
    /** True if the user completed a FULL focused rep (all ladder bricks) — this
     *  advances the ceiling. A floor-only session (showed up, short) = false. */
    ceiling = false,
  ): Promise<GetPracticeStreakResponse> {
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      const row = await this.streakRepo.getStreak(userId);
      const today = this.todayUtc();
      const freeze = parseFreezeState(row.streak_freeze_state);
      const lastCeilingOn =
        (row.streak_freeze_state as { lastCeilingOn?: string } | null)
          ?.lastCeilingOn ?? null;

      // Durable practice log (idempotent per day) — the day was practiced.
      await this.streakRepo.recordPracticeDay(userId, today);

      // Already practiced today: floor is a no-op, but a ceiling rep can still
      // "upgrade" today from floor-only to ceiling.
      if (row.last_practiced_on === today) {
        let ceilingCount = row.practice_streak_ceiling;
        let freezeState: Record<string, unknown> = {
          tokens: freeze.tokens,
          lastCeilingOn,
        };
        if (ceiling && lastCeilingOn !== today) {
          ceilingCount = nextCeiling(
            row.practice_streak_ceiling,
            lastCeilingOn,
            today,
          );
          freezeState = { tokens: freeze.tokens, lastCeilingOn: today };
          await this.streakRepo.setStreak(userId, {
            streakDays: row.practice_streak_days,
            lastPracticedOn: today,
            ceiling: ceilingCount,
            freezeState,
          });
        }
        return {
          current: row.practice_streak_days,
          lastPracticedOn: today,
          isActiveToday: true,
          ceiling: ceilingCount,
          freezeTokens: freeze.tokens,
          freezeUsed: false,
          milestoneReached: null,
        };
      }

      // New calendar day: advance the floor with freeze protection.
      const advance = advanceStreakWithFreeze(
        row.practice_streak_days,
        row.last_practiced_on,
        today,
        freeze,
      );
      const milestone = milestoneCrossed(
        row.practice_streak_days,
        advance.streak,
      );
      const ceilingCount = ceiling
        ? nextCeiling(row.practice_streak_ceiling, lastCeilingOn, today)
        : row.practice_streak_ceiling;

      await this.streakRepo.setStreak(userId, {
        streakDays: advance.streak,
        lastPracticedOn: today,
        ceiling: ceilingCount,
        freezeState: {
          tokens: advance.tokens,
          lastCeilingOn: ceiling ? today : lastCeilingOn,
        },
      });

      if (milestone) {
        await this.streakRepo.recordMilestone(userId, milestone);
      }

      this.logger.info('Practice streak updated', {
        userId,
        previous: row.practice_streak_days,
        next: advance.streak,
        ceiling: ceilingCount,
        freezeUsed: advance.freezeUsed,
        milestone,
        correlationId,
      });

      return {
        current: advance.streak,
        lastPracticedOn: today,
        isActiveToday: true,
        ceiling: ceilingCount,
        freezeTokens: advance.tokens,
        freezeUsed: advance.freezeUsed,
        milestoneReached: milestone,
      };
    } catch (error) {
      this.logger.error('Failed to record session completion', error as Error, {
        userId,
        correlationId,
      });
      // Don't break the drill flow on a streak write failure.
      return {
        current: 0,
        lastPracticedOn: null,
        isActiveToday: false,
        ceiling: 0,
        freezeTokens: 0,
        freezeUsed: false,
        milestoneReached: null,
      };
    }
  }

  /**
   * How many distinct calendar days the user practised in the last `windowDays`
   * (inclusive of today). The shared-service read the training engine's
   * StudentState assembler uses for the "showed up X of N days" signal — the
   * engine never touches `practice_days` directly (product boundary). Returns 0
   * on any read failure rather than throwing (a coaching signal must not break
   * planning the rep).
   */
  async countPracticeDaysInWindow(
    userId: string,
    windowDays: number,
  ): Promise<number> {
    const since = subtractUtcDays(this.todayUtc(), Math.max(0, windowDays - 1));
    try {
      return await this.streakRepo.countPracticeDaysSince(userId, since);
    } catch (error) {
      this.logger.error('Failed to count practice days in window', error as Error, {
        userId,
        windowDays,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      return 0;
    }
  }

  /**
   * The calendar days the user practised in the last `windowDays` (YYYY-MM-DD,
   * ascending). The shared read the month-in-review recap uses for the practice
   * PATTERN (30-day calendar + strongest weekday). Returns [] on failure (a
   * recap stat must not break graduation).
   */
  async listPracticeDaysInWindow(
    userId: string,
    windowDays: number,
  ): Promise<string[]> {
    const since = subtractUtcDays(this.todayUtc(), Math.max(0, windowDays - 1));
    try {
      return await this.streakRepo.listPracticeDaysSince(userId, since);
    } catch (error) {
      this.logger.error('Failed to list practice days in window', error as Error, {
        userId,
        windowDays,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      return [];
    }
  }
}

// ── Pure streak math (exported for unit tests) ──────────────────────────────

/** Difference in whole days between two UTC YYYY-MM-DD strings (b - a). */
export function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** `n` whole days before a UTC YYYY-MM-DD date, as YYYY-MM-DD. */
export function subtractUtcDays(date: string, n: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) - n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
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

// ── Streak protection (Phase 4, spec §8) ────────────────────────────────────

/** Freeze-token policy (founder decision, §15 Q4): Duolingo-style. */
export const FREEZE_MAX_TOKENS = 2;
export const FREEZE_EARN_EVERY_DAYS = 5;
/** Streak milestones worth celebrating (spec §8). */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

export interface FreezeState {
  /** Banked freeze tokens (0..FREEZE_MAX_TOKENS). */
  tokens: number;
}

/** Parse the loose `streak_freeze_state` JSONB into a safe FreezeState. */
export function parseFreezeState(raw: unknown): FreezeState {
  const tokens = (raw as { tokens?: unknown } | null)?.tokens;
  const n = typeof tokens === 'number' && Number.isFinite(tokens) ? tokens : 0;
  return { tokens: Math.max(0, Math.min(FREEZE_MAX_TOKENS, Math.floor(n))) };
}

export interface StreakAdvance {
  /** New floor streak count after applying freezes for any missed days. */
  streak: number;
  /** Freeze tokens remaining after consuming any to bridge the gap. */
  tokens: number;
  /** True if at least one token was consumed to save the streak. */
  freezeUsed: boolean;
}

/**
 * Advance the FLOOR streak with freeze protection. A gap of N days means N−1
 * days were missed; each missed day consumes one freeze token to keep the
 * streak alive. If there aren't enough tokens to cover the gap, the streak
 * resets to 1. Then award tokens earned by the new streak length (1 per
 * FREEZE_EARN_EVERY_DAYS, capped at FREEZE_MAX_TOKENS). Pure.
 */
export function advanceStreakWithFreeze(
  storedDays: number,
  lastPracticedOn: string | null,
  today: string,
  freeze: FreezeState,
): StreakAdvance {
  if (!lastPracticedOn) {
    return {
      streak: 1,
      tokens: awardTokens(0, 1, freeze.tokens),
      freezeUsed: false,
    };
  }
  const gap = dayDiff(lastPracticedOn, today);
  if (gap <= 0) {
    // Anomaly (clock skew / same-day handled by caller) — treat as continue.
    return { streak: storedDays, tokens: freeze.tokens, freezeUsed: false };
  }
  if (gap === 1) {
    const streak = storedDays + 1;
    return {
      streak,
      tokens: awardTokens(storedDays, streak, freeze.tokens),
      freezeUsed: false,
    };
  }
  // gap ≥ 2 → (gap − 1) missed days. Try to bridge with tokens.
  const missed = gap - 1;
  if (freeze.tokens >= missed) {
    const streak = storedDays + 1; // streak survives + today's rep
    // Consume tokens to bridge — and DO NOT re-earn this turn. A bridged day
    // was bought with a token, not earned by consecutive practice, so it must
    // not award a token (otherwise a miss timed onto a 5-day boundary, e.g.
    // 4→5 or 9→10, would refund the very token it consumed — making freezes
    // free and exploitable). Tokens are earned ONLY on the gap===1 path above.
    return {
      streak,
      tokens: freeze.tokens - missed,
      freezeUsed: true,
    };
  }
  // Not enough tokens → streak lapses, restart at 1 (no token earned on a reset).
  return { streak: 1, tokens: 0, freezeUsed: false };
}

/**
 * Banked tokens after this rep: earn ONE token each time the streak CROSSES a
 * multiple of FREEZE_EARN_EVERY_DAYS (4→5, 9→10, …), added to the current
 * balance and capped. Crucially earning is per-crossing, NOT "top up to
 * floor(streak/5)" — otherwise a consumed token would be silently refunded the
 * same day, making freezes free.
 */
function awardTokens(
  prevStreak: number,
  newStreak: number,
  currentTokens: number,
): number {
  const crossings =
    Math.floor(newStreak / FREEZE_EARN_EVERY_DAYS) -
    Math.floor(prevStreak / FREEZE_EARN_EVERY_DAYS);
  const earned = Math.max(0, crossings);
  return Math.max(0, Math.min(FREEZE_MAX_TOKENS, currentTokens + earned));
}

/**
 * The CEILING streak after a full focused rep: same consecutive-day logic as the
 * floor, but the "last day" is the last CEILING day (not the floor day). A
 * floor-only day doesn't advance the ceiling — it just leaves it where it was,
 * and a gap ≥ 2 ceiling-days lapses it (no freeze on the ceiling: it measures
 * sustained quality, not mere showing-up).
 */
export function nextCeiling(
  storedCeiling: number,
  lastCeilingOn: string | null,
  today: string,
): number {
  if (!lastCeilingOn) return 1;
  const gap = dayDiff(lastCeilingOn, today);
  if (gap === 1) return storedCeiling + 1;
  if (gap <= 0) return storedCeiling; // same-day handled by caller
  return 1; // missed a ceiling day → restart
}

/**
 * The milestone newly reached when the streak goes prev → next (e.g. 6→7 hits
 * the 7 milestone), or null. Uses the floor streak — that's the "did you keep
 * the habit" number celebrations hang off.
 */
export function milestoneCrossed(prev: number, next: number): number | null {
  for (const m of STREAK_MILESTONES) {
    if (prev < m && next >= m) return m;
  }
  return null;
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
