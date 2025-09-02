import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TutorialsService } from '../tutorials.service.js';
import { Tutorial as TutorialEntity } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { ResultUtils } from '../../shared/result.js';
import type { IResultTutorialRepository } from '../repositories/result-tutorial.repository.js';

describe('TutorialsService', () => {
  let service: TutorialsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;
  let mockRepository: IResultTutorialRepository;

  beforeEach(() => {
    // Create comprehensive mock for Supabase client
    mockSupabaseClient = {
      rpc: vi.fn(),
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        order: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
      })),
    };

    // Mock Supabase service
    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    // Mock repository
    mockRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      findByLevel: vi.fn(),
      findPublished: vi.fn(),
      search: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      existsBySlug: vi.fn(),
      findByIds: vi.fn(),
      findByAuthor: vi.fn(),
      saveMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    };

    // Create service instance
    service = new TutorialsService(mockSupabaseService, mockRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tutorials with exercise counts', async () => {
      // Arrange
      const mockTutorials = [
        TutorialEntity.reconstitute({
          id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
          title: 'Billie Jean',
          slug: TutorialSlug.create('billie-jean'),
          description: 'Learn Billie Jean bass line',
          youtubeId: 'abc123',
          duration: 300,
          authorName: 'Michael Jackson',
          level: 'beginner',
          tags: [],
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        }),
        TutorialEntity.reconstitute({
          id: TutorialId.create('222e4567-e89b-12d3-a456-426614174222'),
          title: 'Come As You Are',
          slug: TutorialSlug.create('come-as-you-are'),
          description: 'Learn Come As You Are bass line',
          youtubeId: 'xyz456',
          duration: 240,
          authorName: 'Nirvana',
          level: 'intermediate',
          tags: [],
          isActive: true,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        }),
      ];

      const mockExerciseCounts = [
        { id: '111e4567-e89b-12d3-a456-426614174111', exercise_count: 3 },
        { id: '222e4567-e89b-12d3-a456-426614174222', exercise_count: 2 },
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: mockTutorials,
          total: 2,
          page: 1,
          limit: 100,
          totalPages: 1,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockExerciseCounts,
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.tutorials).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.tutorials[0].exercise_count).toBe(3);
      expect(result.tutorials[1].exercise_count).toBe(2);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_tutorials_with_exercise_count',
      );
    });

    it('should handle empty tutorials list', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: [],
          total: 0,
          page: 1,
          limit: 100,
          totalPages: 0,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        tutorials: [],
        total: 0,
      });
    });

    it('should handle null data response', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: [],
          total: 0,
          page: 1,
          limit: 100,
          totalPages: 0,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        tutorials: [],
        total: 0,
      });
    });

    it('should throw error when RPC call fails', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow(
        'Failed to fetch tutorials: Database error',
      );
    });
  });

  describe('findBySlug', () => {
    it('should return tutorial by slug', async () => {
      // Arrange
      const mockTutorial = TutorialEntity.reconstitute({
        id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
        title: 'Test Tutorial',
        slug: TutorialSlug.create('test-tutorial'),
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(mockTutorial),
      );

      // Act
      const result = await service.findBySlug('test-tutorial');

      // Assert
      expect(result.id).toBe('111e4567-e89b-12d3-a456-426614174111');
      expect(result.title).toBe('Test Tutorial');
      expect(result.slug).toBe('test-tutorial');
      expect(mockRepository.findBySlug).toHaveBeenCalledWith(
        expect.any(TutorialSlug),
      );
    });

    it('should throw NotFoundException when tutorial not found', async () => {
      // Arrange
      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert
      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when database error occurs', async () => {
      // Arrange
      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      // Act & Assert
      await expect(service.findBySlug('test-slug')).rejects.toThrow(
        'Failed to find tutorial: Database error',
      );
    });

    it('should handle special characters in slug', async () => {
      // Arrange
      const mockTutorial = TutorialEntity.reconstitute({
        id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
        title: 'Special Tutorial',
        slug: TutorialSlug.create('special-tutorial-123'),
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(mockTutorial),
      );

      // Act
      const result = await service.findBySlug('special-tutorial-123');

      // Assert
      expect(result.slug).toBe('special-tutorial-123');
    });
  });

  describe('findById', () => {
    it('should return tutorial by id', async () => {
      // Arrange
      const mockTutorial = TutorialEntity.reconstitute({
        id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
        title: 'Test Tutorial',
        slug: TutorialSlug.create('test-tutorial'),
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockTutorial),
      );

      // Act
      const result = await service.findById(
        '111e4567-e89b-12d3-a456-426614174111',
      );

      // Assert
      expect(result.id).toBe('111e4567-e89b-12d3-a456-426614174111');
      expect(result.title).toBe('Test Tutorial');
      expect(mockRepository.findById).toHaveBeenCalledWith(
        expect.any(TutorialId),
      );
    });

    it('should throw NotFoundException when tutorial not found by id', async () => {
      // Arrange
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert
      await expect(
        service.findById('111e4567-e89b-12d3-a456-426614174111'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle UUID format ids', async () => {
      // Arrange
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';
      const mockTutorial = TutorialEntity.reconstitute({
        id: TutorialId.create(uuidId),
        title: 'UUID Tutorial',
        slug: TutorialSlug.create('uuid-tutorial'),
        description: 'Test description',
        youtubeId: 'test123',
        duration: 300,
        authorName: 'Test Author',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockTutorial),
      );

      // Act
      const result = await service.findById(uuidId);

      // Assert
      expect(result.id).toBe(uuidId);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle malformed slugs gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert
      await expect(service.findBySlug('!!!invalid!!!')).rejects.toThrow();
    });

    it('should handle very long slugs', async () => {
      // Arrange
      const longSlug = 'a'.repeat(100);

      // Act & Assert
      await expect(service.findBySlug(longSlug)).rejects.toThrow();
    });

    it('should handle SQL injection attempts in slug', async () => {
      // Arrange
      const maliciousSlug = "test'; DROP TABLE tutorials; --";

      // Act & Assert
      await expect(service.findBySlug(maliciousSlug)).rejects.toThrow();
    });
  });

  describe('Performance & Optimization', () => {
    it('should complete findAll operation within reasonable time', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: [],
          total: 0,
          page: 1,
          limit: 100,
          totalPages: 0,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const startTime = Date.now();

      // Act
      await service.findAll();
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle large tutorial datasets efficiently', async () => {
      // Arrange
      const largeTutorialSet = Array.from({ length: 500 }, (_, i) => {
        const paddedI = i.toString().padStart(8, '0');
        const uuid = `${paddedI}-e89b-12d3-a456-426614174000`;
        return TutorialEntity.reconstitute({
          id: TutorialId.create(uuid),
          title: `Tutorial ${i}`,
          slug: TutorialSlug.create(`tutorial-${i}`),
          description: `Description ${i}`,
          youtubeId: `vid${i}`,
          duration: 300 + i,
          authorName: `Author ${i}`,
          level: ['beginner', 'intermediate', 'advanced'][i % 3] as any,
          tags: [],
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        });
      });

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: largeTutorialSet.slice(0, 100),
          total: 500,
          page: 1,
          limit: 100,
          totalPages: 5,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.tutorials).toHaveLength(100);
      expect(result.total).toBe(500);
    });
  });

  describe('Data Validation', () => {
    it('should handle tutorials with missing optional fields', async () => {
      // Arrange
      const minimalTutorial = TutorialEntity.reconstitute({
        id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
        title: 'Minimal Tutorial',
        slug: TutorialSlug.create('minimal-tutorial'),
        description: 'Description',
        youtubeId: 'min123',
        duration: 180,
        authorName: 'Author',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(minimalTutorial),
      );

      // Act
      const result = await service.findById(
        '111e4567-e89b-12d3-a456-426614174111',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.thumbnail).toBeUndefined();
    });
  });
});
