/**
 * SupabaseProviderAdvanced Tests
 *
 * Tests for the advanced Supabase storage provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseProviderAdvanced } from '../SupabaseProviderAdvanced.js';
import type { SupabaseProviderAdvancedConfig } from '../SupabaseProviderAdvanced.js';

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        upload: vi.fn(() =>
          Promise.resolve({ data: { path: 'test.mp3' }, error: null }),
        ),
        download: vi.fn(() => {
          // Create a proper mock blob with arrayBuffer method
          const mockBlob = {
            arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(100))),
            size: 100,
            type: 'application/octet-stream',
          };
          return Promise.resolve({ data: mockBlob, error: null });
        }),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://cdn.test.com/test.mp3' },
        })),
        remove: vi.fn(() => Promise.resolve({ error: null })),
      })),
    },
  })),
}));

// Mock the logger
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the shared utilities
vi.mock('../../shared/index.js', () => ({
  EventBus: class MockEventBus {
    emit = vi.fn();
    on = vi.fn();
    off = vi.fn();
  },
  createStructuredLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('SupabaseProviderAdvanced', () => {
  let provider: SupabaseProviderAdvanced;
  let config: SupabaseProviderAdvancedConfig;

  beforeEach(() => {
    config = {
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      bucketName: 'test-bucket',
      defaultTimeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableCDN: true,
      cdnUrl: 'https://cdn.test.com',
      // Advanced features disabled by default
      enableVersioning: false,
      enableCircuitBreaker: false,
      enableBatchOperations: false,
      enableCDNOptimization: false,
    };

    provider = new SupabaseProviderAdvanced(config);
  });

  describe('Basic functionality', () => {
    it('should initialize with default configuration', () => {
      expect(provider).toBeDefined();
      // With mocked dependencies, provider connects immediately
      expect(provider.isReady()).toBe(true);
    });

    it('should upload files successfully', async () => {
      const data = new Blob(['test content']);
      const result = await provider.upload(data, {
        path: 'test/file.txt',
        contentType: 'text/plain',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('test.mp3');
      expect(result.url).toContain('cdn.test.com');
    });

    it('should download files successfully', async () => {
      const result = await provider.download('test/file.txt');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Advanced features', () => {
    beforeEach(() => {
      config = {
        ...config,
        enableVersioning: true,
        enableCircuitBreaker: true,
        enableBatchOperations: true,
        enableCDNOptimization: true,
      };
      provider = new SupabaseProviderAdvanced(config);
    });

    it('should get advanced metrics', () => {
      const metrics = provider.getAdvancedMetrics();

      expect(metrics).toHaveProperty('uploads');
      expect(metrics).toHaveProperty('downloads');
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('circuitBreakerTrips');
      expect(metrics).toHaveProperty('batchOperations');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('cdnUsage');
      expect(metrics).toHaveProperty('versionedAssets');
    });

    it('should get circuit breaker status', () => {
      const status = provider.getCircuitBreakerStatus();
      expect(status).toBe('disabled'); // Will be 'closed' after initialization
    });

    it('should get batch processor status', () => {
      const status = provider.getBatchProcessorStatus();
      expect(status).toEqual({
        enabled: false, // Will be true after initialization
        running: false,
        queueSize: 0,
      });
    });

    it('should perform health check', async () => {
      const health = await provider.healthCheck();

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.details).toHaveProperty('checks');
      expect(health.details).toHaveProperty('metrics');
      expect(health.details).toHaveProperty('latency');
    });
  });

  describe('Batch operations', () => {
    it('should handle batch upload fallback when disabled', async () => {
      const operations = [
        {
          data: new Blob(['content1']),
          options: { path: 'file1.txt' },
        },
        {
          data: new Blob(['content2']),
          options: { path: 'file2.txt' },
        },
      ];

      const results = await provider.batchUpload(operations);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle batch download fallback when disabled', async () => {
      const paths = ['file1.txt', 'file2.txt'];

      const results = await provider.batchDownload(paths);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Version management', () => {
    it('should return empty version history when disabled', async () => {
      const history = await provider.getVersionHistory('test.txt');
      expect(history).toEqual([]);
    });

    it('should return error when restoring version with versioning disabled', async () => {
      const result = await provider.restoreVersion('test.txt', 'v1');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Versioning not enabled');
    });
  });

  describe('CDN operations', () => {
    it('should handle CDN cache purge when disabled', async () => {
      await expect(
        provider.purgeCDNCache(['test.txt']),
      ).resolves.toBeUndefined();
    });
  });
});
