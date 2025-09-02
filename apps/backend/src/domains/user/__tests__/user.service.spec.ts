import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user.service.js';
import { User } from '../entities/user.entity.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { Email } from '../value-objects/email.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';
import { ResultUtils } from '../../shared/result.js';
import type { IResultUserRepository } from '../repositories/result-user.repository.js';

describe('UserService', () => {
  let service: UserService;
  let mockDatabaseService: any;
  let mockSupabaseClient: any;
  let mockRepository: IResultUserRepository;

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

    // Mock repository
    mockRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      existsByEmail: vi.fn(),
      findAll: vi.fn(),
      saveMany: vi.fn(),
      deleteMany: vi.fn(),
      findByRole: vi.fn(),
      findByIds: vi.fn(),
      updateMany: vi.fn(),
      search: vi.fn(),
    };

    const mockRequestContextService = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };
    
    // Create service instance
    service = new UserService(mockDatabaseService, mockRepository, mockRequestContextService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findProfileById', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    const mockUser = User.reconstitute(
      UserId.create(mockUserId),
      Email.create('test@example.com'),
      UserRole.create('user'),
      'Test User',
      'https://example.com/avatar.jpg',
      new Date('2024-01-01'),
    );

    const mockProfile = {
      id: mockUserId,
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
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      }));
    });

    it('should return user profile by id', async () => {
      // Act
      const result = await service.findProfileById(mockUserId);

      // Assert
      expect(result).toEqual({
        id: mockUserId,
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
      expect(mockRepository.findById).toHaveBeenCalledWith(expect.any(UserId));
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
    });

    it('should throw NotFoundException when profile not found', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert
      await expect(service.findProfileById(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      // Act & Assert
      await expect(service.findProfileById('invalid-id')).rejects.toThrow(
        BadRequestException,
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
        single: vi.fn().mockResolvedValue({
          data: profileWithoutBassConfig,
          error: null,
        }),
      }));

      // Act
      const result = await service.findProfileById(mockUserId);

      // Assert
      expect(result.preferences.bassConfiguration).toEqual({
        stringCount: 4,
        maxFrets: 24,
      });
    });

    it('should return minimal profile when profiles table has no data', async () => {
      // Arrange - Create a proper mock user with all required properties
      const mockUserForMinimal = User.reconstitute(
        UserId.create(mockUserId),
        Email.create('test@example.com'),
        UserRole.create('user'),
        'Test User',
        'https://example.com/avatar.jpg',
        new Date('2024-01-01'),
      );

      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUserForMinimal),
      );
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      // Act
      const result = await service.findProfileById(mockUserId);

      // Assert
      expect(result).toMatchObject({
        id: mockUserId,
        email: 'test@example.com',
        displayName: 'Test User',
        bio: '',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });
  });

  describe('deleteProfile', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    const mockUser = User.reconstitute(
      UserId.create(mockUserId),
      Email.create('test@example.com'),
      UserRole.create('user'),
      'Test User',
      undefined,
      undefined,
    );

    it('should successfully delete user profile', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(true));
      vi.mocked(mockRepository.delete).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      mockSupabaseClient.auth.admin.deleteUser.mockResolvedValue({
        data: {},
        error: null,
      });

      // Act
      await service.deleteProfile(mockUserId);

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledWith(expect.any(UserId));
      expect(mockSupabaseClient.auth.admin.deleteUser).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should throw NotFoundException when profile not found before deletion', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(null),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));

      // Act & Assert
      await expect(service.deleteProfile(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error when user deletion fails', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(true));
      vi.mocked(mockRepository.delete).mockResolvedValue(
        ResultUtils.fail(new Error('Delete failed')),
      );

      // Act & Assert
      await expect(service.deleteProfile(mockUserId)).rejects.toThrow(
        'Failed to delete user',
      );
    });
  });

  describe('updateUserRole', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
    const mockUser = User.reconstitute(
      UserId.create(mockUserId),
      Email.create('test@example.com'),
      UserRole.create('user'),
      'Test User',
      undefined,
      undefined,
    );

    it('should successfully update user role to admin', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(true));
      vi.mocked(mockRepository.update).mockResolvedValue(
        ResultUtils.ok(undefined),
      );

      // Act
      await service.updateUserRole(mockUserId, 'admin');

      // Assert
      expect(mockUser.role).toBe('admin');
      expect(mockRepository.update).toHaveBeenCalledWith(mockUser);
    });

    it('should successfully update user role to moderator', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(true));
      vi.mocked(mockRepository.update).mockResolvedValue(
        ResultUtils.ok(undefined),
      );

      // Act
      await service.updateUserRole(mockUserId, 'moderator');

      // Assert
      expect(mockUser.role).toBe('moderator');
      expect(mockRepository.update).toHaveBeenCalledWith(mockUser);
    });

    it('should throw BadRequestException for invalid role', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(true));

      // Act & Assert
      await expect(
        service.updateUserRole(mockUserId, 'invalid-role' as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when profile not found during role update', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert
      await expect(service.updateUserRole(mockUserId, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Performance & Optimization', () => {
    it('should complete profile operations within reasonable time', async () => {
      // Arrange
      const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUser = User.reconstitute(
        UserId.create(mockUserId),
        Email.create('test@example.com'),
        UserRole.create('user'),
        'Test User',
        undefined,
        undefined,
      );

      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockUser),
      );
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockUserId },
          error: null,
        }),
      }));

      const startTime = Date.now();

      // Act
      await service.findProfileById(mockUserId);
      const endTime = Date.now();

      // Assert - Should complete within 100ms (generous for unit test)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
