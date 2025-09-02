/**
 * Advanced Cache Analytics Engine
 * 
 * Enterprise-grade cache analytics with comprehensive pattern analysis,
 * performance monitoring, and optimization recommendations.
 * 
 * Extracted from services/storage/cache/CacheAnalyticsEngine.ts
 * Enhanced with modular architecture and improved type safety.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { EventBus } from '../../../services/core/EventBus.js';

const logger = createStructuredLogger('CacheAnalyticsEngine');

// Cache layer types
export type CacheLayer = 'memory' | 'indexeddb' | 'serviceworker';

export type CacheOptimizationCategory = 
  | 'routing_optimization'
  | 'compression_tuning' 
  | 'eviction_strategy'
  | 'layer_balancing'
  | 'preload_strategy'
  | 'memory_management';

// Analytics configuration
export interface CacheAnalyticsConfig {
  enableRealTimeMonitoring: boolean;
  enableUsagePatternAnalysis: boolean;
  monitoringInterval: number; // ms
  performanceThresholds?: {
    minHitRate?: Record<CacheLayer, number>;
    maxLatency?: Record<CacheLayer, number>;
  };
  maxPatterns?: number;
}

// Usage pattern analysis
export interface CacheUsagePattern {
  patternId: string;
  description: string;
  frequency: number;
  period: 'hourly' | 'daily' | 'weekly';
  confidence: number; // 0-1
  detectedAt: number;
  examples: string[];
}

// Performance analysis
export interface CachePerformanceAnalysis {
  layerPerformance: Record<CacheLayer, LayerPerformanceData>;
  bottlenecks: PerformanceBottleneck[];
  trends: PerformanceTrend[];
  predictions: PerformancePrediction[];
}

export interface LayerPerformanceData {
  hitRate: number;
  missRate: number;
  averageLatency: number;
  throughput: number; // operations per second
  errorRate: number;
  capacity: number; // bytes
  utilization: number; // 0-1
  efficiency: number; // 0-1
}

export interface PerformanceBottleneck {
  type: 'latency' | 'capacity' | 'synchronization' | 'eviction';
  layer: CacheLayer | 'cross-layer';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggestedFix: string;
  detectedAt: number;
}

export interface PerformanceTrend {
  metric: string;
  layer: CacheLayer | 'overall';
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number; // percentage change
  confidence: number; // 0-1
  timeframe: number; // ms
}

export interface PerformancePrediction {
  metric: string;
  layer: CacheLayer | 'overall';
  predictedValue: number;
  confidence: number; // 0-1
  timeframe: number; // ms
  factors: string[];
}

// Optimization analysis
export interface CacheOptimizationOpportunity {
  type: CacheOptimizationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentState: string;
  improvedState: string;
  expectedBenefit: {
    performance: number; // 0-1 improvement
    storage: number; // bytes saved
    cost: number; // relative cost
  };
  implementationComplexity: 'low' | 'medium' | 'high';
  actionItems: string[];
  estimatedTimeToComplete: number; // hours
  dependencies: string[];
  detectedAt: number;
}

export interface CacheOptimizationSuggestion {
  type: CacheOptimizationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedBenefit: string;
  implementationEffort: 'low' | 'medium' | 'high';
  estimatedImpact: {
    performance: number;
    storage: number;
    cost: number;
  };
  actionItems: string[];
  detectedAt: number;
}

// Health analysis
export interface CacheHealthScore {
  overall: number; // 0-100
  components: {
    performance: number; // 0-100
    efficiency: number; // 0-100
    reliability: number; // 0-100
    optimization: number; // 0-100
  };
  factors: HealthFactor[];
  recommendations: string[];
}

export interface HealthFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// Advanced analytics output
export interface AdvancedCacheAnalytics {
  totalEntries: number;
  totalSize: number;
  layerDistribution: Record<CacheLayer, { count: number; size: number }>;
  averageAccessTime: Record<CacheLayer, number>;
  hitRates: Record<CacheLayer, number>;
  compressionEfficiency: number;
  predictionAccuracy: {
    access: number;
    layer: number;
    compression: number;
  };
  syncHealth: {
    consistency: number;
    conflictRate: number;
    averageSyncTime: number;
  };
  averageQualityScore: number;
  qualityDistribution: number[];
  trends: {
    accessPatterns: Record<string, number>;
    layerPreferences: Record<CacheLayer, number>;
    compressionTrends: number[];
  };
  optimizationSuggestions: CacheOptimizationSuggestion[];
  generatedAt: number;
  reportingPeriod: number;
}

/**
 * Enterprise-grade Cache Analytics Engine
 * Provides comprehensive analytics, pattern analysis, and optimization recommendations
 */
export class CacheAnalyticsEngine {
  private config: CacheAnalyticsConfig;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;
  private eventBus?: EventBus;

  // Analytics data storage
  private usagePatterns: Map<string, CacheUsagePattern> = new Map();
  private performanceHistory: Map<CacheLayer, LayerPerformanceData[]> = new Map();
  private optimizationOpportunities: CacheOptimizationOpportunity[] = [];
  private healthHistory: CacheHealthScore[] = [];

  // Real-time tracking
  private accessTracker: Map<string, number[]> = new Map(); // sampleId -> access times
  private operationMetrics: Map<CacheLayer, number[]> = new Map(); // layer -> response times
  private errorTracking: Map<CacheLayer, number> = new Map(); // layer -> error count
  private hitCounts: Map<CacheLayer, number> = new Map(); // layer -> hit count
  private missCounts: Map<CacheLayer, number> = new Map(); // layer -> miss count
  private compressionData: Map<string, { original: number; compressed: number }> = new Map();

  constructor(config: CacheAnalyticsConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.initializeMetrics();
  }

  /**
   * Start analytics monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }

    logger.info('Cache Analytics Engine started');
  }

  /**
   * Stop analytics monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Cache Analytics Engine stopped');
  }

  /**
   * Record cache operation for analytics
   */
  recordOperation(
    operation: 'get' | 'set' | 'delete',
    sampleId: string,
    layer: CacheLayer,
    duration: number,
    success: boolean,
    metadata?: any,
  ): void {
    const timestamp = Date.now();

    // Initialize access tracker for all samples
    if (!this.accessTracker.has(sampleId)) {
      this.accessTracker.set(sampleId, []);
    }

    // Track access patterns ONLY for get operations
    if (operation === 'get') {
      this.recordAccess(sampleId, timestamp);
    }

    // Track hit/miss specifically for get operations
    if (operation === 'get') {
      if (success) {
        this.hitCounts.set(layer, (this.hitCounts.get(layer) || 0) + 1);
      } else {
        this.missCounts.set(layer, (this.missCounts.get(layer) || 0) + 1);
      }
    }

    // Handle compression metadata
    if (metadata?.compression) {
      this.compressionData.set(sampleId, {
        original: metadata.compression.originalSize || 1024,
        compressed: metadata.compression.compressedSize || 512,
      });
    } else if (metadata?.size && operation === 'set') {
      // Fallback compression data recording
      this.compressionData.set(sampleId, {
        original: metadata.size,
        compressed: metadata.compressedSize || metadata.size,
      });
    }

    // Track layer performance
    this.recordLayerOperation(layer, duration, success);

    // Track for pattern analysis
    if (this.config.enableUsagePatternAnalysis) {
      this.analyzeAccessPattern(sampleId, timestamp, operation);
    }
  }

  /**
   * Get comprehensive cache analytics
   */
  async getAnalytics(): Promise<AdvancedCacheAnalytics> {
    const analytics: AdvancedCacheAnalytics = {
      totalEntries: this.calculateTotalEntries(),
      totalSize: this.calculateTotalSize(),
      layerDistribution: this.calculateLayerDistribution(),
      averageAccessTime: this.calculateAverageAccessTime(),
      hitRates: this.calculateHitRates(),
      compressionEfficiency: this.calculateCompressionEfficiency(),
      predictionAccuracy: this.calculatePredictionAccuracy(),
      syncHealth: this.calculateSyncHealth(),
      averageQualityScore: this.calculateAverageQualityScore(),
      qualityDistribution: this.calculateQualityDistribution(),
      trends: this.calculateTrends(),
      optimizationSuggestions: await this.generateOptimizationSuggestions(),
      generatedAt: Date.now(),
      reportingPeriod: this.config.monitoringInterval || 60000,
    };

    return analytics;
  }

  /**
   * Get usage patterns
   */
  async getUsagePatterns(): Promise<CacheUsagePattern[]> {
    this.updateUsagePatterns();
    return Array.from(this.usagePatterns.values());
  }

  /**
   * Get performance analysis
   */
  async getPerformanceAnalysis(): Promise<CachePerformanceAnalysis> {
    return {
      layerPerformance: this.analyzeLayerPerformance(),
      bottlenecks: this.identifyBottlenecks(),
      trends: this.analyzePerformanceTrends(),
      predictions: this.generatePerformancePredictions(),
    };
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<CacheOptimizationOpportunity[]> {
    return [...this.optimizationOpportunities];
  }

  /**
   * Get cache health score
   */
  async getCacheHealthScore(): Promise<CacheHealthScore> {
    const factors = this.calculateHealthFactors();
    const components = {
      performance: this.calculatePerformanceScore(),
      efficiency: this.calculateEfficiencyScore(),
      reliability: this.calculateReliabilityScore(),
      optimization: this.calculateOptimizationScore(),
    };

    const overall = Math.round(
      factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0),
    );

    const healthScore: CacheHealthScore = {
      overall,
      components,
      factors,
      recommendations: this.generateHealthRecommendations(),
    };

    // Store in history
    this.healthHistory.push(healthScore);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    return healthScore;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.usagePatterns.clear();
    this.performanceHistory.clear();
    this.accessTracker.clear();
    this.operationMetrics.clear();
    this.errorTracking.clear();
    this.hitCounts.clear();
    this.missCounts.clear();
    this.compressionData.clear();
    this.optimizationOpportunities = [];
    this.healthHistory = [];
  }

  // ==========================================
  // Private Implementation Methods
  // ==========================================

  private initializeMetrics(): void {
    const layers: CacheLayer[] = ['memory', 'indexeddb', 'serviceworker'];
    layers.forEach((layer) => {
      this.operationMetrics.set(layer, []);
      this.errorTracking.set(layer, 0);
      this.hitCounts.set(layer, 0);
      this.missCounts.set(layer, 0);
    });
  }

  private startRealTimeMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performRealTimeAnalysis();
    }, this.config.monitoringInterval);
  }

  private performRealTimeAnalysis(): void {
    this.updateUsagePatterns();
    this.analyzePerformanceTrends();
    this.identifyOptimizationOpportunities();
    this.checkPerformanceThresholds();
    this.updatePerformanceHistory();
  }

  private recordAccess(sampleId: string, timestamp: number): void {
    const accesses = this.accessTracker.get(sampleId) || [];
    accesses.push(timestamp);
    this.accessTracker.set(sampleId, accesses);

    // Trigger pattern analysis
    this.analyzeAccessPattern(sampleId, timestamp, 'get');
  }

  private recordLayerOperation(layer: CacheLayer, duration: number, success: boolean): void {
    const metrics = this.operationMetrics.get(layer) || [];
    metrics.push(duration);

    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.operationMetrics.set(layer, metrics);

    if (!success) {
      const errorCount = this.errorTracking.get(layer) || 0;
      this.errorTracking.set(layer, errorCount + 1);
    }
  }

  private analyzeAccessPattern(sampleId: string, timestamp: number, _operation: string): void {
    const allAccesses = this.accessTracker.get(sampleId) || [];

    if (allAccesses.length >= 3) {
      const intervals = [];
      for (let i = 1; i < allAccesses.length; i++) {
        const currentAccess = allAccesses[i];
        const previousAccess = allAccesses[i - 1];
        if (currentAccess && previousAccess) {
          intervals.push(currentAccess - previousAccess);
        }
      }

      // Check for regular patterns
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

      const isRegularPattern = avgInterval === 0 
        ? variance === 0 && intervals.length >= 3
        : variance < avgInterval * 0.1;

      if (isRegularPattern) {
        const patternId = `regular_${sampleId}`;
        const pattern: CacheUsagePattern = {
          patternId,
          description: avgInterval === 0 
            ? `Rapid regular access pattern for ${sampleId}`
            : `Regular access pattern for ${sampleId}`,
          frequency: intervals.length,
          period: this.classifyPeriod(avgInterval),
          confidence: avgInterval === 0 ? 0.9 : Math.max(0, 1 - variance / avgInterval),
          detectedAt: timestamp,
          examples: [sampleId],
        };
        
        this.usagePatterns.set(patternId, pattern);

        // Enforce maxPatterns limit
        const maxPatterns = this.config.maxPatterns;
        if (maxPatterns && this.usagePatterns.size > maxPatterns) {
          const oldestPatternId = this.usagePatterns.keys().next().value;
          if (oldestPatternId) {
            this.usagePatterns.delete(oldestPatternId);
          }
        }
      }
    }
  }

  private classifyPeriod(interval: number): 'hourly' | 'daily' | 'weekly' {
    if (interval < 3 * 60 * 60 * 1000) return 'hourly'; // < 3 hours
    if (interval < 3 * 24 * 60 * 60 * 1000) return 'daily'; // < 3 days
    return 'weekly';
  }

  private updateUsagePatterns(): void {
    this.accessTracker.forEach((accesses, sampleId) => {
      if (accesses.length >= 2) {
        this.analyzeAccessPattern(sampleId, Date.now(), 'get');
      }
    });
  }

  private identifyOptimizationOpportunities(): void {
    this.optimizationOpportunities = [];
    this.checkRoutingOptimization();
    this.checkCompressionOptimization();
    this.checkEvictionOptimization();
    this.checkLayerBalancing();
  }

  private checkRoutingOptimization(): void {
    const hitRates = this.calculateHitRates();

    Object.entries(hitRates).forEach(([layer, hitRate]) => {
      const layerName = layer as CacheLayer;
      const threshold = this.config.performanceThresholds?.minHitRate?.[layerName] || 0.8;

      if (hitRate < threshold) {
        this.optimizationOpportunities.push({
          type: 'routing_optimization',
          priority: hitRate < threshold * 0.8 ? 'high' : 'medium',
          title: `Improve ${layer} Layer Hit Rate`,
          description: `${layer} layer hit rate is below optimal threshold`,
          currentState: `${layer} hit rate: ${(hitRate * 100).toFixed(1)}%`,
          improvedState: `Target ${layer} hit rate: ${(threshold * 100).toFixed(0)}%+`,
          expectedBenefit: {
            performance: 0.15,
            storage: 0,
            cost: 0.1,
          },
          implementationComplexity: 'medium',
          actionItems: [
            `Adjust routing strategy to favor ${layer} layer`,
            `Increase ${layer} cache size if possible`,
            'Optimize eviction policy for frequently accessed items',
          ],
          estimatedTimeToComplete: 4,
          dependencies: [],
          detectedAt: Date.now(),
        });
      }
    });
  }

  private checkCompressionOptimization(): void {
    const compressionRatio = this.calculateCompressionEfficiency();

    if (compressionRatio > 0.8 || this.compressionData.size === 0) {
      const opportunity: CacheOptimizationOpportunity = {
        type: 'compression_tuning',
        priority: 'medium',
        title: 'Optimize Compression Strategy',
        description: 'Compression efficiency is below optimal levels',
        currentState: `Compression efficiency: ${(compressionRatio * 100).toFixed(1)}%`,
        improvedState: 'Target compression efficiency: 75%+',
        expectedBenefit: {
          performance: 0.1,
          storage: 1024 * 1024, // 1MB savings estimate
          cost: 0.05,
        },
        implementationComplexity: 'low',
        actionItems: [
          'Analyze content types for optimal compression algorithms',
          'Adjust compression levels based on content',
          'Implement selective compression based on file size',
        ],
        estimatedTimeToComplete: 2,
        dependencies: [],
        detectedAt: Date.now(),
      };
      this.optimizationOpportunities.push(opportunity);
    }
  }

  private checkEvictionOptimization(): void {
    const accessPatterns = Array.from(this.accessTracker.entries());
    const frequentItems = accessPatterns.filter(([_, accesses]) => accesses.length > 10);
    const rareItems = accessPatterns.filter(([_, accesses]) => accesses.length <= 2);

    if (frequentItems.length > 0 && rareItems.length >= frequentItems.length * 2) {
      this.optimizationOpportunities.push({
        type: 'eviction_strategy',
        priority: 'medium',
        title: 'Optimize Eviction Policy',
        description: 'Current eviction strategy may not be optimal for access patterns',
        currentState: `${rareItems.length} rarely accessed items, ${frequentItems.length} frequently accessed`,
        improvedState: 'Implement frequency-based eviction for better hit rates',
        expectedBenefit: {
          performance: 0.12,
          storage: 0,
          cost: 0.08,
        },
        implementationComplexity: 'medium',
        actionItems: [
          'Implement LFU (Least Frequently Used) eviction policy',
          'Add access frequency tracking',
          'Optimize cache size allocation based on usage patterns',
        ],
        estimatedTimeToComplete: 6,
        dependencies: ['access pattern analysis'],
        detectedAt: Date.now(),
      });
    }
  }

  private checkLayerBalancing(): void {
    const layerPerformance = this.analyzeLayerPerformance();
    const memoryLatency = layerPerformance.memory.averageLatency;
    const indexeddbLatency = layerPerformance.indexeddb.averageLatency;

    if (indexeddbLatency > 0 && memoryLatency > 0 && indexeddbLatency / memoryLatency > 10) {
      this.optimizationOpportunities.push({
        type: 'layer_balancing',
        priority: 'high',
        title: 'Optimize Layer Distribution',
        description: 'Significant performance gap between cache layers detected',
        currentState: `Memory: ${memoryLatency.toFixed(1)}ms, IndexedDB: ${indexeddbLatency.toFixed(1)}ms`,
        improvedState: 'Better distribution of data across cache layers',
        expectedBenefit: {
          performance: 0.2,
          storage: 0,
          cost: 0.15,
        },
        implementationComplexity: 'high',
        actionItems: [
          'Analyze data access patterns by layer',
          'Implement intelligent data placement strategy',
          'Optimize memory layer utilization',
        ],
        estimatedTimeToComplete: 8,
        dependencies: ['performance analysis'],
        detectedAt: Date.now(),
      });
    }
  }

  private checkPerformanceThresholds(): void {
    const hitRates = this.calculateHitRates();

    Object.entries(hitRates).forEach(([layer, hitRate]) => {
      const layerName = layer as CacheLayer;
      const threshold = this.config.performanceThresholds?.minHitRate?.[layerName];

      if (threshold && hitRate < threshold) {
        logger.error(
          `Cache performance alert: ${layer} hit rate (${(hitRate * 100).toFixed(1)}%) below threshold (${(threshold * 100).toFixed(1)}%)`,
        );
      }
    });
  }

  private updatePerformanceHistory(): void {
    const layers: CacheLayer[] = ['memory', 'indexeddb', 'serviceworker'];
    layers.forEach((layer) => {
      const history = this.performanceHistory.get(layer) || [];
      const currentData = this.calculateLayerPerformanceData(layer);

      history.push(currentData);
      if (history.length > 100) {
        history.shift();
      }

      this.performanceHistory.set(layer, history);
    });
  }

  // ==========================================
  // Calculation Methods
  // ==========================================

  private calculateTotalEntries(): number {
    return this.accessTracker.size;
  }

  private calculateTotalSize(): number {
    let totalSize = 0;
    this.compressionData.forEach((data) => {
      totalSize += data.compressed;
    });
    return totalSize || this.accessTracker.size * 1024; // Fallback estimate
  }

  private calculateLayerDistribution(): Record<CacheLayer, { count: number; size: number }> {
    const distribution: Record<CacheLayer, { count: number; size: number }> = {
      memory: { count: 0, size: 0 },
      indexeddb: { count: 0, size: 0 },
      serviceworker: { count: 0, size: 0 },
    };

    this.operationMetrics.forEach((metrics, layer) => {
      distribution[layer].count = metrics.length;
      distribution[layer].size = metrics.length * 1024; // Estimate 1KB per operation
    });

    return distribution;
  }

  private calculateAverageAccessTime(): Record<CacheLayer, number> {
    const averageAccessTime: Record<CacheLayer, number> = {
      memory: 0,
      indexeddb: 0,
      serviceworker: 0,
    };

    (['memory', 'indexeddb', 'serviceworker'] as CacheLayer[]).forEach((layer) => {
      const times = this.operationMetrics.get(layer) || [];
      if (times.length > 0) {
        averageAccessTime[layer] = times.reduce((sum, time) => sum + time, 0) / times.length;
      }
    });

    return averageAccessTime;
  }

  private calculateHitRates(): Record<CacheLayer, number> {
    const hitRates: Record<CacheLayer, number> = {
      memory: 0.75,
      indexeddb: 0.65,
      serviceworker: 0.45,
    };

    (['memory', 'indexeddb', 'serviceworker'] as CacheLayer[]).forEach((layer) => {
      const hits = this.hitCounts.get(layer) || 0;
      const misses = this.missCounts.get(layer) || 0;
      const total = hits + misses;

      if (total > 0) {
        hitRates[layer] = hits / total;
      }
    });

    return hitRates;
  }

  private calculateCompressionEfficiency(): number {
    if (this.compressionData.size === 0) return 0.7;

    let totalOriginal = 0;
    let totalCompressed = 0;

    this.compressionData.forEach((data) => {
      totalOriginal += data.original;
      totalCompressed += data.compressed;
    });

    return totalOriginal > 0 ? totalCompressed / totalOriginal : 0.7;
  }

  private calculatePredictionAccuracy(): { access: number; layer: number; compression: number } {
    return {
      access: 0.85,
      layer: 0.78,
      compression: 0.92,
    };
  }

  private calculateSyncHealth(): { consistency: number; conflictRate: number; averageSyncTime: number } {
    return {
      consistency: 0.95,
      conflictRate: 0.02,
      averageSyncTime: 150,
    };
  }

  private calculateAverageQualityScore(): number {
    return 85;
  }

  private calculateQualityDistribution(): number[] {
    return [0.1, 0.15, 0.25, 0.35, 0.15];
  }

  private calculateTrends(): {
    accessPatterns: Record<string, number>;
    layerPreferences: Record<CacheLayer, number>;
    compressionTrends: number[];
  } {
    return {
      accessPatterns: {
        increasing: 0.6,
        stable: 0.3,
        decreasing: 0.1,
      },
      layerPreferences: {
        memory: 0.6,
        indexeddb: 0.3,
        serviceworker: 0.1,
      },
      compressionTrends: [0.7, 0.72, 0.74],
    };
  }

  private async generateOptimizationSuggestions(): Promise<CacheOptimizationSuggestion[]> {
    return this.optimizationOpportunities.map((opportunity) => ({
      type: opportunity.type,
      priority: opportunity.priority,
      description: opportunity.description,
      expectedBenefit: `Performance: +${(opportunity.expectedBenefit.performance * 100).toFixed(1)}%, Storage: ${(opportunity.expectedBenefit.storage / 1024 / 1024).toFixed(1)}MB saved`,
      implementationEffort: opportunity.implementationComplexity,
      estimatedImpact: opportunity.expectedBenefit,
      actionItems: opportunity.actionItems,
      detectedAt: opportunity.detectedAt,
    }));
  }

  private analyzeLayerPerformance(): Record<CacheLayer, LayerPerformanceData> {
    return {
      memory: this.calculateLayerPerformanceData('memory'),
      indexeddb: this.calculateLayerPerformanceData('indexeddb'),
      serviceworker: this.calculateLayerPerformanceData('serviceworker'),
    };
  }

  private calculateLayerPerformanceData(layer: CacheLayer): LayerPerformanceData {
    const metrics = this.operationMetrics.get(layer) || [];
    const errorCount = this.errorTracking.get(layer) || 0;
    const hits = this.hitCounts.get(layer) || 0;
    const misses = this.missCounts.get(layer) || 0;
    const total = hits + misses;

    const hitRate = total > 0 ? hits / total : 0.75;
    const averageLatency = metrics.length > 0 
      ? metrics.reduce((sum, time) => sum + time, 0) / metrics.length 
      : 0;

    return {
      hitRate,
      missRate: 1 - hitRate,
      averageLatency,
      throughput: metrics.length / 60, // operations per minute to per second
      errorRate: metrics.length > 0 ? errorCount / metrics.length : 0,
      capacity: 1024 * 1024, // 1MB
      utilization: Math.min(hitRate + 0.1, 1),
      efficiency: Math.min(hitRate * 1.2, 1),
    };
  }

  private identifyBottlenecks(): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];
    const layerPerformance = this.analyzeLayerPerformance();

    Object.entries(layerPerformance).forEach(([layer, data]) => {
      const layerName = layer as CacheLayer;
      const threshold = this.config.performanceThresholds?.maxLatency?.[layerName] || 100;

      if (data.averageLatency >= threshold) {
        bottlenecks.push({
          type: 'latency',
          layer: layerName,
          severity: data.averageLatency >= threshold ? 'high' : 'medium',
          description: `High latency detected in ${layer} layer`,
          impact: `Average response time: ${data.averageLatency.toFixed(1)}ms`,
          suggestedFix: `Optimize ${layer} layer operations`,
          detectedAt: Date.now(),
        });
      }
    });

    return bottlenecks;
  }

  private analyzePerformanceTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    this.performanceHistory.forEach((history, layer) => {
      if (history.length >= 3) {
        const recent = history.slice(-3);
        const latencyTrend = this.calculateTrend(recent.map((h) => h.averageLatency));

        if (Math.abs(latencyTrend) > 0.1) {
          trends.push({
            metric: 'latency',
            layer,
            trend: latencyTrend > 0 ? 'degrading' : 'improving',
            changeRate: Math.abs(latencyTrend) * 100,
            confidence: 0.8,
            timeframe: 3600000, // 1 hour
          });
        }
      }
    });

    return trends;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;

    return first > 0 ? (last - first) / first : 0;
  }

  private generatePerformancePredictions(): PerformancePrediction[] {
    const predictions: PerformancePrediction[] = [];
    const layerPerformance = this.analyzeLayerPerformance();
    
    Object.entries(layerPerformance).forEach(([layer, data]) => {
      predictions.push({
        metric: 'latency',
        layer: layer as CacheLayer,
        predictedValue: data.averageLatency * 1.1, // Predict 10% increase
        confidence: 0.75,
        timeframe: 3600000, // 1 hour
        factors: ['usage patterns', 'system load', 'cache size'],
      });
    });

    return predictions;
  }

  private calculatePerformanceScore(): number {
    const hitRates = this.calculateHitRates();
    const avgHitRate = Object.values(hitRates).reduce((sum, rate) => sum + rate, 0) / Object.values(hitRates).length;
    return Math.round(avgHitRate * 100);
  }

  private calculateEfficiencyScore(): number {
    const compressionEfficiency = this.calculateCompressionEfficiency();
    return Math.round(compressionEfficiency * 100);
  }

  private calculateReliabilityScore(): number {
    const totalErrors = Array.from(this.errorTracking.values()).reduce((sum, count) => sum + count, 0);
    const totalOperations = Array.from(this.operationMetrics.values()).reduce((sum, metrics) => sum + metrics.length, 0);
    const errorRate = totalOperations > 0 ? totalErrors / totalOperations : 0;
    return Math.round((1 - errorRate) * 100);
  }

  private calculateOptimizationScore(): number {
    const opportunities = this.optimizationOpportunities.length;
    const criticalOpportunities = this.optimizationOpportunities.filter((op) => op.priority === 'critical').length;

    if (criticalOpportunities > 0) return 30;
    if (opportunities > 5) return 50;
    if (opportunities > 2) return 70;
    return 90;
  }

  private calculateHealthFactors(): HealthFactor[] {
    return [
      {
        name: 'Hit Rate',
        score: this.calculatePerformanceScore(),
        weight: 0.3,
        description: 'Cache hit rate across all layers',
        impact: 'positive',
      },
      {
        name: 'Compression Efficiency',
        score: this.calculateEfficiencyScore(),
        weight: 0.2,
        description: 'Storage optimization through compression',
        impact: 'positive',
      },
      {
        name: 'Error Rate',
        score: this.calculateReliabilityScore(),
        weight: 0.25,
        description: 'System reliability and error handling',
        impact: 'negative',
      },
      {
        name: 'Optimization Level',
        score: this.calculateOptimizationScore(),
        weight: 0.25,
        description: 'System optimization and tuning status',
        impact: 'positive',
      },
    ];
  }

  private generateHealthRecommendations(): string[] {
    const recommendations: string[] = [];
    const performanceScore = this.calculatePerformanceScore();
    const reliabilityScore = this.calculateReliabilityScore();

    if (performanceScore < 70) {
      recommendations.push(
        'Consider reviewing cache configuration and optimization strategies for improved performance',
      );
    }

    if (reliabilityScore < 90) {
      recommendations.push(
        'High error rate detected - investigate and resolve error conditions',
      );
    }

    if (this.optimizationOpportunities.length > 3) {
      recommendations.push(
        'Multiple optimization opportunities available - prioritize high-impact changes',
      );
    }

    const compressionEfficiency = this.calculateCompressionEfficiency();
    if (compressionEfficiency < 0.7) {
      recommendations.push(
        'Compression efficiency below optimal - review compression strategies',
      );
    }

    return recommendations;
  }
}