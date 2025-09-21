import { apiClient } from '@/lib/api-client';
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

export class ExerciseRepository implements IExerciseRepository {
  private readonly baseUrl = '/api/v1/exercises';

  async findById(id: ExerciseId): Promise<Result<Exercise>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id.value}`);
      const exercise = Exercise.fromDTO(response.data);
      return Result.ok(exercise);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch exercise');
    }
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Exercise>>> {
    try {
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(
        `${this.baseUrl}?${params.toString()}`,
      );
      const { items, total, page, limit } = response.data;

      const exercises = items.map((dto: any) => Exercise.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        items: exercises,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch exercises');
    }
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/difficulty/${difficulty.value}`,
      );
      const exercises = response.data.map((dto: any) => Exercise.fromDTO(dto));
      return Result.ok(exercises);
    } catch (error: any) {
      return Result.fail(
        error.message || 'Failed to fetch exercises by difficulty',
      );
    }
  }

  async findByTag(tag: string): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/tag/${encodeURIComponent(tag)}`,
      );
      const exercises = response.data.map((dto: any) => Exercise.fromDTO(dto));
      return Result.ok(exercises);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch exercises by tag');
    }
  }

  async search(options: SearchOptions): Promise<Result<Exercise[]>> {
    try {
      const params = new URLSearchParams();
      params.append('q', options.query);

      if (options.difficulty) {
        params.append('difficulty', options.difficulty.value);
      }

      if (options.tags && options.tags.length > 0) {
        params.append('tags', options.tags.join(','));
      }

      if (options.isActive !== undefined) {
        params.append('active', options.isActive.toString());
      }

      if (options.bpmRange) {
        params.append('bpmMin', options.bpmRange.min.toString());
        params.append('bpmMax', options.bpmRange.max.toString());
      }

      const response = await apiClient.get(
        `${this.baseUrl}/search?${params.toString()}`,
      );
      const exercises = response.data.map((dto: any) => Exercise.fromDTO(dto));
      return Result.ok(exercises);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to search exercises');
    }
  }

  async findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch`, {
        ids: ids.map((id) => id.value),
      });
      const exercises = response.data.map((dto: any) => Exercise.fromDTO(dto));
      return Result.ok(exercises);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch exercises by ids');
    }
  }

  async findActive(): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/active`);
      const exercises = response.data.map((dto: any) => Exercise.fromDTO(dto));
      return Result.ok(exercises);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch active exercises');
    }
  }

  async save(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      const response = await apiClient.post(this.baseUrl, exercise.toDTO());
      const savedExercise = Exercise.fromDTO(response.data);
      return Result.ok(savedExercise);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save exercise');
    }
  }

  async update(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/${exercise.id.value}`,
        exercise.toDTO(),
      );
      const updatedExercise = Exercise.fromDTO(response.data);
      return Result.ok(updatedExercise);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to update exercise');
    }
  }

  async delete(id: ExerciseId): Promise<Result<void>> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id.value}`);
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete exercise');
    }
  }

  async saveMany(exercises: Exercise[]): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch/create`, {
        exercises: exercises.map((e) => e.toDTO()),
      });
      const savedExercises = response.data.map((dto: any) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(savedExercises);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save exercises');
    }
  }

  async deleteMany(ids: ExerciseId[]): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/batch/delete`, {
        ids: ids.map((id) => id.value),
      });
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete exercises');
    }
  }

  async exists(id: ExerciseId): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(`${this.baseUrl}/${id.value}`);
      return Result.ok(response.status === 200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return Result.ok(false);
      }
      return Result.fail(error.message || 'Failed to check if exercise exists');
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/count`);
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to count exercises');
    }
  }

  async countByDifficulty(difficulty: Difficulty): Promise<Result<number>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/count/difficulty/${difficulty.value}`,
      );
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(
        error.message || 'Failed to count exercises by difficulty',
      );
    }
  }
}
