/**
 * Frontend API client for the backend training-engine endpoints.
 *
 * Uses the shared `apiClient` singleton (auth token attached automatically).
 * All endpoints are AuthGuard-protected on the backend → calls before login 401.
 */

import type {
  RepResult,
  RepResultInput,
  GoalEnrollment,
  TutorialBlock,
} from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';

/** GET /api/v1/training-engine/enrollments — the caller's goal enrollments. */
export function fetchMyEnrollments(): Promise<GoalEnrollment[]> {
  return apiClient.get<GoalEnrollment[]>('/api/v1/training-engine/enrollments');
}

/** POST /api/v1/training-engine/goals/:slug/enroll — idempotent enroll. */
export function enrollInGoal(slug: string): Promise<GoalEnrollment> {
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/goals/${encodeURIComponent(slug)}/enroll`,
  );
}

/**
 * POST /api/v1/training-engine/enrollments/:id/today-rep — plan + mint today's
 * rep; returns the virtual-tutorial slug the gym renders through.
 */
export function planTodayRep(
  enrollmentId: string,
): Promise<{ slug: string; bricks: TutorialBlock[] }> {
  return apiClient.post<{ slug: string; bricks: TutorialBlock[] }>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/today-rep`,
  );
}

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
