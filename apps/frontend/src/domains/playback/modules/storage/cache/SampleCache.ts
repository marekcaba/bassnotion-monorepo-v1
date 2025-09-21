/**
 * SampleCache - Core sample caching functionality
 *
 * Provides intelligent caching for audio samples with:
 * - Memory-aware caching decisions
 * - Usage pattern tracking
 * - Smart eviction policies
 * - Performance optimization
 */

import type { AudioSampleMetadata } from '@bassnotion/contracts';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('SampleCache');

export interface SampleCacheEntry {
  sampleId: string;
  data: ArrayBuffer;
  metadata: AudioSampleMetadata;
  size: number;
  cachedAt: number;
  lastAccessed: number;
  accessCount: number;
  priority: number;
  locked: boolean;
}

export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  evictionStrategy: 'lru' | 'lfu' | 'adaptive';
  enableAnalytics: boolean;
  compressionThreshold?: number;
  minRetentionTime?: number;
}

export interface CacheStats {
  entries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  averageAccessTime: number;
}

export interface CacheOperation {
  type: 'get' | 'set' | 'delete' | 'evict';
  sampleId: string;
  success: boolean;
  fromCache: boolean;
  duration: number;
  size?: number;
}

export class SampleCache {
  private cache = new Map<string, SampleCacheEntry>();
  private config: Required<CacheConfig>;
  private totalSize = 0;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalOperations: 0,
    accessTimes: [] as number[],
  };
  private eventBus?: EventBus;
  private locked = new Set<string>(); // Track locked samples

  constructor(config: CacheConfig, eventBus?: EventBus) {
    this.config = {
      compressionThreshold: config.compressionThreshold ?? 0.8,
      minRetentionTime: config.minRetentionTime ?? 60000, // 1 minute
      ...config,
    };
    this.eventBus = eventBus;
  }

  /**
   * Get a sample from cache
   */
  get(sampleId: string): CacheOperation {
    const startTime = performance.now();
    this.stats.totalOperations++;

    const entry = this.cache.get(sampleId);

    if (entry) {
      // Cache hit
      this.stats.hits++;
      entry.lastAccessed = Date.now();
      entry.accessCount++;

      const duration = performance.now() - startTime;
      this.recordAccessTime(duration);

      this.emitEvent('cache:hit', { sampleId, size: entry.size });

      return {
        type: 'get',
        sampleId,
        success: true,
        fromCache: true,
        duration,
        size: entry.size,
      };
    } else {
      // Cache miss
      this.stats.misses++;

      const duration = performance.now() - startTime;
      this.recordAccessTime(duration);

      this.emitEvent('cache:miss', { sampleId });

      return {
        type: 'get',
        sampleId,
        success: false,
        fromCache: false,
        duration,
      };
    }
  }

  /**
   * Get sample data directly
   */
  getData(sampleId: string): ArrayBuffer | undefined {
    const entry = this.cache.get(sampleId);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      return entry.data;
    }
    return undefined;
  }

  /**
   * Set a sample in cache
   */
  set(
    sampleId: string,
    data: ArrayBuffer,
    metadata: AudioSampleMetadata,
  ): CacheOperation {
    const startTime = performance.now();
    this.stats.totalOperations++;

    const size = data.byteLength;

    // Check if we need to evict
    if (this.shouldEvict(size)) {
      this.evict(size);
    }

    // Create cache entry
    const entry: SampleCacheEntry = {
      sampleId,
      data,
      metadata,
      size,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      priority: this.calculatePriority(metadata),
      locked: false,
    };

    // Remove old entry if exists
    const oldEntry = this.cache.get(sampleId);
    if (oldEntry) {
      this.totalSize -= oldEntry.size;
    }

    // Add new entry
    this.cache.set(sampleId, entry);
    this.totalSize += size;

    const duration = performance.now() - startTime;

    this.emitEvent('cache:set', { sampleId, size });

    return {
      type: 'set',
      sampleId,
      success: true,
      fromCache: false,
      duration,
      size,
    };
  }

  /**
   * Delete a sample from cache
   */
  delete(sampleId: string): CacheOperation {
    const startTime = performance.now();
    this.stats.totalOperations++;

    const entry = this.cache.get(sampleId);

    if (entry) {
      this.cache.delete(sampleId);
      this.totalSize -= entry.size;

      const duration = performance.now() - startTime;

      this.emitEvent('cache:delete', { sampleId, size: entry.size });

      return {
        type: 'delete',
        sampleId,
        success: true,
        fromCache: true,
        duration,
        size: entry.size,
      };
    }

    const duration = performance.now() - startTime;

    return {
      type: 'delete',
      sampleId,
      success: false,
      fromCache: false,
      duration,
    };
  }

  /**
   * Check if cache has a sample
   */
  has(sampleId: string): boolean {
    return this.cache.has(sampleId);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalOperations: 0,
      accessTimes: [],
    };

    this.emitEvent('cache:cleared', {});
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalOps = this.stats.totalOperations || 1;

    return {
      entries: this.cache.size,
      totalSize: this.totalSize,
      hitRate: this.stats.hits / totalOps,
      missRate: this.stats.misses / totalOps,
      evictionCount: this.stats.evictions,
      averageAccessTime: this.calculateAverageAccessTime(),
    };
  }

  /**
   * Lock a sample to prevent eviction
   */
  lock(sampleId: string): void {
    const entry = this.cache.get(sampleId);
    if (entry) {
      entry.locked = true;
      this.locked.add(sampleId);
    }
  }

  /**
   * Unlock a sample
   */
  unlock(sampleId: string): void {
    const entry = this.cache.get(sampleId);
    if (entry) {
      entry.locked = false;
      this.locked.delete(sampleId);
    }
  }

  /**
   * Lock multiple samples
   */
  lockMultiple(sampleIds: string[]): void {
    sampleIds.forEach((id) => this.lock(id));
  }

  /**
   * Unlock multiple samples
   */
  unlockMultiple(sampleIds: string[]): void {
    sampleIds.forEach((id) => this.unlock(id));
  }

  /**
   * Get all cached sample IDs
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get entries by metadata tags
   */
  getByTags(tags: string[]): SampleCacheEntry[] {
    const entries: SampleCacheEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.metadata.tags?.some((tag) => tags.includes(tag))) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Preload multiple samples
   */
  async preloadMultiple(
    samples: Array<{
      sampleId: string;
      data: ArrayBuffer;
      metadata: AudioSampleMetadata;
    }>,
  ): Promise<CacheOperation[]> {
    const operations: CacheOperation[] = [];

    for (const sample of samples) {
      const op = this.set(sample.sampleId, sample.data, sample.metadata);
      operations.push(op);
    }

    return operations;
  }

  /**
   * Get cache size info
   */
  getSize(): { entries: number; bytes: number } {
    return {
      entries: this.cache.size,
      bytes: this.totalSize,
    };
  }

  /**
   * Check if eviction is needed
   */
  private shouldEvict(newSize: number): boolean {
    return (
      this.totalSize + newSize > this.config.maxSize ||
      this.cache.size >= this.config.maxEntries
    );
  }

  /**
   * Evict entries to make space
   */
  private evict(requiredSpace: number): void {
    const candidates = this.getEvictionCandidates();
    let freedSpace = 0;

    for (const candidate of candidates) {
      if (freedSpace >= requiredSpace) break;

      const entry = this.cache.get(candidate.sampleId);
      if (!entry || entry.locked) continue;

      // Check minimum retention time
      const age = Date.now() - entry.cachedAt;
      if (age < this.config.minRetentionTime) continue;

      this.cache.delete(candidate.sampleId);
      this.totalSize -= entry.size;
      freedSpace += entry.size;
      this.stats.evictions++;

      this.emitEvent('cache:evicted', {
        sampleId: candidate.sampleId,
        size: entry.size,
        reason: 'space_needed',
      });
    }
  }

  /**
   * Get eviction candidates based on strategy
   */
  private getEvictionCandidates(): SampleCacheEntry[] {
    const entries = Array.from(this.cache.values());

    switch (this.config.evictionStrategy) {
      case 'lru':
        // Least Recently Used
        return entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

      case 'lfu':
        // Least Frequently Used
        return entries.sort((a, b) => a.accessCount - b.accessCount);

      case 'adaptive':
        // Adaptive strategy considering multiple factors
        return entries.sort((a, b) => {
          const scoreA = this.calculateEvictionScore(a);
          const scoreB = this.calculateEvictionScore(b);
          return scoreA - scoreB;
        });

      default:
        return entries;
    }
  }

  /**
   * Calculate eviction score (lower = more likely to evict)
   */
  private calculateEvictionScore(entry: SampleCacheEntry): number {
    const age = Date.now() - entry.cachedAt;
    const recency = Date.now() - entry.lastAccessed;
    const frequency = entry.accessCount;
    const sizeNormalized = entry.size / this.config.maxSize;

    // Weighted score
    return (
      frequency * 0.3 +
      (1 / (recency + 1)) * 0.3 +
      (1 / (age + 1)) * 0.2 +
      (1 - sizeNormalized) * 0.2 +
      entry.priority * 0.2
    );
  }

  /**
   * Calculate priority based on metadata
   */
  private calculatePriority(metadata: AudioSampleMetadata): number {
    let priority = 0.5;

    // Higher priority for frequently used types
    if (metadata.tags?.includes('essential')) priority += 0.3;
    if (metadata.tags?.includes('preload')) priority += 0.2;

    // Lower priority for large files
    if (metadata.size && metadata.size > 5 * 1024 * 1024) {
      priority -= 0.2;
    }

    return Math.max(0, Math.min(1, priority));
  }

  /**
   * Record access time for analytics
   */
  private recordAccessTime(duration: number): void {
    if (!this.config.enableAnalytics) return;

    this.stats.accessTimes.push(duration);

    // Keep only recent access times
    if (this.stats.accessTimes.length > 1000) {
      this.stats.accessTimes = this.stats.accessTimes.slice(-500);
    }
  }

  /**
   * Calculate average access time
   */
  private calculateAverageAccessTime(): number {
    if (this.stats.accessTimes.length === 0) return 0;

    const sum = this.stats.accessTimes.reduce((a, b) => a + b, 0);
    return sum / this.stats.accessTimes.length;
  }

  /**
   * Emit cache event
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventBus) {
      this.eventBus.emit(event, data);
    }

    logger.debug(event, data);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.emitEvent('cache:configUpdated', newConfig);
  }

  /**
   * Get memory usage breakdown
   */
  getMemoryBreakdown(): Map<string, number> {
    const breakdown = new Map<string, number>();

    for (const [_id, entry] of this.cache.entries()) {
      const category = entry.metadata.tags?.[0] || 'uncategorized';
      const current = breakdown.get(category) || 0;
      breakdown.set(category, current + entry.size);
    }

    return breakdown;
  }

  /**
   * Optimize cache based on current usage
   */
  optimize(): void {
    if (!this.config.enableAnalytics) return;

    // Sort entries by efficiency score
    const entries = Array.from(this.cache.entries())
      .map(([id, entry]) => ({
        id,
        entry,
        score: this.calculateEvictionScore(entry),
      }))
      .sort((a, b) => a.score - b.score);

    // Remove low-scoring entries if needed
    const targetSize = this.config.maxSize * 0.8; // Keep 80% capacity
    let currentSize = this.totalSize;

    for (const { id, entry } of entries) {
      if (currentSize <= targetSize) break;
      if (entry.locked) continue;

      this.delete(id);
      currentSize -= entry.size;
    }

    this.emitEvent('cache:optimized', {
      entriesRemoved: this.totalSize - currentSize,
      newSize: currentSize,
    });
  }
}
