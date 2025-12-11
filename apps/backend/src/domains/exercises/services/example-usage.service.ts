import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import type { IResultExerciseRepository } from '../repositories/result-exercise.repository.js';
import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { ResultUtils } from '../../shared/result.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/**
 * Example service showing how to use the Result pattern repository
 */
@Injectable()
export class ExampleUsageService {
  private readonly staticLogger = createStructuredLogger(
    ExampleUsageService.name,
  );

  constructor(
    @Inject('IResultExerciseRepository')
    private readonly exerciseRepository: IResultExerciseRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Example: Get exercise by ID with clean error handling
   */
  async getExercise(id: string) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // No try-catch needed!
    const result = await this.exerciseRepository.findById(
      ExerciseId.create(id),
    );

    if (!result.ok) {
      // Log the actual error internally
      logger.error('Failed to get exercise:', result.error, { correlationId });

      // Return user-friendly error
      throw new HttpException('Exercise not found', HttpStatus.NOT_FOUND);
    }

    return result.value;
  }

  /**
   * Example: Batch import exercises with transaction-like behavior
   */
  async importExercises(exerciseData: any[]) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Convert data to Exercise entities
    const exercises = exerciseData.map((data) =>
      this.createExerciseFromData(data),
    );

    // Save all exercises
    const result = await this.exerciseRepository.saveMany(exercises);

    if (!result.ok) {
      // Rollback logic could go here
      logger.error('Batch import failed:', result.error, { correlationId });

      throw new HttpException(
        'Failed to import exercises',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: `Successfully imported ${exercises.length} exercises`,
      count: exercises.length,
    };
  }

  /**
   * Example: Complex operation with multiple steps
   */
  async promoteBeginnerExercises() {
    // Step 1: Find all beginner exercises
    const beginnerResult = await this.exerciseRepository.findByDifficulty(
      Difficulty.beginner(),
    );

    if (!beginnerResult.ok) {
      throw new HttpException(
        'Failed to fetch beginner exercises',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const exercises = beginnerResult.value;

    // Step 2: Update difficulty for exercises with high BPM
    const toUpdate = exercises
      .filter((e) => e.bpm > 100)
      .map((e) => {
        e.updateDifficulty(Difficulty.intermediate());
        return e;
      });

    if (toUpdate.length === 0) {
      return { message: 'No exercises to promote', count: 0 };
    }

    // Step 3: Batch update
    const updateResult = await this.exerciseRepository.updateMany(toUpdate);

    if (!updateResult.ok) {
      throw new HttpException(
        'Failed to update exercises',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: `Promoted ${toUpdate.length} exercises to intermediate`,
      count: toUpdate.length,
    };
  }

  /**
   * Example: Using Result utilities for transformations
   */
  async getExerciseSummary(id: string) {
    const result = await this.exerciseRepository.findById(
      ExerciseId.create(id),
    );

    // Transform the result if successful
    const summaryResult = ResultUtils.map(result, (exercise) => {
      if (!exercise) return null;

      return {
        id: exercise.id.value,
        title: exercise.title,
        difficulty: exercise.difficulty.value,
        duration: exercise.getDurationInMinutes(),
        tempo: exercise.isFastTempo()
          ? 'fast'
          : exercise.isMediumTempo()
            ? 'medium'
            : 'slow',
        beginnerFriendly: exercise.canBePlayedByBeginner(),
      };
    });

    if (!summaryResult.ok) {
      throw new HttpException(
        'Failed to get exercise summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!summaryResult.value) {
      throw new HttpException('Exercise not found', HttpStatus.NOT_FOUND);
    }

    return summaryResult.value;
  }

  private createExerciseFromData(_data: any): Exercise {
    // Exercise creation logic here
    throw new Error('Not implemented for example');
  }
}
