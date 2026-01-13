'use client';

/**
 * Favorites Hooks
 *
 * TanStack Query hooks for exercise favorites (private) with optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import * as favoritesApi from '../api/favorites';
import type {
  FavoriteStatusResponse,
  UserFavoritesResponse,
} from '@bassnotion/contracts';

// Query keys
export const favoriteKeys = {
  all: ['favorites'] as const,
  status: (exerciseId: string) =>
    [...favoriteKeys.all, 'status', exerciseId] as const,
  userList: () => [...favoriteKeys.all, 'user', 'list'] as const,
  bulk: (exerciseIds: string[]) =>
    [...favoriteKeys.all, 'bulk', exerciseIds.sort().join(',')] as const,
};

/**
 * Hook for single exercise favorite status
 */
export function useFavoriteStatus(exerciseId: string | undefined) {
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useFavoriteStatus');

  return useQuery({
    queryKey: favoriteKeys.status(exerciseId || ''),
    queryFn: async (): Promise<FavoriteStatusResponse> => {
      if (!exerciseId || !session?.access_token) {
        return { exercise_id: exerciseId || '', is_favorited: false };
      }

      logger.debug('Fetching favorite status', { exerciseId, correlationId });
      return favoritesApi.getFavoriteStatus(
        exerciseId,
        session.access_token,
        correlationId,
      );
    },
    staleTime: 30000, // 30 seconds
    enabled: !!exerciseId && isAuthenticated,
  });
}

/**
 * Hook for bulk favorite status (multiple exercises)
 */
export function useBulkFavoriteStatus(exerciseIds: string[]) {
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useBulkFavoriteStatus');

  return useQuery({
    queryKey: favoriteKeys.bulk(exerciseIds),
    queryFn: async () => {
      if (exerciseIds.length === 0 || !session?.access_token) {
        return { statuses: {} };
      }

      logger.debug('Fetching bulk favorite status', {
        count: exerciseIds.length,
        correlationId,
      });
      return favoritesApi.getBulkFavoriteStatus(
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
 * Hook for toggling favorite with optimistic update
 */
export function useToggleFavorite(exerciseId: string | undefined) {
  const queryClient = useQueryClient();
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useToggleFavorite');

  return useMutation({
    mutationFn: async () => {
      if (!exerciseId || !session?.access_token) {
        throw new Error('Not authenticated or no exercise ID');
      }

      logger.debug('Toggling favorite', { exerciseId, correlationId });
      return favoritesApi.toggleFavorite(
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
        queryKey: favoriteKeys.status(exerciseId),
      });

      // Snapshot previous value
      const previousStatus =
        queryClient.getQueryData<FavoriteStatusResponse>(
          favoriteKeys.status(exerciseId),
        );

      // Optimistically update
      queryClient.setQueryData<FavoriteStatusResponse>(
        favoriteKeys.status(exerciseId),
        (old) => {
          if (!old) {
            return {
              exercise_id: exerciseId,
              is_favorited: true,
            };
          }
          return {
            ...old,
            is_favorited: !old.is_favorited,
          };
        },
      );

      return { previousStatus };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousStatus && exerciseId) {
        queryClient.setQueryData(
          favoriteKeys.status(exerciseId),
          context.previousStatus,
        );
      }
      logger.error('Failed to toggle favorite', err as Error, {
        exerciseId,
        correlationId,
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      if (exerciseId) {
        queryClient.invalidateQueries({
          queryKey: favoriteKeys.status(exerciseId),
        });
      }
      // Also invalidate user favorites list
      queryClient.invalidateQueries({
        queryKey: favoriteKeys.userList(),
      });
    },
  });
}

/**
 * Hook for user's favorites list (for profile page)
 */
export function useUserFavorites(page: number = 1, limit: number = 20) {
  const { session, isAuthenticated } = useAuth();
  const { correlationId, logger } = useCorrelation('useUserFavorites');

  return useQuery({
    queryKey: [...favoriteKeys.userList(), page, limit] as const,
    queryFn: async (): Promise<UserFavoritesResponse> => {
      if (!session?.access_token) {
        return { favorites: [], total: 0, page: 1, limit: 20 };
      }

      logger.debug('Fetching user favorites', { page, limit, correlationId });
      return favoritesApi.getUserFavorites(
        session.access_token,
        page,
        limit,
        correlationId,
      );
    },
    staleTime: 60000, // 1 minute
    enabled: isAuthenticated,
  });
}

/**
 * Check if current user can favorite (is authenticated)
 */
export function useCanFavorite(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
