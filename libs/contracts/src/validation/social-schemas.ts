/**
 * Social Feature Validation Schemas
 *
 * Defines Zod schemas for exercise likes (public) and favorites (private).
 * Used for API request/response validation across frontend and backend.
 */

import { z } from 'zod';

// =====================================================
// EXERCISE LIKE SCHEMAS
// =====================================================

/**
 * Schema for a single exercise like record
 */
export const ExerciseLikeSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
});

/**
 * Request to like an exercise
 */
export const LikeExerciseRequestSchema = z.object({
  exercise_id: z.string().uuid('Invalid exercise ID'),
});

/**
 * Response after liking/unliking an exercise
 */
export const ExerciseLikeStatusResponseSchema = z.object({
  exercise_id: z.string().uuid(),
  is_liked: z.boolean(),
  like_count: z.number().int().min(0),
});

/**
 * Request for bulk like status check (multiple exercises)
 */
export const BulkLikeStatusRequestSchema = z.object({
  exercise_ids: z
    .array(z.string().uuid('Invalid exercise ID'))
    .min(1, 'At least one exercise ID required')
    .max(50, 'Maximum 50 exercise IDs per request'),
});

/**
 * Response for bulk like status check
 */
export const BulkLikeStatusResponseSchema = z.object({
  statuses: z.record(
    z.string().uuid(),
    z.object({
      is_liked: z.boolean(),
      like_count: z.number().int().min(0),
    })
  ),
});

// =====================================================
// EXERCISE FAVORITE SCHEMAS
// =====================================================

/**
 * Schema for a single exercise favorite record
 */
export const ExerciseFavoriteSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
});

/**
 * Request to favorite an exercise
 */
export const FavoriteExerciseRequestSchema = z.object({
  exercise_id: z.string().uuid('Invalid exercise ID'),
});

/**
 * Response after favoriting/unfavoriting an exercise
 */
export const FavoriteStatusResponseSchema = z.object({
  exercise_id: z.string().uuid(),
  is_favorited: z.boolean(),
});

/**
 * Request for bulk favorite status check (multiple exercises)
 */
export const BulkFavoriteStatusRequestSchema = z.object({
  exercise_ids: z
    .array(z.string().uuid('Invalid exercise ID'))
    .min(1, 'At least one exercise ID required')
    .max(50, 'Maximum 50 exercise IDs per request'),
});

/**
 * Response for bulk favorite status check
 */
export const BulkFavoriteStatusResponseSchema = z.object({
  statuses: z.record(z.string().uuid(), z.boolean()),
});

/**
 * Response for user's favorites list with pagination
 */
export const UserFavoritesResponseSchema = z.object({
  favorites: z.array(
    z.object({
      id: z.string().uuid(),
      exercise_id: z.string().uuid(),
      created_at: z.string().datetime(),
      // Include exercise preview data for display
      exercise: z
        .object({
          id: z.string().uuid(),
          title: z.string(),
          description: z.string().nullable().optional(),
          difficulty: z.number().int().min(1).max(10).optional(),
          bpm: z.number().int().optional(),
          like_count: z.number().int().min(0).optional(),
          tutorial_slug: z.string().optional(),
        })
        .optional(),
    })
  ),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
});

/**
 * Pagination query params for favorites list
 */
export const FavoritesPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type ExerciseLike = z.infer<typeof ExerciseLikeSchema>;
export type LikeExerciseRequest = z.infer<typeof LikeExerciseRequestSchema>;
export type ExerciseLikeStatusResponse = z.infer<
  typeof ExerciseLikeStatusResponseSchema
>;
export type BulkLikeStatusRequest = z.infer<typeof BulkLikeStatusRequestSchema>;
export type BulkLikeStatusResponse = z.infer<
  typeof BulkLikeStatusResponseSchema
>;

export type ExerciseFavorite = z.infer<typeof ExerciseFavoriteSchema>;
export type FavoriteExerciseRequest = z.infer<
  typeof FavoriteExerciseRequestSchema
>;
export type FavoriteStatusResponse = z.infer<
  typeof FavoriteStatusResponseSchema
>;
export type BulkFavoriteStatusRequest = z.infer<
  typeof BulkFavoriteStatusRequestSchema
>;
export type BulkFavoriteStatusResponse = z.infer<
  typeof BulkFavoriteStatusResponseSchema
>;
export type UserFavoritesResponse = z.infer<typeof UserFavoritesResponseSchema>;
export type FavoritesPagination = z.infer<typeof FavoritesPaginationSchema>;
