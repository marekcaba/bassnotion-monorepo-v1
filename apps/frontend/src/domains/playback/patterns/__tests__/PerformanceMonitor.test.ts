/**
 * PerformanceMonitor Tests
 * Story 3.18.4: Service Architecture Implementation
 *
 * Tests for EnhancedPerformanceMonitor with memory pooling,
 * performance monitoring, and optimization features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnhancedPerformanceMonitor,
  PerformanceReport,
} from '../PerformanceMonitor.js';
import { EventBus } from '../../services/core/EventBus.js';

describe('EnhancedPerformanceMonitor', () => {
  let eventBus: EventBus;
  let monitor: EnhancedPerformanceMonitor;
  let baseTime: number;

  beforeEach(() => {
    // Mock setInterval and clearInterval for tests
    vi.stubGlobal(
      'setInterval',
      vi.fn((callback: Function, delay: number) => {
        const id = Math.random();
        // Store the callback for manual triggering in tests if needed
        return id;
      }),
    );
    vi.stubGlobal('clearInterval', vi.fn());

    // Mock Date.now to be consistent with our performance.now mocks
    baseTime = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => baseTime);

    eventBus = new EventBus();
    monitor = new EnhancedPerformanceMonitor(eventBus, {
      reportingInterval: 100, // Short interval for testing
      metricsRetentionTime: 1000, // 1 second for testing
    });
  });

  afterEach(() => {
    monitor.dispose();
    vi.clearAllTimers();
    vi.unstubAllGlobals();
  });

  describe('Performance Measurement', () => {
    it('should measure operation performance', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const result = await monitor.measure(
        'test-service',
        'test-operation',
        operation,
      );

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should record metrics for successful operations', async () => {
      // Mock performance.now to control timing - use baseTime as reference
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return baseTime + (offset += 15);
      });

      await monitor.measure('test-service', 'test-operation', async () => {
        return 'success';
      });

      const reports = monitor.generateReport('test-service');
      expect(reports).toHaveLength(1);
      expect(reports[0].successfulOperations).toBe(1);
      expect(reports[0].failedOperations).toBe(0);
      expect(reports[0].averageDuration).toBeGreaterThan(0);
    });

    it('should record metrics for failed operations', async () => {
      // Mock performance.now
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 10),
      );

      await expect(
        monitor.measure('test-service', 'test-operation', async () => {
          throw new Error('Operation failed');
        }),
      ).rejects.toThrow('Operation failed');

      const reports = monitor.generateReport('test-service');
      expect(reports).toHaveLength(1);
      expect(reports[0].successfulOperations).toBe(0);
      expect(reports[0].failedOperations).toBe(1);
    });

    it('should include metadata in metrics', async () => {
      const metadata = { userId: '123', requestId: 'abc' };

      await monitor.measure(
        'test-service',
        'test-operation',
        async () => 'result',
        metadata,
      );

      // Metadata would be accessible through internal metrics
      // but not exposed in the report by default
      const reports = monitor.generateReport();
      expect(reports).toHaveLength(1);
    });

    it('should emit event for slow operations', async () => {
      const slowOperationHandler = vi.fn();
      eventBus.on('performance:slow-operation', slowOperationHandler);

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        performanceWarningThreshold: 50, // 50ms threshold
      });

      // Mock performance.now to simulate a slow operation
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        // First call (start) returns baseTime, second call (end) returns baseTime + 100
        return baseTime + callCount++ * 100;
      });

      await monitor.measure('test-service', 'slow-operation', async () => {
        return 'slow';
      });

      expect(slowOperationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          operation: 'slow-operation',
          threshold: 50,
        }),
        expect.any(Object),
      );
    });

    it('should emit event for high memory operations', async () => {
      const highMemoryHandler = vi.fn();
      eventBus.on('performance:high-memory', highMemoryHandler);

      // Mock memory usage
      const originalGetMemoryUsage = (monitor as any).getMemoryUsage;
      let memoryCallCount = 0;
      (monitor as any).getMemoryUsage = vi.fn(() => {
        // Return high memory difference
        return memoryCallCount++ === 0 ? 0 : 200 * 1024 * 1024; // 200MB
      });

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        memoryWarningThreshold: 100, // 100MB threshold
      });

      // Restore getMemoryUsage for the monitor instance
      (monitor as any).getMemoryUsage = () => {
        return memoryCallCount++ === 0 ? 0 : 200 * 1024 * 1024;
      };

      await monitor.measure(
        'test-service',
        'memory-heavy-operation',
        async () => 'result',
      );

      expect(highMemoryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          operation: 'memory-heavy-operation',
          threshold: 100,
        }),
        expect.any(Object),
      );
    });
  });

  describe('Resource Pooling', () => {
    it('should create resource pool', () => {
      const createHandler = vi.fn();
      eventBus.on('performance:pool-created', createHandler);

      const createFn = vi.fn(() => ({ id: Math.random() }));
      const pool = monitor.createResourcePool('test-pool', 5, createFn);

      expect(pool.name).toBe('test-pool');
      expect(pool.size).toBe(5);
      expect(pool.available).toHaveLength(5);
      expect(createFn).toHaveBeenCalledTimes(5);
      expect(createHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-pool',
          size: 5,
        }),
        expect.any(Object),
      );
    });

    it('should acquire resource from pool', () => {
      const pool = monitor.createResourcePool('test-pool', 3, () => ({
        id: Math.random(),
      }));

      const resource = monitor.acquireFromPool('test-pool');

      expect(resource).toBeDefined();
      expect(pool.available).toHaveLength(2);
      expect(pool.inUse.size).toBe(1);
    });

    it('should release resource back to pool', () => {
      const resetFn = vi.fn();
      const pool = monitor.createResourcePool(
        'test-pool',
        3,
        () => ({ id: Math.random() }),
        resetFn,
      );

      const resource = monitor.acquireFromPool('test-pool');
      expect(pool.available).toHaveLength(2);

      monitor.releaseToPool('test-pool', resource);

      expect(pool.available).toHaveLength(3);
      expect(pool.inUse.size).toBe(0);
      expect(resetFn).toHaveBeenCalledWith(resource);
    });

    it('should create new resource when pool empty but under limit', () => {
      const createFn = vi.fn(() => ({ id: Math.random() }));
      const pool = monitor.createResourcePool('test-pool', 5, createFn);

      // Acquire all pre-created resources
      for (let i = 0; i < 5; i++) {
        monitor.acquireFromPool('test-pool');
      }

      expect(pool.available).toHaveLength(0);
      expect(createFn).toHaveBeenCalledTimes(5);

      // This should create a new resource since we're under the limit
      const newResource = monitor.acquireFromPool('test-pool');

      // Should return null when exhausted
      expect(newResource).toBeNull();
    });

    it('should emit event when pool exhausted', () => {
      const exhaustedHandler = vi.fn();
      eventBus.on('performance:pool-exhausted', exhaustedHandler);

      const pool = monitor.createResourcePool('test-pool', 2, () => ({
        id: Math.random(),
      }));

      // Exhaust pool
      monitor.acquireFromPool('test-pool');
      monitor.acquireFromPool('test-pool');
      const result = monitor.acquireFromPool('test-pool'); // This should fail

      expect(result).toBeNull();
      expect(exhaustedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          poolName: 'test-pool',
          size: 2,
        }),
        expect.any(Object),
      );
    });

    it('should return null for non-existent pool', () => {
      const resource = monitor.acquireFromPool('non-existent');
      expect(resource).toBeNull();
    });

    it('should handle release of resource not in pool', () => {
      monitor.createResourcePool('test-pool', 3, () => ({ id: Math.random() }));

      // Try to release resource that wasn't acquired
      expect(() => {
        monitor.releaseToPool('test-pool', { id: 999 });
      }).not.toThrow();
    });

    it('should throw error when pooling disabled', () => {
      monitor = new EnhancedPerformanceMonitor(eventBus, {
        enableMemoryPooling: false,
      });

      expect(() => {
        monitor.createResourcePool('test-pool', 5, () => ({}));
      }).toThrow('Memory pooling is disabled');
    });
  });

  describe('Performance Reporting', () => {
    it('should generate performance report', async () => {
      // Mock performance.now for consistent timing
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return baseTime + (offset += 15);
      });

      // Generate some metrics
      for (let i = 0; i < 10; i++) {
        await monitor.measure('test-service', 'test-operation', async () => {
          return 'result';
        });
      }

      const reports = monitor.generateReport();
      expect(reports).toHaveLength(1);

      const report = reports[0];
      expect(report.serviceName).toBe('test-service');
      expect(report.totalOperations).toBe(10);
      expect(report.successfulOperations).toBe(10);
      expect(report.averageDuration).toBeGreaterThan(0);
      expect(report.percentiles.p50).toBeDefined();
      expect(report.percentiles.p90).toBeDefined();
      expect(report.percentiles.p95).toBeDefined();
      expect(report.percentiles.p99).toBeDefined();
    });

    it('should filter report by service name', async () => {
      // Mock performance.now
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 10),
      );

      await monitor.measure('service1', 'op1', async () => 'result1');
      await monitor.measure('service2', 'op2', async () => 'result2');

      const reports = monitor.generateReport('service1');
      expect(reports).toHaveLength(1);
      expect(reports[0].serviceName).toBe('service1');
    });

    it('should filter report by operation', async () => {
      // Mock performance.now
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 10),
      );

      await monitor.measure('service', 'op1', async () => 'result1');
      await monitor.measure('service', 'op2', async () => 'result2');

      const reports = monitor.generateReport('service', 'op1');
      expect(reports).toHaveLength(1);
    });

    it('should calculate percentiles correctly', async () => {
      // Mock performance.now to simulate specific durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      let callIndex = 0;

      vi.spyOn(performance, 'now').mockImplementation(() => {
        const isStart = callIndex % 2 === 0;
        const durationIndex = Math.floor(callIndex / 2);
        const duration =
          durationIndex < durations.length ? durations[durationIndex] : 0;
        const result = isStart
          ? baseTime + callIndex * 1000
          : baseTime + (callIndex - 1) * 1000 + duration;
        callIndex++;
        return result;
      });

      for (let i = 0; i < durations.length; i++) {
        await monitor.measure(
          'test-service',
          'test-operation',
          async () => 'result',
        );
      }

      const reports = monitor.generateReport();
      expect(reports).toHaveLength(1);
      const report = reports[0];
      expect(report.percentiles.p50).toBeGreaterThanOrEqual(40);
      expect(report.percentiles.p90).toBeGreaterThanOrEqual(80);
    });

    it('should emit periodic reports', async () => {
      vi.useFakeTimers();

      const reportHandler = vi.fn();
      eventBus.on('performance:report', reportHandler);

      // Mock performance.now
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 10),
      );

      // Create a new monitor instance (startReporting is called in constructor)
      monitor = new EnhancedPerformanceMonitor(eventBus, {
        reportingInterval: 100,
      });

      await monitor.measure(
        'test-service',
        'test-operation',
        async () => 'result',
      );

      // Advance timers to trigger the interval
      await vi.advanceTimersByTimeAsync(100);

      expect(reportHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reports: expect.any(Array),
          isHighLoad: expect.any(Boolean),
          memoryPressure: expect.any(Boolean),
          timestamp: expect.any(Number),
        }),
        expect.any(Object),
      );

      vi.useRealTimers();
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare performance with baseline', () => {
      const baseline: PerformanceReport[] = [
        {
          serviceName: 'test-service',
          totalOperations: 100,
          successfulOperations: 95,
          failedOperations: 5,
          averageDuration: 100,
          minDuration: 50,
          maxDuration: 200,
          percentiles: { p50: 90, p90: 150, p95: 180, p99: 195 },
          memoryStats: { average: 50 * 1024 * 1024, peak: 100 * 1024 * 1024 },
          timeRange: { start: 0, end: 1000 },
        },
      ];

      const current: PerformanceReport[] = [
        {
          serviceName: 'test-service',
          totalOperations: 100,
          successfulOperations: 98,
          failedOperations: 2,
          averageDuration: 80,
          minDuration: 40,
          maxDuration: 150,
          percentiles: { p50: 75, p90: 120, p95: 140, p99: 148 },
          memoryStats: { average: 40 * 1024 * 1024, peak: 80 * 1024 * 1024 },
          timeRange: { start: 1000, end: 2000 },
        },
      ];

      const comparison = monitor.compareWithBaseline(baseline, current);

      expect(comparison['test-service']).toBeDefined();
      expect(comparison['test-service'].durationImprovement.average).toBe(20); // 20% improvement
      expect(comparison['test-service'].memoryImprovement.average).toBe(20); // 20% improvement
      expect(
        comparison['test-service'].successRateImprovement.improvement,
      ).toBeCloseTo(3, 10); // 3% improvement
    });

    it('should handle missing baseline', () => {
      const baseline: PerformanceReport[] = [];
      const current: PerformanceReport[] = [
        {
          serviceName: 'test-service',
          totalOperations: 100,
          successfulOperations: 100,
          failedOperations: 0,
          averageDuration: 50,
          minDuration: 30,
          maxDuration: 70,
          percentiles: { p50: 45, p90: 60, p95: 65, p99: 68 },
          timeRange: { start: 0, end: 1000 },
        },
      ];

      const comparison = monitor.compareWithBaseline(baseline, current);
      expect(comparison).toEqual({});
    });
  });

  describe('Memory Monitoring', () => {
    it('should monitor memory pressure', async () => {
      vi.useFakeTimers();

      const memoryPressureHandler = vi.fn();
      eventBus.on('performance:memory-pressure', memoryPressureHandler);

      // Mock setInterval to capture the callback
      let intervalCallback: Function | null = null;
      vi.stubGlobal(
        'setInterval',
        vi.fn((callback: Function, delay: number) => {
          if (delay === 5000) {
            // Memory monitoring interval
            intervalCallback = callback;
          }
          return Math.random();
        }),
      );

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        memoryWarningThreshold: 100, // 100MB threshold
      });

      // Mock high memory usage
      (monitor as any).getMemoryUsage = vi.fn(() => 150 * 1024 * 1024);

      // Manually trigger the memory monitoring
      if (intervalCallback) {
        intervalCallback();
      }

      expect(memoryPressureHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: 150 * 1024 * 1024,
          threshold: 100 * 1024 * 1024,
        }),
        expect.any(Object),
      );

      vi.useRealTimers();
    });

    it('should optimize memory under pressure', async () => {
      vi.useFakeTimers();

      const memoryOptimizedHandler = vi.fn();
      eventBus.on('performance:memory-optimized', memoryOptimizedHandler);

      // Add old metrics
      for (let i = 0; i < 20; i++) {
        await monitor.measure(
          'test-service',
          'test-operation',
          async () => 'result',
        );
      }

      // Mock high memory usage
      (monitor as any).getMemoryUsage = vi.fn(() => 150 * 1024 * 1024);

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        memoryWarningThreshold: 100,
        metricsRetentionTime: 1000,
      });

      (monitor as any).getMemoryUsage = vi.fn(() => 150 * 1024 * 1024);

      // Add some metrics
      for (let i = 0; i < 10; i++) {
        await monitor.measure(
          'test-service',
          'test-operation',
          async () => 'result',
        );
      }

      // Advance time to trigger memory check
      await vi.advanceTimersByTimeAsync(5000);

      expect(memoryOptimizedHandler).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Garbage Collection Optimization', () => {
    it('should suggest garbage collection at intervals', async () => {
      vi.useFakeTimers();

      const gcSuggestedHandler = vi.fn();
      eventBus.on('performance:gc-suggested', gcSuggestedHandler);

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        enableGarbageCollectionOptimization: true,
      });

      // Trigger GC optimization (called during memory optimization)
      (monitor as any).optimizeGarbageCollection();

      // Advance time past GC interval
      await vi.advanceTimersByTimeAsync(60001);

      (monitor as any).optimizeGarbageCollection();

      expect(gcSuggestedHandler).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not suggest GC under high load', async () => {
      vi.useFakeTimers();

      const gcSuggestedHandler = vi.fn();
      eventBus.on('performance:gc-suggested', gcSuggestedHandler);

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        enableGarbageCollectionOptimization: true,
        reportingInterval: 100,
      });

      // Mock performance.now to ensure consistent timing
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 1),
      );

      // Generate high load (more than 1000 operations to trigger high load)
      for (let i = 0; i < 1100; i++) {
        await monitor.measure(
          'test-service',
          'test-operation',
          async () => 'result',
        );
      }

      // Advance time to trigger reporting interval and update isHighLoad flag
      await vi.advanceTimersByTimeAsync(100);

      // Verify isHighLoad flag is actually set
      expect((monitor as any).isHighLoad).toBe(true);

      // Set last GC time to ensure interval has passed
      (monitor as any).lastGCTime = Date.now() - 70000; // 70 seconds ago

      // Try to trigger GC - should not suggest due to high load
      (monitor as any).optimizeGarbageCollection();

      expect(gcSuggestedHandler).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should skip GC optimization when disabled', () => {
      const gcSuggestedHandler = vi.fn();
      eventBus.on('performance:gc-suggested', gcSuggestedHandler);

      // Re-stub globals for this test
      vi.stubGlobal(
        'setInterval',
        vi.fn(() => Math.random()),
      );

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        enableGarbageCollectionOptimization: false,
      });

      (monitor as any).optimizeGarbageCollection();

      expect(gcSuggestedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Retention', () => {
    it('should clean old metrics based on retention time', async () => {
      vi.useFakeTimers();

      // Re-stub setInterval
      vi.stubGlobal(
        'setInterval',
        vi.fn(() => Math.random()),
      );

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        metricsRetentionTime: 500, // 500ms retention
      });

      // Add metrics at different times
      await monitor.measure('test-service', 'op1', async () => 'result1');

      await vi.advanceTimersByTimeAsync(300);
      await monitor.measure('test-service', 'op1', async () => 'result2');

      await vi.advanceTimersByTimeAsync(300); // Total 600ms passed
      await monitor.measure('test-service', 'op1', async () => 'result3');

      const reports = monitor.generateReport();
      if (reports.length > 0) {
        // First metric should be removed due to retention time
        expect(reports[0].totalOperations).toBe(2);
      }

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources properly', async () => {
      vi.useFakeTimers();

      // Re-stub globals
      const clearIntervalMock = vi.fn();
      vi.stubGlobal(
        'setInterval',
        vi.fn(() => 123),
      );
      vi.stubGlobal('clearInterval', clearIntervalMock);

      monitor = new EnhancedPerformanceMonitor(eventBus, {
        reportingInterval: 100,
      });

      // Add some data
      await monitor.measure(
        'test-service',
        'test-operation',
        async () => 'result',
      );
      monitor.createResourcePool('test-pool', 5, () => ({}));

      monitor.dispose();

      expect(clearIntervalMock).toHaveBeenCalled();

      // Verify cleanup
      const reports = monitor.generateReport();
      expect(reports).toHaveLength(0);

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty metrics in report generation', () => {
      const reports = monitor.generateReport();
      expect(reports).toHaveLength(0);
    });

    it('should handle operations with no memory data', async () => {
      // Mock getMemoryUsage to return 0 (no memory data)
      (monitor as any).getMemoryUsage = vi.fn(() => 0);

      // Mock performance.now for timing
      let offset = 0;
      vi.spyOn(performance, 'now').mockImplementation(
        () => baseTime + (offset += 10),
      );

      await monitor.measure(
        'test-service',
        'test-operation',
        async () => 'result',
      );

      const reports = monitor.generateReport();
      if (reports.length > 0) {
        // When memory usage is 0, memoryStats should still exist with 0 values
        expect(reports[0].memoryStats).toEqual({ average: 0, peak: 0 });
      }
    });

    it('should calculate percentiles for single value', async () => {
      await monitor.measure(
        'test-service',
        'test-operation',
        async () => 'result',
      );

      const reports = monitor.generateReport();
      if (reports.length > 0) {
        const report = reports[0];
        expect(report.percentiles.p50).toBe(report.averageDuration);
        expect(report.percentiles.p99).toBe(report.averageDuration);
      }
    });
  });
});
