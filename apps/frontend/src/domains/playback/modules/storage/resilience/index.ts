/**
 * Resilience Module
 *
 * Provides resilience patterns for storage operations including:
 * - Circuit breaker pattern for fault tolerance
 * - Retry logic with exponential backoff
 * - Bulkhead pattern for resource isolation
 * - Timeout protection
 * - Combined resilience policies
 */

export { CircuitBreaker } from './CircuitBreaker.js';
export { RetryManager } from './RetryManager.js';
export { ResiliencePolicy } from './ResiliencePolicy.js';

export type {
  // Circuit Breaker types
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerError,

  // Retry types
  RetryConfig,

  // Bulkhead types
  BulkheadConfig,
  BulkheadRejectedError,

  // Timeout types
  TimeoutConfig,
  TimeoutError,

  // Health check types
  HealthCheckConfig,

  // Policy types
  ResiliencePolicy as ResiliencePolicyConfig,
  ResilienceMetrics,
} from './types.js';
