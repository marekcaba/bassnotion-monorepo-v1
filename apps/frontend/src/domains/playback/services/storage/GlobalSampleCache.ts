/**
 * Global Sample Cache
 * 
 * Singleton cache for pre-loaded audio samples to prevent double loading.
 * Used by BackgroundSampleLoader to store samples and WAM plugins to retrieve them.
 */

import type { Sampler } from 'tone';

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
      type: 'url'
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
      type: 'buffer'
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
      type: 'sampler'
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
      loadedAt: Date.now()
    });
    console.log(`✅ Cached instrument: ${name}`);
  }
  
  /**
   * Get cached instrument
   */
  getCachedInstrument(name: string): any | undefined {
    const cached = this.instruments.get(name);
    if (cached) {
      console.log(`♻️ Using cached instrument: ${name}`);
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
      totalSize: this.samples.size + this.instruments.size
    };
  }
  
  /**
   * Clear cache (use with caution)
   */
  clear(): void {
    this.samples.clear();
    this.instruments.clear();
    this.urlCache.clear();
    console.log('🗑️ Global sample cache cleared');
  }
}

export const GlobalSampleCache = GlobalSampleCacheImpl.getInstance();