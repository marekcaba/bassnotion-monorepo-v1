import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ExercisesService } from './exercises.service.js';
import {
  ExercisesResponseDto,
  ExerciseResponseDto,
} from './dto/exercise-response.dto.js';
// Custom bassline DTOs are now used in UserBasslinesController
import {
  FileUploadDto,
  MusicXMLUploadConfigDto,
  MIDIUploadConfigDto,
  FileUploadResponseDto,
  FileUploadErrorDto,
} from './dto/file-upload.dto.js';
import { FileUploadService } from './services/file-upload.service.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { UploadRateLimit } from '../../shared/decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../../shared/guards/rate-limit.guard.js';

@ApiTags('exercises')
@Controller('api/exercises')
export class ExercisesController {
  private readonly staticLogger = createStructuredLogger(
    ExercisesController.name,
  );

  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly fileUploadService: FileUploadService,
    private readonly supabaseService: SupabaseService,
  ) {
    // Defensive check for dependency injection issues
    if (!this.exercisesService) {
      this.staticLogger.error(
        'ExercisesService is undefined - DI failure detected',
      );
    }
    if (!this.fileUploadService) {
      this.staticLogger.error(
        'FileUploadService is undefined - DI failure detected',
      );
    }
  }

  // ==================== DEFENSIVE PROGRAMMING HELPER ====================

  private checkServiceAvailability(): boolean {
    if (!this.exercisesService) {
      this.staticLogger.error(
        'ExercisesService is undefined - DI failure detected',
      );
      return false;
    }
    return true;
  }

  private getMockExercisesResponse(): ExercisesResponseDto {
    return {
      exercises: [
        {
          id: 'mock-1',
          title: 'Mock Exercise 1',
          description: 'This is a mock exercise due to service unavailability',
          difficulty: 'beginner',
          duration: 60000,
          bpm: 120,
          key: 'E',
          notes: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'mock-2',
          title: 'Mock Exercise 2',
          description:
            'This is another mock exercise due to service unavailability',
          difficulty: 'intermediate',
          duration: 90000,
          bpm: 100,
          key: 'A',
          notes: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total: 2,
      cached: false,
    };
  }

  /**
   * GET /api/exercises
   * Get all active exercises with pagination support
   */
  @Get()
  @ApiOperation({ summary: 'Get all active exercises with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of exercises retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  async getAllExercises(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ExercisesResponseDto> {
    this.staticLogger.info('GET /api/exercises - Fetching all exercises');

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.staticLogger.warn(
        'Returning mock data due to service unavailability',
      );
      return this.getMockExercisesResponse();
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '50', 10);

    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return this.exercisesService.getAllExercises(pageNum, limitNum);
  }

  /**
   * GET /api/exercises/search?q=term
   * Search exercises by title or description
   */
  @Get('search')
  @ApiOperation({ summary: 'Search exercises by title or description' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
  })
  async searchExercises(
    @Query('q') query: string,
  ): Promise<ExercisesResponseDto> {
    this.staticLogger.info(
      `GET /api/exercises/search?q=${query} - Searching exercises`,
    );

    if (!query || query.trim().length === 0) {
      this.staticLogger.warn('Empty search query provided');
      throw new BadRequestException('Search query cannot be empty');
    }

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.staticLogger.warn(
        'Returning mock data due to service unavailability',
      );
      return this.getMockExercisesResponse();
    }

    try {
      const result = await this.exercisesService.searchExercises(query.trim());
      this.staticLogger.info(
        `Successfully found ${result.total} exercises matching "${query}"`,
      );
      return result;
    } catch (error) {
      this.staticLogger.error(
        `Error searching exercises with query "${query}":`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/difficulty/:level
   * Get exercises filtered by difficulty level
   */
  @Get('difficulty/:level')
  async getExercisesByDifficulty(
    @Param('level') level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<ExercisesResponseDto> {
    this.staticLogger.info(
      `GET /api/exercises/difficulty/${level} - Fetching exercises by difficulty`,
    );

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.staticLogger.warn(
        'Returning mock data due to service unavailability',
      );
      return this.getMockExercisesResponse();
    }

    try {
      const result =
        await this.exercisesService.getExercisesByDifficulty(level);
      this.staticLogger.info(
        `Successfully fetched ${result.total} exercises with difficulty ${level}`,
      );
      return result;
    } catch (error) {
      this.staticLogger.error(
        `Error fetching exercises by difficulty ${level}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/:id
   * Get a specific exercise by ID
   */
  @Get(':id')
  async getExerciseById(@Param('id') id: string): Promise<ExerciseResponseDto> {
    this.staticLogger.info(
      `GET /api/exercises/${id} - Fetching exercise by ID`,
    );

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.staticLogger.warn(
        'Returning mock data due to service unavailability',
      );
      const mockResponse = this.getMockExercisesResponse();
      return { exercise: mockResponse.exercises[0] };
    }

    try {
      const result = await this.exercisesService.getExerciseById(id);
      this.staticLogger.info(
        `Successfully fetched exercise: ${result.exercise.title}`,
      );
      return result;
    } catch (error) {
      this.staticLogger.error(`Error fetching exercise ${id}:`, error as Error);
      throw error;
    }
  }

  // NOTE: User bassline management endpoints have been moved to UserBasslinesController
  // The following endpoints are now available at /api/user-basslines:
  // - GET /api/user-basslines (get user's saved basslines)
  // - POST /api/user-basslines (save new bassline)
  // - PUT /api/user-basslines/:id/rename (rename bassline)
  // - DELETE /api/user-basslines/:id (delete bassline)

  // ==================== EPIC 5 ADMIN OPERATIONS ====================

  /**
   * POST /api/exercises
   * Create a new exercise (Epic 5 preparation - requires authentication)
   */
  @Post()
  @UseGuards(AuthGuard)
  async createExercise(
    @Request() req: any,
    @Body() exerciseData: unknown,
  ): Promise<ExerciseResponseDto> {
    const userId = req.user?.id;
    this.staticLogger.info(
      `POST /api/exercises - Creating exercise, User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      throw new BadRequestException('Service unavailable');
    }

    try {
      const result = await this.exercisesService.createExercise(
        exerciseData,
        userId,
      );
      this.staticLogger.info(`Successfully created exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.staticLogger.error(
        `Error creating exercise for user ${userId}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * PUT /api/exercises/:id
   * Update an existing exercise (Epic 5 preparation - requires authentication)
   */
  @Put(':id')
  @UseGuards(AuthGuard)
  async updateExercise(
    @Request() req: any,
    @Param('id') exerciseId: string,
    @Body() updateData: unknown,
  ): Promise<ExerciseResponseDto> {
    const userId = req.user?.id;
    this.staticLogger.info(
      `PUT /api/exercises/${exerciseId} - Updating exercise, User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      throw new BadRequestException('Service unavailable');
    }

    try {
      const result = await this.exercisesService.updateExercise(
        exerciseId,
        updateData,
        userId,
      );
      this.staticLogger.info(`Successfully updated exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.staticLogger.error(
        `Error updating exercise ${exerciseId} for user ${userId}:`,
        error as Error,
      );
      throw error;
    }
  }

  // ==================== FILE UPLOAD ENDPOINTS ====================

  /**
   * POST /api/exercises/upload/musicxml
   * Upload and process MusicXML file to create bass exercise
   *
   * FIXED: Using Fastify multipart instead of Express FileInterceptor
   * SECURITY: Rate limited to 10 uploads per hour per user to prevent DoS
   */
  @Post('upload/musicxml')
  @UseGuards(AuthGuard, RateLimitGuard)
  @UploadRateLimit()
  async uploadMusicXML(
    @Request() req: any,
    @Req() fastifyReq: FastifyRequest,
    @Body() uploadDto: FileUploadDto,
    @Body() configDto?: MusicXMLUploadConfigDto,
  ): Promise<FileUploadResponseDto | FileUploadErrorDto> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // Get multipart file from Fastify request
    const data = await fastifyReq.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const { file: fileStream, filename, mimetype } = data;

    // Read file buffer from stream
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const fileSize = buffer.length;

    this.staticLogger.info(
      `POST /api/exercises/upload/musicxml - User: ${userId}, File: ${filename}`,
    );

    // Validation: file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE} bytes)`,
      );
    }

    // Validation: file type
    const allowedMimeTypes = [
      'text/xml',
      'application/xml',
      'application/vnd.recordare.musicxml',
      'application/vnd.recordare.musicxml+xml',
    ];
    const allowedExtensions = ['.xml', '.musicxml', '.mxl'];
    const fileExtension = filename.toLowerCase();
    const hasValidExtension = allowedExtensions.some((ext) =>
      fileExtension.endsWith(ext),
    );

    if (!allowedMimeTypes.includes(mimetype) && !hasValidExtension) {
      throw new BadRequestException(
        'Invalid file type. Only MusicXML files are allowed.',
      );
    }

    // Defensive programming: check file upload service
    if (!this.fileUploadService) {
      throw new BadRequestException('File upload service unavailable');
    }

    try {
      // Set file type
      uploadDto.fileType = 'musicxml' as any;

      // Create file object compatible with existing service
      const fileObject = {
        buffer,
        originalname: filename,
        mimetype,
        size: fileSize,
      };

      const result = await this.fileUploadService.processUploadedFile(
        fileObject,
        uploadDto,
        configDto,
      );

      this.staticLogger.info(
        `Successfully processed MusicXML file: ${filename}`,
      );
      return result;
    } catch (error) {
      this.staticLogger.error(
        `Error processing MusicXML file ${filename}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * POST /api/exercises/upload/midi
   * Upload and process MIDI file to create bass exercise
   *
   * FIXED: Using Fastify multipart instead of Express FileInterceptor
   * SECURITY: Rate limited to 10 uploads per hour per user to prevent DoS
   */
  @Post('upload/midi')
  @UseGuards(AuthGuard, RateLimitGuard)
  @UploadRateLimit()
  async uploadMIDI(
    @Request() req: any,
    @Req() fastifyReq: FastifyRequest,
    @Body() uploadDto: FileUploadDto,
    @Body() configDto?: MIDIUploadConfigDto,
  ): Promise<FileUploadResponseDto | FileUploadErrorDto> {
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // Get multipart file from Fastify request
    const data = await fastifyReq.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const { file: fileStream, filename, mimetype } = data;

    // Read file buffer from stream
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const fileSize = buffer.length;

    this.staticLogger.info(
      `POST /api/exercises/upload/midi - User: ${userId}, File: ${filename}`,
    );

    // Validation: file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE} bytes)`,
      );
    }

    // Validation: file type
    const allowedMimeTypes = [
      'audio/midi',
      'audio/x-midi',
      'application/x-midi',
      'application/octet-stream', // Some systems report MIDI as this
    ];
    const allowedExtensions = ['.mid', '.midi'];
    const fileExtension = filename.toLowerCase();
    const hasValidExtension = allowedExtensions.some((ext) =>
      fileExtension.endsWith(ext),
    );

    if (!allowedMimeTypes.includes(mimetype) && !hasValidExtension) {
      throw new BadRequestException(
        'Invalid file type. Only MIDI files are allowed.',
      );
    }

    // Defensive programming: check file upload service
    if (!this.fileUploadService) {
      throw new BadRequestException('File upload service unavailable');
    }

    try {
      // Set file type and enable file storage by default
      uploadDto.fileType = 'midi' as any;
      if (uploadDto.storeFile === undefined) {
        uploadDto.storeFile = true;
      }

      // Create file object compatible with existing service
      const fileObject = {
        buffer,
        originalname: filename,
        mimetype,
        size: fileSize,
      };

      // Process and store the MIDI file
      const result = await this.fileUploadService.processAndStoreFile(
        fileObject,
        uploadDto,
        userId,
        configDto,
      );

      // If file processing was successful and an exercise was created, save it to database
      if (result.success && result.exercise && result.storageInfo) {
        try {
          // Create the exercise in the database with file metadata
          const exerciseData = {
            id: result.exercise.id,
            title: result.exercise.title,
            description: result.exercise.description || '',
            difficulty: result.exercise.difficulty as any,
            duration: result.parsingResult?.durationSeconds
              ? Math.round(result.parsingResult.durationSeconds * 1000)
              : 30000, // Default 30 seconds if not available
            bpm: result.exercise.bpm,
            key: result.exercise.key,
            notes: [], // We'll need to get the notes from the actual parsed exercise
            midi_file_path: result.storageInfo.filePath,
            original_filename: filename,
            file_size: fileSize,
            uploaded_at: new Date().toISOString(),
            created_by: userId,
          };

          // Save to database if service is available
          if (this.checkServiceAvailability()) {
            this.staticLogger.info(
              `Saving exercise to database: ${result.exercise.title}`,
            );

            // Use the new service method to create exercise with MIDI file metadata
            await this.exercisesService.createExerciseWithMidiFile(
              exerciseData,
            );

            this.staticLogger.info(
              `Exercise saved successfully with MIDI file: ${result.storageInfo.filePath}`,
            );
          }
        } catch (dbError) {
          this.staticLogger.error(
            'Error saving exercise to database:',
            dbError as Error,
          );
          // Don't fail the upload if database save fails - file is already stored
          this.staticLogger.warn(
            'MIDI file processed and stored, but database save failed',
          );
        }
      }

      this.staticLogger.info(`Successfully processed MIDI file: ${filename}`);
      return result;
    } catch (error) {
      this.staticLogger.error(
        `Error processing MIDI file ${filename}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/:id/download-midi
   * Download the MIDI file associated with an exercise
   */
  @Get(':id/download-midi')
  @UseGuards(AuthGuard)
  async downloadMidiFile(
    @Param('id') exerciseId: string,
    @Request() req: any,
  ): Promise<{ downloadUrl: string; filename: string } | { error: string }> {
    const userId = req.user?.id;
    this.staticLogger.info(
      `GET /api/exercises/${exerciseId}/download-midi - User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    try {
      // Get exercise with MIDI file path
      if (!this.checkServiceAvailability()) {
        throw new BadRequestException('Service unavailable');
      }

      const exerciseResponse =
        await this.exercisesService.getExerciseById(exerciseId);
      const exercise = exerciseResponse.exercise;

      if (!exercise.midi_file_path) {
        return { error: 'No MIDI file associated with this exercise' };
      }

      // Generate download URL for the MIDI file
      const supabase = this.supabaseService.getClient();
      const { data } = supabase.storage
        .from('exercise-files')
        .getPublicUrl(exercise.midi_file_path);

      this.staticLogger.info(
        `Generated download URL for exercise ${exerciseId}`,
      );

      return {
        downloadUrl: data.publicUrl,
        filename: exercise.original_filename || 'exercise.mid',
      };
    } catch (error) {
      this.staticLogger.error(
        `Error generating download URL for exercise ${exerciseId}:`,
        error as Error,
      );
      return { error: 'Failed to generate download URL' };
    }
  }

  /**
   * DELETE /api/exercises/:id/midi-file
   * Delete the MIDI file associated with an exercise
   */
  @Delete(':id/midi-file')
  @UseGuards(AuthGuard)
  async deleteMidiFile(
    @Param('id') exerciseId: string,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.id;
    this.staticLogger.info(
      `DELETE /api/exercises/${exerciseId}/midi-file - User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    try {
      // Get exercise and verify ownership
      if (!this.checkServiceAvailability()) {
        throw new BadRequestException('Service unavailable');
      }

      const exerciseResponse =
        await this.exercisesService.getExerciseById(exerciseId);
      const exercise = exerciseResponse.exercise;

      // Check if user owns the exercise
      if (exercise.created_by !== userId) {
        throw new BadRequestException('Not authorized to delete this file');
      }

      if (!exercise.midi_file_path) {
        return {
          success: false,
          message: 'No MIDI file associated with this exercise',
        };
      }

      // Delete file from storage
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase.storage
        .from('exercise-files')
        .remove([exercise.midi_file_path]);

      if (error) {
        this.staticLogger.error(
          'Error deleting MIDI file from storage:',
          error as Error,
        );
        throw new BadRequestException('Failed to delete MIDI file');
      }

      // Update exercise to remove MIDI file references
      await this.exercisesService.updateExercise(
        exerciseId,
        {
          midi_file_path: null,
          original_filename: null,
          file_size: null,
          uploaded_at: null,
        },
        userId,
      );

      this.staticLogger.info(
        `Successfully deleted MIDI file for exercise ${exerciseId}`,
      );

      return {
        success: true,
        message: 'MIDI file deleted successfully',
      };
    } catch (error) {
      this.staticLogger.error(
        `Error deleting MIDI file for exercise ${exerciseId}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * GET /api/exercises/upload/formats
   * Get supported file upload formats and configurations
   */
  @Get('upload/formats')
  async getSupportedFormats(): Promise<{
    musicxml: {
      extensions: string[];
      mimeTypes: string[];
      maxSizeBytes: number;
      features: string[];
    };
    midi: {
      extensions: string[];
      mimeTypes: string[];
      maxSizeBytes: number;
      features: string[];
    };
  }> {
    return {
      musicxml: {
        extensions: ['.xml', '.musicxml', '.mxl'],
        mimeTypes: [
          'text/xml',
          'application/xml',
          'application/vnd.recordare.musicxml',
          'application/vnd.recordare.musicxml+xml',
        ],
        maxSizeBytes: 10 * 1024 * 1024,
        features: [
          'Bass tablature conversion',
          'Articulation detection',
          'Multiple instrument support',
          'Automatic difficulty analysis',
        ],
      },
      midi: {
        extensions: ['.mid', '.midi'],
        mimeTypes: ['audio/midi', 'audio/x-midi', 'application/x-midi'],
        maxSizeBytes: 10 * 1024 * 1024,
        features: [
          'Automatic bass track detection',
          'Multiple tuning support',
          'Rhythm quantization',
          'Musical analysis',
          'Multiple bass string configurations',
        ],
      },
    };
  }
}
