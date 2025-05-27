import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api-client';
import type { User, UserProfile } from '@/shared/types/contracts';

// Query Keys - centralized for consistency
export const queryKeys = {
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userProfile: (id: string) => ['users', id, 'profile'] as const,
  // Add more query keys as needed
  exercises: ['exercises'] as const,
  exercise: (id: string) => ['exercises', id] as const,
} as const;

// User-related hooks
export function useUser(userId: string) {
  return useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => apiClient.get<User>(`/api/users/${userId}`),
    enabled: !!userId,
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId),
    queryFn: () => apiClient.get<UserProfile>(`/api/users/${userId}/profile`),
    enabled: !!userId,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<UserProfile>;
    }) => apiClient.patch<UserProfile>(`/api/users/${userId}/profile`, data),
    onSuccess: (data, variables) => {
      // Update the user profile cache
      queryClient.setQueryData(queryKeys.userProfile(variables.userId), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.user(variables.userId),
      });
    },
  });
}

// Example: YouTube Exerciser hooks
export function useCreateYouTubeExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { youtubeUrl: string; userId: string }) =>
      apiClient.post('/api/youtube-exerciser/create', data),
    onSuccess: () => {
      // Invalidate exercises list to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.exercises,
      });
    },
  });
}

// Generic hooks for common patterns
export function useOptimisticUpdate<T>(
  queryKey: readonly unknown[],
  mutationFn: (data: T) => Promise<T>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, newData);

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (err, newData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Infinite query example for paginated data
export function useInfiniteExercises(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.exercises, 'infinite', limit],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.get(`/api/exercises?offset=${pageParam}&limit=${limit}`),
    // Note: For infinite queries, you'd typically use useInfiniteQuery
    // This is just an example structure
  });
} 