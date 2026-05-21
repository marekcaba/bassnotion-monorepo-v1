/**
 * useProgress — the single source of truth for tutorial progress on the
 * frontend.
 *
 * Wraps the backend's GET /api/v1/tutorials/:slug/progress endpoint with
 * TanStack Query. The backend computes unlock state server-side, so this
 * hook never needs to derive unlocks client-side — it just renders what
 * the server returned.
 *
 * Companion mutation hooks:
 *  - useCompleteBlock: mark a block complete (idempotent, server-validated)
 *  - useRecordPractice: log one practice rep, may auto-cascade-complete
 *    the parent exercise block
 *
 * Both mutations write back into the queryClient cache directly using the
 * response body (the backend returns the full updated progress), so we
 * never need to refetch after a write. No optimistic UI complexity, no
 * cache invalidation timing — the server's reply IS the new cache.
 *
 * Replaces the legacy hooks: useBlockProgress, usePracticeCompletions,
 * useTutorialProgress(Actions), useTutorialCompletionStatus,
 * useSingleTutorialProgress, useActCompletion. Those are deleted in PR 5.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GetTutorialProgressResponse,
  GetUserTutorialCompletionsResponse,
} from '@bassnotion/contracts';

import {
  completeBlock,
  fetchTutorialProgress,
  fetchUserTutorialCompletions,
  recordPractice,
} from '../api/progress.api';

/** Query key factory — keep all progress keys discoverable. */
export const progressKeys = {
  /** Per-tutorial progress for the current user */
  tutorial: (slug: string) => ['progress', 'tutorial', slug] as const,
  /** Library rollup — one summary entry per tutorial */
  summary: () => ['progress', 'summary'] as const,
} as const;

/**
 * Read the current user's progress for a tutorial. Returns undefined while
 * loading or when slug is falsy. The query is disabled until slug is set
 * AND the user is authenticated (passing `enabled` from the caller).
 */
export function useProgress(
  slug: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: progressKeys.tutorial(slug ?? ''),
    queryFn: () => {
      if (!slug) throw new Error('useProgress: slug is required');
      return fetchTutorialProgress(slug);
    },
    // Only fetch when we have a slug AND the caller hasn't disabled the
    // query (e.g. waiting for auth). Avoids 401 spam on logged-out routes.
    enabled: !!slug && (options?.enabled ?? true),
    // Progress changes infrequently relative to renders. 30s stale-time
    // means the same tutorial page mount + unmount cycle won't re-fetch.
    staleTime: 30_000,
  });
}

/**
 * Mark a block complete. Returns a mutation; call `.mutate({ blockId, data })`.
 * The query cache for this tutorial is replaced with the response — no
 * refetch needed, no race conditions.
 */
export function useCompleteBlock(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      blockId,
      data,
    }: {
      blockId: string;
      data?: Record<string, unknown>;
    }) => completeBlock(slug, blockId, data),
    onSuccess: (newProgress) => {
      queryClient.setQueryData<GetTutorialProgressResponse>(
        progressKeys.tutorial(slug),
        newProgress,
      );
      // The library summary rolls up completion across tutorials — invalidate
      // so it refetches the next time something subscribes. We don't try to
      // patch it in place because the summary endpoint has its own
      // exercise-block auto-complete derivation; an explicit re-fetch keeps
      // the truth on the server.
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
    },
  });
}

/**
 * Record one practice rep for an exercise. Call `.mutate({ exerciseId, tempoBpm })`.
 * On the server side, this may cascade-complete the parent exercise block;
 * the returned progress already reflects that, so the cache replacement
 * here is enough.
 */
export function useRecordPractice(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      exerciseId,
      tempoBpm,
    }: {
      exerciseId: string;
      tempoBpm?: number;
    }) => recordPractice(slug, exerciseId, tempoBpm),
    onSuccess: (newProgress) => {
      queryClient.setQueryData<GetTutorialProgressResponse>(
        progressKeys.tutorial(slug),
        newProgress,
      );
      // The library summary rolls up completion across tutorials — invalidate
      // so it refetches the next time something subscribes. We don't try to
      // patch it in place because the summary endpoint has its own
      // exercise-block auto-complete derivation; an explicit re-fetch keeps
      // the truth on the server.
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
    },
  });
}

/**
 * Library / sidebar rollup. Returns per-tutorial completion summaries for
 * the current user. Disabled until the caller signals the user is signed
 * in (otherwise we'd 401 on every logged-out page mount).
 */
export function useUserTutorialCompletions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: progressKeys.summary(),
    queryFn: fetchUserTutorialCompletions,
    enabled: options?.enabled ?? true,
    // The summary is cheap to compute but called from many places (sidebar,
    // dock, library). A 30s staleTime prevents thrashing the endpoint on
    // every component mount while still feeling fresh after a block-complete
    // invalidates this key.
    staleTime: 30_000,
  });
}

/**
 * Convenience: look up one tutorial's summary from the library rollup.
 * Returns undefined while loading or if no entry exists.
 */
export function useTutorialCompletionSummary(slug: string) {
  const query = useUserTutorialCompletions();
  return {
    ...query,
    data: query.data?.tutorials.find(
      (t): t is GetUserTutorialCompletionsResponse['tutorials'][number] =>
        t.slug === slug,
    ),
  };
}
