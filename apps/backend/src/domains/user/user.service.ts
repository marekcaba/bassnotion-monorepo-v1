import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import type {
  UserProfile,
  UserProfileData,
  BassConfiguration,
} from '@bassnotion/contracts';
import { userProfileSchema } from '@bassnotion/contracts';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly db: DatabaseService) {}

  async findProfileById(userId: string): Promise<UserProfile> {
    this.logger.debug(`Finding profile for user: ${userId}`);

    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error('Error fetching profile:', error);
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return this.mapProfileToUserProfile(profile);
  }

  async updateProfile(
    userId: string,
    profileData: UserProfileData,
  ): Promise<UserProfile> {
    this.logger.debug(`Updating profile for user: ${userId}`);

    // Validate the profile data
    const validatedData = userProfileSchema.parse(profileData);

    // Update the Supabase Auth user metadata if display name is provided
    if (validatedData.displayName) {
      const { error: authUpdateError } =
        await this.db.supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            display_name: validatedData.displayName,
            full_name: validatedData.displayName,
          },
        });

      if (authUpdateError) {
        this.logger.warn(
          'Failed to update auth user metadata:',
          authUpdateError,
        );
        // Don't fail the entire operation if auth metadata update fails
      }
    }

    // Update the profile in the database
    const { data: updatedProfile, error } = await this.db.supabase
      .from('profiles')
      .update({
        display_name: validatedData.displayName,
        bio: validatedData.bio,
        avatar_url: validatedData.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating profile:', error);
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return this.mapProfileToUserProfile(updatedProfile);
  }

  async updateBassConfiguration(
    userId: string,
    bassConfig: BassConfiguration,
  ): Promise<UserProfile> {
    this.logger.debug(`Updating bass configuration for user: ${userId}`);

    // Validate bass configuration
    if (bassConfig.stringCount < 4 || bassConfig.stringCount > 6) {
      throw new BadRequestException('String count must be between 4 and 6');
    }

    if (bassConfig.maxFrets < 19 || bassConfig.maxFrets > 25) {
      throw new BadRequestException('Max frets must be between 19 and 25');
    }

    const { data: updatedProfile, error } = await this.db.supabase
      .from('profiles')
      .update({
        bass_string_count: bassConfig.stringCount,
        bass_max_frets: bassConfig.maxFrets,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating bass configuration:', error);
      throw new Error(`Failed to update bass configuration: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return this.mapProfileToUserProfile(updatedProfile);
  }

  async getBassConfiguration(userId: string): Promise<BassConfiguration> {
    this.logger.debug(`Getting bass configuration for user: ${userId}`);

    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('bass_string_count, bass_max_frets')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error('Error fetching bass configuration:', error);
      throw new Error(`Failed to fetch bass configuration: ${error.message}`);
    }

    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return {
      stringCount: profile.bass_string_count || 4,
      maxFrets: profile.bass_max_frets || 24,
    };
  }

  async deleteProfile(userId: string): Promise<void> {
    this.logger.debug(`Deleting profile for user: ${userId}`);

    // First verify the profile exists
    const { data: profile, error: fetchError } = await this.db.supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    // Delete the user account (this will cascade delete the profile due to FK constraint)
    const { error: deleteError } =
      await this.db.supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      this.logger.error('Error deleting user account:', deleteError);
      throw new Error(`Failed to delete account: ${deleteError.message}`);
    }

    this.logger.log(`Profile deleted successfully for user: ${userId}`);
  }

  async findAllProfiles(
    limit = 100,
    offset = 0,
  ): Promise<{
    profiles: UserProfile[];
    total: number;
  }> {
    this.logger.debug(
      `Finding all profiles with limit: ${limit}, offset: ${offset}`,
    );

    // Get total count
    const { count, error: countError } = await this.db.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      this.logger.error('Error counting profiles:', countError);
      throw new Error(`Failed to count profiles: ${countError.message}`);
    }

    // Get profiles with pagination
    const { data: profiles, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error fetching profiles:', error);
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return {
      profiles:
        profiles?.map((profile: any) => this.mapProfileToUserProfile(profile)) || [],
      total: count || 0,
    };
  }

  async searchProfiles(searchTerm: string, limit = 20): Promise<UserProfile[]> {
    this.logger.debug(`Searching profiles with term: ${searchTerm}`);

    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException(
        'Search term must be at least 2 characters long',
      );
    }

    const { data: profiles, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .or(
        `display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%`,
      )
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Error searching profiles:', error);
      throw new Error(`Failed to search profiles: ${error.message}`);
    }

    return (
      profiles?.map((profile: any) => this.mapProfileToUserProfile(profile)) || []
    );
  }

  async updateUserRole(userId: string, role: string): Promise<UserProfile> {
    this.logger.debug(`Updating role for user: ${userId} to: ${role}`);

    // Validate role
    const validRoles = ['user', 'admin', 'creator'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`,
      );
    }

    const { data: updatedProfile, error } = await this.db.supabase
      .from('profiles')
      .update({
        role: role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating user role:', error);
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return this.mapProfileToUserProfile(updatedProfile);
  }

  async getUserStats(userId: string): Promise<{
    profileCompleteness: number;
    accountAge: number;
    lastActivity: string | null;
  }> {
    this.logger.debug(`Getting stats for user: ${userId}`);

    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.error('Error fetching user stats:', error);
      throw new Error(`Failed to fetch user stats: ${error.message}`);
    }

    if (!profile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    // Calculate profile completeness
    let completeness = 0;
    const fields = ['display_name', 'bio', 'avatar_url'];
    fields.forEach((field) => {
      if (profile[field]) completeness += 1;
    });
    const profileCompleteness = Math.round(
      (completeness / fields.length) * 100,
    );

    // Calculate account age in days
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const accountAge = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      profileCompleteness,
      accountAge,
      lastActivity: profile.updated_at,
    };
  }

  private mapProfileToUserProfile(profile: any): UserProfile {
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      preferences: {
        theme: 'light', // Default theme
        emailNotifications: true, // Default setting
        defaultMetronomeSettings: {
          enabled: false,
          tempo: 120,
          beatsPerMeasure: 4,
          subdivision: 1,
          accentFirstBeat: true,
          volume: 75,
        },
        bassConfiguration: {
          stringCount: profile.bass_string_count || 4,
          maxFrets: profile.bass_max_frets || 24,
        },
      },
    };
  }
}
