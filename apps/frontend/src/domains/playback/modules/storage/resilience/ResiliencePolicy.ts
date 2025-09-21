/**
 * Resilience Policy Module
 *
 * Combines multiple resilience patterns (circuit breaker, retry, timeout, etc.)
 * into a cohesive policy for protecting service calls
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('ResiliencePolicy');
import { CircuitBreaker } from './CircuitBreaker.js';
import { RetryManager } from './RetryManager.js';
import {
  ResiliencePolicy as ResiliencePolicyConfig,
  ResilienceMetrics,
  TimeoutError,
  BulkheadRejectedError,
} from './types.js';

/**
 * Comprehensive resilience policy implementation
 */
export class ResiliencePolicy {
  private config: ResiliencePolicyConfig;
  private circuitBreaker?: CircuitBreaker;
  private retryManager?: RetryManager;

  // Bulkhead state
  private activeConcurrent = 0;
  private queuedRequests = 0;
  private readonly requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    operation: () => Promise<any>;
    queueTime: number;
  }> = [];

  constructor(config: ResiliencePolicyConfig) {
    this.config = config;

    // Initialize circuit breaker if configured
    if (config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    }

    // Initialize retry manager if configured
    if (config.retry) {
      this.retryManager = new RetryManager(config.retry);
    }

    logger.info(`🛡️ Resilience policy initialized: ${config.name}`);
  }

  /**
   * Execute an operation with full resilience policy
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Apply bulkhead pattern if configured
    if (this.config.bulkhead) {
      return this.executeBulkhead(() => this.executeCore(operation));
    }

    return this.executeCore(operation);
  }

  /**
   * Core execution with circuit breaker, retry, and timeout
   */
  private async executeCore<T>(operation: () => Promise<T>): Promise<T> {
    // Wrap with timeout if configured
    let wrappedOperation = operation;
    if (this.config.timeout) {
      const timeoutDuration = this.config.timeout.duration;
      wrappedOperation = () =>
        this.executeWithTimeout(operation, timeoutDuration);
    }

    // Apply circuit breaker if configured
    if (this.circuitBreaker) {
      // If circuit breaker is configured with retry, use retry within circuit breaker
      if (this.retryManager) {
        const retryManager = this.retryManager;
        return this.circuitBreaker.execute(() =>
          retryManager.execute(wrappedOperation),
        );
      }
      return this.circuitBreaker.execute(wrappedOperation);
    }

    // Apply retry if configured (and no circuit breaker)
    if (this.retryManager) {
      return this.retryManager.execute(wrappedOperation);
    }

    // No resilience patterns configured, execute directly
    return wrappedOperation();
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        this.config.timeout?.onTimeout?.();
        reject(
          new TimeoutError(
            `Operation timed out after ${timeoutMs}ms`,
            timeoutMs,
          ),
        );
      }, timeoutMs);

      // Store timer for cleanup
      (timeoutPromise as any)._timer = timer;
    });

    try {
      // Race between operation and timeout
      const result = await Promise.race([operation(), timeoutPromise]);

      // Clear timeout if operation succeeded
      clearTimeout((timeoutPromise as any)._timer);

      return result;
    } catch (error) {
      // Clear timeout on error
      clearTimeout((timeoutPromise as any)._timer);
      throw error;
    }
  }

  /**
   * Execute with bulkhead pattern
   */
  private async executeBulkhead<T>(operation: () => Promise<T>): Promise<T> {
    const bulkheadConfig = this.config.bulkhead;
    if (!bulkheadConfig) {
      // This should not happen due to check in execute(), but handle it safely
      return operation();
    }

    // Check if we can execute immediately
    if (this.activeConcurrent < bulkheadConfig.maxConcurrent) {
      this.activeConcurrent++;
      try {
        return await operation();
      } finally {
        this.activeConcurrent--;
        this.processQueue();
      }
    }

    // Check if we can queue
    const maxQueued = bulkheadConfig.maxQueued ?? 0;
    if (maxQueued > 0 && this.queuedRequests < maxQueued) {
      return this.queueRequest(operation);
    }

    // Reject - bulkhead full
    bulkheadConfig.onReject?.();
    throw new BulkheadRejectedError(
      'Bulkhead rejected - maximum concurrent executions reached',
      'max_concurrent',
    );
  }

  /**
   * Queue a request for later execution
   */
  private queueRequest<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queueTime = Date.now();
      const bulkheadConfig = this.config.bulkhead;
      if (!bulkheadConfig) {
        // This should not happen, but handle it safely
        reject(new Error('Bulkhead not configured'));
        return;
      }
      const queueTimeout = bulkheadConfig.queueTimeout;

      // Set queue timeout if configured
      let timeoutHandle: NodeJS.Timeout | undefined;
      if (queueTimeout) {
        timeoutHandle = setTimeout(() => {
          // Remove from queue
          const index = this.requestQueue.findIndex(
            (item) => item.resolve === resolve,
          );
          if (index !== -1) {
            this.requestQueue.splice(index, 1);
            this.queuedRequests--;
            reject(
              new BulkheadRejectedError(
                `Request timed out in queue after ${queueTimeout}ms`,
                'queue_timeout',
              ),
            );
          }
        }, queueTimeout);
      }

      // Add to queue
      this.queuedRequests++;
      this.requestQueue.push({
        resolve: (value) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve(value);
        },
        reject: (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(error);
        },
        operation,
        queueTime,
      });

      bulkheadConfig.onQueue?.();
      logger.debug(`🛡️ Request queued (queue size: ${this.queuedRequests})`);
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    const bulkheadConfig = this.config.bulkhead;
    if (!bulkheadConfig) return;

    while (
      this.requestQueue.length > 0 &&
      this.activeConcurrent < bulkheadConfig.maxConcurrent
    ) {
      const item = this.requestQueue.shift();
      if (!item) break;

      this.queuedRequests--;
      this.activeConcurrent++;

      const queueDuration = Date.now() - item.queueTime;
      logger.debug(`🛡️ Processing queued request (waited ${queueDuration}ms)`);

      try {
        const result = await item.operation();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      } finally {
        this.activeConcurrent--;
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ResilienceMetrics {
    const metrics: ResilienceMetrics = {};

    if (this.circuitBreaker) {
      metrics.circuitBreaker = this.circuitBreaker.getMetrics();
    }

    if (this.config.bulkhead) {
      metrics.bulkhead = {
        activeExecutions: this.activeConcurrent,
        queuedRequests: this.queuedRequests,
        rejectedRequests: 0, // Would need to track this
      };
    }

    // Additional metrics would be tracked by respective components

    return metrics;
  }

  /**
   * Reset all resilience components
   */
  reset(): void {
    this.circuitBreaker?.reset();

    // Clear bulkhead queue
    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      item?.reject(new Error('Policy reset'));
    }
    this.activeConcurrent = 0;
    this.queuedRequests = 0;

    logger.info(`🛡️ Resilience policy reset: ${this.config.name}`);
  }

  /**
   * Get policy configuration
   */
  getConfig(): ResiliencePolicyConfig {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.circuitBreaker?.dispose();
    this.reset();
    logger.info(`🛡️ Resilience policy disposed: ${this.config.name}`);
  }
}
