import type { User } from '@bassnotion/contracts';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from '../../../shared/types/api.types.js';

import { DatabaseService } from '../../../infrastructure/database/database.service.js';

import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthResponse, AuthError, AuthData } from './types/auth.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly db: DatabaseService) {
    this.logger.debug('AuthService constructor called');
  }

  private normalizeError(error: unknown): AuthError {
    if (error instanceof Error) {
      return {
        message: error.message,
        code:
          error instanceof SupabaseAuthError
            ? String(error.status)
            : 'UNKNOWN_ERROR',
      };
    }
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      'status' in error
    ) {
      return {
        message: String(error.message),
        code: String(error.status),
      };
    }
    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }

  async registerUser(signUpDto: SignUpDto): Promise<AuthResponse> {
    this.logger.debug(`Registering user with email: ${signUpDto.email}`);

    try {
      const { data: auth, error } = await this.db.supabase.auth.signUp({
        email: signUpDto.email,
        password: signUpDto.password,
      });

      if (error) {
        this.logger.error(`Error registering user: ${error.message}`);
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: error.message,
          error: {
            code: String(error.status || 'AUTH_ERROR'),
            details: error.message,
          },
        };
        return errorResponse;
      }

      if (!auth.user) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User registration failed',
          error: {
            code: 'REGISTRATION_FAILED',
            details: 'User registration failed',
          },
        };
        return errorResponse;
      }

      console.log('Before Supabase profile creation (registerUser):', {
        userId: auth.user.id,
        email: auth.user.email,
        displayName: signUpDto.displayName,
      });

      // Create user profile
      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .insert({
          id: auth.user.id,
          email: auth.user.email,
          display_name: signUpDto.displayName,
          bio: signUpDto.bio,
        })
        .select()
        .single();

      console.log('Result from Supabase single() call (registerUser):', {
        data: profile,
        error: profileError,
      });

      if (profileError) {
        this.logger.error(
          `Error creating user profile: ${profileError.message}`,
          profileError.stack,
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: profileError.message,
          error: {
            code: 'PROFILE_CREATION_FAILED',
            details: 'Failed to create user profile.',
          },
        };
        return errorResponse;
      }

      if (!profile) {
        this.logger.error('User profile data is null after successful registration.');
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User profile data missing',
          error: {
            code: 'PROFILE_DATA_MISSING',
            details: 'User profile data missing.',
          },
        };
        return errorResponse;
      }

      const authData: AuthData = {
        user: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
        session: {
          accessToken: auth.session?.access_token || '',
          refreshToken: auth.session?.refresh_token || undefined,
          expiresIn: auth.session?.expires_in || 3600,
        },
      };

      const successResponse: ApiSuccessResponse<AuthData> = {
        success: true,
        message: 'User registered successfully',
        data: authData,
      };

      return successResponse;
    } catch (error) {
      const authError = this.normalizeError(error);
      this.logger.error(`Error in registerUser: ${authError.message}`);

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: authError.message,
        error: {
          code: authError.code,
          details: authError.message,
        },
      };

      return errorResponse;
    }
  }

  async authenticateUser(signInDto: SignInDto): Promise<AuthResponse> {
    this.logger.debug(`Authenticating user with email: ${signInDto.email}`);

    try {
      const { data: auth, error } =
        await this.db.supabase.auth.signInWithPassword({
          email: signInDto.email,
          password: signInDto.password,
        });

      if (error) {
        this.logger.error(`Error authenticating user: ${error.message}`);
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: error.message,
          error: {
            code: String(error.status || 'AUTH_ERROR'),
            details: error.message,
          },
        };
        return errorResponse;
      }

      if (!auth.user) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Authentication failed',
          error: {
            code: 'AUTH_FAILED',
            details: 'Authentication failed',
          },
        };
        return errorResponse;
      }

      console.log('Before Supabase profile fetch (authenticateUser):', {
        userId: auth.user.id,
        email: auth.user.email,
      });

      // Get user profile
      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .select()
        .eq('id', auth.user.id)
        .single();

      console.log('Result from Supabase single() call (authenticateUser):', {
        data: profile,
        error: profileError,
      });

      if (profileError) {
        this.logger.error(
          `Error fetching user profile: ${profileError.message}`,
          profileError.stack,
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: profileError.message,
          error: {
            code: 'PROFILE_FETCH_FAILED',
            details: 'Failed to fetch user profile.',
          },
        };
        return errorResponse;
      }

      if (!profile) {
        this.logger.error('User profile data is null after successful authentication.');
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'User profile data missing',
          error: {
            code: 'PROFILE_DATA_MISSING',
            details: 'User profile data missing.',
          },
        };
        return errorResponse;
      }

      const authData: AuthData = {
        user: {
          id: profile.id,
          email: profile.email,
          displayName: profile.display_name,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
        session: {
          accessToken: auth.session?.access_token || '',
          refreshToken: auth.session?.refresh_token || undefined,
          expiresIn: auth.session?.expires_in || 3600,
        },
      };

      const successResponse: ApiSuccessResponse<AuthData> = {
        success: true,
        message: 'Successfully authenticated',
        data: authData,
      };

      return successResponse;
    } catch (error) {
      const authError = this.normalizeError(error);
      this.logger.error(`Error in authenticateUser: ${authError.message}`);

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: authError.message,
        error: {
          code: authError.code,
          details: authError.message,
        },
      };

      return errorResponse;
    }
  }

  async validateToken(token: string): Promise<User> {
    try {
      const {
        data: { user },
        error,
      } = await this.db.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .select()
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        throw new UnauthorizedException('User profile not found');
      }

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const {
        data: { session },
        error,
      } = await this.db.supabase.auth.getSession();

      if (error || !session?.user) {
        throw new UnauthorizedException('No active session');
      }

      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .select()
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        throw new UnauthorizedException('User profile not found');
      }

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    } catch (error) {
      throw new UnauthorizedException('No active session');
    }
  }
}
