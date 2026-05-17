/**
 * AudioSampleManagerAdapter - Bridge between legacy AudioSampleManager API and modular storage system
 *
 * This adapter provides backward compatibility for code using AudioSampleManager
 * while delegating to the new modular storage components.
 *
 * Migration adapter to move from services/storage to modules/storage
 */

import {
  AudioSampleManagerConfig,
  AudioSampleMetadata,
  AudioSampleFormat,
  AudioSampleQualityProfile,
  AudioSampleCategory,
  AudioSampleOperationResult,
  AudioSampleLibrary,
  createStructuredLogger,
} from '@bassnotion/contracts';

import {
  SampleLoader,
  LoadOptions,
  LoadResult,
} from '../loaders/SampleLoader.js';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus } from '../../shared/index.js';
import { SupabaseProviderAdvanced } from '../providers/SupabaseProviderAdvanced.js';
import { createSupabaseProviderAdvanced } from '../providers/index.js';
import type { SupabaseProviderAdvancedConfig } from '../providers/SupabaseProviderAdvanced.js';

const logger = createStructuredLogger('AudioSampleManagerAdapter');

/**
 * Adapter that provides AudioSampleManager interface using modular storage components
 */
export class AudioSampleManagerAdapter {
  private static instance: AudioSampleManagerAdapter | null = null;

  private sampleLoader: SampleLoader;
  private sampleCache: SampleCache;
  private storageProvider: SupabaseProviderAdvanced;
  private eventBus: EventBus;
  private audioContext?: AudioContext;
  private isInitialized = false;

  constructor(private config: AudioSampleManagerConfig) {
    // Initialize storage provider with advanced features
    const providerConfig: SupabaseProviderAdvancedConfig = {
      supabaseUrl: config.storageClientConfig.supabaseUrl,
      supabaseKey: config.storageClientConfig.supabaseAnonKey,
      bucketName: config.storageClientConfig.bucketName,
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableCDN: true,
      enableVersioning: true,
      enableCircuitBreaker: true,
      enableBatchOperations: true,
      enableCDNOptimization: true,
      versionStrategy: 'timestamp',
      maxVersions: 10,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      batchConcurrency: 5,
      batchSize: 100,
    };

    this.storageProvider = createSupabaseProviderAdvanced(providerConfig);

    // Initialize event bus
    this.eventBus = new EventBus();

    // Initialize sample cache
    this.sampleCache = new SampleCache({
      maxSize: config.cacheConfig.maxSize,
      ttl: config.cacheConfig.ttl,
    });

    // Initialize sample loader with cache
    this.sampleLoader = new SampleLoader(
      {
        baseUrl: `${config.storageClientConfig.supabaseUrl}/storage/v1/object/public/${config.storageClientConfig.bucketName}/`,
        defaultQuality: 'high',
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        enableAnalytics: config.analyticsConfig?.enabled || false,
        enableQualityAdaptation: true,
      },
      this.sampleCache,
      this.eventBus,
    );

    logger.info('AudioSampleManagerAdapter created', {
      config: {
        bucketName: config.storageClientConfig.bucketName,
        cacheEnabled: config.cacheConfig.enabled,
        cacheSize: config.cacheConfig.maxSize,
      },
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: AudioSampleManagerConfig,
  ): AudioSampleManagerAdapter {
    if (!AudioSampleManagerAdapter.instance) {
      if (!config) {
        // Default configuration if none provided
        config = {
          storageClientConfig: {
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            bucketName: 'audio-samples',
          },
          cacheConfig: {
            enabled: true,
            maxSize: 100 * 1024 * 1024, // 100MB
            ttl: 3600000, // 1 hour
            persistentCache: false,
          },
          supportedFormats: ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'webm'],
          streamingConfig: {
            enabled: true,
            chunkSize: 64 * 1024, // 64KB
            preloadSize: 128 * 1024, // 128KB
          },
          enableFormatConversion: false,
          predictiveLoadingEnabled: false,
          enableBackgroundProcessing: false,
          analyticsConfig: {
            enabled: false,
          },
        };
      }
      AudioSampleManagerAdapter.instance = new AudioSampleManagerAdapter(
        config,
      );
    }
    return AudioSampleManagerAdapter.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (AudioSampleManagerAdapter.instance) {
      AudioSampleManagerAdapter.instance.dispose();
      AudioSampleManagerAdapter.instance = null;
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize AudioContext
      if (typeof window !== 'undefined' && !this.audioContext) {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
        }
      }

      // Initialize storage provider
      await this.storageProvider.initialize();

      // Initialize sample loader (if it has an initialize method)
      if (typeof this.sampleLoader.initialize === 'function') {
        await this.sampleLoader.initialize();
      }

      this.isInitialized = true;
      logger.info('AudioSampleManagerAdapter initialized');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to initialize AudioSampleManagerAdapter',
        error as Error,
      );
      throw new Error(
        `Failed to initialize AudioSampleManager: ${errorMessage}`,
      );
    }
  }

  /**
   * Load a sample - main compatibility method
   */
  async loadSample(
    sampleId: string,
    options?: {
      quality?: 'low' | 'medium' | 'high' | 'original';
      enableStreaming?: boolean;
      correlationId?: string;
    },
  ): Promise<AudioSampleOperationResult> {
    const startTime = Date.now();

    try {
      // Ensure initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      const loadOptions: LoadOptions = {
        quality: options?.quality || 'high',
        priority: 'normal',
        correlationId: options?.correlationId,
        useCache: this.config.cacheConfig.enabled,
        preload: false,
      };

      const result = await this.sampleLoader.loadSample(
        sampleId,
        undefined,
        loadOptions,
      );

      if (result.success) {
        return {
          success: true,
          sampleId,
          operation: 'load',
          data: result.data,
          duration: Date.now() - startTime,
          size: result.size,
          source: result.fromCache ? 'cache' : 'storage',
          qualityProfile: result.quality as AudioSampleQualityProfile,
          cached: result.fromCache,
          timestamp: Date.now(),
        };
      } else {
        return {
          success: false,
          sampleId,
          operation: 'load',
          duration: Date.now() - startTime,
          source: 'storage',
          error: result.error || new Error('Load failed'),
          errorCode: 'LOAD_FAILED',
          errorMessage: result.error?.message || 'Sample not found',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      return {
        success: false,
        sampleId,
        operation: 'load',
        duration: Date.now() - startTime,
        source: 'storage',
        error: error instanceof Error ? error : new Error('Unknown error'),
        errorCode: 'LOAD_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Preload multiple samples
   */
  async preloadSamples(
    sampleIds: string[],
    options?: {
      priority?: 'high' | 'normal' | 'low';
      quality?: 'low' | 'medium' | 'high' | 'original';
    },
  ): Promise<Map<string, AudioSampleOperationResult>> {
    const results = new Map<string, AudioSampleOperationResult>();

    // Load samples in parallel
    const loadPromises = sampleIds.map(async (sampleId) => {
      const result = await this.loadSample(sampleId, {
        quality: options?.quality,
      });
      results.set(sampleId, result);
    });

    await Promise.all(loadPromises);

    return results;
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.sampleCache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.sampleCache.getStats();
  }

  /**
   * Get library (backward compatibility)
   */
  async getLibrary(libraryId: string): Promise<AudioSampleLibrary | null> {
    // Return a mock library structure for backward compatibility
    return {
      libraryId,
      name: libraryId,
      description: `Library ${libraryId}`,
      samples: [],
      metadata: {
        totalSamples: 0,
        totalSize: 0,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
      },
      tags: [],
    };
  }

  /**
   * Save sample (backward compatibility)
   */
  async saveSample(
    data: ArrayBuffer,
    metadata: AudioSampleMetadata,
  ): Promise<AudioSampleOperationResult> {
    try {
      // Validate sample data
      if (!data || data.byteLength === 0) {
        return {
          success: false,
          operation: 'save',
          error: 'Invalid sample data',
          errorCode: 'INVALID_DATA',
          errorMessage: 'Invalid sample data: Data is empty',
        };
      }

      const path = `samples/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${metadata.format}`;
      const result = await this.storageProvider.upload(data, {
        path,
        contentType: `audio/${metadata.format}`,
        metadata: metadata as any,
      });

      if (result.success) {
        return {
          success: true,
          operation: 'save',
          sampleId: path,
          metadata,
        };
      }

      return {
        success: false,
        operation: 'save',
        error: 'Upload failed',
        errorCode: 'UPLOAD_FAILED',
      };
    } catch (error) {
      logger.error('Failed to save sample', error);
      return {
        success: false,
        operation: 'save',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SAVE_FAILED',
      };
    }
  }

  /**
   * Delete sample (backward compatibility)
   */
  async deleteSample(sampleId: string): Promise<AudioSampleOperationResult> {
    try {
      const result = await this.storageProvider.delete(
        `samples/${sampleId}.wav`,
      );

      if (result.success) {
        // Clear from cache if it exists
        try {
          await this.sampleCache.remove(sampleId);
        } catch (e) {
          // Ignore cache errors
        }

        return {
          success: true,
          operation: 'delete',
          sampleId,
        };
      }

      return {
        success: false,
        operation: 'delete',
        error: 'Delete failed',
        errorCode: 'DELETE_FAILED',
      };
    } catch (error) {
      logger.error('Failed to delete sample', error);
      return {
        success: false,
        operation: 'delete',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'DELETE_FAILED',
      };
    }
  }

  /**
   * Batch load samples (backward compatibility)
   */
  async batchLoadSamples(
    sampleIds: string[],
    options?: LoadOptions,
  ): Promise<LoadResult[]> {
    const results = await Promise.all(
      sampleIds.map((id) => this.loadSample(id, options)),
    );
    return results;
  }

  /**
   * Get storage health (backward compatibility)
   */
  async getStorageHealth(): Promise<any> {
    return this.storageProvider.healthCheck();
  }

  /**
   * Get storage metrics (backward compatibility)
   */
  getStorageMetrics(): any {
    return {
      basic: this.storageProvider.getMetrics(),
      advanced: this.storageProvider.getAdvancedMetrics(),
      circuitBreaker: this.storageProvider.getCircuitBreakerStatus(),
      batchProcessor: this.storageProvider.getBatchProcessorStatus(),
    };
  }

  /**
   * Convert sample (backward compatibility)
   */
  async convertSample(
    sampleId: string,
    targetFormat: AudioSampleFormat,
  ): Promise<AudioSampleOperationResult> {
    // Mock implementation for backward compatibility
    return {
      success: false,
      operation: 'convert',
      error: 'Conversion not implemented',
      errorCode: 'NOT_IMPLEMENTED',
    };
  }

  /**
   * Search samples (backward compatibility)
   */
  async searchSamples(query: string): Promise<AudioSampleMetadata[]> {
    // Mock implementation for backward compatibility
    return [];
  }

  /**
   * Get cache statistics (backward compatibility)
   */
  getCacheStatistics(): any {
    const stats = this.sampleCache.getStats();
    return {
      size: stats.size,
      count: stats.items,
      hitRate: stats.hitRate,
      evictions: stats.evictions,
    };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    // Close AudioContext if it exists
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }

    // Clear cache
    this.sampleCache.clear();

    // Dispose storage provider
    if (
      this.storageProvider &&
      typeof this.storageProvider.dispose === 'function'
    ) {
      await this.storageProvider.dispose();
    }

    this.isInitialized = false;
    AudioSampleManagerAdapter.instance = null;
    logger.info('AudioSampleManagerAdapter disposed');
  }
}

/**
 * Factory function for backward compatibility
 */
export function createAudioSampleManager(
  config: AudioSampleManagerConfig,
): AudioSampleManagerAdapter {
  return AudioSampleManagerAdapter.getInstance(config);
}
