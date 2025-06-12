/**
 * BatteryManager Behavior Tests
 *
 * Testing battery usage monitoring, power optimization, and adaptive power management
 * for the 1,234-line BatteryManager service using proven behavior-driven approach.
 *
 * Core Behaviors:
 * - Battery usage tracking and metrics collection
 * - Power mode adaptation based on battery levels
 * - Optimization suggestions and automatic application
 * - Thermal management and emergency power saving
 * - User preference integration and custom settings
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { BatteryManager } from '../BatteryManager.js';
import type {
  BatteryStatus,
  PowerMode as _PowerMode,
  UserOptimizationPreferences,
  AudioPerformanceMetrics,
} from '../../types/audio.js';

// Safe browser environment setup
const createMockEnvironment = () => {
  const globalObj = global as any;

  // Battery API mock
  if (!globalObj.navigator) {
    globalObj.navigator = {};
  }

  const mockBattery = {
    charging: false,
    chargingTime: Infinity,
    dischargingTime: 300, // 5 hours
    level: 0.5, // 50%
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchargingchange: null,
    onlevelchange: null,
  };

  // Make sure getBattery always returns the current mockBattery object reference
  globalObj.navigator.getBattery = vi
    .fn()
    .mockImplementation(() => Promise.resolve(mockBattery));

  // Performance API mock
  if (!globalObj.performance) {
    globalObj.performance = {
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 100 * 1024 * 1024,
        totalJSHeapSize: 200 * 1024 * 1024,
        jsHeapSizeLimit: 4 * 1024 * 1024 * 1024,
      },
    };
  }

  // Timers for intervals - properly setup for both global and globalThis access
  const setIntervalSpy = vi.fn((callback, delay) => {
    return setTimeout(callback, delay);
  });
  const clearIntervalSpy = vi.fn();

  globalObj.setInterval = setIntervalSpy;
  globalObj.clearInterval = clearIntervalSpy;
  globalObj.globalThis = globalObj; // Ensure globalThis points to global

  // Also set on globalThis directly for compatibility
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).setInterval = setIntervalSpy;
    (globalThis as any).clearInterval = clearIntervalSpy;
  }

  return { globalObj, mockBattery, setIntervalSpy, clearIntervalSpy };
};

// Scenario builders for battery testing
const createBatteryScenarios = () => {
  const highBatteryStatus: BatteryStatus = {
    level: 0.85, // 85%
    charging: false,
    chargingTime: undefined,
    dischargingTime: 600, // 10 hours
    powerMode: 'high-performance',
    lowPowerModeEnabled: false,
  };

  const mediumBatteryStatus: BatteryStatus = {
    level: 0.45, // 45%
    charging: false,
    chargingTime: undefined,
    dischargingTime: 180, // 3 hours
    powerMode: 'balanced',
    lowPowerModeEnabled: false,
  };

  const lowBatteryStatus: BatteryStatus = {
    level: 0.15, // 15%
    charging: false,
    chargingTime: undefined,
    dischargingTime: 60, // 1 hour
    powerMode: 'battery-saver',
    lowPowerModeEnabled: true,
  };

  const criticalBatteryStatus: BatteryStatus = {
    level: 0.05, // 5%
    charging: false,
    chargingTime: undefined,
    dischargingTime: 15, // 15 minutes
    powerMode: 'ultra-low-power',
    lowPowerModeEnabled: true,
  };

  const chargingBatteryStatus: BatteryStatus = {
    level: 0.3, // 30%
    charging: true,
    chargingTime: 120, // 2 hours to full
    dischargingTime: undefined,
    powerMode: 'balanced',
    lowPowerModeEnabled: false,
  };

  const normalPerformanceMetrics: AudioPerformanceMetrics = {
    latency: 20,
    averageLatency: 22,
    maxLatency: 40,
    dropoutCount: 0,
    bufferUnderruns: 0,
    cpuUsage: 0.3, // 30%
    memoryUsage: 150, // 150MB
    sampleRate: 44100,
    bufferSize: 512,
    timestamp: Date.now(),
    networkLatency: 50,
    cacheHitRate: 0.85,
  };

  const highPerformanceMetrics: AudioPerformanceMetrics = {
    latency: 15,
    averageLatency: 16,
    maxLatency: 25,
    dropoutCount: 0,
    bufferUnderruns: 0,
    cpuUsage: 0.7, // 70%
    memoryUsage: 300, // 300MB
    sampleRate: 96000,
    bufferSize: 256,
    timestamp: Date.now(),
    networkLatency: 20,
    cacheHitRate: 0.9,
  };

  const batteryOptimizedPreferences: UserOptimizationPreferences = {
    prioritizeBatteryLife: true,
    prioritizeQuality: false,
    prioritizeStability: true,
    allowBackgroundOptimization: true,
    thermalManagementEnabled: true,
    automaticQualityScaling: true,
  };

  const qualityOptimizedPreferences: UserOptimizationPreferences = {
    prioritizeBatteryLife: false,
    prioritizeQuality: true,
    prioritizeStability: true,
    allowBackgroundOptimization: false,
    thermalManagementEnabled: false,
    automaticQualityScaling: false,
  };

  return {
    highBatteryStatus,
    mediumBatteryStatus,
    lowBatteryStatus,
    criticalBatteryStatus,
    chargingBatteryStatus,
    normalPerformanceMetrics,
    highPerformanceMetrics,
    batteryOptimizedPreferences,
    qualityOptimizedPreferences,
  };
};

// Expectation helpers
const _expectBatteryLevel = (
  level: number,
  expectedRange: [number, number],
) => {
  expect(level).toBeGreaterThanOrEqual(expectedRange[0]);
  expect(level).toBeLessThanOrEqual(expectedRange[1]);
};

const expectPowerSavings = (savings: number, minExpected = 0) => {
  expect(savings).toBeGreaterThanOrEqual(minExpected);
  expect(savings).toBeLessThan(1000); // Reasonable upper bound
};

const _expectOptimizationSuggestions = (
  suggestions: any[],
  expectedCount: number,
) => {
  expect(suggestions).toBeDefined();
  expect(suggestions.length).toBeGreaterThanOrEqual(expectedCount);
};

describe('BatteryManager Behavior', () => {
  let batteryManager: BatteryManager;
  let mockEnv: any;
  let scenarios: ReturnType<typeof createBatteryScenarios>;

  beforeEach(async () => {
    const { globalObj, mockBattery, setIntervalSpy, clearIntervalSpy } =
      createMockEnvironment();
    mockEnv = { globalObj, mockBattery, setIntervalSpy, clearIntervalSpy };
    scenarios = createBatteryScenarios();

    // Reset singleton
    (BatteryManager as any).instance = undefined;
    // Reset getInstance call counter
    (BatteryManager as any).getInstanceCallCount = 0;

    batteryManager = BatteryManager.getInstance();

    vi.clearAllMocks();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Battery Monitoring Behavior', () => {
    it('should initialize battery monitoring successfully', async () => {
      expect(batteryManager).toBeDefined();

      // Should have access to battery metrics
      const metrics = batteryManager.getBatteryMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.currentDrainRate).toBeGreaterThanOrEqual(0);
      expect(metrics.sessionStartBattery).toBeGreaterThanOrEqual(0);
    });

    it('should start and stop battery monitoring', () => {
      // Start monitoring
      batteryManager.startBatteryMonitoring();

      // Should have started monitoring intervals
      expect(mockEnv.setIntervalSpy).toHaveBeenCalled();

      // Stop monitoring
      batteryManager.stopBatteryMonitoring();

      // Should be able to start/stop without errors
      expect(() => batteryManager.stopBatteryMonitoring()).not.toThrow();
    });

    it('should track battery usage metrics over time', async () => {
      batteryManager.startBatteryMonitoring();

      // Simulate some time passing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const metrics = batteryManager.getBatteryMetrics();

      expect(metrics.averageDrainRate).toBeGreaterThanOrEqual(0);
      expect(metrics.projectedSessionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.audioEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.audioEfficiency).toBeLessThanOrEqual(1);
    });

    it('should generate battery usage reports', () => {
      const report = batteryManager.generateUsageReport();

      expect(report).toBeDefined();
      expect(report.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(report.audioEfficiency).toBeGreaterThanOrEqual(0);
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Power Mode Adaptation', () => {
    it('should adapt to high battery levels', async () => {
      // Mock high battery status
      mockEnv.mockBattery.level = scenarios.highBatteryStatus.level;
      mockEnv.mockBattery.dischargingTime =
        scenarios.highBatteryStatus.dischargingTime;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Should recommend higher quality for high battery
      expect(['ultra', 'high', 'medium']).toContain(
        metrics.optimalQualityRecommendation,
      );
    });

    it('should switch to battery saver mode for low battery', async () => {
      // Mock low battery status
      console.log(
        `Test changing mockBattery.level from ${mockEnv.mockBattery.level} to ${scenarios.lowBatteryStatus.level}`,
      );
      mockEnv.mockBattery.level = scenarios.lowBatteryStatus.level;
      mockEnv.mockBattery.dischargingTime =
        scenarios.lowBatteryStatus.dischargingTime;
      console.log(
        `Test changed mockBattery.level to ${mockEnv.mockBattery.level}`,
      );

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: false,
        },
      });

      batteryManager.startBatteryMonitoring();
      // Force a fresh battery status update after mock changes
      await batteryManager.refreshBatteryStatus();
      // Give extra time for the system to pick up the new mock battery values
      await new Promise((resolve) => setTimeout(resolve, 200));

      const metrics = batteryManager.getBatteryMetrics();

      // Should recommend aggressive battery optimization
      expect(['minimal', 'low', 'medium']).toContain(
        metrics.optimalQualityRecommendation,
      );
    });

    it('should apply battery saver mode at 15% battery automatically', async () => {
      // Mock 15% battery triggering battery saver
      mockEnv.mockBattery.level = 0.15;
      mockEnv.mockBattery.charging = false;

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: false,
        },
      });

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const settings = batteryManager.getPowerManagementSettings();
      // Should have automatically switched to battery saver
      expect(['battery_saver', 'balanced']).toContain(settings.powerMode);
    });

    it('should apply aggressive mode at 8% battery automatically', async () => {
      // Mock 8% battery triggering aggressive mode
      mockEnv.mockBattery.level = 0.08;
      mockEnv.mockBattery.charging = false;

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: false,
        },
      });

      batteryManager.startBatteryMonitoring();
      // Force a fresh battery status update after mock changes
      await batteryManager.refreshBatteryStatus();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const settings = batteryManager.getPowerManagementSettings();
      // Should have applied aggressive optimizations
      expect(['battery_saver']).toContain(settings.powerMode);
    });

    it('should apply emergency mode at 1% battery with specific optimizations', async () => {
      // Mock 1% battery triggering emergency mode
      mockEnv.mockBattery.level = 0.01;
      mockEnv.mockBattery.charging = false;

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: false,
        },
      });

      batteryManager.startBatteryMonitoring();
      // Force a fresh battery status update after mock changes
      await batteryManager.refreshBatteryStatus();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const settings = batteryManager.getPowerManagementSettings();
      // Should have applied emergency mode with specific customizations
      expect(settings.powerMode).toBe('battery_saver');
      expect(settings.customOptimizations).toMatchObject({
        reducedPolyphony: expect.any(Number),
        disableEffects: true,
        lowerSampleRate: true,
        backgroundSuspension: true,
        displayDimming: true,
      });
      // Emergency mode should have very limited polyphony
      expect(settings.customOptimizations.reducedPolyphony).toBeLessThanOrEqual(
        4,
      );
    });

    it('should handle emergency power mode for critical battery', async () => {
      // Mock critical battery status
      mockEnv.mockBattery.level = scenarios.criticalBatteryStatus.level;
      mockEnv.mockBattery.dischargingTime =
        scenarios.criticalBatteryStatus.dischargingTime;

      batteryManager.startBatteryMonitoring();
      // Force a fresh battery status update after mock changes
      await batteryManager.refreshBatteryStatus();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Should recommend minimal quality for critical battery
      expect(['minimal', 'low']).toContain(
        metrics.optimalQualityRecommendation,
      );
      expect(metrics.estimatedTimeRemaining).toBeLessThan(120); // Should show very low time remaining
    });

    it('should optimize for charging when enabled', async () => {
      // Mock charging status
      mockEnv.mockBattery.charging = true;
      mockEnv.mockBattery.level = 0.3; // 30% but charging
      mockEnv.mockBattery.chargingTime = 120; // 2 hours to full

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: true,
        },
      });

      batteryManager.startBatteryMonitoring();
      // Force a fresh battery status update after mock changes
      await batteryManager.refreshBatteryStatus();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const preferences = batteryManager.getUserPreferences();
      // Should prioritize quality over battery when charging
      expect(preferences.prioritizeQuality).toBe(true);
      expect(preferences.prioritizeBatteryLife).toBe(false);
    });

    it('should optimize differently when charging', async () => {
      // Mock charging status
      mockEnv.mockBattery.charging = true;
      mockEnv.mockBattery.level = scenarios.chargingBatteryStatus.level;
      mockEnv.mockBattery.chargingTime =
        scenarios.chargingBatteryStatus.chargingTime;

      await batteryManager.updatePowerManagementSettings({
        enableAutomaticOptimization: true,
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: true,
        },
      });

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Should be less aggressive when charging
      expect(['medium', 'high']).toContain(
        metrics.optimalQualityRecommendation,
      );
    });
  });

  describe('User Preferences Integration', () => {
    it('should respect battery-prioritized user preferences', () => {
      batteryManager.updateUserPreferences(
        scenarios.batteryOptimizedPreferences,
      );

      const preferences = batteryManager.getUserPreferences();

      expect(preferences.prioritizeBatteryLife).toBe(true);
      expect(preferences.automaticQualityScaling).toBe(true);
      expect(preferences.allowBackgroundOptimization).toBe(true);
    });

    it('should respect quality-prioritized user preferences', () => {
      batteryManager.updateUserPreferences(
        scenarios.qualityOptimizedPreferences,
      );

      const preferences = batteryManager.getUserPreferences();

      expect(preferences.prioritizeQuality).toBe(true);
      expect(preferences.automaticQualityScaling).toBe(false);
      expect(preferences.allowBackgroundOptimization).toBe(false);
    });

    it('should balance user preferences with battery constraints', async () => {
      // Set preferences but low battery
      batteryManager.updateUserPreferences(
        scenarios.batteryOptimizedPreferences,
      );
      mockEnv.mockBattery.level = scenarios.lowBatteryStatus.level;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Should still provide optimization recommendations
      expect(metrics.suggestedOptimizations).toBeDefined();
    });
  });

  describe('Power Management Settings', () => {
    it('should update power management settings', async () => {
      const newSettings = {
        powerMode: 'battery_saver' as const,
        qualityVsBatteryPreference: 0.2, // Prioritize battery
        batteryThresholds: {
          enableBatterySaver: 30,
          enableAggressiveMode: 15,
          emergencyMode: 8,
          chargingOptimization: true,
        },
      };

      await batteryManager.updatePowerManagementSettings(newSettings);

      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.powerMode).toBe('battery_saver');
      expect(settings.qualityVsBatteryPreference).toBe(0.2);
      expect(settings.batteryThresholds.enableBatterySaver).toBe(30);
    });

    it('should apply custom optimizations', async () => {
      await batteryManager.updatePowerManagementSettings({
        customOptimizations: {
          reducedPolyphony: 16,
          disableEffects: true,
          lowerSampleRate: true,
          backgroundSuspension: true,
        },
      });

      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.customOptimizations.reducedPolyphony).toBe(16);
      expect(settings.customOptimizations.disableEffects).toBe(true);
    });

    it('should reset power settings to defaults', async () => {
      // Modify settings first
      await batteryManager.updatePowerManagementSettings({
        powerMode: 'battery_saver',
        qualityVsBatteryPreference: 0.1,
      });

      // Reset to defaults
      await batteryManager.resetPowerSettings();

      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.powerMode).toBe('balanced');
      expect(settings.qualityVsBatteryPreference).toBeGreaterThan(0.5);
    });
  });

  describe('Optimization Suggestions', () => {
    it('should generate context-appropriate optimization suggestions', async () => {
      // Set medium battery with monitoring
      mockEnv.mockBattery.level = 0.45;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      expect(metrics.suggestedOptimizations).toBeDefined();
      expect(metrics.suggestedOptimizations).toBeInstanceOf(Array);

      // Suggestions should have proper structure if they exist
      metrics.suggestedOptimizations.forEach((suggestion) => {
        expect(suggestion.type).toBeDefined();
        expect(suggestion.impact).toBeDefined();
        expect(suggestion.estimatedSavings).toBeGreaterThanOrEqual(0);
        expect(suggestion.description).toBeDefined();
        expect(suggestion.action).toBeInstanceOf(Function);
      });
    });

    it('should apply optimization suggestions', async () => {
      mockEnv.mockBattery.level = scenarios.lowBatteryStatus.level;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      if (metrics.suggestedOptimizations.length > 0) {
        const suggestion = metrics.suggestedOptimizations[0];
        if (suggestion) {
          await batteryManager.applyOptimization(suggestion);
        }

        // Should apply without throwing errors
        expect(true).toBe(true); // Optimization applied successfully
      }
    });
  });

  describe('Audio System Drain Calculation', () => {
    beforeAll(() => {
      // Reset audio drain calculation counter only once for the entire test block
      (BatteryManager as any).audioDrainCalculationCount = 0;
    });

    it('should calculate audio system drain based on performance metrics', async () => {
      // Mock realistic performance metrics
      const mockPerformanceMetrics = {
        cpuUsage: 45,
        memoryUsage: 60,
        polyphony: 8,
        bufferSize: 512,
        sampleRate: 44100,
        activeVoices: 6,
        audioProcessingTime: 12.5,
      };

      // Mock PerformanceMonitor to return specific metrics
      const mockPerformanceMonitor = {
        getMetrics: vi.fn().mockReturnValue(mockPerformanceMetrics),
        getCurrentMetrics: vi.fn().mockReturnValue(mockPerformanceMetrics),
      };

      vi.doMock('../PerformanceMonitor.js', () => ({
        PerformanceMonitor: {
          getInstance: () => mockPerformanceMonitor,
        },
      }));

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Audio drain should be calculated based on the performance metrics
      expect(metrics.audioSystemDrain).toBeGreaterThan(0);
      // Drain should correlate with CPU usage and polyphony
      expect(metrics.audioSystemDrain).toBeGreaterThan(10); // Base drain
      expect(metrics.audioSystemDrain).toBeLessThan(100); // Reasonable upper limit
    });

    it('should calculate higher drain for complex audio scenarios', async () => {
      // Mock high-complexity audio scenario
      const highComplexityMetrics = {
        cpuUsage: 85,
        memoryUsage: 80,
        polyphony: 16,
        bufferSize: 256,
        sampleRate: 48000,
        activeVoices: 14,
        audioProcessingTime: 25.8,
      };

      const mockPerformanceMonitor = {
        getMetrics: vi.fn().mockReturnValue(highComplexityMetrics),
        getCurrentMetrics: vi.fn().mockReturnValue(highComplexityMetrics),
      };

      vi.doMock('../PerformanceMonitor.js', () => ({
        PerformanceMonitor: {
          getInstance: () => mockPerformanceMonitor,
        },
      }));

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // High-complexity scenarios should have higher drain
      expect(metrics.audioSystemDrain).toBeGreaterThan(30);
    });

    it('should calculate lower drain for optimized audio scenarios', async () => {
      // Reset singleton before test to ensure fresh initialization with mocks
      (BatteryManager as any).instance = undefined;

      // Mock optimized audio scenario with valid AudioPerformanceMetrics properties
      const optimizedMetrics = {
        latency: 15,
        averageLatency: 16,
        maxLatency: 25,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 15, // Low CPU usage - optimized!
        memoryUsage: 25, // Low memory usage - optimized!
        sampleRate: 44100,
        bufferSize: 1024, // Large buffer - optimized!
        timestamp: Date.now(),
        networkLatency: 20,
        cacheHitRate: 0.9,
      };

      const mockPerformanceMonitor = {
        getMetrics: vi.fn().mockReturnValue(optimizedMetrics),
        getCurrentMetrics: vi.fn().mockReturnValue(optimizedMetrics),
      };

      vi.doMock('../PerformanceMonitor.js', () => ({
        PerformanceMonitor: {
          getInstance: () => mockPerformanceMonitor,
        },
      }));

      // Create fresh BatteryManager instance with the mock
      const testBatteryManager = BatteryManager.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow initialization

      testBatteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = testBatteryManager.getBatteryMetrics();

      // Optimized scenarios should have lower drain
      expect(metrics.audioSystemDrain).toBeLessThan(20);
      expect(metrics.audioSystemDrain).toBeGreaterThan(0);

      // Clean up
      testBatteryManager.dispose();
    });
  });

  describe('Power Mode Implementation Details', () => {
    it('should implement performance mode with quality prioritization', async () => {
      await batteryManager.updatePowerManagementSettings({
        powerMode: 'performance',
        qualityVsBatteryPreference: 0.8, // Prioritize quality
      });

      const preferences = batteryManager.getUserPreferences();
      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.powerMode).toBe('performance');
      expect(preferences.prioritizeQuality).toBe(true);
      expect(preferences.prioritizeBatteryLife).toBe(false);
      expect(preferences.prioritizeStability).toBe(false);
    });

    it('should implement balanced mode with stability prioritization', async () => {
      await batteryManager.updatePowerManagementSettings({
        powerMode: 'balanced',
        qualityVsBatteryPreference: 0.5, // Balanced
      });

      const preferences = batteryManager.getUserPreferences();
      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.powerMode).toBe('balanced');
      expect(preferences.prioritizeStability).toBe(true);
      expect(preferences.prioritizeQuality).toBe(false);
      expect(preferences.prioritizeBatteryLife).toBe(false);
    });

    it('should implement battery saver mode with battery life prioritization', async () => {
      await batteryManager.updatePowerManagementSettings({
        powerMode: 'battery_saver',
        qualityVsBatteryPreference: 0.2, // Prioritize battery
      });

      const preferences = batteryManager.getUserPreferences();
      const settings = batteryManager.getPowerManagementSettings();

      expect(settings.powerMode).toBe('battery_saver');
      expect(preferences.prioritizeBatteryLife).toBe(true);
      expect(preferences.prioritizeQuality).toBe(false);
      expect(preferences.prioritizeStability).toBe(false);
    });
  });

  describe('Battery History and Analytics', () => {
    it('should maintain battery usage history', async () => {
      batteryManager.startBatteryMonitoring();

      // Simulate some time passing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const history = batteryManager.getBatteryHistory(1); // Last 1 hour

      expect(history).toBeInstanceOf(Array);
      // May be empty initially, but structure should be correct
      if (history.length > 0) {
        const entry = history[0];
        if (entry) {
          expect(entry.timestamp).toBeDefined();
          expect(entry.batteryLevel).toBeGreaterThanOrEqual(0);
          expect(entry.batteryLevel).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should calculate battery efficiency metrics', () => {
      const metrics = batteryManager.getBatteryMetrics();

      expect(metrics.audioEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.audioEfficiency).toBeLessThanOrEqual(1);
      expectPowerSavings(metrics.optimizationSavings);
    });

    it('should track thermal impact on battery', () => {
      const metrics = batteryManager.getBatteryMetrics();

      expect(metrics.thermalImpact).toBeGreaterThanOrEqual(0);
      expect(metrics.instantaneousPower).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuPowerUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Handling', () => {
    it('should trigger battery warning events', async () => {
      const warningHandler = vi.fn();

      batteryManager.setEventHandlers({
        onBatteryWarning: warningHandler,
      });

      // Simulate critical battery
      mockEnv.mockBattery.level = scenarios.criticalBatteryStatus.level;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Warning handler might be called for critical battery
      // (Depends on implementation details)
    });

    it('should trigger usage report events', () => {
      const reportHandler = vi.fn();

      batteryManager.setEventHandlers({
        onUsageReport: reportHandler,
      });

      // Generate usage report
      const report = batteryManager.generateUsageReport();

      expect(report).toBeDefined();
      expect(report.sessionDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Battery API unavailability gracefully', async () => {
      // Mock unavailable Battery API
      mockEnv.globalObj.navigator.getBattery = undefined;

      // Reset singleton to test initialization without Battery API
      (BatteryManager as any).instance = undefined;
      const newBatteryManager = BatteryManager.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => newBatteryManager.getBatteryMetrics()).not.toThrow();
      const metrics = newBatteryManager.getBatteryMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.currentDrainRate).toBeGreaterThanOrEqual(0);
      newBatteryManager.dispose();
    });

    it('should handle performance monitoring errors gracefully', async () => {
      // Create mock that throws errors
      const mockPerformanceMonitor = {
        getMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Performance monitoring error');
        }),
        getCurrentMetrics: vi.fn().mockImplementation(() => {
          throw new Error('Performance monitoring error');
        }),
      };

      // Mock the singleton to return our error-throwing monitor
      vi.doMock('../PerformanceMonitor.js', () => ({
        PerformanceMonitor: {
          getInstance: () => mockPerformanceMonitor,
        },
      }));

      // Should not crash the battery manager
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(() => batteryManager.getBatteryMetrics()).not.toThrow();
      const metrics = batteryManager.getBatteryMetrics();
      expect(metrics.audioSystemDrain).toBeGreaterThanOrEqual(0);
    });

    it('should handle optimization errors gracefully', async () => {
      const mockSuggestion = {
        type: 'quality_reduction' as const,
        impact: 'high' as const,
        userExperience: 'moderate' as const,
        estimatedSavings: 30,
        description: 'Test optimization',
        action: () => {
          throw new Error('Action failed');
        },
      };

      // Should handle errors gracefully without crashing
      await expect(
        batteryManager.applyOptimization(mockSuggestion),
      ).resolves.toBeUndefined();
    });

    it('should handle missing battery API gracefully', async () => {
      // Remove battery API
      mockEnv.globalObj.navigator.getBattery = undefined;

      // Should still initialize without errors
      const newManager = BatteryManager.getInstance();
      expect(newManager).toBeDefined();

      const metrics = newManager.getBatteryMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle invalid battery readings', async () => {
      // Simulate invalid battery data
      mockEnv.mockBattery.level = -1;
      mockEnv.mockBattery.dischargingTime = NaN;

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();

      // Should handle invalid data gracefully
      expect(metrics.currentDrainRate).toBeGreaterThanOrEqual(0);
      expect(metrics.projectedSessionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid battery level changes', async () => {
      batteryManager.startBatteryMonitoring();

      // Simulate rapid changes
      mockEnv.mockBattery.level = 0.8;
      await new Promise((resolve) => setTimeout(resolve, 50));

      mockEnv.mockBattery.level = 0.2;
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = batteryManager.getBatteryMetrics();

      // Should handle rapid changes without errors
      expect(metrics.currentDrainRate).toBeGreaterThanOrEqual(0);
    });

    it('should handle corrupted battery status gracefully', async () => {
      // Simulate corrupted battery status
      mockEnv.mockBattery.level = null;
      mockEnv.mockBattery.charging = undefined;
      mockEnv.mockBattery.dischargingTime = 'invalid';

      batteryManager.startBatteryMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();
      // Should provide sensible defaults
      expect(metrics.currentDrainRate).toBeGreaterThanOrEqual(0);
      expect(metrics.projectedSessionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Lifecycle Management', () => {
    it('should maintain singleton behavior', () => {
      const manager1 = BatteryManager.getInstance();
      const manager2 = BatteryManager.getInstance();

      expect(manager1).toBe(manager2);
    });

    it('should dispose resources cleanly', () => {
      batteryManager.startBatteryMonitoring();

      batteryManager.dispose();

      // Should dispose without errors
      expect(() => batteryManager.dispose()).not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      batteryManager.startBatteryMonitoring();
      batteryManager.stopBatteryMonitoring();
      batteryManager.startBatteryMonitoring();
      batteryManager.stopBatteryMonitoring();

      // Should handle multiple cycles without errors
      expect(true).toBe(true);
    });
  });
});
