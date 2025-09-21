/**
 * Storage-specific Error Classes
 * Phase 5.2.1: Domain-specific error classes for storage operations
 *
 * Extends the PlaybackError base class with storage-specific error types
 * for the refactored storage modules.
 */

import {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  ErrorDetails,
  createErrorContext,
  determineSeverity,
} from '../../services/errors/base.js';

/**
 * Storage-specific error codes
 */
export enum StorageErrorCode {
  // Connection errors
  STORAGE_CONNECTION_FAILED = 'STORAGE_CONNECTION_FAILED',
  STORAGE_AUTH_FAILED = 'STORAGE_AUTH_FAILED',
  STORAGE_TIMEOUT = 'STORAGE_TIMEOUT',

  // Operation errors
  UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'STORAGE_DOWNLOAD_FAILED',
  DELETE_FAILED = 'STORAGE_DELETE_FAILED',
  LIST_FAILED = 'STORAGE_LIST_FAILED',

  // Cache errors
  CACHE_MISS = 'STORAGE_CACHE_MISS',
  CACHE_FULL = 'STORAGE_CACHE_FULL',
  CACHE_CORRUPTED = 'STORAGE_CACHE_CORRUPTED',
  CACHE_EVICTION_FAILED = 'STORAGE_CACHE_EVICTION_FAILED',

  // CDN errors
  CDN_UNREACHABLE = 'STORAGE_CDN_UNREACHABLE',
  CDN_SYNC_FAILED = 'STORAGE_CDN_SYNC_FAILED',
  EDGE_LOCATION_ERROR = 'STORAGE_EDGE_LOCATION_ERROR',

  // Batch operation errors
  BATCH_PARTIAL_FAILURE = 'STORAGE_BATCH_PARTIAL_FAILURE',
  BATCH_TIMEOUT = 'STORAGE_BATCH_TIMEOUT',
  BATCH_SIZE_EXCEEDED = 'STORAGE_BATCH_SIZE_EXCEEDED',

  // Resilience errors
  CIRCUIT_BREAKER_OPEN = 'STORAGE_CIRCUIT_BREAKER_OPEN',
  RETRY_EXHAUSTED = 'STORAGE_RETRY_EXHAUSTED',
  FALLBACK_FAILED = 'STORAGE_FALLBACK_FAILED',
}

/**
 * Base storage error class
 */
export class StorageError extends PlaybackError {
  constructor(
    code: StorageErrorCode,
    message: string,
    severity?: ErrorSeverity,
    cause?: Error,
    additionalContext?: Record<string, any>,
  ) {
    const context = createErrorContext({
      currentOperation: 'storage-operation',
      ...additionalContext,
    });

    const details: ErrorDetails = {
      code,
      message,
      severity:
        severity || determineSeverity(ErrorCategory.NETWORK, true, false),
      category: ErrorCategory.NETWORK,
      context,
      recoveryActions: getStorageRecoveryActions(code),
      userMessage: getStorageUserMessage(code),
      technicalMessage: `Storage Error: ${message}`,
      documentationUrl: `/docs/errors/${code.toLowerCase()}`,
    };

    super(details, cause);
    this.name = 'StorageError';
  }
}

/**
 * Storage connection error
 */
export class StorageConnectionError extends StorageError {
  constructor(
    message: string,
    public readonly endpoint?: string,
    public readonly statusCode?: number,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.STORAGE_CONNECTION_FAILED,
      message,
      ErrorSeverity.HIGH,
      cause,
      {
        endpoint,
        statusCode,
        operation: 'storage-connection',
      },
    );
    this.name = 'StorageConnectionError';
  }
}

/**
 * Storage authentication error
 */
export class StorageAuthError extends StorageError {
  constructor(
    message: string,
    public readonly authMethod?: string,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.STORAGE_AUTH_FAILED,
      message,
      ErrorSeverity.HIGH,
      cause,
      {
        authMethod,
        operation: 'storage-authentication',
      },
    );
    this.name = 'StorageAuthError';
  }
}

/**
 * File upload error
 */
export class UploadError extends StorageError {
  constructor(
    message: string,
    public readonly fileName: string,
    public readonly fileSize?: number,
    public readonly uploadProgress?: number,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.UPLOAD_FAILED,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        fileName,
        fileSize,
        uploadProgress,
        operation: 'file-upload',
      },
    );
    this.name = 'UploadError';
  }
}

/**
 * File download error
 */
export class DownloadError extends StorageError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly expectedSize?: number,
    public readonly receivedSize?: number,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.DOWNLOAD_FAILED,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        filePath,
        expectedSize,
        receivedSize,
        operation: 'file-download',
      },
    );
    this.name = 'DownloadError';
  }
}

/**
 * Cache operation error
 */
export class CacheError extends StorageError {
  constructor(
    code: StorageErrorCode,
    message: string,
    public readonly cacheKey?: string,
    public readonly cacheSize?: number,
    public readonly maxSize?: number,
    cause?: Error,
  ) {
    super(code, message, ErrorSeverity.LOW, cause, {
      cacheKey,
      cacheSize,
      maxSize,
      operation: 'cache-operation',
    });
    this.name = 'CacheError';
  }
}

/**
 * Cache full error
 */
export class CacheFullError extends CacheError {
  constructor(
    public readonly currentSize: number,
    public readonly maxSize: number,
    public readonly requestedSize: number,
  ) {
    const message = `Cache full: ${currentSize}/${maxSize} bytes, requested ${requestedSize} bytes`;
    super(
      StorageErrorCode.CACHE_FULL,
      message,
      undefined,
      currentSize,
      maxSize,
    );
    this.name = 'CacheFullError';
  }
}

/**
 * CDN error
 */
export class CDNError extends StorageError {
  constructor(
    message: string,
    public readonly cdnUrl?: string,
    public readonly edgeLocation?: string,
    public readonly latency?: number,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.CDN_UNREACHABLE,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        cdnUrl,
        edgeLocation,
        latency,
        operation: 'cdn-access',
      },
    );
    this.name = 'CDNError';
  }
}

/**
 * Batch operation error
 */
export class BatchOperationError extends StorageError {
  constructor(
    message: string,
    public readonly totalOperations: number,
    public readonly successfulOperations: number,
    public readonly failedOperations: Array<{
      operation: string;
      error: string;
    }>,
    cause?: Error,
  ) {
    super(
      StorageErrorCode.BATCH_PARTIAL_FAILURE,
      message,
      ErrorSeverity.MEDIUM,
      cause,
      {
        totalOperations,
        successfulOperations,
        failedCount: failedOperations.length,
        operation: 'batch-operation',
      },
    );
    this.name = 'BatchOperationError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends StorageError {
  constructor(
    public readonly serviceName: string,
    public readonly failureCount: number,
    public readonly lastFailure?: string,
  ) {
    const message = `Circuit breaker open for ${serviceName}: ${failureCount} failures`;
    super(
      StorageErrorCode.CIRCUIT_BREAKER_OPEN,
      message,
      ErrorSeverity.HIGH,
      undefined,
      {
        serviceName,
        failureCount,
        lastFailure,
        operation: 'circuit-breaker-check',
      },
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends StorageError {
  constructor(
    message: string,
    public readonly attemptCount: number,
    public readonly maxAttempts: number,
    public readonly lastError?: Error,
  ) {
    super(
      StorageErrorCode.RETRY_EXHAUSTED,
      message,
      ErrorSeverity.HIGH,
      lastError,
      {
        attemptCount,
        maxAttempts,
        operation: 'retry-operation',
      },
    );
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Helper function to get recovery actions for storage errors
 */
function getStorageRecoveryActions(code: StorageErrorCode) {
  switch (code) {
    case StorageErrorCode.STORAGE_CONNECTION_FAILED:
    case StorageErrorCode.STORAGE_TIMEOUT:
      return [
        {
          type: 'retry' as const,
          description: 'Retry connection',
          automatic: true,
          priority: 1,
          estimatedTime: 3000,
        },
        {
          type: 'fallback' as const,
          description: 'Use cached data',
          automatic: true,
          priority: 2,
        },
      ];

    case StorageErrorCode.STORAGE_AUTH_FAILED:
      return [
        {
          type: 'reload' as const,
          description: 'Refresh authentication',
          automatic: false,
          priority: 1,
        },
      ];

    case StorageErrorCode.UPLOAD_FAILED:
    case StorageErrorCode.DOWNLOAD_FAILED:
      return [
        {
          type: 'retry' as const,
          description: 'Retry operation',
          automatic: true,
          priority: 1,
          estimatedTime: 5000,
        },
      ];

    case StorageErrorCode.CACHE_FULL:
      return [
        {
          type: 'degrade' as const,
          description: 'Clear old cache entries',
          automatic: true,
          priority: 1,
        },
      ];

    case StorageErrorCode.CDN_UNREACHABLE:
      return [
        {
          type: 'fallback' as const,
          description: 'Use direct storage',
          automatic: true,
          priority: 1,
        },
        {
          type: 'retry' as const,
          description: 'Try different edge location',
          automatic: true,
          priority: 2,
          estimatedTime: 2000,
        },
      ];

    case StorageErrorCode.CIRCUIT_BREAKER_OPEN:
      return [
        {
          type: 'fallback' as const,
          description: 'Use fallback service',
          automatic: true,
          priority: 1,
        },
        {
          type: 'abort' as const,
          description: 'Cancel operation',
          automatic: false,
          priority: 2,
        },
      ];

    default:
      return [
        {
          type: 'retry' as const,
          description: 'Retry operation',
          automatic: true,
          priority: 1,
        },
      ];
  }
}

/**
 * Helper function to get user-friendly messages for storage errors
 */
function getStorageUserMessage(code: StorageErrorCode): string {
  switch (code) {
    case StorageErrorCode.STORAGE_CONNECTION_FAILED:
      return 'Unable to connect to storage service. Please check your internet connection.';
    case StorageErrorCode.STORAGE_AUTH_FAILED:
      return 'Authentication failed. Please sign in again.';
    case StorageErrorCode.STORAGE_TIMEOUT:
      return 'Storage operation timed out. Please try again.';
    case StorageErrorCode.UPLOAD_FAILED:
      return 'Failed to upload file. Please check your connection and try again.';
    case StorageErrorCode.DOWNLOAD_FAILED:
      return 'Failed to download file. Please check your connection and try again.';
    case StorageErrorCode.DELETE_FAILED:
      return 'Failed to delete file. Please try again.';
    case StorageErrorCode.LIST_FAILED:
      return 'Failed to retrieve file list. Please try again.';
    case StorageErrorCode.CACHE_MISS:
      return 'Content not available offline. Internet connection required.';
    case StorageErrorCode.CACHE_FULL:
      return 'Storage space full. Some content may not be cached.';
    case StorageErrorCode.CACHE_CORRUPTED:
      return 'Cached data corrupted. Clearing cache and retrying.';
    case StorageErrorCode.CACHE_EVICTION_FAILED:
      return 'Failed to clear cache space. Please restart the application.';
    case StorageErrorCode.CDN_UNREACHABLE:
      return 'Content delivery network unavailable. Using alternate source.';
    case StorageErrorCode.CDN_SYNC_FAILED:
      return 'Failed to sync with content network. Some content may be outdated.';
    case StorageErrorCode.EDGE_LOCATION_ERROR:
      return 'Nearest server unavailable. Using alternate location.';
    case StorageErrorCode.BATCH_PARTIAL_FAILURE:
      return 'Some operations failed. Please review and retry failed items.';
    case StorageErrorCode.BATCH_TIMEOUT:
      return 'Batch operation took too long. Some items may not be processed.';
    case StorageErrorCode.BATCH_SIZE_EXCEEDED:
      return 'Too many items in batch. Please reduce the number of items.';
    case StorageErrorCode.CIRCUIT_BREAKER_OPEN:
      return 'Service temporarily unavailable due to errors. Please try again later.';
    case StorageErrorCode.RETRY_EXHAUSTED:
      return 'Operation failed after multiple attempts. Please try again later.';
    case StorageErrorCode.FALLBACK_FAILED:
      return 'Unable to use alternate service. Please contact support.';
    default:
      return 'A storage error occurred. Please try again.';
  }
}

/**
 * Type guards for storage errors
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

export function isStorageConnectionError(
  error: unknown,
): error is StorageConnectionError {
  return error instanceof StorageConnectionError;
}

export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

export function isCDNError(error: unknown): error is CDNError {
  return error instanceof CDNError;
}

export function isBatchOperationError(
  error: unknown,
): error is BatchOperationError {
  return error instanceof BatchOperationError;
}

export function isCircuitBreakerOpenError(
  error: unknown,
): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError;
}
