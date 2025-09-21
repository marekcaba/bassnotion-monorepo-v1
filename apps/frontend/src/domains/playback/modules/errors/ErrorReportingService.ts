/**
 * Enhanced Error Reporting Service
 * Phase 5.2.4: Comprehensive error reporting for playback domain
 *
 * Builds upon the existing ErrorReporter with additional features:
 * - Error categorization and deduplication
 * - Error trend analysis
 * - Integration with monitoring services
 * - Detailed error context collection
 */

import { EventBus } from '../../services/core/EventBus.js';
import { ErrorReporter } from '../../services/errors/ErrorReporter.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { MetricsCollector } from '../../services/monitoring/MetricsCollector.js';
import {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  AudioError,
  InstrumentError,
  MidiError,
  StorageError,
  TransportError,
  getErrorMessage,
  getErrorSeverity,
  isRecoverableError,
} from './index.js';

const logger = createStructuredLogger('ErrorReportingService');

/**
 * Error report with enhanced metadata
 */
export interface ErrorReport {
  id: string;
  timestamp: number;
  error: {
    type: string;
    code: string;
    message: string;
    userMessage: string;
    technicalMessage: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    recoverable: boolean;
  };
  context: {
    component?: string;
    operation?: string;
    correlationId?: string;
    sessionId?: string;
    userId?: string;
    audioState?: any;
    performanceMetrics?: any;
  };
  stack?: string;
  fingerprint: string;
  occurrenceCount: number;
  firstOccurrence: number;
  lastOccurrence: number;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Error deduplication entry
 */
interface ErrorDeduplication {
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  lastReported: number;
}

/**
 * Error trend data
 */
interface ErrorTrend {
  period: '1h' | '24h' | '7d';
  errorCounts: Map<string, number>;
  severityCounts: Map<ErrorSeverity, number>;
  categoryCounts: Map<ErrorCategory, number>;
  topErrors: Array<{ code: string; count: number }>;
}

/**
 * Configuration for error reporting
 */
export interface ErrorReportingConfig {
  enableDeduplication?: boolean;
  deduplicationWindow?: number; // ms
  reportingThreshold?: number; // min occurrences before reporting
  trendAnalysisEnabled?: boolean;
  remoteReportingEnabled?: boolean;
  remoteEndpoint?: string;
  batchReporting?: boolean;
  batchSize?: number;
  batchInterval?: number; // ms
  sensitiveDataFilter?: (data: any) => any;
}

/**
 * Enhanced error reporting service
 */
export class ErrorReportingService {
  private eventBus: EventBus;
  private metricsCollector: MetricsCollector;
  private config: Required<ErrorReportingConfig>;
  private deduplicationMap = new Map<string, ErrorDeduplication>();
  private errorReports = new Map<string, ErrorReport>();
  private reportBatch: ErrorReport[] = [];
  private batchTimer?: NodeJS.Timeout;
  private trendData = new Map<string, ErrorTrend>();

  constructor(
    eventBus: EventBus,
    metricsCollector: MetricsCollector,
    config: ErrorReportingConfig = {},
  ) {
    this.eventBus = eventBus;
    this.metricsCollector = metricsCollector;

    this.config = {
      enableDeduplication: true,
      deduplicationWindow: 5 * 60 * 1000, // 5 minutes
      reportingThreshold: 1,
      trendAnalysisEnabled: true,
      remoteReportingEnabled: false,
      remoteEndpoint: '/api/errors',
      batchReporting: true,
      batchSize: 10,
      batchInterval: 30000, // 30 seconds
      sensitiveDataFilter: (data) => data,
      ...config,
    };

    this.setupEventListeners();
    this.startBatchReporting();

    if (this.config.trendAnalysisEnabled) {
      this.startTrendAnalysis();
    }
  }

  /**
   * Report an error
   */
  async reportError(
    error: Error,
    context?: Record<string, any>,
  ): Promise<string> {
    try {
      // Create error report
      const report = this.createErrorReport(error, context);

      // Check deduplication
      if (this.config.enableDeduplication && this.isDuplicate(report)) {
        this.updateDuplicateCount(report);
        return report.id;
      }

      // Store report
      this.errorReports.set(report.id, report);

      // Update metrics
      this.updateMetrics(report);

      // Emit event
      this.eventBus.emit('error:reported', {
        reportId: report.id,
        error: report.error,
        severity: report.error.severity,
      });

      // Add to batch or report immediately
      if (this.config.batchReporting) {
        this.addToBatch(report);
      } else {
        await this.sendReport(report);
      }

      // Log based on severity
      this.logError(report);

      return report.id;
    } catch (reportingError) {
      logger.error('Failed to report error', reportingError as Error);
      return 'error-reporting-failed';
    }
  }

  /**
   * Create comprehensive error report
   */
  private createErrorReport(
    error: Error,
    context?: Record<string, any>,
  ): ErrorReport {
    const id = this.generateReportId();
    const fingerprint = this.generateFingerprint(error);
    const timestamp = Date.now();

    // Determine error type and extract metadata
    const errorType = this.getErrorType(error);
    const errorMetadata = this.extractErrorMetadata(error);

    // Get or create deduplication entry
    const dedup = this.deduplicationMap.get(fingerprint) || {
      fingerprint,
      count: 0,
      firstSeen: timestamp,
      lastSeen: timestamp,
      lastReported: 0,
    };

    const report: ErrorReport = {
      id,
      timestamp,
      error: {
        type: errorType,
        code: this.getErrorCode(error),
        message: error.message,
        userMessage: getErrorMessage(error),
        technicalMessage: this.getTechnicalMessage(error),
        severity: getErrorSeverity(error),
        category: this.getErrorCategory(error),
        recoverable: isRecoverableError(error),
      },
      context: {
        ...context,
        ...errorMetadata.context,
      },
      stack: this.sanitizeStack(error.stack),
      fingerprint,
      occurrenceCount: dedup.count + 1,
      firstOccurrence: dedup.firstSeen,
      lastOccurrence: timestamp,
      tags: this.generateTags(error, context),
      metadata: this.config.sensitiveDataFilter(errorMetadata.metadata),
    };

    return report;
  }

  /**
   * Get error type
   */
  private getErrorType(error: Error): string {
    if (error instanceof InstrumentError) return 'InstrumentError';
    if (error instanceof MidiError) return 'MidiError';
    if (error instanceof StorageError) return 'StorageError';
    if (error instanceof TransportError) return 'TransportError';
    if (error instanceof AudioError) return 'AudioError';
    if (error instanceof PlaybackError) return 'PlaybackError';
    return error.constructor.name || 'Error';
  }

  /**
   * Get error code
   */
  private getErrorCode(error: Error): string {
    if (error instanceof PlaybackError) return error.code;
    if (error instanceof AudioError) return error.code;
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get error category
   */
  private getErrorCategory(error: Error): ErrorCategory {
    if (error instanceof PlaybackError) return error.category;
    if (error instanceof InstrumentError) return ErrorCategory.RESOURCE;
    if (error instanceof MidiError) return ErrorCategory.VALIDATION;
    if (error instanceof StorageError) return ErrorCategory.NETWORK;
    if (error instanceof TransportError) return ErrorCategory.AUDIO_CONTEXT;
    if (error instanceof AudioError) return ErrorCategory.AUDIO_CONTEXT;
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get technical message
   */
  private getTechnicalMessage(error: Error): string {
    if (error instanceof PlaybackError) return error.getTechnicalMessage();
    return error.message;
  }

  /**
   * Extract error-specific metadata
   */
  private extractErrorMetadata(error: Error): {
    context: Record<string, any>;
    metadata: Record<string, any>;
  } {
    const context: Record<string, any> = {};
    const metadata: Record<string, any> = {};

    if (error instanceof InstrumentError) {
      context.instrumentType = error.instrumentType;
      context.instrumentId = error.instrumentId;
    } else if (error instanceof MidiError) {
      metadata.midiContext = (error as any).context;
    } else if (error instanceof StorageError) {
      metadata.storageContext = (error as any).context;
    } else if (error instanceof TransportError) {
      metadata.transportContext = (error as any).context;
    } else if (error instanceof PlaybackError) {
      context.playbackContext = error.context;
      metadata.recoveryActions = error.recoveryActions;
    }

    return { context, metadata };
  }

  /**
   * Generate fingerprint for deduplication
   */
  private generateFingerprint(error: Error): string {
    const parts = [
      this.getErrorType(error),
      this.getErrorCode(error),
      error.message.substring(0, 100), // First 100 chars
      this.getStackFingerprint(error.stack),
    ];

    return parts.join('|');
  }

  /**
   * Extract fingerprint from stack trace
   */
  private getStackFingerprint(stack?: string): string {
    if (!stack) return 'no-stack';

    // Extract first meaningful line from stack
    const lines = stack.split('\n');
    const meaningfulLine = lines.find(
      (line) => line.includes('at ') && !line.includes('node_modules'),
    );

    if (!meaningfulLine) return 'no-meaningful-stack';

    // Remove line numbers and columns for better deduplication
    return meaningfulLine.replace(/:\d+:\d+/g, '');
  }

  /**
   * Check if error is duplicate
   */
  private isDuplicate(report: ErrorReport): boolean {
    const existing = this.deduplicationMap.get(report.fingerprint);

    if (!existing) return false;

    const timeSinceLastReport = Date.now() - existing.lastReported;
    return timeSinceLastReport < this.config.deduplicationWindow;
  }

  /**
   * Update duplicate count
   */
  private updateDuplicateCount(report: ErrorReport): void {
    const existing = this.deduplicationMap.get(report.fingerprint);

    if (existing) {
      existing.count++;
      existing.lastSeen = Date.now();

      // Update metrics for duplicate
      this.metricsCollector.incrementCounter('errors.deduplicated', {
        type: report.error.type,
        severity: report.error.severity,
      });
    }
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate tags for error
   */
  private generateTags(error: Error, context?: Record<string, any>): string[] {
    const tags: string[] = [];

    // Error type tags
    tags.push(`type:${this.getErrorType(error)}`);
    tags.push(`severity:${getErrorSeverity(error)}`);
    tags.push(`category:${this.getErrorCategory(error)}`);

    // Context tags
    if (context?.component) tags.push(`component:${context.component}`);
    if (context?.operation) tags.push(`operation:${context.operation}`);

    // Recovery tags
    if (isRecoverableError(error)) tags.push('recoverable');

    // Platform tags
    if (typeof navigator !== 'undefined') {
      const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
      tags.push(isMobile ? 'platform:mobile' : 'platform:desktop');
    }

    return tags;
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Remove sensitive file paths and keep structure
    return stack
      .split('\n')
      .map((line) => {
        // Remove absolute paths but keep file names
        return line.replace(/\/[^:]+\//g, '.../');
      })
      .join('\n');
  }

  /**
   * Update metrics
   */
  private updateMetrics(report: ErrorReport): void {
    // Increment error counter
    this.metricsCollector.incrementCounter('errors.total', {
      type: report.error.type,
      severity: report.error.severity,
      category: report.error.category,
    });

    // Record error occurrence
    this.metricsCollector.recordValue('errors.by_type', 1, {
      type: report.error.type,
    });

    // Track severity distribution
    this.metricsCollector.recordValue('errors.severity_distribution', 1, {
      severity: report.error.severity,
    });

    // Update deduplication map
    const dedup = this.deduplicationMap.get(report.fingerprint);
    if (dedup) {
      dedup.count = report.occurrenceCount;
      dedup.lastSeen = report.timestamp;
      dedup.lastReported = report.timestamp;
    } else {
      this.deduplicationMap.set(report.fingerprint, {
        fingerprint: report.fingerprint,
        count: 1,
        firstSeen: report.timestamp,
        lastSeen: report.timestamp,
        lastReported: report.timestamp,
      });
    }
  }

  /**
   * Log error based on severity
   */
  private logError(report: ErrorReport): void {
    const logData = {
      reportId: report.id,
      error: report.error,
      occurrences: report.occurrenceCount,
      tags: report.tags,
    };

    switch (report.error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(
          'Critical error reported',
          new Error(report.error.message),
          logData,
        );
        break;
      case ErrorSeverity.HIGH:
        logger.error(
          'High severity error reported',
          new Error(report.error.message),
          logData,
        );
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error reported', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity error reported', logData);
        break;
    }
  }

  /**
   * Add report to batch
   */
  private addToBatch(report: ErrorReport): void {
    this.reportBatch.push(report);

    if (this.reportBatch.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Start batch reporting timer
   */
  private startBatchReporting(): void {
    if (!this.config.batchReporting) return;

    this.batchTimer = setInterval(() => {
      if (this.reportBatch.length > 0) {
        this.flushBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * Flush report batch
   */
  private async flushBatch(): Promise<void> {
    if (this.reportBatch.length === 0) return;

    const batch = [...this.reportBatch];
    this.reportBatch = [];

    try {
      await this.sendBatchReports(batch);
    } catch (error) {
      logger.error('Failed to send error batch', error as Error);
      // Re-add to batch for retry
      this.reportBatch.unshift(...batch);
    }
  }

  /**
   * Send single report
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    // Use existing ErrorReporter for basic logging
    if (report.error.type === 'PlaybackError') {
      const playbackError = this.errorReports.get(report.id);
      if (playbackError) {
        ErrorReporter.reportError(playbackError as any);
      }
    }

    // Send to remote if enabled
    if (this.config.remoteReportingEnabled) {
      await this.sendToRemote([report]);
    }
  }

  /**
   * Send batch reports
   */
  private async sendBatchReports(reports: ErrorReport[]): Promise<void> {
    logger.info('Sending error batch', {
      count: reports.length,
      severities: reports.map((r) => r.error.severity),
    });

    if (this.config.remoteReportingEnabled) {
      await this.sendToRemote(reports);
    }
  }

  /**
   * Send reports to remote endpoint
   */
  private async sendToRemote(reports: ErrorReport[]): Promise<void> {
    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reports }),
      });

      if (!response.ok) {
        throw new Error(`Remote reporting failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send to remote', error as Error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for errors from various sources
    this.eventBus.on('error:occurred', (data: any) => {
      this.reportError(data.error, data.context);
    });

    this.eventBus.on('recovery:failed', (data: any) => {
      this.reportError(data.originalError, {
        ...data.context,
        recoveryAttempt: true,
        recoveryStrategy: data.strategy,
      });
    });

    this.eventBus.on('circuitbreaker:alert', (data: any) => {
      this.reportError(
        new Error(`Circuit breaker alert: ${data.alerts.join(', ')}`),
        {
          component: 'CircuitBreaker',
          breakerName: data.name,
          metrics: data.metrics,
        },
      );
    });
  }

  /**
   * Start trend analysis
   */
  private startTrendAnalysis(): void {
    // Update trends every minute
    setInterval(() => {
      this.updateTrends();
    }, 60 * 1000);
  }

  /**
   * Update error trends
   */
  private updateTrends(): void {
    const now = Date.now();
    const periods: Array<{ key: '1h' | '24h' | '7d'; duration: number }> = [
      { key: '1h', duration: 60 * 60 * 1000 },
      { key: '24h', duration: 24 * 60 * 60 * 1000 },
      { key: '7d', duration: 7 * 24 * 60 * 60 * 1000 },
    ];

    periods.forEach(({ key, duration }) => {
      const cutoff = now - duration;
      const relevantReports = Array.from(this.errorReports.values()).filter(
        (report) => report.timestamp >= cutoff,
      );

      const trend: ErrorTrend = {
        period: key,
        errorCounts: new Map(),
        severityCounts: new Map(),
        categoryCounts: new Map(),
        topErrors: [],
      };

      // Count by error code
      relevantReports.forEach((report) => {
        const code = report.error.code;
        trend.errorCounts.set(code, (trend.errorCounts.get(code) || 0) + 1);

        const severity = report.error.severity;
        trend.severityCounts.set(
          severity,
          (trend.severityCounts.get(severity) || 0) + 1,
        );

        const category = report.error.category;
        trend.categoryCounts.set(
          category,
          (trend.categoryCounts.get(category) || 0) + 1,
        );
      });

      // Get top errors
      trend.topErrors = Array.from(trend.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([code, count]) => ({ code, count }));

      this.trendData.set(key, trend);
    });

    // Emit trend update
    this.eventBus.emit('error:trends-updated', {
      trends: Array.from(this.trendData.entries()),
    });
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalErrors: number;
    uniqueErrors: number;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    topErrors: Array<{ code: string; count: number }>;
    trends: Map<string, ErrorTrend>;
  } {
    const stats = {
      totalErrors: 0,
      uniqueErrors: this.deduplicationMap.size,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      topErrors: [] as Array<{ code: string; count: number }>,
      trends: this.trendData,
    };

    // Calculate totals
    this.deduplicationMap.forEach((dedup) => {
      stats.totalErrors += dedup.count;
    });

    // Get latest trend data for statistics
    const latestTrend = this.trendData.get('24h');
    if (latestTrend) {
      latestTrend.severityCounts.forEach((count, severity) => {
        stats.errorsBySeverity[severity] = count;
      });

      latestTrend.categoryCounts.forEach((count, category) => {
        stats.errorsByCategory[category] = count;
      });

      stats.topErrors = latestTrend.topErrors;
    }

    return stats;
  }

  /**
   * Get specific error report
   */
  getReport(reportId: string): ErrorReport | undefined {
    return this.errorReports.get(reportId);
  }

  /**
   * Clear old reports
   */
  clearOldReports(maxAge: number): void {
    const cutoff = Date.now() - maxAge;

    // Clear old reports
    Array.from(this.errorReports.entries()).forEach(([id, report]) => {
      if (report.timestamp < cutoff) {
        this.errorReports.delete(id);
      }
    });

    // Clear old deduplication entries
    Array.from(this.deduplicationMap.entries()).forEach(
      ([fingerprint, dedup]) => {
        if (dedup.lastSeen < cutoff) {
          this.deduplicationMap.delete(fingerprint);
        }
      },
    );

    logger.info('Cleared old error reports', {
      remainingReports: this.errorReports.size,
      remainingDeduplication: this.deduplicationMap.size,
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Flush any remaining reports
    this.flushBatch();

    this.errorReports.clear();
    this.deduplicationMap.clear();
    this.trendData.clear();
  }
}
