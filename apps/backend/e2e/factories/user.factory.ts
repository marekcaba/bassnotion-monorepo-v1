// External dependencies
import { faker } from '@faker-js/faker';
import { Logger } from '@nestjs/common';
import {
  PostgrestError,
  SupabaseClient,
  AuthResponse,
} from '@supabase/supabase-js';

// Internal dependencies
import { AuthUser } from '../../src/domains/user/auth/types/auth.types.js';

const logger = new Logger('UserFactory');

// Types
/* eslint-disable no-unused-vars */
export enum UserRole {
  USER = 'user',
  _ADMIN = 'admin',
  _INSTRUCTOR = 'instructor',
}
/* eslint-enable no-unused-vars */

export interface UserMetadata {
  role: UserRole;
  isAdmin?: boolean;
  isInstructor?: boolean;
  // Additional metadata fields
  preferences?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UserProfile {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  primaryGenre?: string;
  socialLinks?: {
    youtube?: string;
    instagram?: string;
  };
  // Additional fields for instructor profiles
  yearsOfExperience?: number;
  specialties?: string[];
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  practice_reminder_time?: string;
  weekly_goal_minutes: number;
}

export interface CreateUserOptions {
  email?: string;
  password?: string;
  isConfirmed?: boolean;
  role?: UserRole;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
  metadata?: Partial<UserMetadata>;
}

export class UserFactoryError extends Error {
  override cause: Error | PostgrestError | undefined;

  constructor(message: string, cause?: Error | PostgrestError) {
    super(message);
    this.name = 'UserFactoryError';
    this.cause = cause;
  }
}

export class UserFactory {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly supabase: SupabaseClient) {}

  createData(options: CreateUserOptions = {}): {
    email: string;
    password: string;
    role: UserRole;
    profile: UserProfile;
    preferences: UserPreferences;
    metadata: UserMetadata;
  } {
    const email = options.email || faker.internet.email().toLowerCase();

    // Improved email validation and username extraction with type safety
    const emailRegex = /^([^@]+)@[^@]+$/;
    const match = email.match(emailRegex);

    if (!match?.[1]) {
      throw new Error('Invalid email format');
    }

    const username: string = match[1];

    return {
      email,
      password: options.password || 'ValidPassword123!',
      role: options.role || UserRole.USER,
      profile: {
        username,
        displayName: options.profile?.displayName || faker.person.fullName(),
        bio: options.profile?.bio || faker.lorem.sentence(),
        avatarUrl: options.profile?.avatarUrl || faker.image.avatar(),
        skillLevel:
          options.profile?.skillLevel ||
          faker.helpers.arrayElement(['beginner', 'intermediate', 'advanced']),
        primaryGenre:
          options.profile?.primaryGenre ||
          faker.helpers.arrayElement(['rock', 'jazz', 'funk', 'metal']),
        socialLinks: options.profile?.socialLinks || {
          youtube: faker.internet.url(),
          instagram: faker.internet.url(),
        },
        ...options.profile,
      },
      preferences: {
        theme: options.preferences?.theme || 'dark',
        language: options.preferences?.language || 'en',
        notifications_enabled:
          options.preferences?.notifications_enabled ?? true,
        email_notifications_enabled:
          options.preferences?.email_notifications_enabled ?? true,
        practice_reminder_time: options.preferences?.practice_reminder_time,
        weekly_goal_minutes: options.preferences?.weekly_goal_minutes || 0,
        ...options.preferences,
      },
      metadata: {
        role: options.role || UserRole.USER,
        ...options.metadata,
      },
    };
  }

  async create(options: CreateUserOptions = {}): Promise<AuthUser> {
    const userData = this.createData(options);

    try {
      // Verify connection before proceeding
      await this.verifyConnection();

      // Create auth user with proper typing
      const { data: authData, error: authError } =
        (await this.supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: options.isConfirmed ?? true,
          user_metadata: userData.metadata,
        })) as AuthResponse;

      if (authError) {
        logger.error('Failed to create auth user:', authError);
        throw new UserFactoryError('Failed to create auth user', authError);
      }

      if (!authData?.user?.id) {
        throw new UserFactoryError(
          'Failed to create user: No user ID returned',
        );
      }

      const userId = authData.user.id;

      try {
        // Check if profile exists and delete it if it does
        const { data: existingProfile } = await this.supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        if (existingProfile) {
          logger.debug(`Profile ${userId} already exists, deleting it...`);
          const { error: deleteError } = await this.supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

          if (deleteError) {
            logger.error('Failed to delete existing profile:', deleteError);
            throw deleteError;
          }
        }

        // Check if preferences exist and delete them if they do
        const { data: existingPreferences } = await this.supabase
          .from('user_preferences')
          .select('user_id')
          .eq('user_id', userId)
          .single();

        if (existingPreferences) {
          logger.debug(
            `Preferences for user ${userId} already exist, deleting them...`,
          );
          const { error: deleteError } = await this.supabase
            .from('user_preferences')
            .delete()
            .eq('user_id', userId);

          if (deleteError) {
            logger.error('Failed to delete existing preferences:', deleteError);
            throw deleteError;
          }
        }

        // Create user profile with retry logic
        const profileResult = await this.retryOperation(async () => {
          const { data, error } = await this.supabase
            .from('profiles')
            .insert({
              id: userId,
              email: userData.email,
              display_name: userData.profile.displayName,
              avatar_url: userData.profile.avatarUrl,
              bio: userData.profile.bio,
              skill_level: userData.profile.skillLevel,
              social_links: userData.profile.socialLinks,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              zero_mission_completed: false,
              practice_streak_days: 0,
            })
            .select()
            .single();

          if (error) {
            logger.error('Failed to create profile:', error);
            throw error;
          }
          return data;
        }, 3);

        if (!profileResult) {
          throw new Error('Profile creation returned no data');
        }

        // Create user preferences with retry logic
        const preferencesResult = await this.retryOperation(async () => {
          const { error } = await this.supabase
            .from('user_preferences')
            .insert({
              user_id: userId,
              theme: userData.preferences.theme,
              language: userData.preferences.language || 'en',
              notifications_enabled:
                userData.preferences.notifications_enabled ?? true,
              email_notifications_enabled:
                userData.preferences.email_notifications_enabled ?? true,
              weekly_goal_minutes:
                userData.preferences.weekly_goal_minutes || 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (error) {
            logger.error('Failed to create preferences:', error);
            throw error;
          }
          return true;
        }, 3);

        if (!preferencesResult) {
          throw new Error('Preferences creation failed');
        }

        return {
          id: userId,
          email: userData.email,
          displayName: userData.profile.displayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isConfirmed: options.isConfirmed ?? true,
          lastLoginAt: authData.user.last_sign_in_at
            ? new Date(authData.user.last_sign_in_at).toISOString()
            : undefined,
          session: authData.session
            ? {
                accessToken: authData.session.access_token,
                refreshToken: authData.session.refresh_token,
                expiresIn: authData.session.expires_in,
              }
            : undefined,
        };
      } catch (error) {
        // If anything fails after auth user creation, clean up the auth user
        logger.error('Error during user creation, cleaning up:', error);
        await this.supabase.auth.admin.deleteUser(userId);
        throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to create user:', error);
      throw new UserFactoryError(
        `Failed to create user: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async verifyConnection(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);
      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to verify Supabase connection:', error);
      throw new UserFactoryError(
        `Supabase connection verification failed: ${errorMessage}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay = 1000,
  ): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          `Operation failed (attempt ${attempt}/${maxRetries}):`,
          error,
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }

    if (lastError) {
      logger.error('Operation failed after all retries:', lastError);
    }
    return null;
  }

  async createMany(
    count: number,
    options: CreateUserOptions = {},
  ): Promise<AuthUser[]> {
    const createPromises = Array.from({ length: count }, () =>
      this.create(options),
    );
    return Promise.all(createPromises);
  }

  async createAdmin(options: CreateUserOptions = {}): Promise<AuthUser> {
    return this.create({
      ...options,
      role: UserRole._ADMIN,
      email: options.email || 'admin@bassnotion.com',
      metadata: {
        ...options.metadata,
        isAdmin: true,
      },
    });
  }

  async createInstructor(options: CreateUserOptions = {}): Promise<AuthUser> {
    return this.create({
      ...options,
      role: UserRole._INSTRUCTOR,
      metadata: {
        ...options.metadata,
        isInstructor: true,
      },
      profile: {
        ...options.profile,
        bio: options.profile?.bio || faker.lorem.paragraph(),
        skillLevel: 'advanced',
        yearsOfExperience: faker.number.int({ min: 5, max: 30 }),
        specialties: faker.helpers.arrayElements(
          ['jazz theory', 'slap technique', 'music reading', 'improvisation'],
          { min: 2, max: 4 },
        ),
      },
    });
  }
}
