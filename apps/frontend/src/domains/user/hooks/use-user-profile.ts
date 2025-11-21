'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { supabase } from '@/infrastructure/supabase/client';
import { apiClient } from '@/lib/api-client';
import type { UserProfile } from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('user:profile');

interface UserProfileWithRole extends UserProfile {
  role: string;
}

interface UseUserProfileReturn {
  profile: UserProfileWithRole | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  invalidate: () => Promise<void>;
}

/**
 * Fetches user profile from API
 * FAANG-level caching strategy:
 * - Fresh for 5 mins (no API calls on reload within this time)
 * - Cached for 30 mins (instant display even when stale)
 * - Auto-refetches in background when stale
 */
async function fetchUserProfile(userId: string): Promise<UserProfileWithRole> {
  console.log('📡 Fetching profile from API for user:', userId);

  // Get auth session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log('🔑 Session check:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    sessionError: sessionError?.message,
  });

  if (sessionError || !session?.access_token) {
    throw new Error('User not authenticated');
  }

  // Set auth token in apiClient
  apiClient.setAuthToken(session.access_token);

  // Fetch profile
  const result = await apiClient.get<{
    success: boolean;
    data: UserProfileWithRole;
    message?: string;
  }>('/api/user/profile');

  console.log('📥 Profile API response:', {
    success: result.success,
    hasData: !!result.data,
    message: result.message,
    profileStringCount: result.data?.preferences?.bassConfiguration?.stringCount,
  });

  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to fetch profile');
  }

  return result.data;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: () => fetchUserProfile(user!.id),
    enabled: !!isAuthenticated && !!user,
    // OPTIMIZATION: Increased cache times to reduce redundant profile fetches
    staleTime: 10 * 60 * 1000, // Fresh for 10 minutes (increased from 5)
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour (increased from 30min)
    refetchOnWindowFocus: false, // Don't refetch when tab regains focus
    refetchOnMount: false, // OPTIMIZATION: Don't refetch on remount if data is fresh
    refetchOnReconnect: true, // Refetch when internet reconnects
    retry: (failureCount, error) => {
      // Don't retry on auth errors (4xx)
      if (error instanceof Error && error.message.includes('not authenticated')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Function to invalidate cache (use when user updates settings)
  const invalidate = async () => {
    console.log('🔄 Invalidating user profile cache...');
    await queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] });
  };

  if (error) {
    console.error('❌ Error fetching user profile:', error);
    logger.error('Error fetching user profile:', error);
  }

  return {
    profile: profile ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      refetch();
    },
    invalidate,
  };
}
