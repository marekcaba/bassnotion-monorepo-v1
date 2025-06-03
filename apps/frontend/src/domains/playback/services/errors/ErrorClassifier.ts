/**
 * ErrorClassifier - Automatic Error Categorization and Analysis
 *
 * Provides intelligent error classification and severity assessment
 * for better error handling and recovery strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from './base';

export class ErrorClassifier {
  /**
   * Automatically classify an error based on its characteristics
   */
  public static classifyError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Audio context related errors
    if (this.isAudioContextError(message, name)) {
      return ErrorCategory.AUDIO_CONTEXT;
    }

    // Performance related errors
    if (this.isPerformanceError(message, name)) {
      return ErrorCategory.PERFORMANCE;
    }

    // Resource related errors
    if (this.isResourceError(message, name)) {
      return ErrorCategory.RESOURCE;
    }

    // Network related errors
    if (this.isNetworkError(message, name)) {
      return ErrorCategory.NETWORK;
    }

    // Mobile specific errors
    if (this.isMobileError(message, name)) {
      return ErrorCategory.MOBILE;
    }

    // Validation errors
    if (this.isValidationError(message, name)) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Assess error severity based on error characteristics and context
   */
  public static assessSeverity(
    error: Error,
    category: ErrorCategory,
    context?: ErrorContext,
  ): ErrorSeverity {
    // Critical errors that prevent core functionality
    if (this.isCriticalError(error, category, context)) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors that significantly impact functionality
    if (this.isHighSeverityError(error, category, context)) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors with moderate impact
    if (this.isMediumSeverityError(error, category, context)) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  private static isAudioContextError(message: string, name: string): boolean {
    const keywords = [
      'audiocontext',
      'webaudio',
      'audio context',
      'suspended',
      'gesture',
    ];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isPerformanceError(message: string, name: string): boolean {
    const keywords = [
      'latency',
      'performance',
      'timeout',
      'slow',
      'memory',
      'cpu',
    ];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isResourceError(message: string, name: string): boolean {
    const keywords = [
      'memory',
      'allocation',
      'buffer',
      'resource',
      'quota',
      'limit',
    ];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isNetworkError(message: string, name: string): boolean {
    const keywords = [
      'network',
      'fetch',
      'load',
      'connection',
      'timeout',
      'cors',
    ];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isMobileError(message: string, name: string): boolean {
    const keywords = ['mobile', 'ios', 'android', 'battery', 'background'];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isValidationError(message: string, name: string): boolean {
    const keywords = ['validation', 'invalid', 'type', 'parameter', 'required'];
    return keywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isCriticalError(
    error: Error,
    category: ErrorCategory,
    _context?: ErrorContext,
  ): boolean {
    // AudioContext not supported
    if (
      category === ErrorCategory.AUDIO_CONTEXT &&
      error.message.includes('not supported')
    ) {
      return true;
    }

    // Memory allocation failures
    if (
      category === ErrorCategory.RESOURCE &&
      error.message.includes('allocation failed')
    ) {
      return true;
    }

    return false;
  }

  private static isHighSeverityError(
    error: Error,
    category: ErrorCategory,
    context?: ErrorContext,
  ): boolean {
    // Performance threshold violations
    if (category === ErrorCategory.PERFORMANCE && context?.performanceMetrics) {
      const metrics = context.performanceMetrics;
      if (
        (metrics.latency != null && metrics.latency > 100) ||
        (metrics.cpuUsage != null && metrics.cpuUsage > 90)
      ) {
        return true;
      }
    }

    return false;
  }

  private static isMediumSeverityError(
    error: Error,
    category: ErrorCategory,
    _context?: ErrorContext,
  ): boolean {
    // Most errors default to medium severity
    return category !== ErrorCategory.VALIDATION;
  }
}
