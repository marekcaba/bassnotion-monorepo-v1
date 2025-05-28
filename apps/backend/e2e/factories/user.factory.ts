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
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
}

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
  emailNotifications: boolean;
  metronomeEnabled: boolean;
  defaultPlaybackSpeed: number;
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
        emailNotifications: options.preferences?.emailNotifications ?? true,
        metronomeEnabled: options.preferences?.metronomeEnabled ?? true,
        defaultPlaybackSpeed: options.preferences?.defaultPlaybackSpeed || 1.0,
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

      // Create user profile with retry logic
      const profileResult = await this.retryOperation(async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .insert({
            id: userId,
            ...userData.profile,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }, 3);

      if (!profileResult) {
        // Cleanup auth user if profile creation fails
        await this.supabase.auth.admin.deleteUser(userId);
        throw new UserFactoryError('Failed to create user profile');
      }

      // Create user preferences with retry logic
      const preferencesResult = await this.retryOperation(async () => {
        const { error } = await this.supabase.from('user_preferences').insert({
          user_id: userId,
          ...userData.preferences,
        });

        if (error) throw error;
        return true;
      }, 3);

      if (!preferencesResult) {
        // Cleanup auth user and profile if preferences creation fails
        await this.supabase.auth.admin.deleteUser(userId);
        throw new UserFactoryError('Failed to create user preferences');
      }

      // Create initial free tokens with retry logic
      const tokensResult = await this.retryOperation(async () => {
        const { error } = await this.supabase.from('tokens').insert([
          {
            user_id: userId,
            type: 'free',
            amount: 5,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        ]);

        if (error) throw error;
        return true;
      }, 3);

      if (!tokensResult) {
        // Cleanup auth user, profile, and preferences if tokens creation fails
        await this.supabase.auth.admin.deleteUser(userId);
        throw new UserFactoryError('Failed to create initial tokens');
      }

      // Convert to AuthUser with proper type checking
      const authUser: AuthUser = {
        id: userId,
        email: userData.email,
        displayName: userData.profile.displayName,
        createdAt: new Date().toISOString(), // We don't have access to profile.created_at yet
        updatedAt: new Date().toISOString(), // We don't have access to profile.updated_at yet
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

      return authUser;
    } catch (error: unknown) {
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
      role: UserRole.ADMIN,
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
      role: UserRole.INSTRUCTOR,
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
