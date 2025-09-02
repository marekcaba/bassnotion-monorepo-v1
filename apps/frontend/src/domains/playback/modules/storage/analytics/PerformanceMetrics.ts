/**
 * PerformanceMetrics - Storage performance monitoring and optimization
 * 
 * Tracks detailed performance metrics for storage operations,
 * identifies bottlenecks, and provides optimization recommendations.
 */

import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PerformanceMetrics');

export interface PerformanceMetricsConfig {
  enabled: boolean;
  sampleSize: number; // Number of operations to track
  percentiles: number[]; // e.g., [50, 75, 90, 95, 99]
  slowOperationThreshold: number; // ms
  traceSampleRate: number; // 0-1, percentage of operations to trace
}

export interface OperationMetrics {
  operationId: string;
  type: 'load' | 'store' | 'delete' | 'cache_hit' | 'cache_miss';
  startTime: number;
  endTime: number;
  duration: number;
  size?: number;
  success: boolean;
  error?: string;
  metadata?: {
    assetId?: string;
    source?: string;
    cached?: boolean;
    compressed?: boolean;
  };
}

export interface PerformanceSummary {
  timestamp: number;
  period: number; // ms
  operations: {
    total: number;
    successful: number;
    failed: number;
    byType: Record<string, number>;
  };
  latency: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    percentiles: Record<number, number>;
  };
  throughput: {
    operationsPerSecond: number;
    bytesPerSecond: number;
    peakOps: number;
    peakBytes: number;
  };
  errors: {
    count: number;
    rate: number;
    byType: Record<string, number>;
  };
}

export interface PerformanceTrace {
  traceId: string;
  operationId: string;
  spans: TraceSpan[];
  totalDuration: number;
  metadata: Record<string, any>;
}

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  attributes?: Record<string, any>;
  children?: TraceSpan[];
}

export interface BottleneckAnalysis {
  timestamp: number;
  bottlenecks: Array<{
    type: 'network' | 'disk' | 'cpu' | 'memory' | 'cache';
    severity: 'low' | 'medium' | 'high';
    impact: number; // 0-1
    affectedOperations: number;
    description: string;
    recommendation: string;
  }>;
  slowOperations: Array<{
    operationId: string;
    duration: number;
    type: string;
    reason?: string;
  }>;
}

/**
 * Monitors and analyzes storage performance
 */
export class PerformanceMetrics {
  private config: PerformanceMetricsConfig;
  private eventBus?: EventBus;
  
  // Metrics storage
  private operations: OperationMetrics[] = [];
  private traces = new Map<string, PerformanceTrace>();
  private currentOperations = new Map<string, Partial<OperationMetrics>>();
  
  // Performance tracking
  private startTime = Date.now();
  private operationCount = 0;
  private totalBytes = 0;
  private errorCount = 0;

  constructor(config: PerformanceMetricsConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;
    
    if (config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    logger.info('Performance metrics monitoring started');
  }

  /**
   * Start tracking an operation
   */
  startOperation(
    operationId: string,
    type: OperationMetrics['type'],
    metadata?: OperationMetrics['metadata']
  ): void {
    if (!this.config.enabled) return;
    
    this.currentOperations.set(operationId, {
      operationId,
      type,
      startTime: performance.now(),
      metadata,
    });
    
    // Start trace if sampled
    if (Math.random() < this.config.traceSampleRate) {
      this.startTrace(operationId, type);
    }
  }

  /**
   * End tracking an operation
   */
  endOperation(
    operationId: string,
    success: boolean,
    size?: number,
    error?: string
  ): void {
    if (!this.config.enabled) return;
    
    const operation = this.currentOperations.get(operationId);
    if (!operation || !operation.startTime) return;
    
    const endTime = performance.now();
    const duration = endTime - operation.startTime;
    
    const metrics: OperationMetrics = {
      operationId,
      type: operation.type!,
      startTime: operation.startTime,
      endTime,
      duration,
      size,
      success,
      error,
      metadata: operation.metadata,
    };
    
    this.recordOperation(metrics);
    this.currentOperations.delete(operationId);
    
    // End trace if exists
    this.endTrace(operationId);
    
    // Check for slow operations
    if (duration > this.config.slowOperationThreshold) {
      this.handleSlowOperation(metrics);
    }
  }

  /**
   * Record operation metrics
   */
  private recordOperation(metrics: OperationMetrics): void {
    this.operations.push(metrics);
    this.operationCount++;
    
    if (metrics.size) {
      this.totalBytes += metrics.size;
    }
    
    if (!metrics.success) {
      this.errorCount++;
    }
    
    // Trim old operations
    if (this.operations.length > this.config.sampleSize) {
      this.operations.shift();
    }
    
    // Emit metrics event
    this.eventBus?.emit('performance:operation', metrics);
  }

  /**
   * Get performance summary
   */
  getSummary(period?: number): PerformanceSummary {
    const now = Date.now();
    const periodMs = period || now - this.startTime;
    const cutoff = now - periodMs;
    
    // Filter operations for period
    const periodOps = this.operations.filter(
      op => op.startTime >= cutoff
    );
    
    return {
      timestamp: now,
      period: periodMs,
      operations: this.calculateOperationStats(periodOps),
      latency: this.calculateLatencyStats(periodOps),
      throughput: this.calculateThroughputStats(periodOps, periodMs),
      errors: this.calculateErrorStats(periodOps),
    };
  }

  /**
   * Analyze bottlenecks
   */
  analyzeBottlenecks(): BottleneckAnalysis {
    const slowOps = this.operations
      .filter(op => op.duration > this.config.slowOperationThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    const bottlenecks = this.identifyBottlenecks();
    
    return {
      timestamp: Date.now(),
      bottlenecks,
      slowOperations: slowOps.map(op => ({
        operationId: op.operationId,
        duration: op.duration,
        type: op.type,
        reason: this.analyzeSlowReason(op),
      })),
    };
  }

  /**
   * Get operation traces
   */
  getTraces(limit = 10): PerformanceTrace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);
  }

  /**
   * Add custom timing
   */
  addTiming(
    operationId: string,
    name: string,
    duration: number,
    attributes?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;
    
    const trace = this.traces.get(operationId);
    if (trace) {
      trace.spans.push({
        name,
        startTime: performance.now() - duration,
        endTime: performance.now(),
        duration,
        attributes,
      });
    }
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.operations = [];
    this.traces.clear();
    this.currentOperations.clear();
    this.operationCount = 0;
    this.totalBytes = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Calculate operation statistics
   */
  private calculateOperationStats(
    operations: OperationMetrics[]
  ): PerformanceSummary['operations'] {
    const byType: Record<string, number> = {};
    let successful = 0;
    let failed = 0;
    
    for (const op of operations) {
      byType[op.type] = (byType[op.type] || 0) + 1;
      
      if (op.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return {
      total: operations.length,
      successful,
      failed,
      byType,
    };
  }

  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(
    operations: OperationMetrics[]
  ): PerformanceSummary['latency'] {
    if (operations.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        percentiles: {},
      };
    }
    
    const durations = operations.map(op => op.duration).sort((a, b) => a - b);
    
    const min = durations[0];
    const max = durations[durations.length - 1];
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const median = this.calculatePercentile(durations, 50);
    
    // Calculate standard deviation
    const variance = durations.reduce((sum, d) => {
      return sum + Math.pow(d - mean, 2);
    }, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate percentiles
    const percentiles: Record<number, number> = {};
    for (const p of this.config.percentiles) {
      percentiles[p] = this.calculatePercentile(durations, p);
    }
    
    return {
      min,
      max,
      mean,
      median,
      stdDev,
      percentiles,
    };
  }

  /**
   * Calculate throughput statistics
   */
  private calculateThroughputStats(
    operations: OperationMetrics[],
    periodMs: number
  ): PerformanceSummary['throughput'] {
    const periodSeconds = periodMs / 1000;
    const totalOps = operations.length;
    const totalBytes = operations.reduce((sum, op) => sum + (op.size || 0), 0);
    
    // Calculate peak throughput (ops per second in 1-second windows)
    const windows = new Map<number, { ops: number; bytes: number }>();
    
    for (const op of operations) {
      const windowStart = Math.floor(op.startTime / 1000) * 1000;
      const window = windows.get(windowStart) || { ops: 0, bytes: 0 };
      window.ops++;
      window.bytes += op.size || 0;
      windows.set(windowStart, window);
    }
    
    let peakOps = 0;
    let peakBytes = 0;
    
    for (const window of windows.values()) {
      peakOps = Math.max(peakOps, window.ops);
      peakBytes = Math.max(peakBytes, window.bytes);
    }
    
    return {
      operationsPerSecond: totalOps / periodSeconds,
      bytesPerSecond: totalBytes / periodSeconds,
      peakOps,
      peakBytes,
    };
  }

  /**
   * Calculate error statistics
   */
  private calculateErrorStats(
    operations: OperationMetrics[]
  ): PerformanceSummary['errors'] {
    const errors = operations.filter(op => !op.success);
    const byType: Record<string, number> = {};
    
    for (const error of errors) {
      const type = error.error || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }
    
    return {
      count: errors.length,
      rate: operations.length > 0 ? errors.length / operations.length : 0,
      byType,
    };
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Start trace
   */
  private startTrace(operationId: string, type: string): void {
    const trace: PerformanceTrace = {
      traceId: `trace-${operationId}`,
      operationId,
      spans: [{
        name: type,
        startTime: performance.now(),
        endTime: 0,
        duration: 0,
      }],
      totalDuration: 0,
      metadata: {
        type,
        timestamp: Date.now(),
      },
    };
    
    this.traces.set(operationId, trace);
  }

  /**
   * End trace
   */
  private endTrace(operationId: string): void {
    const trace = this.traces.get(operationId);
    if (!trace || trace.spans.length === 0) return;
    
    const mainSpan = trace.spans[0];
    mainSpan.endTime = performance.now();
    mainSpan.duration = mainSpan.endTime - mainSpan.startTime;
    trace.totalDuration = mainSpan.duration;
    
    // Keep only recent traces
    if (this.traces.size > 100) {
      const oldest = Array.from(this.traces.entries())
        .sort((a, b) => a[1].metadata.timestamp - b[1].metadata.timestamp)[0];
      this.traces.delete(oldest[0]);
    }
  }

  /**
   * Handle slow operation
   */
  private handleSlowOperation(operation: OperationMetrics): void {
    logger.warn(`Slow operation detected: ${operation.type} took ${operation.duration.toFixed(0)}ms`);
    
    this.eventBus?.emit('performance:slowOperation', {
      operation,
      threshold: this.config.slowOperationThreshold,
    });
  }

  /**
   * Analyze slow operation reason
   */
  private analyzeSlowReason(operation: OperationMetrics): string {
    if (operation.size && operation.size > 10 * 1024 * 1024) {
      return 'Large file size';
    }
    
    if (operation.type === 'load' && !operation.metadata?.cached) {
      return 'Network fetch required';
    }
    
    if (operation.error) {
      return 'Error during operation';
    }
    
    return 'Unknown';
  }

  /**
   * Identify bottlenecks
   */
  private identifyBottlenecks(): BottleneckAnalysis['bottlenecks'] {
    const bottlenecks: BottleneckAnalysis['bottlenecks'] = [];
    const summary = this.getSummary();
    
    // Check for high latency
    if (summary.latency.percentiles[95] > 1000) {
      bottlenecks.push({
        type: 'network',
        severity: 'high',
        impact: 0.8,
        affectedOperations: this.operations.filter(op => op.duration > 1000).length,
        description: 'High network latency detected',
        recommendation: 'Consider using a CDN or edge storage',
      });
    }
    
    // Check for high error rate
    if (summary.errors.rate > 0.05) {
      bottlenecks.push({
        type: 'network',
        severity: 'medium',
        impact: summary.errors.rate,
        affectedOperations: summary.errors.count,
        description: 'High error rate in storage operations',
        recommendation: 'Check network stability and storage service health',
      });
    }
    
    // Check for cache misses
    const cacheMisses = this.operations.filter(
      op => op.type === 'cache_miss'
    ).length;
    const cacheTotal = this.operations.filter(
      op => op.type === 'cache_hit' || op.type === 'cache_miss'
    ).length;
    
    if (cacheTotal > 0 && cacheMisses / cacheTotal > 0.3) {
      bottlenecks.push({
        type: 'cache',
        severity: 'low',
        impact: 0.3,
        affectedOperations: cacheMisses,
        description: 'Low cache hit rate',
        recommendation: 'Increase cache size or improve preloading strategy',
      });
    }
    
    return bottlenecks;
  }

  /**
   * Export metrics
   */
  exportMetrics(): {
    operations: OperationMetrics[];
    summary: PerformanceSummary;
    bottlenecks: BottleneckAnalysis;
  } {
    return {
      operations: [...this.operations],
      summary: this.getSummary(),
      bottlenecks: this.analyzeBottlenecks(),
    };
  }

  /**
   * Get real-time stats
   */
  getRealTimeStats(): {
    activeOperations: number;
    opsPerSecond: number;
    bytesPerSecond: number;
    avgLatency: number;
  } {
    const now = performance.now();
    const recentOps = this.operations.filter(
      op => now - op.endTime < 1000
    );
    
    const totalBytes = recentOps.reduce((sum, op) => sum + (op.size || 0), 0);
    const avgLatency = recentOps.length > 0
      ? recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length
      : 0;
    
    return {
      activeOperations: this.currentOperations.size,
      opsPerSecond: recentOps.length,
      bytesPerSecond: totalBytes,
      avgLatency,
    };
  }
}