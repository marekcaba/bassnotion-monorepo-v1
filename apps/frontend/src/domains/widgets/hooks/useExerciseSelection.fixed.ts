'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getExercises,
  searchExercises,
  getExercisesByDifficulty,
  getDefaultExercise,
} from '../api/exercises';
import type { DatabaseExercise as Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export interface UseExerciseSelectionState {
  exercises: Exercise[];
  selectedExercise: Exercise | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedDifficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
  usingFallback: boolean;
}

export interface UseExerciseSelectionActions {
  selectExercise: (exercise: Exercise | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedDifficulty: (
    difficulty: UseExerciseSelectionState['selectedDifficulty'],
  ) => void;
  refreshExercises: () => Promise<void>;
  clearError: () => void;
  selectDefaultExercise: () => void;
}

export type UseExerciseSelectionReturn = UseExerciseSelectionState &
  UseExerciseSelectionActions;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface ExerciseCache {
  exercises: Exercise[];
  timestamp: number;
  searchQuery?: string;
  difficulty?: string;
}

let exerciseCache: ExerciseCache | null = null;

// Export cache clearing function for testing
export function __clearCache(): void {
  exerciseCache = null;
}

// FAANG BEST PRACTICE #1: Move pure functions outside the component
// These don't need to be recreated on every render
function isCacheValid(query = '', difficulty = 'all'): boolean {
  if (!exerciseCache) return false;

  const isExpired = Date.now() - exerciseCache.timestamp > CACHE_DURATION;
  if (isExpired) return false;

  // Check if cache matches current query/difficulty
  const cacheQuery = exerciseCache.searchQuery || '';
  const cacheDifficulty = exerciseCache.difficulty || 'all';

  return cacheQuery === query && cacheDifficulty === difficulty;
}

function isUsingFallback(exercises: Exercise[]): boolean {
  const defaultExercise = getDefaultExercise();
  return (
    exercises.length === 1 &&
    exercises[0]?.id === defaultExercise.id &&
    exercises[0]?.title === defaultExercise.title
  );
}

// FAANG BEST PRACTICE #2: Create stable references for complex operations
function filterExercisesBySearch(
  exercises: Exercise[],
  searchTerm: string,
): Exercise[] {
  const normalizedSearch = searchTerm.toLowerCase();
  return exercises.filter(
    (exercise) =>
      exercise.title.toLowerCase().includes(normalizedSearch) ||
      exercise.description?.toLowerCase().includes(normalizedSearch),
  );
}

export function useExerciseSelection(): UseExerciseSelectionReturn {
  const [state, setState] = useState<UseExerciseSelectionState>({
    exercises: [],
    selectedExercise: null,
    isLoading: true,
    error: null,
    searchQuery: '',
    selectedDifficulty: 'all',
    usingFallback: false,
  });

  // Track user intentions to prevent unwanted auto-selection
  const userClearedSelection = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FAANG BEST PRACTICE #3: Use refs for values that don't trigger re-renders
  const loadingRef = useRef(false);

  // FAANG BEST PRACTICE #4: Separate data fetching logic from state updates
  const fetchExercises = useCallback(
    async (query: string, difficulty: string) => {
      if (query.trim()) {
        try {
          return await searchExercises(query.trim());
        } catch (apiError) {
          logger.warn(
            '🎯 Search API failed, falling back to client-side filtering',
            apiError,
          );
          return await getExercises();
        }
      }

      if (difficulty !== 'all') {
        return await getExercisesByDifficulty(
          difficulty as 'beginner' | 'intermediate' | 'advanced',
        );
      }

      return await getExercises();
    },
    [],
  ); // No dependencies - this is a pure data fetcher

  // FAANG BEST PRACTICE #5: Single responsibility - one function does one thing
  const updateExercisesState = useCallback(
    (
      exercises: Exercise[],
      isFromCache: boolean,
      originalExercises?: Exercise[],
    ) => {
      const fallbackUsed = isUsingFallback(originalExercises || exercises);

      setState((prev) => ({
        ...prev,
        exercises,
        isLoading: false,
        usingFallback: fallbackUsed,
        error: null,
      }));
    },
    [],
  );

  // Load exercises with stable reference
  const loadExercises = useCallback(
    async (query = '', difficulty = 'all', skipClientFilter = false) => {
      // FAANG BEST PRACTICE #6: Prevent concurrent loads
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Check cache first (using stable function)
        if (isCacheValid(query, difficulty) && exerciseCache) {
          let exercises = exerciseCache.exercises;

          // Apply client-side filtering if needed
          if (!skipClientFilter && query.trim()) {
            exercises = filterExercisesBySearch(exercises, query);
          }

          updateExercisesState(exercises, true, exerciseCache.exercises);
          return;
        }

        // Fetch from API
        const response = await fetchExercises(query, difficulty);

        // Update cache
        exerciseCache = {
          exercises: response.exercises,
          timestamp: Date.now(),
          searchQuery: query,
          difficulty,
        };

        let exercises = response.exercises;

        // Apply client-side filtering for search queries
        if (!skipClientFilter && query.trim()) {
          exercises = filterExercisesBySearch(exercises, query);
        }

        updateExercisesState(exercises, false, response.exercises);
      } catch (err) {
        logger.error('🎯 useExerciseSelection: Error loading exercises:', err);

        // Fallback to default exercise
        const defaultExercise = getDefaultExercise();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          exercises: [defaultExercise],
          usingFallback: true,
          error:
            err instanceof Error ? err.message : 'Failed to load exercises',
        }));
      } finally {
        loadingRef.current = false;
      }
    },
    [fetchExercises, updateExercisesState],
  );

  // FAANG BEST PRACTICE #7: Separate effects for different concerns
  // Effect for initial load
  useEffect(() => {
    loadExercises(state.searchQuery, state.selectedDifficulty);
  }, []); // Only on mount

  // Effect for search/filter changes with debouncing
  useEffect(() => {
    // Skip initial mount
    if (state.isLoading && state.exercises.length === 0) return;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For empty search, load immediately
    if (!state.searchQuery.trim()) {
      loadExercises(state.searchQuery, state.selectedDifficulty);
      return;
    }

    // Debounce search queries
    debounceTimeoutRef.current = setTimeout(() => {
      loadExercises(state.searchQuery, state.selectedDifficulty);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [state.searchQuery, state.selectedDifficulty]); // Only depend on actual state values

  // Auto-select first exercise
  useEffect(() => {
    if (
      state.exercises.length > 0 &&
      !state.selectedExercise &&
      !state.isLoading &&
      !userClearedSelection.current
    ) {
      const firstExercise = state.exercises[0];
      if (firstExercise) {
        setState((prev) => ({ ...prev, selectedExercise: firstExercise }));
      }
    }
  }, [state.exercises, state.selectedExercise, state.isLoading]);

  // FAANG BEST PRACTICE #8: Memoize action creators with stable references
  const selectExercise = useCallback((exercise: Exercise | null) => {
    userClearedSelection.current = exercise === null;
    setState((prev) => ({ ...prev, selectedExercise: exercise }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    userClearedSelection.current = false;
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setSelectedDifficulty = useCallback(
    (difficulty: UseExerciseSelectionState['selectedDifficulty']) => {
      userClearedSelection.current = false;
      setState((prev) => ({ ...prev, selectedDifficulty: difficulty }));
    },
    [],
  );

  const refreshExercises = useCallback(async () => {
    exerciseCache = null;
    userClearedSelection.current = false;
    await loadExercises(state.searchQuery, state.selectedDifficulty, true);
  }, [state.searchQuery, state.selectedDifficulty, loadExercises]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const selectDefaultExercise = useCallback(() => {
    const defaultExercise = getDefaultExercise();
    userClearedSelection.current = false;
    setState((prev) => ({
      ...prev,
      selectedExercise: defaultExercise,
      exercises: [defaultExercise],
      usingFallback: true,
      error: null,
    }));
  }, []);

  return {
    ...state,
    selectExercise,
    setSearchQuery,
    setSelectedDifficulty,
    refreshExercises,
    clearError,
    selectDefaultExercise,
  };
}
