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
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  TopicProgress,
} from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/infrastructure/supabase/client';

/**
 * Attach the current Supabase session token to the shared apiClient before an
 * authed call. Mirrors useStreak/use-user-profile: these endpoints are
 * AuthGuard-protected, and the gym hooks can fire before AuthProvider has set
 * the token on mount — so we set it here per-call rather than rely on ordering.
 * Throws if there is no session (caller gates on isAuthenticated upstream).
 */
async function ensureAuthToken(): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }
  apiClient.setAuthToken(session.access_token);
}

/** GET /api/v1/training-engine/enrollments — the caller's goal enrollments. */
export async function fetchMyEnrollments(): Promise<GoalEnrollment[]> {
  await ensureAuthToken();
  return apiClient.get<GoalEnrollment[]>('/api/v1/training-engine/enrollments');
}

/**
 * POST /api/v1/training-engine/goals/:slug/enroll — idempotent enroll.
 * Optional `startTempoBpm` is the placement (where the climb starts); absent
 * falls back to the goal target server-side.
 */
export async function enrollInGoal(
  slug: string,
  startTempoBpm?: number,
): Promise<GoalEnrollment> {
  await ensureAuthToken();
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/goals/${encodeURIComponent(slug)}/enroll`,
    typeof startTempoBpm === 'number' ? { startTempoBpm } : {},
  );
}

/**
 * POST /api/v1/training-engine/enrollments/:id/today-rep — plan + mint today's
 * rep; returns the virtual-tutorial slug the gym renders through.
 */
export async function planTodayRep(
  enrollmentId: string,
  /** Story 5: 'floor' plans the short 3-min session; default 'full'. */
  mode: 'full' | 'floor' = 'full',
): Promise<{
  slug: string;
  bricks: TutorialBlock[];
  /** Content-ladder (Build B): per-topic quota bars for the gym path view.
   *  Present only on a multi-topic goal; absent for single-focal SPEED. */
  topicProgress?: TopicProgress[];
}> {
  await ensureAuthToken();
  return apiClient.post<{
    slug: string;
    bricks: TutorialBlock[];
    topicProgress?: TopicProgress[];
  }>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/today-rep`,
    { mode },
  );
}

/** GET .../enrollments/:id/graduation — read-time day-30 summary (no mutation). */
export async function fetchGraduation(
  enrollmentId: string,
): Promise<GraduationSummary> {
  await ensureAuthToken();
  return apiClient.get<GraduationSummary>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/graduation`,
  );
}

/** GET .../enrollments/:id/month-in-review — the day-30 recap (Story 6). */
export async function fetchMonthInReview(
  enrollmentId: string,
): Promise<MonthInReview> {
  await ensureAuthToken();
  return apiClient.get<MonthInReview>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/month-in-review`,
  );
}

/** POST .../enrollments/:id/graduate — walk through one of the 3 doors. */
export async function graduate(
  enrollmentId: string,
  door: GraduationDoor,
): Promise<GoalEnrollment> {
  await ensureAuthToken();
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/graduate`,
    { door },
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
export async function appendRepResult(
  input: RepResultInput,
): Promise<RepResult> {
  await ensureAuthToken();
  return apiClient.post<RepResult>(
    '/api/v1/training-engine/rep-results',
    input,
  );
}

/** GET /api/v1/training-engine/enrollments/:enrollmentId/rep-results */
export async function fetchRepHistory(
  enrollmentId: string,
): Promise<RepResult[]> {
  await ensureAuthToken();
  return apiClient.get<RepResult[]>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/rep-results`,
  );
}
