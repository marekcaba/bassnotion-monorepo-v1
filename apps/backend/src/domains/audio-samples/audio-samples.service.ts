import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

@Injectable()
export class AudioSamplesService {
  private readonly logger = new Logger(AudioSamplesService.name);
  private readonly bucketName = 'audio-samples';

  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadSample(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; path: string }> {
    try {
      const client = this.supabaseService.getClient();
      
      this.logger.log(`Uploading sample to: ${filePath}`);
      
      const { error } = await client.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/${filePath}`;
      
      this.logger.log(`Sample uploaded successfully: ${filePath}`);
      
      return {
        url: publicUrl,
        path: filePath,
      };
    } catch (error) {
      this.logger.error(`Failed to upload sample: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async uploadBatch(
    samples: Array<{
      path: string;
      buffer: Buffer;
      contentType: string;
    }>,
  ): Promise<Array<{ path: string; url: string; success: boolean; error?: string }>> {
    const results = await Promise.all(
      samples.map(async (sample) => {
        try {
          const result = await this.uploadSample(
            sample.path,
            sample.buffer,
            sample.contentType,
          );
          return {
            ...result,
            success: true,
          };
        } catch (error) {
          return {
            path: sample.path,
            url: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Batch upload complete: ${successCount}/${samples.length} successful`,
    );

    return results;
  }

  async createMetadata(
    path: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getClient();
      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));

      await client.storage
        .from(this.bucketName)
        .upload(path, metadataBuffer, {
          contentType: 'application/json',
          cacheControl: '3600',
          upsert: true,
        });

      this.logger.log(`Metadata created at: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to create metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}