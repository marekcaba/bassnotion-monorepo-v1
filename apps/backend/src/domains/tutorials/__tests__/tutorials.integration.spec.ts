import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TutorialsController } from '../tutorials.controller.js';
import { TutorialsService } from '../tutorials.service.js';
import type {
  Tutorial,
  TutorialSummary,
  TutorialsResponse,
  TutorialResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

describe('Tutorials Integration Tests', () => {
  let controller: TutorialsController;
  let service: TutorialsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create comprehensive Supabase client mock
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

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    // Create service and controller instances directly (simplified approach)
    service = new TutorialsService(mockSupabaseService);
    controller = new TutorialsController(service);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Tutorial Workflow', () => {
    const mockTutorialSummaries: TutorialSummary[] = [
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

    const mockTutorial: Tutorial = {
      id: '1',
      slug: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'beginner',
      description:
        'Learn the iconic bassline from Billie Jean by Michael Jackson',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockExercises = [
      {
        id: 'ex1',
        title: 'Basic Groove Pattern',
        description: 'Learn the fundamental groove',
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
        title: 'Rhythm Variations',
        description: 'Add rhythm variations to the groove',
        difficulty: 'beginner',
        duration: 150000,
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
        id: 'ex3',
        title: 'Advanced Techniques',
        description: 'Master advanced playing techniques',
        difficulty: 'intermediate',
        duration: 200000,
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

    it('should complete full tutorial discovery workflow', async () => {
      // Arrange - Set up all mocks for the complete workflow

      // 1. Mock findAll response
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTutorialSummaries,
        error: null,
      });

      // 2. Mock findBySlug response
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockTutorial, error: null }),
          };
        }
        if (table === 'exercises') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi
              .fn()
              .mockResolvedValue({ data: mockExercises, error: null }),
          };
        }
        return {};
      });

      // Act & Assert - Execute complete workflow

      // Step 1: Get all tutorials
      const allTutorialsResponse: TutorialsResponse =
        await controller.findAll();
      expect(allTutorialsResponse).toEqual({
        tutorials: mockTutorialSummaries,
        total: 2,
      });
      expect(allTutorialsResponse.tutorials).toHaveLength(2);

      // Step 2: Select a specific tutorial
      const tutorialResponse: TutorialResponse =
        await controller.findBySlug('billie-jean');
      expect(tutorialResponse).toEqual({ tutorial: mockTutorial });
      expect(tutorialResponse.tutorial.title).toBe('Billie Jean');

      // Step 3: Get tutorial with exercises
      const tutorialWithExercises: TutorialExercisesResponse =
        await controller.findExercisesBySlug('billie-jean');

      expect(tutorialWithExercises.tutorial).toEqual(mockTutorial);
      expect(tutorialWithExercises.exercises).toHaveLength(3);
      expect(tutorialWithExercises.exercises[0].title).toBe(
        'Basic Groove Pattern',
      );
      expect(tutorialWithExercises.exercises[2].difficulty).toBe(
        'intermediate',
      );

      // Verify all service methods were called
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_tutorials_with_exercise_count',
      );
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
    });

    it('should handle tutorial not found in workflow', async () => {
      // Arrange
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTutorialSummaries,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act - Try to access non-existent tutorial
      const allTutorials = await controller.findAll();
      expect(allTutorials.tutorials).toHaveLength(2);

      // Assert - Should throw when trying to get specific tutorial
      await expect(controller.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty exercises for tutorial', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockTutorial, error: null }),
          };
        }
        if (table === 'exercises') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      });

      // Act
      const result = await controller.findExercisesBySlug('billie-jean');

      // Assert
      expect(result.tutorial).toEqual(mockTutorial);
      expect(result.exercises).toHaveLength(0);
    });
  });

  describe('Error Propagation & Recovery', () => {
    it('should properly propagate database errors from service to controller', async () => {
      // Arrange
      const dbError = { message: 'Database connection timeout' };
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: dbError,
      });

      // Act & Assert
      await expect(controller.findAll()).rejects.toThrow(
        'Failed to fetch tutorials: Database connection timeout',
      );
    });

    it('should handle service exceptions in controller', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      await expect(controller.findBySlug('not-found')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Performance & Data Handling', () => {
    it('should handle large tutorial datasets efficiently', async () => {
      // Arrange
      const largeTutorialSet = Array.from({ length: 100 }, (_, i) => ({
        id: `tutorial-${i}`,
        slug: `tutorial-${i}`,
        title: `Tutorial ${i}`,
        artist: `Artist ${i}`,
        difficulty:
          i % 3 === 0 ? 'beginner' : i % 3 === 1 ? 'intermediate' : 'advanced',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        exercise_count: i % 10,
      }));

      mockSupabaseClient.rpc.mockResolvedValue({
        data: largeTutorialSet,
        error: null,
      });

      const startTime = Date.now();

      // Act
      const result = await controller.findAll();

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert
      expect(result.tutorials).toHaveLength(100);
      expect(result.total).toBe(100);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain data consistency between calls', async () => {
      // Arrange
      const mockTutorial: Tutorial = {
        id: '1',
        slug: 'consistency-test',
        title: 'Consistency Test Tutorial',
        artist: 'Test Artist',
        difficulty: 'beginner',
        description: 'Test description',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTutorial, error: null }),
      }));

      // Act
      const tutorialBySlug = await service.findBySlug('consistency-test');
      const tutorialById = await service.findById('1');

      // Assert
      expect(tutorialBySlug.id).toBe(tutorialById.id);
      expect(tutorialBySlug.title).toBe(tutorialById.title);
    });
  });

  describe('API Contract Compliance', () => {
    it('should return properly typed responses', async () => {
      // Arrange
      const mockTutorialSummary: TutorialSummary = {
        id: '1',
        slug: 'api-test',
        title: 'API Test Tutorial',
        artist: 'Test Artist',
        difficulty: 'beginner',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        exercise_count: 1,
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [mockTutorialSummary],
        error: null,
      });

      // Act
      const response: TutorialsResponse = await controller.findAll();

      // Assert - Verify response structure matches contract
      expect(response).toHaveProperty('tutorials');
      expect(response).toHaveProperty('total');
      expect(response.tutorials[0]).toHaveProperty('id');
      expect(response.tutorials[0]).toHaveProperty('slug');
      expect(response.tutorials[0]).toHaveProperty('title');
      expect(response.tutorials[0]).toHaveProperty('artist');
      expect(response.tutorials[0]).toHaveProperty('difficulty');
      expect(response.tutorials[0]).toHaveProperty('exercise_count');
      expect(response.tutorials[0].difficulty).toMatch(
        /^(beginner|intermediate|advanced)$/,
      );
    });

    it('should handle backwards compatibility', async () => {
      // Arrange
      const legacyTutorial = {
        id: '1',
        slug: 'legacy-tutorial',
        title: 'Legacy Tutorial',
        artist: 'Legacy Artist',
        difficulty: 'beginner',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        // Missing newer optional fields
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: legacyTutorial, error: null }),
      }));

      // Act
      const response: TutorialResponse =
        await controller.findBySlug('legacy-tutorial');

      // Assert
      expect(response.tutorial).toEqual(legacyTutorial);
      expect(response.tutorial.id).toBe('1');
      expect(response.tutorial.slug).toBe('legacy-tutorial');
    });
  });
});
