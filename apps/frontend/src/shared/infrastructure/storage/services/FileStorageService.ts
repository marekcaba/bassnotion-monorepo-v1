/**
 * File Storage Service
 *
 * Generic implementation of IStorageService that handles
 * file operations using Supabase Storage.
 *
 * This service provides the core CRUD operations for file storage
 * and can be extended by domain-specific storage services.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@/shared/utils/errorHandling';
import type {
  IStorageService,
  UploadOptions,
  UploadResult,
  DownloadOptions,
  DownloadResult,
  DeleteOptions,
  ListOptions,
  StorageItem,
  StorageConfig,
} from '../types/storage.interface.js';
import { SupabaseClientManager } from '../client/SupabaseClientManager.js';

const logger = createStructuredLogger('FileStorageService');

export class FileStorageService implements IStorageService {
  private clientManager: SupabaseClientManager;
  private config: StorageConfig;
  private requestId = 0;

  constructor(
    clientManager: SupabaseClientManager,
    config?: Partial<StorageConfig>,
  ) {
    this.clientManager = clientManager;
    this.config = {
      provider: 'supabase',
      maxFileSize: 50 * 1024 * 1024, // 50MB default
      ...config,
    };
  }

  /**
   * Upload a file to storage
   */
  async upload(
    file: File | Blob | ArrayBuffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      logger.info('Starting file upload', {
        requestId,
        bucket: options.bucket,
        path: options.path,
        size: this.getFileSize(file),
      });

      // Validate file size
      const fileSize = this.getFileSize(file);
      if (this.config.maxFileSize && fileSize > this.config.maxFileSize) {
        throw new Error(
          `File size ${fileSize} exceeds maximum allowed size ${this.config.maxFileSize}`,
        );
      }

      // Get client
      const client = await this.clientManager.getClient();

      // Convert ArrayBuffer to Blob if needed
      const uploadFile = file instanceof ArrayBuffer ? new Blob([file]) : file;

      // Upload file
      const { data, error } = await client.storage
        .from(options.bucket)
        .upload(options.path, uploadFile, {
          contentType: options.contentType,
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert ?? false,
        });

      if (error) {
        throw error;
      }

      const result: UploadResult = {
        path: data.path,
        fullPath: `${options.bucket}/${data.path}`,
        id: data.id || this.generateFileId(options.path),
        size: fileSize,
        metadata: options.metadata,
      };

      const duration = Date.now() - startTime;
      logger.info('File upload completed', {
        requestId,
        duration,
        result,
      });

      return result;
    } catch (error) {
      logger.error('File upload failed', {
        requestId,
        error,
        options,
      });
      throw error;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * Download a file from storage
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      logger.info('Starting file download', {
        requestId,
        bucket: options.bucket,
        path: options.path,
      });

      const client = await this.clientManager.getClient();

      // Build path with transformations
      let downloadPath = options.path;
      if (options.transform) {
        const params = new URLSearchParams();
        if (options.transform.width)
          params.append('width', options.transform.width.toString());
        if (options.transform.height)
          params.append('height', options.transform.height.toString());
        if (options.transform.quality)
          params.append('quality', options.transform.quality.toString());
        if (options.transform.format)
          params.append('format', options.transform.format);

        if (params.toString()) {
          downloadPath = `${options.path}?${params.toString()}`;
        }
      }

      // Download file
      const { data, error } = await client.storage
        .from(options.bucket)
        .download(downloadPath);

      if (error) {
        throw error;
      }

      // Get file info for metadata
      const { data: fileInfo } = await client.storage
        .from(options.bucket)
        .list(options.path.substring(0, options.path.lastIndexOf('/')), {
          search: options.path.substring(options.path.lastIndexOf('/') + 1),
        });

      const metadata = fileInfo?.[0]?.metadata || {};

      const result: DownloadResult = {
        data: data,
        contentType: data.type || 'application/octet-stream',
        size: data.size,
        metadata,
        cacheControl: metadata.cacheControl,
      };

      const duration = Date.now() - startTime;
      logger.info('File download completed', {
        requestId,
        duration,
        size: result.size,
      });

      return result;
    } catch (error) {
      logger.error('File download failed', {
        requestId,
        error,
        options,
      });
      throw error;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * Delete files from storage
   */
  async delete(options: DeleteOptions): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Starting file deletion', {
        requestId,
        bucket: options.bucket,
        paths: options.paths,
      });

      const client = await this.clientManager.getClient();

      const { error } = await client.storage
        .from(options.bucket)
        .remove(options.paths);

      if (error) {
        throw error;
      }

      logger.info('File deletion completed', {
        requestId,
        count: options.paths.length,
      });
    } catch (error) {
      logger.error('File deletion failed', {
        requestId,
        error,
        options,
      });
      throw error;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * List files in a bucket/prefix
   */
  async list(
    bucket: string,
    prefix?: string,
    options?: ListOptions,
  ): Promise<StorageItem[]> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Starting file list', {
        requestId,
        bucket,
        prefix,
        options,
      });

      const client = await this.clientManager.getClient();

      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: options?.limit || 100,
        offset: options?.offset || 0,
        sortBy: {
          column: options?.sortBy || 'name',
          order: options?.sortOrder || 'asc',
        },
        search: options?.search,
      });

      if (error) {
        throw error;
      }

      const items: StorageItem[] = (data || []).map((file) => ({
        id: file.id || this.generateFileId(file.name),
        name: file.name,
        path: prefix ? `${prefix}/${file.name}` : file.name,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || file.metadata?.contentType,
        createdAt: file.created_at,
        updatedAt: file.updated_at || file.created_at,
        metadata: file.metadata,
      }));

      logger.info('File list completed', {
        requestId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('File list failed', {
        requestId,
        error,
        bucket,
        prefix,
      });
      throw error;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * Get a public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string {
    // For Supabase, construct the public URL
    const baseUrl =
      this.config.baseUrl ||
      'https://your-project.supabase.co/storage/v1/object/public';
    return `${baseUrl}/${bucket}/${path}`;
  }

  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number,
  ): Promise<string> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Generating signed URL', {
        requestId,
        bucket,
        path,
        expiresIn,
      });

      const client = await this.clientManager.getClient();

      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw error;
      }

      logger.info('Signed URL generated', {
        requestId,
      });

      return data.signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        requestId,
        error,
        bucket,
        path,
      });
      throw error;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * Check if a file exists
   */
  async exists(bucket: string, path: string): Promise<boolean> {
    try {
      const client = await this.clientManager.getClient();

      const { data, error } = await client.storage
        .from(bucket)
        .list(path.substring(0, path.lastIndexOf('/')), {
          search: path.substring(path.lastIndexOf('/') + 1),
        });

      if (error) {
        return false;
      }

      return data.some(
        (file) => file.name === path.substring(path.lastIndexOf('/') + 1),
      );
    } catch (error) {
      logger.error('Failed to check file existence', {
        error,
        bucket,
        path,
      });
      return false;
    } finally {
      const client = await this.clientManager.getClient();
      this.clientManager.releaseClient(client);
    }
  }

  /**
   * Copy a file within or between buckets
   */
  async copy(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Starting file copy', {
        requestId,
        source: `${sourceBucket}/${sourcePath}`,
        destination: `${destBucket}/${destPath}`,
      });

      // Download from source
      const downloadResult = await this.download({
        bucket: sourceBucket,
        path: sourcePath,
      });

      // Upload to destination
      await this.upload(downloadResult.data, {
        bucket: destBucket,
        path: destPath,
        contentType: downloadResult.contentType,
        metadata: downloadResult.metadata,
      });

      logger.info('File copy completed', {
        requestId,
      });
    } catch (error) {
      logger.error('File copy failed', {
        requestId,
        error,
        source: `${sourceBucket}/${sourcePath}`,
        destination: `${destBucket}/${destPath}`,
      });
      throw error;
    }
  }

  /**
   * Move a file within or between buckets
   */
  async move(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      logger.info('Starting file move', {
        requestId,
        source: `${sourceBucket}/${sourcePath}`,
        destination: `${destBucket}/${destPath}`,
      });

      // Copy file
      await this.copy(sourceBucket, sourcePath, destBucket, destPath);

      // Delete original
      await this.delete({
        bucket: sourceBucket,
        paths: [sourcePath],
      });

      logger.info('File move completed', {
        requestId,
      });
    } catch (error) {
      logger.error('File move failed', {
        requestId,
        error,
        source: `${sourceBucket}/${sourcePath}`,
        destination: `${destBucket}/${destPath}`,
      });
      throw error;
    }
  }

  /**
   * Helper to get file size
   */
  private getFileSize(file: File | Blob | ArrayBuffer): number {
    if (file instanceof ArrayBuffer) {
      return file.byteLength;
    }
    return file.size;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestId}`;
  }

  /**
   * Generate a file ID from path
   */
  private generateFileId(path: string): string {
    return `file_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  }
}
