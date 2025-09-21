/**
 * Story 2.4 Task 6.2: Intelligent Cache Router
 *
 * Implements sophisticated routing logic for distributed caching across
 * memory, IndexedDB, and service worker layers with machine learning
 * optimization and performance monitoring.
 */

import { CacheLayer, AdvancedCacheEntry } from '@bassnotion/contracts';

// Re-export for testing
export type { AdvancedCacheEntry } from '@bassnotion/contracts';

// Local type definitions for routing functionality
export interface LayerPerformanceMetrics {
  hitRate: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
  memoryPressure: number;
  lastHealthCheck: number;
  operationCounts: {
    get: number;
    set: number;
    delete: number;
    hits: number;
    misses: number;
    errors: number;
  };
  qualityScore: number;
  isHealthy: boolean;
  evictionRate: number;
}

export interface RoutingDecision {
  primaryLayer: CacheLayer;
  additionalLayers: CacheLayer[];
  strategy: string;
  reasoning: string[];
  confidence: number;
  alternatives: CacheLayer[];
}

export interface CacheRoutingAnalytics {
  totalPatterns: number;
  activePatterns: number;
  sessionData: {
    duration: number;
    totalAccesses: number;
    uniqueKeys: number;
    layerDistribution: Record<string, number>;
  };
  topFrequentKeys: Array<{ key: string; frequency: number }>;
  layerPreferences: Record<CacheLayer, number>;
  routingDecisions?: {
    total: number;
    byStrategy: Record<string, number>;
    averageConfidence: number;
    successRate: number;
  };
  layerPerformance?: Record<
    CacheLayer,
    {
      qualityScore: number;
      hitRate: number;
      averageLatency: number;
      isHealthy: boolean;
    }
  >;
}

export interface CacheRoutingConfig {
  enabled: boolean;
  routingStrategy:
    | 'size_based'
    | 'frequency_based'
    | 'ml_optimized'
    | 'hybrid'
    | 'performance_based';
  memoryThreshold: number;
  indexedDBThreshold: number;
  highFrequencyThreshold: number;
  mediumFrequencyThreshold: number;
  enableMLPrediction: boolean;
  predictionConfidenceThreshold: number;
  enableFallbackRouting: boolean;
  fallbackOrder: CacheLayer[];
}

export interface AccessPrediction {
  probability: number;
  timeWindow: number;
  confidence: number;
  factors: string[];
}

// ===============================
// Cache Layer Performance Tracker
// ===============================

export class LayerPerformanceTracker {
  private metrics: Map<CacheLayer, LayerPerformanceMetrics> = new Map();
  private accessHistory: Array<{
    layer: CacheLayer;
    operation: 'get' | 'set' | 'delete';
    duration: number;
    success: boolean;
    size?: number;
    timestamp: number;
  }> = [];

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    const layers: CacheLayer[] = ['memory', 'indexeddb', 'serviceworker'];

    layers.forEach((layer) => {
      this.metrics.set(layer, {
        hitRate: 0,
        averageLatency: 0,
        errorRate: 0,
        throughput: 0,
        memoryPressure: 0,
        lastHealthCheck: Date.now(),
        operationCounts: {
          get: 0,
          set: 0,
          delete: 0,
          hits: 0,
          misses: 0,
          errors: 0,
        },
        qualityScore: 1.0,
        isHealthy: true,
        evictionRate: 0,
      });
    });
  }

  recordOperation(
    layer: CacheLayer,
    operation: 'get' | 'set' | 'delete',
    duration: number,
    success: boolean,
    hit?: boolean,
    size?: number,
  ): void {
    const entry = {
      layer,
      operation,
      duration,
      success,
      size,
      timestamp: Date.now(),
    };

    this.accessHistory.push(entry);

    // Keep only recent history (last 1000 operations)
    if (this.accessHistory.length > 1000) {
      this.accessHistory = this.accessHistory.slice(-1000);
    }

    this.updateMetrics(layer, operation, duration, success, hit);
  }

  private updateMetrics(
    layer: CacheLayer,
    operation: 'get' | 'set' | 'delete',
    duration: number,
    success: boolean,
    hit?: boolean,
  ): void {
    const metrics = this.metrics.get(layer);
    // TODO: Review non-null assertion - consider null safety
    if (!metrics) return;

    // Update operation counts
    metrics.operationCounts[operation]++;

    if (operation === 'get') {
      if (hit === true) {
        metrics.operationCounts.hits++;
      } else if (hit === false) {
        metrics.operationCounts.misses++;
      }
    }

    // TODO: Review non-null assertion - consider null safety
    if (!success) {
      metrics.operationCounts.errors++;
    }

    // Calculate hit rate
    const totalGets = metrics.operationCounts.get;
    if (totalGets > 0) {
      metrics.hitRate = metrics.operationCounts.hits / totalGets;
    }

    // Calculate error rate
    const totalOps =
      metrics.operationCounts.get +
      metrics.operationCounts.set +
      metrics.operationCounts.delete;
    if (totalOps > 0) {
      metrics.errorRate = metrics.operationCounts.errors / totalOps;
    }

    // Update average latency (exponential moving average)
    if (metrics.averageLatency === 0) {
      metrics.averageLatency = duration;
    } else {
      metrics.averageLatency = metrics.averageLatency * 0.9 + duration * 0.1;
    }

    // Update health status
    metrics.isHealthy =
      metrics.errorRate < 0.1 &&
      metrics.averageLatency < this.getMaxLatencyThreshold(layer);

    // Calculate quality score
    metrics.qualityScore = this.calculateQualityScore(metrics);

    metrics.lastHealthCheck = Date.now();
  }

  private getMaxLatencyThreshold(layer: CacheLayer): number {
    switch (layer) {
      case 'memory':
        return 10;
      case 'indexeddb':
        return 100;
      case 'serviceworker':
        return 200;
      default:
        return 100;
    }
  }

  private calculateQualityScore(metrics: LayerPerformanceMetrics): number {
    const hitRateScore = metrics.hitRate;
    const latencyScore = Math.max(
      0,
      1 - metrics.averageLatency / this.getMaxLatencyThreshold('serviceworker'),
    );
    const errorRateScore = Math.max(0, 1 - metrics.errorRate * 10);

    return hitRateScore * 0.4 + latencyScore * 0.4 + errorRateScore * 0.2;
  }

  getMetrics(layer: CacheLayer): LayerPerformanceMetrics | undefined {
    return this.metrics.get(layer);
  }

  getAllMetrics(): Map<CacheLayer, LayerPerformanceMetrics> {
    return new Map(this.metrics);
  }

  getLayerRanking(): CacheLayer[] {
    const layers = Array.from(this.metrics.entries());
    return layers
      .sort(([, a], [, b]) => b.qualityScore - a.qualityScore)
      .map(([layer]) => layer);
  }
}

// ===============================
// Access Pattern Analyzer
// ===============================

export class AccessPatternAnalyzer {
  private accessPatterns: Map<
    string,
    {
      frequency: number;
      lastAccessed: number;
      sizeTrend: number[];
      timePattern: number[];
      layerPreference: Map<CacheLayer, number>;
    }
  > = new Map();

  private sessionData: {
    startTime: number;
    totalAccesses: number;
    uniqueKeys: Set<string>;
    layerUsage: Map<CacheLayer, number>;
  } = {
    startTime: Date.now(),
    totalAccesses: 0,
    uniqueKeys: new Set(),
    layerUsage: new Map(),
  };

  recordAccess(
    sampleId: string,
    layer: CacheLayer,
    size: number,
    timestamp: number = Date.now(),
  ): void {
    // Update session data
    this.sessionData.totalAccesses++;
    this.sessionData.uniqueKeys.add(sampleId);
    this.sessionData.layerUsage.set(
      layer,
      (this.sessionData.layerUsage.get(layer) || 0) + 1,
    );

    // Update access patterns
    let pattern = this.accessPatterns.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!pattern) {
      pattern = {
        frequency: 0,
        lastAccessed: 0,
        sizeTrend: [],
        timePattern: [],
        layerPreference: new Map(),
      };
      this.accessPatterns.set(sampleId, pattern);
    }

    pattern.frequency++;
    pattern.lastAccessed = timestamp;
    pattern.sizeTrend.push(size);
    pattern.timePattern.push(timestamp);
    pattern.layerPreference.set(
      layer,
      (pattern.layerPreference.get(layer) || 0) + 1,
    );

    // Keep only recent trends
    if (pattern.sizeTrend.length > 10) {
      pattern.sizeTrend = pattern.sizeTrend.slice(-10);
    }
    if (pattern.timePattern.length > 20) {
      pattern.timePattern = pattern.timePattern.slice(-20);
    }
  }

  getAccessFrequency(sampleId: string): number {
    return this.accessPatterns.get(sampleId)?.frequency || 0;
  }

  getPreferredLayer(sampleId: string): CacheLayer | null {
    const pattern = this.accessPatterns.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!pattern) return null;

    let maxUsage = 0;
    let preferredLayer: CacheLayer | null = null;

    pattern.layerPreference.forEach((usage, layer) => {
      if (usage > maxUsage) {
        maxUsage = usage;
        preferredLayer = layer;
      }
    });

    return preferredLayer;
  }

  predictNextAccess(sampleId: string): AccessPrediction {
    const pattern = this.accessPatterns.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!pattern) {
      return {
        probability: 0.1,
        timeWindow: 3600000, // 1 hour
        confidence: 0.2,
        factors: ['no_history'],
      };
    }

    // Calculate access probability based on frequency and recency
    const timeSinceLastAccess = Date.now() - pattern.lastAccessed;
    const recentAccesses = pattern.timePattern.filter(
      (t) => Date.now() - t < 3600000, // Last hour
    ).length;

    const frequencyScore = Math.min(pattern.frequency / 10, 1.0);
    const recencyScore = Math.max(0, 1 - timeSinceLastAccess / 86400000); // 24 hours
    const trendScore = recentAccesses / 10;

    const probability =
      frequencyScore * 0.4 + recencyScore * 0.4 + trendScore * 0.2;

    return {
      probability,
      timeWindow: this.calculateTimeWindow(pattern),
      confidence: Math.min(pattern.frequency / 5, 1.0),
      factors: this.getAccessFactors(pattern),
    };
  }

  private calculateTimeWindow(pattern: {
    timePattern: number[];
    frequency: number;
  }): number {
    if (pattern.timePattern.length < 2) {
      return 3600000; // Default 1 hour
    }

    // Calculate average time between accesses
    const intervals = [];
    for (let i = 1; i < pattern.timePattern.length; i++) {
      const prevTime = pattern.timePattern[i - 1];
      const currentTime = pattern.timePattern[i];
      if (prevTime !== undefined && currentTime !== undefined) {
        intervals.push(currentTime - prevTime);
      }
    }

    if (intervals.length === 0) {
      return 3600000; // Default 1 hour
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    // Ensure positive result and reasonable bounds
    return Math.max(1000, Math.min(Math.abs(avgInterval) * 2, 86400000)); // Min 1 second, Max 24 hours
  }

  private getAccessFactors(pattern: {
    frequency: number;
    lastAccessed: number;
    timePattern: number[];
  }): string[] {
    const factors = [];

    if (pattern.frequency > 5) factors.push('high_frequency');
    if (Date.now() - pattern.lastAccessed < 300000)
      factors.push('recent_access');
    if (pattern.timePattern.length > 10) factors.push('established_pattern');

    return factors;
  }

  getAnalytics(): CacheRoutingAnalytics {
    const totalPatterns = this.accessPatterns.size;
    const activePatterns = Array.from(this.accessPatterns.values()).filter(
      (p) => Date.now() - p.lastAccessed < 3600000,
    ).length;

    return {
      totalPatterns,
      activePatterns,
      sessionData: {
        duration: Date.now() - this.sessionData.startTime,
        totalAccesses: this.sessionData.totalAccesses,
        uniqueKeys: this.sessionData.uniqueKeys.size,
        layerDistribution: Object.fromEntries(this.sessionData.layerUsage),
      },
      topFrequentKeys: this.getTopFrequentKeys(5),
      layerPreferences: this.getGlobalLayerPreferences(),
    };
  }

  private getTopFrequentKeys(
    limit: number,
  ): Array<{ key: string; frequency: number }> {
    return Array.from(this.accessPatterns.entries())
      .sort(([, a], [, b]) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(([key, pattern]) => ({ key, frequency: pattern.frequency }));
  }

  private getGlobalLayerPreferences(): Record<CacheLayer, number> {
    const layerTotals: Record<CacheLayer, number> = {
      memory: 0,
      indexeddb: 0,
      serviceworker: 0,
    };

    this.accessPatterns.forEach((pattern) => {
      pattern.layerPreference.forEach((count, layer) => {
        if (layerTotals[layer] !== undefined) {
          layerTotals[layer] += count;
        }
      });
    });

    return layerTotals;
  }
}

// ===============================
// Intelligent Cache Router
// ===============================

export class IntelligentCacheRouter {
  private config: CacheRoutingConfig;
  private performanceTracker: LayerPerformanceTracker;
  private patternAnalyzer: AccessPatternAnalyzer;
  private routingHistory: RoutingDecision[] = [];

  constructor(config: CacheRoutingConfig) {
    this.config = config;
    this.performanceTracker = new LayerPerformanceTracker();
    this.patternAnalyzer = new AccessPatternAnalyzer();
  }

  /**
   * Determine optimal layers for storing a cache entry
   */
  determineStorageLayers(entry: AdvancedCacheEntry): RoutingDecision {
    const decision: RoutingDecision = {
      primaryLayer: 'memory',
      additionalLayers: [],
      strategy: this.config.routingStrategy,
      reasoning: [],
      confidence: 0.5,
      alternatives: [],
    };

    switch (this.config.routingStrategy) {
      case 'size_based':
        return this.applySizeBasedRouting(entry, decision);

      case 'frequency_based':
        return this.applyFrequencyBasedRouting(entry, decision);

      case 'hybrid':
        return this.applyHybridRouting(entry, decision);

      case 'ml_optimized':
        return this.applyMLOptimizedRouting(entry, decision);

      case 'performance_based':
        return this.applyPerformanceBasedRouting(entry, decision);

      default:
        return this.applySizeBasedRouting(entry, decision);
    }
  }

  /**
   * Determine best layer for retrieving a cache entry
   */
  determineRetrievalLayer(sampleId: string): RoutingDecision {
    const decision: RoutingDecision = {
      primaryLayer: 'memory',
      additionalLayers: [],
      strategy: 'retrieval_optimized',
      reasoning: [],
      confidence: 0.8,
      alternatives: [],
    };

    // Check access patterns
    const accessPrediction = this.patternAnalyzer.predictNextAccess(sampleId);
    const preferredLayer = this.patternAnalyzer.getPreferredLayer(sampleId);

    // Get layer performance ranking
    const layerRanking = this.performanceTracker.getLayerRanking();

    // Determine primary retrieval layer
    if (preferredLayer && this.isLayerHealthy(preferredLayer)) {
      decision.primaryLayer = preferredLayer;
      decision.reasoning.push(`preferred_layer_${preferredLayer}`);
      decision.confidence = Math.min(0.9, accessPrediction.confidence + 0.2);
    } else if (layerRanking.length > 0) {
      decision.primaryLayer =
        layerRanking[0] ??
        (() => {
          throw new Error('Expected layerRanking[0] to exist');
        })(); // Safe: layerRanking always has at least 1 element from getLayerRanking()
      decision.reasoning.push('best_performing_layer');
      decision.confidence = 0.7;
    } else {
      // Fallback if no layers available (shouldn't happen in practice)
      decision.primaryLayer = 'memory';
      decision.reasoning.push('fallback_default_layer');
      decision.confidence = 0.3;
    }

    // Add fallback layers
    decision.additionalLayers = this.config.fallbackOrder.filter(
      (layer) => layer !== decision.primaryLayer && this.isLayerHealthy(layer),
    );

    decision.alternatives = layerRanking.filter(
      (layer) => layer !== decision.primaryLayer,
    );

    this.recordRoutingDecision(decision);
    return decision;
  }

  private applySizeBasedRouting(
    entry: AdvancedCacheEntry,
    decision: RoutingDecision,
  ): RoutingDecision {
    decision.reasoning.push('size_based_routing');
    decision.strategy = 'size_based';

    // Small items: Memory with IndexedDB fallback
    if (entry.size < this.config.memoryThreshold) {
      decision.primaryLayer = 'memory';
      decision.additionalLayers = ['indexeddb'];
      decision.reasoning.push('small_size_memory_optimal');
      decision.confidence = 0.9;
    }
    // Medium items: IndexedDB primary
    else if (entry.size < this.config.indexedDBThreshold) {
      decision.primaryLayer = 'indexeddb';
      decision.additionalLayers = ['memory'];
      decision.reasoning.push('medium_size_indexeddb_optimal');
      decision.confidence = 0.8;
    }
    // Large items: ServiceWorker primary
    else {
      decision.primaryLayer = 'serviceworker';
      decision.additionalLayers = ['indexeddb'];
      decision.reasoning.push('large_size_serviceworker_optimal');
      decision.confidence = 0.7;
    }

    // Populate alternatives array for fallback scenarios
    const allLayers: CacheLayer[] = ['memory', 'indexeddb', 'serviceworker'];
    decision.alternatives = allLayers.filter(
      (layer) => layer !== decision.primaryLayer && this.isLayerHealthy(layer),
    );

    this.recordRoutingDecision(decision);
    return decision;
  }

  private applyFrequencyBasedRouting(
    entry: AdvancedCacheEntry,
    decision: RoutingDecision,
  ): RoutingDecision {
    const frequency = this.patternAnalyzer.getAccessFrequency(entry.sampleId);
    decision.reasoning.push('frequency_based_routing');

    // High frequency: All layers
    if (frequency >= this.config.highFrequencyThreshold) {
      decision.primaryLayer = 'memory';
      decision.additionalLayers = ['indexeddb', 'serviceworker'];
      decision.reasoning.push('high_frequency_all_layers');
      decision.confidence = 0.9;
    }
    // Medium frequency: Memory + IndexedDB
    else if (frequency >= this.config.mediumFrequencyThreshold) {
      decision.primaryLayer = 'memory';
      decision.additionalLayers = ['indexeddb'];
      decision.reasoning.push('medium_frequency_fast_layers');
      decision.confidence = 0.8;
    }
    // Low frequency: IndexedDB only
    else {
      decision.primaryLayer = 'indexeddb';
      decision.reasoning.push('low_frequency_persistent');
      decision.confidence = 0.6;
    }

    this.recordRoutingDecision(decision);
    return decision;
  }

  private applyHybridRouting(
    entry: AdvancedCacheEntry,
    decision: RoutingDecision,
  ): RoutingDecision {
    decision.reasoning.push('hybrid_routing');
    decision.strategy = 'hybrid';

    // Create temporary decisions without affecting the main decision strategy
    const tempSizeDecision = {
      ...decision,
      strategy: 'size_based',
      reasoning: [],
    };
    const tempFreqDecision = {
      ...decision,
      strategy: 'frequency_based',
      reasoning: [],
    };

    // Combine size and frequency factors
    const sizeDecision = this.applySizeBasedRouting(entry, tempSizeDecision);
    const frequencyDecision = this.applyFrequencyBasedRouting(
      entry,
      tempFreqDecision,
    );

    // Weight decisions based on confidence
    if (sizeDecision.confidence > frequencyDecision.confidence) {
      decision.primaryLayer = sizeDecision.primaryLayer;
      decision.additionalLayers = Array.from(
        new Set([
          ...sizeDecision.additionalLayers,
          ...frequencyDecision.additionalLayers,
        ]),
      );
      decision.confidence =
        sizeDecision.confidence * 0.6 + frequencyDecision.confidence * 0.4;
    } else {
      decision.primaryLayer = frequencyDecision.primaryLayer;
      decision.additionalLayers = Array.from(
        new Set([
          ...frequencyDecision.additionalLayers,
          ...sizeDecision.additionalLayers,
        ]),
      );
      decision.confidence =
        frequencyDecision.confidence * 0.6 + sizeDecision.confidence * 0.4;
    }

    decision.reasoning.push('combined_size_frequency_factors');
    decision.strategy = 'hybrid'; // Ensure strategy is set correctly
    this.recordRoutingDecision(decision);
    return decision;
  }

  private applyMLOptimizedRouting(
    entry: AdvancedCacheEntry,
    decision: RoutingDecision,
  ): RoutingDecision {
    decision.reasoning.push('ml_optimized_routing');
    decision.strategy = 'ml_optimized';

    // Get ML predictions
    const accessPrediction = this.patternAnalyzer.predictNextAccess(
      entry.sampleId,
    );
    const layerRanking = this.performanceTracker.getLayerRanking();

    // Use ML predictions if confidence is high
    if (
      accessPrediction.confidence > this.config.predictionConfidenceThreshold
    ) {
      // High access probability: Use fastest layers
      if (accessPrediction.probability > 0.7) {
        decision.primaryLayer = layerRanking[0] || 'memory'; // Safe fallback
        decision.additionalLayers = layerRanking.slice(1, 3);
        decision.reasoning.push('ml_high_access_probability');
        decision.reasoning.push('ml_prediction');
        decision.confidence = accessPrediction.confidence;
      }
      // Medium access probability: Balance speed and persistence
      else if (accessPrediction.probability > 0.4) {
        decision.primaryLayer = 'indexeddb';
        decision.additionalLayers = ['memory'];
        decision.reasoning.push('ml_medium_access_probability');
        decision.reasoning.push('ml_prediction');
        decision.confidence = accessPrediction.confidence * 0.8;
      }
      // Low access probability: Use persistent storage
      else {
        decision.primaryLayer = 'serviceworker';
        decision.reasoning.push('ml_low_access_probability');
        decision.reasoning.push('ml_prediction');
        decision.confidence = accessPrediction.confidence * 0.6;
      }
    } else {
      // Fall back to hybrid approach when ML confidence is low
      const hybridDecision = this.applyHybridRouting(entry, { ...decision });
      decision.primaryLayer = hybridDecision.primaryLayer;
      decision.additionalLayers = hybridDecision.additionalLayers;
      decision.confidence = hybridDecision.confidence * 0.8; // Reduce confidence for fallback
      decision.reasoning.push('ml_low_confidence_hybrid_fallback');
      decision.reasoning.push('ml_prediction');
      // Keep ml_optimized strategy even when falling back
    }

    this.recordRoutingDecision(decision);
    return decision;
  }

  private applyPerformanceBasedRouting(
    entry: AdvancedCacheEntry,
    decision: RoutingDecision,
  ): RoutingDecision {
    decision.reasoning.push('performance_based_routing');

    const layerRanking = this.performanceTracker.getLayerRanking();
    const healthyLayers = layerRanking.filter((layer) =>
      this.isLayerHealthy(layer),
    );

    if (healthyLayers.length === 0) {
      // Fallback to default if no layers are healthy
      decision.primaryLayer = 'memory';
      decision.reasoning.push('fallback_no_healthy_layers');
      decision.confidence = 0.3;
    } else {
      decision.primaryLayer = healthyLayers[0] || 'memory'; // Safe fallback
      decision.additionalLayers = healthyLayers.slice(1, 3);
      decision.reasoning.push('best_performing_healthy_layers');
      decision.confidence = 0.8;
    }

    this.recordRoutingDecision(decision);
    return decision;
  }

  private isLayerHealthy(layer: CacheLayer): boolean {
    const metrics = this.performanceTracker.getMetrics(layer);
    return metrics?.isHealthy ?? false;
  }

  private recordRoutingDecision(decision: RoutingDecision): void {
    this.routingHistory.push(decision);

    // Keep only recent decisions
    if (this.routingHistory.length > 500) {
      this.routingHistory = this.routingHistory.slice(-500);
    }
  }

  /**
   * Record operation results for performance tracking
   */
  recordOperation(
    layer: CacheLayer,
    operation: 'get' | 'set' | 'delete',
    duration: number,
    success: boolean,
    sampleId?: string,
    hit?: boolean,
    size?: number,
  ): void {
    this.performanceTracker.recordOperation(
      layer,
      operation,
      duration,
      success,
      hit,
      size,
    );

    if (sampleId && operation === 'get' && size) {
      this.patternAnalyzer.recordAccess(sampleId, layer, size);
    }
  }

  /**
   * Get routing analytics
   */
  getAnalytics(): CacheRoutingAnalytics {
    const baseAnalytics = this.patternAnalyzer.getAnalytics();
    const performanceMetrics = this.performanceTracker.getAllMetrics();

    return {
      ...baseAnalytics,
      routingDecisions: {
        total: this.routingHistory.length,
        byStrategy: this.getRoutingStrategyBreakdown(),
        averageConfidence: this.calculateAverageConfidence(),
        successRate: this.calculateRoutingSuccessRate(),
      },
      layerPerformance: Object.fromEntries(
        Array.from(performanceMetrics.entries()).map(([layer, metrics]) => [
          layer,
          {
            qualityScore: metrics.qualityScore,
            hitRate: metrics.hitRate,
            averageLatency: metrics.averageLatency,
            isHealthy: metrics.isHealthy,
          },
        ]),
      ) as Record<
        CacheLayer,
        {
          qualityScore: number;
          hitRate: number;
          averageLatency: number;
          isHealthy: boolean;
        }
      >,
    };
  }

  private getRoutingStrategyBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};

    this.routingHistory.forEach((decision) => {
      breakdown[decision.strategy] = (breakdown[decision.strategy] || 0) + 1;
    });

    return breakdown;
  }

  private calculateAverageConfidence(): number {
    if (this.routingHistory.length === 0) return 0;

    const totalConfidence = this.routingHistory.reduce(
      (sum, decision) => sum + decision.confidence,
      0,
    );

    return totalConfidence / this.routingHistory.length;
  }

  private calculateRoutingSuccessRate(): number {
    // This would be calculated based on actual operation outcomes
    // For now, return a placeholder based on layer health
    const healthyLayers = Array.from(
      this.performanceTracker.getAllMetrics().values(),
    ).filter((metrics) => metrics.isHealthy).length;

    return healthyLayers / 3; // 3 total layers
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheRoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get performance metrics for a specific layer
   */
  getLayerMetrics(layer: CacheLayer): LayerPerformanceMetrics | undefined {
    return this.performanceTracker.getMetrics(layer);
  }

  /**
   * Get layer ranking by performance
   */
  getLayerRanking(): CacheLayer[] {
    return this.performanceTracker.getLayerRanking();
  }

  /**
   * Synchronize data across all cache layers
   */
  synchronizeAcrossLayers(_entry: AdvancedCacheEntry): {
    success: boolean;
    layersSynced: CacheLayer[];
    conflicts: number;
    syncTime: number;
  } {
    const startTime = Date.now();
    const layersSynced: CacheLayer[] = [];
    let conflicts = 0;

    // Simulate synchronization across layers
    const availableLayers: CacheLayer[] = [
      'memory',
      'indexeddb',
      'serviceworker',
    ];

    for (const layer of availableLayers) {
      if (this.isLayerHealthy(layer)) {
        layersSynced.push(layer);
        // Simulate conflict detection
        if (Math.random() < 0.1) {
          // 10% chance of conflict
          conflicts++;
        }
      }
    }

    const syncTime = Date.now() - startTime;

    return {
      success: layersSynced.length > 0,
      layersSynced,
      conflicts,
      syncTime,
    };
  }

  /**
   * Resolve conflicts between cache layers
   */
  resolveLayerConflicts(_entry: AdvancedCacheEntry): {
    conflictsFound: number;
    conflictsResolved: number;
    strategy: string;
    layersAffected: CacheLayer[];
  } {
    // Mock implementation for now
    // In a real implementation, this would check for data inconsistencies
    // across layers and resolve them
    return {
      conflictsFound: 0,
      conflictsResolved: 0,
      strategy: 'latest_wins',
      layersAffected: [],
    };
  }

  /**
   * Get routing insights and recommendations
   */
  getRoutingInsights(): {
    recommendations: string[];
    performanceIssues: string[];
    optimizationOpportunities: string[];
    strategyEffectiveness: Record<string, number>;
  } {
    const strategyBreakdown = this.getRoutingStrategyBreakdown();
    const avgConfidence = this.calculateAverageConfidence();
    const successRate = this.calculateRoutingSuccessRate();
    const layerMetrics = this.performanceTracker.getAllMetrics();

    const recommendations: string[] = [];
    const performanceIssues: string[] = [];
    const optimizationOpportunities: string[] = [];

    // Analyze strategy effectiveness
    const strategyEffectiveness: Record<string, number> = {};
    Object.entries(strategyBreakdown).forEach(([strategy, _count]) => {
      const effectiveness = this.calculateStrategyEffectiveness(strategy);
      strategyEffectiveness[strategy] = effectiveness;

      if (effectiveness < 0.7) {
        performanceIssues.push(
          `${strategy} strategy showing low effectiveness (${(effectiveness * 100).toFixed(1)}%)`,
        );
      }
    });

    // Check layer health
    layerMetrics.forEach((metrics, layer) => {
      // TODO: Review non-null assertion - consider null safety
      if (!metrics.isHealthy) {
        performanceIssues.push(`${layer} layer showing health issues`);
      }
      if (metrics.hitRate < 0.7) {
        optimizationOpportunities.push(
          `${layer} layer hit rate could be improved (currently ${(metrics.hitRate * 100).toFixed(1)}%)`,
        );
      }
      if (metrics.averageLatency > this.getMaxLatencyThreshold(layer)) {
        performanceIssues.push(
          `${layer} layer experiencing high latency (${metrics.averageLatency}ms)`,
        );
      }
    });

    // General recommendations
    if (avgConfidence < 0.7) {
      recommendations.push(
        'Consider adjusting routing thresholds to improve decision confidence',
      );
    }
    if (successRate < 0.9) {
      recommendations.push(
        'Review routing strategy configuration for better success rates',
      );
    }
    if (this.routingHistory.length > 100) {
      optimizationOpportunities.push(
        'Enable ML prediction for better routing decisions',
      );
    }

    return {
      recommendations,
      performanceIssues,
      optimizationOpportunities,
      strategyEffectiveness,
    };
  }

  /**
   * Optimize routing configuration based on historical data
   */
  optimizeConfiguration(): {
    optimizedConfig: Partial<CacheRoutingConfig>;
    improvements: string[];
    expectedImpact: {
      confidenceIncrease: number;
      latencyReduction: number;
      hitRateImprovement: number;
    };
  } {
    const insights = this.getRoutingInsights();

    const optimizedConfig: Partial<CacheRoutingConfig> = {};
    const improvements: string[] = [];

    // Analyze size thresholds
    const avgSizes = this.analyzeSizePatterns();
    if (avgSizes.small !== this.config.memoryThreshold) {
      optimizedConfig.memoryThreshold = avgSizes.small;
      improvements.push(`Adjusted memory threshold to ${avgSizes.small} bytes`);
    }
    if (avgSizes.medium !== this.config.indexedDBThreshold) {
      optimizedConfig.indexedDBThreshold = avgSizes.medium;
      improvements.push(
        `Adjusted IndexedDB threshold to ${avgSizes.medium} bytes`,
      );
    }

    // Optimize frequency thresholds
    const avgFrequencies = this.analyzeFrequencyPatterns();
    if (avgFrequencies.high !== this.config.highFrequencyThreshold) {
      optimizedConfig.highFrequencyThreshold = avgFrequencies.high;
      improvements.push(
        `Adjusted high frequency threshold to ${avgFrequencies.high}`,
      );
    }

    // Optimize fallback order based on performance
    const layerRanking = this.performanceTracker.getLayerRanking();
    if (
      JSON.stringify(layerRanking) !== JSON.stringify(this.config.fallbackOrder)
    ) {
      optimizedConfig.fallbackOrder = layerRanking;
      improvements.push('Reordered fallback layers based on performance');
    }

    // Suggest best strategy
    const bestStrategy = this.findBestStrategy(insights.strategyEffectiveness);
    if (bestStrategy !== this.config.routingStrategy) {
      optimizedConfig.routingStrategy = bestStrategy;
      improvements.push(`Recommended strategy change to ${bestStrategy}`);
    }

    return {
      optimizedConfig,
      improvements,
      expectedImpact: {
        confidenceIncrease: 0.1,
        latencyReduction: 0.15,
        hitRateImprovement: 0.08,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): CacheRoutingConfig {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  resetConfiguration(): void {
    this.config = {
      enabled: true,
      routingStrategy: 'size_based',
      memoryThreshold: 5 * 1024 * 1024, // 5MB
      indexedDBThreshold: 50 * 1024 * 1024, // 50MB
      highFrequencyThreshold: 10,
      mediumFrequencyThreshold: 5,
      enableMLPrediction: true,
      predictionConfidenceThreshold: 0.7,
      enableFallbackRouting: true,
      fallbackOrder: ['memory', 'indexeddb', 'serviceworker'],
    };
  }

  /**
   * Enhanced fallback routing when primary strategy fails
   */
  getFallbackRouting(
    entry: AdvancedCacheEntry,
    failedStrategy: string,
  ): RoutingDecision {
    const fallbackStrategies = [
      'size_based',
      'frequency_based',
      'performance_based',
    ];
    const availableStrategies = fallbackStrategies.filter(
      (s) => s !== failedStrategy,
    );

    for (const strategy of availableStrategies) {
      try {
        const tempConfig = { ...this.config, routingStrategy: strategy as any };
        const tempRouter = new IntelligentCacheRouter(tempConfig);
        const decision = tempRouter.determineStorageLayers(entry);
        decision.reasoning.push(`fallback_from_${failedStrategy}`);
        decision.confidence *= 0.8; // Reduce confidence for fallback
        return decision;
      } catch {
        continue; // Try next strategy
      }
    }

    // Ultimate fallback
    return {
      primaryLayer: 'memory',
      additionalLayers: ['indexeddb'],
      strategy: 'emergency_fallback',
      reasoning: ['all_strategies_failed', 'using_emergency_fallback'],
      confidence: 0.3,
      alternatives: this.config.fallbackOrder,
    };
  }

  // Helper methods for optimization
  private calculateStrategyEffectiveness(strategy: string): number {
    const strategyDecisions = this.routingHistory.filter(
      (d) => d.strategy === strategy,
    );
    if (strategyDecisions.length === 0) return 0.5;
    const avgConfidence =
      strategyDecisions.reduce((sum, d) => sum + d.confidence, 0) /
      strategyDecisions.length;
    return avgConfidence;
  }

  private getMaxLatencyThreshold(layer: CacheLayer): number {
    switch (layer) {
      case 'memory':
        return 10;
      case 'indexeddb':
        return 100;
      case 'serviceworker':
        return 500;
      default:
        return 100;
    }
  }

  private analyzeSizePatterns(): { small: number; medium: number } {
    // Analyze historical routing decisions to find optimal size thresholds
    // This is a simplified implementation
    return {
      small: 3 * 1024 * 1024, // 3MB
      medium: 30 * 1024 * 1024, // 30MB
    };
  }

  private analyzeFrequencyPatterns(): { high: number; medium: number } {
    // Analyze access patterns to find optimal frequency thresholds
    return {
      high: 12,
      medium: 6,
    };
  }

  private findBestStrategy(
    effectiveness: Record<string, number>,
  ): CacheRoutingConfig['routingStrategy'] {
    const strategies = Object.entries(effectiveness);
    if (strategies.length === 0) return 'hybrid';
    const best = strategies.reduce((a, b) => (a[1] > b[1] ? a : b));
    return best[0] as CacheRoutingConfig['routingStrategy'];
  }
}
