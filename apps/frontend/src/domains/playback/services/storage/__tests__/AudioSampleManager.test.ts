/**
 * AudioSampleManager Test Suite
 * Comprehensive testing for professional audio sample management
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioSampleManager } from '../AudioSampleManager.js';
import { SupabaseAssetClient } from '../SupabaseAssetClient.js';
import { PredictiveLoadingEngine } from '../PredictiveLoadingEngine.js';
import {
  AudioSampleManagerConfig,
  AudioSampleFormat,
  AudioSampleQualityProfile,
  AudioSampleCategory,
} from '@bassnotion/contracts';

// Mock dependencies
vi.mock('../SupabaseAssetClient.js');
vi.mock('../PredictiveLoadingEngine.js');

// Mock Web Audio API - Global mock that the test can access
let mockAudioContext: any;

const createMockAudioContext = () => ({
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  sampleRate: 44100,
  currentTime: 1.234567,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// Reset and create fresh mock before each test
const resetAudioContextMock = () => {
  mockAudioContext = createMockAudioContext();
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: vi.fn().mockImplementation(() => mockAudioContext),
  });
  return mockAudioContext;
};

// Mock document events to prevent timeout issues
const mockDocumentAddEventListener = vi.fn();
const mockDocumentRemoveEventListener = vi.fn();

// Setup global document mocks
Object.defineProperty(global, 'document', {
  value: {
    addEventListener: mockDocumentAddEventListener,
    removeEventListener: mockDocumentRemoveEventListener,
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({
      id: 'test-element',
      appendChild: vi.fn(),
      setAttribute: vi.fn(),
    })),
    getElementById: vi.fn(() => null),
  },
  writable: true,
});

// Ensure window is also properly mocked
Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    AudioContext: vi.fn(),
    webkitAudioContext: vi.fn(),
  },
  writable: true,
});

describe('AudioSampleManager', () => {
  let audioSampleManager: AudioSampleManager;
  let mockStorageClient: any;
  let defaultConfig: AudioSampleManagerConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset AudioContext mock for each test
    resetAudioContextMock();

    // Create mock storage client
    mockStorageClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
      downloadAsset: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
      runCleanup: vi.fn().mockResolvedValue(undefined),
    };

    // Mock constructors
    (SupabaseAssetClient as any).mockImplementation(() => mockStorageClient);
    (PredictiveLoadingEngine as any).mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    }));

    // Default configuration
    defaultConfig = {
      enabled: true,
      maxConcurrentOperations: 10,
      operationTimeout: 30000,
      enableMultipleLibraries: false,
      maxLibraries: 5,
      cdnOptimizationEnabled: false,
      predictiveLoadingEnabled: false,
      enableQualityAdaptation: true,
      qualityAdaptationStrategy: 'automatic',
      preferredFormat: 'wav',
      enableFormatConversion: true,
      enableBackgroundProcessing: true,
      backgroundProcessingPriority: 'medium',
      enableBatchOperations: true,
      batchSize: 10,
      enableErrorRecovery: true,
      maxRetryAttempts: 3,
      retryBackoffMs: 1000,
      enableContentValidation: true,
      enableVirusScanning: false,
      enableCopyrightCheck: false,
      storageClientConfig: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
        retryAttempts: 3,
        retryBackoffMs: 1000,
      },
      supportedFormats: ['wav', 'mp3', 'ogg', 'flac'] as AudioSampleFormat[],
      defaultQualityProfile: 'practice' as AudioSampleQualityProfile,
      libraryConfig: {
        libraryId: 'default',
        name: 'Default Library',
        description: 'Default audio sample library',
        version: '1.0.0',
        categories: ['bass_notes', 'drum_hits'] as AudioSampleCategory[],
        tags: ['test'],
        defaultQualityProfile: 'practice' as AudioSampleQualityProfile,
        isPublic: false,
        accessLevel: 'free',
        maxSamples: 10000,
        allowUserUploads: false,
        moderationRequired: false,
        autoTagging: false,
        minSampleRate: 44100,
        maxFileSize: 100 * 1024 * 1024,
        allowedFormats: ['wav', 'mp3'] as AudioSampleFormat[],
        qualityThresholds: {
          minBitRate: 128,
          minDynamicRange: 20,
          maxNoiseFloor: -60,
          minDuration: 0.1,
          maxDuration: 600,
        },
        trackUsage: true,
        collectRatings: true,
        enableRecommendations: true,
      },
      streamingConfig: {
        enabled: true,
        enableQualityAdaptation: true,
        qualityLevels: [
          'practice',
          'performance',
        ] as AudioSampleQualityProfile[],
        adaptationStrategy: 'hybrid',
        enableProgressiveLoading: true,
        chunkSize: 64 * 1024,
        preloadChunks: 2,
        bufferSize: 5,
        enableFormatOptimization: true,
        preferredFormats: ['wav', 'mp3'] as AudioSampleFormat[],
        fallbackFormats: ['mp3', 'ogg'] as AudioSampleFormat[],
        enableTranscoding: false,
        bandwidthThresholds: {
          excellent: 5000,
          good: 2000,
          fair: 1000,
          poor: 500,
        },
        latencyThresholds: {
          excellent: 50,
          good: 100,
          fair: 200,
          poor: 500,
        },
        enableNetworkMonitoring: true,
        enableStreamingCache: true,
        cacheSize: 50 * 1024 * 1024,
        cacheTTL: 3600000,
        maxConcurrentStreams: 3,
        streamTimeout: 30000,
        retryAttempts: 3,
        enableMetrics: true,
      },
      cacheConfig: {
        enabled: true,
        maxCacheSize: 100 * 1024 * 1024,
        maxSamples: 1000,
        reservedSpace: 10 * 1024 * 1024,
        evictionStrategy: 'lru',
        evictionThreshold: 0.8,
        trackUsagePatterns: true,
        usageHistoryWindow: 3600000,
        popularityWeight: 0.6,
        recencyWeight: 0.4,
        enablePredictiveCaching: false,
        predictionConfidenceThreshold: 0.7,
        maxPredictiveCacheSize: 20 * 1024 * 1024,
        enableQualityOptimization: true,
        cacheMultipleQualities: false,
        preferredQualityProfile: 'practice' as AudioSampleQualityProfile,
        enableBackgroundOptimization: true,
        optimizationInterval: 60000,
        enableCompression: false,
        compressionLevel: 'medium',
        enableAnalytics: true,
        metricsRetentionPeriod: 86400000,
      },
      analyticsConfig: {
        enabled: true,
        trackPlayback: true,
        trackUserInteractions: true,
        trackPerformanceMetrics: true,
        trackQualityMetrics: true,
        enableQualityMonitoring: true,
        qualityCheckInterval: 60000,
        qualityThresholds: {
          minAudioQuality: 0.7,
          maxLatency: 5000,
          minSuccessRate: 0.95,
          maxErrorRate: 0.05,
        },
        enablePerformanceMonitoring: true,
        performanceMetricsInterval: 30000,
        performanceThresholds: {
          maxLoadTime: 5000,
          minThroughput: 100000,
          maxMemoryUsage: 100 * 1024 * 1024,
          maxCpuUsage: 0.8,
        },
        enableUsageAnalytics: true,
        usageTrackingInterval: 30000,
        sessionTrackingEnabled: true,
        enableReporting: true,
        reportingInterval: 300000,
        reportRetentionPeriod: 2592000000,
        enableAlerts: true,
        alertThresholds: {
          qualityDegradation: 0.2,
          performanceDegradation: 0.3,
          errorRateIncrease: 0.1,
          usageAnomalies: 0.5,
        },
        alertChannels: ['console'],
      },
    };

    audioSampleManager = new AudioSampleManager(defaultConfig);
  });

  afterEach(async () => {
    if (audioSampleManager) {
      await audioSampleManager.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(audioSampleManager.initialize()).resolves.not.toThrow();
      expect(mockStorageClient.initialize).toHaveBeenCalledOnce();
    });

    it('should initialize audio context', async () => {
      await audioSampleManager.initialize();
      expect(window.AudioContext).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await audioSampleManager.initialize();
      await audioSampleManager.initialize();
      expect(mockStorageClient.initialize).toHaveBeenCalledOnce();
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageClient.initialize.mockRejectedValue(
        new Error('Storage init failed'),
      );

      await expect(audioSampleManager.initialize()).rejects.toThrow(
        'Failed to initialize AudioSampleManager: Storage init failed',
      );
    });
  });

  describe('Sample Loading', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should handle sample not found error', async () => {
      const result = await audioSampleManager.loadSample('non-existent-sample');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('LOAD_FAILED');
      expect(result.errorMessage).toContain('Sample not found');
    });

    it('should load sample with proper operation tracking', async () => {
      const sampleId = 'test-sample';
      const result = await audioSampleManager.loadSample(sampleId);

      expect(result.sampleId).toBe(sampleId);
      expect(result.operation).toBe('load');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.timestamp).toBe('number');
    });
  });

  describe('Sample Saving', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should save sample successfully', async () => {
      const sampleData = new ArrayBuffer(2048);
      const metadata = {
        format: 'wav' as AudioSampleFormat,
        category: 'bass_notes' as AudioSampleCategory,
        duration: 5.0,
        tags: ['test', 'bass'],
      };

      const result = await audioSampleManager.saveSample(sampleData, metadata);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('save');
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.format).toBe('wav');
    });

    it('should reject empty sample data', async () => {
      const emptyData = new ArrayBuffer(0);
      const metadata = { format: 'wav' as AudioSampleFormat };

      const result = await audioSampleManager.saveSample(emptyData, metadata);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Invalid sample data');
    });
  });

  describe('Sample Deletion', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should delete sample successfully', async () => {
      const sampleId = 'delete-sample';
      const result = await audioSampleManager.deleteSample(sampleId);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete');
      expect(mockStorageClient.runCleanup).toHaveBeenCalledWith('orphaned');
    });
  });

  describe('Format Conversion', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should handle conversion of non-existent sample', async () => {
      const result = await audioSampleManager.convertSample(
        'non-existent',
        'mp3',
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CONVERSION_FAILED');
    });
  });

  describe('Sample Search', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should return empty results for no matches', async () => {
      const results = await audioSampleManager.searchSamples({
        category: 'vocal_samples',
      });

      expect(results).toHaveLength(0);
    });

    it('should search by category', async () => {
      const results = await audioSampleManager.searchSamples({
        category: 'bass_notes',
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should provide cache statistics', () => {
      const stats = audioSampleManager.getCacheStatistics();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('evictionCount');
      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
    });
  });

  describe('Analytics', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should return null for non-existent sample analytics', async () => {
      const analytics =
        await audioSampleManager.getSampleAnalytics('non-existent');
      expect(analytics).toBeNull();
    });
  });

  describe('Library Management', () => {
    beforeEach(async () => {
      await audioSampleManager.initialize();
    });

    it('should return default library', async () => {
      const library = await audioSampleManager.getLibrary('default');

      expect(library).toBeDefined();
      expect(library?.config.libraryId).toBe('default');
      expect(library?.samples).toBeInstanceOf(Array);
      expect(library?.statistics).toBeDefined();
    });

    it('should return null for non-existent library', async () => {
      const library = await audioSampleManager.getLibrary('non-existent');
      expect(library).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      await audioSampleManager.initialize();
      await audioSampleManager.cleanup();

      expect(mockStorageClient.dispose).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', async () => {
      await expect(audioSampleManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle audio context initialization failure gracefully', async () => {
      // Mock AudioContext to throw error
      (window.AudioContext as any).mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });

      const manager = new AudioSampleManager(defaultConfig);
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should handle storage client errors gracefully', async () => {
      mockStorageClient.initialize.mockRejectedValue(
        new Error('Storage error'),
      );

      await expect(audioSampleManager.initialize()).rejects.toThrow();
    });
  });
});
