import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import {
  UserProfile,
  UserProfileData,
  BassConfiguration,
  userProfileSchema,
  createStructuredLogger,
  LearningStyle,
} from '@bassnotion/contracts';
import type { IResultUserRepository } from './repositories/result-user.repository.js';
import { UserId } from './value-objects/user-id.vo.js';
import { Email } from './value-objects/email.vo.js';
import { UserRole } from './value-objects/user-role.vo.js';
import { User } from './entities/user.entity.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class UserService {
  private readonly staticLogger = createStructuredLogger(UserService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject('IResultUserRepository')
    private readonly userRepository: IResultUserRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findProfileById(userId: string): Promise<UserProfile> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Finding profile for user: ${userId}`, { correlationId });

    // Validate user ID format
    if (!UserId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const userIdVO = UserId.create(userId);
    const result = await this.userRepository.findById(userIdVO);

    if (!result.ok) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching user:', result.error, { correlationId });
      throw new Error(`Failed to fetch user: ${result.error?.message}`);
    }

    if (!result.value) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const user = result.value;

    // For now, still fetch profile data from profiles table
    // TODO: Migrate profile data to user entity
    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      logger.warn('⚠️ No profile found in database, returning defaults');
      // If no profile exists, create a minimal one from user data
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: '',
        avatarUrl: user.avatarUrl,
        role: user.role as 'user' | 'admin' | 'moderator', // Include role from user entity
        preferences: {
          theme: 'light',
          emailNotifications: true,
          defaultMetronomeSettings: {
            enabled: false,
            tempo: 120,
            beatsPerMeasure: 4,
            subdivision: 1,
            accentFirstBeat: true,
            volume: 75,
          },
          bassConfiguration: {
            stringCount: 4,
            maxFrets: 24,
          },
          learningStyle: 'free_flow',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return this.mapProfileToUserProfile(profile);
  }

  async updateProfile(
    userId: string,
    profileData: UserProfileData,
  ): Promise<UserProfile> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Updating profile for user: ${userId}`, { correlationId });

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
        logger.warn('Failed to update auth user metadata:', {
          error: authUpdateError,
          correlationId,
        });
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
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating profile:', error as Error, {
        correlationId,
      });
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
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Updating bass configuration for user: ${userId}`, {
      correlationId,
    });

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
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating bass configuration:', error as Error, {
        correlationId,
      });
      throw new Error(`Failed to update bass configuration: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    return this.mapProfileToUserProfile(updatedProfile);
  }

  async getBassConfiguration(userId: string): Promise<BassConfiguration> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Getting bass configuration for user: ${userId}`, {
      correlationId,
    });

    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('bass_string_count, bass_max_frets')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching bass configuration:', error as Error, {
        correlationId,
      });
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

  async updateLearningStyle(
    userId: string,
    learningStyle: LearningStyle,
  ): Promise<UserProfile> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Updating learning style for user: ${userId}`, {
      correlationId,
    });

    // Validate learning style
    const validStyles: LearningStyle[] = [
      'free_flow',
      'guided_practice',
      'strict_mode',
    ];
    if (!validStyles.includes(learningStyle)) {
      throw new BadRequestException(
        `Invalid learning style. Must be one of: ${validStyles.join(', ')}`,
      );
    }

    const { data: updatedProfile, error } = await this.db.supabase
      .from('profiles')
      .update({
        learning_style: learningStyle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating learning style:', error as Error, {
        correlationId,
      });
      throw new Error(`Failed to update learning style: ${error.message}`);
    }

    if (!updatedProfile) {
      throw new NotFoundException(`Profile not found for user: ${userId}`);
    }

    logger.info(`Learning style updated to ${learningStyle} for user: ${userId}`, {
      correlationId,
    });

    return this.mapProfileToUserProfile(updatedProfile);
  }

  async deleteProfile(userId: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Deleting profile for user: ${userId}`, { correlationId });

    // Validate user ID format
    if (!UserId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const userIdVO = UserId.create(userId);

    // Check if user exists using repository
    const existsResult = await this.userRepository.exists(userIdVO);
    if (!existsResult.ok || !existsResult.value) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Delete the user using repository
    const deleteResult = await this.userRepository.delete(userIdVO);
    if (!deleteResult.ok) {
      logger.error('Error deleting user:', deleteResult.error as Error, {
        correlationId,
      });
      throw new Error(`Failed to delete user: ${deleteResult.error?.message}`);
    }

    // Also delete from auth system
    const { error: deleteError } =
      await this.db.supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error deleting user account:', deleteError, {
        correlationId,
      });
      // Don't throw here as the user entity is already deleted
    }

    logger.info(`User deleted successfully: ${userId}`, { correlationId });
  }

  async findAllProfiles(
    limit = 100,
    offset = 0,
  ): Promise<{
    profiles: UserProfile[];
    total: number;
  }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(
      `Finding all profiles with limit: ${limit}, offset: ${offset}`,
      { correlationId },
    );

    // Get total count
    const { count, error: countError } = await this.db.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error('Error counting profiles:', countError as Error, {
        correlationId,
      });
      throw new Error(`Failed to count profiles: ${countError.message}`);
    }

    // Get profiles with pagination
    const { data: profiles, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching profiles:', error as Error, {
        correlationId,
      });
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    return {
      profiles:
        profiles?.map((profile: any) =>
          this.mapProfileToUserProfile(profile),
        ) || [],
      total: count || 0,
    };
  }

  async searchProfiles(searchTerm: string, limit = 20): Promise<UserProfile[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Searching profiles with term: ${searchTerm}`, {
      correlationId,
    });

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
      logger.error('Error searching profiles:', error as Error, {
        correlationId,
      });
      throw new Error(`Failed to search profiles: ${error.message}`);
    }

    return (
      profiles?.map((profile: any) => this.mapProfileToUserProfile(profile)) ||
      []
    );
  }

  async getUserStats(userId: string): Promise<{
    profileCompleteness: number;
    accountAge: number;
    lastActivity: string | null;
  }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Getting stats for user: ${userId}`, { correlationId });

    const { data: profile, error } = await this.db.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching user stats:', error as Error, {
        correlationId,
      });
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

  // Repository-based methods for user management
  async findUserByEmail(email: string): Promise<User | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Finding user by email: ${email}`, { correlationId });

    const emailVO = Email.create(email);
    const result = await this.userRepository.findByEmail(emailVO);

    if (!result.ok) {
      logger.error('Error finding user by email:', result.error as Error, {
        correlationId,
      });
      throw new Error(`Failed to find user: ${result.error?.message}`);
    }

    return result.value;
  }

  async createUser(
    email: string,
    displayName: string,
    role: 'user' | 'admin' | 'moderator' = 'user',
  ): Promise<User> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Creating user: ${email}`, { correlationId });

    // Check if user already exists
    const emailVO = Email.create(email);
    const existsResult = await this.userRepository.existsByEmail(emailVO);

    if (!existsResult.ok) {
      throw new Error(
        `Failed to check user existence: ${existsResult.error?.message}`,
      );
    }

    if (existsResult.value) {
      throw new BadRequestException('User with this email already exists');
    }

    // Create new user
    const userId = UserId.create(crypto.randomUUID());
    const userRole = UserRole.create(role);
    const user = User.create(userId, emailVO, displayName, userRole);

    const saveResult = await this.userRepository.save(user);
    if (!saveResult.ok) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving user:', saveResult.error, { correlationId });
      throw new Error(`Failed to save user: ${saveResult.error?.message}`);
    }

    return user;
  }

  async updateUserRole(
    userId: string,
    newRole: 'user' | 'admin' | 'moderator',
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Updating user role: ${userId} to ${newRole}`, {
      correlationId,
    });

    const userIdVO = UserId.create(userId);
    const userResult = await this.userRepository.findById(userIdVO);

    if (!userResult.ok || !userResult.value) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const user = userResult.value;

    try {
      const roleVO = UserRole.create(newRole);
      user.updateRole(roleVO);
    } catch {
      throw new BadRequestException(`Invalid user role: ${newRole}`);
    }

    const updateResult = await this.userRepository.update(user);
    if (!updateResult.ok) {
      throw new Error(
        `Failed to update user role: ${updateResult.error?.message}`,
      );
    }
  }

  async recordUserLogin(userId: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Recording login for user: ${userId}`, { correlationId });

    const userIdVO = UserId.create(userId);
    const userResult = await this.userRepository.findById(userIdVO);

    if (!userResult.ok || !userResult.value) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const user = userResult.value;
    user.recordLogin();

    const updateResult = await this.userRepository.update(user);
    if (!updateResult.ok) {
      logger.error('Failed to record login:', updateResult.error as Error, {
        correlationId,
      });
      // Don't throw here as this is not critical
    }
  }

  private mapProfileToUserProfile(profile: any): UserProfile {
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      role: profile.role || 'user', // Include role field
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      preferences: {
        theme: 'light' as const, // Default theme
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
        learningStyle: profile.learning_style || 'free_flow',
      },
    };
  }
}
