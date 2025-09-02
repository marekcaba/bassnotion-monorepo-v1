/**
 * MetricsCollector - Performance metrics collection
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Comprehensive metrics collection for production monitoring
 */

import { EventBus } from '../core/EventBus.js';
import { ProductionLogger } from '../logging/ProductionLogger.js';

export interface Metric {
  name: string;
  category: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MetricAggregation {
  name: string;
  category: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  average: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  lastValue: number;
  lastTimestamp: number;
}

export interface MetricsConfig {
  enabled?: boolean;
  bufferSize?: number;
  aggregationInterval?: number;
  retentionPeriod?: number;
  enableHistograms?: boolean;
  enableRemoteExport?: boolean;
  remoteEndpoint?: string;
  customTags?: Record<string, string>;
}

export interface MetricsSnapshot {
  timestamp: number;
  duration: number;
  metrics: Record<string, MetricAggregation>;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms?: Record<string, number[]>;
}

export class MetricsCollector {
  private static instance: MetricsCollector | null = null;

  private eventBus: EventBus;
  private logger: ProductionLogger;
  private config: Required<MetricsConfig>;
  private metricsBuffer: Metric[] = [];
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private aggregations: Map<string, MetricAggregation> = new Map();
  private aggregationTimer?: NodeJS.Timeout;
  private exportTimer?: NodeJS.Timeout;
  private startTime: number;

  private constructor(
    eventBus: EventBus,
    logger: ProductionLogger,
    config: MetricsConfig = {},
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.config = {
      enabled: true,
      bufferSize: 10000,
      aggregationInterval: 60000, // 1 minute
      retentionPeriod: 3600000, // 1 hour
      enableHistograms: true,
      enableRemoteExport: true,
      remoteEndpoint: '/api/metrics',
      customTags: {},
      ...config,
    };

    this.startTime = Date.now();
    this.setupEventListeners();
    this.startAggregation();
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    eventBus: EventBus,
    logger: ProductionLogger,
    config?: MetricsConfig,
  ): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector(
        eventBus,
        logger,
        config,
      );
    }
    return MetricsCollector.instance;
  }

  /**
   * Record a metric value
   */
  record(
    name: string,
    value: number,
    unit = 'count',
    category = 'general',
    tags?: Record<string, string>,
  ): void {
    if (!this.config.enabled) return;

    const metric: Metric = {
      name,
      category,
      value,
      unit,
      timestamp: Date.now(),
      tags: { ...this.config.customTags, ...tags },
    };

    this.metricsBuffer.push(metric);
    this.updateAggregation(metric);

    // Maintain buffer size
    if (this.metricsBuffer.length > this.config.bufferSize) {
      this.metricsBuffer.shift();
    }

    // Emit for real-time monitoring
    this.eventBus.emit('metrics:recorded', metric);
  }

  /**
   * Increment a counter
   */
  increment(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.record(name, value, 'count', 'counter', tags);
  }

  /**
   * Decrement a counter
   */
  decrement(name: string, value = 1, tags?: Record<string, string>): void {
    this.increment(name, -value, tags);
  }

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);

    this.record(name, value, 'gauge', 'gauge', tags);
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record(name, duration, 'ms', 'timing', tags);

    if (this.config.enableHistograms) {
      this.addToHistogram(name, duration, tags);
    }
  }

  /**
   * Start a timer
   */
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.timing(name, duration, tags);
    };
  }

  /**
   * Measure async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>,
  ): Promise<T> {
    const timer = this.startTimer(name, tags);

    try {
      const result = await operation();
      timer();
      return result;
    } catch (error) {
      timer();
      this.increment(`${name}.errors`, 1, tags);
      throw error;
    }
  }

  /**
   * Update metric aggregation
   */
  private updateAggregation(metric: Metric): void {
    const key = `${metric.category}.${metric.name}`;
    const existing = this.aggregations.get(key);

    if (!existing) {
      this.aggregations.set(key, {
        name: metric.name,
        category: metric.category,
        count: 1,
        sum: metric.value,
        min: metric.value,
        max: metric.value,
        average: metric.value,
        p50: metric.value,
        p95: metric.value,
        p99: metric.value,
        stdDev: 0,
        lastValue: metric.value,
        lastTimestamp: metric.timestamp,
      });
    } else {
      existing.count++;
      existing.sum += metric.value;
      existing.min = Math.min(existing.min, metric.value);
      existing.max = Math.max(existing.max, metric.value);
      existing.average = existing.sum / existing.count;
      existing.lastValue = metric.value;
      existing.lastTimestamp = metric.timestamp;

      // Percentiles and stdDev are calculated during aggregation
    }
  }

  /**
   * Add value to histogram
   */
  private addToHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): void {
    const key = this.getMetricKey(name, tags);
    const histogram = this.histograms.get(key) || [];

    histogram.push(value);

    // Limit histogram size
    if (histogram.length > 1000) {
      histogram.shift();
    }

    this.histograms.set(key, histogram);
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], average: number): number {
    if (values.length === 0) return 0;

    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  /**
   * Start aggregation timer
   */
  private startAggregation(): void {
    if (!this.config.enabled || this.aggregationTimer) return;

    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval);

    // Also start export timer if enabled
    if (this.config.enableRemoteExport) {
      this.exportTimer = setInterval(() => {
        this.exportMetrics();
      }, this.config.aggregationInterval * 2); // Export every 2 aggregation intervals
    }
  }

  /**
   * Perform metric aggregation
   */
  private performAggregation(): void {
    const startTime = performance.now();

    // Update percentiles and standard deviation
    for (const [key, aggregation] of this.aggregations) {
      const metricName = aggregation.name;
      const categoryMetrics = this.metricsBuffer.filter(
        (m) => m.category === aggregation.category && m.name === metricName,
      );

      if (categoryMetrics.length > 0) {
        const values = categoryMetrics.map((m) => m.value);
        const percentiles = this.calculatePercentiles(values);
        const stdDev = this.calculateStdDev(values, aggregation.average);

        aggregation.p50 = percentiles.p50;
        aggregation.p95 = percentiles.p95;
        aggregation.p99 = percentiles.p99;
        aggregation.stdDev = stdDev;
      }
    }

    // Clean old metrics
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.metricsBuffer = this.metricsBuffer.filter(
      (m) => m.timestamp > cutoffTime,
    );

    const duration = performance.now() - startTime;
    this.logger.debug('metrics', 'Aggregation completed', {
      duration,
      metricsCount: this.metricsBuffer.length,
      aggregationsCount: this.aggregations.size,
    });
  }

  /**
   * Get metric key
   */
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }

    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${tagString}}`;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Audio metrics
    this.eventBus.on('audio:initialized', ({ attempts }) => {
      this.increment('audio.initialization.success');
      this.gauge('audio.initialization.attempts', attempts);
    });

    this.eventBus.on('audio:error', () => {
      this.increment('audio.errors');
    });

    this.eventBus.on('audio:sampler-created', ({ creationTime }) => {
      this.timing('audio.sampler.creation', creationTime);
      this.increment('audio.samplers.created');
    });

    this.eventBus.on('audio:sampler-disposed', () => {
      this.increment('audio.samplers.disposed');
    });

    // Performance metrics
    this.eventBus.on('performance:dropout', () => {
      this.increment('performance.audio.dropouts');
    });

    this.eventBus.on('performance:buffer-underrun', () => {
      this.increment('performance.audio.underruns');
    });

    // Optimization metrics
    this.eventBus.on('optimization:initialization-complete', ({ duration }) => {
      this.timing('optimization.initialization', duration);
    });

    this.eventBus.on('optimization:pool-exhausted', ({ pool }) => {
      this.increment('optimization.pool.exhausted', 1, { pool });
    });

    this.eventBus.on('optimization:gc-complete', ({ duration }) => {
      this.timing('optimization.gc', duration);
    });
  }

  /**
   * Get current snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
      metrics: {},
      counters: {},
      gauges: {},
    };

    // Add aggregations
    for (const [key, aggregation] of this.aggregations) {
      snapshot.metrics[key] = { ...aggregation };
    }

    // Add counters
    for (const [key, value] of this.counters) {
      snapshot.counters[key] = value;
    }

    // Add gauges
    for (const [key, value] of this.gauges) {
      snapshot.gauges[key] = value;
    }

    // Add histograms if enabled
    if (this.config.enableHistograms) {
      snapshot.histograms = {};
      for (const [key, values] of this.histograms) {
        snapshot.histograms[key] = [...values];
      }
    }

    return snapshot;
  }

  /**
   * Export metrics to remote endpoint
   */
  private async exportMetrics(): Promise<void> {
    if (!this.config.enableRemoteExport || !this.config.remoteEndpoint) {
      return;
    }

    try {
      const snapshot = this.getSnapshot();

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot,
          sessionId: this.logger.getStats().totalLogs > 0 ? 'active' : 'new',
          timestamp: Date.now(),
        }),
      });

      this.logger.debug('metrics', 'Metrics exported successfully');
    } catch (error) {
      this.logger.error(
        'metrics',
        'Failed to export metrics',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metricsBuffer = [];
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.aggregations.clear();
    this.startTime = Date.now();
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }

    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = undefined;
    }

    // Export final metrics
    this.exportMetrics();
  }

  /**
   * Dispose metrics collector
   */
  dispose(): void {
    this.stop();
    this.reset();
    MetricsCollector.instance = null;
  }
}
