/**
 * topicLadder + the topic-aware generateRep path — behavior tests
 * (BASS_GYM_CONTENT_LADDER_EPIC.md, Build A).
 *
 * Verifies the founder-locked content-ladder model:
 *   - deriveTopicProgress: per-topic quota tally (from rep_results.topicId) +
 *     completion + current stage level
 *   - resolveStage: self-paced level bump (highest stage whose
 *     introduceAfterReps the rep count has met)
 *   - selectTopicForRep: least-advanced ACTIVE topic, completed topics drop out,
 *     authoring order as the stable tie-break
 *   - isGoalComplete: every topic's quota met
 *   - generateRep(topics): serves ONE topic's stage as the 2+2+2 ladder, stamps
 *     topicId on every brick, climbs within the stage's tempo band
 *
 * Pure-function tests: no mocks, no clock, no I/O.
 */

import { describe, it, expect } from 'vitest';

import {
  deriveTopicProgress,
  resolveStage,
  selectTopicForRep,
  isGoalComplete,
} from '../topicLadder';
import { generateRep } from '../generateRep';
import type { TutorialBlock } from '../../types/block';
import type {
  ClimbState,
  RepResult,
  Stage,
  Topic,
} from '../../types/training';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------
function makeGrooveBlock(id: string, originalBpm = 100): TutorialBlock {
  return {
    id,
    type: 'groove-card',
    title: `Groove ${id}`,
    order: 0,
    config: {
      grooveId: id,
      title: `Groove ${id}`,
      subtitle: 'test',
      originalBpm,
      originalKey: 'E',
      lengthBars: 4,
      stems: {} as never,
      role: 'groove',
      completionCriterion: { type: 'conquer', targetTier: 'bronze' },
    } as TutorialBlock<'groove-card'>['config'],
  };
}

function stage(level: number, introduceAfterReps: number, opts: Partial<Stage> = {}): Stage {
  return {
    level,
    introduceAfterReps,
    blocks: [{ blockId: `g${level}`, block: makeGrooveBlock(`g${level}`) }],
    ...opts,
  };
}

function topic(id: string, repQuota: number, stages: Stage[]): Topic {
  return { id, title: `Topic ${id}`, repQuota, stages };
}

function makeRep(topicId: string | null, overrides: Partial<RepResult> = {}): RepResult {
  return {
    id: `rep-${topicId}-${Math.random()}`,
    userId: 'user-1',
    goalEnrollmentId: 'enroll-1',
    drillSessionId: null,
    blockId: 'block-x',
    ladderLevel: 'L2',
    tempoBpm: 100,
    topicId,
    signal: null,
    result: 'completed',
    achievedTier: null,
    completedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<ClimbState> = {}): ClimbState {
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

// ---------------------------------------------------------------------------
// resolveStage — self-paced level bump.
// ---------------------------------------------------------------------------
describe('resolveStage', () => {
  const t = topic('t', 12, [stage(1, 0), stage(2, 4), stage(3, 8)]);

  it('starts at stage 1 with no reps', () => {
    expect(resolveStage(t, 0).level).toBe(1);
  });
  it('holds stage 1 until the next threshold', () => {
    expect(resolveStage(t, 3).level).toBe(1);
  });
  it('bumps to stage 2 at its threshold', () => {
    expect(resolveStage(t, 4).level).toBe(2);
    expect(resolveStage(t, 7).level).toBe(2);
  });
  it('bumps to stage 3 at its threshold and stays', () => {
    expect(resolveStage(t, 8).level).toBe(3);
    expect(resolveStage(t, 100).level).toBe(3);
  });
  it('tolerates a mis-ordered stages array (sorts a copy)', () => {
    const messy = topic('t', 12, [stage(3, 8), stage(1, 0), stage(2, 4)]);
    expect(resolveStage(messy, 5).level).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// deriveTopicProgress — quota tally + completion + stage.
// ---------------------------------------------------------------------------
describe('deriveTopicProgress', () => {
  const topics = [
    topic('a', 12, [stage(1, 0), stage(2, 4)]),
    topic('b', 10, [stage(1, 0)]),
    topic('c', 8, [stage(1, 0)]),
  ];

  it('counts reps per topicId (ignoring null + other topics)', () => {
    const history = [
      makeRep('a'),
      makeRep('a'),
      makeRep('b'),
      makeRep(null), // a single-focal rep — counts for nothing
    ];
    const progress = deriveTopicProgress(topics, history);
    expect(progress.find((p) => p.topicId === 'a')?.repsLogged).toBe(2);
    expect(progress.find((p) => p.topicId === 'b')?.repsLogged).toBe(1);
    expect(progress.find((p) => p.topicId === 'c')?.repsLogged).toBe(0);
  });

  it('flags isComplete only when repsLogged >= repQuota', () => {
    const history = Array.from({ length: 10 }, () => makeRep('b'));
    const progress = deriveTopicProgress(topics, history);
    expect(progress.find((p) => p.topicId === 'b')?.isComplete).toBe(true);
    expect(progress.find((p) => p.topicId === 'a')?.isComplete).toBe(false);
  });

  it('reports the current stage level for each topic', () => {
    const history = Array.from({ length: 5 }, () => makeRep('a'));
    const progress = deriveTopicProgress(topics, history);
    // 5 reps in 'a' → stage 2 (threshold 4); 'b' untouched → stage 1.
    expect(progress.find((p) => p.topicId === 'a')?.currentStageLevel).toBe(2);
    expect(progress.find((p) => p.topicId === 'b')?.currentStageLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// selectTopicForRep — least-advanced active topic.
// ---------------------------------------------------------------------------
describe('selectTopicForRep', () => {
  const topics = [
    topic('a', 12, [stage(1, 0)]),
    topic('b', 10, [stage(1, 0)]),
    topic('c', 8, [stage(1, 0)]),
  ];

  it('serves the topic with the fewest reps logged', () => {
    const history = [makeRep('a'), makeRep('a'), makeRep('b')];
    const progress = deriveTopicProgress(topics, history);
    // a:2, b:1, c:0 → c is least-advanced.
    expect(selectTopicForRep(topics, progress)?.id).toBe('c');
  });

  it('breaks ties by authoring order (earlier topic leads at equal progress)', () => {
    const progress = deriveTopicProgress(topics, []); // all 0
    expect(selectTopicForRep(topics, progress)?.id).toBe('a');
  });

  it('drops a completed topic out of the rotation', () => {
    const history = [
      ...Array.from({ length: 8 }, () => makeRep('c')), // c complete (quota 8)
      makeRep('a'),
      makeRep('a'),
      makeRep('b'),
    ];
    const progress = deriveTopicProgress(topics, history);
    // c is done; among active a:2,b:1 → b.
    expect(selectTopicForRep(topics, progress)?.id).toBe('b');
  });

  it('returns null when every topic is complete', () => {
    const history = [
      ...Array.from({ length: 12 }, () => makeRep('a')),
      ...Array.from({ length: 10 }, () => makeRep('b')),
      ...Array.from({ length: 8 }, () => makeRep('c')),
    ];
    const progress = deriveTopicProgress(topics, history);
    expect(selectTopicForRep(topics, progress)).toBeNull();
    expect(isGoalComplete(progress)).toBe(true);
  });
});

describe('isGoalComplete', () => {
  it('is false for an empty progress list (no topics ≠ done)', () => {
    expect(isGoalComplete([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateRep — the topic-aware path.
// ---------------------------------------------------------------------------
describe('generateRep(topics) — content-ladder path', () => {
  const topics = [
    topic('hold', 12, [
      stage(1, 0, { tempoBand: [80, 100] }),
      stage(2, 4, { tempoBand: [90, 120] }),
    ]),
    topic('lock', 10, [stage(1, 0)]),
  ];

  it('serves the least-advanced topic as a 3-brick 2+2+2 ladder', () => {
    const bricks = generateRep(makeState(), { blocks: [] }, [], {
      goalType: 'feel',
      topics,
    });
    expect(bricks).toHaveLength(3);
    expect(bricks.map((b) => b.ladderPosition)).toEqual(['L1', 'L2', 'L3']);
  });

  it('stamps the chosen topicId on every brick', () => {
    // No reps → least-advanced = first topic 'hold'.
    const bricks = generateRep(makeState(), { blocks: [] }, [], {
      goalType: 'feel',
      topics,
    });
    for (const b of bricks) {
      expect((b.config as Record<string, unknown>).topicId).toBe('hold');
    }
  });

  it('switches the served topic as reps accrue (hold ahead → serve lock)', () => {
    const history = [makeRep('hold'), makeRep('hold')]; // hold:2, lock:0
    const bricks = generateRep(makeState(), { blocks: [] }, history, {
      goalType: 'feel',
      topics,
    });
    expect((bricks[0].config as Record<string, unknown>).topicId).toBe('lock');
  });

  it('climbs within the active stage tempo band (clamps the bracket)', () => {
    // currentPosition 100, notch 8 → L3 would be 108, but stage 1 band caps 100.
    const bricks = generateRep(makeState({ currentPosition: { tempoBpm: 100 } }), { blocks: [] }, [], {
      goalType: 'feel',
      topics,
      tempoNotchBpm: 8,
    });
    const l3 = bricks.find((b) => b.ladderPosition === 'L3');
    expect((l3?.config as Record<string, unknown>).tempoOverride).toBe(100);
  });

  it('uses the bumped stage band once the topic levels up', () => {
    // 4 reps in 'hold' → stage 2 (band 90–120); L3 at 108 now fits.
    const history = Array.from({ length: 4 }, () => makeRep('hold'));
    const bricks = generateRep(makeState({ currentPosition: { tempoBpm: 100 } }), { blocks: [] }, history, {
      goalType: 'feel',
      topics,
      tempoNotchBpm: 8,
    });
    const l3 = bricks.find((b) => b.ladderPosition === 'L3');
    expect((l3?.config as Record<string, unknown>).tempoOverride).toBe(108);
  });

  it('honors floor mode (one brick, still topic-stamped)', () => {
    const bricks = generateRep(makeState(), { blocks: [] }, [], {
      goalType: 'feel',
      topics,
      mode: 'floor',
    });
    expect(bricks).toHaveLength(1);
    expect((bricks[0].config as Record<string, unknown>).topicId).toBe('hold');
  });

  it('throws when the active stage has no inline blocks', () => {
    const empty = [topic('x', 5, [{ level: 1, introduceAfterReps: 0, blocks: [] }])];
    expect(() =>
      generateRep(makeState(), { blocks: [] }, [], { goalType: 'feel', topics: empty }),
    ).toThrow(/no inline blocks/i);
  });
});
