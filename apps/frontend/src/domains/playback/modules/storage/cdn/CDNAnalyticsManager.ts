/**
 * CDN Analytics Manager
 *
 * Manages CDN analytics with performance tracking, metrics collection,
 * and optimization recommendations.
 */

import { logger } from '../../../utils/logger.js';
import {
  CDNPerformanceMetrics,
  CDNOptimizationRecommendation,
  AnalyticsConfig,
} from './types.js';

/**
 * CDN Analytics Manager
 * Implements CDN analytics with performance tracking and optimization recommendations
 */
export class CDNAnalyticsManager {
  private config: AnalyticsConfig;
  private metrics: CDNPerformanceMetrics;
  private recommendations: CDNOptimizationRecommendation[] = [];
  private metricsHistory: CDNPerformanceMetrics[] = [];
  private isInitialized = false;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CDNPerformanceMetrics {
    return {
      timestamp: Date.now(),
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageLatency: 0,
      p50Latency: 0,
      p90Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      bandwidthUsed: 0,
      bandwidthSaved: 0,
      cacheHitRate: 0,
      originHitRate: 0,
      errorRate: 0,
      timeoutRate: 0,
      errorsByType: {},
      edgePerformance: [],
      geographicDistribution: [],
      compressionSavings: 0,
      formatConversionSavings: 0,
      costSavings: 0,
      qualityMetrics: {
        videoQualityScore: 0,
        audioQualityScore: 0,
        imageQualityScore: 0,
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CDNAnalyticsManager already initialized');
      return;
    }

    try {
      if (this.config.enabled && this.config.collectMetrics) {
        this.startMetricsCollection();
      }

      this.isInitialized = true;
      logger.info('📊 CDNAnalyticsManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CDNAnalyticsManager:', error);
      throw error;
    }
  }

  private startMetricsCollection(): void {
    const interval = this.config.reportingInterval || 60000; // Default 1 minute

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeMetrics();
      this.generateRecommendations();
    }, interval);

    logger.info(`📈 Started metrics collection with ${interval}ms interval`);
  }

  private collectMetrics(): void {
    // Create a snapshot of current metrics
    const snapshot = { ...this.metrics, timestamp: Date.now() };

    // Add to history (keep last 100 snapshots)
    this.metricsHistory.push(snapshot);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }
  }

  private analyzeMetrics(): void {
    // Calculate trends
    if (this.metricsHistory.length < 2) return;

    const current = this.metrics;
    const previous = this.metricsHistory[this.metricsHistory.length - 2];

    // Calculate error rate trend
    const currentErrorRate =
      current.requestsFailed / current.requestsTotal || 0;
    const previousErrorRate =
      previous.requestsFailed / previous.requestsTotal || 0;
    const errorRateTrend = currentErrorRate - previousErrorRate;

    // Calculate latency trend
    const latencyTrend = current.averageLatency - previous.averageLatency;

    // Log significant changes
    if (Math.abs(errorRateTrend) > 0.05) {
      logger.warn(
        `📊 Error rate changed by ${(errorRateTrend * 100).toFixed(2)}%`,
      );
    }

    if (Math.abs(latencyTrend) > 50) {
      logger.warn(`📊 Latency changed by ${latencyTrend.toFixed(0)}ms`);
    }
  }

  /**
   * Update metrics based on a request
   */
  updateRequestMetrics(request: RequestMetrics): void {
    this.metrics.requestsTotal++;

    if (request.success) {
      this.metrics.requestsSuccessful++;
    } else {
      this.metrics.requestsFailed++;
      const errorType = request.errorType || 'unknown';
      this.metrics.errorsByType[errorType] =
        (this.metrics.errorsByType[errorType] || 0) + 1;
    }

    // Update latency metrics (simplified - in production, use proper percentile calculation)
    this.updateLatencyMetrics(request.latency);

    // Update bandwidth metrics
    this.metrics.bandwidthUsed += request.bytesTransferred || 0;
    this.metrics.bandwidthSaved += request.bytesSaved || 0;

    // Update cache metrics
    if (request.cacheHit !== undefined) {
      const totalRequests = this.metrics.requestsTotal;
      const currentHits = this.metrics.cacheHitRate * (totalRequests - 1);
      this.metrics.cacheHitRate =
        (currentHits + (request.cacheHit ? 1 : 0)) / totalRequests;
    }

    // Update edge performance
    if (request.edgeId) {
      this.updateEdgePerformance(request.edgeId, request);
    }

    // Update geographic distribution
    if (request.userRegion) {
      this.updateGeographicDistribution(request.userRegion);
    }
  }

  private updateLatencyMetrics(latency: number): void {
    const totalRequests = this.metrics.requestsTotal;

    // Update average latency
    const currentTotal = this.metrics.averageLatency * (totalRequests - 1);
    this.metrics.averageLatency = (currentTotal + latency) / totalRequests;

    // Simplified percentile updates (in production, use proper data structures)
    this.metrics.p50Latency = this.metrics.averageLatency * 0.8;
    this.metrics.p90Latency = this.metrics.averageLatency * 1.5;
    this.metrics.p95Latency = this.metrics.averageLatency * 1.8;
    this.metrics.p99Latency = this.metrics.averageLatency * 2.5;
  }

  private updateEdgePerformance(edgeId: string, request: RequestMetrics): void {
    let edgeMetric = this.metrics.edgePerformance.find(
      (e) => e.edgeId === edgeId,
    );

    if (!edgeMetric) {
      edgeMetric = {
        edgeId,
        latency: 0,
        throughput: 0,
        errorRate: 0,
        availability: 1,
      };
      this.metrics.edgePerformance.push(edgeMetric);
    }

    // Update edge metrics (simplified calculation)
    const edgeRequests = this.getEdgeRequestCount(edgeId);
    edgeMetric.latency =
      (edgeMetric.latency * (edgeRequests - 1) + request.latency) /
      edgeRequests;
    edgeMetric.throughput = request.bytesTransferred || 0;
    edgeMetric.errorRate = request.success ? 0 : 1;
    edgeMetric.availability = request.success ? 1 : 0;
  }

  private updateGeographicDistribution(region: string): void {
    let geoMetric = this.metrics.geographicDistribution.find(
      (g) => g.region === region,
    );

    if (!geoMetric) {
      geoMetric = {
        region,
        country: region, // Simplified - in production, map region to country
        requests: 0,
        percentage: 0,
      };
      this.metrics.geographicDistribution.push(geoMetric);
    }

    geoMetric.requests++;

    // Update percentages for all regions
    const totalRequests = this.metrics.requestsTotal;
    this.metrics.geographicDistribution.forEach((geo) => {
      geo.percentage = (geo.requests / totalRequests) * 100;
    });
  }

  private getEdgeRequestCount(edgeId: string): number {
    // Simplified - in production, track per-edge request counts
    return (
      Math.floor(
        this.metrics.requestsTotal / this.metrics.edgePerformance.length,
      ) || 1
    );
  }

  private generateRecommendations(): void {
    this.recommendations = [];

    // Check cache performance
    if (this.metrics.cacheHitRate < 0.7) {
      this.recommendations.push({
        recommendationId: 'low-cache-hit-rate',
        type: 'performance',
        priority: 'high',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${(this.metrics.cacheHitRate * 100).toFixed(1)}%, below recommended 70%`,
        impact: {
          performance: 40,
          cost: 30,
          reliability: 10,
        },
        implementationDifficulty: 'medium',
        estimatedSavings: 2000,
        effort: 'medium',
        timeToImplement: 4,
        requiredResources: ['CDN configuration', 'Cache tuning'],
        risks: ['Temporary performance impact'],
        steps: [
          'Analyze cache miss patterns',
          'Adjust cache headers',
          'Implement cache warming',
          'Monitor improvements',
        ],
      });
    }

    // Check error rates
    const errorRate =
      this.metrics.requestsFailed / this.metrics.requestsTotal || 0;
    if (errorRate > 0.02) {
      this.recommendations.push({
        recommendationId: 'high-error-rate',
        type: 'reliability',
        priority: 'critical',
        title: 'High Error Rate',
        description: `Error rate is ${(errorRate * 100).toFixed(2)}%, above acceptable 2%`,
        impact: {
          performance: 20,
          cost: 10,
          reliability: 50,
        },
        implementationDifficulty: 'high',
        estimatedSavings: 500,
        effort: 'high',
        timeToImplement: 8,
        requiredResources: ['Engineering team', 'Monitoring tools'],
        risks: ['Service disruption during fixes'],
        steps: [
          'Analyze error patterns',
          'Identify root causes',
          'Implement fixes',
          'Add monitoring',
        ],
      });
    }

    // Check latency
    if (this.metrics.averageLatency > 200) {
      this.recommendations.push({
        recommendationId: 'high-latency',
        type: 'performance',
        priority: 'high',
        title: 'High Average Latency',
        description: `Average latency is ${this.metrics.averageLatency.toFixed(0)}ms, above target 200ms`,
        impact: {
          performance: 45,
          cost: 15,
          reliability: 20,
        },
        implementationDifficulty: 'medium',
        estimatedSavings: 1500,
        effort: 'medium',
        timeToImplement: 6,
        requiredResources: ['CDN optimization', 'Edge configuration'],
        risks: ['Increased costs from edge expansion'],
        steps: [
          'Analyze latency by region',
          'Add edge locations if needed',
          'Optimize routing algorithms',
          'Enable compression',
        ],
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CDNPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): CDNPerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get current recommendations
   */
  getRecommendations(): CDNOptimizationRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Export metrics for reporting
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(
        {
          current: this.metrics,
          history: this.metricsHistory,
          recommendations: this.recommendations,
        },
        null,
        2,
      );
    }

    // CSV format (simplified)
    const headers = [
      'timestamp',
      'requests',
      'successful',
      'failed',
      'avgLatency',
      'cacheHitRate',
    ];
    const rows = this.metricsHistory.map((m) => [
      m.timestamp,
      m.requestsTotal,
      m.requestsSuccessful,
      m.requestsFailed,
      m.averageLatency.toFixed(2),
      m.cacheHitRate.toFixed(4),
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.isInitialized = false;
    this.metricsHistory = [];
    logger.info('🛑 CDNAnalyticsManager disposed');
  }
}

// Types
interface RequestMetrics {
  success: boolean;
  latency: number;
  bytesTransferred?: number;
  bytesSaved?: number;
  cacheHit?: boolean;
  edgeId?: string;
  userRegion?: string;
  errorType?: string;
}
