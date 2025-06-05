/**
 * AssetManager - Supabase CDN Asset Loading with Fallback
 *
 * Manages asset loading from Supabase Storage via CDN with intelligent
 * fallback strategies, caching, and error recovery for Epic 2 architecture.
 *
 * Part of Story 2.1: Task 11, Subtask 11.4
 */

import type {
  AssetReference,
  ProcessedAssetManifest,
  AssetLoadingGroup,
  AssetOptimization,
  AssetManagerConfig,
  AssetLoadResult,
  AssetLoadError,
  AssetLoadProgress,
} from '../types/audio.js';
import { NetworkLatencyMonitor } from './NetworkLatencyMonitor.js';
import { CacheMetricsCollector } from './CacheMetricsCollector.js';

export class AssetManager {
  private static instance: AssetManager;
  private config: AssetManagerConfig;
  private audioContext: AudioContext | null = null;
  private cache: Map<string, ArrayBuffer | AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AssetLoadResult>> = new Map();
  private loadProgress: AssetLoadProgress = {
    totalAssets: 0,
    loadedAssets: 0,
    failedAssets: 0,
    bytesLoaded: 0,
    totalBytes: 0,
    loadingSpeed: 0,
  };
  private loadStartTime = 0;
  private networkMonitor: NetworkLatencyMonitor;
  private cacheMetrics: CacheMetricsCollector;

  private constructor(config: Partial<AssetManagerConfig> = {}) {
    this.config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      cdnEnabled: true,
      cdnBaseUrl: process.env.NEXT_PUBLIC_CDN_URL,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableCompression: true,
      maxConcurrentLoads: 6,
      ...config,
    };

    // Initialize monitoring services
    this.networkMonitor = NetworkLatencyMonitor.getInstance();
    this.cacheMetrics = CacheMetricsCollector.getInstance();

    // Start monitoring
    this.networkMonitor.startMonitoring();
    this.cacheMetrics.startTracking();
  }

  public static getInstance(
    config?: Partial<AssetManagerConfig>,
  ): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager(config);
    }
    return AssetManager.instance;
  }

  /**
   * Set audio context for audio decoding
   */
  public setAudioContext(audioContext: AudioContext): void {
    this.audioContext = audioContext;
  }

  /**
   * Load all assets from processed manifest with Epic 2 optimizations
   */
  public async loadAssetsFromManifest(
    manifest: ProcessedAssetManifest,
  ): Promise<{
    successful: AssetLoadResult[];
    failed: AssetLoadError[];
    progress: AssetLoadProgress;
  }> {
    this.initializeLoadProgress(manifest);
    this.loadStartTime = Date.now();

    const successful: AssetLoadResult[] = [];
    const failed: AssetLoadError[] = [];

    // Process loading groups in priority order
    for (const group of manifest.loadingGroups) {
      const groupResults = await this.loadAssetGroup(group, manifest);
      successful.push(...groupResults.successful);
      failed.push(...groupResults.failed);
    }

    // Update final progress
    this.loadProgress.loadingSpeed = this.calculateLoadingSpeed();

    return {
      successful,
      failed,
      progress: { ...this.loadProgress },
    };
  }

  /**
   * Load asset group with parallel/sequential strategy
   */
  private async loadAssetGroup(
    group: AssetLoadingGroup,
    manifest: ProcessedAssetManifest,
  ): Promise<{
    successful: AssetLoadResult[];
    failed: AssetLoadError[];
  }> {
    const successful: AssetLoadResult[] = [];
    const failed: AssetLoadError[] = [];

    if (group.parallelLoadable) {
      // Parallel loading with concurrency limit
      const semaphore = new Semaphore(this.config.maxConcurrentLoads);
      const promises = group.assets.map(async (asset) => {
        await semaphore.acquire();
        try {
          const result = await this.loadAsset(asset, manifest);
          successful.push(result);
        } catch (error) {
          failed.push(error as AssetLoadError);
        } finally {
          semaphore.release();
        }
      });

      await Promise.all(promises);
    } else {
      // Sequential loading for dependency management
      for (const asset of group.assets) {
        try {
          const result = await this.loadAsset(asset, manifest);
          successful.push(result);
        } catch (error) {
          failed.push(error as AssetLoadError);

          // Stop sequential loading if this is a required asset
          if (group.requiredForPlayback) {
            break;
          }
        }
      }
    }

    return { successful, failed };
  }

  /**
   * Load single asset with CDN fallback and caching
   */
  public async loadAsset(
    asset: AssetReference,
    manifest: ProcessedAssetManifest,
  ): Promise<AssetLoadResult> {
    const startTime = Date.now();

    // Check cache first
    const cached = this.cache.get(asset.url);
    if (cached) {
      // Record cache hit
      this.cacheMetrics.recordOperation(asset.url, 'hit', {
        assetType: asset.type,
        assetPriority: asset.priority,
        loadTime: Date.now() - startTime,
      });

      return {
        url: asset.url,
        data: cached,
        source: 'cache',
        loadTime: 0,
        compressionUsed: false,
      };
    }

    // Record cache miss
    this.cacheMetrics.recordOperation(asset.url, 'miss', {
      assetType: asset.type,
      assetPriority: asset.priority,
    });

    // Check if already loading
    const existingPromise = this.loadingPromises.get(asset.url);
    if (existingPromise) {
      return existingPromise;
    }

    // Create loading promise
    const loadPromise = this.performAssetLoad(asset, manifest, startTime);
    this.loadingPromises.set(asset.url, loadPromise);

    try {
      const result = await loadPromise;
      this.updateLoadProgress(asset, result);
      return result;
    } finally {
      this.loadingPromises.delete(asset.url);
    }
  }

  /**
   * Perform actual asset loading with fallback strategy
   */
  private async performAssetLoad(
    asset: AssetReference,
    manifest: ProcessedAssetManifest,
    startTime: number,
  ): Promise<AssetLoadResult> {
    const optimization = manifest.optimizations.get(asset.url);
    const attemptedSources: string[] = [];
    let lastError: Error | null = null;

    // Epic 2: Try CDN first if enabled
    if (this.config.cdnEnabled && this.config.cdnBaseUrl) {
      try {
        const cdnUrl = this.buildCDNUrl(asset, optimization);
        attemptedSources.push('cdn');
        const data = await this.fetchAsset(cdnUrl, asset.type);

        this.cache.set(asset.url, data);
        return {
          url: asset.url,
          data,
          source: 'cdn',
          loadTime: Date.now() - startTime,
          compressionUsed: optimization?.compressionLevel !== 'none',
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`CDN load failed for ${asset.url}:`, error);
      }
    }

    // Fallback to direct Supabase Storage
    try {
      const supabaseUrl = this.buildSupabaseUrl(asset);
      attemptedSources.push('supabase');
      const data = await this.fetchAsset(supabaseUrl, asset.type);

      this.cache.set(asset.url, data);
      return {
        url: asset.url,
        data,
        source: 'supabase',
        loadTime: Date.now() - startTime,
        compressionUsed: false,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`Supabase load failed for ${asset.url}:`, error);
    }

    // All sources failed
    const loadError: AssetLoadError = {
      url: asset.url,
      error: lastError || new Error('All loading sources failed'),
      attemptedSources,
      retryCount: 0,
    };

    this.loadProgress.failedAssets++;
    throw loadError;
  }

  /**
   * Build CDN URL with optimization parameters
   */
  private buildCDNUrl(
    asset: AssetReference,
    optimization?: AssetOptimization,
  ): string {
    const baseUrl = this.config.cdnBaseUrl;
    if (!baseUrl) {
      throw new Error('CDN base URL not configured');
    }
    const path = this.extractStoragePath(asset.url);
    let cdnUrl = `${baseUrl}/${path}`;

    // Add optimization parameters for CDN
    if (optimization && this.config.enableCompression) {
      const params = new URLSearchParams();

      if (optimization.compressionLevel !== 'none') {
        params.append('compress', optimization.compressionLevel);
      }

      if (optimization.qualityTarget !== 'maximum') {
        params.append('quality', optimization.qualityTarget);
      }

      if (asset.type === 'audio' && optimization.deviceOptimized) {
        // Request appropriate format for device
        params.append('format', 'auto');
      }

      if (params.toString()) {
        cdnUrl += `?${params.toString()}`;
      }
    }

    return cdnUrl;
  }

  /**
   * Build direct Supabase Storage URL
   */
  private buildSupabaseUrl(asset: AssetReference): string {
    // If asset.url is already a full Supabase URL, use it directly
    if (asset.url.startsWith('http')) {
      return asset.url;
    }

    // Build Supabase Storage URL
    const bucket = this.determineBucket(asset);
    return `${this.config.supabaseUrl}/storage/v1/object/public/${bucket}/${asset.url}`;
  }

  /**
   * Determine Supabase bucket based on asset category
   */
  private determineBucket(asset: AssetReference): string {
    switch (asset.category) {
      case 'bassline':
      case 'chords':
        return 'tutorial-midi';
      case 'drums':
        return 'library-midi';
      case 'bass-sample':
      case 'drum-sample':
        return 'audio-samples';
      case 'ambience':
        return 'ambience-tracks';
      default:
        return 'assets';
    }
  }

  /**
   * Extract storage path from full URL
   */
  private extractStoragePath(url: string): string {
    if (url.startsWith('http')) {
      // Extract path from full URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const publicIndex = pathParts.indexOf('public');
      if (publicIndex !== -1 && publicIndex < pathParts.length - 1) {
        return pathParts.slice(publicIndex + 1).join('/');
      }
    }
    return url;
  }

  /**
   * Fetch asset with timeout and retries
   */
  private async fetchAsset(
    url: string,
    type: 'midi' | 'audio',
  ): Promise<ArrayBuffer | AudioBuffer> {
    // Start network latency measurement
    const source = url.includes(this.config.cdnBaseUrl || '')
      ? 'cdn'
      : 'supabase';
    const measurementId = this.networkMonitor.startAssetMeasurement(
      url,
      source,
      type,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: type === 'midi' ? 'audio/midi' : 'audio/*',
        },
      });

      if (!response.ok) {
        // Complete measurement with failure
        this.networkMonitor.completeAssetMeasurement(
          measurementId,
          false,
          `HTTP ${response.status}: ${response.statusText}`,
        );
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Complete measurement with success
      this.networkMonitor.completeAssetMeasurement(
        measurementId,
        true,
        undefined,
        arrayBuffer.byteLength,
      );

      // Decode audio if needed and audio context is available
      if (type === 'audio' && this.audioContext) {
        try {
          return await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (decodeError) {
          console.warn(
            'Audio decode failed, returning raw buffer:',
            decodeError,
          );
          return arrayBuffer;
        }
      }

      return arrayBuffer;
    } catch (error) {
      // Complete measurement with error
      this.networkMonitor.completeAssetMeasurement(
        measurementId,
        false,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Initialize load progress tracking
   */
  private initializeLoadProgress(manifest: ProcessedAssetManifest): void {
    this.loadProgress = {
      totalAssets: manifest.totalCount,
      loadedAssets: 0,
      failedAssets: 0,
      bytesLoaded: 0,
      totalBytes: manifest.totalSize,
      loadingSpeed: 0,
    };
  }

  /**
   * Update load progress for completed asset
   */
  private updateLoadProgress(
    asset: AssetReference,
    result: AssetLoadResult,
  ): void {
    this.loadProgress.loadedAssets++;
    this.loadProgress.currentAsset = asset.url;

    // Estimate bytes loaded (rough approximation)
    if (result.data instanceof ArrayBuffer) {
      this.loadProgress.bytesLoaded += result.data.byteLength;
    } else if (result.data instanceof AudioBuffer) {
      // Estimate AudioBuffer size
      this.loadProgress.bytesLoaded +=
        result.data.length * result.data.numberOfChannels * 4;
    }

    this.loadProgress.loadingSpeed = this.calculateLoadingSpeed();
  }

  /**
   * Calculate current loading speed in bytes per second
   */
  private calculateLoadingSpeed(): number {
    const elapsed = Date.now() - this.loadStartTime;
    if (elapsed === 0) return 0;
    return (this.loadProgress.bytesLoaded / elapsed) * 1000; // Convert to bytes per second
  }

  /**
   * Get current loading progress
   */
  public getLoadProgress(): AssetLoadProgress {
    return { ...this.loadProgress };
  }

  /**
   * Clear asset cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size in bytes
   */
  public getCacheSize(): number {
    let totalSize = 0;
    this.cache.forEach((data) => {
      if (data instanceof ArrayBuffer) {
        totalSize += data.byteLength;
      } else if (data instanceof AudioBuffer) {
        totalSize += data.length * data.numberOfChannels * 4;
      }
    });
    return totalSize;
  }

  /**
   * Preload critical assets for faster playback
   */
  public async preloadCriticalAssets(
    manifest: ProcessedAssetManifest,
  ): Promise<AssetLoadResult[]> {
    const criticalAssets = manifest.assets.filter((asset) =>
      manifest.criticalPath.includes(asset.url),
    );

    const results: AssetLoadResult[] = [];
    for (const asset of criticalAssets) {
      try {
        const result = await this.loadAsset(asset, manifest);
        results.push(result);
      } catch (error) {
        console.error(`Failed to preload critical asset ${asset.url}:`, error);
      }
    }

    return results;
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.clearCache();
    this.loadingPromises.clear();
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}
