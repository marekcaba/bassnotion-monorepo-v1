/**
 * Favorite Repository
 *
 * Handles all database operations for exercise favorites.
 * Favorites are private - RLS ensures users can only see their own.
 */

import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ExerciseFavorite } from '../entities/exercise-favorite.entity.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface FavoriteWithExercise {
  id: string;
  exerciseId: string;
  createdAt: Date;
  exercise?: {
    id: string;
    title: string;
    description?: string;
    difficulty?: number;
    bpm?: number;
    likeCount?: number;
    tutorialSlug?: string;
  };
}

@Injectable()
export class FavoriteRepository {
  private readonly staticLogger = createStructuredLogger(
    FavoriteRepository.name,
  );

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
   * Add exercise to favorites (upsert to handle duplicates)
   */
  async favorite(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseFavorite> {
    const favorite = ExerciseFavorite.create(exerciseId, userId);

    const { data, error } = await this.supabase
      .from('exercise_favorites')
      .upsert(favorite.toPersistence(), {
        onConflict: 'exercise_id,user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to favorite exercise', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to favorite exercise: ${error.message}`);
    }

    this.logger.info('Exercise favorited', {
      correlationId: this.correlationId,
      exerciseId,
      userId,
    });

    return ExerciseFavorite.fromPersistence(data);
  }

  /**
   * Remove exercise from favorites
   */
  async unfavorite(exerciseId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('exercise_favorites')
      .delete()
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to unfavorite exercise', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to unfavorite exercise: ${error.message}`);
    }

    this.logger.info('Exercise unfavorited', {
      correlationId: this.correlationId,
      exerciseId,
      userId,
    });
  }

  /**
   * Check if user has favorited an exercise
   */
  async isFavorited(exerciseId: string, userId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('exercise_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('Failed to check favorite status', error as Error, {
        correlationId: this.correlationId,
        exerciseId,
        userId,
      });
      throw new Error(`Failed to check favorite status: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get bulk favorite status for multiple exercises
   */
  async getBulkFavoriteStatus(
    exerciseIds: string[],
    userId: string,
  ): Promise<Map<string, boolean>> {
    if (exerciseIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from('exercise_favorites')
      .select('exercise_id')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds);

    if (error) {
      this.logger.error('Failed to get bulk favorite status', error as Error, {
        correlationId: this.correlationId,
        userId,
        exerciseIds,
      });
      throw new Error(`Failed to get bulk favorite status: ${error.message}`);
    }

    const favoritedSet = new Set(data?.map((f) => f.exercise_id) || []);
    const result = new Map<string, boolean>();

    for (const id of exerciseIds) {
      result.set(id, favoritedSet.has(id));
    }

    return result;
  }

  /**
   * Get user's favorites with exercise details (paginated)
   */
  async getUserFavorites(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ favorites: FavoriteWithExercise[]; total: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const { count, error: countError } = await this.supabase
      .from('exercise_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      this.logger.error('Failed to count favorites', countError as Error, {
        correlationId: this.correlationId,
        userId,
      });
      throw new Error(`Failed to count favorites: ${countError.message}`);
    }

    // Get paginated favorites with exercise and tutorial data
    const { data, error } = await this.supabase
      .from('exercise_favorites')
      .select(
        `
        id,
        exercise_id,
        created_at,
        exercises (
          id,
          title,
          description,
          difficulty,
          bpm,
          like_count,
          tutorials (
            slug
          )
        )
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to get user favorites', error as Error, {
        correlationId: this.correlationId,
        userId,
      });
      throw new Error(`Failed to get user favorites: ${error.message}`);
    }

    const favorites: FavoriteWithExercise[] = (data || []).map((item: any) => ({
      id: item.id,
      exerciseId: item.exercise_id,
      createdAt: new Date(item.created_at),
      exercise: item.exercises
        ? {
            id: item.exercises.id,
            title: item.exercises.title,
            description: item.exercises.description,
            difficulty: item.exercises.difficulty,
            bpm: item.exercises.bpm,
            likeCount: item.exercises.like_count,
            tutorialSlug: item.exercises.tutorials?.slug,
          }
        : undefined,
    }));

    return {
      favorites,
      total: count ?? 0,
    };
  }
}
