/**
 * Shared Circuit Breaker for Sample Loading Operations
 *
 * Provides circuit breaker protection for all sample/config loading
 * to prevent cascading failures when Supabase is unavailable.
 *
 * Usage:
 *   import { protectedSampleFetch } from './SampleLoadingCircuitBreaker.js';
 *   const response = await protectedSampleFetch(url, 'operation-id');
 */

import {
  CircuitBreakerIntegration,
  CriticalPath,
} from '../../modules/errors/CircuitBreakerIntegration.js';
import { CircuitBreakerOpenError } from '../../modules/errors/StorageErrors.js';
import { EventBus } from './EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('SampleLoadingCircuitBreaker');

// Default timeout for sample fetch operations (10 seconds)
export const SAMPLE_FETCH_TIMEOUT_MS = 10000;

let instance: CircuitBreakerIntegration | null = null;

/**
 * Get the shared circuit breaker instance for sample loading
 */
export function getSampleLoadingCircuitBreaker(): CircuitBreakerIntegration {
  if (!instance) {
    const eventBus = EventBus.getGlobalInstance();
    instance = new CircuitBreakerIntegration(eventBus);
    logger.info('SampleLoadingCircuitBreaker initialized');
  }
  return instance;
}

/**
 * Execute an operation with circuit breaker protection
 * Throws CircuitBreakerOpenError if circuit is open (service unavailable)
 */
export async function executeWithSampleBreaker<T>(
  operation: () => Promise<T>,
  operationId: string,
): Promise<T> {
  return getSampleLoadingCircuitBreaker().executeWithBreaker(
    CriticalPath.SAMPLE_LOADING,
    operation,
    operationId,
  );
}

/**
 * Check if sample loading circuit is currently open (service down)
 */
export function isSampleLoadingAvailable(): boolean {
  const breaker = getSampleLoadingCircuitBreaker().getBreaker(
    CriticalPath.SAMPLE_LOADING,
  );
  return breaker?.getState() !== 'open';
}

/**
 * Get the current circuit breaker status for monitoring/UI
 */
export function getSampleLoadingStatus(): {
  available: boolean;
  state: string;
  message?: string;
} {
  const breaker = getSampleLoadingCircuitBreaker().getBreaker(
    CriticalPath.SAMPLE_LOADING,
  );
  const state = breaker?.getState() || 'unknown';

  if (state === 'open') {
    return {
      available: false,
      state,
      message:
        'Audio samples temporarily unavailable. Please try again shortly.',
    };
  }

  return {
    available: true,
    state,
  };
}

/**
 * Fetch with timeout wrapper for sample loading
 * @param url - URL to fetch
 * @param timeout - Timeout in milliseconds (default: 10000)
 */
export async function fetchWithTimeout(
  url: string,
  timeout: number = SAMPLE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      headers: { Accept: 'audio/*' },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Sample fetch timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
}

/**
 * Protected fetch for sample loading - combines timeout + circuit breaker
 *
 * This is the primary function to use for all sample loading operations.
 * It provides:
 * - 10 second timeout (configurable)
 * - Circuit breaker protection (opens after 10 failures, recovers after 30s)
 * - Throws on HTTP errors (4xx, 5xx)
 *
 * @param url - URL to fetch
 * @param operationId - Unique identifier for this operation (for tracing)
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @throws {CircuitBreakerOpenError} when circuit is open
 * @throws {Error} on timeout or HTTP errors
 */
export async function protectedSampleFetch(
  url: string,
  operationId: string,
  timeout: number = SAMPLE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  return executeWithSampleBreaker(async () => {
    const response = await fetchWithTimeout(url, timeout);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} for ${url}`,
      );
    }
    return response;
  }, operationId);
}

/**
 * Reset the circuit breaker (for testing or manual recovery)
 */
export function resetSampleLoadingCircuitBreaker(): void {
  const breaker = getSampleLoadingCircuitBreaker();
  breaker.resetBreaker(CriticalPath.SAMPLE_LOADING);
  logger.info('SampleLoadingCircuitBreaker reset');
}

// Re-export for convenience
export { CircuitBreakerOpenError, CriticalPath };
