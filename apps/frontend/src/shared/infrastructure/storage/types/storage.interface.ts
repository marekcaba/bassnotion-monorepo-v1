/**
 * Core Storage Service Interface
 *
 * This interface defines the contract for all storage implementations.
 * It provides generic CRUD operations that can be implemented by
 * different storage providers (Supabase, S3, local, etc.)
 */

export interface UploadOptions {
  bucket: string;
  path: string;
  metadata?: Record<string, any>;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

export interface UploadResult {
  path: string;
  fullPath: string;
  id: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface DownloadOptions {
  bucket: string;
  path: string;
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'origin' | 'webp' | 'jpg' | 'png';
  };
}

export interface DownloadResult {
  data: Blob | ArrayBuffer;
  contentType: string;
  size: number;
  metadata?: Record<string, any>;
  cacheControl?: string;
}

export interface StorageItem {
  id: string;
  name: string;
  path: string;
  size: number;
  contentType?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'size';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface DeleteOptions {
  bucket: string;
  paths: string[];
}

/**
 * Core storage service interface
 */
export interface IStorageService {
  /**
   * Upload a file to storage
   */
  upload(
    file: File | Blob | ArrayBuffer,
    options: UploadOptions,
  ): Promise<UploadResult>;

  /**
   * Download a file from storage
   */
  download(options: DownloadOptions): Promise<DownloadResult>;

  /**
   * Delete files from storage
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * List files in a bucket/prefix
   */
  list(
    bucket: string,
    prefix?: string,
    options?: ListOptions,
  ): Promise<StorageItem[]>;

  /**
   * Get a public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * Get a signed URL for temporary access
   */
  getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number,
  ): Promise<string>;

  /**
   * Check if a file exists
   */
  exists(bucket: string, path: string): Promise<boolean>;

  /**
   * Copy a file within or between buckets
   */
  copy(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<void>;

  /**
   * Move a file within or between buckets
   */
  move(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<void>;
}

/**
 * Storage service configuration
 */
export interface StorageConfig {
  provider: 'supabase' | 's3' | 'gcs' | 'local';
  baseUrl?: string;
  defaultBucket?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  // Provider-specific config
  providerConfig?: Record<string, any>;
}
