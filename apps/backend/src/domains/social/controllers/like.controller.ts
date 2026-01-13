/**
 * Like Controller
 *
 * REST API endpoints for exercise likes.
 * - Like count is public (anyone can see)
 * - is_liked status requires authentication
 * - Like/unlike actions require authentication
 */

import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { LikeService } from '../services/like.service.js';
import { AuthGuard } from '../../user/auth/guards/auth.guard.js';
import { OptionalAuthGuard } from '../../user/auth/guards/optional-auth.guard.js';
import { BulkLikeStatusRequestSchema } from '@bassnotion/contracts';
import { createStructuredLogger } from '@bassnotion/contracts';

interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string };
}

interface OptionalAuthRequest extends FastifyRequest {
  user?: { id: string };
}

@Controller('api/exercises')
export class LikeController {
  private readonly logger = createStructuredLogger(LikeController.name);

  constructor(private readonly likeService: LikeService) {}

  /**
   * Like an exercise
   * POST /api/exercises/:exerciseId/like
   */
  @Post(':exerciseId/like')
  @UseGuards(AuthGuard)
  async likeExercise(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Like exercise request', { exerciseId, userId });

    const result = await this.likeService.likeExercise(exerciseId, userId);

    return {
      exercise_id: exerciseId,
      is_liked: result.isLiked,
      like_count: result.likeCount,
    };
  }

  /**
   * Unlike an exercise
   * DELETE /api/exercises/:exerciseId/like
   */
  @Delete(':exerciseId/like')
  @UseGuards(AuthGuard)
  async unlikeExercise(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Unlike exercise request', { exerciseId, userId });

    const result = await this.likeService.unlikeExercise(exerciseId, userId);

    return {
      exercise_id: exerciseId,
      is_liked: result.isLiked,
      like_count: result.likeCount,
    };
  }

  /**
   * Toggle like status
   * POST /api/exercises/:exerciseId/like/toggle
   */
  @Post(':exerciseId/like/toggle')
  @UseGuards(AuthGuard)
  async toggleLike(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Toggle like request', { exerciseId, userId });

    const result = await this.likeService.toggleLike(exerciseId, userId);

    return {
      exercise_id: exerciseId,
      is_liked: result.isLiked,
      like_count: result.likeCount,
    };
  }

  /**
   * Get like status for an exercise
   * GET /api/exercises/:exerciseId/like/status
   *
   * Public endpoint - returns like count for everyone
   * Returns is_liked: true/false for authenticated users
   * Returns is_liked: false for unauthenticated users
   */
  @Get(':exerciseId/like/status')
  @UseGuards(OptionalAuthGuard)
  async getLikeStatus(
    @Param('exerciseId') exerciseId: string,
    @Req() req: OptionalAuthRequest,
  ) {
    const userId = req.user?.id;

    // If authenticated, get full status
    if (userId) {
      const result = await this.likeService.getLikeStatus(exerciseId, userId);
      return {
        exercise_id: result.exerciseId,
        is_liked: result.isLiked,
        like_count: result.likeCount,
      };
    }

    // For unauthenticated users, just get the like count
    const likeCount = await this.likeService.getLikeCountOnly(exerciseId);
    return {
      exercise_id: exerciseId,
      is_liked: false,
      like_count: likeCount,
    };
  }

  /**
   * Get bulk like status for multiple exercises
   * POST /api/exercises/likes/bulk-status
   */
  @Post('likes/bulk-status')
  @UseGuards(AuthGuard)
  async getBulkLikeStatus(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const validated = BulkLikeStatusRequestSchema.parse(body);

    this.logger.info('Bulk like status request', {
      userId,
      exerciseCount: validated.exercise_ids.length,
    });

    const statuses = await this.likeService.getBulkLikeStatus(
      validated.exercise_ids,
      userId,
    );

    // Transform to API format
    const formattedStatuses: Record<
      string,
      { is_liked: boolean; like_count: number }
    > = {};

    for (const [id, status] of Object.entries(statuses)) {
      formattedStatuses[id] = {
        is_liked: status.isLiked,
        like_count: status.likeCount,
      };
    }

    return { statuses: formattedStatuses };
  }
}
