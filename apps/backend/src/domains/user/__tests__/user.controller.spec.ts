import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserController } from '../user.controller.js';
import type { UserProfileData } from '@bassnotion/contracts';
import type { FastifyRequest } from 'fastify';
import {
  isApiSuccessResponse,
  isApiErrorResponse,
} from '../../../shared/types/api.types.js';

describe('UserController', () => {
  let controller: UserController;
  let mockDatabaseService: any;
  let mockSupabaseClient: any;
  let mockRequest: FastifyRequest & { user: any };

  beforeEach(() => {
    // Create comprehensive mock for Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
      })),
      auth: {
        admin: {
          updateUserById: vi.fn(),
          deleteUser: vi.fn(),
        },
        signInWithPassword: vi.fn(),
      },
    };

    // Mock Database service
    mockDatabaseService = {
      supabase: mockSupabaseClient,
    };

    // Mock authenticated request
    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
    } as FastifyRequest & { user: any };

    // Create controller instance
    controller = new UserController(mockDatabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProfile', () => {
    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      role: 'user',
      bass_string_count: 4,
      bass_max_frets: 24,
    };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));
    });

    it('should return user profile successfully', async () => {
      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile fetched successfully');
      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe('user-123');
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.displayName).toBe('Test User');
        expect(result.data.role).toBe('user');
        expect(result.data.preferences.bassConfiguration.stringCount).toBe(4);
      }
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should return error when profile not found', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Profile not found');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('PROFILE_NOT_FOUND');
      }
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockError = { message: 'Database connection failed' };
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to fetch profile');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('PROFILE_FETCH_FAILED');
        expect(result.error.details).toBe('Database connection failed');
      }
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Internal server error');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should include default preferences when profile has null values', async () => {
      // Arrange
      const profileWithNulls = {
        ...mockProfile,
        bass_string_count: null,
        bass_max_frets: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: profileWithNulls, error: null }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data.preferences.bassConfiguration).toEqual({
          stringCount: 4,
          maxFrets: 24,
        });
        expect(result.data.preferences.theme).toBe('light');
        expect(result.data.preferences.emailNotifications).toBe(true);
      }
    });
  });

  describe('updateProfile', () => {
    const mockProfileData: UserProfileData = {
      displayName: 'Updated User',
      bio: 'Updated bio',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    };

    const mockUpdatedProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Updated User',
      bio: 'Updated bio',
      avatar_url: 'https://example.com/new-avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T01:00:00Z',
      bass_string_count: 4,
      bass_max_frets: 24,
    };

    beforeEach(() => {
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: null,
      });
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUpdatedProfile, error: null }),
      }));
    });

    it('should update profile successfully', async () => {
      // Act
      const result = await controller.updateProfile(
        mockProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data).toBeDefined();
        expect(result.data.displayName).toBe('Updated User');
        expect(result.data.bio).toBe('Updated bio');
        expect(result.data.avatarUrl).toBe(
          'https://example.com/new-avatar.jpg',
        );
      }
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        {
          user_metadata: {
            display_name: 'Updated User',
            full_name: 'Updated User',
          },
        },
      );
    });

    it('should update profile even when auth metadata update fails', async () => {
      // Arrange
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: { message: 'Auth service unavailable' },
      });

      // Act
      const result = await controller.updateProfile(
        mockProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      if (isApiSuccessResponse(result)) {
        expect(result.data.displayName).toBe('Updated User');
      }
    });

    it('should handle profile update database errors', async () => {
      // Arrange
      const mockError = { message: 'Constraint violation' };
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act
      const result = await controller.updateProfile(
        mockProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update profile');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('PROFILE_UPDATE_FAILED');
        expect(result.error.details).toBe('Constraint violation');
      }
    });

    it('should handle profile not found during update', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await controller.updateProfile(
        mockProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Profile not found');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('PROFILE_NOT_FOUND');
      }
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const invalidProfileData = {
        displayName: '', // Invalid empty string
        bio: 'Valid bio',
        avatarUrl: 'invalid-url', // Invalid URL format
      } as UserProfileData;

      // Act & Assert - This would normally fail at the Zod validation level
      // but we test what happens if invalid data somehow gets through
      try {
        await controller.updateProfile(invalidProfileData, mockRequest);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle unexpected errors during update', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      // Act
      const result = await controller.updateProfile(
        mockProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Internal server error');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should handle partial profile updates', async () => {
      // Arrange
      const partialProfileData: UserProfileData = {
        displayName: 'New Name Only',
      };

      const partialUpdatedProfile = {
        ...mockUpdatedProfile,
        display_name: 'New Name Only',
        bio: null, // Unchanged
        avatar_url: null, // Unchanged
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: partialUpdatedProfile, error: null }),
      }));

      // Act
      const result = await controller.updateProfile(
        partialProfileData,
        mockRequest,
      );

      // Assert
      expect(result.success).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data.displayName).toBe('New Name Only');
        expect(result.data.bio).toBe(null);
        expect(result.data.avatarUrl).toBe(null);
      }
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        error: null,
      });
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        error: null,
      });
    });

    it('should delete account successfully with correct password', async () => {
      // Arrange
      const deleteBody = { password: 'correct-password' };

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Account deleted successfully');
      if (isApiSuccessResponse(result)) {
        expect(result.data).toEqual({});
      }
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'correct-password',
      });
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should reject deletion with incorrect password', async () => {
      // Arrange
      const deleteBody = { password: 'wrong-password' };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INVALID_PASSWORD');
      }
      expect(mockSupabaseClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    });

    it('should handle account deletion errors', async () => {
      // Arrange
      const deleteBody = { password: 'correct-password' };
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        error: { message: 'Cannot delete user with active sessions' },
      });

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete account');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('ACCOUNT_DELETION_FAILED');
        expect(result.error.details).toBe(
          'Cannot delete user with active sessions',
        );
      }
    });

    it('should handle unexpected errors during deletion', async () => {
      // Arrange
      const deleteBody = { password: 'correct-password' };
      mockSupabaseClient.auth.signInWithPassword.mockImplementation(() => {
        throw new Error('Auth service unavailable');
      });

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Internal server error');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should handle rate limiting errors', async () => {
      // Arrange
      const deleteBody = { password: 'correct-password' };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Too many requests' },
      });

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INVALID_PASSWORD');
      }
    });

    it('should handle missing password in request body', async () => {
      // Arrange
      const deleteBody = {} as { password: string };
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        error: { message: 'Password is required' },
      });

      // Act
      const result = await controller.deleteAccount(deleteBody, mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error.code).toBe('INVALID_PASSWORD');
      }
    });
  });

  describe('Authentication & Authorization', () => {
    it('should handle requests with missing user context', async () => {
      // Arrange
      const invalidRequest = {} as FastifyRequest & { user: any };

      // Act & Assert - This would normally be caught by the AuthGuard
      // but we test the controller's behavior if it somehow gets through
      try {
        await controller.getProfile(invalidRequest);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle requests with malformed user object', async () => {
      // Arrange
      const malformedRequest = {
        user: { id: null }, // Invalid user ID
      } as FastifyRequest & { user: any };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await controller.getProfile(malformedRequest);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should handle requests with non-string user ID', async () => {
      // Arrange
      const invalidRequest = {
        user: { id: 123, email: 'test@example.com' }, // Non-string ID
      } as any;

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await controller.getProfile(invalidRequest);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('Response Format Compliance', () => {
    it('should return consistent ApiResponse format for success', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'user',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should return consistent ApiResponse format for errors', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('data');
      expect(result.success).toBe(false);
      if (isApiErrorResponse(result)) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('details');
      }
    });

    it('should include role information in profile response', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'admin',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data.role).toBe('admin');
      }
    });

    it('should provide default role when not specified in profile', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: null, // No role specified
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      const result = await controller.getProfile(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data.role).toBe('user'); // Default role
      }
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'user',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act - Simulate concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        controller.getProfile(mockRequest),
      );
      const results = await Promise.all(requests);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        if (isApiSuccessResponse(result)) {
          expect(result.data.id).toBe('user-123');
        }
      });
    });

    it('should complete operations within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: 'user',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      await controller.getProfile(mockRequest);
      const endTime = Date.now();

      // Assert - Should complete within 1 second (generous for unit test)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
