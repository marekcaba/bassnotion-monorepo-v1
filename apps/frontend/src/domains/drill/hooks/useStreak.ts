'use client';

/**
 * useStreak — the user's practice streak (Practice Bridge).
 *
 *  - useStreak()           → read the current consecutive-day streak
 *  - useRecordSession()    → mark a drill session completed (bumps the streak),
 *                            called when a drill reaches its summary screen
 *
 * Mirrors use-user-profile.ts: pull the Supabase session token, set it on the
 * shared apiClient, hit /api/v1/users/me/practice-streak. Auth-gated so logged-
 * out pages don't 401-spam.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GetPracticeStreakResponse } from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/domains/user/hooks/use-auth';

const STREAK_PATH = '/api/v1/users/me/practice-streak';

const streakKeys = {
  current: (userId?: string) => ['practice-streak', userId] as const,
};

async function authToken(): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }
  apiClient.setAuthToken(session.access_token);
}

async function fetchStreak(): Promise<GetPracticeStreakResponse> {
  await authToken();
  return apiClient.get<GetPracticeStreakResponse>(STREAK_PATH);
}

async function postSessionCompleted(): Promise<GetPracticeStreakResponse> {
  await authToken();
  return apiClient.post<GetPracticeStreakResponse>(STREAK_PATH);
}

/** Read the user's current practice streak. Undefined while loading/disabled. */
export function useStreak() {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: streakKeys.current(user?.id),
    queryFn: fetchStreak,
    enabled: !!isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        error.message.includes('not authenticated')
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Record that the user completed a drill session today. Idempotent server-side
 * (one bump per calendar day). On success, primes the streak query cache so the
 * dashboard reflects the new count without a refetch.
 */
export function useRecordSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSessionCompleted,
    onSuccess: (data) => {
      queryClient.setQueryData<GetPracticeStreakResponse>(
        streakKeys.current(user?.id),
        data,
      );
    },
  });
}
