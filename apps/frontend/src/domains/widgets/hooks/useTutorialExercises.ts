import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTutorialExercises, TutorialsApiError } from '../api/tutorials';
import type { Tutorial } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { createStructuredLogger } from '@bassnotion/contracts';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';

const logger = createStructuredLogger('useTutorialExercises');

interface UseTutorialExercisesResult {
  tutorial: Tutorial | null;
  exercises: Exercise[]; // Return Exercise entities, not raw DTOs
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch tutorial with its exercises
 */
// Track render count
let useTutorialExercisesCallCount = 0;

export function useTutorialExercises(
  slug: string | null,
): UseTutorialExercisesResult {
  useTutorialExercisesCallCount++;

  // Log every 10th call
  if (useTutorialExercisesCallCount % 10 === 0) {
    logger.info(
      `🔄 useTutorialExercises CALL #${useTutorialExercisesCallCount}`,
      {
        slug,
        timestamp: Date.now(),
      },
    );
  }

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['tutorial-exercises', slug],
    queryFn: () => {
      if (!slug) {
        throw new Error('Tutorial slug is required');
      }
      return fetchTutorialExercises(slug);
    },
    enabled: !!slug, // Only run query if slug is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // CRITICAL: Disable automatic refetch on window focus
    refetchOnMount: false, // CRITICAL: Disable automatic refetch on mount
    refetchInterval: false, // CRITICAL: Disable periodic refetch
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (
        error instanceof TutorialsApiError &&
        error.status &&
        error.status >= 400 &&
        error.status < 500
      ) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Memoize the return object to prevent unnecessary re-renders
  // Convert raw DTOs to Exercise entities
  return React.useMemo(
    () => ({
      tutorial: data?.tutorial || null,
      exercises: data?.exercises
        ? data.exercises.map((dto: any) => Exercise.fromDTO(dto))
        : [],
      isLoading,
      error,
      isError,
      refetch,
    }),
    [data, isLoading, error, isError, refetch],
  );
}

/**
 * Hook to fetch just the tutorial data (without exercises)
 */
export function useTutorial(slug: string | null) {
  const { tutorial, isLoading, error, isError } = useTutorialExercises(slug);

  return {
    tutorial,
    isLoading,
    error,
    isError,
  };
}
