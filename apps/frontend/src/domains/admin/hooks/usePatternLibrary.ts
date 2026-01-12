/**
 * Pattern Library Hooks
 * React Query hooks for pattern library operations
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { patternLibraryApi } from '../api/pattern-library.api.js';
import type { PatternLibraryFilter, CreatePatternInput } from '@bassnotion/contracts';

/**
 * Query keys for pattern library
 */
export const patternLibraryKeys = {
  all: ['patternLibrary'] as const,
  lists: () => [...patternLibraryKeys.all, 'list'] as const,
  list: (filter: PatternLibraryFilter) =>
    [...patternLibraryKeys.lists(), filter] as const,
  details: () => [...patternLibraryKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternLibraryKeys.details(), id] as const,
};

/**
 * Hook to fetch patterns from the library
 * Supports filtering, pagination, and searching
 */
export function usePatternLibrary(
  filter: PatternLibraryFilter = {},
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: patternLibraryKeys.list(filter),
    queryFn: () => patternLibraryApi.getPatterns(filter),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - patterns don't change often
  });
}

/**
 * Hook to fetch a single pattern by ID
 */
export function usePattern(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: patternLibraryKeys.detail(id),
    queryFn: () => patternLibraryApi.getPattern(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes - individual patterns are cached longer
  });
}

/**
 * Hook to record pattern usage
 */
export function useRecordPatternUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patternLibraryApi.recordPatternUsage(id),
    onSuccess: (_data, id) => {
      // Invalidate pattern detail to refresh usage count
      queryClient.invalidateQueries({
        queryKey: patternLibraryKeys.detail(id),
      });
    },
  });
}

/**
 * Hook to prefetch patterns (useful for preloading on hover)
 */
export function usePrefetchPattern() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: patternLibraryKeys.detail(id),
      queryFn: () => patternLibraryApi.getPattern(id),
      staleTime: 1000 * 60 * 10,
    });
  };
}

/**
 * Hook to create a new pattern in the library
 */
export function useCreatePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePatternInput) =>
      patternLibraryApi.createPattern(input),
    onSuccess: () => {
      // Invalidate all pattern lists to show the new pattern
      queryClient.invalidateQueries({
        queryKey: patternLibraryKeys.lists(),
      });
    },
  });
}
