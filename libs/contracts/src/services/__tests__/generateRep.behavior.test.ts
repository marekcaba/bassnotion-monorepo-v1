/**
 * generateRep — behavior tests (Bass Gym Training Engine, Phase 0).
 *
 * Verifies the pure planner against the spec §14 Phase-0 acceptance list:
 *   - 2+2+2 bracketing (six ordered bricks, L1<L2<L3 tempos)
 *   - ceiling/floor clamps (50–180 BPM, ±6 key)
 *   - the type dial (SPEED implemented; others throw loudly)
 *   - difficulty_scalar back-off (tightens the bracket)
 *   - L1 spaced-review selection from rep_results history
 *
 * Pure-function tests: no mocks, no clock, no I/O.
 */

import { describe, it, expect } from 'vitest';

import {
  generateRep,
  selectReviewBlock,
  clampTempo,
  clampKey,
} from '../generateRep';
import type { TutorialBlock } from '../../types/block';
import type { BlockPool, ClimbState, RepResult } from '../../types/training';

// ---------------------------------------------------------------------------
// Test fixtures.
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

function makeRep(overrides: Partial<RepResult> = {}): RepResult {
  return {
    id: `rep-${Math.round(overrides.tempoBpm ?? 0)}`,
    userId: 'user-1',
    goalEnrollmentId: 'enroll-1',
    drillSessionId: null,
    blockId: 'block-x',
    ladderLevel: 'L2',
    tempoBpm: 100,
    signal: null,
    result: 'conquered',
    achievedTier: 'bronze',
    completedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const SPEED = { goalType: 'speed' as const };

describe('generateRep — clamps', () => {
  it('clampTempo bounds to [50, 180] and rounds', () => {
    expect(clampTempo(10)).toBe(50);
    expect(clampTempo(999)).toBe(180);
    expect(clampTempo(120.4)).toBe(120);
  });

  it('clampKey bounds to [-6, 6] and rounds', () => {
    expect(clampKey(-99)).toBe(-6);
    expect(clampKey(99)).toBe(6);
    expect(clampKey(2.6)).toBe(3);
  });
});

describe('generateRep — SPEED 2+2+2 bracketing', () => {
  it('returns exactly six ordered bricks', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(makeState(), pool, [], SPEED);

    expect(bricks).toHaveLength(6);
    // Strictly ascending order 0..5.
    expect(bricks.map((b) => b.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('brackets today (L2) with an easier L1 and a harder L3', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 100 } }),
      pool,
      [],
      SPEED,
    );

    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;

    // L1a/L1b (idx 0,1) < L2a/L2b (idx 2,3) < L3a/L3b (idx 4,5)
    expect(tempo(bricks[0])).toBe(92); // 100 - 8
    expect(tempo(bricks[1])).toBe(92);
    expect(tempo(bricks[2])).toBe(100); // today
    expect(tempo(bricks[3])).toBe(100);
    expect(tempo(bricks[4])).toBe(108); // 100 + 8
    expect(tempo(bricks[5])).toBe(108);
  });

  it('stamps a 2-minute timebox on every brick', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(makeState(), pool, [], SPEED);
    for (const b of bricks) {
      expect((b.config as { timeboxMinutes?: number }).timeboxMinutes).toBe(2);
    }
  });

  it('clamps the bracket against the floor (never below 50 BPM)', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 52 } }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    expect(tempo(bricks[0])).toBe(50); // 52 - 8 = 44 → clamped to 50
  });

  it('clamps the bracket against the ceiling (never above 180 BPM)', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 178 } }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    expect(tempo(bricks[4])).toBe(180); // 178 + 8 = 186 → clamped to 180
  });

  it('does not mutate the source pool block (purity)', () => {
    const focal = makeGrooveBlock('focal');
    const pool: BlockPool = { blocks: [focal] };
    generateRep(makeState(), pool, [], SPEED);
    expect(
      (focal.config as { tempoOverride?: number }).tempoOverride,
    ).toBeUndefined();
    expect(focal.order).toBe(0);
    expect(focal.id).toBe('focal');
  });

  it('throws on an empty block pool', () => {
    expect(() => generateRep(makeState(), { blocks: [] }, [], SPEED)).toThrow(
      /blocks is empty/i,
    );
  });
});

describe('generateRep — difficulty_scalar back-off', () => {
  it('a scalar < 1 tightens the bracket (eases the climb)', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 100 }, difficultyScalar: 0.5 }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    // notch = round(8 * 0.5) = 4
    expect(tempo(bricks[0])).toBe(96);
    expect(tempo(bricks[2])).toBe(100);
    expect(tempo(bricks[4])).toBe(104);
  });

  it('never collapses the notch below 1 BPM even at a tiny scalar', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(
      makeState({
        currentPosition: { tempoBpm: 100 },
        difficultyScalar: 0.001,
      }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    expect(tempo(bricks[0])).toBe(99); // notch floored to 1
    expect(tempo(bricks[4])).toBe(101);
  });
});

describe('selectReviewBlock — L1 spaced review from rep_results', () => {
  it('returns null before any wins', () => {
    expect(selectReviewBlock([])).toBeNull();
    expect(
      selectReviewBlock([makeRep({ result: 'released', blockId: 'a' })]),
    ).toBeNull();
  });

  it('picks the oldest-not-seen conquered block', () => {
    const history: RepResult[] = [
      makeRep({ blockId: 'new', completedAt: '2026-06-10T00:00:00.000Z' }),
      makeRep({ blockId: 'old', completedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    expect(selectReviewBlock(history)).toBe('old');
  });

  it('tie-breaks same-recency blocks by weakest achieved tier', () => {
    const history: RepResult[] = [
      makeRep({
        blockId: 'gold',
        completedAt: '2026-06-01T00:00:00.000Z',
        achievedTier: 'gold',
      }),
      makeRep({
        blockId: 'bronze',
        completedAt: '2026-06-01T00:00:00.000Z',
        achievedTier: 'bronze',
      }),
    ];
    expect(selectReviewBlock(history)).toBe('bronze');
  });

  it('uses the LATEST completion per block for recency', () => {
    const history: RepResult[] = [
      makeRep({ blockId: 'a', completedAt: '2026-06-01T00:00:00.000Z' }),
      makeRep({ blockId: 'a', completedAt: '2026-06-12T00:00:00.000Z' }), // a re-seen recently
      makeRep({ blockId: 'b', completedAt: '2026-06-05T00:00:00.000Z' }),
    ];
    // 'a' was last seen 06-12, 'b' last seen 06-05 → b is older → review b.
    expect(selectReviewBlock(history)).toBe('b');
  });
});

describe('generateRep — L1 uses the review block when wins exist', () => {
  it('L1 bricks point at the reviewed block, L2/L3 at the focal block', () => {
    const focal = makeGrooveBlock('focal');
    const review = makeGrooveBlock('review-me');
    const pool: BlockPool = { blocks: [focal, review] };
    const history: RepResult[] = [
      makeRep({
        blockId: 'review-me',
        completedAt: '2026-06-01T00:00:00.000Z',
      }),
    ];
    const bricks = generateRep(makeState(), pool, history, SPEED);

    // Brick ids are derived from the source block id.
    expect(bricks[0].id).toContain('review-me');
    expect(bricks[1].id).toContain('review-me');
    expect(bricks[2].id).toContain('focal');
    expect(bricks[4].id).toContain('focal');
  });

  it('before wins, L1 falls back to the focal block', () => {
    const focal = makeGrooveBlock('focal');
    const pool: BlockPool = { blocks: [focal] };
    const bricks = generateRep(makeState(), pool, [], SPEED);
    expect(bricks[0].id).toContain('focal');
  });
});

function makeTaskBlock(id: string, instruction: string): TutorialBlock {
  return {
    id,
    type: 'task',
    title: `Task ${id}`,
    order: 0,
    config: {
      instruction,
      completionCriterion: { type: 'time', target: 2 },
    } as TutorialBlock<'task'>['config'],
  };
}

describe('generateRep — task blocks (no-audio SPEED, the seed path)', () => {
  it('interpolates the per-level tempo into the {tempo} instruction token', () => {
    const pool: BlockPool = {
      blocks: [makeTaskBlock('scale', 'Play C major at {tempo} BPM, clean.')],
    };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 100 } }),
      pool,
      [],
      SPEED,
    );
    const instr = (b: TutorialBlock) =>
      (b.config as { instruction?: string }).instruction;
    expect(instr(bricks[0])).toBe('Play C major at 92 BPM, clean.'); // L1
    expect(instr(bricks[2])).toBe('Play C major at 100 BPM, clean.'); // L2
    expect(instr(bricks[4])).toBe('Play C major at 108 BPM, clean.'); // L3
  });

  it('also stamps tempoOverride + the timebox on a task brick', () => {
    const pool: BlockPool = {
      blocks: [makeTaskBlock('scale', 'Play at {tempo}.')],
    };
    const bricks = generateRep(makeState(), pool, [], SPEED);
    const cfg = bricks[2].config as {
      tempoOverride?: number;
      timeboxMinutes?: number;
    };
    expect(cfg.tempoOverride).toBe(100);
    expect(cfg.timeboxMinutes).toBe(2);
  });

  it('leaves an instruction without a {tempo} token unchanged', () => {
    const pool: BlockPool = {
      blocks: [makeTaskBlock('scale', 'Practice slowly and cleanly.')],
    };
    const bricks = generateRep(makeState(), pool, [], SPEED);
    expect((bricks[0].config as { instruction?: string }).instruction).toBe(
      'Practice slowly and cleanly.',
    );
  });
});

describe('generateRep — the SEED goal block shape (drift guard)', () => {
  // This is the EXACT block the seed migration 20260613000003 embeds in the
  // goal_snapshot's block_set (verified applied to real Postgres). Kept here so
  // a change to the seed's shape that would break the planner fails a unit test
  // — the mocked service test can't catch a seed↔engine drift on its own.
  const SEED_FOCAL_BLOCK: TutorialBlock = {
    id: 'speed-c-major-scale-focal',
    type: 'task',
    title: 'C Major Scale',
    order: 0,
    tempoRange: { min: 60, max: 160 },
    config: {
      heading: 'C Major Scale',
      instruction:
        'Play the C major scale (two octaves, up and down) at {tempo} BPM. Keep it even and relaxed — no rushing.',
      completionCriterion: { type: 'time', target: 2 },
    } as TutorialBlock<'task'>['config'],
  };

  it('plans a valid 2+2+2 rep with the tempo interpolated into the real instruction', () => {
    const pool: BlockPool = { blocks: [SEED_FOCAL_BLOCK] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 90 } }),
      pool,
      [],
      SPEED,
    );
    expect(bricks).toHaveLength(6);
    const instr = (b: TutorialBlock) =>
      (b.config as { instruction?: string }).instruction;
    // L1 = 82 BPM, interpolated into the seed's real instruction copy.
    expect(instr(bricks[0])).toContain('at 82 BPM');
    expect(instr(bricks[0])).toContain('two octaves');
    expect(instr(bricks[2])).toContain('at 90 BPM');
    expect(instr(bricks[4])).toContain('at 98 BPM');
    // The seed's tempoRange (60–160) is wide enough not to clamp these.
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    expect(tempo(bricks[0])).toBe(82);
    expect(tempo(bricks[4])).toBe(98);
  });
});

describe('generateRep — tempoRange + ladderPosition labels (§13)', () => {
  it('clamps the emitted tempo into the block authored tempoRange', () => {
    const block = makeGrooveBlock('focal');
    block.tempoRange = { min: 95, max: 105 };
    const pool: BlockPool = { blocks: [block] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 100 } }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    expect(tempo(bricks[0])).toBe(95); // 92 -> floored to range min 95
    expect(tempo(bricks[2])).toBe(100); // within range
    expect(tempo(bricks[4])).toBe(105); // 108 -> capped to range max 105
  });

  it('normalizes an inverted tempoRange (min>max) instead of emitting garbage', () => {
    const block = makeGrooveBlock('focal');
    block.tempoRange = { min: 160, max: 60 }; // mis-authored, swapped
    const pool: BlockPool = { blocks: [block] };
    const bricks = generateRep(
      makeState({ currentPosition: { tempoBpm: 100 } }),
      pool,
      [],
      SPEED,
    );
    const tempo = (b: TutorialBlock) =>
      (b.config as { tempoOverride?: number }).tempoOverride;
    // Normalized to [60,160] → 92/100/108 all pass through, NOT pinned to 160.
    expect(tempo(bricks[0])).toBe(92);
    expect(tempo(bricks[2])).toBe(100);
    expect(tempo(bricks[4])).toBe(108);
  });

  it('stamps ladderPosition on every emitted brick', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    const bricks = generateRep(makeState(), pool, [], SPEED);
    expect(bricks.map((b) => b.ladderPosition)).toEqual([
      'L1',
      'L1',
      'L2',
      'L2',
      'L3',
      'L3',
    ]);
  });
});

describe('generateRep — type dial', () => {
  it('SPEED is implemented', () => {
    const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
    expect(() => generateRep(makeState(), pool, [], SPEED)).not.toThrow();
  });

  it.each(['knowledge', 'vocabulary', 'feel'] as const)(
    'throws a clear not-implemented error for %s (Phase 0 = SPEED only)',
    (goalType) => {
      const pool: BlockPool = { blocks: [makeGrooveBlock('focal')] };
      expect(() => generateRep(makeState(), pool, [], { goalType })).toThrow(
        /not implemented yet/i,
      );
    },
  );
});
