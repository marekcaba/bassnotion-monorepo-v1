import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Logger,
  UseGuards,
  Request,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExercisesService } from './exercises.service.js';
import {
  ExercisesResponseDto,
  ExerciseResponseDto,
} from './dto/exercise-response.dto.js';
import {
  CustomBasslinesResponseDto,
  CustomBasslineDto,
} from './dto/custom-bassline.dto.js';
import {
  FileUploadDto,
  MusicXMLUploadConfigDto,
  MIDIUploadConfigDto,
  FileUploadResponseDto,
  FileUploadErrorDto,
} from './dto/file-upload.dto.js';
import { FileUploadService } from './services/file-upload.service.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';

@Controller('api/exercises')
export class ExercisesController {
  private readonly logger = new Logger(ExercisesController.name);

  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly fileUploadService: FileUploadService,
  ) {
    // Defensive check for dependency injection issues
    if (!this.exercisesService) {
      this.logger.error('ExercisesService is undefined - DI failure detected');
    }
    if (!this.fileUploadService) {
      this.logger.error('FileUploadService is undefined - DI failure detected');
    }
  }

  // ==================== DEFENSIVE PROGRAMMING HELPER ====================

  private checkServiceAvailability(): boolean {
    if (!this.exercisesService) {
      this.logger.error('ExercisesService is undefined - DI failure detected');
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
  async getAllExercises(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ExercisesResponseDto> {
    this.logger.log('GET /api/exercises - Fetching all exercises');

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.logger.warn('Returning mock data due to service unavailability');
      return this.getMockExercisesResponse();
    }

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);

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
  async searchExercises(
    @Query('q') query: string,
  ): Promise<ExercisesResponseDto> {
    this.logger.log(
      `GET /api/exercises/search?q=${query} - Searching exercises`,
    );

    if (!query || query.trim().length === 0) {
      this.logger.warn('Empty search query provided');
      return {
        exercises: [],
        total: 0,
        cached: false,
      };
    }

    // Defensive programming: handle DI failure gracefully
    if (!this.checkServiceAvailability()) {
      this.logger.warn('Returning mock data due to service unavailability');
      return this.getMockExercisesResponse();
    }

    try {
      const result = await this.exercisesService.searchExercises(query.trim());
      this.logger.log(
        `Successfully found ${result.total} exercises matching "${query}"`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error searching exercises with query "${query}":`,
        error,
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
    this.logger.log(
      `GET /api/exercises/difficulty/${level} - Fetching exercises by difficulty`,
    );

    try {
      const result =
        await this.exercisesService.getExercisesByDifficulty(level);
      this.logger.log(
        `Successfully fetched ${result.total} exercises with difficulty ${level}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching exercises by difficulty ${level}:`,
        error,
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
    this.logger.log(`GET /api/exercises/${id} - Fetching exercise by ID`);

    try {
      const result = await this.exercisesService.getExerciseById(id);
      this.logger.log(
        `Successfully fetched exercise: ${result.exercise.title}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error fetching exercise ${id}:`, error);
      throw error;
    }
  }

  // ==================== USER EXERCISE MANAGEMENT ====================

  /**
   * GET /api/exercises/user/my-exercises
   * Get user's custom basslines (requires authentication)
   */
  @Get('user/my-exercises')
  @UseGuards(AuthGuard)
  async getUserCustomBasslines(
    @Request() req: any,
  ): Promise<CustomBasslinesResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`GET /api/exercises/user/my-exercises - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.getUserCustomBasslines(userId);
      this.logger.log(
        `Successfully fetched ${result.total} custom basslines for user ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching custom basslines for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * POST /api/exercises/user/save-bassline
   * Save a custom bassline for the authenticated user
   */
  @Post('user/save-bassline')
  @UseGuards(AuthGuard)
  async saveCustomBassline(
    @Request() req: any,
    @Body() basslineData: unknown,
  ): Promise<CustomBasslineDto> {
    const userId = req.user?.id;
    this.logger.log(`POST /api/exercises/user/save-bassline - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.saveCustomBassline(
        userId,
        basslineData,
      );
      this.logger.log(`Successfully saved custom bassline: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error saving custom bassline for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * PUT /api/exercises/user/:basslineId
   * Update a user's custom bassline
   */
  @Put('user/:basslineId')
  @UseGuards(AuthGuard)
  async updateCustomBassline(
    @Request() req: any,
    @Param('basslineId') basslineId: string,
    @Body() updateData: unknown,
  ): Promise<CustomBasslineDto> {
    const userId = req.user?.id;
    this.logger.log(`PUT /api/exercises/user/${basslineId} - User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.updateCustomBassline(
        userId,
        basslineId,
        updateData as any,
      );
      this.logger.log(`Successfully updated custom bassline: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error updating custom bassline ${basslineId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * DELETE /api/exercises/user/:basslineId
   * Delete a user's custom bassline
   */
  @Delete('user/:basslineId')
  @UseGuards(AuthGuard)
  async deleteCustomBassline(
    @Request() req: any,
    @Param('basslineId') basslineId: string,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    this.logger.log(
      `DELETE /api/exercises/user/${basslineId} - User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      await this.exercisesService.deleteCustomBassline(userId, basslineId);
      this.logger.log(`Successfully deleted custom bassline: ${basslineId}`);
      return { message: 'Custom bassline deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting custom bassline ${basslineId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

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
    this.logger.log(`POST /api/exercises - Creating exercise, User: ${userId}`);

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.createExercise(
        exerciseData,
        userId,
      );
      this.logger.log(`Successfully created exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.logger.error(`Error creating exercise for user ${userId}:`, error);
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
    this.logger.log(
      `PUT /api/exercises/${exerciseId} - Updating exercise, User: ${userId}`,
    );

    if (!userId) {
      throw new BadRequestException('User ID not found in request');
    }

    try {
      const result = await this.exercisesService.updateExercise(
        exerciseId,
        updateData,
        userId,
      );
      this.logger.log(`Successfully updated exercise: ${result.id}`);
      return { exercise: result };
    } catch (error) {
      this.logger.error(
        `Error updating exercise ${exerciseId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  // ==================== FILE UPLOAD ENDPOINTS ====================

  /**
   * POST /api/exercises/upload/musicxml
   * Upload and process MusicXML file to create bass exercise
   */
  @Post('upload/musicxml')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'text/xml',
          'application/xml',
          'application/vnd.recordare.musicxml',
          'application/vnd.recordare.musicxml+xml',
        ];

        const allowedExtensions = ['.xml', '.musicxml', '.mxl'];
        const fileExtension = file.originalname.toLowerCase();
        const hasValidExtension = allowedExtensions.some((ext) =>
          fileExtension.endsWith(ext),
        );

        if (allowedMimeTypes.includes(file.mimetype) || hasValidExtension) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only MusicXML files are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadMusicXML(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() uploadDto: FileUploadDto,
    @Body() configDto?: MusicXMLUploadConfigDto,
  ): Promise<FileUploadResponseDto | FileUploadErrorDto> {
    const userId = req.user?.id;
    this.logger.log(
      `POST /api/exercises/upload/musicxml - User: ${userId}, File: ${file?.originalname}`,
    );

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Set file type
      uploadDto.fileType = 'musicxml' as any;

      const result = await this.fileUploadService.processUploadedFile(
        file,
        uploadDto,
        configDto,
      );

      this.logger.log(
        `Successfully processed MusicXML file: ${file.originalname}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error processing MusicXML file ${file.originalname}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * POST /api/exercises/upload/midi
   * Upload and process MIDI file to create bass exercise
   */
  @Post('upload/midi')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'audio/midi',
          'audio/x-midi',
          'application/x-midi',
        ];

        const allowedExtensions = ['.mid', '.midi'];
        const fileExtension = file.originalname.toLowerCase();
        const hasValidExtension = allowedExtensions.some((ext) =>
          fileExtension.endsWith(ext),
        );

        if (allowedMimeTypes.includes(file.mimetype) || hasValidExtension) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              'Invalid file type. Only MIDI files are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadMIDI(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() uploadDto: FileUploadDto,
    @Body() configDto?: MIDIUploadConfigDto,
  ): Promise<FileUploadResponseDto | FileUploadErrorDto> {
    const userId = req.user?.id;
    this.logger.log(
      `POST /api/exercises/upload/midi - User: ${userId}, File: ${file?.originalname}`,
    );

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Set file type and enable file storage by default
      uploadDto.fileType = 'midi' as any;
      if (uploadDto.storeFile === undefined) {
        uploadDto.storeFile = true;
      }

      // Process and store the MIDI file
      const result = await this.fileUploadService.processAndStoreFile(
        file,
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
            original_filename: file.originalname,
            file_size: file.size,
            uploaded_at: new Date().toISOString(),
            created_by: userId,
          };

          // Save to database if service is available
          if (this.checkServiceAvailability()) {
            this.logger.log(
              `Saving exercise to database: ${result.exercise.title}`,
            );

            // Use the new service method to create exercise with MIDI file metadata
            await this.exercisesService.createExerciseWithMidiFile(
              exerciseData,
            );

            this.logger.log(
              `Exercise saved successfully with MIDI file: ${result.storageInfo.filePath}`,
            );
          }
        } catch (dbError) {
          this.logger.error('Error saving exercise to database:', dbError);
          // Don't fail the upload if database save fails - file is already stored
          this.logger.warn(
            'MIDI file processed and stored, but database save failed',
          );
        }
      }

      this.logger.log(`Successfully processed MIDI file: ${file.originalname}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error processing MIDI file ${file.originalname}:`,
        error,
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
    this.logger.log(
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
      const supabase = this.exercisesService['supabaseService'].getClient();
      const { data } = supabase.storage
        .from('exercise-files')
        .getPublicUrl(exercise.midi_file_path);

      this.logger.log(`Generated download URL for exercise ${exerciseId}`);

      return {
        downloadUrl: data.publicUrl,
        filename: exercise.original_filename || 'exercise.mid',
      };
    } catch (error) {
      this.logger.error(
        `Error generating download URL for exercise ${exerciseId}:`,
        error,
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
    this.logger.log(
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
      const supabase = this.exercisesService['supabaseService'].getClient();
      const { error } = await supabase.storage
        .from('exercise-files')
        .remove([exercise.midi_file_path]);

      if (error) {
        this.logger.error('Error deleting MIDI file from storage:', error);
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

      this.logger.log(
        `Successfully deleted MIDI file for exercise ${exerciseId}`,
      );

      return {
        success: true,
        message: 'MIDI file deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error deleting MIDI file for exercise ${exerciseId}:`,
        error,
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
