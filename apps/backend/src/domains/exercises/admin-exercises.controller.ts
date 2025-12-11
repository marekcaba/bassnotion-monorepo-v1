import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AdminExercisesService } from './admin-exercises.service.js';
import { UpdateMidiStatusDto } from './dto/update-midi-status.dto.js';
import type { ConvertMidiRequestDto } from './dto/convert-midi-request.dto.js';
import { MidiParserService } from './services/midi-parser.service.js';
import { FretboardMapperService } from './services/fretboard-mapper.service.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { CorrelationId } from '../../shared/decorators/correlation-id.decorator.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

@ApiTags('admin-exercises')
@Controller('api/v1/exercises')
@UseGuards(AdminGuard)
export class AdminExercisesController {
  private readonly logger = new Logger(AdminExercisesController.name);

  constructor(
    private readonly exercisesService: AdminExercisesService,
    private readonly midiParserService: MidiParserService,
    private readonly fretboardMapperService: FretboardMapperService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tutorialId') tutorialId?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding all exercises`, {
      correlationId,
      page,
      limit,
      tutorialId,
    });

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (pageNum < 1 || limitNum < 1) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return await this.exercisesService.findAll({
      page: pageNum,
      limit: limitNum,
      tutorialId,
    });
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding exercise by ID: ${id}`, { correlationId });

    const exercise = await this.exercisesService.findById(id);
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return exercise;
  }

  @Get('tutorial/:tutorialId')
  async findByTutorialId(
    @Param('tutorialId') tutorialId: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding exercises for tutorial: ${tutorialId}`, {
      correlationId,
    });

    return await this.exercisesService.findByTutorialId(tutorialId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update exercise (upsert pattern)',
    description: `
**Story 4.4 Task 3.1**: Upsert pattern for seamless exercise saves from modal

**Behavior**:
- If \`id\` provided in body → Updates existing exercise
- If no \`id\` → Creates new exercise with server-assigned UUID
- Supports temp MIDI migration: \`temp_bassline_midi_path\` → permanent storage
- Atomic operation: Exercise metadata + MIDI + notes saved together

**New Features**:
- ✅ Notes array support (fretboard positions from MIDI conversion)
- ✅ Temp MIDI file migration (seamless upload → convert → save flow)
- ✅ No tutorial save required (individual exercise persistence)

**Example Request**:
\`\`\`json
{
  "tutorial_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Measure 1-4: Intro Riff",
  "description": "Opening bassline with slides",
  "bpm": 120,
  "total_bars": 4,
  "time_signature": { "numerator": 4, "denominator": 4 },
  "difficulty": "intermediate",
  "key": "E",
  "notes": [
    {
      "id": "note-1",
      "string": 1,
      "fret": 0,
      "note": "E",
      "color": "red",
      "duration": "quarter",
      "position": { "measure": 1, "beat": 1, "subdivision": 0 }
    }
  ],
  "temp_bassline_midi_path": "exercise-midi-temp/abc123.mid"
}
\`\`\`
    `.trim(),
  })
  @ApiBody({
    description: 'Exercise data with optional ID for upsert',
    schema: {
      type: 'object',
      required: ['tutorial_id', 'title', 'bpm'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Optional: Provide to update existing exercise',
        },
        tutorial_id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        bpm: { type: 'number', minimum: 40, maximum: 300 },
        total_bars: { type: 'number', minimum: 1, maximum: 32 },
        time_signature: {
          type: 'object',
          properties: {
            numerator: { type: 'number' },
            denominator: { type: 'number' },
          },
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        },
        key: { type: 'string' },
        notes: {
          type: 'array',
          items: { type: 'object' },
          description: 'Fretboard positions from MIDI conversion',
        },
        temp_bassline_midi_path: {
          type: 'string',
          description: 'Path to temp MIDI file (will be moved to permanent)',
        },
        bassline_midi_url: { type: 'string', format: 'uri' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Exercise created or updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (invalid BPM, notes, etc.)',
  })
  async create(
    @Body() createExerciseDto: any,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Creating/updating exercise (upsert)`, {
      correlationId,
      userId: user.id,
      exerciseId: createExerciseDto.id || 'new',
      title: createExerciseDto.title,
      tutorialId: createExerciseDto.tutorial_id,
      hasNotes: !!createExerciseDto.notes?.length,
      hasTempMidi: !!createExerciseDto.temp_bassline_midi_path,
    });

    // Use upsert pattern (Story 4.4 Task 3.1)
    return await this.exercisesService.upsert({
      ...createExerciseDto,
      created_by: user.id,
    });
  }

  @Post('upload-midi/:exerciseId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload MIDI file for exercise (bypasses RLS using service role)',
  })
  @ApiParam({ name: 'exerciseId', description: 'Exercise ID' })
  @ApiResponse({
    status: 200,
    description: 'MIDI file uploaded successfully',
    schema: { type: 'object', properties: { publicUrl: { type: 'string' } } },
  })
  async uploadMidi(
    @Req() request: FastifyRequest,
    @Param('exerciseId') exerciseId: string,
    @Query('type') type: 'bassline' | 'drummer' | 'harmony' | 'metronome',
    @CorrelationId() correlationId?: string,
  ) {
    if (!type) {
      throw new BadRequestException(
        'MIDI type is required (bassline, drummer, harmony, or metronome)',
      );
    }

    // Get the uploaded file using Fastify's multipart
    const data = await request.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const buffer = await data.toBuffer();

    this.logger.log(`Uploading MIDI file for exercise ${exerciseId}`, {
      correlationId,
      type,
      fileName: data.filename,
      fileSize: buffer.length,
    });

    const fileExt = data.filename.split('.').pop();
    const fileName = `${Date.now()}_${type}.${fileExt}`;
    const filePath = `exercises/${exerciseId}/${fileName}`;

    const publicUrl = await this.supabaseService.uploadFile(
      'exercise-midi-files',
      filePath,
      buffer,
      'audio/midi',
    );

    this.logger.log(
      `Successfully uploaded MIDI file for exercise ${exerciseId}`,
      {
        correlationId,
        type,
        publicUrl,
      },
    );

    return { publicUrl };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update existing exercise (partial update)',
    description: `
**Story 4.4 Task 3.2**: Partial update support with notes array

**Behavior**:
- Updates only provided fields (partial update)
- Supports notes array updates (Story 4.4)
- Supports temp MIDI migration (Story 4.4)
- Returns updated exercise or 404 if not found

**Use Cases**:
- Update exercise metadata after MIDI conversion
- Save generated fretboard positions (notes array)
- Update MIDI URLs after upload
    `.trim(),
  })
  @ApiParam({
    name: 'id',
    description: 'Exercise ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Exercise updated successfully' })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  async update(
    @Param('id') id: string,
    @Body() updateExerciseDto: any,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Updating exercise: ${id}`, {
      correlationId,
      userId: user.id,
      hasNotes: !!updateExerciseDto.notes?.length,
      hasTempMidi: !!updateExerciseDto.temp_bassline_midi_path,
    });

    const exercise = await this.exercisesService.update(id, updateExerciseDto);
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return exercise;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Deleting exercise: ${id}`, {
      correlationId,
      userId: user.id,
    });

    const result = await this.exercisesService.delete(id);
    if (!result) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }
  }

  @Post('batch/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Batch delete exercises' })
  @ApiResponse({ status: 204, description: 'Exercises deleted successfully' })
  async batchDelete(
    @Body() body: { ids: string[] },
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Batch deleting exercises`, {
      correlationId,
      userId: user.id,
      count: body.ids.length,
      ids: body.ids,
    });

    // Delete each exercise
    for (const id of body.ids) {
      const result = await this.exercisesService.delete(id);
      if (!result) {
        this.logger.warn(`Exercise ${id} not found during batch delete`, {
          correlationId,
        });
      }
    }
  }

  @Patch(':id/midi-status')
  async updateMidiStatus(
    @Param('id') id: string,
    @Body() updateMidiStatusDto: UpdateMidiStatusDto,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Updating MIDI status for exercise: ${id}`, {
      correlationId,
      ...updateMidiStatusDto,
    });

    const exercise = await this.exercisesService.updateMidiStatus(
      id,
      updateMidiStatusDto,
    );
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return exercise;
  }

  @Post('batch')
  async findByIds(
    @Body('ids') ids: string[],
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding exercises by IDs`, {
      correlationId,
      count: ids.length,
    });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Invalid IDs array');
    }

    return await this.exercisesService.findByIds(ids);
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('difficulty') difficulty?: string,
    @Query('tags') tags?: string,
    @Query('active') active?: string,
    @Query('bpmMin') bpmMin?: string,
    @Query('bpmMax') bpmMax?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Searching exercises`, {
      correlationId,
      query,
      filters: { difficulty, tags, active, bpmMin, bpmMax },
    });

    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    return await this.exercisesService.search({
      query,
      difficulty,
      tags: tags?.split(','),
      isActive: active === 'true',
      bpmMin: bpmMin ? parseInt(bpmMin, 10) : undefined,
      bpmMax: bpmMax ? parseInt(bpmMax, 10) : undefined,
    });
  }

  @Put(':id/reorder')
  async updateOrder(
    @Param('id') id: string,
    @Body('order_index') orderIndex: number,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(
      `Updating exercise order: ${id} to position ${orderIndex}`,
      {
        correlationId,
      },
    );

    const exercise = await this.exercisesService.updateOrder(id, orderIndex);
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return exercise;
  }

  @Get('difficulty/:difficulty')
  async findByDifficulty(
    @Param('difficulty') difficulty: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding exercises by difficulty: ${difficulty}`, {
      correlationId,
    });

    if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      throw new BadRequestException('Invalid difficulty level');
    }

    return await this.exercisesService.findByDifficulty(difficulty);
  }

  /**
   * Parse MIDI file for an exercise and group notes by measure
   * POST /api/v1/exercises/:id/midi/parse
   *
   * @deprecated Use POST /api/v1/midi/parse instead (stateless version)
   * This endpoint requires exercise to exist in database before parsing.
   * The new stateless endpoint works with any MIDI URL without DB dependency.
   *
   * Sunset date: 2 releases from Story 4.4 completion (approximately 6 months)
   * Migration guide: See docs/developer-handbook/MIGRATION_GUIDE_STORY_4.4.md
   */
  @Post(':id/midi/parse')
  @ApiOperation({
    summary: '[DEPRECATED] Parse MIDI file and group notes by measure',
    description: `
⚠️ DEPRECATED: Use POST /api/v1/midi/parse instead

This endpoint requires the exercise to exist in database before parsing.
The new stateless endpoint (POST /api/v1/midi/parse) works with any MIDI URL
without database dependency, enabling seamless upload → convert → save workflows.

**Why deprecated:**
- Requires exercise to be saved first (poor UX)
- Database dependency prevents horizontal scaling
- Forces multi-step workflow (upload → save → parse)

**Recommended alternative:**
POST /api/v1/midi/parse - Accepts MIDI URL + metadata directly

**Sunset timeline:**
- Deprecated: Story 4.4 completion (2025-12-06)
- Sunset: 2 releases later (~6 months)

Parses the bassline MIDI file for an exercise and groups notes by measure based on BPM and time signature.
    `.trim(),
    deprecated: true,
  })
  @ApiParam({
    name: 'id',
    description: 'Exercise ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'MIDI file parsed successfully',
    schema: {
      type: 'object',
      properties: {
        totalMeasures: { type: 'number', example: 4 },
        totalNotes: { type: 'number', example: 16 },
        durationSeconds: { type: 'number', example: 8 },
        measures: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              measureNumber: { type: 'number' },
              startTime: { type: 'number' },
              endTime: { type: 'number' },
              notes: { type: 'array' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid MIDI file or missing required metadata',
  })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  async parseMidi(
    @Param('id') id: string,
    @CorrelationId() correlationId?: string,
  ) {
    // Log deprecation warning
    this.logger.warn(
      `[DEPRECATED] Using legacy MIDI parse endpoint. Use POST /api/v1/midi/parse instead.`,
      {
        correlationId,
        exerciseId: id,
        deprecatedEndpoint: 'POST /exercises/:id/midi/parse',
        recommendedEndpoint: 'POST /api/v1/midi/parse',
        sunsetDate: '~6 months from 2025-12-06',
      },
    );

    this.logger.log(`Parsing MIDI for exercise: ${id}`, { correlationId });

    // Get exercise details
    const exercise = await this.exercisesService.findById(id);
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    // Validate exercise has MIDI file
    if (!exercise.basslineMidiUrl) {
      throw new BadRequestException(
        'Exercise does not have a bassline MIDI file',
      );
    }

    // Validate required metadata
    if (!exercise.bpm || !exercise.timeSignature || !exercise.totalBars) {
      throw new BadRequestException(
        'Exercise is missing required metadata (bpm, time_signature, or total_bars)',
      );
    }

    // Parse time signature
    const timeSignature =
      typeof exercise.timeSignature === 'string'
        ? JSON.parse(exercise.timeSignature)
        : exercise.timeSignature;

    // Parse MIDI file
    const result = await this.midiParserService.parseMidiFromUrl(
      exercise.basslineMidiUrl,
      exercise.bpm,
      {
        numerator: timeSignature.numerator || 4,
        denominator: timeSignature.denominator || 4,
      },
      exercise.totalBars,
      correlationId,
    );

    this.logger.log(`MIDI parsing completed for exercise: ${id}`, {
      correlationId,
      totalMeasures: result.totalMeasures,
      totalNotes: result.totalNotes,
    });

    return result;
  }

  /**
   * Convert MIDI notes to fretboard positions using multi-anchor approach
   * POST /api/v1/exercises/:id/midi/convert
   */
  @Post(':id/midi/convert')
  @ApiOperation({
    summary: 'Convert MIDI to fretboard positions',
    description:
      'Converts MIDI notes to fretboard positions (string/fret) using a multi-anchor approach and dynamic programming algorithm. Generates confidence scores, alternatives, and playability metrics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Exercise ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    description: 'Conversion request with measure anchors',
    schema: {
      type: 'object',
      required: ['anchors'],
      properties: {
        anchors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              measureNumber: { type: 'number', example: 1 },
              string: { type: 'number', minimum: 1, maximum: 6, example: 1 },
              fret: { type: 'number', minimum: 0, maximum: 24, example: 0 },
            },
          },
        },
        bassType: {
          type: 'string',
          enum: ['4', '5', '6'],
          default: '4',
          example: '4',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MIDI converted to fretboard positions successfully',
    schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          description: 'Generated fretboard positions with metadata',
        },
        totalNotes: { type: 'number', example: 16 },
        playability: {
          type: 'object',
          properties: {
            overallScore: { type: 'number', example: 85 },
            largeStretches: { type: 'number', example: 2 },
            difficultShifts: { type: 'number', example: 1 },
            stringCrossings: { type: 'number', example: 8 },
            handStability: { type: 'number', example: 90 },
            highConfidencePercentage: { type: 'number', example: 75 },
          },
        },
        processingTimeMs: { type: 'number', example: 45 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid anchors or missing MIDI file',
  })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  async convertMidiToFretboard(
    @Param('id') id: string,
    @Body() convertRequest: ConvertMidiRequestDto,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Converting MIDI to fretboard for exercise: ${id}`, {
      correlationId,
      anchorCount: convertRequest.anchors.length,
      bassType: convertRequest.bassType,
    });

    // Get exercise details
    const exercise = await this.exercisesService.findById(id);
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    // Validate exercise has MIDI file
    if (!exercise.basslineMidiUrl) {
      throw new BadRequestException(
        'Exercise does not have a bassline MIDI file',
      );
    }

    // Validate required metadata
    if (!exercise.bpm || !exercise.timeSignature || !exercise.totalBars) {
      throw new BadRequestException(
        'Exercise is missing required metadata (bpm, time_signature, or total_bars)',
      );
    }

    // Parse time signature
    const timeSignature =
      typeof exercise.timeSignature === 'string'
        ? JSON.parse(exercise.timeSignature)
        : exercise.timeSignature;

    // First, parse MIDI to get measures
    const parseResult = await this.midiParserService.parseMidiFromUrl(
      exercise.basslineMidiUrl,
      exercise.bpm,
      {
        numerator: timeSignature.numerator || 4,
        denominator: timeSignature.denominator || 4,
      },
      exercise.totalBars,
      correlationId,
    );

    // Convert to fretboard positions
    const conversionStartTime = Date.now();
    const { notes, playability } =
      await this.fretboardMapperService.convertMidiToFretboard(
        parseResult.measures,
        convertRequest.anchors,
        convertRequest.bassType,
        correlationId,
      );
    const processingTimeMs = Date.now() - conversionStartTime;

    this.logger.log(
      `MIDI to fretboard conversion completed for exercise: ${id}`,
      {
        correlationId,
        totalNotes: notes.length,
        playabilityScore: playability.overallScore,
        processingTimeMs,
      },
    );

    return {
      notes,
      totalNotes: notes.length,
      playability,
      processingTimeMs,
    };
  }
}
