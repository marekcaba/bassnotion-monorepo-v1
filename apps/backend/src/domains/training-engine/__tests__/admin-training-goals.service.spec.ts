import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { AdminTrainingGoalsService } from '../admin-training-goals.service.js';
import type { TrainingEngineRepository } from '../repositories/training-engine.repository.js';
import type { Goal } from '@bassnotion/contracts';

function makeGoal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    slug: 'speed-c-major-scale',
    type: 'speed',
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
    ...over,
  };
}

function makeService(repoOver: Partial<TrainingEngineRepository> = {}) {
  const repo = {
    listAllGoals: vi.fn(async () => [makeGoal()]),
    findGoalById: vi.fn(async () => makeGoal()),
    goalSlugExists: vi.fn(async () => false),
    findGoalBySlug: vi.fn(async () => null),
    insertGoal: vi.fn(async (row: Record<string, unknown>) =>
      makeGoal({ slug: row.slug as string, title: row.title as string }),
    ),
    updateGoal: vi.fn(async (id: string, patch: Record<string, unknown>) =>
      makeGoal({ id, ...(patch as Partial<Goal>) }),
    ),
    deleteGoal: vi.fn(async () => undefined),
    countEnrollmentsForGoal: vi.fn(async () => 0),
    setGoalArchived: vi.fn(async (id: string, archived: boolean) =>
      makeGoal({ id, archivedAt: archived ? '2026-06-16T00:00:00.000Z' : null }),
    ),
    ...repoOver,
  } as unknown as TrainingEngineRepository;
  return { service: new AdminTrainingGoalsService(repo), repo };
}

describe('AdminTrainingGoalsService.create', () => {
  it('maps camelCase input to snake_case columns + slugifies the title', async () => {
    const { service, repo } = makeService();
    const blockSet = [{ blockId: 'x', block: { id: 'x' } }] as never;
    await service.create({
      type: 'speed',
      title: 'Speed: C Major Scale',
      target: { tempoBpm: 120 },
      blockSet,
    });
    const row = (repo.insertGoal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row).toMatchObject({
      slug: 'speed-c-major-scale',
      type: 'speed',
      title: 'Speed: C Major Scale',
      target: { tempoBpm: 120 },
      is_active: true,
    });
    expect(row.block_set).toEqual(blockSet);
    expect(row).toHaveProperty('created_at');
  });

  it('appends a numeric suffix on slug collision (active OR inactive)', async () => {
    const { service, repo } = makeService({
      // base + base-2 taken, base-3 free.
      goalSlugExists: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false),
    });
    await service.create({
      type: 'speed',
      title: 'Speed Drill',
      blockSet: [{ blockId: 'x', block: { id: 'x' } }] as never,
    });
    const row = (repo.insertGoal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(row.slug).toBe('speed-drill-3');
  });

  it('rejects a missing title', async () => {
    const { service } = makeService();
    await expect(
      service.create({ type: 'speed', title: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid type', async () => {
    const { service } = makeService();
    await expect(
      service.create({ type: 'bogus' as never, title: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REJECTS an empty goal — no topics AND no focal block (would 500 the gym)', async () => {
    const { service } = makeService();
    await expect(
      service.create({ type: 'speed', title: 'Empty Goal' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PERSISTS content-ladder topics (the Build B persistence gap fix)', async () => {
    const { service, repo } = makeService();
    const topics = [
      {
        id: 'hold',
        title: 'Hold the Engine',
        repQuota: 12,
        stages: [
          {
            level: 1,
            introduceAfterReps: 0,
            blocks: [{ blockId: 'b', block: { id: 'b' } }],
          },
        ],
      },
    ];
    await service.create({ type: 'feel', title: 'Lock The Pocket', topics } as never);
    const row = (repo.insertGoal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // topics must land in the topics column — previously dropped silently.
    expect(row.topics).toEqual(topics);
  });

  it('REJECTS a multi-topic goal with an empty stage (would 500 the gym)', async () => {
    const { service } = makeService();
    const topics = [
      {
        id: 'hold',
        title: 'Hold the Engine',
        repQuota: 12,
        stages: [{ level: 1, introduceAfterReps: 0, blocks: [] }], // no block
      },
    ];
    await expect(
      service.create({ type: 'feel', title: 'Lock The Pocket', topics } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REJECTS a topic with a zero quota', async () => {
    const { service } = makeService();
    const topics = [
      {
        id: 'hold',
        title: 'Hold the Engine',
        repQuota: 0,
        stages: [
          {
            level: 1,
            introduceAfterReps: 0,
            blocks: [{ blockId: 'b', block: { id: 'b' } }],
          },
        ],
      },
    ];
    await expect(
      service.create({ type: 'feel', title: 'X', topics } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminTrainingGoalsService.update', () => {
  it('patches only the supplied fields (camel→snake) and never the slug', async () => {
    const { service, repo } = makeService();
    await service.update('goal-1', {
      title: 'New Title',
      target: { tempoBpm: 140 },
      isActive: false,
    });
    const [id, row] = (repo.updateGoal as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(id).toBe('goal-1');
    expect(row).toEqual({
      title: 'New Title',
      target: { tempoBpm: 140 },
      is_active: false,
    });
    expect(row).not.toHaveProperty('slug'); // slug is stable
  });

  it('rejects an invalid type on patch', async () => {
    const { service } = makeService();
    await expect(
      service.update('goal-1', { type: 'nope' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the goal does not exist', async () => {
    const { service } = makeService({
      updateGoal: vi.fn(async () => null),
    });
    await expect(
      service.update('missing', { title: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminTrainingGoalsService list/get/remove', () => {
  it('lists all goals', async () => {
    const { service } = makeService();
    expect(await service.list()).toHaveLength(1);
  });
  it('deletes by id when no enrollments reference the goal', async () => {
    const { service, repo } = makeService({
      countEnrollmentsForGoal: vi.fn(async () => 0),
    });
    await service.remove('goal-1');
    expect(repo.deleteGoal).toHaveBeenCalledWith('goal-1');
  });

  it('REFUSES to delete a goal that has enrollments (no silent cascade wipe)', async () => {
    const { service, repo } = makeService({
      countEnrollmentsForGoal: vi.fn(async () => 3),
    });
    await expect(service.remove('goal-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.deleteGoal).not.toHaveBeenCalled();
  });

  it('FORCE-deletes a goal with enrollments (admin override cascades)', async () => {
    const { service, repo } = makeService({
      countEnrollmentsForGoal: vi.fn(async () => 3),
    });
    await service.remove('goal-1', true); // force = true
    expect(repo.deleteGoal).toHaveBeenCalledWith('goal-1');
  });
});

describe('AdminTrainingGoalsService archive/unarchive', () => {
  it('archives a goal (sets archived_at) — reversible, never cascades', async () => {
    const { service, repo } = makeService();
    const g = await service.archive('goal-1');
    expect(repo.setGoalArchived).toHaveBeenCalledWith('goal-1', true);
    expect(g.archivedAt).toBeTruthy();
    expect(repo.deleteGoal).not.toHaveBeenCalled(); // archive ≠ delete
  });

  it('unarchives a goal (clears archived_at)', async () => {
    const { service, repo } = makeService();
    const g = await service.unarchive('goal-1');
    expect(repo.setGoalArchived).toHaveBeenCalledWith('goal-1', false);
    expect(g.archivedAt).toBeNull();
  });

  it('throws NotFound when archiving a missing goal', async () => {
    const { service } = makeService({
      setGoalArchived: vi.fn(async () => null),
    });
    await expect(service.archive('missing')).rejects.toThrow();
  });
});
