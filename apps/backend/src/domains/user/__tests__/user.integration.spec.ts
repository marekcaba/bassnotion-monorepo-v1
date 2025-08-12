import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserController } from '../user.controller.js';
import { UserService } from '../user.service.js';
import type { UserProfileData, BassConfiguration } from '@bassnotion/contracts';
import type { FastifyRequest } from 'fastify';
import {
  isApiSuccessResponse,
  isApiErrorResponse,
} from '../../../shared/types/api.types.js';

describe('User Integration Tests', () => {
  let controller: UserController;
  let service: UserService;
  let mockDatabaseService: any;
  let mockSupabaseClient: any;
  let mockRequest: FastifyRequest & { user: any };

  beforeEach(() => {
    // Create comprehensive Supabase client mock
    mockSupabaseClient = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })),
      auth: {
        admin: {
          updateUserById: vi.fn(),
          deleteUser: vi.fn(),
        },
        signInWithPassword: vi.fn(),
      },
    };

    mockDatabaseService = {
      supabase: mockSupabaseClient,
    };

    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
      },
    } as FastifyRequest & { user: any };

    // Create service and controller instances directly (simplified approach)
    service = new UserService(mockDatabaseService);
    controller = new UserController(mockDatabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete User Profile Workflow', () => {
    const mockUserProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'John Doe',
      bio: 'Bass player from NYC',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      role: 'user',
      bass_string_count: 4,
      bass_max_frets: 24,
    };

    const updatedProfileData: UserProfileData = {
      displayName: 'John Smith',
      bio: 'Professional bass player and instructor',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    };

    const mockUpdatedProfile = {
      ...mockUserProfile,
      display_name: 'John Smith',
      bio: 'Professional bass player and instructor',
      avatar_url: 'https://example.com/new-avatar.jpg',
      updated_at: '2024-01-01T01:00:00Z',
    };

    it('should complete full user profile management workflow', async () => {
      // Arrange - Set up all mocks for the complete workflow

      // 1. Mock initial profile fetch
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockUserProfile, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      // 2. Mock auth service for profile updates
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: null,
      });

      // Act & Assert - Execute complete workflow

      // Step 1: Get initial profile
      const initialProfileResponse = await controller.getProfile(mockRequest);
      expect(initialProfileResponse.success).toBe(true);
      if (isApiSuccessResponse(initialProfileResponse)) {
        expect(initialProfileResponse.data.displayName).toBe('John Doe');
        expect(initialProfileResponse.data.role).toBe('user');
        expect(
          initialProfileResponse.data.preferences.bassConfiguration,
        ).toEqual({
          stringCount: 4,
          maxFrets: 24,
        });
      }

      // Step 2: Update profile information
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUpdatedProfile, error: null }),
      }));

      const updateResponse = await controller.updateProfile(
        updatedProfileData,
        mockRequest,
      );
      expect(updateResponse.success).toBe(true);
      if (isApiSuccessResponse(updateResponse)) {
        expect(updateResponse.data.displayName).toBe('John Smith');
        expect(updateResponse.data.bio).toBe(
          'Professional bass player and instructor',
        );
      }

      // Step 3: Verify auth metadata was updated
      expect(mockSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
        'user-123',
        {
          user_metadata: {
            display_name: 'John Smith',
            full_name: 'John Smith',
          },
        },
      );

      // Step 4: Get updated profile to verify changes
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUpdatedProfile, error: null }),
      }));

      const finalProfileResponse = await controller.getProfile(mockRequest);
      expect(finalProfileResponse.success).toBe(true);
      if (isApiSuccessResponse(finalProfileResponse)) {
        expect(finalProfileResponse.data.displayName).toBe('John Smith');
        expect(finalProfileResponse.data.bio).toBe(
          'Professional bass player and instructor',
        );
      }
    });

    it('should handle bass configuration management workflow', async () => {
      // Arrange
      const bassConfig: BassConfiguration = {
        stringCount: 5,
        maxFrets: 22,
      };

      const profileWithUpdatedBass = {
        ...mockUserProfile,
        bass_string_count: 5,
        bass_max_frets: 22,
        updated_at: '2024-01-01T02:00:00Z',
      };

      // 1. Get initial bass configuration
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUserProfile, error: null }),
      }));

      const initialBassConfig = await service.getBassConfiguration('user-123');
      expect(initialBassConfig).toEqual({
        stringCount: 4,
        maxFrets: 24,
      });

      // 2. Update bass configuration
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: profileWithUpdatedBass, error: null }),
      }));

      const updatedProfile = await service.updateBassConfiguration(
        'user-123',
        bassConfig,
      );
      expect(updatedProfile.preferences.bassConfiguration).toEqual({
        stringCount: 5,
        maxFrets: 22,
      });

      // 3. Verify bass configuration was updated in database
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: profileWithUpdatedBass, error: null }),
      }));

      const finalBassConfig = await service.getBassConfiguration('user-123');
      expect(finalBassConfig).toEqual({
        stringCount: 5,
        maxFrets: 22,
      });
    });

    it('should handle user search and discovery workflow', async () => {
      // Arrange
      const searchResults = [
        {
          id: 'user-1',
          email: 'john@example.com',
          display_name: 'John Doe',
          bio: 'Bass player from NYC',
          avatar_url: 'https://example.com/avatar1.jpg',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          bass_string_count: 4,
          bass_max_frets: 24,
        },
        {
          id: 'user-2',
          email: 'jane@example.com',
          display_name: 'Jane Smith',
          bio: 'Jazz bassist and educator',
          avatar_url: 'https://example.com/avatar2.jpg',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          bass_string_count: 5,
          bass_max_frets: 22,
        },
      ];

      const allUsersResults = [
        ...searchResults,
        {
          id: 'user-3',
          email: 'mike@example.com',
          display_name: 'Mike Johnson',
          bio: 'Rock bassist',
          avatar_url: null,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
          bass_string_count: 4,
          bass_max_frets: 24,
        },
      ];

      // 1. Search for specific users
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: searchResults, error: null }),
      }));

      const searchResult = await service.searchProfiles('john');
      expect(searchResult).toHaveLength(2);
      expect(searchResult[0].displayName).toBe('John Doe');
      expect(searchResult[1].displayName).toBe('Jane Smith');

      // 2. Get all users with pagination
      mockSupabaseClient.from.mockImplementation((_table: string) => {
        const selectMock = vi.fn().mockReturnThis();
        const rangeMock = vi.fn().mockReturnThis();
        const orderMock = vi.fn().mockReturnThis();

        return {
          select: selectMock.mockImplementation(
            (fields: string, options?: any) => {
              if (options?.count === 'exact' && options?.head === true) {
                return Promise.resolve({ count: 3, error: null });
              }
              return {
                range: rangeMock,
                order: orderMock.mockResolvedValue({
                  data: allUsersResults,
                  error: null,
                }),
              };
            },
          ),
          range: rangeMock,
          order: orderMock,
        };
      });

      const allUsersResult = await service.findAllProfiles(10, 0);
      expect(allUsersResult.total).toBe(3);
      expect(allUsersResult.profiles).toHaveLength(3);
      expect(allUsersResult.profiles[0].displayName).toBe('John Doe');
      expect(allUsersResult.profiles[2].displayName).toBe('Mike Johnson');
    });
  });

  describe('Account Deletion Workflow', () => {
    it('should complete secure account deletion process', async () => {
      // Arrange
      const deleteBody = { password: 'user-password' };
      const mockProfile = { id: 'user-123' };

      // 1. Verify password
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        error: null,
      });

      // 2. Check profile exists before deletion
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // 3. Delete user account
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        error: null,
      });

      // Act - Execute deletion workflow through controller
      const controllerResult = await controller.deleteAccount(
        deleteBody,
        mockRequest,
      );

      // Assert
      expect(controllerResult.success).toBe(true);
      expect(controllerResult.message).toBe('Account deleted successfully');
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'user-password',
      });
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'user-123',
      );

      // Act - Execute deletion workflow through service
      await service.deleteProfile('user-123');

      // Assert - Service should also complete successfully
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledTimes(2);
    });

    it('should prevent deletion with incorrect password', async () => {
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
      expect(mockSupabaseClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('Error Propagation & Recovery', () => {
    it('should properly propagate service errors to controller', async () => {
      // Arrange
      const dbError = { message: 'Database connection timeout' };
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: dbError }),
      }));

      // Act & Assert - Test service error
      await expect(service.findProfileById('user-123')).rejects.toThrow(
        'Failed to fetch profile: Database connection timeout',
      );

      // Act & Assert - Test controller error handling
      const controllerResult = await controller.getProfile(mockRequest);
      expect(controllerResult.success).toBe(false);
      if (isApiErrorResponse(controllerResult)) {
        expect(controllerResult.error.code).toBe('PROFILE_FETCH_FAILED');
      }
    });

    it('should handle service exceptions in controller gracefully', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert - Service should throw NotFoundException
      await expect(service.findProfileById('non-existent')).rejects.toThrow(
        NotFoundException,
      );

      // Act - Controller should handle it gracefully
      const controllerResult = await controller.getProfile({
        user: { id: 'non-existent', email: 'test@example.com' },
      } as any);

      // Assert
      expect(controllerResult.success).toBe(false);
      if (isApiErrorResponse(controllerResult)) {
        expect(controllerResult.error.code).toBe('PROFILE_NOT_FOUND');
      }
    });

    it('should handle validation errors in bass configuration workflow', async () => {
      // Act & Assert - Test invalid string count
      await expect(
        service.updateBassConfiguration('user-123', {
          stringCount: 3 as any,
          maxFrets: 24,
        }),
      ).rejects.toThrow(BadRequestException);

      // Act & Assert - Test invalid max frets
      await expect(
        service.updateBassConfiguration('user-123', {
          stringCount: 4,
          maxFrets: 18,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle search validation errors', async () => {
      // Act & Assert - Test short search term
      await expect(service.searchProfiles('a')).rejects.toThrow(
        BadRequestException,
      );

      // Act & Assert - Test empty search term
      await expect(service.searchProfiles('')).rejects.toThrow(
        BadRequestException,
      );

      // Act & Assert - Test whitespace-only search term
      await expect(service.searchProfiles('   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Data Consistency & Validation', () => {
    it('should maintain data consistency across service calls', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Consistent User',
        bio: 'Same data everywhere',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 5,
        bass_max_frets: 22,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      const profileById = await service.findProfileById('user-123');
      const bassConfig = await service.getBassConfiguration('user-123');
      const userStats = await service.getUserStats('user-123');

      // Assert
      expect(profileById.id).toBe('user-123');
      expect(profileById.displayName).toBe('Consistent User');
      expect(bassConfig.stringCount).toBe(5);
      expect(bassConfig.maxFrets).toBe(22);
      expect(userStats.profileCompleteness).toBe(100); // All fields present
    });

    it('should handle edge cases in user statistics calculation', async () => {
      // Arrange
      const oldProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: null,
        bio: null,
        avatar_url: null,
        created_at: '2020-01-01T00:00:00Z', // Very old account
        updated_at: '2020-01-01T00:00:00Z',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: oldProfile, error: null }),
      }));

      // Act
      const stats = await service.getUserStats('user-123');

      // Assert
      expect(stats.profileCompleteness).toBe(0); // No optional fields filled
      expect(stats.accountAge).toBeGreaterThan(1000); // Old account
      expect(stats.lastActivity).toBe('2020-01-01T00:00:00Z');
    });

    it('should validate role updates correctly', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        role: 'admin',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act - Test valid roles
      await expect(
        service.updateUserRole('user-123', 'admin'),
      ).resolves.toBeDefined();
      await expect(
        service.updateUserRole('user-123', 'creator'),
      ).resolves.toBeDefined();
      await expect(
        service.updateUserRole('user-123', 'user'),
      ).resolves.toBeDefined();

      // Act & Assert - Test invalid role
      await expect(
        service.updateUserRole('user-123', 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large user datasets efficiently', async () => {
      // Arrange
      const largeUserSet = Array.from({ length: 500 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        display_name: `User ${i}`,
        bio: `Bio for user ${i}`,
        avatar_url: i % 2 === 0 ? `https://example.com/avatar${i}.jpg` : null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 4 + (i % 3),
        bass_max_frets: 20 + (i % 6),
      }));

      mockSupabaseClient.from.mockImplementation((_table: string) => {
        const selectMock = vi.fn().mockReturnThis();
        const rangeMock = vi.fn().mockReturnThis();
        const orderMock = vi.fn().mockReturnThis();

        return {
          select: selectMock.mockImplementation(
            (fields: string, options?: any) => {
              if (options?.count === 'exact' && options?.head === true) {
                return Promise.resolve({ count: 500, error: null });
              }
              return {
                range: rangeMock,
                order: orderMock.mockResolvedValue({
                  data: largeUserSet.slice(0, 100),
                  error: null,
                }),
              };
            },
          ),
          range: rangeMock,
          order: orderMock,
        };
      });

      const startTime = Date.now();

      // Act
      const result = await service.findAllProfiles(100, 0);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert
      expect(result.profiles).toHaveLength(100);
      expect(result.total).toBe(500);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent user operations efficiently', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act - Simulate concurrent requests
      const concurrentRequests = Array.from({ length: 20 }, () =>
        controller.getProfile(mockRequest),
      );
      const results = await Promise.all(concurrentRequests);

      // Assert
      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        if (isApiSuccessResponse(result)) {
          expect(result.data.id).toBe('user-123');
        }
      });
    });
  });

  describe('API Contract Compliance', () => {
    it('should return properly typed responses across all endpoints', async () => {
      // Arrange
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Contract Test User',
        bio: 'Testing API contracts',
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
      const profileResponse = await controller.getProfile(mockRequest);

      // Assert - Verify response structure matches contract
      expect(profileResponse).toHaveProperty('success');
      expect(profileResponse).toHaveProperty('message');
      expect(profileResponse).toHaveProperty('data');
      if (isApiSuccessResponse(profileResponse)) {
        expect(profileResponse.data).toHaveProperty('id');
        expect(profileResponse.data).toHaveProperty('email');
        expect(profileResponse.data).toHaveProperty('displayName');
        expect(profileResponse.data).toHaveProperty('preferences');
        expect(profileResponse.data.preferences).toHaveProperty(
          'bassConfiguration',
        );
        expect(
          profileResponse.data.preferences.bassConfiguration,
        ).toHaveProperty('stringCount');
        expect(
          profileResponse.data.preferences.bassConfiguration,
        ).toHaveProperty('maxFrets');
      }
    });
  });
});
