/**
 * Supabase Asset Client Facade
 *
 * Simplified facade that delegates to shared infrastructure services
 * Maintains backward compatibility while using new modular architecture
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SupabaseAssetClientConfig,
  DownloadOptions,
  DownloadResult,
  StorageMetrics,
} from '@bassnotion/contracts';

// Shared infrastructure imports
import {
  SupabaseClientManager,
  FileStorageService,
  CDNService,
  MonitoringService,
  type IStorageService,
  type ICDNService,
  type IMonitoringService,
} from '@/shared/infrastructure/storage/index.js';

// Domain-specific adapters
import { AudioStorageService } from '../AudioStorageService.js';
import {
  PlaybackAuthenticationManager,
  PlaybackSecurityMonitor,
} from './auth/index.js';
import { PlaybackCDNService } from './cdn/index.js';
import { PlaybackMonitoringService } from './monitoring/index.js';

const logger = createStructuredLogger('SupabaseAssetClientFacade');

/**
 * Facade for SupabaseAssetClient
 * Delegates to modular services while maintaining the same public API
 */
export class SupabaseAssetClient {
  private static instance: SupabaseAssetClient | null = null;
  private static defaultConfig: SupabaseAssetClientConfig | null = null;

  // Core services
  private clientManager: SupabaseClientManager;
  private storageService: AudioStorageService;
  private authManager: PlaybackAuthenticationManager;
  private securityMonitor: PlaybackSecurityMonitor;
  private cdnService: PlaybackCDNService;
  private monitoringService: PlaybackMonitoringService;

  // Legacy compatibility
  private config: SupabaseAssetClientConfig;
  private isInitialized = false;
  private metrics: StorageMetrics;

  constructor(config: SupabaseAssetClientConfig) {
    this.config = {
      maxConnections: 10,
      failoverTimeout: 5000,
      healthCheckInterval: 30000,
      circuitBreakerThreshold: 5,
      retryAttempts: 3,
      retryBackoffMs: 1000,
      enableGeographicOptimization: true,
      ...config,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      lastRequestTime: 0,
      cacheHitRate: 0,
      cdnHitRate: 0,
      compressionSavings: 0,
    };

    // Initialize services
    this.clientManager = new SupabaseClientManager(config);
    this.storageService = new AudioStorageService(
      new FileStorageService(
        this.clientManager,
        config.bucketName || 'audio-samples',
      ),
    );

    // Initialize authentication if configured
    if (config.authenticationConfig) {
      const client = this.clientManager.getPrimaryClient();
      this.authManager = new PlaybackAuthenticationManager(
        config.authenticationConfig,
        client,
        {
          totalAuthAttempts: 0,
          successfulAuths: 0,
          failedAuths: 0,
          tokenRefreshCount: 0,
          sessionExtensions: 0,
          securityIncidents: 0,
          averageSessionDuration: 0,
          lastAuthTime: 0,
          lastTokenRefresh: 0,
          suspiciousActivityScore: 0,
        },
      );

      if (config.authenticationConfig.securityMonitoringEnabled) {
        this.securityMonitor = new PlaybackSecurityMonitor(
          config.authenticationConfig.securityConfig || { enabled: true },
          this.authManager.getMetrics(),
        );
      }
    }

    // Initialize CDN if configured
    if (config.cdnOptimizationConfig) {
      this.cdnService = new PlaybackCDNService(config.cdnOptimizationConfig);
    }

    // Initialize monitoring
    this.monitoringService = new PlaybackMonitoringService({
      enabled: config.realTimeMonitoringConfig?.enabled || false,
      metricsInterval: 60000,
      healthCheckInterval: 30000,
    });

    logger.info('SupabaseAssetClient facade created', {
      config: { bucketName: config.bucketName },
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SupabaseAssetClientConfig): SupabaseAssetClient {
    if (config && !SupabaseAssetClient.defaultConfig) {
      SupabaseAssetClient.defaultConfig = config;
    }

    if (!SupabaseAssetClient.instance) {
      const configToUse = config || SupabaseAssetClient.defaultConfig;
      if (!configToUse) {
        throw new Error(
          'SupabaseAssetClient requires configuration on first initialization',
        );
      }
      SupabaseAssetClient.instance = new SupabaseAssetClient(configToUse);
    }

    return SupabaseAssetClient.instance;
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize client manager
      await this.clientManager.initialize();

      // Initialize storage service
      await this.storageService.initialize();

      // Initialize CDN if available
      if (this.cdnService) {
        await this.cdnService.initialize();
      }

      // Start monitoring
      if (this.monitoringService) {
        await this.monitoringService.start();
      }

      this.isInitialized = true;
      logger.info('SupabaseAssetClient initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SupabaseAssetClient', error);
      throw error;
    }
  }

  /**
   * Download asset with options
   */
  async downloadAsset(
    path: string,
    options?: DownloadOptions,
  ): Promise<DownloadResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.metrics.totalRequests++;
    const startTime = Date.now();

    try {
      // Use CDN if available
      let downloadUrl = path;
      if (this.cdnService && options?.useCDN !== false) {
        downloadUrl = await this.cdnService.getOptimalAudioEndpoint(
          path,
          options?.quality,
        );
      }

      // Download through storage service
      const result = await this.storageService.downloadAudio(path);

      // Update metrics
      this.metrics.successfulRequests++;
      const duration = Date.now() - startTime;
      this.metrics.averageLatency =
        (this.metrics.averageLatency * (this.metrics.totalRequests - 1) +
          duration) /
        this.metrics.totalRequests;
      this.metrics.lastRequestTime = Date.now();

      // Record in monitoring
      if (this.monitoringService) {
        this.monitoringService.recordMetric('download_duration', duration);
        this.monitoringService.recordPlaybackEvent('asset_downloaded', {
          path,
          duration,
          size: result.size,
        });
      }

      return result;
    } catch (error) {
      this.metrics.failedRequests++;

      if (this.monitoringService) {
        this.monitoringService.recordPlaybackEvent(
          'download_failed',
          {
            path,
            error: error instanceof Error ? error.message : String(error),
          },
          'error',
        );
      }

      throw error;
    }
  }

  /**
   * Preload audio samples (delegates to AudioStorageService)
   */
  async preloadAudioSamples(
    paths: string[],
    options?: { priority?: 'high' | 'normal' | 'low' },
  ): Promise<Map<string, AudioBuffer>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info('Preloading audio samples', {
      count: paths.length,
      priority: options?.priority,
    });

    // Warm CDN cache if available
    if (this.cdnService) {
      const priorities = new Map(
        paths.map((path, i) => [path, paths.length - i]),
      );
      await this.cdnService.warmAudioCache(paths, priorities);
    }

    // Preload through audio storage service
    const buffers = await this.storageService.preloadAudioSamples(
      paths,
      options,
    );

    if (this.monitoringService) {
      this.monitoringService.recordPlaybackEvent('samples_preloaded', {
        count: paths.length,
        priority: options?.priority || 'normal',
      });
    }

    return buffers;
  }

  /**
   * Upload asset
   */
  async uploadAsset(
    path: string,
    data: Blob | File | ArrayBuffer,
    options?: { contentType?: string; cacheControl?: string },
  ): Promise<{ path: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.metrics.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await this.storageService.upload(path, data, options);

      this.metrics.successfulRequests++;
      const duration = Date.now() - startTime;

      if (this.monitoringService) {
        this.monitoringService.recordMetric('upload_duration', duration);
      }

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Delete asset
   */
  async deleteAsset(path: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.storageService.delete(path);

    // Invalidate CDN cache if available
    if (this.cdnService) {
      await this.cdnService.invalidateCache([path]);
    }
  }

  /**
   * List assets
   */
  async listAssets(
    prefix?: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ path: string; size: number; lastModified: Date }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const items = await this.storageService.list(prefix, options);

    return items.map((item) => ({
      path: item.name,
      size: item.metadata?.size || 0,
      lastModified: new Date(item.updated_at || item.created_at),
    }));
  }

  /**
   * Get public URL
   */
  getPublicUrl(path: string): string {
    const client = this.clientManager.getPrimaryClient();
    const { data } = client.storage
      .from(this.config.bucketName || 'audio-samples')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Get storage metrics
   */
  getMetrics(): StorageMetrics {
    const performanceMetrics = this.monitoringService?.getPerformanceMetrics();

    return {
      ...this.metrics,
      cacheHitRate: performanceMetrics?.availability.successRate || 0,
      cdnHitRate: this.cdnService?.getMetrics().cacheHitRate || 0,
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    components: Record<string, { healthy: boolean; message?: string }>;
  }> {
    const components: Record<string, { healthy: boolean; message?: string }> =
      {};

    // Check client manager health
    components.clientManager = {
      healthy: this.clientManager.isHealthy(
        this.clientManager.getPrimaryClient(),
      ),
    };

    // Check monitoring health
    if (this.monitoringService) {
      const health = this.monitoringService.getHealthStatus();
      components.monitoring = {
        healthy: health.overallStatus === 'healthy',
        message: health.overallStatus,
      };

      // Check audio-specific health
      const audioHealth = await this.monitoringService.checkAudioSystemHealth();
      components.audio = {
        healthy: audioHealth.healthy,
        message: audioHealth.issues.join(', '),
      };
    }

    // Check CDN health
    if (this.cdnService) {
      const cdnHealth = this.cdnService.getHealthStatus();
      components.cdn = {
        healthy: cdnHealth.overallHealth === 'healthy',
        message: cdnHealth.overallHealth,
      };
    }

    const healthy = Object.values(components).every((c) => c.healthy);

    return { healthy, components };
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    logger.info('Disposing SupabaseAssetClient');

    if (this.monitoringService) {
      await this.monitoringService.stop();
    }

    if (this.cdnService) {
      await this.cdnService.dispose();
    }

    if (this.authManager) {
      await this.authManager.signOut();
    }

    await this.clientManager.dispose();

    this.isInitialized = false;
    SupabaseAssetClient.instance = null;

    logger.info('SupabaseAssetClient disposed');
  }
}

// Deprecation notice
logger.warn(
  'SupabaseAssetClient is now a facade. Consider using the modular services directly for new code.',
);
