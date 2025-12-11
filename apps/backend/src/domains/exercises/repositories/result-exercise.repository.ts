import { Injectable, Inject } from '@nestjs/common';
import type {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions,
} from './exercise.repository.interface.js';
import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { Result, ResultUtils } from '../../shared/result.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface IResultExerciseRepository {
  findById(id: ExerciseId): Promise<Result<Exercise | null>>;
  findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Exercise>>>;
  findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>>;
  search(query: string): Promise<Result<Exercise[]>>;
  save(exercise: Exercise): Promise<Result<void>>;
  update(exercise: Exercise): Promise<Result<void>>;
  delete(id: ExerciseId): Promise<Result<void>>;
  exists(id: ExerciseId): Promise<Result<boolean>>;
  findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>>;
  saveMany(exercises: Exercise[]): Promise<Result<void>>;
  updateMany(exercises: Exercise[]): Promise<Result<void>>;
  deleteMany(ids: ExerciseId[]): Promise<Result<void>>;
}

@Injectable()
export class ResultExerciseRepository implements IResultExerciseRepository {
  private readonly staticLogger = createStructuredLogger(
    ResultExerciseRepository.name,
  );

  constructor(
    private readonly repository: IExerciseRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: ExerciseId): Promise<Result<Exercise | null>> {
    try {
      const exercise = await this.repository.findById(id);
      return ResultUtils.ok(exercise);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();

      logger.error(`Failed to find exercise ${id.value}:`, error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Exercise>>> {
    try {
      const result = await this.repository.findAll(options);
      return ResultUtils.ok(result);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find all exercises:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>> {
    try {
      const exercises = await this.repository.findByDifficulty(difficulty);
      return ResultUtils.ok(exercises);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find exercises by difficulty ${difficulty.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async search(query: string): Promise<Result<Exercise[]>> {
    try {
      const exercises = await this.repository.search(query);
      return ResultUtils.ok(exercises);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to search exercises with query "${query}":`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async save(exercise: Exercise): Promise<Result<void>> {
    try {
      await this.repository.save(exercise);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save exercise:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async update(exercise: Exercise): Promise<Result<void>> {
    try {
      await this.repository.update(exercise);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to update exercise ${exercise.id.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async delete(id: ExerciseId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to delete exercise ${id.value}:`, error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async exists(id: ExerciseId): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.exists(id);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check existence of exercise ${id.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>> {
    try {
      const exercises = await this.repository.findByIds(ids);
      return ResultUtils.ok(exercises);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find exercises by ids:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async saveMany(exercises: Exercise[]): Promise<Result<void>> {
    try {
      await this.repository.saveMany(exercises);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save exercises batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async updateMany(exercises: Exercise[]): Promise<Result<void>> {
    try {
      await this.repository.updateMany(exercises);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to update exercises batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async deleteMany(ids: ExerciseId[]): Promise<Result<void>> {
    try {
      await this.repository.deleteMany(ids);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to delete exercises batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }
}
