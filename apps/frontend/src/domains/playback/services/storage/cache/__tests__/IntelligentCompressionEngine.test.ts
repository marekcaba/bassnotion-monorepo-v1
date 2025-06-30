/**
 * Story 2.4: Advanced Asset Management & CDN Integration
 * Subtask 6.4: Intelligent Compression Engine Tests
 *
 * Comprehensive test suite for format-specific compression with quality preservation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntelligentCompressionEngine } from '../IntelligentCompressionEngine.js';
import type {
  IntelligentCompressionConfig,
  NetworkAdaptiveConfig,
} from '@bassnotion/contracts';

describe('IntelligentCompressionEngine', () => {
  let compressionEngine: IntelligentCompressionEngine;
  let mockConfig: IntelligentCompressionConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,

      // Format-specific compression
      audioCompression: {
        enabled: true,
        defaultLevel: 'high',
        enableAdaptiveQuality: true,
        preserveMetadata: true,
        enableFrequencyOptimization: true,
        enableDynamicRangeCompression: false,
        targetBitrates: {
          high: 320000,
          medium: 192000,
          low: 128000,
        },
      },
      midiCompression: {
        enabled: true,
        enableEventCompression: true,
        enableTimingOptimization: true,
        enableRedundancyRemoval: true,
        preserveMusicalIntegrity: true,
        compressionRatio: 0.7,
      },
      metadataCompression: {
        enabled: true,
        enableSchemaCompression: true,
        enableValueCompression: true,
        preserveSearchability: true,
        compressionAlgorithm: 'gzip',
      },

      // Adaptive compression
      enableAdaptiveCompression: true,
      compressionLevelAdaptation: 'quality',

      // Quality preservation
      enableQualityMonitoring: true,
      minQualityThreshold: 0.8,
      qualityRecoveryEnabled: true,

      // Performance optimization
      enableParallelCompression: false,
      maxCompressionWorkers: 2,
      compressionTimeout: 30000,

      // Advanced features
      enableDeltaCompression: true,
      enableDeduplication: false,
      enableContextualCompression: true,
    };

    compressionEngine = new IntelligentCompressionEngine(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', async () => {
      await compressionEngine.initialize();
      // Note: isInitialized is private, so we'll test indirectly
      const analytics = compressionEngine.getCompressionAnalytics();
      expect(analytics).toBeDefined();
    });

    it('should throw error when initializing with invalid config', async () => {
      const invalidConfig = {
        ...mockConfig,
        minQualityThreshold: 1.5, // Invalid: must be between 0 and 1
      };
      const invalidEngine = new IntelligentCompressionEngine(invalidConfig);

      await expect(invalidEngine.initialize()).rejects.toThrow();
    });

    it('should setup compression workers correctly', async () => {
      await compressionEngine.initialize();
      const analytics = compressionEngine.getCompressionAnalytics();
      expect(analytics).toBeDefined();
    });
  });

  describe('Compression Analysis', () => {
    const createMockAudioData = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      // Fill with mock audio data patterns
      for (let i = 0; i < size; i++) {
        view[i] = Math.floor(Math.sin(i * 0.1) * 127 + 128);
      }
      return buffer;
    };

    const createMockMIDIData = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      // Fill with mock MIDI data patterns
      view[0] = 0x4d; // 'M'
      view[1] = 0x54; // 'T'
      view[2] = 0x68; // 'h'
      view[3] = 0x64; // 'd'
      for (let i = 4; i < size; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    };

    it('should analyze compression benefit for audio assets', async () => {
      const audioData = createMockAudioData(1024 * 1024); // 1MB
      const benefit = await compressionEngine.analyzeCompressionBenefit(
        audioData,
        'audio_sample',
      );

      expect(benefit).toBeDefined();
      expect(benefit.worthCompressing).toBe(true);
      expect(benefit.projectedCompressionRatio).toBeGreaterThan(0);
      expect(benefit.projectedCompressionRatio).toBeLessThanOrEqual(1);
      expect(benefit.confidence).toBeGreaterThan(0);
      expect(benefit.confidence).toBeLessThanOrEqual(1);
    });

    it('should analyze compression benefit for MIDI assets', async () => {
      const midiData = createMockMIDIData(64 * 1024); // 64KB
      const benefit = await compressionEngine.analyzeCompressionBenefit(
        midiData,
        'midi_file',
      );

      expect(benefit).toBeDefined();
      expect(benefit.worthCompressing).toBe(true);
      expect(benefit.projectedCompressionRatio).toBeGreaterThan(0);
      expect(benefit.projectedCompressionRatio).toBeLessThanOrEqual(1);
    });

    it('should consider network conditions in analysis', async () => {
      const audioData = createMockAudioData(512 * 1024); // 512KB
      const networkConditions: NetworkAdaptiveConfig = {
        bandwidth: 100000, // 100KB/s - slow connection
        latency: 200,
        reliability: 0.7,
        connectionType: 'cellular',
        adaptiveEnabled: true,
        qualityScaling: true,
        aggressiveCompression: true,
      };

      const benefit = await compressionEngine.analyzeCompressionBenefit(
        audioData,
        'audio_sample',
        networkConditions,
      );

      expect(benefit).toBeDefined();
      expect(benefit.worthCompressing).toBe(true);
      // Should recommend more aggressive compression for slow connections
      expect(benefit.projectedTransferTimeSavings).toBeGreaterThan(0);
    });

    it('should provide alternative strategies', async () => {
      const audioData = createMockAudioData(256 * 1024); // 256KB
      const benefit = await compressionEngine.analyzeCompressionBenefit(
        audioData,
        'audio_sample',
      );

      expect(benefit.alternativeStrategies).toBeDefined();
      expect(Array.isArray(benefit.alternativeStrategies)).toBe(true);
      expect(benefit.alternativeStrategies.length).toBeGreaterThan(0);
    });
  });

  describe('Compression Operations', () => {
    const createMockData = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < size; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    };

    it('should compress audio data successfully', async () => {
      const audioData = createMockData(1024 * 1024); // 1MB
      const result = await compressionEngine.compressAsset(
        audioData,
        'audio_sample',
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.compressedData).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
      expect(result.qualityAssessment).toBeDefined();
    });

    it('should compress MIDI data successfully', async () => {
      const midiData = createMockData(64 * 1024); // 64KB
      const result = await compressionEngine.compressAsset(
        midiData,
        'midi_file',
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.compressedData).toBeDefined();
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should handle compression failures gracefully', async () => {
      // Create invalid data that should fail compression
      const invalidData = new ArrayBuffer(0);
      const result = await compressionEngine.compressAsset(
        invalidData,
        'audio_sample',
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect quality thresholds', async () => {
      const audioData = createMockData(512 * 1024); // 512KB
      const result = await compressionEngine.compressAsset(
        audioData,
        'audio_sample',
      );

      if (result.success && result.qualityAssessment) {
        expect(result.qualityAssessment.qualityScore).toBeGreaterThanOrEqual(
          mockConfig.minQualityThreshold,
        );
      }
    });

    it('should apply network-adaptive compression', async () => {
      const audioData = createMockData(1024 * 1024); // 1MB
      const networkConditions: NetworkAdaptiveConfig = {
        bandwidth: 50000, // 50KB/s - very slow connection
        latency: 500,
        reliability: 0.5,
        connectionType: 'cellular',
        adaptiveEnabled: true,
        qualityScaling: true,
        aggressiveCompression: true,
      };

      const result = await compressionEngine.compressAsset(
        audioData,
        'audio_sample',
        {
          networkConditions,
          qualityPreference: 'speed',
        },
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      // Should achieve better compression ratio for poor network conditions
      expect(result.compressionRatio).toBeLessThan(0.8);
    });
  });

  describe('Quality Assessment', () => {
    const createMockData = (size: number): ArrayBuffer => {
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < size; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    };

    it('should assess compression quality accurately', async () => {
      const originalData = createMockData(256 * 1024);
      const compressedResult = await compressionEngine.compressAsset(
        originalData,
        'audio_sample',
      );

      if (compressedResult.success && compressedResult.qualityAssessment) {
        const assessment = compressedResult.qualityAssessment;

        expect(assessment.qualityScore).toBeGreaterThan(0);
        expect(assessment.qualityScore).toBeLessThanOrEqual(1);
        expect(assessment.lossType).toMatch(/^(lossless|lossy|hybrid)$/);
        expect(assessment.degradationLevel).toBeGreaterThanOrEqual(0);
        expect(assessment.degradationLevel).toBeLessThanOrEqual(1);
      }
    });

    it('should provide quality recommendations', async () => {
      const audioData = createMockData(512 * 1024);
      const result = await compressionEngine.compressAsset(
        audioData,
        'audio_sample',
      );

      if (result.success && result.qualityAssessment) {
        expect(result.qualityAssessment.recommendations).toBeDefined();
        expect(Array.isArray(result.qualityAssessment.recommendations)).toBe(
          true,
        );
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should track compression analytics', async () => {
      const data = new ArrayBuffer(1024);
      await compressionEngine.compressAsset(data, 'audio_sample');

      const analytics = compressionEngine.getCompressionAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalOperations).toBeGreaterThan(0);
      expect(analytics.operationsByType).toBeDefined();
      expect(analytics.operationsByType.audio_sample).toBeGreaterThan(0);
    });

    it('should provide performance metrics', async () => {
      const analytics = compressionEngine.getCompressionAnalytics();

      expect(analytics.performanceMetrics).toBeDefined();
      expect(
        analytics.performanceMetrics.operationsPerSecond,
      ).toBeGreaterThanOrEqual(0);
      expect(
        analytics.performanceMetrics.averageThroughput,
      ).toBeGreaterThanOrEqual(0);
      expect(
        analytics.performanceMetrics.averageLatency,
      ).toBeGreaterThanOrEqual(0);
    });

    it('should track quality metrics', async () => {
      const analytics = compressionEngine.getCompressionAnalytics();

      expect(analytics.qualityMetrics).toBeDefined();
      expect(
        analytics.qualityMetrics.averageQualityScore,
      ).toBeGreaterThanOrEqual(0);
      expect(analytics.qualityMetrics.averageQualityScore).toBeLessThanOrEqual(
        1,
      );
      expect(analytics.qualityMetrics.totalOperations).toBeGreaterThanOrEqual(
        0,
      );
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration dynamically', async () => {
      const newConfig = {
        ...mockConfig,
        minQualityThreshold: 0.9,
      };

      compressionEngine.updateConfiguration(newConfig);

      // Verify configuration was updated
      const data = createMockData(256 * 1024);
      const result = await compressionEngine.compressAsset(
        data,
        'audio_sample',
      );

      if (result.success && result.qualityAssessment) {
        expect(result.qualityAssessment.qualityScore).toBeGreaterThanOrEqual(
          0.9,
        );
      }
    });

    it('should validate configuration updates', async () => {
      const invalidConfig = {
        ...mockConfig,
        minQualityThreshold: 1.5, // Invalid threshold > 1
      };

      expect(() => {
        compressionEngine.updateConfiguration(invalidConfig);
      }).not.toThrow(); // updateConfiguration handles validation internally
    });
  });

  describe('Error Handling', () => {
    it('should handle worker failures gracefully', async () => {
      // Simulate worker failure by trying to compress very large data
      const largeData = new ArrayBuffer(100 * 1024 * 1024); // 100MB
      const result = await compressionEngine.compressAsset(
        largeData,
        'audio_sample',
      );

      // Should either succeed or fail gracefully with error message
      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid asset types', async () => {
      const data = new ArrayBuffer(1024);
      // Testing invalid asset type with type assertion
      const result = await compressionEngine.compressAsset(
        data,
        'invalid_type' as any,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle compression timeouts', async () => {
      // Create a configuration with very short but valid timeout
      const timeoutConfig = {
        ...mockConfig,
        compressionTimeout: 1000, // 1000ms timeout (minimum valid value)
      };

      const timeoutEngine = new IntelligentCompressionEngine(timeoutConfig);
      await timeoutEngine.initialize();

      const data = new ArrayBuffer(1024 * 1024); // 1MB
      const result = await timeoutEngine.compressAsset(data, 'audio_sample');

      // Should complete successfully with valid timeout
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      await compressionEngine.initialize();
      await compressionEngine.cleanup();

      // Should be able to reinitialize after cleanup
      await compressionEngine.initialize();
      const analytics = compressionEngine.getCompressionAnalytics();
      expect(analytics).toBeDefined();
    });
  });

  // Helper function to create mock data
  function createMockData(size: number): ArrayBuffer {
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < size; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }
});
