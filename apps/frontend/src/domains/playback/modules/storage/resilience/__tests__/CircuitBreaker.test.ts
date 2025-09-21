import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker } from '../CircuitBreaker';
import { CircuitBreakerConfig, CircuitBreakerError } from '../types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockConfig: CircuitBreakerConfig;
  let stateChangeCallback: any;
  let openCallback: any;
  let closeCallback: any;
  let halfOpenCallback: any;

  beforeEach(() => {
    // Reset all mocks
    stateChangeCallback = vi.fn();
    openCallback = vi.fn();
    closeCallback = vi.fn();
    halfOpenCallback = vi.fn();

    mockConfig = {
      failureThreshold: 3,
      successThreshold: 2,
      recoveryTimeout: 1000,
      failureWindow: 5000,
      onStateChange: stateChangeCallback,
      onOpen: openCallback,
      onClose: closeCallback,
      onHalfOpen: halfOpenCallback,
    };

    circuitBreaker = new CircuitBreaker(mockConfig);
  });

  afterEach(() => {
    circuitBreaker.dispose();
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.isClosed()).toBe(true);
      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.isHalfOpen()).toBe(false);
    });

    it('should use default values for optional config', () => {
      const minimalConfig = {
        failureThreshold: 5,
        recoveryTimeout: 2000,
      };

      const breaker = new CircuitBreaker(minimalConfig);
      expect(breaker.getState()).toBe('closed');
      breaker.dispose();
    });
  });

  describe('success handling', () => {
    it('should execute successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should track successful requests in metrics', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(operation);
      await circuitBreaker.execute(operation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
    });
  });

  describe('failure handling', () => {
    it('should track failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }

      expect(circuitBreaker.getFailureCount()).toBe(1);
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should open after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe('open');
      expect(circuitBreaker.isOpen()).toBe(true);
      expect(openCallback).toHaveBeenCalledWith(3);
      expect(stateChangeCallback).toHaveBeenCalledWith('open', 'closed');
    });

    it('should use sliding window for failure tracking', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Use fake timers for this test
      vi.useFakeTimers();

      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      // Advance time to make failures expire from window
      vi.advanceTimersByTime(5100);

      // One more failure should not open circuit
      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe('closed');

      vi.useRealTimers();
    }, 10000);
  });

  describe('open state behavior', () => {
    beforeEach(async () => {
      vi.useFakeTimers();

      // Open the circuit
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reject requests when open', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(operation)).rejects.toBeInstanceOf(
        CircuitBreakerError,
      );

      expect(operation).not.toHaveBeenCalled();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.rejectedRequests).toBe(1);
    });

    it('should use fallback when available', async () => {
      const fallbackBreaker = new CircuitBreaker({
        ...mockConfig,
        fallback: async () => 'fallback value',
      });

      // Open the circuit
      const failOperation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await fallbackBreaker.execute(failOperation);
        } catch (e) {
          // Expected
        }
      }

      // Now try with open circuit
      const operation = vi.fn().mockResolvedValue('success');
      const result = await fallbackBreaker.execute(operation);

      expect(result).toBe('fallback value');
      expect(operation).not.toHaveBeenCalled();

      fallbackBreaker.dispose();
    });

    it('should transition to half-open after recovery timeout', async () => {
      // The circuit is already open from beforeEach
      // Now advance time past recovery timeout
      await vi.advanceTimersByTimeAsync(1100);

      expect(circuitBreaker.getState()).toBe('half-open');
      expect(halfOpenCallback).toHaveBeenCalled();
    });
  });

  describe('half-open state behavior', () => {
    beforeEach(async () => {
      vi.useFakeTimers();

      // Open the circuit
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      // Wait for half-open
      await vi.advanceTimersByTimeAsync(1100);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow test requests', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should close after success threshold', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      // Need 2 successes to close
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState()).toBe('half-open');

      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState()).toBe('closed');
      expect(closeCallback).toHaveBeenCalled();
    });

    it('should reopen on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe('open');
    });
  });

  describe('error filtering', () => {
    it('should only count filtered errors as failures', async () => {
      const breakerWithFilter = new CircuitBreaker({
        ...mockConfig,
        errorFilter: (error: any) => error.message !== 'ignore',
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ignore'))
        .mockRejectedValueOnce(new Error('count'))
        .mockRejectedValueOnce(new Error('ignore'))
        .mockRejectedValueOnce(new Error('count'));

      // First two calls
      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithFilter.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      expect(breakerWithFilter.getFailureCount()).toBe(1); // Only one counted
      expect(breakerWithFilter.getState()).toBe('closed');

      // Two more calls
      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithFilter.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      expect(breakerWithFilter.getFailureCount()).toBe(2); // Two counted
      expect(breakerWithFilter.getState()).toBe('closed'); // Still closed (threshold is 3)

      breakerWithFilter.dispose();
    });
  });

  describe('metrics and monitoring', () => {
    it('should track response times', async () => {
      vi.useFakeTimers();

      const operation = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(() => resolve('success'), 50)),
        );

      const promise1 = circuitBreaker.execute(operation);
      vi.advanceTimersByTime(50);
      await promise1;

      const promise2 = circuitBreaker.execute(operation);
      vi.advanceTimersByTime(50);
      await promise2;

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThan(40);
      expect(metrics.averageResponseTime).toBeLessThan(70);

      vi.useRealTimers();
    });

    it('should maintain event history', async () => {
      const operation = vi
        .fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'));

      await circuitBreaker.execute(operation);
      try {
        await circuitBreaker.execute(operation);
      } catch (e) {
        // Expected
      }

      const history = circuitBreaker.getEventHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history.some((e) => e.type === 'request_success')).toBe(true);
      expect(history.some((e) => e.type === 'request_failure')).toBe(true);
    });
  });

  describe('manual controls', () => {
    it('should allow manual reset', async () => {
      // Open the circuit
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe('open');

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.getFailureCount()).toBe(0);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });

    it('should allow force open', () => {
      circuitBreaker.forceOpen();

      expect(circuitBreaker.getState()).toBe('open');
      expect(openCallback).toHaveBeenCalled();
    });

    it('should allow force close', async () => {
      // First open it
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe('open');

      // Then force close
      circuitBreaker.forceClose();

      expect(circuitBreaker.getState()).toBe('closed');
      expect(closeCallback).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up timers on dispose', async () => {
      vi.useFakeTimers();

      // Open the circuit to start recovery timer
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }

      // Dispose immediately
      circuitBreaker.dispose();

      // Wait past recovery timeout
      await vi.advanceTimersByTimeAsync(1500);

      // State should not have changed (timer was cleared)
      expect(halfOpenCallback).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
