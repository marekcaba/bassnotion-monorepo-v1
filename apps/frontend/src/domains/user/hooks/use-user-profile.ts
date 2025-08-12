'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { supabase } from '@/infrastructure/supabase/client';
import type { UserProfile } from '@bassnotion/contracts';

interface UserProfileWithRole extends UserProfile {
  role: string;
}

interface UseUserProfileReturn {
  profile: UserProfileWithRole | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfileWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!isAuthenticated || !user) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get auth headers
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('User not authenticated');
      }

      // Call the backend API with proper auth headers
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        'http://localhost:3000';

      const response = await fetch(`${backendUrl}/api/user/profile`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setProfile(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch profile');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [isAuthenticated, user?.id]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
  };
}
