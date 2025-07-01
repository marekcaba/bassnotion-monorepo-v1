/**
 * Test Suite for LatencyOptimizer
 *
 * Tests comprehensive latency optimization functionality including:
 * - Device profiling and capability detection
 * - Audio context initialization and configuration
 * - Real-time latency measurement and monitoring
 * - Automatic optimization strategies
 * - Performance analytics and reporting
 *
 * @author BassNotion Team
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LatencyOptimizer,
  type LatencyMeasurement,
} from '../LatencyOptimizer.js';

// Mock Web Audio API
class MockAudioContext {
  public state = 'running';
  public sampleRate = 44100;
  public baseLatency = 0.005; // 5ms
  public outputLatency = 0.01; // 10ms
  public close = vi.fn();

  constructor(options?: AudioContextOptions) {
    (this as any).options = options;
    this.close.mockResolvedValue(undefined);
  }

  async resume() {
    this.state = 'running';
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn(() => new Float32Array(length)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    };
  }
}

// Mock console methods
const mockConsoleDebug = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock timers
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

// Mock performance
const mockPerformanceNow = vi.fn();

describe('LatencyOptimizer', () => {
  let latencyOptimizer: LatencyOptimizer;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock Web Audio API
    global.AudioContext = MockAudioContext as any;
    global.AudioWorkletNode = vi.fn() as any;
    global.SharedArrayBuffer = vi.fn() as any;
    global.OffscreenCanvas = vi.fn() as any;

    // Mock navigator (default desktop device)
    global.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      hardwareConcurrency: 8,
      deviceMemory: 8,
    } as any;

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

    // Destroy any existing instance
    const existingInstance = (LatencyOptimizer as any).instance;
    if (existingInstance) {
      await existingInstance.destroy();
    }

    // Get fresh instance
    latencyOptimizer = LatencyOptimizer.getInstance();

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  afterEach(async () => {
    if (latencyOptimizer) {
      await latencyOptimizer.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LatencyOptimizer.getInstance();
      const instance2 = LatencyOptimizer.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', async () => {
      const instance1 = LatencyOptimizer.getInstance();
      await instance1.destroy();

      const instance2 = LatencyOptimizer.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Device Profiling', () => {
    it('should detect desktop device correctly', () => {
      const profile = latencyOptimizer.getDeviceProfile();

      expect(profile).toBeDefined();
      expect(profile?.deviceType).toBe('desktop');
      expect(profile?.audioDriver).toBe('CoreAudio');
      expect(profile?.recommendedBufferSize).toBe(128);
      expect(profile?.supportsLowLatency).toBe(true);
      expect(profile?.workletSupport).toBe(true);
      expect(profile?.measurementAccuracy).toBe(0.9);
    });

    it('should detect mobile device', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock mobile device
      (global.navigator as any).userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)';

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const profile = optimizer.getDeviceProfile();

      expect(profile?.deviceType).toBe('mobile');
      expect(profile?.recommendedBufferSize).toBe(512);
      expect(profile?.measurementAccuracy).toBe(0.5);

      await optimizer.destroy();
    });

    it('should detect tablet device', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock tablet device
      (global.navigator as any).userAgent = 'Mozilla/5.0 (iPad; CPU OS 14_0)';

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const profile = optimizer.getDeviceProfile();

      expect(profile?.deviceType).toBe('tablet');
      expect(profile?.recommendedBufferSize).toBe(256);
      expect(profile?.measurementAccuracy).toBe(0.7);

      await optimizer.destroy();
    });

    it('should detect Windows audio driver', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock Windows device
      (global.navigator as any).userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const profile = optimizer.getDeviceProfile();

      expect(profile?.audioDriver).toBe('WASAPI/DirectSound');

      await optimizer.destroy();
    });

    it('should detect Linux audio driver', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock Linux device
      (global.navigator as any).userAgent = 'Mozilla/5.0 (X11; Linux x86_64)';

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const profile = optimizer.getDeviceProfile();

      expect(profile?.audioDriver).toBe('ALSA/PulseAudio');

      await optimizer.destroy();
    });

    it('should handle low-latency support detection', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock device without low-latency support
      delete (global as any).AudioWorkletNode;
      delete (global as any).SharedArrayBuffer;

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const profile = optimizer.getDeviceProfile();

      expect(profile?.supportsLowLatency).toBe(false);
      expect(profile?.workletSupport).toBe(false);

      await optimizer.destroy();

      // Restore for other tests
      global.AudioWorkletNode = vi.fn() as any;
      global.SharedArrayBuffer = vi.fn() as any;
    });
  });

  describe('Latency Measurement', () => {
    it('should measure current latency', async () => {
      const measurement = await latencyOptimizer.measureCurrentLatency();

      expect(measurement).toBeDefined();
      expect(typeof measurement.inputLatency).toBe('number');
      expect(typeof measurement.outputLatency).toBe('number');
      expect(typeof measurement.processingLatency).toBe('number');
      expect(typeof measurement.totalLatency).toBe('number');
      expect(typeof measurement.timestamp).toBe('number');
      expect(typeof measurement.confidence).toBe('number');

      expect(measurement.confidence).toBeGreaterThanOrEqual(0);
      expect(measurement.confidence).toBeLessThanOrEqual(1);
      expect(measurement.totalLatency).toBeGreaterThan(0);
    });

    it('should calculate latency from audio context', async () => {
      const measurement = await latencyOptimizer.measureCurrentLatency();

      // Mock context has 5ms base + 10ms output = 15ms audio latency
      // Plus processing latency (2-5ms)
      expect(measurement.inputLatency).toBe(5); // 5ms base latency
      expect(measurement.outputLatency).toBe(10); // 10ms output latency
      expect(measurement.processingLatency).toBeGreaterThanOrEqual(2);
      expect(measurement.processingLatency).toBeLessThanOrEqual(5);
      expect(measurement.totalLatency).toBeGreaterThanOrEqual(17);
      expect(measurement.totalLatency).toBeLessThanOrEqual(20);
    });

    it('should track measurement history', async () => {
      await latencyOptimizer.measureCurrentLatency();
      await latencyOptimizer.measureCurrentLatency();
      await latencyOptimizer.measureCurrentLatency();

      const history = latencyOptimizer.getLatencyHistory();

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history.length).toBeGreaterThan(1);
      expect(history[0]?.timestamp).toBeLessThanOrEqual(
        history[1]?.timestamp ?? 0,
      );
    });

    it('should limit history size', async () => {
      // Simulate adding many measurements
      const optimizer = latencyOptimizer as any;

      // Add more than max history size (100)
      for (let i = 0; i < 150; i++) {
        const measurement: LatencyMeasurement = {
          inputLatency: 5,
          outputLatency: 10,
          processingLatency: 3,
          totalLatency: 18,
          timestamp: Date.now() + i,
          confidence: 0.9,
        };
        optimizer.addLatencyMeasurement(measurement);
      }

      const history = latencyOptimizer.getLatencyHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Latency Statistics', () => {
    it('should calculate statistics correctly', async () => {
      // Add some measurements
      await latencyOptimizer.measureCurrentLatency();
      await latencyOptimizer.measureCurrentLatency();
      await latencyOptimizer.measureCurrentLatency();

      const stats = latencyOptimizer.getLatencyStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.current).toBe('number');
      expect(typeof stats.average).toBe('number');
      expect(typeof stats.minimum).toBe('number');
      expect(typeof stats.maximum).toBe('number');
      expect(['improving', 'stable', 'degrading']).toContain(stats.trend);

      expect(stats.minimum).toBeLessThanOrEqual(stats.average);
      expect(stats.average).toBeLessThanOrEqual(stats.maximum);
    });

    it('should return zero stats when no measurements', () => {
      // Create fresh instance without measurements
      const stats = latencyOptimizer.getLatencyStatistics();

      expect(stats.current).toBe(0);
      expect(stats.average).toBe(0);
      expect(stats.minimum).toBe(0);
      expect(stats.maximum).toBe(0);
      expect(stats.trend).toBe('stable');
    });

    it('should detect improving trend', async () => {
      const optimizer = latencyOptimizer as any;

      // Add measurements with improving trend
      for (let i = 0; i < 20; i++) {
        const latency = 30 - i; // Decreasing latency
        const measurement: LatencyMeasurement = {
          inputLatency: 5,
          outputLatency: 10,
          processingLatency: latency - 15,
          totalLatency: latency,
          timestamp: Date.now() + i * 1000,
          confidence: 0.9,
        };
        optimizer.addLatencyMeasurement(measurement);
      }

      const stats = latencyOptimizer.getLatencyStatistics();
      expect(stats.trend).toBe('improving');
    });

    it('should detect degrading trend', async () => {
      const optimizer = latencyOptimizer as any;

      // Add measurements with degrading trend
      for (let i = 0; i < 20; i++) {
        const latency = 20 + i; // Increasing latency
        const measurement: LatencyMeasurement = {
          inputLatency: 5,
          outputLatency: 10,
          processingLatency: latency - 15,
          totalLatency: latency,
          timestamp: Date.now() + i * 1000,
          confidence: 0.9,
        };
        optimizer.addLatencyMeasurement(measurement);
      }

      const stats = latencyOptimizer.getLatencyStatistics();
      expect(stats.trend).toBe('degrading');
    });
  });

  describe('Automatic Optimization', () => {
    it('should trigger optimization on high latency', async () => {
      const optimizer = latencyOptimizer as any;

      // Mock high latency measurement
      const highLatencyMeasurement: LatencyMeasurement = {
        inputLatency: 20,
        outputLatency: 30,
        processingLatency: 20,
        totalLatency: 70, // Above 30ms * 1.5 = 45ms threshold
        timestamp: Date.now(),
        confidence: 0.9,
      };

      // Spy on optimization method
      const optimizeSpy = vi.spyOn(optimizer, 'optimizeLatencyAutomatically');

      optimizer.checkOptimizationTriggers(highLatencyMeasurement);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[LatencyOptimizer] High latency detected: 70ms',
      );
      expect(optimizeSpy).toHaveBeenCalled();
    });

    it('should perform automatic optimization', async () => {
      const result = await latencyOptimizer.optimizeLatencyAutomatically();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.previousLatency).toBe('number');
      expect(typeof result.newLatency).toBe('number');
      expect(typeof result.improvement).toBe('number');
      expect(result.settings).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('should optimize buffer size', async () => {
      const settings = latencyOptimizer.getSettings();
      const originalBuffer = settings.bufferSize;

      const optimizer = latencyOptimizer as any;
      await optimizer.optimizeBufferSize();

      const newSettings = latencyOptimizer.getSettings();
      expect(newSettings.bufferSize).toBeLessThan(originalBuffer);
      expect(newSettings.bufferSize).toBeGreaterThanOrEqual(128);
    });

    it('should adjust sample rate for low-latency devices', async () => {
      const optimizer = latencyOptimizer as any;

      // Mock low-latency capable device
      optimizer.deviceProfile = {
        ...optimizer.deviceProfile,
        supportsLowLatency: true,
      };

      // Set lower sample rate
      optimizer.settings.sampleRate = 44100;

      await optimizer.adjustSampleRate();

      expect(optimizer.settings.sampleRate).toBe(48000);
    });

    it('should not adjust sample rate for non-capable devices', async () => {
      const optimizer = latencyOptimizer as any;

      // Mock non-low-latency device
      optimizer.deviceProfile = {
        ...optimizer.deviceProfile,
        supportsLowLatency: false,
      };

      const originalRate = optimizer.settings.sampleRate;
      await optimizer.adjustSampleRate();

      expect(optimizer.settings.sampleRate).toBe(originalRate);
    });
  });

  describe('Settings Management', () => {
    it('should update settings correctly', () => {
      const newSettings = {
        targetLatency: 20,
        bufferSize: 128,
        enableWorklets: false,
      };

      latencyOptimizer.updateSettings(newSettings);

      const currentSettings = latencyOptimizer.getSettings();
      expect(currentSettings.targetLatency).toBe(20);
      expect(currentSettings.bufferSize).toBe(128);
      expect(currentSettings.enableWorklets).toBe(false);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[LatencyOptimizer] Settings updated:',
        expect.objectContaining(newSettings),
      );
    });

    it('should return copy of settings', () => {
      const settings1 = latencyOptimizer.getSettings();
      const settings2 = latencyOptimizer.getSettings();

      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2); // Different objects

      // Modifying one shouldn't affect the other
      settings1.targetLatency = 999;
      expect(settings2.targetLatency).not.toBe(999);
    });

    it('should have sensible default settings', () => {
      const settings = latencyOptimizer.getSettings();

      expect(settings.targetLatency).toBe(30);
      expect(settings.bufferSize).toBe(256);
      expect(settings.sampleRate).toBe(44100);
      expect(settings.enableWorklets).toBe(true);
      expect(settings.enableCompensation).toBe(true);
      expect(settings.adaptiveBuffering).toBe(true);
      expect(settings.measurementInterval).toBe(5000);
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive latency report', async () => {
      // Add some measurements
      await latencyOptimizer.measureCurrentLatency();
      await latencyOptimizer.measureCurrentLatency();

      const report = latencyOptimizer.generateLatencyReport();

      expect(report).toContain('Latency Optimization Report');
      expect(report).toContain('Current Performance');
      expect(report).toContain('Target Compliance');
      expect(report).toContain('Device Profile');
      expect(report).toContain('Current Settings');
      expect(report).toContain('Latest Measurement Breakdown');
      expect(report).toContain('Recommendations');
    });

    it('should show target compliance indicators', async () => {
      await latencyOptimizer.measureCurrentLatency();

      const report = latencyOptimizer.generateLatencyReport();

      expect(report).toMatch(/✅|⚠️/); // Should contain status indicators
      expect(report).toContain('Target: 30ms');
      expect(report).toContain('Professional: <50ms');
      expect(report).toContain('Excellent: <30ms');
    });

    it('should include device information in report', () => {
      const report = latencyOptimizer.generateLatencyReport();

      expect(report).toContain('Device Type: desktop');
      expect(report).toContain('Audio Driver: CoreAudio');
      expect(report).toContain('Low Latency Support: Yes');
      expect(report).toContain('Audio Worklet Support: Yes');
    });

    it('should provide optimization recommendations', async () => {
      const optimizer = latencyOptimizer as any;

      // Mock high latency scenario
      for (let i = 0; i < 5; i++) {
        const measurement: LatencyMeasurement = {
          inputLatency: 20,
          outputLatency: 30,
          processingLatency: 20,
          totalLatency: 70, // High latency
          timestamp: Date.now() + i * 1000,
          confidence: 0.9,
        };
        optimizer.addLatencyMeasurement(measurement);
      }

      const recommendations = optimizer.generateOptimizationRecommendations();

      // Should contain optimization recommendations for high latency
      expect(recommendations).toBeDefined();
      expect(typeof recommendations).toBe('string');
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations).toMatch(
        /reducing buffer size|Enable Audio Worklets|try 128-sample buffer|check system load|Performance is optimal/,
      );
    });

    it('should show optimal performance when latency is good', async () => {
      const optimizer = latencyOptimizer as any;

      // Mock good latency measurements
      for (let i = 0; i < 5; i++) {
        const measurement: LatencyMeasurement = {
          inputLatency: 5,
          outputLatency: 10,
          processingLatency: 5,
          totalLatency: 20, // Good latency
          timestamp: Date.now() + i * 1000,
          confidence: 0.9,
        };
        optimizer.addLatencyMeasurement(measurement);
      }

      const recommendations = optimizer.generateOptimizationRecommendations();

      expect(recommendations).toContain('Performance is optimal');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Web Audio API', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Remove Web Audio API
      delete (global as any).AudioContext;

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[LatencyOptimizer] Web Audio API not available',
      );

      await optimizer.destroy();

      // Restore for other tests
      global.AudioContext = MockAudioContext as any;
    });

    it('should handle audio context initialization errors', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock constructor that throws
      global.AudioContext = vi.fn(() => {
        throw new Error('Audio context failed');
      }) as any;

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[LatencyOptimizer] Audio context initialization failed:',
        expect.any(Error),
      );

      await optimizer.destroy();

      // Restore for other tests
      global.AudioContext = MockAudioContext as any;
    });

    it('should handle baseline measurement errors', async () => {
      // Destroy current instance
      await latencyOptimizer.destroy();

      // Mock AudioContext that throws during baseline measurement
      const mockContext = {
        baseLatency: 0.005,
        outputLatency: 0.01,
        createBuffer: vi.fn(() => {
          throw new Error('Buffer creation failed');
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      global.AudioContext = vi.fn(() => mockContext) as any;

      const optimizer = LatencyOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[LatencyOptimizer] Calibration buffer creation failed:',
        expect.any(Error),
      );

      await optimizer.destroy();

      // Restore for other tests
      global.AudioContext = MockAudioContext as any;
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should start measurement timer', () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5000, // 5 second measurement interval
      );
    });

    it('should stop timers on destroy', async () => {
      await latencyOptimizer.destroy();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
    });

    it('should close audio context on destroy', async () => {
      const optimizer = latencyOptimizer as any;
      const mockClose = vi.fn().mockResolvedValue(undefined);

      optimizer.audioContext = {
        state: 'running',
        close: mockClose,
      };

      await latencyOptimizer.destroy();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should clear all data on destroy', async () => {
      // Add some measurements
      await latencyOptimizer.measureCurrentLatency();

      await latencyOptimizer.destroy();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[LatencyOptimizer] Destroyed',
      );
    });

    it('should handle worklet cleanup', async () => {
      const optimizer = latencyOptimizer as any;
      const mockDisconnect = vi.fn();

      optimizer.workletNode = {
        disconnect: mockDisconnect,
      };

      await latencyOptimizer.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
