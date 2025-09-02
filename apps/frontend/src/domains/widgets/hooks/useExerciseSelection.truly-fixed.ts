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

// Pure functions outside component
function isCacheValid(query = '', difficulty = 'all'): boolean {
  if (!exerciseCache) return false;

  const isExpired = Date.now() - exerciseCache.timestamp > CACHE_DURATION;
  if (isExpired) return false;

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

  // Refs for values that don't trigger re-renders
  const userClearedSelection = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  // THE REAL FIX: Store search/difficulty in refs to break circular dependency
  const searchQueryRef = useRef(state.searchQuery);
  const selectedDifficultyRef = useRef(state.selectedDifficulty);

  // Update refs when state changes
  useEffect(() => {
    searchQueryRef.current = state.searchQuery;
  }, [state.searchQuery]);

  useEffect(() => {
    selectedDifficultyRef.current = state.selectedDifficulty;
  }, [state.selectedDifficulty]);

  // Stable load function with NO dependencies
  const loadExercises = useCallback(async () => {
    // Prevent concurrent loads
    if (loadingRef.current) return;
    loadingRef.current = true;

    // Get current values from refs
    const query = searchQueryRef.current;
    const difficulty = selectedDifficultyRef.current;

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check cache first
      if (isCacheValid(query, difficulty) && exerciseCache) {
        let exercises = exerciseCache.exercises;

        // Apply client-side filtering if needed
        if (query.trim()) {
          exercises = filterExercisesBySearch(exercises, query);
        }

        const fallbackUsed = isUsingFallback(exerciseCache.exercises);

        setState((prev) => ({
          ...prev,
          exercises,
          isLoading: false,
          usingFallback: fallbackUsed,
          error: null,
        }));
        return;
      }

      // Fetch from API
      let response;

      if (query.trim()) {
        try {
          response = await searchExercises(query.trim());
        } catch (apiError) {
          logger.warn(
            '🎯 Search API failed, falling back to client-side filtering',
            apiError,
          );
          response = await getExercises();
        }
      } else if (difficulty !== 'all') {
        response = await getExercisesByDifficulty(
          difficulty as 'beginner' | 'intermediate' | 'advanced',
        );
      } else {
        response = await getExercises();
      }

      // Update cache
      exerciseCache = {
        exercises: response.exercises,
        timestamp: Date.now(),
        searchQuery: query,
        difficulty,
      };

      let exercises = response.exercises;

      // Apply client-side filtering for search queries
      if (query.trim()) {
        exercises = filterExercisesBySearch(exercises, query);
      }

      const fallbackUsed = isUsingFallback(response.exercises);

      setState((prev) => ({
        ...prev,
        exercises,
        isLoading: false,
        usingFallback: fallbackUsed,
        error: null,
      }));
    } catch (err) {
      logger.error('🎯 useExerciseSelection: Error loading exercises:', err);

      // Fallback to default exercise
      const defaultExercise = getDefaultExercise();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        exercises: [defaultExercise],
        usingFallback: true,
        error: err instanceof Error ? err.message : 'Failed to load exercises',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, []); // TRULY NO DEPENDENCIES!

  // Initial load effect
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      loadExercises();
    }
  }, [loadExercises]);

  // Search/filter change effect
  useEffect(() => {
    // Skip if this is the initial state
    if (!hasInitialLoadRef.current) return;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For empty search, load immediately
    if (!state.searchQuery.trim()) {
      loadExercises();
      return;
    }

    // Debounce search queries
    debounceTimeoutRef.current = setTimeout(() => {
      loadExercises();
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [state.searchQuery, state.selectedDifficulty, loadExercises]);

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

  // Action creators with stable references
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
    await loadExercises();
  }, [loadExercises]);

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
