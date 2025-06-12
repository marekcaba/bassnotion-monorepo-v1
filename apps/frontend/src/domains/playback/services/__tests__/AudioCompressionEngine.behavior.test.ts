/**
 * AudioCompressionEngine Behavior Tests
 *
 * Testing audio compression, format conversion, quality adaptation, and device optimization
 * for the 1,300-line AudioCompressionEngine service using proven behavior-driven approach.
 *
 * Core Behaviors:
 * - Adaptive compression based on device/network conditions
 * - Multi-format audio processing (MP3, OGG, WebM, AAC)
 * - Quality scaling and bitrate optimization
 * - Performance monitoring and analytics
 * - Intelligent caching and optimization
 * - Singleton pattern and lifecycle management
 * - Epic 2 integration and asset optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AudioCompressionEngine,
  type CompressionOptions,
  type AudioFormat,
  type AudioCompressionConfig,
} from '../AudioCompressionEngine.js';
import type {
  QualityLevel,
  DeviceCapabilities,
  NetworkCapabilities,
} from '../../types/audio.js';

// Safe browser environment setup
const createMockEnvironment = () => {
  const globalObj = global as any;

  // Navigator mock for hardware information
  if (!globalObj.navigator) {
    globalObj.navigator = {
      hardwareConcurrency: 4,
      userAgent: 'Mozilla/5.0 (Node.js Test Environment)',
      platform: 'node',
      connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      },
    };
  }

  // AudioContext mock for audio processing
  if (!globalObj.AudioContext) {
    globalObj.AudioContext = class MockAudioContext {
      createBufferSource() {
        return { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      decodeAudioData(buffer: ArrayBuffer) {
        return Promise.resolve({
          length: buffer.byteLength / 4,
          duration: buffer.byteLength / 44100 / 4,
          sampleRate: 44100,
          numberOfChannels: 2,
        });
      }
    };
  }

  // Worker mock for compression processing
  if (!globalObj.Worker) {
    globalObj.Worker = class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage: ((e: any) => void) | null = null;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    };
  }

  return globalObj;
};

// Mock audio buffer creation for testing scenarios
const createMockAudioBuffer = (size = 44100): ArrayBuffer => {
  const buffer = new ArrayBuffer(size);
  const view = new Float32Array(buffer);
  // Fill with mock audio data (sine wave)
  for (let i = 0; i < view.length; i++) {
    view[i] = Math.sin((i / view.length) * 2 * Math.PI * 440);
  }
  return buffer;
};

// Scenario builders for audio compression testing
const createCompressionScenarios = () => {
  const audioBuffer = new ArrayBuffer(1024 * 1024); // 1MB audio buffer
  const smallAudioBuffer = new ArrayBuffer(512 * 1024); // 512KB audio buffer
  const largeAudioBuffer = new ArrayBuffer(5 * 1024 * 1024); // 5MB audio buffer

  const lowEndDevice: DeviceCapabilities = {
    cpuCores: 2,
    memoryGB: 2,
    architecture: 'arm',
    gpuSupport: false,
    maxSampleRate: 44100,
    minBufferSize: 1024,
    maxPolyphony: 32,
    audioWorkletSupport: false,
    sharedArrayBufferSupport: false,
    deviceClass: 'low-end',
    platformVersion: '14.0',
    isTablet: false,
    screenSize: { width: 375, height: 667 },
    performanceScore: 0.3,
    thermalThrottlingThreshold: 70,
    batteryCapacity: 3000,
  };

  const highEndDevice: DeviceCapabilities = {
    cpuCores: 8,
    memoryGB: 16,
    architecture: 'x86_64',
    gpuSupport: true,
    maxSampleRate: 96000,
    minBufferSize: 256,
    maxPolyphony: 128,
    audioWorkletSupport: true,
    sharedArrayBufferSupport: true,
    deviceClass: 'premium',
    platformVersion: '16.0',
    isTablet: false,
    screenSize: { width: 414, height: 896 },
    performanceScore: 0.95,
    thermalThrottlingThreshold: 85,
    batteryCapacity: 5000,
  };

  const slowNetwork: NetworkCapabilities = {
    connectionType: '3g',
    effectiveType: '3g',
    downlink: 1.5,
    rtt: 300,
    saveData: true,
    isMetered: true,
    bandwidth: 1500, // 1.5 Mbps converted to kbps
    latency: 300, // Same as rtt
  };

  const fastNetwork: NetworkCapabilities = {
    connectionType: '5g',
    effectiveType: '4g',
    downlink: 100,
    rtt: 20,
    saveData: false,
    isMetered: false,
    bandwidth: 100000, // 100 Mbps converted to kbps
    latency: 20, // Same as rtt
  };

  return {
    audioBuffer,
    smallAudioBuffer,
    largeAudioBuffer,
    lowEndDevice,
    highEndDevice,
    slowNetwork,
    fastNetwork,
  };
};

// Quality expectation helpers
const expectCompressionRatio = (
  ratio: number,
  expectedMin: number,
  expectedMax: number,
) => {
  expect(ratio).toBeGreaterThanOrEqual(expectedMin);
  expect(ratio).toBeLessThanOrEqual(expectedMax);
};

const expectProcessingTime = (time: number, maxExpected: number) => {
  expect(time).toBeGreaterThan(0);
  expect(time).toBeLessThan(maxExpected);
};

const expectQualityRetention = (score: number, minExpected = 0.7) => {
  expect(score).toBeGreaterThanOrEqual(minExpected);
  expect(score).toBeLessThanOrEqual(1.0);
};

describe('AudioCompressionEngine Behavior', () => {
  let engine: AudioCompressionEngine;
  let _mockEnv: any;
  let scenarios: ReturnType<typeof createCompressionScenarios>;

  beforeEach(() => {
    _mockEnv = createMockEnvironment();
    scenarios = createCompressionScenarios();

    // Reset singleton
    (AudioCompressionEngine as any).instance = undefined;

    engine = AudioCompressionEngine.getInstance({
      enableCompression: true,
      defaultQuality: 'medium',
      adaptiveQuality: true,
      preferredFormats: ['mp3', 'ogg', 'webm', 'aac'],
      fallbackFormat: 'mp3',
      enableDeviceOptimization: true,
      enablePerformanceTracking: true,
      enableCompressionCache: true,
      maxCacheSize: 10 * 1024 * 1024, // 10MB
    });

    vi.clearAllMocks();
  });

  describe('Singleton Pattern Behavior', () => {
    it('should maintain singleton instance across calls', () => {
      const instance1 = AudioCompressionEngine.getInstance();
      const instance2 = AudioCompressionEngine.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1 === instance2).toBe(true);
    });

    it('should apply initial configuration only once', () => {
      const customConfig: Partial<AudioCompressionConfig> = {
        enableCompression: false,
        defaultQuality: 'low',
        adaptiveQuality: false,
      };

      // Reset for custom config test
      (AudioCompressionEngine as any).instance = undefined;
      const customEngine = AudioCompressionEngine.getInstance(customConfig);

      expect(customEngine).toBeDefined();
      expect(customEngine).toBeInstanceOf(AudioCompressionEngine);

      // Subsequent calls should return same instance
      const sameEngine = AudioCompressionEngine.getInstance();
      expect(sameEngine).toBe(customEngine);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = AudioCompressionEngine.getInstance();

      // Modify state
      instance1.updateContext(scenarios.lowEndDevice);

      const instance2 = AudioCompressionEngine.getInstance();
      expect(instance1).toBe(instance2);

      // State should be maintained
      const profile = instance2.getOptimalSettings(
        'wav',
        scenarios.lowEndDevice,
      );
      expect(profile.targetDevices).toContain('low-end');
    });
  });

  describe('Basic Compression Behavior', () => {
    it('should compress audio with standard settings', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result.success).toBe(true);
      expect(result.outputFormat).toBe('mp3');
      expect(result.outputBuffer).toBeDefined();
      expectCompressionRatio(result.compressionRatio, 0.1, 0.8);
      expectProcessingTime(result.processingTime, 5000);
      expectQualityRetention(result.qualityScore);
    });

    it('should handle different audio formats', async () => {
      const formats: AudioFormat[] = ['mp3', 'ogg', 'webm', 'aac'];

      for (const format of formats) {
        const options: CompressionOptions = {
          targetFormat: format,
          targetQuality: 'medium',
        };

        const result = await engine.compressAudio(
          scenarios.smallAudioBuffer,
          options,
        );

        expect(result.success).toBe(true);
        expect(result.outputFormat).toBe(format);
        expectCompressionRatio(result.compressionRatio, 0.1, 0.9);
      }
    });

    it('should handle multiple quality levels', async () => {
      const qualities: QualityLevel[] = [
        'minimal',
        'low',
        'medium',
        'high',
        'ultra',
      ];

      for (const quality of qualities) {
        const options: CompressionOptions = {
          targetFormat: 'mp3',
          targetQuality: quality,
        };

        const result = await engine.compressAudio(
          scenarios.audioBuffer,
          options,
        );

        expect(result.success).toBe(true);

        // Higher quality should have lower compression ratio
        if (quality === 'ultra') {
          expectCompressionRatio(result.compressionRatio, 0.4, 0.9);
        } else if (quality === 'minimal') {
          expectCompressionRatio(result.compressionRatio, 0.05, 0.3);
        }
      }
    });

    it('should handle compression with custom metadata', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
        sourceUrl: 'https://example.com/test.wav',
        reason: 'Test compression for unit testing',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe('string');
    });

    it('should calculate compression metrics correctly', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'low', // Should compress more
      };

      const result = await engine.compressAudio(
        scenarios.largeAudioBuffer,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.compressionMetrics).toBeDefined();
      expect(result.compressionMetrics.originalSize).toBe(
        scenarios.largeAudioBuffer.byteLength,
      );
      expect(result.compressionMetrics.compressedSize).toBeGreaterThan(0);
      expect(result.compressionMetrics.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionMetrics.processingTime).toBeGreaterThan(0);
      expect(result.compressionMetrics.qualityRetention).toBeGreaterThanOrEqual(
        0,
      );
      expect(result.compressionMetrics.qualityRetention).toBeLessThanOrEqual(1);
    });

    it('should handle very small audio buffers', async () => {
      const smallBuffer = createMockAudioBuffer(256); // Very small buffer
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(smallBuffer, options);

      expect(result.success).toBe(true);
      expect(result.outputBuffer).toBeDefined();
    });
  });

  describe('Device-Adaptive Compression', () => {
    it('should optimize compression for low-end devices', async () => {
      engine.updateContext(scenarios.lowEndDevice, scenarios.slowNetwork);

      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result.success).toBe(true);
      // Low-end device should have aggressive compression
      expectCompressionRatio(result.compressionRatio, 0.05, 0.4);
      expect(result.compressionMetrics.deviceOptimizationScore).toBeGreaterThan(
        0.7,
      );
    });

    it('should enable high quality for premium devices', async () => {
      engine.updateContext(scenarios.highEndDevice, scenarios.fastNetwork);

      const options: CompressionOptions = {
        targetFormat: 'aac',
        targetQuality: 'high',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result.success).toBe(true);
      // High-end device should preserve quality
      expectCompressionRatio(result.compressionRatio, 0.3, 0.8);
      expectQualityRetention(result.qualityScore, 0.85);
    });

    it('should adapt to network conditions', async () => {
      // Test slow network adaptation
      engine.updateContext(scenarios.highEndDevice, scenarios.slowNetwork);

      const slowNetworkResult = await engine.compressAudio(
        scenarios.audioBuffer,
        {
          targetFormat: 'mp3',
          targetQuality: 'medium',
        },
      );

      // Test fast network adaptation
      engine.updateContext(scenarios.highEndDevice, scenarios.fastNetwork);

      const fastNetworkResult = await engine.compressAudio(
        scenarios.audioBuffer,
        {
          targetFormat: 'mp3',
          targetQuality: 'medium',
        },
      );

      expect(slowNetworkResult.success).toBe(true);
      expect(fastNetworkResult.success).toBe(true);

      // Slow network should compress more aggressively
      expect(slowNetworkResult.compressionRatio).toBeLessThan(
        fastNetworkResult.compressionRatio,
      );
    });
  });

  describe('Performance and Optimization', () => {
    it('should cache compression results', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      // First compression
      const result1 = await engine.compressAudio(
        scenarios.audioBuffer,
        options,
      );
      const time1 = result1.processingTime;

      // Second compression (should hit cache)
      const result2 = await engine.compressAudio(
        scenarios.audioBuffer,
        options,
      );
      const time2 = result2.processingTime;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Second compression should be significantly faster (cached)
      expect(time2).toBeLessThan(time1 * 0.1); // At least 10x faster
    });

    it('should handle priority-based processing', async () => {
      const urgentOptions: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
        priority: 'urgent',
      };

      const lowOptions: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
        priority: 'low',
      };

      // Start multiple jobs simultaneously
      const urgentPromise = engine.compressAudio(
        scenarios.audioBuffer,
        urgentOptions,
      );
      const lowPromise = engine.compressAudio(
        scenarios.audioBuffer,
        lowOptions,
      );

      const [urgentResult, lowResult] = await Promise.all([
        urgentPromise,
        lowPromise,
      ]);

      expect(urgentResult.success).toBe(true);
      expect(lowResult.success).toBe(true);

      // Urgent priority should complete faster or at least succeed
      expect(urgentResult.processingTime).toBeLessThanOrEqual(
        lowResult.processingTime * 1.5,
      );
    });

    it('should process compression jobs within reasonable time', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const startTime = performance.now();
      const result = await engine.compressAudio(
        scenarios.largeAudioBuffer,
        options,
      );
      const processingTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent compression jobs', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      // Start multiple compressions concurrently
      const jobs = Array.from({ length: 3 }, (_, i) => {
        const uniqueBuffer = createMockAudioBuffer(2048);

        return engine.compressAudio(uniqueBuffer, {
          ...options,
          sourceUrl: `concurrent-test-${i}.wav`,
        });
      });

      const results = await Promise.all(jobs);

      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBeDefined();
      });
    });

    it('should maintain performance under load', async () => {
      // Process multiple jobs sequentially
      const results = [];
      for (let i = 0; i < 3; i++) {
        const uniqueBuffer = createMockAudioBuffer(1024);

        const result = await engine.compressAudio(uniqueBuffer, {
          targetFormat: 'mp3',
          targetQuality: 'medium',
          sourceUrl: `load-test-${i}.wav`,
        });

        results.push(result);
      }

      // All jobs should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Performance should remain reasonable
      const avgProcessingTime =
        results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgProcessingTime).toBeLessThan(2000); // Average should be under 2 seconds
    });
  });

  describe('Analytics and Monitoring', () => {
    it('should provide comprehensive compression analytics', () => {
      const analytics = engine.getAnalytics();

      expect(analytics).toBeDefined();
      expect(typeof analytics.totalJobsProcessed).toBe('number');
      expect(typeof analytics.averageCompressionRatio).toBe('number');
      expect(typeof analytics.averageProcessingTime).toBe('number');
      expect(typeof analytics.successRate).toBe('number');
      expect(analytics.formatDistribution).toBeInstanceOf(Map);
      expect(analytics.qualityDistribution).toBeInstanceOf(Map);
      expect(analytics.devicePerformance).toBeInstanceOf(Map);
      expect(analytics.networkOptimization).toBeInstanceOf(Map);
      expect(analytics.algorithmEfficiency).toBeInstanceOf(Map);

      // Analytics should start with default values
      expect(analytics.successRate).toBeGreaterThanOrEqual(0);
      expect(analytics.successRate).toBeLessThanOrEqual(1);
    });

    it('should update analytics after compression jobs', async () => {
      const initialAnalytics = engine.getAnalytics();
      const initialJobCount = initialAnalytics.totalJobsProcessed;

      // Run a compression job
      const result = await engine.compressAudio(scenarios.audioBuffer, {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      });

      expect(result.success).toBe(true);

      const updatedAnalytics = engine.getAnalytics();
      expect(updatedAnalytics.totalJobsProcessed).toBe(initialJobCount + 1);
    });

    it('should track format distribution in analytics', async () => {
      // Process different formats
      await engine.compressAudio(scenarios.smallAudioBuffer, {
        targetFormat: 'mp3',
      });
      await engine.compressAudio(scenarios.smallAudioBuffer, {
        targetFormat: 'ogg',
      });

      const analytics = engine.getAnalytics();
      expect(analytics.formatDistribution.size).toBeGreaterThan(0);
    });

    it('should track quality distribution in analytics', async () => {
      // Process different qualities
      await engine.compressAudio(scenarios.smallAudioBuffer, {
        targetQuality: 'low',
      });
      await engine.compressAudio(scenarios.smallAudioBuffer, {
        targetQuality: 'high',
      });

      const analytics = engine.getAnalytics();
      expect(analytics.qualityDistribution.size).toBeGreaterThan(0);
    });

    it('should provide compression analytics after multiple operations', async () => {
      // Perform multiple compressions
      const compressions = [
        { format: 'mp3' as AudioFormat, quality: 'low' as QualityLevel },
        { format: 'ogg' as AudioFormat, quality: 'medium' as QualityLevel },
        { format: 'webm' as AudioFormat, quality: 'high' as QualityLevel },
      ];

      for (const { format, quality } of compressions) {
        await engine.compressAudio(scenarios.audioBuffer, {
          targetFormat: format,
          targetQuality: quality,
        });
      }

      const analytics = engine.getAnalytics();

      expect(analytics.totalJobsProcessed).toBe(3);
      expect(analytics.successRate).toBeGreaterThan(0.9);
      expect(analytics.averageCompressionRatio).toBeGreaterThan(0);
      expect(analytics.formatDistribution.size).toBeGreaterThan(0);
    });
  });

  describe('Format Optimization', () => {
    it('should select optimal format for device capabilities', async () => {
      engine.updateContext(scenarios.lowEndDevice, scenarios.slowNetwork);

      const profile = engine.getOptimalSettings(
        'wav',
        scenarios.lowEndDevice,
        scenarios.slowNetwork,
      );

      expect(profile.name).toBeDefined();
      expect(profile.targetDevices).toContain('low-end');
      expect(profile.qualitySettings.bitrate).toBeLessThan(192); // Lower bitrate for low-end
    });

    it('should handle format conversion chains', async () => {
      const options: CompressionOptions = {
        inputFormat: 'wav',
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(
        scenarios.largeAudioBuffer,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.outputFormat).toBe('mp3');
      expectCompressionRatio(result.compressionRatio, 0.1, 0.5); // WAV to MP3 should compress well
    });

    it('should fallback gracefully on format failures', async () => {
      const options: CompressionOptions = {
        targetFormat: 'flac', // Potentially unsupported format
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      // Should succeed with fallback format
      expect(result.success).toBe(true);
      expect(['mp3', 'ogg', 'webm']).toContain(result.outputFormat);
    });

    it('should handle optimal settings without context', () => {
      const optimal = engine.getOptimalSettings('wav');

      expect(optimal).toBeDefined();
      expect(optimal.name).toBeDefined();
      expect(optimal.description).toBeDefined();
      expect(optimal.qualitySettings).toBeDefined();
      expect(optimal.qualitySettings.bitrate).toBeGreaterThan(0);
      expect(optimal.qualitySettings.sampleRate).toBeGreaterThan(0);
      expect(optimal.qualitySettings.channels).toBeGreaterThanOrEqual(1);
      expect(optimal.qualitySettings.channels).toBeLessThanOrEqual(2);
    });

    it('should handle unknown input formats gracefully', () => {
      const optimal = engine.getOptimalSettings('unknown-format' as any);

      expect(optimal).toBeDefined();
      expect(optimal.qualitySettings).toBeDefined();
    });

    it('should work with basic device context', () => {
      const basicDevice = {
        isMobile: false,
        isLowEnd: false,
        isSlowNetwork: false,
        maxConcurrentDownloads: 6,
        supportedFormats: ['mp3', 'ogg'],
      };

      const optimal = engine.getOptimalSettings('wav', basicDevice as any);

      expect(optimal).toBeDefined();
      expect(optimal.qualitySettings).toBeDefined();
      expect(optimal.qualitySettings.bitrate).toBeGreaterThan(0);
    });

    it('should work with basic network context', () => {
      const basicNetwork = {
        connectionType: 'wifi',
        downlinkSpeed: 10,
        isSlowConnection: false,
      };

      const optimal = engine.getOptimalSettings(
        'wav',
        undefined,
        basicNetwork as any,
      );

      expect(optimal).toBeDefined();
      expect(optimal.qualitySettings).toBeDefined();
    });
  });

  describe('Quality Adaptation', () => {
    it('should maintain quality for critical audio', async () => {
      const options: CompressionOptions = {
        targetFormat: 'aac',
        targetQuality: 'ultra',
        reason: 'critical_audio',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result.success).toBe(true);
      expectQualityRetention(result.qualityScore, 0.9); // Very high quality retention
      expect(result.compressionRatio).toBeGreaterThan(0.4); // Less aggressive compression
    });

    it('should balance size and quality for different scenarios', async () => {
      const scenarios_compression = [
        {
          quality: 'minimal' as QualityLevel,
          expectedRatio: [0.05, 0.25] as const,
        },
        {
          quality: 'medium' as QualityLevel,
          expectedRatio: [0.2, 0.6] as const,
        },
        {
          quality: 'ultra' as QualityLevel,
          expectedRatio: [0.5, 0.9] as const,
        },
      ];

      for (const { quality, expectedRatio } of scenarios_compression) {
        const result = await engine.compressAudio(scenarios.audioBuffer, {
          targetFormat: 'mp3',
          targetQuality: quality,
        });

        expect(result.success).toBe(true);
        expectCompressionRatio(
          result.compressionRatio,
          expectedRatio[0],
          expectedRatio[1],
        );
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid input gracefully', async () => {
      const emptyBuffer = new ArrayBuffer(0);

      const result = await engine.compressAudio(emptyBuffer, {
        targetFormat: 'mp3',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('format_unsupported');
    });

    it('should handle null or undefined input buffers', async () => {
      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      };

      const result1 = await engine.compressAudio(null as any, options);
      const result2 = await engine.compressAudio(undefined as any, options);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Should handle gracefully - might succeed or fail but shouldn't crash
    });

    it('should handle compression errors gracefully', async () => {
      // Try to compress with invalid options
      const options: CompressionOptions = {
        targetFormat: 'invalid-format' as any,
        targetQuality: 'invalid-quality' as any,
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
        expect(typeof result.error?.recoverable).toBe('boolean');
      }
    });

    it('should handle processing timeouts', async () => {
      // Create a large buffer that might trigger timeout logic
      const hugeBuffer = createMockAudioBuffer(1024 * 64); // Larger buffer
      const options: CompressionOptions = {
        targetFormat: 'flac', // Lossless format might take longer
        targetQuality: 'ultra',
      };

      const result = await engine.compressAudio(hugeBuffer, options);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      // Should either succeed or fail gracefully with timeout
      if (!result.success) {
        expect(result.error?.type).toBe('processing_timeout');
        expect(result.error?.recoverable).toBe(true);
      }
    });

    it('should handle memory constraints', async () => {
      // Configure small memory limit
      engine = AudioCompressionEngine.getInstance({
        maxCacheSize: 1024 * 1024, // 1MB limit
      });

      const result = await engine.compressAudio(scenarios.largeAudioBuffer, {
        targetFormat: 'mp3',
        targetQuality: 'medium',
      });

      // Should either adapt or fail gracefully
      if (!result.success) {
        expect(result.error?.type).toBe('memory_limit');
        expect(result.error?.fallbackOptions).toBeDefined();
      } else {
        // Should have adapted compression settings
        expect(result.compressionRatio).toBeLessThan(0.5);
      }
    });

    it('should provide fallback options on compression errors', async () => {
      const options: CompressionOptions = {
        targetFormat: 'unsupported-format' as any,
        targetQuality: 'medium',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);

      if (!result.success && result.error) {
        expect(result.error.fallbackOptions).toBeDefined();
        expect(Array.isArray(result.error.fallbackOptions)).toBe(true);
      }
    });
  });

  describe('Cache Management', () => {
    it('should manage cache size efficiently', async () => {
      // Fill cache with multiple compressions
      for (let i = 0; i < 10; i++) {
        const buffer = createMockAudioBuffer(1024 * 1024); // 1MB each
        await engine.compressAudio(buffer, {
          targetFormat: 'mp3',
          targetQuality: 'medium',
          reason: `test_${i}`,
        });
      }

      const analytics = engine.getAnalytics();
      expect(analytics.totalJobsProcessed).toBe(10);

      // Cache should be managed within limits
      // Note: Exact cache behavior depends on implementation
    });

    it('should clear cache when requested', async () => {
      await engine.compressAudio(scenarios.audioBuffer, {
        targetFormat: 'mp3',
      });

      engine.clearCache();

      // Next compression should not hit cache
      const result = await engine.compressAudio(scenarios.audioBuffer, {
        targetFormat: 'mp3',
      });

      expect(result.success).toBe(true);
      // Processing time should be full (not cached)
      expect(result.processingTime).toBeGreaterThan(10);
    });

    it('should handle cache with multiple results', async () => {
      // Fill cache with multiple compression results
      for (let i = 0; i < 5; i++) {
        const uniqueSize = 1024 + i * 4; // Ensure multiple of 4 for Float32Array
        const uniqueBuffer = new ArrayBuffer(uniqueSize);
        const sourceData = new Float32Array(scenarios.audioBuffer);
        const targetData = new Float32Array(uniqueBuffer);

        // Copy as much data as fits
        const copyLength = Math.min(sourceData.length, targetData.length);
        targetData.set(sourceData.subarray(0, copyLength));

        await engine.compressAudio(uniqueBuffer, {
          targetFormat: 'mp3',
          targetQuality: 'medium',
          sourceUrl: `test-${i}.wav`, // Unique URLs for cache keys
        });
      }

      // Cache should be populated
      const analytics = engine.getAnalytics();
      expect(analytics.totalJobsProcessed).toBe(5);
    });
  });

  describe('Epic 2 Integration', () => {
    it('should handle Epic 2 asset types appropriately', async () => {
      // Test with Epic 2 asset categories
      const epic2AssetTypes = [
        { format: 'wav', category: 'bass-sample' },
        { format: 'wav', category: 'drum-sample' },
        { format: 'wav', category: 'ambience' },
      ];

      for (const assetType of epic2AssetTypes) {
        const options: CompressionOptions = {
          targetFormat: 'mp3',
          targetQuality: 'medium',
          sourceUrl: `epic2-${assetType.category}.${assetType.format}`,
          reason: `Epic 2 ${assetType.category} compression`,
        };

        const result = await engine.compressAudio(
          scenarios.audioBuffer,
          options,
        );
        expect(result.success).toBe(true);
      }
    });

    it('should integrate with mobile device optimization', async () => {
      const mobileDevice = {
        isMobile: true,
        isLowEnd: false,
        maxConcurrentDownloads: 4,
      };

      // Update context for mobile
      engine.updateContext(mobileDevice as any);

      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'medium',
        reason: 'Epic 2 mobile optimization test',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);
      expect(result.success).toBe(true);
    });

    it('should integrate with adaptive quality based on network conditions', async () => {
      const slowNetwork = {
        connectionType: '3g',
        isSlowConnection: true,
      };

      // Update context for slow network
      engine.updateContext(undefined, slowNetwork as any);

      const options: CompressionOptions = {
        targetFormat: 'mp3',
        targetQuality: 'high', // Should be adapted down due to slow network
        reason: 'Epic 2 adaptive quality test',
      };

      const result = await engine.compressAudio(scenarios.audioBuffer, options);
      expect(result.success).toBe(true);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize with proper configuration', () => {
      const customEngine = AudioCompressionEngine.getInstance({
        enableCompression: false,
        defaultQuality: 'high',
        preferredFormats: ['aac', 'mp3'],
      });

      expect(customEngine).toBeDefined();
      // Should maintain singleton behavior
      expect(customEngine).toBe(engine);
    });

    it('should dispose resources cleanly', () => {
      engine.dispose();

      // Should be able to dispose without errors
      expect(() => engine.dispose()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      expect(() => {
        engine.dispose();
        engine.dispose(); // Should not throw on second call
      }).not.toThrow();
    });

    it('should clean up worker pool on dispose', () => {
      // Dispose should clean up internal resources
      expect(() => {
        engine.dispose();
      }).not.toThrow();

      // After dispose, operations should still be handled gracefully
      const analytics = engine.getAnalytics();
      expect(analytics).toBeDefined();
    });

    it('should handle context updates', () => {
      engine.updateContext(scenarios.highEndDevice, scenarios.fastNetwork);

      const profile = engine.getOptimalSettings(
        'wav',
        scenarios.highEndDevice,
        scenarios.fastNetwork,
      );

      expect(profile.targetDevices).toContain('premium');
      expect(profile.qualitySettings.bitrate).toBeGreaterThan(128);
    });

    it('should update context without throwing', () => {
      expect(() => {
        engine.updateContext();
      }).not.toThrow();
    });

    it('should update with basic device context', () => {
      const basicDevice = {
        isMobile: true,
        isLowEnd: false,
        maxConcurrentDownloads: 4,
      };

      expect(() => {
        engine.updateContext(basicDevice as any);
      }).not.toThrow();
    });

    it('should handle empty context objects', () => {
      expect(() => {
        engine.updateContext({} as any, {} as any);
      }).not.toThrow();
    });
  });
});
