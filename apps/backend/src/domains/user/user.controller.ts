import type { UserProfile, UserProfileData } from '@bassnotion/contracts';
import { userProfileSchema } from '@bassnotion/contracts';
import {
  Controller,
  Put,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { ApiResponse } from '../../shared/types/api.types.js';
import { AuthGuard } from './auth/guards/auth.guard.js';

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly db: DatabaseService) {}

  @Put('profile')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Body() profileData: UserProfileData,
    @Req() request: FastifyRequest & { user: any },
  ): Promise<ApiResponse<UserProfile>> {
    this.logger.debug(`Profile update request for user: ${request.user.id}`);

    try {
      // Validate the profile data
      const validatedData = userProfileSchema.parse(profileData);

      // Update the Supabase Auth user metadata (this updates the auth.users table)
      if (validatedData.displayName) {
        const { error: authUpdateError } = await this.db.supabase.auth.admin.updateUserById(
          request.user.id,
          {
            user_metadata: {
              display_name: validatedData.displayName,
              full_name: validatedData.displayName, // Some integrations use full_name
            }
          }
        );

        if (authUpdateError) {
          this.logger.warn('Failed to update auth user metadata:', authUpdateError);
          // Don't fail the entire operation if auth metadata update fails
        } else {
          this.logger.debug('Successfully updated auth user metadata');
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
        .eq('id', request.user.id)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating profile:', error);
        return {
          success: false,
          message: 'Failed to update profile',
          error: {
            code: 'PROFILE_UPDATE_FAILED',
            details: error.message,
          },
        };
      }

      if (!updatedProfile) {
        return {
          success: false,
          message: 'Profile not found',
          error: {
            code: 'PROFILE_NOT_FOUND',
            details: 'User profile not found',
          },
        };
      }

      const userData: UserProfile = {
        id: updatedProfile.id,
        email: updatedProfile.email,
        displayName: updatedProfile.display_name,
        bio: updatedProfile.bio,
        avatarUrl: updatedProfile.avatar_url,
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at,
        preferences: {
          theme: 'light', // Default theme
          emailNotifications: true, // Default setting
          defaultMetronomeSettings: {
            enabled: false,
            tempo: 120,
            beatsPerMeasure: 4,
            subdivision: 1,
            accentFirstBeat: true,
            volume: 75
          }
        }
      };

      return {
        success: true,
        message: 'Profile updated successfully',
        data: userData,
      };
    } catch (error) {
      this.logger.error('Unexpected error updating profile:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'Failed to update profile',
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
    this.logger.debug(`Account deletion request for user: ${request.user.id}`);

    try {
      // Verify password before deletion
      const { error: verifyError } =
        await this.db.supabase.auth.signInWithPassword({
          email: request.user.email,
          password: body.password,
        });

      if (verifyError) {
        this.logger.error('Password verification failed for account deletion:', verifyError);
        return {
          success: false,
          message: 'Invalid password',
          error: {
            code: 'INVALID_PASSWORD',
            details: 'Password verification failed',
          },
        };
      }

      // Delete the user account (this will cascade delete the profile due to FK constraint)
      const { error: deleteError } = await this.db.supabase.auth.admin.deleteUser(
        request.user.id
      );

      if (deleteError) {
        this.logger.error('Error deleting user account:', deleteError);
        return {
          success: false,
          message: 'Failed to delete account',
          error: {
            code: 'ACCOUNT_DELETION_FAILED',
            details: deleteError.message,
          },
        };
      }

      this.logger.log(`Account deleted successfully for user: ${request.user.id}`);

      return {
        success: true,
        message: 'Account deleted successfully',
        data: {},
      };
    } catch (error) {
      this.logger.error('Unexpected error deleting account:', error);
      return {
        success: false,
        message: 'Internal server error',
        error: {
          code: 'INTERNAL_ERROR',
          details: 'Failed to delete account',
        },
      };
    }
  }
} 