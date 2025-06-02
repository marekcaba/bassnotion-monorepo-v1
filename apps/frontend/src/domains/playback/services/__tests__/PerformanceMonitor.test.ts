/**
 * PerformanceMonitor Unit Tests
 *
 * Tests audio performance tracking including latency measurement,
 * NFR compliance monitoring, and alert systems.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor.js';

// Mock AudioContext
const mockAudioContext = {
  sampleRate: 44100,
  baseLatency: 0.005, // 5ms
  outputLatency: 0.01, // 10ms
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
  })),
};

// Mock performance.memory (Chrome-specific)
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024,
  },
  configurable: true,
});

// Mock performance.now
Object.defineProperty(performance, 'now', {
  value: vi.fn(() => Date.now()),
  configurable: true,
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Reset singleton instance
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const monitor1 = PerformanceMonitor.getInstance();
      const monitor2 = PerformanceMonitor.getInstance();

      expect(monitor1).toBe(monitor2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with AudioContext', () => {
      monitor.initialize(mockAudioContext as any);

      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should update basic metrics on initialization', () => {
      monitor.initialize(mockAudioContext as any);

      const metrics = monitor.getMetrics();
      expect(metrics.sampleRate).toBe(44100);
      expect(metrics.bufferSize).toBe(
        mockAudioContext.baseLatency * mockAudioContext.sampleRate,
      );
    });
  });

  describe('Monitoring Lifecycle', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should start monitoring', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      monitor.startMonitoring(500);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    });

    it('should not start monitoring twice', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      monitor.startMonitoring();
      monitor.startMonitoring();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should stop monitoring', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      monitor.startMonitoring();
      monitor.stopMonitoring();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not stop monitoring when not started', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      monitor.stopMonitoring();

      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should calculate latency correctly', () => {
      // Start monitoring to trigger metrics collection
      monitor.startMonitoring(100);

      // Wait for at least one collection cycle
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();

          // Expected latency: (baseLatency + outputLatency) * 1000
          const expectedLatency = (0.005 + 0.01) * 1000; // 15ms
          expect(metrics.latency).toBe(expectedLatency);
          expect(metrics.averageLatency).toBeGreaterThan(0);
          expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.latency);

          resolve();
        }, 150);
      });
    });

    it('should track latency history', () => {
      monitor.startMonitoring(50);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();
          expect(metrics.averageLatency).toBeGreaterThan(0);
          resolve();
        }, 200);
      });
    });

    it('should estimate CPU usage', () => {
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();
          expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
          expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
          resolve();
        }, 150);
      });
    });

    it('should update memory usage', () => {
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();
          expect(metrics.memoryUsage).toBe(50); // 50MB from mock
          resolve();
        }, 150);
      });
    });
  });

  describe('Response Time Measurement', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should measure operation response time', async () => {
      const testOperation = () => Promise.resolve('test result');

      const { result, responseTime } =
        await monitor.measureResponseTime(testOperation);

      expect(result).toBe('test result');
      expect(responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should emit alert for slow response time', async () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      // Mock slow operation
      const slowOperation = () =>
        new Promise((resolve) => setTimeout(() => resolve('slow'), 250));

      await monitor.measureResponseTime(slowOperation);

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'latency',
          severity: 'critical',
          message: expect.stringContaining('response time exceeded 200ms'),
        }),
      );
    });
  });

  describe('Dropout and Underrun Tracking', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should record audio dropouts', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      monitor.recordDropout();

      const metrics = monitor.getMetrics();
      expect(metrics.dropoutCount).toBe(1);
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dropout',
          severity: 'warning',
          message: expect.stringContaining('Audio dropout detected'),
        }),
      );
    });

    it('should record buffer underruns', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      monitor.recordBufferUnderrun();

      const metrics = monitor.getMetrics();
      expect(metrics.bufferUnderruns).toBe(1);
      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dropout',
          severity: 'critical',
          message: expect.stringContaining('Buffer underrun detected'),
        }),
      );
    });

    it('should track multiple dropouts', () => {
      monitor.recordDropout();
      monitor.recordDropout();
      monitor.recordBufferUnderrun();

      const metrics = monitor.getMetrics();
      expect(metrics.dropoutCount).toBe(2);
      expect(metrics.bufferUnderruns).toBe(1);
    });
  });

  describe('Alert System', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should register alert handlers', () => {
      const alertHandler = vi.fn();
      const unsubscribe = monitor.onAlert(alertHandler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unregister alert handlers', () => {
      const alertHandler = vi.fn();
      const unsubscribe = monitor.onAlert(alertHandler);

      unsubscribe();
      monitor.recordDropout();

      // Handler should not be called after unsubscribe
      expect(alertHandler).not.toHaveBeenCalled();
    });

    it('should register metrics handlers', () => {
      const metricsHandler = vi.fn();
      const unsubscribe = monitor.onMetrics(metricsHandler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should emit metrics updates', () => {
      const metricsHandler = vi.fn();
      monitor.onMetrics(metricsHandler);

      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(metricsHandler).toHaveBeenCalledWith(
            expect.objectContaining({
              latency: expect.any(Number),
              sampleRate: 44100,
            }),
          );
          resolve();
        }, 150);
      });
    });
  });

  describe('NFR Compliance Testing', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should detect latency NFR violations (NFR-PO-15: <50ms)', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      // Mock high latency
      const highLatencyContext = {
        ...mockAudioContext,
        baseLatency: 0.03, // 30ms
        outputLatency: 0.025, // 25ms
        // Total: 55ms > 50ms limit
      };

      monitor.initialize(highLatencyContext as any);
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(alertHandler).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'latency',
              severity: 'critical',
              message: expect.stringContaining('NFR limit: 50ms'),
            }),
          );
          resolve();
        }, 150);
      });
    });

    it('should emit warning before critical latency threshold', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      // Mock moderate latency (30ms warning threshold)
      const moderateLatencyContext = {
        ...mockAudioContext,
        baseLatency: 0.02, // 20ms
        outputLatency: 0.015, // 15ms
        // Total: 35ms > 30ms warning
      };

      monitor.initialize(moderateLatencyContext as any);
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(alertHandler).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'latency',
              severity: 'warning',
              message: expect.stringContaining('Audio latency warning'),
            }),
          );
          resolve();
        }, 150);
      });
    });

    it('should detect CPU usage violations', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      // Force high CPU usage by recording many dropouts
      for (let i = 0; i < 20; i++) {
        monitor.recordDropout();
      }

      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cpuAlerts = alertHandler.mock.calls.filter(
            (call) => call[0].type === 'cpu' && call[0].severity === 'critical',
          );
          expect(cpuAlerts.length).toBeGreaterThan(0);
          resolve();
        }, 150);
      });
    });
  });

  describe('Metrics Reset', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should reset metrics', () => {
      // Add some data
      monitor.recordDropout();
      monitor.recordBufferUnderrun();

      const metricsBefore = monitor.getMetrics();
      expect(metricsBefore.dropoutCount).toBe(1);
      expect(metricsBefore.bufferUnderruns).toBe(1);

      monitor.resetMetrics();

      const metricsAfter = monitor.getMetrics();
      expect(metricsAfter.dropoutCount).toBe(0);
      expect(metricsAfter.bufferUnderruns).toBe(0);
      expect(metricsAfter.latency).toBe(0);
      expect(metricsAfter.averageLatency).toBe(0);
      expect(metricsAfter.maxLatency).toBe(0);
    });
  });

  describe('Disposal', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should dispose properly', () => {
      const alertHandler = vi.fn();
      const metricsHandler = vi.fn();

      monitor.onAlert(alertHandler);
      monitor.onMetrics(metricsHandler);
      monitor.startMonitoring();

      monitor.dispose();

      // Should stop monitoring and clear handlers
      const metrics = monitor.getMetrics();
      expect(metrics.timestamp).toBeGreaterThan(0); // Basic sanity check
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing performance.memory', () => {
      // Temporarily remove performance.memory
      const originalMemory = (performance as any).memory;
      delete (performance as any).memory;

      monitor.initialize(mockAudioContext as any);
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();
          // Should not throw and memory should remain 0
          expect(metrics.memoryUsage).toBe(0);

          // Restore
          (performance as any).memory = originalMemory;
          resolve();
        }, 150);
      });
    });

    it('should handle missing AudioContext properties', () => {
      const incompleteContext = {
        sampleRate: 44100,
        // Missing baseLatency and outputLatency but has createAnalyser
        createAnalyser: vi.fn(() => ({
          fftSize: 256,
          smoothingTimeConstant: 0.8,
        })),
      };

      monitor.initialize(incompleteContext as any);
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();
          expect(metrics.latency).toBe(0); // Should default to 0
          expect(incompleteContext.createAnalyser).toHaveBeenCalled();
          resolve();
        }, 150);
      });
    });
  });
});
