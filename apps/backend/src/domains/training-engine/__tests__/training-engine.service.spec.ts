import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { TrainingEngineService } from '../training-engine.service.js';
import type { TrainingEngineRepository } from '../repositories/training-engine.repository.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';
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

function makeService(repoOverrides: Partial<TrainingEngineRepository> = {}) {
  const repo = {
    findEnrollmentById: vi.fn(async () => makeEnrollment()),
    insertRepResult: vi.fn(async () => makeRepResult()),
    getRepResultsForEnrollment: vi.fn(async () => [makeRepResult()]),
    upsertVirtualTutorial: vi.fn(async () => undefined),
    setEnrollmentVirtualSlug: vi.fn(async () => undefined),
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

  const service = new TrainingEngineService(repo, requestContext);
  return { service, repo };
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
