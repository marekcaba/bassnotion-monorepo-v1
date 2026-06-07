import { useQuery } from '@tanstack/react-query';
import {
  fetchCollections,
  TutorialsApiError,
  type CollectionView,
} from '../api/tutorials';
import { useAuth } from '@/domains/user/hooks/use-auth';

interface UseCollectionsResult {
  collections: CollectionView[];
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

/**
 * Fetch the DB-driven sidebar folders. The result is auth-dependent (anon vs
 * member vs pack-owner see different folders), so the query key includes the
 * auth state — logging in/out refetches the right folder set.
 */
export function useCollections(): UseCollectionsResult {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['collections', isAuthenticated],
    queryFn: fetchCollections,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, err) => {
      if (
        err instanceof TutorialsApiError &&
        err.status &&
        err.status >= 400 &&
        err.status < 500
      ) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    collections: data?.collections ?? [],
    isLoading,
    error,
    isError,
    refetch,
  };
}
