/**
 * InstrumentAssetOptimizer Tests
 *
 * Tests instrument-specific asset optimization and caching strategies
 * for bass samples, drum hits, and MIDI files.
 *
 * Part of Story 2.2: Task 7, Subtask 7.3
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  InstrumentAssetOptimizer,
  type InstrumentOptimizationConfig,
} from '../plugins/InstrumentAssetOptimizer.js';
import type {
  DeviceCapabilities,
  NetworkCapabilities,
  AssetLoadResult,
} from '../../types/audio.js';

// Enhanced AudioBuffer Mock for Node.js test environment
class MockAudioBuffer {
  public readonly length: number;
  public readonly sampleRate: number;
  public readonly numberOfChannels: number;
  public readonly duration: number;

  constructor(options: {
    length: number;
    sampleRate: number;
    numberOfChannels?: number;
  }) {
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.numberOfChannels = options.numberOfChannels || 2;
    this.duration = this.length / this.sampleRate;
  }

  getChannelData(channel: number): Float32Array {
    if (channel >= this.numberOfChannels) {
      throw new Error(`Channel ${channel} does not exist`);
    }
    return new Float32Array(this.length);
  }

  copyFromChannel(
    destination: Float32Array,
    channelNumber: number,
    startInChannel?: number,
  ): void {
    const start = startInChannel || 0;
    const source = this.getChannelData(channelNumber);
    destination.set(source.slice(start, start + destination.length));
  }

  copyToChannel(
    source: Float32Array,
    channelNumber: number,
    startInChannel?: number,
  ): void {
    const start = startInChannel || 0;
    const destination = this.getChannelData(channelNumber);
    destination.set(source, start);
  }
}

// Set up global AudioBuffer mock
global.AudioBuffer = MockAudioBuffer as any;

// Mock the AssetManager
vi.mock('../AssetManager.js', () => ({
  AssetManager: {
    getInstance: vi.fn(() => ({
      loadAsset: vi.fn(),
    })),
  },
}));

describe('InstrumentAssetOptimizer', () => {
  let optimizer: InstrumentAssetOptimizer;
  let mockAssetManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    optimizer = new InstrumentAssetOptimizer();
    mockAssetManager = optimizer['assetManager'];
  });

  describe('Initialization', () => {
    test('should initialize with default optimization strategies', () => {
      const settings = optimizer.exportOptimizationSettings();

      expect(settings.strategies.bass).toEqual({
        noteRange: { low: 'B0', high: 'G4' },
        velocityLayers: 6,
        roundRobinSamples: 3,
        sustainSamples: true,
        palmMuteSamples: true,
        harmonics: false,
        fretNoiseReduction: true,
        stringOptimization: true,
      });

      expect(settings.strategies.drums).toEqual({
        kitPieces: [
          'kick',
          'snare',
          'hihat_closed',
          'hihat_open',
          'crash',
          'ride',
        ],
        velocityLayers: 4,
        roomSamples: false,
        closeMics: true,
        overheads: false,
        ambientTails: true,
        bleedReduction: true,
        fillOptimization: true,
      });
    });

    test('should start with empty optimization configurations', () => {
      const settings = optimizer.exportOptimizationSettings();
      expect(Object.keys(settings.configs)).toHaveLength(0);
    });
  });

  describe('Configuration Management', () => {
    test('should configure instrument optimization', () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'intelligent',
        compressionLevel: 'light',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.configs.bass).toEqual(config);
    });

    test('should configure multiple instruments', () => {
      const bassConfig: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'none',
        priorityScheme: 'frequency',
      };

      const drumConfig: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'medium',
        cacheStrategy: 'memory',
        compressionLevel: 'light',
        priorityScheme: 'user_preference',
      };

      optimizer.configureInstrumentOptimization('bass', bassConfig);
      optimizer.configureInstrumentOptimization('drums', drumConfig);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.configs.bass).toEqual(bassConfig);
      expect(settings.configs.drums).toEqual(drumConfig);
    });
  });

  describe('Device Capabilities Optimization', () => {
    test('should optimize for low-end devices', () => {
      const lowEndCapabilities: DeviceCapabilities = {
        cpuCores: 2,
        memoryGB: 2,
        architecture: 'arm64',
        gpuSupport: false,
        maxSampleRate: 44100,
        minBufferSize: 512,
        maxPolyphony: 4,
        audioWorkletSupport: false,
        sharedArrayBufferSupport: false,
        deviceClass: 'low-end',
        platformVersion: '10.0',
        isTablet: false,
        screenSize: { width: 375, height: 667 },
        performanceScore: 0.3,
        thermalThrottlingThreshold: 60,
      };

      optimizer.setDeviceCapabilities(lowEndCapabilities);

      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'none',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.strategies.bass.velocityLayers).toBe(3);
      expect(settings.strategies.bass.roundRobinSamples).toBe(1);
      expect(settings.strategies.bass.palmMuteSamples).toBe(false);
      expect(settings.strategies.bass.harmonics).toBe(false);
    });

    test('should optimize for high-end devices', () => {
      const highEndCapabilities: DeviceCapabilities = {
        cpuCores: 8,
        memoryGB: 8,
        architecture: 'arm64',
        gpuSupport: true,
        maxSampleRate: 96000,
        minBufferSize: 128,
        maxPolyphony: 32,
        audioWorkletSupport: true,
        sharedArrayBufferSupport: true,
        deviceClass: 'premium',
        platformVersion: '15.0',
        isTablet: true,
        screenSize: { width: 1024, height: 768 },
        performanceScore: 0.9,
        thermalThrottlingThreshold: 80,
      };

      optimizer.setDeviceCapabilities(highEndCapabilities);

      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'medium',
        cacheStrategy: 'memory',
        compressionLevel: 'medium',
        priorityScheme: 'adaptive',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.strategies.bass.velocityLayers).toBe(6);
      expect(settings.strategies.bass.roundRobinSamples).toBe(3);
      expect(settings.strategies.bass.palmMuteSamples).toBe(true);
      expect(settings.strategies.bass.harmonics).toBe(true);
    });

    test('should optimize drums for device memory constraints', () => {
      const memoryConstrainedDevice: DeviceCapabilities = {
        cpuCores: 4,
        memoryGB: 3,
        architecture: 'arm64',
        gpuSupport: true,
        maxSampleRate: 48000,
        minBufferSize: 256,
        maxPolyphony: 16,
        audioWorkletSupport: true,
        sharedArrayBufferSupport: false,
        deviceClass: 'mid-range',
        platformVersion: '13.0',
        isTablet: false,
        screenSize: { width: 414, height: 896 },
        performanceScore: 0.6,
        thermalThrottlingThreshold: 70,
      };

      optimizer.setDeviceCapabilities(memoryConstrainedDevice);

      const config: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'high',
        cacheStrategy: 'hybrid',
        compressionLevel: 'light',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('drums', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.strategies.drums.velocityLayers).toBe(3);
      expect(settings.strategies.drums.roomSamples).toBe(false);
      expect(settings.strategies.drums.overheads).toBe(false); // Memory < 4GB
    });

    test('should optimize chord polyphony for device capabilities', () => {
      const limitedPolyphonyDevice: DeviceCapabilities = {
        cpuCores: 2,
        memoryGB: 4,
        architecture: 'x86_64',
        gpuSupport: false,
        maxSampleRate: 44100,
        minBufferSize: 512,
        maxPolyphony: 6,
        audioWorkletSupport: false,
        sharedArrayBufferSupport: false,
        deviceClass: 'low-end',
        platformVersion: '11.0',
        isTablet: false,
        screenSize: { width: 320, height: 568 },
        performanceScore: 0.4,
        thermalThrottlingThreshold: 65,
      };

      optimizer.setDeviceCapabilities(limitedPolyphonyDevice);

      const config: InstrumentOptimizationConfig = {
        instrument: 'chords',
        quality: 'medium',
        cacheStrategy: 'memory',
        compressionLevel: 'medium',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('chords', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.strategies.chords.polyphonyLimit).toBe(4); // Min of 4 and maxPolyphony 6
      expect(settings.strategies.chords.dynamicVoicing).toBe(false);
      expect(settings.strategies.chords.layerBlending).toBe(false);
    });
  });

  describe('Network Capabilities Optimization', () => {
    test('should optimize for slow network connections', () => {
      const slowNetwork: NetworkCapabilities = {
        connectionType: '3g',
        effectiveType: '2g',
        downlink: 0.5, // 0.5 Mbps
        rtt: 300,
        saveData: true,
        isMetered: true,
        bandwidth: 500,
        latency: 300,
      };

      optimizer.setNetworkCapabilities(slowNetwork);

      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'none',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.configs.bass).toBeDefined();
      expect(settings.configs.bass!.quality).toBe('minimal');
      expect(settings.configs.bass!.compressionLevel).toBe('aggressive');
      expect(settings.configs.bass!.cacheStrategy).toBe('memory');
    });

    test('should optimize for fast network connections', () => {
      const fastNetwork: NetworkCapabilities = {
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 50, // 50 Mbps
        rtt: 20,
        saveData: false,
        isMetered: false,
        bandwidth: 50000,
        latency: 20,
      };

      optimizer.setNetworkCapabilities(fastNetwork);

      const config: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'low',
        cacheStrategy: 'memory',
        compressionLevel: 'aggressive',
        priorityScheme: 'user_preference',
      };

      optimizer.configureInstrumentOptimization('drums', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.configs.drums).toBeDefined();
      expect(settings.configs.drums!.quality).toBe('high');
      expect(settings.configs.drums!.compressionLevel).toBe('none');
      expect(settings.configs.drums!.cacheStrategy).toBe('progressive');
    });

    test('should optimize for moderate network conditions', () => {
      const moderateNetwork: NetworkCapabilities = {
        connectionType: '4g',
        effectiveType: '3g',
        downlink: 10, // 10 Mbps
        rtt: 80,
        saveData: false,
        isMetered: true,
        bandwidth: 10000,
        latency: 80,
      };

      optimizer.setNetworkCapabilities(moderateNetwork);

      const config: InstrumentOptimizationConfig = {
        instrument: 'chords',
        quality: 'ultra',
        cacheStrategy: 'hybrid',
        compressionLevel: 'none',
        priorityScheme: 'adaptive',
      };

      optimizer.configureInstrumentOptimization('chords', config);

      const settings = optimizer.exportOptimizationSettings();
      expect(settings.configs.chords).toBeDefined();
      expect(settings.configs.chords!.quality).toBe('medium');
      expect(settings.configs.chords!.compressionLevel).toBe('light');
      expect(settings.configs.chords!.cacheStrategy).toBe('intelligent');
    });
  });

  describe('Asset Loading Optimization', () => {
    test('should optimize bass asset loading', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'light',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const mockAsset: AssetLoadResult = {
        url: 'bass-C2.wav',
        data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 100,
        compressionUsed: false,
        success: true,
        size: 4096,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      const assets = ['bass-C2.wav', 'bass-F2.wav'];
      const optimizedAssets = await optimizer.optimizeAssetLoading(
        'bass',
        assets,
      );

      expect(optimizedAssets).toHaveLength(2);
      expect(mockAssetManager.loadAsset).toHaveBeenCalledTimes(2);

      // Check if optimization metrics were updated
      const metrics = optimizer.getOptimizationMetrics('bass');
      expect(metrics).toBeDefined();
      expect(metrics!.loadTime).toBeGreaterThan(0);
    });

    test('should optimize drum asset loading with different strategies', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'medium',
        cacheStrategy: 'intelligent',
        compressionLevel: 'medium',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('drums', config);

      const mockAsset: AssetLoadResult = {
        url: 'kick.wav',
        data: new AudioBuffer({ length: 512, sampleRate: 44100 }),
        source: 'supabase',
        loadTime: 150,
        compressionUsed: true,
        success: true,
        size: 2048,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      const assets = ['kick.wav', 'snare.wav', 'hihat.wav'];
      const optimizedAssets = await optimizer.optimizeAssetLoading(
        'drums',
        assets,
      );

      expect(optimizedAssets).toHaveLength(3);

      const metrics = optimizer.getOptimizationMetrics('drums');
      expect(metrics).toBeDefined();
      expect(metrics!.qualityScore).toBeGreaterThan(0);
    });

    test('should handle asset loading failures gracefully', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'chords',
        quality: 'high',
        cacheStrategy: 'memory',
        compressionLevel: 'none',
        priorityScheme: 'user_preference',
      };

      optimizer.configureInstrumentOptimization('chords', config);

      mockAssetManager.loadAsset
        .mockResolvedValueOnce({
          url: 'chord-C.preset',
          data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
          source: 'cdn',
          loadTime: 80,
          compressionUsed: false,
          success: true,
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const assets = ['chord-C.preset', 'chord-F.preset'];
      const optimizedAssets = await optimizer.optimizeAssetLoading(
        'chords',
        assets,
      );

      expect(optimizedAssets).toHaveLength(1); // Only successful asset
      expect(optimizedAssets.length).toBeGreaterThan(0);
      if (optimizedAssets.length > 0) {
        expect(optimizedAssets[0]!.url).toBe('chord-C.preset');
      }
    });

    test('should throw error when no configuration exists', async () => {
      const assets = ['metronome-click.wav'];

      await expect(
        optimizer.optimizeAssetLoading('metronome', assets),
      ).rejects.toThrow('No optimization configuration found for metronome');
    });
  });

  describe('Caching System', () => {
    test('should cache optimized assets', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'medium',
        cacheStrategy: 'hybrid',
        compressionLevel: 'light',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const mockAsset: AssetLoadResult = {
        url: 'bass-G2.wav',
        data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 90,
        compressionUsed: true,
        success: true,
        size: 3072,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      // Load asset first time
      await optimizer.optimizeAssetLoading('bass', ['bass-G2.wav']);

      // Load same asset second time (should use cache)
      await optimizer.optimizeAssetLoading('bass', ['bass-G2.wav']);

      const status = optimizer.getOptimizationStatus();
      expect(status.totalCachedAssets).toBeGreaterThan(0);
    });

    test('should calculate cache hit rate', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'none',
        priorityScheme: 'adaptive',
      };

      optimizer.configureInstrumentOptimization('drums', config);

      const mockAsset: AssetLoadResult = {
        url: 'snare.wav',
        data: new AudioBuffer({ length: 512, sampleRate: 44100 }),
        source: 'supabase',
        loadTime: 120,
        compressionUsed: false,
        success: true,
        size: 2048,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      // Load multiple times to build cache frequency
      await optimizer.optimizeAssetLoading('drums', ['snare.wav']);
      await optimizer.optimizeAssetLoading('drums', ['snare.wav']);
      await optimizer.optimizeAssetLoading('drums', ['snare.wav']);

      const metrics = optimizer.getOptimizationMetrics('drums');
      expect(metrics).toBeDefined();
      expect(metrics!.cacheHitRate).toBeGreaterThan(0);
    });

    test('should maintain cache size limits', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'low',
        cacheStrategy: 'memory',
        compressionLevel: 'aggressive',
        priorityScheme: 'frequency',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const mockAsset: AssetLoadResult = {
        url: 'test-asset.wav',
        data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 100,
        compressionUsed: true,
        success: true,
        size: 4096,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      // Simulate loading many assets
      const manyAssets = Array.from({ length: 50 }, (_, i) => `asset-${i}.wav`);
      await optimizer.optimizeAssetLoading('bass', manyAssets);

      const status = optimizer.getOptimizationStatus();
      expect(status.totalCachedAssets).toBeLessThanOrEqual(1000); // Cache limit
    });
  });

  describe('Performance Metrics', () => {
    test('should track optimization metrics', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'metronome',
        quality: 'medium',
        cacheStrategy: 'intelligent',
        compressionLevel: 'light',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('metronome', config);

      const mockAsset: AssetLoadResult = {
        url: 'click-wood.wav',
        data: new AudioBuffer({ length: 256, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 50,
        compressionUsed: true,
        success: true,
        size: 1024,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      await optimizer.optimizeAssetLoading('metronome', ['click-wood.wav']);

      const metrics = optimizer.getOptimizationMetrics('metronome');
      expect(metrics).toBeDefined();
      expect(metrics!).toMatchObject({
        loadTime: expect.any(Number),
        memoryUsage: expect.any(Number),
        cacheHitRate: expect.any(Number),
        qualityScore: expect.any(Number),
        userSatisfaction: expect.any(Number),
        performanceImpact: expect.any(Number),
        networkUsage: expect.any(Number),
        batteryImpact: expect.any(Number),
      });
    });

    test('should calculate memory usage correctly', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'chords',
        quality: 'ultra',
        cacheStrategy: 'progressive',
        compressionLevel: 'none',
        priorityScheme: 'user_preference',
      };

      optimizer.configureInstrumentOptimization('chords', config);

      const largeAsset: AssetLoadResult = {
        url: 'chord-complex.preset',
        data: new AudioBuffer({
          length: 44100 * 2, // 2 seconds at 44.1kHz
          sampleRate: 44100,
          numberOfChannels: 2,
        }),
        source: 'supabase',
        loadTime: 200,
        compressionUsed: false,
        success: true,
        size: 352800, // 44100 * 2 * 2 * 4 bytes
      };

      mockAssetManager.loadAsset.mockResolvedValue(largeAsset);

      await optimizer.optimizeAssetLoading('chords', ['chord-complex.preset']);

      const metrics = optimizer.getOptimizationMetrics('chords');
      expect(metrics!.memoryUsage).toBeGreaterThan(300000); // Expected memory usage
    });
  });

  describe('Optimization Status', () => {
    test('should provide comprehensive optimization status', async () => {
      // Configure multiple instruments
      const bassConfig: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'high',
        cacheStrategy: 'progressive',
        compressionLevel: 'light',
        priorityScheme: 'frequency',
      };

      const drumConfig: InstrumentOptimizationConfig = {
        instrument: 'drums',
        quality: 'medium',
        cacheStrategy: 'memory',
        compressionLevel: 'medium',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('bass', bassConfig);
      optimizer.configureInstrumentOptimization('drums', drumConfig);

      const mockAsset: AssetLoadResult = {
        url: 'test.wav',
        data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 100,
        compressionUsed: false,
        success: true,
        size: 4096,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      // Load some assets
      await optimizer.optimizeAssetLoading('bass', ['bass-test.wav']);
      await optimizer.optimizeAssetLoading('drums', ['drum-test.wav']);

      const status = optimizer.getOptimizationStatus();

      expect(status.optimizedInstruments).toContain('bass');
      expect(status.optimizedInstruments).toContain('drums');
      expect(status.totalCachedAssets).toBeGreaterThan(0);
      expect(status.cacheMemoryUsage).toBeGreaterThan(0);
      expect(status.averageCacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Management', () => {
    test('should clear cache and reset metrics', async () => {
      const config: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'medium',
        cacheStrategy: 'hybrid',
        compressionLevel: 'light',
        priorityScheme: 'adaptive',
      };

      optimizer.configureInstrumentOptimization('bass', config);

      const mockAsset: AssetLoadResult = {
        url: 'bass-clear-test.wav',
        data: new AudioBuffer({ length: 1024, sampleRate: 44100 }),
        source: 'cdn',
        loadTime: 100,
        compressionUsed: false,
        success: true,
        size: 4096,
      };

      mockAssetManager.loadAsset.mockResolvedValue(mockAsset);

      await optimizer.optimizeAssetLoading('bass', ['bass-clear-test.wav']);

      let status = optimizer.getOptimizationStatus();
      expect(status.totalCachedAssets).toBeGreaterThan(0);

      optimizer.clearCache();

      status = optimizer.getOptimizationStatus();
      expect(status.totalCachedAssets).toBe(0);
      expect(status.cacheMemoryUsage).toBe(0);

      const metrics = optimizer.getOptimizationMetrics('bass');
      expect(metrics).toBeNull();
    });
  });

  describe('Export/Import Settings', () => {
    test('should export optimization settings', () => {
      const bassConfig: InstrumentOptimizationConfig = {
        instrument: 'bass',
        quality: 'ultra',
        cacheStrategy: 'intelligent',
        compressionLevel: 'none',
        priorityScheme: 'musical_context',
      };

      optimizer.configureInstrumentOptimization('bass', bassConfig);

      const settings = optimizer.exportOptimizationSettings();

      expect(settings.configs.bass).toEqual(bassConfig);
      expect(settings.strategies.bass).toBeDefined();
      expect(settings.strategies.drums).toBeDefined();
      expect(settings.strategies.chords).toBeDefined();
      expect(settings.strategies.metronome).toBeDefined();
    });
  });
});
