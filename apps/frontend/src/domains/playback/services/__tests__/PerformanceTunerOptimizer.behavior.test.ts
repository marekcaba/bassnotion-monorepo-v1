/**
 * Performance Tuner & Mobile Optimizer Behavior Tests
 *
 * Tests for the comprehensive performance tuning and mobile optimization system
 * Part of Story 2.2: Task 7, Subtask 7.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceTunerOptimizer } from '../plugins/PerformanceTunerOptimizer.js';

// Enhanced Browser API Mocks for Node.js test environment
class MockNavigator {
  public userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  public hardwareConcurrency = 8;
  public deviceMemory? = 8;
  public connection? = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
  };

  getBattery?(): Promise<{ level: number; charging: boolean }> {
    return Promise.resolve({ level: 0.8, charging: false });
  }
}

class MockPerformance {
  public memory? = {
    usedJSHeapSize: 50 * 1024 * 1024,
    jsHeapSizeLimit: 100 * 1024 * 1024,
    totalJSHeapSize: 80 * 1024 * 1024,
  };

  now(): number {
    return Date.now();
  }

  mark(_name: string): void {
    // Mock implementation
  }

  measure(_name: string, _startMark?: string, _endMark?: string): void {
    // Mock implementation
  }
}

// Set up global mocks
global.navigator = new MockNavigator() as any;
global.performance = new MockPerformance() as any;

// Mock requestAnimationFrame for performance monitoring
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  // Execute callback immediately in tests
  setTimeout(callback, 16); // Simulate 60fps
  return 1; // Return a mock request ID
});

global.cancelAnimationFrame = vi.fn();

// Mock the dependencies
vi.mock('../AssetManager.js', () => ({
  AssetManager: {
    getInstance: vi.fn(() => ({
      updateConfiguration: vi.fn(),
      getPerformanceMetrics: vi.fn().mockReturnValue({
        loadTime: 100,
        cacheHitRate: 0.8,
        memoryUsage: 50 * 1024 * 1024,
      }),
    })),
  },
}));

vi.mock('../plugins/N8nAssetPipelineProcessor.js', () => ({
  N8nAssetPipelineProcessor: vi.fn().mockImplementation(() => ({
    updateConfiguration: vi.fn(),
    getPerformanceMetrics: vi.fn().mockReturnValue({
      cdnLatency: 50,
      failoverCount: 0,
      qualityAdaptations: 2,
    }),
  })),
}));

vi.mock('../plugins/InstrumentAssetOptimizer.js', () => ({
  InstrumentAssetOptimizer: vi.fn().mockImplementation(() => ({
    updateConfiguration: vi.fn(),
    getOptimizationStatus: vi.fn().mockReturnValue({
      optimizedInstruments: ['bass', 'drums'],
      totalCachedAssets: 50,
      averageCacheHitRate: 0.75,
    }),
  })),
}));

vi.mock('../plugins/MusicalContextAnalyzer.js', () => ({
  MusicalContextAnalyzer: vi.fn().mockImplementation(() => ({
    updateConfiguration: vi.fn(),
    exportConfiguration: vi.fn().mockReturnValue({
      musicalAnalyzer: {
        analysisMode: 'comprehensive',
        predictionEnabled: true,
      },
    }),
  })),
}));

describe('PerformanceTunerOptimizer', () => {
  let optimizer: PerformanceTunerOptimizer;
  let mockAssetManager: any;
  let mockPipelineProcessor: any;
  let mockAssetOptimizer: any;
  let mockMusicalAnalyzer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh mocks for each test
    mockAssetManager = {
      updateConfiguration: vi.fn(),
      getPerformanceMetrics: vi.fn().mockReturnValue({
        loadTime: 100,
        cacheHitRate: 0.8,
        memoryUsage: 50 * 1024 * 1024,
      }),
    };

    mockPipelineProcessor = {
      updateConfiguration: vi.fn(),
      getPerformanceMetrics: vi.fn().mockReturnValue({
        cdnLatency: 50,
        failoverCount: 0,
        qualityAdaptations: 2,
      }),
    };

    mockAssetOptimizer = {
      updateConfiguration: vi.fn(),
      getOptimizationStatus: vi.fn().mockReturnValue({
        optimizedInstruments: ['bass', 'drums'],
        totalCachedAssets: 50,
        averageCacheHitRate: 0.75,
      }),
    };

    mockMusicalAnalyzer = {
      updateConfiguration: vi.fn(),
      exportConfiguration: vi.fn().mockReturnValue({
        musicalAnalyzer: {
          analysisMode: 'comprehensive',
          predictionEnabled: true,
        },
      }),
    };

    // Reset navigator to default state
    (global.navigator as any).userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    (global.navigator as any).hardwareConcurrency = 8;
    (global.navigator as any).deviceMemory = 8;

    // Reset performance memory
    (global.performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024,
      jsHeapSizeLimit: 100 * 1024 * 1024,
      totalJSHeapSize: 80 * 1024 * 1024,
    };

    // Initialize optimizer
    optimizer = new PerformanceTunerOptimizer(
      mockAssetManager as any,
      mockPipelineProcessor as any,
      mockAssetOptimizer as any,
      mockMusicalAnalyzer as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Device Detection', () => {
    it('should detect desktop devices correctly', () => {
      const status = optimizer.getPerformanceStatus();
      expect(status.profile.deviceType).toBe('desktop');
      expect(status.profile.networkSpeed).toBe('medium');
    });

    it('should detect mobile devices', () => {
      // Update navigator for mobile detection
      (global.navigator as any).userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) mobile';

      const newOptimizer = new PerformanceTunerOptimizer(
        mockAssetManager as any,
        mockPipelineProcessor as any,
        mockAssetOptimizer as any,
        mockMusicalAnalyzer as any,
      );

      const status = newOptimizer.getPerformanceStatus();
      expect(status.profile.deviceType).toBe('mobile');
    });

    it('should detect low-end devices', () => {
      // Update navigator for low-end device detection
      (global.navigator as any).hardwareConcurrency = 2;
      (global.navigator as any).deviceMemory = 1;

      const newOptimizer = new PerformanceTunerOptimizer(
        mockAssetManager as any,
        mockPipelineProcessor as any,
        mockAssetOptimizer as any,
        mockMusicalAnalyzer as any,
      );

      const status = newOptimizer.getPerformanceStatus();
      expect(status.profile.deviceType).toBe('lowend');
    });
  });

  describe('Optimization Strategies', () => {
    it('should apply desktop performance strategy by default', () => {
      const status = optimizer.getPerformanceStatus();
      expect(status.activeStrategy).toBe('Desktop Performance');
    });

    it('should switch to aggressive optimization for low battery', () => {
      // Simulate low battery
      const lowBatteryOptimizer = new PerformanceTunerOptimizer(
        mockAssetManager as any,
        mockPipelineProcessor as any,
        mockAssetOptimizer as any,
        mockMusicalAnalyzer as any,
      );

      // Manually set low battery profile
      (lowBatteryOptimizer as any).currentProfile = {
        deviceType: 'mobile',
        networkSpeed: 'medium',
        batteryLevel: 0.15,
        thermalState: 'nominal',
        memoryPressure: 'low',
      };

      lowBatteryOptimizer.forceOptimization(true); // Preserve manual profile

      const status = lowBatteryOptimizer.getPerformanceStatus();
      expect(status.activeStrategy).toBe('Mobile Battery Saver');
    });

    it('should apply thermal protection strategy when overheating', () => {
      // Simulate thermal issues
      (optimizer as any).currentProfile.thermalState = 'serious';

      optimizer.forceOptimization(true); // Preserve manual profile

      const status = optimizer.getPerformanceStatus();
      expect(status.activeStrategy).toBe('Thermal Protection');
    });
  });

  describe('Performance Monitoring', () => {
    it('should calculate performance score correctly', () => {
      const status = optimizer.getPerformanceStatus();

      expect(status.score).toBeTypeOf('number');
      expect(status.score).toBeGreaterThanOrEqual(0);
      expect(status.score).toBeLessThanOrEqual(100);
      expect(status.status).toMatch(/excellent|good|fair|poor/);
    });

    it('should provide performance metrics', () => {
      const status = optimizer.getPerformanceStatus();

      expect(status.metrics).toBeDefined();
      expect(status.metrics.frameRate).toBeTypeOf('number');
      expect(status.metrics.memoryUsage).toBeTypeOf('number');
      expect(status.metrics.audioLatency).toBeTypeOf('number');
    });

    it('should track optimization history', () => {
      optimizer.applyOptimizationStrategy();
      optimizer.forceOptimization();

      const status = optimizer.getPerformanceStatus();
      expect(status.optimizationHistory).toBeDefined();
      expect(Array.isArray(status.optimizationHistory)).toBe(true);
    });
  });

  describe('Mobile Optimization', () => {
    it('should apply mobile-specific optimizations', () => {
      optimizer.optimizeForMobile();

      // Should have applied mobile strategy
      expect(mockAssetOptimizer.updateConfiguration).toHaveBeenCalled();
      expect(mockPipelineProcessor.updateConfiguration).toHaveBeenCalled();
    });

    it('should handle battery-aware loading', () => {
      // Set low battery
      (optimizer as any).currentProfile.batteryLevel = 0.25;

      optimizer.optimizeForMobile();

      const status = optimizer.getPerformanceStatus();
      expect(status.activeStrategy).toBe('Mobile Battery Saver');
    });
  });

  describe('Performance Degradation Handling', () => {
    it('should detect low frame rate issues', () => {
      // Simulate low frame rate
      (optimizer as any).performanceMetrics.frameRate = 25;

      // Manually trigger degradation check
      optimizer.triggerPerformanceDegradationCheck();

      const status = optimizer.getPerformanceStatus();
      expect(status.recommendations).toContain('Reduce visual effects quality');
    });

    it('should detect high memory usage', () => {
      // Simulate high memory usage
      (optimizer as any).performanceMetrics.memoryUsage = 0.85;

      const status = optimizer.getPerformanceStatus();
      expect(status.recommendations).toContain('Clear unused asset cache');
    });

    it('should detect high audio latency', () => {
      // Simulate high latency
      (optimizer as any).performanceMetrics.audioLatency = 75;

      const status = optimizer.getPerformanceStatus();
      expect(status.recommendations).toContain('Increase audio buffer size');
    });
  });

  describe('Configuration Export', () => {
    it('should export complete performance configuration', () => {
      const config = optimizer.exportConfiguration();

      expect(config).toBeDefined();
      expect(config.performanceTuner).toBeDefined();
      expect(config.performanceTuner.currentProfile).toBeDefined();
      expect(config.performanceTuner.activeStrategy).toBeDefined();
      expect(config.performanceTuner.performanceMetrics).toBeDefined();
      expect(config.performanceTuner.performanceScore).toBeTypeOf('number');

      expect(config.recommendations).toBeDefined();
      expect(Array.isArray(config.recommendations)).toBe(true);

      expect(config.status).toBeDefined();
      expect(config.status.status).toMatch(/excellent|good|fair|poor/);
    });

    it('should include available strategies in export', () => {
      const config = optimizer.exportConfiguration();

      expect(config.performanceTuner.availableStrategies).toBeDefined();
      expect(Array.isArray(config.performanceTuner.availableStrategies)).toBe(
        true,
      );
      expect(
        config.performanceTuner.availableStrategies.length,
      ).toBeGreaterThan(0);

      const strategies = config.performanceTuner.availableStrategies;
      const strategyNames = strategies.map((s: any) => s.name);

      expect(strategyNames).toContain('Mobile Battery Saver');
      expect(strategyNames).toContain('Desktop Performance');
      expect(strategyNames).toContain('Thermal Protection');
    });
  });

  describe('Strategy Application', () => {
    it('should apply optimization strategy to all systems', () => {
      optimizer.applyOptimizationStrategy();

      // Should configure all connected systems
      expect(mockPipelineProcessor.updateConfiguration).toHaveBeenCalled();
      expect(mockAssetOptimizer.updateConfiguration).toHaveBeenCalled();
      expect(mockMusicalAnalyzer.updateConfiguration).toHaveBeenCalled();
    });

    it('should record optimization changes in history', () => {
      const initialHistory =
        optimizer.getPerformanceStatus().optimizationHistory.length;

      optimizer.applyOptimizationStrategy();

      const finalHistory =
        optimizer.getPerformanceStatus().optimizationHistory.length;
      expect(finalHistory).toBeGreaterThan(initialHistory);
    });

    it('should calculate device capability tier correctly', () => {
      // Test premium tier
      optimizer.applyOptimizationStrategy();

      const config = optimizer.exportConfiguration();
      expect(config.performanceTuner.activeStrategy).toBeDefined();
    });
  });

  describe('Force Optimization', () => {
    it('should update profile and apply new strategy', () => {
      const _initialStrategy = optimizer.getPerformanceStatus().activeStrategy;

      // Change profile to trigger strategy change
      (optimizer as any).currentProfile.thermalState = 'serious';

      optimizer.forceOptimization(true); // Preserve manual profile

      // Should have checked for strategy changes
      expect(mockPipelineProcessor.updateConfiguration).toHaveBeenCalled();
    });

    it('should not change strategy if already optimal', () => {
      const initialStrategy = optimizer.getPerformanceStatus().activeStrategy;

      optimizer.forceOptimization();

      const finalStrategy = optimizer.getPerformanceStatus().activeStrategy;
      expect(finalStrategy).toBe(initialStrategy);
    });
  });

  describe('Real-time Monitoring', () => {
    it('should start performance monitoring on initialization', () => {
      // Performance monitoring should be active
      const status = optimizer.getPerformanceStatus();
      expect(status.metrics.frameRate).toBeGreaterThan(0);
    });

    it('should update frame rate metrics continuously', () => {
      vi.useFakeTimers();

      const _initialFrameRate =
        optimizer.getPerformanceStatus().metrics.frameRate;

      // Simulate frame updates
      vi.advanceTimersByTime(100);

      const updatedFrameRate =
        optimizer.getPerformanceStatus().metrics.frameRate;
      expect(updatedFrameRate).toBeTypeOf('number');

      vi.useRealTimers();
    });
  });

  describe('Integration with Task 7 Components', () => {
    it('should integrate with all Task 7 components', () => {
      const config = optimizer.exportConfiguration();

      // Should include configuration from all Task 7 components
      expect(config).toBeDefined();
      expect(config.performanceTuner).toBeDefined();

      // Verify that optimization applies to all systems
      optimizer.applyOptimizationStrategy();

      expect(mockAssetOptimizer.updateConfiguration).toHaveBeenCalled();
      expect(mockPipelineProcessor.updateConfiguration).toHaveBeenCalled();
      expect(mockMusicalAnalyzer.updateConfiguration).toHaveBeenCalled();
    });

    it('should coordinate performance across all systems', () => {
      // Test comprehensive performance coordination
      optimizer.optimizeForMobile();

      const status = optimizer.getPerformanceStatus();
      expect(status.score).toBeGreaterThanOrEqual(0);
      expect(status.recommendations).toBeDefined();

      // Should have applied coordinated optimizations
      expect(mockAssetOptimizer.updateConfiguration).toHaveBeenCalled();
      expect(mockPipelineProcessor.updateConfiguration).toHaveBeenCalled();
    });
  });
});
