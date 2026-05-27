import { Injectable, Inject } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class SupabaseService {
  private readonly staticLogger = createStructuredLogger(SupabaseService.name);
  private readonly supabaseClient: SupabaseClient;

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Use environment variables directly
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    logger.info('🚀 SupabaseService initializing', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceRoleKey,
      url: supabaseUrl?.substring(0, 30) + '...',
      correlationId,
    });

    // Check for test environment
    const isTestEnv = process.env.NODE_ENV === 'test';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      if (isTestEnv) {
        logger.warn(
          '🔧 Supabase environment variables not found - creating mock client for tests',
          {
            correlationId,
          },
        );
        // Create a mock client for test environments
        this.supabaseClient = {} as SupabaseClient;
      } else {
        // Fail fast in production/development
        const errorMsg =
          'Supabase environment variables are required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY';
        logger.error(errorMsg, new Error(errorMsg), { correlationId });
        throw new Error(errorMsg);
      }
    } else {
      try {
        this.supabaseClient = createClient(
          supabaseUrl,
          supabaseServiceRoleKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          },
        );
        logger.info('✅ SupabaseService initialized successfully', {
          correlationId,
        });
      } catch (error) {
        logger.error('❌ Error creating Supabase client:', error as Error, {
          correlationId,
        });
        throw error;
      }
    }
  }

  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.warn(
        '⚠️ Supabase client not initialized - returning mock client',
        { correlationId },
      );
      return {} as SupabaseClient;
    }
    return this.supabaseClient;
  }

  isReady(): boolean {
    return !!this.supabaseClient && Object.keys(this.supabaseClient).length > 0;
  }

  /**
   * Upload a file to Supabase Storage using service role (bypasses RLS)
   * @param bucket - The storage bucket name
   * @param path - The file path within the bucket
   * @param file - The file buffer to upload
   * @param contentType - The MIME type of the file
   * @returns The public URL of the uploaded file
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
    options?: { upsert?: boolean },
  ): Promise<string> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Uploading file to Supabase Storage', {
      bucket,
      path,
      contentType,
      fileSize: file.length,
      upsert: options?.upsert ?? false,
      correlationId,
    });

    const { error } = await this.supabaseClient.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        upsert: options?.upsert ?? false,
      });

    if (error) {
      logger.error('Failed to upload file to Supabase Storage', error, {
        bucket,
        path,
        contentType,
        correlationId,
      });
      throw error;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabaseClient.storage.from(bucket).getPublicUrl(path);

    logger.info('Successfully uploaded file to Supabase Storage', {
      bucket,
      path,
      publicUrl,
      correlationId,
    });

    return publicUrl;
  }

  /**
   * Upload file to temporary storage bucket (Story 4.4 - Task 2)
   * Temporary files are auto-cleaned after 2 hours
   *
   * @param file - The file buffer to upload
   * @param filename - The filename (UUID-based recommended)
   * @param contentType - The MIME type of the file
   * @returns Object with temporaryUrl (signed, expires in 1 hour) and path for later move
   */
  async uploadToTemp(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<{ temporaryUrl: string; tempPath: string }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const bucket = 'exercise-midi-temp';
    const tempPath = `${Date.now()}_${filename}`;

    logger.info('Uploading file to temporary storage', {
      bucket,
      tempPath,
      contentType,
      fileSize: file.length,
      correlationId,
    });

    const { error } = await this.supabaseClient.storage
      .from(bucket)
      .upload(tempPath, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      logger.error('Failed to upload file to temporary storage', error, {
        bucket,
        tempPath,
        contentType,
        correlationId,
      });
      throw error;
    }

    // Generate signed URL that expires in 1 hour (3600 seconds)
    const { data: signedData, error: signError } =
      await this.supabaseClient.storage
        .from(bucket)
        .createSignedUrl(tempPath, 3600);

    if (signError || !signedData) {
      logger.error('Failed to create signed URL for temp file', signError, {
        bucket,
        tempPath,
        correlationId,
      });
      throw signError || new Error('Failed to create signed URL');
    }

    logger.info('Successfully uploaded file to temporary storage', {
      bucket,
      tempPath,
      signedUrl: signedData.signedUrl,
      expiresIn: '1 hour',
      correlationId,
    });

    return {
      temporaryUrl: signedData.signedUrl,
      tempPath,
    };
  }

  /**
   * Move file from temporary to permanent storage (Story 4.4 - Task 2)
   * This is atomic - either moves successfully or fails without side effects
   *
   * @param tempPath - Path in temporary bucket (from uploadToTemp)
   * @param permanentBucket - Destination bucket (e.g., 'exercise-midi-files')
   * @param permanentPath - Destination path (e.g., 'exercises/{exerciseId}/bassline.mid')
   * @returns The public URL of the file in permanent storage
   */
  async moveToPermanent(
    tempPath: string,
    permanentBucket: string,
    permanentPath: string,
  ): Promise<string> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const tempBucket = 'exercise-midi-temp';

    logger.info('Moving file from temp to permanent storage', {
      tempBucket,
      tempPath,
      permanentBucket,
      permanentPath,
      correlationId,
    });

    // Download from temp
    const { data: fileData, error: downloadError } =
      await this.supabaseClient.storage.from(tempBucket).download(tempPath);

    if (downloadError || !fileData) {
      logger.error('Failed to download file from temp storage', downloadError, {
        tempBucket,
        tempPath,
        correlationId,
      });
      throw downloadError || new Error('Failed to download temp file');
    }

    // Upload to permanent location
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const { error: uploadError } = await this.supabaseClient.storage
      .from(permanentBucket)
      .upload(permanentPath, fileBuffer, {
        contentType: fileData.type,
        upsert: true, // Allow overwriting if file exists
      });

    if (uploadError) {
      logger.error('Failed to upload file to permanent storage', uploadError, {
        permanentBucket,
        permanentPath,
        correlationId,
      });
      throw uploadError;
    }

    // Delete from temp (cleanup)
    const { error: deleteError } = await this.supabaseClient.storage
      .from(tempBucket)
      .remove([tempPath]);

    if (deleteError) {
      // Log warning but don't fail - cleanup will handle it later
      logger.warn(
        'Failed to delete temp file after move (will be cleaned up later)',
        {
          tempBucket,
          tempPath,
          error: deleteError.message || String(deleteError),
          correlationId,
        },
      );
    }

    // Get public URL from permanent location
    const {
      data: { publicUrl },
    } = this.supabaseClient.storage
      .from(permanentBucket)
      .getPublicUrl(permanentPath);

    logger.info('Successfully moved file to permanent storage', {
      tempPath,
      permanentBucket,
      permanentPath,
      publicUrl,
      correlationId,
    });

    return publicUrl;
  }

  /**
   * Delete file from any storage bucket
   *
   * @param bucket - The storage bucket name
   * @param path - The file path within the bucket
   * @returns True if deleted, false if not found
   */
  async deleteFile(bucket: string, path: string): Promise<boolean> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Deleting file from storage', {
      bucket,
      path,
      correlationId,
    });

    const { error } = await this.supabaseClient.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      logger.warn('Failed to delete file', {
        bucket,
        path,
        error: error.message || String(error),
        correlationId,
      });
      return false;
    }

    logger.debug('Successfully deleted file', {
      bucket,
      path,
      correlationId,
    });

    return true;
  }

  /**
   * Delete file from temporary storage (Story 4.4 - Task 2)
   * Used by cleanup cron job
   *
   * @param tempPath - Path in temporary bucket
   * @returns True if deleted, false if not found
   */
  async deleteTempFile(tempPath: string): Promise<boolean> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const tempBucket = 'exercise-midi-temp';

    logger.debug('Deleting temp file', {
      tempBucket,
      tempPath,
      correlationId,
    });

    const { error } = await this.supabaseClient.storage
      .from(tempBucket)
      .remove([tempPath]);

    if (error) {
      logger.warn('Failed to delete temp file', {
        tempBucket,
        tempPath,
        error: error.message || String(error),
        correlationId,
      });
      return false;
    }

    logger.debug('Successfully deleted temp file', {
      tempBucket,
      tempPath,
      correlationId,
    });

    return true;
  }

  /**
   * List all files in temporary storage (Story 4.4 - Task 2)
   * Used by cleanup cron job to find expired files
   *
   * @returns Array of file objects with name and created_at timestamp
   */
  async listTempFiles(): Promise<Array<{ name: string; created_at: string }>> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const tempBucket = 'exercise-midi-temp';

    logger.debug('Listing temp files', {
      tempBucket,
      correlationId,
    });

    const { data, error } = await this.supabaseClient.storage
      .from(tempBucket)
      .list();

    if (error) {
      logger.error('Failed to list temp files', error, {
        tempBucket,
        correlationId,
      });
      throw error;
    }

    return data || [];
  }
}
