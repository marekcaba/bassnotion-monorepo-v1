import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TutorialsController } from '../tutorials.controller.js';
import type {
  TutorialsResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

describe('TutorialsController', () => {
  let controller: TutorialsController;
  let mockTutorialsService: any;

  beforeEach(() => {
    // Create mock service with all required methods
    mockTutorialsService = {
      findAll: vi.fn(),
      findBySlug: vi.fn(),
      findExercisesByTutorialSlug: vi.fn(),
      findById: vi.fn(),
      fixExerciseLinks: vi.fn(),
    };

    // Direct instantiation - following the working pattern from app.controller.spec.ts
    controller = new TutorialsController(mockTutorialsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tutorials with exercise counts', async () => {
      // Arrange
      const mockResponse: TutorialsResponse = {
        tutorials: [
          {
            id: '1',
            slug: 'billie-jean',
            title: 'Billie Jean',
            artist: 'Michael Jackson',
            difficulty: 'beginner',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            exercise_count: 3,
          },
        ],
        total: 1,
      };
      mockTutorialsService.findAll.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockTutorialsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty tutorials list', async () => {
      // Arrange
      const mockResponse: TutorialsResponse = {
        tutorials: [],
        total: 0,
      };
      mockTutorialsService.findAll.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.tutorials).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findBySlug', () => {
    it('should return tutorial by slug', async () => {
      // Arrange
      const mockTutorial = {
        id: '1',
        slug: 'billie-jean',
        title: 'Billie Jean',
        artist: 'Michael Jackson',
        difficulty: 'beginner' as const,
        description: 'Learn the iconic bassline',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockTutorialsService.findBySlug.mockResolvedValue(mockTutorial);

      // Act
      const result = await controller.findBySlug('billie-jean');

      // Assert
      expect(result).toEqual({ tutorial: mockTutorial });
      expect(mockTutorialsService.findBySlug).toHaveBeenCalledWith(
        'billie-jean',
      );
    });

    it('should throw NotFoundException for non-existent tutorial', async () => {
      // Arrange
      mockTutorialsService.findBySlug.mockRejectedValue(
        new NotFoundException('Tutorial with slug "non-existent" not found'),
      );

      // Act & Assert
      await expect(controller.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTutorialsService.findBySlug).toHaveBeenCalledWith(
        'non-existent',
      );
    });
  });

  describe('findExercisesBySlug', () => {
    it('should return tutorial with its exercises', async () => {
      // Arrange
      const mockResponse: TutorialExercisesResponse = {
        tutorial: {
          id: '1',
          slug: 'billie-jean',
          title: 'Billie Jean',
          artist: 'Michael Jackson',
          difficulty: 'beginner',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'Basic Groove Pattern',
            difficulty: 'beginner',
            duration: 120000,
            bpm: 117,
            key: 'F#',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'ex2',
            title: 'Advanced Variations',
            difficulty: 'intermediate',
            duration: 180000,
            bpm: 117,
            key: 'F#',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ] as any[],
      };
      mockTutorialsService.findExercisesByTutorialSlug.mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await controller.findExercisesBySlug('billie-jean');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.exercises).toHaveLength(2);
      expect(
        mockTutorialsService.findExercisesByTutorialSlug,
      ).toHaveBeenCalledWith('billie-jean');
    });

    it('should return tutorial with empty exercises array', async () => {
      // Arrange
      const mockResponse: TutorialExercisesResponse = {
        tutorial: {
          id: '1',
          slug: 'new-tutorial',
          title: 'New Tutorial',
          artist: 'Artist',
          difficulty: 'beginner',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        exercises: [],
      };
      mockTutorialsService.findExercisesByTutorialSlug.mockResolvedValue(
        mockResponse,
      );

      // Act
      const result = await controller.findExercisesBySlug('new-tutorial');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.exercises).toHaveLength(0);
    });

    it('should throw NotFoundException for non-existent tutorial', async () => {
      // Arrange
      mockTutorialsService.findExercisesByTutorialSlug.mockRejectedValue(
        new NotFoundException('Tutorial with slug "non-existent" not found'),
      );

      // Act & Assert
      await expect(
        controller.findExercisesBySlug('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('API Contracts', () => {
    it('should match expected response structure for tutorials list', async () => {
      // Arrange
      const mockResponse: TutorialsResponse = {
        tutorials: [
          {
            id: expect.any(String),
            slug: expect.any(String),
            title: expect.any(String),
            artist: expect.any(String),
            difficulty: expect.stringMatching(
              /^(beginner|intermediate|advanced)$/,
            ),
            is_active: expect.any(Boolean),
            created_at: expect.any(String),
            updated_at: expect.any(String),
            exercise_count: expect.any(Number),
          },
        ],
        total: expect.any(Number),
      };
      mockTutorialsService.findAll.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toMatchObject({
        tutorials: expect.any(Array),
        total: expect.any(Number),
      });
    });

    it('should match expected response structure for single tutorial', async () => {
      // Arrange
      const mockTutorial = {
        id: '1',
        slug: 'test-tutorial',
        title: 'Test Tutorial',
        artist: 'Test Artist',
        difficulty: 'beginner' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockTutorialsService.findBySlug.mockResolvedValue(mockTutorial);

      // Act
      const result = await controller.findBySlug('test-tutorial');

      // Assert
      expect(result).toMatchObject({
        tutorial: {
          id: expect.any(String),
          slug: expect.any(String),
          title: expect.any(String),
          artist: expect.any(String),
          difficulty: expect.stringMatching(
            /^(beginner|intermediate|advanced)$/,
          ),
          is_active: expect.any(Boolean),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      });
    });
  });
});
