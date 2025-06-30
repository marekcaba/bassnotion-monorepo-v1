import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import {
  ExerciseDto,
  ExercisesResponseDto,
  ExerciseResponseDto,
} from './dto/exercise-response.dto.js';
import {
  CustomBasslineDto,
  SaveCustomBasslineDto,
  CustomBasslinesResponseDto,
  validateSaveCustomBassline,
  validateCustomBassline,
} from './dto/custom-bassline.dto.js';
import {
  validateCreateExercise,
  validateUpdateExercise,
} from './dto/create-exercise.dto.js';
import { ExerciseSchema } from '@bassnotion/contracts';

@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.debug('🔧 ExercisesService constructor called');
  }

  /**
   * Get all active exercises with pagination support
   */
  async getAllExercises(page = 1, limit = 50): Promise<ExercisesResponseDto> {
    try {
      this.logger.debug(`Fetching exercises - page: ${page}, limit: ${limit}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('exercises')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('title', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('Supabase error fetching exercises:', error);
        throw new InternalServerErrorException(
          `Failed to fetch exercises: ${error.message}`,
        );
      }

      this.logger.debug(
        `Found ${data?.length || 0} exercises (total: ${count})`,
      );

      // Validate response data using contracts schema
      const exercises: ExerciseDto[] = (data || []).map((exercise) => {
        try {
          return ExerciseSchema.parse(exercise);
        } catch (validationError) {
          this.logger.warn(
            `Exercise ${exercise.id} failed validation:`,
            validationError,
          );
          return exercise; // Return as-is if validation fails for backward compatibility
        }
      });

      return {
        exercises,
        total: count || 0,
        cached: false, // TODO: Implement caching in Phase 4
      };
    } catch (error) {
      this.logger.error('Error in getAllExercises:', error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch exercises');
    }
  }

  /**
   * Get a specific exercise by ID with full validation
   */
  async getExerciseById(id: string): Promise<ExerciseResponseDto> {
    try {
      this.logger.debug(`Fetching exercise with ID: ${id}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          this.logger.warn(`Exercise not found: ${id}`);
          throw new NotFoundException(`Exercise with ID ${id} not found`);
        }
        this.logger.error('Supabase error fetching exercise:', error);
        throw new InternalServerErrorException(
          `Failed to fetch exercise: ${error.message}`,
        );
      }

      if (!data) {
        throw new NotFoundException(`Exercise with ID ${id} not found`);
      }

      this.logger.debug(`Found exercise: ${data.title}`);

      // Validate exercise data using contracts schema
      let validatedExercise: ExerciseDto;
      try {
        validatedExercise = ExerciseSchema.parse(data);
      } catch (validationError) {
        this.logger.warn(`Exercise ${id} failed validation:`, validationError);
        validatedExercise = data as ExerciseDto; // Fallback for backward compatibility
      }

      return {
        exercise: validatedExercise,
      };
    } catch (error) {
      this.logger.error(`Error in getExerciseById(${id}):`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch exercise');
    }
  }

  /**
   * Get exercises filtered by difficulty
   */
  async getExercisesByDifficulty(
    difficulty: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<ExercisesResponseDto> {
    try {
      this.logger.debug(`Fetching exercises with difficulty: ${difficulty}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .eq('difficulty', difficulty)
        .order('title', { ascending: true });

      if (error) {
        this.logger.error(
          'Supabase error fetching exercises by difficulty:',
          error,
        );
        throw new InternalServerErrorException(
          `Failed to fetch exercises: ${error.message}`,
        );
      }

      this.logger.debug(
        `Found ${data?.length || 0} exercises with difficulty ${difficulty}`,
      );

      const exercises: ExerciseDto[] = (data || []).map((exercise) => {
        try {
          return ExerciseSchema.parse(exercise);
        } catch (validationError) {
          this.logger.warn(
            `Exercise ${exercise.id} failed validation:`,
            validationError,
          );
          return exercise; // Return as-is if validation fails
        }
      });

      return {
        exercises,
        total: exercises.length,
        cached: false,
      };
    } catch (error) {
      this.logger.error(
        `Error in getExercisesByDifficulty(${difficulty}):`,
        error,
      );
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch exercises by difficulty',
      );
    }
  }

  /**
   * Search exercises by title or description
   */
  async searchExercises(query: string): Promise<ExercisesResponseDto> {
    try {
      this.logger.debug(`Searching exercises with query: ${query}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('title', { ascending: true });

      if (error) {
        this.logger.error('Supabase error searching exercises:', error);
        throw new InternalServerErrorException(
          `Failed to search exercises: ${error.message}`,
        );
      }

      this.logger.debug(
        `Found ${data?.length || 0} exercises matching query: ${query}`,
      );

      const exercises: ExerciseDto[] = (data || []).map((exercise) => {
        try {
          return ExerciseSchema.parse(exercise);
        } catch (validationError) {
          this.logger.warn(
            `Exercise ${exercise.id} failed validation:`,
            validationError,
          );
          return exercise; // Return as-is if validation fails
        }
      });

      return {
        exercises,
        total: exercises.length,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Error in searchExercises(${query}):`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to search exercises');
    }
  }

  // ==================== USER EXERCISE MANAGEMENT ====================

  /**
   * Get user's custom basslines
   */
  async getUserCustomBasslines(
    userId: string,
  ): Promise<CustomBasslinesResponseDto> {
    try {
      this.logger.debug(`Fetching custom basslines for user: ${userId}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('custom_basslines')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Supabase error fetching custom basslines:', error);
        throw new InternalServerErrorException(
          `Failed to fetch custom basslines: ${error.message}`,
        );
      }

      this.logger.debug(
        `Found ${data?.length || 0} custom basslines for user ${userId}`,
      );

      // Validate custom basslines using contracts schema
      const basslines: CustomBasslineDto[] = (data || []).map((bassline) => {
        try {
          return validateCustomBassline(bassline);
        } catch (validationError) {
          this.logger.warn(
            `Custom bassline ${bassline.id} failed validation:`,
            validationError,
          );
          return bassline; // Return as-is if validation fails
        }
      });

      return {
        basslines,
        total: basslines.length,
      };
    } catch (error) {
      this.logger.error(`Error in getUserCustomBasslines(${userId}):`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch custom basslines',
      );
    }
  }

  /**
   * Save a custom bassline for a user
   */
  async saveCustomBassline(
    userId: string,
    basslineData: unknown,
  ): Promise<CustomBasslineDto> {
    try {
      this.logger.debug(`Saving custom bassline for user: ${userId}`);

      // Validate input data using contracts schema
      const validatedData = validateSaveCustomBassline(basslineData);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Check if the referenced exercise exists
      const { data: exerciseExists, error: exerciseError } = await supabase
        .from('exercises')
        .select('id')
        .eq('id', validatedData.exercise_id)
        .eq('is_active', true)
        .single();

      if (exerciseError || !exerciseExists) {
        this.logger.warn(
          `Referenced exercise not found: ${validatedData.exercise_id}`,
        );
        throw new BadRequestException(
          `Exercise with ID ${validatedData.exercise_id} not found`,
        );
      }

      // Insert the custom bassline
      const { data, error } = await supabase
        .from('custom_basslines')
        .insert({
          user_id: userId,
          exercise_id: validatedData.exercise_id,
          title: validatedData.title,
          notes: validatedData.notes,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          this.logger.warn(
            `Duplicate bassline title for user ${userId}:`,
            error,
          );
          throw new BadRequestException(
            'A bassline with this title already exists for this exercise',
          );
        }
        this.logger.error('Supabase error saving custom bassline:', error);
        throw new InternalServerErrorException(
          `Failed to save custom bassline: ${error.message}`,
        );
      }

      if (!data) {
        throw new InternalServerErrorException(
          'Failed to save custom bassline - no data returned',
        );
      }

      this.logger.debug(`Successfully saved custom bassline: ${data.id}`);

      // Validate and return the saved bassline
      return validateCustomBassline(data);
    } catch (error) {
      this.logger.error(`Error in saveCustomBassline(${userId}):`, error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to save custom bassline');
    }
  }

  /**
   * Update a user's custom bassline
   */
  async updateCustomBassline(
    userId: string,
    basslineId: string,
    updateData: Partial<SaveCustomBasslineDto>,
  ): Promise<CustomBasslineDto> {
    try {
      this.logger.debug(
        `Updating custom bassline ${basslineId} for user: ${userId}`,
      );

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Verify the bassline belongs to the user
      const { data: existingBassline, error: fetchError } = await supabase
        .from('custom_basslines')
        .select('*')
        .eq('id', basslineId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingBassline) {
        this.logger.warn(
          `Custom bassline not found or not owned by user: ${basslineId}`,
        );
        throw new NotFoundException(
          `Custom bassline with ID ${basslineId} not found`,
        );
      }

      // Update the bassline
      const { data, error } = await supabase
        .from('custom_basslines')
        .update(updateData)
        .eq('id', basslineId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          this.logger.warn(
            `Duplicate bassline title for user ${userId}:`,
            error,
          );
          throw new BadRequestException(
            'A bassline with this title already exists for this exercise',
          );
        }
        this.logger.error('Supabase error updating custom bassline:', error);
        throw new InternalServerErrorException(
          `Failed to update custom bassline: ${error.message}`,
        );
      }

      if (!data) {
        throw new InternalServerErrorException(
          'Failed to update custom bassline - no data returned',
        );
      }

      this.logger.debug(`Successfully updated custom bassline: ${data.id}`);

      // Validate and return the updated bassline
      return validateCustomBassline(data);
    } catch (error) {
      this.logger.error(
        `Error in updateCustomBassline(${userId}, ${basslineId}):`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update custom bassline',
      );
    }
  }

  /**
   * Delete a user's custom bassline
   */
  async deleteCustomBassline(
    userId: string,
    basslineId: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Deleting custom bassline ${basslineId} for user: ${userId}`,
      );

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Delete the bassline (RLS policies ensure user can only delete their own)
      const { error } = await supabase
        .from('custom_basslines')
        .delete()
        .eq('id', basslineId)
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Supabase error deleting custom bassline:', error);
        throw new InternalServerErrorException(
          `Failed to delete custom bassline: ${error.message}`,
        );
      }

      this.logger.debug(`Successfully deleted custom bassline: ${basslineId}`);
    } catch (error) {
      this.logger.error(
        `Error in deleteCustomBassline(${userId}, ${basslineId}):`,
        error,
      );
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to delete custom bassline',
      );
    }
  }

  // ==================== EPIC 5 ADMIN OPERATIONS ====================

  /**
   * Create a new exercise (Epic 5 preparation)
   */
  async createExercise(
    exerciseData: unknown,
    createdBy?: string,
  ): Promise<ExerciseDto> {
    try {
      this.logger.debug('Creating new exercise');

      // Validate input data using contracts schema
      const validatedData = validateCreateExercise(exerciseData);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Insert the exercise
      const { data, error } = await supabase
        .from('exercises')
        .insert({
          ...validatedData,
          created_by: createdBy,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Supabase error creating exercise:', error);
        throw new InternalServerErrorException(
          `Failed to create exercise: ${error.message}`,
        );
      }

      if (!data) {
        throw new InternalServerErrorException(
          'Failed to create exercise - no data returned',
        );
      }

      this.logger.debug(`Successfully created exercise: ${data.id}`);

      // Validate and return the created exercise
      return ExerciseSchema.parse(data);
    } catch (error) {
      this.logger.error('Error in createExercise:', error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create exercise');
    }
  }

  /**
   * Update an existing exercise (Epic 5 preparation)
   */
  async updateExercise(
    exerciseId: string,
    updateData: unknown,
    userId?: string,
  ): Promise<ExerciseDto> {
    try {
      this.logger.debug(`Updating exercise: ${exerciseId}`);

      // Validate input data using contracts schema
      const validatedData = validateUpdateExercise(updateData);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        this.logger.error('Supabase service is not ready');
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Build update query
      let query = supabase
        .from('exercises')
        .update(validatedData)
        .eq('id', exerciseId);

      // If userId is provided, ensure user owns the exercise
      if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.warn(
            `Exercise not found or not owned by user: ${exerciseId}`,
          );
          throw new NotFoundException(
            `Exercise with ID ${exerciseId} not found`,
          );
        }
        this.logger.error('Supabase error updating exercise:', error);
        throw new InternalServerErrorException(
          `Failed to update exercise: ${error.message}`,
        );
      }

      if (!data) {
        throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
      }

      this.logger.debug(`Successfully updated exercise: ${data.id}`);

      // Validate and return the updated exercise
      return ExerciseSchema.parse(data);
    } catch (error) {
      this.logger.error(`Error in updateExercise(${exerciseId}):`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update exercise');
    }
  }
}
