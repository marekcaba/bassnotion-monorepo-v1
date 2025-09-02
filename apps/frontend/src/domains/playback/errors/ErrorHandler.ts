/**
 * ErrorHandler - Centralized error handling system
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Professional error handling with recovery and reporting
 */

import { EventBus } from '../services/core/EventBus.js';
import { AudioError } from './AudioErrors.js';
import { ErrorReporter } from './ErrorReporting.js';
import { ErrorRecovery } from './ErrorRecovery.js';
import { createStructuredLogger } from '@bassnotion/contracts';

export interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  additionalData?: Record<string, unknown>;
}

export interface ErrorHandlerConfig {
  maxRetries?: number;
  retryDelay?: number;
  enableUserNotifications?: boolean;
  enableAutoRecovery?: boolean;
  errorReporter?: ErrorReporter;
  errorRecovery?: ErrorRecovery;
}

interface ErrorRecord {
  error: Error;
  context: ErrorContext;
  timestamp: number;
  resolved: boolean;
  retryCount: number;
}

export class ErrorHandler {
  private errorReporter: ErrorReporter;
  private errorRecovery: ErrorRecovery;
  private eventBus: EventBus;
  private config: Required<ErrorHandlerConfig>;
  private errorHistory: ErrorRecord[] = [];
  private readonly MAX_ERROR_HISTORY = 100;
  private userErrorCallback?: (message: string, severity: string) => void;

  constructor(eventBus: EventBus, config: ErrorHandlerConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableUserNotifications: true,
      enableAutoRecovery: true,
      errorReporter: config.errorReporter || new ErrorReporter(eventBus),
      errorRecovery: config.errorRecovery || new ErrorRecovery(eventBus),
      ...config,
    };

    this.errorReporter = this.config.errorReporter;
    this.errorRecovery = this.config.errorRecovery;

    this.setupEventListeners();
  }

  /**
   * Set callback for user error display
   */
  setUserErrorCallback(
    callback: (message: string, severity: string) => void,
  ): void {
    this.userErrorCallback = callback;
  }

  /**
   * Handle an error with full processing pipeline
   */
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const errorRecord: ErrorRecord = {
      error,
      context,
      timestamp: Date.now(),
      resolved: false,
      retryCount: 0,
    };

    // Add to history
    this.addToHistory(errorRecord);

    // Log error for debugging
    this.logError(error, context);

    // Report error for analytics
    await this.errorReporter.report(error, context);

    // Emit error event
    this.eventBus.emit('error:occurred', {
      error,
      context,
      timestamp: errorRecord.timestamp,
    });

    // Attempt automatic recovery if enabled
    if (this.config.enableAutoRecovery) {
      const recovered = await this.attemptRecovery(errorRecord);

      if (recovered) {
        errorRecord.resolved = true;
        this.eventBus.emit('error:recovered', {
          error,
          context,
          timestamp: Date.now(),
        });
        return;
      }
    }

    // Show user-friendly error message
    if (this.config.enableUserNotifications) {
      this.showUserError(error, context);
    }
  }

  /**
   * Handle async errors with retry logic
   */
  async handleAsyncError<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        context.additionalData = {
          ...context.additionalData,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
        };

        // Log attempt
        this.logError(lastError, context);

        // Check if we should retry
        if (attempt < this.config.maxRetries) {
          const shouldRetry = await this.shouldRetry(lastError, context);

          if (shouldRetry) {
            // Wait before retry with exponential backoff
            const delay = this.config.retryDelay * Math.pow(2, attempt);
            await this.delay(delay);

            this.eventBus.emit('error:retry', {
              error: lastError,
              context,
              attempt: attempt + 1,
              delay,
            });
            continue;
          }
        }

        // Final attempt failed
        await this.handleError(lastError, context);
        throw lastError;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Attempt automatic recovery
   */
  private async attemptRecovery(errorRecord: ErrorRecord): Promise<boolean> {
    try {
      const recovered = await this.errorRecovery.attempt(
        errorRecord.error,
        errorRecord.context,
      );

      if (recovered) {
        this.eventBus.emit('error:recovery-success', {
          error: errorRecord.error,
          context: errorRecord.context,
          timestamp: Date.now(),
        });
      }

      return recovered;
    } catch (recoveryError) {
      // Recovery itself failed
      this.logError(
        recoveryError instanceof Error
          ? recoveryError
          : new Error(String(recoveryError)),
        { ...errorRecord.context, operation: 'error-recovery' },
      );
      return false;
    }
  }

  /**
   * Determine if operation should be retried
   */
  private async shouldRetry(
    error: Error,
    context: ErrorContext,
  ): Promise<boolean> {
    // Don't retry non-recoverable errors
    if (error instanceof AudioError && !error.isRecoverable()) {
      return false;
    }

    // Check specific error types
    if (
      error.message.includes('Network') ||
      error.message.includes('timeout') ||
      error.message.includes('CORS')
    ) {
      return true;
    }

    // Ask recovery service
    return this.errorRecovery.canRecover(error, context);
  }

  /**
   * Show user-friendly error message
   */
  private showUserError(error: Error, context: ErrorContext): void {
    const userMessage =
      error instanceof AudioError
        ? error.toUserMessage()
        : 'An unexpected error occurred. Please try again.';

    const severity =
      error instanceof AudioError ? error.getSeverity() : 'medium';

    // Use callback if set, otherwise emit event
    if (this.userErrorCallback) {
      this.userErrorCallback(userMessage, severity);
    } else {
      this.eventBus.emit('error:user-notification', {
        message: userMessage,
        severity,
        context,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Log error for debugging
   */
  private logError(error: Error, context: ErrorContext): void {
    const logData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔴 Audio Error: ${context.operation}`);
      logger.error('Error:', error);
      logger.error('Context:', context);
      console.groupEnd();
    }

    // Emit for external logging
    this.eventBus.emit('error:logged', logData);
  }

  /**
   * Add error to history
   */
  private addToHistory(errorRecord: ErrorRecord): void {
    this.errorHistory.push(errorRecord);

    // Limit history size
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for audio-specific errors
    this.eventBus.on('audio:error', async ({ error, context }) => {
      await this.handleError(
        error,
        context || {
          operation: 'audio-operation',
          component: 'audio-engine',
          timestamp: Date.now(),
        },
      );
    });

    // Listen for transport errors
    this.eventBus.on('transport:error', async ({ error, operation }) => {
      await this.handleError(error, {
        operation: operation || 'transport-operation',
        component: 'transport-controller',
        timestamp: Date.now(),
      });
    });

    // Listen for plugin errors
    this.eventBus.on('plugin:error', async ({ error, pluginName }) => {
      await this.handleError(error, {
        operation: 'plugin-operation',
        component: `plugin-${pluginName}`,
        timestamp: Date.now(),
        additionalData: { pluginName },
      });
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    resolvedErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: ErrorRecord[];
  } {
    const errorsByType: Record<string, number> = {};

    this.errorHistory.forEach((record) => {
      const errorType = record.error.constructor.name;
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    return {
      totalErrors: this.errorHistory.length,
      resolvedErrors: this.errorHistory.filter((r) => r.resolved).length,
      errorsByType,
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.eventBus.emit('error:history-cleared', { timestamp: Date.now() });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
