/**
 * AdminTutorialsService.publish() / unpublish() — status-enum sync tests.
 *
 * Reproduces the bug where `publish()` and `unpublish()` historically
 * only flipped `is_active` and `published_at`, leaving the `status`
 * enum at 'draft'. The newer RLS policy (migration 20250923000003)
 * gates anon SELECT on `status = 'published'`, so a "published"
 * tutorial would still be invisible to public consumers (e.g. the
 * waitlist SSR fetch) until `status` also moved.
 *
 * Verifies that BOTH legacy fields (`is_active`, `published_at`) AND
 * the new `status` enum are updated together in a single write.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminTutorialsService } from '../admin-tutorials.service.js';

interface SupabaseUpdateMock {
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

describe('AdminTutorialsService.publish / unpublish — status enum sync', () => {
  let service: AdminTutorialsService;
  let updatePayloads: Array<Record<string, unknown>>;
  let singleResponse: {
    data: Record<string, unknown> | null;
    error: { code?: string; message?: string } | null;
  };

  beforeEach(() => {
    updatePayloads = [];
    singleResponse = {
      data: { id: 'tutorial-1', status: 'published' },
      error: null,
    };

    const fromMock = () => {
      const chain: SupabaseUpdateMock = {
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return chain;
        }) as ReturnType<typeof vi.fn>,
        eq: vi.fn(() => chain) as ReturnType<typeof vi.fn>,
        select: vi.fn(() => chain) as ReturnType<typeof vi.fn>,
        single: vi.fn(async () => singleResponse) as ReturnType<typeof vi.fn>,
      };
      return chain;
    };

    const mockSupabaseClient = { from: vi.fn(fromMock) };
    const mockSupabaseService = {
      getClient: () => mockSupabaseClient,
    };

    service = new AdminTutorialsService(mockSupabaseService as never);
  });

  it('publish() sets status="published", is_active=true, and published_at together', async () => {
    await service.publish('tutorial-1');

    expect(updatePayloads).toHaveLength(1);
    const payload = updatePayloads[0]!;
    expect(payload.status).toBe('published');
    expect(payload.is_active).toBe(true);
    expect(typeof payload.published_at).toBe('string');
    expect(typeof payload.updated_at).toBe('string');
  });

  it('unpublish() resets status="draft", clears is_active, and nulls published_at', async () => {
    singleResponse = {
      data: { id: 'tutorial-1', status: 'draft' },
      error: null,
    };

    await service.unpublish('tutorial-1');

    expect(updatePayloads).toHaveLength(1);
    const payload = updatePayloads[0]!;
    expect(payload.status).toBe('draft');
    expect(payload.is_active).toBe(false);
    expect(payload.published_at).toBeNull();
    expect(typeof payload.updated_at).toBe('string');
  });

  it('publish() returns null when the row is missing (PGRST116)', async () => {
    singleResponse = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await service.publish('nonexistent');
    expect(result).toBeNull();
  });

  it('unpublish() returns null when the row is missing (PGRST116)', async () => {
    singleResponse = {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    };

    const result = await service.unpublish('nonexistent');
    expect(result).toBeNull();
  });
});
