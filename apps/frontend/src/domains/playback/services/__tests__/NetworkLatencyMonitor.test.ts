/**
 * NetworkLatencyMonitor Tests
 *
 * Comprehensive unit tests for network latency monitoring and CDN performance comparison
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkLatencyMonitor } from '../NetworkLatencyMonitor.js';

// Mock performance API
const mockPerformance = {
  now: vi.fn(),
  timing: {
    navigationStart: 1000,
    domainLookupStart: 1010,
    domainLookupEnd: 1020,
    connectStart: 1020,
    connectEnd: 1050,
    requestStart: 1050,
    responseStart: 1100,
    responseEnd: 1150,
  },
  getEntriesByName: vi.fn(),
};

// Mock fetch for network requests
const mockFetch = vi.fn();

describe('NetworkLatencyMonitor', () => {
  let monitor: NetworkLatencyMonitor;

  beforeEach(() => {
    // Setup global mocks
    vi.stubGlobal('performance', mockPerformance);
    vi.stubGlobal('fetch', mockFetch);

    // Reset mocks
    mockPerformance.now.mockClear();
    mockPerformance.getEntriesByName.mockClear();
    mockFetch.mockClear();

    // Reset singleton state
    (NetworkLatencyMonitor as any).instance = undefined;
    monitor = NetworkLatencyMonitor.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    monitor.dispose?.();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NetworkLatencyMonitor.getInstance();
      const instance2 = NetworkLatencyMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = NetworkLatencyMonitor.getInstance();
      const instance2 = NetworkLatencyMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initial State', () => {
    it('should have default metrics on initialization', () => {
      const metrics = monitor.getMetrics();

      expect(metrics.currentLatency).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.minLatency).toBe(Infinity);
      expect(metrics.maxLatency).toBe(0);
      expect(metrics.cdnLatency).toBe(0);
      expect(metrics.supabaseLatency).toBe(0);
      expect(metrics.measurementCount).toBe(0);
      expect(metrics.failedMeasurements).toBe(0);
    });

    it('should have good network condition by default', () => {
      const condition = monitor.getNetworkCondition();
      expect(condition).toBe('good');
    });

    it('should not be monitoring initially', () => {
      expect((monitor as any).isMonitoring).toBe(false);
    });
  });

  describe('Asset Measurement Lifecycle', () => {
    it('should start asset measurement and return measurement ID', () => {
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
        'audio',
      );

      expect(measurementId).toBeDefined();
      expect(typeof measurementId).toBe('string');
      expect(measurementId.length).toBeGreaterThan(0);
    });

    it('should complete asset measurement successfully', () => {
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
        'audio',
      );

      // Simulate some time passing
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1150);

      const result = monitor.completeAssetMeasurement(
        measurementId,
        true,
        undefined,
        1024,
      );

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
      expect(result?.url).toBe('https://cdn.example.com/test.mp3');
      expect(result?.source).toBe('cdn');
      expect(result?.assetType).toBe('audio');
      expect(result?.assetSize).toBe(1024);
    });

    it('should handle failed asset measurements', () => {
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
      );

      const result = monitor.completeAssetMeasurement(
        measurementId,
        false,
        'Network timeout',
      );

      expect(result).toBeDefined();
      expect(result?.success).toBe(false);
      expect(result?.error).toBe('Network timeout');
    });

    it('should return null for unknown measurement ID', () => {
      const result = monitor.completeAssetMeasurement('unknown-id', true);

      expect(result).toBeNull();
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring', () => {
      expect((monitor as any).isMonitoring).toBe(false);
      monitor.startMonitoring();
      expect((monitor as any).isMonitoring).toBe(true);
    });

    it('should stop monitoring', () => {
      monitor.startMonitoring();
      expect((monitor as any).isMonitoring).toBe(true);
      monitor.stopMonitoring();
      expect((monitor as any).isMonitoring).toBe(false);
    });

    it('should not start monitoring twice', () => {
      monitor.startMonitoring();
      const intervalId1 = (monitor as any).monitoringInterval;
      monitor.startMonitoring(); // Second call should be ignored
      const intervalId2 = (monitor as any).monitoringInterval;
      expect(intervalId1).toBe(intervalId2);
    });

    it('should emit monitoring events', () => {
      const startedCallback = vi.fn();
      const stoppedCallback = vi.fn();

      monitor.on('monitoringStarted', startedCallback);
      monitor.on('monitoringStopped', stoppedCallback);

      monitor.startMonitoring();
      expect(startedCallback).toHaveBeenCalledWith({
        timestamp: expect.any(Number),
      });

      monitor.stopMonitoring();
      expect(stoppedCallback).toHaveBeenCalledWith({
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Source Performance Comparison', () => {
    it('should provide performance comparison for CDN and Supabase', () => {
      const comparison = monitor.getSourcePerformanceComparison();

      expect(comparison).toHaveProperty('cdn');
      expect(comparison).toHaveProperty('supabase');

      expect(comparison.cdn).toHaveProperty('averageLatency');
      expect(comparison.cdn).toHaveProperty('successRate');
      expect(comparison.cdn).toHaveProperty('measurementCount');

      expect(comparison.supabase).toHaveProperty('averageLatency');
      expect(comparison.supabase).toHaveProperty('successRate');
      expect(comparison.supabase).toHaveProperty('measurementCount');
    });

    it('should start with zero measurements for both sources', () => {
      const comparison = monitor.getSourcePerformanceComparison();

      expect(comparison.cdn.measurementCount).toBe(0);
      expect(comparison.supabase.measurementCount).toBe(0);
      expect(comparison.cdn.averageLatency).toBe(0);
      expect(comparison.supabase.averageLatency).toBe(0);
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics to default state', () => {
      // Perform some measurements first
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
      );
      monitor.completeAssetMeasurement(measurementId, true);

      // Reset metrics
      monitor.resetMetrics();

      // Check that metrics are back to defaults
      const metrics = monitor.getMetrics();
      expect(metrics.currentLatency).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.measurementCount).toBe(0);
      expect(metrics.failedMeasurements).toBe(0);
    });

    it('should emit reset event', () => {
      const resetCallback = vi.fn();
      monitor.on('metricsReset', resetCallback);

      monitor.resetMetrics();

      expect(resetCallback).toHaveBeenCalledWith({
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customConfig = {
        measurementInterval: 10000,
        historySize: 50,
        enableDetailedTiming: false,
      };

      const customMonitor = NetworkLatencyMonitor.getInstance(customConfig);
      const config = (customMonitor as any).config;

      expect(config.measurementInterval).toBe(10000);
      expect(config.historySize).toBe(50);
      expect(config.enableDetailedTiming).toBe(false);
    });

    it('should merge with default configuration', () => {
      const customConfig = { measurementInterval: 10000 };

      const customMonitor = NetworkLatencyMonitor.getInstance(customConfig);
      const config = (customMonitor as any).config;

      // Custom setting
      expect(config.measurementInterval).toBe(10000);
      // Default settings preserved
      expect(config.enabled).toBe(true);
      expect(config.historySize).toBe(100);
    });
  });

  describe('Network Condition Detection', () => {
    it('should maintain network condition state', () => {
      const initialCondition = monitor.getNetworkCondition();
      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(
        initialCondition,
      );
    });

    it('should provide consistent condition from getNetworkCondition and getMetrics', () => {
      const condition = monitor.getNetworkCondition();
      const metrics = monitor.getMetrics();
      expect(condition).toBe(metrics.networkCondition);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing performance API gracefully', () => {
      vi.stubGlobal('performance', undefined);

      expect(() => {
        const measurementId = monitor.startAssetMeasurement(
          'https://cdn.example.com/test.mp3',
          'cdn',
        );
        monitor.completeAssetMeasurement(measurementId, true);
      }).not.toThrow();
    });

    it('should handle missing measurement completion gracefully', () => {
      const result = monitor.completeAssetMeasurement('non-existent-id', true);
      expect(result).toBeNull();
    });

    it('should handle invalid URLs gracefully', () => {
      expect(() => {
        monitor.startAssetMeasurement('invalid-url', 'cdn');
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should dispose properly', () => {
      monitor.startMonitoring();
      expect((monitor as any).isMonitoring).toBe(true);

      monitor.dispose();

      expect((monitor as any).isMonitoring).toBe(false);
      expect((monitor as any).monitoringInterval).toBeNull();
    });

    it('should limit measurement history size', () => {
      const maxHistorySize = (monitor as any).config.historySize;

      // Add more measurements than the limit
      for (let i = 0; i < maxHistorySize + 10; i++) {
        const measurementId = monitor.startAssetMeasurement(
          `https://cdn.example.com/test${i}.mp3`,
          'cdn',
        );
        monitor.completeAssetMeasurement(measurementId, true);
      }

      const history = (monitor as any).measurementHistory;
      expect(history.length).toBeLessThanOrEqual(maxHistorySize);
    });
  });

  describe('Integration Requirements', () => {
    it('should provide Epic 2 compliant metrics interface', () => {
      const metrics = monitor.getMetrics();

      // Check Epic 2 interface compliance
      expect(typeof metrics.currentLatency).toBe('number');
      expect(typeof metrics.averageLatency).toBe('number');
      expect(typeof metrics.networkCondition).toBe('string');
      expect(typeof metrics.lastMeasurement).toBe('number');
      expect(typeof metrics.measurementCount).toBe('number');
    });

    it('should maintain measurement timestamps', () => {
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
      );

      const beforeTime = Date.now();
      monitor.completeAssetMeasurement(measurementId, true);
      const afterTime = Date.now();

      const metrics = monitor.getMetrics();
      expect(metrics.lastMeasurement).toBeGreaterThanOrEqual(beforeTime);
      expect(metrics.lastMeasurement).toBeLessThanOrEqual(afterTime);
    });

    it('should support both CDN and Supabase sources', () => {
      const cdnMeasurementId = monitor.startAssetMeasurement(
        'https://cdn.example.com/test.mp3',
        'cdn',
      );
      const supabaseMeasurementId = monitor.startAssetMeasurement(
        'https://supabase.example.com/test.mp3',
        'supabase',
      );

      const cdnResult = monitor.completeAssetMeasurement(
        cdnMeasurementId,
        true,
      );
      const supabaseResult = monitor.completeAssetMeasurement(
        supabaseMeasurementId,
        true,
      );

      expect(cdnResult?.source).toBe('cdn');
      expect(supabaseResult?.source).toBe('supabase');
    });
  });
});
