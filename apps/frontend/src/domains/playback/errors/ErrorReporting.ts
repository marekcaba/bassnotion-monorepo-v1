/**
 * ErrorReporting - Error analytics and reporting
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Collects and reports error data for monitoring and analysis
 */

import { EventBus } from '../services/core/EventBus.js';
import { ErrorContext } from './ErrorHandler.js';
import { AudioError } from './AudioErrors.js';

export interface ErrorReport {
  id: string;
  timestamp: number;
  errorType: string;
  errorCode?: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent: string;
  url: string;
  audioContextState?: string;
  performance?: {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    timing?: {
      loadTime: number;
      domContentLoaded: number;
    };
  };
}

export interface ReportingConfig {
  endpoint?: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  enableLocalStorage?: boolean;
  maxStoredReports?: number;
}

export class ErrorReporter {
  private eventBus: EventBus;
  private config: Required<ReportingConfig>;
  private reportQueue: ErrorReport[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;

  constructor(eventBus: EventBus, config: ReportingConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      endpoint: '/api/errors',
      apiKey: '',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      enableLocalStorage: true,
      maxStoredReports: 100,
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.loadStoredReports();
    this.startFlushTimer();
    this.setupUnloadHandler();
  }

  /**
   * Report an error
   */
  async report(error: Error, context: ErrorContext): Promise<void> {
    const report = this.createReport(error, context);

    // Add to queue
    this.reportQueue.push(report);

    // Emit event
    this.eventBus.emit('error:reported', { report });

    // Check if we should flush
    if (this.reportQueue.length >= this.config.batchSize) {
      await this.flush();
    }

    // Store locally if enabled
    if (this.config.enableLocalStorage) {
      this.storeReport(report);
    }
  }

  /**
   * Create error report
   */
  private createReport(error: Error, context: ErrorContext): ErrorReport {
    const report: ErrorReport = {
      id: this.generateReportId(),
      timestamp: Date.now(),
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        sessionId: this.sessionId,
      },
      severity: this.determineSeverity(error),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add error code if it's an AudioError
    if (error instanceof AudioError) {
      report.errorCode = error.code;
    }

    // Add AudioContext state if available
    try {
      const audioContext = (window as any).audioContext;
      if (audioContext) {
        report.audioContextState = audioContext.state;
      }
    } catch {
      // Ignore if we can't access audio context
    }

    // Add performance data
    if (performance && performance.memory) {
      report.performance = {
        memory: {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        },
      };
    }

    // Add page load timing
    if (performance && performance.timing) {
      const loadTime =
        performance.timing.loadEventEnd - performance.timing.navigationStart;
      const domContentLoaded =
        performance.timing.domContentLoadedEventEnd -
        performance.timing.navigationStart;

      report.performance = {
        ...report.performance,
        timing: {
          loadTime,
          domContentLoaded,
        },
      };
    }

    return report;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(
    error: Error,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof AudioError) {
      return error.getSeverity();
    }

    // Determine based on error message patterns
    const message = error.message.toLowerCase();

    if (message.includes('fatal') || message.includes('crash')) {
      return 'critical';
    }

    if (message.includes('failed') || message.includes('error')) {
      return 'high';
    }

    if (message.includes('warning') || message.includes('retry')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Flush reports to server
   */
  async flush(): Promise<void> {
    if (this.reportQueue.length === 0) return;

    const reports = [...this.reportQueue];
    this.reportQueue = [];

    try {
      await this.sendReports(reports);

      // Clear stored reports on successful send
      if (this.config.enableLocalStorage) {
        this.clearStoredReports();
      }

      this.eventBus.emit('error:reports-sent', {
        count: reports.length,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Failed to send, add back to queue
      this.reportQueue.unshift(...reports);

      this.eventBus.emit('error:report-failed', {
        error,
        reportCount: reports.length,
      });
    }
  }

  /**
   * Send reports to server
   */
  private async sendReports(reports: ErrorReport[]): Promise<void> {
    if (!this.config.endpoint) return;

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'X-API-Key': this.config.apiKey }),
      },
      body: JSON.stringify({
        reports,
        sessionId: this.sessionId,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send error reports: ${response.statusText}`);
    }
  }

  /**
   * Store report locally
   */
  private storeReport(report: ErrorReport): void {
    try {
      const stored = this.getStoredReports();
      stored.push(report);

      // Limit stored reports
      if (stored.length > this.config.maxStoredReports) {
        stored.splice(0, stored.length - this.config.maxStoredReports);
      }

      localStorage.setItem('audio-error-reports', JSON.stringify(stored));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Load stored reports
   */
  private loadStoredReports(): void {
    if (!this.config.enableLocalStorage) return;

    try {
      const stored = this.getStoredReports();
      if (stored.length > 0) {
        this.reportQueue.push(...stored);
        this.clearStoredReports();
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get stored reports
   */
  private getStoredReports(): ErrorReport[] {
    try {
      const stored = localStorage.getItem('audio-error-reports');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear stored reports
   */
  private clearStoredReports(): void {
    try {
      localStorage.removeItem('audio-error-reports');
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors in timer
      });
    }, this.config.flushInterval);
  }

  /**
   * Setup unload handler
   */
  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Try to send any remaining reports
      if (this.reportQueue.length > 0) {
        // Use sendBeacon for reliability
        if (navigator.sendBeacon && this.config.endpoint) {
          const data = JSON.stringify({
            reports: this.reportQueue,
            sessionId: this.sessionId,
            timestamp: Date.now(),
          });

          navigator.sendBeacon(this.config.endpoint, data);
        }
      }
    });
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    return `${this.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get reporting statistics
   */
  getStats(): {
    queuedReports: number;
    sessionId: string;
    totalReported: number;
  } {
    return {
      queuedReports: this.reportQueue.length,
      sessionId: this.sessionId,
      totalReported: 0, // Would need to track this
    };
  }

  /**
   * Dispose of reporter
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    this.flush().catch(() => {
      // Store any remaining reports
      if (this.config.enableLocalStorage && this.reportQueue.length > 0) {
        this.reportQueue.forEach((report) => this.storeReport(report));
      }
    });
  }
}
