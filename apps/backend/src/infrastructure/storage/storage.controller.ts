import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CleanupService } from './cleanup.service.js';
import { AdminGuard } from '../../domains/user/auth/guards/admin.guard.js';
import { CorrelationId } from '../../shared/decorators/correlation-id.decorator.js';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';

/**
 * Storage Controller - Temporary file storage operations
 * Story 4.4 - Task 2: Temporary MIDI File Storage System
 *
 * Provides endpoints for uploading MIDI files to temporary storage before
 * exercises are saved to database, enabling seamless upload → convert → save workflows.
 */
@ApiTags('storage')
@Controller('api/v1/storage')
@UseGuards(AdminGuard)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cleanupService: CleanupService,
  ) {}

  /**
   * Upload MIDI file to temporary storage
   * POST /api/v1/storage/upload-temp
   *
   * Files uploaded here:
   * - Are stored in `exercise-midi-temp` bucket
   * - Get a signed URL that expires in 1 hour
   * - Are auto-cleaned after 2 hours
   * - Can be moved to permanent storage later
   *
   * This enables upload before exercise is saved to database.
   */
  @Post('upload-temp')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload MIDI file to temporary storage',
    description: `
Upload a MIDI file to temporary storage before exercise is saved to database.

**Workflow:**
1. Upload MIDI file → Returns temporary URL + path
2. Parse MIDI using temporary URL (POST /api/v1/midi/parse)
3. Convert to fretboard positions
4. Save exercise → Move file to permanent storage

**Temporary File Lifecycle:**
- Signed URL expires in 1 hour (for security)
- Files auto-cleanup after 2 hours (cron job)
- Move to permanent storage before expiration

**Why Temporary Storage:**
- Allows upload before exercise exists in database
- Prevents orphaned files if user cancels
- Reduces storage costs (auto-cleanup)
    `.trim(),
  })
  @ApiBody({
    description: 'MIDI file upload',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'MIDI file (.mid or .midi, max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        temporaryUrl: {
          type: 'string',
          example:
            'https://xyz.supabase.co/storage/v1/object/sign/exercise-midi-temp/1234567890_abc.mid?token=xyz',
          description: 'Signed URL for accessing file (expires in 1 hour)',
        },
        tempPath: {
          type: 'string',
          example: '1234567890_abc.mid',
          description: 'Path in temp bucket (use for move-to-permanent)',
        },
        filename: {
          type: 'string',
          example: 'my-bassline.mid',
          description: 'Original filename',
        },
        fileSize: {
          type: 'number',
          example: 1024,
          description: 'File size in bytes',
        },
        expiresIn: {
          type: 'string',
          example: '1 hour',
          description: 'When the signed URL expires',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file (wrong type, too large, etc.)',
  })
  @ApiResponse({
    status: 507,
    description: 'Storage quota exceeded',
  })
  async uploadTemp(
    @Req() req: FastifyRequest,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log('Uploading MIDI to temporary storage (Fastify)', {
      correlationId,
    });

    // Get the multipart file from Fastify request
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const { file, filename, mimetype } = data;

    // Read file buffer from stream
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const fileSize = buffer.length;

    this.logger.log('File received', {
      filename,
      fileSize,
      mimetype,
      correlationId,
    });

    // Validation: file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE} bytes)`,
      );
    }

    // Validation: file type (must be .mid or .midi)
    const validExtensions = ['.mid', '.midi'];
    const fileExtension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Invalid file type: ${fileExtension || 'unknown'} (must be .mid or .midi)`,
      );
    }

    // Validation: MIME type (should be audio/midi or audio/x-midi)
    const validMimeTypes = [
      'audio/midi',
      'audio/x-midi',
      'application/octet-stream',
    ];
    if (!validMimeTypes.includes(mimetype)) {
      this.logger.warn('Unexpected MIDI file MIME type', {
        mimetype,
        filename,
        correlationId,
      });
      // Don't fail - some systems report MIDI as octet-stream
    }

    // Generate UUID-based filename to prevent collisions
    const uuid = randomUUID();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${uuid}_${sanitizedFilename}`;

    try {
      const result = await this.supabaseService.uploadToTemp(
        buffer,
        uniqueFilename,
        mimetype,
      );

      this.logger.log('Successfully uploaded MIDI to temporary storage', {
        originalFilename: filename,
        tempPath: result.tempPath,
        fileSize,
        correlationId,
      });

      return {
        temporaryUrl: result.temporaryUrl,
        tempPath: result.tempPath,
        filename: filename,
        fileSize: fileSize,
        expiresIn: '1 hour',
      };
    } catch (error: any) {
      // Check for storage quota errors
      if (error.message?.includes('quota') || error.statusCode === '413') {
        this.logger.error('Storage quota exceeded', error, {
          filename,
          fileSize,
          correlationId,
        });
        throw new BadRequestException(
          'Storage quota exceeded. Please contact support.',
        );
      }

      this.logger.error('Failed to upload MIDI to temporary storage', error, {
        filename,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Move file from temporary to permanent storage
   * POST /api/v1/storage/move-to-permanent
   *
   * This is typically called when exercise is saved to database.
   * The file is moved atomically and temp file is deleted.
   */
  @Post('move-to-permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move file from temporary to permanent storage',
    description: `
Move a file from temporary storage to permanent storage.

**Use Case:**
After uploading to temp and user saves the exercise, call this endpoint
to move the MIDI file to permanent storage.

**Atomic Operation:**
Either succeeds completely or fails without side effects.

**Cleanup:**
Temp file is automatically deleted after successful move.
    `.trim(),
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['tempPath', 'exerciseId'],
      properties: {
        tempPath: {
          type: 'string',
          example: '1234567890_abc.mid',
          description: 'Path from upload-temp response',
        },
        exerciseId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
          description: 'Exercise ID (for permanent path)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File moved successfully',
    schema: {
      type: 'object',
      properties: {
        permanentUrl: {
          type: 'string',
          example:
            'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-files/exercises/abc/bassline.mid',
          description: 'Public URL of file in permanent storage',
        },
        permanentPath: {
          type: 'string',
          example: 'exercises/abc/1234567890_bassline.mid',
          description: 'Path in permanent bucket',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (missing params, file not found)',
  })
  @ApiResponse({
    status: 404,
    description: 'Temp file not found (expired or already moved)',
  })
  async moveToPermanent(
    @Body() body: { tempPath: string; exerciseId: string },
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log('Moving file from temp to permanent storage', {
      tempPath: body.tempPath,
      exerciseId: body.exerciseId,
      correlationId,
    });

    // Validation
    if (!body.tempPath || !body.exerciseId) {
      throw new BadRequestException('tempPath and exerciseId are required');
    }

    // Generate permanent path
    const timestamp = Date.now();
    const permanentBucket = 'exercise-midi-files';
    const permanentPath = `exercises/${body.exerciseId}/${timestamp}_bassline.mid`;

    try {
      const permanentUrl = await this.supabaseService.moveToPermanent(
        body.tempPath,
        permanentBucket,
        permanentPath,
      );

      this.logger.log('Successfully moved file to permanent storage', {
        tempPath: body.tempPath,
        permanentPath,
        exerciseId: body.exerciseId,
        correlationId,
      });

      return {
        permanentUrl,
        permanentPath,
      };
    } catch (error) {
      this.logger.error('Failed to move file to permanent storage', error, {
        tempPath: body.tempPath,
        exerciseId: body.exerciseId,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Clean up expired temporary files
   * POST /api/v1/storage/cleanup
   *
   * Manually trigger cleanup of temp files older than 2 hours.
   * This can also be called by a cron job or external scheduler.
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clean up expired temporary files',
    description: `
Manually trigger cleanup of temporary MIDI files older than 2 hours.

**When to Use:**
- Manual cleanup when storage quota is approaching limit
- Testing cleanup logic in development
- Called by external cron job (recommended approach)

**What It Does:**
1. Scans all files in exercise-midi-temp bucket
2. Identifies files older than 2 hours
3. Deletes expired files in batches
4. Returns statistics about cleanup operation

**Performance:**
- Processes files in batches of 50
- Typical runtime: 1-5 seconds for 100 files
- Safe to run concurrently (idempotent)
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
    schema: {
      type: 'object',
      properties: {
        deletedCount: {
          type: 'number',
          example: 15,
          description: 'Number of files deleted',
        },
        failedCount: {
          type: 'number',
          example: 0,
          description: 'Number of files that failed to delete',
        },
        totalScanned: {
          type: 'number',
          example: 42,
          description: 'Total number of files scanned',
        },
        durationMs: {
          type: 'number',
          example: 1234,
          description: 'Duration of cleanup operation in milliseconds',
        },
      },
    },
  })
  async cleanup(@CorrelationId() correlationId?: string) {
    this.logger.log('Manual cleanup triggered', { correlationId });

    const result = await this.cleanupService.cleanupExpiredFiles();

    this.logger.log('Cleanup completed', { ...result, correlationId });

    return result;
  }

  /**
   * Get temporary storage statistics
   * GET /api/v1/storage/stats
   *
   * Get information about temp storage usage for monitoring.
   */
  @Post('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get temporary storage statistics',
    description: `
Get statistics about temporary storage usage.

**Use Cases:**
- Monitoring dashboard
- Alerting when too many expired files accumulate
- Capacity planning

**Returns:**
- Total number of temp files
- Number of expired files (ready for cleanup)
- Number of active files (not yet expired)
- Age of oldest and newest files
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalFiles: {
          type: 'number',
          example: 42,
          description: 'Total number of temp files',
        },
        expiredFiles: {
          type: 'number',
          example: 15,
          description: 'Number of expired files (older than 2 hours)',
        },
        activeFiles: {
          type: 'number',
          example: 27,
          description: 'Number of active files (not expired)',
        },
        oldestFileAge: {
          type: 'string',
          example: '3h 24m',
          description: 'Age of oldest file',
        },
        newestFileAge: {
          type: 'string',
          example: '5m 12s',
          description: 'Age of newest file',
        },
      },
    },
  })
  async getStats(@CorrelationId() correlationId?: string) {
    this.logger.log('Getting temp storage stats', { correlationId });

    const stats = await this.cleanupService.getTempStorageStats();

    this.logger.log('Stats retrieved', { ...stats, correlationId });

    return stats;
  }
}
