import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TutorialsService } from '../tutorials.service.js';
import type { Tutorial, TutorialSummary } from '@bassnotion/contracts';

describe('TutorialsService', () => {
  let service: TutorialsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

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

    // Create service instance
    service = new TutorialsService(mockSupabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tutorials with exercise counts', async () => {
      // Arrange
      const mockTutorials: TutorialSummary[] = [
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
        {
          id: '2',
          slug: 'come-as-you-are',
          title: 'Come As You Are',
          artist: 'Nirvana',
          difficulty: 'intermediate',
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          exercise_count: 2,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTutorials,
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        tutorials: mockTutorials,
        total: 2,
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_tutorials_with_exercise_count',
      );
    });

    it('should handle empty tutorials list', async () => {
      // Arrange
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
      const mockError = { message: 'Database connection failed' };
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: mockError,
      });

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow(
        'Failed to fetch tutorials: Database connection failed',
      );
    });
  });

  describe('findBySlug', () => {
    const mockTutorial: Tutorial = {
      id: '1',
      slug: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'beginner',
      description: 'Learn the iconic bassline from Billie Jean',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      // Reset the mock chain for each test
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTutorial, error: null }),
      }));
    });

    it('should return tutorial by slug', async () => {
      // Act
      const result = await service.findBySlug('billie-jean');

      // Assert
      expect(result).toEqual(mockTutorial);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });

    it('should throw NotFoundException when tutorial not found', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        new NotFoundException('Tutorial with slug "non-existent" not found'),
      );
    });

    it('should throw NotFoundException when database error occurs', async () => {
      // Arrange
      const mockError = { message: 'Row not found' };
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act & Assert
      await expect(service.findBySlug('billie-jean')).rejects.toThrow(
        new NotFoundException('Tutorial with slug "billie-jean" not found'),
      );
    });

    it('should handle special characters in slug', async () => {
      // Arrange
      const specialSlug = 'come-as-you-are-nirvana-90s';

      // Act
      await service.findBySlug(specialSlug);

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });
  });

  describe('findById', () => {
    const mockTutorial: Tutorial = {
      id: '1',
      slug: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'beginner',
      description: 'Learn the iconic bassline from Billie Jean',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTutorial, error: null }),
      }));
    });

    it('should return tutorial by id', async () => {
      // Act
      const result = await service.findById('1');

      // Assert
      expect(result).toEqual(mockTutorial);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });

    it('should throw NotFoundException when tutorial not found by id', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findById('999')).rejects.toThrow(
        new NotFoundException('Tutorial with id "999" not found'),
      );
    });

    it('should handle UUID format ids', async () => {
      // Arrange
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';

      // Act
      await service.findById(uuidId);

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });
  });

  describe('findExercisesByTutorialSlug', () => {
    const mockTutorial: Tutorial = {
      id: '1',
      slug: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'beginner',
      description: 'Learn the iconic bassline from Billie Jean',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockExercises = [
      {
        id: 'ex1',
        title: 'Basic Groove Pattern',
        description: 'Learn the main groove',
        difficulty: 'beginner',
        duration: 120000,
        bpm: 117,
        key: 'F#',
        tutorial_id: '1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
        chord_progression: 'F# D#m G#m C#',
        notes: [],
      },
      {
        id: 'ex2',
        title: 'Advanced Variations',
        description: 'Add variations to the groove',
        difficulty: 'intermediate',
        duration: 180000,
        bpm: 117,
        key: 'F#',
        tutorial_id: '1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
        chord_progression: 'F# D#m G#m C#',
        notes: [],
      },
    ];

    beforeEach(() => {
      // Mock findBySlug to return tutorial
      vi.spyOn(service, 'findBySlug').mockResolvedValue(mockTutorial);

      // Mock exercises query
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockExercises, error: null }),
      }));
    });

    it('should return tutorial with its exercises', async () => {
      // Act
      const result = await service.findExercisesByTutorialSlug('billie-jean');

      // Assert
      expect(result).toEqual({
        tutorial: mockTutorial,
        exercises: mockExercises,
      });
      expect(service.findBySlug).toHaveBeenCalledWith('billie-jean');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
    });

    it('should return tutorial with empty exercises array', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      // Act
      const result = await service.findExercisesByTutorialSlug('billie-jean');

      // Assert
      expect(result).toEqual({
        tutorial: mockTutorial,
        exercises: [],
      });
    });

    it('should handle null exercises data', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await service.findExercisesByTutorialSlug('billie-jean');

      // Assert
      expect(result.exercises).toEqual([]);
    });

    it('should throw error when exercises query fails', async () => {
      // Arrange
      const mockError = { message: 'Failed to fetch exercises' };
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act & Assert
      await expect(
        service.findExercisesByTutorialSlug('billie-jean'),
      ).rejects.toThrow('Failed to fetch exercises: Failed to fetch exercises');
    });

    it('should propagate NotFoundException from findBySlug', async () => {
      // Arrange
      vi.spyOn(service, 'findBySlug').mockRejectedValue(
        new NotFoundException('Tutorial with slug "non-existent" not found'),
      );

      // Act & Assert
      await expect(
        service.findExercisesByTutorialSlug('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query exercises with correct parameters', async () => {
      // Act
      await service.findExercisesByTutorialSlug('billie-jean');

      // Assert
      expect(service.findBySlug).toHaveBeenCalledWith('billie-jean');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
    });
  });

  describe('fixExerciseLinks', () => {
    const mockTutorial = {
      id: 'tutorial-1',
      slug: 'billie-jean',
      title: 'Billie Jean',
    };

    const mockExercise = {
      id: 'exercise-1',
      title: 'Blues Scale Mastery',
      tutorial_id: 'tutorial-1',
    };

    beforeEach(() => {
      // Mock findBySlug
      vi.spyOn(service, 'findBySlug').mockResolvedValue(mockTutorial as any);

      // Mock update query
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi
          .fn()
          .mockResolvedValue({ data: [mockExercise], error: null }),
      }));
    });

    it('should successfully update exercise-tutorial relationships', async () => {
      // Act
      const result = await service.fixExerciseLinks();

      // Assert
      expect(result.message).toBe('Exercise-tutorial relationships updated');
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        exercise: 'Blues Scale Mastery',
        success: true,
        updated: [mockExercise],
      });
      expect(service.findBySlug).toHaveBeenCalledWith('billie-jean');
    });

    it('should handle exercise update errors', async () => {
      // Arrange
      const mockError = { message: 'Update failed' };
      mockSupabaseClient.from.mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      }));

      // Act
      const result = await service.fixExerciseLinks();

      // Assert
      expect(result.results[0]).toEqual({
        exercise: 'Blues Scale Mastery',
        error: 'Update failed',
      });
    });

    it('should handle tutorial not found error', async () => {
      // Arrange
      vi.spyOn(service, 'findBySlug').mockRejectedValue(
        new NotFoundException('Tutorial not found'),
      );

      // Act & Assert
      await expect(service.fixExerciseLinks()).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should handle malformed slugs gracefully', async () => {
      // Arrange
      const malformedSlug = ''; // Empty string
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findBySlug(malformedSlug)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle very long slugs', async () => {
      // Arrange
      const longSlug = 'a'.repeat(1000);
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(service.findBySlug(longSlug)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle SQL injection attempts in slug', async () => {
      // Arrange
      const maliciousSlug = "'; DROP TABLE tutorials; --";
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      await expect(service.findBySlug(maliciousSlug)).rejects.toThrow(
        NotFoundException,
      );

      // Assert - The query should still execute safely (parameterized)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });
  });

  describe('Performance & Optimization', () => {
    it('should complete findAll operation within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      // Act
      await service.findAll();
      const endTime = Date.now();

      // Assert - Should complete within 1 second (generous for unit test)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle large tutorial datasets efficiently', async () => {
      // Arrange - Create large mock dataset
      const largeTutorialSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `tutorial-${i}`,
        slug: `tutorial-slug-${i}`,
        title: `Tutorial ${i}`,
        artist: `Artist ${i}`,
        difficulty: 'beginner' as const,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        exercise_count: i % 10,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({
        data: largeTutorialSet,
        error: null,
      });

      // Act
      const result = await service.findAll();

      // Assert
      expect(result.tutorials).toHaveLength(1000);
      expect(result.total).toBe(1000);
    });
  });

  describe('Data Validation', () => {
    it('should handle tutorials with missing optional fields', async () => {
      // Arrange
      const incompleteTutorial = {
        id: '1',
        slug: 'test-tutorial',
        title: 'Test Tutorial',
        artist: 'Test Artist',
        difficulty: 'beginner',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        // Missing description
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: incompleteTutorial,
          error: null,
        }),
      }));

      // Act
      const result = await service.findBySlug('test-tutorial');

      // Assert
      expect(result).toEqual(incompleteTutorial);
    });

    it('should handle exercises with all optional fields present', async () => {
      // Arrange
      const mockTutorial = { id: '1', slug: 'test' };
      vi.spyOn(service, 'findBySlug').mockResolvedValue(mockTutorial as any);

      const completeExercise = {
        id: 'ex1',
        title: 'Complete Exercise',
        description: 'Full description',
        difficulty: 'beginner',
        duration: 120000,
        bpm: 120,
        key: 'C',
        tutorial_id: '1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
        chord_progression: 'C F G C',
        notes: [{ note: 'C', duration: 'quarter' }],
        tags: ['beginner', 'groove'],
        video_url: 'https://example.com/video',
        sheet_music_url: 'https://example.com/sheet',
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [completeExercise],
          error: null,
        }),
      }));

      // Act
      const result = await service.findExercisesByTutorialSlug('test');

      // Assert
      expect(result.exercises[0]).toEqual(completeExercise);
    });
  });
});
