/**
 * StorageProvider - Base interface for storage providers
 * 
 * Defines the common interface that all storage providers must implement.
 * This allows for easy switching between different storage backends.
 */

export interface StorageProvider {
  /**
   * Upload/store data
   */
  upload(
    data: ArrayBuffer | Blob | File,
    options: UploadOptions
  ): Promise<StorageResult>;

  /**
   * Download/retrieve data
   */
  download(
    path: string,
    options?: DownloadOptions
  ): Promise<StorageResult & { data?: ArrayBuffer }>;

  /**
   * Delete data
   */
  delete(paths: string | string[]): Promise<StorageResult>;

  /**
   * List files
   */
  list(
    path?: string,
    options?: ListOptions
  ): Promise<{ files: StorageObject[]; error?: Error }>;

  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get public URL (if applicable)
   */
  getPublicUrl?(path: string): string;

  /**
   * Create signed URL (if applicable)
   */
  createSignedUrl?(
    path: string,
    expiresIn: number
  ): Promise<{ url?: string; error?: Error }>;

  /**
   * Move/rename file
   */
  move?(fromPath: string, toPath: string): Promise<StorageResult>;

  /**
   * Copy file
   */
  copy?(fromPath: string, toPath: string): Promise<StorageResult>;

  /**
   * Get provider metrics
   */
  getMetrics(): StorageMetrics;

  /**
   * Check if provider is ready
   */
  isReady(): boolean;

  /**
   * Update configuration
   */
  updateConfig?(config: any): void;
}

export interface StorageResult {
  success: boolean;
  url?: string;
  path?: string;
  size?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  path: string;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  metadata?: Record<string, any>;
}

export interface DownloadOptions {
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  };
  download?: boolean;
}

export interface ListOptions {
  prefix?: string;
  limit?: number;
  offset?: number;
  sortBy?: {
    column: string;
    order: 'asc' | 'desc';
  };
}

export interface StorageObject {
  name: string;
  path?: string;
  id?: string;
  size?: number;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: Record<string, any>;
}

export interface StorageMetrics {
  uploads?: number;
  downloads?: number;
  stored?: number;
  retrieved?: number;
  deleted?: number;
  errors: number;
  totalUploadSize?: number;
  totalDownloadSize?: number;
  totalSize?: number;
}

/**
 * Factory for creating storage providers
 */
export class StorageProviderFactory {
  private static providers = new Map<string, new (...args: any[]) => StorageProvider>();

  /**
   * Register a provider type
   */
  static register(
    type: string,
    providerClass: new (...args: any[]) => StorageProvider
  ): void {
    this.providers.set(type, providerClass);
  }

  /**
   * Create a provider instance
   */
  static create(
    type: string,
    config: any,
    ...args: any[]
  ): StorageProvider {
    const ProviderClass = this.providers.get(type);
    
    if (!ProviderClass) {
      throw new Error(`Unknown storage provider type: ${type}`);
    }
    
    return new ProviderClass(config, ...args);
  }

  /**
   * Get available provider types
   */
  static getTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Storage provider type enum
 */
export enum StorageProviderType {
  SUPABASE = 'supabase',
  LOCAL = 'local',
  S3 = 's3',
  AZURE = 'azure',
  GCS = 'gcs',
}