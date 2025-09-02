/**
 * Global Sample Cache
 *
 * Singleton cache for pre-loaded audio samples to prevent double loading.
 * Used by InitialSamplePreloader to store samples and widgets to retrieve them.
 */

import type { Sampler } from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface CachedSample {
  url: string;
  buffer?: AudioBuffer;
  sampler?: Sampler;
  loadedAt: number;
  type: 'buffer' | 'sampler' | 'url';
}

interface CachedInstrument {
  name: string;
  sampler: any; // Tone.Sampler or similar
  loadedAt: number;
}

class GlobalSampleCacheImpl {
  private static instance: GlobalSampleCacheImpl;

  // Caches
  private samples = new Map<string, CachedSample>();
  private instruments = new Map<string, CachedInstrument>();
  private urlCache = new Map<string, string>(); // path -> Supabase URL

  private constructor() {}

  static getInstance(): GlobalSampleCacheImpl {
    if (!GlobalSampleCacheImpl.instance) {
      GlobalSampleCacheImpl.instance = new GlobalSampleCacheImpl();
    }
    return GlobalSampleCacheImpl.instance;
  }

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
  }

  /**
   * Get cached URL
   */
  getCachedUrl(path: string): string | undefined {
    return this.urlCache.get(path);
  }

  /**
   * Cache an audio buffer
   */
  cacheBuffer(path: string, buffer: AudioBuffer): void {
    const existing = this.samples.get(path);
    this.samples.set(path, {
      url: existing?.url || path,
      buffer,
      loadedAt: Date.now(),
      type: 'buffer',
    });
  }

  /**
   * Get cached buffer
   */
  getCachedBuffer(path: string): AudioBuffer | undefined {
    return this.samples.get(path)?.buffer;
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
      totalInstruments: this.instruments.size
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
    return this.samples.has(path);
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
   * Get cache statistics
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
    logger.info(
      `[GlobalSampleCache] Cleared ${clearedCount} buffers due to context change`,
    );
  }
}

export const GlobalSampleCache = GlobalSampleCacheImpl.getInstance();
