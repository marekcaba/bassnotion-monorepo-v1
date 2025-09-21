/**
 * React Hook for Error Reporting
 * Phase 5.2.4: Easy error reporting integration for React components
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { EventBus } from '../../../services/core/EventBus.js';
import { MetricsCollector } from '../../../services/monitoring/MetricsCollector.js';
import {
  ErrorReportingService,
  ErrorReport,
} from '../ErrorReportingService.js';
import { ErrorRecoveryRegistry } from '../ErrorRecoveryRegistry.js';
import {
  CircuitBreakerIntegration,
  CriticalPath,
} from '../CircuitBreakerIntegration.js';
import {
  getErrorMessage,
  getErrorSeverity,
  isRecoverableError,
} from '../index.js';

/**
 * Error handling options for components
 */
export interface ErrorHandlingOptions {
  component: string;
  enableRecovery?: boolean;
  enableCircuitBreaker?: boolean;
  criticalPath?: CriticalPath;
  onError?: (error: Error, report: ErrorReport) => void;
  onRecoverySuccess?: (error: Error) => void;
  onRecoveryFailed?: (error: Error) => void;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (
  error: Error,
  context?: Record<string, any>,
) => Promise<ErrorReport | null>;

/**
 * Hook return type
 */
export interface UseErrorReportingReturn {
  reportError: ErrorHandler;
  reportErrorSync: (error: Error, context?: Record<string, any>) => void;
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    operationName?: string,
  ) => Promise<T>;
  getErrorStatistics: () => any;
  clearErrors: () => void;
}

/**
 * React hook for error reporting
 */
export function useErrorReporting(
  options: ErrorHandlingOptions,
): UseErrorReportingReturn {
  const { correlationId, logger, sessionId } = useCorrelation(
    options.component,
  );

  // Create instances (would normally come from context/DI)
  const eventBusRef = useRef<EventBus>();
  const reportingServiceRef = useRef<ErrorReportingService>();
  const recoveryRegistryRef = useRef<ErrorRecoveryRegistry>();
  const circuitBreakersRef = useRef<CircuitBreakerIntegration>();

  // Initialize services
  useEffect(() => {
    if (!eventBusRef.current) {
      eventBusRef.current = new EventBus();
    }

    if (!reportingServiceRef.current) {
      const metricsCollector = new MetricsCollector(eventBusRef.current);
      reportingServiceRef.current = new ErrorReportingService(
        eventBusRef.current,
        metricsCollector,
        {
          enableDeduplication: true,
          trendAnalysisEnabled: true,
          batchReporting: true,
        },
      );
    }

    if (options.enableRecovery && !recoveryRegistryRef.current) {
      recoveryRegistryRef.current = new ErrorRecoveryRegistry(
        eventBusRef.current,
        {
          enableMetrics: true,
          strategySelectionMode: 'adaptive',
        },
      );
    }

    if (options.enableCircuitBreaker && !circuitBreakersRef.current) {
      circuitBreakersRef.current = new CircuitBreakerIntegration(
        eventBusRef.current,
      );
    }

    // Cleanup on unmount
    return () => {
      reportingServiceRef.current?.dispose();
    };
  }, [options.enableRecovery, options.enableCircuitBreaker]);

  /**
   * Report an error asynchronously
   */
  const reportError = useCallback<ErrorHandler>(
    async (error: Error, context?: Record<string, any>) => {
      try {
        logger.error('Component error', error, { context });

        const errorContext = {
          ...context,
          component: options.component,
          correlationId,
          sessionId,
          timestamp: Date.now(),
        };

        // Report the error
        const reportId = await reportingServiceRef.current!.reportError(
          error,
          errorContext,
        );
        const report = reportingServiceRef.current!.getReport(reportId);

        if (!report) {
          logger.warn('Failed to get error report', { reportId });
          return null;
        }

        // Try recovery if enabled and error is recoverable
        if (options.enableRecovery && isRecoverableError(error)) {
          try {
            const recovered = await recoveryRegistryRef.current!.attempt(
              error,
              errorContext,
            );

            if (recovered) {
              logger.info('Error recovered successfully', {
                error: error.name,
                component: options.component,
              });
              options.onRecoverySuccess?.(error);
            } else {
              logger.warn('Error recovery failed', {
                error: error.name,
                component: options.component,
              });
              options.onRecoveryFailed?.(error);
            }
          } catch (recoveryError) {
            logger.error(
              'Recovery attempt threw error',
              recoveryError as Error,
            );
          }
        }

        // Call custom error handler
        options.onError?.(error, report);

        return report;
      } catch (reportingError) {
        logger.error('Failed to report error', reportingError as Error);
        return null;
      }
    },
    [correlationId, sessionId, logger, options],
  );

  /**
   * Report an error synchronously (fire and forget)
   */
  const reportErrorSync = useCallback(
    (error: Error, context?: Record<string, any>) => {
      // Report asynchronously without awaiting
      reportError(error, context).catch((err) => {
        logger.error('Background error reporting failed', err);
      });
    },
    [reportError, logger],
  );

  /**
   * Execute an operation with automatic error handling
   */
  const executeWithErrorHandling = useCallback(
    async <T>(
      operation: () => Promise<T>,
      operationName?: string,
    ): Promise<T> => {
      const startTime = Date.now();

      try {
        // Execute with circuit breaker if enabled
        if (options.enableCircuitBreaker && options.criticalPath) {
          return await circuitBreakersRef.current!.executeWithBreaker(
            options.criticalPath,
            operation,
            operationName,
          );
        }

        // Execute normally
        return await operation();
      } catch (error) {
        const duration = Date.now() - startTime;

        // Report the error
        await reportError(error as Error, {
          operation: operationName || 'unknown',
          duration,
          criticalPath: options.criticalPath,
        });

        // Re-throw for component to handle
        throw error;
      }
    },
    [options.enableCircuitBreaker, options.criticalPath, reportError],
  );

  /**
   * Get error statistics
   */
  const getErrorStatistics = useCallback(() => {
    return (
      reportingServiceRef.current?.getStatistics() || {
        totalErrors: 0,
        uniqueErrors: 0,
        errorsBySeverity: {},
        errorsByCategory: {},
        topErrors: [],
        trends: new Map(),
      }
    );
  }, []);

  /**
   * Clear old errors
   */
  const clearErrors = useCallback(() => {
    // Clear errors older than 24 hours
    reportingServiceRef.current?.clearOldReports(24 * 60 * 60 * 1000);
  }, []);

  return {
    reportError,
    reportErrorSync,
    executeWithErrorHandling,
    getErrorStatistics,
    clearErrors,
  };
}

/**
 * Example usage in a component:
 *
 * ```tsx
 * export function ExampleComponent() {
 *   const { reportError, executeWithErrorHandling } = useErrorReporting({
 *     component: 'ExampleComponent',
 *     enableRecovery: true,
 *     enableCircuitBreaker: true,
 *     criticalPath: CriticalPath.AUDIO_CONTEXT_INIT,
 *     onError: (error, report) => {
 *       // Show user-friendly error message
 *       console.log('User message:', report.error.userMessage);
 *     },
 *     onRecoverySuccess: (error) => {
 *       // Update UI to show recovery succeeded
 *       console.log('Recovered from error:', error.message);
 *     }
 *   });
 *
 *   const handleClick = async () => {
 *     try {
 *       await executeWithErrorHandling(
 *         async () => {
 *           // Some operation that might fail
 *           const response = await fetch('/api/data');
 *           if (!response.ok) {
 *             throw new Error('Failed to fetch data');
 *           }
 *           return response.json();
 *         },
 *         'fetch-data'
 *       );
 *     } catch (error) {
 *       // Error already reported, just handle UI updates
 *       console.error('Operation failed:', error);
 *     }
 *   };
 *
 *   const handleManualError = () => {
 *     const error = new Error('Manual error for testing');
 *     reportError(error, {
 *       userAction: 'manual-trigger',
 *       additionalInfo: 'Testing error reporting'
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleClick}>Execute Operation</button>
 *       <button onClick={handleManualError}>Trigger Error</button>
 *     </div>
 *   );
 * }
 * ```
 */
