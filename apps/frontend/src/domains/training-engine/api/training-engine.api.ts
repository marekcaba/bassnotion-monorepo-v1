/**
 * Frontend API client for the backend training-engine endpoints.
 *
 * Uses the shared `apiClient` singleton (auth token attached automatically).
 * All endpoints are AuthGuard-protected on the backend → calls before login 401.
 */

import type { RepResult, RepResultInput } from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';

/**
 * POST /api/v1/training-engine/rep-results
 *
 * The RepResultSink's client side — appends one rep to the engine's append-only
 * history. A SIBLING write to the drill executor's `completeBlock`: the two
 * serve different purposes (block_completions = the drill UI's unlock/summary
 * state; rep_results = the engine's own source of truth that generateRep reads).
 */
export function appendRepResult(input: RepResultInput): Promise<RepResult> {
  return apiClient.post<RepResult>(
    '/api/v1/training-engine/rep-results',
    input,
  );
}

/** GET /api/v1/training-engine/enrollments/:enrollmentId/rep-results */
export function fetchRepHistory(enrollmentId: string): Promise<RepResult[]> {
  return apiClient.get<RepResult[]>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/rep-results`,
  );
}
