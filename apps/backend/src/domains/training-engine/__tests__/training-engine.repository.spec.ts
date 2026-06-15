import { describe, it, expect, beforeEach, vi } from 'vitest';

import { TrainingEngineRepository } from '../repositories/training-engine.repository.js';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import type { RequestContextService } from '../../../shared/services/request-context.service.js';
import type { RepResultRow } from '../types/training-engine.types.js';

const REP_ROW: RepResultRow = {
  id: 'rep-1',
  user_id: 'user-1',
  goal_enrollment_id: 'enroll-1',
  drill_session_id: 'sess-1',
  block_id: 'block-1',
  ladder_level: 'L2',
  tempo_bpm: 120,
  signal_kind: 'button',
  signal_value: { kind: 'button', value: 1, at: 7 },
  result: 'conquered',
  achieved_tier: 'silver',
  completed_at: '2026-06-10T00:00:00.000Z',
};

function makeRepo() {
  const client: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(() => client),
    select: vi.fn(() => client),
    insert: vi.fn(() => client),
    update: vi.fn(() => client),
    upsert: vi.fn(() => client),
    eq: vi.fn(() => client),
    order: vi.fn(() => client),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const supabase = {
    getClient: vi.fn(() => client),
  } as unknown as SupabaseService;
  const requestContext = {
    getLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    getCorrelationId: () => 'corr-1',
  } as unknown as RequestContextService;

  const repo = new TrainingEngineRepository(supabase, requestContext);
  return { repo, client };
}

describe('TrainingEngineRepository.insertRepResult', () => {
  it('writes snake_case columns and derives signal_kind from the signal', async () => {
    const { repo, client } = makeRepo();
    client.single.mockResolvedValue({ data: REP_ROW, error: null });

    await repo.insertRepResult({
      userId: 'user-1',
      goalEnrollmentId: 'enroll-1',
      drillSessionId: 'sess-1',
      blockId: 'block-1',
      ladderLevel: 'L2',
      tempoBpm: 120,
      signal: { kind: 'button', value: 1, at: 7 },
      result: 'conquered',
      achievedTier: 'silver',
    });

    expect(client.from).toHaveBeenCalledWith('rep_results');
    const payload = client.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: 'user-1',
      goal_enrollment_id: 'enroll-1',
      drill_session_id: 'sess-1',
      block_id: 'block-1',
      ladder_level: 'L2',
      tempo_bpm: 120,
      signal_kind: 'button',
      result: 'conquered',
      achieved_tier: 'silver',
    });
    // signal_value stores the whole signal object.
    expect(payload.signal_value).toEqual({ kind: 'button', value: 1, at: 7 });
  });

  it('maps the inserted row back to a camelCase RepResult', async () => {
    const { repo, client } = makeRepo();
    client.single.mockResolvedValue({ data: REP_ROW, error: null });

    const result = await repo.insertRepResult({
      userId: 'user-1',
      goalEnrollmentId: 'enroll-1',
      blockId: 'block-1',
      ladderLevel: 'L2',
      signal: { kind: 'button', value: 1, at: 7 },
      result: 'conquered',
    });

    expect(result).toEqual({
      id: 'rep-1',
      userId: 'user-1',
      goalEnrollmentId: 'enroll-1',
      drillSessionId: 'sess-1',
      blockId: 'block-1',
      ladderLevel: 'L2',
      tempoBpm: 120,
      signal: { kind: 'button', value: 1, at: 7 },
      result: 'conquered',
      achievedTier: 'silver',
      completedAt: '2026-06-10T00:00:00.000Z',
    });
  });

  it('handles a null signal (floor rep / stub widget) without error', async () => {
    const { repo, client } = makeRepo();
    client.single.mockResolvedValue({
      data: {
        ...REP_ROW,
        signal_kind: null,
        signal_value: null,
        tempo_bpm: null,
      },
      error: null,
    });

    const result = await repo.insertRepResult({
      userId: 'user-1',
      goalEnrollmentId: 'enroll-1',
      blockId: 'block-1',
      ladderLevel: 'L1',
      signal: null,
      result: 'completed',
    });

    const payload = client.insert.mock.calls[0][0];
    expect(payload.signal_kind).toBeNull();
    expect(payload.signal_value).toBeNull();
    expect(result.signal).toBeNull();
  });

  it('throws when Supabase returns an error', async () => {
    const { repo, client } = makeRepo();
    client.single.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(
      repo.insertRepResult({
        userId: 'user-1',
        goalEnrollmentId: 'enroll-1',
        blockId: 'block-1',
        ladderLevel: 'L2',
        signal: null,
        result: 'conquered',
      }),
    ).rejects.toBeTruthy();
  });
});

describe('TrainingEngineRepository.upsertVirtualTutorial', () => {
  it('upserts on the slug conflict with training-engine tags + published', async () => {
    const { repo, client } = makeRepo();
    // upsert is the terminal call here (the repo awaits its result directly),
    // so it resolves to { error } rather than returning the chainable builder.
    client.upsert.mockResolvedValue({ error: null });

    await repo.upsertVirtualTutorial({
      slug: 'training-rep-enroll-1',
      title: 'Daily Rep',
      blocks: [],
    });

    expect(client.from).toHaveBeenCalledWith('tutorials');
    const [row, opts] = client.upsert.mock.calls[0];
    expect(row).toMatchObject({
      slug: 'training-rep-enroll-1',
      title: 'Daily Rep',
      is_active: true,
      status: 'published',
      tags: ['training-engine'],
    });
    expect(opts).toEqual({ onConflict: 'slug', ignoreDuplicates: false });
  });
});

describe('TrainingEngineRepository.findEnrollmentById', () => {
  it("returns null when no row is found (not the user's enrollment)", async () => {
    const { repo, client } = makeRepo();
    client.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await repo.findEnrollmentById('user-1', 'enroll-x');
    expect(result).toBeNull();
    expect(client.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
