import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PracticeService,
  dayDiff,
  nextStreak,
  effectiveStreak,
} from '../practice.service.js';
import type { PracticeStreakRepository } from '../repositories/practice-streak.repository.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';

const USER_ID = 'user-1';

function makeService(repo: Partial<PracticeStreakRepository>) {
  const requestContext = {
    getLogger: () => undefined,
    getCorrelationId: () => 'test',
  } as unknown as RequestContextService;
  // Default recordPracticeDay to a resolved no-op so tests that don't care
  // about the practice log don't have to stub it; override per-test to assert.
  const withDefaults = {
    recordPracticeDay: vi.fn().mockResolvedValue(undefined),
    ...repo,
  };
  return new PracticeService(
    withDefaults as PracticeStreakRepository,
    requestContext,
  );
}

// ── Pure streak math ────────────────────────────────────────────────────────

describe('dayDiff', () => {
  it('counts whole days between UTC dates', () => {
    expect(dayDiff('2026-06-01', '2026-06-01')).toBe(0);
    expect(dayDiff('2026-06-01', '2026-06-02')).toBe(1);
    expect(dayDiff('2026-06-01', '2026-06-05')).toBe(4);
    expect(dayDiff('2026-06-05', '2026-06-01')).toBe(-4);
  });

  it('handles month boundaries', () => {
    expect(dayDiff('2026-05-31', '2026-06-01')).toBe(1);
  });
});

describe('nextStreak', () => {
  it('starts at 1 on first ever practice', () => {
    expect(nextStreak(0, null, '2026-06-03')).toBe(1);
  });
  it('increments on a consecutive day', () => {
    expect(nextStreak(3, '2026-06-02', '2026-06-03')).toBe(4);
  });
  it('resets to 1 after a gap of 2+ days', () => {
    expect(nextStreak(5, '2026-06-01', '2026-06-03')).toBe(1);
  });
});

describe('effectiveStreak', () => {
  it('is 0 when never practiced', () => {
    expect(effectiveStreak(0, null, '2026-06-03')).toBe(0);
  });
  it('keeps the count when last practice was today', () => {
    expect(effectiveStreak(4, '2026-06-03', '2026-06-03')).toBe(4);
  });
  it('keeps the count when last practice was yesterday', () => {
    expect(effectiveStreak(4, '2026-06-02', '2026-06-03')).toBe(4);
  });
  it('lapses to 0 when a day was missed', () => {
    expect(effectiveStreak(4, '2026-06-01', '2026-06-03')).toBe(0);
  });
});

// ── Service behavior (mocked repo) ──────────────────────────────────────────

describe('PracticeService.recordSessionCompleted', () => {
  let setStreak: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setStreak = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a streak at 1 on first practice', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 0,
        last_practiced_on: null,
      }),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res).toEqual({
      current: 1,
      lastPracticedOn: '2026-06-03',
      isActiveToday: true,
    });
    expect(setStreak).toHaveBeenCalledWith(USER_ID, 1, '2026-06-03');
  });

  it('is idempotent within the same day (no write)', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 4,
        last_practiced_on: '2026-06-03',
      }),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(4);
    expect(setStreak).not.toHaveBeenCalled();
  });

  it('logs a practice day even on the same-day no-op path', async () => {
    const recordPracticeDay = vi.fn().mockResolvedValue(undefined);
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 4,
        last_practiced_on: '2026-06-03',
      }),
      setStreak,
      recordPracticeDay,
    });
    await svc.recordSessionCompleted(USER_ID);
    expect(recordPracticeDay).toHaveBeenCalledWith(USER_ID, '2026-06-03');
  });

  it('logs a practice day when the streak increments', async () => {
    const recordPracticeDay = vi.fn().mockResolvedValue(undefined);
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 4,
        last_practiced_on: '2026-06-02',
      }),
      setStreak,
      recordPracticeDay,
    });
    await svc.recordSessionCompleted(USER_ID);
    expect(recordPracticeDay).toHaveBeenCalledWith(USER_ID, '2026-06-03');
  });

  it('increments on a consecutive day', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 4,
        last_practiced_on: '2026-06-02',
      }),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(5);
    expect(setStreak).toHaveBeenCalledWith(USER_ID, 5, '2026-06-03');
  });

  it('resets to 1 after a missed day', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 9,
        last_practiced_on: '2026-06-01',
      }),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(1);
    expect(setStreak).toHaveBeenCalledWith(USER_ID, 1, '2026-06-03');
  });

  it('never throws — returns a safe value if the repo fails', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockRejectedValue(new Error('db down')),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res).toEqual({
      current: 0,
      lastPracticedOn: null,
      isActiveToday: false,
    });
  });
});

describe('PracticeService.getStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the live count + isActiveToday when practiced today', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 7,
        last_practiced_on: '2026-06-03',
      }),
    });
    expect(await svc.getStreak(USER_ID)).toEqual({
      current: 7,
      lastPracticedOn: '2026-06-03',
      isActiveToday: true,
    });
  });

  it('reports a lapsed streak as 0 without writing', async () => {
    const setStreak = vi.fn();
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue({
        practice_streak_days: 7,
        last_practiced_on: '2026-05-30',
      }),
      setStreak,
    });
    const res = await svc.getStreak(USER_ID);
    expect(res.current).toBe(0);
    expect(res.isActiveToday).toBe(false);
    expect(setStreak).not.toHaveBeenCalled();
  });
});
