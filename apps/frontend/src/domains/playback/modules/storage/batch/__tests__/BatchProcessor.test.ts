/**
 * Batch Processor Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchProcessor } from '../BatchProcessor.js';
import {
  BatchOperation,
  BatchExecutor,
  BatchConfig,
  BatchError,
  BatchTimeoutError,
} from '../types.js';

// Mock executor
class MockExecutor implements BatchExecutor<string> {
  async execute(operation: BatchOperation): Promise<string> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (operation.data?.shouldFail) {
      throw new Error(`Operation ${operation.id} failed`);
    }

    return `Result for ${operation.id}`;
  }
}

// Slow executor for timeout tests
class SlowExecutor implements BatchExecutor<string> {
  async execute(operation: BatchOperation): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `Slow result for ${operation.id}`;
  }
}

describe('BatchProcessor', () => {
  let processor: BatchProcessor<string>;
  let executor: MockExecutor;

  beforeEach(() => {
    executor = new MockExecutor();
    processor = new BatchProcessor(executor, {
      maxConcurrent: 2,
      batchSize: 5,
      retryAttempts: 2,
      retryDelay: 10,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('operation management', () => {
    it('should add single operation', () => {
      const id = processor.addOperation({
        type: 'process',
        resource: 'test-resource',
      });

      expect(id).toBeTruthy();
      expect(processor.getQueueSize()).toBe(1);
    });

    it('should add multiple operations', () => {
      const operations: BatchOperation[] = [
        { type: 'upload', resource: 'file1.txt' },
        { type: 'download', resource: 'file2.txt' },
        { type: 'delete', resource: 'file3.txt' },
      ];

      const ids = processor.addOperations(operations);

      expect(ids).toHaveLength(3);
      expect(processor.getQueueSize()).toBe(3);
    });

    it('should remove operation', () => {
      const id = processor.addOperation({
        type: 'process',
        resource: 'test-resource',
      });

      const removed = processor.removeOperation(id);

      expect(removed).toBe(true);
      expect(processor.getQueueSize()).toBe(0);
    });

    it('should clear all operations', () => {
      processor.addOperations([
        { type: 'upload', resource: 'file1.txt' },
        { type: 'upload', resource: 'file2.txt' },
      ]);

      processor.clearOperations();

      expect(processor.getQueueSize()).toBe(0);
    });

    it('should not allow operations while running', async () => {
      processor.addOperation({ type: 'process', resource: 'test' });

      const executePromise = processor.execute();

      expect(() => {
        processor.addOperation({ type: 'process', resource: 'test2' });
      }).toThrow('Cannot add operations while batch is running');

      await executePromise;
    });
  });

  describe('execution', () => {
    it('should execute all operations successfully', async () => {
      const operations: BatchOperation[] = [
        { type: 'upload', resource: 'file1.txt' },
        { type: 'upload', resource: 'file2.txt' },
        { type: 'upload', resource: 'file3.txt' },
      ];

      processor.addOperations(operations);
      const results = await processor.execute();

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      expect(results[0].result).toBe('Result for ' + results[0].operationId);
    });

    it('should handle operation failures', async () => {
      processor.addOperations([
        { type: 'process', resource: 'good', data: { shouldFail: false } },
        { type: 'process', resource: 'bad', data: { shouldFail: true } },
        { type: 'process', resource: 'good2', data: { shouldFail: false } },
      ]);

      const results = await processor.execute();

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('failed');
      expect(results[1].error).toBeInstanceOf(BatchError);
      expect(results[2].status).toBe('success');
    }, 10000); // Increase test timeout

    it('should retry failed operations', async () => {
      let attempts = 0;
      const retryExecutor = new (class implements BatchExecutor<string> {
        async execute(operation: BatchOperation): Promise<string> {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'Success after retry';
        }
      })();

      const retryProcessor = new BatchProcessor(retryExecutor, {
        retryAttempts: 2,
        retryDelay: 10,
      });

      retryProcessor.addOperation({ type: 'process', resource: 'test' });
      const results = await retryProcessor.execute();

      expect(results[0].status).toBe('success');
      expect(results[0].result).toBe('Success after retry');
      expect(results[0].retries).toBe(2);
      expect(attempts).toBe(3);
    });

    it('should respect maxConcurrent limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const trackingExecutor = new (class implements BatchExecutor<string> {
        async execute(operation: BatchOperation): Promise<string> {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 20));
          concurrent--;
          return 'Done';
        }
      })();

      const limitedProcessor = new BatchProcessor(trackingExecutor, {
        maxConcurrent: 2,
        batchSize: 10,
      });

      // Add 5 operations
      for (let i = 0; i < 5; i++) {
        limitedProcessor.addOperation({
          type: 'process',
          resource: `test${i}`,
        });
      }

      await limitedProcessor.execute();

      expect(maxConcurrent).toBe(2);
    });

    it('should handle timeout', async () => {
      const timeoutProcessor = new BatchProcessor(new SlowExecutor(), {
        timeout: 50,
      });

      timeoutProcessor.addOperation({ type: 'process', resource: 'slow' });
      const results = await timeoutProcessor.execute();

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toBeInstanceOf(BatchTimeoutError);
    }, 10000); // Increase test timeout to 10 seconds
  });

  describe('progress tracking', () => {
    it('should report progress', async () => {
      const progressUpdates: number[] = [];

      const trackingProcessor = new BatchProcessor(executor, {
        progressCallback: (progress) => {
          progressUpdates.push(progress.completed);
        },
      });

      trackingProcessor.addOperations([
        { type: 'process', resource: 'file1' },
        { type: 'process', resource: 'file2' },
        { type: 'process', resource: 'file3' },
      ]);

      await trackingProcessor.execute();

      expect(progressUpdates.length).toBeGreaterThan(0);
      // Check that progress increased (final value should be 3)
      const finalProgress = trackingProcessor.getProgress();
      expect(finalProgress.completed).toBe(3);
    });

    it('should provide accurate progress info', async () => {
      processor.addOperations([
        { type: 'process', resource: 'file1' },
        { type: 'process', resource: 'file2' },
      ]);

      const executePromise = processor.execute();

      // Check progress during execution
      await new Promise((resolve) => setTimeout(resolve, 5));
      const progress = processor.getProgress();

      expect(progress.total).toBe(2);
      expect(progress.startTime).toBeGreaterThan(0);

      await executePromise;
    });
  });

  describe('control operations', () => {
    it('should pause and resume execution', async () => {
      // Create a slow processor to ensure we can pause in time
      const slowExecutor = new (class implements BatchExecutor<string> {
        async execute(operation: BatchOperation): Promise<string> {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return `Result for ${operation.id}`;
        }
      })();

      const slowProcessor = new BatchProcessor(slowExecutor, {
        maxConcurrent: 1, // Process one at a time to control timing
      });

      const operations: BatchOperation[] = [];
      for (let i = 0; i < 5; i++) {
        operations.push({ type: 'process', resource: `file${i}` });
      }

      slowProcessor.addOperations(operations);

      const executePromise = slowProcessor.execute();

      // Pause immediately
      slowProcessor.pause();
      expect(slowProcessor.isPaused()).toBe(true);

      // Wait a bit to see if progress stalls
      await new Promise((resolve) => setTimeout(resolve, 150));
      const progressWhilePaused = slowProcessor.getProgress().completed;

      // Progress should be minimal while paused (at most 1 operation might have started)
      expect(progressWhilePaused).toBeLessThanOrEqual(1);

      // Resume execution
      slowProcessor.resume();
      expect(slowProcessor.isPaused()).toBe(false);

      await executePromise;

      const finalProgress = slowProcessor.getProgress();
      expect(finalProgress.completed).toBe(5);
    }, 15000);

    it('should cancel execution', async () => {
      const operations: BatchOperation[] = [];
      for (let i = 0; i < 20; i++) {
        operations.push({ type: 'process', resource: `file${i}` });
      }

      processor.addOperations(operations);

      const executePromise = processor.execute();

      // Cancel after a short delay
      await new Promise((resolve) => setTimeout(resolve, 30));
      processor.cancel();

      await expect(executePromise).rejects.toThrow('Batch operation cancelled');
    });
  });

  describe('metrics', () => {
    it('should collect execution metrics', async () => {
      processor.addOperations([
        { type: 'process', resource: 'file1' },
        { type: 'process', resource: 'file2', data: { shouldFail: true } },
        { type: 'process', resource: 'file3' },
      ]);

      await processor.execute();

      const metrics = processor.getMetrics();

      expect(metrics.totalOperations).toBe(3);
      expect(metrics.successfulOperations).toBe(2);
      expect(metrics.failedOperations).toBe(1);
      expect(metrics.errorRate).toBeCloseTo(0.333, 2);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.totalDuration).toBeGreaterThan(0);
      expect(metrics.averageOperationTime).toBeGreaterThan(0);
    }, 10000); // Increase test timeout
  });

  describe('error handling', () => {
    it('should call error callback on failure', async () => {
      const errors: Array<{ error: Error; operation: BatchOperation }> = [];

      const errorProcessor = new BatchProcessor(executor, {
        errorCallback: (error, operation) => {
          errors.push({ error, operation });
        },
      });

      errorProcessor.addOperations([
        { type: 'process', resource: 'bad', data: { shouldFail: true } },
      ]);

      await errorProcessor.execute();

      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBeInstanceOf(BatchError);
      expect(errors[0].operation.resource).toBe('bad');
    });

    it('should stop on error if continueOnError is false', async () => {
      const strictProcessor = new BatchProcessor(executor, {
        continueOnError: false,
        maxConcurrent: 1, // Process sequentially to ensure order
      });

      strictProcessor.addOperations([
        { type: 'process', resource: 'good' },
        { type: 'process', resource: 'bad', data: { shouldFail: true } },
        { type: 'process', resource: 'never-executed' },
      ]);

      await expect(strictProcessor.execute()).rejects.toThrow(BatchError);

      // Check that the third operation was not executed
      // Since we stop on error, at most 2 operations should be processed (1 success + 1 failure)
      const results = strictProcessor.getProgress();
      expect(results.completed + results.failed).toBeLessThanOrEqual(2);
    });
  });
});
