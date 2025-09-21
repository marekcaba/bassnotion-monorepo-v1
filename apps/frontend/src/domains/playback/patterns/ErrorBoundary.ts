/**
 * ErrorBoundary - Service-level Error Isolation
 * Story 3.18.4: Service Architecture Implementation
 *
 * Provides error isolation and recovery for services to prevent
 * cascading failures across the system.
 */

import { Service } from '../services/core/ServiceRegistry.js';
import { EventBus } from '../services/core/EventBus.js';
import { createStructuredLogger } from '@/shared/utils/errorHandling';

export interface ErrorBoundaryConfig {
  maxErrors?: number;
  errorWindow?: number; // ms
  recoveryStrategies?: RecoveryStrategy[];
  enableAutoRecovery?: boolean;
  isolationLevel?: 'full' | 'partial' | 'none';
  fallbackService?: Service;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: Error, context: ErrorContext) => boolean;
  recover: (error: Error, context: ErrorContext) => Promise<void>;
  priority: number;
}

export interface ErrorContext {
  serviceName: string;
  operation: string;
  timestamp: number;
  errorCount: number;
  lastError?: Error;
  metadata?: Record<string, any>;
  correlationId: string;
}

export interface ErrorReport {
  serviceName: string;
  errors: Array<{
    error: Error;
    context: ErrorContext;
    timestamp: number;
    recovered: boolean;
  }>;
  totalErrors: number;
  recoveredErrors: number;
  failedRecoveries: number;
}

export class ServiceErrorBoundary {
  private config: Required<ErrorBoundaryConfig>;
  private eventBus: EventBus;
  private logger = createStructuredLogger('ServiceErrorBoundary');
  private errorHistory: Map<
    string,
    Array<{ error: Error; timestamp: number; correlationId: string }>
  > = new Map();
  private recoveryInProgress = new Map<string, boolean>();
  private isolatedServices = new Set<string>();
  private errorReports = new Map<string, ErrorReport>();

  constructor(eventBus: EventBus, config: ErrorBoundaryConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxErrors: config.maxErrors || 5,
      errorWindow: config.errorWindow || 60000, // 1 minute
      recoveryStrategies:
        config.recoveryStrategies || this.getDefaultStrategies(),
      enableAutoRecovery: config.enableAutoRecovery ?? true,
      isolationLevel: config.isolationLevel || 'partial',
      fallbackService: config.fallbackService as Service,
    };
  }

  /**
   * Wrap service method with error boundary protection
   */
  protect<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
    correlationId?: string,
  ): Promise<T> {
    return this.executeWithBoundary(
      serviceName,
      operation,
      fn,
      metadata,
      correlationId,
    );
  }

  /**
   * Execute operation within error boundary
   */
  private async executeWithBoundary<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
    correlationId?: string,
  ): Promise<T> {
    const executionCorrelationId =
      correlationId ||
      `eb-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    // Check if service is isolated
    if (
      this.isolatedServices.has(serviceName) &&
      this.config.isolationLevel === 'full'
    ) {
      throw new Error(`Service ${serviceName} is isolated due to errors`);
    }

    try {
      const result = await fn();

      // Clear error history on success if recovery was in progress
      if (this.recoveryInProgress.get(serviceName)) {
        this.clearErrorHistory(serviceName);
        this.recoveryInProgress.set(serviceName, false);
        this.logger.info('Service recovery successful', {
          serviceName,
          operation,
          correlationId: executionCorrelationId,
        });
        this.eventBus.emit('errorboundary:recovery-success', {
          serviceName,
          operation,
          correlationId: executionCorrelationId,
        });
      }

      return result;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      // Record error
      this.recordError(serviceName, errorObj, executionCorrelationId);

      // Create error context
      const context: ErrorContext = {
        serviceName,
        operation,
        timestamp: Date.now(),
        errorCount: this.getErrorCount(serviceName),
        lastError: errorObj,
        metadata,
        correlationId: executionCorrelationId,
      };

      // Log the error with correlation ID
      this.logger.error('Service operation failed', errorObj, {
        serviceName,
        operation,
        correlationId: executionCorrelationId,
        errorCount: context.errorCount,
        metadata,
      });

      // Emit error event with correlation ID
      this.eventBus.emit('errorboundary:error', {
        serviceName,
        operation,
        error: errorObj,
        context,
        correlationId: executionCorrelationId,
      });

      // Check if we should isolate the service
      if (this.shouldIsolateService(serviceName)) {
        await this.isolateService(serviceName);
      }

      // Attempt recovery if enabled
      if (
        this.config.enableAutoRecovery &&
        !this.recoveryInProgress.get(serviceName)
      ) {
        const recovered = await this.attemptRecovery(errorObj, context);
        if (recovered) {
          // Retry the operation with same correlation ID
          return this.executeWithBoundary(
            serviceName,
            operation,
            fn,
            metadata,
            executionCorrelationId,
          );
        }
      }

      // Use fallback service if available and service is isolated
      if (
        this.config.fallbackService &&
        this.isolatedServices.has(serviceName)
      ) {
        this.eventBus.emit('errorboundary:fallback-used', {
          serviceName,
          operation,
        });
        // Execute operation using fallback service
        // This is a simplified example - actual implementation would depend on service interface
        throw new Error(
          `Service ${serviceName} failed and no specific fallback available`,
        );
      }

      // Re-throw the error if no recovery was possible
      throw errorObj;
    }
  }

  /**
   * Record error for tracking
   */
  private recordError(
    serviceName: string,
    error: Error,
    correlationId: string,
  ): void {
    const errors = this.errorHistory.get(serviceName) || [];
    errors.push({ error, timestamp: Date.now(), correlationId });

    // Clean old errors outside the window
    const cutoffTime = Date.now() - this.config.errorWindow;
    const recentErrors = errors.filter((e) => e.timestamp > cutoffTime);

    this.errorHistory.set(serviceName, recentErrors);

    // Update error report
    this.updateErrorReport(serviceName, error, false, correlationId);
  }

  /**
   * Get error count for service
   */
  private getErrorCount(serviceName: string): number {
    const errors = this.errorHistory.get(serviceName) || [];
    const cutoffTime = Date.now() - this.config.errorWindow;
    return errors.filter((e) => e.timestamp > cutoffTime).length;
  }

  /**
   * Check if service should be isolated
   */
  private shouldIsolateService(serviceName: string): boolean {
    const errorCount = this.getErrorCount(serviceName);
    return errorCount >= this.config.maxErrors;
  }

  /**
   * Isolate service
   */
  private async isolateService(serviceName: string): Promise<void> {
    if (this.isolatedServices.has(serviceName)) {
      return;
    }

    this.isolatedServices.add(serviceName);

    const isolationCorrelationId = `eb-iso-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    this.logger.warn('Service isolated due to errors', {
      serviceName,
      errorCount: this.getErrorCount(serviceName),
      isolationLevel: this.config.isolationLevel,
      correlationId: isolationCorrelationId,
    });

    this.eventBus.emit('errorboundary:service-isolated', {
      serviceName,
      errorCount: this.getErrorCount(serviceName),
      isolationLevel: this.config.isolationLevel,
      correlationId: isolationCorrelationId,
    });

    // Schedule automatic recovery check
    if (this.config.enableAutoRecovery) {
      setTimeout(() => {
        this.checkServiceHealth(serviceName);
      }, this.config.errorWindow);
    }
  }

  /**
   * Attempt recovery using configured strategies
   */
  private async attemptRecovery(
    error: Error,
    context: ErrorContext,
  ): Promise<boolean> {
    this.recoveryInProgress.set(context.serviceName, true);

    // Sort strategies by priority
    const strategies = [...this.config.recoveryStrategies].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const strategy of strategies) {
      if (strategy.condition(error, context)) {
        try {
          await strategy.recover(error, context);

          this.eventBus.emit('errorboundary:recovery-attempted', {
            serviceName: context.serviceName,
            strategy: strategy.name,
            success: true,
          });

          this.updateErrorReport(
            context.serviceName,
            error,
            true,
            context.correlationId,
          );
          return true;
        } catch (recoveryError) {
          this.eventBus.emit('errorboundary:recovery-attempted', {
            serviceName: context.serviceName,
            strategy: strategy.name,
            success: false,
            error: recoveryError,
          });
        }
      }
    }

    this.recoveryInProgress.set(context.serviceName, false);
    return false;
  }

  /**
   * Check service health and potentially remove from isolation
   */
  private async checkServiceHealth(serviceName: string): Promise<void> {
    const errorCount = this.getErrorCount(serviceName);

    if (errorCount === 0 && this.isolatedServices.has(serviceName)) {
      this.isolatedServices.delete(serviceName);
      const correlationId = `eb-rec-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      this.logger.info('Service health restored', {
        serviceName,
        correlationId,
      });
      this.eventBus.emit('errorboundary:service-restored', {
        serviceName,
        correlationId,
      });
    }
  }

  /**
   * Clear error history for service
   */
  private clearErrorHistory(serviceName: string): void {
    this.errorHistory.delete(serviceName);
  }

  /**
   * Update error report
   */
  private updateErrorReport(
    serviceName: string,
    error: Error,
    recovered: boolean,
    correlationId: string,
  ): void {
    const report = this.errorReports.get(serviceName) || {
      serviceName,
      errors: [],
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
    };

    report.errors.push({
      error,
      context: {
        serviceName,
        operation: 'unknown',
        timestamp: Date.now(),
        errorCount: this.getErrorCount(serviceName),
        correlationId,
      },
      timestamp: Date.now(),
      recovered,
    });

    report.totalErrors++;
    if (recovered) {
      report.recoveredErrors++;
    } else {
      report.failedRecoveries++;
    }

    // Keep only last 100 errors
    if (report.errors.length > 100) {
      report.errors = report.errors.slice(-100);
    }

    this.errorReports.set(serviceName, report);
  }

  /**
   * Get default recovery strategies
   */
  private getDefaultStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'retry-transient',
        condition: (error) => {
          // Retry on network and timeout errors
          return (
            error.message.includes('network') ||
            error.message.includes('timeout') ||
            error.name === 'NetworkError'
          );
        },
        recover: async (_error, context) => {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          this.eventBus.emit('errorboundary:retry', { context });
        },
        priority: 10,
      },
      {
        name: 'reset-service',
        condition: (_error, context) => {
          // Reset service on repeated errors
          return context.errorCount >= 3;
        },
        recover: async (_error, context) => {
          this.eventBus.emit('errorboundary:service-reset', {
            serviceName: context.serviceName,
          });
          // Service reset would be handled by ServiceRegistry
        },
        priority: 5,
      },
      {
        name: 'clear-cache',
        condition: (error) => {
          // Clear cache on memory errors
          return (
            error.message.includes('memory') || error.message.includes('cache')
          );
        },
        recover: async (_error, context) => {
          this.eventBus.emit('errorboundary:cache-clear', {
            serviceName: context.serviceName,
          });
        },
        priority: 8,
      },
    ];
  }

  /**
   * Get isolation status
   */
  isServiceIsolated(serviceName: string): boolean {
    return this.isolatedServices.has(serviceName);
  }

  /**
   * Manually restore service
   */
  restoreService(serviceName: string): void {
    this.isolatedServices.delete(serviceName);
    this.clearErrorHistory(serviceName);
    this.recoveryInProgress.delete(serviceName);

    this.eventBus.emit('errorboundary:service-restored', {
      serviceName,
      manual: true,
    });
  }

  /**
   * Get error report for service
   */
  getErrorReport(serviceName?: string): ErrorReport | Map<string, ErrorReport> {
    if (serviceName) {
      return (
        this.errorReports.get(serviceName) || {
          serviceName,
          errors: [],
          totalErrors: 0,
          recoveredErrors: 0,
          failedRecoveries: 0,
        }
      );
    }
    return new Map(this.errorReports);
  }

  /**
   * Clear all error history
   */
  clearAll(): void {
    this.errorHistory.clear();
    this.recoveryInProgress.clear();
    this.isolatedServices.clear();
    this.errorReports.clear();
  }
}

/**
 * Decorator for automatic error boundary protection with correlation ID support
 */
export function ErrorBoundary(
  serviceName: string,
  errorBoundary: ServiceErrorBoundary,
) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract correlation ID from args if available
      let correlationId: string | undefined;

      // Check if first arg is an object with correlationId
      if (
        args[0] &&
        typeof args[0] === 'object' &&
        'correlationId' in args[0]
      ) {
        correlationId = args[0].correlationId;
      }

      // Or check if any arg is a correlationId string
      const correlationIdArg = args.find(
        (arg) =>
          typeof arg === 'string' && arg.includes('-') && arg.length === 36,
      );

      if (!correlationId && correlationIdArg) {
        correlationId = correlationIdArg;
      }

      return errorBoundary.protect(
        serviceName,
        propertyKey,
        () => originalMethod.apply(this, args),
        { args },
        correlationId,
      );
    };

    return descriptor;
  };
}
