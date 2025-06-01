import type { User } from '@bassnotion/contracts';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  UseGuards,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

import { AuthService } from './auth.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthResponse } from './types/auth.types.js';
import { DatabaseService } from '../../../infrastructure/database/database.service.js';
import { ApiResponse } from '../../../shared/types/api.types.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { PasswordSecurityService } from './services/password-security.service.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly db: DatabaseService,
    private readonly passwordSecurity: PasswordSecurityService,
  ) {
    this.logger.debug('AuthController constructor called');

    // Defensive check for test environment
    if (!this.authService) {
      this.logger.error('AuthService is undefined in constructor!');
    }
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signUpDto: SignUpDto): Promise<AuthResponse> {
    this.logger.debug(`Signup request received for email: ${signUpDto.email}`);

    // Defensive check for test environment
    if (!this.authService) {
      this.logger.error('AuthService is undefined in signup method!');
      return {
        success: false,
        message: 'Authentication service unavailable',
        error: {
          code: 'SERVICE_UNAVAILABLE',
          details: 'AuthService is not properly injected',
        },
      };
    }

    return this.authService.registerUser(signUpDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() signInDto: SignInDto,
    @Req() request: FastifyRequest,
  ): Promise<AuthResponse> {
    this.logger.debug(`Signin request received for email: ${signInDto.email}`);

    // Defensive check for test environment
    if (!this.authService) {
      this.logger.error('AuthService is undefined in signin method!');
      return {
        success: false,
        message: 'Authentication service unavailable',
        error: {
          code: 'SERVICE_UNAVAILABLE',
          details: 'AuthService is not properly injected',
        },
      };
    }

    // Extract client IP address
    const clientIp = this.extractClientIp(request);

    // Extract user agent
    const userAgent = request.headers['user-agent'];

    this.logger.debug(
      `Login attempt from IP: ${clientIp}, User-Agent: ${userAgent}`,
    );

    return this.authService.authenticateUser(signInDto, clientIp, userAgent);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(): Promise<User> {
    this.logger.debug('Get current user request received');
    return this.authService.getCurrentUser();
  }

  @Get('google')
  async googleAuth(@Res() res: FastifyReply): Promise<void> {
    this.logger.debug('Google OAuth initiation - redirecting to Supabase');

    try {
      const { data, error } = await this.db.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/auth/callback`,
        },
      });

      if (error) {
        this.logger.error('Error initiating Google OAuth:', error);
        res.code(500).send({
          success: false,
          message: 'Failed to initiate Google OAuth',
          error: error.message,
        });
        return;
      }

      if (data.url) {
        // Fastify redirect with explicit status code
        res.code(302).redirect(data.url);
      } else {
        res.code(500).send({
          success: false,
          message: 'No OAuth URL generated',
        });
      }
    } catch (error) {
      this.logger.error('Unexpected error in Google OAuth:', error);
      res.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  @Get('google/callback')
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: FastifyReply,
  ): Promise<void> {
    this.logger.debug('Google OAuth callback received');

    try {
      // Exchange the code for a session
      const { data, error } =
        await this.db.supabase.auth.exchangeCodeForSession(code);

      if (error || !data.session) {
        this.logger.error('Error exchanging code for session:', error);
        res.redirect(
          `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/login?error=oauth_failed`,
        );
        return;
      }

      // Create profile if it doesn't exist
      await this.ensureUserProfile(data.user);

      // Redirect to frontend with success
      res.redirect(
        `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/dashboard?oauth=success`,
      );
    } catch (error) {
      this.logger.error('Unexpected error in Google OAuth callback:', error);
      res.redirect(
        `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/login?error=oauth_error`,
      );
    }
  }

  @Post('magic-link')
  @HttpCode(HttpStatus.OK)
  async sendMagicLink(
    @Body() body: { email: string },
  ): Promise<ApiResponse<Record<string, never>>> {
    this.logger.debug(`Magic link request for email: ${body.email}`);

    try {
      const { error } = await this.db.supabase.auth.signInWithOtp({
        email: body.email,
        options: {
          emailRedirectTo: `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/auth/callback`,
        },
      });

      if (error) {
        this.logger.error('Error sending magic link:', error);
        return {
          success: false,
          message: 'Failed to send magic link',
          error: {
            code: 'MAGIC_LINK_FAILED',
            details: error.message,
          },
        };
      }

      return {
        success: true,
        message: 'Magic link sent successfully',
        data: {},
      };
    } catch (error) {
      this.logger.error('Unexpected error sending magic link:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'Failed to send magic link',
        },
      };
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { email: string },
  ): Promise<ApiResponse<Record<string, never>>> {
    this.logger.debug(`Password reset request for email: ${body.email}`);

    try {
      const { error } = await this.db.supabase.auth.resetPasswordForEmail(
        body.email,
        {
          redirectTo: `${process.env.FRONTEND_URL || 'https://bassnotion-frontend.vercel.app'}/reset-password`,
        },
      );

      if (error) {
        this.logger.error('Error sending password reset email:', error);
        return {
          success: false,
          message: 'Failed to send password reset email',
          error: {
            code: 'PASSWORD_RESET_FAILED',
            details: error.message,
          },
        };
      }

      return {
        success: true,
        message: 'Password reset email sent successfully',
        data: {},
      };
    } catch (error) {
      this.logger.error('Unexpected error in password reset:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'Failed to send password reset email',
        },
      };
    }
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: FastifyRequest & { user: any },
  ): Promise<ApiResponse<Record<string, never>>> {
    this.logger.debug('Password change request received');

    try {
      // First verify current password by attempting to sign in
      const { error: verifyError } =
        await this.db.supabase.auth.signInWithPassword({
          email: request.user.email,
          password: changePasswordDto.currentPassword,
        });

      if (verifyError) {
        this.logger.error('Current password verification failed:', verifyError);
        return {
          success: false,
          message: 'Current password is incorrect',
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            details: 'Current password verification failed',
          },
        };
      }

      // Update password
      const { error: updateError } = await this.db.supabase.auth.updateUser({
        password: changePasswordDto.newPassword,
      });

      if (updateError) {
        this.logger.error('Error updating password:', updateError);
        return {
          success: false,
          message: 'Failed to update password',
          error: {
            code: 'PASSWORD_UPDATE_FAILED',
            details: updateError.message,
          },
        };
      }

      return {
        success: true,
        message: 'Password updated successfully',
        data: {},
      };
    } catch (error) {
      this.logger.error('Unexpected error changing password:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'Failed to change password',
        },
      };
    }
  }

  @Post('check-password-security')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkPasswordSecurity(
    @Body() body: { password: string },
    @Req() _request: FastifyRequest & { user: any },
  ): Promise<
    ApiResponse<{
      isCompromised: boolean;
      breachCount?: number;
      recommendation?: string;
      strengthRecommendations: string[];
    }>
  > {
    this.logger.debug('Password security check request received');

    try {
      const passwordCheck = await this.passwordSecurity.checkPasswordSecurity(
        body.password,
      );
      const strengthRecommendations =
        this.passwordSecurity.getPasswordStrengthRecommendations(body.password);

      return {
        success: true,
        message: passwordCheck.isCompromised
          ? 'Password security check completed - issues found'
          : 'Password security check completed - no issues found',
        data: {
          isCompromised: passwordCheck.isCompromised,
          breachCount: passwordCheck.breachCount,
          recommendation: passwordCheck.recommendation,
          strengthRecommendations,
        },
      };
    } catch (error) {
      this.logger.error('Error checking password security:', error);
      return {
        success: false,
        message: 'Failed to check password security',
        error: {
          code: 'PASSWORD_CHECK_FAILED',
          details: 'Unable to verify password security',
        },
      };
    }
  }

  private async ensureUserProfile(user: any): Promise<void> {
    try {
      // Check if profile exists
      const { data: existingProfile } = await this.db.supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Create profile for OAuth user
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User';

        const { error: profileError } = await this.db.supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            display_name: displayName,
            provider: 'google',
          });

        if (profileError) {
          this.logger.error('Error creating OAuth user profile:', profileError);
        } else {
          this.logger.debug(`Created profile for OAuth user: ${user.email}`);
        }
      }
    } catch (error) {
      this.logger.error('Error ensuring user profile:', error);
    }
  }

  /**
   * Extract client IP address from request, handling proxies and load balancers
   */
  private extractClientIp(request: FastifyRequest): string {
    // Check for IP from various headers in order of preference
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xRealIp = request.headers['x-real-ip'];
    const xClientIp = request.headers['x-client-ip'];
    const cfConnectingIp = request.headers['cf-connecting-ip']; // Cloudflare
    const trueClientIp = request.headers['true-client-ip']; // Cloudflare

    // Parse X-Forwarded-For header (can contain multiple IPs)
    if (xForwardedFor) {
      const forwardedIps = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor;

      // Take the first IP (original client)
      const clientIp = forwardedIps.split(',')[0].trim();
      if (clientIp && this.isValidIp(clientIp)) {
        return clientIp;
      }
    }

    // Check other headers
    const headers = [trueClientIp, cfConnectingIp, xRealIp, xClientIp];
    for (const header of headers) {
      if (header && this.isValidIp(header.toString())) {
        return header.toString();
      }
    }

    // Fallback to socket remote address
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Basic IP validation
   */
  private isValidIp(ip: string): boolean {
    // IPv4 regex
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return (
      ipv4Regex.test(ip) ||
      ipv6Regex.test(ip) ||
      ip === '::1' ||
      ip === 'localhost'
    );
  }
}
