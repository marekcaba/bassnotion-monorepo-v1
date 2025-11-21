/**
 * Performance Metrics Collector
 * 
 * Collects and analyzes performance metrics for storage operations
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  StoragePerformanceMetrics,
  PerformanceAnomaly,
  PerformanceRecommendation,
} from '@bassnotion/contracts';
import type { MetricCollector } from './IMonitoringService.js';

const logger = createStructuredLogger('PerformanceMetrics');

export class PerformanceMetricsCollector {
  private metrics: StoragePerformanceMetrics;
  private metricHistory: Map<string, number[]> = new Map();
  private collectors: Map<string, MetricCollector> = new Map();
  private collectInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): StoragePerformanceMetrics {
    return {
      timestamp: Date.now(),
      operations: {
        uploads: { count: 0, totalTime: 0, averageTime: 0, errors: 0 },
        downloads: { count: 0, totalTime: 0, averageTime: 0, errors: 0 },
        deletes: { count: 0, totalTime: 0, averageTime: 0, errors: 0 },
        lists: { count: 0, totalTime: 0, averageTime: 0, errors: 0 },
      },
      latency: {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        max: 0,
      },
      throughput: {
        bytesUploaded: 0,
        bytesDownloaded: 0,
        requestsPerSecond: 0,
      },
      availability: {
        uptime: 100,
        successRate: 100,
        errorRate: 0,
      },
      resources: {
        memoryUsage: 0,
        cpuUsage: 0,
        connectionCount: 0,
      },
      anomalies: [],
      recommendations: [],
    };
  }

  /**
   * Register a metric collector
   */
  registerCollector(collector: MetricCollector): void {
    this.collectors.set(collector.name, collector);
    logger.info('Metric collector registered', { 
      name: collector.name, 
      unit: collector.unit,
    });
  }

  /**
   * Start collecting metrics
   */
  start(intervalMs = 60000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Performance metrics collection started', { intervalMs });

    // Run initial collection
    this.collectMetrics().catch((error) => {
      logger.error('Initial metrics collection failed', error);
    });

    // Schedule periodic collection
    this.collectInterval = setInterval(() => {
      this.collectMetrics().catch((error) => {
        logger.error('Metrics collection failed', error);
      });
    }, intervalMs);
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = undefined;
    }

    logger.info('Performance metrics collection stopped');
  }

  /**
   * Collect metrics from all collectors
   */
  private async collectMetrics(): Promise<void> {
    const collectionPromises = Array.from(this.collectors.entries()).map(
      async ([name, collector]) => {
        try {
          const value = await collector.collect();
          this.recordMetric(name, value, collector.tags);
        } catch (error) {
          logger.error('Collector failed', error as Error, { name });
        }
      },
    );

    await Promise.all(collectionPromises);
    
    // Analyze metrics for anomalies
    this.detectAnomalies();
    
    // Generate recommendations
    this.generateRecommendations();
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    // Update history
    let history = this.metricHistory.get(name);
    if (!history) {
      history = [];
      this.metricHistory.set(name, history);
    }

    history.push(value);
    
    // Keep only last 100 values
    if (history.length > 100) {
      history.shift();
    }

    logger.debug('Metric recorded', { name, value, tags });
  }

  /**
   * Record operation metrics
   */
  recordOperation(
    operation: 'upload' | 'download' | 'delete' | 'list',
    duration: number,
    success: boolean,
    bytes?: number,
  ): void {
    const opMetrics = this.metrics.operations[`${operation}s` as keyof typeof this.metrics.operations];
    
    opMetrics.count++;
    opMetrics.totalTime += duration;
    opMetrics.averageTime = opMetrics.totalTime / opMetrics.count;
    
    if (!success) {
      opMetrics.errors++;
    }

    // Update throughput
    if (bytes) {
      if (operation === 'upload') {
        this.metrics.throughput.bytesUploaded += bytes;
      } else if (operation === 'download') {
        this.metrics.throughput.bytesDownloaded += bytes;
      }
    }

    // Update availability
    const totalOps = Object.values(this.metrics.operations).reduce(
      (sum, op) => sum + op.count,
      0,
    );
    const totalErrors = Object.values(this.metrics.operations).reduce(
      (sum, op) => sum + op.errors,
      0,
    );

    this.metrics.availability.errorRate = totalOps > 0 ? (totalErrors / totalOps) * 100 : 0;
    this.metrics.availability.successRate = 100 - this.metrics.availability.errorRate;
  }

  /**
   * Update latency percentiles
   */
  updateLatencyPercentiles(latencies: number[]): void {
    if (latencies.length === 0) return;

    const sorted = [...latencies].sort((a, b) => a - b);
    
    this.metrics.latency.p50 = this.percentile(sorted, 50);
    this.metrics.latency.p90 = this.percentile(sorted, 90);
    this.metrics.latency.p95 = this.percentile(sorted, 95);
    this.metrics.latency.p99 = this.percentile(sorted, 99);
    this.metrics.latency.max = sorted[sorted.length - 1];
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(): void {
    const anomalies: PerformanceAnomaly[] = [];

    // Check error rate
    if (this.metrics.availability.errorRate > 5) {
      anomalies.push({
        type: 'high_error_rate',
        severity: this.metrics.availability.errorRate > 10 ? 'high' : 'medium',
        timestamp: new Date(),
        value: this.metrics.availability.errorRate,
        threshold: 5,
        description: `Error rate ${this.metrics.availability.errorRate.toFixed(2)}% exceeds threshold`,
      });
    }

    // Check latency
    if (this.metrics.latency.p95 > 1000) {
      anomalies.push({
        type: 'high_latency',
        severity: this.metrics.latency.p95 > 2000 ? 'high' : 'medium',
        timestamp: new Date(),
        value: this.metrics.latency.p95,
        threshold: 1000,
        description: `P95 latency ${this.metrics.latency.p95}ms exceeds threshold`,
      });
    }

    this.metrics.anomalies = anomalies;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    const recommendations: PerformanceRecommendation[] = [];

    // Check if caching would help
    if (this.metrics.operations.downloads.count > this.metrics.operations.uploads.count * 10) {
      recommendations.push({
        type: 'caching',
        priority: 'high',
        description: 'High download-to-upload ratio suggests caching would improve performance',
        estimatedImpact: 'Could reduce download latency by 50-80%',
      });
    }

    // Check if connection pooling needed
    const avgOperationsPerSecond = 
      Object.values(this.metrics.operations).reduce((sum, op) => sum + op.count, 0) / 60;
    
    if (avgOperationsPerSecond > 10) {
      recommendations.push({
        type: 'connection_pooling',
        priority: 'medium',
        description: 'High operation rate suggests connection pooling would help',
        estimatedImpact: 'Could reduce connection overhead by 30%',
      });
    }

    this.metrics.recommendations = recommendations;
  }

  /**
   * Get current metrics
   */
  getMetrics(): StoragePerformanceMetrics {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      anomalies: [...this.metrics.anomalies],
      recommendations: [...this.metrics.recommendations],
    };
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string): number[] {
    return [...(this.metricHistory.get(name) || [])];
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.metricHistory.clear();
    logger.info('Performance metrics cleared');
  }
}