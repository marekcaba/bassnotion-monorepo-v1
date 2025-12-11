/**
 * LocalProvider - Local storage provider for audio assets
 *
 * Provides storage capabilities using browser's local storage mechanisms
 * including IndexedDB for large binary data and localStorage for metadata.
 * Useful for offline support and development environments.
 */

import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('LocalProvider');

export interface LocalProviderConfig {
  dbName: string;
  dbVersion: number;
  objectStoreName: string;
  maxStorageSize: number; // in bytes
  enableCompression: boolean;
  metadataPrefix: string;
}

export interface LocalStorageResult {
  success: boolean;
  path?: string;
  size?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LocalStorageObject {
  path: string;
  data: ArrayBuffer;
  size: number;
  contentType?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface LocalProviderMetrics {
  hitRate: number;
  missRate: number;
  averageLatencyMs: number;
  errorRate: number;
  totalOperations: number;
  totalBytes: number;
  storeCount: number;
  retrieveCount: number;
  deleteCount: number;
  hits: number;
  misses: number;
  errors: number;
}

/**
 * Storage provider for local browser storage
 */
export class LocalProvider {
  private config: LocalProviderConfig;
  private eventBus?: EventBus;
  private db?: IDBDatabase;
  private isInitialized = false;

  // Storage metrics (enhanced for performance tracking)
  private metrics = {
    stored: 0,
    retrieved: 0,
    deleted: 0,
    errors: 0,
    totalSize: 0,
    // Enhanced performance tracking
    hits: 0,
    misses: 0,
    latencies: [] as number[], // Rolling window of last 100 latencies
  };

  private readonly LATENCY_WINDOW_SIZE = 100;

  constructor(config: LocalProviderConfig, eventBus?: EventBus) {
    this.config = config;
    this.eventBus = eventBus;

    this.initialize();
  }

  /**
   * Initialize IndexedDB
   */
  private async initialize(): Promise<void> {
    try {
      // Check for IndexedDB support
      if (!('indexedDB' in window)) {
        throw new Error('IndexedDB not supported');
      }

      // Open database
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error as Error);
        this.eventBus?.emit('storage:error', {
          provider: 'local',
          error: 'Failed to open database',
        });
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        logger.info('LocalProvider initialized with IndexedDB');

        this.eventBus?.emit('storage:connected', {
          provider: 'local',
          database: this.config.dbName,
        });

        // Calculate current storage size
        this.calculateStorageSize();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.config.objectStoreName)) {
          const store = db.createObjectStore(this.config.objectStoreName, {
            keyPath: 'path',
          });

          // Create indexes
          store.createIndex('contentType', 'contentType', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    } catch (error) {
      logger.error('Failed to initialize LocalProvider:', error as Error);
      this.isInitialized = false;
    }
  }

  /**
   * Store data locally
   */
  async store(
    path: string,
    data: ArrayBuffer,
    options: {
      contentType?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<LocalStorageResult> {
    const startTime = performance.now();

    try {
      await this.ensureInitialized();

      // Check storage quota
      const canStore = await this.checkStorageQuota(data.byteLength);
      if (!canStore) {
        throw new Error('Storage quota exceeded');
      }

      // Compress if enabled
      let storedData = data;
      if (this.config.enableCompression) {
        storedData = await this.compressData(data);
      }

      // Create storage object
      const storageObject: LocalStorageObject = {
        path,
        data: storedData,
        size: data.byteLength,
        contentType: options.contentType,
        metadata: options.metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Store in IndexedDB
      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      await new Promise<void>((resolve, reject) => {
        const request = store.put(storageObject);

        request.onsuccess = () => {
          // Store metadata in localStorage
          this.storeMetadata(path, {
            size: data.byteLength,
            contentType: options.contentType,
            compressed: this.config.enableCompression,
            ...options.metadata,
          });

          // Update metrics
          this.metrics.stored++;
          this.metrics.totalSize += data.byteLength;

          resolve();
        };

        request.onerror = () => reject(request.error);
      });

      const duration = performance.now() - startTime;
      this.recordLatency(duration);

      this.eventBus?.emit('storage:stored', {
        path,
        size: data.byteLength,
        duration,
        provider: 'local',
      });

      return {
        success: true,
        path,
        size: data.byteLength,
        metadata: options.metadata,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordLatency(duration);
      this.metrics.errors++;

      this.eventBus?.emit('storage:storeError', {
        path,
        error: (error as Error).message,
        provider: 'local',
      });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Retrieve data from local storage
   */
  async retrieve(
    path: string,
  ): Promise<LocalStorageResult & { data?: ArrayBuffer }> {
    const startTime = performance.now();

    try {
      await this.ensureInitialized();

      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readonly',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      const storageObject = await new Promise<LocalStorageObject | undefined>(
        (resolve, reject) => {
          const request = store.get(path);

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );

      if (!storageObject) {
        throw new Error('File not found');
      }

      // Decompress if needed
      let data = storageObject.data;
      const metadata = this.getMetadata(path);
      if (metadata?.compressed) {
        data = await this.decompressData(data);
      }

      // Update metrics
      this.metrics.retrieved++;
      this.metrics.hits++;

      const duration = performance.now() - startTime;
      this.recordLatency(duration);

      this.eventBus?.emit('storage:retrieved', {
        path,
        size: data.byteLength,
        duration,
        provider: 'local',
      });

      return {
        success: true,
        data,
        path,
        size: data.byteLength,
        metadata: storageObject.metadata,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordLatency(duration);

      // Check if it's a miss (not found) vs actual error
      const isNotFound = (error as Error).message === 'File not found';
      if (isNotFound) {
        this.metrics.misses++;
      } else {
        this.metrics.errors++;
      }

      this.eventBus?.emit('storage:retrieveError', {
        path,
        error: (error as Error).message,
        provider: 'local',
      });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Delete data from local storage
   */
  async delete(paths: string | string[]): Promise<LocalStorageResult> {
    try {
      await this.ensureInitialized();

      const pathArray = Array.isArray(paths) ? paths : [paths];
      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      let deletedSize = 0;

      for (const path of pathArray) {
        // Get size before deletion
        const metadata = this.getMetadata(path);
        if (metadata?.size) {
          deletedSize += metadata.size;
        }

        await new Promise<void>((resolve, reject) => {
          const request = store.delete(path);

          request.onsuccess = () => {
            // Remove metadata
            this.deleteMetadata(path);
            resolve();
          };

          request.onerror = () => reject(request.error);
        });
      }

      // Update metrics
      this.metrics.deleted += pathArray.length;
      this.metrics.totalSize -= deletedSize;

      this.eventBus?.emit('storage:deleted', {
        paths: pathArray,
        provider: 'local',
      });

      return {
        success: true,
        path: Array.isArray(paths) ? paths.join(',') : paths,
      };
    } catch (error) {
      this.metrics.errors++;

      this.eventBus?.emit('storage:deleteError', {
        paths: Array.isArray(paths) ? paths : [paths],
        error: (error as Error).message,
        provider: 'local',
      });

      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * List stored files
   */
  async list(
    prefix = '',
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ files: Array<{ path: string; size: number; metadata?: any }> }> {
    try {
      await this.ensureInitialized();

      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readonly',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      const files: Array<{ path: string; size: number; metadata?: any }> = [];
      let count = 0;
      let skipped = 0;

      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            const object = cursor.value as LocalStorageObject;

            // Filter by prefix
            if (object.path.startsWith(prefix)) {
              // Handle offset
              if (skipped < (options.offset || 0)) {
                skipped++;
              } else if (!options.limit || count < options.limit) {
                files.push({
                  path: object.path,
                  size: object.size,
                  metadata: object.metadata,
                });
                count++;
              }
            }

            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      return { files };
    } catch (error) {
      logger.error('Failed to list files:', error as Error);
      return { files: [] };
    }
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.ensureInitialized();

      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readonly',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      return new Promise<boolean>((resolve) => {
        const request = store.count(path);

        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    try {
      await this.ensureInitialized();

      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readwrite',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          // Clear all metadata
          this.clearAllMetadata();

          // Reset metrics
          this.metrics = {
            stored: 0,
            retrieved: 0,
            deleted: 0,
            errors: 0,
            totalSize: 0,
          };

          resolve();
        };

        request.onerror = () => reject(request.error);
      });

      this.eventBus?.emit('storage:cleared', {
        provider: 'local',
      });
    } catch (error) {
      logger.error('Failed to clear storage:', error as Error);
    }
  }

  /**
   * Get storage info
   */
  async getStorageInfo(): Promise<{
    used: number;
    available?: number;
    quota?: number;
  }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();

        return {
          used: estimate.usage || this.metrics.totalSize,
          available: estimate.quota
            ? estimate.quota - (estimate.usage || 0)
            : undefined,
          quota: estimate.quota,
        };
      }

      // Fallback to metrics
      return {
        used: this.metrics.totalSize,
      };
    } catch {
      return {
        used: this.metrics.totalSize,
      };
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();

      // Wait for initialization
      let attempts = 0;
      while (!this.isInitialized && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (!this.isInitialized) {
        throw new Error('Failed to initialize LocalProvider');
      }
    }
  }

  /**
   * Check storage quota
   */
  private async checkStorageQuota(size: number): Promise<boolean> {
    const info = await this.getStorageInfo();

    if (info.quota) {
      return info.used + size < info.quota;
    }

    // Check against configured max size
    return this.metrics.totalSize + size < this.config.maxStorageSize;
  }

  /**
   * Calculate current storage size
   */
  private async calculateStorageSize(): Promise<void> {
    try {
      if (!this.db) throw new Error('Database not initialized');
      const transaction = this.db.transaction(
        [this.config.objectStoreName],
        'readonly',
      );
      const store = transaction.objectStore(this.config.objectStoreName);

      let totalSize = 0;

      await new Promise<void>((resolve) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            const object = cursor.value as LocalStorageObject;
            totalSize += object.size;
            cursor.continue();
          } else {
            this.metrics.totalSize = totalSize;
            resolve();
          }
        };

        request.onerror = () => resolve();
      });
    } catch (error) {
      logger.error('Failed to calculate storage size:', error as Error);
    }
  }

  /**
   * Store metadata in localStorage
   */
  private storeMetadata(path: string, metadata: Record<string, any>): void {
    try {
      const key = `${this.config.metadataPrefix}:${path}`;
      localStorage.setItem(key, JSON.stringify(metadata));
    } catch (error) {
      logger.warn('Failed to store metadata:', { error });
    }
  }

  /**
   * Get metadata from localStorage
   */
  private getMetadata(path: string): Record<string, any> | null {
    try {
      const key = `${this.config.metadataPrefix}:${path}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Delete metadata from localStorage
   */
  private deleteMetadata(path: string): void {
    try {
      const key = `${this.config.metadataPrefix}:${path}`;
      localStorage.removeItem(key);
    } catch (error) {
      logger.warn('Failed to delete metadata:', { error });
    }
  }

  /**
   * Clear all metadata
   */
  private clearAllMetadata(): void {
    const prefix = `${this.config.metadataPrefix}:`;
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(prefix),
    );
    keys.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Compress data (placeholder - would use real compression)
   */
  private async compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // In production, would use actual compression like pako
    // For now, just return original data
    return data;
  }

  /**
   * Decompress data (placeholder - would use real decompression)
   */
  private async decompressData(data: ArrayBuffer): Promise<ArrayBuffer> {
    // In production, would use actual decompression like pako
    // For now, just return original data
    return data;
  }

  /**
   * Get provider metrics (legacy)
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Record latency for performance tracking
   */
  private recordLatency(latencyMs: number): void {
    this.metrics.latencies.push(latencyMs);
    // Keep only the last N latencies
    if (this.metrics.latencies.length > this.LATENCY_WINDOW_SIZE) {
      this.metrics.latencies = this.metrics.latencies.slice(
        -this.LATENCY_WINDOW_SIZE,
      );
    }
  }

  /**
   * Calculate average latency from rolling window
   */
  private calculateAverageLatency(): number {
    if (this.metrics.latencies.length === 0) return 0;
    const sum = this.metrics.latencies.reduce((a, b) => a + b, 0);
    return sum / this.metrics.latencies.length;
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): LocalProviderMetrics {
    const totalRetrievals = this.metrics.hits + this.metrics.misses;
    const totalOps =
      this.metrics.stored + this.metrics.retrieved + this.metrics.deleted;

    return {
      hitRate: totalRetrievals > 0 ? this.metrics.hits / totalRetrievals : 0,
      missRate: totalRetrievals > 0 ? this.metrics.misses / totalRetrievals : 0,
      averageLatencyMs: this.calculateAverageLatency(),
      errorRate: totalOps > 0 ? this.metrics.errors / totalOps : 0,
      totalOperations: totalOps,
      totalBytes: this.metrics.totalSize,
      storeCount: this.metrics.stored,
      retrieveCount: this.metrics.retrieved,
      deleteCount: this.metrics.deleted,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      errors: this.metrics.errors,
    };
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
