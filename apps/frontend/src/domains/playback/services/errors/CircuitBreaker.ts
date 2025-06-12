/**
 * CircuitBreaker - Production Error Recovery with Circuit Breaker Pattern
 *
 * Implements circuit breaker pattern with exponential backoff, failure tracking,
 * and automatic recovery for production-grade error handling.
 *
 * Part of Story 2.1: Task 5, Subtask 5.2 - Automatic error recovery
 */

export enum CircuitState {
  CLOSED = 'closed', // Normal operation, failures allowed
  OPEN = 'open', // Circuit tripped, blocking requests
  HALF_OPEN = 'half_open', // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before half-open (ms)
  successThreshold: number; // Successes needed to close from half-open
  timeout: number; // Request timeout (ms)
  exponentialBackoff: {
    baseDelay: number; // Base delay for exponential backoff (ms)
    maxDelay: number; // Maximum delay (ms)
    multiplier: number; // Backoff multiplier
    jitter: boolean; // Add random jitter to prevent thundering herd
  };
  retryPolicy: {
    maxRetries: number; // Maximum retry attempts
    retryableErrors: string[]; // Error types that are retryable
  };
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  rejectedCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  averageResponseTime: number;
  uptime: number; // Percentage uptime
}

export interface RetryContext {
  attempt: number;
  lastError?: Error;
  totalElapsed: number;
  nextRetryDelay: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private rejectedCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests = 0;
  private totalResponseTime = 0;
  private nextOpenTime?: number;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;
  private forcedOpen = false;

  // Retry state tracking
  private activeRetries = new Map<string, RetryContext>();

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 2,
      timeout: 10000,
      exponentialBackoff: {
        baseDelay: 1000,
        maxDelay: 30000,
        multiplier: 2,
        jitter: true,
      },
      retryPolicy: {
        maxRetries: 3,
        retryableErrors: [
          'NetworkError',
          'TimeoutError',
          'ServiceUnavailableError',
        ],
      },
      ...config,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  public async execute<T>(
    operation: () => Promise<T>,
    operationId?: string,
  ): Promise<T> {
    const startTime = Date.now();
    this.totalRequests++;

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        this.rejectedCount++;

        // When circuit is OPEN, immediately reject all requests
        throw new Error(
          `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
        );
      }
    }

    const requestId =
      operationId || `${this.name}-${Date.now()}-${Math.random()}`;

    try {
      const result = await this.executeWithTimeout(operation);

      // Success path
      this.activeRetries.delete(requestId);
      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      // Handle both Error objects and non-Error objects
      const preservedError = error; // Preserve original error for final throw

      // For HALF_OPEN state, fail immediately without retries
      if (this.state === CircuitState.HALF_OPEN) {
        this.onFailure(error);
        this.activeRetries.delete(requestId);
        throw preservedError; // Preserve non-Error objects even in HALF_OPEN
      }

      // Check if we should retry
      if (this.shouldRetry(error, requestId)) {
        // Count initial failure immediately to track operation degradation
        this.onFailure(preservedError);

        try {
          const result = await this.retryWithBackoff(
            operation,
            requestId,
            preservedError,
          );
          // Success after retries - failure already counted, just count success
          const responseTime = Date.now() - startTime;
          this.onSuccess(responseTime);
          return result;
        } catch (retryError) {
          // All retries failed - failure already counted, don't double-count
          this.activeRetries.delete(requestId);
          const errorMessage = (retryError as Error).message;
          if (errorMessage.includes('Maximum retry attempts')) {
            // Throw retry exhaustion error for truly exhausted retries
            throw retryError;
          } else {
            // Preserve original error (including non-Error objects)
            throw preservedError;
          }
        }
      } else {
        // No retries attempted - count as failure and preserve original error
        this.onFailure(error);
        this.activeRetries.delete(requestId);
        throw preservedError; // Preserve non-Error objects
      }
    }
  }

  /**
   * Execute operation with retry and exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    requestId: string,
    _initialError: unknown,
  ): Promise<T> {
    let retryContext = this.activeRetries.get(requestId);

    if (!retryContext) {
      retryContext = {
        attempt: 0,
        totalElapsed: 0,
        nextRetryDelay: this.config.exponentialBackoff.baseDelay,
      };
      this.activeRetries.set(requestId, retryContext);
    }

    // Use recursive approach to ensure proper promise chaining
    const attemptRetry = async (): Promise<T> => {
      if (retryContext!.attempt >= this.config.retryPolicy.maxRetries) {
        // All retries exhausted - clean up and throw retry exhaustion message
        this.activeRetries.delete(requestId);
        const lastError =
          retryContext!.lastError ||
          new Error('Maximum retry attempts exceeded');
        throw new Error(
          `Maximum retry attempts (${this.config.retryPolicy.maxRetries}) exceeded. Last error: ${lastError.message}`,
        );
      }

      retryContext!.attempt++;

      try {
        const result = await this.executeWithTimeout(operation);
        // Success on retry - clean up and return
        this.activeRetries.delete(requestId);
        return result;
      } catch (error) {
        // Do NOT track individual retry failures - only track final operation failure
        retryContext!.lastError = error as Error;

        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(retryContext!.attempt);
        retryContext!.nextRetryDelay = delay;
        retryContext!.totalElapsed += delay;

        // Delay before next retry
        await this.delay(delay);

        // Recursively attempt next retry
        return attemptRetry();
      }
    };

    return attemptRetry();
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    let timeoutId: NodeJS.Timeout | number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = globalThis.setTimeout(() => {
        reject(
          new Error(
            `timeout: Operation timed out after ${this.config.timeout}ms`,
          ),
        );
      }, this.config.timeout);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } finally {
      // Always clear the timeout to prevent unhandled rejections
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId as any);
      }
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(responseTime: number): void {
    this.lastSuccessTime = Date.now();
    this.totalResponseTime += responseTime;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Don't reset failure count on every success in CLOSED state
      // This allows tracking of recent failures
      this.successCount++;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(_error: Error | unknown): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Return to open state
      this.state = CircuitState.OPEN;
      this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
      }
    }
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(error: Error | unknown, requestId: string): boolean {
    // Handle non-Error objects by creating Error wrapper
    const errorObj = error instanceof Error ? error : new Error(String(error));
    // Check if error type is retryable - use error.name which can be set explicitly
    const errorType = errorObj.name || errorObj.constructor.name;
    if (!this.config.retryPolicy.retryableErrors.includes(errorType)) {
      return false;
    }

    // Don't retry if circuit is open
    if (this.state === CircuitState.OPEN) {
      return false;
    }

    // Check retry limits - we haven't created the context yet, so check if we can start retrying
    const retryContext = this.activeRetries.get(requestId);
    const currentAttempt = retryContext?.attempt || 0;

    if (currentAttempt >= this.config.retryPolicy.maxRetries) {
      return false;
    }

    return true;
  }

  /**
   * Check if circuit should attempt recovery
   * Uses a tolerance window to handle real-world timer scheduling variations
   */
  private shouldAttemptRecovery(): boolean {
    if (!this.nextOpenTime) return false;

    // Production-grade tolerance: allow recovery slightly before exact timeout
    // This accounts for real-world timer scheduling variations and execution timing
    const RECOVERY_TOLERANCE_MS = Math.min(
      50,
      this.config.recoveryTimeout * 0.05,
    );

    return Date.now() >= this.nextOpenTime - RECOVERY_TOLERANCE_MS;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.config.exponentialBackoff.baseDelay *
      Math.pow(this.config.exponentialBackoff.multiplier, attempt - 1);

    return Math.min(exponentialDelay, this.config.exponentialBackoff.maxDelay);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      // Use globalThis.setTimeout to ensure we get the mocked version in tests
      globalThis.setTimeout(resolve, ms);
    });
  }

  /**
   * Get circuit breaker metrics
   */
  public getMetrics(): CircuitBreakerMetrics {
    const uptime =
      this.totalRequests > 0
        ? ((this.totalRequests - this.rejectedCount) / this.totalRequests) * 100
        : 100;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      rejectedCount: this.rejectedCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      averageResponseTime:
        this.totalRequests > 0
          ? this.totalResponseTime / this.totalRequests
          : 0,
      uptime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.rejectedCount = 0;
    this.totalRequests = 0; // Reset total requests counter
    this.totalResponseTime = 0; // Reset total response time
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.activeRetries.clear();
    this.nextOpenTime = undefined;
    this.forcedOpen = false;
  }

  /**
   * Force circuit to open state
   */
  public forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
    this.forcedOpen = true;
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get active retry contexts
   */
  public getActiveRetries(): Map<string, RetryContext> {
    return new Map(this.activeRetries);
  }
}

/**
 * Circuit Breaker Manager for handling multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Get or create circuit breaker
   */
  public getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, config));
    }
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Failed to create circuit breaker: ${name}`);
    }
    return circuitBreaker;
  }

  /**
   * Get all circuit breaker metrics
   */
  public getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    this.circuitBreakers.forEach((circuitBreaker, name) => {
      metrics[name] = circuitBreaker.getMetrics();
    });

    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  public resetAll(): void {
    this.circuitBreakers.forEach((circuitBreaker) => circuitBreaker.reset());
  }

  /**
   * Remove circuit breaker
   */
  public remove(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  public clear(): void {
    this.circuitBreakers.clear();
  }
}
