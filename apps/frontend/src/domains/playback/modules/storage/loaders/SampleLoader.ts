/**
 * SampleLoader - Core sample loading functionality
 * 
 * Provides intelligent sample loading with caching integration,
 * quality adaptation, error recovery, and analytics tracking.
 * Consolidates loading logic from across the playback domain.
 */

import type * as Tone from 'tone';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger, type AudioSampleMetadata } from '@bassnotion/contracts';

const logger = createStructuredLogger('SampleLoader');

export interface LoadOptions {
  quality?: 'low' | 'medium' | 'high' | 'original';
  priority?: 'high' | 'normal' | 'low';
  correlationId?: string;
  retryCount?: number;
  timeout?: number;
  useCache?: boolean;
  preload?: boolean;
}

export interface LoadResult {
  success: boolean;
  data?: ArrayBuffer | AudioBuffer;
  url?: string;
  fromCache: boolean;
  loadTime: number;
  size: number;
  quality: string;
  error?: Error;
}

export interface SampleLoaderConfig {
  baseUrl?: string;
  defaultQuality: 'low' | 'medium' | 'high' | 'original';
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableAnalytics: boolean;
  enableQualityAdaptation: boolean;
}

/**
 * Handles loading of audio samples with intelligent caching and quality adaptation
 */
export class SampleLoader {
  private config: SampleLoaderConfig;
  private cache?: SampleCache;
  private eventBus?: EventBus;
  private tone?: typeof Tone;
  private audioContext?: AudioContext;
  
  // Loading state
  private activeLoads = new Map<string, Promise<LoadResult>>();
  private loadStats = {
    totalLoads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failures: 0,
    totalLoadTime: 0,
    totalSize: 0,
  };

  constructor(
    config: SampleLoaderConfig,
    cache?: SampleCache,
    eventBus?: EventBus
  ) {
    this.config = config;
    this.cache = cache;
    this.eventBus = eventBus;
  }

  /**
   * Initialize with Tone.js
   */
  initializeTone(tone: typeof Tone): void {
    this.tone = tone;
    this.audioContext = tone.context.rawContext as AudioContext;
  }

  /**
   * Load a sample by ID or URL
   */
  async loadSample(
    sampleIdOrUrl: string,
    metadata?: AudioSampleMetadata,
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = performance.now();
    const opts = this.normalizeOptions(options);
    
    try {
      // Check if already loading
      const activeLoad = this.activeLoads.get(sampleIdOrUrl);
      if (activeLoad) {
        logger.debug('Returning active load for:', sampleIdOrUrl);
        return activeLoad;
      }

      // Create load promise
      const loadPromise = this.performLoad(sampleIdOrUrl, metadata, opts);
      this.activeLoads.set(sampleIdOrUrl, loadPromise);
      
      // Wait for result
      const result = await loadPromise;
      
      // Update stats
      this.updateStats(result, performance.now() - startTime);
      
      // Clean up
      this.activeLoads.delete(sampleIdOrUrl);
      
      return result;
    } catch (error) {
      this.activeLoads.delete(sampleIdOrUrl);
      throw error;
    }
  }

  /**
   * Load multiple samples in parallel
   */
  async loadMultiple(
    samples: Array<{
      id: string;
      url?: string;
      metadata?: AudioSampleMetadata;
      options?: LoadOptions;
    }>
  ): Promise<Map<string, LoadResult>> {
    const results = new Map<string, LoadResult>();
    
    // Create load promises
    const loadPromises = samples.map(async (sample) => {
      try {
        const result = await this.loadSample(
          sample.url || sample.id,
          sample.metadata,
          sample.options
        );
        results.set(sample.id, result);
      } catch (error) {
        results.set(sample.id, {
          success: false,
          fromCache: false,
          loadTime: 0,
          size: 0,
          quality: 'original',
          error: error as Error,
        });
      }
    });
    
    // Wait for all loads
    await Promise.all(loadPromises);
    
    return results;
  }

  /**
   * Create a Tone.Buffer from a sample
   */
  async createToneBuffer(
    sampleIdOrUrl: string,
    options: LoadOptions = {}
  ): Promise<Tone.ToneAudioBuffer | null> {
    if (!this.tone) {
      throw new Error('Tone.js not initialized');
    }

    try {
      // Try cache first
      if (this.cache && options.useCache !== false) {
        const cachedData = this.cache.getData(sampleIdOrUrl);
        if (cachedData) {
          logger.debug('Creating ToneBuffer from cache:', sampleIdOrUrl);
          return new this.tone.ToneAudioBuffer(cachedData);
        }
      }

      // Load sample
      const result = await this.loadSample(sampleIdOrUrl, undefined, options);
      
      if (result.success && result.data) {
        if (result.data instanceof ArrayBuffer) {
          return new this.tone.ToneAudioBuffer(result.data);
        } else if (result.data instanceof AudioBuffer) {
          return new this.tone.ToneAudioBuffer(result.data);
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to create ToneBuffer:', error);
      throw error;
    }
  }

  /**
   * Create a Tone.Sampler from samples
   */
  async createToneSampler(
    samples: Record<string, string>,
    options: LoadOptions = {}
  ): Promise<Tone.Sampler | null> {
    if (!this.tone) {
      throw new Error('Tone.js not initialized');
    }

    try {
      const buffers: Record<string, Tone.ToneAudioBuffer> = {};
      
      // Load all samples
      const entries = Object.entries(samples);
      for (const [note, url] of entries) {
        const buffer = await this.createToneBuffer(url, options);
        if (buffer) {
          buffers[note] = buffer;
        } else {
          logger.warn(`Failed to load sample for note ${note}`);
        }
      }
      
      // Create sampler
      return new this.tone.Sampler(buffers);
    } catch (error) {
      logger.error('Failed to create ToneSampler:', error);
      throw error;
    }
  }

  /**
   * Perform the actual load operation
   */
  private async performLoad(
    sampleIdOrUrl: string,
    metadata?: AudioSampleMetadata,
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    // Try cache first
    if (this.cache && options.useCache !== false) {
      const cachedResult = await this.loadFromCache(sampleIdOrUrl);
      if (cachedResult.success) {
        return cachedResult;
      }
    }
    
    // Load from network
    return this.loadFromNetwork(sampleIdOrUrl, metadata, options);
  }

  /**
   * Try to load from cache
   */
  private async loadFromCache(sampleId: string): Promise<LoadResult> {
    if (!this.cache) {
      return {
        success: false,
        fromCache: false,
        loadTime: 0,
        size: 0,
        quality: 'original',
      };
    }

    const startTime = performance.now();
    const data = this.cache.getData(sampleId);
    
    if (data) {
      const loadTime = performance.now() - startTime;
      
      this.eventBus?.emit('sample:loaded', {
        sampleId,
        fromCache: true,
        loadTime,
        size: data.byteLength,
      });
      
      return {
        success: true,
        data,
        fromCache: true,
        loadTime,
        size: data.byteLength,
        quality: 'cached',
      };
    }
    
    return {
      success: false,
      fromCache: false,
      loadTime: 0,
      size: 0,
      quality: 'original',
    };
  }

  /**
   * Load from network with retries
   */
  private async loadFromNetwork(
    url: string,
    metadata?: AudioSampleMetadata,
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    const startTime = performance.now();
    const maxRetries = options.retryCount ?? this.config.maxRetries;
    let lastError: Error | undefined;
    
    // Build full URL
    const fullUrl = this.buildUrl(url, options.quality || this.config.defaultQuality);
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(this.config.retryDelay * attempt);
          logger.debug(`Retry attempt ${attempt} for ${url}`);
        }
        
        // Fetch with timeout
        const response = await this.fetchWithTimeout(fullUrl, options.timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Get data
        const data = await response.arrayBuffer();
        const loadTime = performance.now() - startTime;
        
        // Cache if enabled
        if (this.cache && metadata) {
          await this.cache.set(url, data, metadata);
        }
        
        this.eventBus?.emit('sample:loaded', {
          sampleId: url,
          fromCache: false,
          loadTime,
          size: data.byteLength,
          quality: options.quality || this.config.defaultQuality,
        });
        
        return {
          success: true,
          data,
          url: fullUrl,
          fromCache: false,
          loadTime,
          size: data.byteLength,
          quality: options.quality || this.config.defaultQuality,
        };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to load ${url} (attempt ${attempt + 1}):`, error);
      }
    }
    
    // All attempts failed
    const loadTime = performance.now() - startTime;
    
    this.eventBus?.emit('sample:loadFailed', {
      sampleId: url,
      error: lastError,
      attempts: maxRetries + 1,
      loadTime,
    });
    
    return {
      success: false,
      fromCache: false,
      loadTime,
      size: 0,
      quality: options.quality || this.config.defaultQuality,
      error: lastError,
    };
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = timeout || this.config.timeout;
    
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'audio/*',
        },
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Build full URL with quality suffix
   */
  private buildUrl(url: string, quality: string): string {
    // If already a full URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Build with base URL
    const baseUrl = this.config.baseUrl || '';
    let fullUrl = baseUrl + url;
    
    // Add quality suffix if not original
    if (quality !== 'original' && this.config.enableQualityAdaptation) {
      const extension = fullUrl.substring(fullUrl.lastIndexOf('.'));
      const baseName = fullUrl.substring(0, fullUrl.lastIndexOf('.'));
      fullUrl = `${baseName}_${quality}${extension}`;
    }
    
    return fullUrl;
  }

  /**
   * Normalize load options
   */
  private normalizeOptions(options: LoadOptions): Required<LoadOptions> {
    return {
      quality: options.quality || this.config.defaultQuality,
      priority: options.priority || 'normal',
      correlationId: options.correlationId || `load-${Date.now()}`,
      retryCount: options.retryCount ?? this.config.maxRetries,
      timeout: options.timeout || this.config.timeout,
      useCache: options.useCache !== false,
      preload: options.preload || false,
    };
  }

  /**
   * Update loading statistics
   */
  private updateStats(result: LoadResult, loadTime: number): void {
    this.loadStats.totalLoads++;
    this.loadStats.totalLoadTime += loadTime;
    
    if (result.success) {
      if (result.fromCache) {
        this.loadStats.cacheHits++;
      } else {
        this.loadStats.cacheMisses++;
      }
      this.loadStats.totalSize += result.size;
    } else {
      this.loadStats.failures++;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get loading statistics
   */
  getStats(): typeof this.loadStats & {
    averageLoadTime: number;
    cacheHitRate: number;
    failureRate: number;
  } {
    const total = this.loadStats.totalLoads || 1;
    
    return {
      ...this.loadStats,
      averageLoadTime: this.loadStats.totalLoadTime / total,
      cacheHitRate: this.loadStats.cacheHits / total,
      failureRate: this.loadStats.failures / total,
    };
  }

  /**
   * Clear statistics
   */
  clearStats(): void {
    this.loadStats = {
      totalLoads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0,
      totalLoadTime: 0,
      totalSize: 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SampleLoaderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}