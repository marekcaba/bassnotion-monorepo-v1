/**
 * Retry Manager Module
 *
 * Implements retry logic with exponential backoff, jitter,
 * and configurable retry policies
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RetryManager');
import { RetryConfig } from './types.js';

/**
 * Retry Manager for resilient operations
 */
export class RetryManager {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      ...config,
      maxDelay:
        config.maxDelay ??
        config.initialDelay *
          Math.pow(config.backoffMultiplier ?? 2, config.maxAttempts),
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitter: config.jitter ?? true,
      retryableErrors: config.retryableErrors ?? (() => true),
    } as Required<RetryConfig>;

    logger.info(
      `🔄 Retry manager initialized: ${JSON.stringify({
        maxAttempts: this.config.maxAttempts,
        initialDelay: this.config.initialDelay,
        maxDelay: this.config.maxDelay,
        backoffMultiplier: this.config.backoffMultiplier,
      })}`,
    );
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        logger.debug(`🔄 Attempt ${attempt}/${this.config.maxAttempts}`);
        const result = await operation();

        if (attempt > 1) {
          logger.info(`🔄 Operation succeeded after ${attempt} attempts`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.config.retryableErrors(error)) {
          logger.error('🔄 Non-retryable error encountered:', error);
          throw error;
        }

        // Don't retry if this was the last attempt
        if (attempt === this.config.maxAttempts) {
          logger.error(`🔄 All ${this.config.maxAttempts} attempts failed`);
          break;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt);

        // Call retry callback
        this.config.onRetry?.(attempt, error);

        logger.warn(`🔄 Attempt ${attempt} failed, retrying in ${delay}ms...`);

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // All attempts failed
    throw lastError;
  }

  /**
   * Execute with custom retry policy
   */
  async executeWithPolicy<T>(
    operation: () => Promise<T>,
    customConfig: Partial<RetryConfig>,
  ): Promise<T> {
    const manager = new RetryManager({
      ...this.config,
      ...customConfig,
    });

    return manager.execute(operation);
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attemptNumber: number): number {
    // Calculate exponential backoff
    let delay =
      this.config.initialDelay *
      Math.pow(this.config.backoffMultiplier, attemptNumber - 1);

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter if enabled
    if (this.config.jitter) {
      // Random jitter between 0% and 25% of delay
      const jitterAmount = delay * 0.25 * Math.random();
      delay = delay + jitterAmount;
    }

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a retriable wrapper for a function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(() => fn(...args));
    }) as T;
  }

  /**
   * Get retry statistics
   */
  getStatistics(): {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    usesJitter: boolean;
  } {
    return {
      maxAttempts: this.config.maxAttempts,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      backoffMultiplier: this.config.backoffMultiplier,
      usesJitter: this.config.jitter,
    };
  }
}
