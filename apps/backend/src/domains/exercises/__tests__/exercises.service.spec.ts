/**
 * ExercisesService Unit Tests
 *
 * Testing exercise CRUD operations, user exercise management,
 * custom bassline functionality, and data validation.
 *
 * Core Behaviors:
 * - Exercise retrieval with pagination and filtering
 * - User custom bassline management
 * - Data validation using contracts schemas
 * - Error handling and security
 * - Performance requirements compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ExercisesService } from '../exercises.service.js';
import { ExerciseSchema } from '@bassnotion/contracts';

// Mock contracts validation
vi.mock('@bassnotion/contracts', async () => {
  const actual = await vi.importActual('@bassnotion/contracts');
  return {
    ...actual,
    ExerciseSchema: {
      parse: vi.fn((data) => data),
    },
  };
});

// Mock DTOs
vi.mock('../dto/custom-bassline.dto.js', () => ({
  validateSaveCustomBassline: vi.fn((data) => data),
  validateCustomBassline: vi.fn((data) => data),
}));

vi.mock('../dto/create-exercise.dto.js', () => ({
  validateCreateExercise: vi.fn((data) => data),
  validateUpdateExercise: vi.fn((data) => data),
}));

describe('ExercisesService', () => {
  let exercisesService: ExercisesService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  // Test data fixtures
  const mockExercise = {
    id: 'exercise-1',
    title: 'Test Exercise',
    description: 'A test exercise',
    difficulty: 'beginner' as const,
    duration: 60000,
    bpm: 120,
    key: 'C',
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 1,
        fret: 3,
        duration: 500,
        note: 'G',
        color: 'red',
      },
    ],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockCustomBassline = {
    id: 'bassline-1',
    exercise_id: 'exercise-1',
    user_id: 'user-1',
    title: 'My Custom Bassline',
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 1,
        fret: 5,
        duration: 500,
        note: 'A',
        color: 'blue',
      },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock query builder that returns promises
    const createMockQuery = (response: any) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(response),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockResolvedValue(response),
      or: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) => Promise.resolve(response).then(resolve)),
      catch: vi.fn(),
    });

    mockSupabaseClient = {
      from: vi.fn((_table: string) =>
        createMockQuery({ data: null, error: null }),
      ),
    };

    mockSupabaseService = {
      getClient: vi.fn(() => mockSupabaseClient),
      isReady: vi.fn(() => true),
    };

    exercisesService = new ExercisesService(mockSupabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Exercise Retrieval', () => {
    describe('getAllExercises', () => {
      it('should retrieve paginated exercises with performance compliance', async () => {
        const mockResponse = { data: [mockExercise], error: null, count: 1 };

        // Mock the from method to return a query that resolves to our response
        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue(mockResponse),
        }));

        const startTime = performance.now();
        const result = await exercisesService.getAllExercises(1, 10);
        const responseTime = performance.now() - startTime;

        expect(responseTime).toBeLessThan(500); // <500ms requirement
        expect(result).toEqual({
          exercises: [mockExercise],
          total: 1,
          cached: false,
        });
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
      });

      it('should handle pagination parameters correctly', async () => {
        const mockResponse = {
          data: Array(5).fill(mockExercise),
          error: null,
          count: 50,
        };

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => mockQuery);

        await exercisesService.getAllExercises(2, 5);

        expect(mockQuery.range).toHaveBeenCalledWith(5, 9); // page 2, limit 5 = offset 5, end 9
      });

      it('should validate exercise data using contracts schema', async () => {
        const mockResponse = { data: [mockExercise], error: null, count: 1 };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue(mockResponse),
        }));

        await exercisesService.getAllExercises();

        expect(ExerciseSchema.parse).toHaveBeenCalledWith(mockExercise);
      });

      it('should handle Supabase service not ready', async () => {
        mockSupabaseService.isReady.mockReturnValue(false);

        await expect(exercisesService.getAllExercises()).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('should handle Supabase errors gracefully', async () => {
        const mockResponse = {
          data: null,
          error: { message: 'Database error' },
        };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue(mockResponse),
        }));

        await expect(exercisesService.getAllExercises()).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });

    describe('getExerciseById', () => {
      it('should retrieve single exercise with performance compliance', async () => {
        const mockResponse = { data: mockExercise, error: null };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        const startTime = performance.now();
        const result = await exercisesService.getExerciseById('exercise-1');
        const responseTime = performance.now() - startTime;

        expect(responseTime).toBeLessThan(200); // <200ms requirement
        expect(result).toEqual({
          exercise: mockExercise,
        });
      });

      it('should throw NotFoundException for non-existent exercise', async () => {
        const mockResponse = { data: null, error: { code: 'PGRST116' } };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        await expect(
          exercisesService.getExerciseById('non-existent'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should validate exercise data using contracts schema', async () => {
        const mockResponse = { data: mockExercise, error: null };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        await exercisesService.getExerciseById('exercise-1');

        expect(ExerciseSchema.parse).toHaveBeenCalledWith(mockExercise);
      });
    });

    describe('getExercisesByDifficulty', () => {
      it('should filter exercises by difficulty level', async () => {
        const mockResponse = { data: [mockExercise], error: null };

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => mockQuery);

        const result =
          await exercisesService.getExercisesByDifficulty('beginner');

        expect(result.exercises).toEqual([mockExercise]);
        expect(mockQuery.eq).toHaveBeenCalledWith('difficulty', 'beginner');
      });

      it('should handle all difficulty levels', async () => {
        const difficulties: ('beginner' | 'intermediate' | 'advanced')[] = [
          'beginner',
          'intermediate',
          'advanced',
        ];

        for (const difficulty of difficulties) {
          const mockResponse = { data: [mockExercise], error: null };

          mockSupabaseClient.from = vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue(mockResponse),
          }));

          const result =
            await exercisesService.getExercisesByDifficulty(difficulty);

          expect(result.exercises).toHaveLength(1);
        }
      });
    });

    describe('searchExercises', () => {
      it('should search exercises by title and description', async () => {
        const mockResponse = { data: [mockExercise], error: null };

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => mockQuery);

        const result = await exercisesService.searchExercises('test');

        expect(result.exercises).toEqual([mockExercise]);
        expect(mockQuery.or).toHaveBeenCalledWith(
          'title.ilike.%test%,description.ilike.%test%',
        );
      });
    });
  });

  describe('User Exercise Management', () => {
    describe('getUserCustomBasslines', () => {
      it('should retrieve user custom basslines', async () => {
        const mockResponse = { data: [mockCustomBassline], error: null };

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => mockQuery);

        const result = await exercisesService.getUserCustomBasslines('user-1');

        expect(result).toEqual({
          basslines: [mockCustomBassline],
          total: 1,
        });
        expect(mockSupabaseClient.from).toHaveBeenCalledWith(
          'custom_basslines',
        );
      });

      it('should filter basslines by user ID', async () => {
        const mockResponse = { data: [], error: null };

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => mockQuery);

        await exercisesService.getUserCustomBasslines('user-1');

        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
      });
    });

    describe('saveCustomBassline', () => {
      const mockBasslineData = {
        exercise_id: 'exercise-1',
        title: 'New Bassline',
        notes: [mockCustomBassline.notes[0]],
      };

      it('should save custom bassline successfully', async () => {
        // Mock exercise existence check
        const exerciseResponse = { data: { id: 'exercise-1' }, error: null };
        const basslineResponse = { data: mockCustomBassline, error: null };

        let callCount = 0;
        mockSupabaseClient.from = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            // First call for exercise check
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(exerciseResponse),
            };
          } else {
            // Second call for bassline save
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(basslineResponse),
            };
          }
        });

        const result = await exercisesService.saveCustomBassline(
          'user-1',
          mockBasslineData,
        );

        expect(result).toEqual(mockCustomBassline);
      });

      it('should validate referenced exercise exists', async () => {
        // Mock exercise not found
        const exerciseResponse = { data: null, error: { code: 'PGRST116' } };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(exerciseResponse),
        }));

        await expect(
          exercisesService.saveCustomBassline('user-1', mockBasslineData),
        ).rejects.toThrow(BadRequestException);
      });

      it('should handle duplicate bassline titles', async () => {
        // Mock exercise exists
        const exerciseResponse = { data: { id: 'exercise-1' }, error: null };
        const basslineResponse = { data: null, error: { code: '23505' } };

        let callCount = 0;
        mockSupabaseClient.from = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(exerciseResponse),
            };
          } else {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(basslineResponse),
            };
          }
        });

        await expect(
          exercisesService.saveCustomBassline('user-1', mockBasslineData),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateCustomBassline', () => {
      it('should update existing bassline', async () => {
        // Mock existing bassline check and update
        const existingResponse = { data: mockCustomBassline, error: null };
        const updateResponse = {
          data: { ...mockCustomBassline, title: 'Updated Title' },
          error: null,
        };

        let callCount = 0;
        mockSupabaseClient.from = vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(existingResponse),
            };
          } else {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue(updateResponse),
            };
          }
        });

        const result = await exercisesService.updateCustomBassline(
          'user-1',
          'bassline-1',
          { title: 'Updated Title' },
        );

        expect(result.title).toBe('Updated Title');
      });

      it('should throw NotFoundException for non-existent bassline', async () => {
        const mockResponse = { data: null, error: { code: 'PGRST116' } };

        mockSupabaseClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        await expect(
          exercisesService.updateCustomBassline('user-1', 'non-existent', {}),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('deleteCustomBassline', () => {
      it('should delete bassline successfully', async () => {
        const mockResponse = { error: null };

        // Create a proper chain that handles .eq().eq() calls
        const mockChain = {
          eq: vi.fn().mockResolvedValue(mockResponse),
        };

        mockSupabaseClient.from = vi.fn(() => ({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(mockChain),
        }));

        await expect(
          exercisesService.deleteCustomBassline('user-1', 'bassline-1'),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Admin Operations (Epic 5 Preparation)', () => {
    describe('createExercise', () => {
      const mockExerciseData = {
        title: 'New Exercise',
        difficulty: 'intermediate' as const,
        duration: 120000,
        bpm: 140,
        key: 'D',
        notes: [mockExercise.notes[0]],
      };

      it('should create exercise successfully', async () => {
        const mockResponse = { data: mockExercise, error: null };

        mockSupabaseClient.from = vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        const result = await exercisesService.createExercise(
          mockExerciseData,
          'user-1',
        );

        expect(result).toEqual(mockExercise);
        expect(ExerciseSchema.parse).toHaveBeenCalledWith(mockExercise);
      });

      it('should handle creation errors', async () => {
        const mockResponse = {
          data: null,
          error: { message: 'Creation failed' },
        };

        mockSupabaseClient.from = vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        await expect(
          exercisesService.createExercise(mockExerciseData, 'user-1'),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('updateExercise', () => {
      it('should update exercise successfully', async () => {
        const updateData = { title: 'Updated Exercise' };
        const updatedExercise = { ...mockExercise, ...updateData };
        const mockResponse = { data: updatedExercise, error: null };

        mockSupabaseClient.from = vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        const result = await exercisesService.updateExercise(
          'exercise-1',
          updateData,
          'user-1',
        );

        expect(result).toEqual(updatedExercise);
        expect(ExerciseSchema.parse).toHaveBeenCalledWith(updatedExercise);
      });

      it('should throw NotFoundException for non-existent exercise', async () => {
        const mockResponse = { data: null, error: { code: 'PGRST116' } };

        mockSupabaseClient.from = vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(mockResponse),
        }));

        await expect(
          exercisesService.updateExercise('non-existent', {}, 'user-1'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase service unavailable', async () => {
      mockSupabaseService.isReady.mockReturnValue(false);

      await expect(exercisesService.getAllExercises()).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle validation errors gracefully', async () => {
      const mockResponse = { data: [mockExercise], error: null, count: 1 };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      }));

      // Mock validation failure
      const mockValidationError = new Error('Validation failed');
      (ExerciseSchema.parse as any).mockImplementationOnce(() => {
        throw mockValidationError;
      });

      const result = await exercisesService.getAllExercises();

      // Should return original data on validation failure for backward compatibility
      expect(result.exercises).toEqual([mockExercise]);
    });

    it('should handle database connection errors', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Connection failed',
          code: 'CONNECTION_ERROR',
        },
      };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      }));

      await expect(exercisesService.getAllExercises()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should meet exercise list performance requirement (<500ms)', async () => {
      const mockExercises = Array(50).fill(mockExercise);
      const mockResponse = { data: mockExercises, error: null, count: 50 };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      }));

      const startTime = performance.now();
      await exercisesService.getAllExercises();
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(500);
    });

    it('should meet single exercise performance requirement (<200ms)', async () => {
      const mockResponse = { data: mockExercise, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse),
      }));

      const startTime = performance.now();
      await exercisesService.getExerciseById('exercise-1');
      const responseTime = performance.now() - startTime;

      expect(responseTime).toBeLessThan(200);
    });

    it('should handle concurrent requests without degradation', async () => {
      const mockResponse = { data: [mockExercise], error: null, count: 1 };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue(mockResponse),
      }));

      const concurrentRequests = Array(10)
        .fill(null)
        .map(() => exercisesService.getAllExercises());

      const startTime = performance.now();
      const results = await Promise.all(concurrentRequests);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(totalTime).toBeLessThan(2000); // All requests should complete within 2 seconds
    });
  });
});
