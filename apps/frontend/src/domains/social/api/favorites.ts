/**
 * Favorites API Client
 *
 * API functions for exercise favorites (private).
 */

import { apiClient } from '@/shared/api/client';
import type {
  FavoriteStatusResponse,
  BulkFavoriteStatusResponse,
  UserFavoritesResponse,
} from '@bassnotion/contracts';

/**
 * Add exercise to favorites
 */
export async function favoriteExercise(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<FavoriteStatusResponse> {
  return apiClient.post(
    `/api/exercises/${exerciseId}/favorite`,
    {},
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

/**
 * Remove exercise from favorites
 */
export async function unfavoriteExercise(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<FavoriteStatusResponse> {
  return apiClient.delete(`/api/exercises/${exerciseId}/favorite`, {
    correlationId,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<FavoriteStatusResponse> {
  return apiClient.post(
    `/api/exercises/${exerciseId}/favorite/toggle`,
    {},
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

/**
 * Get favorite status for an exercise
 */
export async function getFavoriteStatus(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<FavoriteStatusResponse> {
  return apiClient.get(`/api/exercises/${exerciseId}/favorite/status`, {
    correlationId,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Get bulk favorite status for multiple exercises
 */
export async function getBulkFavoriteStatus(
  exerciseIds: string[],
  token: string,
  correlationId?: string,
): Promise<BulkFavoriteStatusResponse> {
  return apiClient.post(
    '/api/exercises/favorites/bulk-status',
    { exercise_ids: exerciseIds },
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

/**
 * Get user's favorites list
 */
export async function getUserFavorites(
  token: string,
  page = 1,
  limit = 20,
  correlationId?: string,
): Promise<UserFavoritesResponse> {
  return apiClient.get(`/api/user/favorites?page=${page}&limit=${limit}`, {
    correlationId,
    headers: { Authorization: `Bearer ${token}` },
  });
}
