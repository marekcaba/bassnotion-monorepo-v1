/**
 * PerformanceError - Specialized errors for performance threshold violations
 *
 * Handles NFR compliance violations, latency issues, and system performance
 * problems with specific monitoring and recovery strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorRecoveryAction,
  createErrorContext,
} from './base';

export enum PerformanceErrorCode {
  // NFR violations
  LATENCY_THRESHOLD_EXCEEDED = 'PERF_LATENCY_THRESHOLD_EXCEEDED', // NFR-PO-15: >50ms
  RESPONSE_TIME_EXCEEDED = 'PERF_RESPONSE_TIME_EXCEEDED', // NFR-PF-04: >200ms
  BATTERY_DRAIN_EXCEEDED = 'PERF_BATTERY_DRAIN_EXCEEDED', // NFR-PO-16: >5%/hour

  // Audio performance
  AUDIO_DROPOUTS_DETECTED = 'PERF_AUDIO_DROPOUTS_DETECTED',
  BUFFER_UNDERRUN = 'PERF_BUFFER_UNDERRUN',
  SAMPLE_RATE_MISMATCH = 'PERF_SAMPLE_RATE_MISMATCH',

  // System performance
  CPU_USAGE_HIGH = 'PERF_CPU_USAGE_HIGH',
  MEMORY_USAGE_HIGH = 'PERF_MEMORY_USAGE_HIGH',
  MEMORY_LEAK_DETECTED = 'PERF_MEMORY_LEAK_DETECTED',

  // Network performance
  NETWORK_LATENCY_HIGH = 'PERF_NETWORK_LATENCY_HIGH',
  ASSET_LOADING_SLOW = 'PERF_ASSET_LOADING_SLOW',
  CDN_CACHE_MISS = 'PERF_CDN_CACHE_MISS',

  // Monitoring failures
  METRICS_COLLECTION_FAILED = 'PERF_METRICS_COLLECTION_FAILED',
  PERFORMANCE_MONITOR_FAILED = 'PERF_MONITOR_FAILED',
}

export class PerformanceError extends PlaybackError {
  public readonly performanceMetrics?: Record<string, number>;
  public threshold?: number;
  public measuredValue?: number;
  public nfrViolation?: {
    requirement: string;
    threshold: number;
    measured: number;
    severity: 'warning' | 'violation';
  };

  constructor(
    code: PerformanceErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const recoveryActions = getPerformanceRecoveryActions(code);
    const severity = getPerformanceSeverity(code, context.performanceMetrics);

    const errorDetails: ErrorDetails = {
      code,
      message,
      severity,
      category: ErrorCategory.PERFORMANCE,
      context: createErrorContext(context),
      recoveryActions,
      userMessage: getPerformanceUserMessage(code),
      technicalMessage: getPerformanceTechnicalMessage(code, message),
      documentationUrl: getPerformanceDocumentationUrl(code),
    };

    super(errorDetails, cause);
    this.name = 'PerformanceError';

    this.performanceMetrics = context.performanceMetrics;
    this.extractPerformanceContext(code, context);
  }

  private extractPerformanceContext(
    code: PerformanceErrorCode,
    context: Partial<ErrorContext>,
  ): void {
    const metrics = context.performanceMetrics;
    if (!metrics) return;

    switch (code) {
      case PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED:
        this.threshold = 50; // NFR-PO-15
        this.measuredValue = metrics.latency;
        this.nfrViolation = {
          requirement: 'NFR-PO-15',
          threshold: 50,
          measured: metrics.latency || 0,
          severity: (metrics.latency || 0) > 100 ? 'violation' : 'warning',
        };
        break;

      case PerformanceErrorCode.RESPONSE_TIME_EXCEEDED:
        this.threshold = 200; // NFR-PF-04
        this.measuredValue = metrics.responseTime;
        this.nfrViolation = {
          requirement: 'NFR-PF-04',
          threshold: 200,
          measured: metrics.responseTime || 0,
          severity: (metrics.responseTime || 0) > 400 ? 'violation' : 'warning',
        };
        break;

      case PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED:
        this.threshold = 5; // NFR-PO-16: <5% per hour
        this.measuredValue = metrics.batteryDrain;
        this.nfrViolation = {
          requirement: 'NFR-PO-16',
          threshold: 5,
          measured: metrics.batteryDrain || 0,
          severity: (metrics.batteryDrain || 0) > 10 ? 'violation' : 'warning',
        };
        break;
    }
  }
}

function getPerformanceRecoveryActions(
  code: PerformanceErrorCode,
): ErrorRecoveryAction[] {
  const actions: ErrorRecoveryAction[] = [];

  switch (code) {
    case PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED:
      actions.push({
        type: 'degrade',
        description: 'Increase buffer size to reduce latency spikes',
        automatic: true,
        priority: 9,
        estimatedTime: 1000,
      });
      actions.push({
        type: 'degrade',
        description: 'Reduce polyphony to lower processing load',
        automatic: true,
        priority: 8,
      });
      break;

    case PerformanceErrorCode.CPU_USAGE_HIGH:
      actions.push({
        type: 'degrade',
        description: 'Reduce audio quality to lower CPU usage',
        automatic: true,
        priority: 8,
      });
      actions.push({
        type: 'degrade',
        description: 'Disable non-essential audio effects',
        automatic: true,
        priority: 7,
      });
      break;

    case PerformanceErrorCode.MEMORY_USAGE_HIGH:
      actions.push({
        type: 'degrade',
        description: 'Clear audio buffer cache',
        automatic: true,
        priority: 9,
        estimatedTime: 500,
      });
      actions.push({
        type: 'degrade',
        description: 'Reduce sample rate',
        automatic: true,
        priority: 6,
      });
      break;

    case PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED:
      actions.push({
        type: 'degrade',
        description: 'Enable battery saver mode',
        automatic: true,
        priority: 8,
      });
      break;

    default:
      actions.push({
        type: 'retry',
        description: 'Restart performance monitoring',
        automatic: true,
        priority: 5,
        estimatedTime: 1000,
      });
  }

  return actions;
}

function getPerformanceSeverity(
  code: PerformanceErrorCode,
  metrics?: Record<string, number>,
): ErrorSeverity {
  // Critical NFR violations
  if (
    code === PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED &&
    metrics?.latency &&
    metrics.latency > 100
  ) {
    return ErrorSeverity.CRITICAL;
  }

  if (
    code === PerformanceErrorCode.RESPONSE_TIME_EXCEEDED &&
    metrics?.responseTime &&
    metrics.responseTime > 500
  ) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity issues
  const highSeverityErrors = [
    PerformanceErrorCode.BUFFER_UNDERRUN,
    PerformanceErrorCode.MEMORY_LEAK_DETECTED,
    PerformanceErrorCode.AUDIO_DROPOUTS_DETECTED,
  ];

  if (highSeverityErrors.includes(code)) {
    return ErrorSeverity.HIGH;
  }

  return ErrorSeverity.MEDIUM;
}

function getPerformanceUserMessage(code: PerformanceErrorCode): string {
  switch (code) {
    case PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED:
      return 'Audio latency is higher than optimal. Consider closing other applications for better performance.';

    case PerformanceErrorCode.CPU_USAGE_HIGH:
      return 'High CPU usage detected. Audio quality may be reduced to maintain smooth playback.';

    case PerformanceErrorCode.MEMORY_USAGE_HIGH:
      return 'High memory usage detected. Some audio features may be temporarily disabled.';

    case PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED:
      return 'High battery usage detected. Battery saver mode has been enabled.';

    default:
      return 'Performance issue detected. Audio quality may be automatically adjusted.';
  }
}

function getPerformanceTechnicalMessage(
  code: PerformanceErrorCode,
  originalMessage: string,
): string {
  return `${code}: ${originalMessage}`;
}

function getPerformanceDocumentationUrl(code: PerformanceErrorCode): string {
  const baseUrl = '/docs/troubleshooting/performance';

  switch (code) {
    case PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED:
      return `${baseUrl}#latency-optimization`;

    case PerformanceErrorCode.CPU_USAGE_HIGH:
      return `${baseUrl}#cpu-optimization`;

    case PerformanceErrorCode.MEMORY_USAGE_HIGH:
      return `${baseUrl}#memory-optimization`;

    default:
      return `${baseUrl}#general-performance`;
  }
}

export function createPerformanceError(
  code: PerformanceErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): PerformanceError {
  const context: Partial<ErrorContext> = {
    currentOperation: 'Performance monitoring',
    ...additionalContext,
  };

  return new PerformanceError(code, message, context, cause);
}
