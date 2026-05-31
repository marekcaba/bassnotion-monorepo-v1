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
      getAllBlockCompletionsForUser: vi.fn().mockResolvedValue([]),
      insertBlockCompletion: vi
        .fn()
        .mockImplementation(async (userId, tutorialId, blockId) => ({
          user_id: userId,
          tutorial_id: tutorialId,
          block_id: blockId,
          completed_at: '2026-05-20T12:00:00Z',
          data: null,
        })),
      incrementPracticeCompletion: vi
        .fn()
        .mockImplementation(
          async (userId, tutorialId, exerciseId, tempoBpm) => ({
            user_id: userId,
            tutorial_id: tutorialId,
            exercise_id: exerciseId,
            completion_count: 1,
            last_tempo_bpm: tempoBpm ?? null,
          }),
        ),
    } as any;

    mockTutorials = {
      findBySlug: vi.fn(),
      findAll: vi.fn().mockResolvedValue({ tutorials: [], total: 0 }),
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

  describe('completeBlock', () => {
    it('inserts a block_completions row and returns updated progress', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([videoBlock('b0', 0), videoBlock('b1', 1)]),
      );
      // No prior completions → b0 is the first block, allowed to complete.
      (mockRepo.getBlockCompletions as any)
        .mockResolvedValueOnce([]) // unlock-check read
        .mockResolvedValueOnce([
          // post-write read inside getTutorialProgress
          {
            user_id: USER_ID,
            tutorial_id: TUTORIAL_ID,
            block_id: 'b0',
            completed_at: '2026-05-20T12:00:00Z',
            data: null,
          },
        ]);

      const result = await service.completeBlock(USER_ID, 'slug', 'b0');

      expect(mockRepo.insertBlockCompletion).toHaveBeenCalledWith(
        USER_ID,
        TUTORIAL_ID,
        'b0',
        undefined,
      );
      expect(result.blocks[0]).toMatchObject({
        blockId: 'b0',
        completed: true,
      });
    });

    it('rejects completing a block whose prerequisites are not done', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([videoBlock('b0', 0), videoBlock('b1', 1)]),
      );
      // No completions at all → trying to complete b1 (order 1) when b0
      // isn't done should 404.
      (mockRepo.getBlockCompletions as any).mockResolvedValue([]);

      await expect(
        service.completeBlock(USER_ID, 'slug', 'b1'),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.insertBlockCompletion).not.toHaveBeenCalled();
    });

    it('rejects completing a block that does not exist in the tutorial', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([videoBlock('b0', 0)]),
      );

      await expect(
        service.completeBlock(USER_ID, 'slug', 'phantom'),
      ).rejects.toThrow(NotFoundException);
    });

    it('forwards the optional data payload to the repository', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([videoBlock('b0', 0)]),
      );
      (mockRepo.getBlockCompletions as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.completeBlock(USER_ID, 'slug', 'b0', { quizScore: 4 });

      expect(mockRepo.insertBlockCompletion).toHaveBeenCalledWith(
        USER_ID,
        TUTORIAL_ID,
        'b0',
        { quizScore: 4 },
      );
    });
  });

  describe('recordPractice', () => {
    it('increments practice count and returns updated progress', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([exerciseBlock('practice', 0, ['ex1', 'ex2'])]),
      );
      // After increment: ex1 has 1 rep, ex2 still 0 → block NOT auto-complete.
      (mockRepo.getPracticeProgress as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: TUTORIAL_ID,
          exercise_id: 'ex1',
          completion_count: 1,
          last_tempo_bpm: 100,
        },
      ]);

      await service.recordPractice(USER_ID, 'slug', 'ex1', 100);

      expect(mockRepo.incrementPracticeCompletion).toHaveBeenCalledWith(
        USER_ID,
        TUTORIAL_ID,
        'ex1',
        100,
      );
      // Block should NOT be auto-completed (only 1 rep, threshold is 4)
      expect(mockRepo.insertBlockCompletion).not.toHaveBeenCalled();
    });

    it('auto-completes the parent exercise block when ALL exercises hit threshold', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([exerciseBlock('practice', 0, ['ex1', 'ex2'])]),
      );
      // After the increment we're simulating, both exercises are at 4.
      (mockRepo.getPracticeProgress as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: TUTORIAL_ID,
          exercise_id: 'ex1',
          completion_count: 4,
          last_tempo_bpm: null,
        },
        {
          user_id: USER_ID,
          tutorial_id: TUTORIAL_ID,
          exercise_id: 'ex2',
          completion_count: 4,
          last_tempo_bpm: null,
        },
      ]);
      (mockRepo.getBlockCompletions as any).mockResolvedValue([]);

      await service.recordPractice(USER_ID, 'slug', 'ex2');

      // The rep increment AND the block auto-completion should both fire.
      expect(mockRepo.incrementPracticeCompletion).toHaveBeenCalledTimes(1);
      expect(mockRepo.insertBlockCompletion).toHaveBeenCalledWith(
        USER_ID,
        TUTORIAL_ID,
        'practice',
      );
    });

    it('does NOT auto-complete when only some exercises hit threshold', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([exerciseBlock('practice', 0, ['ex1', 'ex2'])]),
      );
      (mockRepo.getPracticeProgress as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: TUTORIAL_ID,
          exercise_id: 'ex1',
          completion_count: 4,
          last_tempo_bpm: null,
        },
        {
          user_id: USER_ID,
          tutorial_id: TUTORIAL_ID,
          exercise_id: 'ex2',
          completion_count: 3,
          last_tempo_bpm: null,
        },
      ]);

      await service.recordPractice(USER_ID, 'slug', 'ex1');

      expect(mockRepo.insertBlockCompletion).not.toHaveBeenCalled();
    });

    it('rejects practicing an exercise that does not belong to the tutorial', async () => {
      (mockTutorials.findBySlug as any).mockResolvedValue(
        makeTutorial([exerciseBlock('practice', 0, ['ex1'])]),
      );

      await expect(
        service.recordPractice(USER_ID, 'slug', 'phantom'),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepo.incrementPracticeCompletion).not.toHaveBeenCalled();
    });
  });

  describe('getUserTutorialCompletions', () => {
    it('returns empty list when no tutorials exist', async () => {
      (mockTutorials.findAll as any).mockResolvedValue({
        tutorials: [],
        total: 0,
      });

      const result = await service.getUserTutorialCompletions(USER_ID);

      expect(result).toEqual({ tutorials: [] });
    });

    it('reports isComplete=false for a tutorial with no completions', async () => {
      (mockTutorials.findAll as any).mockResolvedValue({
        tutorials: [
          {
            id: 't1',
            slug: 't-one',
            blocks: [videoBlock('b0', 0), videoBlock('b1', 1)],
          },
        ],
        total: 1,
      });

      const result = await service.getUserTutorialCompletions(USER_ID);

      expect(result.tutorials[0]).toMatchObject({
        tutorialId: 't1',
        slug: 't-one',
        isComplete: false,
        completedBlockCount: 0,
        totalBlockCount: 2,
        blockCompletions: { b0: false, b1: false },
      });
    });

    it('reports isComplete=true when every block is in block_completions', async () => {
      (mockTutorials.findAll as any).mockResolvedValue({
        tutorials: [
          {
            id: 't1',
            slug: 't-one',
            blocks: [videoBlock('b0', 0), videoBlock('b1', 1)],
          },
        ],
        total: 1,
      });
      (mockRepo.getAllBlockCompletionsForUser as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: 't1',
          block_id: 'b0',
          completed_at: 'x',
          data: null,
        },
        {
          user_id: USER_ID,
          tutorial_id: 't1',
          block_id: 'b1',
          completed_at: 'x',
          data: null,
        },
      ]);

      const result = await service.getUserTutorialCompletions(USER_ID);

      expect(result.tutorials[0]).toMatchObject({
        isComplete: true,
        completedBlockCount: 2,
        totalBlockCount: 2,
      });
    });

    it('treats exercise blocks as complete when all exercises hit threshold (even without block_completions row)', async () => {
      (mockTutorials.findAll as any).mockResolvedValue({
        tutorials: [
          {
            id: 't1',
            slug: 't-one',
            blocks: [exerciseBlock('practice', 0, ['ex1', 'ex2'])],
          },
        ],
        total: 1,
      });
      (mockRepo.getPracticeProgress as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: 't1',
          exercise_id: 'ex1',
          completion_count: 4,
          last_tempo_bpm: null,
        },
        {
          user_id: USER_ID,
          tutorial_id: 't1',
          exercise_id: 'ex2',
          completion_count: 4,
          last_tempo_bpm: null,
        },
      ]);

      const result = await service.getUserTutorialCompletions(USER_ID);

      expect(result.tutorials[0]).toMatchObject({
        isComplete: true,
        blockCompletions: { practice: true },
      });
    });

    it('handles multiple tutorials independently', async () => {
      (mockTutorials.findAll as any).mockResolvedValue({
        tutorials: [
          { id: 't1', slug: 't-one', blocks: [videoBlock('b0', 0)] },
          {
            id: 't2',
            slug: 't-two',
            blocks: [videoBlock('b0', 0), videoBlock('b1', 1)],
          },
        ],
        total: 2,
      });
      (mockRepo.getAllBlockCompletionsForUser as any).mockResolvedValue([
        {
          user_id: USER_ID,
          tutorial_id: 't1',
          block_id: 'b0',
          completed_at: 'x',
          data: null,
        },
      ]);

      const result = await service.getUserTutorialCompletions(USER_ID);

      const t1 = result.tutorials.find((t) => t.tutorialId === 't1');
      const t2 = result.tutorials.find((t) => t.tutorialId === 't2');
      expect(t1?.isComplete).toBe(true);
      expect(t2?.isComplete).toBe(false);
      expect(t2?.completedBlockCount).toBe(0);
    });
  });
});
