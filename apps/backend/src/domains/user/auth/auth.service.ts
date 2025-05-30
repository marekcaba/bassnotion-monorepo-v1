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
import { AuthSecurityService } from './services/auth-security.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly authSecurity: AuthSecurityService,
  ) {
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
      // First, check if user already exists
      const { data: existingUser } = await this.db.supabase
        .from('profiles')
        .select('id')
        .eq('email', signUpDto.email)
        .single();

      if (existingUser) {
        return {
          success: false,
          message: 'User already exists',
          error: {
            code: 'USER_EXISTS',
            details: 'A user with this email already exists.',
          },
        };
      }

      // Create auth user
      const { data: auth, error: authError } =
        await this.db.supabase.auth.signUp({
          email: signUpDto.email,
          password: signUpDto.password,
        });

      if (authError) {
        this.logger.error(`Error registering user: ${authError.message}`);
        return {
          success: false,
          message: authError.message,
          error: {
            code: String(authError.status || 'AUTH_ERROR'),
            details: authError.message,
          },
        };
      }

      if (!auth.user) {
        return {
          success: false,
          message: 'User registration failed',
          error: {
            code: 'REGISTRATION_FAILED',
            details: 'User registration failed',
          },
        };
      }

      // Create user profile with retry logic
      let profile;
      let profileError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await this.db.supabase
          .from('profiles')
          .insert({
            id: auth.user.id,
            email: auth.user.email,
            display_name: signUpDto.displayName,
            bio: signUpDto.bio,
          })
          .select()
          .single();

        if (!result.error) {
          profile = result.data;
          break;
        }

        profileError = result.error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }

      if (profileError || !profile) {
        // Clean up auth user if profile creation failed
        await this.db.supabase.auth.admin.deleteUser(auth.user.id);

        this.logger.error(
          `Error creating user profile after 3 attempts: ${profileError?.message}`,
          profileError?.stack,
        );
        return {
          success: false,
          message: profileError?.message || 'Failed to create user profile',
          error: {
            code: 'PROFILE_CREATION_FAILED',
            details: 'Failed to create user profile after multiple attempts.',
          },
        };
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

      return {
        success: true,
        message: 'User registered successfully',
        data: authData,
      };
    } catch (error) {
      const authError = this.normalizeError(error);
      this.logger.error(`Error in registerUser: ${authError.message}`);

      return {
        success: false,
        message: authError.message,
        error: {
          code: authError.code,
          details: authError.message,
        },
      };
    }
  }

  async authenticateUser(
    signInDto: SignInDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    // Force rebuild v2.0 - ensure Railway uses latest method signature
    this.logger.debug(`Authenticating user with email: ${signInDto.email}`);

    const clientIp = ipAddress || 'unknown';

    try {
      // Check rate limiting and account lockout BEFORE attempting authentication
      const { rateLimitInfo, lockoutInfo } =
        await this.authSecurity.getSecurityInfo(signInDto.email, clientIp);

      // Block if rate limited or account locked
      if (rateLimitInfo.isRateLimited || lockoutInfo.isLocked) {
        const errorMessage = this.authSecurity.getSecurityErrorMessage(
          rateLimitInfo,
          lockoutInfo,
        );

        this.logger.warn(
          `Login blocked for ${signInDto.email} from IP ${clientIp}: ${errorMessage}`,
        );

        // Still record the attempt for tracking
        await this.authSecurity.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        const errorResponse: ApiErrorResponse = {
          success: false,
          message: errorMessage,
          error: {
            code: lockoutInfo.isLocked ? 'ACCOUNT_LOCKED' : 'RATE_LIMITED',
            details: errorMessage,
          },
        };
        return errorResponse;
      }

      // Attempt authentication with Supabase
      const { data: auth, error } =
        await this.db.supabase.auth.signInWithPassword({
          email: signInDto.email,
          password: signInDto.password,
        });

      // Record failed attempt if authentication failed
      if (error || !auth.user) {
        await this.authSecurity.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        this.logger.error(
          `Error authenticating user: ${error?.message || 'Unknown error'}`,
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid credentials',
          error: {
            code: 'INVALID_CREDENTIALS',
            details: 'Invalid email or password',
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
        // Record failed attempt for profile fetch failure
        await this.authSecurity.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        this.logger.error(
          `Error fetching user profile: ${profileError.message}`,
          profileError.stack,
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Authentication failed',
          error: {
            code: 'PROFILE_FETCH_FAILED',
            details: 'Failed to fetch user profile.',
          },
        };
        return errorResponse;
      }

      if (!profile) {
        // Record failed attempt for missing profile
        await this.authSecurity.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        this.logger.error(
          'User profile data is null after successful authentication.',
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Authentication failed',
          error: {
            code: 'PROFILE_DATA_MISSING',
            details: 'User profile data missing.',
          },
        };
        return errorResponse;
      }

      // SUCCESS: Record successful login attempt
      await this.authSecurity.recordLoginAttempt(
        signInDto.email,
        clientIp,
        true,
        userAgent,
      );

      this.logger.log(
        `Successful login for ${signInDto.email} from IP ${clientIp}`,
      );

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
      // Record failed attempt for unexpected errors
      await this.authSecurity.recordLoginAttempt(
        signInDto.email,
        clientIp,
        false,
        userAgent,
      );

      const authError = this.normalizeError(error);
      this.logger.error(`Error in authenticateUser: ${authError.message}`);

      const errorResponse: ApiErrorResponse = {
        success: false,
        message: 'Authentication failed',
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
    } catch {
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
    } catch {
      throw new UnauthorizedException('No active session');
    }
  }
}
