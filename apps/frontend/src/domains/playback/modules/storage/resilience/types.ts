/**
 * Resilience Module Types
 *
 * Type definitions for resilience patterns including
 * circuit breaker, retry strategies, and health monitoring
 */

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'open' | 'closed' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;

  /** Success threshold to close from half-open state */
  successThreshold?: number;

  /** Time in ms before attempting to close the circuit */
  recoveryTimeout: number;

  /** Time window in ms for counting failures */
  failureWindow?: number;

  /** Callback when state changes */
  onStateChange?: (
    newState: CircuitBreakerState,
    previousState: CircuitBreakerState,
  ) => void;

  /** Callback when circuit opens */
  onOpen?: (failureCount: number) => void;

  /** Callback when circuit closes */
  onClose?: () => void;

  /** Callback when circuit enters half-open state */
  onHalfOpen?: () => void;

  /** Function to determine if an error should count as failure */
  errorFilter?: (error: unknown) => boolean;

  /** Fallback function when circuit is open */
  fallback?: <T>() => Promise<T> | T;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Current state */
  state: CircuitBreakerState;

  /** Total number of requests */
  totalRequests: number;

  /** Number of successful requests */
  successfulRequests: number;

  /** Number of failed requests */
  failedRequests: number;

  /** Number of requests rejected due to open circuit */
  rejectedRequests: number;

  /** Current consecutive failures */
  consecutiveFailures: number;

  /** Current consecutive successes */
  consecutiveSuccesses: number;

  /** Last failure timestamp */
  lastFailureTime?: number;

  /** Last success timestamp */
  lastSuccessTime?: number;

  /** Last state change timestamp */
  lastStateChangeTime: number;

  /** Number of times circuit has been opened */
  timesOpened: number;

  /** Success rate percentage */
  successRate: number;

  /** Average response time for successful requests */
  averageResponseTime: number;
}

/**
 * Circuit breaker events
 */
export interface CircuitBreakerEvent {
  /** Event type */
  type:
    | 'state_change'
    | 'request_success'
    | 'request_failure'
    | 'request_rejected'
    | 'recovery_attempt';

  /** Timestamp */
  timestamp: number;

  /** Current state */
  state: CircuitBreakerState;

  /** Event details */
  details?: Record<string, unknown>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Initial delay between retries in ms */
  initialDelay: number;

  /** Maximum delay between retries in ms */
  maxDelay?: number;

  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;

  /** Add jitter to delays to prevent thundering herd */
  jitter?: boolean;

  /** Function to determine if error is retryable */
  retryableErrors?: (error: unknown) => boolean;

  /** Callback on each retry attempt */
  onRetry?: (attemptNumber: number, error: unknown) => void;
}

/**
 * Bulkhead configuration
 */
export interface BulkheadConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;

  /** Maximum queued requests */
  maxQueued?: number;

  /** Queue timeout in ms */
  queueTimeout?: number;

  /** Callback when request is queued */
  onQueue?: () => void;

  /** Callback when request is rejected */
  onReject?: () => void;
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Timeout duration in ms */
  duration: number;

  /** Callback when timeout occurs */
  onTimeout?: () => void;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Interval between health checks in ms */
  interval: number;

  /** Health check function */
  checkHealth: () => Promise<boolean> | boolean;

  /** Number of consecutive failures before marking unhealthy */
  failureThreshold?: number;

  /** Number of consecutive successes before marking healthy */
  successThreshold?: number;

  /** Callback when health status changes */
  onHealthChange?: (isHealthy: boolean) => void;
}

/**
 * Resilience policy combining multiple patterns
 */
export interface ResiliencePolicy {
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;

  /** Retry configuration */
  retry?: RetryConfig;

  /** Bulkhead configuration */
  bulkhead?: BulkheadConfig;

  /** Timeout configuration */
  timeout?: TimeoutConfig;

  /** Health check configuration */
  healthCheck?: HealthCheckConfig;

  /** Policy name for identification */
  name: string;

  /** Policy description */
  description?: string;
}

/**
 * Resilience metrics
 */
export interface ResilienceMetrics {
  /** Circuit breaker metrics */
  circuitBreaker?: CircuitBreakerMetrics;

  /** Retry metrics */
  retry?: {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryCount: number;
  };

  /** Bulkhead metrics */
  bulkhead?: {
    activeExecutions: number;
    queuedRequests: number;
    rejectedRequests: number;
  };

  /** Timeout metrics */
  timeout?: {
    totalTimeouts: number;
    averageExecutionTime: number;
  };

  /** Health check metrics */
  health?: {
    isHealthy: boolean;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastCheckTime: number;
  };
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly failureCount?: number,
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly duration: number,
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Bulkhead rejected error
 */
export class BulkheadRejectedError extends Error {
  constructor(
    message: string,
    public readonly reason: 'max_concurrent' | 'queue_full' | 'queue_timeout',
  ) {
    super(message);
    this.name = 'BulkheadRejectedError';
  }
}
