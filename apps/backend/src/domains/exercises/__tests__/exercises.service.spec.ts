import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExercisesService } from '../exercises.service.js';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { ResultUtils } from '../../shared/result.js';

describe('ExercisesService', () => {
  let service: ExercisesService;
  let mockExerciseRepository: any;
  let mockRequestContextService: any;

  const mockExercise = {
    id: ExerciseId.create('123e4567-e89b-12d3-a456-426614174000'),
    title: 'Test Exercise',
    description: 'Test Description',
    difficulty: Difficulty.beginner(),
    duration: 1200,
    bpm: 120,
    key: 'C',
    notes: [
      {
        id: 'note-1',
        timestamp: 0,
        string: 1,
        fret: 3,
        duration: 500,
        note: 'C',
        color: '#FF0000',
      },
    ],
    tags: ['test'],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    toPersistence() {
      return {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Exercise',
        description: 'Test Description',
        difficulty: 'beginner',
        duration: 1200,
        bpm: 120,
        key: 'C',
        notes: [
          {
            id: 'note-1',
            timestamp: 0,
            string: 1,
            fret: 3,
            duration: 500,
            note: 'C',
            color: '#FF0000',
          },
        ],
        tags: ['test'],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
    },
  };

  beforeEach(async () => {
    mockExerciseRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
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

    mockRequestContextService = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };

    service = new ExercisesService(mockExerciseRepository, mockRequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllExercises', () => {
    it('should return paginated exercises', async () => {
      const mockPaginatedResult = {
        items: [mockExercise],
        total: 1,
        page: 1,
        limit: 50,
      };

      mockExerciseRepository.findAll.mockResolvedValue(
        ResultUtils.ok(mockPaginatedResult),
      );

      const result = await service.getAllExercises(1, 50);

      expect(result).toEqual({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Test Exercise',
          }),
        ]),
        total: 1,
        cached: false,
      });
      expect(mockExerciseRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
      });
    });

    it('should handle errors properly', async () => {
      mockExerciseRepository.findAll.mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      await expect(service.getAllExercises()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getExerciseById', () => {
    it('should return exercise by id', async () => {
      mockExerciseRepository.findById.mockResolvedValue(
        ResultUtils.ok(mockExercise),
      );

      const result = await service.getExerciseById(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual({
        exercise: expect.objectContaining({
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Test Exercise',
        }),
      });
      expect(mockExerciseRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          _value: '123e4567-e89b-12d3-a456-426614174000',
        }),
      );
    });

    it('should throw BadRequestException for invalid ID format', async () => {
      await expect(service.getExerciseById('invalid-id')).rejects.toThrow(
        'Invalid exercise ID format',
      );
    });

    it('should throw NotFoundException if exercise not found', async () => {
      mockExerciseRepository.findById.mockResolvedValue(ResultUtils.ok(null));

      await expect(
        service.getExerciseById('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      mockExerciseRepository.findById.mockResolvedValue(
        ResultUtils.fail(new Error('Database connection failed')),
      );

      await expect(
        service.getExerciseById('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getExercisesByDifficulty', () => {
    it('should return exercises by difficulty', async () => {
      mockExerciseRepository.findByDifficulty.mockResolvedValue(
        ResultUtils.ok([mockExercise]),
      );

      const result = await service.getExercisesByDifficulty('beginner');

      expect(result).toEqual({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174000',
            difficulty: 'beginner',
          }),
        ]),
        total: 1,
        cached: false,
      });
      expect(mockExerciseRepository.findByDifficulty).toHaveBeenCalledWith(
        expect.objectContaining({ _value: 'beginner' }),
      );
    });

    it('should handle errors properly', async () => {
      mockExerciseRepository.findByDifficulty.mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      await expect(
        service.getExercisesByDifficulty('beginner'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('searchExercises', () => {
    it('should search exercises by query', async () => {
      mockExerciseRepository.search.mockResolvedValue(
        ResultUtils.ok([mockExercise]),
      );

      const result = await service.searchExercises('test');

      expect(result).toEqual({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Test Exercise',
          }),
        ]),
        total: 1,
        cached: false,
      });
      expect(mockExerciseRepository.search).toHaveBeenCalledWith('test');
    });

    it('should return empty array for no matches', async () => {
      mockExerciseRepository.search.mockResolvedValue(ResultUtils.ok([]));

      const result = await service.searchExercises('nonexistent');

      expect(result).toEqual({
        exercises: [],
        total: 0,
        cached: false,
      });
    });

    it('should throw InternalServerErrorException when search fails', async () => {
      mockExerciseRepository.search.mockResolvedValue(
        ResultUtils.fail(new Error('Search index error')),
      );

      await expect(service.searchExercises('test')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createExercise', () => {
    it('should create new exercise', async () => {
      const exerciseData = {
        title: 'New Exercise',
        description: 'New Description',
        difficulty: 'intermediate',
        duration: 1800, // Must be at least 1000ms
        bpm: 100,
        key: 'G',
        notes: [
          {
            id: 'note-1',
            timestamp: 0,
            string: 1,
            fret: 3,
            duration: 500,
            note: 'G',
            color: '#FF0000',
          },
        ],
        tags: [],
      };

      mockExerciseRepository.save.mockResolvedValue(ResultUtils.ok(undefined));

      const result = await service.createExercise(exerciseData, 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          title: 'New Exercise',
          difficulty: 'intermediate',
        }),
      );
      expect(mockExerciseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Exercise',
        }),
      );
    });

    it('should validate exercise data', async () => {
      const invalidData = {
        // Missing required fields
        title: '',
      };

      await expect(service.createExercise(invalidData)).rejects.toThrow();
    });

    it('should throw InternalServerErrorException when save fails', async () => {
      const exerciseData = {
        title: 'New Exercise',
        description: 'New Description',
        difficulty: 'intermediate',
        duration: 1800,
        bpm: 100,
        key: 'G',
        notes: [],
        tags: [],
      };

      mockExerciseRepository.save.mockResolvedValue(
        ResultUtils.fail(new Error('Database save error')),
      );

      await expect(
        service.createExercise(exerciseData, 'user-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateExercise', () => {
    it('should update existing exercise', async () => {
      const updateData = {
        title: 'Updated Title',
        bpm: 140,
      };

      const updateTitleMock = vi.fn();
      const updateBpmMock = vi.fn();

      const updatedExercise = {
        ...mockExercise,
        updateTitle: updateTitleMock,
        updateBpm: updateBpmMock,
        updateDescription: vi.fn(),
        updateDifficulty: vi.fn(),
      };

      mockExerciseRepository.findById.mockResolvedValue(
        ResultUtils.ok(updatedExercise),
      );
      mockExerciseRepository.update.mockResolvedValue(
        ResultUtils.ok(undefined),
      );

      try {
        const result = await service.updateExercise(
          '123e4567-e89b-12d3-a456-426614174000',
          updateData,
        );

        expect(updateTitleMock).toHaveBeenCalledWith('Updated Title');
        expect(updateBpmMock).toHaveBeenCalledWith(140);
        expect(mockExerciseRepository.update).toHaveBeenCalledWith(
          updatedExercise,
        );
        expect(result).toEqual(
          expect.objectContaining({
            title: 'Test Exercise',
            id: '123e4567-e89b-12d3-a456-426614174000',
          }),
        );
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(service.updateExercise('invalid-id', {})).rejects.toThrow(
        'Invalid exercise ID format',
      );
    });

    it('should throw NotFoundException if exercise not found', async () => {
      mockExerciseRepository.findById.mockResolvedValue(ResultUtils.ok(null));

      await expect(
        service.updateExercise('550e8400-e29b-41d4-a716-446655440000', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException when findById fails during update', async () => {
      mockExerciseRepository.findById.mockResolvedValue(
        ResultUtils.fail(new Error('Database find error')),
      );

      await expect(
        service.updateExercise('550e8400-e29b-41d4-a716-446655440000', {
          title: 'Updated',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedExercise = {
        ...mockExercise,
        updateTitle: vi.fn(),
        updateBpm: vi.fn(),
        updateDescription: vi.fn(),
        updateDifficulty: vi.fn(),
      };

      mockExerciseRepository.findById.mockResolvedValue(
        ResultUtils.ok(updatedExercise),
      );
      mockExerciseRepository.update.mockResolvedValue(
        ResultUtils.fail(new Error('Database update error')),
      );

      await expect(
        service.updateExercise(
          '550e8400-e29b-41d4-a716-446655440000',
          updateData,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createExerciseWithMidiFile', () => {
    it('should create exercise with MIDI file metadata', async () => {
      const midiData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'MIDI Exercise',
        description: 'From MIDI file',
        difficulty: 'intermediate',
        duration: 240,
        bpm: 110,
        key: 'D',
        notes: [],
        midi_file_path: '/uploads/test.midi',
        original_filename: 'test.midi',
        file_size: 2048,
        uploaded_at: '2024-01-01T00:00:00Z',
        created_by: 'user-1',
      };

      mockExerciseRepository.save.mockResolvedValue(ResultUtils.ok(undefined));

      const result = await service.createExerciseWithMidiFile(midiData);

      expect(result).toEqual(
        expect.objectContaining({
          title: 'MIDI Exercise',
          midi_file_path: '/uploads/test.midi',
        }),
      );
      expect(mockExerciseRepository.save).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when save fails for MIDI exercise', async () => {
      const midiData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'MIDI Exercise',
        description: 'From MIDI file',
        difficulty: 'intermediate',
        duration: 240,
        bpm: 110,
        key: 'D',
        notes: [],
        midi_file_path: '/uploads/test.midi',
        original_filename: 'test.midi',
        file_size: 2048,
        uploaded_at: '2024-01-01T00:00:00Z',
        created_by: 'user-1',
      };

      mockExerciseRepository.save.mockResolvedValue(
        ResultUtils.fail(new Error('Database save error')),
      );

      await expect(
        service.createExerciseWithMidiFile(midiData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // NOTE: Custom bassline tests have been removed
  // These are now handled in user-basslines.service.spec.ts
});
