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
import { Tutorial as TutorialEntity } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { ResultUtils } from '../../shared/result.js';
import type { IResultTutorialRepository } from '../repositories/result-tutorial.repository.js';

describe('Tutorials Integration Tests', () => {
  let controller: TutorialsController;
  let service: TutorialsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;
  let mockRepository: IResultTutorialRepository;

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

    // Create service and controller instances directly (simplified approach)
    service = new TutorialsService(mockSupabaseService, mockRepository);
    controller = new TutorialsController(service);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Tutorial Workflow', () => {
    const mockTutorialSummaries: TutorialSummary[] = [
      {
        id: '111e4567-e89b-12d3-a456-426614174111',
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
        id: '222e4567-e89b-12d3-a456-426614174222',
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
      id: '111e4567-e89b-12d3-a456-426614174111',
      slug: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'beginner',
      description:
        'Learn the iconic bassline from Billie Jean by Michael Jackson',
      youtube_url: 'abc123',
      duration: '300',
      concepts: ['funk', 'pop'],
      thumbnail: undefined,
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
        tutorial_id: '111e4567-e89b-12d3-a456-426614174111',
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
        tutorial_id: '111e4567-e89b-12d3-a456-426614174111',
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
        tutorial_id: '111e4567-e89b-12d3-a456-426614174111',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_active: true,
        chord_progression: 'F# D#m G#m C#',
        notes: [],
      },
    ];

    it('should complete full tutorial discovery workflow', async () => {
      // Arrange - Set up all mocks for the complete workflow

      // 1. Mock repository findAll response
      const mockTutorialEntities = mockTutorialSummaries.map((summary) =>
        TutorialEntity.reconstitute({
          id: TutorialId.create(summary.id),
          slug: TutorialSlug.create(summary.slug),
          title: summary.title,
          description: `Learn ${summary.title} bass line`,
          youtubeId: 'abc123',
          duration: 300,
          authorName: summary.artist,
          level: summary.difficulty as 'beginner' | 'intermediate' | 'advanced',
          tags: [],
          isActive: summary.is_active,
          createdAt: new Date(summary.created_at),
          updatedAt: new Date(summary.updated_at),
        }),
      );

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: mockTutorialEntities,
          total: 2,
          page: 1,
          limit: 100,
          totalPages: 1,
        }),
      );

      // 2. Mock Supabase RPC for exercise counts
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTutorialSummaries.map((t) => ({
          id: t.id,
          exercise_count: t.exercise_count,
        })),
        error: null,
      });

      // 3. Mock repository findBySlug response
      const mockTutorialEntity = TutorialEntity.reconstitute({
        id: TutorialId.create(mockTutorial.id),
        slug: TutorialSlug.create(mockTutorial.slug),
        title: mockTutorial.title,
        description: mockTutorial.description || '',
        youtubeId: mockTutorial.youtube_url || '',
        duration: parseInt(mockTutorial.duration || '300'),
        authorName: mockTutorial.artist,
        level: mockTutorial.difficulty as
          | 'beginner'
          | 'intermediate'
          | 'advanced',
        tags: mockTutorial.concepts || [],
        isActive: mockTutorial.is_active,
        thumbnailUrl: mockTutorial.thumbnail,
        publishedAt: undefined,
        createdAt: new Date(mockTutorial.created_at),
        updatedAt: new Date(mockTutorial.updated_at),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(mockTutorialEntity),
      );

      // 4. Mock Supabase exercises response
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
      expect(allTutorialsResponse.total).toBe(2);
      expect(allTutorialsResponse.tutorials).toHaveLength(2);
      expect(allTutorialsResponse.tutorials[0].id).toBe(
        '111e4567-e89b-12d3-a456-426614174111',
      );
      expect(allTutorialsResponse.tutorials[0].title).toBe('Billie Jean');
      expect(allTutorialsResponse.tutorials[0].artist).toBe('Michael Jackson');
      expect(allTutorialsResponse.tutorials[0].difficulty).toBe('beginner');

      // Step 2: Select a specific tutorial
      const tutorialResponse: TutorialResponse =
        await controller.findBySlug('billie-jean');
      expect(tutorialResponse.tutorial.id).toBe(mockTutorial.id);
      expect(tutorialResponse.tutorial.slug).toBe(mockTutorial.slug);
      expect(tutorialResponse.tutorial.title).toBe('Billie Jean');
      expect(tutorialResponse.tutorial.artist).toBe('Michael Jackson');
      expect(tutorialResponse.tutorial.difficulty).toBe('beginner');

      // Step 3: Get tutorial with exercises
      const tutorialWithExercises: TutorialExercisesResponse =
        await controller.findExercisesBySlug('billie-jean');

      expect(tutorialWithExercises.tutorial.id).toBe(mockTutorial.id);
      expect(tutorialWithExercises.tutorial.title).toBe(mockTutorial.title);
      expect(tutorialWithExercises.tutorial.artist).toBe(mockTutorial.artist);
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
    });

    it('should handle tutorial not found in workflow', async () => {
      // Arrange
      const mockTutorialEntities = mockTutorialSummaries.map((summary) =>
        TutorialEntity.reconstitute({
          id: TutorialId.create(summary.id),
          slug: TutorialSlug.create(summary.slug),
          title: summary.title,
          description: `Learn ${summary.title} bass line`,
          youtubeId: 'abc123',
          duration: 300,
          authorName: summary.artist,
          level: summary.difficulty as 'beginner' | 'intermediate' | 'advanced',
          tags: [],
          isActive: summary.is_active,
          createdAt: new Date(summary.created_at),
          updatedAt: new Date(summary.updated_at),
        }),
      );

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: mockTutorialEntities,
          total: 2,
          page: 1,
          limit: 100,
          totalPages: 1,
        }),
      );

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(null),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTutorialSummaries.map((t) => ({
          id: t.id,
          exercise_count: t.exercise_count,
        })),
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
      const mockTutorialEntity = TutorialEntity.reconstitute({
        id: TutorialId.create(mockTutorial.id),
        slug: TutorialSlug.create(mockTutorial.slug),
        title: mockTutorial.title,
        description: mockTutorial.description || '',
        youtubeId: 'abc123',
        duration: 300,
        authorName: mockTutorial.artist,
        level: mockTutorial.difficulty as
          | 'beginner'
          | 'intermediate'
          | 'advanced',
        tags: [],
        isActive: mockTutorial.is_active,
        createdAt: new Date(mockTutorial.created_at),
        updatedAt: new Date(mockTutorial.updated_at),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(mockTutorialEntity),
      );

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
      expect(result.tutorial.id).toBe(mockTutorial.id);
      expect(result.tutorial.title).toBe(mockTutorial.title);
      expect(result.tutorial.artist).toBe(mockTutorial.artist);
      expect(result.tutorial.difficulty).toBe(mockTutorial.difficulty);
      expect(result.exercises).toHaveLength(0);
    });
  });

  describe('Error Propagation & Recovery', () => {
    it('should properly propagate database errors from service to controller', async () => {
      // Arrange
      const dbError = new Error('Database connection timeout');
      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.fail(dbError),
      );

      // Act & Assert
      await expect(controller.findAll()).rejects.toThrow(
        'Failed to fetch tutorials: Database connection timeout',
      );
    });

    it('should handle service exceptions in controller', async () => {
      // Arrange
      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(null),
      );

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
        id: `${(i + 1).toString().padStart(8, '0')}-e89b-12d3-a456-426614174${(i + 1).toString().padStart(3, '0')}`.substring(
          0,
          36,
        ),
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

      const largeTutorialEntities = largeTutorialSet.map((tutorial) =>
        TutorialEntity.reconstitute({
          id: TutorialId.create(tutorial.id),
          slug: TutorialSlug.create(tutorial.slug),
          title: tutorial.title,
          description: `Learn ${tutorial.title} bass line`,
          youtubeId: 'abc123',
          duration: 300,
          authorName: tutorial.artist,
          level: tutorial.difficulty as
            | 'beginner'
            | 'intermediate'
            | 'advanced',
          tags: [],
          isActive: tutorial.is_active,
          createdAt: new Date(tutorial.created_at),
          updatedAt: new Date(tutorial.updated_at),
        }),
      );

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: largeTutorialEntities,
          total: 100,
          page: 1,
          limit: 100,
          totalPages: 1,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: largeTutorialSet.map((t) => ({
          id: t.id,
          exercise_count: t.exercise_count,
        })),
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
      const tutorialId = '333e4567-e89b-12d3-a456-426614174333';
      const mockTutorial: Tutorial = {
        id: tutorialId,
        slug: 'consistency-test',
        title: 'Consistency Test Tutorial',
        artist: 'Test Artist',
        difficulty: 'beginner',
        description: 'Test description',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockTutorialEntity = TutorialEntity.reconstitute({
        id: TutorialId.create(tutorialId),
        slug: TutorialSlug.create('consistency-test'),
        title: 'Consistency Test Tutorial',
        description: 'Test description',
        youtubeId: 'abc123',
        duration: 300,
        authorName: 'Test Artist',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(mockTutorialEntity),
      );
      vi.mocked(mockRepository.findById).mockResolvedValue(
        ResultUtils.ok(mockTutorialEntity),
      );

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTutorial, error: null }),
      }));

      // Act
      const tutorialBySlug = await service.findBySlug('consistency-test');
      const tutorialById = await service.findById(tutorialId);

      // Assert
      expect(tutorialBySlug.id).toBe(tutorialById.id);
      expect(tutorialBySlug.title).toBe(tutorialById.title);
    });
  });

  describe('API Contract Compliance', () => {
    it('should return properly typed responses', async () => {
      // Arrange
      const tutorialId = '444e4567-e89b-12d3-a456-426614174444';

      const mockTutorialEntity = TutorialEntity.reconstitute({
        id: TutorialId.create(tutorialId),
        slug: TutorialSlug.create('api-test'),
        title: 'API Test Tutorial',
        description: 'Learn API Test Tutorial bass line',
        youtubeId: 'abc123',
        duration: 300,
        authorName: 'Test Artist',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        ResultUtils.ok({
          items: [mockTutorialEntity],
          total: 1,
          page: 1,
          limit: 100,
          totalPages: 1,
        }),
      );

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ id: tutorialId, exercise_count: 1 }],
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

      const legacyEntity = TutorialEntity.reconstitute({
        id: TutorialId.create('111e4567-e89b-12d3-a456-426614174111'),
        title: 'Legacy Tutorial',
        slug: TutorialSlug.create('legacy-tutorial'),
        description: 'Legacy description',
        youtubeId: 'legacy123',
        duration: 300,
        authorName: 'Legacy Artist',
        level: 'beginner',
        tags: [],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      vi.mocked(mockRepository.findBySlug).mockResolvedValue(
        ResultUtils.ok(legacyEntity),
      );

      // Act
      const response: TutorialResponse =
        await controller.findBySlug('legacy-tutorial');

      // Assert
      expect(response.tutorial.id).toBe('111e4567-e89b-12d3-a456-426614174111');
      expect(response.tutorial.slug).toBe('legacy-tutorial');
      expect(response.tutorial.title).toBe('Legacy Tutorial');
      expect(response.tutorial.artist).toBe('Legacy Artist');
      expect(response.tutorial.difficulty).toBe('beginner');
    });
  });
});
