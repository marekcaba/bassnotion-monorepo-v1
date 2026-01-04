/**
 * Bass Sample Loader
 *
 * Handles loading bass samples from Supabase with caching via GlobalSampleCache.
 * Implements FAANG smart loading - only loads samples needed for the exercise.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { BassSampleConfig, BassSampleStatus, BassSampleMap } from './types.js';
import { getBufferKey, getSamplesForMidiNotes, getSampleForMidiNote } from './BassSampleManifest.js';

const logger = createStructuredLogger('BassSampleLoader');

/**
 * Maximum concurrent sample loads
 */
const MAX_CONCURRENT_LOADS = 4;

/**
 * Request timeout in milliseconds
 */
const LOAD_TIMEOUT_MS = 30000;

/**
 * Cache key prefix for bass samples
 */
const CACHE_KEY_PREFIX = 'bass-sample-';

/**
 * Loading progress callback
 */
export type LoadProgressCallback = (loaded: number, total: number) => void;

/**
 * Sample loading result
 */
export interface LoadResult {
  success: boolean;
  loaded: number;
  failed: number;
  errors: Array<{ midiNote: number; error: string }>;
}

/**
 * Bass Sample Loader
 *
 * Loads bass samples with:
 * - GlobalSampleCache integration (memory + IndexedDB)
 * - Concurrent loading with limit
 * - Progress tracking
 * - Error handling with retry
 */
export class BassSampleLoader {
  private loadingPromises = new Map<number, Promise<AudioBuffer | null>>();
  private loadedBuffers: BassSampleMap = new Map();
  private sampleStatus = new Map<number, BassSampleStatus>();
  private audioContext: AudioContext | null = null;

  constructor() {
    logger.info('BassSampleLoader initialized');
  }

  /**
   * Set the AudioContext for decoding samples
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    logger.info('AudioContext set for sample decoding');
  }

  /**
   * Load samples for specific MIDI notes (FAANG smart loading)
   */
  async loadSamplesForNotes(
    midiNotes: number[],
    onProgress?: LoadProgressCallback,
  ): Promise<LoadResult> {
    const samples = getSamplesForMidiNotes(midiNotes);

    if (samples.length === 0) {
      logger.warn('No samples to load for provided MIDI notes');
      return { success: true, loaded: 0, failed: 0, errors: [] };
    }

    logger.info('Loading bass samples', {
      requestedNotes: midiNotes.length,
      samplesToLoad: samples.length,
    });

    return this.loadSamples(samples, onProgress);
  }

  /**
   * Load a list of samples with concurrency control
   */
  async loadSamples(
    samples: BassSampleConfig[],
    onProgress?: LoadProgressCallback,
  ): Promise<LoadResult> {
    const result: LoadResult = {
      success: true,
      loaded: 0,
      failed: 0,
      errors: [],
    };

    // Filter out already loaded samples
    const samplesToLoad = samples.filter(
      (sample) => !this.loadedBuffers.has(sample.midiNote),
    );

    if (samplesToLoad.length === 0) {
      logger.info('All samples already loaded');
      onProgress?.(samples.length, samples.length);
      return result;
    }

    const total = samplesToLoad.length;
    let loaded = 0;

    // Initialize status for all samples
    for (const sample of samplesToLoad) {
      this.sampleStatus.set(sample.midiNote, {
        midiNote: sample.midiNote,
        noteName: sample.note,
        status: 'pending',
      });
    }

    // Load in batches with concurrency limit
    const batches = this.createBatches(samplesToLoad, MAX_CONCURRENT_LOADS);

    for (const batch of batches) {
      const batchPromises = batch.map(async (sample) => {
        try {
          this.updateStatus(sample.midiNote, 'loading');
          const buffer = await this.loadSample(sample);

          if (buffer) {
            this.loadedBuffers.set(sample.midiNote, buffer);
            this.updateStatus(sample.midiNote, 'ready');
            result.loaded++;
          } else {
            this.updateStatus(sample.midiNote, 'error', 'Failed to decode');
            result.failed++;
            result.errors.push({
              midiNote: sample.midiNote,
              error: 'Failed to decode sample',
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.updateStatus(sample.midiNote, 'error', errorMessage);
          result.failed++;
          result.errors.push({
            midiNote: sample.midiNote,
            error: errorMessage,
          });
          logger.error('Failed to load sample', {
            midiNote: sample.midiNote,
            error: errorMessage,
          });
        }

        loaded++;
        onProgress?.(loaded, total);
      });

      await Promise.all(batchPromises);
    }

    result.success = result.failed === 0;

    logger.info('Sample loading complete', {
      loaded: result.loaded,
      failed: result.failed,
      total,
    });

    return result;
  }

  /**
   * Load a single sample
   */
  private async loadSample(sample: BassSampleConfig): Promise<AudioBuffer | null> {
    const { midiNote, url } = sample;

    // Check if already loading
    const existingPromise = this.loadingPromises.get(midiNote);
    if (existingPromise) {
      return existingPromise;
    }

    const loadPromise = this.fetchAndDecode(url, midiNote);
    this.loadingPromises.set(midiNote, loadPromise);

    try {
      const buffer = await loadPromise;
      return buffer;
    } finally {
      this.loadingPromises.delete(midiNote);
    }
  }

  /**
   * Fetch and decode a sample URL
   */
  private async fetchAndDecode(
    url: string,
    midiNote: number,
  ): Promise<AudioBuffer | null> {
    // Try to get from GlobalSampleCache first
    const cacheKey = `${CACHE_KEY_PREFIX}${midiNote}`;
    const cache = this.getGlobalCache();

    if (cache) {
      const cached = cache.getBuffer(cacheKey);
      if (cached) {
        logger.info('Cache hit for bass sample', { midiNote, cacheKey });
        return cached;
      }

      // Check for raw buffer that needs decoding
      const rawCached = cache.getRawBuffer(cacheKey);
      if (rawCached && this.audioContext) {
        logger.info('Decoding cached raw buffer', { midiNote });
        try {
          const decoded = await this.audioContext.decodeAudioData(
            rawCached.slice(0),
          );
          // Cache the decoded buffer
          await cache.cacheBuffer(cacheKey, decoded, {
            isContextCompatible: true,
          });
          return decoded;
        } catch (error) {
          logger.warn('Failed to decode cached raw buffer', { midiNote, error });
        }
      }
    }

    // Fetch from network
    logger.info('Fetching bass sample from network', { midiNote, url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // Cache raw buffer
      if (cache) {
        await cache.cacheBuffer(cacheKey, arrayBuffer);
      }

      // Decode if we have an AudioContext
      if (this.audioContext) {
        const audioBuffer = await this.audioContext.decodeAudioData(
          arrayBuffer.slice(0),
        );

        // Cache decoded buffer
        if (cache) {
          await cache.cacheBuffer(cacheKey, audioBuffer, {
            isContextCompatible: true,
          });
        }

        return audioBuffer;
      }

      logger.warn('No AudioContext available, returning null', { midiNote });
      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the GlobalSampleCache instance
   */
  private getGlobalCache(): GlobalSampleCacheInterface | null {
    try {
      // Dynamic import to avoid circular dependencies
      const { GlobalSampleCache } = require('../../../storage/cache/GlobalSampleCache.js');
      return GlobalSampleCache.getInstance();
    } catch (error) {
      logger.warn('GlobalSampleCache not available');
      return null;
    }
  }

  /**
   * Create batches for concurrent loading
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update sample status
   */
  private updateStatus(
    midiNote: number,
    status: BassSampleStatus['status'],
    error?: string,
  ): void {
    const current = this.sampleStatus.get(midiNote);
    if (current) {
      current.status = status;
      if (error) {
        current.error = error;
      }
    }
  }

  /**
   * Get loaded buffers as a Record for BassScheduler
   */
  getBuffers(): Record<string, AudioBuffer> {
    const buffers: Record<string, AudioBuffer> = {};
    for (const [midiNote, buffer] of this.loadedBuffers) {
      buffers[getBufferKey(midiNote)] = buffer;
    }
    return buffers;
  }

  /**
   * Get loaded buffers as a Map
   */
  getBufferMap(): BassSampleMap {
    return new Map(this.loadedBuffers);
  }

  /**
   * Get buffer for a specific MIDI note
   */
  getBuffer(midiNote: number): AudioBuffer | undefined {
    return this.loadedBuffers.get(midiNote);
  }

  /**
   * Check if a sample is loaded
   */
  isLoaded(midiNote: number): boolean {
    return this.loadedBuffers.has(midiNote);
  }

  /**
   * Get status of all samples
   */
  getStatus(): Map<number, BassSampleStatus> {
    return new Map(this.sampleStatus);
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loaded: number;
    loading: number;
    pending: number;
    error: number;
  } {
    let loaded = 0;
    let loading = 0;
    let pending = 0;
    let error = 0;

    for (const status of this.sampleStatus.values()) {
      switch (status.status) {
        case 'ready':
          loaded++;
          break;
        case 'loading':
          loading++;
          break;
        case 'pending':
          pending++;
          break;
        case 'error':
          error++;
          break;
      }
    }

    return { loaded, loading, pending, error };
  }

  /**
   * Clear all loaded samples
   */
  clear(): void {
    this.loadedBuffers.clear();
    this.sampleStatus.clear();
    this.loadingPromises.clear();
    logger.info('BassSampleLoader cleared');
  }

  /**
   * Dispose the loader
   */
  dispose(): void {
    this.clear();
    this.audioContext = null;
    logger.info('BassSampleLoader disposed');
  }
}

/**
 * Interface for GlobalSampleCache methods we use
 */
interface GlobalSampleCacheInterface {
  getBuffer(key: string): AudioBuffer | undefined;
  getRawBuffer(key: string): ArrayBuffer | undefined;
  cacheBuffer(
    key: string,
    buffer: AudioBuffer | ArrayBuffer,
    options?: { isContextCompatible?: boolean },
  ): Promise<void>;
}

/**
 * Create a new BassSampleLoader instance
 */
export function createBassSampleLoader(): BassSampleLoader {
  return new BassSampleLoader();
}
