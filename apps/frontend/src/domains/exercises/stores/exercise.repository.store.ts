import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Result } from '@/shared/types/result';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseId } from '../value-objects/exercise-id';
import { Difficulty } from '../value-objects/difficulty';
import { ResultExerciseRepository } from '../repositories/result-exercise.repository';
import {
  PaginatedResult,
  PaginationOptions,
  SearchOptions,
} from '../repositories/exercise.repository.interface';

interface ExerciseRepositoryState {
  // State
  exercises: Map<string, Exercise>;
  activeExercises: Exercise[];
  isLoading: boolean;
  error: string | null;
  lastFetch: Date | null;

  // Pagination state
  currentPage: PaginatedResult<Exercise> | null;

  // Repository instance
  repository: ResultExerciseRepository;

  // Actions
  fetchById: (id: ExerciseId) => Promise<Result<Exercise>>;
  fetchAll: (
    options?: PaginationOptions,
  ) => Promise<Result<PaginatedResult<Exercise>>>;
  fetchByDifficulty: (difficulty: Difficulty) => Promise<Result<Exercise[]>>;
  fetchByTag: (tag: string) => Promise<Result<Exercise[]>>;
  search: (options: SearchOptions) => Promise<Result<Exercise[]>>;
  fetchActive: () => Promise<Result<Exercise[]>>;

  // Mutations
  save: (exercise: Exercise) => Promise<Result<Exercise>>;
  update: (exercise: Exercise) => Promise<Result<Exercise>>;
  delete: (id: ExerciseId) => Promise<Result<void>>;

  // Batch operations
  saveMany: (exercises: Exercise[]) => Promise<Result<Exercise[]>>;
  deleteMany: (ids: ExerciseId[]) => Promise<Result<void>>;

  // Utility
  clearCache: () => void;
  reset: () => void;

  // Getters
  getExerciseById: (id: string) => Exercise | undefined;
  getExercisesByDifficulty: (difficulty: Difficulty) => Exercise[];
  getExercisesByTag: (tag: string) => Exercise[];
}

const initialState = {
  exercises: new Map<string, Exercise>(),
  activeExercises: [],
  isLoading: false,
  error: null,
  lastFetch: null,
  currentPage: null,
};

export const useExerciseRepositoryStore = create<ExerciseRepositoryState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      repository: new ResultExerciseRepository(),

      fetchById: async (id: ExerciseId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findById(id);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            exercises.set(result.value!.id.value, result.value!);
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchAll: async (options?: PaginationOptions) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findAll(options);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            result.value!.items.forEach((exercise) => {
              exercises.set(exercise.id.value, exercise);
            });
            return {
              exercises,
              currentPage: result.value!,
              isLoading: false,
              lastFetch: new Date(),
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchByDifficulty: async (difficulty: Difficulty) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByDifficulty(difficulty);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            result.value!.forEach((exercise) => {
              exercises.set(exercise.id.value, exercise);
            });
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchByTag: async (tag: string) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findByTag(tag);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            result.value!.forEach((exercise) => {
              exercises.set(exercise.id.value, exercise);
            });
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      search: async (options: SearchOptions) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.search(options);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            result.value!.forEach((exercise) => {
              exercises.set(exercise.id.value, exercise);
            });
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      fetchActive: async () => {
        set({ isLoading: true, error: null });
        const result = await get().repository.findActive();

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            result.value!.forEach((exercise) => {
              exercises.set(exercise.id.value, exercise);
            });
            return {
              exercises,
              activeExercises: result.value!,
              isLoading: false,
              lastFetch: new Date(),
            };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      save: async (exercise: Exercise) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.save(exercise);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            exercises.set(result.value!.id.value, result.value!);
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      update: async (exercise: Exercise) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.update(exercise);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercises = new Map(state.exercises);
            exercises.set(result.value!.id.value, result.value!);
            return { exercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      delete: async (id: ExerciseId) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.delete(id);

        if (result.isSuccess) {
          set((state) => {
            const exercises = new Map(state.exercises);
            exercises.delete(id.value);
            const activeExercises = state.activeExercises.filter(
              (e) => !e.id.equals(id),
            );
            return { exercises, activeExercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      saveMany: async (exercises: Exercise[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.saveMany(exercises);

        if (result.isSuccess && result.value) {
          set((state) => {
            const exercisesMap = new Map(state.exercises);
            result.value!.forEach((exercise) => {
              exercisesMap.set(exercise.id.value, exercise);
            });
            return { exercises: exercisesMap, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      deleteMany: async (ids: ExerciseId[]) => {
        set({ isLoading: true, error: null });
        const result = await get().repository.deleteMany(ids);

        if (result.isSuccess) {
          set((state) => {
            const exercises = new Map(state.exercises);
            ids.forEach((id) => exercises.delete(id.value));
            const activeExercises = state.activeExercises.filter(
              (e) => !ids.some((id) => e.id.equals(id)),
            );
            return { exercises, activeExercises, isLoading: false };
          });
        } else {
          set({ isLoading: false, error: result.error || null });
        }

        return result;
      },

      clearCache: () => {
        get().repository.clearCache();
      },

      reset: () => {
        set(initialState);
      },

      getExerciseById: (id: string) => {
        return get().exercises.get(id);
      },

      getExercisesByDifficulty: (difficulty: Difficulty) => {
        return Array.from(get().exercises.values()).filter((exercise) =>
          exercise.difficulty.equals(difficulty),
        );
      },

      getExercisesByTag: (tag: string) => {
        return Array.from(get().exercises.values()).filter((exercise) =>
          exercise.hasTag(tag),
        );
      },
    }),
    {
      name: 'exercise-repository-store',
    },
  ),
);

// Convenience hooks
export const useExercise = (id: string) => {
  const exercise = useExerciseRepositoryStore((state) =>
    state.getExerciseById(id),
  );
  const fetchById = useExerciseRepositoryStore((state) => state.fetchById);
  const isLoading = useExerciseRepositoryStore((state) => state.isLoading);
  const error = useExerciseRepositoryStore((state) => state.error);

  return {
    exercise,
    isLoading,
    error,
    refetch: () => fetchById(ExerciseId.create(id)),
  };
};

export const useExercises = (options?: PaginationOptions) => {
  const currentPage = useExerciseRepositoryStore((state) => state.currentPage);
  const fetchAll = useExerciseRepositoryStore((state) => state.fetchAll);
  const isLoading = useExerciseRepositoryStore((state) => state.isLoading);
  const error = useExerciseRepositoryStore((state) => state.error);

  return {
    exercises: currentPage?.items || [],
    pagination: currentPage
      ? {
          total: currentPage.total,
          page: currentPage.page,
          limit: currentPage.limit,
          totalPages: currentPage.totalPages,
          hasNext: currentPage.hasNext,
          hasPrevious: currentPage.hasPrevious,
        }
      : null,
    isLoading,
    error,
    refetch: () => fetchAll(options),
  };
};

export const useActiveExercises = () => {
  const activeExercises = useExerciseRepositoryStore(
    (state) => state.activeExercises,
  );
  const fetchActive = useExerciseRepositoryStore((state) => state.fetchActive);
  const isLoading = useExerciseRepositoryStore((state) => state.isLoading);
  const error = useExerciseRepositoryStore((state) => state.error);

  return {
    exercises: activeExercises,
    isLoading,
    error,
    refetch: fetchActive,
  };
};
