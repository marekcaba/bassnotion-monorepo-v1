/**
 * Storage Batch Executor
 *
 * Executes batch storage operations using the storage provider
 */

import { logger } from '../../../../utils/logger.js';

import type { StorageProvider } from '../../providers/StorageProvider.js';
import {
  BatchExecutor,
  BatchOperation,
  BatchUploadOperation,
  BatchDownloadOperation,
  BatchDeleteOperation,
  BatchTransferResult,
  BatchError,
} from '../types.js';

/**
 * Storage-specific batch executor
 */
export class StorageBatchExecutor
  implements BatchExecutor<BatchTransferResult>
{
  constructor(private storageProvider: StorageProvider) {
    logger.info('📦 Storage batch executor initialized');
  }

  /**
   * Execute a batch operation
   */
  async execute(operation: BatchOperation): Promise<BatchTransferResult> {
    logger.debug(
      `🔄 Executing ${operation.type} operation: ${operation.id} (${operation.resource})`,
    );

    try {
      switch (operation.type) {
        case 'upload':
          return this.executeUpload(operation);

        case 'download':
          return this.executeDownload(operation);

        case 'delete':
          return this.executeDelete(operation);

        case 'update':
          return this.executeUpdate(operation);

        default:
          throw new BatchError(
            `Unsupported operation type: ${operation.type}`,
            operation,
          );
      }
    } catch (error) {
      if (error instanceof BatchError) {
        throw error;
      }

      throw new BatchError(
        `Storage operation failed: ${(error as Error).message}`,
        operation,
        error as Error,
      );
    }
  }

  /**
   * Execute upload operation
   */
  private async executeUpload(
    operation: BatchOperation,
  ): Promise<BatchTransferResult> {
    const uploadOp = operation.data as BatchUploadOperation;

    if (!uploadOp || !uploadOp.bucket || !uploadOp.path) {
      throw new BatchError('Invalid upload operation data', operation);
    }

    // Convert data to Blob if needed
    let blob: Blob;
    if (uploadOp.data instanceof Blob) {
      blob = uploadOp.data;
    } else if (uploadOp.data instanceof ArrayBuffer) {
      blob = new Blob([uploadOp.data], { type: uploadOp.contentType });
    } else if (typeof uploadOp.data === 'string') {
      blob = new Blob([uploadOp.data], {
        type: uploadOp.contentType || 'text/plain',
      });
    } else {
      throw new BatchError('Invalid upload data format', operation);
    }

    // Upload using storage provider
    await this.storageProvider.upload(uploadOp.bucket, uploadOp.path, blob, {
      contentType: uploadOp.contentType,
      metadata: uploadOp.metadata,
    });

    // Get file info for result
    const info = await this.storageProvider.getMetadata(
      uploadOp.bucket,
      uploadOp.path,
    );

    return {
      path: uploadOp.path,
      size: blob.size,
      contentType: uploadOp.contentType || blob.type,
      etag: info?.etag,
      lastModified: info?.lastModified
        ? new Date(info.lastModified)
        : new Date(),
    };
  }

  /**
   * Execute download operation
   */
  private async executeDownload(
    operation: BatchOperation,
  ): Promise<BatchTransferResult> {
    const downloadOp = operation.data as BatchDownloadOperation;

    if (!downloadOp || !downloadOp.bucket || !downloadOp.path) {
      throw new BatchError('Invalid download operation data', operation);
    }

    // Download using storage provider
    const blob = await this.storageProvider.download(
      downloadOp.bucket,
      downloadOp.path,
    );

    // Generate URL for the downloaded content
    const url = URL.createObjectURL(blob);

    // Get metadata
    const info = await this.storageProvider.getMetadata(
      downloadOp.bucket,
      downloadOp.path,
    );

    return {
      path: downloadOp.path,
      size: blob.size,
      contentType: blob.type,
      url,
      etag: info?.etag,
      lastModified: info?.lastModified
        ? new Date(info.lastModified)
        : undefined,
    };
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(
    operation: BatchOperation,
  ): Promise<BatchTransferResult> {
    const deleteOp = operation.data as BatchDeleteOperation;

    if (!deleteOp || !deleteOp.bucket || !deleteOp.path) {
      throw new BatchError('Invalid delete operation data', operation);
    }

    // Get metadata before deletion
    const info = await this.storageProvider.getMetadata(
      deleteOp.bucket,
      deleteOp.path,
    );

    // Delete using storage provider
    await this.storageProvider.delete(deleteOp.bucket, deleteOp.path);

    return {
      path: deleteOp.path,
      size: info?.size,
      contentType: info?.contentType,
      etag: info?.etag,
      lastModified: info?.lastModified
        ? new Date(info.lastModified)
        : undefined,
    };
  }

  /**
   * Execute update operation
   */
  private async executeUpdate(
    operation: BatchOperation,
  ): Promise<BatchTransferResult> {
    // For storage, update is typically implemented as upload with overwrite
    if (
      operation.data &&
      typeof operation.data === 'object' &&
      'bucket' in operation.data
    ) {
      const updateOp = operation.data as BatchUploadOperation;
      updateOp.overwrite = true;
      return this.executeUpload(operation);
    }

    throw new BatchError('Invalid update operation data', operation);
  }
}

/**
 * Factory function to create storage batch executor
 */
export function createStorageBatchExecutor(
  storageProvider: StorageProvider,
): StorageBatchExecutor {
  return new StorageBatchExecutor(storageProvider);
}
