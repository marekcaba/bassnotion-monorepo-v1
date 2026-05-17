/**
 * Global Sample Cache - Enhanced singleton cache
 *
 * Combines functionality from the original GlobalSampleCache with the new SampleCache
 * to provide comprehensive caching for:
 * - Audio samples (URLs, AudioBuffers, Tone.js samplers)
 * - Complete instruments (Salamander piano, etc.)
 * - Backward compatibility with existing CachedToneBufferLoader
 * - AudioContext-aware buffer management
 */

import type { Sampler } from 'tone';
import type { AudioSampleMetadata } from '@bassnotion/contracts';
import { EventBus, createStructuredLogger } from '../../shared/index.js';
import { SampleCache, type CacheConfig } from './SampleCache.js';
import {
  LocalProvider,
  type LocalProviderConfig,
} from '../providers/LocalProvider.js';

const logger = createStructuredLogger('GlobalSampleCache');

export type CachePriority = 'low' | 'normal' | 'high' | 'critical';

export interface CachedSample {
  url: string;
  buffer?: AudioBuffer;
  rawBuffer?: ArrayBuffer; // Raw audio data (not yet decoded)
  sampler?: Sampler;
  loadedAt: number;
  type: 'buffer' | 'sampler' | 'url' | 'raw';
  isContextCompatible?: boolean; // If true, buffer is from current AudioContext and should survive cleanup

  // Access tracking for smarter eviction
  lastAccessed: number; // Timestamp of last get()
  accessCount: number; // Total times accessed

  // Priority for eviction decisions
  priority: CachePriority;

  // Size tracking for memory management
  sizeBytes: number; // Estimated size in bytes
}

export interface CachedInstrument {
  name: string;
  sampler: any; // Tone.Sampler or similar
  loadedAt: number;
}

export interface GlobalCacheStats {
  samplesCount: number;
  instrumentsCount: number;
  totalSize: number;
  bufferCount: number;
  urlCount: number;
  totalCachedBuffers: number;
  totalCachedUrls: number;
  estimatedMemoryMB: number;
  intelligentCacheStats?: any;
}

// ==========================================
// Performance Tracking Types
// ==========================================

export interface LayerPerformanceMetrics {
  hitRate: number;
  missRate: number;
  averageLatencyMs: number;
  errorRate: number;
  operationCounts: {
    get: number;
    set: number;
    delete: number;
    hits: number;
    misses: number;
    errors: number;
  };
  totalBytes: number;
  isHealthy: boolean;
}

export interface CachePerformanceReport {
  memory: LayerPerformanceMetrics;
  indexedDB: LayerPerformanceMetrics;
  combined: LayerPerformanceMetrics;
  timestamp: number;
}

/**
 * Enhanced global sample cache that combines all caching functionality
 */
export class GlobalSampleCacheImpl {
  private static instance: GlobalSampleCacheImpl | null = null;

  // Legacy caches for backward compatibility
  private samples = new Map<string, CachedSample>();
  private instruments = new Map<string, CachedInstrument>();
  private urlCache = new Map<string, string>(); // path -> Supabase URL
  private metadata = new Map<string, any>(); // Generic metadata cache for FAANG strategies

  // New intelligent cache
  private sampleCache: SampleCache;
  private eventBus: EventBus;

  // Persistent storage for IndexedDB caching
  private localStorage: LocalProvider | null = null;

  // Offline mode flag - when true, only use cached samples (no network)
  private offlineMode = false;

  // Performance tracking state
  private layerMetrics = {
    memory: this.createEmptyMetrics(),
    indexedDB: this.createEmptyMetrics(),
  };
  private readonly LATENCY_WINDOW_SIZE = 100; // Rolling window for latency calculations

  private constructor() {
    this.eventBus = new EventBus();

    // Initialize with production-ready defaults
    const cacheConfig: CacheConfig = {
      maxSize: 500 * 1024 * 1024, // 500MB
      maxEntries: 10000,
      evictionStrategy: 'adaptive',
      enableAnalytics: true,
      compressionThreshold: 0.8,
      minRetentionTime: 60000, // 1 minute
    };

    this.sampleCache = new SampleCache(cacheConfig, this.eventBus);

    // Initialize LocalProvider for persistent IndexedDB cache
    this.initializeLocalStorage();
  }

  /**
   * Initialize LocalProvider for persistent sample caching
   */
  private initializeLocalStorage(): void {
    try {
      console.log('[INDEXEDDB-DEBUG] Initializing LocalProvider...');
      const localConfig: LocalProviderConfig = {
        dbName: 'BassNotionAudioSamples',
        // v2 added on 2026-05-17: bass cache keys now include the sample
        // string (bass-${midi}-${string}). The upgrade handler in
        // LocalProvider deletes old single-key bass entries so the new
        // format reuses storage cleanly.
        dbVersion: 2,
        objectStoreName: 'samples',
        maxStorageSize: 500 * 1024 * 1024, // 500MB
        enableCompression: false, // Audio files are already compressed (OGG)
        metadataPrefix: 'sample_meta_',
      };

      this.localStorage = new LocalProvider(localConfig, this.eventBus);
      console.log(
        '[INDEXEDDB-DEBUG] LocalProvider instance created:',
        !!this.localStorage,
      );
      logger.info('✅ LocalProvider initialized for persistent sample caching');

      // Log when IndexedDB is ready
      this.eventBus.on('storage:connected', (event) => {
        console.log('[INDEXEDDB-DEBUG] IndexedDB connected:', event);
        logger.info('💾 IndexedDB ready for persistent caching');
      });
    } catch (error) {
      console.error(
        '[INDEXEDDB-DEBUG] Failed to initialize LocalProvider:',
        error,
      );
      logger.warn(
        'Failed to initialize LocalProvider, will use memory-only cache',
        error as Error,
      );
      this.localStorage = null;
    }
  }

  static getInstance(): GlobalSampleCacheImpl {
    if (!GlobalSampleCacheImpl.instance) {
      GlobalSampleCacheImpl.instance = new GlobalSampleCacheImpl();
    }
    return GlobalSampleCacheImpl.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static reset(): void {
    GlobalSampleCacheImpl.instance = null;
  }

  // ==========================================
  // Legacy API (for backward compatibility)
  // ==========================================

  /**
   * Cache a sample URL
   */
  cacheUrl(path: string, url: string): void {
    const now = Date.now();
    this.urlCache.set(path, url);
    this.samples.set(path, {
      url,
      loadedAt: now,
      type: 'url',
      lastAccessed: now,
      accessCount: 0,
      priority: 'normal',
      sizeBytes: 0, // URLs don't have size
    });

    logger.info(`📎 Cached URL: ${path}`);
  }

  /**
   * Get cached URL
   */
  getCachedUrl(path: string): string | undefined {
    const url = this.urlCache.get(path);
    if (url) {
      logger.info(`♻️ Cache HIT for URL: ${path}`);
    } else {
      logger.info(`❌ Cache MISS for URL: ${path}`);
    }
    return url;
  }

  /**
   * Cache an audio buffer (AudioBuffer or raw ArrayBuffer)
   * @param path - Cache key (e.g., "grandpiano-v4-A3")
   * @param buffer - AudioBuffer (decoded) or ArrayBuffer (raw audio data)
   * @param options - Optional metadata (e.g., { isContextCompatible: true })
   *
   * BUG #2 FIX: This method now accepts both AudioBuffer and ArrayBuffer.
   * - AudioBuffer: Must be from the CURRENT AudioContext (validate with isContextCompatible)
   * - ArrayBuffer: Raw audio data that will be decoded by AudioEngine when needed
   *
   * PERSISTENT CACHE: Also stores to IndexedDB for cross-session persistence
   */
  async cacheBuffer(
    path: string,
    buffer: AudioBuffer | ArrayBuffer,
    options?: { isContextCompatible?: boolean },
  ): Promise<void> {
    const memoryStartTime = performance.now();
    const existing = this.samples.get(path);

    const now = Date.now();
    const sizeBytes = this.estimateBufferSize(buffer);

    // Check if this is a raw ArrayBuffer or decoded AudioBuffer
    if (buffer instanceof ArrayBuffer) {
      // Raw audio data - cache for later decoding
      // ✅ FIX: Preserve existing decoded buffer if present (prevent data loss on double-caching)
      this.samples.set(path, {
        url: existing?.url || path,
        rawBuffer: buffer,
        buffer: existing?.buffer, // ✅ Keep decoded AudioBuffer if it exists
        loadedAt: now,
        type: 'raw',
        isContextCompatible: existing?.isContextCompatible, // ✅ Preserve compatibility flag
        lastAccessed: now,
        accessCount: existing?.accessCount || 0,
        priority: existing?.priority || 'normal',
        sizeBytes,
      });

      // Also cache in new system
      const metadata: Partial<AudioSampleMetadata> = {
        path,
        size: buffer.byteLength,
        format: 'unknown' as any,
        tags: ['raw', 'arraybuffer'],
      };

      this.sampleCache.set(path, buffer, metadata as AudioSampleMetadata);

      // Record memory set operation
      const memoryLatency = performance.now() - memoryStartTime;
      this.recordOperation('memory', 'set', true, memoryLatency, sizeBytes);

      logger.info(
        `📦 Cached raw ArrayBuffer: ${path} (${Math.round(buffer.byteLength / 1024)}KB)`,
      );

      // Store to IndexedDB for persistence across sessions
      if (this.localStorage) {
        const idbStartTime = performance.now();
        try {
          console.log(
            `[INDEXEDDB-DEBUG] Attempting to store ${path} to IndexedDB...`,
          );
          const result = await this.localStorage.store(path, buffer, {
            contentType: 'audio/ogg', // Samples are OGG format
            metadata: {
              cachedAt: Date.now(),
              size: buffer.byteLength,
              type: 'raw-audio',
            },
          });
          const idbLatency = performance.now() - idbStartTime;
          this.recordOperation(
            'indexedDB',
            'set',
            result.success,
            idbLatency,
            sizeBytes,
            !result.success,
          );
          console.log(`[INDEXEDDB-DEBUG] Store result for ${path}:`, result);
          logger.info(
            `💾 Persisted to IndexedDB: ${path} (${Math.round(buffer.byteLength / 1024)}KB)`,
          );
        } catch (error) {
          const idbLatency = performance.now() - idbStartTime;
          this.recordOperation(
            'indexedDB',
            'set',
            false,
            idbLatency,
            undefined,
            true,
          );
          console.error(`[INDEXEDDB-DEBUG] Failed to store ${path}:`, error);
          logger.warn(
            `Failed to persist ${path} to IndexedDB, will re-download on next session`,
            error as Error,
          );
        }
      } else {
        console.warn(
          `[INDEXEDDB-DEBUG] localStorage is null, cannot persist ${path}`,
        );
        logger.warn(
          `LocalProvider not initialized, skipping IndexedDB cache for ${path}`,
        );
      }
    } else if (buffer instanceof AudioBuffer) {
      // Decoded AudioBuffer - validate it's from the correct context
      if (!options?.isContextCompatible) {
        logger.warn(
          `⚠️ BUG #2 WARNING: Caching AudioBuffer without isContextCompatible flag! ` +
            `This buffer may be from OfflineAudioContext and will cause playback issues. ` +
            `Path: ${path}`,
        );
      }

      // ✅ FIX: Preserve existing raw buffer if present (prevent data loss on double-caching)
      this.samples.set(path, {
        url: existing?.url || path,
        rawBuffer: existing?.rawBuffer, // ✅ Keep raw ArrayBuffer if it exists
        buffer,
        loadedAt: now,
        type: 'buffer',
        isContextCompatible: options?.isContextCompatible,
        lastAccessed: now,
        accessCount: existing?.accessCount || 0,
        priority: existing?.priority || 'normal',
        sizeBytes,
      });

      // Also cache in new system for unified access
      const metadata: Partial<AudioSampleMetadata> = {
        path,
        size: buffer.numberOfChannels * buffer.length * 4,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        bitDepth: 32,
        channels: buffer.numberOfChannels,
        bitRate: Math.round(
          (buffer.numberOfChannels * buffer.sampleRate * 32) / 1000,
        ),
        format: 'wav' as any,
        tags: ['buffer', 'decoded'],
      };

      // Convert AudioBuffer to ArrayBuffer for new cache
      const arrayBuffer = this.audioBufferToArrayBuffer(buffer);
      this.sampleCache.set(path, arrayBuffer, metadata as AudioSampleMetadata);

      // Record memory set operation
      const memoryLatency = performance.now() - memoryStartTime;
      this.recordOperation('memory', 'set', true, memoryLatency, sizeBytes);

      logger.info(
        `🔊 Cached AudioBuffer: ${path} (${buffer.duration.toFixed(2)}s, ${buffer.sampleRate}Hz)`,
      );
    } else {
      throw new Error(
        `Invalid buffer type for path ${path}: expected AudioBuffer or ArrayBuffer, got ${typeof buffer}`,
      );
    }
  }

  /**
   * Get cached buffer (decoded AudioBuffer only)
   */
  getCachedBuffer(path: string): AudioBuffer | undefined {
    const startTime = performance.now();
    const sample = this.samples.get(path);
    const buffer = sample?.buffer;
    const latencyMs = performance.now() - startTime;

    if (buffer) {
      logger.info(`♻️ Cache HIT for AudioBuffer: ${path}`);

      // Update access tracking
      sample.lastAccessed = Date.now();
      sample.accessCount++;

      // Record performance metrics
      this.recordOperation('memory', 'get', true, latencyMs, sample.sizeBytes);

      // BUG #2 WARNING: Check if buffer is context-compatible
      if (!sample?.isContextCompatible) {
        logger.warn(
          `⚠️ BUG #2 WARNING: Returning AudioBuffer that may not be context-compatible! ` +
            `This could cause "buffer from different context" errors. Path: ${path}`,
        );
      }
    } else {
      logger.info(`❌ Cache MISS for AudioBuffer: ${path}`);
      this.recordOperation('memory', 'get', false, latencyMs);
    }

    return buffer;
  }

  /**
   * Get cached raw ArrayBuffer (undecoded audio data)
   * BUG #2 FIX: Use this to get raw audio data that can be decoded by AudioEngine
   * PERSISTENT CACHE: Checks IndexedDB if not in memory
   */
  async getCachedRawBuffer(path: string): Promise<ArrayBuffer | undefined> {
    const memoryStartTime = performance.now();

    // Check memory cache first (fast)
    const sample = this.samples.get(path);
    const rawBuffer = sample?.rawBuffer;

    if (rawBuffer) {
      const memoryLatency = performance.now() - memoryStartTime;
      logger.info(
        `♻️ Memory cache HIT for raw ArrayBuffer: ${path} (${Math.round(rawBuffer.byteLength / 1024)}KB)`,
      );

      // Update access tracking
      sample.lastAccessed = Date.now();
      sample.accessCount++;

      // Record memory hit
      this.recordOperation(
        'memory',
        'get',
        true,
        memoryLatency,
        sample.sizeBytes,
      );
      return rawBuffer;
    }

    // Memory miss
    const memoryLatency = performance.now() - memoryStartTime;
    this.recordOperation('memory', 'get', false, memoryLatency);

    // Check IndexedDB persistent cache
    if (this.localStorage) {
      const idbStartTime = performance.now();
      try {
        const result = await this.localStorage.retrieve(path);
        const idbLatency = performance.now() - idbStartTime;

        if (result.success && result.data) {
          logger.info(
            `💾 IndexedDB cache HIT for raw ArrayBuffer: ${path} (${Math.round(result.data.byteLength / 1024)}KB)`,
          );

          // Record IndexedDB hit
          this.recordOperation(
            'indexedDB',
            'get',
            true,
            idbLatency,
            result.data.byteLength,
          );

          // Restore to memory cache for faster subsequent access
          const now = Date.now();
          this.samples.set(path, {
            url: path,
            rawBuffer: result.data,
            loadedAt: now,
            type: 'raw',
            lastAccessed: now,
            accessCount: 1,
            priority: 'normal',
            sizeBytes: result.data.byteLength,
          });

          return result.data;
        } else {
          // IndexedDB miss
          this.recordOperation('indexedDB', 'get', false, idbLatency);
        }
      } catch (error) {
        const idbLatency = performance.now() - idbStartTime;
        logger.warn(
          `Failed to retrieve ${path} from IndexedDB`,
          error as Error,
        );
        this.recordOperation(
          'indexedDB',
          'get',
          false,
          idbLatency,
          undefined,
          true,
        );
      }
    }

    logger.info(`❌ Cache MISS for raw ArrayBuffer: ${path}`);
    return undefined;
  }

  /**
   * Cache a Tone.js sampler
   */
  cacheSampler(path: string, sampler: Sampler): void {
    const existing = this.samples.get(path);
    const now = Date.now();
    this.samples.set(path, {
      url: existing?.url || path,
      sampler,
      loadedAt: now,
      type: 'sampler',
      lastAccessed: now,
      accessCount: existing?.accessCount || 0,
      priority: 'high', // Samplers are typically important
      sizeBytes: 0, // Sampler size is hard to estimate
    });

    logger.info(`🎹 Cached sampler: ${path}`);
  }

  /**
   * Get cached sampler
   */
  getCachedSampler(path: string): Sampler | undefined {
    return this.samples.get(path)?.sampler;
  }

  /**
   * Cache an entire instrument (e.g., Salamander piano)
   */
  cacheInstrument(name: string, sampler: any): void {
    this.instruments.set(name, {
      name,
      sampler,
      loadedAt: Date.now(),
    });

    logger.info(`✅ Cached instrument: ${name}`, {
      currentCachedInstruments: Array.from(this.instruments.keys()),
      totalInstruments: this.instruments.size,
    });
  }

  /**
   * Get cached instrument
   */
  getCachedInstrument(name: string): any | undefined {
    const cached = this.instruments.get(name);
    if (cached) {
      logger.info(`♻️ Using cached instrument: ${name}`);
      return cached.sampler;
    }
    return undefined;
  }

  /**
   * Check if a sample is cached
   */
  hasSample(path: string): boolean {
    return this.samples.has(path) || this.sampleCache.has(path);
  }

  /**
   * Check if an instrument is cached
   */
  hasInstrument(name: string): boolean {
    return this.instruments.has(name);
  }

  /**
   * Get all cached instrument names
   */
  getCachedInstrumentNames(): string[] {
    return Array.from(this.instruments.keys());
  }

  /**
   * Clear a specific cached instrument
   * Used when switching tutorials to force reload with new exercise data
   */
  clearInstrument(name: string): boolean {
    const existed = this.instruments.has(name);
    if (existed) {
      this.instruments.delete(name);
      logger.info(`🗑️ Cleared cached instrument: ${name}`, {
        remainingInstruments: Array.from(this.instruments.keys()),
      });
    }
    return existed;
  }

  /**
   * Clear all cached instruments
   * Used for complete audio system reset
   */
  clearAllInstruments(): void {
    const count = this.instruments.size;
    this.instruments.clear();
    logger.info(`🗑️ Cleared all ${count} cached instruments`);
  }

  /**
   * Get all sample keys in the cache
   * Useful for iterating over cached samples by instrument prefix
   */
  getAllSampleKeys(): string[] {
    return Array.from(this.samples.keys());
  }

  /**
   * Cache metadata for preload strategies (e.g., required notes from MIDI analysis)
   */
  cacheMetadata(key: string, data: any): void {
    this.metadata.set(key, {
      data,
      cachedAt: Date.now(),
    });

    logger.info(`📋 Cached metadata: ${key}`, {
      dataKeys: Object.keys(data),
    });
  }

  /**
   * Get cached metadata
   */
  getCachedMetadata(key: string): any | undefined {
    const cached = this.metadata.get(key);
    if (cached) {
      logger.debug(`♻️ Using cached metadata: ${key}`);
      return cached.data;
    }
    return undefined;
  }

  /**
   * Get cached metadata (alias for getCachedMetadata)
   * Used by BassPreloadStrategy and BassLineWidget
   */
  getMetadata(key: string): any | undefined {
    return this.getCachedMetadata(key);
  }

  /**
   * Clear specific metadata
   */
  clearMetadata(key: string): void {
    if (this.metadata.has(key)) {
      this.metadata.delete(key);
      logger.info(`🗑️ Cleared metadata: ${key}`);
    }
  }

  /**
   * Clear all metadata
   */
  clearAllMetadata(): void {
    this.metadata.clear();
    logger.info('🗑️ Cleared all metadata');
  }

  /**
   * Get cache statistics (legacy format)
   */
  getStats(): {
    samplesCount: number;
    instrumentsCount: number;
    totalSize: number;
  } {
    return {
      samplesCount: this.samples.size,
      instrumentsCount: this.instruments.size,
      totalSize: this.samples.size + this.instruments.size,
    };
  }

  /**
   * Get cache statistics (compatible with CachedToneBufferLoader)
   */
  getCacheStats(): {
    bufferCount: number;
    urlCount: number;
    totalCachedBuffers: number;
    totalCachedUrls: number;
    estimatedMemoryMB: number;
  } {
    const bufferCount = Array.from(this.samples.values()).filter(
      (s) => s.buffer,
    ).length;
    const urlCount = this.urlCache.size;

    // Estimate memory usage (rough approximation)
    let estimatedMemoryBytes = 0;
    this.samples.forEach((sample) => {
      if (sample.buffer) {
        // AudioBuffer memory = channels * length * 4 bytes (32-bit float)
        estimatedMemoryBytes +=
          sample.buffer.numberOfChannels * sample.buffer.length * 4;
      }
    });

    return {
      bufferCount,
      urlCount,
      totalCachedBuffers: bufferCount,
      totalCachedUrls: urlCount,
      estimatedMemoryMB: estimatedMemoryBytes / (1024 * 1024),
    };
  }

  /**
   * Clear cache (use with caution)
   */
  clear(): void {
    this.samples.clear();
    this.instruments.clear();
    this.urlCache.clear();
    this.sampleCache.clear();

    logger.info('🗑️ Global sample cache cleared');
  }

  /**
   * Clear a specific buffer from cache
   */
  clearBuffer(path: string): void {
    const sample = this.samples.get(path);
    if (sample && sample.buffer) {
      // Remove only the buffer, keep the URL cached
      this.samples.set(path, {
        ...sample,
        buffer: undefined,
        type: 'url',
      });
      logger.info(`[GlobalSampleCache] Cleared buffer for: ${path}`);
    }

    // Also clear from new cache
    this.sampleCache.delete(path);
  }

  /**
   * Clear all cached buffers (keep URLs)
   * This should be called when AudioContext changes
   */
  clearAllBuffers(): void {
    let clearedCount = 0;
    this.samples.forEach((sample, path) => {
      if (sample.buffer) {
        this.samples.set(path, {
          ...sample,
          buffer: undefined,
          type: 'url',
        });
        clearedCount++;
      }
    });

    // Clear all from new cache too (it doesn't distinguish buffer vs URL)
    this.sampleCache.clear();

    logger.info(
      `[GlobalSampleCache] Cleared ${clearedCount} buffers due to context change`,
    );
  }

  // ==========================================
  // Enhanced API (unified access)
  // ==========================================

  /**
   * Get enhanced cache statistics
   */
  getEnhancedStats(): GlobalCacheStats {
    const legacyStats = this.getStats();
    const compatStats = this.getCacheStats();
    const newStats = this.sampleCache.getStats();

    return {
      ...legacyStats,
      ...compatStats,
      intelligentCacheStats: newStats,
    };
  }

  /**
   * Get the intelligent cache instance
   */
  getIntelligentCache(): SampleCache {
    return this.sampleCache;
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.sampleCache.updateConfig(config);
  }

  /**
   * Optimize cache performance
   */
  optimize(): void {
    this.sampleCache.optimize();
  }

  /**
   * Get memory breakdown
   */
  getMemoryBreakdown(): Map<string, number> {
    return this.sampleCache.getMemoryBreakdown();
  }

  // ==========================================
  // Utility methods
  // ==========================================

  /**
   * Convert AudioBuffer to ArrayBuffer for new cache system
   */
  private audioBufferToArrayBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    // Create a simple PCM representation
    const buffer = new ArrayBuffer(numberOfChannels * length * 4); // 32-bit float
    const view = new Float32Array(buffer);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const offset = channel * length;

      for (let i = 0; i < length; i++) {
        const value = channelData[i];
        if (value !== undefined) {
          view[offset + i] = value;
        }
      }
    }

    return buffer;
  }

  /**
   * Handle AudioContext state changes
   */
  onAudioContextChange(): void {
    logger.info('🔄 AudioContext changed - clearing buffers');
    this.clearAllBuffers();
  }

  // ==========================================
  // Performance Tracking Methods
  // ==========================================

  /**
   * Create empty performance metrics object
   */
  private createEmptyMetrics(): LayerPerformanceMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      averageLatencyMs: 0,
      errorRate: 0,
      operationCounts: {
        get: 0,
        set: 0,
        delete: 0,
        hits: 0,
        misses: 0,
        errors: 0,
      },
      totalBytes: 0,
      isHealthy: true,
    };
  }

  /**
   * Record a cache operation for performance tracking
   */
  private recordOperation(
    layer: 'memory' | 'indexedDB',
    op: 'get' | 'set' | 'delete',
    hit: boolean,
    latencyMs: number,
    sizeBytes?: number,
    error?: boolean,
  ): void {
    const metrics = this.layerMetrics[layer];

    // Update operation counts
    metrics.operationCounts[op]++;
    if (op === 'get') {
      if (hit) {
        metrics.operationCounts.hits++;
      } else {
        metrics.operationCounts.misses++;
      }
    }
    if (error) {
      metrics.operationCounts.errors++;
    }
    if (sizeBytes && op === 'set') {
      metrics.totalBytes += sizeBytes;
    }

    // Calculate rates
    const totalGets = metrics.operationCounts.get;
    if (totalGets > 0) {
      metrics.hitRate = metrics.operationCounts.hits / totalGets;
      metrics.missRate = metrics.operationCounts.misses / totalGets;
    }

    const totalOps =
      metrics.operationCounts.get +
      metrics.operationCounts.set +
      metrics.operationCounts.delete;
    if (totalOps > 0) {
      metrics.errorRate = metrics.operationCounts.errors / totalOps;
    }

    // Update average latency (rolling average)
    if (latencyMs > 0) {
      const currentTotal = metrics.averageLatencyMs * (totalOps - 1);
      metrics.averageLatencyMs = (currentTotal + latencyMs) / totalOps;
    }

    // Health check: unhealthy if error rate > 10% or latency > 500ms
    metrics.isHealthy =
      metrics.errorRate < 0.1 && metrics.averageLatencyMs < 500;
  }

  /**
   * Get comprehensive performance report for all cache layers
   */
  getPerformanceReport(): CachePerformanceReport {
    // Calculate combined metrics
    const memMetrics = this.layerMetrics.memory;
    const idbMetrics = this.layerMetrics.indexedDB;

    const totalGets =
      memMetrics.operationCounts.get + idbMetrics.operationCounts.get;
    const totalHits =
      memMetrics.operationCounts.hits + idbMetrics.operationCounts.hits;
    const totalMisses =
      memMetrics.operationCounts.misses + idbMetrics.operationCounts.misses;
    const totalErrors =
      memMetrics.operationCounts.errors + idbMetrics.operationCounts.errors;
    const totalOps =
      memMetrics.operationCounts.get +
      memMetrics.operationCounts.set +
      memMetrics.operationCounts.delete +
      idbMetrics.operationCounts.get +
      idbMetrics.operationCounts.set +
      idbMetrics.operationCounts.delete;

    const combined: LayerPerformanceMetrics = {
      hitRate: totalGets > 0 ? totalHits / totalGets : 0,
      missRate: totalGets > 0 ? totalMisses / totalGets : 0,
      averageLatencyMs:
        totalOps > 0
          ? (memMetrics.averageLatencyMs *
              (memMetrics.operationCounts.get +
                memMetrics.operationCounts.set +
                memMetrics.operationCounts.delete) +
              idbMetrics.averageLatencyMs *
                (idbMetrics.operationCounts.get +
                  idbMetrics.operationCounts.set +
                  idbMetrics.operationCounts.delete)) /
            totalOps
          : 0,
      errorRate: totalOps > 0 ? totalErrors / totalOps : 0,
      operationCounts: {
        get: totalGets,
        set: memMetrics.operationCounts.set + idbMetrics.operationCounts.set,
        delete:
          memMetrics.operationCounts.delete + idbMetrics.operationCounts.delete,
        hits: totalHits,
        misses: totalMisses,
        errors: totalErrors,
      },
      totalBytes: memMetrics.totalBytes + idbMetrics.totalBytes,
      isHealthy: memMetrics.isHealthy && idbMetrics.isHealthy,
    };

    return {
      memory: { ...memMetrics },
      indexedDB: { ...idbMetrics },
      combined,
      timestamp: Date.now(),
    };
  }

  /**
   * Estimate size of an AudioBuffer or ArrayBuffer in bytes
   */
  private estimateBufferSize(buffer: AudioBuffer | ArrayBuffer): number {
    if (buffer instanceof ArrayBuffer) {
      return buffer.byteLength;
    }
    // AudioBuffer: channels × length × 4 bytes (32-bit float)
    return buffer.numberOfChannels * buffer.length * 4;
  }

  // ==========================================
  // Recovery Event Handler Support
  // ==========================================

  /**
   * Calculate eviction score for a sample (lower = more evictable)
   * Considers: access frequency, recency, priority, and size
   */
  private calculateEvictionScore(sample: CachedSample): number {
    const now = Date.now();
    const recencyMs = now - sample.lastAccessed;
    const frequency = sample.accessCount;

    // Priority weights
    const priorityWeights: Record<CachePriority, number> = {
      critical: 1.0,
      high: 0.7,
      normal: 0.4,
      low: 0.1,
    };

    // Score formula: higher = more valuable = less evictable
    // - Frequency: more accesses = more valuable
    // - Recency: recently accessed = more valuable (inverse of recency)
    // - Priority: higher priority = more valuable
    const score =
      frequency * 0.4 + // 40% weight on access count
      (1 / (recencyMs / 60000 + 1)) * 0.4 + // 40% weight on recency (normalized to minutes)
      priorityWeights[sample.priority] * 0.2; // 20% weight on priority

    return score;
  }

  /**
   * Get sorted list of evictable entries (buffers only)
   * Sorted by eviction score (lowest first = most evictable)
   */
  private getEvictableEntries(): Array<[string, CachedSample]> {
    return Array.from(this.samples.entries())
      .filter(([_, sample]) => sample.buffer || sample.rawBuffer) // Only entries with buffers
      .sort(
        (a, b) =>
          this.calculateEvictionScore(a[1]) - this.calculateEvictionScore(b[1]),
      );
  }

  /**
   * Evict cache entries until size is below target
   * Called by RecoveryEventHandlers on 'cache:evict-old-entries' event
   */
  evictToSize(targetBytes: number): void {
    const stats = this.getStats();
    if (stats.totalSize <= targetBytes) {
      logger.info('Cache size already below target, no eviction needed', {
        currentSize: stats.totalSize,
        targetBytes,
      });
      return;
    }

    const bytesToEvict = stats.totalSize - targetBytes;
    logger.info('Evicting cache entries to meet target size', {
      targetBytes,
      bytesToEvict,
    });

    // Get entries sorted by eviction score (most evictable first)
    const entries = this.getEvictableEntries();
    let evictedBytes = 0;
    let evictedCount = 0;

    for (const [path, sample] of entries) {
      if (evictedBytes >= bytesToEvict) break;

      evictedBytes += sample.sizeBytes;
      this.clearBuffer(path);
      evictedCount++;
    }

    logger.info('Eviction complete', {
      evictedCount,
      evictedBytes,
      targetBytes,
    });
  }

  /**
   * Evict a percentage of oldest/least-used entries
   * Called by RecoveryEventHandlers on 'cache:evict-old-entries' event
   * Uses smart scoring based on access patterns and priority
   */
  evictOldest(percentage = 0.25): void {
    const entries = this.getEvictableEntries();
    const toEvictCount = Math.ceil(entries.length * percentage);

    if (toEvictCount === 0) {
      logger.info('No entries to evict');
      return;
    }

    logger.info('Evicting least-used cache entries', {
      percentage: `${percentage * 100}%`,
      totalEntries: entries.length,
      toEvictCount,
    });

    // Evict the lowest-scored entries
    for (let i = 0; i < toEvictCount && i < entries.length; i++) {
      const [path] = entries[i];
      this.clearBuffer(path);
    }

    logger.info('Smart eviction complete', { evictedCount: toEvictCount });
  }

  /**
   * Set offline mode (use cache only, no network)
   * Called by RecoveryEventHandlers on 'storage:use-fallback-service' event
   */
  setOfflineMode(enabled: boolean): void {
    this.offlineMode = enabled;
    logger.info('Offline mode', { enabled });

    this.eventBus.emit('cache:offline-mode-changed', { enabled });
  }

  /**
   * Check if offline mode is active
   */
  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  /**
   * Preload essential samples
   */
  async preloadEssentials(essentialPaths: string[]): Promise<void> {
    for (const path of essentialPaths) {
      if (!this.hasSample(path)) {
        logger.info(`⏳ Preloading essential sample: ${path}`);
        // This would typically load from Supabase
        // Implementation depends on the loader service
      }
    }
  }
}

// Export singleton getter to avoid circular dependency issues
export const GlobalSampleCache = {
  getInstance: () => GlobalSampleCacheImpl.getInstance(),
  // Convenience methods that delegate to the singleton
  hasSample: (url: string) =>
    GlobalSampleCacheImpl.getInstance().hasSample(url),
  getCachedBuffer: (url: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedBuffer(url),
  getCachedRawBuffer: async (url: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedRawBuffer(url),
  getCachedUrl: (url: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedUrl(url),
  getCachedSampler: (url: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedSampler(url),
  getCachedInstrument: (name: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedInstrument(name),
  getCachedInstrumentNames: () =>
    GlobalSampleCacheImpl.getInstance().getCachedInstrumentNames(),
  getAllSampleKeys: () =>
    GlobalSampleCacheImpl.getInstance().getAllSampleKeys(),
  cacheUrl: (path: string, url: string) =>
    GlobalSampleCacheImpl.getInstance().cacheUrl(path, url),
  cacheBuffer: async (
    path: string,
    buffer: AudioBuffer | ArrayBuffer,
    options?: { isContextCompatible?: boolean },
  ) => GlobalSampleCacheImpl.getInstance().cacheBuffer(path, buffer, options),
  cacheSampler: (path: string, sampler: Sampler) =>
    GlobalSampleCacheImpl.getInstance().cacheSampler(path, sampler),
  cacheInstrument: (name: string, sampler: any) =>
    GlobalSampleCacheImpl.getInstance().cacheInstrument(name, sampler),
  clearInstrument: (name: string) =>
    GlobalSampleCacheImpl.getInstance().clearInstrument(name),
  clearAllInstruments: () =>
    GlobalSampleCacheImpl.getInstance().clearAllInstruments(),
  clearBuffer: (path: string) =>
    GlobalSampleCacheImpl.getInstance().clearBuffer(path),
  clearAllBuffers: () => GlobalSampleCacheImpl.getInstance().clearAllBuffers(),
  clear: () => GlobalSampleCacheImpl.getInstance().clear(),
  getStats: () => GlobalSampleCacheImpl.getInstance().getStats(),
  getCacheStats: () => GlobalSampleCacheImpl.getInstance().getCacheStats(),
  // Recovery event handler support
  evictToSize: (targetBytes: number) =>
    GlobalSampleCacheImpl.getInstance().evictToSize(targetBytes),
  evictOldest: (percentage?: number) =>
    GlobalSampleCacheImpl.getInstance().evictOldest(percentage),
  setOfflineMode: (enabled: boolean) =>
    GlobalSampleCacheImpl.getInstance().setOfflineMode(enabled),
  isOfflineMode: () => GlobalSampleCacheImpl.getInstance().isOfflineMode(),
  // Performance tracking
  getPerformanceReport: () =>
    GlobalSampleCacheImpl.getInstance().getPerformanceReport(),
  // Metadata methods for FAANG preload strategies
  getMetadata: (key: string) =>
    GlobalSampleCacheImpl.getInstance().getCachedMetadata(key),
  cacheMetadata: (key: string, data: any) =>
    GlobalSampleCacheImpl.getInstance().cacheMetadata(key, data),
  clearMetadata: (key: string) =>
    GlobalSampleCacheImpl.getInstance().clearMetadata(key),
  clearAllMetadata: () =>
    GlobalSampleCacheImpl.getInstance().clearAllMetadata(),
};
