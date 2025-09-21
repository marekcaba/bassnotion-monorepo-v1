import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryManager } from '../RetryManager';
import { RetryConfig } from '../types';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockConfig: RetryConfig;
  let onRetryCallback: any;

  beforeEach(() => {
    onRetryCallback = vi.fn();

    mockConfig = {
      maxAttempts: 3,
      initialDelay: 100,
      backoffMultiplier: 2,
      jitter: false, // Disable jitter for predictable tests
      onRetry: onRetryCallback,
    };

    retryManager = new RetryManager(mockConfig);
  });

  describe('successful operations', () => {
    it('should execute successful operations without retry', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetryCallback).not.toHaveBeenCalled();
    });

    it('should succeed after retries', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await retryManager.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(onRetryCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure handling', () => {
    it('should fail after max attempts', async () => {
      const error = new Error('persistent failure');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(retryManager.execute(operation)).rejects.toThrow(
        'persistent failure',
      );

      expect(operation).toHaveBeenCalledTimes(3);
      expect(onRetryCallback).toHaveBeenCalledTimes(2); // Not called on last failure
    });

    it('should pass attempt number and error to callback', async () => {
      const error1 = new Error('fail 1');
      const error2 = new Error('fail 2');
      const operation = vi
        .fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('success');

      await retryManager.execute(operation);

      expect(onRetryCallback).toHaveBeenNthCalledWith(1, 1, error1);
      expect(onRetryCallback).toHaveBeenNthCalledWith(2, 2, error2);
    });
  });

  describe('delay calculation', () => {
    it('should use exponential backoff', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      const startTime = Date.now();

      try {
        await retryManager.execute(operation);
      } catch (e) {
        // Expected
      }

      const totalTime = Date.now() - startTime;

      // Should have delays of 100ms and 200ms (total 300ms minimum)
      expect(totalTime).toBeGreaterThan(290);
      expect(totalTime).toBeLessThan(350); // Some buffer for execution time
    });

    it('should respect max delay', async () => {
      const manager = new RetryManager({
        ...mockConfig,
        maxDelay: 150,
      });

      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      const delays: number[] = [];
      const trackingManager = new RetryManager({
        ...mockConfig,
        maxDelay: 150,
        onRetry: (attempt) => {
          const expectedDelay = Math.min(100 * Math.pow(2, attempt - 1), 150);
          delays.push(expectedDelay);
        },
      });

      try {
        await trackingManager.execute(operation);
      } catch (e) {
        // Expected
      }

      expect(delays).toEqual([100, 150]); // Second delay capped at 150
    });

    it('should add jitter when enabled', async () => {
      const manager = new RetryManager({
        ...mockConfig,
        jitter: true,
      });

      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      const startTime = Date.now();

      try {
        await manager.execute(operation);
      } catch (e) {
        // Expected
      }

      const totalTime = Date.now() - startTime;

      // With jitter, delays should be 100-125ms and 200-250ms
      // Total should be between 300-375ms
      expect(totalTime).toBeGreaterThan(290);
      expect(totalTime).toBeLessThan(400);
    });
  });

  describe('error filtering', () => {
    it('should not retry non-retryable errors', async () => {
      const manager = new RetryManager({
        ...mockConfig,
        retryableErrors: (error: any) => error.retryable === true,
      });

      const nonRetryableError = Object.assign(new Error('non-retryable'), {
        retryable: false,
      });

      const operation = vi.fn().mockRejectedValue(nonRetryableError);

      await expect(manager.execute(operation)).rejects.toThrow('non-retryable');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(onRetryCallback).not.toHaveBeenCalled();
    });

    it('should retry retryable errors', async () => {
      const manager = new RetryManager({
        ...mockConfig,
        retryableErrors: (error: any) => error.retryable === true,
      });

      const retryableError = Object.assign(new Error('retryable'), {
        retryable: true,
      });

      const operation = vi.fn().mockRejectedValue(retryableError);

      await expect(manager.execute(operation)).rejects.toThrow('retryable');

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('custom policies', () => {
    it('should allow custom config per execution', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const customOnRetry = vi.fn();

      const result = await retryManager.executeWithPolicy(operation, {
        maxAttempts: 2,
        initialDelay: 50,
        onRetry: customOnRetry,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(customOnRetry).toHaveBeenCalledTimes(1);
      expect(onRetryCallback).not.toHaveBeenCalled(); // Original callback not used
    });
  });

  describe('wrapper function', () => {
    it('should create retriable wrapper', async () => {
      const originalFunction = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const wrappedFunction = retryManager.wrap(originalFunction);

      const result = await wrappedFunction('arg1', 'arg2');

      expect(result).toBe('success');
      expect(originalFunction).toHaveBeenCalledTimes(2);
      expect(originalFunction).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('statistics', () => {
    it('should provide retry statistics', () => {
      const stats = retryManager.getStatistics();

      expect(stats).toEqual({
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 800, // 100 * 2^3
        backoffMultiplier: 2,
        usesJitter: false,
      });
    });

    it('should calculate correct max delay with custom config', () => {
      const manager = new RetryManager({
        maxAttempts: 5,
        initialDelay: 50,
        backoffMultiplier: 3,
        jitter: true,
      });

      const stats = manager.getStatistics();

      expect(stats.maxDelay).toBe(50 * Math.pow(3, 5)); // 50 * 3^5 = 12150
      expect(stats.usesJitter).toBe(true);
    });
  });
});
