/**
 * advanceClimb — behavior tests (Bass Gym Training Engine, Treadmill epic Story 2).
 *
 * Verifies the pure "treadmill" brain against the v1 SPEED rule:
 *   - a win raises the tempo one notch, capped at the goal target
 *   - a win recovers difficultyScalar toward 1.0
 *   - a too_hard run eases difficultyScalar + bumps backoffCount, no advance
 *   - holds (no win, no back-off) change nothing
 *   - clamps: never past target, never below the scalar floor
 *   - the type dial: SPEED implemented; others throw loudly
 *
 * Pure-function tests: no mocks, no clock, no I/O.
 */

import { describe, it, expect } from 'vitest';

import {
  advanceClimb,
  ADVANCE_NOTCH_BPM,
  DIFFICULTY_SCALAR_MIN,
} from '../advanceClimb';
import type {
  ClimbState,
  StudentSignals,
  StudentState,
} from '../../types/training';

function makeClimb(overrides: Partial<ClimbState> = {}): ClimbState {
  return {
    id: 'climb-1',
    goalEnrollmentId: 'enroll-1',
    userId: 'user-1',
    currentPosition: { tempoBpm: 100 },
    spacedReviewQueue: [],
    difficultyScalar: 1.0,
    backoffCount: 0,
    lastRepDate: null,
    recommendations: {},
    createdAt: '2026-06-15T00:00:00.000Z',
    updatedAt: '2026-06-15T00:00:00.000Z',
    ...overrides,
  };
}

function makeSignals(overrides: Partial<StudentSignals> = {}): StudentSignals {
  return {
    consecutiveWins: 0,
    recentTooHardCount: 0,
    lastNOutcomes: [],
    daysSinceLastConquered: null,
    plateauRepCount: 0,
    ...overrides,
  };
}

function makeStudent(opts: {
  climb?: Partial<ClimbState>;
  signals?: Partial<StudentSignals>;
  targetBpm?: number | null;
}): StudentState {
  const target =
    opts.targetBpm === undefined
      ? { tempoBpm: 180 }
      : opts.targetBpm === null
        ? {}
        : { tempoBpm: opts.targetBpm };
  return {
    assembledAt: '2026-06-16T00:00:00.000Z',
    goal: {
      enrollmentId: 'enroll-1',
      type: 'speed',
      target,
      status: 'active',
      startTempoBpm: 80,
      daysSinceStart: 5,
      graduationDaysRemaining: 25,
    },
    climb: makeClimb(opts.climb),
    repHistory: [],
    lastRep: null,
    daysSinceLastRep: null,
    derived: makeSignals(opts.signals),
    lifetimeMastery: {},
    attendance: {
      streakDays: 0,
      ceiling: 0,
      isActiveToday: false,
      lastPracticedOn: null,
      freezeTokens: 0,
      daysPracticedInWindow: 0,
      windowDays: 30,
    },
  };
}

const SPEED = { goalType: 'speed' as const };

describe('advanceClimb (SPEED)', () => {
  it('raises the tempo one notch on a win', () => {
    const s = makeStudent({
      climb: { currentPosition: { tempoBpm: 100 } },
      signals: { consecutiveWins: 1 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(true);
    expect(d.currentPosition?.tempoBpm).toBe(100 + ADVANCE_NOTCH_BPM);
  });

  it('caps the advance at the goal target', () => {
    const s = makeStudent({
      climb: { currentPosition: { tempoBpm: 118 } },
      signals: { consecutiveWins: 3 },
      targetBpm: 120,
    });
    const d = advanceClimb(s, SPEED);
    expect(d.currentPosition?.tempoBpm).toBe(120); // 118 + 8 = 126 → capped at 120
  });

  it('does not move when already at target (scalar already 1.0)', () => {
    const s = makeStudent({
      climb: { currentPosition: { tempoBpm: 120 }, difficultyScalar: 1.0 },
      signals: { consecutiveWins: 2 },
      targetBpm: 120,
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(false);
  });

  it('recovers difficultyScalar toward 1.0 on a win after a prior back-off', () => {
    const s = makeStudent({
      climb: { currentPosition: { tempoBpm: 100 }, difficultyScalar: 0.5 },
      signals: { consecutiveWins: 1 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(true);
    expect(d.difficultyScalar).toBeGreaterThan(0.5);
    expect(d.difficultyScalar).toBeLessThanOrEqual(1);
  });

  it('eases difficultyScalar + bumps backoffCount on a too_hard run, without advancing', () => {
    const s = makeStudent({
      climb: {
        currentPosition: { tempoBpm: 100 },
        difficultyScalar: 1.0,
        backoffCount: 0,
      },
      signals: { recentTooHardCount: 2, consecutiveWins: 0 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(true);
    expect(d.difficultyScalar).toBeLessThan(1);
    expect(d.backoffCount).toBe(1);
    expect(d.currentPosition).toBeUndefined(); // no tempo advance on back-off
  });

  it('never eases below the scalar floor', () => {
    const s = makeStudent({
      climb: { difficultyScalar: DIFFICULTY_SCALAR_MIN },
      signals: { recentTooHardCount: 3 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(false); // already at floor → nothing to write
  });

  it('holds (no change) when the player neither won nor struggled', () => {
    const s = makeStudent({
      climb: { currentPosition: { tempoBpm: 100 }, difficultyScalar: 1.0 },
      signals: { consecutiveWins: 0, recentTooHardCount: 0 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.changed).toBe(false);
  });

  it('back-off takes priority over a stray win signal', () => {
    const s = makeStudent({
      climb: { difficultyScalar: 1.0 },
      signals: { recentTooHardCount: 2, consecutiveWins: 1 },
    });
    const d = advanceClimb(s, SPEED);
    expect(d.difficultyScalar).toBeLessThan(1);
    expect(d.currentPosition).toBeUndefined();
  });
});

describe('advanceClimb type dial', () => {
  it.each(['knowledge', 'vocabulary', 'feel'] as const)(
    'throws for unimplemented goal type "%s"',
    (goalType) => {
      const s = makeStudent({ signals: { consecutiveWins: 1 } });
      expect(() => advanceClimb(s, { goalType })).toThrow(/not implemented yet/);
    },
  );
});
