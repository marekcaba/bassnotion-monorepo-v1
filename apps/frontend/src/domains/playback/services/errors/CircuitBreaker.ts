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
        throw new Error(
          `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
        );
      }
    }

    const requestId =
      operationId || `${this.name}-${Date.now()}-${Math.random()}`;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);

      // Record success
      this.onSuccess(Date.now() - startTime);

      // Clear any retry context for this operation
      this.activeRetries.delete(requestId);

      return result;
    } catch (error) {
      // Record failure
      this.onFailure(error as Error);

      // Attempt retry if applicable
      if (this.shouldRetry(error as Error, requestId)) {
        return await this.retryWithBackoff(operation, requestId);
      }

      throw error;
    }
  }

  /**
   * Execute operation with retry and exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    requestId: string,
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

    retryContext.attempt++;

    if (retryContext.attempt > this.config.retryPolicy.maxRetries) {
      this.activeRetries.delete(requestId);
      throw new Error(
        `Maximum retry attempts (${this.config.retryPolicy.maxRetries}) exceeded for '${this.name}'`,
      );
    }

    // Calculate delay with exponential backoff
    const delay = this.calculateBackoffDelay(retryContext.attempt);
    retryContext.nextRetryDelay = delay;

    // Add jitter to prevent thundering herd
    const finalDelay = this.config.exponentialBackoff.jitter
      ? delay + Math.random() * 1000
      : delay;

    console.log(
      `Circuit breaker '${this.name}': Retry attempt ${retryContext.attempt}/${this.config.retryPolicy.maxRetries} in ${finalDelay}ms`,
    );

    await this.delay(finalDelay);
    retryContext.totalElapsed += finalDelay;

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess(Date.now());
      this.activeRetries.delete(requestId);
      return result;
    } catch (error) {
      retryContext.lastError = error as Error;
      this.onFailure(error as Error);

      // Continue retry loop
      return await this.retryWithBackoff(operation, requestId);
    }
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Operation timed out after ${this.config.timeout}ms`),
          );
        }, this.config.timeout);
      }),
    ]);
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
        console.log(
          `Circuit breaker '${this.name}' closed - service recovered`,
        );
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(_error: Error): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Return to open state
      this.state = CircuitState.OPEN;
      this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
      console.log(
        `Circuit breaker '${this.name}' opened - service still failing`,
      );
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
        console.log(
          `Circuit breaker '${this.name}' opened - failure threshold (${this.config.failureThreshold}) exceeded`,
        );
      }
    }
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(_error: Error, requestId: string): boolean {
    const retryContext = this.activeRetries.get(requestId);
    const attempt = retryContext?.attempt || 0;

    // Check retry limits
    if (attempt >= this.config.retryPolicy.maxRetries) {
      return false;
    }

    // Check if error type is retryable
    const errorType = _error.constructor.name;
    if (!this.config.retryPolicy.retryableErrors.includes(errorType)) {
      return false;
    }

    // Don't retry if circuit is open
    if (this.state === CircuitState.OPEN) {
      return false;
    }

    return true;
  }

  /**
   * Check if circuit should attempt recovery
   */
  private shouldAttemptRecovery(): boolean {
    if (!this.nextOpenTime) return false;
    return Date.now() >= this.nextOpenTime;
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
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    this.activeRetries.clear();
    this.nextOpenTime = undefined;
    console.log(`Circuit breaker '${this.name}' manually reset`);
  }

  /**
   * Force circuit to open state
   */
  public forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextOpenTime = Date.now() + this.config.recoveryTimeout;
    console.log(`Circuit breaker '${this.name}' manually opened`);
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
