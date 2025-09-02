// Value Objects
export { ExerciseId } from '../value-objects/exercise-id';
export { Difficulty } from '../value-objects/difficulty';

// Entities
export { Exercise } from '../entities/exercise.entity';
export type { ExerciseNote, ExerciseProps } from '../entities/exercise.entity';

// Repository Interfaces
export type {
  IExerciseRepository,
  PaginationOptions,
  PaginatedResult,
  SearchOptions,
} from './exercise.repository.interface';

// Repository Implementations
export { ExerciseRepository } from './exercise.repository';
export { CachedExerciseRepository } from './cached-exercise.repository';
export { ResultExerciseRepository } from './result-exercise.repository';

// Store and Hooks
export {
  useExerciseRepositoryStore,
  useExercise,
  useExercises,
  useActiveExercises,
} from '../stores/exercise.repository.store';