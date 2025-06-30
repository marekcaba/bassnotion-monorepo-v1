import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ExercisesService } from './exercises.service.js';
import {
  ExercisesResponseDto,
  ExerciseResponseDto,
} from './dto/exercise-response.dto.js';
import {
  CustomBasslinesResponseDto,
  CustomBasslineDto,
} from './dto/custom-bassline.dto.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';

@Controller('api/exercises')
export class ExercisesController {
  private readonly logger = new Logger(ExercisesController.name);

  constructor(private readonly exercisesService: ExercisesService) {
    // Defensive check for dependency injection issues
    if (!this.exercisesService) {
      this.logger.error('ExercisesService is undefined - DI failure detected');
    }
  }

  // ==================== DEFENSIVE PROGRAMMING HELPER ====================

  private checkServiceAvailability(): boolean {
    if (!this.exercisesService) {
      this.logger.error('ExercisesService is undefined - DI failure detected');
      return false;
    }
    return true;
  }

  private getMockExercisesResponse(): ExercisesResponseDto {
    return {
      exercises: [
        {
          id: 'mock-1',
          title: 'Mock Exercise 1',
          description: 'This is a mock exercise due to service unavailability',
          difficulty: 'beginner',
          duration: 60000,
          bpm: 120,
          key: 'E',
          notes: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'mock-2',
          title: 'Mock Exercise 2',
          description:
            'This is another mock exercise due to service unavailability',
          difficulty: 'intermediate',
          duration: 90000,
          bpm: 100,
          key: 'A',
          notes: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total: 2,
      cached: false,
    };
  }

  /**
   * GET /api/exercises
   * Get all active exercises with pagination support
   */
  @Get()
  async getAllExercises(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ExercisesResponseDto> {
    this.logger.log('GET /api/exercises - Fetching all exercises');

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.logger.warn('Returning mock data due to service unavailability');
      return this.getMockExercisesResponse();
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);

    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return this.exercisesService.getAllExercises(pageNum, limitNum);
  }

  /**
   * GET /api/exercises/search?q=term
   * Search exercises by title or description
   */
  @Get('search')
  async searchExercises(
    @Query('q') query: string,
  ): Promise<ExercisesResponseDto> {
    this.logger.log(
      `GET /api/exercises/search?q=${query} - Searching exercises`,
    );

    if (!query || query.trim().length === 0) {
      this.logger.warn('Empty search query provided');
      return {
        exercises: [],
        total: 0,
        cached: false,
      };
    }

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.logger.warn('Returning mock data due to service unavailability');
      return this.getMockExercisesResponse();
    }

    try {
      const result = await this.exercisesService.searchExercises(query.trim());
      this.logger.log(
        `Successfully found ${result.total} exercises matching "${query}"`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error searching exercises with query "${query}":`,
        error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/difficulty/:level
   * Get exercises filtered by difficulty level
   */
  @Get('difficulty/:level')
  async getExercisesByDifficulty(
    @Param('level') level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<ExercisesResponseDto> {
    this.logger.log(
      `GET /api/exercises/difficulty/${level} - Fetching exercises by difficulty`,
    );

    try {
      const result =
        await this.exercisesService.getExercisesByDifficulty(level);
      this.logger.log(
        `Successfully fetched ${result.total} exercises with difficulty ${level}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching exercises by difficulty ${level}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/:id
   * Get a specific exercise by ID
   */
  @Get(':id')
  async getExerciseById(@Param('id') id: string): Promise<ExerciseResponseDto> {
    this.logger.log(`GET /api/exercises/${id} - Fetching exercise by ID`);

    try {
      const result = await this.exercisesService.getExerciseById(id);
      this.logger.log(
        `Successfully fetched exercise: ${result.exercise.title}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error fetching exercise ${id}:`, error);
      throw error;
    }
  }

  // ==================== USER EXERCISE MANAGEMENT ====================

  /**
   * GET /api/exercises/user/my-exercises
   * Get user's custom basslines (requires authentication)
   */
  @Get('user/my-exercises')
  @UseGuards(AuthGuard)
  async getUserCustomBasslines(
    @Request() req: any,
  ): Promise<CustomBasslinesResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`GET /api/exercises/user/my-exercises - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.getUserCustomBasslines(userId);
      this.logger.log(
        `Successfully fetched ${result.total} custom basslines for user ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching custom basslines for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * POST /api/exercises/user/save-bassline
   * Save a custom bassline for the authenticated user
   */
  @Post('user/save-bassline')
  @UseGuards(AuthGuard)
  async saveCustomBassline(
    @Request() req: any,
    @Body() basslineData: unknown,
  ): Promise<CustomBasslineDto> {
    const userId = req.user?.id;
    this.logger.log(`POST /api/exercises/user/save-bassline - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.saveCustomBassline(
        userId,
        basslineData,
      );
      this.logger.log(`Successfully saved custom bassline: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error saving custom bassline for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * PUT /api/exercises/user/:basslineId
   * Update a user's custom bassline
   */
  @Put('user/:basslineId')
  @UseGuards(AuthGuard)
  async updateCustomBassline(
    @Request() req: any,
    @Param('basslineId') basslineId: string,
    @Body() updateData: unknown,
  ): Promise<CustomBasslineDto> {
    const userId = req.user?.id;
    this.logger.log(`PUT /api/exercises/user/${basslineId} - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.updateCustomBassline(
        userId,
        basslineId,
        updateData as any,
      );
      this.logger.log(`Successfully updated custom bassline: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating custom bassline ${basslineId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * DELETE /api/exercises/user/:basslineId
   * Delete a user's custom bassline
   */
  @Delete('user/:basslineId')
  @UseGuards(AuthGuard)
  async deleteCustomBassline(
    @Request() req: any,
    @Param('basslineId') basslineId: string,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    this.logger.log(
      `DELETE /api/exercises/user/${basslineId} - User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      await this.exercisesService.deleteCustomBassline(userId, basslineId);
      this.logger.log(`Successfully deleted custom bassline: ${basslineId}`);
      return { message: 'Custom bassline deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting custom bassline ${basslineId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // ==================== EPIC 5 ADMIN OPERATIONS ====================

  /**
   * POST /api/exercises
   * Create a new exercise (Epic 5 preparation - requires authentication)
   */
  @Post()
  @UseGuards(AuthGuard)
  async createExercise(
    @Request() req: any,
    @Body() exerciseData: unknown,
  ): Promise<ExerciseResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`POST /api/exercises - Creating exercise, User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.createExercise(
        exerciseData,
        userId,
      );
      this.logger.log(`Successfully created exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.logger.error(`Error creating exercise for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * PUT /api/exercises/:id
   * Update an existing exercise (Epic 5 preparation - requires authentication)
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  async updateExercise(
    @Request() req: any,
    @Param('id') exerciseId: string,
    @Body() updateData: unknown,
  ): Promise<ExerciseResponseDto> {
    const userId = req.user?.id;
    this.logger.log(
      `PUT /api/exercises/${exerciseId} - Updating exercise, User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.updateExercise(
        exerciseId,
        updateData,
        userId,
      );
      this.logger.log(`Successfully updated exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.logger.error(
        `Error updating exercise ${exerciseId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}
