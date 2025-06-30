/**
 * AdaptiveAudioStreamer Behavioral Test Suite
 * Story 2.4 Task 4.3: Comprehensive testing for adaptive streaming with progressive loading
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdaptiveAudioStreamer } from '../AdaptiveAudioStreamer.js';
import { SupabaseAssetClient } from '../SupabaseAssetClient.js';
import { AudioCompressionEngine } from '../../AudioCompressionEngine.js';
import {
  AdaptiveAudioStreamingConfig,
  AudioSampleMetadata,
  AudioSampleFormat,
  AudioSampleQualityProfile,
} from '@bassnotion/contracts';

// Mock dependencies
vi.mock('../SupabaseAssetClient.js');
vi.mock('../../AudioCompressionEngine.js');

// Mock Navigator Connection API
const mockConnection = {
  downlink: 2.5,
  effectiveType: '4g',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: mockConnection,
});

// Mock fetch for latency measurement
global.fetch = vi.fn().mockResolvedValue({ ok: true });

describe('AdaptiveAudioStreamer - Behavioral Tests', () => {
  let adaptiveStreamer: AdaptiveAudioStreamer;
  let mockStorageClient: any;
  let mockCompressionEngine: any;
  let defaultConfig: AdaptiveAudioStreamingConfig;
  let sampleMetadata: AudioSampleMetadata;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock storage client
    mockStorageClient = {
      downloadAsset: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    // Mock compression engine
    mockCompressionEngine = {
      compressAudio: vi.fn(),
    };

    // Mock constructors
    (SupabaseAssetClient as any).mockImplementation(() => mockStorageClient);
    vi.mocked(AudioCompressionEngine.getInstance).mockReturnValue(
      mockCompressionEngine,
    );

    // Default configuration
    defaultConfig = {
      enabled: true,
      enableQualityAdaptation: true,
      qualityLevels: [
        'studio',
        'performance',
        'practice',
        'preview',
        'mobile',
        'streaming',
      ] as AudioSampleQualityProfile[],
      adaptationStrategy: 'hybrid',
      enableProgressiveLoading: true,
      chunkSize: 64 * 1024,
      preloadChunks: 2,
      bufferSize: 5,
      enableFormatOptimization: true,
      preferredFormats: ['wav', 'mp3', 'ogg'] as AudioSampleFormat[],
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
    };

    // Sample metadata for testing
    sampleMetadata = {
      bucket: 'audio_samples',
      path: 'test/sample.wav',
      size: 10 * 1024 * 1024,
      downloadTime: 0,
      source: 'supabase-storage',
      duration: 60,
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      bitRate: 1411,
      format: 'wav',
      category: 'bass_notes',
      tags: ['test', 'bass'],
      qualityProfile: 'performance',
      isProcessed: false,
      playCount: 0,
      popularityScore: 0.5,
      peakAmplitude: 0.8,
      rmsLevel: 0.3,
      dynamicRange: 60,
      customProperties: {},
    };

    // Create streamer instance
    adaptiveStreamer = new AdaptiveAudioStreamer(
      defaultConfig,
      mockStorageClient,
      mockCompressionEngine,
    );
  });

  afterEach(async () => {
    await adaptiveStreamer.cleanup();
    vi.clearAllTimers();
  });

  describe('Core Streaming Behavior', () => {
    it('should initialize successfully', async () => {
      await expect(adaptiveStreamer.initialize()).resolves.not.toThrow();
    });

    it('should handle basic streaming requests', async () => {
      const _mockArrayBuffer = new ArrayBuffer(sampleMetadata.size);
      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
      });

      const result = await adaptiveStreamer.streamSample(
        'test-sample',
        sampleMetadata,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle streaming failures gracefully', async () => {
      mockStorageClient.downloadAsset.mockRejectedValue(
        new Error('Network timeout'),
      );

      const result = await adaptiveStreamer.streamSample(
        'test-sample-failure',
        sampleMetadata,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Network timeout');
    });

    it('should use progressive loading for large files', async () => {
      const largeFileMetadata = {
        ...sampleMetadata,
        size: 20 * 1024 * 1024, // 20MB
        duration: 300,
      };

      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: {
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(64 * 1024)),
        },
      });

      const result = await adaptiveStreamer.streamSample(
        'test-large-file',
        largeFileMetadata,
        { preferredQuality: 'performance' },
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
    });

    it('should adapt quality based on network conditions', async () => {
      // Simulate good network conditions
      mockConnection.downlink = 3; // 3 Mbps

      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
      });

      const result = await adaptiveStreamer.streamSample(
        'test-quality-adaptation',
        sampleMetadata,
      );

      expect(result.success).toBe(true);
      expect(result.finalQuality).toBeDefined();
    });

    it('should handle format optimization when enabled', async () => {
      mockCompressionEngine.compressAudio.mockResolvedValue({
        success: true,
        outputBuffer: new ArrayBuffer(sampleMetadata.size * 0.8),
        compressionRatio: 0.8,
        actualBitrate: 256,
        processingTime: 300,
        qualityScore: 0.85,
        compressionMetrics: {
          originalSize: sampleMetadata.size,
          compressedSize: sampleMetadata.size * 0.8,
          compressionRatio: 0.8,
          processingTime: 300,
          cpuUsage: 0.25,
          memoryUsage: 40 * 1024 * 1024,
          qualityRetention: 0.85,
          algorithmEfficiency: 0.75,
          deviceOptimizationScore: 0.8,
        },
      });

      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
      });

      const result = await adaptiveStreamer.streamSample(
        'test-compression',
        sampleMetadata,
        { enableOptimization: true },
      );

      expect(result.success).toBe(true);
      expect(result.compressionSavings).toBeGreaterThanOrEqual(0);
    });

    it('should track active sessions', async () => {
      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
      });

      const streamPromise = adaptiveStreamer.streamSample(
        'test-session-tracking',
        sampleMetadata,
      );

      // Check that session is tracked
      const activeSessions = adaptiveStreamer.getActiveSessions();
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0]?.sampleId).toBe('test-session-tracking');

      await streamPromise;

      // Session should be cleaned up after completion
      const finalSessions = adaptiveStreamer.getActiveSessions();
      expect(finalSessions.length).toBe(0);
    });

    it('should collect performance metrics', async () => {
      mockStorageClient.downloadAsset.mockResolvedValue({
        success: true,
        data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)) },
      });

      const result = await adaptiveStreamer.streamSample(
        'test-metrics',
        sampleMetadata,
      );

      expect(result.success).toBe(true);
      expect(result.performance).toMatchObject({
        averageChunkLoadTime: expect.any(Number),
        totalBufferTime: expect.any(Number),
        networkUtilization: expect.any(Number),
        qualityStability: expect.any(Number),
        bufferUnderruns: expect.any(Number),
        formatOptimizationSavings: expect.any(Number),
      });
    });

    it('should clean up resources properly', async () => {
      await adaptiveStreamer.initialize();
      await adaptiveStreamer.cleanup();

      expect(adaptiveStreamer.getActiveSessions()).toHaveLength(0);
      expect(adaptiveStreamer.getPerformanceMetrics('any-id')).toBeNull();
    });
  });
});
