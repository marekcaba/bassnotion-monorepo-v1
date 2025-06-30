/**
 * ErrorClassifier - Automatic Error Categorization and Analysis
 *
 * Provides intelligent error classification and severity assessment
 * for better error handling and recovery strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { ErrorCategory, ErrorSeverity, ErrorContext } from './base.js';

export class ErrorClassifier {
  /**
   * Automatically classify an error based on its characteristics
   */
  public static classifyError(error: Error): ErrorCategory {
    const message = this.normalizeText(error.message);
    const name = this.normalizeText(error.name);

    // Check categories in order of specificity to avoid conflicts
    // Audio context errors - most specific first
    if (this.isAudioContextError(message, name)) {
      return ErrorCategory.AUDIO_CONTEXT;
    }

    // Mobile specific errors - before general resource/network
    if (this.isMobileError(message, name)) {
      return ErrorCategory.MOBILE;
    }

    // Network errors - before performance to catch network timeouts
    if (this.isNetworkError(message, name)) {
      return ErrorCategory.NETWORK;
    }

    // Resource errors - before performance to catch memory issues
    if (this.isResourceError(message, name)) {
      return ErrorCategory.RESOURCE;
    }

    // Validation errors - specific input/parameter issues
    if (this.isValidationError(message, name)) {
      return ErrorCategory.VALIDATION;
    }

    // Performance errors - broader category, check last
    if (this.isPerformanceError(message, name)) {
      return ErrorCategory.PERFORMANCE;
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

  /**
   * Normalize text for consistent pattern matching
   */
  private static normalizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return (
      text
        .toLowerCase()
        // Remove special characters but keep spaces and alphanumeric
        .replace(/[^a-z0-9\s]/g, ' ')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  private static isAudioContextError(message: string, name: string): boolean {
    const specificKeywords = [
      'audiocontext not supported',
      'audio context not supported',
      'audio context suspended',
      'webaudio api not available',
      'audio context state invalid',
      'user gesture required for audio context',
      'webaudio not supported',
      'web audio api not supported',
    ];

    const generalKeywords = [
      'audiocontext',
      'webaudio',
      'audio context',
      'web audio api',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns
    return generalKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isResourceError(message: string, name: string): boolean {
    const specificKeywords = [
      'memory allocation failed',
      'buffer overflow detected',
      'resource quota exceeded',
      'allocation limit reached',
      'resource unavailable',
    ];

    const generalKeywords = [
      'memory allocation',
      'buffer overflow',
      'resource quota',
      'allocation failed',
      'allocation limit',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns - exclude performance-related memory usage
    if (
      generalKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      // Exclude performance-related memory messages
      if (
        message.includes('memory usage critical') ||
        message.includes('performance') ||
        message.includes('latency') ||
        message.includes('cpu overload')
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  private static isNetworkError(message: string, name: string): boolean {
    const specificKeywords = [
      'network connection failed',
      'fetch request timeout',
      'failed to load resource',
      'connection lost',
      'cors policy violation',
      'network timeout',
    ];

    const generalKeywords = [
      'network connection',
      'fetch request',
      'failed to load',
      'connection lost',
      'cors policy',
      'network timeout',
      'network',
      'fetch',
      'cors',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns but exclude performance-related timeouts
    if (
      generalKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      // Exclude performance-related timeout messages
      if (message.includes('performance') || message.includes('latency')) {
        return false;
      }
      return true;
    }

    return false;
  }

  private static isMobileError(message: string, name: string): boolean {
    const specificKeywords = [
      'mobile device limitations',
      'ios audio restrictions',
      'android battery optimization',
      'battery saver mode active',
      'background processing limited',
    ];

    const generalKeywords = [
      'mobile device',
      'ios audio',
      'android battery',
      'battery saver',
      'background processing',
      'mobile',
      'ios',
      'android',
      'battery',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns
    return generalKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isValidationError(message: string, name: string): boolean {
    const specificKeywords = [
      'validation failed',
      'invalid parameter provided',
      'type mismatch error',
      'required parameter missing',
      'invalid input format',
    ];

    const generalKeywords = [
      'validation',
      'invalid parameter',
      'type mismatch',
      'required parameter',
      'invalid input',
      'invalid',
      'required',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns
    return generalKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isPerformanceError(message: string, name: string): boolean {
    const specificKeywords = [
      'latency threshold exceeded',
      'performance degradation detected',
      'operation timeout',
      'system running slow',
      'memory usage critical',
      'cpu overload detected',
    ];

    const generalKeywords = [
      'latency threshold',
      'performance degradation',
      'performance timeout',
      'system running slow',
      'memory usage critical',
      'cpu overload',
      'latency',
      'performance',
      'cpu',
    ];

    // Check specific patterns first
    if (
      specificKeywords.some(
        (keyword) => message.includes(keyword) || name.includes(keyword),
      )
    ) {
      return true;
    }

    // Check general patterns
    return generalKeywords.some(
      (keyword) => message.includes(keyword) || name.includes(keyword),
    );
  }

  private static isCriticalError(
    error: Error,
    category: ErrorCategory,
    _context?: ErrorContext,
  ): boolean {
    const message = this.normalizeText(error.message);

    // AudioContext not supported - critical system capability missing
    if (category === ErrorCategory.AUDIO_CONTEXT) {
      if (
        message.includes('not supported') ||
        message.includes('api not available')
      ) {
        return true;
      }
    }

    // Memory allocation failures - critical resource issues
    if (category === ErrorCategory.RESOURCE) {
      if (
        message.includes('allocation failed') ||
        message.includes('buffer overflow') ||
        message.includes('memory allocation failed')
      ) {
        return true;
      }
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

    // Network failures that affect core functionality
    if (category === ErrorCategory.NETWORK) {
      const message = this.normalizeText(error.message);
      if (
        message.includes('connection failed') ||
        message.includes('connection lost')
      ) {
        return true;
      }
    }

    // Mobile device limitations that prevent functionality
    if (category === ErrorCategory.MOBILE) {
      const message = this.normalizeText(error.message);
      if (message.includes('limitations') || message.includes('restrictions')) {
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
    // Most non-validation errors default to medium severity
    if (category === ErrorCategory.VALIDATION) {
      return false; // Validation errors are typically low severity
    }

    // Audio context errors that are not critical
    if (category === ErrorCategory.AUDIO_CONTEXT) {
      const message = this.normalizeText(error.message);
      if (
        // TODO: Review non-null assertion - consider null safety
        !message.includes('not supported') &&
        // TODO: Review non-null assertion - consider null safety
        !message.includes('api not available')
      ) {
        return true;
      }
    }

    // Performance errors that don't meet high severity criteria
    if (category === ErrorCategory.PERFORMANCE) {
      return true;
    }

    // Resource errors that aren't critical
    if (category === ErrorCategory.RESOURCE) {
      const message = this.normalizeText(error.message);
      if (
        // TODO: Review non-null assertion - consider null safety
        !message.includes('allocation failed') &&
        // TODO: Review non-null assertion - consider null safety
        !message.includes('buffer overflow')
      ) {
        return true;
      }
    }

    // Network errors that aren't high severity
    if (category === ErrorCategory.NETWORK) {
      return true;
    }

    // Mobile errors that aren't high severity
    if (category === ErrorCategory.MOBILE) {
      return true;
    }

    return true; // Default to medium for other categories
  }
}
