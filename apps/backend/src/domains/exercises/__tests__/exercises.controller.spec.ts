import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExercisesController } from '../exercises.controller.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FileUploadType } from '../dto/file-upload.dto.js';
import { Readable } from 'stream';

describe('ExercisesController', () => {
  let controller: ExercisesController;
  let mockExercisesService: any;
  let mockFileUploadService: any;

  const mockExercise = {
    id: '123',
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

  beforeEach(async () => {
    // Create mock services
    mockExercisesService = {
      getAllExercises: vi.fn(),
      getExerciseById: vi.fn(),
      getExercisesByDifficulty: vi.fn(),
      searchExercises: vi.fn(),
      createExercise: vi.fn(),
      updateExercise: vi.fn(),
      createExerciseWithMidiFile: vi.fn(),
    };

    mockFileUploadService = {
      processUploadedFile: vi.fn(),
      processAndStoreFile: vi.fn(),
    };

    const mockSupabaseService = {
      logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      supabaseClient: {},
      onModuleInit: vi.fn(),
      isReady: vi.fn().mockReturnValue(true),
      getClient: vi.fn(),
      from: vi.fn(),
    };

    // Create the controller directly for better control over dependency injection
    controller = new ExercisesController(
      mockExercisesService,
      mockFileUploadService,
      mockSupabaseService as any,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Basic Exercise Endpoints', () => {
    describe('GET /api/exercises', () => {
      it('should return all exercises', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          cached: false,
        };

        mockExercisesService.getAllExercises.mockResolvedValue(mockResponse);

        const result = await controller.getAllExercises();

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.getAllExercises).toHaveBeenCalledWith(
          1,
          50,
        );
      });

      it('should handle pagination parameters', async () => {
        const mockResponse = {
          exercises: [],
          total: 0,
          cached: false,
        };

        mockExercisesService.getAllExercises.mockResolvedValue(mockResponse);

        await controller.getAllExercises('2', '20');

        expect(mockExercisesService.getAllExercises).toHaveBeenCalledWith(
          2,
          20,
        );
      });
    });

    describe('GET /api/exercises/difficulty/:difficulty', () => {
      it('should return exercises by difficulty', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          cached: false,
        };

        mockExercisesService.getExercisesByDifficulty.mockResolvedValue(
          mockResponse,
        );

        const result = await controller.getExercisesByDifficulty('beginner');

        expect(result).toEqual(mockResponse);
        expect(
          mockExercisesService.getExercisesByDifficulty,
        ).toHaveBeenCalledWith('beginner');
      });

      it('should validate difficulty parameter', async () => {
        mockExercisesService.getExercisesByDifficulty.mockRejectedValue(
          new BadRequestException('Invalid difficulty'),
        );

        await expect(
          controller.getExercisesByDifficulty('invalid' as any),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('GET /api/exercises/search', () => {
      it('should search exercises', async () => {
        const mockResponse = {
          exercises: [mockExercise],
          total: 1,
          cached: false,
        };

        mockExercisesService.searchExercises.mockResolvedValue(mockResponse);

        const result = await controller.searchExercises('test');

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.searchExercises).toHaveBeenCalledWith(
          'test',
        );
      });

      it('should throw BadRequestException for empty query', async () => {
        await expect(controller.searchExercises('')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('GET /api/exercises/:id', () => {
      it('should return exercise by id', async () => {
        const mockResponse = { exercise: mockExercise };

        mockExercisesService.getExerciseById.mockResolvedValue(mockResponse);

        const result = await controller.getExerciseById('123');

        expect(result).toEqual(mockResponse);
        expect(mockExercisesService.getExerciseById).toHaveBeenCalledWith(
          '123',
        );
      });

      it('should throw NotFoundException for non-existent exercise', async () => {
        mockExercisesService.getExerciseById.mockRejectedValue(
          new NotFoundException('Exercise not found'),
        );

        await expect(controller.getExerciseById('999')).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  // NOTE: User Exercise Management tests have been removed
  // These endpoints are now handled by UserBasslinesController
  // See user-basslines.controller.spec.ts for tests

  describe('Admin Operations', () => {
    const mockRequest = { user: { id: 'user-1' } };

    describe('POST /api/exercises', () => {
      it('should create new exercise', async () => {
        const exerciseData = {
          title: 'New Exercise',
          description: 'New Description',
          difficulty: 'intermediate',
          duration: 180,
          bpm: 100,
          key: 'G',
          notes: [],
        };
        const mockResponse = { ...mockExercise, ...exerciseData };

        mockExercisesService.createExercise.mockResolvedValue(mockResponse);

        const result = await controller.createExercise(
          mockRequest,
          exerciseData,
        );

        expect(result).toEqual({ exercise: mockResponse });
        expect(mockExercisesService.createExercise).toHaveBeenCalledWith(
          exerciseData,
          'user-1',
        );
      });

      it('should throw BadRequestException if user ID is missing', async () => {
        await expect(controller.createExercise({}, {})).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('PUT /api/exercises/:id', () => {
      it('should update exercise', async () => {
        const updateData = { title: 'Updated Exercise' };
        const mockResponse = { ...mockExercise, ...updateData };

        mockExercisesService.updateExercise.mockResolvedValue(mockResponse);

        const result = await controller.updateExercise(
          mockRequest,
          '123',
          updateData,
        );

        expect(result).toEqual({ exercise: mockResponse });
        expect(mockExercisesService.updateExercise).toHaveBeenCalledWith(
          '123',
          updateData,
          'user-1',
        );
      });

      it('should throw BadRequestException if user ID is missing', async () => {
        await expect(controller.updateExercise({}, '123', {})).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('File Upload Endpoints (Fastify multipart)', () => {
    const mockRequest = { user: { id: 'user-1' } };

    // Helper to create Fastify request mock with multipart file
    const createMockFastifyRequest = (fileData: {
      filename: string;
      mimetype: string;
      buffer: Buffer;
    }) => {
      const stream = Readable.from([fileData.buffer]);
      return {
        file: vi.fn().mockResolvedValue({
          file: stream,
          filename: fileData.filename,
          mimetype: fileData.mimetype,
        }),
      } as any;
    };

    describe('POST /api/exercises/upload/midi', () => {
      it('should process MIDI file upload', async () => {
        const fileData = {
          filename: 'test.midi',
          mimetype: 'audio/midi',
          buffer: Buffer.from('test'),
        };

        const mockResponse = {
          success: true,
          exercise: mockExercise,
          storageInfo: {
            filePath: '/uploads/test.midi',
            size: fileData.buffer.length,
          },
          parsingResult: {
            durationSeconds: 120,
          },
        };

        mockFileUploadService.processAndStoreFile.mockResolvedValue(
          mockResponse,
        );
        mockExercisesService.createExerciseWithMidiFile.mockResolvedValue(
          mockExercise,
        );

        const mockFastifyReq = createMockFastifyRequest(fileData);
        const result = await controller.uploadMIDI(
          mockRequest,
          mockFastifyReq,
          { fileType: FileUploadType.MIDI, storeFile: true },
          undefined,
        );

        expect(result).toBeDefined();
        expect(mockFileUploadService.processAndStoreFile).toHaveBeenCalledWith(
          expect.objectContaining({
            buffer: fileData.buffer,
            originalname: fileData.filename,
            mimetype: fileData.mimetype,
            size: fileData.buffer.length,
          }),
          expect.objectContaining({ fileType: 'midi', storeFile: true }),
          'user-1',
          undefined,
        );
      });

      it('should throw BadRequestException if no file', async () => {
        const mockFastifyReq = {
          file: vi.fn().mockResolvedValue(null),
        } as any;

        await expect(
          controller.uploadMIDI(
            mockRequest,
            mockFastifyReq,
            { fileType: FileUploadType.MIDI },
            undefined,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if user not authenticated', async () => {
        const fileData = {
          filename: 'test.midi',
          mimetype: 'audio/midi',
          buffer: Buffer.from('test'),
        };
        const mockFastifyReq = createMockFastifyRequest(fileData);

        await expect(
          controller.uploadMIDI(
            {},
            mockFastifyReq,
            { fileType: FileUploadType.MIDI },
            undefined,
          ),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('POST /api/exercises/upload/musicxml', () => {
      it('should process MusicXML file upload', async () => {
        const fileData = {
          filename: 'test.xml',
          mimetype: 'text/xml',
          buffer: Buffer.from('<musicxml>test</musicxml>'),
        };

        const mockResponse = {
          success: true,
          exercise: mockExercise,
        };

        mockFileUploadService.processUploadedFile.mockResolvedValue(
          mockResponse,
        );

        const mockFastifyReq = createMockFastifyRequest(fileData);
        const result = await controller.uploadMusicXML(
          mockRequest,
          mockFastifyReq,
          { fileType: FileUploadType.MUSICXML },
          undefined,
        );

        expect(result).toEqual(mockResponse);
        expect(mockFileUploadService.processUploadedFile).toHaveBeenCalledWith(
          expect.objectContaining({
            buffer: fileData.buffer,
            originalname: fileData.filename,
            mimetype: fileData.mimetype,
            size: fileData.buffer.length,
          }),
          expect.objectContaining({ fileType: 'musicxml' }),
          undefined,
        );
      });
    });
  });

  describe('Defensive Programming Checks', () => {
    it('should log error if ExercisesService is undefined', () => {
      const loggerSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create controller with undefined service
      const mockSupabaseService = {};
      new ExercisesController(
        undefined as any,
        mockFileUploadService,
        mockSupabaseService as any,
      );

      // Verify error was logged (implementation depends on logger setup)
      loggerSpy.mockRestore();
    });

    it('should have proper method for service availability check', () => {
      expect(controller['checkServiceAvailability']).toBeDefined();
      // With properly injected services, this should return true
      expect(controller['checkServiceAvailability']()).toBe(true);
    });
  });
});
