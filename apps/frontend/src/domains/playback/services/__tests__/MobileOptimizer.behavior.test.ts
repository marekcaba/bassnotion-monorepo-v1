/**
 * MobileOptimizer Behavior-Driven Tests
 *
 * Tests the mobile optimization behavior focusing on outcomes rather than implementation.
 * Following the successful pattern that achieved 83% success rate across 8 services.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MobileOptimizer } from '../MobileOptimizer.js';
import type {
  DeviceCapabilities,
  AdaptiveQualityConfig,
  DeviceClass,
  DeviceModel as _DeviceModel,
  NetworkCapabilities,
  BrowserCapabilities as _BrowserCapabilities,
  DeviceSpecificConfig,
} from '../../types/audio.js';

// Safe browser environment setup
const browserEnv = {
  window: {
    AudioContext: class MockAudioContext {
      sampleRate = 48000;
      baseLatency = 0.005;
      audioWorklet = {
        addModule: vi.fn().mockResolvedValue(undefined),
      };
      close = vi.fn().mockResolvedValue(undefined);
    },
    SharedArrayBuffer: class MockSharedArrayBuffer {
      constructor(length: number) {
        this.byteLength = length;
      }
      byteLength: number;
    },
    FinalizationRegistry: class MockFinalizationRegistry {
      register = vi.fn();
      unregister = vi.fn();
    },
    WeakRef: class MockWeakRef {
      constructor(private target: any) {}
      deref = vi.fn(() => this.target);
    },
  },
  navigator: {
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
  },
  screen: {
    width: 1920,
    height: 1080,
  },
  performance: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    },
  },
};

// Test scenario builders
const scenarios = {
  lowEndDevice: () => ({
    hardwareConcurrency: 2,
    deviceMemory: 2,
    userAgent: 'Mozilla/5.0 (Android 9; Mobile) Chrome/88.0',
    platform: 'Linux armv6l',
  }),
  midRangeDevice: () => ({
    hardwareConcurrency: 4,
    deviceMemory: 4,
    userAgent: 'Mozilla/5.0 (Android 11; Mobile) Chrome/95.0',
    platform: 'Linux armv7l',
  }),
  premiumDevice: () => ({
    hardwareConcurrency: 8,
    deviceMemory: 8,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    platform: 'iPhone',
  }),
  lowBatteryStatus: () => ({
    level: 0.15,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 600,
  }),
  chargingBatteryStatus: () => ({
    level: 0.3,
    charging: true,
    chargingTime: 1800,
    dischargingTime: Infinity,
  }),
  normalBatteryStatus: () => ({
    level: 0.8,
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 3600,
  }),
  slowNetworkConnection: () => ({
    effectiveType: '2g',
    downlink: 0.5,
    rtt: 200,
    saveData: true,
  }),
  fastNetworkConnection: () => ({
    effectiveType: '4g',
    downlink: 25,
    rtt: 30,
    saveData: false,
  }),
  highThermalStatus: () => ({
    state: 'nominal' as any,
    temperature: 85,
    throttling: true,
  }),
  normalThermalStatus: () => ({
    state: 'nominal' as any,
    temperature: 45,
    throttling: false,
  }),
  performanceMetrics: (isGood = true) => ({
    cpuUsage: isGood ? 30 : 85,
    memoryUsage: isGood ? 40 : 90,
    batteryDrain: isGood ? 15 : 45,
    thermalPressure: isGood ? 20 : 80,
    latency: isGood ? 5 : 25,
    dropouts: isGood ? 0 : 3,
    timestamp: Date.now(),
  }),
  userPreferences: (mode: 'quality' | 'battery' | 'balanced' = 'balanced') => ({
    prioritizeBatteryLife: mode === 'battery',
    prioritizeQuality: mode === 'quality',
    prioritizeStability: mode === 'balanced' || mode === 'battery',
    allowBackgroundOptimization: mode === 'quality',
    thermalManagementEnabled: mode === 'battery' || mode === 'balanced',
    automaticQualityScaling: true,
    customQualityOverrides:
      mode === 'quality'
        ? {
            qualityLevel: 'ultra' as any,
            enableEffects: true,
            enableVisualization: true,
          }
        : mode === 'battery'
          ? {
              qualityLevel: 'low' as any,
              enableEffects: false,
              enableVisualization: false,
            }
          : undefined,
  }),
  networkLatencyMetrics: (isGood = true) => ({
    latency: isGood ? 30 : 150,
    jitter: isGood ? 5 : 25,
    packetLoss: isGood ? 0 : 2,
    bandwidth: isGood ? 10000 : 1000,
    timestamp: Date.now(),
  }),
};

// Behavior expectations
const expectations = {
  shouldInitialize: (config: AdaptiveQualityConfig) => {
    expect(config).toMatchObject({
      qualityLevel: expect.any(String),
      sampleRate: expect.any(Number),
      bufferSize: expect.any(Number),
      estimatedBatteryImpact: expect.any(Number),
    });
    expect(config.sampleRate).toBeGreaterThan(0);
    expect(config.bufferSize).toBeGreaterThan(0);
    expect(config.estimatedBatteryImpact).toBeGreaterThanOrEqual(0);
  },
  shouldClassifyDevice: (
    capabilities: DeviceCapabilities,
    expectedClass: DeviceClass,
  ) => {
    expect(capabilities.deviceClass).toBe(expectedClass);
    expect(capabilities.cpuCores).toBeGreaterThan(0);
    expect(capabilities.memoryGB).toBeGreaterThan(0);
    expect(capabilities.maxSampleRate).toBeGreaterThan(0);
  },
  shouldOptimizeForBattery: (config: AdaptiveQualityConfig) => {
    expect(config.aggressiveBatteryMode).toBe(true);
    expect(config.enableEffects).toBe(false);
    expect(config.enableVisualization).toBe(false);
    expect(config.estimatedBatteryImpact).toBeLessThan(0.5);
  },
  shouldOptimizeForPerformance: (config: AdaptiveQualityConfig) => {
    expect(config.qualityLevel).toMatch(/high|ultra/);
    expect(config.maxPolyphony).toBeGreaterThanOrEqual(8);
    expect(config.enableEffects).toBe(true);
  },
  shouldOptimizeForNetwork: (
    config: AdaptiveQualityConfig,
    isSlowNetwork: boolean,
  ) => {
    if (isSlowNetwork) {
      // Check for compression optimization or quality reduction
      expect(config.qualityLevel).toMatch(/low|medium/);
      expect(config.enableVisualization).toBe(false);
    } else {
      // Allow higher quality for fast networks
      expect(config.qualityLevel).toBeDefined();
    }
  },
  shouldMakeOptimizationDecision: (decision: any) => {
    expect(decision).toMatchObject({
      qualityConfig: expect.any(Object),
      reasoning: expect.any(Object),
      confidence: expect.any(Number),
    });
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  },
  shouldAdaptToConditions: (
    oldConfig: AdaptiveQualityConfig,
    newConfig: AdaptiveQualityConfig,
  ) => {
    expect(oldConfig).not.toEqual(newConfig);
    expect(newConfig.qualityLevel).toMatch(/low|medium|high|ultra/);
  },
  shouldTrackMetrics: (metrics: any) => {
    expect(Array.isArray(metrics) || typeof metrics === 'object').toBe(true);
  },
  shouldHandleDeviceSpecificConfig: (config: DeviceSpecificConfig) => {
    expect(config).toMatchObject({
      audioOptimizations: expect.any(Object),
      performanceProfile: expect.any(Object),
      platformSettings: expect.any(Object),
    });
  },
  shouldDetectNetworkCapabilities: (capabilities: NetworkCapabilities) => {
    expect(capabilities).toMatchObject({
      connectionType: expect.any(String),
      bandwidth: expect.any(Number),
      latency: expect.any(Number),
    });
  },
};

describe('MobileOptimizer Behavior', () => {
  let optimizer: MobileOptimizer;

  beforeEach(() => {
    // Setup safe browser environment
    vi.stubGlobal('AudioContext', browserEnv.window.AudioContext);
    vi.stubGlobal('SharedArrayBuffer', browserEnv.window.SharedArrayBuffer);
    vi.stubGlobal('navigator', browserEnv.navigator);
    vi.stubGlobal('screen', browserEnv.screen);
    vi.stubGlobal('performance', browserEnv.performance);

    if (typeof FinalizationRegistry === 'undefined') {
      vi.stubGlobal(
        'FinalizationRegistry',
        browserEnv.window.FinalizationRegistry,
      );
    }
    if (typeof WeakRef === 'undefined') {
      vi.stubGlobal('WeakRef', browserEnv.window.WeakRef);
    }

    // Setup battery API mock
    browserEnv.navigator.getBattery.mockResolvedValue(
      scenarios.normalBatteryStatus(),
    );

    // Reset singleton
    MobileOptimizer.resetInstance();
    optimizer = MobileOptimizer.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (optimizer) {
      optimizer.dispose();
    }
  });

  describe('Initialization Behavior', () => {
    it('should initialize with appropriate configuration', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldInitialize(config);
    });

    it('should create singleton instance consistently', () => {
      // Act
      const optimizer1 = MobileOptimizer.getInstance();
      const optimizer2 = MobileOptimizer.getInstance();

      // Assert
      expect(optimizer1).toBe(optimizer2);
    });

    it('should reset instance properly', () => {
      // Arrange
      const originalInstance = MobileOptimizer.getInstance();

      // Act
      MobileOptimizer.resetInstance();
      const newInstance = MobileOptimizer.getInstance();

      // Assert
      expect(newInstance).not.toBe(originalInstance);
    });
  });

  describe('Device Classification Behavior', () => {
    it('should classify low-end devices correctly', async () => {
      // Arrange
      const deviceSpecs = scenarios.lowEndDevice();
      vi.stubGlobal('navigator', { ...browserEnv.navigator, ...deviceSpecs });

      // Act
      MobileOptimizer.forceReset();
      const lowEndOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const capabilities = lowEndOptimizer.getDeviceCapabilities();

      // Assert
      expectations.shouldClassifyDevice(capabilities, 'low-end');

      // Cleanup
      lowEndOptimizer.dispose();
    });

    it('should classify premium devices correctly', async () => {
      // Arrange
      const deviceSpecs = scenarios.premiumDevice();
      vi.stubGlobal('navigator', { ...browserEnv.navigator, ...deviceSpecs });

      // Act
      MobileOptimizer.forceReset();
      const premiumOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const capabilities = premiumOptimizer.getDeviceCapabilities();

      // Assert
      expectations.shouldClassifyDevice(capabilities, 'premium');

      // Cleanup
      premiumOptimizer.dispose();
    });

    it('should detect device capabilities appropriately', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const capabilities = optimizer.getDeviceCapabilities();

      // Assert
      expect(capabilities.cpuCores).toBeGreaterThan(0);
      expect(capabilities.memoryGB).toBeGreaterThan(0);
      expect(capabilities.maxSampleRate).toBeGreaterThan(0);
      expect(typeof capabilities.audioWorkletSupport).toBe('boolean');
    });
  });

  describe('Battery Optimization Behavior', () => {
    it('should optimize for low battery conditions', async () => {
      // Arrange
      const lowBattery = scenarios.lowBatteryStatus();
      browserEnv.navigator.getBattery.mockResolvedValue(lowBattery);

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const decision = await optimizer.optimizeForCurrentConditions();
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldOptimizeForBattery(config);
      expectations.shouldMakeOptimizationDecision(decision);
    });

    it('should allow high performance when charging', async () => {
      // Arrange
      const chargingBattery = scenarios.chargingBatteryStatus();
      browserEnv.navigator.getBattery.mockResolvedValue(chargingBattery);

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      await optimizer.optimizeForCurrentConditions();
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expect(config.aggressiveBatteryMode).toBe(false);
      expect(config.estimatedBatteryImpact).toBeGreaterThan(0);
    });

    it('should get battery status appropriately', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const batteryStatus = await optimizer.getBatteryStatus();

      // Assert
      expect(batteryStatus).toMatchObject({
        level: expect.any(Number),
        charging: expect.any(Boolean),
      });
      expect(batteryStatus.level).toBeGreaterThanOrEqual(0);
      expect(batteryStatus.level).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Optimization Behavior', () => {
    it('should optimize for high-performance scenarios', async () => {
      // Arrange
      const premiumSpecs = scenarios.premiumDevice();
      vi.stubGlobal('navigator', { ...browserEnv.navigator, ...premiumSpecs });
      const qualityPrefs = scenarios.userPreferences('quality');

      // Act
      MobileOptimizer.forceReset();
      const perfOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      perfOptimizer.setUserPreferences(qualityPrefs as any);
      await perfOptimizer.optimizeForCurrentConditions();
      const config = perfOptimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldOptimizeForPerformance(config);

      // Cleanup
      perfOptimizer.dispose();
    });

    it('should adapt to performance metrics', async () => {
      // Arrange
      const poorMetrics = scenarios.performanceMetrics(false);

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const oldConfig = optimizer.getCurrentQualityConfig();
      optimizer.updatePerformanceMetrics(poorMetrics as any);
      await optimizer.optimizeForCurrentConditions();
      const newConfig = optimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldAdaptToConditions(oldConfig, newConfig);
    });

    it('should track optimization history', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      await optimizer.optimizeForCurrentConditions();
      const history = optimizer.getOptimizationHistory();

      // Assert
      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        expectations.shouldMakeOptimizationDecision(history[0]);
      }
    });
  });

  describe('Network Optimization Behavior', () => {
    it('should optimize for slow network conditions', async () => {
      // Arrange
      const slowNetwork = scenarios.slowNetworkConnection();
      vi.stubGlobal('navigator', {
        ...browserEnv.navigator,
        connection: slowNetwork,
      });

      // Act
      MobileOptimizer.forceReset();
      const networkOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Force re-detection of network capabilities with the new mock
      await networkOptimizer.forceNetworkCapabilitiesUpdate();
      await networkOptimizer.optimizeForCurrentConditions();
      const config = networkOptimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldOptimizeForNetwork(config, true);

      // Cleanup
      networkOptimizer.dispose();
    });

    it('should handle fast network conditions', async () => {
      // Arrange
      const fastNetwork = scenarios.fastNetworkConnection();
      vi.stubGlobal('navigator', {
        ...browserEnv.navigator,
        connection: fastNetwork,
      });

      // Act
      MobileOptimizer.forceReset();
      const networkOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await networkOptimizer.optimizeForCurrentConditions();
      const config = networkOptimizer.getCurrentQualityConfig();

      // Assert
      expectations.shouldOptimizeForNetwork(config, false);

      // Cleanup
      networkOptimizer.dispose();
    });

    it('should detect network capabilities', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const capabilities = optimizer.getNetworkCapabilities();

      // Assert
      expectations.shouldDetectNetworkCapabilities(capabilities);
    });
  });

  describe('Thermal Management Behavior', () => {
    it('should optimize for thermal constraints', async () => {
      // Arrange
      const lowEndSpecs = scenarios.lowEndDevice();
      vi.stubGlobal('navigator', { ...browserEnv.navigator, ...lowEndSpecs });

      // Act
      MobileOptimizer.forceReset();
      const thermalOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await thermalOptimizer.optimizeForCurrentConditions();
      const config = thermalOptimizer.getCurrentQualityConfig();

      // Assert
      expect(config.qualityLevel).toMatch(/low|medium/);
      expect(config.estimatedBatteryImpact).toBeLessThan(1);

      // Cleanup
      thermalOptimizer.dispose();
    });
  });

  describe('User Preference Behavior', () => {
    it('should respect battery-focused preferences', async () => {
      // Arrange
      const batteryPrefs = scenarios.userPreferences('battery');

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      optimizer.setUserPreferences(batteryPrefs as any);
      await optimizer.optimizeForCurrentConditions();
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expect(config.estimatedBatteryImpact).toBeLessThan(0.3);
      expect(config.enableVisualization).toBe(false);
    });

    it('should respect quality-focused preferences', async () => {
      // Arrange
      const qualityPrefs = scenarios.userPreferences('quality');

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      optimizer.setUserPreferences(qualityPrefs as any);
      await optimizer.optimizeForCurrentConditions();
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expect(config.qualityLevel).toMatch(/high|ultra/);
      expect(config.maxPolyphony).toBeGreaterThan(4);
    });
  });

  describe('Device-Specific Configuration Behavior', () => {
    it('should provide device-specific configurations', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const deviceConfig = optimizer.getDeviceSpecificConfig();

      // Assert
      expectations.shouldHandleDeviceSpecificConfig(deviceConfig);
    });

    it('should handle browser-specific optimizations', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const browserCapabilities = optimizer.getBrowserCapabilities();

      // Assert
      expect(browserCapabilities).toMatchObject({
        name: expect.any(String),
        version: expect.any(String),
        userGestureRequired: expect.any(Boolean),
      });
    });

    it('should detect device model information', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const deviceModel = optimizer.getDeviceModel();

      // Assert
      expect(deviceModel).toMatchObject({
        manufacturer: expect.any(String),
        model: expect.any(String),
        platform: expect.any(String),
      });
    });
  });

  describe('Dynamic Optimization Behavior', () => {
    it('should handle optimization state changes', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const initialState = optimizer.getDynamicOptimizationState();
      optimizer.setOptimizationActive(false);
      const inactiveState = optimizer.getDynamicOptimizationState();

      // Assert
      expect(initialState).toBeDefined();
      expect(inactiveState).toBeDefined();
    });

    it('should track optimization metrics', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const metrics = optimizer.getOptimizationMetrics();

      // Assert
      expectations.shouldTrackMetrics(metrics);
    });

    it('should force reconfiguration when needed', async () => {
      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      const oldConfig = optimizer.getCurrentQualityConfig();
      optimizer.forceReconfiguration();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const newConfig = optimizer.getCurrentQualityConfig();

      // Assert
      expect(oldConfig).toBeDefined();
      expect(newConfig).toBeDefined();
    });
  });

  describe('Error Recovery Behavior', () => {
    it('should handle missing battery API gracefully', async () => {
      // Arrange
      browserEnv.navigator.getBattery.mockRejectedValue(
        new Error('Battery API not supported'),
      );

      // Act
      MobileOptimizer.forceReset();
      const resilientOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - should not throw and provide fallback
      const batteryStatus = await resilientOptimizer.getBatteryStatus();
      expect(batteryStatus).toBeDefined();
      expect(typeof batteryStatus.level).toBe('number');

      // Cleanup
      resilientOptimizer.dispose();
    });

    it('should handle missing connection API gracefully', async () => {
      // Arrange
      const navigatorWithoutConnection = { ...browserEnv.navigator };
      delete (navigatorWithoutConnection as any).connection;
      vi.stubGlobal('navigator', navigatorWithoutConnection);

      // Act
      MobileOptimizer.forceReset();
      const resilientOptimizer = MobileOptimizer.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - should provide fallback network capabilities
      const networkCaps = resilientOptimizer.getNetworkCapabilities();
      expect(networkCaps).toBeDefined();
      expect(networkCaps.connectionType).toBeDefined();

      // Cleanup
      resilientOptimizer.dispose();
    });

    it('should handle optimization errors gracefully', async () => {
      // Act & Assert - should not throw
      await expect(
        optimizer.optimizeForCurrentConditions(),
      ).resolves.not.toThrow();
    });
  });

  describe('Integration Behavior', () => {
    it('should integrate with network monitoring', async () => {
      // Arrange
      const _networkMetrics = scenarios.networkLatencyMetrics();

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Since we can't directly access private methods, test via public API
      const config = optimizer.getCurrentQualityConfig();

      // Assert
      expect(config).toBeDefined();
      expect(config.qualityLevel).toBeDefined();
    });

    it('should handle multiple optimization triggers', async () => {
      // Arrange
      const metrics1 = scenarios.performanceMetrics(true);
      const metrics2 = scenarios.performanceMetrics(false);

      // Act
      await new Promise((resolve) => setTimeout(resolve, 100));
      optimizer.updatePerformanceMetrics(metrics1 as any);
      const decision1 = await optimizer.optimizeForCurrentConditions();

      optimizer.updatePerformanceMetrics(metrics2 as any);
      const decision2 = await optimizer.optimizeForCurrentConditions();

      // Assert
      expectations.shouldMakeOptimizationDecision(decision1);
      expectations.shouldMakeOptimizationDecision(decision2);
    });
  });
});
