'use client';

/**
 * Likes Hooks
 *
 * TanStack Query hooks for exercise likes with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import * as likesApi from '../api/likes';
import type { ExerciseLikeStatusResponse } from '@bassnotion/contracts';

// Query keys
export const likeKeys = {
  all: ['likes'] as const,
  status: (exerciseId: string) =>
    [...likeKeys.all, 'status', exerciseId] as const,
  bulk: (exerciseIds: string[]) =>
    [...likeKeys.all, 'bulk', exerciseIds.sort().join(',')] as const,
};

/**
 * Hook for single exercise like status
 * Note: Like count is public, is_liked is user-specific
 */
export function useLikeStatus(exerciseId: string | undefined) {
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useLikeStatus');

  return useQuery({
    queryKey: likeKeys.status(exerciseId || ''),
    queryFn: async (): Promise<ExerciseLikeStatusResponse> => {
      if (!exerciseId) {
        return { exercise_id: '', is_liked: false, like_count: 0 };
      }

      // If not authenticated, we can still get like count from the API
      // The backend will return is_liked: false for unauthenticated users
      logger.debug('Fetching like status', { exerciseId, isAuthenticated, correlationId });
      return likesApi.getLikeStatus(
        exerciseId,
        session?.access_token || '',
        correlationId,
      );
    },
    staleTime: 30000, // 30 seconds
    enabled: !!exerciseId, // Always enabled when there's an exercise ID
  });
}

/**
 * Hook for bulk like status (multiple exercises)
 */
export function useBulkLikeStatus(exerciseIds: string[]) {
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useBulkLikeStatus');

  return useQuery({
    queryKey: likeKeys.bulk(exerciseIds),
    queryFn: async () => {
      if (exerciseIds.length === 0 || !session?.access_token) {
        return { statuses: {} };
      }

      logger.debug('Fetching bulk like status', {
        count: exerciseIds.length,
        correlationId,
      });
      return likesApi.getBulkLikeStatus(
        exerciseIds,
        session.access_token,
        correlationId,
      );
    },
    staleTime: 30000,
    enabled: exerciseIds.length > 0 && isAuthenticated,
  });
}

/**
 * Hook for toggling like with optimistic update
 */
export function useToggleLike(exerciseId: string | undefined) {
  const queryClient = useQueryClient();
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useToggleLike');

  return useMutation({
    mutationFn: async () => {
      if (!exerciseId || !session?.access_token) {
        throw new Error('Not authenticated or no exercise ID');
      }

      logger.debug('Toggling like', { exerciseId, correlationId });
      return likesApi.toggleLike(
        exerciseId,
        session.access_token,
        correlationId,
      );
    },
    // Optimistic update
    onMutate: async () => {
      if (!exerciseId) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: likeKeys.status(exerciseId),
      });

      // Snapshot previous value
      const previousStatus = queryClient.getQueryData<ExerciseLikeStatusResponse>(
        likeKeys.status(exerciseId),
      );

      // Optimistically update
      queryClient.setQueryData<ExerciseLikeStatusResponse>(
        likeKeys.status(exerciseId),
        (old) => {
          if (!old) {
            return {
              exercise_id: exerciseId,
              is_liked: true,
              like_count: 1,
            };
          }
          return {
            ...old,
            is_liked: !old.is_liked,
            like_count: old.is_liked
              ? Math.max(0, old.like_count - 1)
              : old.like_count + 1,
          };
        },
      );

      return { previousStatus };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousStatus && exerciseId) {
        queryClient.setQueryData(
          likeKeys.status(exerciseId),
          context.previousStatus,
        );
      }
      logger.error('Failed to toggle like', err as Error, {
        exerciseId,
        correlationId,
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      if (exerciseId) {
        queryClient.invalidateQueries({
          queryKey: likeKeys.status(exerciseId),
        });
      }
    },
  });
}

/**
 * Get like count for display (even without auth)
 * Returns 0 if no data available
 */
export function useLikeCount(exerciseId: string | undefined): number {
  const { data } = useLikeStatus(exerciseId);
  return data?.like_count ?? 0;
}

/**
 * Check if current user can like (is authenticated)
 */
export function useCanLike(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
