import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user.service.js';

import type { UserProfileData, BassConfiguration } from '@bassnotion/contracts';

describe('UserService', () => {
  let service: UserService;
  let mockDatabaseService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create comprehensive mock for Supabase client
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

    // Mock Database service
    mockDatabaseService = {
      supabase: mockSupabaseClient,
    };

    // Create service instance
    service = new UserService(mockDatabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findProfileById', () => {
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

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));
    });

    it('should return user profile by id', async () => {
      // Act
      const result = await service.findProfileById('user-123');

      // Assert
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        bio: 'Test bio',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        preferences: {
          theme: 'light',
          emailNotifications: true,
          defaultMetronomeSettings: {
            enabled: false,
            tempo: 120,
            beatsPerMeasure: 4,
            subdivision: 1,
            accentFirstBeat: true,
            volume: 75,
          },
          bassConfiguration: {
            stringCount: 4,
            maxFrets: 24,
          },
        },
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findProfileById('non-existent')).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });

    it('should throw error when database error occurs', async () => {
      // Arrange
      const mockError = { message: 'Database connection failed' };
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act & Assert
      await expect(service.findProfileById('user-123')).rejects.toThrow(
        'Failed to fetch profile: Database connection failed',
      );
    });

    it('should handle profile with default bass configuration', async () => {
      // Arrange
      const profileWithoutBassConfig = {
        ...mockProfile,
        bass_string_count: null,
        bass_max_frets: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: profileWithoutBassConfig, error: null }),
      }));

      // Act
      const result = await service.findProfileById('user-123');

      // Assert
      expect(result.preferences.bassConfiguration).toEqual({
        stringCount: 4,
        maxFrets: 24,
      });
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

    it('should successfully update user profile', async () => {
      // Act
      const result = await service.updateProfile('user-123', mockProfileData);

      // Assert
      expect(result.displayName).toBe('Updated User');
      expect(result.bio).toBe('Updated bio');
      expect(result.avatarUrl).toBe('https://example.com/new-avatar.jpg');
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

    it('should update profile even if auth metadata update fails', async () => {
      // Arrange
      mockSupabaseClient.auth.admin.updateUserById.mockResolvedValue({
        error: { message: 'Auth update failed' },
      });

      // Act
      const result = await service.updateProfile('user-123', mockProfileData);

      // Assert
      expect(result.displayName).toBe('Updated User');
    });

    it('should throw error when profile update fails', async () => {
      // Arrange
      const mockError = { message: 'Update failed' };
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act & Assert
      await expect(
        service.updateProfile('user-123', mockProfileData),
      ).rejects.toThrow('Failed to update profile: Update failed');
    });

    it('should throw NotFoundException when profile not found during update', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(
        service.updateProfile('non-existent', mockProfileData),
      ).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });
  });

  describe('updateBassConfiguration', () => {
    const validBassConfig: BassConfiguration = {
      stringCount: 5,
      maxFrets: 22,
    };

    const mockUpdatedProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T01:00:00Z',
      bass_string_count: 5,
      bass_max_frets: 22,
    };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUpdatedProfile, error: null }),
      }));
    });

    it('should successfully update bass configuration', async () => {
      // Act
      const result = await service.updateBassConfiguration(
        'user-123',
        validBassConfig,
      );

      // Assert
      expect(result.preferences.bassConfiguration).toEqual({
        stringCount: 5,
        maxFrets: 22,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should throw BadRequestException for invalid string count', async () => {
      // Arrange
      const invalidConfig = { stringCount: 3 as any, maxFrets: 24 };

      // Act & Assert
      await expect(
        service.updateBassConfiguration('user-123', invalidConfig),
      ).rejects.toThrow(
        new BadRequestException('String count must be between 4 and 6'),
      );
    });

    it('should throw BadRequestException for invalid max frets', async () => {
      // Arrange
      const invalidConfig = { stringCount: 4 as const, maxFrets: 18 };

      // Act & Assert
      await expect(
        service.updateBassConfiguration('user-123', invalidConfig),
      ).rejects.toThrow(
        new BadRequestException('Max frets must be between 19 and 25'),
      );
    });

    it('should handle edge cases for valid configurations', async () => {
      // Test minimum valid values
      const minConfig = { stringCount: 4 as const, maxFrets: 19 };
      await expect(
        service.updateBassConfiguration('user-123', minConfig),
      ).resolves.toBeDefined();

      // Test maximum valid values
      const maxConfig = { stringCount: 6 as const, maxFrets: 25 };
      await expect(
        service.updateBassConfiguration('user-123', maxConfig),
      ).resolves.toBeDefined();
    });
  });

  describe('getBassConfiguration', () => {
    const mockProfile = {
      bass_string_count: 5,
      bass_max_frets: 22,
    };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));
    });

    it('should return bass configuration', async () => {
      // Act
      const result = await service.getBassConfiguration('user-123');

      // Assert
      expect(result).toEqual({
        stringCount: 5,
        maxFrets: 22,
      });
    });

    it('should return default values when configuration is null', async () => {
      // Arrange
      const profileWithDefaults = {
        bass_string_count: null,
        bass_max_frets: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: profileWithDefaults, error: null }),
      }));

      // Act
      const result = await service.getBassConfiguration('user-123');

      // Assert
      expect(result).toEqual({
        stringCount: 4,
        maxFrets: 24,
      });
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(
        service.getBassConfiguration('non-existent'),
      ).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });
  });

  describe('deleteProfile', () => {
    const mockProfile = { id: 'user-123' };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        error: null,
      });
    });

    it('should successfully delete user profile', async () => {
      // Act
      await service.deleteProfile('user-123');

      // Assert
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should throw NotFoundException when profile not found before deletion', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.deleteProfile('non-existent')).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });

    it('should throw error when user deletion fails', async () => {
      // Arrange
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        error: { message: 'Deletion failed' },
      });

      // Act & Assert
      await expect(service.deleteProfile('user-123')).rejects.toThrow(
        'Failed to delete account: Deletion failed',
      );
    });
  });

  describe('findAllProfiles', () => {
    const mockProfiles = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        display_name: 'User One',
        bio: 'Bio 1',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 4,
        bass_max_frets: 24,
      },
      {
        id: 'user-2',
        email: 'user2@example.com',
        display_name: 'User Two',
        bio: 'Bio 2',
        avatar_url: 'https://example.com/avatar2.jpg',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        bass_string_count: 5,
        bass_max_frets: 22,
      },
    ];

    beforeEach(() => {
      // Mock count query
      mockSupabaseClient.from.mockImplementation((_table: string) => {
        const selectMock = vi.fn().mockReturnThis();
        const eqMock = vi.fn().mockReturnThis();
        const rangeMock = vi.fn().mockReturnThis();
        const orderMock = vi.fn().mockReturnThis();

        return {
          select: selectMock.mockImplementation(
            (fields: string, options?: any) => {
              if (options?.count === 'exact' && options?.head === true) {
                return Promise.resolve({ count: 2, error: null });
              }
              return {
                eq: eqMock,
                range: rangeMock,
                order: orderMock.mockResolvedValue({
                  data: mockProfiles,
                  error: null,
                }),
              };
            },
          ),
          eq: eqMock,
          range: rangeMock,
          order: orderMock,
        };
      });
    });

    it('should return paginated profiles with total count', async () => {
      // Act
      const result = await service.findAllProfiles(10, 0);

      // Assert
      expect(result.total).toBe(2);
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].displayName).toBe('User One');
      expect(result.profiles[1].displayName).toBe('User Two');
    });

    it('should handle custom pagination parameters', async () => {
      // Act
      await service.findAllProfiles(5, 10);

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle empty profiles list', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((fields: string, options?: any) => {
          if (options?.count === 'exact' && options?.head === true) {
            return Promise.resolve({ count: 0, error: null });
          }
          return {
            range: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      }));

      // Act
      const result = await service.findAllProfiles();

      // Assert
      expect(result.total).toBe(0);
      expect(result.profiles).toHaveLength(0);
    });
  });

  describe('searchProfiles', () => {
    const mockSearchResults = [
      {
        id: 'user-1',
        email: 'john@example.com',
        display_name: 'John Doe',
        bio: 'Bass player from NYC',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 4,
        bass_max_frets: 24,
      },
    ];

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi
          .fn()
          .mockResolvedValue({ data: mockSearchResults, error: null }),
      }));
    });

    it('should search profiles by search term', async () => {
      // Act
      const result = await service.searchProfiles('john');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('John Doe');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should throw BadRequestException for short search term', async () => {
      // Act & Assert
      await expect(service.searchProfiles('j')).rejects.toThrow(
        new BadRequestException(
          'Search term must be at least 2 characters long',
        ),
      );
    });

    it('should handle empty search term', async () => {
      // Act & Assert
      await expect(service.searchProfiles('')).rejects.toThrow(
        new BadRequestException(
          'Search term must be at least 2 characters long',
        ),
      );
    });

    it('should handle whitespace-only search term', async () => {
      // Act & Assert
      await expect(service.searchProfiles('   ')).rejects.toThrow(
        new BadRequestException(
          'Search term must be at least 2 characters long',
        ),
      );
    });

    it('should return empty array when no profiles match', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      // Act
      const result = await service.searchProfiles('nonexistent');

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('updateUserRole', () => {
    const mockUpdatedProfile = {
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

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: mockUpdatedProfile, error: null }),
      }));
    });

    it('should successfully update user role to admin', async () => {
      // Act
      const result = await service.updateUserRole('user-123', 'admin');

      // Assert
      expect(result.id).toBe('user-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should successfully update user role to creator', async () => {
      // Act
      await service.updateUserRole('user-123', 'creator');

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should throw BadRequestException for invalid role', async () => {
      // Act & Assert
      await expect(
        service.updateUserRole('user-123', 'invalid-role'),
      ).rejects.toThrow(
        new BadRequestException(
          'Invalid role: invalid-role. Must be one of: user, admin, creator',
        ),
      );
    });

    it('should throw NotFoundException when profile not found during role update', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(
        service.updateUserRole('non-existent', 'admin'),
      ).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });
  });

  describe('getUserStats', () => {
    const mockProfile = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
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

    it('should return user statistics with profile completeness', async () => {
      // Act
      const result = await service.getUserStats('user-123');

      // Assert
      expect(result.profileCompleteness).toBe(100); // All 3 fields present
      expect(result.accountAge).toBeGreaterThan(0);
      expect(result.lastActivity).toBe('2024-01-02T00:00:00Z');
    });

    it('should calculate partial profile completeness', async () => {
      // Arrange
      const incompleteProfile = {
        ...mockProfile,
        bio: null,
        avatar_url: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: incompleteProfile, error: null }),
      }));

      // Act
      const result = await service.getUserStats('user-123');

      // Assert
      expect(result.profileCompleteness).toBe(33); // Only display_name present (1/3)
    });

    it('should throw NotFoundException when profile not found for stats', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.getUserStats('non-existent')).rejects.toThrow(
        new NotFoundException('Profile not found for user: non-existent'),
      );
    });
  });

  describe('mapProfileToUserProfile', () => {
    it('should map database profile to UserProfile with default preferences', async () => {
      // This tests the private method indirectly through findProfileById
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
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
      const result = await service.findProfileById('user-123');

      // Assert
      expect(result.preferences.theme).toBe('light');
      expect(result.preferences.emailNotifications).toBe(true);
      expect(result.preferences.defaultMetronomeSettings.tempo).toBe(120);
      expect(result.preferences.bassConfiguration.stringCount).toBe(5);
      expect(result.preferences.bassConfiguration.maxFrets).toBe(22);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle SQL injection attempts in user id', async () => {
      // Arrange
      const maliciousId = "'; DROP TABLE profiles; --";
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findProfileById(maliciousId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should handle very long user ids', async () => {
      // Arrange
      const longId = 'a'.repeat(1000);
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findProfileById(longId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty string user id', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findProfileById('')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Performance & Optimization', () => {
    it('should complete profile operations within reasonable time', async () => {
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
        bass_string_count: 4,
        bass_max_frets: 24,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));

      // Act
      await service.findProfileById('user-123');
      const endTime = Date.now();

      // Assert - Should complete within 1 second (generous for unit test)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle large search results efficiently', async () => {
      // Arrange
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        display_name: `User ${i}`,
        bio: `Bio for user ${i}`,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        bass_string_count: 4,
        bass_max_frets: 24,
      }));

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: largeResultSet, error: null }),
      }));

      // Act
      const result = await service.searchProfiles('user');

      // Assert
      expect(result).toHaveLength(100);
    });
  });
});
