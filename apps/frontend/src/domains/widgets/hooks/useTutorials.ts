import { useQuery } from '@tanstack/react-query';
import { fetchTutorials, TutorialsApiError } from '../api/tutorials';
import type { TutorialsResponse } from '@bassnotion/contracts';

interface UseTutorialsResult {
  tutorials: TutorialsResponse['tutorials'];
  total: number;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch all tutorials with caching and error handling.
 * `enabled` (default true) lets callers skip the fetch on routes that don't
 * render tutorials (e.g. the sidebar panel is hidden) — see useTutorialsByFolder.
 */
export function useTutorials({
  enabled = true,
}: { enabled?: boolean } = {}): UseTutorialsResult {
  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['tutorials'],
    queryFn: fetchTutorials,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
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
    tutorials: data?.tutorials || [],
    total: data?.total || 0,
    isLoading,
    error,
    isError,
    refetch,
  };
}
