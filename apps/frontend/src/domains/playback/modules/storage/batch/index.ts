/**
 * Batch Operations Module
 *
 * Provides batch processing capabilities for storage operations
 */

// Core processor
export { BatchProcessor } from './BatchProcessor.js';

// Strategies
export {
  BaseBatchStrategy,
  SizeBasedStrategy,
  PriorityBasedStrategy,
  TypeBasedStrategy,
  ResourceBasedStrategy,
  AdaptiveStrategy,
} from './strategies/BatchStrategy.js';

// Executors
export {
  StorageBatchExecutor,
  createStorageBatchExecutor,
} from './executors/StorageBatchExecutor.js';

// Types
export type {
  BatchOperation,
  BatchResult,
  BatchProgress,
  BatchConfig,
  BatchExecutor,
  BatchProcessor as IBatchProcessor,
  BatchUploadOperation,
  BatchDownloadOperation,
  BatchDeleteOperation,
  BatchTransferResult,
  BatchStrategy,
  BatchMetrics,
} from './types.js';

export { BatchError, BatchTimeoutError, BatchCancelledError } from './types.js';
