import { promises as dns } from 'node:dns';

import {
  Injectable,
  UnauthorizedException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';

import type { User } from '@bassnotion/contracts';
import { createStructuredLogger } from '@bassnotion/contracts';

import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from '../../../shared/types/api.types.js';

import { DatabaseService } from '../../../infrastructure/database/database.service.js';

import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthResponse, AuthError, AuthData } from './types/auth.types.js';
import { AuthSecurityService } from './services/auth-security.service.js';
import { PasswordSecurityService } from './services/password-security.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly staticLogger = createStructuredLogger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly authSecurityService: AuthSecurityService,
    private readonly passwordSecurityService: PasswordSecurityService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('AuthService constructor completed successfully', {
      correlationId,
    });
  }

  onModuleInit() {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('AuthService module initialized', { correlationId });
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

  /**
   * Check whether an email address's domain accepts mail.
   * Fail-open on transient DNS errors so a flaky resolver doesn't block
   * legitimate signups. Returns `{ valid: false }` only on definitive
   * "domain does not exist / has no MX records" errors.
   */
  async validateEmailDomain(
    email: string | undefined,
  ): Promise<{ valid: boolean; reason?: string }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    const domain = email?.split('@')[1];
    if (!domain) {
      return { valid: false, reason: 'Email is missing a domain' };
    }
    try {
      const mx = await dns.resolveMx(domain);
      if (mx.length === 0) {
        return { valid: false, reason: `Domain "${domain}" has no MX records` };
      }
      // RFC 7505 null MX: priority 0 + exchange "." means "this domain
      // explicitly does not accept mail" (used by typo-squat domains like
      // gogle.com that Google parks). Treat as invalid.
      const nullMx = mx.length === 1 && mx[0].priority === 0 && (mx[0].exchange === '' || mx[0].exchange === '.');
      if (nullMx) {
        return { valid: false, reason: `Domain "${domain}" does not accept mail (null MX)` };
      }
      return { valid: true };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'ENODATA') {
        logger.debug(`MX lookup rejected: ${domain} (${code})`, { correlationId });
        return { valid: false, reason: `Domain "${domain}" does not exist or does not accept mail` };
      }
      logger.warn(`MX lookup for ${domain} failed transiently (${code}); allowing signup`, { correlationId });
      return { valid: true };
    }
  }

  async registerUser(signUpDto: SignUpDto): Promise<AuthResponse> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug(`Registering user with email: ${signUpDto.email}`, {
      correlationId,
    });

    try {
      // Basic validation is now handled by Zod at controller level

      // 1. VALIDATE PASSWORD SECURITY (Zod handles basic format validation)
      logger.debug('Checking password security...', { correlationId });

      // Check password strength requirements
      const strengthRecommendations =
        this.passwordSecurityService.getPasswordStrengthRecommendations(
          signUpDto.password,
        );

      if (strengthRecommendations.length > 0) {
        logger.warn(
          `Password does not meet requirements for ${signUpDto.email}`,
        );
        return {
          success: false,
          message: 'Password does not meet security requirements',
          error: {
            code: 'PASSWORD_REQUIREMENTS_NOT_MET',
            details: `Password requirements: ${strengthRecommendations.join(', ')}`,
          },
        };
      }

      // Check if password is compromised via HaveIBeenPwned
      const securityCheck =
        await this.passwordSecurityService.checkPasswordSecurity(
          signUpDto.password,
        );

      if (securityCheck.isCompromised) {
        logger.warn(
          `Compromised password detected for ${signUpDto.email}: ${securityCheck.breachCount} breaches`,
        );
        return {
          success: false,
          message:
            'This password has been found in data breaches and is not secure',
          error: {
            code: 'PASSWORD_COMPROMISED',
            details:
              securityCheck.recommendation ||
              'This is a commonly used password that has been compromised in data breaches. Please choose a different password.',
          },
        };
      }

      logger.debug('Password security validation passed', { correlationId });

      // 2. CHECK IF USER ALREADY EXISTS
      // SECURITY: We still check for existing users internally, but return a generic
      // error message to prevent email enumeration attacks
      logger.debug('Checking if user already exists...', { correlationId });
      const { data: existingUser } = await this.db.supabase
        .from('profiles')
        .select('id')
        .eq('email', signUpDto.email)
        .single();

      if (existingUser) {
        // SECURITY: Use generic error message that doesn't reveal email exists
        // Log the real reason internally for debugging
        logger.debug(
          `Registration attempt for existing email: ${signUpDto.email}`,
          { correlationId },
        );
        return {
          success: false,
          message: 'Unable to create account',
          error: {
            code: 'REGISTRATION_FAILED',
            details: 'Unable to create account. Please try signing in instead.',
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
        logger.error(`Error registering user: ${authError.message}`, authError);
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

        logger.error(
          `Error creating user profile after 3 attempts: ${profileError?.message}`,
          profileError as Error,
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
      logger.error(
        `Error in registerUser: ${authError.message}`,
        error as Error,
      );

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
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    // Force rebuild v2.0 - ensure Railway uses latest method signature
    logger.debug(`Authenticating user with email: ${signInDto.email}`, {
      correlationId,
    });

    const clientIp = ipAddress || 'unknown';

    try {
      // Check if database connection is available
      if (!this.db) {
        logger.error(
          'Database service is not injected',
          new Error('Database service missing'),
          { correlationId },
        );
        return {
          success: false,
          message: 'An unexpected error occurred',
          error: {
            code: 'DATABASE_UNAVAILABLE',
            details: 'An unexpected error occurred',
          },
        };
      }

      if (!this.db.supabase) {
        logger.error(
          'Supabase client is not initialized',
          new Error('Supabase unavailable'),
          { correlationId },
        );
        // Try to initialize it
        await this.db.initializeSupabaseClient();

        // Check again
        if (!this.db.supabase) {
          logger.error(
            'Failed to initialize Supabase client after retry',
            new Error('Supabase initialization failed'),
            { correlationId },
          );
          return {
            success: false,
            message: 'An unexpected error occurred',
            error: {
              code: 'DATABASE_UNAVAILABLE',
              details: 'An unexpected error occurred',
            },
          };
        }
      }

      // Check rate limiting and account lockout BEFORE attempting authentication
      const { rateLimitInfo, lockoutInfo } =
        (await this.authSecurityService.getSecurityInfo(
          signInDto.email,
          clientIp,
        )) || {
          rateLimitInfo: { isRateLimited: false, attemptsRemaining: 999 },
          lockoutInfo: { isLocked: false, failedAttempts: 0 },
        };

      // Block if rate limited or account locked
      if (rateLimitInfo.isRateLimited || lockoutInfo.isLocked) {
        const errorMessage =
          this.authSecurityService.getSecurityErrorMessage(
            rateLimitInfo,
            lockoutInfo,
          ) || 'Login blocked due to security measures';

        logger.warn(
          `Login blocked for ${signInDto.email} from IP ${clientIp}: ${errorMessage}`,
          { correlationId },
        );

        // Still record the attempt for tracking
        await this.authSecurityService.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        const errorResponse: ApiErrorResponse = {
          success: false,
          message: errorMessage,
          error: {
            code: rateLimitInfo.isRateLimited
              ? 'RATE_LIMITED'
              : 'ACCOUNT_LOCKED',
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
        await this.authSecurityService.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        logger.error(
          `Error authenticating user: ${error?.message || 'Unknown error'}`,
          error as Error,
          { correlationId },
        );
        const errorResponse: ApiErrorResponse = {
          success: false,
          message: 'Invalid email or password',
          error: {
            code: 'INVALID_CREDENTIALS',
            details: 'Invalid email or password',
          },
        };
        return errorResponse;
      }

      // Get user profile
      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .select()
        .eq('id', auth.user.id)
        .single();

      if (profileError) {
        // Record failed attempt for profile fetch failure
        await this.authSecurityService.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        logger.error(
          `Error fetching user profile: ${profileError.message}`,
          profileError as Error,
          { correlationId },
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
        await this.authSecurityService.recordLoginAttempt(
          signInDto.email,
          clientIp,
          false,
          userAgent,
        );

        logger.error(
          'User profile data is null after successful authentication.',
          new Error('Null profile'),
          { correlationId },
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
      await this.authSecurityService.recordLoginAttempt(
        signInDto.email,
        clientIp,
        true,
        userAgent,
      );

      logger.info(
        `Successful login for ${signInDto.email} from IP ${clientIp}`,
        { correlationId },
      );

      // Check if user's password has been compromised (after successful login)
      let passwordWarning = '';
      try {
        const passwordCheck =
          await this.passwordSecurityService.checkPasswordSecurity(
            signInDto.password,
          );
        if (
          passwordCheck.isCompromised &&
          passwordCheck.breachCount &&
          passwordCheck.breachCount > 0
        ) {
          passwordWarning =
            passwordCheck.recommendation ||
            'Your password may have been compromised. Please consider changing it.';
          logger.warn(
            `User ${signInDto.email} logged in with compromised password (${passwordCheck.breachCount} breaches)`,
            { correlationId },
          );
        }
      } catch (error) {
        logger.error(
          'Error checking password security during login:',
          error as Error,
          { correlationId },
        );
        // Continue with login - don't block user if security check fails
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
        message: passwordWarning
          ? `Successfully authenticated. Security Notice: ${passwordWarning}`
          : 'Successfully authenticated',
        data: authData,
      };

      return successResponse;
    } catch (error) {
      // Record failed attempt for unexpected errors
      await this.authSecurityService.recordLoginAttempt(
        signInDto.email,
        clientIp,
        false,
        userAgent,
      );

      const authError = this.normalizeError(error);
      logger.error(
        `Error in authenticateUser: ${authError.message}`,
        error as Error,
        { correlationId },
      );

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
    // Create logger directly to avoid initialization issues
    const logger = createStructuredLogger('AuthService.validateToken');

    logger.debug('Validating token', {
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 20),
      hasDb: !!this.db,
      hasSupabase: !!this.db?.supabase,
      supabaseAuth: !!this.db?.supabase?.auth,
    });

    // Check if database service is available
    if (!this.db) {
      logger.error('Database service not injected in validateToken');
      throw new UnauthorizedException('Service temporarily unavailable');
    }

    // Check if supabase client is initialized
    if (!this.db.supabase || !this.db.supabase.auth) {
      logger.error('Supabase client not initialized');
      // Try to initialize it
      await this.db.initializeSupabaseClient();

      // Check again
      if (!this.db.supabase || !this.db.supabase.auth) {
        logger.error('Failed to initialize Supabase client');
        throw new UnauthorizedException('Service temporarily unavailable');
      }
    }

    try {
      const {
        data: { user },
        error,
      } = await this.db.supabase.auth.getUser(token);

      if (error) {
        logger.error('Supabase auth.getUser error:', error);
        throw new UnauthorizedException(
          `Token validation failed: ${error.message}`,
        );
      }

      if (!user) {
        logger.error('No user returned from Supabase');
        throw new UnauthorizedException('Invalid token - no user');
      }

      logger.debug('User found from token', {
        userId: user.id,
        email: user.email,
      });

      const { data: profile, error: profileError } = await this.db.supabase
        .from('profiles')
        .select()
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('Profile fetch error:', profileError);
        throw new UnauthorizedException(
          `Profile not found: ${profileError.message}`,
        );
      }

      if (!profile) {
        logger.error('No profile data returned');
        throw new UnauthorizedException('User profile not found');
      }

      logger.debug('Profile found', { profileId: profile.id });

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    } catch (error) {
      logger.error('Token validation error:', error as Error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
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
