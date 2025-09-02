import { Result } from '@/shared/types/result';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseId } from '../value-objects/exercise-id';
import { Difficulty } from '../value-objects/difficulty';
import {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions,
  SearchOptions,
} from './exercise.repository.interface';
import { ExerciseRepository } from './exercise.repository';
import { CachedExerciseRepository } from './cached-exercise.repository';

export class ResultExerciseRepository implements IExerciseRepository {
  private readonly repository: IExerciseRepository;

  constructor() {
    const baseRepository = new ExerciseRepository();
    this.repository = new CachedExerciseRepository(baseRepository);
  }

  async findById(id: ExerciseId): Promise<Result<Exercise>> {
    try {
      return await this.repository.findById(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching exercise'
      );
    }
  }

  async findAll(options?: PaginationOptions): Promise<Result<PaginatedResult<Exercise>>> {
    try {
      return await this.repository.findAll(options);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching exercises'
      );
    }
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.findByDifficulty(difficulty);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching exercises by difficulty'
      );
    }
  }

  async findByTag(tag: string): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.findByTag(tag);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching exercises by tag'
      );
    }
  }

  async search(options: SearchOptions): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.search(options);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while searching exercises'
      );
    }
  }

  async findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.findByIds(ids);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching exercises by ids'
      );
    }
  }

  async findActive(): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.findActive();
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching active exercises'
      );
    }
  }

  async save(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      return await this.repository.save(exercise);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving exercise'
      );
    }
  }

  async update(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      return await this.repository.update(exercise);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while updating exercise'
      );
    }
  }

  async delete(id: ExerciseId): Promise<Result<void>> {
    try {
      return await this.repository.delete(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting exercise'
      );
    }
  }

  async saveMany(exercises: Exercise[]): Promise<Result<Exercise[]>> {
    try {
      return await this.repository.saveMany(exercises);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving exercises'
      );
    }
  }

  async deleteMany(ids: ExerciseId[]): Promise<Result<void>> {
    try {
      return await this.repository.deleteMany(ids);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting exercises'
      );
    }
  }

  async exists(id: ExerciseId): Promise<Result<boolean>> {
    try {
      return await this.repository.exists(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while checking exercise existence'
      );
    }
  }

  async count(): Promise<Result<number>> {
    try {
      return await this.repository.count();
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while counting exercises'
      );
    }
  }

  async countByDifficulty(difficulty: Difficulty): Promise<Result<number>> {
    try {
      return await this.repository.countByDifficulty(difficulty);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while counting exercises by difficulty'
      );
    }
  }

  // Utility method to access cache clearing if needed
  clearCache(): void {
    if (this.repository instanceof CachedExerciseRepository) {
      this.repository.clearCache();
    }
  }
}