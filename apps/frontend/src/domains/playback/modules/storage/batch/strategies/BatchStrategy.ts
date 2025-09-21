/**
 * Batch Strategy Implementations
 *
 * Different strategies for optimizing batch operations
 */

import {
  BatchOperation,
  BatchConfig,
  BatchStrategy as IBatchStrategy,
} from '../types.js';

/**
 * Base batch strategy
 */
export abstract class BaseBatchStrategy implements IBatchStrategy {
  abstract name: string;

  /**
   * Determine if operations should be batched
   */
  shouldBatch(operations: BatchOperation[]): boolean {
    // Default: batch if more than 1 operation
    return operations.length > 1;
  }

  /**
   * Optimize operation order
   */
  optimizeOrder(operations: BatchOperation[]): BatchOperation[] {
    // Default: no optimization
    return operations;
  }

  /**
   * Partition operations into batches
   */
  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const batches: BatchOperation[][] = [];
    const batchSize = config.batchSize;

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    return batches;
  }
}

/**
 * Size-based batching strategy
 * Groups operations by total data size
 */
export class SizeBasedStrategy extends BaseBatchStrategy {
  name = 'size-based';
  private maxBatchSize: number;

  constructor(maxBatchSizeMB = 100) {
    super();
    this.maxBatchSize = maxBatchSizeMB * 1024 * 1024; // Convert to bytes
  }

  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const batches: BatchOperation[][] = [];
    let currentBatch: BatchOperation[] = [];
    let currentSize = 0;

    for (const operation of operations) {
      const opSize = this.getOperationSize(operation);

      // Start new batch if size limit exceeded
      if (currentSize + opSize > this.maxBatchSize && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }

      currentBatch.push(operation);
      currentSize += opSize;

      // Respect max batch count
      if (currentBatch.length >= config.batchSize) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private getOperationSize(operation: BatchOperation): number {
    // Estimate size based on operation data
    if (operation.data instanceof Blob) {
      return operation.data.size;
    } else if (operation.data instanceof ArrayBuffer) {
      return operation.data.byteLength;
    } else if (typeof operation.data === 'string') {
      return new Blob([operation.data]).size;
    }

    // Default estimate
    return 1024; // 1KB
  }
}

/**
 * Priority-based batching strategy
 * Groups and orders operations by priority
 */
export class PriorityBasedStrategy extends BaseBatchStrategy {
  name = 'priority-based';

  optimizeOrder(operations: BatchOperation[]): BatchOperation[] {
    // Sort by priority (higher priority first)
    return [...operations].sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });
  }

  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const sorted = this.optimizeOrder(operations);
    const batches: BatchOperation[][] = [];

    // Group by priority levels
    const priorityGroups = new Map<number, BatchOperation[]>();

    for (const op of sorted) {
      const priority = op.priority ?? 0;
      const group = priorityGroups.get(priority) || [];
      group.push(op);
      priorityGroups.set(priority, group);
    }

    // Create batches respecting priority groups
    for (const [_, group] of priorityGroups) {
      for (let i = 0; i < group.length; i += config.batchSize) {
        batches.push(group.slice(i, i + config.batchSize));
      }
    }

    return batches;
  }
}

/**
 * Type-based batching strategy
 * Groups operations by type for better efficiency
 */
export class TypeBasedStrategy extends BaseBatchStrategy {
  name = 'type-based';

  optimizeOrder(operations: BatchOperation[]): BatchOperation[] {
    // Group by type
    const typeOrder = ['download', 'upload', 'update', 'delete', 'process'];

    return [...operations].sort((a, b) => {
      const indexA = typeOrder.indexOf(a.type);
      const indexB = typeOrder.indexOf(b.type);
      return indexA - indexB;
    });
  }

  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const batches: BatchOperation[][] = [];

    // Group by type
    const typeGroups = new Map<string, BatchOperation[]>();

    for (const op of operations) {
      const group = typeGroups.get(op.type) || [];
      group.push(op);
      typeGroups.set(op.type, group);
    }

    // Create batches for each type
    for (const [_, group] of typeGroups) {
      for (let i = 0; i < group.length; i += config.batchSize) {
        batches.push(group.slice(i, i + config.batchSize));
      }
    }

    return batches;
  }
}

/**
 * Resource-based batching strategy
 * Groups operations by resource/path for locality
 */
export class ResourceBasedStrategy extends BaseBatchStrategy {
  name = 'resource-based';

  optimizeOrder(operations: BatchOperation[]): BatchOperation[] {
    // Sort by resource path
    return [...operations].sort((a, b) => {
      return a.resource.localeCompare(b.resource);
    });
  }

  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const batches: BatchOperation[][] = [];

    // Group by resource prefix (e.g., bucket/folder)
    const resourceGroups = new Map<string, BatchOperation[]>();

    for (const op of operations) {
      const prefix = this.getResourcePrefix(op.resource);
      const group = resourceGroups.get(prefix) || [];
      group.push(op);
      resourceGroups.set(prefix, group);
    }

    // Create batches for each resource group
    for (const [_, group] of resourceGroups) {
      for (let i = 0; i < group.length; i += config.batchSize) {
        batches.push(group.slice(i, i + config.batchSize));
      }
    }

    return batches;
  }

  private getResourcePrefix(resource: string): string {
    // Extract bucket/folder prefix
    const parts = resource.split('/');
    return parts.slice(0, Math.min(2, parts.length)).join('/');
  }
}

/**
 * Adaptive batching strategy
 * Adjusts batch size based on performance metrics
 */
export class AdaptiveStrategy extends BaseBatchStrategy {
  name = 'adaptive';
  private performanceHistory: number[] = [];
  private optimalBatchSize: number;

  constructor(initialBatchSize = 50) {
    super();
    this.optimalBatchSize = initialBatchSize;
  }

  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][] {
    const batches: BatchOperation[][] = [];
    const adaptiveBatchSize = Math.min(this.optimalBatchSize, config.batchSize);

    for (let i = 0; i < operations.length; i += adaptiveBatchSize) {
      batches.push(operations.slice(i, i + adaptiveBatchSize));
    }

    return batches;
  }

  /**
   * Update strategy based on performance
   */
  updatePerformance(
    batchSize: number,
    duration: number,
    successRate: number,
  ): void {
    const throughput = batchSize / (duration / 1000);
    this.performanceHistory.push(throughput);

    // Keep last 10 measurements
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift();
    }

    // Adjust batch size based on performance trend
    if (successRate < 0.9) {
      // Reduce batch size if error rate is high
      this.optimalBatchSize = Math.max(
        10,
        Math.floor(this.optimalBatchSize * 0.8),
      );
    } else if (this.isThroughputImproving()) {
      // Increase batch size if performance is improving
      this.optimalBatchSize = Math.floor(this.optimalBatchSize * 1.2);
    }
  }

  private isThroughputImproving(): boolean {
    if (this.performanceHistory.length < 3) return true;

    const recent = this.performanceHistory.slice(-3);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgAll =
      this.performanceHistory.reduce((a, b) => a + b, 0) /
      this.performanceHistory.length;

    return avgRecent > avgAll;
  }
}
