/**
 * Frontend API client for the backend progress endpoints.
 *
 * Uses the shared `apiClient` singleton so the auth token (set by
 * AuthProvider on session change) is included automatically. The
 * `NEXT_PUBLIC_API_URL` env var is the base URL.
 *
 * All endpoints are AuthGuard-protected on the backend; calls made
 * before login will 401.
 */

import type {
  GetTutorialProgressResponse,
  GetUserTutorialCompletionsResponse,
} from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';

/** GET /api/v1/tutorials/:slug/progress */
export function fetchTutorialProgress(
  slug: string,
): Promise<GetTutorialProgressResponse> {
  return apiClient.get<GetTutorialProgressResponse>(
    `/api/v1/tutorials/${encodeURIComponent(slug)}/progress`,
  );
}

/**
 * POST /api/v1/tutorials/:slug/blocks/:blockId/complete
 *
 * Idempotent. Returns the freshly computed full progress so the caller
 * can replace its cache atomically.
 */
export function completeBlock(
  slug: string,
  blockId: string,
  data?: Record<string, unknown>,
): Promise<GetTutorialProgressResponse> {
  return apiClient.post<GetTutorialProgressResponse>(
    `/api/v1/tutorials/${encodeURIComponent(slug)}/blocks/${encodeURIComponent(
      blockId,
    )}/complete`,
    { data },
  );
}

/**
 * POST /api/v1/tutorials/:slug/exercises/:exerciseId/practice
 *
 * Records one practice rep. If the rep causes the parent exercise block to
 * reach the all-exercises-meet-threshold rule, the backend auto-completes
 * the block in the same request — the returned progress reflects that.
 */
export function recordPractice(
  slug: string,
  exerciseId: string,
  tempoBpm?: number,
): Promise<GetTutorialProgressResponse> {
  return apiClient.post<GetTutorialProgressResponse>(
    `/api/v1/tutorials/${encodeURIComponent(slug)}/exercises/${encodeURIComponent(
      exerciseId,
    )}/practice`,
    { tempoBpm },
  );
}

/**
 * GET /api/v1/users/me/tutorial-completions
 *
 * Per-tutorial completion rollup for the library / sidebar. Returns one
 * summary entry per active tutorial.
 */
export function fetchUserTutorialCompletions(): Promise<GetUserTutorialCompletionsResponse> {
  return apiClient.get<GetUserTutorialCompletionsResponse>(
    `/api/v1/users/me/tutorial-completions`,
  );
}
