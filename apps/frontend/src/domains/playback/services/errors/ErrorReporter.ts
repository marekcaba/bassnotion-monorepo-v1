/**
 * ErrorReporter - Sanitized Error Logging and Reporting
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { PlaybackError } from './base';

export class ErrorReporter {
  /**
   * Report error with sanitized data
   */
  public static reportError(error: PlaybackError): void {
    const sanitizedReport = this.createSanitizedReport(error);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('PlaybackError:', sanitizedReport);
    }

    // In production, you would send to monitoring service
    // this.sendToMonitoringService(sanitizedReport);
  }

  /**
   * Create a sanitized error report safe for logging
   */
  private static createSanitizedReport(
    error: PlaybackError,
  ): Record<string, unknown> {
    return {
      code: error.code,
      category: error.category,
      severity: error.severity,
      message: error.getTechnicalMessage(),
      timestamp: error.timestamp,
      recoverable: error.isRecoverable(),
      automaticRecoveries: error.getAutomaticRecoveries().length,
      context: this.sanitizeContext(error.context),
      stack: this.sanitizeStack(error.stack),
    };
  }

  private static sanitizeContext(context: any): Record<string, unknown> {
    return {
      timestamp: context.timestamp,
      currentOperation: context.currentOperation,
      engineState: context.engineState,
      audioContextState: context.audioContextState,
      deviceInfo: context.deviceInfo
        ? {
            platform: context.deviceInfo.platform,
            isMobile: context.deviceInfo.isMobile,
            hasLowLatencySupport: context.deviceInfo.hasLowLatencySupport,
          }
        : undefined,
      performanceMetrics: context.performanceMetrics
        ? {
            latency: context.performanceMetrics.latency,
            cpuUsage: context.performanceMetrics.cpuUsage,
            memoryUsage: context.performanceMetrics.memoryUsage,
          }
        : undefined,
    };
  }

  private static sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Remove file paths and sensitive information
    return stack
      .split('\n')
      .map((line) => line.replace(/\/.*\//g, '/[path]/'))
      .join('\n');
  }
}
