/**
 * Like Repository
 *
 * Handles all database operations for exercise likes.
 * Uses Supabase client with RLS policies for security.
 */

import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ExerciseLike } from '../entities/exercise-like.entity.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface LikeStatus {
  isLiked: boolean;
  likeCount: number;
}

@Injectable()
export class LikeRepository {
  private readonly staticLogger = createStructuredLogger(LikeRepository.name);

  constructor(
    private readonly supabase: SupabaseClient,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  private get logger() {
    return this.requestContext?.getLogger() || this.staticLogger;
  }

  private get correlationId() {
    return this.requestContext?.getCorrelationId();
  }

  /**
   * Like an exercise (upsert to handle duplicates gracefully)
   */
  async like(exerciseId: string, userId: string): Promise<ExerciseLike> {
    const like = ExerciseLike.create(exerciseId, userId);

    const { data, error } = await this.supabase
      .from('exercise_likes')
      .upsert(like.toPersistence(), {
        onConflict: 'exercise_id,user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to like exercise', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to like exercise: ${error.message}`);
    }

    this.logger.info('Exercise liked', {
      correlationId: this.correlationId,
      exerciseId,
      userId,
    });

    return ExerciseLike.fromPersistence(data);
  }

  /**
   * Unlike an exercise
   */
  async unlike(exerciseId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('exercise_likes')
      .delete()
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to unlike exercise', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to unlike exercise: ${error.message}`);
    }

    this.logger.info('Exercise unliked', {
      correlationId: this.correlationId,
      exerciseId,
      userId,
    });
  }

  /**
   * Check if user has liked an exercise
   */
  async isLiked(exerciseId: string, userId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('exercise_likes')
      .select('id', { count: 'exact', head: true })
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to check like status', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to check like status: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get like count for an exercise (from denormalized column)
   */
  async getLikeCount(exerciseId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('like_count')
      .eq('id', exerciseId)
      .single();

    if (error) {
      this.logger.error('Failed to get like count', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
      });
      throw new Error(`Failed to get like count: ${error.message}`);
    }

    return data?.like_count ?? 0;
  }

  /**
   * Get like status for a single exercise
   */
  async getLikeStatus(exerciseId: string, userId: string): Promise<LikeStatus> {
    const [isLiked, likeCount] = await Promise.all([
      this.isLiked(exerciseId, userId),
      this.getLikeCount(exerciseId),
    ]);

    return { isLiked, likeCount };
  }

  /**
   * Get bulk like status for multiple exercises (optimized for lists)
   */
  async getBulkLikeStatus(
    exerciseIds: string[],
    userId: string,
  ): Promise<Map<string, LikeStatus>> {
    if (exerciseIds.length === 0) {
      return new Map();
    }

    // Fetch like counts from exercises table
    const { data: exercises, error: exerciseError } = await this.supabase
      .from('exercises')
      .select('id, like_count')
      .in('id', exerciseIds);

    if (exerciseError) {
      this.logger.error('Failed to get bulk like counts', exerciseError as Error, {
        correlationId: this.correlationId,
        exerciseIds,
      });
      throw new Error(`Failed to get bulk like counts: ${exerciseError.message}`);
    }

    // Fetch user's likes for these exercises
    const { data: userLikes, error: likesError } = await this.supabase
      .from('exercise_likes')
      .select('exercise_id')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds);

    if (likesError) {
      this.logger.error('Failed to get user likes', likesError as Error, {
        correlationId: this.correlationId,
        userId,
        exerciseIds,
      });
      throw new Error(`Failed to get user likes: ${likesError.message}`);
    }

    // Build result map
    const userLikedSet = new Set(userLikes?.map((l) => l.exercise_id) || []);
    const result = new Map<string, LikeStatus>();

    for (const exercise of exercises || []) {
      result.set(exercise.id, {
        isLiked: userLikedSet.has(exercise.id),
        likeCount: exercise.like_count ?? 0,
      });
    }

    // Fill in missing exercises with defaults
    for (const id of exerciseIds) {
      if (!result.has(id)) {
        result.set(id, { isLiked: false, likeCount: 0 });
      }
    }

    return result;
  }

  /**
   * Get all likes by a user (for profile)
   */
  async getUserLikes(userId: string): Promise<ExerciseLike[]> {
    const { data, error } = await this.supabase
      .from('exercise_likes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get user likes', error as Error, {
        correlationId: this.correlationId,
        userId,
      });
      throw new Error(`Failed to get user likes: ${error.message}`);
    }

    return (data || []).map(ExerciseLike.fromPersistence);
  }
}
