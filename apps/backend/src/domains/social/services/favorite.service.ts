/**
 * Favorite Service
 *
 * Business logic for exercise favorites.
 * Favorites are private - only visible to the owning user.
 */

import { Injectable, Inject } from '@nestjs/common';
import {
  FavoriteRepository,
  FavoriteWithExercise,
} from '../repositories/favorite.repository.js';

@Injectable()
export class FavoriteService {
  constructor(
    @Inject('FavoriteRepository')
    private readonly favoriteRepository: FavoriteRepository,
  ) {}

  /**
   * Add exercise to favorites
   */
  async favoriteExercise(
    exerciseId: string,
    userId: string,
  ): Promise<{ exerciseId: string; isFavorited: boolean }> {
    await this.favoriteRepository.favorite(exerciseId, userId);

    return { exerciseId, isFavorited: true };
  }

  /**
   * Remove exercise from favorites
   */
  async unfavoriteExercise(
    exerciseId: string,
    userId: string,
  ): Promise<{ exerciseId: string; isFavorited: boolean }> {
    await this.favoriteRepository.unfavorite(exerciseId, userId);

    return { exerciseId, isFavorited: false };
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(
    exerciseId: string,
    userId: string,
  ): Promise<{ exerciseId: string; isFavorited: boolean }> {
    const isCurrentlyFavorited = await this.favoriteRepository.isFavorited(
      exerciseId,
      userId,
    );

    if (isCurrentlyFavorited) {
      return this.unfavoriteExercise(exerciseId, userId);
    } else {
      return this.favoriteExercise(exerciseId, userId);
    }
  }

  /**
   * Get favorite status for an exercise
   */
  async getFavoriteStatus(
    exerciseId: string,
    userId: string,
  ): Promise<{ exerciseId: string; isFavorited: boolean }> {
    const isFavorited = await this.favoriteRepository.isFavorited(
      exerciseId,
      userId,
    );

    return { exerciseId, isFavorited };
  }

  /**
   * Get bulk favorite status for multiple exercises
   */
  async getBulkFavoriteStatus(
    exerciseIds: string[],
    userId: string,
  ): Promise<Record<string, boolean>> {
    const statusMap = await this.favoriteRepository.getBulkFavoriteStatus(
      exerciseIds,
      userId,
    );

    return Object.fromEntries(statusMap);
  }

  /**
   * Get user's favorites list with exercise details
   */
  async getUserFavorites(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    favorites: FavoriteWithExercise[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.favoriteRepository.getUserFavorites(
      userId,
      page,
      limit,
    );

    return {
      ...result,
      page,
      limit,
    };
  }
}
