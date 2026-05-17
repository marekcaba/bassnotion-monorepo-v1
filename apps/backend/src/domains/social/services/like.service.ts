/**
 * Like Service
 *
 * Business logic for exercise likes.
 * Handles like/unlike operations and status queries.
 */

import { Injectable, Inject } from '@nestjs/common';
import { LikeRepository, LikeStatus } from '../repositories/like.repository.js';

@Injectable()
export class LikeService {
  constructor(
    @Inject('LikeRepository')
    private readonly likeRepository: LikeRepository,
  ) {}

  /**
   * Like an exercise
   */
  async likeExercise(exerciseId: string, userId: string): Promise<LikeStatus> {
    await this.likeRepository.like(exerciseId, userId);
    const likeCount = await this.likeRepository.getLikeCount(exerciseId);

    return { isLiked: true, likeCount };
  }

  /**
   * Unlike an exercise
   */
  async unlikeExercise(
    exerciseId: string,
    userId: string,
  ): Promise<LikeStatus> {
    await this.likeRepository.unlike(exerciseId, userId);
    const likeCount = await this.likeRepository.getLikeCount(exerciseId);

    return { isLiked: false, likeCount };
  }

  /**
   * Toggle like status (convenience method for frontend)
   */
  async toggleLike(exerciseId: string, userId: string): Promise<LikeStatus> {
    const isCurrentlyLiked = await this.likeRepository.isLiked(
      exerciseId,
      userId,
    );

    if (isCurrentlyLiked) {
      return this.unlikeExercise(exerciseId, userId);
    } else {
      return this.likeExercise(exerciseId, userId);
    }
  }

  /**
   * Get like status for an exercise
   */
  async getLikeStatus(
    exerciseId: string,
    userId: string,
  ): Promise<{ exerciseId: string } & LikeStatus> {
    const status = await this.likeRepository.getLikeStatus(exerciseId, userId);

    return {
      exerciseId,
      ...status,
    };
  }

  /**
   * Get bulk like status for multiple exercises
   */
  async getBulkLikeStatus(
    exerciseIds: string[],
    userId: string,
  ): Promise<Record<string, LikeStatus>> {
    const statusMap = await this.likeRepository.getBulkLikeStatus(
      exerciseIds,
      userId,
    );

    return Object.fromEntries(statusMap);
  }

  /**
   * Get like count only (for anonymous users)
   * Returns just the count without requiring authentication
   */
  async getLikeCountOnly(exerciseId: string): Promise<number> {
    return this.likeRepository.getLikeCount(exerciseId);
  }
}
