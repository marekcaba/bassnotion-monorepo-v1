/**
 * Batch Operations Types
 *
 * Type definitions for batch processing operations
 */

export interface BatchOperation<T = unknown> {
  id: string;
  type: 'upload' | 'download' | 'delete' | 'update' | 'process';
  resource: string;
  data?: T;
  metadata?: Record<string, unknown>;
  priority?: number;
  retryCount?: number;
  createdAt: number;
}

export interface BatchResult<T = unknown> {
  operationId: string;
  status: 'success' | 'failed' | 'skipped';
  result?: T;
  error?: Error;
  duration: number;
  retries: number;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentOperation?: string;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface BatchConfig {
  maxConcurrent: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  timeout?: number;
  continueOnError: boolean;
  progressCallback?: (progress: BatchProgress) => void;
  errorCallback?: (error: Error, operation: BatchOperation) => void;
}

export interface BatchExecutor<T = unknown> {
  execute(operation: BatchOperation): Promise<T>;
}

export interface BatchProcessor {
  addOperation<T>(operation: BatchOperation<T>): string;
  addOperations<T>(operations: BatchOperation<T>[]): string[];
  removeOperation(operationId: string): boolean;
  clearOperations(): void;
  execute<T>(): Promise<BatchResult<T>[]>;
  pause(): void;
  resume(): void;
  cancel(): void;
  getProgress(): BatchProgress;
  getQueueSize(): number;
  isPaused(): boolean;
  isRunning(): boolean;
}

export interface BatchUploadOperation {
  bucket: string;
  path: string;
  data: Blob | ArrayBuffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
  overwrite?: boolean;
}

export interface BatchDownloadOperation {
  bucket: string;
  path: string;
  outputFormat?: 'blob' | 'arraybuffer' | 'text';
}

export interface BatchDeleteOperation {
  bucket: string;
  path: string;
  includeVersions?: boolean;
}

export interface BatchTransferResult {
  path: string;
  size?: number;
  etag?: string;
  contentType?: string;
  lastModified?: Date;
  url?: string;
}

export interface BatchStrategy {
  name: string;
  shouldBatch(operations: BatchOperation[]): boolean;
  optimizeOrder(operations: BatchOperation[]): BatchOperation[];
  partitionBatch(
    operations: BatchOperation[],
    config: BatchConfig,
  ): BatchOperation[][];
}

export interface BatchMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalDuration: number;
  averageOperationTime: number;
  throughput: number; // operations per second
  dataTransferred: number; // bytes
  retryCount: number;
  errorRate: number;
}

export class BatchError extends Error {
  constructor(
    message: string,
    public readonly operation: BatchOperation,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'BatchError';
  }
}

export class BatchTimeoutError extends BatchError {
  constructor(operation: BatchOperation, timeout: number) {
    super(`Operation timed out after ${timeout}ms`, operation);
    this.name = 'BatchTimeoutError';
  }
}

export class BatchCancelledError extends Error {
  constructor(public readonly remainingOperations: number) {
    super(
      `Batch operation cancelled with ${remainingOperations} operations remaining`,
    );
    this.name = 'BatchCancelledError';
  }
}
