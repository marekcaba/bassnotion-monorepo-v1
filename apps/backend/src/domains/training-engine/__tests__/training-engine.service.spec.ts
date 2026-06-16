import { describe, it, expect, vi } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import {
  TrainingEngineService,
  buildGraduationSummary,
  buildMonthInReview,
  deriveStudentSignals,
} from '../training-engine.service.js';
import type { TrainingEngineRepository } from '../repositories/training-engine.repository.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';
import type { PracticeService } from '../../progress/practice.service.js';
import type { ProgressService } from '../../progress/progress.service.js';
import type {
  GoalEnrollment,
  RepResult,
  TutorialBlock,
} from '@bassnotion/contracts';

const USER = 'user-1';
const ENROLLMENT = 'enroll-1';
const OTHER_USER = 'user-2';

function makeEnrollment(
  overrides: Partial<GoalEnrollment> = {},
): GoalEnrollment {
  return {
    id: ENROLLMENT,
    userId: USER,
    goalId: 'goal-1',
    startedAt: '2026-06-01T00:00:00.000Z',
    status: 'active',
    goalSnapshot: {
      type: 'speed',
      target: { tempoBpm: 120 },
      blockSet: [],
      assessmentConfig: {},
      day30Milestone: {},
      forkConfig: {},
    },
    placement: {},
    virtualTutorialSlug: null,
    graduatedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepResult(overrides: Partial<RepResult> = {}): RepResult {
  return {
    id: 'rep-1',
    userId: USER,
    goalEnrollmentId: ENROLLMENT,
    drillSessionId: null,
    blockId: 'block-1',
    ladderLevel: 'L2',
    tempoBpm: 120,
    signal: { kind: 'button', value: 1, at: 1 },
    result: 'conquered',
    achievedTier: 'bronze',
    completedAt: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

function makeClimbState() {
  return {
    id: 'climb-1',
    goalEnrollmentId: ENROLLMENT,
    userId: USER,
    currentPosition: { tempoBpm: 90 },
    spacedReviewQueue: [],
    difficultyScalar: 1.0,
    backoffCount: 0,
    lastRepDate: null,
    recommendations: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

/** An enrollment whose snapshot embeds a focal task block inline (the seed shape). */
function makeEnrollmentWithBlock(): GoalEnrollment {
  const enrollment = makeEnrollment();
  enrollment.goalSnapshot.blockSet = [
    {
      blockId: 'focal',
      ladderPosition: 'L2',
      // The seed embeds the full block inline under `block`.
      block: {
        id: 'focal',
        type: 'task',
        title: 'C Major Scale',
        order: 0,
        config: {
          instruction: 'Play C major at {tempo} BPM.',
          completionCriterion: { type: 'time', target: 2 },
        },
      },
    } as never,
  ];
  return enrollment;
}

function makeGoal() {
  return {
    id: 'goal-1',
    slug: 'speed-c-major-scale',
    type: 'speed' as const,
    title: 'Speed: C Major Scale',
    description: null,
    target: { tempoBpm: 120 },
    assessmentConfig: {},
    blockSet: [],
    prerequisites: [],
    day30Milestone: {},
    forkConfig: {},
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeService(repoOverrides: Partial<TrainingEngineRepository> = {}) {
  const repo = {
    findEnrollmentById: vi.fn(async () => makeEnrollmentWithBlock()),
    findClimbState: vi.fn(async () => makeClimbState()),
    insertRepResult: vi.fn(async () => makeRepResult()),
    getRepResultsForEnrollment: vi.fn(async () => [makeRepResult()]),
    upsertVirtualTutorial: vi.fn(async () => undefined),
    setEnrollmentVirtualSlug: vi.fn(async () => undefined),
    listEnrollments: vi.fn(async () => [makeEnrollment()]),
    findGoalBySlug: vi.fn(async () => makeGoal()),
    findEnrollmentByGoal: vi.fn(async () => null),
    createEnrollment: vi.fn(async () => makeEnrollment()),
    createClimbState: vi.fn(async () => makeClimbState()),
    updateEnrollment: vi.fn(
      async (_u: string, _id: string, patch: Record<string, unknown>) =>
        makeEnrollment({ ...(patch as Partial<GoalEnrollment>) }),
    ),
    updateClimbPosition: vi.fn(async () => undefined),
    patchClimbState: vi.fn(async () => undefined),
    ...repoOverrides,
  } as unknown as TrainingEngineRepository;

  const requestContext = {
    getLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    getCorrelationId: () => 'corr-1',
  } as unknown as RequestContextService;

  // Shared-service seam (Story 1): the StudentState assembler reads attendance/
  // streak/mastery through these. Safe defaults so existing tests are unaffected.
  const practiceService = {
    getStreak: vi.fn(async () => ({
      current: 3,
      lastPracticedOn: '2026-06-15',
      isActiveToday: false,
      ceiling: 1,
      freezeTokens: 2,
      freezeUsed: false,
      milestoneReached: null,
    })),
    countPracticeDaysInWindow: vi.fn(async () => 5),
  } as unknown as PracticeService;

  const progressService = {
    getLifetimeMasteryByBlock: vi.fn(async () => ({})),
  } as unknown as ProgressService;

  const service = new TrainingEngineService(
    repo,
    requestContext,
    practiceService,
    progressService,
  );
  return { service, repo, practiceService, progressService };
}

describe('TrainingEngineService.recordRepResult', () => {
  it('appends the rep when the enrollment belongs to the user', async () => {
    const { service, repo } = makeService();
    const result = await service.recordRepResult(USER, {
      goalEnrollmentId: ENROLLMENT,
      blockId: 'block-1',
      ladderLevel: 'L2',
      tempoBpm: 120,
      signal: { kind: 'button', value: 1, at: 1 },
      result: 'conquered',
      achievedTier: 'bronze',
    });

    expect(result.id).toBe('rep-1');
    expect(repo.insertRepResult).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, goalEnrollmentId: ENROLLMENT }),
    );
  });

  it('forces the userId from the authenticated caller, not the payload', async () => {
    const { service, repo } = makeService();
    await service.recordRepResult(USER, {
      goalEnrollmentId: ENROLLMENT,
      blockId: 'block-1',
      ladderLevel: 'L1',
      signal: null,
      result: 'completed',
    });
    const arg = (repo.insertRepResult as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(arg.userId).toBe(USER);
  });

  it("rejects with Forbidden when the enrollment is not the user's", async () => {
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(
      service.recordRepResult(OTHER_USER, {
        goalEnrollmentId: ENROLLMENT,
        blockId: 'block-1',
        ladderLevel: 'L2',
        signal: null,
        result: 'conquered',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.insertRepResult).not.toHaveBeenCalled();
  });
});

describe('TrainingEngineService.getRepHistory', () => {
  it('returns the enrollment history newest-first from the repo', async () => {
    const { service, repo } = makeService();
    const history = await service.getRepHistory(USER, ENROLLMENT);
    expect(history).toHaveLength(1);
    expect(repo.getRepResultsForEnrollment).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
    );
  });
});

describe('TrainingEngineService.virtualTutorialSlug', () => {
  it('is deterministic per enrollment (idempotent re-mint target)', () => {
    const { service } = makeService();
    expect(service.virtualTutorialSlug(ENROLLMENT)).toBe(
      'training-rep-enroll-1',
    );
    expect(service.virtualTutorialSlug(ENROLLMENT)).toBe(
      service.virtualTutorialSlug(ENROLLMENT),
    );
  });
});

describe('TrainingEngineService.mintVirtualTutorial', () => {
  const bricks = [
    { id: 'b1', type: 'task', title: 'L1', order: 0, config: {} },
  ] as unknown as TutorialBlock[];

  it('upserts the tutorial row and stamps the slug onto the enrollment', async () => {
    const { service, repo } = makeService();
    const slug = await service.mintVirtualTutorial(USER, ENROLLMENT, bricks);

    expect(slug).toBe('training-rep-enroll-1');
    expect(repo.upsertVirtualTutorial).toHaveBeenCalledWith({
      slug: 'training-rep-enroll-1',
      title: 'Daily Rep',
      blocks: bricks,
    });
    expect(repo.setEnrollmentVirtualSlug).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      'training-rep-enroll-1',
    );
  });

  it("throws NotFound when the enrollment is not the user's", async () => {
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(
      service.mintVirtualTutorial(USER, ENROLLMENT, bricks),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.upsertVirtualTutorial).not.toHaveBeenCalled();
  });
});

describe('TrainingEngineService.getTodayRep', () => {
  it('plans 3 bricks from the snapshot block_set + climb state, and mints them', async () => {
    const { service, repo } = makeService();
    const { slug, bricks } = await service.getTodayRep(USER, ENROLLMENT);

    expect(slug).toBe('training-rep-enroll-1');
    expect(bricks).toHaveLength(3); // L1/L2/L3 = a 6-min rep

    // The minted bricks are exactly what was generated.
    expect(repo.upsertVirtualTutorial).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'training-rep-enroll-1',
        blocks: bricks,
      }),
    );
    expect(repo.setEnrollmentVirtualSlug).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      'training-rep-enroll-1',
    );
  });

  it('brackets the climb-state tempo and interpolates it into the task instruction', async () => {
    // Pin lastRepDate to today so the Story-2 advance is a no-op here — this test
    // isolates the BRACKETING from the climb position (advance is covered below).
    const today = new Date().toISOString().slice(0, 10);
    const { service } = makeService({
      findClimbState: vi.fn(
        async () => ({ ...makeClimbState(), lastRepDate: today }) as never,
      ),
    });
    const { bricks } = await service.getTodayRep(USER, ENROLLMENT);
    const instr = (b: { config: unknown }) =>
      (b.config as { instruction?: string }).instruction;
    // climb tempo 90, notch 8 → L1 82 / L2 90 / L3 98 (one brick each).
    expect(instr(bricks[0])).toBe('Play C major at 82 BPM.');
    expect(instr(bricks[1])).toBe('Play C major at 90 BPM.');
    expect(instr(bricks[2])).toBe('Play C major at 98 BPM.');
  });

  it('feeds rep history into the planner (drives L1 spaced review)', async () => {
    const { service, repo } = makeService();
    await service.getTodayRep(USER, ENROLLMENT);
    expect(repo.getRepResultsForEnrollment).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
    );
  });

  it('throws NotFound when the enrollment is missing', async () => {
    const { service } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(service.getTodayRep(USER, ENROLLMENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFound when the climb state is missing', async () => {
    const { service } = makeService({
      findClimbState: vi.fn(async () => null),
    });
    await expect(service.getTodayRep(USER, ENROLLMENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('TrainingEngineService.listMyEnrollments', () => {
  it('returns the user enrollments from the repo', async () => {
    const { service, repo } = makeService();
    const list = await service.listMyEnrollments(USER);
    expect(list).toHaveLength(1);
    expect(repo.listEnrollments).toHaveBeenCalledWith(USER);
  });
});

describe('TrainingEngineService.enrollInGoal', () => {
  it('freezes a snapshot + creates enrollment AND climb_state', async () => {
    const { service, repo } = makeService({
      // Fresh enroll: no enrollment + no climb_state yet.
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    const enrollment = await service.enrollInGoal(USER, 'speed-c-major-scale');

    expect(enrollment.id).toBe(ENROLLMENT);
    // Snapshot is frozen from the goal.
    expect(repo.createEnrollment).toHaveBeenCalledWith(
      USER,
      'goal-1',
      expect.objectContaining({ type: 'speed', target: { tempoBpm: 120 } }),
      expect.objectContaining({ startTempoBpm: 120 }),
    );
    // climb_state seeded from the goal target tempo.
    expect(repo.createClimbState).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      expect.objectContaining({ tempoBpm: 120 }),
    );
  });

  it('is idempotent: returns the existing enrollment without re-creating', async () => {
    const existing = makeEnrollment();
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => existing),
      // climb_state already present → no repair write.
      findClimbState: vi.fn(async () => makeClimbState()),
    });
    const result = await service.enrollInGoal(USER, 'speed-c-major-scale');
    expect(result).toBe(existing);
    expect(repo.createEnrollment).not.toHaveBeenCalled();
    expect(repo.createClimbState).not.toHaveBeenCalled();
  });

  it('SELF-HEALS an orphaned enrollment (exists but climb_state missing)', async () => {
    const existing = makeEnrollment();
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => existing),
      findClimbState: vi.fn(async () => null), // orphan: no climb_state
    });
    const result = await service.enrollInGoal(USER, 'speed-c-major-scale');
    expect(result).toBe(existing);
    // Repaired: climb_state created for the existing enrollment.
    expect(repo.createClimbState).toHaveBeenCalledWith(
      USER,
      existing.id,
      expect.objectContaining({ tempoBpm: 120 }),
    );
    expect(repo.createEnrollment).not.toHaveBeenCalled();
  });

  it('on a fresh enroll, only creates climb_state once (not already present)', async () => {
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    await service.enrollInGoal(USER, 'speed-c-major-scale');
    expect(repo.createEnrollment).toHaveBeenCalledTimes(1);
    expect(repo.createClimbState).toHaveBeenCalledTimes(1);
  });

  it('throws NotFound for an unknown goal slug', async () => {
    const { service } = makeService({
      findGoalBySlug: vi.fn(async () => null),
    });
    await expect(
      service.enrollInGoal(USER, 'does-not-exist'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('falls back to tempo 60 when the goal has no target tempo', async () => {
    const goalNoTempo = { ...makeGoal(), target: {} };
    const { service, repo } = makeService({
      findGoalBySlug: vi.fn(async () => goalNoTempo),
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    await service.enrollInGoal(USER, 'speed-c-major-scale');
    expect(repo.createClimbState).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      expect.objectContaining({ tempoBpm: 60 }),
    );
  });

  // ── Phase 5b: placement ──────────────────────────────────────────────────

  it('seeds the climb from the placement tempo (overrides the goal target)', async () => {
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    await service.enrollInGoal(USER, 'speed-c-major-scale', {
      startTempoBpm: 78,
    });
    // climb starts at the placed tempo, not the goal's 120.
    expect(repo.createClimbState).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      expect.objectContaining({ tempoBpm: 78 }),
    );
    // placement record marks it as a real placement.
    expect(repo.createEnrollment).toHaveBeenCalledWith(
      USER,
      'goal-1',
      expect.anything(),
      expect.objectContaining({ startTempoBpm: 78, placed: true }),
    );
  });

  it('clamps an out-of-range placement to the engine band', async () => {
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    await service.enrollInGoal(USER, 'speed-c-major-scale', {
      startTempoBpm: 9999,
    });
    expect(repo.createClimbState).toHaveBeenCalledWith(
      USER,
      ENROLLMENT,
      expect.objectContaining({ tempoBpm: 180 }), // clamped to TEMPO_MAX
    );
  });

  it('marks placed:false when no placement is given (target fallback)', async () => {
    const { service, repo } = makeService({
      findEnrollmentByGoal: vi.fn(async () => null),
      findClimbState: vi.fn(async () => null),
    });
    await service.enrollInGoal(USER, 'speed-c-major-scale');
    expect(repo.createEnrollment).toHaveBeenCalledWith(
      USER,
      'goal-1',
      expect.anything(),
      expect.objectContaining({ startTempoBpm: 120, placed: false }),
    );
  });
});

// ── Phase 5c: graduation ────────────────────────────────────────────────────

describe('buildGraduationSummary (pure read-time)', () => {
  const daysAgoIso = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString();

  it('is not due before day 30', () => {
    const e = makeEnrollment({
      startedAt: daysAgoIso(10),
      placement: { startTempoBpm: 80 },
    });
    const s = buildGraduationSummary(e, { tempoBpm: 92 });
    expect(s.isDue).toBe(false);
    expect(s.daysElapsed).toBe(10);
    expect(s.daysRemaining).toBe(20);
    expect(s.startTempoBpm).toBe(80);
    expect(s.currentTempoBpm).toBe(92);
    expect(s.targetTempoBpm).toBe(120);
  });

  it('is due at/after day 30', () => {
    const e = makeEnrollment({ startedAt: daysAgoIso(31) });
    const s = buildGraduationSummary(e, { tempoBpm: 110 });
    expect(s.isDue).toBe(true);
    expect(s.daysRemaining).toBe(0);
  });

  it('reports graduated when status is graduated', () => {
    const e = makeEnrollment({
      startedAt: daysAgoIso(31),
      status: 'graduated',
    });
    expect(buildGraduationSummary(e, null).graduated).toBe(true);
  });
});

describe('TrainingEngineService.getGraduation', () => {
  it('returns the summary for the enrollment', async () => {
    const { service } = makeService({
      findEnrollmentById: vi.fn(async () =>
        makeEnrollment({ placement: { startTempoBpm: 75 } }),
      ),
      findClimbState: vi.fn(async () => ({
        ...makeClimbState(),
        currentPosition: { tempoBpm: 99 },
      })),
    });
    const s = await service.getGraduation(USER, ENROLLMENT);
    expect(s.startTempoBpm).toBe(75);
    expect(s.currentTempoBpm).toBe(99);
    // Story 7: attendance rides the summary, read via the shared PracticeService.
    expect(s.daysPracticedInWindow).toBe(5);
    expect(s.windowDays).toBe(30);
  });

  it('omits the day count if the attendance read fails (best-effort)', async () => {
    const { service, practiceService } = makeService();
    (
      practiceService.countPracticeDaysInWindow as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('attendance read down'));
    const s = await service.getGraduation(USER, ENROLLMENT);
    expect(s.daysPracticedInWindow).toBeUndefined();
    // The rest of the summary is intact.
    expect(s.goalEnrollmentId).toBe(ENROLLMENT);
  });

  it('throws NotFound for a missing enrollment', async () => {
    const { service } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(
      service.getGraduation(USER, ENROLLMENT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TrainingEngineService.walkThroughDoor', () => {
  // A door is only actionable once the 30-day window is due.
  const dueIso = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const dueEnrollment = (over: Partial<GoalEnrollment> = {}) =>
    makeEnrollment({ startedAt: dueIso, ...over });

  it('go_deeper raises the target above the landing + resets the clock', async () => {
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => dueEnrollment()), // target 120
      findClimbState: vi.fn(async () => ({
        ...makeClimbState(),
        currentPosition: { tempoBpm: 118 }, // landed near target
      })),
    });
    await service.walkThroughDoor(USER, ENROLLMENT, 'go_deeper');
    const patch = (repo.updateEnrollment as ReturnType<typeof vi.fn>).mock
      .calls[0][2];
    expect(patch.status).toBe('active');
    expect(patch).toHaveProperty('started_at'); // clock reset
    // new target = max(landed 118, target 120) + 10 = 130.
    expect(
      (patch.goal_snapshot as { target: { tempoBpm: number } }).target.tempoBpm,
    ).toBe(130);
  });

  it('lock_it_in marks the enrollment graduated', async () => {
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => dueEnrollment()),
    });
    await service.walkThroughDoor(USER, ENROLLMENT, 'lock_it_in');
    const patch = (repo.updateEnrollment as ReturnType<typeof vi.fn>).mock
      .calls[0][2];
    expect(patch.status).toBe('graduated');
    expect(patch).toHaveProperty('graduated_at');
  });

  it('switch_lanes also graduates (frontend re-places)', async () => {
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => dueEnrollment()),
    });
    await service.walkThroughDoor(USER, ENROLLMENT, 'switch_lanes');
    const patch = (repo.updateEnrollment as ReturnType<typeof vi.fn>).mock
      .calls[0][2];
    expect(patch.status).toBe('graduated');
  });

  it('REJECTS a door before the window is due (no mid-cycle reset)', async () => {
    const { service, repo } = makeService({
      // started_at recent → not due.
      findEnrollmentById: vi.fn(async () => makeEnrollment()),
    });
    await expect(
      service.walkThroughDoor(USER, ENROLLMENT, 'go_deeper'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateEnrollment).not.toHaveBeenCalled();
  });

  it('is a no-op on an already-graduated enrollment', async () => {
    const grad = dueEnrollment({ status: 'graduated' });
    const { service, repo } = makeService({
      findEnrollmentById: vi.fn(async () => grad),
    });
    const result = await service.walkThroughDoor(USER, ENROLLMENT, 'go_deeper');
    expect(result).toBe(grad);
    expect(repo.updateEnrollment).not.toHaveBeenCalled();
  });

  it('throws NotFound for a missing enrollment', async () => {
    const { service } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(
      service.walkThroughDoor(USER, ENROLLMENT, 'lock_it_in'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Story 1: StudentState ────────────────────────────────────────────────────

describe('deriveStudentSignals (pure)', () => {
  const climb = makeClimbState() as never;

  it('counts the leading run of conquered reps (newest-first)', () => {
    const history = [
      makeRepResult({ id: 'r3', result: 'conquered', tempoBpm: 100 }),
      makeRepResult({ id: 'r2', result: 'conquered', tempoBpm: 100 }),
      makeRepResult({ id: 'r1', result: 'released', tempoBpm: 90 }),
    ];
    const s = deriveStudentSignals(history, climb, '2026-06-12');
    expect(s.consecutiveWins).toBe(2);
    // both leading wins share the newest tempo → plateau of 2
    expect(s.plateauRepCount).toBe(2);
  });

  it('breaks the win run on the first non-conquered rep', () => {
    const history = [
      makeRepResult({ id: 'r2', result: 'too_hard' }),
      makeRepResult({ id: 'r1', result: 'conquered' }),
    ];
    const s = deriveStudentSignals(history, climb, '2026-06-12');
    expect(s.consecutiveWins).toBe(0);
  });

  it('counts too_hard in the recent window and surfaces days-since-last-conquered', () => {
    const history = [
      makeRepResult({ id: 'r2', result: 'too_hard' }),
      makeRepResult({
        id: 'r1',
        result: 'conquered',
        completedAt: '2026-06-08T00:00:00.000Z',
      }),
    ];
    const s = deriveStudentSignals(history, climb, '2026-06-12');
    expect(s.recentTooHardCount).toBe(1);
    expect(s.lastNOutcomes).toEqual(['too_hard', 'conquered']);
    expect(s.daysSinceLastConquered).toBe(4); // 06-08 → 06-12
  });

  it('returns null days-since-conquered when nothing was ever conquered', () => {
    const history = [makeRepResult({ result: 'released' })];
    const s = deriveStudentSignals(history, climb, '2026-06-12');
    expect(s.daysSinceLastConquered).toBeNull();
    expect(s.consecutiveWins).toBe(0);
  });
});

describe('TrainingEngineService.assembleStudentState', () => {
  it('assembles a serializable whole-student snapshot from repo + shared services', async () => {
    const { service, practiceService, progressService } = makeService();
    const ss = await service.assembleStudentState(USER, ENROLLMENT);

    // goal view from the snapshot/enrollment
    expect(ss.goal.enrollmentId).toBe(ENROLLMENT);
    expect(ss.goal.type).toBe('speed');
    expect(ss.goal.target).toEqual({ tempoBpm: 120 });
    // climb passed through verbatim
    expect(ss.climb.currentPosition).toEqual({ tempoBpm: 90 });
    // attendance sourced via PracticeService (boundary), field is `ceiling`
    expect(ss.attendance.streakDays).toBe(3);
    expect(ss.attendance.ceiling).toBe(1);
    expect(ss.attendance.daysPracticedInWindow).toBe(5);
    expect(ss.attendance.windowDays).toBe(30);
    // derived signals present
    expect(ss.derived.consecutiveWins).toBeGreaterThanOrEqual(0);
    // the shared services WERE the path (no direct cross-domain query)
    expect(practiceService.getStreak).toHaveBeenCalledWith(USER);
    expect(progressService.getLifetimeMasteryByBlock).toHaveBeenCalledWith(USER);
    // fully serializable (no Date objects / handles leaked in)
    expect(() => JSON.stringify(ss)).not.toThrow();
  });

  it('404s when the enrollment is not the caller\'s', async () => {
    const { service } = makeService({
      findEnrollmentById: vi.fn(async () => null),
    });
    await expect(
      service.assembleStudentState(USER, ENROLLMENT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── Story 2: the climb advances (mat -> treadmill) ───────────────────────────

describe('TrainingEngineService.getTodayRep — climb advance', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('advances the climb (persists a patch) when the last rep was conquered and not yet advanced today', async () => {
    // default climb has lastRepDate: null; default history is one conquered rep.
    const { service, repo } = makeService({
      findClimbState: vi.fn(
        async () => ({ ...makeClimbState(), lastRepDate: null }) as never,
      ),
    });
    await service.getTodayRep(USER, ENROLLMENT);

    expect(repo.patchClimbState).toHaveBeenCalledTimes(1);
    const patch = (repo.patchClimbState as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as Record<string, unknown>;
    // a win raises the tempo one notch from 90 → 98 and stamps last_rep_date
    expect((patch.current_position as { tempoBpm: number }).tempoBpm).toBe(98);
    expect(patch.last_rep_date).toBe(today);
  });

  it('does NOT advance twice in one day (idempotent on last_rep_date)', async () => {
    const { service, repo } = makeService({
      findClimbState: vi.fn(
        async () => ({ ...makeClimbState(), lastRepDate: today }) as never,
      ),
    });
    await service.getTodayRep(USER, ENROLLMENT);
    expect(repo.patchClimbState).not.toHaveBeenCalled();
  });
});

// ── Story 6: month-in-review recap ───────────────────────────────────────────

describe('buildMonthInReview (pure)', () => {
  it('derives level delta, strongest weekday, rep/groove counts + best tier', () => {
    const enrollment = makeEnrollmentWithBlock();
    enrollment.placement = { startTempoBpm: 80 };
    const review = buildMonthInReview({
      enrollment,
      currentPosition: { tempoBpm: 112 },
      history: [
        makeRepResult({ id: 'r3', result: 'conquered', achievedTier: 'gold' }),
        makeRepResult({ id: 'r2', result: 'conquered', achievedTier: 'silver' }),
        makeRepResult({ id: 'r1', result: 'released', achievedTier: null }),
      ],
      // 2024-06-10 is a Monday, -11 a Tuesday; weight Tuesdays.
      practicedDays: ['2026-06-09', '2026-06-16', '2026-06-23', '2026-06-10'],
      windowDays: 30,
      streak: { current: 12, ceiling: 7, freezeTokens: 2 },
    });

    expect(review.startTempoBpm).toBe(80);
    expect(review.currentTempoBpm).toBe(112);
    expect(review.gainedBpm).toBe(32);
    expect(review.totalReps).toBe(3);
    expect(review.conqueredReps).toBe(2);
    // best tier across conquered reps = gold
    expect(review.grooves).toHaveLength(1);
    expect(review.grooves[0].title).toBe('C Major Scale');
    expect(review.grooves[0].bestTier).toBe('gold');
    expect(review.grooves[0].conqueredReps).toBe(2);
    // 2026-06-09/16/23 are Tuesdays (UTC) → strongest weekday = 2 (Tue)
    expect(review.strongestWeekday).toBe(2);
    expect(review.daysPracticed).toBe(4);
    expect(review.streakDays).toBe(12);
    expect(review.ceilingDays).toBe(7);
  });

  it('handles a cycle with no conquered reps (no grooves, null tier)', () => {
    const review = buildMonthInReview({
      enrollment: makeEnrollmentWithBlock(),
      currentPosition: null,
      history: [makeRepResult({ result: 'released', achievedTier: null })],
      practicedDays: [],
      windowDays: 30,
      streak: { current: 0, ceiling: 0, freezeTokens: 0 },
    });
    expect(review.grooves).toHaveLength(0);
    expect(review.conqueredReps).toBe(0);
    expect(review.gainedBpm).toBeNull();
    expect(review.strongestWeekday).toBeNull();
  });
});
