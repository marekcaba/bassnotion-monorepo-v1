/**
 * Test Suite for AudioBufferManager
 *
 * Tests comprehensive audio buffer management functionality including:
 * - Audio context initialization and configuration
 * - Device profiling and optimization
 * - Asset registration, preloading, and caching
 * - Buffer pooling and memory management
 * - Performance monitoring and metrics collection
 *
 * @author BassNotion Team
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioBufferManager } from '../AudioBufferManager.js';

// Mock Web Audio API
class MockAudioContext {
  public state = 'running';
  public sampleRate = 44100;
  public baseLatency = 0.005; // 5ms
  public outputLatency = 0.01; // 10ms
  public close = vi.fn().mockResolvedValue(undefined); // Mock close method returning Promise

  constructor(options?: AudioContextOptions) {
    if (options?.sampleRate) {
      this.sampleRate = options.sampleRate;
    }
  }

  async resume() {
    this.state = 'running';
  }

  async decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return createMockAudioBuffer();
  }

  createBuffer(
    numberOfChannels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    return createMockAudioBuffer(length / sampleRate);
  }

  createBufferSource(): AudioBufferSourceNode {
    return {} as AudioBufferSourceNode;
  }

  createGain(): GainNode {
    return {} as GainNode;
  }
}

// Mock AudioBuffer
const createMockAudioBuffer = (duration = 1): AudioBuffer => ({
  numberOfChannels: 2,
  length: 44100 * duration,
  sampleRate: 44100,
  duration,
  getChannelData: vi.fn(() => new Float32Array(44100 * duration)),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
});

// Mock fetch for audio loading
const mockFetch = vi.fn();

// Mock performance.now
const mockPerformanceNow = vi.fn();

// Mock console methods
const mockConsoleDebug = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock timers
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('AudioBufferManager', () => {
  let audioManager: AudioBufferManager;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock Web Audio API - ensure both global and window have the same mock
    global.AudioContext = MockAudioContext as any;
    global.AudioWorkletNode = vi.fn() as any;

    // Mock window object with same AudioContext reference
    global.window = {
      AudioContext: MockAudioContext,
    } as any;

    // Mock navigator (default high-end device)
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    } as any;

    // Mock fetch
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    } as any);

    // Mock performance
    global.performance = {
      ...global.performance,
      now: mockPerformanceNow,
    };
    mockPerformanceNow.mockReturnValue(1000);

    // Mock console methods
    global.console = {
      ...global.console,
      debug: mockConsoleDebug,
      warn: mockConsoleWarn,
      error: mockConsoleError,
    };

    // Mock timers
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;
    mockSetInterval.mockReturnValue(12345);

    // Destroy any existing instance first
    const existingInstance = (AudioBufferManager as any).instance;
    if (existingInstance) {
      await existingInstance.destroy();
    }

    // Get fresh instance
    audioManager = AudioBufferManager.getInstance();
  });

  afterEach(async () => {
    // Clean up singleton instance
    if (audioManager) {
      await audioManager.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AudioBufferManager.getInstance();
      const instance2 = AudioBufferManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', async () => {
      const instance1 = AudioBufferManager.getInstance();
      await instance1.destroy();

      const instance2 = AudioBufferManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Device Profiling', () => {
    it('should detect high-end device correctly', () => {
      const profile = audioManager.getDeviceProfile();

      expect(profile).toBeDefined();
      expect(profile?.isLowEnd).toBe(false);
      expect(profile?.recommendedBufferSize).toBe(256);
      expect(profile?.maxConcurrentSounds).toBe(16);
      expect(profile?.supportsWebAudio).toBe(true);
      expect(profile?.latencyCapability).toBe('low');
    });

    it('should detect low-end device based on memory', async () => {
      // Destroy current instance
      await audioManager.destroy();

      // Mock low memory device
      (global.navigator as any).deviceMemory = 2; // 2GB RAM

      const manager = AudioBufferManager.getInstance();
      const profile = manager.getDeviceProfile();

      expect(profile?.isLowEnd).toBe(true);
      expect(profile?.recommendedBufferSize).toBe(512);
      expect(profile?.maxConcurrentSounds).toBe(8);
      expect(profile?.latencyCapability).toBe('high');

      // Clean up
      await manager.destroy();
      // Restore original navigator
      (global.navigator as any).deviceMemory = 8;
    });

    it('should detect low-end device based on CPU cores', async () => {
      // Destroy current instance
      await audioManager.destroy();

      // Remove memory info, use CPU cores
      delete (global.navigator as any).deviceMemory;
      (global.navigator as any).hardwareConcurrency = 2; // 2 CPU cores

      const manager = AudioBufferManager.getInstance();
      const profile = manager.getDeviceProfile();

      expect(profile?.isLowEnd).toBe(true);

      // Clean up
      await manager.destroy();
      // Restore original navigator
      (global.navigator as any).deviceMemory = 8;
      (global.navigator as any).hardwareConcurrency = 8;
    });

    it('should fallback to user agent detection', async () => {
      // Destroy current instance
      await audioManager.destroy();

      // Remove hardware info
      delete (global.navigator as any).deviceMemory;
      delete (global.navigator as any).hardwareConcurrency;
      (global.navigator as any).userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 9_0)';

      const manager = AudioBufferManager.getInstance();
      const profile = manager.getDeviceProfile();

      expect(profile?.isLowEnd).toBe(true);

      // Clean up
      await manager.destroy();
      // Restore original navigator
      (global.navigator as any).deviceMemory = 8;
      (global.navigator as any).hardwareConcurrency = 8;
      (global.navigator as any).userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    });
  });

  describe('Audio Asset Management', () => {
    it('should register audio asset', () => {
      audioManager.registerAudioAsset(
        'test-sound',
        '/audio/test.wav',
        'high',
        true,
      );

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Registered asset: test-sound (priority: high, preload: true)',
      );
    });

    it('should register asset with default parameters', () => {
      audioManager.registerAudioAsset('default-sound', '/audio/default.wav');

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Registered asset: default-sound (priority: medium, preload: false)',
      );
    });

    it('should preload asset on registration when preload=true', async () => {
      audioManager.registerAudioAsset(
        'preload-sound',
        '/audio/preload.wav',
        'high',
        true,
      );

      // Wait for async preload
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith('/audio/preload.wav');
    });

    it('should get audio buffer and load on demand', async () => {
      audioManager.registerAudioAsset('on-demand', '/audio/on-demand.wav');

      const buffer = await audioManager.getAudioBuffer('on-demand');

      expect(buffer).toBeDefined();
      expect(buffer?.numberOfChannels).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith('/audio/on-demand.wav');
    });

    it('should return cached buffer on subsequent requests', async () => {
      audioManager.registerAudioAsset('cached', '/audio/cached.wav');

      const buffer1 = await audioManager.getAudioBuffer('cached');
      const buffer2 = await audioManager.getAudioBuffer('cached');

      expect(buffer1).toBe(buffer2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle asset not found', async () => {
      const buffer = await audioManager.getAudioBuffer('nonexistent');

      expect(buffer).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[AudioBufferManager] Asset not found: nonexistent',
      );
    });

    it('should handle preload errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      audioManager.registerAudioAsset('error-asset', '/audio/error.wav');
      const buffer = await audioManager.getAudioBuffer('error-asset');

      expect(buffer).toBeNull();
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[AudioBufferManager] Failed to preload asset: error-asset',
        expect.any(Error),
      );
    });
  });

  describe('Batch Asset Loading', () => {
    it('should preload multiple assets in parallel', async () => {
      audioManager.registerAudioAsset('asset1', '/audio/asset1.wav');
      audioManager.registerAudioAsset('asset2', '/audio/asset2.wav');
      audioManager.registerAudioAsset('asset3', '/audio/asset3.wav');

      await audioManager.preloadAssets(['asset1', 'asset2', 'asset3']);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Preloaded 3 assets',
      );
    });

    it('should handle partial failures in batch loading', async () => {
      mockFetch.mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as any);
      mockFetch.mockRejectedValueOnce(new Error('Failed'));
      mockFetch.mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as any);

      audioManager.registerAudioAsset('success1', '/audio/success1.wav');
      audioManager.registerAudioAsset('failure', '/audio/failure.wav');
      audioManager.registerAudioAsset('success2', '/audio/success2.wav');

      await audioManager.preloadAssets(['success1', 'failure', 'success2']);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Preloaded 3 assets',
      );
    });
  });

  describe('Buffer Pooling', () => {
    it('should get buffer from pool', () => {
      const createFn = vi.fn(() => createMockAudioBuffer());

      const buffer1 = audioManager.getPooledBuffer('test-type', createFn);
      audioManager.returnToPool('test-type', buffer1);

      const buffer2 = audioManager.getPooledBuffer('test-type', createFn);

      expect(buffer2).toBe(buffer1);
      expect(createFn).toHaveBeenCalledTimes(1);
    });

    it('should create new buffer when pool is empty', () => {
      const createFn = vi.fn(() => createMockAudioBuffer());

      const buffer = audioManager.getPooledBuffer('empty-pool', createFn);

      expect(buffer).toBeDefined();
      expect(createFn).toHaveBeenCalledTimes(1);
    });

    it('should limit pool size', () => {
      const buffers = Array.from({ length: 15 }, () => createMockAudioBuffer());

      // Return more buffers than max pool size (10)
      buffers.forEach((buffer) => {
        audioManager.returnToPool('limited-pool', buffer);
      });

      // Pool should be limited to max size
      const createFn = vi.fn(() => createMockAudioBuffer());

      // Get all buffers from pool
      const pooledBuffers = [];
      for (let i = 0; i < 12; i++) {
        pooledBuffers.push(
          audioManager.getPooledBuffer('limited-pool', createFn),
        );
      }

      // Should have created 2 new buffers (pool was limited to 10)
      expect(createFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate current metrics', () => {
      const metrics = audioManager.getCurrentMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.latency).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.timestamp).toBe('number');
    });

    it('should calculate latency from audio context', () => {
      const metrics = audioManager.getCurrentMetrics();

      // Mock context has 5ms base + 10ms output = 15ms total
      expect(metrics.latency).toBe(15);
    });

    it('should estimate CPU usage based on active assets', async () => {
      // Register and access some assets
      audioManager.registerAudioAsset('active1', '/audio/active1.wav');
      audioManager.registerAudioAsset('active2', '/audio/active2.wav');

      await audioManager.getAudioBuffer('active1');
      await audioManager.getAudioBuffer('active2');

      const metrics = audioManager.getCurrentMetrics();

      // Each active asset should contribute ~5% CPU
      expect(metrics.cpuUsage).toBeGreaterThan(0);
    });

    it('should calculate memory usage of buffers', async () => {
      // Create a larger audio buffer (10 seconds) to ensure meaningful memory usage
      // 2 channels * 44100 samples/sec * 10 sec * 4 bytes = ~3.4 MB
      const mockManager = audioManager as any;
      const originalDecodeAudioData = mockManager.audioContext?.decodeAudioData;

      if (mockManager.audioContext) {
        mockManager.audioContext.decodeAudioData = vi.fn().mockResolvedValue(
          createMockAudioBuffer(10), // 10 second buffer for ~3.4MB
        );
      }

      audioManager.registerAudioAsset('memory-test', '/audio/memory.wav');
      await audioManager.getAudioBuffer('memory-test');

      const metrics = audioManager.getCurrentMetrics();

      expect(metrics.memoryUsage).toBeGreaterThan(0);

      // Restore original method
      if (mockManager.audioContext && originalDecodeAudioData) {
        mockManager.audioContext.decodeAudioData = originalDecodeAudioData;
      }
    });

    it('should maintain metrics history', () => {
      const history = audioManager.getMetricsHistory();

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should warn about high latency', () => {
      // Mock high latency context
      const mockContext = audioManager as any;
      mockContext.audioContext = {
        baseLatency: 0.03, // 30ms
        outputLatency: 0.025, // 25ms = 55ms total
      };

      audioManager.optimizeBufferSettings();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[AudioBufferManager] High latency detected: 55ms',
      );
    });

    it('should recommend optimizations for low-end devices', () => {
      // Mock low-end device
      const mockManager = audioManager as any;
      mockManager.deviceProfile = {
        isLowEnd: true,
        recommendedBufferSize: 512,
      };
      mockManager.audioContext = {
        baseLatency: 0.03,
        outputLatency: 0.025,
      };

      audioManager.optimizeBufferSettings();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Recommending larger buffer size for stability',
      );
    });

    it('should warn about high memory usage', async () => {
      // Mock high memory usage
      const mockManager = audioManager as any;
      mockManager.calculateMemoryUsage = vi.fn(() => 60); // 60MB

      audioManager.optimizeBufferSettings();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[AudioBufferManager] High memory usage: 60MB',
      );
    });
  });

  describe('Asset Cleanup', () => {
    it('should start periodic cleanup', () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30000, // 30 second cleanup interval
      );
    });

    it('should clean up unused assets', async () => {
      audioManager.registerAudioAsset('unused', '/audio/unused.wav', 'low');
      await audioManager.getAudioBuffer('unused');

      // Mock old access time
      const mockManager = audioManager as any;
      const asset = mockManager.audioAssets.get('unused');
      if (asset) {
        asset.lastAccessed = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      }

      // Trigger cleanup
      mockManager.cleanupUnusedAssets();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Cleaned up unused asset: unused',
      );
    });

    it('should not clean up high priority or preloaded assets', async () => {
      audioManager.registerAudioAsset(
        'high-priority',
        '/audio/high.wav',
        'high',
      );
      audioManager.registerAudioAsset(
        'preloaded',
        '/audio/preload.wav',
        'medium',
        true,
      );

      // Mock old access times
      const mockManager = audioManager as any;
      ['high-priority', 'preloaded'].forEach((name) => {
        const asset = mockManager.audioAssets.get(name);
        if (asset) {
          asset.lastAccessed = Date.now() - 6 * 60 * 1000;
        }
      });

      const assetCountBefore = mockManager.audioAssets.size;
      mockManager.cleanupUnusedAssets();
      const assetCountAfter = mockManager.audioAssets.size;

      expect(assetCountAfter).toBe(assetCountBefore);
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance report', async () => {
      audioManager.registerAudioAsset(
        'report-test',
        '/audio/report.wav',
        'high',
        true,
      );
      await audioManager.getAudioBuffer('report-test');

      const report = audioManager.generatePerformanceReport();

      expect(report).toContain('Audio Performance Report');
      expect(report).toContain('Current Metrics');
      expect(report).toContain('Device Profile');
      expect(report).toContain('Audio Assets');
      expect(report).toContain('Performance Status');
      expect(report).toContain('report-test');
    });

    it('should show performance status indicators', () => {
      const report = audioManager.generatePerformanceReport();

      expect(report).toMatch(/✅|⚠️/); // Should contain status indicators
    });
  });

  describe('Audio Context Management', () => {
    it('should handle missing Web Audio API', async () => {
      // Destroy existing instance first
      await audioManager.destroy();

      // Remove both global and window AudioContext
      delete (global.window as any).AudioContext;
      delete (global as any).AudioContext;

      const _manager = AudioBufferManager.getInstance();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[AudioBufferManager] Web Audio API not available',
      );
    });

    it('should handle audio context initialization errors', async () => {
      // Destroy existing instance first
      await audioManager.destroy();

      // Mock constructor that throws for both global and window
      const ThrowingAudioContext = vi.fn(() => {
        throw new Error('Audio context failed');
      });

      global.AudioContext = ThrowingAudioContext as any;
      (global.window as any).AudioContext = ThrowingAudioContext;

      const _manager = AudioBufferManager.getInstance();

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[AudioBufferManager] Failed to initialize audio context:',
        expect.any(Error),
      );
    });
  });

  describe('Destruction and Cleanup', () => {
    it('should stop timers on destroy', async () => {
      await audioManager.destroy();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
    });

    it('should close audio context on destroy', async () => {
      const mockClose = vi.fn();
      (audioManager as any).audioContext = {
        state: 'running',
        close: mockClose,
      };

      await audioManager.destroy();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should clear all data on destroy', async () => {
      audioManager.registerAudioAsset('destroy-test', '/audio/destroy.wav');

      await audioManager.destroy();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[AudioBufferManager] Destroyed',
      );
    });
  });
});
