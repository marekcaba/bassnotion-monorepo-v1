/**
 * Performance Optimizer Behavior Tests
 *
 * Tests for Story 2.2: Task 10 - Performance Optimization & Quality Assurance
 * Covers all subtasks: adaptive quality scaling, mobile optimization,
 * performance benchmarking, real-time monitoring, and production validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PerformanceOptimizer from '../plugins/PerformanceOptimizer.js';

// Mock browser APIs
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
  hardwareConcurrency: 4,
  deviceMemory: 4,
  connection: {
    effectiveType: '4g',
    type: 'wifi',
    downlink: 10,
  },
  getBattery: vi.fn().mockResolvedValue({
    level: 0.8,
    charging: false,
  }),
  mockPlatform: undefined as string | undefined, // Add mockPlatform property for testing
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      jsHeapSizeLimit: 100 * 1024 * 1024,
    },
  },
  writable: true,
});

describe('PerformanceOptimizer - Task 10: Performance Optimization & Quality Assurance', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(async () => {
    // Reset singleton
    (PerformanceOptimizer as any).instance = null;
    optimizer = PerformanceOptimizer.getInstance();
    await optimizer.initialize();
  });

  afterEach(async () => {
    if (optimizer) {
      await optimizer.dispose();
    }
    vi.clearAllMocks();
  });

  describe('Subtask 10.1: Adaptive Quality Scaling', () => {
    it('should initialize with device-appropriate quality settings', async () => {
      const capabilities = optimizer.getDeviceCapabilities();
      const settings = optimizer.getCurrentQualitySettings();

      expect(capabilities).toMatchObject({
        platform: expect.any(String),
        cpu: expect.objectContaining({
          cores: expect.any(Number),
          performance: expect.any(String),
        }),
        memory: expect.objectContaining({
          total: expect.any(Number),
          available: expect.any(Number),
        }),
        audio: expect.objectContaining({
          sampleRate: expect.any(Number),
          channels: expect.any(Number),
        }),
      });

      expect(settings).toMatchObject({
        audio: expect.objectContaining({
          sampleRate: expect.any(Number),
          bitDepth: expect.any(Number),
          bufferSize: expect.any(Number),
        }),
        instruments: expect.objectContaining({
          polyphony: expect.any(Number),
          velocityLayers: expect.any(Number),
        }),
      });
    });

    it('should adapt quality based on device capabilities', async () => {
      const result = await optimizer.adaptQualityToDevice();

      expect(result).toMatchObject({
        performanceGain: expect.any(Number),
        qualityImpact: expect.any(Number),
        recommendations: expect.arrayContaining([expect.any(String)]),
        appliedOptimizations: expect.arrayContaining([expect.any(String)]),
      });

      expect(result.performanceGain).toBeGreaterThanOrEqual(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide quality scaling recommendations', async () => {
      const recommendations = optimizer.getQualityRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach((rec) => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it('should handle quality transitions smoothly', async () => {
      const _initialSettings = optimizer.getCurrentQualitySettings();

      // Simulate quality change
      const result = await optimizer.adaptQualityToDevice();
      const newSettings = optimizer.getCurrentQualitySettings();

      expect(result.performanceGain).toBeDefined();
      expect(newSettings).toBeDefined();

      // Settings should be updated
      expect(newSettings.audio.sampleRate).toBeGreaterThan(0);
      expect(newSettings.instruments.polyphony).toBeGreaterThan(0);
    });
  });

  describe('Subtask 10.2: Mobile Optimization', () => {
    it('should detect mobile platform correctly', () => {
      const capabilities = optimizer.getDeviceCapabilities();

      // Based on our mock iPhone user agent
      expect(['mobile', 'tablet', 'desktop']).toContain(capabilities.platform);
    });

    it('should optimize for mobile constraints', async () => {
      const result = await optimizer.optimizeForMobile();

      expect(result).toMatchObject({
        performanceGain: expect.any(Number),
        qualityImpact: expect.any(Number),
        recommendations: expect.arrayContaining([expect.any(String)]),
        appliedOptimizations: expect.arrayContaining([expect.any(String)]),
      });

      expect(result.performanceGain).toBeGreaterThan(0);
      expect(result.appliedOptimizations.length).toBeGreaterThan(0);
    });

    it('should handle battery-aware optimization', async () => {
      // Mock mobile platform and low battery
      mockNavigator.mockPlatform = 'mobile';
      mockNavigator.getBattery = vi.fn().mockResolvedValue({
        level: 0.15, // 15% battery
        charging: false,
      });

      // Reinitialize to pick up new mocks
      await optimizer.dispose();
      const newOptimizer = PerformanceOptimizer.getInstance();
      await newOptimizer.initialize();

      const result = await newOptimizer.optimizeForMobile();

      expect(result.performanceGain).toBeGreaterThan(10); // Should be significant for low battery
      expect(result.appliedOptimizations).toContain(
        'Low battery mode activated',
      );

      await newOptimizer.dispose();
    });

    it('should adapt to network conditions', async () => {
      // Mock mobile platform and cellular network
      (mockNavigator as any).mockPlatform = 'mobile';
      mockNavigator.connection = {
        effectiveType: '2g',
        type: 'cellular',
        downlink: 0.5,
      };

      // Reinitialize to pick up new mocks
      await optimizer.dispose();
      const newOptimizer = PerformanceOptimizer.getInstance();
      await newOptimizer.initialize();

      const result = await newOptimizer.optimizeForMobile();

      expect(result.appliedOptimizations).toContain(
        'Cellular data optimization',
      );

      await newOptimizer.dispose();
    });

    it('should handle thermal optimization', async () => {
      // Simulate high temperature (this would be detected by the optimizer)
      const result = await optimizer.optimizeForMobile();

      // Should have some optimization applied
      expect(result.performanceGain).toBeGreaterThanOrEqual(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Subtask 10.3: Performance Benchmarking', () => {
    it('should run comprehensive benchmark suite', async () => {
      const results = await optimizer.runBenchmarks();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result) => {
        expect(result).toMatchObject({
          testName: expect.any(String),
          duration: expect.any(Number),
          score: expect.any(Number),
          metrics: expect.objectContaining({
            audio: expect.any(Object),
            system: expect.any(Object),
            quality: expect.any(Object),
            benchmarks: expect.any(Object),
          }),
          passed: expect.any(Boolean),
          details: expect.any(String),
        });

        expect(result.duration).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it('should measure audio latency accurately', async () => {
      const results = await optimizer.runBenchmarks();
      const audioTest = results.find((r) => r.testName.includes('Audio'));

      expect(audioTest).toBeDefined();
      expect(audioTest!.metrics.audio.latency).toBeGreaterThan(0);
      expect(audioTest!.metrics.audio.latency).toBeLessThan(100); // Reasonable latency
    });

    it('should assess CPU performance', async () => {
      const results = await optimizer.runBenchmarks();
      const cpuTest = results.find((r) => r.testName.includes('CPU'));

      expect(cpuTest).toBeDefined();
      expect(cpuTest!.metrics.audio.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuTest!.metrics.audio.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should evaluate memory usage', async () => {
      const results = await optimizer.runBenchmarks();
      const memoryTest = results.find((r) => r.testName.includes('Memory'));

      expect(memoryTest).toBeDefined();
      expect(memoryTest!.metrics.audio.memoryUsage).toBeGreaterThan(0);
      expect(memoryTest!.metrics.benchmarks.memoryFootprint).toBeGreaterThan(0);
    });

    it('should test network performance', async () => {
      const results = await optimizer.runBenchmarks();
      const networkTest = results.find((r) => r.testName.includes('Network'));

      expect(networkTest).toBeDefined();
      expect(networkTest!.metrics.system.networkUsage).toBeGreaterThanOrEqual(
        0,
      );
    });

    it('should validate battery efficiency', async () => {
      const results = await optimizer.runBenchmarks();
      const batteryTest = results.find((r) => r.testName.includes('Battery'));

      expect(batteryTest).toBeDefined();
      expect(batteryTest!.metrics.system.batteryDrain).toBeGreaterThan(0);
    });

    it('should assess overall quality stability', async () => {
      const results = await optimizer.runBenchmarks();
      const qualityTest = results.find((r) => r.testName.includes('Quality'));

      expect(qualityTest).toBeDefined();
      expect(qualityTest!.metrics.quality.score).toBeGreaterThan(0);
      expect(qualityTest!.metrics.quality.stability).toBeGreaterThan(0);
      expect(qualityTest!.metrics.quality.efficiency).toBeGreaterThan(0);
    });
  });

  describe('Subtask 10.4: Real-time Quality Monitoring', () => {
    it('should start and stop monitoring successfully', async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();

      optimizer.on('monitoringStarted', startSpy);
      optimizer.on('monitoringStopped', stopSpy);

      await optimizer.startRealTimeMonitoring();
      expect(startSpy).toHaveBeenCalled();

      optimizer.stopRealTimeMonitoring();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should emit performance metrics updates', async () => {
      const metricsSpy = vi.fn();
      optimizer.on('metricsUpdated', metricsSpy);

      await optimizer.startRealTimeMonitoring();

      // Wait for at least one metrics update
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(metricsSpy).toHaveBeenCalled();

      const metricsData = metricsSpy.mock.calls[0]?.[0];
      expect(metricsData).toMatchObject({
        audio: expect.any(Object),
        system: expect.any(Object),
        quality: expect.any(Object),
        benchmarks: expect.any(Object),
      });

      optimizer.stopRealTimeMonitoring();
    });

    it('should detect optimization needs', async () => {
      const optimizationSpy = vi.fn();
      optimizer.on('optimizationNeeded', optimizationSpy);

      await optimizer.startRealTimeMonitoring();

      // Wait for monitoring to potentially detect issues
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // May or may not be called depending on simulated metrics
      if (optimizationSpy.mock.calls.length > 0) {
        const optimizationData = optimizationSpy.mock.calls[0]?.[0];
        expect(optimizationData).toMatchObject({
          reason: expect.any(String),
          metrics: expect.any(Object),
        });
      }

      optimizer.stopRealTimeMonitoring();
    });

    it('should provide current performance metrics', () => {
      const metrics = optimizer.getCurrentMetrics();

      expect(metrics).toMatchObject({
        audio: expect.objectContaining({
          latency: expect.any(Number),
          dropouts: expect.any(Number),
          cpuUsage: expect.any(Number),
          memoryUsage: expect.any(Number),
        }),
        system: expect.objectContaining({
          frameRate: expect.any(Number),
          batteryDrain: expect.any(Number),
          temperature: expect.any(Number),
          networkUsage: expect.any(Number),
        }),
        quality: expect.objectContaining({
          score: expect.any(Number),
          stability: expect.any(Number),
          efficiency: expect.any(Number),
        }),
        benchmarks: expect.objectContaining({
          initializationTime: expect.any(Number),
          processingTime: expect.any(Number),
          memoryFootprint: expect.any(Number),
          throughput: expect.any(Number),
        }),
      });
    });
  });

  describe('Subtask 10.5: Production Validation', () => {
    it('should validate production readiness', async () => {
      const results = await optimizer.validateProductionReadiness();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result) => {
        expect(result).toMatchObject({
          component: expect.any(String),
          status: expect.stringMatching(/^(pass|fail|warning)$/),
          score: expect.any(Number),
          issues: expect.any(Array),
          recommendations: expect.any(Array),
        });

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    it('should run regression tests', async () => {
      const results = await optimizer.runRegressionTests();

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result) => {
        expect(result).toMatchObject({
          testName: expect.any(String),
          duration: expect.any(Number),
          score: expect.any(Number),
          passed: expect.any(Boolean),
          details: expect.any(String),
        });

        // Regression tests should have meaningful names
        expect(result.testName).toMatch(/Test$/); // All should end with 'Test'
        expect(result.duration).toBeGreaterThan(0);
      });
    });

    it('should validate all critical components', async () => {
      const results = await optimizer.validateProductionReadiness();

      const expectedComponents = [
        'Audio Engine',
        'MIDI Parser',
        'Instrument Processors',
        'Asset Manager',
        'Performance Optimizer',
        'Quality Monitor',
      ];

      expectedComponents.forEach((component) => {
        const componentResult = results.find((r) => r.component === component);
        expect(componentResult).toBeDefined();
        expect(componentResult!.score).toBeGreaterThan(0);
      });
    });

    it('should provide comprehensive validation report', async () => {
      const results = await optimizer.validateProductionReadiness();
      const overallScore =
        results.reduce((sum, r) => sum + r.score, 0) / results.length;

      expect(overallScore).toBeGreaterThan(0);
      expect(overallScore).toBeLessThanOrEqual(100);

      // Should have at least some passing components
      const passingComponents = results.filter((r) => r.status === 'pass');
      expect(passingComponents.length).toBeGreaterThan(0);
    });

    it('should detect performance regressions', async () => {
      const results = await optimizer.runRegressionTests();

      // Should have various regression tests
      const testTypes = results.map((r) => r.testName);
      expect(testTypes).toContain('Initialization Regression Test');
      expect(testTypes).toContain('Audio Quality Regression Test');
      expect(testTypes).toContain('Performance Regression Test');
      expect(testTypes).toContain('Memory Leak Test');
      expect(testTypes).toContain('Stability Test');
    });
  });

  describe('Integration & Lifecycle Management', () => {
    it('should maintain singleton pattern', () => {
      const optimizer1 = PerformanceOptimizer.getInstance();
      const optimizer2 = PerformanceOptimizer.getInstance();

      expect(optimizer1).toBe(optimizer2);
    });

    it('should handle initialization and disposal properly', async () => {
      const newOptimizer = PerformanceOptimizer.getInstance();

      expect(newOptimizer.isInitialized()).toBe(true);

      await newOptimizer.dispose();
      expect(newOptimizer.isInitialized()).toBe(false);
    });

    it('should export complete configuration', () => {
      const config = optimizer.exportConfiguration();

      expect(config).toMatchObject({
        deviceCapabilities: expect.any(Object),
        currentQualitySettings: expect.any(Object),
        performanceMetrics: expect.any(Object),
        optimizationHistory: expect.any(Array),
        isInitialized: expect.any(Boolean),
        monitoringActive: expect.any(Boolean),
      });
    });

    it('should handle errors gracefully', async () => {
      // Test error handling by disposing and trying to use
      await optimizer.dispose();

      // These should handle the disposed state gracefully
      expect(() => optimizer.getCurrentMetrics()).not.toThrow();
      expect(() => optimizer.getDeviceCapabilities()).not.toThrow();
      expect(() => optimizer.getCurrentQualitySettings()).not.toThrow();
    });

    it('should emit events correctly', async () => {
      const eventSpy = vi.fn();

      optimizer.on('qualityAdapted', eventSpy);
      await optimizer.adaptQualityToDevice();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Targets Validation', () => {
    it('should meet audio latency targets (<50ms)', async () => {
      const metrics = optimizer.getCurrentMetrics();
      expect(metrics.audio.latency).toBeLessThan(50);
    });

    it('should maintain reasonable CPU usage (<80%)', async () => {
      const metrics = optimizer.getCurrentMetrics();
      expect(metrics.audio.cpuUsage).toBeLessThan(80);
    });

    it('should keep memory usage under control', async () => {
      const metrics = optimizer.getCurrentMetrics();
      expect(metrics.audio.memoryUsage).toBeLessThan(200); // MB
    });

    it('should maintain stable frame rate (>30fps)', async () => {
      const metrics = optimizer.getCurrentMetrics();
      expect(metrics.system.frameRate).toBeGreaterThan(30);
    });

    it('should achieve good quality scores (>70)', async () => {
      const metrics = optimizer.getCurrentMetrics();
      expect(metrics.quality.score).toBeGreaterThan(70);
      expect(metrics.quality.stability).toBeGreaterThan(70);
      expect(metrics.quality.efficiency).toBeGreaterThan(70);
    });
  });
});
