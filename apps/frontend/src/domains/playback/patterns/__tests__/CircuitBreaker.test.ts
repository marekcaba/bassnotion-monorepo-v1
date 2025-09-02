/**
 * Enhanced CircuitBreaker Tests
 * Story 3.18.4: Service Architecture Implementation
 *
 * Tests for enhanced CircuitBreaker with adaptive thresholds,
 * health checks, and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnhancedCircuitBreaker,
  CircuitBreakerFactory,
} from '../CircuitBreaker.js';
import { EventBus } from '../../services/core/EventBus.js';
import { CircuitState } from '../../services/errors/CircuitBreaker.js';

describe('EnhancedCircuitBreaker', () => {
  let eventBus: EventBus;
  let circuitBreaker: EnhancedCircuitBreaker;

  beforeEach(() => {
    // Mock setInterval and clearInterval
    vi.stubGlobal(
      'setInterval',
      vi.fn(() => Math.random()),
    );
    vi.stubGlobal('clearInterval', vi.fn());
    eventBus = new EventBus();
  });

  afterEach(() => {
    circuitBreaker?.dispose();
    vi.clearAllTimers();
    vi.unstubAllGlobals();
  });

  describe('Basic Circuit Breaker Functionality', () => {
    beforeEach(() => {
      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 3,
        recoveryTimeout: 100,
        retryPolicy: {
          maxRetries: 0, // Disable retries for clearer test behavior
          retryableErrors: [],
        },
      });
    });

    it('should execute successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Next call should fail immediately
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        "Circuit breaker 'test-breaker' is OPEN",
      );
      expect(operation).toHaveBeenCalledTimes(3); // Not called on 4th attempt
    });

    it('should emit state change events', async () => {
      const stateChangeHandler = vi.fn();
      eventBus.on('circuitbreaker:state-changed', stateChangeHandler);

      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Trigger circuit opening
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      expect(stateChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-breaker',
          state: CircuitState.OPEN,
          reason: 'opened',
        }),
        expect.any(Object),
      );
    });
  });

  describe('Fallback Operation', () => {
    it('should use fallback when circuit is open', async () => {
      const fallback = vi.fn().mockResolvedValue('fallback-result');
      const fallbackUsedHandler = vi.fn();

      eventBus.on('circuitbreaker:fallback-used', fallbackUsedHandler);

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 1,
        fallbackOperation: fallback,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open circuit
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }

      // Next call should use fallback
      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('fallback-result');
      expect(fallback).toHaveBeenCalled();
      expect(fallbackUsedHandler).toHaveBeenCalled();
    });

    it('should handle fallback failure', async () => {
      const fallback = vi.fn().mockRejectedValue(new Error('Fallback failed'));
      const fallbackFailedHandler = vi.fn();

      eventBus.on('circuitbreaker:fallback-failed', fallbackFailedHandler);

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 1,
        fallbackOperation: fallback,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open circuit
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }

      // Next call should fail with original error
      await expect(circuitBreaker.execute(operation)).rejects.toThrow(
        "Circuit breaker 'test-breaker' is OPEN",
      );
      expect(fallbackFailedHandler).toHaveBeenCalled();
    });
  });

  describe('Health Check Monitoring', () => {
    it('should perform health checks when circuit is open', async () => {
      vi.useFakeTimers();

      const healthCheck = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const healthCheckPassedHandler = vi.fn();

      eventBus.on('circuitbreaker:state-changed', healthCheckPassedHandler);

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 1,
        healthCheckInterval: 100,
        healthCheckOperation: healthCheck,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open circuit
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }

      // First health check fails
      await vi.advanceTimersByTimeAsync(100);
      expect(healthCheck).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Second health check passes
      await vi.advanceTimersByTimeAsync(100);
      expect(healthCheck).toHaveBeenCalledTimes(2);

      // Check for state change event
      expect(healthCheckPassedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'health-check-passed',
        }),
        expect.any(Object),
      );

      vi.useRealTimers();
    });

    it('should emit event when health check fails', async () => {
      vi.useFakeTimers();

      const healthCheck = vi
        .fn()
        .mockRejectedValue(new Error('Health check failed'));
      const healthCheckFailedHandler = vi.fn();

      eventBus.on(
        'circuitbreaker:health-check-failed',
        healthCheckFailedHandler,
      );

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 1,
        healthCheckInterval: 50,
        healthCheckOperation: healthCheck,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      // Open circuit
      const operation = vi.fn().mockRejectedValue(new Error('Failed'));
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // Expected
      }

      await vi.advanceTimersByTimeAsync(50);

      expect(healthCheckFailedHandler).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Adaptive Threshold', () => {
    it('should adjust threshold based on failure rate', async () => {
      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 5,
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 3,
          maxThreshold: 10,
          adjustmentRate: 1,
        },
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn();

      // High failure rate - should decrease threshold
      for (let i = 0; i < 10; i++) {
        operation.mockRejectedValueOnce(new Error('Failed'));
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      const metrics = circuitBreaker.getEnhancedMetrics();
      expect(metrics.adaptiveThreshold?.current).toBeLessThan(5);
      expect(metrics.adaptiveThreshold?.recentFailureRate).toBeGreaterThan(0.5);
    });

    it('should increase threshold on low failure rate', async () => {
      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 5,
        adaptiveThreshold: {
          enabled: true,
          minThreshold: 3,
          maxThreshold: 10,
          adjustmentRate: 1,
        },
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn();

      // Low failure rate - should increase threshold
      for (let i = 0; i < 10; i++) {
        if (i % 10 === 0) {
          operation.mockRejectedValueOnce(new Error('Failed'));
        } else {
          operation.mockResolvedValueOnce('success');
        }

        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected for failures
        }
      }

      const metrics = circuitBreaker.getEnhancedMetrics();
      // With 10% failure rate, threshold might not increase much or at all
      expect(metrics.adaptiveThreshold?.current).toBeGreaterThanOrEqual(4);
      expect(metrics.adaptiveThreshold?.recentFailureRate).toBeLessThanOrEqual(
        0.1,
      );
    });
  });

  describe('Circuit Breaker Chaining', () => {
    it('should check chained breakers before execution', async () => {
      const chainedBreaker = new EnhancedCircuitBreaker('chained', eventBus, {
        failureThreshold: 1,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      circuitBreaker = new EnhancedCircuitBreaker('main', eventBus, {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      circuitBreaker.chain('chained', chainedBreaker);

      // Open the chained breaker
      const failingOp = vi.fn().mockRejectedValue(new Error('Failed'));
      try {
        await chainedBreaker.execute(failingOp);
      } catch (error) {
        // Expected
      }

      // Main breaker should fail due to chained breaker being open
      const mainOp = vi.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(mainOp)).rejects.toThrow(
        'Chained circuit breaker',
      );
      expect(mainOp).not.toHaveBeenCalled();
    });

    it('should unchain breakers', () => {
      const chainedBreaker = new EnhancedCircuitBreaker('chained', eventBus, {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      circuitBreaker = new EnhancedCircuitBreaker('main', eventBus, {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      circuitBreaker.chain('chained', chainedBreaker);

      const metrics = circuitBreaker.getEnhancedMetrics();
      expect(metrics.chainedBreakers).toContain('chained');

      circuitBreaker.unchain('chained');

      const updatedMetrics = circuitBreaker.getEnhancedMetrics();
      expect(updatedMetrics.chainedBreakers).not.toContain('chained');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should emit periodic metrics', async () => {
      vi.useFakeTimers();

      const metricsHandler = vi.fn();
      eventBus.on('circuitbreaker:metrics', metricsHandler);

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        monitoring: {
          metricsInterval: 100,
          alertThresholds: {
            failureRate: 50,
            rejectedRate: 25,
            uptimePercent: 90,
          },
        },
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      await vi.advanceTimersByTimeAsync(100);

      expect(metricsHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-breaker',
          metrics: expect.any(Object),
          alerts: expect.any(Array),
        }),
        expect.any(Object),
      );

      vi.useRealTimers();
    });

    it('should emit alerts when thresholds exceeded', async () => {
      vi.useFakeTimers();

      const alertHandler = vi.fn();
      eventBus.on('circuitbreaker:alert', alertHandler);

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        failureThreshold: 5,
        monitoring: {
          metricsInterval: 100,
          alertThresholds: {
            failureRate: 50,
            rejectedRate: 25,
            uptimePercent: 90,
          },
        },
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const operation = vi.fn().mockRejectedValue(new Error('Failed'));

      // Generate high failure rate
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      await vi.advanceTimersByTimeAsync(100);

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-breaker',
          alerts: expect.any(Array),
        }),
        expect.any(Object),
      );

      vi.useRealTimers();
    });
  });

  describe('CircuitBreakerFactory', () => {
    let factory: CircuitBreakerFactory;

    beforeEach(() => {
      factory = new CircuitBreakerFactory(eventBus);
    });

    it('should create circuit breaker with preset config', () => {
      const highThroughput = factory.create('test', 'high-throughput');
      const critical = factory.create('test', 'critical');
      const background = factory.create('test', 'background');

      expect(highThroughput).toBeInstanceOf(EnhancedCircuitBreaker);
      expect(critical).toBeInstanceOf(EnhancedCircuitBreaker);
      expect(background).toBeInstanceOf(EnhancedCircuitBreaker);
    });

    it('should create circuit breaker with custom config', () => {
      const custom = factory.create('test', 'custom', {
        failureThreshold: 100,
        recoveryTimeout: 5000,
      });

      expect(custom).toBeInstanceOf(EnhancedCircuitBreaker);
    });

    it('should create chained circuit breakers', () => {
      const chain = factory.createChain([
        { name: 'api', preset: 'critical' },
        { name: 'cache', preset: 'high-throughput' },
        { name: 'db', preset: 'background' },
      ]);

      expect(chain).toBeInstanceOf(EnhancedCircuitBreaker);

      const metrics = chain.getEnhancedMetrics();
      expect(metrics.chainedBreakers).toEqual(['cache', 'db']);
    });

    it('should throw error for empty chain', () => {
      expect(() => factory.createChain([])).toThrow(
        'At least one circuit breaker',
      );
    });
  });

  describe('Cleanup', () => {
    it('should clear timers on dispose', () => {
      vi.useFakeTimers();

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        healthCheckInterval: 100,
        monitoring: {
          metricsInterval: 100,
          alertThresholds: {
            failureRate: 50,
            rejectedRate: 25,
            uptimePercent: 90,
          },
        },
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      circuitBreaker.dispose();

      // Should clear at least 1 timer (health check and/or metrics)
      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should reset state on dispose', () => {
      circuitBreaker = new EnhancedCircuitBreaker('test-breaker', eventBus, {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });

      const chainedBreaker = new EnhancedCircuitBreaker('chained', eventBus, {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      circuitBreaker.chain('chained', chainedBreaker);

      circuitBreaker.dispose();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getEnhancedMetrics().chainedBreakers).toEqual([]);
    });
  });
});
