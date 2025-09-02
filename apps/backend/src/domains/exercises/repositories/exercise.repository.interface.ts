import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IExerciseRepository {
  findById(id: ExerciseId): Promise<Exercise | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<Exercise>>;
  findByDifficulty(difficulty: Difficulty): Promise<Exercise[]>;
  search(query: string): Promise<Exercise[]>;
  save(exercise: Exercise): Promise<void>;
  update(exercise: Exercise): Promise<void>;
  delete(id: ExerciseId): Promise<void>;
  exists(id: ExerciseId): Promise<boolean>;
  findByIds(ids: ExerciseId[]): Promise<Exercise[]>;

  // Batch operations
  saveMany(exercises: Exercise[]): Promise<void>;
  updateMany(exercises: Exercise[]): Promise<void>;
  deleteMany(ids: ExerciseId[]): Promise<void>;
}
