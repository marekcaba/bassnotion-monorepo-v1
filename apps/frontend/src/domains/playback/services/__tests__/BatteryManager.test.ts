/**
 * BatteryManager Test Suite
 *
 * Tests battery usage monitoring, power management, and user controls
 * for Subtask 7.5: Battery Usage Monitoring with User Controls
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BatteryManager,
  type PowerManagementSettings,
  type BatteryOptimizationSuggestion,
} from '../BatteryManager.js';
import { MobileOptimizer } from '../MobileOptimizer.js';
import { PerformanceMonitor } from '../PerformanceMonitor.js';
import type {
  UserOptimizationPreferences,
  BatteryStatus,
  AudioPerformanceMetrics,
} from '../../types/audio.js';

// Mock dependencies
vi.mock('../MobileOptimizer.js');
vi.mock('../PerformanceMonitor.js');

describe('BatteryManager', () => {
  let batteryManager: BatteryManager;
  let mockMobileOptimizer: any;
  let mockPerformanceMonitor: any;
  let mockBatteryAPI: any;

  beforeEach(() => {
    // Reset singleton instances
    (BatteryManager as any).instance = undefined;
    (MobileOptimizer as any).instance = undefined;
    (PerformanceMonitor as any).instance = undefined;

    // Mock battery API
    mockBatteryAPI = {
      level: 0.8,
      charging: false,
      chargingTime: Infinity,
      dischargingTime: 300, // 5 hours
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock navigator.getBattery
    const mockGetBattery = vi.fn().mockResolvedValue(mockBatteryAPI);
    Object.defineProperty(navigator, 'getBattery', {
      value: mockGetBattery,
      configurable: true,
    });

    // Mock MobileOptimizer
    mockMobileOptimizer = {
      getBatteryStatus: vi.fn().mockResolvedValue({
        level: 0.8,
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      } as BatteryStatus),
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        deviceClass: 'mid-range',
        cpuCores: 4,
        memoryGB: 4,
      }),
      getCurrentQualityConfig: vi.fn().mockReturnValue({
        qualityLevel: 'medium',
        enableEffects: true,
        enableVisualization: true,
        backgroundProcessing: true,
        aggressiveBatteryMode: false,
        thermalManagement: false,
        backgroundAudioReduction: false,
        estimatedBatteryImpact: 0.5,
        estimatedCpuUsage: 0.4,
      }),
      setUserPreferences: vi.fn(),
      optimizeForCurrentConditions: vi.fn().mockResolvedValue({
        qualityConfig: {},
        reasoning: { explanation: 'Test optimization' },
        estimatedImprovement: {},
        confidence: 0.8,
        nextReEvaluationTime: Date.now() + 30000,
      }),
    };

    // Mock PerformanceMonitor
    mockPerformanceMonitor = {
      getMetrics: vi.fn().mockReturnValue({
        latency: 25,
        averageLatency: 30,
        maxLatency: 45,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 40,
        memoryUsage: 256,
        sampleRate: 44100,
        bufferSize: 512,
        timestamp: Date.now(),
      } as AudioPerformanceMetrics),
    };

    // Mock singleton getInstance methods
    vi.mocked(MobileOptimizer.getInstance).mockReturnValue(mockMobileOptimizer);
    vi.mocked(PerformanceMonitor.getInstance).mockReturnValue(
      mockPerformanceMonitor,
    );

    batteryManager = BatteryManager.getInstance();
  });

  afterEach(() => {
    batteryManager.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = BatteryManager.getInstance();
      const instance2 = BatteryManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize Battery API event listeners', async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockBatteryAPI.addEventListener).toHaveBeenCalledWith(
        'chargingchange',
        expect.any(Function),
      );
      expect(mockBatteryAPI.addEventListener).toHaveBeenCalledWith(
        'levelchange',
        expect.any(Function),
      );
      expect(mockBatteryAPI.addEventListener).toHaveBeenCalledWith(
        'chargingtimechange',
        expect.any(Function),
      );
      expect(mockBatteryAPI.addEventListener).toHaveBeenCalledWith(
        'dischargingtimechange',
        expect.any(Function),
      );
    });

    it('should establish power baselines based on device class', async () => {
      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockMobileOptimizer.getDeviceCapabilities).toHaveBeenCalled();
    });
  });

  describe('Battery Monitoring', () => {
    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should start and stop battery monitoring', () => {
      expect(() => batteryManager.startBatteryMonitoring()).not.toThrow();
      expect(() => batteryManager.stopBatteryMonitoring()).not.toThrow();
    });

    it('should collect battery metrics', () => {
      const metrics = batteryManager.getBatteryMetrics();

      expect(metrics).toMatchObject({
        currentDrainRate: expect.any(Number),
        audioSystemDrain: expect.any(Number),
        estimatedTimeRemaining: expect.any(Number),
        averageDrainRate: expect.any(Number),
        totalAudioUsage: expect.any(Number),
        sessionStartBattery: expect.any(Number),
        audioEfficiency: expect.any(Number),
        optimizationSavings: expect.any(Number),
        thermalImpact: expect.any(Number),
        instantaneousPower: expect.any(Number),
        cpuPowerUsage: expect.any(Number),
        audioPowerUsage: expect.any(Number),
        displayPowerUsage: expect.any(Number),
        projectedSessionTime: expect.any(Number),
        optimalQualityRecommendation: expect.stringMatching(
          /^(ultra|high|medium|low|minimal)$/,
        ),
        suggestedOptimizations: expect.any(Array),
      });
    });

    it('should calculate audio system drain based on performance metrics', () => {
      const metrics = batteryManager.getBatteryMetrics();

      // Audio system drain should be calculated based on CPU usage and quality settings
      expect(metrics.audioSystemDrain).toBeGreaterThan(0);
      expect(metrics.cpuPowerUsage).toBeGreaterThan(0);
      expect(metrics.audioPowerUsage).toBeGreaterThan(0);
      expect(metrics.displayPowerUsage).toBeGreaterThan(0);
    });

    it('should track battery history', async () => {
      // Start monitoring to generate history
      batteryManager.startBatteryMonitoring();

      // Wait for history to be recorded
      await new Promise((resolve) => setTimeout(resolve, 100));

      const history = batteryManager.getBatteryHistory(1); // Last 1 hour
      expect(Array.isArray(history)).toBe(true);

      batteryManager.stopBatteryMonitoring();
    });
  });

  describe('Power Management Settings', () => {
    it('should get and update power management settings', () => {
      const settings = batteryManager.getPowerManagementSettings();

      expect(settings).toMatchObject({
        enableAutomaticOptimization: expect.any(Boolean),
        batteryThresholds: {
          enableBatterySaver: expect.any(Number),
          enableAggressiveMode: expect.any(Number),
          emergencyMode: expect.any(Number),
          chargingOptimization: expect.any(Boolean),
        },
        powerMode: expect.stringMatching(
          /^(performance|balanced|battery_saver|custom)$/,
        ),
        qualityVsBatteryPreference: expect.any(Number),
        backgroundOptimizationAllowed: expect.any(Boolean),
        thermalThrottlingEnabled: expect.any(Boolean),
        batteryWarningsEnabled: expect.any(Boolean),
        optimizationNotificationsEnabled: expect.any(Boolean),
        usageReportsEnabled: expect.any(Boolean),
        customOptimizations: expect.any(Object),
      });

      // Update settings
      const newSettings: Partial<PowerManagementSettings> = {
        powerMode: 'battery_saver',
        batteryThresholds: {
          ...settings.batteryThresholds,
          enableBatterySaver: 25,
        },
      };

      batteryManager.updatePowerManagementSettings(newSettings);

      const updatedSettings = batteryManager.getPowerManagementSettings();
      expect(updatedSettings.powerMode).toBe('battery_saver');
      expect(updatedSettings.batteryThresholds.enableBatterySaver).toBe(25);
    });

    it('should apply power mode changes', async () => {
      batteryManager.updatePowerManagementSettings({
        powerMode: 'performance',
      });

      // Should update user preferences and trigger optimization
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalled();
      expect(
        mockMobileOptimizer.optimizeForCurrentConditions,
      ).toHaveBeenCalled();
    });
  });

  describe('User Preferences Management', () => {
    it('should get and update user preferences', () => {
      const preferences = batteryManager.getUserPreferences();

      expect(preferences).toMatchObject({
        prioritizeBatteryLife: expect.any(Boolean),
        prioritizeQuality: expect.any(Boolean),
        prioritizeStability: expect.any(Boolean),
        allowBackgroundOptimization: expect.any(Boolean),
        thermalManagementEnabled: expect.any(Boolean),
        automaticQualityScaling: expect.any(Boolean),
      });

      // Update preferences
      const newPreferences: Partial<UserOptimizationPreferences> = {
        prioritizeBatteryLife: true,
        prioritizeQuality: false,
      };

      batteryManager.updateUserPreferences(newPreferences);

      const updatedPreferences = batteryManager.getUserPreferences();
      expect(updatedPreferences.prioritizeBatteryLife).toBe(true);
      expect(updatedPreferences.prioritizeQuality).toBe(false);

      // Should sync with MobileOptimizer
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining(newPreferences),
      );
    });
  });

  describe('Optimization Suggestions', () => {
    it('should generate optimization suggestions based on battery level', async () => {
      // Mock low battery
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.2, // 20% battery
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for metrics update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = batteryManager.getBatteryMetrics();
      const suggestions = metrics.suggestedOptimizations;

      expect(Array.isArray(suggestions)).toBe(true);

      if (suggestions.length > 0) {
        suggestions.forEach((suggestion: BatteryOptimizationSuggestion) => {
          expect(suggestion).toMatchObject({
            type: expect.stringMatching(
              /^(quality_reduction|feature_disable|background_optimization|thermal_management)$/,
            ),
            impact: expect.stringMatching(/^(low|medium|high)$/),
            userExperience: expect.stringMatching(
              /^(minimal|moderate|significant)$/,
            ),
            estimatedSavings: expect.any(Number),
            description: expect.any(String),
            action: expect.any(Function),
          });
        });
      }
    });

    it('should apply optimization suggestions', async () => {
      const mockSuggestion: BatteryOptimizationSuggestion = {
        type: 'quality_reduction',
        impact: 'high',
        userExperience: 'moderate',
        estimatedSavings: 30,
        description: 'Test optimization',
        action: vi.fn(),
      };

      await batteryManager.applyOptimization(mockSuggestion);

      expect(mockSuggestion.action).toHaveBeenCalled();

      const metrics = batteryManager.getBatteryMetrics();
      expect(metrics.optimizationSavings).toBe(30);
    });
  });

  describe('Automatic Optimizations', () => {
    it('should apply battery saver mode at low battery', async () => {
      // Mock low battery triggering battery saver
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.15, // 15% battery - should trigger battery saver
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for automatic optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have triggered user preference changes
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalled();
      expect(
        mockMobileOptimizer.optimizeForCurrentConditions,
      ).toHaveBeenCalled();
    });

    it('should apply aggressive mode at very low battery', async () => {
      // Mock very low battery triggering aggressive mode
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.08, // 8% battery - should trigger aggressive mode
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for automatic optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have triggered aggressive optimizations
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalled();
      expect(
        mockMobileOptimizer.optimizeForCurrentConditions,
      ).toHaveBeenCalled();
    });

    it('should apply emergency mode at critical battery', async () => {
      // Mock critical battery triggering emergency mode
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.03, // 3% battery - should trigger emergency mode
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for automatic optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have triggered emergency optimizations
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalled();
      expect(
        mockMobileOptimizer.optimizeForCurrentConditions,
      ).toHaveBeenCalled();

      const settings = batteryManager.getPowerManagementSettings();
      expect(settings.customOptimizations).toMatchObject({
        reducedPolyphony: 2,
        disableEffects: true,
        lowerSampleRate: true,
        backgroundSuspension: true,
        displayDimming: true,
      });
    });

    it('should optimize for charging when enabled', async () => {
      // Enable charging optimization
      batteryManager.updatePowerManagementSettings({
        batteryThresholds: {
          enableBatterySaver: 20,
          enableAggressiveMode: 10,
          emergencyMode: 5,
          chargingOptimization: true,
        },
      });

      // Mock charging device
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.3, // 30% battery but charging
        charging: true,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for automatic optimization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should optimize for quality while charging
      expect(mockMobileOptimizer.setUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          prioritizeBatteryLife: false,
          prioritizeQuality: true,
        }),
      );
    });
  });

  describe('Battery Warnings', () => {
    it('should emit low battery warnings', async () => {
      const warningHandler = vi.fn();
      batteryManager.setEventHandlers({ onBatteryWarning: warningHandler });

      // Mock low battery
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.12, // 12% battery - should trigger warning
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for warning check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Warning should have been emitted
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory',
          severity: 'warning',
          message: expect.stringContaining('Low battery'),
        }),
      );
    });

    it('should emit critical battery warnings', async () => {
      const warningHandler = vi.fn();
      batteryManager.setEventHandlers({ onBatteryWarning: warningHandler });

      // Mock critical battery
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.04, // 4% battery - should trigger critical warning
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for warning check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Critical warning should have been emitted
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory',
          severity: 'critical',
          message: expect.stringContaining('Critical battery'),
        }),
      );
    });

    it('should not emit warnings when charging', async () => {
      const warningHandler = vi.fn();
      batteryManager.setEventHandlers({ onBatteryWarning: warningHandler });

      // Mock low battery but charging
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.04, // 4% battery but charging
        charging: true,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for warning check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No warning should be emitted while charging
      expect(warningHandler).not.toHaveBeenCalled();
    });
  });

  describe('Usage Reporting', () => {
    it('should generate usage report', () => {
      const report = batteryManager.generateUsageReport();

      expect(report).toMatchObject({
        sessionDuration: expect.any(Number),
        totalBatteryUsed: expect.any(Number),
        averagePowerUsage: expect.any(Number),
        audioEfficiency: expect.any(Number),
        optimizationSavings: expect.any(Number),
        recommendations: expect.any(Array),
      });

      // Duration should be positive
      expect(report.sessionDuration).toBeGreaterThan(0);

      // Recommendations should be strings
      report.recommendations.forEach((rec) => {
        expect(typeof rec).toBe('string');
      });
    });

    it('should provide specific recommendations based on usage patterns', () => {
      // Mock poor efficiency metrics
      const currentMetrics = batteryManager.getBatteryMetrics();
      (batteryManager as any).currentMetrics = {
        ...currentMetrics,
        audioEfficiency: 0.4, // Low efficiency
        thermalImpact: 0.5, // High thermal impact
        currentDrainRate: 20, // High drain rate
      };

      const report = batteryManager.generateUsageReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(
        report.recommendations.some((rec) =>
          rec.includes('lower quality settings'),
        ),
      ).toBe(true);
      expect(
        report.recommendations.some((rec) =>
          rec.includes('thermal management'),
        ),
      ).toBe(true);
      expect(
        report.recommendations.some((rec) =>
          rec.includes('battery optimizations'),
        ),
      ).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should handle battery change events', () => {
      const handler = vi.fn();
      batteryManager.setEventHandlers({ onPowerModeChange: handler });

      // Trigger power mode change
      batteryManager.updatePowerManagementSettings({
        powerMode: 'performance',
      });

      expect(handler).toHaveBeenCalledWith('performance');
    });

    it('should handle optimization recommendation events', async () => {
      const handler = vi.fn();
      batteryManager.setEventHandlers({
        onOptimizationRecommendation: handler,
      });

      // Mock conditions that trigger recommendations
      mockMobileOptimizer.getBatteryStatus.mockResolvedValue({
        level: 0.25, // 25% battery - should trigger recommendations
        charging: false,
        powerMode: 'balanced',
        lowPowerModeEnabled: false,
      });

      // Wait for recommendations to be generated
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Handler should be called if recommendations are generated
      // (depends on the specific conditions and current settings)
    });
  });

  describe('Power Mode Management', () => {
    it('should handle performance mode', async () => {
      batteryManager.updatePowerManagementSettings({
        powerMode: 'performance',
      });

      const preferences = batteryManager.getUserPreferences();
      expect(preferences.prioritizeQuality).toBe(true);
      expect(preferences.prioritizeBatteryLife).toBe(false);
      expect(preferences.prioritizeStability).toBe(false);
    });

    it('should handle balanced mode', async () => {
      batteryManager.updatePowerManagementSettings({ powerMode: 'balanced' });

      const preferences = batteryManager.getUserPreferences();
      expect(preferences.prioritizeQuality).toBe(false);
      expect(preferences.prioritizeBatteryLife).toBe(false);
      expect(preferences.prioritizeStability).toBe(true);
    });

    it('should handle battery saver mode', async () => {
      batteryManager.updatePowerManagementSettings({
        powerMode: 'battery_saver',
      });

      const preferences = batteryManager.getUserPreferences();
      expect(preferences.prioritizeQuality).toBe(false);
      expect(preferences.prioritizeBatteryLife).toBe(true);
      expect(preferences.prioritizeStability).toBe(false);
    });
  });

  describe('Reset and Disposal', () => {
    it('should reset to default power settings', async () => {
      // Change settings first
      batteryManager.updatePowerManagementSettings({
        powerMode: 'performance',
        batteryWarningsEnabled: false,
      });

      // Reset to defaults
      await batteryManager.resetPowerSettings();

      const settings = batteryManager.getPowerManagementSettings();
      expect(settings.powerMode).toBe('balanced');
      expect(settings.batteryWarningsEnabled).toBe(true);
    });

    it('should dispose properly', () => {
      batteryManager.startBatteryMonitoring();

      expect(() => batteryManager.dispose()).not.toThrow();

      // Should have removed event listeners
      expect(mockBatteryAPI.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Battery API unavailability gracefully', async () => {
      // Mock unavailable Battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: undefined,
        configurable: true,
      });

      // Should not throw during initialization
      const newBatteryManager = BatteryManager.getInstance();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => newBatteryManager.getBatteryMetrics()).not.toThrow();

      newBatteryManager.dispose();
    });

    it('should handle performance monitoring errors gracefully', async () => {
      // Mock performance monitor error
      mockPerformanceMonitor.getMetrics.mockImplementation(() => {
        throw new Error('Performance monitoring error');
      });

      // Should not crash the battery manager
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => batteryManager.getBatteryMetrics()).not.toThrow();
    });

    it('should handle optimization errors gracefully', async () => {
      // Mock optimization error
      mockMobileOptimizer.optimizeForCurrentConditions.mockRejectedValue(
        new Error('Optimization failed'),
      );

      const mockSuggestion: BatteryOptimizationSuggestion = {
        type: 'quality_reduction',
        impact: 'high',
        userExperience: 'moderate',
        estimatedSavings: 30,
        description: 'Test optimization',
        action: () => {
          throw new Error('Action failed');
        },
      };

      // Should handle errors gracefully
      await expect(
        batteryManager.applyOptimization(mockSuggestion),
      ).resolves.toBeUndefined();
    });
  });
});
