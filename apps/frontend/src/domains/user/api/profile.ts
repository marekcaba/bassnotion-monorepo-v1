'use client';

import { supabase } from '@/infrastructure/supabase/client';
import type {
  UserProfileData,
  BassConfigurationData,
} from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('user:api');

export class ProfileService {
  private async getAuthHeaders() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // TODO: Review non-null assertion - consider null safety
    if (error || !session?.access_token) {
      throw new Error('User not authenticated');
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  private get backendUrl() {
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3000'
    );
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: UserProfileData) {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${this.backendUrl}/user/profile`;

      logger.debug('Calling backend URL:', url);
      logger.debug('Headers:', headers);
      logger.debug('Data:', profileData);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData),
      });

      logger.debug('Response status:', response.status);
      logger.debug('Response headers:', Object.fromEntries(response.headers));

      const result = await response.json();
      logger.debug('Response data:', result);

      // TODO: Review non-null assertion - consider null safety
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update profile');
      }

      return result.data;
    } catch (error) {
      logger.error('Update error:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(password: string) {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.backendUrl}/user/account`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      // TODO: Review non-null assertion - consider null safety
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete account');
      }

      return result.data;
    } catch (error) {
      logger.error('Delete account error:', error);
      throw error;
    }
  }

  /**
   * Update bass configuration
   */
  async updateBassConfiguration(bassConfig: BassConfigurationData) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          bass_string_count: bassConfig.stringCount,
          bass_max_frets: bassConfig.maxFrets,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to update bass configuration: ${error.message}`,
        );
      }

      return {
        stringCount: data.bass_string_count,
        maxFrets: data.bass_max_frets,
      };
    } catch (error) {
      logger.error('Update bass configuration error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentProfile() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // TODO: Review non-null assertion - consider null safety
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // First try to get the profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle no rows

      if (error) {
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      // If no profile exists, create one
      // TODO: Review non-null assertion - consider null safety
      if (!profile) {
        logger.info('No profile found, creating one...');

        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            display_name: displayName,
            bio: null,
            avatar_url: null,
            bass_string_count: 4,
            bass_max_frets: 24,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create profile: ${createError.message}`);
        }

        // TODO: Review non-null assertion - consider null safety
        if (!newProfile) {
          throw new Error('Failed to create profile: No data returned');
        }

        return {
          id: newProfile.id,
          email: newProfile.email,
          displayName: newProfile.display_name,
          bio: newProfile.bio,
          avatarUrl: newProfile.avatar_url,
          bassConfiguration: {
            stringCount: newProfile.bass_string_count || 4,
            maxFrets: newProfile.bass_max_frets || 24,
          },
          createdAt: newProfile.created_at,
          updatedAt: newProfile.updated_at,
        };
      }

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        bassConfiguration: {
          stringCount: profile.bass_string_count || 4,
          maxFrets: profile.bass_max_frets || 24,
        },
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }
}

export const profileService = new ProfileService();
