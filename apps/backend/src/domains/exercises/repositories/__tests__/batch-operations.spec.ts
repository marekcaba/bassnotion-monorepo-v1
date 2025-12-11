import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExerciseRepository } from '../exercise.repository.js';
import { ExerciseId } from '../../value-objects/exercise-id.vo.js';
import { Difficulty } from '../../value-objects/difficulty.vo.js';
import { Exercise } from '../../entities/exercise.entity.js';

describe('ExerciseRepository Batch Operations', () => {
  let repository: ExerciseRepository;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create chainable mock
    const createChainableMock = () => {
      const mock: any = {
        from: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        in: vi.fn(),
        eq: vi.fn(),
      };

      Object.keys(mock).forEach((key) => {
        mock[key].mockReturnValue(mock);
      });

      return mock;
    };

    mockSupabaseClient = createChainableMock();

    const mockRequestContextService = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };

    repository = new ExerciseRepository(
      mockSupabaseClient,
      mockRequestContextService as any,
    );
  });

  describe('saveMany', () => {
    it('should save multiple exercises in one operation', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: null,
      });

      const exercises = [
        Exercise.create({
          id: ExerciseId.create(),
          title: 'Exercise 1',
          description: 'Description 1',
          difficulty: Difficulty.beginner(),
          duration: 120,
          bpm: 100,
          key: 'C',
          notes: [],
          tags: [],
          isActive: true,
        }),
        Exercise.create({
          id: ExerciseId.create(),
          title: 'Exercise 2',
          description: 'Description 2',
          difficulty: Difficulty.intermediate(),
          duration: 180,
          bpm: 120,
          key: 'G',
          notes: [],
          tags: [],
          isActive: true,
        }),
      ];

      await repository.saveMany(exercises);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Exercise 1' }),
          expect.objectContaining({ title: 'Exercise 2' }),
        ]),
      );
    });

    it('should handle empty array', async () => {
      await repository.saveMany([]);

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: { message: 'Batch insert failed' },
      });

      const exercises = [
        Exercise.create({
          id: ExerciseId.create(),
          title: 'Exercise 1',
          description: 'Description 1',
          difficulty: Difficulty.beginner(),
          duration: 120,
          bpm: 100,
          key: 'C',
          notes: [],
          tags: [],
          isActive: true,
        }),
      ];

      await expect(repository.saveMany(exercises)).rejects.toThrow(
        'Failed to save exercises batch',
      );
    });
  });

  describe('updateMany', () => {
    it('should update multiple exercises', async () => {
      // Mock for Promise.all with multiple update calls
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      const exercises = [
        Exercise.reconstitute({
          id: ExerciseId.create('550e8400-e29b-41d4-a716-446655440001'),
          title: 'Updated Exercise 1',
          description: 'Updated Description 1',
          difficulty: Difficulty.intermediate(),
          duration: 150,
          bpm: 110,
          key: 'D',
          notes: [],
          tags: ['updated'],
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        }),
        Exercise.reconstitute({
          id: ExerciseId.create('550e8400-e29b-41d4-a716-446655440002'),
          title: 'Updated Exercise 2',
          description: 'Updated Description 2',
          difficulty: Difficulty.advanced(),
          duration: 200,
          bpm: 140,
          key: 'A',
          notes: [],
          tags: ['updated'],
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        }),
      ];

      await repository.updateMany(exercises);

      expect(mockSupabaseClient.update).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'id',
        '550e8400-e29b-41d4-a716-446655440001',
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'id',
        '550e8400-e29b-41d4-a716-446655440002',
      );
    });
  });

  describe('deleteMany', () => {
    it('should soft delete multiple exercises', async () => {
      mockSupabaseClient.in.mockResolvedValue({
        data: null,
        error: null,
      });

      const ids = [
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440001'),
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440002'),
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440003'),
      ];

      await repository.deleteMany(ids);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        }),
      );
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('id', [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ]);
    });

    it('should handle empty array', async () => {
      await repository.deleteMany([]);

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });
});
