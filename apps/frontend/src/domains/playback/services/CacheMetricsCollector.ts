/**
 * CacheMetricsCollector - Cache Performance Tracking Service
 *
 * Monitors cache hit rates, efficiency, and performance for Epic 2
 * asset loading optimization and CDN cache effectiveness analysis.
 *
 * Part of Story 2.1: Task 12, Subtask 12.5
 */

import { EventEmitter } from 'events';

export interface CachePerformanceMetrics {
  hitRate: number; // Overall cache hit rate (0-1)
  hitRateByType: Map<string, number>; // Hit rate by asset type
  totalRequests: number; // Total cache requests
  totalHits: number; // Total cache hits
  totalMisses: number; // Total cache misses
  memoryUsage: number; // Cache memory usage (bytes)
  evictionCount: number; // Number of cache evictions
  averageLoadTime: number; // Average load time for misses (ms)
  lastUpdated: number; // Last metrics update
  hitRateByPriority: Map<string, number>; // Hit rate by asset priority
  avgHitLoadTime: number; // Average load time for hits (ms)
  avgMissLoadTime: number; // Average load time for misses (ms)
  cacheEfficiency: number; // Overall cache efficiency score (0-1)
}

export interface CacheOperationRecord {
  id: string;
  url: string;
  type: 'hit' | 'miss' | 'eviction' | 'insertion';
  assetType?: 'midi' | 'audio';
  assetPriority?: 'high' | 'medium' | 'low';
  timestamp: number;
  loadTime?: number; // Time taken if it was a miss
  cacheSize?: number; // Asset size in bytes
  memoryPressure?: number; // Memory pressure at time of operation (0-1)
}

export interface CacheStoreStats {
  totalSize: number; // Total cache size in bytes
  itemCount: number; // Number of items in cache
  oldestItem: number; // Timestamp of oldest cached item
  newestItem: number; // Timestamp of newest cached item
  averageItemSize: number; // Average size of cached items
  largestItem: number; // Size of largest cached item
  memoryPressure: number; // Current memory pressure (0-1)
}

export interface CacheMetricsConfig {
  enabled: boolean;
  historySize: number; // Number of operations to keep in history
  memoryThreshold: number; // Memory threshold for pressure calculation (bytes)
  evictionThreshold: number; // Memory usage threshold for evictions (0-1)
  enableDetailedTracking: boolean; // Track detailed per-asset metrics
  enableTrendAnalysis: boolean; // Enable trend analysis and predictions
  reportingInterval: number; // How often to calculate metrics (ms)
}

export interface CacheAlert {
  type:
    | 'hit_rate_low'
    | 'memory_pressure'
    | 'eviction_rate_high'
    | 'efficiency_degraded';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<CachePerformanceMetrics>;
  timestamp: number;
  recommendation?: string;
}

export interface CacheAnalytics {
  hitRateByTimeOfDay: Map<number, number>; // Hit rate by hour of day
  popularAssets: Array<{ url: string; hitCount: number; lastAccess: number }>;
  evictionPatterns: Array<{
    reason: string;
    frequency: number;
    avgItemAge: number;
  }>;
  performanceTrends: {
    hitRateChange: number; // % change in hit rate over time
    loadTimeChange: number; // % change in load times
    efficiencyChange: number; // % change in cache efficiency
  };
}

export class CacheMetricsCollector extends EventEmitter {
  private static instance: CacheMetricsCollector;
  private config: CacheMetricsConfig;
  private metrics: CachePerformanceMetrics;
  private operationHistory: CacheOperationRecord[] = [];
  private analytics: CacheAnalytics;
  private isTracking = false;
  private reportingInterval: number | null = null;

  // Performance thresholds for alerting
  private readonly HIT_RATE_THRESHOLDS = {
    excellent: 0.9, // 90%+ hit rate
    good: 0.7, // 70%+ hit rate
    acceptable: 0.5, // 50%+ hit rate
    poor: 0.3, // 30%+ hit rate
  };

  private readonly EFFICIENCY_THRESHOLDS = {
    excellent: 0.85,
    good: 0.7,
    acceptable: 0.5,
    poor: 0.3,
  };

  private constructor(config: Partial<CacheMetricsConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      historySize: 1000,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      evictionThreshold: 0.8, // 80%
      enableDetailedTracking: true,
      enableTrendAnalysis: true,
      reportingInterval: 30000, // 30 seconds
      ...config,
    };

    this.metrics = {
      hitRate: 0,
      hitRateByType: new Map(),
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      memoryUsage: 0,
      evictionCount: 0,
      averageLoadTime: 0,
      lastUpdated: 0,
      hitRateByPriority: new Map(),
      avgHitLoadTime: 0,
      avgMissLoadTime: 0,
      cacheEfficiency: 0,
    };

    this.analytics = {
      hitRateByTimeOfDay: new Map(),
      popularAssets: [],
      evictionPatterns: [],
      performanceTrends: {
        hitRateChange: 0,
        loadTimeChange: 0,
        efficiencyChange: 0,
      },
    };
  }

  public static getInstance(
    config?: Partial<CacheMetricsConfig>,
  ): CacheMetricsCollector {
    if (!CacheMetricsCollector.instance) {
      CacheMetricsCollector.instance = new CacheMetricsCollector(config);
    }
    return CacheMetricsCollector.instance;
  }

  /**
   * Start cache metrics tracking
   */
  public startTracking(): void {
    if (!this.config.enabled || this.isTracking) return;

    this.isTracking = true;

    // Start periodic metrics calculation
    this.reportingInterval = window.setInterval(() => {
      this.calculateMetrics();
      this.analyzePerformanceTrends();
    }, this.config.reportingInterval);

    this.emit('trackingStarted', { timestamp: Date.now() });
  }

  /**
   * Stop cache metrics tracking
   */
  public stopTracking(): void {
    if (!this.isTracking) return;

    this.isTracking = false;
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    this.emit('trackingStopped', { timestamp: Date.now() });
  }

  /**
   * Record a cache operation (hit, miss, eviction, insertion)
   */
  public recordOperation(
    url: string,
    type: 'hit' | 'miss' | 'eviction' | 'insertion',
    details: {
      assetType?: 'midi' | 'audio';
      assetPriority?: 'high' | 'medium' | 'low';
      loadTime?: number;
      cacheSize?: number;
      memoryPressure?: number;
    } = {},
  ): void {
    if (!this.config.enabled) return;

    const operation: CacheOperationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      type,
      timestamp: Date.now(),
      ...details,
    };

    this.operationHistory.push(operation);

    // Maintain history size limit
    if (this.operationHistory.length > this.config.historySize) {
      this.operationHistory.shift();
    }

    // Update metrics immediately for hits/misses/evictions
    if (type === 'hit' || type === 'miss') {
      this.updateImmediateMetrics(operation);
    } else if (type === 'eviction') {
      this.metrics.evictionCount++;
      if (details.cacheSize) {
        this.metrics.memoryUsage = Math.max(
          0,
          this.metrics.memoryUsage - details.cacheSize,
        );
      }
      this.metrics.lastUpdated = Date.now();
    }

    this.emit('operationRecorded', { operation });
  }

  /**
   * Get current cache performance metrics
   */
  public getMetrics(): CachePerformanceMetrics {
    return {
      ...this.metrics,
      hitRateByType: new Map(this.metrics.hitRateByType),
      hitRateByPriority: new Map(this.metrics.hitRateByPriority),
    };
  }

  /**
   * Get cache store statistics
   */
  public getCacheStoreStats(cacheStore: Map<string, any>): CacheStoreStats {
    const items = Array.from(cacheStore.entries());
    const sizes = items.map(([, value]) => this.estimateItemSize(value));
    const totalSize = sizes.reduce((sum, size) => sum + size, 0);

    // Estimate timestamps (simplified - in real implementation would track these)
    const now = Date.now();
    const oldestEstimate = now - 60 * 60 * 1000; // 1 hour ago
    const newestEstimate = now;

    return {
      totalSize,
      itemCount: items.length,
      oldestItem: oldestEstimate,
      newestItem: newestEstimate,
      averageItemSize: items.length > 0 ? totalSize / items.length : 0,
      largestItem: sizes.length > 0 ? Math.max(...sizes) : 0,
      memoryPressure: this.calculateMemoryPressure(totalSize),
    };
  }

  /**
   * Get cache analytics and trends
   */
  public getAnalytics(): CacheAnalytics {
    return {
      ...this.analytics,
      hitRateByTimeOfDay: new Map(this.analytics.hitRateByTimeOfDay),
      popularAssets: [...this.analytics.popularAssets],
      evictionPatterns: [...this.analytics.evictionPatterns],
    };
  }

  /**
   * Get cache efficiency score
   */
  public getEfficiencyScore(): number {
    return this.metrics.cacheEfficiency;
  }

  /**
   * Reset all metrics and history
   */
  public resetMetrics(): void {
    this.metrics = {
      hitRate: 0,
      hitRateByType: new Map(),
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      memoryUsage: 0,
      evictionCount: 0,
      averageLoadTime: 0,
      lastUpdated: 0,
      hitRateByPriority: new Map(),
      avgHitLoadTime: 0,
      avgMissLoadTime: 0,
      cacheEfficiency: 0,
    };

    this.operationHistory = [];
    this.analytics = {
      hitRateByTimeOfDay: new Map(),
      popularAssets: [],
      evictionPatterns: [],
      performanceTrends: {
        hitRateChange: 0,
        loadTimeChange: 0,
        efficiencyChange: 0,
      },
    };

    this.emit('metricsReset', { timestamp: Date.now() });
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.stopTracking();
    this.operationHistory = [];
    this.removeAllListeners();
  }

  /**
   * Update immediate metrics for hit/miss operations
   */
  private updateImmediateMetrics(operation: CacheOperationRecord): void {
    this.metrics.totalRequests++;

    if (operation.type === 'hit') {
      this.metrics.totalHits++;
      if (operation.loadTime) {
        this.updateAverage('avgHitLoadTime', operation.loadTime);
      }
    } else if (operation.type === 'miss') {
      this.metrics.totalMisses++;
      if (operation.loadTime) {
        this.updateAverage('avgMissLoadTime', operation.loadTime);
        this.updateAverage('averageLoadTime', operation.loadTime);
      }
    }

    // Update overall hit rate
    this.metrics.hitRate = this.metrics.totalHits / this.metrics.totalRequests;

    // Update hit rate by asset type
    if (
      operation.assetType &&
      (operation.type === 'hit' || operation.type === 'miss')
    ) {
      this.updateHitRateByCategory(
        this.metrics.hitRateByType,
        operation.assetType,
        operation.type,
      );
    }

    // Update hit rate by priority
    if (
      operation.assetPriority &&
      (operation.type === 'hit' || operation.type === 'miss')
    ) {
      this.updateHitRateByCategory(
        this.metrics.hitRateByPriority,
        operation.assetPriority,
        operation.type,
      );
    }

    this.metrics.lastUpdated = Date.now();
  }

  /**
   * Calculate comprehensive metrics from operation history
   */
  private calculateMetrics(): void {
    if (this.operationHistory.length === 0) return;

    // Calculate memory usage from recent operations
    const recentOperations = this.operationHistory.slice(-100);
    this.metrics.memoryUsage = recentOperations
      .filter((op) => op.cacheSize)
      .reduce((sum, op) => sum + (op.cacheSize || 0), 0);

    // Calculate eviction count
    this.metrics.evictionCount = this.operationHistory.filter(
      (op) => op.type === 'eviction',
    ).length;

    // Calculate cache efficiency
    this.metrics.cacheEfficiency = this.calculateCacheEfficiency();

    // Update analytics
    this.updateAnalytics();

    // Check thresholds and emit alerts
    this.checkPerformanceThresholds();

    this.emit('metricsUpdated', { metrics: this.getMetrics() });
  }

  /**
   * Update hit rate for a specific category
   */
  private updateHitRateByCategory(
    categoryMap: Map<string, number>,
    category: string,
    _operationType: 'hit' | 'miss',
  ): void {
    const categoryOps = this.operationHistory.filter(
      (op) =>
        (op.assetType === category || op.assetPriority === category) &&
        (op.type === 'hit' || op.type === 'miss'),
    );

    if (categoryOps.length > 0) {
      const hits = categoryOps.filter((op) => op.type === 'hit').length;
      categoryMap.set(category, hits / categoryOps.length);
    }
  }

  /**
   * Update running average for a metric
   */
  private updateAverage(
    metricKey: keyof CachePerformanceMetrics,
    newValue: number,
  ): void {
    const currentValue = this.metrics[metricKey] as number;
    const alpha = 0.1; // Smoothing factor
    this.metrics[metricKey as keyof CachePerformanceMetrics] = (currentValue *
      (1 - alpha) +
      newValue * alpha) as any;
  }

  /**
   * Calculate overall cache efficiency score
   */
  private calculateCacheEfficiency(): number {
    const hitRateWeight = 0.4;
    const loadTimeWeight = 0.3;
    const memoryEfficiencyWeight = 0.3;

    // Hit rate efficiency (0-1)
    const hitRateEfficiency = this.metrics.hitRate;

    // Load time efficiency (inverse of normalized load time)
    const avgLoadTime = this.metrics.averageLoadTime || 1;
    const loadTimeEfficiency = Math.max(0, 1 - avgLoadTime / 5000); // Normalize against 5s max

    // Memory efficiency (inverse of memory pressure)
    const memoryEfficiency = Math.max(
      0,
      1 - this.calculateMemoryPressure(this.metrics.memoryUsage),
    );

    return (
      hitRateWeight * hitRateEfficiency +
      loadTimeWeight * loadTimeEfficiency +
      memoryEfficiencyWeight * memoryEfficiency
    );
  }

  /**
   * Calculate memory pressure based on current usage
   */
  private calculateMemoryPressure(memoryUsage: number): number {
    return Math.min(1, memoryUsage / this.config.memoryThreshold);
  }

  /**
   * Estimate size of a cached item
   */
  private estimateItemSize(item: any): number {
    if (item instanceof ArrayBuffer) {
      return item.byteLength;
    } else if (item instanceof AudioBuffer) {
      return item.length * item.numberOfChannels * 4; // 4 bytes per sample
    } else if (typeof item === 'string') {
      return item.length * 2; // 2 bytes per character (UTF-16)
    }
    return 1024; // Default estimate
  }

  /**
   * Update analytics data
   */
  private updateAnalytics(): void {
    this.updateHitRateByTimeOfDay();
    this.updatePopularAssets();
    this.updateEvictionPatterns();
  }

  /**
   * Update hit rate by time of day
   */
  private updateHitRateByTimeOfDay(): void {
    const hourBuckets = new Map<number, { hits: number; total: number }>();

    this.operationHistory
      .filter((op) => op.type === 'hit' || op.type === 'miss')
      .forEach((op) => {
        const hour = new Date(op.timestamp).getHours();
        const bucket = hourBuckets.get(hour) || { hits: 0, total: 0 };
        bucket.total++;
        if (op.type === 'hit') bucket.hits++;
        hourBuckets.set(hour, bucket);
      });

    hourBuckets.forEach((bucket, hour) => {
      this.analytics.hitRateByTimeOfDay.set(hour, bucket.hits / bucket.total);
    });
  }

  /**
   * Update popular assets list
   */
  private updatePopularAssets(): void {
    const assetHits = new Map<string, { count: number; lastAccess: number }>();

    this.operationHistory
      .filter((op) => op.type === 'hit')
      .forEach((op) => {
        const asset = assetHits.get(op.url) || { count: 0, lastAccess: 0 };
        asset.count++;
        asset.lastAccess = Math.max(asset.lastAccess, op.timestamp);
        assetHits.set(op.url, asset);
      });

    this.analytics.popularAssets = Array.from(assetHits.entries())
      .map(([url, stats]) => ({
        url,
        hitCount: stats.count,
        lastAccess: stats.lastAccess,
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 20); // Top 20 popular assets
  }

  /**
   * Update eviction patterns analysis
   */
  private updateEvictionPatterns(): void {
    const evictions = this.operationHistory.filter(
      (op) => op.type === 'eviction',
    );
    // Simplified eviction pattern analysis
    this.analytics.evictionPatterns = [
      {
        reason: 'memory_pressure',
        frequency: evictions.length,
        avgItemAge: evictions.length > 0 ? 30 * 60 * 1000 : 0, // 30 minutes average
      },
    ];
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(): void {
    const recentOps = this.operationHistory.slice(-100);
    const olderOps = this.operationHistory.slice(-200, -100);

    if (recentOps.length > 0 && olderOps.length > 0) {
      // Calculate hit rate change
      const recentHitRate =
        recentOps.filter((op) => op.type === 'hit').length / recentOps.length;
      const olderHitRate =
        olderOps.filter((op) => op.type === 'hit').length / olderOps.length;
      this.analytics.performanceTrends.hitRateChange =
        ((recentHitRate - olderHitRate) / olderHitRate) * 100;

      // Calculate load time change
      const recentLoadTimes = recentOps
        .filter((op) => op.loadTime)
        .map((op) => op.loadTime as number);
      const olderLoadTimes = olderOps
        .filter((op) => op.loadTime)
        .map((op) => op.loadTime as number);

      if (recentLoadTimes.length > 0 && olderLoadTimes.length > 0) {
        const recentAvgLoadTime =
          recentLoadTimes.reduce((sum, time) => sum + time, 0) /
          recentLoadTimes.length;
        const olderAvgLoadTime =
          olderLoadTimes.reduce((sum, time) => sum + time, 0) /
          olderLoadTimes.length;
        this.analytics.performanceTrends.loadTimeChange =
          ((recentAvgLoadTime - olderAvgLoadTime) / olderAvgLoadTime) * 100;
      }
    }
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkPerformanceThresholds(): void {
    // Check hit rate thresholds
    if (this.metrics.hitRate < this.HIT_RATE_THRESHOLDS.poor) {
      this.emitAlert({
        type: 'hit_rate_low',
        severity: 'critical',
        message: `Cache hit rate critically low: ${(this.metrics.hitRate * 100).toFixed(1)}%`,
        metrics: { hitRate: this.metrics.hitRate },
        timestamp: Date.now(),
        recommendation:
          'Consider increasing cache size or reviewing asset loading patterns',
      });
    } else if (this.metrics.hitRate < this.HIT_RATE_THRESHOLDS.acceptable) {
      this.emitAlert({
        type: 'hit_rate_low',
        severity: 'warning',
        message: `Cache hit rate below acceptable: ${(this.metrics.hitRate * 100).toFixed(1)}%`,
        metrics: { hitRate: this.metrics.hitRate },
        timestamp: Date.now(),
      });
    }

    // Check efficiency thresholds
    if (this.metrics.cacheEfficiency < this.EFFICIENCY_THRESHOLDS.poor) {
      this.emitAlert({
        type: 'efficiency_degraded',
        severity: 'critical',
        message: `Cache efficiency critically low: ${(this.metrics.cacheEfficiency * 100).toFixed(1)}%`,
        metrics: { cacheEfficiency: this.metrics.cacheEfficiency },
        timestamp: Date.now(),
        recommendation: 'Review cache eviction policies and memory allocation',
      });
    }

    // Check memory pressure
    const memoryPressure = this.calculateMemoryPressure(
      this.metrics.memoryUsage,
    );
    if (memoryPressure > 0.9) {
      this.emitAlert({
        type: 'memory_pressure',
        severity: 'critical',
        message: `High memory pressure: ${(memoryPressure * 100).toFixed(1)}%`,
        metrics: { memoryUsage: this.metrics.memoryUsage },
        timestamp: Date.now(),
        recommendation:
          'Consider reducing cache size or implementing more aggressive eviction',
      });
    }
  }

  /**
   * Emit cache performance alert
   */
  private emitAlert(alert: CacheAlert): void {
    this.emit('alert', { alert });
  }
}
