/**
 * UsageAnalytics - Storage usage analytics and monitoring
 * 
 * Tracks and analyzes storage usage patterns, performance metrics,
 * and provides insights for optimization. Simplified from the more
 * complex SampleAnalyticsEngine.
 */

import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('UsageAnalytics');

export interface UsageAnalyticsConfig {
  enabled: boolean;
  trackingInterval: number; // ms
  historySize: number; // Number of data points to keep
  alertThresholds: {
    errorRate: number;
    latency: number;
    cacheHitRate: number;
  };
}

export interface UsageMetrics {
  timestamp: number;
  operations: {
    loads: number;
    stores: number;
    deletes: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
  };
  performance: {
    avgLoadTime: number;
    avgStoreTime: number;
    p95LoadTime: number;
    p95StoreTime: number;
  };
  storage: {
    totalSize: number;
    fileCount: number;
    cacheSize: number;
    cacheUtilization: number;
  };
  quality: {
    errorRate: number;
    cacheHitRate: number;
    compressionRatio: number;
  };
}

export interface UsagePattern {
  assetId: string;
  accessCount: number;
  lastAccessed: number;
  avgAccessInterval: number;
  peakUsageTimes: number[];
  relatedAssets: Map<string, number>;
}

export interface UsageAlert {
  id: string;
  type: 'performance' | 'error' | 'capacity' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metric: string;
  threshold: number;
  actual: number;
  recommendation?: string;
}

export interface UsageReport {
  reportId: string;
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalOperations: number;
    totalDataTransferred: number;
    averageCacheHitRate: number;
    averageLatency: number;
    errorRate: number;
  };
  trends: {
    operations: 'increasing' | 'stable' | 'decreasing';
    performance: 'improving' | 'stable' | 'degrading';
    errors: 'increasing' | 'stable' | 'decreasing';
  };
  topAssets: Array<{
    assetId: string;
    accessCount: number;
    avgLoadTime: number;
  }>;
  alerts: UsageAlert[];
  recommendations: string[];
}

/**
 * Tracks and analyzes storage usage
 */
export class UsageAnalytics {
  private config: UsageAnalyticsConfig;
  private eventBus?: EventBus;
  
  // Tracking data
  private metricsHistory: UsageMetrics[] = [];
  private patterns = new Map<string, UsagePattern>();
  private alerts: UsageAlert[] = [];
  private trackingInterval?: number;
  
  // Current session metrics
  private sessionMetrics = {
    operations: {
      loads: 0,
      stores: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    },
    loadTimes: [] as number[],
    storeTimes: [] as number[],
    dataTransferred: 0,
    sessionStart: Date.now(),
  };

  constructor(config: UsageAnalyticsConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    
    if (config.enabled) {
      this.startTracking();
    }
  }

  /**
   * Start tracking
   */
  private startTracking(): void {
    // Subscribe to storage events
    if (this.eventBus) {
      this.eventBus.on('storage:loaded', this.handleLoad.bind(this));
      this.eventBus.on('storage:stored', this.handleStore.bind(this));
      this.eventBus.on('storage:deleted', this.handleDelete.bind(this));
      this.eventBus.on('cache:hit', this.handleCacheHit.bind(this));
      this.eventBus.on('cache:miss', this.handleCacheMiss.bind(this));
      this.eventBus.on('storage:error', this.handleError.bind(this));
    }
    
    // Start periodic metrics collection
    this.trackingInterval = window.setInterval(
      () => this.collectMetrics(),
      this.config.trackingInterval
    );
    
    logger.info('Usage analytics tracking started');
  }

  /**
   * Stop tracking
   */
  stopTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }
    
    logger.info('Usage analytics tracking stopped');
  }

  /**
   * Record load operation
   */
  recordLoad(assetId: string, loadTime: number, size: number, fromCache: boolean): void {
    if (!this.config.enabled) return;
    
    this.sessionMetrics.operations.loads++;
    this.sessionMetrics.loadTimes.push(loadTime);
    this.sessionMetrics.dataTransferred += size;
    
    if (fromCache) {
      this.sessionMetrics.operations.cacheHits++;
    } else {
      this.sessionMetrics.operations.cacheMisses++;
    }
    
    this.updatePattern(assetId);
  }

  /**
   * Record store operation
   */
  recordStore(assetId: string, storeTime: number, size: number): void {
    if (!this.config.enabled) return;
    
    this.sessionMetrics.operations.stores++;
    this.sessionMetrics.storeTimes.push(storeTime);
    this.sessionMetrics.dataTransferred += size;
  }

  /**
   * Record delete operation
   */
  recordDelete(assetId: string | string[]): void {
    if (!this.config.enabled) return;
    
    const count = Array.isArray(assetId) ? assetId.length : 1;
    this.sessionMetrics.operations.deletes += count;
  }

  /**
   * Record error
   */
  recordError(operation: string, error: Error): void {
    if (!this.config.enabled) return;
    
    this.sessionMetrics.operations.errors++;
    
    // Check error rate threshold
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: errorRate > this.config.alertThresholds.errorRate * 2 ? 'high' : 'medium',
        message: `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
        metric: 'errorRate',
        threshold: this.config.alertThresholds.errorRate,
        actual: errorRate,
        recommendation: 'Check network connectivity and storage service status',
      });
    }
  }

  /**
   * Update usage pattern
   */
  private updatePattern(assetId: string, relatedAssetId?: string): void {
    let pattern = this.patterns.get(assetId);
    
    if (!pattern) {
      pattern = {
        assetId,
        accessCount: 0,
        lastAccessed: Date.now(),
        avgAccessInterval: 0,
        peakUsageTimes: [],
        relatedAssets: new Map(),
      };
      this.patterns.set(assetId, pattern);
    }
    
    const now = Date.now();
    const interval = now - pattern.lastAccessed;
    
    pattern.accessCount++;
    pattern.avgAccessInterval = 
      (pattern.avgAccessInterval * (pattern.accessCount - 1) + interval) / 
      pattern.accessCount;
    pattern.lastAccessed = now;
    
    // Track peak usage hour
    const hour = new Date().getHours();
    if (!pattern.peakUsageTimes.includes(hour)) {
      pattern.peakUsageTimes.push(hour);
    }
    
    // Track related assets
    if (relatedAssetId && relatedAssetId !== assetId) {
      const count = pattern.relatedAssets.get(relatedAssetId) || 0;
      pattern.relatedAssets.set(relatedAssetId, count + 1);
    }
  }

  /**
   * Collect periodic metrics
   */
  private collectMetrics(): void {
    const metrics = this.calculateCurrentMetrics();
    
    // Add to history
    this.metricsHistory.push(metrics);
    
    // Trim history
    if (this.metricsHistory.length > this.config.historySize) {
      this.metricsHistory.shift();
    }
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    // Emit metrics update
    this.eventBus?.emit('analytics:metrics', metrics);
  }

  /**
   * Calculate current metrics
   */
  private calculateCurrentMetrics(): UsageMetrics {
    const loadTimes = this.sessionMetrics.loadTimes;
    const storeTimes = this.sessionMetrics.storeTimes;
    
    return {
      timestamp: Date.now(),
      operations: { ...this.sessionMetrics.operations },
      performance: {
        avgLoadTime: this.calculateAverage(loadTimes),
        avgStoreTime: this.calculateAverage(storeTimes),
        p95LoadTime: this.calculatePercentile(loadTimes, 95),
        p95StoreTime: this.calculatePercentile(storeTimes, 95),
      },
      storage: {
        totalSize: 0, // Would need to track
        fileCount: 0, // Would need to track
        cacheSize: 0, // Would need to track
        cacheUtilization: 0, // Would need to track
      },
      quality: {
        errorRate: this.calculateErrorRate(),
        cacheHitRate: this.calculateCacheHitRate(),
        compressionRatio: 0, // Would need to track
      },
    };
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: UsageMetrics): void {
    // Check latency
    if (metrics.performance.p95LoadTime > this.config.alertThresholds.latency) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `High load latency detected: ${metrics.performance.p95LoadTime.toFixed(0)}ms`,
        metric: 'p95LoadTime',
        threshold: this.config.alertThresholds.latency,
        actual: metrics.performance.p95LoadTime,
        recommendation: 'Consider increasing cache size or optimizing asset loading',
      });
    }
    
    // Check cache hit rate
    if (metrics.quality.cacheHitRate < this.config.alertThresholds.cacheHitRate) {
      this.createAlert({
        type: 'performance',
        severity: 'low',
        message: `Low cache hit rate: ${(metrics.quality.cacheHitRate * 100).toFixed(1)}%`,
        metric: 'cacheHitRate',
        threshold: this.config.alertThresholds.cacheHitRate,
        actual: metrics.quality.cacheHitRate,
        recommendation: 'Review cache eviction policies and preloading strategies',
      });
    }
  }

  /**
   * Create alert
   */
  private createAlert(alert: Omit<UsageAlert, 'id' | 'timestamp'>): void {
    const fullAlert: UsageAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    this.alerts.push(fullAlert);
    
    // Keep only recent alerts
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    
    // Emit alert
    this.eventBus?.emit('analytics:alert', fullAlert);
    
    logger.warn('Usage alert:', fullAlert.message);
  }

  /**
   * Generate usage report
   */
  generateReport(period?: { start: number; end: number }): UsageReport {
    const now = Date.now();
    const reportPeriod = period || {
      start: this.sessionMetrics.sessionStart,
      end: now,
    };
    
    // Filter metrics for period
    const periodMetrics = this.metricsHistory.filter(
      m => m.timestamp >= reportPeriod.start && m.timestamp <= reportPeriod.end
    );
    
    // Calculate summary
    const totalOps = this.sessionMetrics.operations.loads + 
                    this.sessionMetrics.operations.stores + 
                    this.sessionMetrics.operations.deletes;
    
    const summary = {
      totalOperations: totalOps,
      totalDataTransferred: this.sessionMetrics.dataTransferred,
      averageCacheHitRate: this.calculateCacheHitRate(),
      averageLatency: this.calculateAverage(this.sessionMetrics.loadTimes),
      errorRate: this.calculateErrorRate(),
    };
    
    // Analyze trends
    const trends = this.analyzeTrends(periodMetrics);
    
    // Get top assets
    const topAssets = this.getTopAssets(10);
    
    // Filter alerts for period
    const periodAlerts = this.alerts.filter(
      a => a.timestamp >= reportPeriod.start && a.timestamp <= reportPeriod.end
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, trends);
    
    return {
      reportId: `report-${Date.now()}`,
      period: reportPeriod,
      summary,
      trends,
      topAssets,
      alerts: periodAlerts,
      recommendations,
    };
  }

  /**
   * Get usage patterns
   */
  getPatterns(): Map<string, UsagePattern> {
    return new Map(this.patterns);
  }

  /**
   * Get current alerts
   */
  getAlerts(): UsageAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.metricsHistory = [];
    this.patterns.clear();
    this.alerts = [];
    this.sessionMetrics = {
      operations: {
        loads: 0,
        stores: 0,
        deletes: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
      },
      loadTimes: [],
      storeTimes: [],
      dataTransferred: 0,
      sessionStart: Date.now(),
    };
  }

  // Event handlers
  private handleLoad(data: any): void {
    this.recordLoad(data.path || data.assetId, data.duration, data.size, data.fromCache);
  }

  private handleStore(data: any): void {
    this.recordStore(data.path || data.assetId, data.duration, data.size);
  }

  private handleDelete(data: any): void {
    this.recordDelete(data.paths || data.path);
  }

  private handleCacheHit(data: any): void {
    if (!this.config.enabled) return;
    this.sessionMetrics.operations.cacheHits++;
  }

  private handleCacheMiss(data: any): void {
    if (!this.config.enabled) return;
    this.sessionMetrics.operations.cacheMisses++;
  }

  private handleError(data: any): void {
    this.recordError(data.operation || 'unknown', data.error);
  }

  // Utility methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index] || 0;
  }

  private calculateErrorRate(): number {
    const total = this.sessionMetrics.operations.loads + 
                 this.sessionMetrics.operations.stores + 
                 this.sessionMetrics.operations.deletes;
    
    if (total === 0) return 0;
    
    return this.sessionMetrics.operations.errors / total;
  }

  private calculateCacheHitRate(): number {
    const total = this.sessionMetrics.operations.cacheHits + 
                 this.sessionMetrics.operations.cacheMisses;
    
    if (total === 0) return 0;
    
    return this.sessionMetrics.operations.cacheHits / total;
  }

  private analyzeTrends(
    metrics: UsageMetrics[]
  ): UsageReport['trends'] {
    if (metrics.length < 2) {
      return {
        operations: 'stable',
        performance: 'stable',
        errors: 'stable',
      };
    }
    
    // Simple trend analysis - compare first and last halves
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);
    
    // Operations trend
    const firstOps = firstHalf.reduce((sum, m) => 
      sum + m.operations.loads + m.operations.stores, 0) / firstHalf.length;
    const secondOps = secondHalf.reduce((sum, m) => 
      sum + m.operations.loads + m.operations.stores, 0) / secondHalf.length;
    
    const opsTrend = secondOps > firstOps * 1.1 ? 'increasing' :
                     secondOps < firstOps * 0.9 ? 'decreasing' : 'stable';
    
    // Performance trend
    const firstPerf = firstHalf.reduce((sum, m) => 
      sum + m.performance.avgLoadTime, 0) / firstHalf.length;
    const secondPerf = secondHalf.reduce((sum, m) => 
      sum + m.performance.avgLoadTime, 0) / secondHalf.length;
    
    const perfTrend = secondPerf < firstPerf * 0.9 ? 'improving' :
                      secondPerf > firstPerf * 1.1 ? 'degrading' : 'stable';
    
    // Error trend
    const firstErrors = firstHalf.reduce((sum, m) => 
      sum + m.quality.errorRate, 0) / firstHalf.length;
    const secondErrors = secondHalf.reduce((sum, m) => 
      sum + m.quality.errorRate, 0) / secondHalf.length;
    
    const errorTrend = secondErrors > firstErrors * 1.1 ? 'increasing' :
                       secondErrors < firstErrors * 0.9 ? 'decreasing' : 'stable';
    
    return {
      operations: opsTrend,
      performance: perfTrend,
      errors: errorTrend,
    };
  }

  private getTopAssets(limit: number): UsageReport['topAssets'] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(pattern => ({
        assetId: pattern.assetId,
        accessCount: pattern.accessCount,
        avgLoadTime: 0, // Would need to track per-asset
      }));
  }

  private generateRecommendations(
    summary: UsageReport['summary'],
    trends: UsageReport['trends']
  ): string[] {
    const recommendations: string[] = [];
    
    if (summary.errorRate > 0.05) {
      recommendations.push('High error rate detected. Check storage service health and network connectivity.');
    }
    
    if (summary.averageCacheHitRate < 0.7) {
      recommendations.push('Low cache hit rate. Consider increasing cache size or implementing predictive preloading.');
    }
    
    if (summary.averageLatency > 500) {
      recommendations.push('High average latency. Consider using a CDN or optimizing asset sizes.');
    }
    
    if (trends.operations === 'increasing' && trends.performance === 'degrading') {
      recommendations.push('Increasing load with degrading performance. Consider scaling storage resources.');
    }
    
    if (trends.errors === 'increasing') {
      recommendations.push('Error rate is increasing. Review recent changes and monitor storage service status.');
    }
    
    return recommendations;
  }

  /**
   * Dispose analytics
   */
  dispose(): void {
    this.stopTracking();
    this.clear();
  }
}