/**
 * Story 2.4 Task 4.4: Intelligent Sample Caching - Main Cache Manager
 * SampleCacheManager - The main orchestrator for intelligent sample caching
 *
 * Integrates usage pattern analysis, memory management, and intelligent eviction
 * to provide enterprise-grade intelligent caching with usage-based optimization.
 *
 * Features:
 * - Map-like interface for backward compatibility
 * - Intelligent usage pattern tracking and analysis
 * - Memory pressure-aware caching decisions
 * - Smart eviction with multiple strategies
 * - Predictive preloading based on usage patterns
 * - Comprehensive cache analytics and optimization
 */

import {
  SampleCacheEntry,
  IntelligentSampleCacheConfig,
  AudioSampleMetadata,
} from '@bassnotion/contracts';

import UsagePatternAnalyzer, {
  UsageAnalyzerConfig,
  UsageAnalysisResult,
  CacheRecommendation,
} from './UsagePatternAnalyzer.js';

import MemoryManager, {
  MemoryManagerConfig,
  MemoryUsageInfo,
  MemoryPressureLevel,
} from './MemoryManager.js';

import EvictionPolicyEngine, {
  EvictionPolicyConfig,
  EvictionStatistics,
} from './EvictionPolicyEngine.js';

/**
 * Memory optimization result interface
 */
export interface MemoryOptimizationResult {
  success: boolean;
  optimizationType: string;
  memoryFreed: number;
  itemsProcessed: number;
  duration: number;
  recommendations: string[];
  error?: string;
}

/**
 * Cache operation result interface
 */
export interface CacheOperationResult {
  success: boolean;
  operation: 'get' | 'set' | 'delete' | 'evict' | 'optimize';
  sampleId: string;
  fromCache: boolean;
  loadTime: number;
  size?: number;
  source: 'memory' | 'evicted' | 'not_found';
  memoryPressure: MemoryPressureLevel;
  cacheEfficiency: number;
  error?: Error;
}

/**
 * Cache analytics interface
 */
export interface CacheAnalytics {
  totalSamples: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  averageLoadTime: number;
  memoryUtilization: number;
  efficiencyScore: number;
  usageAnalysis: UsageAnalysisResult | null;
  memoryStatus: MemoryUsageInfo;
  evictionStatistics: EvictionStatistics;
  recommendations: CacheRecommendation[];
  lastOptimized: number;
}

/**
 * Preload operation interface
 */
export interface PreloadOperation {
  sampleId: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  estimatedSize: number;
  timeToAccess: number;
  reason: string;
}

/**
 * Sample Cache Manager
 *
 * The main orchestrator for intelligent sample caching that integrates:
 * - Usage pattern analysis for optimization recommendations
 * - Memory management for pressure-aware caching decisions
 * - Intelligent eviction policies with adaptive strategies
 */
export class SampleCacheManager {
  private config: IntelligentSampleCacheConfig;
  private cache: Map<string, SampleCacheEntry> = new Map();

  // Integrated components
  // TODO: Review non-null assertion - consider null safety
  private usageAnalyzer!: UsagePatternAnalyzer;
  // TODO: Review non-null assertion - consider null safety
  private memoryManager!: MemoryManager;
  // TODO: Review non-null assertion - consider null safety
  private evictionEngine!: EvictionPolicyEngine;

  // Cache state
  private totalSize = 0;
  private operationCount = 0;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private lastOptimization = 0;

  // Performance tracking
  private loadTimes: number[] = [];
  private isOptimizing = false;

  constructor(config: IntelligentSampleCacheConfig) {
    this.config = config;
    this.initializeComponents();
  }

  /**
   * Get a sample from cache with intelligent tracking
   */
  public async get(
    sampleId: string,
    sessionDuration?: number,
  ): Promise<CacheOperationResult> {
    const startTime = performance.now();
    this.operationCount++;

    try {
      const entry = this.cache.get(sampleId);
      const memoryPressure = this.memoryManager.getMemoryPressure();

      if (entry) {
        // Cache hit - update tracking
        this.hitCount++;
        entry.lastAccessed = Date.now();
        entry.accessCount++;

        // Track usage patterns
        if (this.config.trackUsagePatterns) {
          this.usageAnalyzer.recordAccess(sampleId, entry, sessionDuration);
        }

        const loadTime = performance.now() - startTime;
        this.recordLoadTime(loadTime);

        return {
          success: true,
          operation: 'get',
          sampleId,
          fromCache: true,
          loadTime,
          size: entry.size,
          source: 'memory',
          memoryPressure,
          cacheEfficiency: this.calculateEfficiencyScore(),
        };
      } else {
        // Cache miss
        this.missCount++;

        const loadTime = performance.now() - startTime;
        this.recordLoadTime(loadTime);

        return {
          success: false,
          operation: 'get',
          sampleId,
          fromCache: false,
          loadTime,
          source: 'not_found',
          memoryPressure,
          cacheEfficiency: this.calculateEfficiencyScore(),
        };
      }
    } catch (error) {
      const loadTime = performance.now() - startTime;
      return {
        success: false,
        operation: 'get',
        sampleId,
        fromCache: false,
        loadTime,
        source: 'not_found',
        memoryPressure: this.memoryManager.getMemoryPressure(),
        cacheEfficiency: this.calculateEfficiencyScore(),
        error: error as Error,
      };
    }
  }

  /**
   * Set a sample in cache with intelligent management
   */
  public async set(
    sampleId: string,
    data: ArrayBuffer,
    metadata: AudioSampleMetadata,
  ): Promise<CacheOperationResult> {
    const startTime = performance.now();
    this.operationCount++;

    try {
      const size = data.byteLength;
      const memoryPressure = this.memoryManager.getMemoryPressure();

      // Check if we need to evict before adding
      const shouldEvict = await this.shouldEvictBeforeAdding(size);
      if (shouldEvict) {
        await this.performIntelligentEviction(memoryPressure);
      }

      // Create cache entry
      const entry: SampleCacheEntry = {
        sampleId,
        metadata,
        data,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size,
        qualityProfile: metadata.qualityProfile,
        compressionUsed: false,
        averagePlayDuration: metadata.duration || 0,
        completionRate: 0,
        isValid: true,
        needsRefresh: false,
        isLocked: false,
      };

      // Add to cache
      this.cache.set(sampleId, entry);
      this.totalSize += size;

      // Track usage patterns
      if (this.config.trackUsagePatterns) {
        this.usageAnalyzer.recordAccess(sampleId, entry);
      }

      // Trigger optimization if needed
      if (this.shouldTriggerOptimization()) {
        this.scheduleOptimization();
      }

      const loadTime = performance.now() - startTime;
      this.recordLoadTime(loadTime);

      return {
        success: true,
        operation: 'set',
        sampleId,
        fromCache: false,
        loadTime,
        size,
        source: 'memory',
        memoryPressure,
        cacheEfficiency: this.calculateEfficiencyScore(),
      };
    } catch (error) {
      const loadTime = performance.now() - startTime;
      return {
        success: false,
        operation: 'set',
        sampleId,
        fromCache: false,
        loadTime,
        source: 'not_found',
        memoryPressure: this.memoryManager.getMemoryPressure(),
        cacheEfficiency: this.calculateEfficiencyScore(),
        error: error as Error,
      };
    }
  }

  /**
   * Delete a sample from cache
   */
  public async delete(sampleId: string): Promise<CacheOperationResult> {
    const startTime = performance.now();
    this.operationCount++;

    try {
      const entry = this.cache.get(sampleId);
      const memoryPressure = this.memoryManager.getMemoryPressure();

      if (entry) {
        this.cache.delete(sampleId);
        this.totalSize -= entry.size;

        const loadTime = performance.now() - startTime;
        this.recordLoadTime(loadTime);

        return {
          success: true,
          operation: 'delete',
          sampleId,
          fromCache: true,
          loadTime,
          size: entry.size,
          source: 'memory',
          memoryPressure,
          cacheEfficiency: this.calculateEfficiencyScore(),
        };
      } else {
        const loadTime = performance.now() - startTime;
        return {
          success: false,
          operation: 'delete',
          sampleId,
          fromCache: false,
          loadTime,
          source: 'not_found',
          memoryPressure,
          cacheEfficiency: this.calculateEfficiencyScore(),
        };
      }
    } catch (error) {
      const loadTime = performance.now() - startTime;
      return {
        success: false,
        operation: 'delete',
        sampleId,
        fromCache: false,
        loadTime,
        source: 'not_found',
        memoryPressure: this.memoryManager.getMemoryPressure(),
        cacheEfficiency: this.calculateEfficiencyScore(),
        error: error as Error,
      };
    }
  }

  /**
   * Check if cache has a sample
   */
  public has(sampleId: string): boolean {
    return this.cache.has(sampleId);
  }

  /**
   * Get cache size information
   */
  public size(): { count: number; bytes: number } {
    return {
      count: this.cache.size,
      bytes: this.totalSize,
    };
  }

  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.totalSize = 0;
    this.resetStatistics();
  }

  /**
   * Get comprehensive cache analytics
   */
  public async getAnalytics(): Promise<CacheAnalytics> {
    const usageAnalysis = this.usageAnalyzer.getLatestAnalysis();
    const memoryStatus = this.memoryManager.getMemoryUsage();
    const evictionStats = this.evictionEngine.getStatistics();

    return {
      totalSamples: this.cache.size,
      totalSize: this.totalSize,
      hitRate:
        this.operationCount > 0 ? this.hitCount / this.operationCount : 0,
      missRate:
        this.operationCount > 0 ? this.missCount / this.operationCount : 0,
      evictionRate:
        this.operationCount > 0 ? this.evictionCount / this.operationCount : 0,
      averageLoadTime: this.calculateAverageLoadTime(),
      memoryUtilization: this.totalSize / this.config.maxCacheSize,
      efficiencyScore: this.calculateEfficiencyScore(),
      usageAnalysis,
      memoryStatus,
      evictionStatistics: evictionStats,
      recommendations: this.usageAnalyzer.generateRecommendations(),
      lastOptimized: this.lastOptimization,
    };
  }

  /**
   * Perform intelligent cache optimization
   */
  public async optimize(): Promise<MemoryOptimizationResult> {
    if (this.isOptimizing) {
      return {
        success: false,
        optimizationType: 'intelligent',
        memoryFreed: 0,
        itemsProcessed: 0,
        duration: 0,
        recommendations: [],
        error: 'Optimization already in progress',
      };
    }

    this.isOptimizing = true;
    const startTime = performance.now();

    try {
      const memoryPressure = this.memoryManager.getMemoryPressure();
      let totalMemoryFreed = 0;
      let itemsProcessed = 0;

      // Perform intelligent eviction if needed
      if (memoryPressure !== 'none') {
        const evictionResult =
          await this.performIntelligentEviction(memoryPressure);
        totalMemoryFreed += evictionResult.memoryFreed;
        itemsProcessed += evictionResult.itemsProcessed;
      }

      // Process optimization recommendations
      const recommendations = this.usageAnalyzer.generateRecommendations();
      for (const recommendation of recommendations) {
        if (
          recommendation.type === 'evict' &&
          recommendation.priority === 'high'
        ) {
          const entry = this.cache.get(recommendation.sampleId);
          if (entry) {
            this.cache.delete(recommendation.sampleId);
            this.totalSize -= entry.size;
            totalMemoryFreed += entry.size;
            itemsProcessed++;
            this.evictionCount++;
          }
        }
      }

      // Update optimization timestamp
      this.lastOptimization = Date.now();

      const duration = performance.now() - startTime;

      return {
        success: true,
        optimizationType: 'intelligent',
        memoryFreed: totalMemoryFreed,
        itemsProcessed,
        duration,
        recommendations: recommendations.map((r) => r.reason),
      };
    } catch (error) {
      return {
        success: false,
        optimizationType: 'intelligent',
        memoryFreed: 0,
        itemsProcessed: 0,
        duration: performance.now() - startTime,
        recommendations: [],
        error: (error as Error).message,
      };
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Get predictive preload recommendations
   */
  public async getPredictiveRecommendations(): Promise<PreloadOperation[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enablePredictiveCaching) {
      return [];
    }

    const predictions = this.usageAnalyzer.predictNextAccesses();
    const availableSpace = this.config.maxCacheSize - this.totalSize;

    return (
      predictions
        .filter(
          (pred) =>
            pred.confidence >= this.config.predictionConfidenceThreshold,
        )
        // TODO: Review non-null assertion - consider null safety
        .filter((pred) => !this.cache.has(pred.sampleId))
        .map((pred) => ({
          sampleId: pred.sampleId,
          confidence: pred.confidence,
          priority: (pred.confidence > 0.8
            ? 'high'
            : pred.confidence > 0.6
              ? 'medium'
              : 'low') as 'low' | 'medium' | 'high',
          estimatedSize: 1024 * 1024,
          timeToAccess: pred.timeToAccess,
          reason: `Predicted access with ${(pred.confidence * 100).toFixed(1)}% confidence`,
        }))
        .filter((op) => op.estimatedSize <= availableSpace)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10)
    );
  }

  /**
   * Update cache configuration
   */
  public updateConfig(newConfig: Partial<IntelligentSampleCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Private implementation methods

  private initializeComponents(): void {
    // Initialize usage pattern analyzer
    const usageConfig: UsageAnalyzerConfig = {
      enabled: this.config.trackUsagePatterns,
      analysisWindow: this.config.usageHistoryWindow,
      minAccessesForPattern: 3,
      sequentialDetectionWindow: 30000,
      temporalAnalysisEnabled: true,
      behaviorPredictionEnabled: this.config.enablePredictiveCaching,
      recommendationGenerationEnabled: true,
      maxPatternsToTrack: this.config.maxSamples,
      patternDecayFactor: 0.95,
    };
    this.usageAnalyzer = new UsagePatternAnalyzer(usageConfig);

    // Initialize memory manager
    const memoryConfig: MemoryManagerConfig = {
      enabled: true,
      monitoringInterval: 5000,
      thresholds: {
        lowPressure: 0.7,
        mediumPressure: 0.8,
        highPressure: 0.9,
        criticalPressure: 0.95,
      },
      adaptiveSizing: true,
      autoOptimization: true,
      maxCacheMemoryRatio: 0.3,
      emergencyEvictionEnabled: true,
      compressionThreshold: 0.8,
      performanceMonitoring: this.config.enableAnalytics,
    };
    this.memoryManager = new MemoryManager(memoryConfig);

    // Initialize eviction policy engine
    const evictionConfig: EvictionPolicyConfig = {
      strategy: this.config.evictionStrategy,
      lruWeight: this.config.recencyWeight,
      lfuWeight: 0.3,
      usageWeight: this.config.popularityWeight,
      qualityWeight: this.config.enableQualityOptimization ? 0.2 : 0,
      sizeWeight: 0.3,
      adaptiveWeighting: true,
      memoryPressureAware: true,
      qualityPreservation: this.config.enableQualityOptimization,
      batchSize: 5,
      emergencyBatchSize: 20,
      minRetentionTime: 60000,
      protectedSampleIds: [],
    };
    this.evictionEngine = new EvictionPolicyEngine(evictionConfig);
  }

  private async shouldEvictBeforeAdding(newItemSize: number): Promise<boolean> {
    const wouldExceedSize =
      this.totalSize + newItemSize > this.config.maxCacheSize;
    const wouldExceedCount = this.cache.size >= this.config.maxSamples;
    const memoryPressure = this.memoryManager.getMemoryPressure();
    const isHighPressure =
      memoryPressure === 'high' || memoryPressure === 'critical';

    return wouldExceedSize || wouldExceedCount || isHighPressure;
  }

  private async performIntelligentEviction(
    memoryPressure: MemoryPressureLevel,
  ): Promise<{ memoryFreed: number; itemsProcessed: number }> {
    const targetEvictionCount = this.calculateEvictionCount(memoryPressure);
    const candidates = this.evictionEngine.selectEvictionCandidates(
      this.cache,
      targetEvictionCount,
      memoryPressure,
    );

    let memoryFreed = 0;
    let itemsProcessed = 0;

    for (const candidate of candidates) {
      const entry = this.cache.get(candidate.sampleId);
      if (entry) {
        this.cache.delete(candidate.sampleId);
        this.totalSize -= entry.size;
        memoryFreed += entry.size;
        itemsProcessed++;
        this.evictionCount++;
      }
    }

    return { memoryFreed, itemsProcessed };
  }

  private calculateEvictionCount(memoryPressure: MemoryPressureLevel): number {
    const currentUtilization = this.totalSize / this.config.maxCacheSize;
    const targetUtilization = this.getTargetUtilization(memoryPressure);

    if (currentUtilization <= targetUtilization) {
      return 0;
    }

    const averageItemSize = this.totalSize / this.cache.size;
    const bytesToFree =
      (currentUtilization - targetUtilization) * this.config.maxCacheSize;
    return Math.ceil(bytesToFree / averageItemSize);
  }

  private getTargetUtilization(memoryPressure: MemoryPressureLevel): number {
    switch (memoryPressure) {
      case 'critical':
        return 0.6;
      case 'high':
        return 0.7;
      case 'medium':
        return 0.8;
      default:
        return 0.9;
    }
  }

  private shouldTriggerOptimization(): boolean {
    const timeSinceLastOptimization = Date.now() - this.lastOptimization;
    const optimizationInterval = this.config.optimizationInterval || 300000;

    return (
      this.config.enableBackgroundOptimization &&
      timeSinceLastOptimization > optimizationInterval
    );
  }

  private scheduleOptimization(): void {
    setTimeout(() => {
      this.optimize().catch((error) => {
        console.warn('Background cache optimization failed:', error);
      });
    }, 1000);
  }

  private calculateEfficiencyScore(): number {
    if (this.operationCount === 0) {
      return 0.5;
    }

    const hitRate = this.hitCount / this.operationCount;
    const utilizationScore = Math.min(
      this.totalSize / this.config.maxCacheSize,
      1,
    );
    const usageEfficiency = this.usageAnalyzer.getCacheEfficiencyScore();

    return hitRate * 0.5 + utilizationScore * 0.3 + usageEfficiency * 0.2;
  }

  private calculateAverageLoadTime(): number {
    if (this.loadTimes.length === 0) {
      return 0;
    }

    const sum = this.loadTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.loadTimes.length;
  }

  private recordLoadTime(loadTime: number): void {
    this.loadTimes.push(loadTime);

    if (this.loadTimes.length > 1000) {
      this.loadTimes = this.loadTimes.slice(-500);
    }
  }

  private resetStatistics(): void {
    this.operationCount = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.loadTimes = [];
    this.lastOptimization = 0;
  }
}

export default SampleCacheManager;
