'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getExercises,
  searchExercises,
  getExercisesByDifficulty,
  getDefaultExercise,
} from '../api/exercises';
import type { DatabaseExercise as Exercise } from '@bassnotion/contracts';

export interface UseExerciseSelectionState {
  exercises: Exercise[];
  selectedExercise: Exercise | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedDifficulty: 'all' | 'beginner' | 'intermediate' | 'advanced';
  usingFallback: boolean; // New state to indicate if we're using fallback data
}

export interface UseExerciseSelectionActions {
  selectExercise: (exercise: Exercise | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedDifficulty: (
    difficulty: UseExerciseSelectionState['selectedDifficulty'],
  ) => void;
  refreshExercises: () => Promise<void>;
  clearError: () => void;
  selectDefaultExercise: () => void; // New action to manually select default exercise
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

  // Check if cache is valid
  const isCacheValid = useCallback(
    (query = '', difficulty = 'all'): boolean => {
      if (!exerciseCache) return false;

      const isExpired = Date.now() - exerciseCache.timestamp > CACHE_DURATION;
      if (isExpired) return false;

      // Check if cache matches current query/difficulty
      const cacheQuery = exerciseCache.searchQuery || '';
      const cacheDifficulty = exerciseCache.difficulty || 'all';

      return cacheQuery === query && cacheDifficulty === difficulty;
    },
    [],
  );

  // Check if response contains only the default exercise (indicating fallback was used)
  const isUsingFallback = useCallback((exercises: Exercise[]): boolean => {
    const defaultExercise = getDefaultExercise();
    return (
      exercises.length === 1 &&
      exercises[0]?.id === defaultExercise.id &&
      exercises[0]?.title === defaultExercise.title
    );
  }, []);

  // Load exercises based on current filters
  const loadExercises = useCallback(
    async (query = '', difficulty = 'all', skipClientFilter = false) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        // Check cache first
        if (isCacheValid(query, difficulty) && exerciseCache) {
          let exercises = exerciseCache.exercises;

          // Apply client-side filtering if needed (for search queries)
          if (!skipClientFilter && query.trim()) {
            const searchTerm = query.toLowerCase();
            exercises = exercises.filter(
              (exercise) =>
                exercise.title.toLowerCase().includes(searchTerm) ||
                exercise.description?.toLowerCase().includes(searchTerm),
            );
          }

          setState((prev) => ({
            ...prev,
            exercises,
            isLoading: false,
            usingFallback: isUsingFallback(exerciseCache?.exercises || []),
          }));
          return;
        }

        // Loading exercises from API
        let response;

        if (query.trim()) {
          // For search queries, try API first, then fall back to client-side filtering
          try {
            response = await searchExercises(query.trim());
          } catch (apiError) {
            console.warn(
              '🎯 Search API failed, falling back to client-side filtering',
              apiError,
            );
            // Fall back to getting all exercises and filtering client-side
            response = await getExercises();
          }
        } else if (difficulty !== 'all') {
          // Filter by difficulty
          response = await getExercisesByDifficulty(
            difficulty as 'beginner' | 'intermediate' | 'advanced',
          );
        } else {
          // Get all exercises
          response = await getExercises();
        }

        // Update cache with original results
        exerciseCache = {
          exercises: response.exercises,
          timestamp: Date.now(),
          searchQuery: query,
          difficulty,
        };

        let exercises = response.exercises;

        // Apply client-side filtering for search queries when needed
        if (!skipClientFilter && query.trim()) {
          const searchTerm = query.toLowerCase();
          const filtered = exercises.filter(
            (exercise) =>
              exercise.title.toLowerCase().includes(searchTerm) ||
              exercise.description?.toLowerCase().includes(searchTerm),
          );

          // Always use filtered results for search queries to ensure consistent behavior
          exercises = filtered;
        }

        const fallbackUsed = isUsingFallback(response.exercises);

        setState((prev) => ({
          ...prev,
          exercises,
          isLoading: false,
          usingFallback: fallbackUsed,
        }));

        // Debug log (disabled to reduce console noise)
        // console.log(
        //   '🎯 useExerciseSelection: Loaded',
        //   exercises.length,
        //   'exercises',
        //   fallbackUsed ? '(using fallback)' : '',
        // );
      } catch (err) {
        console.error('🎯 useExerciseSelection: Error loading exercises:', err);

        // If all else fails, use the default exercise directly
        const defaultExercise = getDefaultExercise();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          exercises: [defaultExercise],
          usingFallback: true,
          error:
            err instanceof Error ? err.message : 'Failed to load exercises',
        }));
      }
    },
    [isCacheValid, isUsingFallback],
  );

  // Consolidated debounced loading effect
  useEffect(() => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // For empty search query, load immediately
    if (!state.searchQuery.trim()) {
      loadExercises(state.searchQuery, state.selectedDifficulty);
      return;
    }

    // For search queries, debounce
    debounceTimeoutRef.current = setTimeout(() => {
      loadExercises(state.searchQuery, state.selectedDifficulty);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [state.searchQuery, state.selectedDifficulty, loadExercises]);

  // Auto-select first exercise (respecting user intentions)
  useEffect(() => {
    if (
      state.exercises.length > 0 &&
      !state.selectedExercise &&
      !state.isLoading &&
      !userClearedSelection.current
    ) {
      const firstExercise = state.exercises[0];
      if (firstExercise) {
        // Debug log (disabled to reduce console noise)
        // console.log('🎯 useExerciseSelection: Auto-selecting first exercise:', {
        //   id: firstExercise.id,
        //   title: firstExercise.title,
        //   bpm: firstExercise.bpm,
        //   usingFallback: state.usingFallback,
        // });
        setState((prev) => ({ ...prev, selectedExercise: firstExercise }));
      }
    }
  }, [state.exercises, state.selectedExercise, state.isLoading]);

  // Actions
  const selectExercise = useCallback((exercise: Exercise | null) => {
    // Track when user explicitly clears selection
    if (exercise === null) {
      userClearedSelection.current = true;
    } else {
      userClearedSelection.current = false;
    }
    setState((prev) => ({ ...prev, selectedExercise: exercise }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    // Reset user intention when starting new search
    userClearedSelection.current = false;
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setSelectedDifficulty = useCallback(
    (difficulty: UseExerciseSelectionState['selectedDifficulty']) => {
      // Reset user intention when changing difficulty
      userClearedSelection.current = false;
      setState((prev) => ({ ...prev, selectedDifficulty: difficulty }));
    },
    [],
  );

  const refreshExercises = useCallback(async () => {
    // Clear cache and reload
    exerciseCache = null;
    userClearedSelection.current = false;
    await loadExercises(state.searchQuery, state.selectedDifficulty, true);
  }, [loadExercises, state.searchQuery, state.selectedDifficulty]);

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
    // Debug log (disabled to reduce console noise)
    // console.log('🎯 useExerciseSelection: Manually selected default exercise');
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
