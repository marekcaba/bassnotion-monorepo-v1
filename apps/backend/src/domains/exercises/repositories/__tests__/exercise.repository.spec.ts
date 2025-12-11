import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExerciseRepository } from '../exercise.repository.js';
import { ExerciseId } from '../../value-objects/exercise-id.vo.js';
import { Difficulty } from '../../value-objects/difficulty.vo.js';
import { Exercise } from '../../entities/exercise.entity.js';

describe('ExerciseRepository', () => {
  let repository: ExerciseRepository;
  let mockSupabaseClient: any;

  const mockExerciseRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Exercise',
    description: 'Test Description',
    difficulty: 'beginner',
    duration: 120,
    bpm: 120,
    key: 'C',
    notes: [],
    tags: ['test'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Create a chainable mock that returns itself for all methods
    const createChainableMock = () => {
      const mock: any = {
        from: vi.fn(),
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
        or: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        in: vi.fn(),
      };

      // Make all methods return the mock itself for chaining
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

  describe('findById', () => {
    it('should find exercise by id', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockExerciseRecord,
        error: null,
      });

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      const result = await repository.findById(id);

      expect(result).toBeDefined();
      expect(result?.title).toBe('Test Exercise');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('exercises');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', id.value);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return null when exercise not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      const result = await repository.findById(id);

      expect(result).toBeNull();
    });

    it('should throw error on database error', async () => {
      mockSupabaseClient.single.mockRejectedValue(new Error('Database error'));

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      await expect(repository.findById(id)).rejects.toThrow(
        'Failed to find exercise',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [mockExerciseRecord],
        error: null,
        count: 1,
      });

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 9);
    });

    it('should handle empty results', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should calculate correct offset for pagination', async () => {
      mockSupabaseClient.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await repository.findAll({ page: 3, limit: 20 });

      expect(mockSupabaseClient.range).toHaveBeenCalledWith(40, 59);
    });
  });

  describe('findByDifficulty', () => {
    it('should find exercises by difficulty', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [mockExerciseRecord],
        error: null,
      });

      const difficulty = Difficulty.beginner();
      const result = await repository.findByDifficulty(difficulty);

      expect(result).toHaveLength(1);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'difficulty',
        'beginner',
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const difficulty = Difficulty.beginner();
      await expect(repository.findByDifficulty(difficulty)).rejects.toThrow(
        'Failed to fetch exercises by difficulty',
      );
    });
  });

  describe('search', () => {
    it('should search exercises by query', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [mockExerciseRecord],
        error: null,
      });

      const result = await repository.search('test');

      expect(result).toHaveLength(1);
      expect(mockSupabaseClient.or).toHaveBeenCalledWith(
        'title.ilike.%test%,description.ilike.%test%',
      );
    });

    it('should return empty array when no matches', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repository.search('nonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('should save new exercise', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: null,
      });

      const exercise = Exercise.create({
        id: ExerciseId.create(),
        title: 'New Exercise',
        description: 'New Description',
        difficulty: Difficulty.intermediate(),
        duration: 180,
        bpm: 100,
        key: 'G',
        notes: [],
        tags: [],
        isActive: true,
      });

      await repository.save(exercise);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Exercise',
          difficulty: 'intermediate',
        }),
      );
    });

    it('should throw error on save failure', async () => {
      mockSupabaseClient.insert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      const exercise = Exercise.create({
        id: ExerciseId.create(),
        title: 'New Exercise',
        description: 'New Description',
        difficulty: Difficulty.beginner(),
        duration: 180,
        bpm: 100,
        key: 'G',
        notes: [],
        tags: [],
        isActive: true,
      });

      await expect(repository.save(exercise)).rejects.toThrow(
        'Failed to save exercise',
      );
    });
  });

  describe('update', () => {
    it('should update existing exercise', async () => {
      // For update, we need to chain methods
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      const exercise = Exercise.reconstitute({
        id: ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
        title: 'Updated Exercise',
        description: 'Updated Description',
        difficulty: Difficulty.advanced(),
        duration: 240,
        bpm: 140,
        key: 'D',
        notes: [],
        tags: ['updated'],
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });

      await repository.update(exercise);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Exercise',
          difficulty: 'advanced',
        }),
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'id',
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });
  });

  describe('delete', () => {
    it('should soft delete exercise', async () => {
      // For delete, we need to chain methods
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      await repository.delete(id);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        }),
      );
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', id.value);
    });
  });

  describe('exists', () => {
    it('should return true when exercise exists', async () => {
      // For exists, the last eq in the chain returns the result
      // We need to ensure the mock chain works correctly
      const finalResult = {
        count: 1,
        error: null,
      };

      // Override eq to return the final result on the second call
      let eqCallCount = 0;
      mockSupabaseClient.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          // Second eq call returns the final result
          return Promise.resolve(finalResult);
        }
        // First eq call returns the mock for chaining
        return mockSupabaseClient;
      });

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      const result = await repository.exists(id);

      expect(result).toBe(true);
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
    });

    it('should return false when exercise does not exist', async () => {
      // For exists, the last eq in the chain returns the result
      const finalResult = {
        count: 0,
        error: null,
      };

      // Override eq to return the final result on the second call
      let eqCallCount = 0;
      mockSupabaseClient.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          // Second eq call returns the final result
          return Promise.resolve(finalResult);
        }
        // First eq call returns the mock for chaining
        return mockSupabaseClient;
      });

      const id = ExerciseId.create('550e8400-e29b-41d4-a716-446655440000');
      const result = await repository.exists(id);

      expect(result).toBe(false);
    });
  });

  describe('findByIds', () => {
    it('should find multiple exercises by ids', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: [mockExerciseRecord],
        error: null,
      });

      const ids = [
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440000'),
        ExerciseId.create('550e8400-e29b-41d4-a716-446655440001'),
      ];
      const result = await repository.findByIds(ids);

      expect(result).toHaveLength(1);
      expect(mockSupabaseClient.in).toHaveBeenCalledWith('id', [
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ]);
    });

    it('should return empty array when given empty ids', async () => {
      const result = await repository.findByIds([]);

      expect(result).toHaveLength(0);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });
});
