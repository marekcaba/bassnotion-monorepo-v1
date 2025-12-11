import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import {
  MusicXMLParser,
  MIDIFileParser,
  type MusicXMLConversionResult,
  type MIDIFileParsingResult,
  DEFAULT_MIDI_FILE_CONFIG,
  DEFAULT_BASS_CONVERSION_CONFIG,
  type MusicalExercise,
  type ExerciseDifficulty,
  createStructuredLogger,
} from '@bassnotion/contracts';
import {
  FileUploadDto,
  MusicXMLUploadConfigDto,
  MIDIUploadConfigDto,
  FileUploadResponseDto,
  FileUploadErrorDto,
  FileUploadType,
} from '../dto/file-upload.dto.js';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly staticLogger = createStructuredLogger(
    FileUploadService.name,
  );
  private musicXMLParser: MusicXMLParser;
  private midiParser: MIDIFileParser;

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    this.musicXMLParser = new MusicXMLParser();
    this.midiParser = new MIDIFileParser();
  }

  /**
   * Store file in Supabase Storage and return file path
   */
  private async storeFileInBucket(
    file: any,
    exerciseId: string,
  ): Promise<{ filePath: string; publicUrl: string }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    try {
      const supabase = this.supabaseService.getClient();

      // Generate unique filename to avoid conflicts
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.originalname}`;
      const filePath = `exercises/${exerciseId}/${fileName}`;

      // Upload file to exercise-files bucket
      const { data, error } = await supabase.storage
        .from('exercise-files')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        logger.error(
          `Error uploading file to storage: ${error.message}`,
          error as Error,
          { correlationId },
        );
        throw new Error(`File storage failed: ${error.message}`);
      }

      // Get public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('exercise-files')
        .getPublicUrl(filePath);

      logger.info(`File stored successfully: ${filePath}`, { correlationId });

      return {
        filePath: data.path,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error in file storage:', error as Error, { correlationId });
      throw error;
    }
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFileFromBucket(filePath: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase.storage
        .from('exercise-files')
        .remove([filePath]);

      if (error) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.error(
          `Error deleting file from storage: ${error.message}`,
          error as Error,
          { correlationId },
        );
        throw new Error(`File deletion failed: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.info(`File deleted successfully: ${filePath}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error in file deletion:', error as Error, {
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Process uploaded file, store in bucket, and convert to exercise
   */
  async processAndStoreFile(
    file: any,
    uploadDto: FileUploadDto,
    userId: string,
    configDto?: MusicXMLUploadConfigDto | MIDIUploadConfigDto,
  ): Promise<
    | (FileUploadResponseDto & {
        storageInfo?: { filePath: string; publicUrl: string };
      })
    | FileUploadErrorDto
  > {
    const startTime = performance.now();
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    try {
      logger.info(
        `Processing and storing uploaded file: ${file.originalname} (${file.size} bytes)`,
        { correlationId },
      );

      // Validate file
      this.validateUploadedFile(file, uploadDto.fileType);

      // Generate exercise ID for storage path
      const exerciseId = uuidv4();

      // Store file in Supabase Storage first
      let storageInfo: { filePath: string; publicUrl: string } | undefined;
      if (uploadDto.storeFile !== false) {
        storageInfo = await this.storeFileInBucket(file, exerciseId);
      }

      // Process file based on type
      let result: FileUploadResponseDto;

      if (uploadDto.fileType === FileUploadType.MUSICXML) {
        result = await this.processMusicXMLFile(
          file,
          uploadDto,
          configDto as MusicXMLUploadConfigDto,
        );
      } else {
        result = await this.processMIDIFile(
          file,
          uploadDto,
          configDto as MIDIUploadConfigDto,
        );
      }

      // Ensure exercise has the correct ID if created
      if (result.exercise) {
        result.exercise.id = exerciseId;
      }

      result.processingTimeMs = performance.now() - startTime;

      logger.info(
        `Successfully processed and stored ${file.originalname} in ${result.processingTimeMs.toFixed(2)}ms`,
        { correlationId },
      );

      return {
        ...result,
        storageInfo,
      };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error processing file ${file.originalname}:`,
        error as Error,
        { correlationId },
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'FILE_PROCESSING_ERROR',
        details: error instanceof Error ? error.stack : undefined,
        originalFileName: file.originalname,
        fileSize: file.size,
      };
    }
  }

  /**
   * Process uploaded file and convert to exercise (legacy method)
   */
  async processUploadedFile(
    file: any,
    uploadDto: FileUploadDto,
    configDto?: MusicXMLUploadConfigDto | MIDIUploadConfigDto,
  ): Promise<FileUploadResponseDto | FileUploadErrorDto> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    const startTime = performance.now();

    try {
      logger.info(
        `Processing uploaded file: ${file.originalname} (${file.size} bytes)`,
        { correlationId },
      );

      // Validate file
      this.validateUploadedFile(file, uploadDto.fileType);

      // Process based on file type
      let result: FileUploadResponseDto;

      if (uploadDto.fileType === FileUploadType.MUSICXML) {
        result = await this.processMusicXMLFile(
          file,
          uploadDto,
          configDto as MusicXMLUploadConfigDto,
        );
      } else {
        result = await this.processMIDIFile(
          file,
          uploadDto,
          configDto as MIDIUploadConfigDto,
        );
      }

      result.processingTimeMs = performance.now() - startTime;

      logger.info(
        `Successfully processed ${file.originalname} in ${result.processingTimeMs.toFixed(2)}ms`,
        { correlationId },
      );

      return result;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;

      logger.error(
        `Error processing file ${file.originalname}:`,
        error as Error,
        { correlationId },
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'FILE_PROCESSING_ERROR',
        details: error instanceof Error ? error.stack : undefined,
        originalFileName: file.originalname,
        fileSize: file.size,
      };
    }
  }

  /**
   * Process MusicXML file
   */
  private async processMusicXMLFile(
    file: any,
    uploadDto: FileUploadDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config?: MusicXMLUploadConfigDto,
  ): Promise<FileUploadResponseDto> {
    const xmlContent = file.buffer.toString('utf-8');

    // Parse MusicXML
    const conversionResult: MusicXMLConversionResult =
      await this.musicXMLParser.parseFile(xmlContent);

    if (!conversionResult.success) {
      throw new Error(
        `MusicXML parsing failed: ${conversionResult.errors.join(', ')}`,
      );
    }

    // Create exercise if requested
    let exercise: MusicalExercise | undefined;
    if (uploadDto.createExercise !== false) {
      const parsedExercise =
        this.musicXMLParser.convertToExercise(conversionResult);

      if (parsedExercise) {
        exercise = parsedExercise;
        // Override with user-provided metadata
        if (uploadDto.title) exercise.title = uploadDto.title;
        if (uploadDto.description) exercise.description = uploadDto.description;
        if (uploadDto.difficulty) exercise.difficulty = uploadDto.difficulty;

        // Auto-detect difficulty if requested
        if (
          uploadDto.autoDetectDifficulty &&
          !uploadDto.difficulty &&
          exercise
        ) {
          exercise.difficulty = this.calculateDifficulty(exercise);
        }
      }
    }

    const response: FileUploadResponseDto = {
      success: true,
      message: 'MusicXML file processed successfully',
      originalFileName: file.originalname,
      fileSize: file.size,
      processingTimeMs: 0, // Will be set by caller

      parsingResult: {
        format: 'MusicXML',
        trackCount: conversionResult.metadata?.instruments?.length || 1,
        durationSeconds: this.calculateDuration(conversionResult),
        notesFound: conversionResult.notes?.length || 0,
        bassTrackFound: true, // MusicXML processing assumes valid bass content
      },

      exercise: exercise
        ? {
            id: exercise.id,
            title: exercise.title,
            description: exercise.description || '',
            difficulty: exercise.difficulty,
            noteCount: exercise.notes.length,
            bpm: exercise.bpm,
            key: exercise.key,
            timeSignature: `${exercise.timeSignature.numerator}/${exercise.timeSignature.denominator}`,
          }
        : undefined,

      warnings: conversionResult.warnings || [],
      errors: conversionResult.errors || [],

      conversionStats: {
        originalNotes: conversionResult.notes?.length || 0,
        convertedNotes: exercise?.notes.length || 0,
        droppedNotes:
          (conversionResult.notes?.length || 0) - (exercise?.notes.length || 0),
        quantizedNotes: 0, // MusicXML doesn't typically need quantization
      },
    };

    return response;
  }

  /**
   * Process MIDI file
   */
  private async processMIDIFile(
    file: any,
    uploadDto: FileUploadDto,
    config?: MIDIUploadConfigDto,
  ): Promise<FileUploadResponseDto> {
    // Configure parser based on provided config
    const parserConfig = {
      ...DEFAULT_MIDI_FILE_CONFIG,
      targetFormat: (config?.targetFormat as any) || 'exercise',
      bassDetection: {
        enabled: config?.autoSelectBass ?? true,
        noteRangeFilter: {
          min: config?.bassNoteRangeMin || 23,
          max: config?.bassNoteRangeMax || 67,
        },
        velocityThreshold: 10,
      },
      timingConversion: {
        ...DEFAULT_MIDI_FILE_CONFIG.timingConversion,
        quantization: (config?.quantization as any) || 'sixteenth',
      },
    };

    const bassConfig = {
      ...DEFAULT_BASS_CONVERSION_CONFIG,
      tuning: this.getBassStringConfiguration(
        config?.bassTuning || 'standard4',
      ),
    };

    // Update parser configurations
    this.midiParser = new MIDIFileParser(parserConfig, bassConfig);

    // Parse MIDI file
    const parsingResult: MIDIFileParsingResult =
      await this.midiParser.parseFile(file.buffer, file.originalname);

    if (!parsingResult.success) {
      throw new Error(
        `MIDI parsing failed: ${parsingResult.errors.join(', ')}`,
      );
    }

    // Create exercise if one was generated
    const exercise = parsingResult.exercise;
    if (exercise && uploadDto.createExercise !== false) {
      // Override with user-provided metadata
      if (uploadDto.title) exercise.title = uploadDto.title;
      if (uploadDto.description) exercise.description = uploadDto.description;
      if (uploadDto.difficulty) exercise.difficulty = uploadDto.difficulty;

      // Auto-detect difficulty if requested
      if (uploadDto.autoDetectDifficulty && !uploadDto.difficulty) {
        exercise.difficulty = this.calculateDifficulty(exercise);
      }
    }

    const response: FileUploadResponseDto = {
      success: true,
      message: 'MIDI file processed successfully',
      originalFileName: file.originalname,
      fileSize: file.size,
      processingTimeMs: 0, // Will be set by caller

      parsingResult: {
        format: parsingResult.metadata.format.toUpperCase(),
        trackCount: parsingResult.metadata.trackCount,
        durationSeconds: parsingResult.metadata.durationSeconds,
        notesFound: parsingResult.conversionStats.originalNotes,
        bassTrackFound: !!parsingResult.bassTrack,
        confidence: parsingResult.bassTrack?.confidence,
      },

      exercise: exercise
        ? {
            id: exercise.id,
            title: exercise.title,
            description: exercise.description || '',
            difficulty: exercise.difficulty,
            noteCount: exercise.notes.length,
            bpm: exercise.bpm,
            key: exercise.key,
            timeSignature: `${exercise.timeSignature.numerator}/${exercise.timeSignature.denominator}`,
          }
        : undefined,

      warnings: parsingResult.warnings,
      errors: parsingResult.errors,

      conversionStats: parsingResult.conversionStats,
    };

    return response;
  }

  /**
   * Validate uploaded file
   */
  private validateUploadedFile(file: any, fileType: FileUploadType): void {
    // Check file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`,
      );
    }

    // Check file extension
    const fileName = file.originalname.toLowerCase();

    if (fileType === FileUploadType.MUSICXML) {
      const validExtensions = ['.xml', '.musicxml', '.mxl'];
      const hasValidExtension = validExtensions.some((ext) =>
        fileName.endsWith(ext),
      );

      if (!hasValidExtension) {
        throw new BadRequestException(
          `Invalid file type for MusicXML. Allowed extensions: ${validExtensions.join(', ')}`,
        );
      }
    } else if (fileType === FileUploadType.MIDI) {
      const validExtensions = ['.mid', '.midi'];
      const hasValidExtension = validExtensions.some((ext) =>
        fileName.endsWith(ext),
      );

      if (!hasValidExtension) {
        throw new BadRequestException(
          `Invalid file type for MIDI. Allowed extensions: ${validExtensions.join(', ')}`,
        );
      }
    }

    // Check if file has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File appears to be empty');
    }
  }

  /**
   * Calculate exercise difficulty based on various factors
   */
  private calculateDifficulty(exercise: MusicalExercise): ExerciseDifficulty {
    let difficultyScore = 0;

    // Note density
    const noteCountFactor = Math.min(1, exercise.notes.length / 100);
    difficultyScore += noteCountFactor * 0.3;

    // Tempo factor
    const tempoFactor = Math.min(1, (exercise.bpm - 60) / 140); // Normalize 60-200 BPM
    difficultyScore += Math.max(0, tempoFactor) * 0.2;

    // Fret spread
    const frets = exercise.notes
      .map((n: any) => n.fret)
      .filter((f: number) => f > 0);
    if (frets.length > 0) {
      const fretSpread = Math.max(...frets) - Math.min(...frets);
      const fretSpreadFactor = Math.min(1, fretSpread / 12);
      difficultyScore += fretSpreadFactor * 0.2;
    }

    // String jumps
    let stringJumps = 0;
    for (let i = 1; i < exercise.notes.length; i++) {
      stringJumps += Math.abs(
        exercise.notes[i].string - exercise.notes[i - 1].string,
      );
    }
    const stringJumpFactor = Math.min(
      1,
      stringJumps / exercise.notes.length / 2,
    );
    difficultyScore += stringJumpFactor * 0.15;

    // Techniques used
    const techniquesUsed = new Set(
      exercise.notes
        .map((n: any) => n.techniques)
        .filter((t: any) => t && t.length > 0)
        .flat(),
    );
    const techniqueFactor = Math.min(1, techniquesUsed.size / 5);
    difficultyScore += techniqueFactor * 0.15;

    // Determine difficulty level
    if (difficultyScore < 0.25) return 'beginner';
    if (difficultyScore < 0.5) return 'intermediate';
    if (difficultyScore < 0.75) return 'advanced';
    return 'expert';
  }

  /**
   * Calculate duration from conversion result
   */
  private calculateDuration(conversionResult: any): number {
    // Simple estimation based on note count and tempo
    if (!conversionResult.notes || conversionResult.notes.length === 0)
      return 0;

    const averageNoteDuration = 0.5; // seconds per note (rough estimate)
    return conversionResult.notes.length * averageNoteDuration;
  }

  /**
   * Get bass string configuration
   */
  private getBassStringConfiguration(tuning: string) {
    // This would import from contracts, but for now we'll define inline
    const BASS_TUNINGS = {
      standard4: [
        {
          stringNumber: 1,
          openNote: 'G',
          openPitch: 43,
          midiRange: { min: 43, max: 67 },
        },
        {
          stringNumber: 2,
          openNote: 'D',
          openPitch: 38,
          midiRange: { min: 38, max: 62 },
        },
        {
          stringNumber: 3,
          openNote: 'A',
          openPitch: 33,
          midiRange: { min: 33, max: 57 },
        },
        {
          stringNumber: 4,
          openNote: 'E',
          openPitch: 28,
          midiRange: { min: 28, max: 52 },
        },
      ],
      standard5: [
        {
          stringNumber: 1,
          openNote: 'G',
          openPitch: 43,
          midiRange: { min: 43, max: 67 },
        },
        {
          stringNumber: 2,
          openNote: 'D',
          openPitch: 38,
          midiRange: { min: 38, max: 62 },
        },
        {
          stringNumber: 3,
          openNote: 'A',
          openPitch: 33,
          midiRange: { min: 33, max: 57 },
        },
        {
          stringNumber: 4,
          openNote: 'E',
          openPitch: 28,
          midiRange: { min: 28, max: 52 },
        },
        {
          stringNumber: 5,
          openNote: 'B',
          openPitch: 23,
          midiRange: { min: 23, max: 47 },
        },
      ],
      dropD: [
        {
          stringNumber: 1,
          openNote: 'G',
          openPitch: 43,
          midiRange: { min: 43, max: 67 },
        },
        {
          stringNumber: 2,
          openNote: 'D',
          openPitch: 38,
          midiRange: { min: 38, max: 62 },
        },
        {
          stringNumber: 3,
          openNote: 'A',
          openPitch: 33,
          midiRange: { min: 33, max: 57 },
        },
        {
          stringNumber: 4,
          openNote: 'D',
          openPitch: 26,
          midiRange: { min: 26, max: 50 },
        },
      ],
    };

    return (
      BASS_TUNINGS[tuning as keyof typeof BASS_TUNINGS] ||
      BASS_TUNINGS.standard4
    );
  }
}
