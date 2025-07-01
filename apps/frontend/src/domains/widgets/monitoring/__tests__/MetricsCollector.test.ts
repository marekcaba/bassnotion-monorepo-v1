/**
 * MetricsCollector Test Suite - Comprehensive Testing
 * Tests the central performance metrics collection system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsCollector } from '../MetricsCollector';
import type { MetricsAlert } from '../MetricsCollector';

// Mock all the dependencies at the module level
vi.mock('../../utils/performance/PerformanceBaseline', () => ({
  PerformanceBaseline: vi.fn().mockImplementation(() => ({
    startBaseline: vi.fn().mockResolvedValue({
      rendering: {
        fps: 58,
        frameTime: 17.2,
        droppedFrames: 2,
        threejsObjects: 120,
      },
      memory: { heapUsed: 48 },
      audio: { latency: 25, dropouts: 0 },
    }),
  })),
}));

vi.mock('../../utils/memory/MemoryManager', () => ({
  MemoryManager: {
    getInstance: vi.fn().mockReturnValue({
      getCurrentMemoryUsage: vi.fn().mockReturnValue({
        heapUsed: 50,
        heapTotal: 60,
        heapLimit: 2048,
        external: 5,
        arrayBuffers: 2,
        timestamp: Date.now(),
      }),
      checkForMemoryLeaks: vi.fn().mockReturnValue([]),
      triggerCleanup: vi.fn(),
      components: new Map([
        ['test1', {}],
        ['test2', {}],
      ]),
    }),
  },
}));

vi.mock('../../optimization/AudioBufferManager', () => ({
  AudioBufferManager: {
    getInstance: vi.fn().mockReturnValue({
      getCurrentMetrics: vi.fn().mockReturnValue({
        latency: 25,
        bufferUnderruns: 0,
        dropouts: 0,
        cpuUsage: 15,
        memoryUsage: 10,
        timestamp: Date.now(),
      }),
      audioAssets: new Map([
        ['asset1', {}],
        ['asset2', {}],
      ]),
    }),
  },
}));

vi.mock('../../optimization/LatencyOptimizer', () => ({
  LatencyOptimizer: {
    getInstance: vi.fn().mockReturnValue({
      getLatencyStatistics: vi.fn().mockReturnValue({
        current: 25,
        average: 27,
        minimum: 20,
        maximum: 35,
        trend: 'stable',
      }),
      optimizeLatencyAutomatically: vi.fn().mockResolvedValue({
        success: true,
        previousLatency: 30,
        newLatency: 25,
        improvement: 16.7,
      }),
    }),
  },
}));

vi.mock('../../optimization/BundleOptimizer', () => ({
  BundleOptimizer: {
    getInstance: vi.fn().mockReturnValue({
      getCurrentMetrics: vi.fn().mockReturnValue({
        totalSize: 2.5 * 1024 * 1024,
        loadedChunks: 3,
        cacheHitRate: 85,
        failedChunks: 0,
      }),
      optimizeBundleLoading: vi.fn(),
    }),
  },
}));

vi.mock(
  '../../../shared/components/music/FretboardVisualizer/optimization/RenderOptimizer',
  () => ({
    RenderOptimizer: vi.fn().mockImplementation(() => ({
      getCurrentMetrics: vi.fn().mockReturnValue({
        fps: 58,
        frameTime: 17.2,
        droppedFrames: 2,
        objectCount: 120,
        activeMeshes: 45,
        drawCalls: 12,
      }),
      optimizeAutomatically: vi.fn().mockResolvedValue({
        success: true,
        optimizationsApplied: ['LOD', 'Culling'],
        performanceGain: 15.2,
      }),
    })),
  }),
);

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton for clean test state
    (MetricsCollector as any).instance = null;
    metricsCollector = MetricsCollector.getInstance();
  });

  afterEach(() => {
    if (metricsCollector) {
      metricsCollector.destroy();
    }
    // Reset singleton instance for next test
    (MetricsCollector as any).instance = null;
    vi.clearAllTimers();
  });

  describe('Basic Functionality', () => {
    it('should create singleton instance', () => {
      const instance1 = MetricsCollector.getInstance();
      const instance2 = MetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default configuration', () => {
      expect(metricsCollector).toBeDefined();
      expect(metricsCollector['config']).toBeDefined();
      expect(metricsCollector['config'].collectionInterval).toBe(5000);
      expect(metricsCollector['config'].maxHistorySize).toBe(200);
    });

    it('should update configuration correctly', () => {
      const newConfig = {
        collectionInterval: 10000,
        maxHistorySize: 100,
        enableAlerting: false,
      };

      metricsCollector.updateConfig(newConfig);

      expect(metricsCollector['config'].collectionInterval).toBe(10000);
      expect(metricsCollector['config'].maxHistorySize).toBe(100);
      expect(metricsCollector['config'].enableAlerting).toBe(false);
    });

    it('should manage collection state', () => {
      vi.useFakeTimers();

      expect(metricsCollector['isCollecting']).toBe(false);

      metricsCollector.startCollection();
      expect(metricsCollector['isCollecting']).toBe(true);
      expect(metricsCollector['collectionTimer']).toBeDefined();

      metricsCollector.stopCollection();
      expect(metricsCollector['isCollecting']).toBe(false);
      expect(metricsCollector['collectionTimer']).toBeNull();

      vi.useRealTimers();
    });

    it('should clean up resources on destroy', () => {
      metricsCollector.startCollection();
      metricsCollector.destroy();

      expect(metricsCollector['isCollecting']).toBe(false);
      expect(metricsCollector['collectionTimer']).toBeNull();
      expect(metricsCollector['metricsHistory']).toHaveLength(0);
      expect(metricsCollector['alerts']).toHaveLength(0);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive performance metrics', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeCloseTo(Date.now(), -2);
      expect(metrics.overall).toBeDefined();
      expect(metrics.overall.performanceScore).toBeGreaterThan(0);
      expect(metrics.overall.status).toBeDefined();
    });

    it('should collect rendering metrics', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.rendering).toBeDefined();
      expect(metrics.rendering.fps).toBe(58);
      expect(metrics.rendering.frameTime).toBe(17);
      expect(metrics.rendering.droppedFrames).toBe(2); // Accept baseline mock value
      expect(metrics.rendering.objectCount).toBe(120); // Accept baseline mock value
    });

    it('should collect memory metrics', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.heapUsed).toBe(50);
      expect(metrics.memory.heapTotal).toBe(60);
      expect(metrics.memory.components).toBe(2);
      expect(metrics.memory.leaksDetected).toBe(0);
      expect(metrics.memory.cleanupTriggered).toBe(false);
    });

    it('should collect audio metrics', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.audio).toBeDefined();
      expect(metrics.audio.latency).toBe(25);
      expect(metrics.audio.bufferUnderruns).toBe(0);
      expect(metrics.audio.activeAssets).toBe(2);
      expect(metrics.audio.cpuUsage).toBe(15);
      expect(metrics.audio.memoryUsage).toBe(10);
    });

    it('should collect bundle metrics', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.bundle).toBeDefined();
      expect(metrics.bundle.totalSize).toBeGreaterThan(0);
      expect(metrics.bundle.loadedChunks).toBe(3);
      expect(metrics.bundle.cacheHitRate).toBe(85);
      expect(metrics.bundle.failedChunks).toBe(0);
    });

    it('should store metrics in history', async () => {
      await metricsCollector.collectMetrics();
      await metricsCollector.collectMetrics();

      const history = metricsCollector.getMetricsHistory();
      expect(history).toHaveLength(2);
    });

    it('should limit history size according to configuration', async () => {
      metricsCollector.updateConfig({ maxHistorySize: 2 });

      await metricsCollector.collectMetrics();
      await metricsCollector.collectMetrics();
      await metricsCollector.collectMetrics();

      const history = metricsCollector.getMetricsHistory();
      expect(history).toHaveLength(2);
    });

    it('should get current metrics', () => {
      // Should return null initially
      const currentMetrics = metricsCollector.getCurrentMetrics();
      expect(currentMetrics).toBeNull();
    });
  });

  describe('Performance Scoring', () => {
    it('should calculate performance score correctly', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.overall.performanceScore).toBeGreaterThan(0);
      expect(metrics.overall.performanceScore).toBeLessThanOrEqual(100);
    });

    it('should determine performance status', async () => {
      const metrics = await metricsCollector.collectMetrics();

      // With mocked good values, should be good status
      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(
        metrics.overall.status,
      );
    });

    it('should weight different metrics appropriately', async () => {
      const metrics = await metricsCollector.collectMetrics();

      // Score should reflect all metric categories
      expect(metrics.overall.performanceScore).toBeGreaterThan(50); // Should be decent with our mocked values
    });
  });

  describe('Alerting System', () => {
    beforeEach(() => {
      metricsCollector.updateConfig({ enableAlerting: true });
    });

    it('should generate alerts for poor performance', async () => {
      // Mock poor performance - modify the memory manager to return high memory usage
      const memoryManager = metricsCollector['memoryManager'];
      vi.mocked(memoryManager.getCurrentMemoryUsage).mockReturnValue({
        heapUsed: 250 * 1024 * 1024, // 250MB - above critical threshold
        heapTotal: 300 * 1024 * 1024,
        heapLimit: 2048 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        timestamp: Date.now(),
      });

      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.overall.alerts.length).toBeGreaterThan(0);
    });

    it('should categorize alert severity correctly', async () => {
      // Mock critical memory usage
      const memoryManager = metricsCollector['memoryManager'];
      vi.mocked(memoryManager.getCurrentMemoryUsage).mockReturnValue({
        heapUsed: 250 * 1024 * 1024, // 250MB - critical
        heapTotal: 300 * 1024 * 1024,
        heapLimit: 2048 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        timestamp: Date.now(),
      });

      const metrics = await metricsCollector.collectMetrics();

      const criticalAlerts = metrics.overall.alerts.filter(
        (alert: MetricsAlert) => alert.severity === 'critical',
      );
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it('should track alert history', async () => {
      await metricsCollector.collectMetrics();

      const alertHistory = metricsCollector.getRecentAlerts();
      expect(Array.isArray(alertHistory)).toBe(true);
    });

    it('should get recent alerts within time window', () => {
      const recentAlerts = metricsCollector.getRecentAlerts(300000); // 5 minutes
      expect(Array.isArray(recentAlerts)).toBe(true);
    });
  });

  describe('Optimization Triggers', () => {
    it('should trigger optimizations when needed', () => {
      // First collect some metrics to have current state
      return metricsCollector.collectMetrics().then(() => {
        // Mock high memory usage to trigger optimization
        const memoryManager = metricsCollector['memoryManager'];
        vi.mocked(memoryManager.getCurrentMemoryUsage).mockReturnValue({
          heapUsed: 200 * 1024 * 1024, // 200MB - above threshold
          heapTotal: 250 * 1024 * 1024,
          heapLimit: 2048 * 1024 * 1024,
          external: 5 * 1024 * 1024,
          arrayBuffers: 2 * 1024 * 1024,
          timestamp: Date.now(),
        });

        return metricsCollector.collectMetrics().then(() => {
          // Should be able to call triggerOptimizations without error
          expect(() => metricsCollector.triggerOptimizations()).not.toThrow();
        });
      });
    });

    it('should handle optimization triggers safely', () => {
      // Should handle case when no metrics exist yet
      expect(() => metricsCollector.triggerOptimizations()).not.toThrow();
    });

    it('should integrate with memory manager', async () => {
      // Collect metrics first
      await metricsCollector.collectMetrics();

      // Mock high memory to trigger cleanup
      const memoryManager = metricsCollector['memoryManager'];
      vi.mocked(memoryManager.getCurrentMemoryUsage).mockReturnValue({
        heapUsed: 200 * 1024 * 1024, // 200MB
        heapTotal: 250 * 1024 * 1024,
        heapLimit: 2048 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
        timestamp: Date.now(),
      });

      await metricsCollector.collectMetrics();

      const triggerCleanupSpy = vi.spyOn(memoryManager, 'triggerCleanup');
      metricsCollector.triggerOptimizations();

      expect(triggerCleanupSpy).toHaveBeenCalled();
    });

    it('should integrate with audio optimizer', async () => {
      // Mock high latency to trigger audio optimization
      const audioManager = metricsCollector['audioBufferManager'];
      const latencyOptimizer = metricsCollector['latencyOptimizer'];

      vi.mocked(audioManager.getCurrentMetrics).mockReturnValue({
        latency: 50, // Above 30ms threshold
        bufferUnderruns: 0,
        dropouts: 0,
        cpuUsage: 15,
        memoryUsage: 10,
        timestamp: Date.now(),
      });

      vi.mocked(latencyOptimizer.getLatencyStatistics).mockReturnValue({
        current: 50, // High latency to trigger optimization
        average: 48,
        minimum: 45,
        maximum: 55,
        trend: 'degrading',
      });

      // Collect metrics with high latency
      await metricsCollector.collectMetrics();

      const optimizeSpy = vi.spyOn(
        latencyOptimizer,
        'optimizeLatencyAutomatically',
      );

      // Trigger optimizations
      metricsCollector.triggerOptimizations();

      expect(optimizeSpy).toHaveBeenCalled();
    });
  });

  describe('Advanced Configuration', () => {
    it('should handle custom alert thresholds', () => {
      const customThresholds = {
        alertThresholds: {
          fps: { warning: 45, critical: 25 },
          memory: { warning: 100, critical: 150 },
          latency: { warning: 40, critical: 80 },
          bundleSize: { warning: 3, critical: 5 },
        },
      };

      metricsCollector.updateConfig(customThresholds);

      expect(metricsCollector['config'].alertThresholds.fps.warning).toBe(45);
      expect(metricsCollector['config'].alertThresholds.fps.critical).toBe(25);
    });

    it('should validate configuration values', () => {
      const invalidConfig = {
        collectionInterval: -1000, // Invalid
        maxHistorySize: 0, // Invalid
      };

      // Should handle invalid config gracefully
      expect(() => metricsCollector.updateConfig(invalidConfig)).not.toThrow();
    });

    it('should support disabling specific features', () => {
      metricsCollector.updateConfig({
        enableAlerting: false,
        enableReporting: false,
      });

      expect(metricsCollector['config'].enableAlerting).toBe(false);
      expect(metricsCollector['config'].enableReporting).toBe(false);
    });
  });

  describe('Integration and System Health', () => {
    it('should handle missing dependencies gracefully', async () => {
      // Mock a dependency failure
      vi.mocked(
        metricsCollector['memoryManager'].getCurrentMemoryUsage,
      ).mockImplementation(() => {
        throw new Error('Memory system unavailable');
      });

      // Should not crash, should handle gracefully
      const metrics = await metricsCollector.collectMetrics();
      expect(metrics).toBeDefined();
    });

    it('should provide system health status', async () => {
      const metrics = await metricsCollector.collectMetrics();

      expect(metrics.overall.status).toMatch(
        /^(excellent|good|fair|poor|critical)$/,
      );
    });

    it('should handle concurrent metric collection', async () => {
      const promises = [
        metricsCollector.collectMetrics(),
        metricsCollector.collectMetrics(),
        metricsCollector.collectMetrics(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.timestamp).toBeDefined();
      });
    });
  });
});
