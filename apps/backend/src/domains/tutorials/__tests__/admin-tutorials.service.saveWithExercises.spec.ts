/**
 * AdminTutorialsService.saveWithExercises() — slug-collision retry tests.
 *
 * Same family of bug as create(): the slug is derived from the title,
 * and an UPDATE on the row was hitting `tutorials_slug_key` when a
 * different row already held the same slug (e.g. two drafts both
 * titled "Untitled Tutorial"). The fix appends -2, -3, … to the slug
 * until the UPDATE succeeds (up to 8 attempts).
 *
 * These tests only cover the slug-retry behaviour. Full
 * saveWithExercises behaviour (exercises create/update path, blocks
 * payload, etc.) is exercised by the existing integration tests.
 *
 * The test only exercises the tutorial-UPDATE step (Step 1 of
 * saveWithExercises). Step 2 (exercises) is mocked to a no-op via an
 * empty `dto.exercises` so the test doesn't need to mock the entire
 * downstream flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { AdminTutorialsService } from '../admin-tutorials.service.js';

interface UpdateCall {
  payload: Record<string, unknown>;
  eqId: string;
}

describe('AdminTutorialsService.saveWithExercises — slug-collision retry on UPDATE', () => {
  let service: AdminTutorialsService;
  let updateCalls: UpdateCall[];
  // Queue of responses to dispense from the `update().eq().select().single()`
  // chain in order, one per `.single()` invocation.
  let singleResponses: Array<{
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  }>;

  beforeEach(() => {
    updateCalls = [];
    singleResponses = [];

    const fromMock = (_table: string) => {
      let pendingPayload: Record<string, unknown> | null = null;
      let pendingEqId = '';

      const chain = {
        update: vi.fn((payload: Record<string, unknown>) => {
          pendingPayload = payload;
          return chain;
        }),
        eq: vi.fn((_col: string, id: string) => {
          pendingEqId = id;
          return chain;
        }),
        select: vi.fn(() => chain),
        single: vi.fn(async () => {
          updateCalls.push({
            payload: pendingPayload as Record<string, unknown>,
            eqId: pendingEqId,
          });
          const next = singleResponses.shift();
          if (!next) {
            throw new Error(
              'Test bug: update().eq().select().single() called more times than singleResponses has items',
            );
          }
          return next;
        }),
        // Methods exercised by the downstream Step 2 (exercises). Each
        // returns a chainable thenable that resolves to `{ data: [], error: null }`.
        delete: vi.fn(() => chain),
        in: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
        then: undefined as never,
      };
      return chain;
    };

    const mockSupabaseClient = { from: vi.fn(fromMock) };
    const mockSupabaseService = { getClient: () => mockSupabaseClient };

    service = new AdminTutorialsService(mockSupabaseService as never);
  });

  function makeDto(title: string, id = 'tut-1') {
    return {
      id,
      title,
      description: '',
      youtube_id: '',
      duration: 0,
      author_name: 'Marek',
      difficulty: 'beginner',
      category: 'rhythm',
      tags: [],
      is_active: true,
      blocks: [],
      exercises: [], // empty so Step 2 short-circuits
    } as never;
  }

  function slugCollision(slug: string) {
    return {
      data: null,
      error: {
        code: '23505',
        details: `Key (slug)=(${slug}) already exists.`,
        message:
          'duplicate key value violates unique constraint "tutorials_slug_key"',
      },
    };
  }

  function ok(row: Record<string, unknown>) {
    return { data: row, error: null };
  }

  // -------------------------------------------------------------------------
  it('happy path: clean UPDATE, no retry', async () => {
    singleResponses.push(ok({ id: 'tut-1', slug: 'my-tutorial' }));

    try {
      await service.saveWithExercises(makeDto('My Tutorial'), 'user-1');
    } catch {
      // The full method also runs exercises + return-fetch logic that
      // we haven't mocked; we only care that Step 1 succeeded without
      // retrying.
    }

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.payload.slug).toBe('my-tutorial');
    expect(updateCalls[0]!.eqId).toBe('tut-1');
  });

  // -------------------------------------------------------------------------
  it('PG 23505 on slug → retries with -2 suffix and succeeds', async () => {
    singleResponses.push(slugCollision('untitled-tutorial'));
    singleResponses.push(ok({ id: 'tut-1', slug: 'untitled-tutorial-2' }));

    try {
      await service.saveWithExercises(makeDto('Untitled Tutorial'), 'user-1');
    } catch {
      // exercises step uses unmocked code paths; ignore.
    }

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.map((c) => c.payload.slug)).toEqual([
      'untitled-tutorial',
      'untitled-tutorial-2',
    ]);
    // Both attempts target the same row.
    expect(updateCalls.every((c) => c.eqId === 'tut-1')).toBe(true);
  });

  // -------------------------------------------------------------------------
  it('multiple collisions escalate the suffix', async () => {
    singleResponses.push(slugCollision('untitled-tutorial'));
    singleResponses.push(slugCollision('untitled-tutorial-2'));
    singleResponses.push(slugCollision('untitled-tutorial-3'));
    singleResponses.push(ok({ id: 'tut-1', slug: 'untitled-tutorial-4' }));

    try {
      await service.saveWithExercises(makeDto('Untitled Tutorial'), 'user-1');
    } catch {
      // exercises step uses unmocked code paths; ignore.
    }

    expect(updateCalls.map((c) => c.payload.slug)).toEqual([
      'untitled-tutorial',
      'untitled-tutorial-2',
      'untitled-tutorial-3',
      'untitled-tutorial-4',
    ]);
  });

  // -------------------------------------------------------------------------
  it('non-23505 error does NOT retry; throws', async () => {
    singleResponses.push({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });

    await expect(
      service.saveWithExercises(makeDto('My Tutorial'), 'user-1'),
    ).rejects.toThrow(/Failed to update tutorial/);

    expect(updateCalls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  it('PG 23505 on a non-slug constraint does NOT retry; throws', async () => {
    singleResponses.push({
      data: null,
      error: {
        code: '23505',
        details: 'Key (some_other_col)=(x) already exists.',
        message: 'duplicate key value',
      },
    });

    await expect(
      service.saveWithExercises(makeDto('My Tutorial'), 'user-1'),
    ).rejects.toThrow(/Failed to update tutorial/);

    expect(updateCalls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  it('8 collisions in a row → ConflictException', async () => {
    for (let i = 0; i < 8; i++) {
      singleResponses.push(
        slugCollision(
          i === 0 ? 'untitled-tutorial' : `untitled-tutorial-${i + 1}`,
        ),
      );
    }

    await expect(
      service.saveWithExercises(makeDto('Untitled Tutorial'), 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(updateCalls).toHaveLength(8);
  });

  // -------------------------------------------------------------------------
  it('empty title falls back to "untitled-tutorial" base slug', async () => {
    singleResponses.push(ok({ id: 'tut-1', slug: 'untitled-tutorial' }));

    try {
      await service.saveWithExercises(makeDto('   '), 'user-1');
    } catch {
      // exercises step uses unmocked code paths; ignore.
    }

    expect(updateCalls[0]!.payload.slug).toBe('untitled-tutorial');
  });
});
