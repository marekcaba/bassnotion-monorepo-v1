/**
 * CacheManager - Orchestrates intelligent sample caching
 *
 * Manages multiple cache layers, coordinates between different
 * caching strategies, and provides a unified interface for
 * cache operations across the application.
 */

import {
  SampleCache,
  type CacheConfig,
  type CacheOperation,
} from './SampleCache.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

const logger = createStructuredLogger('CacheManager');

export interface CacheLayer {
  name: string;
  cache: SampleCache;
  priority: number;
  maxSize: number;
  evictionStrategy: 'lru' | 'lfu' | 'adaptive';
}

export interface CacheManagerConfig {
  enableMultiLayer: boolean;
  layers?: Array<{
    name: string;
    maxSize: number;
    evictionStrategy: 'lru' | 'lfu' | 'adaptive';
    priority: number;
  }>;
  enablePredictiveLoading: boolean;
  enableCompression: boolean;
  compressionThreshold: number;
  defaultLayerSize: number;
}

export interface CacheManagerStats {
  totalSize: number;
  totalEntries: number;
  layerStats: Map<
    string,
    {
      size: number;
      entries: number;
      hitRate: number;
      missRate: number;
    }
  >;
  overallHitRate: number;
  overallMissRate: number;
  compressionRatio: number;
}

/**
 * Manages hierarchical caching with multiple layers
 */
export class CacheManager {
  private layers: Map<string, CacheLayer> = new Map();
  private config: CacheManagerConfig;
  private eventBus: EventBus;
  private defaultLayer?: CacheLayer;

  // Statistics
  private globalHits = 0;
  private globalMisses = 0;
  private compressionSaved = 0;
  private totalUncompressed = 0;

  constructor(config: CacheManagerConfig, eventBus: EventBus) {
    this.config = config;
    this.eventBus = eventBus;

    this.initializeLayers();
  }

  /**
   * Initialize cache layers
   */
  private initializeLayers(): void {
    if (this.config.enableMultiLayer && this.config.layers) {
      // Create configured layers
      this.config.layers.forEach((layerConfig) => {
        const cacheConfig: CacheConfig = {
          maxSize: layerConfig.maxSize,
          maxEntries: Math.floor(layerConfig.maxSize / (100 * 1024)), // Assume 100KB avg
          evictionStrategy: layerConfig.evictionStrategy,
          enableAnalytics: true,
        };

        const cache = new SampleCache(cacheConfig, this.eventBus);

        this.layers.set(layerConfig.name, {
          name: layerConfig.name,
          cache,
          priority: layerConfig.priority,
          maxSize: layerConfig.maxSize,
          evictionStrategy: layerConfig.evictionStrategy,
        });
      });
    } else {
      // Create single default layer
      const cacheConfig: CacheConfig = {
        maxSize: this.config.defaultLayerSize || 100 * 1024 * 1024, // 100MB default
        maxEntries: 1000,
        evictionStrategy: 'adaptive',
        enableAnalytics: true,
      };

      const cache = new SampleCache(cacheConfig, this.eventBus);

      this.defaultLayer = {
        name: 'default',
        cache,
        priority: 1,
        maxSize: cacheConfig.maxSize,
        evictionStrategy: 'adaptive',
      };

      this.layers.set('default', this.defaultLayer);
    }

    logger.info('CacheManager initialized with layers:', {
      layers: Array.from(this.layers.keys()),
    });
  }

  /**
   * Get a sample from cache
   */
  async get(sampleId: string): Promise<ArrayBuffer | undefined> {
    // Try layers in priority order
    const sortedLayers = Array.from(this.layers.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    for (const layer of sortedLayers) {
      const data = layer.cache.getData(sampleId);
      if (data) {
        this.globalHits++;

        // Promote to higher priority layers if accessed frequently
        this.promoteIfNeeded(sampleId, layer, data);

        this.eventBus.emit('cache:hit', { sampleId, layer: layer.name });
        return data;
      }
    }

    this.globalMisses++;
    this.eventBus.emit('cache:miss', { sampleId });
    return undefined;
  }

  /**
   * Set a sample in cache
   */
  async set(
    sampleId: string,
    data: ArrayBuffer,
    metadata: AudioSampleMetadata,
    options?: {
      layer?: string;
      compress?: boolean;
      priority?: 'high' | 'normal' | 'low';
    },
  ): Promise<CacheOperation> {
    // Determine target layer
    const targetLayer = options?.layer
      ? this.layers.get(options.layer)
      : this.selectLayerForSample(data.byteLength, metadata);

    if (!targetLayer) {
      throw new Error('No suitable cache layer available');
    }

    // Compress if needed
    let processedData = data;
    if (
      this.config.enableCompression &&
      options?.compress !== false &&
      data.byteLength > this.config.compressionThreshold
    ) {
      processedData = await this.compressData(data);
      this.compressionSaved += data.byteLength - processedData.byteLength;
      this.totalUncompressed += data.byteLength;

      // Update metadata to indicate compression
      metadata = {
        ...metadata,
        compressionUsed: true,
        size: processedData.byteLength,
      };
    }

    // Store in selected layer
    const operation = targetLayer.cache.set(sampleId, processedData, metadata);

    this.eventBus.emit('cache:set', {
      sampleId,
      layer: targetLayer.name,
      size: processedData.byteLength,
      compressed: metadata.compressionUsed || false,
    });

    return operation;
  }

  /**
   * Delete a sample from all layers
   */
  async delete(sampleId: string): Promise<boolean> {
    let deleted = false;

    for (const layer of this.layers.values()) {
      const operation = layer.cache.delete(sampleId);
      if (operation.success) {
        deleted = true;
      }
    }

    if (deleted) {
      this.eventBus.emit('cache:deleted', { sampleId });
    }

    return deleted;
  }

  /**
   * Check if sample exists in any layer
   */
  has(sampleId: string): boolean {
    for (const layer of this.layers.values()) {
      if (layer.cache.has(sampleId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    for (const layer of this.layers.values()) {
      layer.cache.clear();
    }

    this.globalHits = 0;
    this.globalMisses = 0;
    this.compressionSaved = 0;
    this.totalUncompressed = 0;

    this.eventBus.emit('cache:cleared');
  }

  /**
   * Get statistics across all layers
   */
  getStats(): CacheManagerStats {
    const layerStats = new Map<string, any>();
    let totalSize = 0;
    let totalEntries = 0;

    for (const [name, layer] of this.layers.entries()) {
      const stats = layer.cache.getStats();
      const size = layer.cache.getSize();

      layerStats.set(name, {
        size: size.bytes,
        entries: size.entries,
        hitRate: stats.hitRate,
        missRate: stats.missRate,
      });

      totalSize += size.bytes;
      totalEntries += size.entries;
    }

    const totalOps = this.globalHits + this.globalMisses;
    const overallHitRate = totalOps > 0 ? this.globalHits / totalOps : 0;
    const overallMissRate = totalOps > 0 ? this.globalMisses / totalOps : 0;

    const compressionRatio =
      this.totalUncompressed > 0
        ? this.compressionSaved / this.totalUncompressed
        : 0;

    return {
      totalSize,
      totalEntries,
      layerStats,
      overallHitRate,
      overallMissRate,
      compressionRatio,
    };
  }

  /**
   * Optimize all cache layers
   */
  optimize(): void {
    for (const layer of this.layers.values()) {
      layer.cache.optimize();
    }

    this.rebalanceLayers();

    this.eventBus.emit('cache:optimized');
  }

  /**
   * Lock samples across all layers
   */
  lockSamples(sampleIds: string[]): void {
    for (const layer of this.layers.values()) {
      layer.cache.lockMultiple(sampleIds);
    }
  }

  /**
   * Unlock samples across all layers
   */
  unlockSamples(sampleIds: string[]): void {
    for (const layer of this.layers.values()) {
      layer.cache.unlockMultiple(sampleIds);
    }
  }

  /**
   * Preload samples with intelligent distribution
   */
  async preloadSamples(
    samples: Array<{
      sampleId: string;
      data: ArrayBuffer;
      metadata: AudioSampleMetadata;
      priority?: 'high' | 'normal' | 'low';
    }>,
  ): Promise<void> {
    // Sort by priority and size
    const sorted = samples.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return a.data.byteLength - b.data.byteLength;
    });

    // Distribute across layers based on priority and size
    for (const sample of sorted) {
      await this.set(sample.sampleId, sample.data, sample.metadata, {
        priority: sample.priority,
      });
    }

    logger.info(`Preloaded ${samples.length} samples across cache layers`);
  }

  /**
   * Select appropriate layer for a sample
   */
  private selectLayerForSample(
    size: number,
    metadata: AudioSampleMetadata,
  ): CacheLayer | undefined {
    // If only default layer, use it
    if (this.layers.size === 1 && this.defaultLayer) {
      return this.defaultLayer;
    }

    // Select based on metadata and size
    const isEssential = metadata.tags?.includes('essential');
    const isFrequent = metadata.tags?.includes('frequent');

    // Find layer with highest priority that has space
    const sortedLayers = Array.from(this.layers.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    for (const layer of sortedLayers) {
      const layerSize = layer.cache.getSize();

      // High priority items go to high priority layers
      if (isEssential && layer.priority >= 3) {
        return layer;
      }

      // Frequent items go to medium-high priority layers
      if (isFrequent && layer.priority >= 2) {
        return layer;
      }

      // Check if layer has space
      if (layerSize.bytes + size <= layer.maxSize) {
        return layer;
      }
    }

    // Default to lowest priority layer
    return sortedLayers[sortedLayers.length - 1];
  }

  /**
   * Promote sample to higher priority layer if needed
   */
  private promoteIfNeeded(
    sampleId: string,
    currentLayer: CacheLayer,
    data: ArrayBuffer,
  ): void {
    // Find higher priority layer
    const higherLayers = Array.from(this.layers.values())
      .filter((l) => l.priority > currentLayer.priority)
      .sort((a, b) => a.priority - b.priority);

    if (higherLayers.length === 0) return;

    // Check access count in current layer
    const entry = currentLayer.cache.getKeys().find((key) => key === sampleId);

    if (!entry) return;

    // Promote if accessed frequently
    // This is simplified - in production would track access patterns
    const targetLayer = higherLayers[0];
    if (targetLayer) {
      if (
        targetLayer.cache.getSize().bytes + data.byteLength <=
        targetLayer.maxSize
      ) {
        logger.debug(
          `Promoting ${sampleId} from ${currentLayer.name} to ${targetLayer.name}`,
        );
        // Note: Would need to get metadata from current cache entry
        // This is simplified for the example
      }
    }
  }

  /**
   * Rebalance samples across layers
   */
  private rebalanceLayers(): void {
    if (!this.config.enableMultiLayer || this.layers.size <= 1) return;

    // Analyze usage patterns and redistribute
    // This is a simplified version - production would be more sophisticated
    logger.debug('Rebalancing cache layers');
  }

  /**
   * Compress data (placeholder - would use real compression)
   */
  private async compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // In production, would use actual compression algorithm
    // For now, just return original data
    return data;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update individual cache configurations if needed
    if (newConfig.enableCompression !== undefined) {
      logger.info('Compression setting updated:', {
        enableCompression: newConfig.enableCompression,
      });
    }
  }

  /**
   * Get layer information
   */
  getLayers(): Array<{
    name: string;
    priority: number;
    size: number;
    entries: number;
  }> {
    return Array.from(this.layers.entries()).map(([name, layer]) => {
      const size = layer.cache.getSize();
      return {
        name,
        priority: layer.priority,
        size: size.bytes,
        entries: size.entries,
      };
    });
  }
}
