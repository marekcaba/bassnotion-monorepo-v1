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
import { LocalProvider, type LocalProviderConfig } from '../providers/LocalProvider.js';

const logger = createStructuredLogger('GlobalSampleCache');

export interface CachedSample {
  url: string;
  buffer?: AudioBuffer;
  rawBuffer?: ArrayBuffer; // Raw audio data (not yet decoded)
  sampler?: Sampler;
  loadedAt: number;
  type: 'buffer' | 'sampler' | 'url' | 'raw';
  isContextCompatible?: boolean; // If true, buffer is from current AudioContext and should survive cleanup
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
        dbVersion: 1,
        objectStoreName: 'samples',
        maxStorageSize: 500 * 1024 * 1024, // 500MB
        enableCompression: false, // Audio files are already compressed (OGG)
        metadataPrefix: 'sample_meta_',
      };

      this.localStorage = new LocalProvider(localConfig, this.eventBus);
      console.log('[INDEXEDDB-DEBUG] LocalProvider instance created:', !!this.localStorage);
      logger.info('✅ LocalProvider initialized for persistent sample caching');

      // Log when IndexedDB is ready
      this.eventBus.on('storage:connected', (event) => {
        console.log('[INDEXEDDB-DEBUG] IndexedDB connected:', event);
        logger.info('💾 IndexedDB ready for persistent caching');
      });
    } catch (error) {
      console.error('[INDEXEDDB-DEBUG] Failed to initialize LocalProvider:', error);
      logger.warn('Failed to initialize LocalProvider, will use memory-only cache', error as Error);
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
    this.urlCache.set(path, url);
    this.samples.set(path, {
      url,
      loadedAt: Date.now(),
      type: 'url',
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
    const existing = this.samples.get(path);

    // Check if this is a raw ArrayBuffer or decoded AudioBuffer
    if (buffer instanceof ArrayBuffer) {
      // Raw audio data - cache for later decoding
      // ✅ FIX: Preserve existing decoded buffer if present (prevent data loss on double-caching)
      this.samples.set(path, {
        url: existing?.url || path,
        rawBuffer: buffer,
        buffer: existing?.buffer, // ✅ Keep decoded AudioBuffer if it exists
        loadedAt: Date.now(),
        type: 'raw',
        isContextCompatible: existing?.isContextCompatible, // ✅ Preserve compatibility flag
      });

      // Also cache in new system
      const metadata: Partial<AudioSampleMetadata> = {
        path,
        size: buffer.byteLength,
        format: 'unknown' as any,
        tags: ['raw', 'arraybuffer'],
      };

      this.sampleCache.set(path, buffer, metadata as AudioSampleMetadata);

      logger.info(
        `📦 Cached raw ArrayBuffer: ${path} (${Math.round(buffer.byteLength / 1024)}KB)`,
      );

      // Store to IndexedDB for persistence across sessions
      if (this.localStorage) {
        try {
          console.log(`[INDEXEDDB-DEBUG] Attempting to store ${path} to IndexedDB...`);
          const result = await this.localStorage.store(path, buffer, {
            contentType: 'audio/ogg', // Samples are OGG format
            metadata: {
              cachedAt: Date.now(),
              size: buffer.byteLength,
              type: 'raw-audio'
            },
          });
          console.log(`[INDEXEDDB-DEBUG] Store result for ${path}:`, result);
          logger.info(`💾 Persisted to IndexedDB: ${path} (${Math.round(buffer.byteLength / 1024)}KB)`);
        } catch (error) {
          console.error(`[INDEXEDDB-DEBUG] Failed to store ${path}:`, error);
          logger.warn(`Failed to persist ${path} to IndexedDB, will re-download on next session`, error as Error);
        }
      } else {
        console.warn(`[INDEXEDDB-DEBUG] localStorage is null, cannot persist ${path}`);
        logger.warn(`LocalProvider not initialized, skipping IndexedDB cache for ${path}`);
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
        loadedAt: Date.now(),
        type: 'buffer',
        isContextCompatible: options?.isContextCompatible,
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
    const sample = this.samples.get(path);
    const buffer = sample?.buffer;

    if (buffer) {
      logger.info(`♻️ Cache HIT for AudioBuffer: ${path}`);

      // BUG #2 WARNING: Check if buffer is context-compatible
      if (!sample?.isContextCompatible) {
        logger.warn(
          `⚠️ BUG #2 WARNING: Returning AudioBuffer that may not be context-compatible! ` +
            `This could cause "buffer from different context" errors. Path: ${path}`,
        );
      }
    } else {
      logger.info(`❌ Cache MISS for AudioBuffer: ${path}`);
    }

    return buffer;
  }

  /**
   * Get cached raw ArrayBuffer (undecoded audio data)
   * BUG #2 FIX: Use this to get raw audio data that can be decoded by AudioEngine
   * PERSISTENT CACHE: Checks IndexedDB if not in memory
   */
  async getCachedRawBuffer(path: string): Promise<ArrayBuffer | undefined> {
    // Check memory cache first (fast)
    const sample = this.samples.get(path);
    const rawBuffer = sample?.rawBuffer;

    if (rawBuffer) {
      logger.info(
        `♻️ Memory cache HIT for raw ArrayBuffer: ${path} (${Math.round(rawBuffer.byteLength / 1024)}KB)`,
      );
      return rawBuffer;
    }

    // Check IndexedDB persistent cache
    if (this.localStorage) {
      try {
        const result = await this.localStorage.retrieve(path);
        if (result.success && result.data) {
          logger.info(
            `💾 IndexedDB cache HIT for raw ArrayBuffer: ${path} (${Math.round(result.data.byteLength / 1024)}KB)`,
          );

          // Restore to memory cache for faster subsequent access
          this.samples.set(path, {
            url: path,
            rawBuffer: result.data,
            loadedAt: Date.now(),
            type: 'raw',
          });

          return result.data;
        }
      } catch (error) {
        logger.warn(`Failed to retrieve ${path} from IndexedDB`, error as Error);
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
    this.samples.set(path, {
      url: existing?.url || path,
      sampler,
      loadedAt: Date.now(),
      type: 'sampler',
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
  cacheUrl: (path: string, url: string) =>
    GlobalSampleCacheImpl.getInstance().cacheUrl(path, url),
  cacheBuffer: async (path: string, buffer: AudioBuffer | ArrayBuffer, options?: { isContextCompatible?: boolean }) =>
    GlobalSampleCacheImpl.getInstance().cacheBuffer(path, buffer, options),
  cacheSampler: (path: string, sampler: Sampler) =>
    GlobalSampleCacheImpl.getInstance().cacheSampler(path, sampler),
  cacheInstrument: (name: string, sampler: any) =>
    GlobalSampleCacheImpl.getInstance().cacheInstrument(name, sampler),
  clearBuffer: (path: string) =>
    GlobalSampleCacheImpl.getInstance().clearBuffer(path),
  clearAllBuffers: () => GlobalSampleCacheImpl.getInstance().clearAllBuffers(),
  clear: () => GlobalSampleCacheImpl.getInstance().clear(),
  getStats: () => GlobalSampleCacheImpl.getInstance().getStats(),
  getCacheStats: () => GlobalSampleCacheImpl.getInstance().getCacheStats(),
  // Note: these methods don't exist on the implementation - remove them
  // getAudioBuffer: (url: string) => GlobalSampleCacheImpl.getInstance().getAudioBuffer(url),
  // cacheAudioBuffer: (url: string, buffer: AudioBuffer) => GlobalSampleCacheImpl.getInstance().cacheAudioBuffer(url, buffer),
  // clearCache: () => GlobalSampleCacheImpl.getInstance().clearCache(),
};
