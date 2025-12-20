'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { supabase } from '@/infrastructure/supabase/client';
import { apiClient } from '@/lib/api-client';
import type { UserProfile } from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('user:profile');

// Storage keys for persisting user data across page loads
const USER_ROLE_STORAGE_KEY = 'bassnotion-user-role';
const USER_DISPLAY_NAME_STORAGE_KEY = 'bassnotion-user-display-name';

// UserProfile already has role?: 'user' | 'admin' | 'moderator'
// This type ensures role is always present (not undefined)
type UserProfileWithRole = UserProfile & {
  role: 'user' | 'admin' | 'moderator';
};

interface CachedUserData {
  role: 'user' | 'admin' | 'moderator' | null;
  displayName: string | null;
}

/**
 * Get cached user data from localStorage
 */
function getCachedUserData(): CachedUserData {
  if (typeof window === 'undefined') return { role: null, displayName: null };
  try {
    const role = localStorage.getItem(USER_ROLE_STORAGE_KEY);
    const displayName = localStorage.getItem(USER_DISPLAY_NAME_STORAGE_KEY);
    return {
      role: role === 'admin' || role === 'user' || role === 'moderator' ? role : null,
      displayName,
    };
  } catch {
    return { role: null, displayName: null };
  }
}

/**
 * Cache user data to localStorage
 */
function cacheUserData(role: string, displayName: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
    localStorage.setItem(USER_DISPLAY_NAME_STORAGE_KEY, displayName);
  } catch {
    // Silently fail if localStorage is blocked
  }
}

/**
 * Clear cached user data (call on logout)
 */
export function clearCachedUserData(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_ROLE_STORAGE_KEY);
    localStorage.removeItem(USER_DISPLAY_NAME_STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

// Keep for backwards compatibility
export const clearCachedUserRole = clearCachedUserData;

interface UseUserProfileReturn {
  profile: UserProfileWithRole | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  invalidate: () => Promise<void>;
  /** Cached role from localStorage - available after hydration */
  cachedRole: 'user' | 'admin' | 'moderator' | null;
  /** Cached display name from localStorage - available after hydration */
  cachedDisplayName: string | null;
  /** True after localStorage has been checked (prevents hydration mismatch) */
  isHydrated: boolean;
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
    profileStringCount:
      result.data?.preferences?.bassConfiguration?.stringCount,
  });

  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to fetch profile');
  }

  return result.data;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Track if we've loaded from localStorage (to prevent hydration mismatch)
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize with null for SSR, then load from localStorage after hydration
  const [cachedRole, setCachedRole] = useState<'user' | 'admin' | 'moderator' | null>(null);
  const [cachedDisplayName, setCachedDisplayName] = useState<string | null>(null);

  // Load cached data AFTER hydration to avoid SSR mismatch
  useEffect(() => {
    const cached = getCachedUserData();
    if (cached.role) {
      setCachedRole(cached.role);
    }
    if (cached.displayName) {
      setCachedDisplayName(cached.displayName);
    }
    setIsHydrated(true);
  }, []);

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
      if (
        error instanceof Error &&
        error.message.includes('not authenticated')
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Cache the user data whenever profile is fetched
  useEffect(() => {
    if (profile?.role && profile?.displayName) {
      cacheUserData(profile.role, profile.displayName);
      setCachedRole(profile.role);
      setCachedDisplayName(profile.displayName);
    }
  }, [profile?.role, profile?.displayName]);

  // Function to invalidate cache (use when user updates settings)
  const invalidate = async () => {
    console.log('🔄 Invalidating user profile cache...');
    await queryClient.invalidateQueries({
      queryKey: ['user-profile', user?.id],
    });
  };

  if (error) {
    console.error('❌ Error fetching user profile:', error);
    logger.error('Error fetching user profile:', error);
  }

  return {
    profile: profile ?? null,
    cachedRole,
    cachedDisplayName,
    isLoading,
    isHydrated,
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      refetch();
    },
    invalidate,
  };
}
