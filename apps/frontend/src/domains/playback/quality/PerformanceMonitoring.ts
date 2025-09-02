/**
 * PerformanceMonitoring - Production performance tracking
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Monitors audio performance metrics in production
 */

import { EventBus } from '../services/core/EventBus.js';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
}

export interface PerformanceReport {
  timestamp: number;
  duration: number;
  metrics: {
    audioLatency: number;
    dropoutRate: number;
    initializationTime: number;
    memoryUsage: number;
    cpuUsage: number;
    bufferUnderruns: number;
    contextSuspensions: number;
    errorRate: number;
  };
  violations: ThresholdViolation[];
  health: 'healthy' | 'degraded' | 'critical';
}

export interface ThresholdViolation {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: number;
}

export class PerformanceMonitoring {
  private eventBus: EventBus;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: PerformanceThreshold[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private startTime = 0;

  // Counters
  private dropoutCount = 0;
  private bufferUnderrunCount = 0;
  private contextSuspensionCount = 0;
  private errorCount = 0;
  private operationCount = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.initializeThresholds();
    this.setupEventListeners();
  }

  /**
   * Initialize performance thresholds
   */
  private initializeThresholds(): void {
    this.thresholds = [
      { metric: 'audioLatency', warning: 50, critical: 100 }, // ms
      { metric: 'dropoutRate', warning: 0.01, critical: 0.05 }, // 1%, 5%
      { metric: 'initializationTime', warning: 2000, critical: 5000 }, // ms
      { metric: 'memoryUsage', warning: 200, critical: 500 }, // MB
      { metric: 'cpuUsage', warning: 50, critical: 80 }, // %
      { metric: 'bufferUnderruns', warning: 5, critical: 20 }, // count per minute
      { metric: 'contextSuspensions', warning: 2, critical: 10 }, // count per minute
      { metric: 'errorRate', warning: 0.01, critical: 0.05 }, // 1%, 5%
    ];
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.startTime = Date.now();
    this.resetCounters();

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.eventBus.emit('performance:monitoring-started', {
      timestamp: this.startTime,
      interval: intervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.eventBus.emit('performance:monitoring-stopped', {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
    });
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();
    const duration = (timestamp - this.startTime) / 1000; // seconds

    // Calculate rates
    const dropoutRate =
      this.operationCount > 0 ? this.dropoutCount / this.operationCount : 0;
    const errorRate =
      this.operationCount > 0 ? this.errorCount / this.operationCount : 0;

    // Per minute rates
    const minutesSinceStart = duration / 60;
    const bufferUnderrunsPerMinute =
      minutesSinceStart > 0 ? this.bufferUnderrunCount / minutesSinceStart : 0;
    const suspensionsPerMinute =
      minutesSinceStart > 0
        ? this.contextSuspensionCount / minutesSinceStart
        : 0;

    // Get system metrics
    const audioLatency = await this.getAudioLatency();
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = await this.estimateCPUUsage();
    const initTime = this.getAverageInitTime();

    // Store metrics
    this.recordMetric('audioLatency', audioLatency, 'ms');
    this.recordMetric('dropoutRate', dropoutRate * 100, '%');
    this.recordMetric('initializationTime', initTime, 'ms');
    this.recordMetric('memoryUsage', memoryUsage, 'MB');
    this.recordMetric('cpuUsage', cpuUsage, '%');
    this.recordMetric(
      'bufferUnderruns',
      bufferUnderrunsPerMinute,
      'per minute',
    );
    this.recordMetric('contextSuspensions', suspensionsPerMinute, 'per minute');
    this.recordMetric('errorRate', errorRate * 100, '%');

    // Generate report
    const report: PerformanceReport = {
      timestamp,
      duration,
      metrics: {
        audioLatency,
        dropoutRate,
        initializationTime: initTime,
        memoryUsage,
        cpuUsage,
        bufferUnderruns: bufferUnderrunsPerMinute,
        contextSuspensions: suspensionsPerMinute,
        errorRate,
      },
      violations: this.checkThresholds({
        audioLatency,
        dropoutRate,
        initializationTime: initTime,
        memoryUsage,
        cpuUsage,
        bufferUnderruns: bufferUnderrunsPerMinute,
        contextSuspensions: suspensionsPerMinute,
        errorRate,
      }),
      health: 'healthy',
    };

    // Determine health status
    const criticalViolations = report.violations.filter(
      (v) => v.severity === 'critical',
    );
    const warningViolations = report.violations.filter(
      (v) => v.severity === 'warning',
    );

    if (criticalViolations.length > 0) {
      report.health = 'critical';
    } else if (warningViolations.length > 0) {
      report.health = 'degraded';
    }

    // Emit report
    this.eventBus.emit('performance:report', report);

    // Reset per-interval counters
    this.resetIntervalCounters();
  }

  /**
   * Record a metric
   */
  private recordMetric(name: string, value: number, unit: string): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 100 entries
    if (metricHistory.length > 100) {
      metricHistory.shift();
    }
  }

  /**
   * Check thresholds
   */
  private checkThresholds(
    metrics: Record<string, number>,
  ): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];

    for (const threshold of this.thresholds) {
      const value = metrics[threshold.metric];
      if (value === undefined) continue;

      if (value >= threshold.critical) {
        violations.push({
          metric: threshold.metric,
          value,
          threshold: threshold.critical,
          severity: 'critical',
          timestamp: Date.now(),
        });
      } else if (value >= threshold.warning) {
        violations.push({
          metric: threshold.metric,
          value,
          threshold: threshold.warning,
          severity: 'warning',
          timestamp: Date.now(),
        });
      }
    }

    return violations;
  }

  /**
   * Get audio latency
   */
  private async getAudioLatency(): Promise<number> {
    try {
      const context = (window as any).audioContext;
      if (context) {
        return (context.baseLatency + context.outputLatency) * 1000; // Convert to ms
      }
    } catch {
      // Ignore errors
    }
    return 0;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Estimate CPU usage
   */
  private async estimateCPUUsage(): Promise<number> {
    // This is a rough estimate based on main thread blocking
    const start = performance.now();
    let iterations = 0;

    // Run for 10ms
    while (performance.now() - start < 10) {
      iterations++;
    }

    // Baseline is ~100000 iterations in 10ms on a typical CPU
    const baseline = 100000;
    const usage = Math.max(0, 100 - (iterations / baseline) * 100);

    return Math.min(100, usage);
  }

  /**
   * Get average initialization time
   */
  private getAverageInitTime(): number {
    const initMetrics = this.metrics.get('initialization');
    if (!initMetrics || initMetrics.length === 0) return 0;

    const sum = initMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / initMetrics.length;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Track audio events
    this.eventBus.on(
      'audio:initialization-success',
      ({ attempts, duration }) => {
        if (duration) {
          this.recordMetric('initialization', duration, 'ms');
        }
      },
    );

    this.eventBus.on('audio:dropout', () => {
      this.dropoutCount++;
    });

    this.eventBus.on('audio:buffer-underrun', () => {
      this.bufferUnderrunCount++;
    });

    this.eventBus.on('audio:state-changed', ({ state }) => {
      if (state === 'suspended') {
        this.contextSuspensionCount++;
      }
    });

    this.eventBus.on('audio:error', () => {
      this.errorCount++;
    });

    this.eventBus.on('audio:operation', () => {
      this.operationCount++;
    });
  }

  /**
   * Reset all counters
   */
  private resetCounters(): void {
    this.dropoutCount = 0;
    this.bufferUnderrunCount = 0;
    this.contextSuspensionCount = 0;
    this.errorCount = 0;
    this.operationCount = 0;
  }

  /**
   * Reset per-interval counters
   */
  private resetIntervalCounters(): void {
    // Keep cumulative counts but reset rate calculations
  }

  /**
   * Get current metrics
   */
  getMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit?: number): PerformanceMetric[] {
    const history = this.metrics.get(name) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const data = {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
      metrics: Object.fromEntries(this.metrics),
      counters: {
        dropouts: this.dropoutCount,
        bufferUnderruns: this.bufferUnderrunCount,
        contextSuspensions: this.contextSuspensionCount,
        errors: this.errorCount,
        operations: this.operationCount,
      },
    };

    return JSON.stringify(data, null, 2);
  }
}
