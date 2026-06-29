'use client';

/**
 * useTakeHistory — the user's submitted RECORDINGS (graded takes), newest-first,
 * each carrying a short-lived signed audio URL for playback.
 *
 * Mirrors the domain's other data hooks (useGymExerciseLibrary): a thin wrapper
 * over TanStack Query, gated on auth so the AuthGuard-protected GET never fires a
 * 401 before login. The query key is USER-SCOPED (gymKeys) so a cached/prefetched
 * entry can't leak across an account switch. The signed URLs are short-lived, so
 * the data is treated as fresh only briefly (staleTime) and re-fetched on demand
 * via `refetch`.
 *
 * The returned shape is intentionally narrow ({ takes, isLoading, error, refetch })
 * so consumers don't depend on the full TanStack result surface.
 */

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TakeResultWithSignedUrl } from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import { fetchMyTakeHistory } from '../api/training-engine.api';
import { gymKeys } from '../api/gymQueryKeys';

export interface UseTakeHistoryResult {
  takes: TakeResultWithSignedUrl[];
  isLoading: boolean;
  /** A human-readable message when the fetch failed, else null. */
  error: string | null;
  refetch: () => void;
}

export function useTakeHistory(): UseTakeHistoryResult {
  // Gate on isAuthenticatedSync (user + session + INITIALIZED), not isAuthenticated: on a fresh
  // page load (e.g. landing on /backstage) the store can briefly report a user/session before the
  // Supabase session is hydrated, so the fetch fires with no token → 401 → empty list. Waiting for
  // `isInitialized` avoids that tokenless first call.
  const { isAuthenticatedSync, user } = useAuth();

  const query = useQuery<TakeResultWithSignedUrl[]>({
    // queryClient.clear() fires on identity change; the userId segment is
    // belt-and-suspenders so a prefetched entry can't survive an account switch.
    queryKey: gymKeys.takeHistory(user?.id ?? 'anon'),
    queryFn: fetchMyTakeHistory,
    enabled: isAuthenticatedSync,
    // Signed URLs are short-lived — keep the window modest so playback links stay valid.
    staleTime: 60 * 1000,
    // Retry a transient auth race (session not yet hydrated → "User not authenticated"): a couple
    // of quick retries cover the hydration gap without hammering on a genuine auth failure.
    retry: 2,
    retryDelay: 400,
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    takes: query.data ?? [],
    // `isLoading` is false for a disabled (pre-auth) query, so only report
    // loading once the fetch is actually in flight.
    isLoading: query.isLoading && query.fetchStatus !== 'idle',
    error: query.error ? 'Could not load your recordings.' : null,
    refetch,
  };
}
