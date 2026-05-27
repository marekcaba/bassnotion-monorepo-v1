/**
 * AdminTutorialsService.create() — duplicate-slug retry tests.
 *
 * Reproduces the "PG 23505 duplicate key value violates unique
 * constraint 'tutorials_slug_key'" 500 surfaced when a user clicked
 * "Create New Tutorial" with a default-titled draft already in the DB.
 * The fix appends -2, -3, … suffixes to the slug until the insert
 * succeeds (up to 8 attempts).
 *
 * Verifies:
 *   - Happy path: clean insert returns the row, no retry
 *   - PG 23505 on slug → retries with `-2` suffix and succeeds
 *   - Multiple collisions → escalates suffix; eventually succeeds
 *   - Empty-title path: falls back to base slug 'untitled-tutorial'
 *   - PG 23505 on a non-slug column → does NOT retry, throws original error
 *   - Non-23505 error → does NOT retry, throws original error
 *   - All 8 attempts collide → throws ConflictException
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { AdminTutorialsService } from '../admin-tutorials.service.js';

interface InsertCall {
  payload: Record<string, unknown>;
}

interface SupabaseFromMock {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

describe('AdminTutorialsService.create — slug-collision retry', () => {
  let service: AdminTutorialsService;
  let mockSupabaseService: { getClient: () => unknown };
  let insertCalls: InsertCall[];
  // Queue of responses to dispense in order, one per .single() invocation.
  let singleResponses: Array<{
    data: Record<string, unknown> | null;
    error: { code?: string; details?: string; message?: string } | null;
  }>;

  beforeEach(() => {
    insertCalls = [];
    singleResponses = [];

    const fromMock = () => {
      const chain: SupabaseFromMock = {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertCalls.push({ payload });
          return chain;
        }) as ReturnType<typeof vi.fn>,
        select: vi.fn(() => chain) as ReturnType<typeof vi.fn>,
        single: vi.fn(async () => {
          const next = singleResponses.shift();
          if (!next) {
            throw new Error(
              'Test bug: insert().select().single() called more times than singleResponses has items',
            );
          }
          return next;
        }) as ReturnType<typeof vi.fn>,
      };
      return chain;
    };

    const mockSupabaseClient = {
      from: vi.fn(fromMock),
    };

    mockSupabaseService = {
      getClient: () => mockSupabaseClient,
    };

    service = new AdminTutorialsService(mockSupabaseService as never);
  });

  function makeDto(title: string) {
    return {
      title,
      created_by: 'user-1',
      description: '',
      youtube_id: '',
      duration: 0,
      author_name: 'Marek',
      difficulty: 'beginner',
      category: 'rhythm',
      tags: [],
      is_active: true,
    } as never;
  }

  function uniqueSlugViolation(slug: string) {
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
  it('happy path: a clean insert returns the row and never retries', async () => {
    singleResponses.push(ok({ id: 't-1', slug: 'untitled-tutorial' }));
    const result = await service.create(makeDto('Untitled Tutorial'));
    expect(result).toEqual({ id: 't-1', slug: 'untitled-tutorial' });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]!.payload.slug).toBe('untitled-tutorial');
  });

  // -------------------------------------------------------------------------
  it('PG 23505 on slug → retries with -2 suffix and succeeds', async () => {
    singleResponses.push(uniqueSlugViolation('untitled-tutorial'));
    singleResponses.push(ok({ id: 't-2', slug: 'untitled-tutorial-2' }));

    const result = await service.create(makeDto('Untitled Tutorial'));
    expect(result).toEqual({ id: 't-2', slug: 'untitled-tutorial-2' });
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0]!.payload.slug).toBe('untitled-tutorial');
    expect(insertCalls[1]!.payload.slug).toBe('untitled-tutorial-2');
  });

  // -------------------------------------------------------------------------
  it('multiple collisions escalate the suffix', async () => {
    singleResponses.push(uniqueSlugViolation('untitled-tutorial'));
    singleResponses.push(uniqueSlugViolation('untitled-tutorial-2'));
    singleResponses.push(uniqueSlugViolation('untitled-tutorial-3'));
    singleResponses.push(ok({ id: 't-4', slug: 'untitled-tutorial-4' }));

    await service.create(makeDto('Untitled Tutorial'));
    expect(insertCalls.map((c) => c.payload.slug)).toEqual([
      'untitled-tutorial',
      'untitled-tutorial-2',
      'untitled-tutorial-3',
      'untitled-tutorial-4',
    ]);
  });

  // -------------------------------------------------------------------------
  it('empty / whitespace title falls back to "untitled-tutorial" base slug', async () => {
    singleResponses.push(ok({ id: 't-5', slug: 'untitled-tutorial' }));
    await service.create(makeDto('   '));
    expect(insertCalls[0]!.payload.slug).toBe('untitled-tutorial');
  });

  // -------------------------------------------------------------------------
  it('PG 23505 on a non-slug column does NOT retry; throws', async () => {
    singleResponses.push({
      data: null,
      error: {
        code: '23505',
        details: 'Key (some_other_col)=(x) already exists.',
        message: 'duplicate key value',
      },
    });
    await expect(service.create(makeDto('Foo'))).rejects.toThrow(
      'Failed to create tutorial',
    );
    expect(insertCalls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  it('non-23505 error does NOT retry; throws', async () => {
    singleResponses.push({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });
    await expect(service.create(makeDto('Foo'))).rejects.toThrow(
      'Failed to create tutorial',
    );
    expect(insertCalls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  it('exhausting all 8 attempts → ConflictException with a useful message', async () => {
    for (let i = 0; i < 8; i++) {
      singleResponses.push(
        uniqueSlugViolation(
          i === 0 ? 'untitled-tutorial' : `untitled-tutorial-${i + 1}`,
        ),
      );
    }
    await expect(
      service.create(makeDto('Untitled Tutorial')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(insertCalls).toHaveLength(8);
  });
});
