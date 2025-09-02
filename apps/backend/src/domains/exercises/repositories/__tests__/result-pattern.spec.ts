import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResultExerciseRepository } from '../result-exercise.repository.js';
import { ExerciseId } from '../../value-objects/exercise-id.vo.js';
import { Difficulty } from '../../value-objects/difficulty.vo.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { ResultUtils } from '../../../shared/result.js';

describe('ResultExerciseRepository', () => {
  let repository: ResultExerciseRepository;
  let mockBaseRepository: any;

  const mockExercise = Exercise.create({
    id: ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
    title: 'Test Exercise',
    description: 'Test Description',
    difficulty: Difficulty.beginner(),
    duration: 120,
    bpm: 100,
    key: 'C',
    notes: [],
    tags: [],
    isActive: true,
  });

  beforeEach(() => {
    mockBaseRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByDifficulty: vi.fn(),
      search: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      findByIds: vi.fn(),
      saveMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
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
    
    repository = new ResultExerciseRepository(mockBaseRepository, mockRequestContextService as any);
  });

  describe('findById', () => {
    it('should return success result when exercise found', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockExercise);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );

      expect(result.ok).toBe(true);
      expect(result.ok && result.value).toBe(mockExercise);
    });

    it('should return success result with null when exercise not found', async () => {
      mockBaseRepository.findById.mockResolvedValue(null);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );

      expect(result.ok).toBe(true);
      expect(result.ok && result.value).toBe(null);
    });

    it('should return failure result on error', async () => {
      const error = new Error('Database error');
      mockBaseRepository.findById.mockRejectedValue(error);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe(error);
    });
  });

  describe('saveMany', () => {
    it('should return success result when batch save succeeds', async () => {
      mockBaseRepository.saveMany.mockResolvedValue(undefined);

      const exercises = [mockExercise];
      const result = await repository.saveMany(exercises);

      expect(result.ok).toBe(true);
      expect(mockBaseRepository.saveMany).toHaveBeenCalledWith(exercises);
    });

    it('should return failure result when batch save fails', async () => {
      const error = new Error('Batch save failed');
      mockBaseRepository.saveMany.mockRejectedValue(error);

      const result = await repository.saveMany([mockExercise]);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe(error);
    });
  });

  describe('Result utilities integration', () => {
    it('should work with ResultUtils.map', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockExercise);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );
      const mapped = ResultUtils.map(
        result,
        (exercise) => exercise?.title || 'Not found',
      );

      expect(mapped.ok).toBe(true);
      expect(mapped.ok && mapped.value).toBe('Test Exercise');
    });

    it('should work with ResultUtils.flatMap', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockExercise);
      mockBaseRepository.exists.mockResolvedValue(true);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );

      const flatMapped = ResultUtils.flatMap(result, (exercise) => {
        if (!exercise) return ResultUtils.ok(false);
        return ResultUtils.ok(true); // Simplified for test
      });

      expect(flatMapped.ok).toBe(true);
      expect(flatMapped.ok && flatMapped.value).toBe(true);
    });

    it('should propagate errors through flatMap', async () => {
      const error = new Error('Database error');
      mockBaseRepository.findById.mockRejectedValue(error);

      const result = await repository.findById(
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
      );

      const flatMapped = ResultUtils.flatMap(result, (_exercise) => {
        // This should never be called since result failed
        return ResultUtils.ok(true);
      });

      expect(flatMapped.ok).toBe(false);
      expect(!flatMapped.ok && flatMapped.error).toBe(error);
    });
  });

  describe('combine multiple results', () => {
    it('should combine successful results', async () => {
      mockBaseRepository.findById.mockResolvedValue(mockExercise);
      mockBaseRepository.exists.mockResolvedValue(true);

      const results = await Promise.all([
        repository.findById(
          ExerciseId.create('550e8400-e29b-41d4-a716-446655440001'),
        ),
        repository.findById(
          ExerciseId.create('550e8400-e29b-41d4-a716-446655440002'),
        ),
      ]);

      const combined = ResultUtils.combine(results);

      expect(combined.ok).toBe(true);
      expect(combined.ok && combined.value).toHaveLength(2);
    });

    it('should fail fast on first error', async () => {
      const error = new Error('Failed');
      mockBaseRepository.findById
        .mockResolvedValueOnce(mockExercise)
        .mockRejectedValueOnce(error);

      const results = await Promise.all([
        repository.findById(
          ExerciseId.create('550e8400-e29b-41d4-a716-446655440001'),
        ),
        repository.findById(
          ExerciseId.create('550e8400-e29b-41d4-a716-446655440002'),
        ),
      ]);

      const combined = ResultUtils.combine(results);

      expect(combined.ok).toBe(false);
      expect(!combined.ok && combined.error).toBe(error);
    });
  });
});
