import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MidiParserService } from './services/midi-parser.service.js';
import { FretboardMapperService } from './services/fretboard-mapper.service.js';
import { DrumMapperService } from './services/drum-mapper.service.js';
import { HarmonyMapperService } from './services/harmony-mapper.service.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CorrelationId } from '../../shared/decorators/correlation-id.decorator.js';
import {
  MidiProcessingRateLimit,
  MidiConversionRateLimit,
} from '../../shared/decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../../shared/guards/rate-limit.guard.js';
import type { StatelessParseMidiRequestDto } from './dto/parse-midi-request.dto.js';
import { StatelessParseMidiRequestSchema } from './dto/parse-midi-request.dto.js';
import type { ConvertDrumMidiRequestDto } from './dto/convert-drum-midi.dto.js';
import { ConvertDrumMidiResponseDto } from './dto/convert-drum-midi.dto.js';
import { ConvertHarmonyMidiDto } from './dto/convert-harmony-midi.dto.js';
import type { ConvertHarmonyResponseDto } from './dto/convert-harmony-response.dto.js';

/**
 * MIDI Controller - Stateless MIDI operations
 * Story 4.4 - Task 1: Stateless MIDI Parser Endpoint
 *
 * This controller provides stateless MIDI parsing operations that don't require
 * exercises to exist in the database. This enables seamless upload → convert → save
 * workflows without the need to save exercises first.
 */
@ApiTags('midi')
@Controller('api/v1/midi')
@UseGuards(AdminGuard, RateLimitGuard)
export class MidiController {
  private readonly logger = new Logger(MidiController.name);

  constructor(
    private readonly midiParserService: MidiParserService,
    private readonly fretboardMapperService: FretboardMapperService,
    private readonly drumMapperService: DrumMapperService,
    private readonly harmonyMapperService: HarmonyMapperService,
  ) {}

  /**
   * Parse MIDI file from URL (stateless - no database lookup required)
   * POST /api/v1/midi/parse
   *
   * This endpoint accepts a MIDI URL and metadata directly, without requiring
   * the exercise to exist in the database. This enables the seamless workflow:
   * 1. Upload MIDI to temp storage
   * 2. Parse MIDI using this endpoint (no DB write needed)
   * 3. Convert to fretboard positions
   * 4. Save everything atomically
   *
   * @param body - MIDI URL and metadata (bpm, timeSignature, totalBars)
   * @param correlationId - Request correlation ID for tracing
   * @returns Parsed measures with note events
   */
  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @MidiProcessingRateLimit()
  @ApiOperation({
    summary: 'Parse MIDI file from URL (stateless)',
    description: `
Parse a MIDI file directly from a URL without requiring the exercise to exist in database.
This is the FAANG-level stateless approach that enables seamless workflows.

**Use Cases:**
- Parse temporary uploaded MIDI before saving exercise
- Re-parse with different BPM/time signature without saving
- Preview MIDI content before committing to database

**Workflow:**
1. Upload MIDI → Get temporary URL
2. Call this endpoint with temp URL + metadata
3. Get parsed measures instantly (no DB lookup)
4. Convert to fretboard positions (separate endpoint)
5. Save exercise with all data atomically

**Benefits over legacy /exercises/:id/midi/parse:**
- ✅ No database dependency (horizontal scaling)
- ✅ Works for new exercises (before they have ID)
- ✅ Faster (no DB lookup latency)
- ✅ Stateless (can retry safely)
    `.trim(),
  })
  @ApiBody({
    description: 'MIDI URL and metadata for parsing',
    schema: {
      type: 'object',
      required: ['midiUrl', 'bpm', 'timeSignature', 'totalBars'],
      properties: {
        midiUrl: {
          type: 'string',
          format: 'uri',
          example:
            'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-temp/abc123.mid',
          description: 'HTTPS URL to MIDI file (must be .mid or .midi)',
        },
        bpm: {
          type: 'number',
          example: 120,
          minimum: 40,
          maximum: 300,
          description: 'Beats per minute',
        },
        timeSignature: {
          type: 'object',
          required: ['numerator', 'denominator'],
          properties: {
            numerator: {
              type: 'number',
              example: 4,
              minimum: 1,
              maximum: 16,
              description: 'Time signature numerator (top number)',
            },
            denominator: {
              type: 'number',
              example: 4,
              enum: [2, 4, 8, 16],
              description: 'Time signature denominator (bottom number)',
            },
          },
        },
        totalBars: {
          type: 'number',
          example: 4,
          minimum: 1,
          maximum: 32,
          description: 'Total number of bars/measures',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'MIDI file parsed successfully',
    schema: {
      type: 'object',
      properties: {
        totalMeasures: {
          type: 'number',
          example: 4,
          description: 'Number of measures in the parsed result',
        },
        totalNotes: {
          type: 'number',
          example: 16,
          description: 'Total number of notes found',
        },
        durationSeconds: {
          type: 'number',
          example: 8.0,
          description: 'Duration of MIDI file in seconds',
        },
        measures: {
          type: 'array',
          description: 'Parsed measures with note events',
          items: {
            type: 'object',
            properties: {
              measureNumber: { type: 'number', example: 1 },
              startTime: { type: 'number', example: 0.0 },
              endTime: { type: 'number', example: 2.0 },
              notes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pitch: {
                      type: 'number',
                      example: 41,
                      description: 'MIDI note number',
                    },
                    velocity: {
                      type: 'number',
                      example: 100,
                      description: '0-127',
                    },
                    name: {
                      type: 'string',
                      example: 'F2',
                      description: 'Note name',
                    },
                    time: {
                      type: 'number',
                      example: 0.5,
                      description: 'Time in seconds',
                    },
                    duration: {
                      type: 'number',
                      example: 0.25,
                      description: 'Duration in seconds',
                    },
                  },
                },
              },
            },
          },
        },
        metadata: {
          type: 'object',
          properties: {
            bpm: { type: 'number', example: 120 },
            timeSignature: {
              type: 'object',
              properties: {
                numerator: { type: 'number', example: 4 },
                denominator: { type: 'number', example: 4 },
              },
            },
            totalBars: { type: 'number', example: 4 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (bad URL, invalid MIDI, validation errors)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Must be a valid URL',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'MIDI file not found at URL',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during parsing',
  })
  async parseStateless(
    @Body() body: StatelessParseMidiRequestDto,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log('Parsing MIDI (stateless)', {
      midiUrl: body.midiUrl,
      bpm: body.bpm,
      timeSignature: body.timeSignature,
      totalBars: body.totalBars,
      correlationId,
    });

    // Validate request body using Zod schema
    const validationResult = StatelessParseMidiRequestSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      this.logger.warn('MIDI parse validation failed', {
        errors: validationResult.error.errors,
        correlationId,
      });
      throw new BadRequestException(
        firstError?.message || 'Invalid request parameters',
      );
    }

    // Additional Supabase domain validation
    // Only allow MIDI files from our Supabase storage for security
    const supabaseUrlPattern = /supabase\.co\/storage\/v1\/object\//;
    if (!supabaseUrlPattern.test(body.midiUrl)) {
      this.logger.warn('MIDI URL is not from Supabase storage', {
        midiUrl: body.midiUrl,
        correlationId,
      });
      throw new BadRequestException(
        'MIDI URL must be from Supabase storage domain',
      );
    }

    // Parse MIDI file (stateless - no DB lookup)
    const result = await this.midiParserService.parseMidiFromUrl(
      body.midiUrl,
      body.bpm,
      body.timeSignature,
      body.totalBars,
      correlationId,
    );

    this.logger.log('MIDI parsing completed (stateless)', {
      totalMeasures: result.totalMeasures,
      totalNotes: result.totalNotes,
      durationSeconds: result.durationSeconds,
      correlationId,
    });

    return result;
  }

  /**
   * Convert parsed MIDI to fretboard positions (stateless)
   * POST /api/v1/midi/convert
   *
   * Story 4.4 - Task 4.5: Stateless MIDI Conversion
   * This endpoint accepts parsed measures and anchors directly, without requiring
   * the exercise to exist in the database. Completes the stateless workflow:
   * 1. Upload MIDI → temp storage
   * 2. Parse MIDI → get measures
   * 3. Set anchors → user input
   * 4. Convert to fretboard → THIS ENDPOINT
   * 5. Save everything atomically
   */
  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @MidiConversionRateLimit()
  @ApiOperation({
    summary: 'Convert parsed MIDI to fretboard positions (stateless)',
    description: `
Convert MIDI measures to fretboard positions without requiring the exercise to exist in database.
This completes the FAANG-level stateless workflow for MIDI conversion.

**Workflow:**
1. Parse MIDI → Get measures (via /api/v1/midi/parse)
2. User selects anchor positions for each measure
3. Call this endpoint with measures + anchors
4. Get fretboard positions with playability metrics
5. Save exercise with all data atomically

**Benefits:**
- ✅ No database dependency
- ✅ Works for new exercises (before they have ID)
- ✅ Can retry/re-convert without side effects
- ✅ Enables preview before saving
    `.trim(),
  })
  @ApiBody({
    description: 'Parsed measures, anchors, and bass type',
    schema: {
      type: 'object',
      required: ['measures', 'anchors'],
      properties: {
        measures: {
          type: 'array',
          description: 'Parsed measures from /api/v1/midi/parse',
          items: {
            type: 'object',
            properties: {
              measureNumber: { type: 'number', example: 1 },
              startTime: { type: 'number', example: 0.0 },
              endTime: { type: 'number', example: 2.0 },
              notes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pitch: { type: 'number', example: 41 },
                    velocity: { type: 'number', example: 100 },
                    name: { type: 'string', example: 'F2' },
                    time: { type: 'number', example: 0.5 },
                    duration: { type: 'number', example: 0.25 },
                  },
                },
              },
            },
          },
        },
        anchors: {
          type: 'array',
          description: 'Anchor positions for each measure',
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
        notes: { type: 'array', description: 'Generated fretboard positions' },
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
    description:
      'Invalid measures, anchors, or MIDI contains notes outside bass guitar range',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example:
            'MIDI contains 3 notes outside bass guitar range in measure 1. Please ensure all notes are between E1 (MIDI 28) and C4 (MIDI 60) for 4-string bass.',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async convertStateless(
    @Body()
    body: { measures: any[]; anchors: any[]; bassType?: '4' | '5' | '6' },
    @CorrelationId() correlationId?: string,
  ) {
    const startTime = Date.now();

    this.logger.log('Converting MIDI to fretboard (stateless)', {
      measureCount: body.measures?.length || 0,
      anchorCount: body.anchors?.length || 0,
      bassType: body.bassType || '4',
      correlationId,
    });

    // Validate required fields
    if (
      !body.measures ||
      !Array.isArray(body.measures) ||
      body.measures.length === 0
    ) {
      throw new BadRequestException('measures array is required');
    }

    if (
      !body.anchors ||
      !Array.isArray(body.anchors) ||
      body.anchors.length === 0
    ) {
      throw new BadRequestException('anchors array is required');
    }

    // Convert MIDI to fretboard (stateless - no DB lookup)
    try {
      const result = await this.fretboardMapperService.convertMidiToFretboard(
        body.measures,
        body.anchors,
        body.bassType || '4',
        correlationId,
      );

      const processingTimeMs = Date.now() - startTime;

      this.logger.log('MIDI conversion completed (stateless)', {
        totalNotes: result.notes.length,
        playabilityScore: result.playability.overallScore,
        processingTimeMs,
        correlationId,
      });

      return {
        notes: result.notes,
        totalNotes: result.notes.length,
        playability: result.playability,
        processingTimeMs,
      };
    } catch (error: any) {
      // Convert service errors to BadRequestException so the frontend gets the helpful message
      if (
        error?.message &&
        error.message.includes('outside bass guitar range')
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Convert drummer MIDI to drum pattern
   * POST /api/v1/midi/convert-drums
   *
   * Similar to /convert-to-fretboard but for drum MIDI.
   * Parses drummer MIDI and converts to structured drum hits.
   *
   * @param body - Drummer MIDI URL
   * @param correlationId - Request correlation ID for tracing
   * @returns Converted drum pattern with stats and warnings
   */
  @Post('convert-drums')
  @HttpCode(HttpStatus.OK)
  @MidiConversionRateLimit()
  @ApiOperation({
    summary: 'Convert drummer MIDI to drum pattern',
    description:
      'Parse and convert drummer MIDI file to structured drum hits. ' +
      'Returns drum pattern that admin can review and edit before saving.',
  })
  @ApiBody({
    description: 'Drummer MIDI URL',
    schema: {
      type: 'object',
      required: ['drummerMidiUrl'],
      properties: {
        exerciseId: {
          type: 'string',
          description: 'Exercise ID for reference',
          example: 'e52df2a2-a018-4bfd-b16a-9831efcd8c3d',
        },
        drummerMidiUrl: {
          type: 'string',
          description: 'URL to drummer MIDI file (temp or permanent storage)',
          example:
            'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/exercise-midi-temp/1761654366448_drummer.mid',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Drum pattern converted successfully',
    type: ConvertDrumMidiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or MIDI parsing error',
  })
  async convertDrumMidi(
    @Body() body: ConvertDrumMidiRequestDto,
    @CorrelationId() correlationId?: string,
  ): Promise<ConvertDrumMidiResponseDto> {
    const startTime = Date.now();

    this.logger.log('Converting drummer MIDI to drum pattern', {
      exerciseId: body.exerciseId,
      drummerMidiUrl: body.drummerMidiUrl,
      correlationId,
    });

    try {
      // Step 1: Parse MIDI file
      const parsedMidi = await this.midiParserService.parseMidiFromUrl(
        body.drummerMidiUrl,
        120, // Default BPM, will be extracted from MIDI
        { numerator: 4, denominator: 4 }, // Default time signature
        0, // Auto-detect total bars
        correlationId,
      );

      // Step 2: Convert to drum pattern
      const drumPattern = await this.drumMapperService.convertMidiToDrumPattern(
        parsedMidi.measures,
        correlationId,
      );

      // Step 3: Get statistics
      const stats = this.drumMapperService.getDrumPatternStats(drumPattern);

      // Step 4: Validate and get warnings
      const validation =
        this.drumMapperService.validateDrumPattern(drumPattern);

      const processingTimeMs = Date.now() - startTime;

      this.logger.log('Drummer MIDI converted successfully', {
        exerciseId: body.exerciseId,
        totalHits: stats.totalHits,
        uniqueDrums: stats.uniqueDrums,
        unknownCount: stats.unknownCount,
        processingTimeMs,
        correlationId,
      });

      return {
        drumPattern,
        stats,
        warnings: [...validation.warnings],
        message:
          validation.warnings.length > 0
            ? 'Drum pattern converted with warnings. Please review.'
            : 'Drum pattern converted successfully.',
      };
    } catch (error: any) {
      this.logger.error('Failed to convert drummer MIDI', {
        exerciseId: body.exerciseId,
        error: error.message,
        correlationId,
      });

      throw new BadRequestException(
        error.message || 'Failed to convert drummer MIDI',
      );
    }
  }

  /**
   * Convert harmony MIDI to note data (stateless)
   * POST /api/v1/midi/convert-harmony
   *
   * Converts parsed MIDI measures to harmony note data with pitch, velocity, and timing.
   * Unlike fretboard conversion, this doesn't require anchors since there are no physical
   * constraints - just extracts the notes as-is with musical timing.
   *
   * @param body - Parsed measures and instrument type
   * @param correlationId - Request correlation ID for tracing
   * @returns Converted harmony notes with analysis metadata
   */
  @Post('convert-harmony')
  @HttpCode(HttpStatus.OK)
  @MidiConversionRateLimit()
  @ApiOperation({
    summary: 'Convert parsed MIDI to harmony note data (stateless)',
    description: `
Convert MIDI measures to harmony note data without requiring the exercise to exist in database.
This is simpler than fretboard conversion - no anchors needed, just extract notes with timing.

**Workflow:**
1. Parse MIDI → Get measures (via /api/v1/midi/parse)
2. Call this endpoint with measures + instrument type
3. Get harmony notes with pitch/velocity/timing + analysis
4. Save exercise with all data atomically

**Analysis Includes:**
- Velocity range (for optimized sample preloading)
- Unique pitches (for loading only required notes)
- Required velocity layers (instrument-specific optimization)
- Polyphony detection (simultaneous notes)
- Octave range

**Benefits:**
- ✅ No database dependency
- ✅ Works for new exercises (before they have ID)
- ✅ Sample preloading optimization metadata included
- ✅ Stateless and retryable
    `.trim(),
  })
  @ApiBody({
    description: 'Parsed measures and instrument type',
    schema: {
      type: 'object',
      required: ['measures', 'instrumentType'],
      properties: {
        measures: {
          type: 'array',
          description: 'Parsed measures from /api/v1/midi/parse',
          items: {
            type: 'object',
            properties: {
              measureNumber: { type: 'number', example: 1 },
              startTime: { type: 'number', example: 0.0 },
              endTime: { type: 'number', example: 2.0 },
              notes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pitch: {
                      type: 'number',
                      example: 60,
                      description: 'MIDI note (0-127)',
                    },
                    velocity: {
                      type: 'number',
                      example: 80,
                      description: 'Velocity (0-127)',
                    },
                    name: { type: 'string', example: 'C4' },
                    time: { type: 'number', example: 0.5 },
                    duration: { type: 'number', example: 0.25 },
                  },
                },
              },
            },
          },
        },
        instrumentType: {
          type: 'string',
          enum: ['grandpiano', 'rhodes', 'wurlitzer', 'pad'],
          example: 'grandpiano',
          description:
            'Harmony instrument type (affects velocity layer calculation)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Harmony MIDI converted successfully',
    schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          description: 'Generated harmony notes',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'harmony-note-1' },
              pitch: { type: 'number', example: 60 },
              velocity: { type: 'number', example: 80 },
              noteName: { type: 'string', example: 'C4' },
              measureNumber: { type: 'number', example: 1 },
              voiceIndex: {
                type: 'number',
                example: 0,
                description: 'For polyphonic tracking',
              },
            },
          },
        },
        analysis: {
          type: 'object',
          properties: {
            minVelocity: { type: 'number', example: 40 },
            maxVelocity: { type: 'number', example: 100 },
            requiredVelocityLayers: {
              type: 'array',
              items: { type: 'string' },
              example: ['v6', 'v7', 'v8', 'v9', 'v10'],
            },
            uniquePitches: {
              type: 'array',
              items: { type: 'number' },
              example: [60, 64, 67, 71],
              description: 'MIDI pitches to preload',
            },
            noteCount: { type: 'number', example: 42 },
            octaveRange: {
              type: 'object',
              properties: {
                min: { type: 'number', example: 3 },
                max: { type: 'number', example: 5 },
              },
            },
            isPolyphonic: { type: 'boolean', example: true },
            maxVoiceCount: { type: 'number', example: 4 },
          },
        },
        processingTimeMs: { type: 'number', example: 25 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid measures or instrument type',
  })
  async convertHarmony(
    @Body() body: ConvertHarmonyMidiDto,
    @CorrelationId() correlationId?: string,
  ): Promise<ConvertHarmonyResponseDto> {
    this.logger.log('Converting harmony MIDI to note data (stateless)', {
      measureCount: body.measures?.length || 0,
      instrumentType: body.instrumentType,
      correlationId,
    });

    // Validate required fields
    if (
      !body.measures ||
      !Array.isArray(body.measures) ||
      body.measures.length === 0
    ) {
      throw new BadRequestException('measures array is required');
    }

    if (!body.instrumentType) {
      throw new BadRequestException('instrumentType is required');
    }

    try {
      // Convert MIDI to harmony notes (stateless - no DB lookup)
      const result = await this.harmonyMapperService.convertMidiToHarmony(
        body.measures,
        body.instrumentType,
        correlationId,
        body.controlChanges,
      );

      this.logger.log('Harmony MIDI conversion completed (stateless)', {
        totalNotes: result.notes.length,
        uniquePitches: result.analysis.uniquePitches.length,
        velocityLayers: result.analysis.requiredVelocityLayers.length,
        isPolyphonic: result.analysis.isPolyphonic,
        processingTimeMs: result.processingTimeMs,
        correlationId,
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to convert harmony MIDI', {
        error: error.message,
        stack: error.stack,
        correlationId,
      });

      throw new BadRequestException(
        error.message || 'Failed to convert harmony MIDI',
      );
    }
  }
}
