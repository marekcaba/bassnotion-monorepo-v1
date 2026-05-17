/**
 * Logging Decorators for Playback Domain
 *
 * TypeScript decorators that integrate with the existing structured logging system
 */

import {
  createStructuredLogger,
  StructuredLogger,
} from '@bassnotion/contracts';
import { MetricsCollector } from '../../services/monitoring/MetricsCollector.js';
import { EventBus } from '../../services/core/EventBus.js';
import { ProductionLogger } from '../../services/logging/ProductionLogger.js';

export interface LogMethodOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  includeArgs?: boolean;
  includeResult?: boolean;
  sanitizeArgs?: (args: any[]) => any[];
  sanitizeResult?: (result: any) => any;
}

export interface LogPerformanceOptions {
  metricName?: string;
  threshold?: number; // Log only if execution time exceeds threshold (ms)
  includeInMetrics?: boolean;
}

export interface LogErrorsOptions {
  rethrow?: boolean;
  sanitize?: boolean;
  recoveryStrategies?: string[];
}

/**
 * Get or create logger for a class
 */
function getClassLogger(target: any, className?: string): StructuredLogger {
  const loggerKey = Symbol.for('__logger__');

  if (!target[loggerKey]) {
    const name = className || target.constructor.name || 'Unknown';
    target[loggerKey] = createStructuredLogger(`playback:${name}`);
  }

  return target[loggerKey];
}

/**
 * Get metrics collector instance
 */
function getMetricsCollector(): MetricsCollector | null {
  try {
    // Get singleton instances if available (use window for typed access)
    const eventBus =
      (typeof window !== 'undefined' &&
        (window.__playbackEventBus as EventBus | undefined)) ||
      EventBus.getInstance();
    const prodLogger =
      (typeof window !== 'undefined' &&
        (window.__playbackLogger as ProductionLogger | undefined)) ||
      new ProductionLogger(eventBus, { enabled: true });

    return MetricsCollector.getInstance(eventBus, prodLogger);
  } catch {
    // Return null if metrics collector is not available
    return null;
  }
}

/**
 * Decorator to log method calls
 */
export function LogMethod(options: LogMethodOptions = {}): MethodDecorator {
  const {
    level = 'debug',
    includeArgs = true,
    includeResult = false,
    sanitizeArgs = (args) => args,
    sanitizeResult = (result) => result,
  } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const logger = getClassLogger(this);
      const methodName = String(propertyKey);
      const className = this.constructor.name;

      const logData: Record<string, any> = {
        method: methodName,
        class: className,
      };

      if (includeArgs) {
        logData.args = sanitizeArgs(args);
      }

      // Log method entry
      logger[level](`${className}.${methodName} called`, logData);

      try {
        const result = await originalMethod.apply(this, args);

        if (includeResult) {
          logger[level](`${className}.${methodName} completed`, {
            ...logData,
            result: sanitizeResult(result),
          });
        }

        return result;
      } catch (error) {
        logger.error(
          `${className}.${methodName} failed`,
          error as Error,
          logData,
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to measure and log performance
 */
export function LogPerformance(
  options: LogPerformanceOptions = {},
): MethodDecorator {
  const { metricName, threshold = 0, includeInMetrics = true } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const logger = getClassLogger(this);
      const methodName = String(propertyKey);
      const className = this.constructor.name;
      const fullMethodName = `${className}.${methodName}`;
      const metric =
        metricName ||
        `playback.${className.toLowerCase()}.${methodName.toLowerCase()}`;

      const startTime = performance.now();
      const metrics = includeInMetrics ? getMetricsCollector() : null;

      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;

        // Record metric
        if (metrics) {
          metrics.timing(metric, duration, {
            class: className,
            method: methodName,
          });
        }

        // Log if exceeds threshold
        if (duration >= threshold) {
          logger.info(`${fullMethodName} performance`, {
            duration,
            threshold,
            exceeded: duration - threshold,
          });
        }

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;

        if (metrics) {
          metrics.increment(`${metric}.errors`, 1, {
            class: className,
            method: methodName,
          });
          metrics.timing(`${metric}.error`, duration, {
            class: className,
            method: methodName,
          });
        }

        logger.error(`${fullMethodName} failed`, error as Error, { duration });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to log errors with optional sanitization
 */
export function LogErrors(options: LogErrorsOptions = {}): MethodDecorator {
  const { rethrow = true, sanitize = true, recoveryStrategies = [] } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const logger = getClassLogger(this);
      const methodName = String(propertyKey);
      const className = this.constructor.name;
      const metrics = getMetricsCollector();

      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorData: Record<string, any> = {
          method: methodName,
          class: className,
          recoverable: recoveryStrategies.length > 0,
          recoveryStrategies,
        };

        if (!sanitize) {
          errorData.args = args;
        }

        // Log the error
        logger.error(
          `${className}.${methodName} error`,
          error as Error,
          errorData,
        );

        // Record error metric
        if (metrics) {
          metrics.increment(`playback.errors.${className.toLowerCase()}`, 1, {
            method: methodName,
            errorType: (error as Error).name,
          });
        }

        // Emit error event for monitoring
        try {
          const eventBus = EventBus.getInstance();
          eventBus.emit('playback:error', {
            class: className,
            method: methodName,
            error,
            recoverable: recoveryStrategies.length > 0,
          });
        } catch {
          // Ignore if EventBus is not available
        }

        if (rethrow) {
          throw error;
        }
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to add correlation ID to async operations
 */
export function WithCorrelation(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const logger = getClassLogger(this);
      const methodName = String(propertyKey);
      const className = this.constructor.name;

      // Try to find correlation ID from args or generate new one
      let correlationId: string | undefined;

      // Check if first arg is an object with correlationId
      if (
        args[0] &&
        typeof args[0] === 'object' &&
        'correlationId' in args[0]
      ) {
        correlationId = args[0].correlationId;
      }

      // Generate new one if not found
      if (!correlationId) {
        correlationId = `${className}.${methodName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Log with correlation ID
      logger.debug(`${className}.${methodName} started`, { correlationId });

      try {
        const result = await originalMethod.apply(this, args);
        logger.debug(`${className}.${methodName} completed`, { correlationId });
        return result;
      } catch (error) {
        logger.error(`${className}.${methodName} failed`, error as Error, {
          correlationId,
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator to add logging to all methods
 */
export function LogClass(options: LogMethodOptions = {}): ClassDecorator {
  return function (target: any) {
    const className = target.name;

    // Add logger to class prototype
    const loggerKey = Symbol.for('__logger__');
    target.prototype[loggerKey] = createStructuredLogger(
      `playback:${className}`,
    );

    // Get all method names
    const propertyNames = Object.getOwnPropertyNames(target.prototype);

    for (const propertyName of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(
        target.prototype,
        propertyName,
      );

      if (
        descriptor &&
        typeof descriptor.value === 'function' &&
        propertyName !== 'constructor'
      ) {
        // Apply LogMethod decorator to each method
        Object.defineProperty(
          target.prototype,
          propertyName,
          LogMethod(options)(
            target.prototype,
            propertyName,
            descriptor,
          ) as PropertyDescriptor,
        );
      }
    }

    return target;
  };
}

/**
 * Measure and log async operation performance
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>,
  options: {
    logger?: StructuredLogger;
    tags?: Record<string, string>;
    threshold?: number;
  } = {},
): Promise<T> {
  const { logger, tags = {}, threshold = 0 } = options;
  const log = logger || createStructuredLogger('playback:measure');
  const metrics = getMetricsCollector();

  const startTime = performance.now();

  try {
    const result = await operation();
    const duration = performance.now() - startTime;

    if (metrics) {
      metrics.timing(`playback.measure.${name}`, duration, tags);
    }

    if (duration >= threshold) {
      log.info(`Async operation completed: ${name}`, { duration, ...tags });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    if (metrics) {
      metrics.increment(`playback.measure.${name}.errors`, 1, tags);
    }

    log.error(`Async operation failed: ${name}`, error as Error, {
      duration,
      ...tags,
    });
    throw error;
  }
}
