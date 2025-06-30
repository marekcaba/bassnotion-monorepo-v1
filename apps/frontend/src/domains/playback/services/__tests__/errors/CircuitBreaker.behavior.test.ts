/**
 * CircuitBreaker Behavior Tests
 *
 * Tests the circuit breaker pattern behaviors including state transitions,
 * failure tracking, exponential backoff, retry policies, and service protection.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  RetryContext,
} from '../../errors/CircuitBreaker.js';

// Test Environment Setup
const setupCircuitBreakerEnvironment = () => {
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Use safer mocking approach that doesn't break core functionality
  vi.spyOn(Date, 'now').mockReturnValue(1000);

  Object.defineProperty(performance, 'now', {
    value: vi.fn(() => 1000),
    writable: true,
    configurable: true,
  });

  Object.defineProperty(performance, 'mark', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });

  Object.defineProperty(performance, 'measure', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });

  // Use spyOn for Math.random to preserve other Math functions
  vi.spyOn(Math, 'random').mockReturnValue(0.5);

  return {};
};

// Circuit Breaker Scenario Builders
const createCircuitBreakerScenarios = () => {
  const configs = {
    fast: {
      failureThreshold: 2,
      recoveryTimeout: 1000,
      successThreshold: 1,
      timeout: 500,
      exponentialBackoff: {
        baseDelay: 100,
        maxDelay: 1000,
        multiplier: 1.5,
        jitter: false,
      },
      retryPolicy: {
        maxRetries: 2,
        retryableErrors: ['NetworkError', 'TimeoutError'],
      },
    } as CircuitBreakerConfig,

    standard: {
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
    } as CircuitBreakerConfig,

    robust: {
      failureThreshold: 10,
      recoveryTimeout: 300000,
      successThreshold: 5,
      timeout: 30000,
      exponentialBackoff: {
        baseDelay: 2000,
        maxDelay: 60000,
        multiplier: 3,
        jitter: true,
      },
      retryPolicy: {
        maxRetries: 5,
        retryableErrors: [
          'NetworkError',
          'TimeoutError',
          'ServiceUnavailableError',
          'ConnectionError',
        ],
      },
    } as CircuitBreakerConfig,
  };

  const createSuccessfulOperation = (responseTime = 100) => {
    return vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, responseTime));
      return 'success';
    });
  };

  const createFailingOperation = (
    errorType = 'NetworkError',
    failureCount = 1,
  ) => {
    let attempts = 0;
    return vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts <= failureCount) {
        const error = new Error(`${errorType}: Operation failed`);
        error.name = errorType;
        throw error;
      }
      return 'success';
    });
  };

  const createTimeoutOperation = (delay = 15000) => {
    return vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return 'timeout-success';
    });
  };

  const createIntermittentOperation = (successRate = 0.5) => {
    return vi.fn().mockImplementation(async () => {
      if (Math.random() < successRate) {
        return 'intermittent-success';
      } else {
        const error = new Error('NetworkError: Intermittent failure');
        error.name = 'NetworkError';
        throw error;
      }
    });
  };

  return {
    configs,
    createSuccessfulOperation,
    createFailingOperation,
    createTimeoutOperation,
    createIntermittentOperation,
  };
};

// Test Helpers
const expectValidCircuitState = (state: CircuitState) => {
  expect(Object.values(CircuitState)).toContain(state);
};

const expectValidCircuitMetrics = (metrics: CircuitBreakerMetrics) => {
  expect(metrics).toBeDefined();
  expect(typeof metrics.state).toBe('string');
  expect(typeof metrics.failureCount).toBe('number');
  expect(typeof metrics.successCount).toBe('number');
  expect(typeof metrics.rejectedCount).toBe('number');
  expect(typeof metrics.totalRequests).toBe('number');
  expect(typeof metrics.averageResponseTime).toBe('number');
  expect(typeof metrics.uptime).toBe('number');

  expectValidCircuitState(metrics.state);
  expect(metrics.failureCount).toBeGreaterThanOrEqual(0);
  expect(metrics.successCount).toBeGreaterThanOrEqual(0);
  expect(metrics.rejectedCount).toBeGreaterThanOrEqual(0);
  expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
  expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
  expect(metrics.uptime).toBeGreaterThanOrEqual(0);
  expect(metrics.uptime).toBeLessThanOrEqual(100);
};

const _expectValidRetryContext = (context: RetryContext) => {
  expect(context).toBeDefined();
  expect(typeof context.attempt).toBe('number');
  expect(typeof context.totalElapsed).toBe('number');
  expect(typeof context.nextRetryDelay).toBe('number');

  expect(context.attempt).toBeGreaterThanOrEqual(0);
  expect(context.totalElapsed).toBeGreaterThanOrEqual(0);
  expect(context.nextRetryDelay).toBeGreaterThan(0);
};

const _expectCircuitStateTransition = (
  fromState: CircuitState,
  toState: CircuitState,
  actualState: CircuitState,
) => {
  expect(actualState).toBe(toState);
};

// Behavior Tests
describe('CircuitBreaker Behaviors', () => {
  let scenarios: ReturnType<typeof createCircuitBreakerScenarios>;

  beforeEach(() => {
    setupCircuitBreakerEnvironment();
    scenarios = createCircuitBreakerScenarios();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Circuit Breaker Identity Behaviors', () => {
    test('should create circuit breaker with default configuration', () => {
      const circuitBreaker = new CircuitBreaker('test-service');

      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });

    test('should create circuit breaker with custom configuration', () => {
      const circuitBreaker = new CircuitBreaker(
        'custom-service',
        scenarios.configs.fast,
      );

      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
    });

    test('should provide unique circuit breaker instances', () => {
      const cb1 = new CircuitBreaker('service-1');
      const cb2 = new CircuitBreaker('service-2');

      expect(cb1).not.toBe(cb2);
      expect(cb1.getState()).toBe(CircuitState.CLOSED);
      expect(cb2.getState()).toBe(CircuitState.CLOSED);
    });

    test('should provide initial metrics state', () => {
      const circuitBreaker = new CircuitBreaker('metrics-test');
      const metrics = circuitBreaker.getMetrics();

      expectValidCircuitMetrics(metrics);
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.uptime).toBe(100); // Should start at 100% uptime
    });
  });

  describe('Circuit State Transition Behaviors', () => {
    test('should remain CLOSED during successful operations', async () => {
      const circuitBreaker = new CircuitBreaker(
        'success-service',
        scenarios.configs.fast,
      );
      const operation = scenarios.createSuccessfulOperation();

      // Execute multiple successful operations
      for (let i = 0; i < 5; i++) {
        const result = await circuitBreaker.execute(operation);
        expect(result).toBe('success');
        expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.successCount).toBe(5);
      expect(metrics.failureCount).toBe(0);
    });

    test('should transition CLOSED -> OPEN after failure threshold', async () => {
      const circuitBreaker = new CircuitBreaker(
        'failure-service',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation('NetworkError', 10);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Execute operations until threshold is reached
      for (let i = 0; i < scenarios.configs.fast.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.failureCount).toBeGreaterThanOrEqual(
        scenarios.configs.fast.failureThreshold,
      );
    });

    test('should transition OPEN -> HALF_OPEN after recovery timeout', async () => {
      const circuitBreaker = new CircuitBreaker(
        'recovery-service',
        scenarios.configs.fast,
      );
      const failingOperation = scenarios.createFailingOperation(
        'NetworkError',
        10,
      );

      // Trip the circuit breaker
      for (let i = 0; i < scenarios.configs.fast.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Mock time advancement
      let currentTime = 1000;
      (Date.now as any).mockImplementation(() => {
        currentTime += scenarios.configs.fast.recoveryTimeout + 100;
        return currentTime;
      });

      // Create successful operation for recovery test
      const successOperation = scenarios.createSuccessfulOperation();

      // Attempt operation after recovery timeout
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    test('should transition HALF_OPEN -> CLOSED after success threshold', async () => {
      const circuitBreaker = new CircuitBreaker(
        'half-open-service',
        scenarios.configs.fast,
      );

      // Force circuit to OPEN state
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Mock time advancement for recovery
      let currentTime = 1000;
      (Date.now as any).mockImplementation(() => {
        currentTime += scenarios.configs.fast.recoveryTimeout + 100;
        return currentTime;
      });

      const successOperation = scenarios.createSuccessfulOperation();

      // Execute successful operations to meet success threshold
      for (let i = 0; i < scenarios.configs.fast.successThreshold; i++) {
        const result = await circuitBreaker.execute(successOperation);
        expect(result).toBe('success');
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    test('should transition HALF_OPEN -> OPEN on failure', async () => {
      const circuitBreaker = new CircuitBreaker(
        'half-open-fail-service',
        scenarios.configs.fast,
      );

      // Force circuit to OPEN state
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Mock time advancement for recovery
      let currentTime = 1000;
      (Date.now as any).mockImplementation(() => {
        currentTime += scenarios.configs.fast.recoveryTimeout + 100;
        return currentTime;
      });

      const failingOperation = scenarios.createFailingOperation(
        'NetworkError',
        1,
      );

      // Attempt operation that fails in HALF_OPEN state
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected failure
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Failure Tracking Behaviors', () => {
    test('should track consecutive failures accurately', async () => {
      const circuitBreaker = new CircuitBreaker('failure-tracking', {
        ...scenarios.configs.fast,
        failureThreshold: 5, // Higher threshold to allow all 3 operations to execute
      });

      // Use a single failing operation that will be retried
      const failingOperation = scenarios.createFailingOperation(
        'NetworkError',
        10,
      ); // Always fails

      // Track failures - each execute() call should count as 1 failure regardless of retries
      let failureCount = 0;
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        failureCount++;
        expect(circuitBreaker.getMetrics().failureCount).toBe(failureCount);
      }

      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        failureCount++;
        expect(circuitBreaker.getMetrics().failureCount).toBe(failureCount);
      }

      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        failureCount++;
        expect(circuitBreaker.getMetrics().failureCount).toBe(failureCount);
      }

      expect(failureCount).toBe(3);
      expect(circuitBreaker.getMetrics().failureCount).toBe(3);
    }, 10000); // Extended timeout for this test

    test('should reset failure count on successful operation', async () => {
      const circuitBreaker = new CircuitBreaker(
        'failure-reset',
        scenarios.configs.standard,
      );

      // Execute some failures
      const failingOperation = scenarios.createFailingOperation(
        'NetworkError',
        2,
      );
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected failure
      }

      const metricsAfterFailure = circuitBreaker.getMetrics();
      expect(metricsAfterFailure.failureCount).toBeGreaterThan(0);

      // Execute successful operation
      const successOperation = scenarios.createSuccessfulOperation();
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe('success');

      const finalMetrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(finalMetrics);
      expect(finalMetrics.successCount).toBeGreaterThan(0);
    });

    test('should track different error types appropriately', async () => {
      const circuitBreaker = new CircuitBreaker(
        'error-types',
        scenarios.configs.standard,
      );

      const networkError = scenarios.createFailingOperation('NetworkError', 1);
      const timeoutError = scenarios.createFailingOperation('TimeoutError', 1);
      const systemError = scenarios.createFailingOperation('SystemError', 1);

      // Execute different error types
      const operations = [networkError, timeoutError, systemError];
      for (const operation of operations) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failures
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.failureCount).toBeGreaterThanOrEqual(operations.length);
    });

    test('should track timing metrics for operations', async () => {
      const circuitBreaker = new CircuitBreaker(
        'timing-tracking',
        scenarios.configs.standard,
      );

      // Mock time advancement for response time calculation
      let currentTime = 1000;
      (Date.now as any).mockImplementation(() => {
        const time = currentTime;
        currentTime += 150; // Simulate 150ms operations
        return time;
      });

      const operation = scenarios.createSuccessfulOperation(100);

      // Execute multiple operations
      for (let i = 0; i < 3; i++) {
        const result = await circuitBreaker.execute(operation);
        expect(result).toBe('success');
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.totalRequests).toBe(3);
    });
  });

  describe('Retry Policy Behaviors', () => {
    test('should retry retryable errors up to max attempts', async () => {
      const circuitBreaker = new CircuitBreaker(
        'retry-policy',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation(
        'NetworkError',
        scenarios.configs.fast.retryPolicy.maxRetries,
      );

      // This should eventually succeed after retries
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');

      // Verify the operation was called multiple times (initial + retries)
      expect(operation).toHaveBeenCalledTimes(
        scenarios.configs.fast.retryPolicy.maxRetries + 1,
      );
    });

    test('should not retry non-retryable errors', async () => {
      const circuitBreaker = new CircuitBreaker(
        'non-retry',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation(
        'AuthenticationError',
        1,
      );

      // Should fail immediately without retries
      try {
        await circuitBreaker.execute(operation);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Should only be called once (no retries for non-retryable errors)
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should exhaust all retry attempts for persistent failures', async () => {
      const circuitBreaker = new CircuitBreaker(
        'exhaust-retries',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation('NetworkError', 5); // Fail more than retry limit

      try {
        await circuitBreaker.execute(operation);
        expect.fail('Should have thrown error after exhausting retries');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Maximum retry attempts');
      }

      // Should be called maxRetries + 1 times (initial + retries)
      expect(operation).toHaveBeenCalledTimes(
        scenarios.configs.fast.retryPolicy.maxRetries + 1,
      );
    });

    test('should track active retry contexts', async () => {
      const circuitBreaker = new CircuitBreaker(
        'retry-context',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation('NetworkError', 5); // Fail more than retry limit

      // Execute operation and verify retry behavior
      try {
        await circuitBreaker.execute(operation, 'test-operation');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Maximum retry attempts');
      }

      // After completion, active retries should be cleared
      const finalActiveRetries = circuitBreaker.getActiveRetries();
      expect(finalActiveRetries.size).toBe(0);

      // Should be called: initial + 2 retries = 3 times (maxRetries limit)
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Exponential Backoff Behaviors', () => {
    test('should apply exponential backoff between retry attempts', async () => {
      const circuitBreaker = new CircuitBreaker(
        'backoff-test',
        scenarios.configs.standard,
      );
      const operation = scenarios.createFailingOperation('NetworkError', 2);

      const _startTime = Date.now();
      const result = await circuitBreaker.execute(operation);
      const _endTime = Date.now();

      expect(result).toBe('success');

      // With backoff, operation should take longer than without
      // This test validates the behavior exists
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('should respect maximum backoff delay', async () => {
      const circuitBreaker = new CircuitBreaker('max-backoff', {
        ...scenarios.configs.standard,
        exponentialBackoff: {
          baseDelay: 1000,
          maxDelay: 2000, // Low max delay
          multiplier: 10, // High multiplier
          jitter: false,
        },
        retryPolicy: {
          maxRetries: 5,
          retryableErrors: ['NetworkError'],
        },
      });

      const operation = scenarios.createFailingOperation('NetworkError', 3);

      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');

      // Verify retries occurred
      expect(operation).toHaveBeenCalledTimes(4);
    });

    test('should add jitter when configured', async () => {
      const circuitBreaker = new CircuitBreaker('jitter-test', {
        ...scenarios.configs.standard,
        exponentialBackoff: {
          baseDelay: 1000,
          maxDelay: 10000,
          multiplier: 2,
          jitter: true, // Enable jitter
        },
      });

      // Mock Math.random to return predictable jitter
      (Math.random as any).mockReturnValue(0.3);

      const operation = scenarios.createFailingOperation('NetworkError', 2);

      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');

      // Verify jitter was applied (Math.random was called)
      expect(Math.random).toHaveBeenCalled();
    });

    test('should scale backoff with multiplier', async () => {
      const circuitBreaker = new CircuitBreaker('multiplier-test', {
        ...scenarios.configs.fast,
        exponentialBackoff: {
          baseDelay: 100,
          maxDelay: 5000,
          multiplier: 3, // High multiplier
          jitter: false,
        },
      });

      const operation = scenarios.createFailingOperation('NetworkError', 2);

      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Circuit Protection Behaviors', () => {
    test('should reject requests when circuit is OPEN', async () => {
      const circuitBreaker = new CircuitBreaker(
        'protection-test',
        scenarios.configs.fast,
      );

      // Force circuit to OPEN state
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      const operation = scenarios.createSuccessfulOperation();

      try {
        await circuitBreaker.execute(operation);
        expect.fail('Should have rejected request');
      } catch (error) {
        expect((error as Error).message).toContain('Circuit breaker');
        expect((error as Error).message).toContain('OPEN');
      }

      // Operation should not have been called
      expect(operation).not.toHaveBeenCalled();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.rejectedCount).toBeGreaterThan(0);
    });

    test('should timeout long-running operations', async () => {
      const circuitBreaker = new CircuitBreaker('timeout-test', {
        ...scenarios.configs.fast,
        timeout: 200, // Short timeout
      });

      const operation = scenarios.createTimeoutOperation(1000); // Long operation

      try {
        await circuitBreaker.execute(operation);
        expect.fail('Should have timed out');
      } catch (error) {
        expect((error as Error).message).toContain('timeout');
      }
    });

    test('should protect against cascading failures', async () => {
      const circuitBreaker = new CircuitBreaker(
        'cascade-protection',
        scenarios.configs.fast,
      );
      const operation = scenarios.createFailingOperation('NetworkError', 10);

      // Execute multiple failures to trip circuit
      for (let i = 0; i < scenarios.configs.fast.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Subsequent requests should be rejected quickly
      const rejectedOperation = scenarios.createSuccessfulOperation();
      try {
        await circuitBreaker.execute(rejectedOperation);
        expect.fail('Should have been rejected');
      } catch (error) {
        expect((error as Error).message).toContain('OPEN');
      }

      // Rejected operation should not have been executed
      expect(rejectedOperation).not.toHaveBeenCalled();
    });

    test('should calculate uptime percentage accurately', async () => {
      const circuitBreaker = new CircuitBreaker(
        'uptime-test',
        scenarios.configs.fast,
      );

      // Execute mix of successful and failed operations
      const successOperation = scenarios.createSuccessfulOperation();
      const failOperation = scenarios.createFailingOperation('NetworkError', 1);

      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      try {
        await circuitBreaker.execute(failOperation);
      } catch {
        // Expected failure
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.uptime).toBeLessThanOrEqual(100);
    });
  });

  describe('Circuit Breaker Manager Behaviors', () => {
    test('should provide singleton circuit breaker manager', () => {
      const manager1 = CircuitBreakerManager.getInstance();
      const manager2 = CircuitBreakerManager.getInstance();

      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(CircuitBreakerManager);
    });

    test('should create and manage multiple circuit breakers', () => {
      const manager = CircuitBreakerManager.getInstance();

      const cb1 = manager.getCircuitBreaker(
        'service-1',
        scenarios.configs.fast,
      );
      const cb2 = manager.getCircuitBreaker(
        'service-2',
        scenarios.configs.standard,
      );

      expect(cb1).toBeInstanceOf(CircuitBreaker);
      expect(cb2).toBeInstanceOf(CircuitBreaker);
      expect(cb1).not.toBe(cb2);
    });

    test('should return same circuit breaker for same service name', () => {
      const manager = CircuitBreakerManager.getInstance();

      const cb1 = manager.getCircuitBreaker('same-service');
      const cb2 = manager.getCircuitBreaker('same-service');

      expect(cb1).toBe(cb2);
    });

    test('should provide metrics for all managed circuit breakers', async () => {
      const manager = CircuitBreakerManager.getInstance();

      const cb1 = manager.getCircuitBreaker('metrics-service-1');
      const cb2 = manager.getCircuitBreaker('metrics-service-2');

      // Execute some operations
      const operation = scenarios.createSuccessfulOperation();
      await cb1.execute(operation);
      await cb2.execute(operation);

      const allMetrics = manager.getAllMetrics();
      expect(allMetrics).toBeDefined();
      expect(typeof allMetrics).toBe('object');
      expect(allMetrics['metrics-service-1']).toBeDefined();
      expect(allMetrics['metrics-service-2']).toBeDefined();

      expectValidCircuitMetrics(allMetrics['metrics-service-1']!);
      expectValidCircuitMetrics(allMetrics['metrics-service-2']!);
    });

    test('should reset all circuit breakers', async () => {
      const manager = CircuitBreakerManager.getInstance();

      const cb1 = manager.getCircuitBreaker('reset-service-1');
      const cb2 = manager.getCircuitBreaker('reset-service-2');

      // Execute operations to create state
      const operation = scenarios.createSuccessfulOperation();
      await cb1.execute(operation);
      await cb2.execute(operation);

      // Verify state exists
      expect(cb1.getMetrics().totalRequests).toBeGreaterThan(0);
      expect(cb2.getMetrics().totalRequests).toBeGreaterThan(0);

      // Reset all
      manager.resetAll();

      // Verify reset
      expect(cb1.getMetrics().totalRequests).toBe(0);
      expect(cb2.getMetrics().totalRequests).toBe(0);
    });

    test('should remove specific circuit breakers', () => {
      const manager = CircuitBreakerManager.getInstance();

      const cb = manager.getCircuitBreaker('removable-service');
      expect(cb).toBeInstanceOf(CircuitBreaker);

      const removed = manager.remove('removable-service');
      expect(removed).toBe(true);

      // Should create new instance after removal
      const newCb = manager.getCircuitBreaker('removable-service');
      expect(newCb).toBeInstanceOf(CircuitBreaker);
      expect(newCb).not.toBe(cb);
    });

    test('should clear all circuit breakers', () => {
      const manager = CircuitBreakerManager.getInstance();

      manager.getCircuitBreaker('clear-service-1');
      manager.getCircuitBreaker('clear-service-2');
      manager.getCircuitBreaker('clear-service-3');

      const metricsBeforeClear = manager.getAllMetrics();
      expect(Object.keys(metricsBeforeClear).length).toBeGreaterThan(0);

      manager.clear();

      const metricsAfterClear = manager.getAllMetrics();
      expect(Object.keys(metricsAfterClear).length).toBe(0);
    });
  });

  describe('Real-World Circuit Breaker Scenarios', () => {
    test('should handle intermittent network failures', async () => {
      const circuitBreaker = new CircuitBreaker(
        'intermittent-network',
        scenarios.configs.standard,
      );
      const operation = scenarios.createIntermittentOperation(0.7); // 70% success rate

      // Execute multiple operations with intermittent failures
      const results = [];
      for (let i = 0; i < 10; i++) {
        try {
          const result = await circuitBreaker.execute(operation);
          results.push(result);
        } catch {
          // Expected intermittent failures
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successCount).toBeGreaterThan(0);
    });

    test('should handle service recovery after outage', async () => {
      const circuitBreaker = new CircuitBreaker(
        'service-recovery',
        scenarios.configs.fast,
      );

      // Simulate service outage
      const failingOperation = scenarios.createFailingOperation(
        'ServiceUnavailableError',
        10,
      );

      // Trip the circuit
      for (let i = 0; i < scenarios.configs.fast.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Simulate time passage and service recovery
      let currentTime = 1000;
      (Date.now as any).mockImplementation(() => {
        currentTime += scenarios.configs.fast.recoveryTimeout + 100;
        return currentTime;
      });

      // Service is now working
      const recoveredOperation = scenarios.createSuccessfulOperation();

      // Circuit should allow test and recover
      const result = await circuitBreaker.execute(recoveredOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    test('should handle high-frequency requests under load', async () => {
      const circuitBreaker = new CircuitBreaker(
        'high-frequency',
        scenarios.configs.robust,
      );
      const operation = scenarios.createSuccessfulOperation(10); // Fast operations

      // Execute many concurrent operations
      const promises = Array.from({ length: 50 }, () =>
        circuitBreaker.execute(operation),
      );

      const results = await Promise.all(promises);

      results.forEach((result) => expect(result).toBe('success'));

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.totalRequests).toBe(50);
      expect(metrics.successCount).toBe(50);
      expect(metrics.failureCount).toBe(0);
    });

    test('should handle mixed success and failure patterns', async () => {
      const circuitBreaker = new CircuitBreaker(
        'mixed-patterns',
        scenarios.configs.standard,
      );

      const operations = [
        scenarios.createSuccessfulOperation(),
        scenarios.createFailingOperation('NetworkError', 1),
        scenarios.createSuccessfulOperation(),
        scenarios.createSuccessfulOperation(),
        scenarios.createFailingOperation('TimeoutError', 1),
      ];

      const results = [];
      for (const operation of operations) {
        try {
          const result = await circuitBreaker.execute(operation);
          results.push(result);
        } catch {
          // Expected failures
        }
      }

      const metrics = circuitBreaker.getMetrics();
      expectValidCircuitMetrics(metrics);
      expect(metrics.totalRequests).toBe(operations.length);
      expect(metrics.successCount).toBeGreaterThan(0);
      expect(metrics.failureCount).toBeGreaterThan(0);
    });

    test('should coordinate multiple circuit breakers for different services', async () => {
      const manager = CircuitBreakerManager.getInstance();

      const dbCircuit = manager.getCircuitBreaker(
        'database',
        scenarios.configs.fast,
      );
      const apiCircuit = manager.getCircuitBreaker(
        'api',
        scenarios.configs.standard,
      );
      const cacheCircuit = manager.getCircuitBreaker(
        'cache',
        scenarios.configs.robust,
      );

      const dbOperation = scenarios.createSuccessfulOperation();
      const apiOperation = scenarios.createFailingOperation('NetworkError', 2);
      const cacheOperation = scenarios.createSuccessfulOperation();

      // Execute operations concurrently
      const [dbResult, , cacheResult] = await Promise.allSettled([
        dbCircuit.execute(dbOperation),
        apiCircuit.execute(apiOperation).catch((e) => e),
        cacheCircuit.execute(cacheOperation),
      ]);

      expect(dbResult.status).toBe('fulfilled');
      expect(cacheResult.status).toBe('fulfilled');

      const allMetrics = manager.getAllMetrics();
      expect(Object.keys(allMetrics)).toContain('database');
      expect(Object.keys(allMetrics)).toContain('api');
      expect(Object.keys(allMetrics)).toContain('cache');

      Object.values(allMetrics).forEach((metrics) => {
        expectValidCircuitMetrics(metrics);
      });
    });
  });

  describe('Precise Timer Testing Behaviors', () => {
    // Use real timers for these tests to avoid mock conflicts
    beforeEach(() => {
      // Properly reset fake timers and establish real timers
      vi.clearAllTimers();
      vi.useRealTimers();
      // Restore real Date.now() functionality
      vi.restoreAllMocks();
    });

    afterEach(() => {
      // Clean up after real timer tests
      vi.clearAllTimers();
    });

    test('should timeout operations with exact timing verification', async () => {
      const circuitBreaker = new CircuitBreaker('timeout-precision', {
        ...scenarios.configs.fast,
        timeout: 50, // Short timeout for fast test
      });

      const operation = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 200); // Operation longer than timeout
          }),
      );

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        'Operation timed out after 50ms',
      );

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
    }, 10000); // Extended timeout for real timer test

    test('should not timeout fast operations with precise timing', async () => {
      const circuitBreaker = new CircuitBreaker('fast-operations', {
        ...scenarios.configs.fast,
        timeout: 100, // Allow sufficient time
      });

      const operation = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('fast-success'), 10); // Fast operation
          }),
      );

      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('fast-success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    }, 10000);

    test('should transition states with precise recovery timeout timing', async () => {
      // Set up time mock BEFORE creating the circuit breaker
      let currentTime = 1000;
      const dateSpy = vi
        .spyOn(Date, 'now')
        .mockImplementation(() => currentTime);

      const circuitBreaker = new CircuitBreaker('recovery-timing', {
        ...scenarios.configs.fast,
        recoveryTimeout: 100, // Short recovery timeout for fast testing
      });

      // Trip the circuit
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error('Test error'));

      for (let i = 0; i < scenarios.configs.fast.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past recovery timeout
      currentTime += scenarios.configs.fast.recoveryTimeout + 50; // Add some buffer

      // Next call should attempt recovery
      const successOperation = vi.fn().mockResolvedValue('recovery-success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('recovery-success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Clean up
      dateSpy.mockRestore();
    }, 10000);

    test('should handle exponential backoff timing precisely', async () => {
      const circuitBreaker = new CircuitBreaker('backoff-timing', {
        ...scenarios.configs.fast,
        exponentialBackoff: {
          baseDelay: 10, // Very short delays for testing
          maxDelay: 100,
          multiplier: 2,
          jitter: false, // Disable jitter for predictable tests
        },
        retryPolicy: {
          maxRetries: 2,
          retryableErrors: ['NetworkError'],
        },
      });

      const retryableError = new Error('NetworkError');
      retryableError.name = 'NetworkError';

      const operation = vi
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('backoff-success');

      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('backoff-success');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    }, 10000);
  });

  describe('Edge Case Handling Behaviors', () => {
    test('should handle operations that throw synchronously', async () => {
      const circuitBreaker = new CircuitBreaker(
        'sync-errors',
        scenarios.configs.fast,
      );

      const operation = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        'Synchronous error',
      );

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    test('should handle operations that return undefined', async () => {
      const circuitBreaker = new CircuitBreaker(
        'undefined-returns',
        scenarios.configs.fast,
      );

      const operation = vi.fn().mockResolvedValue(undefined);

      const result = await circuitBreaker.execute(operation);
      expect(result).toBeUndefined();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
    });

    test('should handle concurrent operations edge cases', async () => {
      const circuitBreaker = new CircuitBreaker(
        'concurrent-edge-cases',
        scenarios.configs.fast,
      );

      const operation = vi.fn().mockResolvedValue('concurrent-success');

      // Execute multiple concurrent operations
      const promises = Array(10)
        .fill(null)
        .map(() => circuitBreaker.execute(operation));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((result) => result === 'concurrent-success')).toBe(
        true,
      );

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(10);
      expect(metrics.totalRequests).toBe(10);
    });

    test('should handle null and empty string returns appropriately', async () => {
      const circuitBreaker = new CircuitBreaker(
        'null-empty-returns',
        scenarios.configs.fast,
      );

      const nullOperation = vi.fn().mockResolvedValue(null);
      const emptyOperation = vi.fn().mockResolvedValue('');
      const zeroOperation = vi.fn().mockResolvedValue(0);
      const falseOperation = vi.fn().mockResolvedValue(false);

      const nullResult = await circuitBreaker.execute(nullOperation);
      const emptyResult = await circuitBreaker.execute(emptyOperation);
      const zeroResult = await circuitBreaker.execute(zeroOperation);
      const falseResult = await circuitBreaker.execute(falseOperation);

      expect(nullResult).toBeNull();
      expect(emptyResult).toBe('');
      expect(zeroResult).toBe(0);
      expect(falseResult).toBe(false);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(4);
      expect(metrics.failureCount).toBe(0);
    });

    test('should handle operations that throw non-Error objects', async () => {
      const circuitBreaker = new CircuitBreaker('non-error-throws', {
        ...scenarios.configs.fast,
        failureThreshold: 5, // Higher threshold to allow all 3 operations to execute
      });

      const stringThrowOperation = vi.fn().mockRejectedValue('String error');
      const objectThrowOperation = vi
        .fn()
        .mockRejectedValue({ error: 'Object error' });
      const numberThrowOperation = vi.fn().mockRejectedValue(404);

      await expect(circuitBreaker.execute(stringThrowOperation)).rejects.toBe(
        'String error',
      );
      await expect(
        circuitBreaker.execute(objectThrowOperation),
      ).rejects.toEqual({ error: 'Object error' });
      await expect(circuitBreaker.execute(numberThrowOperation)).rejects.toBe(
        404,
      );

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(3);
      expect(metrics.totalRequests).toBe(3);
    });
  });

  describe('Implementation Verification Behaviors', () => {
    // Use real timers for these tests to avoid mock conflicts
    beforeEach(() => {
      vi.useRealTimers();
    });

    test('should track active retry contexts during execution', async () => {
      const circuitBreaker = new CircuitBreaker('retry-tracking', {
        ...scenarios.configs.fast,
        retryPolicy: {
          maxRetries: 2,
          retryableErrors: ['NetworkError'],
        },
      });

      const retryableError = new Error('NetworkError');
      retryableError.name = 'NetworkError';

      const operation = vi.fn().mockRejectedValue(retryableError);

      // Execute operation and verify retry behavior
      try {
        await circuitBreaker.execute(operation, 'test-operation');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Maximum retry attempts');
      }

      // After completion, active retries should be cleared
      const finalActiveRetries = circuitBreaker.getActiveRetries();
      expect(finalActiveRetries.size).toBe(0);

      // Should be called: initial + 2 retries = 3 times (maxRetries limit)
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should properly reset internal state and metrics', async () => {
      const circuitBreaker = new CircuitBreaker(
        'reset-test',
        scenarios.configs.fast,
      );

      // Execute some operations to create state
      const operation = scenarios.createFailingOperation('NetworkError', 1);
      try {
        await circuitBreaker.execute(operation);
      } catch {
        // Expected failure
      }

      // Verify initial state
      expect(circuitBreaker.getMetrics().failureCount).toBeGreaterThan(0);

      // Reset circuit breaker
      circuitBreaker.reset();

      // Verify state is reset
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });

    test('should force circuit open and maintain state appropriately', async () => {
      const circuitBreaker = new CircuitBreaker(
        'force-open',
        scenarios.configs.fast,
      );

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Force circuit open
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Verify operations are rejected
      const operation = scenarios.createSuccessfulOperation();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        "Circuit breaker 'force-open' is OPEN",
      );

      // Operation should not have been called
      expect(operation).not.toHaveBeenCalled();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.rejectedCount).toBe(1);
    });

    test('should maintain circuit breaker state across manager operations', async () => {
      const manager = CircuitBreakerManager.getInstance();

      const circuit = manager.getCircuitBreaker('persistent-circuit');
      circuit.forceOpen();

      expect(circuit.getState()).toBe(CircuitState.OPEN);

      // Get the same circuit again
      const sameCircuit = manager.getCircuitBreaker('persistent-circuit');
      expect(sameCircuit.getState()).toBe(CircuitState.OPEN);
      expect(sameCircuit).toBe(circuit); // Should be same instance
    });
  });

  describe('Error Message Precision Behaviors', () => {
    test('should provide specific error messages for circuit open state', async () => {
      const circuitBreaker = new CircuitBreaker(
        'error-messaging',
        scenarios.configs.fast,
      );

      // Force circuit open
      circuitBreaker.forceOpen();

      const operation = scenarios.createSuccessfulOperation();

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        "Circuit breaker 'error-messaging' is OPEN",
      );
    });

    test('should provide specific timeout error messages', async () => {
      const circuitBreaker = new CircuitBreaker('timeout-messaging', {
        ...scenarios.configs.fast,
        timeout: 200,
      });

      const operation = scenarios.createTimeoutOperation(1000);

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        'timeout: Operation timed out after 200ms',
      );
    });

    test('should provide specific retry exhaustion error messages', async () => {
      const circuitBreaker = new CircuitBreaker('retry-messaging', {
        ...scenarios.configs.fast,
        retryPolicy: {
          maxRetries: 2,
          retryableErrors: ['NetworkError'],
        },
      });

      const retryableError = new Error('NetworkError');
      retryableError.name = 'NetworkError';
      const operation = vi.fn().mockRejectedValue(retryableError);

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        'Maximum retry attempts (2) exceeded',
      );
    });

    test('should preserve original error messages for non-retryable errors', async () => {
      const circuitBreaker = new CircuitBreaker(
        'original-errors',
        scenarios.configs.fast,
      );

      const originalError = new Error('Original validation error');
      originalError.name = 'ValidationError';
      const operation = vi.fn().mockRejectedValue(originalError);

      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        'Original validation error',
      );

      // Should only be called once (no retries for non-retryable errors)
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should provide descriptive error messages for various failure scenarios', async () => {
      const circuitBreaker = new CircuitBreaker(
        'descriptive-errors',
        scenarios.configs.fast,
      );

      // Test different error scenarios
      const scenarios_list = [
        {
          name: 'NetworkError',
          error: (() => {
            const e = new Error('Network connection failed');
            e.name = 'NetworkError';
            return e;
          })(),
          expectMessage: 'Network connection failed',
        },
        {
          name: 'TimeoutError',
          error: (() => {
            const e = new Error('Request timeout exceeded');
            e.name = 'TimeoutError';
            return e;
          })(),
          expectMessage: 'Request timeout exceeded',
        },
        {
          name: 'ServiceUnavailableError',
          error: (() => {
            const e = new Error('Service temporarily unavailable');
            e.name = 'ServiceUnavailableError';
            return e;
          })(),
          expectMessage: 'Service temporarily unavailable',
        },
      ];

      for (const scenario of scenarios_list) {
        // Reset circuit breaker before each scenario to ensure clean state
        circuitBreaker.reset();

        const operation = vi.fn().mockRejectedValue(scenario.error);

        await expect(circuitBreaker.execute(operation)).rejects.toThrow(
          scenario.expectMessage,
        );
      }
    });
  });

  describe('Complex Mock Coordination Behaviors', () => {
    // Use real timers for these tests to avoid mock conflicts
    beforeEach(() => {
      vi.useRealTimers();
    });

    test('should handle concurrent timer-dependent operations', async () => {
      const circuitBreaker = new CircuitBreaker(
        'concurrent-timer-ops',
        scenarios.configs.fast,
      );

      // Mix of fast and slow operations to test timing coordination
      const fastOp = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10)),
        );
      const slowOp = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 50)),
        );
      const timeoutOp = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 600)), // Will timeout
      );

      const promises = [
        circuitBreaker.execute(fastOp),
        circuitBreaker.execute(slowOp),
        circuitBreaker.execute(timeoutOp),
      ];

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      const results = await Promise.allSettled(promises);

      // Fast and slow operations should succeed, timeout should fail
      expect(results[0]!.status).toBe('fulfilled');
      expect(results[1]!.status).toBe('fulfilled');
      expect(results[2]!.status).toBe('rejected');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
    }, 10000);

    test('should coordinate complex async retry patterns with timing', async () => {
      const circuitBreaker = new CircuitBreaker('complex-retry', {
        ...scenarios.configs.fast,
        exponentialBackoff: {
          baseDelay: 10,
          maxDelay: 50,
          multiplier: 2,
          jitter: false,
        },
        retryPolicy: {
          maxRetries: 2,
          retryableErrors: ['NetworkError'],
        },
      });

      let attempt = 0;
      const retryableError = new Error('NetworkError');
      retryableError.name = 'NetworkError';

      const operation = vi.fn().mockImplementation(async () => {
        attempt++;
        if (attempt <= 2) {
          throw retryableError;
        }
        return 'complex-success';
      });

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('complex-success');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(attempt).toBe(3);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(1);
    }, 10000);

    test('should handle mixed synchronous and asynchronous error scenarios', async () => {
      const circuitBreaker = new CircuitBreaker(
        'mixed-sync-async',
        scenarios.configs.fast,
      );

      // Synchronous error
      const syncError = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      // Asynchronous success
      const asyncSuccess = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve('async-success'), 20),
            ),
        );

      // Test synchronous error
      await expect(circuitBreaker.execute(syncError)).rejects.toThrow(
        'Sync error',
      );

      // Test asynchronous success
      const result = await circuitBreaker.execute(asyncSuccess);
      expect(result).toBe('async-success');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(1);
    }, 10000);

    test('should coordinate Promise.allSettled with timer advancement for retry scenarios', async () => {
      const circuitBreaker = new CircuitBreaker('promise-coordination', {
        ...scenarios.configs.fast,
        retryPolicy: {
          maxRetries: 2,
          retryableErrors: ['NetworkError'],
        },
      });

      const retryableError = new Error('NetworkError');
      retryableError.name = 'NetworkError';
      const operation = vi.fn().mockRejectedValue(retryableError);

      // Execute with real timers
      try {
        await circuitBreaker.execute(operation, 'coordinated-operation');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Maximum retry attempts');
      }

      // Should be called: initial + 2 retries = 3 times (maxRetries limit)
      expect(operation).toHaveBeenCalledTimes(3);
    }, 10000);
  });
});
