import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, Inject } from '@nestjs/common';
import type { IResultExerciseRepository } from './repositories/result-exercise.repository.js';
import { Exercise } from './entities/exercise.entity.js';
import { ExerciseId } from './value-objects/exercise-id.vo.js';
import { Difficulty } from './value-objects/difficulty.vo.js';
import {
  ExerciseDto,
  ExercisesResponseDto,
  ExerciseResponseDto } from './dto/exercise-response.dto.js';
import {
  validateCreateExercise,
  validateUpdateExercise } from './dto/create-exercise.dto.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class ExercisesService {
  private readonly staticLogger = createStructuredLogger(ExercisesService.name);

  constructor(
    @Inject('IResultExerciseRepository')
    private readonly exerciseRepository: IResultExerciseRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('🔧 ExercisesService constructor called', { correlationId });
  }

  /**
   * Get all active exercises with pagination support
   */
  async getAllExercises(page = 1, limit = 50): Promise<ExercisesResponseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    try {
      logger.debug(`Fetching exercises - page: ${page}, limit: ${limit}`, { correlationId });

      const result = await this.exerciseRepository.findAll({ page, limit });

      if (!result.ok) {
        logger.error('Error fetching exercises:', result.error, { correlationId });
        throw new InternalServerErrorException('Failed to fetch exercises');
      }

      logger.debug(
        `Found ${result.value.items.length} exercises (total: ${result.value.total})`,
        { correlationId }
      );

      // Convert entities to DTOs
      const exercises: ExerciseDto[] = result.value.items.map((exercise) =>
        this.mapEntityToDto(exercise),
      );

      return {
        exercises,
        total: result.value.total,
        cached: false, // TODO: Implement caching in Phase 4
      };
    } catch (error) {
      logger.error('Error in getAllExercises:', error as Error, { correlationId });
      throw new InternalServerErrorException('Failed to fetch exercises');
    }
  }

  /**
   * Get a specific exercise by ID with full validation
   */
  async getExerciseById(id: string): Promise<ExerciseResponseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    
    try {
      logger.debug(`Fetching exercise with ID: ${id}`, { correlationId });

      // Validate ID format
      if (!ExerciseId.isValid(id)) {
        throw new BadRequestException('Invalid exercise ID format');
      }

      const exerciseId = ExerciseId.create(id);
      const result = await this.exerciseRepository.findById(exerciseId);

      if (!result.ok) {
        logger.error('Error fetching exercise:', result.error, { correlationId });
        throw new InternalServerErrorException('Failed to fetch exercise');
      }

      if (!result.value) {
        logger.warn(`Exercise not found: ${id}`, { correlationId });
        throw new NotFoundException(`Exercise with ID ${id} not found`);
      }

      logger.debug(`Found exercise: ${result.value.title}`, { correlationId });

      return {
        exercise: this.mapEntityToDto(result.value) };
    } catch (error) {
      logger.error(`Error in getExerciseById(${id}):`, error as Error, { correlationId });
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
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
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      logger.debug(`Fetching exercises with difficulty: ${difficulty}`, { correlationId });

      const difficultyVO = Difficulty.create(difficulty);
      const result =
        await this.exerciseRepository.findByDifficulty(difficultyVO);

      if (!result.ok) {
        logger.error('Error fetching exercises by difficulty:', result.error, { correlationId });
        throw new InternalServerErrorException(
          'Failed to fetch exercises by difficulty',
        );
      }

      logger.debug(
        `Found ${result.value.length} exercises with difficulty ${difficulty}`,
        { correlationId }
      );

      return {
        exercises: result.value.map((exercise) =>
          this.mapEntityToDto(exercise),
        ),
        total: result.value.length,
        cached: false };
    } catch (error) {
      logger.error(
        `Error in getExercisesByDifficulty(${difficulty}):`,
        error as Error,
        { correlationId }
      );
      throw new InternalServerErrorException(
        'Failed to fetch exercises by difficulty',
      );
    }
  }

  /**
   * Search exercises by title or description
   */
  async searchExercises(query: string): Promise<ExercisesResponseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      logger.debug(`Searching exercises with query: ${query}`, { correlationId });

      const result = await this.exerciseRepository.search(query);

      if (!result.ok) {
        logger.error('Error searching exercises:', result.error, { correlationId });
        throw new InternalServerErrorException('Failed to search exercises');
      }

      logger.debug(
        `Found ${result.value.length} exercises matching query: ${query}`,
        { correlationId }
      );

      return {
        exercises: result.value.map((exercise) =>
          this.mapEntityToDto(exercise),
        ),
        total: result.value.length,
        cached: false };
    } catch (error) {
      logger.error(`Error in searchExercises(${query}):`, error as Error, { correlationId });
      throw new InternalServerErrorException('Failed to search exercises');
    }
  }

  /**
   * Create a new exercise (Epic 5 preparation)
   */
  async createExercise(
    exerciseData: unknown,
    createdBy?: string,
  ): Promise<ExerciseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      logger.debug('Creating new exercise', { correlationId });

      // Validate input data using contracts schema
      const validatedData = validateCreateExercise(exerciseData);

      // Create domain entity
      const exercise = Exercise.create({
        id: ExerciseId.create(),
        title: validatedData.title,
        description: validatedData.description || '',
        difficulty: Difficulty.create(validatedData.difficulty),
        duration: validatedData.duration,
        bpm: validatedData.bpm,
        key: validatedData.key,
        notes: validatedData.notes || [],
        tags: [], // tags are not in the CreateExerciseRequestSchema
        isActive: true,
        createdBy });

      // Save through repository
      const saveResult = await this.exerciseRepository.save(exercise);

      if (!saveResult.ok) {
        logger.error('Error saving exercise:', saveResult.error, { correlationId });
        throw new InternalServerErrorException('Failed to create exercise');
      }

      logger.debug(`Successfully created exercise: ${exercise.id.value}`, { correlationId });

      return this.mapEntityToDto(exercise);
    } catch (error) {
      logger.error('Error in createExercise:', error as Error, { correlationId });
      throw new InternalServerErrorException('Failed to create exercise');
    }
  }

  /**
   * Create exercise with MIDI file metadata
   */
  async createExerciseWithMidiFile(exerciseData: {
    id: string;
    title: string;
    description?: string;
    difficulty: string;
    duration: number;
    bpm: number;
    key: string;
    notes: any[];
    midi_file_path: string;
    original_filename: string;
    file_size: number;
    uploaded_at: string;
    created_by: string;
  }): Promise<ExerciseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      logger.debug(
        `Creating exercise with MIDI file: ${exerciseData.title}`,
        { correlationId }
      );

      // Create domain entity
      const exercise = Exercise.create({
        id: ExerciseId.create(exerciseData.id),
        title: exerciseData.title,
        description: exerciseData.description || '',
        difficulty: Difficulty.create(exerciseData.difficulty),
        duration: exerciseData.duration,
        bpm: exerciseData.bpm,
        key: exerciseData.key,
        notes: exerciseData.notes,
        tags: [],
        isActive: true,
        midiFilePath: exerciseData.midi_file_path,
        originalFilename: exerciseData.original_filename,
        fileSize: exerciseData.file_size,
        uploadedAt: new Date(exerciseData.uploaded_at),
        createdBy: exerciseData.created_by });

      // Save through repository
      const saveResult = await this.exerciseRepository.save(exercise);

      if (!saveResult.ok) {
        logger.error('Error saving exercise with MIDI file:',
          saveResult.error, { correlationId });
        throw new InternalServerErrorException(
          'Failed to create exercise with MIDI file',
        );
      }

      logger.debug(
        `Successfully created exercise with MIDI: ${exercise.id.value}`,
        { correlationId }
      );

      return this.mapEntityToDto(exercise);
    } catch (error) {
      logger.error('Error in createExerciseWithMidiFile:', error as Error, { correlationId });
      throw new InternalServerErrorException(
        'Failed to create exercise with MIDI file',
      );
    }
  }

  /**
   * Update an existing exercise (Epic 5 preparation)
   */
  async updateExercise(
    exerciseId: string,
    updateData: unknown,
    _userId?: string,
  ): Promise<ExerciseDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    try {
      logger.debug(`Updating exercise: ${exerciseId}`, { correlationId });

      // Validate input data
      const validatedData = validateUpdateExercise(updateData);

      // Validate ID format
      if (!ExerciseId.isValid(exerciseId)) {
        throw new BadRequestException('Invalid exercise ID format');
      }

      const id = ExerciseId.create(exerciseId);
      const findResult = await this.exerciseRepository.findById(id);

      if (!findResult.ok) {
        logger.error('Error fetching exercise for update:',
          findResult.error, { correlationId });
        throw new InternalServerErrorException(
          'Failed to fetch exercise for update',
        );
      }

      if (!findResult.value) {
        throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
      }

      const exercise = findResult.value;

      // Apply updates to entity
      if (validatedData.title !== undefined) {
        exercise.updateTitle(validatedData.title);
      }
      if (validatedData.description !== undefined) {
        exercise.updateDescription(validatedData.description);
      }
      if (validatedData.difficulty !== undefined) {
        exercise.updateDifficulty(Difficulty.create(validatedData.difficulty));
      }
      if (validatedData.bpm !== undefined) {
        exercise.updateBpm(validatedData.bpm);
      }

      // Update through repository
      const updateResult = await this.exerciseRepository.update(exercise);

      if (!updateResult.ok) {
        logger.error('Error updating exercise:', updateResult.error, { correlationId });
        throw new InternalServerErrorException('Failed to update exercise');
      }

      logger.debug(`Successfully updated exercise: ${exercise.id.value}`, { correlationId });

      return this.mapEntityToDto(exercise);
    } catch (error) {
      logger.error(`Error in updateExercise(${exerciseId}):`, error as Error, { correlationId });
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update exercise');
    }
  }

  /**
   * Map domain entity to DTO
   */
  private mapEntityToDto(exercise: Exercise): ExerciseDto {
    const persistenceData = exercise.toPersistence();

    // Map back to DTO format expected by frontend
    return {
      id: persistenceData.id,
      title: persistenceData.title,
      description: persistenceData.description,
      difficulty: persistenceData.difficulty,
      duration: persistenceData.duration,
      bpm: persistenceData.bpm,
      key: persistenceData.key,
      notes: persistenceData.notes,
      tags: persistenceData.tags,
      is_active: persistenceData.is_active,
      // Legacy single MIDI file
      midi_file_path: persistenceData.midi_file_path,
      original_filename: persistenceData.original_filename,
      file_size: persistenceData.file_size,
      uploaded_at: persistenceData.uploaded_at,
      // New separate MIDI files for each widget (Story 4.4)
      drummer_midi_url: persistenceData.drummer_midi_url,
      bassline_midi_url: persistenceData.bassline_midi_url,
      harmony_midi_url: persistenceData.harmony_midi_url,
      metronome_midi_url: persistenceData.metronome_midi_url,
      // Pre-converted patterns (Story 4.4 - avoid re-parsing MIDI on client)
      drum_pattern: persistenceData.drum_pattern,
      harmony_notes: persistenceData.harmony_notes,
      harmony_control_changes: persistenceData.harmony_control_changes,
      harmony_instrument: persistenceData.harmony_instrument,
      // Musical metadata
      duration_beats: persistenceData.duration_beats,
      total_bars: persistenceData.total_bars,
      time_signature: persistenceData.time_signature,
      tutorial_id: persistenceData.tutorial_id,
      created_by: persistenceData.created_by,
      created_at: persistenceData.created_at,
      updated_at: persistenceData.updated_at } as ExerciseDto;
  }
}
