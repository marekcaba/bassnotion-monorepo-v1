/**
 * PerformanceMonitor - Enhanced Performance Monitoring
 * Story 3.18.4: Service Architecture Implementation
 *
 * Advanced performance monitoring with memory optimization,
 * resource pooling, and performance profiling.
 */

import { EventBus } from '../services/core/EventBus.js';

export interface PerformanceMetrics {
  serviceName: string;
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed?: number;
  cpuUsage?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  serviceName: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  memoryStats?: {
    average: number;
    peak: number;
  };
  timeRange: {
    start: number;
    end: number;
  };
}

export interface ResourcePool<T> {
  name: string;
  size: number;
  available: T[];
  inUse: Set<T>;
  create: () => T;
  reset?: (item: T) => void;
}

export interface PerformanceOptimizationConfig {
  enableMemoryPooling?: boolean;
  enableGarbageCollectionOptimization?: boolean;
  metricsRetentionTime?: number; // ms
  reportingInterval?: number; // ms
  memoryWarningThreshold?: number; // MB
  performanceWarningThreshold?: number; // ms
}

export class EnhancedPerformanceMonitor {
  private eventBus: EventBus;
  private config: Required<PerformanceOptimizationConfig>;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private resourcePools: Map<string, ResourcePool<any>> = new Map();
  private reportingTimer?: NodeJS.Timeout;
  private lastGCTime = 0;
  private gcInterval = 60000; // 1 minute

  // Performance optimization flags
  private isHighLoad = false;
  private memoryPressure = false;

  constructor(eventBus: EventBus, config: PerformanceOptimizationConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      enableMemoryPooling: config.enableMemoryPooling ?? true,
      enableGarbageCollectionOptimization:
        config.enableGarbageCollectionOptimization ?? true,
      metricsRetentionTime: config.metricsRetentionTime || 300000, // 5 minutes
      reportingInterval: config.reportingInterval || 30000, // 30 seconds
      memoryWarningThreshold: config.memoryWarningThreshold || 100, // 100 MB
      performanceWarningThreshold: config.performanceWarningThreshold || 1000, // 1 second
    };

    this.startReporting();
    this.setupMemoryMonitoring();
  }

  /**
   * Measure operation performance
   */
  async measure<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    let success = false;

    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      const metrics: PerformanceMetrics = {
        serviceName,
        operation,
        startTime,
        endTime,
        duration: endTime - startTime,
        memoryUsed: endMemory - startMemory,
        success,
        metadata,
      };

      this.recordMetrics(metrics);

      // Check for performance issues
      this.checkPerformanceThresholds(metrics);
    }
  }

  /**
   * Create resource pool for object reuse
   */
  createResourcePool<T>(
    name: string,
    size: number,
    create: () => T,
    reset?: (item: T) => void,
  ): ResourcePool<T> {
    if (!this.config.enableMemoryPooling) {
      throw new Error('Memory pooling is disabled');
    }

    const pool: ResourcePool<T> = {
      name,
      size,
      available: [],
      inUse: new Set(),
      create,
      reset,
    };

    // Pre-populate pool
    for (let i = 0; i < size; i++) {
      pool.available.push(create());
    }

    this.resourcePools.set(name, pool);

    this.eventBus.emit('performance:pool-created', {
      name,
      size,
    });

    return pool;
  }

  /**
   * Acquire resource from pool
   */
  acquireFromPool<T>(poolName: string): T | null {
    const pool = this.resourcePools.get(poolName) as ResourcePool<T>;
    if (!pool) {
      return null;
    }

    let resource: T;

    if (pool.available.length > 0) {
      const popped = pool.available.pop();
      if (popped) {
        resource = popped;
      }
    } else if (pool.inUse.size < pool.size) {
      // Create new resource if under limit
      resource = pool.create();
    } else {
      // Pool exhausted
      this.eventBus.emit('performance:pool-exhausted', {
        poolName,
        size: pool.size,
      });
      return null;
    }

    pool.inUse.add(resource);
    return resource;
  }

  /**
   * Release resource back to pool
   */
  releaseToPool<T>(poolName: string, resource: T): void {
    const pool = this.resourcePools.get(poolName) as ResourcePool<T>;
    if (!pool || !pool.inUse.has(resource)) {
      return;
    }

    pool.inUse.delete(resource);

    // Reset resource if reset function provided
    if (pool.reset) {
      pool.reset(resource);
    }

    pool.available.push(resource);
  }

  /**
   * Optimize garbage collection timing
   */
  private optimizeGarbageCollection(): void {
    if (!this.config.enableGarbageCollectionOptimization) {
      return;
    }

    const now = Date.now();

    // Only suggest GC if enough time has passed and system is not under high load
    if (now - this.lastGCTime > this.gcInterval && !this.isHighLoad) {
      // In a real implementation, we would trigger GC here
      // For now, we just emit an event
      this.eventBus.emit('performance:gc-suggested', {
        lastGC: this.lastGCTime,
        memoryUsage: this.getMemoryUsage(),
      });

      this.lastGCTime = now;
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    const key = `${metrics.serviceName}:${metrics.operation}`;
    const metricsList = this.metrics.get(key) || [];

    metricsList.push(metrics);

    // Clean old metrics
    const cutoffTime = Date.now() - this.config.metricsRetentionTime;
    const recentMetrics = metricsList.filter((m) => m.startTime > cutoffTime);

    this.metrics.set(key, recentMetrics);
  }

  /**
   * Check performance thresholds
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // Check duration threshold
    if (metrics.duration > this.config.performanceWarningThreshold) {
      this.eventBus.emit('performance:slow-operation', {
        ...metrics,
        threshold: this.config.performanceWarningThreshold,
      });
    }

    // Check memory threshold
    if (
      metrics.memoryUsed &&
      metrics.memoryUsed > this.config.memoryWarningThreshold * 1024 * 1024
    ) {
      this.eventBus.emit('performance:high-memory', {
        ...metrics,
        threshold: this.config.memoryWarningThreshold,
      });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(
    serviceName?: string,
    operation?: string,
  ): PerformanceReport[] {
    const reports: PerformanceReport[] = [];

    for (const [key, metricsList] of this.metrics) {
      const [service, op] = key.split(':');

      if (serviceName && service !== serviceName) continue;
      if (operation && op !== operation) continue;

      if (metricsList.length === 0) continue;

      const successful = metricsList.filter((m) => m.success);
      const failed = metricsList.filter((m) => !m.success);
      const durations = successful.map((m) => m.duration).sort((a, b) => a - b);
      const memoryUsages = metricsList
        .filter((m) => m.memoryUsed !== undefined)
        .map((m) => m.memoryUsed as number);

      const report: PerformanceReport = {
        serviceName: service,
        totalOperations: metricsList.length,
        successfulOperations: successful.length,
        failedOperations: failed.length,
        averageDuration:
          durations.reduce((a, b) => a + b, 0) / durations.length || 0,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        percentiles: {
          p50: this.calculatePercentile(durations, 50),
          p90: this.calculatePercentile(durations, 90),
          p95: this.calculatePercentile(durations, 95),
          p99: this.calculatePercentile(durations, 99),
        },
        memoryStats:
          memoryUsages.length > 0
            ? {
                average:
                  memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
                peak: Math.max(...memoryUsages),
              }
            : undefined,
        timeRange: {
          start: metricsList[0].startTime,
          end: metricsList[metricsList.length - 1].endTime,
        },
      };

      reports.push(report);
    }

    return reports;
  }

  /**
   * Compare with baseline (old system)
   */
  compareWithBaseline(
    baseline: PerformanceReport[],
    current: PerformanceReport[],
  ): Record<string, any> {
    const comparison: Record<string, any> = {};

    for (const currentReport of current) {
      const baselineReport = baseline.find(
        (b) => b.serviceName === currentReport.serviceName,
      );

      if (!baselineReport) continue;

      const key = currentReport.serviceName;
      comparison[key] = {
        durationImprovement: {
          average:
            ((baselineReport.averageDuration - currentReport.averageDuration) /
              baselineReport.averageDuration) *
            100,
          p95:
            ((baselineReport.percentiles.p95 - currentReport.percentiles.p95) /
              baselineReport.percentiles.p95) *
            100,
        },
        memoryImprovement:
          currentReport.memoryStats && baselineReport.memoryStats
            ? {
                average:
                  ((baselineReport.memoryStats.average -
                    currentReport.memoryStats.average) /
                    baselineReport.memoryStats.average) *
                  100,
                peak:
                  ((baselineReport.memoryStats.peak -
                    currentReport.memoryStats.peak) /
                    baselineReport.memoryStats.peak) *
                  100,
              }
            : null,
        successRateImprovement: {
          baseline:
            (baselineReport.successfulOperations /
              baselineReport.totalOperations) *
            100,
          current:
            (currentReport.successfulOperations /
              currentReport.totalOperations) *
            100,
          improvement:
            (currentReport.successfulOperations /
              currentReport.totalOperations -
              baselineReport.successfulOperations /
                baselineReport.totalOperations) *
            100,
        },
      };
    }

    return comparison;
  }

  /**
   * Setup memory monitoring
   */
  private setupMemoryMonitoring(): void {
    // Monitor memory pressure
    setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      const memoryThreshold = this.config.memoryWarningThreshold * 1024 * 1024;

      const wasUnderPressure = this.memoryPressure;
      this.memoryPressure = memoryUsage > memoryThreshold;

      if (this.memoryPressure && !wasUnderPressure) {
        this.eventBus.emit('performance:memory-pressure', {
          usage: memoryUsage,
          threshold: memoryThreshold,
        });

        // Trigger optimization strategies
        this.optimizeMemoryUsage();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemoryUsage(): void {
    // Clear old metrics more aggressively
    const aggressiveCutoff = Date.now() - this.config.metricsRetentionTime / 2;

    for (const [key, metricsList] of this.metrics) {
      const recentMetrics = metricsList.filter(
        (m) => m.startTime > aggressiveCutoff,
      );
      if (recentMetrics.length < metricsList.length) {
        this.metrics.set(key, recentMetrics);
      }
    }

    // Suggest garbage collection
    this.optimizeGarbageCollection();

    // Emit optimization event
    this.eventBus.emit('performance:memory-optimized', {
      timestamp: Date.now(),
    });
  }

  /**
   * Start periodic reporting
   */
  private startReporting(): void {
    this.reportingTimer = setInterval(() => {
      const reports = this.generateReport();

      // Check system load
      const totalOperations = reports.reduce(
        (sum, r) => sum + r.totalOperations,
        0,
      );
      const avgDuration =
        reports.reduce((sum, r) => sum + r.averageDuration, 0) / reports.length;

      this.isHighLoad = totalOperations > 1000 || avgDuration > 100;

      this.eventBus.emit('performance:report', {
        reports,
        isHighLoad: this.isHighLoad,
        memoryPressure: this.memoryPressure,
        timestamp: Date.now(),
      });
    }, this.config.reportingInterval);
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && (window.performance as any).memory) {
      return (window.performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = undefined;
    }

    this.metrics.clear();
    this.resourcePools.clear();
  }
}
