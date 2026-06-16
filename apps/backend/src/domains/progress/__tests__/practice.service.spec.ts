import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PracticeService,
  dayDiff,
  nextStreak,
  effectiveStreak,
  advanceStreakWithFreeze,
  nextCeiling,
  milestoneCrossed,
  parseFreezeState,
} from '../practice.service.js';
import type {
  PracticeStreakRepository,
  StreakRow,
} from '../repositories/practice-streak.repository.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';

const USER_ID = 'user-1';

/** Build a StreakRow with Phase-4 fields defaulted (override per test). */
function row(over: Partial<StreakRow> = {}): StreakRow {
  return {
    practice_streak_days: 0,
    last_practiced_on: null,
    practice_streak_ceiling: 0,
    streak_freeze_state: null,
    ...over,
  };
}

function makeService(repo: Partial<PracticeStreakRepository>) {
  const requestContext = {
    getLogger: () => undefined,
    getCorrelationId: () => 'test',
  } as unknown as RequestContextService;
  // Default recordPracticeDay + recordMilestone to resolved no-ops so tests that
  // don't care don't have to stub them; override per-test to assert.
  const withDefaults = {
    recordPracticeDay: vi.fn().mockResolvedValue(undefined),
    recordMilestone: vi.fn().mockResolvedValue(undefined),
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
      getStreak: vi.fn().mockResolvedValue(row()),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(1);
    expect(res.lastPracticedOn).toBe('2026-06-03');
    expect(res.isActiveToday).toBe(true);
    expect(setStreak).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ streakDays: 1, lastPracticedOn: '2026-06-03' }),
    );
  });

  it('is idempotent within the same day (no floor write without a ceiling)', async () => {
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 4, last_practiced_on: '2026-06-03' }),
        ),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(4);
    expect(setStreak).not.toHaveBeenCalled();
  });

  it('logs a practice day even on the same-day no-op path', async () => {
    const recordPracticeDay = vi.fn().mockResolvedValue(undefined);
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 4, last_practiced_on: '2026-06-03' }),
        ),
      setStreak,
      recordPracticeDay,
    });
    await svc.recordSessionCompleted(USER_ID);
    expect(recordPracticeDay).toHaveBeenCalledWith(USER_ID, '2026-06-03');
  });

  it('increments on a consecutive day', async () => {
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 4, last_practiced_on: '2026-06-02' }),
        ),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(5);
    expect(setStreak).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ streakDays: 5 }),
    );
  });

  it('resets to 1 after a missed day with no freeze tokens', async () => {
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 9, last_practiced_on: '2026-06-01' }),
        ),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(1);
    expect(res.freezeUsed).toBe(false);
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
      ceiling: 0,
      freezeTokens: 0,
      freezeUsed: false,
      milestoneReached: null,
    });
  });

  // ── Phase 4: freeze protection ─────────────────────────────────────────────

  it('a freeze token shields a single missed day (streak survives)', async () => {
    const svc = makeService({
      // last practiced 06-02, today 06-04 → 1 missed day, 1 token available.
      // Streak 3→4 doesn't cross a 5-mark, so no token is re-earned.
      getStreak: vi.fn().mockResolvedValue(
        row({
          practice_streak_days: 3,
          last_practiced_on: '2026-06-02',
          streak_freeze_state: { tokens: 1 },
        }),
      ),
      setStreak,
    });
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'));
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(4); // survived + today
    expect(res.freezeUsed).toBe(true);
    expect(res.freezeTokens).toBe(0); // consumed, none re-earned (no crossing)
  });

  it('lapses when the gap exceeds available tokens', async () => {
    const svc = makeService({
      // 06-01 → 06-05 = 3 missed days, only 1 token → not enough.
      getStreak: vi.fn().mockResolvedValue(
        row({
          practice_streak_days: 9,
          last_practiced_on: '2026-06-01',
          streak_freeze_state: { tokens: 1 },
        }),
      ),
      setStreak,
    });
    vi.setSystemTime(new Date('2026-06-05T12:00:00Z'));
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(1);
    expect(res.freezeUsed).toBe(false);
  });

  // ── Phase 4: ceiling tier ──────────────────────────────────────────────────

  it('advances the ceiling on a full focused rep (ceiling=true)', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue(
        row({
          practice_streak_days: 4,
          last_practiced_on: '2026-06-02',
          practice_streak_ceiling: 4,
          streak_freeze_state: { tokens: 0, lastCeilingOn: '2026-06-02' },
        }),
      ),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID, true);
    expect(res.current).toBe(5); // floor
    expect(res.ceiling).toBe(5); // ceiling advanced too
  });

  it('a floor-only rep does NOT advance the ceiling', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue(
        row({
          practice_streak_days: 4,
          last_practiced_on: '2026-06-02',
          practice_streak_ceiling: 4,
          streak_freeze_state: { tokens: 0, lastCeilingOn: '2026-06-02' },
        }),
      ),
      setStreak,
    });
    const res = await svc.recordSessionCompleted(USER_ID, false);
    expect(res.current).toBe(5); // floor advanced
    expect(res.ceiling).toBe(4); // ceiling unchanged
  });

  // ── Phase 4: milestones ────────────────────────────────────────────────────

  it('records + reports a milestone when crossing 7', async () => {
    const recordMilestone = vi.fn().mockResolvedValue(undefined);
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 6, last_practiced_on: '2026-06-02' }),
        ),
      setStreak,
      recordMilestone,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(7);
    expect(res.milestoneReached).toBe(7);
    expect(recordMilestone).toHaveBeenCalledWith(USER_ID, 7);
  });

  it('does not re-fire a milestone mid-range', async () => {
    const recordMilestone = vi.fn().mockResolvedValue(undefined);
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 8, last_practiced_on: '2026-06-02' }),
        ),
      setStreak,
      recordMilestone,
    });
    const res = await svc.recordSessionCompleted(USER_ID);
    expect(res.current).toBe(9);
    expect(res.milestoneReached).toBeNull();
    expect(recordMilestone).not.toHaveBeenCalled();
  });
});

// ── Phase 4 pure helpers ──────────────────────────────────────────────────────

describe('advanceStreakWithFreeze', () => {
  it('starts at 1 with no prior practice', () => {
    expect(
      advanceStreakWithFreeze(0, null, '2026-06-03', { tokens: 0 }),
    ).toMatchObject({ streak: 1, freezeUsed: false });
  });
  it('increments on a consecutive day', () => {
    expect(
      advanceStreakWithFreeze(3, '2026-06-02', '2026-06-03', { tokens: 0 }),
    ).toMatchObject({ streak: 4, freezeUsed: false });
  });
  it('consumes 1 token for 1 missed day', () => {
    expect(
      advanceStreakWithFreeze(3, '2026-06-01', '2026-06-03', { tokens: 2 }),
    ).toMatchObject({ streak: 4, tokens: 1, freezeUsed: true });
  });
  it('does NOT re-earn a token when bridging onto a 5-day boundary (anti-exploit)', () => {
    // 4→5 crosses a 5-mark, but the day was BRIDGED (bought with a token), not
    // practiced — so it must NOT refund the consumed token. Else a miss timed
    // onto every 5th day makes freezes free.
    expect(
      advanceStreakWithFreeze(4, '2026-06-02', '2026-06-04', { tokens: 1 }),
    ).toMatchObject({ streak: 5, tokens: 0, freezeUsed: true });
    // Same at 9→10.
    expect(
      advanceStreakWithFreeze(9, '2026-06-02', '2026-06-04', { tokens: 1 }),
    ).toMatchObject({ streak: 10, tokens: 0, freezeUsed: true });
  });
  it('lapses when tokens cannot cover the gap', () => {
    expect(
      advanceStreakWithFreeze(3, '2026-06-01', '2026-06-05', { tokens: 1 }),
    ).toMatchObject({ streak: 1, freezeUsed: false });
  });
  it('earns ONE token per 5-day crossing, added to balance, capped at 2', () => {
    // 4→5 crosses the 5-mark → +1 token.
    expect(
      advanceStreakWithFreeze(4, '2026-06-02', '2026-06-03', { tokens: 0 }),
    ).toMatchObject({ streak: 5, tokens: 1 });
    // 9→10 crosses again, on top of an existing token → 2 (cap).
    expect(
      advanceStreakWithFreeze(9, '2026-06-02', '2026-06-03', { tokens: 1 }),
    ).toMatchObject({ streak: 10, tokens: 2 });
    // 14→15 crosses, but already at cap → stays 2.
    expect(
      advanceStreakWithFreeze(14, '2026-06-02', '2026-06-03', { tokens: 2 }),
    ).toMatchObject({ streak: 15, tokens: 2 });
    // A non-crossing day earns nothing.
    expect(
      advanceStreakWithFreeze(5, '2026-06-02', '2026-06-03', { tokens: 1 }),
    ).toMatchObject({ streak: 6, tokens: 1 });
  });
});

describe('nextCeiling', () => {
  it('starts at 1', () => expect(nextCeiling(0, null, '2026-06-03')).toBe(1));
  it('increments on a consecutive ceiling day', () =>
    expect(nextCeiling(2, '2026-06-02', '2026-06-03')).toBe(3));
  it('resets after a missed ceiling day (no freeze on ceiling)', () =>
    expect(nextCeiling(5, '2026-06-01', '2026-06-03')).toBe(1));
});

describe('milestoneCrossed', () => {
  it('fires on the exact crossing', () => {
    expect(milestoneCrossed(6, 7)).toBe(7);
    expect(milestoneCrossed(29, 30)).toBe(30);
  });
  it('is null when no milestone is crossed', () => {
    expect(milestoneCrossed(7, 8)).toBeNull();
    expect(milestoneCrossed(0, 1)).toBeNull();
  });
});

describe('parseFreezeState', () => {
  it('defaults to 0 tokens on null/garbage', () => {
    expect(parseFreezeState(null).tokens).toBe(0);
    expect(parseFreezeState({}).tokens).toBe(0);
    expect(parseFreezeState({ tokens: 'x' }).tokens).toBe(0);
  });
  it('clamps tokens to [0, max]', () => {
    expect(parseFreezeState({ tokens: 99 }).tokens).toBe(2);
    expect(parseFreezeState({ tokens: -3 }).tokens).toBe(0);
    expect(parseFreezeState({ tokens: 1 }).tokens).toBe(1);
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

  it('reports the live floor + ceiling + tokens when practiced today', async () => {
    const svc = makeService({
      getStreak: vi.fn().mockResolvedValue(
        row({
          practice_streak_days: 7,
          last_practiced_on: '2026-06-03',
          practice_streak_ceiling: 5,
          streak_freeze_state: { tokens: 2, lastCeilingOn: '2026-06-03' },
        }),
      ),
    });
    expect(await svc.getStreak(USER_ID)).toEqual({
      current: 7,
      lastPracticedOn: '2026-06-03',
      isActiveToday: true,
      ceiling: 5,
      freezeTokens: 2,
      freezeUsed: false,
      milestoneReached: null,
    });
  });

  it('reports a lapsed streak as 0 without writing', async () => {
    const setStreak = vi.fn();
    const svc = makeService({
      getStreak: vi
        .fn()
        .mockResolvedValue(
          row({ practice_streak_days: 7, last_practiced_on: '2026-05-30' }),
        ),
      setStreak,
    });
    const res = await svc.getStreak(USER_ID);
    expect(res.current).toBe(0);
    expect(res.isActiveToday).toBe(false);
    expect(setStreak).not.toHaveBeenCalled();
  });
});
