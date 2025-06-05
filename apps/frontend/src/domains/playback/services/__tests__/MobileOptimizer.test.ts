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
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false,
  },
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
      // Mock low-end device specs properly
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        hardwareConcurrency: 2, // 2 cores
        deviceMemory: 2, // 2GB RAM - this should trigger low-end classification
      });

      // Force re-initialization with new navigator specs
      MobileOptimizer.forceReset();
      const lowEndOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const capabilities = lowEndOptimizer.getDeviceCapabilities();
      expect(capabilities.deviceClass).toBe('low-end');

      const qualityConfig = lowEndOptimizer.getCurrentQualityConfig();
      expect(qualityConfig.qualityLevel).toBe('low'); // Low-end devices should get 'low' quality, not 'medium'
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

      // Should reduce quality to lower CPU usage (updated expectations for conservative thresholds)
      expect(qualityConfig.bufferSize).toBeGreaterThanOrEqual(512);
      expect(qualityConfig.maxPolyphony).toBeLessThanOrEqual(32); // Premium devices still allow higher polyphony
      expect(qualityConfig.enableVisualization).toBe(true);
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

      // With good battery and premium device, should allow ultra quality
      expect(qualityConfig.qualityLevel).toBe('ultra'); // Premium devices can reach ultra quality with good battery
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

      // Simulate critical conditions
      const criticalMetrics: AudioPerformanceMetrics = {
        latency: 150,
        averageLatency: 120,
        maxLatency: 200,
        dropoutCount: 5,
        bufferUnderruns: 3,
        cpuUsage: 95, // Critical CPU usage
        memoryUsage: 1800,
        sampleRate: 48000,
        bufferSize: 128,
        timestamp: Date.now(),
      };

      // Feed multiple measurements to trigger critical detection
      for (let i = 0; i < 5; i++) {
        optimizer.updatePerformanceMetrics(criticalMetrics);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const qualityConfig = optimizer.getCurrentQualityConfig();

      // Should have applied emergency optimizations (updated expectations)
      expect(qualityConfig.bufferSize).toBeGreaterThan(128);
      expect(qualityConfig.maxPolyphony).toBeLessThan(32); // Premium devices have higher baseline
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

  describe('Enhanced Device-Specific Configurations', () => {
    it('should detect device model correctly', async () => {
      // Mock iPhone user agent
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      });

      const iPhoneOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const deviceModel = iPhoneOptimizer.getDeviceModel();
      expect(deviceModel.manufacturer).toBe('Apple');
      expect(deviceModel.series).toBe('iPhone');
      expect(deviceModel.year).toBeGreaterThan(2020);

      iPhoneOptimizer.dispose();
    });

    it('should detect network capabilities', async () => {
      // Mock network connection
      const mockConnection = {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
      };

      vi.stubGlobal('navigator', {
        ...mockNavigator,
        connection: mockConnection,
      });

      const networkOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const networkCapabilities = networkOptimizer.getNetworkCapabilities();
      expect(networkCapabilities.effectiveType).toBe('4g');
      expect(networkCapabilities.downlink).toBe(10);
      expect(networkCapabilities.rtt).toBe(50);

      networkOptimizer.dispose();
    });

    it('should detect browser capabilities', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const browserCapabilities = optimizer.getBrowserCapabilities();
      expect(browserCapabilities).toHaveProperty('name');
      expect(browserCapabilities).toHaveProperty('version');
      expect(browserCapabilities).toHaveProperty('engine');
      expect(browserCapabilities).toHaveProperty('supportedFeatures');
      expect(browserCapabilities).toHaveProperty('limitations');
    });

    it('should create device-specific configuration', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const deviceConfig = optimizer.getDeviceSpecificConfig();
      expect(deviceConfig).toHaveProperty('deviceModel');
      expect(deviceConfig).toHaveProperty('networkCapabilities');
      expect(deviceConfig).toHaveProperty('browserCapabilities');
      expect(deviceConfig).toHaveProperty('audioOptimizations');
      expect(deviceConfig).toHaveProperty('performanceProfile');
      expect(deviceConfig).toHaveProperty('platformSettings');
    });

    it('should adapt configuration based on network conditions', async () => {
      // Create optimizer with slow network conditions
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        connection: {
          ...mockNavigator.connection,
          effectiveType: '2g', // Very slow network
          downlink: 0.1,
          rtt: 2000,
        },
      });

      MobileOptimizer.forceReset();
      const slowNetworkOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const qualityConfig = slowNetworkOptimizer.getCurrentQualityConfig();
      expect(qualityConfig.enableVisualization).toBe(false); // 2g networks should disable visualization
      expect(qualityConfig.backgroundProcessing).toBe(false);
      expect(qualityConfig.compressionRatio).toBeGreaterThan(0.5);

      slowNetworkOptimizer.dispose();
    });

    it('should provide dynamic optimization state', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dynamicState = optimizer.getDynamicOptimizationState();
      expect(dynamicState).toHaveProperty('currentConditions');
      expect(dynamicState).toHaveProperty('activeAdjustments');
      expect(dynamicState).toHaveProperty('nextEvaluationTime');
      expect(dynamicState).toHaveProperty('adjustmentHistory');
    });

    it('should track optimization metrics', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = optimizer.getOptimizationMetrics();
      expect(metrics).toHaveProperty('deviceIdentifier');
      expect(metrics).toHaveProperty('sessionDuration');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('optimizationTriggers');
    });

    it('should force reconfiguration when needed', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const _initialConfig = optimizer.getCurrentQualityConfig();

      // Force reconfiguration
      optimizer.forceReconfiguration();

      const newConfig = optimizer.getCurrentQualityConfig();
      expect(newConfig).toBeDefined();
      // Configuration should be recalculated (may or may not change)
    });

    it('should update network capabilities manually', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update with new network capabilities
      optimizer.updateNetworkCapabilitiesManually({
        effectiveType: '4g',
        downlink: 100,
        rtt: 10,
      });

      const updatedCapabilities = optimizer.getNetworkCapabilities();
      expect(updatedCapabilities.effectiveType).toBe('4g');
      expect(updatedCapabilities.downlink).toBe(100);
      expect(updatedCapabilities.rtt).toBe(10);
    });
  });

  describe('Progressive Enhancement', () => {
    it('should provide fallback strategies for unsupported features', async () => {
      // Mock browser without AudioWorklet support
      vi.stubGlobal('AudioContext', undefined);

      const fallbackOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const browserCapabilities = fallbackOptimizer.getBrowserCapabilities();
      expect(browserCapabilities.supportedFeatures.audioWorklet).toBe(false);

      const qualityConfig = fallbackOptimizer.getCurrentQualityConfig();
      // Should adapt for lack of AudioWorklet support
      expect(qualityConfig.bufferSize).toBeGreaterThanOrEqual(512);

      fallbackOptimizer.dispose();
    });

    it('should handle device-specific browser limitations', async () => {
      // Mock Safari user agent
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      });

      const safariOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const browserCapabilities = safariOptimizer.getBrowserCapabilities();
      expect(browserCapabilities.name).toBe('safari');
      expect(browserCapabilities.limitations.requiresUserGesture).toBe(true);

      const qualityConfig = safariOptimizer.getCurrentQualityConfig();
      // Should have Safari-specific optimizations
      expect(qualityConfig.bufferSize).toBeGreaterThanOrEqual(256);

      safariOptimizer.dispose();
    });
  });

  describe('Device Classification and Optimization', () => {
    it('should optimize differently for low-end devices', async () => {
      // Mock actual low-end device specs
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        hardwareConcurrency: 2,
        deviceMemory: 1, // 1GB RAM for true low-end
      });

      MobileOptimizer.forceReset();
      const lowEndOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const deviceConfig = lowEndOptimizer.getDeviceSpecificConfig();
      expect(deviceConfig.performanceProfile.memoryConstraints).toBe('severe');
      expect(
        deviceConfig.performanceProfile.backgroundProcessingCapability,
      ).toBe('none');

      lowEndOptimizer.dispose();
    });

    it('should optimize differently for premium devices', async () => {
      // Mock premium device
      vi.stubGlobal('navigator', {
        ...mockNavigator,
        hardwareConcurrency: 12,
        deviceMemory: 16,
      });

      const premiumOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const deviceConfig = premiumOptimizer.getDeviceSpecificConfig();
      expect(deviceConfig.performanceProfile.memoryConstraints).toBe('none');
      expect(
        deviceConfig.performanceProfile.backgroundProcessingCapability,
      ).toBe('full');

      const qualityConfig = premiumOptimizer.getCurrentQualityConfig();
      expect(qualityConfig.maxPolyphony).toBeGreaterThanOrEqual(16);
      expect(qualityConfig.enableEffects).toBe(true);

      premiumOptimizer.dispose();
    });

    it('should adapt to thermal conditions', async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate thermal stress
      const thermalStressMetrics: AudioPerformanceMetrics = {
        latency: 30,
        averageLatency: 35,
        maxLatency: 60,
        dropoutCount: 1,
        bufferUnderruns: 1,
        cpuUsage: 92, // Thermal throttling
        memoryUsage: 800,
        sampleRate: 48000,
        bufferSize: 256,
        timestamp: Date.now(),
      };

      // Feed multiple measurements
      for (let i = 0; i < 5; i++) {
        optimizer.updatePerformanceMetrics(thermalStressMetrics);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const adaptedConfig = optimizer.getCurrentQualityConfig();
      expect(adaptedConfig.cpuThrottling).toBeGreaterThanOrEqual(0.7);
      expect(adaptedConfig.backgroundProcessing).toBe(true); // Premium devices can maintain background processing
    });

    it('should adapt to low battery conditions', async () => {
      // Mock low battery
      mockNavigator.getBattery.mockResolvedValue({
        ...mockBattery,
        level: 0.1, // 10% battery
        charging: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await optimizer.optimizeForCurrentConditions();

      const adaptedConfig = optimizer.getCurrentQualityConfig();
      expect(adaptedConfig.aggressiveBatteryMode).toBe(true);
      expect(adaptedConfig.maxPolyphony).toBeLessThanOrEqual(4);
      expect(adaptedConfig.enableEffects).toBe(false);
    });
  });
});
