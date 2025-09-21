/**
 * Circuit Breaker Module
 *
 * Implements the circuit breaker pattern for resilient service calls
 * with enhanced features like sliding window, half-open testing, and metrics
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('CircuitBreaker');
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerError,
} from './types.js';

/**
 * Enhanced Circuit Breaker implementation
 * Protects against cascading failures in distributed systems
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private previousState: CircuitBreakerState = 'closed';
  private config: Required<CircuitBreakerConfig>;

  // Metrics
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private rejectedRequests = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private lastStateChangeTime = Date.now();
  private timesOpened = 0;
  private responseTimes: number[] = [];

  // Sliding window for failure tracking
  private failureTimestamps: number[] = [];

  // Recovery timer
  private recoveryTimer?: NodeJS.Timeout;

  // Event history
  private eventHistory: CircuitBreakerEvent[] = [];
  private maxEventHistory = 100;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...config,
      successThreshold:
        config.successThreshold ?? Math.ceil(config.failureThreshold / 2),
      failureWindow: config.failureWindow ?? 60000, // 1 minute default
      errorFilter: config.errorFilter ?? (() => true),
      fallback: config.fallback,
    } as Required<CircuitBreakerConfig>;

    logger.info(
      `🔌 Circuit breaker initialized: ${JSON.stringify({
        failureThreshold: this.config.failureThreshold,
        successThreshold: this.config.successThreshold,
        recoveryTimeout: this.config.recoveryTimeout,
        failureWindow: this.config.failureWindow,
      })}`,
    );
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      this.rejectedRequests++;
      this.recordEvent('request_rejected');

      // Use fallback if available
      if (this.config.fallback) {
        logger.info('🔌 Circuit breaker open - using fallback');
        return this.config.fallback<T>();
      }

      throw new CircuitBreakerError(
        'Circuit breaker is open - request rejected',
        this.state,
        this.consecutiveFailures,
      );
    }

    const startTime = Date.now();
    this.totalRequests++;

    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;

      this.recordSuccess(responseTime);
      return result;
    } catch (error) {
      // Check if error should count as failure
      if (!this.config.errorFilter(error)) {
        // Error doesn't count, rethrow
        throw error;
      }

      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private recordSuccess(responseTime: number): void {
    this.successfulRequests++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // Track response times for metrics
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.recordEvent('request_success', { responseTime });

    // Handle state transitions
    if (this.state === 'half-open') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Record a failed operation
   */
  private recordFailure(): void {
    this.failedRequests++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = Date.now();

    // Add to sliding window
    this.failureTimestamps.push(Date.now());

    // Clean old failures outside window
    const windowStart = Date.now() - this.config.failureWindow;
    this.failureTimestamps = this.failureTimestamps.filter(
      (ts) => ts > windowStart,
    );

    this.recordEvent('request_failure', {
      consecutiveFailures: this.consecutiveFailures,
      failuresInWindow: this.failureTimestamps.length,
    });

    // Check if we should open the circuit
    if (this.state === 'closed' || this.state === 'half-open') {
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    if (this.state === 'open') return;

    this.changeState('open');
    this.timesOpened++;

    // Clear any existing recovery timer
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    // Set recovery timer
    this.recoveryTimer = setTimeout(() => {
      this.halfOpen();
    }, this.config.recoveryTimeout);

    // Call callback
    this.config.onOpen?.(this.consecutiveFailures);

    logger.warn(
      `🔌 Circuit breaker opened after ${this.consecutiveFailures} failures`,
    );
  }

  /**
   * Close the circuit breaker
   */
  private close(): void {
    if (this.state === 'closed') return;

    this.changeState('closed');
    this.consecutiveFailures = 0;
    this.failureTimestamps = [];

    // Clear recovery timer
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }

    // Call callback
    this.config.onClose?.();

    logger.info('🔌 Circuit breaker closed - normal operation resumed');
  }

  /**
   * Enter half-open state for testing
   */
  private halfOpen(): void {
    if (this.state === 'half-open') return;

    this.changeState('half-open');
    this.consecutiveSuccesses = 0;
    this.recordEvent('recovery_attempt');

    // Call callback
    this.config.onHalfOpen?.();

    logger.info('🔌 Circuit breaker half-open - testing recovery');
  }

  /**
   * Change state and trigger callbacks
   */
  private changeState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.previousState = oldState;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    this.recordEvent('state_change', {
      previousState: oldState,
      newState,
    });

    // Call state change callback
    this.config.onStateChange?.(newState, oldState);
  }

  /**
   * Record an event
   */
  private recordEvent(
    type: CircuitBreakerEvent['type'],
    details?: Record<string, unknown>,
  ): void {
    const event: CircuitBreakerEvent = {
      type,
      timestamp: Date.now(),
      state: this.state,
      details,
    };

    this.eventHistory.push(event);

    // Limit history size
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get previous state
   */
  getPreviousState(): CircuitBreakerState {
    return this.previousState;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const successRate =
      this.totalRequests > 0
        ? (this.successfulRequests / this.totalRequests) * 100
        : 100;

    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) /
          this.responseTimes.length
        : 0;

    return {
      state: this.state,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      rejectedRequests: this.rejectedRequests,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChangeTime: this.lastStateChangeTime,
      timesOpened: this.timesOpened,
      successRate,
      averageResponseTime,
    };
  }

  /**
   * Get event history
   */
  getEventHistory(): CircuitBreakerEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    logger.info('🔌 Circuit breaker manually reset');
    this.close();

    // Reset all metrics
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.rejectedRequests = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.timesOpened = 0;
    this.responseTimes = [];
    this.failureTimestamps = [];
    this.eventHistory = [];
  }

  /**
   * Force open the circuit breaker (for testing)
   */
  forceOpen(): void {
    logger.warn('🔌 Circuit breaker force opened');
    this.open();
  }

  /**
   * Force close the circuit breaker (for testing)
   */
  forceClose(): void {
    logger.warn('🔌 Circuit breaker force closed');
    this.close();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }

    logger.info('🔌 Circuit breaker disposed');
  }
}
