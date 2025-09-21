/**
 * AudioSampleManager Migration Tests
 *
 * Tests to verify that AudioSampleManager works correctly with
 * the new SupabaseProviderAdvanced storage modules
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioSampleManager } from '../AudioSampleManager.js';
import type { AudioSampleManagerConfig } from '@bassnotion/contracts';

// Mock the storage provider module
vi.mock('../../../modules/storage/providers/index.js', () => ({
  createSupabaseProviderAdvanced: vi.fn(() => ({
    // Note: initialize doesn't exist on the real implementation, but AudioSampleManagerAdapter calls it
    initialize: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue({
      success: true,
      data: new ArrayBuffer(1024),
      size: 1024,
    }),
    upload: vi.fn((data, options) => {
      return Promise.resolve({
        success: true,
        url: 'https://test.com/sample.wav',
        path: options?.path || 'samples/test.wav',
        size: data instanceof ArrayBuffer ? data.byteLength : 1024,
        metadata: options?.metadata,
      });
    }),
    delete: vi.fn().mockResolvedValue({
      success: true,
    }),
    batchDownload: vi.fn().mockImplementation((paths) =>
      paths.map((path: string) => ({
        success: true,
        data: new ArrayBuffer(1024),
        size: 1024,
        path,
      })),
    ),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      details: {
        checks: {
          storage: true,
          cdn: true,
          versioning: true,
          circuitBreaker: true,
          batchProcessor: true,
        },
        metrics: {
          uploads: 10,
          downloads: 50,
          cacheHits: 30,
          cacheMisses: 20,
        },
      },
    }),
    getMetrics: vi.fn().mockReturnValue({
      uploads: 10,
      downloads: 50,
      errors: 2,
    }),
    getAdvancedMetrics: vi.fn().mockReturnValue({
      uploads: 10,
      downloads: 50,
      cacheHits: 30,
      cacheMisses: 20,
      circuitBreakerTrips: 0,
      batchOperations: 5,
      averageLatency: 150,
      cdnUsage: 45,
      versionedAssets: 12,
    }),
    getCircuitBreakerStatus: vi.fn().mockReturnValue('closed'),
    getBatchProcessorStatus: vi.fn().mockReturnValue({
      enabled: true,
      running: false,
      queueSize: 0,
    }),
    // Base SupabaseProvider methods
    exists: vi.fn().mockResolvedValue(true),
    getPublicUrl: vi.fn(
      (path) =>
        `https://test.supabase.co/storage/v1/object/public/test-bucket/${path}`,
    ),
    createSignedUrl: vi.fn().mockResolvedValue({ url: 'https://signed.url' }),
    move: vi.fn().mockResolvedValue({ success: true }),
    copy: vi.fn().mockResolvedValue({ success: true }),
    isReady: vi.fn(() => true),
    updateConfig: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    dispose: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock SampleLoader
vi.mock('../../../modules/storage/loaders/SampleLoader.js', () => ({
  SampleLoader: vi.fn().mockImplementation(() => ({
    loadSample: vi.fn().mockImplementation((sampleId) => {
      // Return failure for non-existent samples
      if (sampleId.includes('non-existent')) {
        return Promise.resolve({
          success: false,
          error: new Error('Sample not found'),
          errorCode: 'NOT_FOUND',
        });
      }
      return Promise.resolve({
        success: true,
        data: new ArrayBuffer(1024),
        size: 1024,
        format: 'wav',
        quality: 'high',
        fromCache: false,
      });
    }),
    preloadSamples: vi.fn().mockResolvedValue(new Map()),
    cancelLoading: vi.fn(),
  })),
}));

// Mock SampleCache
vi.mock('../../../modules/storage/cache/SampleCache.js', () => ({
  SampleCache: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
    delete: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    getStats: vi.fn(() => ({
      size: 0,
      items: 0,
      hitRate: 0,
      evictionCount: 0,
    })),
  })),
}));

// Mock EventBus
vi.mock('../../../modules/shared/index.js', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

// Mock other dependencies
vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: () => ({
    correlationId: 'test-correlation-id',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }),
}));

vi.mock('../core/index.js', () => ({
  ServiceRegistry: {
    get: vi.fn(() => ({
      getContext: () => new AudioContext(),
    })),
  },
  AudioEngine: vi.fn(),
}));

describe('AudioSampleManager with SupabaseProviderAdvanced', () => {
  let audioSampleManager: AudioSampleManager;
  let config: AudioSampleManagerConfig;

  beforeEach(() => {
    config = {
      storageClientConfig: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
        bucketName: 'test-bucket',
      },
      cacheConfig: {
        enabled: true,
        maxSize: 100 * 1024 * 1024,
        ttl: 3600000,
        persistentCache: false,
      },
      supportedFormats: ['wav', 'mp3', 'ogg'],
      streamingConfig: {
        enabled: false,
        chunkSize: 64 * 1024,
        preloadSize: 128 * 1024,
      },
      enableFormatConversion: false,
      predictiveLoadingEnabled: false,
      enableBackgroundProcessing: false,
      analyticsConfig: {
        enabled: false,
      },
      libraryConfig: {
        libraryId: 'default',
        name: 'Default Library',
        description: 'Default sample library',
      },
      defaultQualityProfile: 'practice',
      qualityAdaptationStrategy: 'automatic',
    };

    // Reset singleton instance
    AudioSampleManager.resetInstance();
    audioSampleManager = AudioSampleManager.getInstance(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Storage Provider Integration', () => {
    it('should initialize with SupabaseProviderAdvanced', async () => {
      await audioSampleManager.initialize();
      expect(audioSampleManager).toBeDefined();
    });

    it('should use storage provider for downloading samples', async () => {
      await audioSampleManager.initialize();

      // Add a sample to library for testing
      const library = await audioSampleManager.getLibrary('default');
      if (library) {
        library.samples.push({
          bucket: 'test-bucket',
          path: 'samples/test.wav',
          size: 1024,
          downloadTime: 0,
          source: 'supabase-storage',
          duration: 5,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          bitRate: 128,
          format: 'wav',
          category: 'instrument_samples',
          tags: ['test'],
          qualityProfile: 'practice',
          isProcessed: false,
          playCount: 0,
          popularityScore: 0,
          peakAmplitude: 0.8,
          rmsLevel: 0.3,
          dynamicRange: 60,
          customProperties: {},
        });
      }

      const result = await audioSampleManager.loadSample('test');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.size).toBe(1024);
      expect(result.source).toBe('storage');
    });

    it('should use storage provider for uploading samples', async () => {
      await audioSampleManager.initialize();

      const sampleData = new ArrayBuffer(1024);
      const metadata = {
        format: 'wav' as const,
        category: 'instrument_samples' as const,
        tags: ['test'],
      };

      const result = await audioSampleManager.saveSample(sampleData, metadata);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('save');
    });

    it('should use storage provider for deleting samples', async () => {
      await audioSampleManager.initialize();

      // Add a sample to library for testing
      const library = await audioSampleManager.getLibrary('default');
      if (library) {
        library.samples.push({
          bucket: 'test-bucket',
          path: 'samples/test.wav',
          size: 1024,
          downloadTime: 0,
          source: 'supabase-storage',
          duration: 5,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          bitRate: 128,
          format: 'wav',
          category: 'instrument_samples',
          tags: ['test'],
          qualityProfile: 'practice',
          isProcessed: false,
          playCount: 0,
          popularityScore: 0,
          peakAmplitude: 0.8,
          rmsLevel: 0.3,
          dynamicRange: 60,
          customProperties: {},
        });
      }

      const result = await audioSampleManager.deleteSample('test');

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete');
    });
  });

  describe('Advanced Features', () => {
    it('should use batch operations for loading multiple samples', async () => {
      await audioSampleManager.initialize();

      // Add samples to library for testing
      const library = await audioSampleManager.getLibrary('default');
      if (library) {
        ['test1', 'test2', 'test3'].forEach((id) => {
          library.samples.push({
            bucket: 'test-bucket',
            path: `samples/${id}.wav`,
            size: 1024,
            downloadTime: 0,
            source: 'supabase-storage',
            duration: 5,
            sampleRate: 44100,
            bitDepth: 16,
            channels: 2,
            bitRate: 128,
            format: 'wav',
            category: 'instrument_samples',
            tags: ['test'],
            qualityProfile: 'practice',
            isProcessed: false,
            playCount: 0,
            popularityScore: 0,
            peakAmplitude: 0.8,
            rmsLevel: 0.3,
            dynamicRange: 60,
            customProperties: {},
          });
        });
      }

      const results = await audioSampleManager.batchLoadSamples([
        'test1',
        'test2',
        'test3',
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.source === 'storage')).toBe(true);
    });

    it('should get storage health status', async () => {
      await audioSampleManager.initialize();

      const health = await audioSampleManager.getStorageHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.checks).toBeDefined();
      expect(health.details.checks.storage).toBe(true);
      expect(health.details.checks.cdn).toBe(true);
      expect(health.details.checks.versioning).toBe(true);
      expect(health.details.checks.circuitBreaker).toBe(true);
      expect(health.details.checks.batchProcessor).toBe(true);
    });

    it('should get storage metrics', async () => {
      await audioSampleManager.initialize();

      const metrics = audioSampleManager.getStorageMetrics();

      expect(metrics.basic).toBeDefined();
      expect(metrics.basic.uploads).toBe(10);
      expect(metrics.basic.downloads).toBe(50);

      expect(metrics.advanced).toBeDefined();
      expect(metrics.advanced.cacheHits).toBe(30);
      expect(metrics.advanced.cacheMisses).toBe(20);
      expect(metrics.advanced.circuitBreakerTrips).toBe(0);
      expect(metrics.advanced.batchOperations).toBe(5);
      expect(metrics.advanced.averageLatency).toBe(150);
      expect(metrics.advanced.cdnUsage).toBe(45);
      expect(metrics.advanced.versionedAssets).toBe(12);

      expect(metrics.circuitBreaker).toBe('closed');
      expect(metrics.batchProcessor.enabled).toBe(true);
      expect(metrics.batchProcessor.running).toBe(false);
      expect(metrics.batchProcessor.queueSize).toBe(0);
    });
  });

  describe('Migration Validation', () => {
    it('should maintain backward compatibility', async () => {
      await audioSampleManager.initialize();

      // Test that all public methods still work
      expect(typeof audioSampleManager.loadSample).toBe('function');
      expect(typeof audioSampleManager.saveSample).toBe('function');
      expect(typeof audioSampleManager.deleteSample).toBe('function');
      expect(typeof audioSampleManager.convertSample).toBe('function');
      expect(typeof audioSampleManager.searchSamples).toBe('function');
      expect(typeof audioSampleManager.getLibrary).toBe('function');
      expect(typeof audioSampleManager.getCacheStatistics).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      await audioSampleManager.initialize();

      // Test with non-existent sample
      const result = await audioSampleManager.loadSample('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('LOAD_FAILED');
    });
  });
});
