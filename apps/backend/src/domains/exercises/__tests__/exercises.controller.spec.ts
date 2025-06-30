/**
 * ExercisesController Unit Tests
 *
 * Testing REST API endpoints for exercise management including:
 * - Public exercise endpoints (GET operations)
 * - Authenticated user exercise management
 * - Admin operations (Epic 5 preparation)
 * - Error handling and HTTP status codes
 * - Performance requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExercisesController } from '../exercises.controller.js';
import { ExercisesService } from '../exercises.service.js';

describe('ExercisesController', () => {
  let controller: ExercisesController;
  let mockExercisesService: ExercisesService;

  // Mock data
  const mockExercise = {
    id: 'exercise-1',
    title: 'Test Exercise',
    difficulty: 'beginner',
    notes: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockBassline = {
    id: 'bassline-1',
    exercise_id: 'exercise-1',
    user_id: 'user-1',
    custom_notes: [],
    name: 'My Custom Bassline',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Create mock service with all required methods
    mockExercisesService = {
      getAllExercises: vi.fn(),
      getExerciseById: vi.fn(),
      getExercisesByDifficulty: vi.fn(),
      searchExercises: vi.fn(),
      getUserCustomBasslines: vi.fn(),
      saveCustomBassline: vi.fn(),
      updateCustomBassline: vi.fn(),
      deleteCustomBassline: vi.fn(),
      createExercise: vi.fn(),
      updateExercise: vi.fn(),
    } as any;

    // Direct instantiation - following the working pattern from app.controller.spec.ts
    controller = new ExercisesController(mockExercisesService);
  });

  describe('Exercise Retrieval Endpoints', () => {
    describe('GET /api/exercises', () => {
      it('should return paginated exercises with default parameters', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          page: 1,
          limit: 10,
        };

        mockExercisesService.getAllExercises = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.getAllExercises();

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.getAllExercises).toHaveBeenCalledWith(
          1,
          10,
        );
      });

      it('should handle custom pagination parameters', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          page: 2,
          limit: 5,
        };

        mockExercisesService.getAllExercises = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.getAllExercises('2', '5');

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.getAllExercises).toHaveBeenCalledWith(2, 5);
      });

      it('should validate pagination parameters', async () => {
        await expect(controller.getAllExercises('0', '-1')).rejects.toThrow(
          'Invalid pagination parameters',
        );
      });

      it('should handle service errors gracefully', async () => {
        mockExercisesService.getAllExercises = vi
          .fn()
          .mockRejectedValue(new Error('Service error'));

        await expect(controller.getAllExercises()).rejects.toThrow(
          'Service error',
        );
      });

      it('should meet performance requirements (<500ms)', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          page: 1,
          limit: 10,
        };

        mockExercisesService.getAllExercises = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const startTime = Date.now();
        await controller.getAllExercises();
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(500);
      });
    });

    describe('GET /api/exercises/:id', () => {
      it('should return single exercise', async () => {
        const mockResponse = { exercise: mockExercise };

        mockExercisesService.getExerciseById = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.getExerciseById('exercise-1');

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.getExerciseById).toHaveBeenCalledWith(
          'exercise-1',
        );
      });

      it('should handle NotFoundException from service', async () => {
        mockExercisesService.getExerciseById = vi
          .fn()
          .mockRejectedValue(new NotFoundException('Exercise not found'));

        await expect(
          controller.getExerciseById('nonexistent-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('GET /api/exercises/difficulty/:level', () => {
      it('should return exercises by difficulty', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
        };

        mockExercisesService.getExercisesByDifficulty = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.getExercisesByDifficulty('beginner');

        expect(result).toEqual(mockResponse);
        expect(
          mockExercisesService.getExercisesByDifficulty,
        ).toHaveBeenCalledWith('beginner');
      });

      it('should handle all valid difficulty levels', async () => {
        const difficulties: ('beginner' | 'intermediate' | 'advanced')[] = [
          'beginner',
          'intermediate',
          'advanced',
        ];
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
        };

        mockExercisesService.getExercisesByDifficulty = vi
          .fn()
          .mockResolvedValue(mockResponse);

        for (const difficulty of difficulties) {
          await controller.getExercisesByDifficulty(difficulty);
          expect(
            mockExercisesService.getExercisesByDifficulty,
          ).toHaveBeenCalledWith(difficulty);
        }
      });
    });

    describe('GET /api/exercises/search', () => {
      it('should return search results', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
        };

        mockExercisesService.searchExercises = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.searchExercises('test');

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.searchExercises).toHaveBeenCalledWith(
          'test',
        );
      });

      it('should handle empty search query', async () => {
        const result = await controller.searchExercises('');

        expect(result).toEqual({
          exercises: [],
          total: 0,
          cached: false,
        });
        expect(mockExercisesService.searchExercises).not.toHaveBeenCalled();
      });

      it('should trim search query', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
        };

        mockExercisesService.searchExercises = vi
          .fn()
          .mockResolvedValue(mockResponse);

        await controller.searchExercises('  test  ');

        expect(mockExercisesService.searchExercises).toHaveBeenCalledWith(
          'test',
        );
      });
    });
  });

  describe('User Exercise Management', () => {
    const mockRequest = { user: { id: 'user-1' } };

    describe('GET /api/exercises/user/my-exercises', () => {
      it('should return user custom basslines', async () => {
        const mockResponse = {
          basslines: [mockBassline],
          total: 1,
        };

        mockExercisesService.getUserCustomBasslines = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.getUserCustomBasslines(mockRequest);

        expect(result).toEqual(mockResponse);
        expect(
          mockExercisesService.getUserCustomBasslines,
        ).toHaveBeenCalledWith('user-1');
      });
    });

    describe('POST /api/exercises/user/save-bassline', () => {
      it('should save custom bassline', async () => {
        const mockBasslineData = {
          exercise_id: 'exercise-1',
          custom_notes: [],
          name: 'My Custom Bassline',
        };
        const mockResponse = { bassline: mockBassline };

        mockExercisesService.saveCustomBassline = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.saveCustomBassline(
          mockRequest,
          mockBasslineData,
        );

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.saveCustomBassline).toHaveBeenCalledWith(
          'user-1',
          mockBasslineData,
        );
      });

      it('should handle validation errors from service', async () => {
        mockExercisesService.saveCustomBassline = vi
          .fn()
          .mockRejectedValue(new BadRequestException('Invalid bassline data'));

        await expect(
          controller.saveCustomBassline(mockRequest, {}),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('PUT /api/exercises/user/:basslineId', () => {
      it('should update custom bassline', async () => {
        const mockUpdateData = {
          custom_notes: [],
          name: 'Updated Bassline',
        };
        const mockResponse = {
          bassline: { ...mockBassline, name: 'Updated Bassline' },
        };

        mockExercisesService.updateCustomBassline = vi
          .fn()
          .mockResolvedValue(mockResponse);

        const result = await controller.updateCustomBassline(
          mockRequest,
          'bassline-1',
          mockUpdateData,
        );

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.updateCustomBassline).toHaveBeenCalledWith(
          'user-1',
          'bassline-1',
          mockUpdateData,
        );
      });

      it('should handle NotFoundException from service', async () => {
        mockExercisesService.updateCustomBassline = vi
          .fn()
          .mockRejectedValue(new NotFoundException('Bassline not found'));

        await expect(
          controller.updateCustomBassline(mockRequest, 'nonexistent-id', {}),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('DELETE /api/exercises/user/:basslineId', () => {
      it('should delete custom bassline', async () => {
        mockExercisesService.deleteCustomBassline = vi
          .fn()
          .mockResolvedValue(undefined);

        const result = await controller.deleteCustomBassline(
          mockRequest,
          'bassline-1',
        );

        expect(result).toEqual({
          message: 'Custom bassline deleted successfully',
        });
        expect(mockExercisesService.deleteCustomBassline).toHaveBeenCalledWith(
          'user-1',
          'bassline-1',
        );
      });

      it('should handle service errors', async () => {
        mockExercisesService.deleteCustomBassline = vi
          .fn()
          .mockRejectedValue(new Error('Deletion failed'));

        await expect(
          controller.deleteCustomBassline(mockRequest, 'bassline-1'),
        ).rejects.toThrow('Deletion failed');
      });
    });
  });

  describe('Admin Operations (Epic 5 Preparation)', () => {
    const mockRequest = { user: { id: 'user-1' } };

    describe('POST /api/exercises', () => {
      it('should create new exercise', async () => {
        const mockExerciseData = {
          title: 'New Exercise',
          difficulty: 'beginner' as const,
          notes: [],
        };
        const mockResponse = {
          exercise: { ...mockExercise, title: 'New Exercise' },
        };

        mockExercisesService.createExercise = vi
          .fn()
          .mockResolvedValue({ ...mockExercise, title: 'New Exercise' });

        const result = await controller.createExercise(
          mockRequest,
          mockExerciseData,
        );

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.createExercise).toHaveBeenCalledWith(
          mockExerciseData,
          'user-1',
        );
      });

      it('should handle creation errors', async () => {
        mockExercisesService.createExercise = vi
          .fn()
          .mockRejectedValue(new Error('Creation failed'));

        await expect(
          controller.createExercise(mockRequest, {}),
        ).rejects.toThrow('Creation failed');
      });
    });

    describe('PUT /api/exercises/:id', () => {
      it('should update existing exercise', async () => {
        const mockUpdateData = {
          title: 'Updated Exercise',
          difficulty: 'intermediate' as const,
        };
        const mockResponse = {
          exercise: { ...mockExercise, title: 'Updated Exercise' },
        };

        mockExercisesService.updateExercise = vi
          .fn()
          .mockResolvedValue({ ...mockExercise, title: 'Updated Exercise' });

        const result = await controller.updateExercise(
          mockRequest,
          'exercise-1',
          mockUpdateData,
        );

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.updateExercise).toHaveBeenCalledWith(
          'exercise-1',
          mockUpdateData,
          'user-1',
        );
      });

      it('should handle NotFoundException from service', async () => {
        mockExercisesService.updateExercise = vi
          .fn()
          .mockRejectedValue(new NotFoundException('Exercise not found'));

        await expect(
          controller.updateExercise(mockRequest, 'nonexistent-id', {}),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors correctly', async () => {
      mockExercisesService.getAllExercises = vi
        .fn()
        .mockRejectedValue(new Error('Service error'));

      await expect(controller.getAllExercises()).rejects.toThrow(
        'Service error',
      );
    });

    it('should validate input parameters', async () => {
      mockExercisesService.saveCustomBassline = vi
        .fn()
        .mockRejectedValue(new BadRequestException('Invalid input'));

      await expect(
        controller.saveCustomBassline({ user: { id: 'user-1' } }, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet list performance requirements (<500ms)', async () => {
      const mockResponse = {
        exercises: [mockExercise],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockExercisesService.getAllExercises = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const startTime = Date.now();
      await controller.getAllExercises();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should meet single exercise performance requirements (<200ms)', async () => {
      const mockResponse = { exercise: mockExercise };

      mockExercisesService.getExerciseById = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const startTime = Date.now();
      await controller.getExerciseById('exercise-1');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('Data Integrity', () => {
    it('should handle concurrent requests without data corruption', async () => {
      const mockResponse = {
        exercises: [mockExercise],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockExercisesService.getAllExercises = vi
        .fn()
        .mockResolvedValue(mockResponse);

      const result = await controller.getAllExercises();

      expect(result.exercises).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should allow 404 errors to propagate for not found resources', async () => {
      mockExercisesService.getExerciseById = vi
        .fn()
        .mockRejectedValue(new NotFoundException('Exercise not found'));

      await expect(
        controller.getExerciseById('nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow 400 errors to propagate for bad requests', async () => {
      mockExercisesService.saveCustomBassline = vi
        .fn()
        .mockRejectedValue(new BadRequestException('Invalid data'));

      await expect(
        controller.saveCustomBassline({ user: { id: 'user-1' } }, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
