import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProgressService } from '../progress.service.js';
import type { ProgressRepository } from '../repositories/progress.repository.js';
import type { TutorialsService } from '../../tutorials/tutorials.service.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';

const USER_ID = 'user-1';
const TUTORIAL_ID = 'tutorial-1';

/**
 * Build a minimal Tutorial contract object with the blocks we want to test
 * against. Other tutorial fields are stubbed because the service only
 * inspects `id` and `blocks`.
 */
function makeTutorial(blocks: any[]) {
  return {
    id: TUTORIAL_ID,
    slug: 'test-tut',
    title: 'Test',
    description: '',
    blocks,
  } as any;
}

function videoBlock(id: string, order: number) {
  return {
    id,
    type: 'video' as const,
    title: id,
    order,
    config: {},
  };
}

function exerciseBlock(
  id: string,
  order: number,
  exerciseIds: string[],
  requiredCompletions?: number,
) {
  return {
    id,
    type: 'exercise' as const,
    title: id,
    order,
    config: { exerciseIds, requiredCompletions },
  };
}

describe('ProgressService', () => {
  let service: ProgressService;
  let mockRepo: ProgressRepository;
  let mockTutorials: TutorialsService;
  let mockRequestContext: RequestContextService;

  beforeEach(() => {
    mockRepo = {
      getBlockCompletions: vi.fn().mockResolvedValue([]),
      getPracticeProgress: vi.fn().mockResolvedValue([]),
    } as any;

    mockTutorials = {
      findBySlug: vi.fn(),
    } as any;

    mockRequestContext = {
      getLogger: vi.fn(),
      getCorrelationId: vi.fn(),
    } as any;

    service = new ProgressService(mockRepo, mockTutorials, mockRequestContext);
  });

  it('returns empty progress when tutorial has no blocks', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(makeTutorial([]));

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result).toEqual({
      tutorialId: TUTORIAL_ID,
      blocks: [],
      exercises: [],
    });
    // Empty-blocks fast path doesn't hit the repos at all
    expect(mockRepo.getBlockCompletions).not.toHaveBeenCalled();
  });

  it('marks block 0 unlocked even when nothing is completed', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([videoBlock('b0', 0), videoBlock('b1', 1)]),
    );

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks[0]).toMatchObject({
      blockId: 'b0',
      completed: false,
      unlocked: true,
    });
    expect(result.blocks[1]).toMatchObject({
      blockId: 'b1',
      completed: false,
      unlocked: false,
    });
  });

  it('unlocks block N once block N-1 is completed', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([
        videoBlock('b0', 0),
        videoBlock('b1', 1),
        videoBlock('b2', 2),
      ]),
    );
    (mockRepo.getBlockCompletions as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        block_id: 'b0',
        completed_at: '2026-05-20T10:00:00Z',
        data: null,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks).toMatchObject([
      { blockId: 'b0', completed: true, unlocked: true },
      { blockId: 'b1', completed: false, unlocked: true },
      { blockId: 'b2', completed: false, unlocked: false },
    ]);
  });

  it('does not unlock further blocks past a non-completed block', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([
        videoBlock('b0', 0),
        videoBlock('b1', 1),
        videoBlock('b2', 2),
      ]),
    );
    // b0 completed, b1 NOT completed → b2 still locked even if user
    // somehow had a stray b2 row (shouldn't happen but be defensive).
    (mockRepo.getBlockCompletions as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        block_id: 'b0',
        completed_at: '2026-05-20T10:00:00Z',
        data: null,
      },
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        block_id: 'b2',
        completed_at: '2026-05-20T10:01:00Z',
        data: null,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks[2]).toMatchObject({
      blockId: 'b2',
      completed: true,
      unlocked: false, // gated by b1 still being incomplete
    });
  });

  it('auto-completes an exercise block when ALL exercises hit the threshold', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([
        videoBlock('b0', 0),
        exerciseBlock('practice', 1, ['ex1', 'ex2']),
      ]),
    );
    (mockRepo.getBlockCompletions as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        block_id: 'b0',
        completed_at: '2026-05-20T10:00:00Z',
        data: null,
      },
    ]);
    (mockRepo.getPracticeProgress as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex1',
        completion_count: 4,
        last_tempo_bpm: 100,
      },
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex2',
        completion_count: 4,
        last_tempo_bpm: 120,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks[1]).toMatchObject({
      blockId: 'practice',
      completed: true,
      unlocked: true,
    });
  });

  it('does NOT auto-complete an exercise block if any exercise is below threshold', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([exerciseBlock('practice', 0, ['ex1', 'ex2'])]),
    );
    (mockRepo.getPracticeProgress as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex1',
        completion_count: 4,
        last_tempo_bpm: 100,
      },
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex2',
        completion_count: 3, // one rep short
        last_tempo_bpm: 120,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks[0]).toMatchObject({
      blockId: 'practice',
      completed: false,
    });
  });

  it('respects per-block requiredCompletions override', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([exerciseBlock('practice', 0, ['ex1'], 2)]),
    );
    (mockRepo.getPracticeProgress as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex1',
        completion_count: 2,
        last_tempo_bpm: null,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.blocks[0].completed).toBe(true);
  });

  it('exposes practice exercises with their completion counts', async () => {
    (mockTutorials.findBySlug as any).mockResolvedValue(
      makeTutorial([exerciseBlock('practice', 0, ['ex1', 'ex2'])]),
    );
    (mockRepo.getPracticeProgress as any).mockResolvedValue([
      {
        user_id: USER_ID,
        tutorial_id: TUTORIAL_ID,
        exercise_id: 'ex1',
        completion_count: 2,
        last_tempo_bpm: 90,
      },
    ]);

    const result = await service.getTutorialProgress(USER_ID, 'slug');

    expect(result.exercises).toEqual(
      expect.arrayContaining([
        { exerciseId: 'ex1', completionCount: 2, lastTempoBpm: 90 },
        { exerciseId: 'ex2', completionCount: 0, lastTempoBpm: null },
      ]),
    );
  });

  it('propagates NotFoundException from tutorials service', async () => {
    (mockTutorials.findBySlug as any).mockRejectedValue(
      new NotFoundException('Tutorial with slug "missing" not found'),
    );

    await expect(
      service.getTutorialProgress(USER_ID, 'missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
