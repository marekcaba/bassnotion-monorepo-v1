import { Exercise } from '../entities/exercise.entity';
import { ExerciseId } from '../value-objects/exercise-id';
import { Difficulty } from '../value-objects/difficulty';
import { Result } from '@/shared/types/result';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SearchOptions {
  query: string;
  difficulty?: Difficulty;
  tags?: string[];
  isActive?: boolean;
  bpmRange?: {
    min: number;
    max: number;
  };
}

export interface IExerciseRepository {
  // Read operations
  findById(id: ExerciseId): Promise<Result<Exercise>>;
  findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Exercise>>>;
  findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>>;
  findByTag(tag: string): Promise<Result<Exercise[]>>;
  search(options: SearchOptions): Promise<Result<Exercise[]>>;
  findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>>;
  findActive(): Promise<Result<Exercise[]>>;

  // Write operations
  save(exercise: Exercise): Promise<Result<Exercise>>;
  update(exercise: Exercise): Promise<Result<Exercise>>;
  delete(id: ExerciseId): Promise<Result<void>>;

  // Batch operations
  saveMany(exercises: Exercise[]): Promise<Result<Exercise[]>>;
  deleteMany(ids: ExerciseId[]): Promise<Result<void>>;

  // Utility operations
  exists(id: ExerciseId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
  countByDifficulty(difficulty: Difficulty): Promise<Result<number>>;
}
