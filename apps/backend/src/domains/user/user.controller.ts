import { UserProfile, createStructuredLogger } from '@bassnotion/contracts';
import type { UserProfileData } from '@bassnotion/contracts';
import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { ApiResponse } from '../../shared/types/api.types.js';
import { AuthGuard } from './auth/guards/auth.guard.js';
import { UserService } from './user.service.js';

@Controller('api/user')
export class UserController {
  private readonly staticLogger = createStructuredLogger(UserController.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly userService: UserService,
  ) {}

  @Get('profile')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getProfile(
    @Req() request: FastifyRequest & { user: any },
  ): Promise<ApiResponse<UserProfile>> {
    this.staticLogger.debug(`Profile request for user: ${request.user.id}`);

    try {
      const profile = await this.userService.findProfileById(request.user.id);

      const userData: UserProfile = profile;

      return {
        success: true,
        message: 'Profile fetched successfully',
        data: userData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        (error instanceof Error && error.message.includes('Not found'))
      ) {
        this.staticLogger.error('Profile not found:', error);
        return {
          success: false,
          message: 'Profile not found',
          error: {
            code: 'PROFILE_NOT_FOUND',
            details: 'User profile not found',
          },
        };
      }

      this.staticLogger.error(
        'Unexpected error fetching profile:',
        error as Error,
      );
      return {
        success: false,
        message: 'Failed to fetch profile',
        error: {
          code: 'PROFILE_FETCH_FAILED',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  @Put('profile')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Body() profileData: UserProfileData,
    @Req() request: FastifyRequest & { user: any },
  ): Promise<ApiResponse<UserProfile>> {
    this.staticLogger.debug(
      `Profile update request for user: ${request.user.id}`,
    );

    try {
      const updatedProfile = await this.userService.updateProfile(
        request.user.id,
        profileData,
      );

      return {
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        (error instanceof Error && error.message.includes('Not found'))
      ) {
        this.staticLogger.error('Profile not found:', error);
        return {
          success: false,
          message: 'Profile not found',
          error: {
            code: 'PROFILE_NOT_FOUND',
            details: 'User profile not found',
          },
        };
      }

      this.staticLogger.error(
        'Unexpected error updating profile:',
        error as Error,
      );
      return {
        success: false,
        message: 'Failed to update profile',
        error: {
          code: 'PROFILE_UPDATE_FAILED',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  @Delete('account')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Body() body: { password: string },
    @Req() request: FastifyRequest & { user: any },
  ): Promise<ApiResponse<Record<string, never>>> {
    this.staticLogger.debug(
      `Account deletion request for user: ${request.user.id}`,
    );

    try {
      // Verify password before deletion
      const { error: verifyError } =
        await this.db.supabase.auth.signInWithPassword({
          email: request.user.email,
          password: body.password,
        });

      if (verifyError) {
        this.staticLogger.error(
          'Password verification failed for account deletion:',
          verifyError,
        );
        return {
          success: false,
          message: 'Invalid password',
          error: {
            code: 'INVALID_PASSWORD',
            details: 'Password verification failed',
          },
        };
      }

      // Delete the user profile using service
      await this.userService.deleteProfile(request.user.id);

      this.staticLogger.info(
        `Account deleted successfully for user: ${request.user.id}`,
      );

      return {
        success: true,
        message: 'Account deleted successfully',
        data: {},
      };
    } catch (error) {
      this.staticLogger.error(
        'Unexpected error deleting account:',
        error as Error,
      );
      return {
        success: false,
        message: 'Failed to delete account',
        error: {
          code: 'ACCOUNT_DELETION_FAILED',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
