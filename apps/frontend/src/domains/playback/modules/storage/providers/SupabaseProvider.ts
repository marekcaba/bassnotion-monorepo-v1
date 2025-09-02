/**
 * SupabaseProvider - Supabase storage provider for audio assets
 * 
 * Provides a simplified interface for storing and retrieving audio
 * assets using Supabase Storage. Extracted from the more complex
 * SupabaseAssetClient to focus on core storage operations.
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('SupabaseProvider');

export interface SupabaseProviderConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enableCDN: boolean;
  cdnUrl?: string;
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
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at?: string;
  metadata?: Record<string, any>;
  bucket_id?: string;
}

/**
 * Storage provider for Supabase
 */
export class SupabaseProvider {
  private config: SupabaseProviderConfig;
  private client: SupabaseClient;
  private eventBus?: EventBus;
  
  // Connection state
  private isConnected = false;
  private connectionRetries = 0;
  
  // Metrics
  private metrics = {
    uploads: 0,
    downloads: 0,
    errors: 0,
    totalUploadSize: 0,
    totalDownloadSize: 0,
  };

  constructor(config: SupabaseProviderConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    
    // Initialize Supabase client
    this.client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    
    this.testConnection();
  }

  /**
   * Test connection to Supabase
   */
  private async testConnection(): Promise<void> {
    try {
      const { data, error } = await this.client.storage
        .from(this.config.bucketName)
        .list('', { limit: 1 });
      
      if (error) {
        throw error;
      }
      
      this.isConnected = true;
      this.connectionRetries = 0;
      logger.info('Connected to Supabase storage');
      
      this.eventBus?.emit('storage:connected', {
        provider: 'supabase',
        bucket: this.config.bucketName,
      });
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      logger.error('Failed to connect to Supabase:', error);
      
      // Retry connection
      if (this.connectionRetries < this.config.maxRetries) {
        setTimeout(() => this.testConnection(), this.config.retryDelay * this.connectionRetries);
      }
    }
  }

  /**
   * Upload a file to storage
   */
  async upload(
    data: ArrayBuffer | Blob | File,
    options: UploadOptions
  ): Promise<StorageResult> {
    const startTime = performance.now();
    
    try {
      // Ensure connected
      if (!this.isConnected) {
        await this.waitForConnection();
      }
      
      // Prepare upload options
      const uploadOptions: any = {
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert !== false,
      };
      
      if (options.contentType) {
        uploadOptions.contentType = options.contentType;
      }
      
      // Upload file
      const { data: uploadData, error } = await this.client.storage
        .from(this.config.bucketName)
        .upload(options.path, data, uploadOptions);
      
      if (error) {
        throw error;
      }
      
      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.config.bucketName)
        .getPublicUrl(options.path);
      
      const size = data instanceof ArrayBuffer 
        ? data.byteLength 
        : data instanceof Blob 
          ? data.size 
          : 0;
      
      // Update metrics
      this.metrics.uploads++;
      this.metrics.totalUploadSize += size;
      
      const result: StorageResult = {
        success: true,
        url: this.config.enableCDN && this.config.cdnUrl
          ? urlData.publicUrl.replace(this.config.supabaseUrl, this.config.cdnUrl)
          : urlData.publicUrl,
        path: uploadData.path,
        size,
        metadata: options.metadata,
      };
      
      const duration = performance.now() - startTime;
      
      this.eventBus?.emit('storage:uploaded', {
        path: options.path,
        size,
        duration,
        provider: 'supabase',
      });
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      
      const result: StorageResult = {
        success: false,
        error: error as Error,
      };
      
      this.eventBus?.emit('storage:uploadError', {
        path: options.path,
        error: (error as Error).message,
        provider: 'supabase',
      });
      
      return result;
    }
  }

  /**
   * Download a file from storage
   */
  async download(
    path: string,
    options: DownloadOptions = {}
  ): Promise<StorageResult & { data?: ArrayBuffer }> {
    const startTime = performance.now();
    
    try {
      // Ensure connected
      if (!this.isConnected) {
        await this.waitForConnection();
      }
      
      // Download file
      const { data, error } = await this.client.storage
        .from(this.config.bucketName)
        .download(path, options.transform);
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error('No data received');
      }
      
      // Convert to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();
      
      // Update metrics
      this.metrics.downloads++;
      this.metrics.totalDownloadSize += arrayBuffer.byteLength;
      
      const result: StorageResult & { data?: ArrayBuffer } = {
        success: true,
        data: arrayBuffer,
        path,
        size: arrayBuffer.byteLength,
      };
      
      const duration = performance.now() - startTime;
      
      this.eventBus?.emit('storage:downloaded', {
        path,
        size: arrayBuffer.byteLength,
        duration,
        provider: 'supabase',
      });
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      
      const result: StorageResult & { data?: ArrayBuffer } = {
        success: false,
        error: error as Error,
      };
      
      this.eventBus?.emit('storage:downloadError', {
        path,
        error: (error as Error).message,
        provider: 'supabase',
      });
      
      return result;
    }
  }

  /**
   * Delete a file from storage
   */
  async delete(paths: string | string[]): Promise<StorageResult> {
    try {
      // Ensure connected
      if (!this.isConnected) {
        await this.waitForConnection();
      }
      
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      const { error } = await this.client.storage
        .from(this.config.bucketName)
        .remove(pathArray);
      
      if (error) {
        throw error;
      }
      
      this.eventBus?.emit('storage:deleted', {
        paths: pathArray,
        provider: 'supabase',
      });
      
      return {
        success: true,
        path: Array.isArray(paths) ? paths.join(',') : paths,
      };
    } catch (error) {
      this.metrics.errors++;
      
      this.eventBus?.emit('storage:deleteError', {
        paths: Array.isArray(paths) ? paths : [paths],
        error: (error as Error).message,
        provider: 'supabase',
      });
      
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * List files in storage
   */
  async list(
    path: string = '',
    options: ListOptions = {}
  ): Promise<{ files: StorageObject[]; error?: Error }> {
    try {
      // Ensure connected
      if (!this.isConnected) {
        await this.waitForConnection();
      }
      
      const { data, error } = await this.client.storage
        .from(this.config.bucketName)
        .list(path, {
          limit: options.limit || 100,
          offset: options.offset || 0,
          sortBy: options.sortBy,
        });
      
      if (error) {
        throw error;
      }
      
      return {
        files: data || [],
      };
    } catch (error) {
      return {
        files: [],
        error: error as Error,
      };
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(path: string): string {
    const { data } = this.client.storage
      .from(this.config.bucketName)
      .getPublicUrl(path);
    
    if (this.config.enableCDN && this.config.cdnUrl) {
      return data.publicUrl.replace(this.config.supabaseUrl, this.config.cdnUrl);
    }
    
    return data.publicUrl;
  }

  /**
   * Create signed URL for temporary access
   */
  async createSignedUrl(
    path: string,
    expiresIn: number = 3600
  ): Promise<{ url?: string; error?: Error }> {
    try {
      const { data, error } = await this.client.storage
        .from(this.config.bucketName)
        .createSignedUrl(path, expiresIn);
      
      if (error) {
        throw error;
      }
      
      return {
        url: data?.signedUrl,
      };
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.storage
        .from(this.config.bucketName)
        .list(path.substring(0, path.lastIndexOf('/')), {
          limit: 1,
          offset: 0,
          search: path.substring(path.lastIndexOf('/') + 1),
        });
      
      if (error) {
        return false;
      }
      
      return (data || []).some(file => file.name === path.substring(path.lastIndexOf('/') + 1));
    } catch (error) {
      return false;
    }
  }

  /**
   * Move/rename a file
   */
  async move(fromPath: string, toPath: string): Promise<StorageResult> {
    try {
      // Download file
      const downloadResult = await this.download(fromPath);
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error('Failed to download file for move');
      }
      
      // Upload to new location
      const uploadResult = await this.upload(downloadResult.data, {
        path: toPath,
        upsert: true,
      });
      
      if (!uploadResult.success) {
        throw new Error('Failed to upload file to new location');
      }
      
      // Delete original
      const deleteResult = await this.delete(fromPath);
      if (!deleteResult.success) {
        // Try to cleanup uploaded file
        await this.delete(toPath);
        throw new Error('Failed to delete original file');
      }
      
      return {
        success: true,
        path: toPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Copy a file
   */
  async copy(fromPath: string, toPath: string): Promise<StorageResult> {
    try {
      // Download file
      const downloadResult = await this.download(fromPath);
      if (!downloadResult.success || !downloadResult.data) {
        throw new Error('Failed to download file for copy');
      }
      
      // Upload to new location
      const uploadResult = await this.upload(downloadResult.data, {
        path: toPath,
        upsert: true,
      });
      
      return uploadResult;
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Wait for connection
   */
  private async waitForConnection(timeout = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.isConnected) {
      throw new Error('Failed to connect to Supabase storage');
    }
  }

  /**
   * Get provider metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SupabaseProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reconnect if URL or key changed
    if (newConfig.supabaseUrl || newConfig.supabaseKey) {
      this.isConnected = false;
      this.client = createClient(
        this.config.supabaseUrl,
        this.config.supabaseKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        }
      );
      this.testConnection();
    }
  }

  /**
   * Get bucket info
   */
  async getBucketInfo(): Promise<{
    name: string;
    public: boolean;
    size?: number;
    fileCount?: number;
  }> {
    try {
      // Note: Supabase doesn't provide direct bucket info API
      // This is a simplified version
      const { data } = await this.list('', { limit: 1000 });
      
      let totalSize = 0;
      const fileCount = data.length;
      
      // Note: Individual file sizes would need to be tracked separately
      // as Supabase list doesn't return file sizes
      
      return {
        name: this.config.bucketName,
        public: true, // Assuming public bucket
        fileCount,
        size: totalSize,
      };
    } catch (error) {
      return {
        name: this.config.bucketName,
        public: true,
        fileCount: 0,
        size: 0,
      };
    }
  }
}