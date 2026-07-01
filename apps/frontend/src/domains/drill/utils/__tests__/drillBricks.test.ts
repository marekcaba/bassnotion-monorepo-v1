import { describe, it, expect } from 'vitest';
import type { AnyBlock, Tutorial } from '@bassnotion/contracts';
import {
  isDrillBrickBlock,
  isDrillTutorial,
  getDrillBricks,
  describeCriterion,
} from '../drillBricks';

// Minimal block factories — only the fields drillBricks inspects.
function taskBlock(overrides: Partial<AnyBlock> = {}): AnyBlock {
  return {
    id: 'task-1',
    type: 'task',
    title: 'Task',
    order: 0,
    config: {
      instruction: 'Play C major triads',
      heading: 'Warm-up',
      completionCriterion: { type: 'time', target: 5 },
    },
    ...overrides,
  } as AnyBlock;
}

function grooveCard(
  config: Record<string, unknown>,
  overrides: Partial<AnyBlock> = {},
): AnyBlock {
  return {
    id: 'gc-1',
    type: 'groove-card',
    title: 'Groove',
    order: 1,
    config: { title: 'Greasy Pocket', subtitle: 'Funk in E', ...config },
    ...overrides,
  } as AnyBlock;
}

function videoBlock(): AnyBlock {
  return {
    id: 'v-1',
    type: 'video',
    title: 'Intro',
    order: 0,
    config: {},
  } as AnyBlock;
}

function scalesBlock(
  config: Record<string, unknown> = {},
  overrides: Partial<AnyBlock> = {},
): AnyBlock {
  return {
    id: 'sc-1',
    type: 'scales',
    title: 'Scales',
    order: 2,
    config: { exerciseId: 'ex-major-run', exerciseName: 'C Major Run', ...config },
    ...overrides,
  } as AnyBlock;
}

function tut(blocks: AnyBlock[]): Pick<Tutorial, 'blocks'> {
  return { blocks };
}

describe('isDrillBrickBlock', () => {
  it('treats a task block as a brick', () => {
    expect(isDrillBrickBlock(taskBlock())).toBe(true);
  });

  it('treats a groove-card with a role as a brick', () => {
    expect(isDrillBrickBlock(grooveCard({ role: 'groove' }))).toBe(true);
  });

  it('treats a groove-card with ONLY a completionCriterion as a brick', () => {
    // The bug we hit: a criterion-only card (no role) must still count.
    expect(
      isDrillBrickBlock(
        grooveCard({ completionCriterion: { type: 'manual' } }),
      ),
    ).toBe(true);
  });

  it('does NOT treat a plain groove-card (no role, no criterion) as a brick', () => {
    expect(isDrillBrickBlock(grooveCard({}))).toBe(false);
  });

  it('does NOT treat a video block as a brick', () => {
    expect(isDrillBrickBlock(videoBlock())).toBe(false);
  });

  it('always treats a scales block as a brick (a locked deliverable)', () => {
    expect(isDrillBrickBlock(scalesBlock())).toBe(true);
    // even with an open (null exercise) config it's still a brick.
    expect(isDrillBrickBlock(scalesBlock({ exerciseId: null }))).toBe(true);
  });
});

describe('isDrillTutorial', () => {
  it('is true when any block is a drill brick', () => {
    expect(isDrillTutorial(tut([videoBlock(), taskBlock()]))).toBe(true);
  });

  it('is false for a plain tutorial', () => {
    expect(isDrillTutorial(tut([videoBlock(), grooveCard({})]))).toBe(false);
  });

  it('is false for null/empty', () => {
    expect(isDrillTutorial(null)).toBe(false);
    expect(isDrillTutorial(undefined)).toBe(false);
    expect(isDrillTutorial(tut([]))).toBe(false);
  });
});

describe('getDrillBricks', () => {
  it('flattens bricks in block order and skips non-bricks', () => {
    const bricks = getDrillBricks(
      tut([
        videoBlock(), // skipped
        grooveCard({ role: 'groove' }, { id: 'gc-1', order: 2 }),
        taskBlock({ id: 'task-1', order: 1 }),
      ]),
    );
    // Sorted by order: task (1) before groove (2); video skipped.
    expect(bricks.map((b) => b.id)).toEqual(['task-1', 'gc-1']);
    expect(bricks.map((b) => b.kind)).toEqual(['task', 'groove']);
  });

  it('maps task block fields (heading → title, instruction → subtitle)', () => {
    const [brick] = getDrillBricks(tut([taskBlock()]));
    expect(brick.title).toBe('Warm-up');
    expect(brick.subtitle).toBe('Play C major triads');
    expect(brick.criterion).toEqual({ type: 'time', target: 5 });
  });

  it('maps groove-card fields (title/subtitle/timebox/criterion)', () => {
    const [brick] = getDrillBricks(
      tut([
        grooveCard({
          role: 'groove',
          timeboxMinutes: 5,
          completionCriterion: { type: 'loops', target: 4 },
        }),
      ]),
    );
    expect(brick.title).toBe('Greasy Pocket');
    expect(brick.subtitle).toBe('Funk in E');
    expect(brick.timeboxMinutes).toBe(5);
    expect(brick.criterion).toEqual({ type: 'loops', target: 4 });
  });

  it('maps a scales block (kind scales, exerciseName → title)', () => {
    const [brick] = getDrillBricks(tut([scalesBlock()]));
    expect(brick.kind).toBe('scales');
    expect(brick.title).toBe('C Major Run');
  });

  it('falls back to the block title when a scales block has no exerciseName', () => {
    const [brick] = getDrillBricks(
      tut([scalesBlock({ exerciseName: null }, { title: 'Daily Scale' })]),
    );
    expect(brick.title).toBe('Daily Scale');
  });

  it('returns [] for a non-drill tutorial', () => {
    expect(getDrillBricks(tut([videoBlock()]))).toEqual([]);
    expect(getDrillBricks(null)).toEqual([]);
  });
});

describe('describeCriterion', () => {
  it('describes time / loops / conquer / manual', () => {
    expect(describeCriterion({ type: 'time', target: 5 })).toBe(
      'Practice 5 min',
    );
    expect(describeCriterion({ type: 'loops', target: 4 })).toBe('Play 4×');
    expect(describeCriterion({ type: 'conquer' })).toBe('Clean pass');
    expect(describeCriterion({ type: 'manual' })).toBe("Until you're done");
  });

  it('falls back when target is missing or criterion is absent', () => {
    expect(describeCriterion({ type: 'time' })).toBe('Practice');
    expect(describeCriterion({ type: 'loops' })).toBe('Play the loop');
    expect(describeCriterion(undefined)).toBe('Free practice');
  });
});
