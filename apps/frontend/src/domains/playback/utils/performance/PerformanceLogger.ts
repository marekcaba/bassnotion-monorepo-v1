/**
 * Performance-Aware Logging for Playback Domain
 *
 * Integrates performance metrics with structured logging
 */

import {
  createStructuredLogger,
  StructuredLogger,
} from '@bassnotion/contracts';
import { MetricsCollector } from '../../services/monitoring/MetricsCollector.js';
import { EventBus } from '../../services/core/EventBus.js';
import { ProductionLogger } from '../../services/logging/ProductionLogger.js';

export interface PerformanceContext {
  operation: string;
  component: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  excellent: number; // < excellent = 🟢
  good: number; // < good = 🟡
  acceptable: number; // < acceptable = 🟠
  // >= acceptable = 🔴
}

export interface PerformanceLogEntry {
  timestamp: number;
  operation: string;
  component: string;
  duration: number;
  status: 'excellent' | 'good' | 'acceptable' | 'poor';
  memoryUsed?: number;
  cpuUsage?: number;
  metadata?: Record<string, any>;
}

/**
 * Default performance thresholds for common operations (in ms)
 */
export const DEFAULT_THRESHOLDS: Record<string, PerformanceThresholds> = {
  // Audio operations
  'audio.init': { excellent: 100, good: 300, acceptable: 500 },
  'audio.context.start': { excellent: 50, good: 100, acceptable: 200 },
  'audio.buffer.decode': { excellent: 50, good: 150, acceptable: 300 },

  // Sample loading
  'sample.load': { excellent: 100, good: 300, acceptable: 500 },
  'sample.cache.hit': { excellent: 1, good: 5, acceptable: 10 },
  'sample.cache.miss': { excellent: 100, good: 300, acceptable: 500 },

  // MIDI processing
  'midi.parse': { excellent: 10, good: 50, acceptable: 100 },
  'midi.validate': { excellent: 5, good: 20, acceptable: 50 },
  'midi.transform': { excellent: 10, good: 30, acceptable: 60 },

  // Instrument operations
  'instrument.init': { excellent: 100, good: 300, acceptable: 500 },
  'instrument.trigger': { excellent: 1, good: 5, acceptable: 10 },
  'instrument.release': { excellent: 1, good: 3, acceptable: 5 },

  // Pattern/sequence operations
  'pattern.schedule': { excellent: 5, good: 15, acceptable: 30 },
  'sequence.start': { excellent: 10, good: 30, acceptable: 50 },

  // Effects processing
  'effects.apply': { excellent: 1, good: 5, acceptable: 10 },
  'effects.chain.rebuild': { excellent: 10, good: 30, acceptable: 50 },

  // Default for unknown operations
  default: { excellent: 50, good: 150, acceptable: 300 },
};

/**
 * Performance-aware logger that integrates metrics with logging
 */
export class PerformanceLogger {
  private logger: StructuredLogger;
  private metrics: MetricsCollector | null;
  private thresholds: Map<string, PerformanceThresholds>;
  private performanceBuffer: PerformanceLogEntry[] = [];
  private bufferSize = 1000;

  constructor(
    component: string,
    customThresholds?: Record<string, PerformanceThresholds>,
  ) {
    this.logger = createStructuredLogger(`playback:perf:${component}`);
    this.thresholds = new Map(
      Object.entries({
        ...DEFAULT_THRESHOLDS,
        ...customThresholds,
      }),
    );

    // Try to get metrics collector
    try {
      const eventBus = EventBus.getInstance();
      const prodLogger = new ProductionLogger(eventBus, { enabled: true });
      this.metrics = MetricsCollector.getInstance(eventBus, prodLogger);
    } catch {
      this.metrics = null;
    }
  }

  /**
   * Start a performance measurement
   */
  startOperation(context: PerformanceContext): PerformanceOperation {
    return new PerformanceOperation(this, context);
  }

  /**
   * Log performance measurement
   */
  logPerformance(
    context: PerformanceContext,
    duration: number,
    additionalData?: Record<string, any>,
  ): void {
    const thresholds = this.getThresholds(context.operation);
    const status = this.getPerformanceStatus(duration, thresholds);
    const level = this.getLogLevel(status);

    // Create performance entry
    const entry: PerformanceLogEntry = {
      timestamp: Date.now(),
      operation: context.operation,
      component: context.component,
      duration,
      status,
      metadata: { ...context.metadata, ...additionalData },
    };

    // Add memory usage if available
    if (performance.memory) {
      entry.memoryUsed = performance.memory.usedJSHeapSize;
    }

    // Buffer the entry
    this.addToBuffer(entry);

    // Log with appropriate level
    this.logger[level](`Performance: ${context.operation}`, {
      duration,
      status,
      correlationId: context.correlationId,
      ...additionalData,
    });

    // Record metrics
    if (this.metrics) {
      this.metrics.timing(
        `playback.${context.component}.${context.operation}`,
        duration,
        {
          status,
          component: context.component,
        },
      );

      // Track performance status distribution
      this.metrics.increment(`playback.performance.status.${status}`, 1, {
        operation: context.operation,
      });
    }

    // Emit event for poor performance
    if (status === 'poor') {
      this.emitPerformanceWarning(entry);
    }
  }

  /**
   * Get performance thresholds for an operation
   */
  private getThresholds(operation: string): PerformanceThresholds {
    return this.thresholds.get(operation) || this.thresholds.get('default')!;
  }

  /**
   * Determine performance status based on duration
   */
  private getPerformanceStatus(
    duration: number,
    thresholds: PerformanceThresholds,
  ): PerformanceLogEntry['status'] {
    if (duration < thresholds.excellent) return 'excellent';
    if (duration < thresholds.good) return 'good';
    if (duration < thresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  /**
   * Get log level based on performance status
   */
  private getLogLevel(
    status: PerformanceLogEntry['status'],
  ): keyof StructuredLogger {
    switch (status) {
      case 'excellent':
      case 'good':
        return 'debug';
      case 'acceptable':
        return 'info';
      case 'poor':
        return 'warn';
    }
  }

  /**
   * Add entry to buffer
   */
  private addToBuffer(entry: PerformanceLogEntry): void {
    this.performanceBuffer.push(entry);

    if (this.performanceBuffer.length > this.bufferSize) {
      this.performanceBuffer.shift();
    }
  }

  /**
   * Emit performance warning event
   */
  private emitPerformanceWarning(entry: PerformanceLogEntry): void {
    try {
      const eventBus = EventBus.getInstance();
      eventBus.emit('playback:performance:warning', {
        entry,
        threshold: this.getThresholds(entry.operation),
      });
    } catch {
      // Ignore if EventBus not available
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(operation?: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    statusDistribution: Record<string, number>;
  } {
    const entries = operation
      ? this.performanceBuffer.filter((e) => e.operation === operation)
      : this.performanceBuffer;

    if (entries.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        statusDistribution: {},
      };
    }

    const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    const statusCounts = entries.reduce(
      (acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      count: entries.length,
      average: sum / entries.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      statusDistribution: statusCounts,
    };
  }

  /**
   * Get recent poor performance entries
   */
  getPoorPerformanceEntries(limit = 10): PerformanceLogEntry[] {
    return this.performanceBuffer
      .filter((e) => e.status === 'poor')
      .slice(-limit);
  }

  /**
   * Clear performance buffer
   */
  clearBuffer(): void {
    this.performanceBuffer = [];
  }
}

/**
 * Represents an ongoing performance measurement
 */
export class PerformanceOperation {
  private logger: PerformanceLogger;
  private context: PerformanceContext;
  private startTime: number;
  private startMemory?: number;
  private checkpoints: Map<string, number> = new Map();

  constructor(logger: PerformanceLogger, context: PerformanceContext) {
    this.logger = logger;
    this.context = context;
    this.startTime = performance.now();

    if (performance.memory) {
      this.startMemory = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Add a checkpoint
   */
  checkpoint(name: string): void {
    const elapsed = performance.now() - this.startTime;
    this.checkpoints.set(name, elapsed);

    this.logger['logger'].debug(`Checkpoint: ${name}`, {
      operation: this.context.operation,
      elapsed,
      correlationId: this.context.correlationId,
    });
  }

  /**
   * Complete the operation and log performance
   */
  complete(additionalData?: Record<string, any>): void {
    const duration = performance.now() - this.startTime;

    const data: Record<string, any> = {
      ...additionalData,
      checkpoints: Object.fromEntries(this.checkpoints),
    };

    if (this.startMemory && performance.memory) {
      data.memoryDelta = performance.memory.usedJSHeapSize - this.startMemory;
    }

    this.logger.logPerformance(this.context, duration, data);
  }

  /**
   * Mark operation as failed
   */
  fail(error: Error, additionalData?: Record<string, any>): void {
    const duration = performance.now() - this.startTime;

    this.logger.logPerformance(this.context, duration, {
      ...additionalData,
      error: error.message,
      errorType: error.name,
      checkpoints: Object.fromEntries(this.checkpoints),
    });
  }
}

/**
 * Create a performance logger instance
 */
export function createPerformanceLogger(
  component: string,
  customThresholds?: Record<string, PerformanceThresholds>,
): PerformanceLogger {
  return new PerformanceLogger(component, customThresholds);
}
