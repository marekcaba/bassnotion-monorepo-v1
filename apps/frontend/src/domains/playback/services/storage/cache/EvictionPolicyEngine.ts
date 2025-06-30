/**
 * Story 2.4 Task 4.4: Intelligent Sample Caching - Eviction Policy Engine
 * EvictionPolicyEngine - Implements intelligent eviction strategies for cache optimization
 *
 * Provides advanced eviction policies including:
 * - LRU (Least Recently Used)
 * - LFU (Least Frequently Used)
 * - Usage-based eviction
 * - Intelligent hybrid eviction
 * - Memory pressure-aware eviction
 * - Quality-aware eviction
 */

import { SampleCacheEntry } from '@bassnotion/contracts';
import { MemoryPressureLevel } from './MemoryManager.js';

/**
 * Eviction policy types
 */
export type EvictionStrategy = 'lru' | 'lfu' | 'usage_based' | 'intelligent';

/**
 * Eviction candidate information
 */
export interface EvictionCandidate {
  sampleId: string;
  entry: SampleCacheEntry;
  score: number; // Lower score = higher eviction priority
  reason: string;
  memoryImpact: number; // Memory that would be freed (bytes)
}

/**
 * Eviction policy configuration
 */
export interface EvictionPolicyConfig {
  strategy: EvictionStrategy;

  // LRU configuration
  lruWeight: number; // Weight for recency in scoring (0-1)

  // LFU configuration
  lfuWeight: number; // Weight for frequency in scoring (0-1)

  // Usage-based configuration
  usageWeight: number; // Weight for usage patterns in scoring (0-1)
  qualityWeight: number; // Weight for quality considerations (0-1)
  sizeWeight: number; // Weight for size considerations (0-1)

  // Intelligent configuration
  adaptiveWeighting: boolean; // Enable adaptive weight adjustment
  memoryPressureAware: boolean; // Consider memory pressure in decisions
  qualityPreservation: boolean; // Prefer to keep high-quality samples

  // General configuration
  batchSize: number; // Number of items to evict at once
  emergencyBatchSize: number; // Larger batch size for emergency eviction
  minRetentionTime: number; // Minimum time to keep items (ms)
  protectedSampleIds: string[]; // Sample IDs that should not be evicted
}

/**
 * Eviction statistics
 */
export interface EvictionStatistics {
  totalEvictions: number;
  evictionsByStrategy: Record<EvictionStrategy, number>;
  averageEvictionScore: number;
  memoryFreed: number; // Total memory freed through evictions
  qualityImpact: number; // Average quality impact of evictions (0-1)
  lastEvictionTime: number;
  emergencyEvictions: number;
}

/**
 * Eviction Policy Engine
 *
 * Implements intelligent eviction strategies to optimize cache performance and memory usage.
 * Supports multiple eviction policies and adapts to memory pressure and usage patterns.
 */
export class EvictionPolicyEngine {
  private config: EvictionPolicyConfig;
  private statistics: EvictionStatistics;
  private adaptiveWeights: Record<string, number> = {};

  constructor(config: EvictionPolicyConfig) {
    this.config = config;
    this.statistics = this.initializeStatistics();
    this.initializeAdaptiveWeights();
  }

  /**
   * Select items for eviction based on the configured strategy
   */
  public selectEvictionCandidates(
    cacheEntries: Map<string, SampleCacheEntry>,
    targetCount: number,
    memoryPressure: MemoryPressureLevel = 'none',
  ): EvictionCandidate[] {
    const candidates = this.generateEvictionCandidates(
      cacheEntries,
      memoryPressure,
    );

    // Sort by eviction score (lower = higher priority for eviction)
    candidates.sort((a, b) => a.score - b.score);

    // Apply batch size limits
    const batchSize = this.getBatchSize(memoryPressure);
    const selectedCount = Math.min(targetCount, batchSize, candidates.length);

    const selected = candidates.slice(0, selectedCount);

    // Update statistics
    this.updateStatistics(selected, memoryPressure);

    return selected;
  }

  /**
   * Calculate eviction score for a specific cache entry
   */
  public calculateEvictionScore(
    sampleId: string,
    entry: SampleCacheEntry,
    memoryPressure: MemoryPressureLevel = 'none',
  ): number {
    switch (this.config.strategy) {
      case 'lru':
        return this.calculateLRUScore(entry);
      case 'lfu':
        return this.calculateLFUScore(entry);
      case 'usage_based':
        return this.calculateUsageBasedScore(entry);
      case 'intelligent':
        return this.calculateIntelligentScore(sampleId, entry, memoryPressure);
      default:
        return this.calculateLRUScore(entry); // Fallback to LRU
    }
  }

  /**
   * Check if a sample is protected from eviction
   */
  public isProtectedFromEviction(
    sampleId: string,
    entry: SampleCacheEntry,
  ): boolean {
    // Check if explicitly protected
    if (this.config.protectedSampleIds.includes(sampleId)) {
      return true;
    }

    // Check minimum retention time
    const age = Date.now() - entry.cachedAt;
    if (age < this.config.minRetentionTime) {
      return true;
    }

    // Check if currently locked
    if (entry.isLocked) {
      return true;
    }

    return false;
  }

  /**
   * Get eviction statistics
   */
  public getStatistics(): EvictionStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset eviction statistics
   */
  public resetStatistics(): void {
    this.statistics = this.initializeStatistics();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EvictionPolicyConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.strategy) {
      this.initializeAdaptiveWeights();
    }
  }

  /**
   * Get recommended eviction strategy based on current conditions
   */
  public getRecommendedStrategy(
    cacheSize: number,
    memoryPressure: MemoryPressureLevel,
    accessPatterns: 'random' | 'sequential' | 'mixed',
  ): EvictionStrategy {
    // High memory pressure favors aggressive strategies
    if (memoryPressure === 'critical' || memoryPressure === 'high') {
      return 'intelligent'; // Most adaptive
    }

    // Large caches benefit from intelligent strategies
    if (cacheSize > 1000) {
      return 'intelligent';
    }

    // Sequential access patterns work well with LRU
    if (accessPatterns === 'sequential') {
      return 'lru';
    }

    // Random access patterns benefit from usage-based
    if (accessPatterns === 'random') {
      return 'usage_based';
    }

    // Default to intelligent for mixed patterns
    return 'intelligent';
  }

  // Private implementation methods

  private generateEvictionCandidates(
    cacheEntries: Map<string, SampleCacheEntry>,
    memoryPressure: MemoryPressureLevel,
  ): EvictionCandidate[] {
    const candidates: EvictionCandidate[] = [];

    for (const [sampleId, entry] of Array.from(cacheEntries.entries())) {
      // Skip protected entries
      if (this.isProtectedFromEviction(sampleId, entry)) {
        continue;
      }

      const score = this.calculateEvictionScore(
        sampleId,
        entry,
        memoryPressure,
      );
      const reason = this.getEvictionReason(sampleId, entry, score);

      candidates.push({
        sampleId,
        entry,
        score,
        reason,
        memoryImpact: entry.size,
      });
    }

    return candidates;
  }

  private calculateLRUScore(entry: SampleCacheEntry): number {
    const now = Date.now();
    const timeSinceLastAccess = now - entry.lastAccessed;

    // Normalize to 0-1 scale (older = higher score = higher eviction priority)
    return Math.min(timeSinceLastAccess / (24 * 60 * 60 * 1000), 1); // 24 hours max
  }

  private calculateLFUScore(entry: SampleCacheEntry): number {
    // Lower access count = higher eviction priority
    // Normalize based on typical access patterns
    const maxExpectedAccesses = 100;
    return Math.max(0, 1 - entry.accessCount / maxExpectedAccesses);
  }

  private calculateUsageBasedScore(entry: SampleCacheEntry): number {
    const recencyScore = this.calculateLRUScore(entry);
    const frequencyScore = this.calculateLFUScore(entry);
    const sizeScore = this.calculateSizeScore(entry);
    const qualityScore = this.calculateQualityScore(entry);

    return (
      recencyScore * this.config.lruWeight +
      frequencyScore * this.config.lfuWeight +
      sizeScore * this.config.sizeWeight +
      qualityScore * this.config.qualityWeight
    );
  }

  private calculateIntelligentScore(
    sampleId: string,
    entry: SampleCacheEntry,
    memoryPressure: MemoryPressureLevel,
  ): number {
    let weights = this.config.adaptiveWeighting
      ? this.getAdaptiveWeights(memoryPressure)
      : {
          recency: this.config.lruWeight,
          frequency: this.config.lfuWeight,
          usage: this.config.usageWeight,
          quality: this.config.qualityWeight,
          size: this.config.sizeWeight,
        };

    // Adjust weights based on memory pressure
    if (this.config.memoryPressureAware) {
      weights = this.adjustWeightsForMemoryPressure(weights, memoryPressure);
    }

    const recencyScore = this.calculateLRUScore(entry);
    const frequencyScore = this.calculateLFUScore(entry);
    const usageScore = this.calculateUsagePatternScore(entry);
    const sizeScore = this.calculateSizeScore(entry);
    const qualityScore = this.calculateQualityScore(entry);

    return (
      recencyScore * (weights.recency || 0) +
      frequencyScore * (weights.frequency || 0) +
      usageScore * (weights.usage || 0) +
      sizeScore * (weights.size || 0) +
      qualityScore * (weights.quality || 0)
    );
  }

  private calculateSizeScore(entry: SampleCacheEntry): number {
    // Larger files have higher eviction priority when memory is constrained
    const maxExpectedSize = 50 * 1024 * 1024; // 50MB
    return Math.min(entry.size / maxExpectedSize, 1);
  }

  private calculateQualityScore(entry: SampleCacheEntry): number {
    // Lower quality = higher eviction priority (when quality preservation is disabled)
    const qualityRanking = {
      preview: 0.1,
      mobile: 0.2,
      streaming: 0.3,
      practice: 0.4,
      performance: 0.5,
      studio: 0.6,
    };

    const baseScore = qualityRanking[entry.qualityProfile] || 0.3;

    // Invert if quality preservation is enabled
    return this.config.qualityPreservation ? 1 - baseScore : baseScore;
  }

  private calculateUsagePatternScore(entry: SampleCacheEntry): number {
    // Analyze usage patterns for smarter eviction
    const completionRate = entry.completionRate || 0;
    const averagePlayDuration = entry.averagePlayDuration || 0;

    // Low completion rate or short play duration = higher eviction priority
    const completionScore = 1 - completionRate;
    const durationScore = Math.max(0, 1 - averagePlayDuration / 300); // 5 minutes max

    return (completionScore + durationScore) / 2;
  }

  private getAdaptiveWeights(
    _memoryPressure: MemoryPressureLevel,
  ): Record<string, number> {
    const baseWeights = {
      recency: this.config.lruWeight,
      frequency: this.config.lfuWeight,
      usage: this.config.usageWeight,
      quality: this.config.qualityWeight,
      size: this.config.sizeWeight,
    };

    // Adjust based on observed performance
    if (this.adaptiveWeights.recency !== undefined) {
      baseWeights.recency = this.adaptiveWeights.recency;
    }
    if (this.adaptiveWeights.frequency !== undefined) {
      baseWeights.frequency = this.adaptiveWeights.frequency;
    }
    if (this.adaptiveWeights.size !== undefined) {
      baseWeights.size = this.adaptiveWeights.size;
    }

    return baseWeights;
  }

  private adjustWeightsForMemoryPressure(
    weights: Record<string, number>,
    _memoryPressure: MemoryPressureLevel,
  ): Record<string, number> {
    const adjusted = { ...weights };

    switch (_memoryPressure) {
      case 'critical':
        // Prioritize size heavily in critical situations
        if (adjusted.size !== undefined) adjusted.size *= 2;
        if (adjusted.quality !== undefined) adjusted.quality *= 0.5; // Less concern for quality
        break;
      case 'high':
        if (adjusted.size !== undefined) adjusted.size *= 1.5;
        if (adjusted.quality !== undefined) adjusted.quality *= 0.7;
        break;
      case 'medium':
        if (adjusted.size !== undefined) adjusted.size *= 1.2;
        if (adjusted.quality !== undefined) adjusted.quality *= 0.9;
        break;
      default:
        // No adjustment for low or no pressure
        break;
    }

    // Normalize weights to sum to 1
    const total = Object.values(adjusted).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    if (total > 0) {
      Object.keys(adjusted).forEach((key) => {
        if (adjusted[key] !== undefined) {
          adjusted[key] /= total;
        }
      });
    }

    return adjusted;
  }

  private getBatchSize(memoryPressure: MemoryPressureLevel): number {
    if (memoryPressure === 'critical' || memoryPressure === 'high') {
      return this.config.emergencyBatchSize;
    }
    return this.config.batchSize;
  }

  private getEvictionReason(
    sampleId: string,
    entry: SampleCacheEntry,
    score: number,
  ): string {
    if (score > 0.8) {
      return 'High eviction score due to low usage and/or large size';
    } else if (score > 0.6) {
      return 'Medium eviction score due to infrequent access';
    } else if (score > 0.4) {
      return 'Low usage frequency or recent access';
    } else {
      return 'Selected for eviction to free memory';
    }
  }

  private updateStatistics(
    candidates: EvictionCandidate[],
    memoryPressure: MemoryPressureLevel,
  ): void {
    this.statistics.totalEvictions += candidates.length;
    this.statistics.evictionsByStrategy[this.config.strategy] +=
      candidates.length;

    if (candidates.length > 0) {
      const averageScore =
        candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length;
      this.statistics.averageEvictionScore =
        (this.statistics.averageEvictionScore + averageScore) / 2;

      const memoryFreed = candidates.reduce(
        (sum, c) => sum + c.memoryImpact,
        0,
      );
      this.statistics.memoryFreed += memoryFreed;

      this.statistics.lastEvictionTime = Date.now();

      if (memoryPressure === 'critical' || memoryPressure === 'high') {
        this.statistics.emergencyEvictions += candidates.length;
      }
    }
  }

  private initializeStatistics(): EvictionStatistics {
    return {
      totalEvictions: 0,
      evictionsByStrategy: {
        lru: 0,
        lfu: 0,
        usage_based: 0,
        intelligent: 0,
      },
      averageEvictionScore: 0,
      memoryFreed: 0,
      qualityImpact: 0,
      lastEvictionTime: 0,
      emergencyEvictions: 0,
    };
  }

  private initializeAdaptiveWeights(): void {
    this.adaptiveWeights = {
      recency: this.config.lruWeight,
      frequency: this.config.lfuWeight,
      usage: this.config.usageWeight,
      quality: this.config.qualityWeight,
      size: this.config.sizeWeight,
    };
  }
}

export default EvictionPolicyEngine;
