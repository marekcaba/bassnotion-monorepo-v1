/**
 * AnalysisCache - Caching for metadata analysis results
 * 
 * Provides efficient caching of analysis results to avoid
 * redundant processing of the same audio files.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { AudioAnalysisResult } from '@bassnotion/contracts';
import type { AnalysisCacheEntry } from '../types.js';

const logger = createStructuredLogger('AnalysisCache');

export class AnalysisCache {
  private cache: Map<string, AnalysisCacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttl = 3600000) { // 1 hour default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Generate cache key from audio buffer and filename
   */
  generateKey(audioBuffer: ArrayBuffer, filename: string): string {
    // Simple hash based on buffer size and filename
    const bufferHash = audioBuffer.byteLength.toString(36);
    const filenameHash = filename
      .split('')
      .reduce((hash, char) => {
        return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
      }, 0)
      .toString(36);

    return `${bufferHash}-${filenameHash}`;
  }

  /**
   * Get analysis result from cache
   */
  get(key: string): AudioAnalysisResult | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.result;
  }

  /**
   * Store analysis result in cache
   */
  set(key: string, result: AudioAnalysisResult): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: AnalysisCacheEntry = {
      result,
      timestamp: Date.now(),
      key,
    };

    this.cache.set(key, entry);
    logger.debug('Cached analysis result', { key });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    // Clean up expired entries first
    this.cleanupExpired();

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * Evict oldest entry from cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted oldest cache entry', { key: oldestKey });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug('Cleaned up expired entries', { count: expiredKeys.length });
    }
  }

  /**
   * Dispose of cache
   */
  dispose(): void {
    this.clear();
  }
}