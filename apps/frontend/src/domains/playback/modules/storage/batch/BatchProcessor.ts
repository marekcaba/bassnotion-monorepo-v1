/**
 * Batch Processor Module
 *
 * Handles batch operations with concurrency control, retry logic,
 * and progress tracking for storage operations
 */

import { logger } from '../../../utils/logger.js';

import {
  BatchOperation,
  BatchResult,
  BatchProgress,
  BatchConfig,
  BatchExecutor,
  BatchProcessor as IBatchProcessor,
  BatchError,
  BatchTimeoutError,
  BatchCancelledError,
  BatchMetrics,
} from './types.js';

/**
 * Default batch configuration
 */
const DEFAULT_CONFIG: BatchConfig = {
  maxConcurrent: 5,
  batchSize: 100,
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000,
  continueOnError: true,
};

/**
 * Batch Processor implementation
 */
export class BatchProcessor<T = unknown> implements IBatchProcessor {
  private config: Required<BatchConfig>;
  private queue: BatchOperation<T>[] = [];
  private activeOperations = new Set<string>();
  private results: Map<string, BatchResult<T>> = new Map();
  private executor: BatchExecutor<T>;

  // State management
  private isRunning_ = false;
  private isPaused_ = false;
  private isCancelled = false;

  // Progress tracking
  private startTime = 0;
  private completedCount = 0;
  private failedCount = 0;
  private skippedCount = 0;

  // Metrics
  private metrics: BatchMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalDuration: 0,
    averageOperationTime: 0,
    throughput: 0,
    dataTransferred: 0,
    retryCount: 0,
    errorRate: 0,
  };

  // Control promises
  private pausePromise?: Promise<void>;
  private pauseResolve?: () => void;

  constructor(executor: BatchExecutor<T>, config: Partial<BatchConfig> = {}) {
    this.executor = executor;
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<BatchConfig>;

    logger.info(
      `🔄 Batch processor initialized - concurrent: ${this.config.maxConcurrent}, batch: ${this.config.batchSize}, retries: ${this.config.retryAttempts}`,
    );
  }

  /**
   * Add a single operation to the queue
   */
  addOperation<O>(operation: BatchOperation<O>): string {
    if (this.isRunning_) {
      throw new Error('Cannot add operations while batch is running');
    }

    const id = operation.id || this.generateOperationId();
    const op = { ...operation, id, createdAt: Date.now() } as BatchOperation;

    this.queue.push(op as BatchOperation<T>);
    logger.debug(`➕ Operation added to queue: ${id} (${operation.type})`);

    return id;
  }

  /**
   * Add multiple operations to the queue
   */
  addOperations<O>(operations: BatchOperation<O>[]): string[] {
    if (this.isRunning_) {
      throw new Error('Cannot add operations while batch is running');
    }

    const ids = operations.map((op) => this.addOperation(op));
    logger.info(`➕ Added ${operations.length} operations to queue`);

    return ids;
  }

  /**
   * Remove an operation from the queue
   */
  removeOperation(operationId: string): boolean {
    if (this.isRunning_) {
      throw new Error('Cannot remove operations while batch is running');
    }

    const index = this.queue.findIndex((op) => op.id === operationId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      logger.debug(`➖ Operation removed from queue: ${operationId}`);
      return true;
    }

    return false;
  }

  /**
   * Clear all operations from the queue
   */
  clearOperations(): void {
    if (this.isRunning_) {
      throw new Error('Cannot clear operations while batch is running');
    }

    this.queue = [];
    this.results.clear();
    logger.info('🗑️ Queue cleared');
  }

  /**
   * Execute all operations in the queue
   */
  async execute<O>(): Promise<BatchResult<O>[]> {
    if (this.isRunning_) {
      throw new Error('Batch execution already in progress');
    }

    if (this.queue.length === 0) {
      logger.warn('⚠️ No operations in queue');
      return [];
    }

    logger.info(
      `🚀 Starting batch execution with ${this.queue.length} operations`,
    );

    // Reset state
    this.isRunning_ = true;
    this.isCancelled = false;
    this.isPaused_ = false;
    this.startTime = Date.now();
    this.completedCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
    this.results.clear();

    // Update metrics
    this.metrics.totalOperations = this.queue.length;

    try {
      // Process operations in batches
      const batches = this.createBatches();

      for (const batch of batches) {
        if (this.isCancelled) {
          throw new BatchCancelledError(
            this.queue.length - this.completedCount,
          );
        }

        await this.processBatch(batch);
      }

      // Finalize metrics
      this.finalizeMetrics();

      // Return results in original order
      return this.queue.map(
        (op) => this.results.get(op.id)!,
      ) as BatchResult<O>[];
    } finally {
      this.isRunning_ = false;
      logger.info(
        `✅ Batch execution completed - operations: ${this.metrics.totalOperations}, success: ${this.metrics.successfulOperations}, failed: ${this.metrics.failedOperations}`,
      );
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (!this.isRunning_ || this.isPaused_) return;

    logger.info('⏸️ Pausing batch execution');
    this.isPaused_ = true;

    this.pausePromise = new Promise((resolve) => {
      this.pauseResolve = resolve;
    });
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (!this.isPaused_) return;

    logger.info('▶️ Resuming batch execution');
    this.isPaused_ = false;

    if (this.pauseResolve) {
      this.pauseResolve();
      this.pausePromise = undefined;
      this.pauseResolve = undefined;
    }
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    if (!this.isRunning_) return;

    logger.warn('🛑 Cancelling batch execution');
    this.isCancelled = true;

    // Resume if paused so cancellation can proceed
    if (this.isPaused_) {
      this.resume();
    }
  }

  /**
   * Get current progress
   */
  getProgress(): BatchProgress {
    const completed =
      this.completedCount + this.failedCount + this.skippedCount;
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const remaining = this.queue.length - completed;
    const rate = completed > 0 ? completed / (elapsed / 1000) : 0;
    const estimatedTimeRemaining =
      rate > 0 ? (remaining / rate) * 1000 : undefined;

    return {
      total: this.queue.length,
      completed: this.completedCount,
      failed: this.failedCount,
      skipped: this.skippedCount,
      currentOperation: Array.from(this.activeOperations).join(', '),
      startTime: this.startTime,
      estimatedTimeRemaining,
    };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.isPaused_;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.isRunning_;
  }

  /**
   * Get current metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Create batches from queue
   */
  private createBatches(): BatchOperation<T>[][] {
    const batches: BatchOperation<T>[][] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < this.queue.length; i += batchSize) {
      batches.push(this.queue.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(batch: BatchOperation<T>[]): Promise<void> {
    const promises: Promise<void>[] = [];
    const semaphore = new Semaphore(this.config.maxConcurrent);

    for (const operation of batch) {
      if (this.isCancelled) break;

      // Handle pause
      if (this.isPaused_ && this.pausePromise) {
        await this.pausePromise;
      }

      const promise = semaphore.acquire().then(async (release) => {
        try {
          await this.processOperation(operation);
        } finally {
          release();
        }
      });

      promises.push(promise);
    }

    await Promise.all(promises);
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: BatchOperation<T>): Promise<void> {
    // Handle pause before starting operation
    if (this.isPaused_ && this.pausePromise) {
      await this.pausePromise;
    }

    this.activeOperations.add(operation.id);
    const startTime = Date.now();
    let retries = 0;

    try {
      // Report progress
      this.reportProgress();

      // Execute with retry logic
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
        if (attempt > 0) {
          retries++;
          this.metrics.retryCount++;
          await this.sleep(this.config.retryDelay * Math.pow(2, attempt - 1));
        }

        try {
          const result = await this.executeWithTimeout(operation);

          // Success
          const duration = Date.now() - startTime;
          this.results.set(operation.id, {
            operationId: operation.id,
            status: 'success',
            result,
            duration,
            retries,
          });

          this.completedCount++;
          this.metrics.successfulOperations++;

          logger.debug(
            `✅ Operation completed: ${operation.id} (${duration}ms, ${retries} retries)`,
          );

          return;
        } catch (error) {
          lastError = error as Error;

          if (attempt === this.config.retryAttempts) {
            throw lastError;
          }

          logger.warn(
            `⚠️ Operation failed, retrying (${attempt + 1}/${this.config.retryAttempts}): ${operation.id} - ${lastError.message}`,
          );
        }
      }
    } catch (error) {
      // Operation failed
      const duration = Date.now() - startTime;
      const batchError =
        error instanceof BatchError
          ? error
          : new BatchError(
              `Operation failed: ${(error as Error).message}`,
              operation,
              error as Error,
            );

      this.results.set(operation.id, {
        operationId: operation.id,
        status: 'failed',
        error: batchError,
        duration,
        retries,
      });

      this.failedCount++;
      this.metrics.failedOperations++;

      logger.error(
        `❌ Operation failed: ${operation.id} - ${batchError.message} (${duration}ms, ${retries} retries)`,
      );

      // Call error callback
      this.config.errorCallback?.(batchError, operation);

      // Stop if not continuing on error
      if (!this.config.continueOnError) {
        throw batchError;
      }
    } finally {
      this.activeOperations.delete(operation.id);
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout(operation: BatchOperation<T>): Promise<T> {
    if (!this.config.timeout) {
      return this.executor.execute(operation);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new BatchTimeoutError(operation, this.config.timeout!));
      }, this.config.timeout);
    });

    return Promise.race([this.executor.execute(operation), timeoutPromise]);
  }

  /**
   * Report progress
   */
  private reportProgress(): void {
    if (this.config.progressCallback) {
      this.config.progressCallback(this.getProgress());
    }
  }

  /**
   * Finalize metrics
   */
  private finalizeMetrics(): void {
    const duration = Date.now() - this.startTime;

    this.metrics.totalDuration = duration;
    this.metrics.averageOperationTime = duration / this.metrics.totalOperations;
    this.metrics.throughput = this.metrics.totalOperations / (duration / 1000);
    this.metrics.errorRate =
      this.metrics.failedOperations / this.metrics.totalOperations;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.waiting.push(() => {
        this.permits--;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.permits++;

    if (this.waiting.length > 0 && this.permits > 0) {
      const next = this.waiting.shift();
      next?.();
    }
  }
}
