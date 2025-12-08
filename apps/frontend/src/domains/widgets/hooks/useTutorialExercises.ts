import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

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

  const { data, isPending, error, isError, refetch, isFetching, fetchStatus, status } = useQuery({
    queryKey: ['tutorial-exercises', slug],
    queryFn: () => {
      if (!slug) {
        throw new Error('Tutorial slug is required');
      }
      logger.info('🌐 Executing fetchTutorialExercises', { slug });
      return fetchTutorialExercises(slug);
    },
    enabled: !!slug, // Only run query if slug is provided
    staleTime: 1 * 60 * 1000, // 1 minute - faster cache invalidation for edited exercises
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false, // CRITICAL: Disable automatic refetch on window focus
    refetchInterval: false, // CRITICAL: Disable periodic refetch
    refetchOnMount: 'always', // Always refetch when component mounts for latest data
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

  // DIAGNOSTIC: Log React Query state to verify Webkit fix
  // fetchStatus should be 'fetching' or 'idle', NEVER 'paused'
  if (useTutorialExercisesCallCount % 10 === 0) {
    logger.info('🔍 QUERY STATE DIAGNOSTIC', {
      status,
      fetchStatus,  // 'idle' | 'fetching' | 'paused' - should NOT be 'paused'
      isPending,
      isFetching,
      hasData: !!data,
      slug,
    });
  }

  // DOM DEBUG: Write React Query state to DOM for Playwright visibility
  // This allows E2E tests to query actual state instead of waiting for UI
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    // Get or create debug element
    let debugEl = document.getElementById('rq-debug-tutorial-exercises');
    if (!debugEl) {
      debugEl = document.createElement('div');
      debugEl.id = 'rq-debug-tutorial-exercises';
      debugEl.style.display = 'none';
      debugEl.setAttribute('data-testid', 'rq-debug');
      document.body.appendChild(debugEl);
    }

    // Update attributes with current state
    debugEl.setAttribute('data-status', status);
    debugEl.setAttribute('data-fetch-status', fetchStatus);
    debugEl.setAttribute('data-is-pending', String(isPending));
    debugEl.setAttribute('data-is-fetching', String(isFetching));
    debugEl.setAttribute('data-has-data', String(!!data));
    debugEl.setAttribute('data-has-error', String(!!error));
    debugEl.setAttribute('data-slug', slug || '');
    debugEl.setAttribute('data-timestamp', new Date().toISOString());
    debugEl.setAttribute('data-tutorial-slug', data?.tutorial?.slug || '');
    debugEl.setAttribute('data-exercise-count', String(data?.exercises?.length || 0));
  }, [status, fetchStatus, isPending, isFetching, data, error, slug]);

  // WEBKIT FIX: Force refetch if query is stuck in pending state
  // This works around Webkit's JavaScript engine timing issues with React Query
  React.useEffect(() => {
    // Detect stuck pending state: isPending=true but not fetching and no data
    // This means React Query hasn't started the fetch despite enabled=true
    if (slug && isPending && !isFetching && !data && !error) {
      logger.warn('Webkit fix: Query stuck in pending state without fetching', { slug });
      // Give Webkit 2 seconds to resolve naturally, then force refetch
      const timer = setTimeout(() => {
        logger.error('Webkit fix: Forcing refetch via queryClient', { slug, isPending, isFetching });
        // Use queryClient.refetchQueries for more reliable refetch in Webkit
        queryClient.refetchQueries({
          queryKey: ['tutorial-exercises', slug],
          exact: true
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [slug, isPending, isFetching, data, error, queryClient]);

  // Memoize exercises separately to prevent recreation when other fields change
  const exercises = React.useMemo(() => {
    if (!data?.exercises) return [];
    return data.exercises.map((dto: any) => Exercise.fromDTO(dto));
  }, [data?.exercises]);

  // Memoize the return object to prevent unnecessary re-renders
  // CRITICAL: Remove 'refetch' from dependencies - it creates new reference on every query change
  return React.useMemo(
    () => ({
      tutorial: data?.tutorial || null,
      exercises,
      isLoading: isPending,  // TanStack Query v5: use isPending for conditional queries
      error,
      isError,
      refetch,  // Include in return but NOT in dependencies
    }),
    [data?.tutorial, exercises, isPending, error, isError],  // Use isPending instead of isLoading
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
