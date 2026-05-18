/**
 * Favorite Controller
 *
 * REST API endpoints for exercise favorites.
 * Favorites are private - users can only see their own.
 */

import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { FavoriteService } from '../services/favorite.service.js';
import { AuthGuard } from '../../user/auth/guards/auth.guard.js';
import {
  BulkFavoriteStatusRequestSchema,
  FavoritesPaginationSchema,
} from '@bassnotion/contracts';
import { createStructuredLogger } from '@bassnotion/contracts';

interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string };
}

@Controller('api')
@UseGuards(AuthGuard)
export class FavoriteController {
  private readonly logger = createStructuredLogger(FavoriteController.name);

  constructor(private readonly favoriteService: FavoriteService) {}

  /**
   * Add exercise to favorites
   * POST /api/exercises/:exerciseId/favorite
   */
  @Post('exercises/:exerciseId/favorite')
  async favoriteExercise(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Favorite exercise request', { exerciseId, userId });

    const result = await this.favoriteService.favoriteExercise(
      exerciseId,
      userId,
    );

    return {
      exercise_id: result.exerciseId,
      is_favorited: result.isFavorited,
    };
  }

  /**
   * Remove exercise from favorites
   * DELETE /api/exercises/:exerciseId/favorite
   */
  @Delete('exercises/:exerciseId/favorite')
  async unfavoriteExercise(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Unfavorite exercise request', { exerciseId, userId });

    const result = await this.favoriteService.unfavoriteExercise(
      exerciseId,
      userId,
    );

    return {
      exercise_id: result.exerciseId,
      is_favorited: result.isFavorited,
    };
  }

  /**
   * Toggle favorite status
   * POST /api/exercises/:exerciseId/favorite/toggle
   */
  @Post('exercises/:exerciseId/favorite/toggle')
  async toggleFavorite(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    this.logger.info('Toggle favorite request', { exerciseId, userId });

    const result = await this.favoriteService.toggleFavorite(
      exerciseId,
      userId,
    );

    return {
      exercise_id: result.exerciseId,
      is_favorited: result.isFavorited,
    };
  }

  /**
   * Get favorite status for an exercise
   * GET /api/exercises/:exerciseId/favorite/status
   */
  @Get('exercises/:exerciseId/favorite/status')
  async getFavoriteStatus(
    @Param('exerciseId') exerciseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    const result = await this.favoriteService.getFavoriteStatus(
      exerciseId,
      userId,
    );

    return {
      exercise_id: result.exerciseId,
      is_favorited: result.isFavorited,
    };
  }

  /**
   * Get bulk favorite status for multiple exercises
   * POST /api/exercises/favorites/bulk-status
   */
  @Post('exercises/favorites/bulk-status')
  async getBulkFavoriteStatus(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const validated = BulkFavoriteStatusRequestSchema.parse(body);

    this.logger.info('Bulk favorite status request', {
      userId,
      exerciseCount: validated.exercise_ids.length,
    });

    const statuses = await this.favoriteService.getBulkFavoriteStatus(
      validated.exercise_ids,
      userId,
    );

    return { statuses };
  }

  /**
   * Get user's favorites list
   * GET /api/user/favorites
   */
  @Get('user/favorites')
  async getUserFavorites(
    @Query() query: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const { page, limit } = FavoritesPaginationSchema.parse(query);

    this.logger.info('Get user favorites request', { userId, page, limit });

    const result = await this.favoriteService.getUserFavorites(
      userId,
      page,
      limit,
    );

    // Transform to API format
    return {
      favorites: result.favorites.map((f) => ({
        id: f.id,
        exercise_id: f.exerciseId,
        created_at: f.createdAt.toISOString(),
        exercise: f.exercise
          ? {
              id: f.exercise.id,
              title: f.exercise.title,
              description: f.exercise.description ?? null,
              difficulty: f.exercise.difficulty ?? null,
              bpm: f.exercise.bpm ?? null,
              like_count: f.exercise.likeCount ?? 0,
              tutorial_slug: f.exercise.tutorialSlug ?? null,
            }
          : null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
