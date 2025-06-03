/**
 * MobileOptimizer Tests
 *
 * Comprehensive unit tests for mobile optimization and adaptive quality scaling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MobileOptimizer } from '../MobileOptimizer.js';
import type {
  AudioPerformanceMetrics,
  UserOptimizationPreferences,
} from '../../types/audio.js';

// Mock browser APIs
const mockNavigator = {
  hardwareConcurrency: 8,
  deviceMemory: 8,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
  platform: 'iPhone',
  getBattery: vi.fn(),
};

const mockScreen = {
  width: 1920,
  height: 1080,
};

const mockPerformance = {
  now: vi.fn(() => Date.now()),
};

// Mock AudioContext
const mockAudioContext = {
  sampleRate: 48000,
  baseLatency: 0.005,
  audioWorklet: {
    addModule: vi.fn().mockResolvedValue(undefined),
  },
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock battery API
const mockBattery = {
  level: 0.8,
  charging: false,
  chargingTime: Infinity,
  dischargingTime: 600, // 10 hours
};

describe('MobileOptimizer', () => {
  let optimizer: MobileOptimizer;

  beforeEach(() => {
    // Reset global mocks
    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('screen', mockScreen);
    vi.stubGlobal('performance', mockPerformance);
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => mockAudioContext),
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.stubGlobal('SharedArrayBuffer', function SharedArrayBuffer() {});

    // Mock getBattery
    mockNavigator.getBattery.mockResolvedValue(mockBattery);

    // Reset singleton
    (MobileOptimizer as any).instance = undefined;

    optimizer = MobileOptimizer.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    optimizer.dispose();
  });

  describe('Initialization', () => {
    it('should create singleton instance', () => {
      const optimizer1 = MobileOptimizer.getInstance();
      const optimizer2 = MobileOptimizer.getInstance();

      expect(optimizer1).toBe(optimizer2);
    });

    it('should detect device capabilities correctly', async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const capabilities = optimizer.getDeviceCapabilities();

      expect(capabilities).toMatchObject({
        cpuCores: 8,
        memoryGB: 8,
        deviceClass: 'premium', // Should classify as premium with 8 cores and 8GB
        maxSampleRate: 48000,
        audioWorkletSupport: expect.any(Boolean),
        sharedArrayBufferSupport: true,
      });
    });

    it('should initialize with appropriate quality config', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      expect(qualityConfig).toHaveProperty('qualityLevel');
      expect(qualityConfig).toHaveProperty('sampleRate');
      expect(qualityConfig).toHaveProperty('bufferSize');
      expect(qualityConfig).toHaveProperty('estimatedBatteryImpact');
    });
  });

  describe('Device Classification', () => {
    it('should classify low-end devices correctly', async () => {
      // Mock low-end device
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        hardwareConcurrency: 2,
        deviceMemory: 2,
      });

      const lowEndOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const capabilities = lowEndOptimizer.getDeviceCapabilities();
      expect(capabilities.deviceClass).toBe('low-end');

      const qualityConfig = lowEndOptimizer.getCurrentQualityConfig();
      expect(qualityConfig.qualityLevel).toBe('low');
      expect(qualityConfig.maxPolyphony).toBeLessThanOrEqual(4);

      lowEndOptimizer.dispose();
    });

    it('should classify premium devices correctly', async () => {
      // Premium device is already mocked in beforeEach
      await new Promise((resolve) => setTimeout(resolve, 100));

      const capabilities = optimizer.getDeviceCapabilities();
      expect(capabilities.deviceClass).toBe('premium');

      const qualityConfig = optimizer.getCurrentQualityConfig();
      expect(qualityConfig.qualityLevel).toBe('ultra');
      expect(qualityConfig.maxPolyphony).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Battery Optimization', () => {
    it('should optimize for low battery conditions', async () => {
      // Mock low battery
      mockNavigator.getBattery.mockResolvedValue({
        ...mockBattery,
        level: 0.15, // 15% battery
        charging: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await optimizer.optimizeForCurrentConditions();

      const qualityConfig = optimizer.getCurrentQualityConfig();

      expect(qualityConfig.aggressiveBatteryMode).toBe(true);
      expect(qualityConfig.enableEffects).toBe(false);
      expect(qualityConfig.enableVisualization).toBe(false);
      expect(qualityConfig.estimatedBatteryImpact).toBeLessThan(0.5);
    });

    it('should allow high performance when charging', async () => {
      // Mock charging device
      mockNavigator.getBattery.mockResolvedValue({
        ...mockBattery,
        level: 0.3, // 30% battery but charging
        charging: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await optimizer.optimizeForCurrentConditions();

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should not apply aggressive battery optimizations when charging
      expect(qualityConfig.aggressiveBatteryMode).toBe(false);
    });

    it('should get battery status correctly', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const batteryStatus = await optimizer.getBatteryStatus();

      expect(batteryStatus).toMatchObject({
        level: expect.any(Number),
        charging: expect.any(Boolean),
        powerMode: expect.any(String),
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize for high CPU usage', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate high CPU usage
      const highCpuMetrics: AudioPerformanceMetrics = {
        latency: 20,
        averageLatency: 25,
        maxLatency: 50,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 95, // Very high CPU usage
        memoryUsage: 500,
        sampleRate: 48000,
        bufferSize: 256,
        timestamp: Date.now(),
      };

      optimizer.updatePerformanceMetrics(highCpuMetrics);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should reduce quality to lower CPU usage
      expect(qualityConfig.bufferSize).toBeGreaterThanOrEqual(512);
      expect(qualityConfig.maxPolyphony).toBeLessThanOrEqual(8);
      expect(qualityConfig.enableVisualization).toBe(false);
    });

    it('should optimize for high latency', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate high latency
      const highLatencyMetrics: AudioPerformanceMetrics = {
        latency: 250, // Very high latency
        averageLatency: 200,
        maxLatency: 300,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 50,
        memoryUsage: 500,
        sampleRate: 48000,
        bufferSize: 128,
        timestamp: Date.now(),
      };

      optimizer.updatePerformanceMetrics(highLatencyMetrics);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should increase buffer size to reduce latency issues
      expect(qualityConfig.bufferSize).toBeGreaterThan(128);
    });
  });

  describe('Thermal Management', () => {
    it('should reduce quality under thermal stress', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate thermal stress with very high CPU usage
      const thermalStressMetrics: AudioPerformanceMetrics = {
        latency: 30,
        averageLatency: 35,
        maxLatency: 60,
        dropoutCount: 1,
        bufferUnderruns: 1,
        cpuUsage: 92, // Thermal throttling territory
        memoryUsage: 800,
        sampleRate: 48000,
        bufferSize: 256,
        timestamp: Date.now(),
      };

      // Feed multiple high-CPU measurements to trigger thermal detection
      for (let i = 0; i < 5; i++) {
        optimizer.updatePerformanceMetrics(thermalStressMetrics);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should apply thermal optimizations
      expect(qualityConfig.thermalManagement).toBe(true);
      expect(qualityConfig.cpuThrottling).toBeLessThan(1.0);
    });
  });

  describe('User Preferences', () => {
    it('should respect battery life priority', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const preferences: UserOptimizationPreferences = {
        prioritizeBatteryLife: true,
        prioritizeQuality: false,
        prioritizeStability: false,
        allowBackgroundOptimization: true,
        thermalManagementEnabled: true,
        automaticQualityScaling: true,
      };

      optimizer.setUserPreferences(preferences);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      expect(qualityConfig.aggressiveBatteryMode).toBe(true);
      expect(qualityConfig.estimatedBatteryImpact).toBeLessThan(0.5);
    });

    it('should respect quality priority when battery allows', async () => {
      // Mock good battery level
      mockNavigator.getBattery.mockResolvedValue({
        ...mockBattery,
        level: 0.8, // 80% battery
        charging: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const preferences: UserOptimizationPreferences = {
        prioritizeBatteryLife: false,
        prioritizeQuality: true,
        prioritizeStability: false,
        allowBackgroundOptimization: true,
        thermalManagementEnabled: true,
        automaticQualityScaling: true,
      };

      optimizer.setUserPreferences(preferences);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      expect(qualityConfig.qualityLevel).toBe('high');
      expect(qualityConfig.enableEffects).toBe(true);
      expect(qualityConfig.enableVisualization).toBe(true);
    });

    it('should apply custom quality overrides', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const preferences: UserOptimizationPreferences = {
        prioritizeBatteryLife: false,
        prioritizeQuality: false,
        prioritizeStability: false,
        allowBackgroundOptimization: true,
        thermalManagementEnabled: true,
        automaticQualityScaling: true,
        customQualityOverrides: {
          sampleRate: 22050,
          maxPolyphony: 6,
          enableEffects: false,
        },
      };

      optimizer.setUserPreferences(preferences);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      expect(qualityConfig.sampleRate).toBe(22050);
      expect(qualityConfig.maxPolyphony).toBe(6);
      expect(qualityConfig.enableEffects).toBe(false);
    });
  });

  describe('Quality Recommendations', () => {
    it('should provide quality recommendations for different power modes', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const recommendations = optimizer.getQualityRecommendations();

      expect(recommendations).toHaveProperty('high-performance');
      expect(recommendations).toHaveProperty('balanced');
      expect(recommendations).toHaveProperty('battery-saver');
      expect(recommendations).toHaveProperty('ultra-low-power');

      // Battery saver should have lower quality than high performance
      expect(
        recommendations['battery-saver'].estimatedBatteryImpact,
      ).toBeLessThan(
        recommendations['high-performance'].estimatedBatteryImpact,
      );

      // Ultra low power should have minimal quality
      expect(recommendations['ultra-low-power'].qualityLevel).toBe('minimal');
    });
  });

  describe('Optimization Decisions', () => {
    it('should generate detailed optimization decisions', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const decision = await optimizer.optimizeForCurrentConditions();

      expect(decision).toMatchObject({
        qualityConfig: expect.any(Object),
        reasoning: {
          primaryFactors: expect.any(Array),
          batteryInfluence: expect.any(Number),
          thermalInfluence: expect.any(Number),
          performanceInfluence: expect.any(Number),
          userPreferenceInfluence: expect.any(Number),
          explanation: expect.any(String),
        },
        estimatedImprovement: {
          batteryLifeExtension: expect.any(Number),
          performanceImprovement: expect.any(Number),
          qualityReduction: expect.any(Number),
          stabilityImprovement: expect.any(Number),
        },
        confidence: expect.any(Number),
        nextReEvaluationTime: expect.any(Number),
      });

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should track optimization history', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger multiple optimizations
      await optimizer.optimizeForCurrentConditions();
      await optimizer.optimizeForCurrentConditions();

      const history = optimizer.getOptimizationHistory();

      expect(history).toHaveLength(2);
      expect(history[0]).toHaveProperty('qualityConfig');
      expect(history[0]).toHaveProperty('reasoning');
    });
  });

  describe('Performance Integration', () => {
    it('should update performance metrics correctly', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics: AudioPerformanceMetrics = {
        latency: 25,
        averageLatency: 30,
        maxLatency: 50,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 45,
        memoryUsage: 512,
        sampleRate: 48000,
        bufferSize: 256,
        timestamp: Date.now(),
      };

      optimizer.updatePerformanceMetrics(metrics);

      // Verify metrics are stored and used for optimization
      const decision = await optimizer.optimizeForCurrentConditions();
      expect(decision.reasoning.performanceInfluence).toBeGreaterThanOrEqual(0);
    });

    it('should trigger immediate optimization for critical conditions', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const criticalMetrics: AudioPerformanceMetrics = {
        latency: 300, // Critical latency
        averageLatency: 250,
        maxLatency: 400,
        dropoutCount: 10, // Many dropouts
        bufferUnderruns: 5,
        cpuUsage: 95, // Critical CPU usage
        memoryUsage: 3000, // High memory usage
        sampleRate: 48000,
        bufferSize: 128,
        timestamp: Date.now(),
      };

      // Should trigger immediate optimization
      optimizer.updatePerformanceMetrics(criticalMetrics);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should have applied emergency optimizations
      expect(qualityConfig.bufferSize).toBeGreaterThan(128);
      expect(qualityConfig.maxPolyphony).toBeLessThan(16);
    });
  });

  describe('Resource Management', () => {
    it('should dispose resources correctly', () => {
      optimizer.dispose();

      // Should not throw errors after disposal
      expect(() => {
        optimizer.setOptimizationActive(false);
      }).not.toThrow();
    });

    it('should control optimization activity', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      optimizer.setOptimizationActive(false);

      // Triggering optimization should still work manually
      const decision = await optimizer.optimizeForCurrentConditions();
      expect(decision).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unavailable battery API gracefully', async () => {
      // Mock unavailable battery API
      mockNavigator.getBattery.mockRejectedValue(
        new Error('Battery API not available'),
      );

      const newOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const batteryStatus = await newOptimizer.getBatteryStatus();

      // Should provide fallback values
      expect(batteryStatus).toMatchObject({
        level: expect.any(Number),
        charging: expect.any(Boolean),
        powerMode: expect.any(String),
      });

      newOptimizer.dispose();
    });

    it('should handle AudioContext creation errors', async () => {
      // Reset singleton first
      MobileOptimizer.resetInstance();

      // Mock AudioContext creation failure
      vi.stubGlobal(
        'AudioContext',
        vi.fn(() => {
          throw new Error('AudioContext not supported');
        }),
      );

      const newOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const capabilities = newOptimizer.getDeviceCapabilities();

      // Should provide fallback audio capabilities
      expect(capabilities.maxSampleRate).toBe(44100);
      expect(capabilities.audioWorkletSupport).toBe(false);

      newOptimizer.dispose();
    });

    it('should handle empty performance history', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not crash with no performance history
      const decision = await optimizer.optimizeForCurrentConditions();
      expect(decision).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });
});
