/**
 * Likes API Client
 *
 * API functions for exercise likes.
 */

import { apiClient, type ApiClientOptions } from '@/shared/api/client';
import type {
  ExerciseLikeStatusResponse,
  BulkLikeStatusResponse,
} from '@bassnotion/contracts';

/**
 * Like an exercise
 */
export async function likeExercise(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<ExerciseLikeStatusResponse> {
  return apiClient.post(
    `/api/exercises/${exerciseId}/like`,
    {},
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

/**
 * Unlike an exercise
 */
export async function unlikeExercise(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<ExerciseLikeStatusResponse> {
  return apiClient.delete(`/api/exercises/${exerciseId}/like`, {
    correlationId,
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Toggle like status
 */
export async function toggleLike(
  exerciseId: string,
  token: string,
  correlationId?: string,
): Promise<ExerciseLikeStatusResponse> {
  return apiClient.post(
    `/api/exercises/${exerciseId}/like/toggle`,
    {},
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

/**
 * Get like status for an exercise
 * Token is optional - anonymous users can still see like count
 */
export async function getLikeStatus(
  exerciseId: string,
  token?: string,
  correlationId?: string,
): Promise<ExerciseLikeStatusResponse> {
  const options: ApiClientOptions = { correlationId };
  if (token) {
    options.headers = { Authorization: `Bearer ${token}` };
  }
  return apiClient.get(`/api/exercises/${exerciseId}/like/status`, options);
}

/**
 * Get bulk like status for multiple exercises
 */
export async function getBulkLikeStatus(
  exerciseIds: string[],
  token: string,
  correlationId?: string,
): Promise<BulkLikeStatusResponse> {
  return apiClient.post(
    '/api/exercises/likes/bulk-status',
    { exercise_ids: exerciseIds },
    {
      correlationId,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
