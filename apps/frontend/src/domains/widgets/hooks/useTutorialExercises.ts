import { useQuery } from '@tanstack/react-query';
import { fetchTutorialExercises, TutorialsApiError } from '../api/tutorials';
import type { Tutorial } from '@bassnotion/contracts';

interface UseTutorialExercisesResult {
  tutorial: Tutorial | null;
  exercises: any[]; // Using any[] to match backend service type
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch tutorial with its exercises
 */
export function useTutorialExercises(
  slug: string | null,
): UseTutorialExercisesResult {
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

  return {
    tutorial: data?.tutorial || null,
    exercises: data?.exercises || [],
    isLoading,
    error,
    isError,
    refetch,
  };
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
