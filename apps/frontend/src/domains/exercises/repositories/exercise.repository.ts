import { apiClient } from '@/lib/api-client';
import { Result } from '@/shared/types/result';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseId } from '../value-objects/exercise-id.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions,
  SearchOptions,
} from './exercise.repository.interface';
import type { ExerciseDTO } from '@bassnotion/contracts';

/** Helper to check if error has response status for HTTP errors */
function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}

export class ExerciseRepository implements IExerciseRepository {
  private readonly baseUrl = '/api/v1/exercises';

  async findById(id: ExerciseId): Promise<Result<Exercise>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id.value}`);
      // Backend wraps response in { exercise: {...} }, so unwrap it
      const exercise = Exercise.fromDTO(
        (response as { exercise: ExerciseDTO }).exercise,
      );
      return Result.ok(exercise);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch exercise';
      return Result.fail(errorMessage);
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
      const { items, total, page, limit } = response as {
        items: ExerciseDTO[];
        total: number;
        page: number;
        limit: number;
      };

      const exercises = items.map((dto: ExerciseDTO) => Exercise.fromDTO(dto));
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch exercises';
      return Result.fail(errorMessage);
    }
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/difficulty/${difficulty.value}`,
      );
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch exercises by difficulty';
      return Result.fail(errorMessage);
    }
  }

  async findByTag(tag: string): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/tag/${encodeURIComponent(tag)}`,
      );
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch exercises by tag';
      return Result.fail(errorMessage);
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
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to search exercises';
      return Result.fail(errorMessage);
    }
  }

  async findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch`, {
        ids: ids.map((id) => id.value),
      });
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch exercises by ids';
      return Result.fail(errorMessage);
    }
  }

  async findActive(): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/active`);
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch active exercises';
      return Result.fail(errorMessage);
    }
  }

  async save(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      const dto = exercise.toDTO();
      const response = await apiClient.post(this.baseUrl, dto);
      // API client returns the data directly, not wrapped in { data: ... }
      const savedExercise = Exercise.fromDTO(response as ExerciseDTO);
      return Result.ok(savedExercise);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save exercise';
      return Result.fail(errorMessage);
    }
  }

  // Alias for save method to match common naming conventions
  async create(exercise: Exercise): Promise<Result<Exercise>> {
    return this.save(exercise);
  }

  // Find exercises by tutorial ID
  async findByTutorialId(tutorialId: string): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/tutorial/${tutorialId}`,
      );
      const exercises = (response as ExerciseDTO[]).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );
      return Result.ok(exercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch exercises by tutorial ID';
      return Result.fail(errorMessage);
    }
  }

  // Delete exercise by string ID (for convenience)
  async deleteById(id: string): Promise<Result<void>> {
    return this.delete(ExerciseId.create(id));
  }

  async update(exercise: Exercise): Promise<Result<Exercise>> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/${exercise.id.value}`,
        exercise.toDTO(),
      );
      const updatedExercise = Exercise.fromDTO(response as ExerciseDTO);
      return Result.ok(updatedExercise);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update exercise';
      return Result.fail(errorMessage);
    }
  }

  async delete(id: ExerciseId): Promise<Result<void>> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id.value}`);
      return Result.ok(undefined);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete exercise';
      return Result.fail(errorMessage);
    }
  }

  async saveMany(exercises: Exercise[]): Promise<Result<Exercise[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch/create`, {
        exercises: exercises.map((e) => e.toDTO()),
      });
      const savedExercises = (response as ExerciseDTO[]).map(
        (dto: ExerciseDTO) => Exercise.fromDTO(dto),
      );
      return Result.ok(savedExercises);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save exercises';
      return Result.fail(errorMessage);
    }
  }

  async deleteMany(ids: ExerciseId[]): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/batch/delete`, {
        ids: ids.map((id) => id.value),
      });
      return Result.ok(undefined);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete exercises';
      return Result.fail(errorMessage);
    }
  }

  async exists(id: ExerciseId): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(`${this.baseUrl}/${id.value}`);
      return Result.ok(response.status === 200);
    } catch (error: unknown) {
      if (getErrorStatus(error) === 404) {
        return Result.ok(false);
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to check if exercise exists';
      return Result.fail(errorMessage);
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/count`);
      return Result.ok((response as { count: number }).count);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to count exercises';
      return Result.fail(errorMessage);
    }
  }

  async countByDifficulty(difficulty: Difficulty): Promise<Result<number>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/count/difficulty/${difficulty.value}`,
      );
      return Result.ok((response as { count: number }).count);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to count exercises by difficulty';
      return Result.fail(errorMessage);
    }
  }
}
