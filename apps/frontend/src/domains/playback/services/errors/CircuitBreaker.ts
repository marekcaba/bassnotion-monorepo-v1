/**
 * Circuit Breaker Pattern
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/storage/resilience/CircuitBreaker.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/storage/resilience' directly
 */

export { CircuitBreaker } from '../../modules/storage/resilience/CircuitBreaker.js';
export type {
  CircuitBreakerState as CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerConfig as CircuitBreakerOptions,
  CircuitBreakerEvent as CircuitBreakerStateChangeEvent,
  CircuitBreakerMetrics,
} from '../../modules/storage/resilience/types.js';

// Also export CircuitBreakerManager for backward compatibility
export { CircuitBreakerFactory as CircuitBreakerManager } from '../../patterns/CircuitBreaker.js';

// Export CircuitState as enum-like constant for backward compatibility with tests
export const CircuitState = {
  OPEN: 'open' as const,
  CLOSED: 'closed' as const,
  HALF_OPEN: 'half-open' as const,
};
