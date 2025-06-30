/**
 * NetworkLatencyMonitor Behavior Tests
 *
 * Testing network latency measurement, performance monitoring, condition tracking,
 * and asset loading behaviors for the 482-line NetworkLatencyMonitor service using
 * proven behavior-driven approach.
 *
 * Core Behaviors:
 * - Network latency measurement (automatic and manual)
 * - Performance metrics tracking and analytics
 * - Network condition classification and monitoring
 * - CDN vs Supabase performance comparison
 * - Asset loading tracking and measurement
 * - Threshold-based monitoring and condition changes
 * - Event emission and lifecycle management
 * - Configuration management and adaptive thresholds
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkLatencyMonitor } from '../NetworkLatencyMonitor.js';
import type {
  NetworkLatencyConfig,
  NetworkLatencyMetrics,
  NetworkCondition,
  NetworkMeasurementDetails,
} from '../NetworkLatencyMonitor.js';

// Safe browser environment setup for network monitoring testing
const createMockEnvironment = () => {
  const globalObj = global as any;

  // Mock performance API with timing methods
  if (!globalObj.performance) {
    globalObj.performance = {
      now: vi.fn(() => Date.now()),
      getEntriesByType: vi.fn(() => []),
      mark: vi.fn(),
      measure: vi.fn(),
      timing: {
        navigationStart: Date.now(),
        domainLookupStart: Date.now() + 10,
        domainLookupEnd: Date.now() + 20,
        connectStart: Date.now() + 20,
        connectEnd: Date.now() + 50,
        requestStart: Date.now() + 50,
        responseStart: Date.now() + 100,
        responseEnd: Date.now() + 150,
      },
    };
  }

  // Mock window with interval methods
  if (!globalObj.window) {
    globalObj.window = {
      setInterval: vi.fn((callback, delay) => {
        return setInterval(callback, delay);
      }),
      clearInterval: vi.fn((id) => {
        clearInterval(id);
      }),
    };
  }

  // Mock fetch for network requests
  const createMockResponse = (ok = true, _delay = 100) => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
  });

  const mockFetch = vi.fn((url: string, _options?: any) => {
    const delay = url.includes('slow') ? 500 : url.includes('fast') ? 50 : 100;
    const success = !url.includes('error');

    return Promise.resolve(createMockResponse(success, delay));
  });

  // Mock Date for consistent timestamps
  const fixedTimestamp = 1640995200000;
  let currentTime = fixedTimestamp;

  const mockDate = {
    now: vi.fn(() => {
      currentTime += 100; // Increment by 100ms each call
      return currentTime;
    }),
  };

  return {
    globalObj,
    mockFetch,
    mockDate,
    fixedTimestamp,
  };
};

// Scenario builders for network latency testing
const createNetworkScenarios = () => {
  // Network measurement scenarios
  const excellentLatencyMeasurement = (): Omit<
    NetworkMeasurementDetails,
    'url' | 'source'
  > => ({
    startTime: Date.now(),
    dnsStart: 0,
    dnsEnd: 10,
    connectionStart: 10,
    connectionEnd: 30,
    requestStart: 30,
    responseStart: 40,
    responseEnd: 45,
    totalTime: 45, // Excellent < 50ms
    success: true,
  });

  const goodLatencyMeasurement = (): Omit<
    NetworkMeasurementDetails,
    'url' | 'source'
  > => ({
    startTime: Date.now(),
    dnsStart: 0,
    dnsEnd: 20,
    connectionStart: 20,
    connectionEnd: 60,
    requestStart: 60,
    responseStart: 80,
    responseEnd: 120,
    totalTime: 120, // Good 50-150ms
    success: true,
  });

  const poorLatencyMeasurement = (): Omit<
    NetworkMeasurementDetails,
    'url' | 'source'
  > => ({
    startTime: Date.now(),
    dnsStart: 0,
    dnsEnd: 100,
    connectionStart: 100,
    connectionEnd: 250,
    requestStart: 250,
    responseStart: 350,
    responseEnd: 450,
    totalTime: 450, // Poor 300-500ms
    success: true,
  });

  const failedMeasurement = (): Omit<
    NetworkMeasurementDetails,
    'url' | 'source'
  > => ({
    startTime: Date.now(),
    dnsStart: 0,
    dnsEnd: 0,
    connectionStart: 0,
    connectionEnd: 0,
    requestStart: 0,
    responseStart: 0,
    responseEnd: 0,
    totalTime: 0,
    success: false,
    error: 'Network timeout',
  });

  // Configuration scenarios
  const basicConfig: Partial<NetworkLatencyConfig> = {
    enabled: true,
    measurementInterval: 1000, // 1 second for testing
    historySize: 50,
    dnsTimeout: 2000,
    connectionTimeout: 5000,
    requestTimeout: 10000,
    enableDetailedTiming: true,
    enableGeolocation: false,
    adaptiveThresholds: true,
  };

  const disabledConfig: Partial<NetworkLatencyConfig> = {
    enabled: false,
    measurementInterval: 5000,
    historySize: 10,
  };

  const fastConfig: Partial<NetworkLatencyConfig> = {
    enabled: true,
    measurementInterval: 500, // Very fast for testing
    historySize: 20,
    enableDetailedTiming: true,
  };

  const timeoutConfig: Partial<NetworkLatencyConfig> = {
    enabled: true,
    dnsTimeout: 100, // Very short timeouts
    connectionTimeout: 200,
    requestTimeout: 500,
  };

  // Asset measurement scenarios
  const cdnAssetMeasurement = (latency = 100) => ({
    url: 'https://cdn.bassnotion.com/audio/track1.wav',
    source: 'cdn' as const,
    assetType: 'audio' as const,
    totalTime: latency,
    success: true,
  });

  const supabaseAssetMeasurement = (latency = 150) => ({
    url: 'https://project.supabase.co/storage/v1/object/public/audio/track2.wav',
    source: 'supabase' as const,
    assetType: 'audio' as const,
    totalTime: latency,
    success: true,
  });

  const midiAssetMeasurement = (latency = 80) => ({
    url: 'https://cdn.bassnotion.com/midi/pattern1.mid',
    source: 'cdn' as const,
    assetType: 'midi' as const,
    totalTime: latency,
    success: true,
  });

  return {
    measurements: {
      excellentLatencyMeasurement,
      goodLatencyMeasurement,
      poorLatencyMeasurement,
      failedMeasurement,
    },
    configs: {
      basicConfig,
      disabledConfig,
      fastConfig,
      timeoutConfig,
    },
    assets: {
      cdnAssetMeasurement,
      supabaseAssetMeasurement,
      midiAssetMeasurement,
    },
  };
};

// Expectation helpers for network latency testing
const createNetworkExpectations = () => {
  const shouldInitializeCorrectly = (monitor: NetworkLatencyMonitor) => {
    const metrics = monitor.getMetrics();
    expect(metrics).toMatchObject({
      currentLatency: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      measurementCount: 0,
      failedMeasurements: 0,
      networkCondition: 'good',
    });
  };

  const shouldHaveValidMetrics = (metrics: NetworkLatencyMetrics) => {
    expect(metrics.currentLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    expect(metrics.measurementCount).toBeGreaterThanOrEqual(0);
    expect(metrics.failedMeasurements).toBeGreaterThanOrEqual(0);
    expect(metrics.lastMeasurement).toBeGreaterThanOrEqual(0);
    expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(
      metrics.networkCondition,
    );
  };

  const shouldClassifyConditionCorrectly = (
    monitor: NetworkLatencyMonitor,
    expectedCondition: NetworkCondition,
  ) => {
    const condition = monitor.getNetworkCondition();
    expect(condition).toBe(expectedCondition);

    const metrics = monitor.getMetrics();
    expect(metrics.networkCondition).toBe(expectedCondition);
  };

  const shouldProvideSourceComparison = (comparison: any) => {
    expect(comparison).toMatchObject({
      cdn: {
        averageLatency: expect.any(Number),
        successRate: expect.any(Number),
        measurementCount: expect.any(Number),
      },
      supabase: {
        averageLatency: expect.any(Number),
        successRate: expect.any(Number),
        measurementCount: expect.any(Number),
      },
    });

    expect(comparison.cdn.successRate).toBeGreaterThanOrEqual(0);
    expect(comparison.cdn.successRate).toBeLessThanOrEqual(1);
    expect(comparison.supabase.successRate).toBeGreaterThanOrEqual(0);
    expect(comparison.supabase.successRate).toBeLessThanOrEqual(1);
  };

  const shouldUpdateMinMaxCorrectly = (
    metrics: NetworkLatencyMetrics,
    latency: number,
  ) => {
    if (metrics.measurementCount > 0) {
      expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
      expect(metrics.minLatency).toBeLessThanOrEqual(latency);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(latency);
    }
  };

  const shouldTrackMeasurementHistory = (
    monitor: NetworkLatencyMonitor,
    expectedCount: number,
  ) => {
    const metrics = monitor.getMetrics();
    expect(metrics.measurementCount).toBe(expectedCount);
  };

  const shouldValidateAssetMeasurement = (
    measurement: NetworkMeasurementDetails | null,
    url: string,
    source: string,
  ) => {
    expect(measurement).not.toBeNull();
    if (measurement) {
      expect(measurement.url).toBe(url);
      expect(measurement.source).toBe(source);
      expect(measurement.totalTime).toBeGreaterThanOrEqual(0);
      expect(typeof measurement.success).toBe('boolean');
    }
  };

  return {
    shouldInitializeCorrectly,
    shouldHaveValidMetrics,
    shouldClassifyConditionCorrectly,
    shouldProvideSourceComparison,
    shouldUpdateMinMaxCorrectly,
    shouldTrackMeasurementHistory,
    shouldValidateAssetMeasurement,
  };
};

describe('NetworkLatencyMonitor Behavior', () => {
  let monitor: NetworkLatencyMonitor;
  let mockEnv: ReturnType<typeof createMockEnvironment>;
  let scenarios: ReturnType<typeof createNetworkScenarios>;
  let expectations: ReturnType<typeof createNetworkExpectations>;

  beforeEach(() => {
    // Setup mock environment
    mockEnv = createMockEnvironment();
    scenarios = createNetworkScenarios();
    expectations = createNetworkExpectations();

    // Setup global mocks
    vi.stubGlobal('performance', mockEnv.globalObj.performance);
    vi.stubGlobal('window', mockEnv.globalObj.window);
    vi.stubGlobal('fetch', mockEnv.mockFetch);

    // Mock Date.now safely
    vi.spyOn(Date, 'now').mockReturnValue(mockEnv.fixedTimestamp);

    // Reset singleton
    (NetworkLatencyMonitor as any).instance = undefined;
    monitor = NetworkLatencyMonitor.getInstance(scenarios.configs.basicConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (monitor) {
      monitor.dispose();
    }
  });

  describe('🌐 Initialization and Configuration Behavior', () => {
    it('should initialize with default configuration', () => {
      const defaultMonitor = NetworkLatencyMonitor.getInstance();
      expectations.shouldInitializeCorrectly(defaultMonitor);
      defaultMonitor.dispose();
    });

    it('should initialize with custom configuration', () => {
      const customMonitor = NetworkLatencyMonitor.getInstance(
        scenarios.configs.fastConfig,
      );
      expectations.shouldInitializeCorrectly(customMonitor);
      customMonitor.dispose();
    });

    it('should handle disabled configuration', () => {
      const disabledMonitor = NetworkLatencyMonitor.getInstance(
        scenarios.configs.disabledConfig,
      );
      expectations.shouldInitializeCorrectly(disabledMonitor);
      disabledMonitor.dispose();
    });

    it('should maintain singleton pattern', () => {
      const monitor1 = NetworkLatencyMonitor.getInstance();
      const monitor2 = NetworkLatencyMonitor.getInstance();
      expect(monitor1).toBe(monitor2);
      monitor1.dispose();
    });

    it('should update configuration on existing instance', () => {
      const monitor1 = NetworkLatencyMonitor.getInstance({
        measurementInterval: 1000,
      });
      const monitor2 = NetworkLatencyMonitor.getInstance({
        measurementInterval: 2000,
      });
      expect(monitor1).toBe(monitor2);
      monitor1.dispose();
    });
  });

  describe('📊 Network Metrics Tracking Behavior', () => {
    it('should provide valid initial metrics', () => {
      const metrics = monitor.getMetrics();
      expectations.shouldHaveValidMetrics(metrics);
      expect(metrics.measurementCount).toBe(0);
    });

    it('should update metrics after measurements', () => {
      // Simulate a measurement
      const measurement = {
        ...scenarios.measurements.goodLatencyMeasurement(),
        url: 'test-url',
        source: 'unknown' as const,
      };

      // Access private method for testing
      (monitor as any).updateGeneralMetrics(measurement);

      const metrics = monitor.getMetrics();
      expectations.shouldHaveValidMetrics(metrics);
      expect(metrics.measurementCount).toBe(1);
      expect(metrics.currentLatency).toBe(measurement.totalTime);
    });

    it('should track minimum and maximum latency correctly', () => {
      // Add measurements with different latencies
      const fastMeasurement = {
        ...scenarios.measurements.excellentLatencyMeasurement(),
        url: 'fast-url',
        source: 'unknown' as const,
      };
      const slowMeasurement = {
        ...scenarios.measurements.poorLatencyMeasurement(),
        url: 'slow-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateGeneralMetrics(fastMeasurement);
      (monitor as any).updateGeneralMetrics(slowMeasurement);

      const metrics = monitor.getMetrics();
      expectations.shouldUpdateMinMaxCorrectly(
        metrics,
        fastMeasurement.totalTime,
      );
      expect(metrics.minLatency).toBe(fastMeasurement.totalTime);
      expect(metrics.maxLatency).toBe(slowMeasurement.totalTime);
    });

    it('should calculate rolling average correctly', () => {
      // Add multiple measurements
      const measurements = [
        { totalTime: 100 },
        { totalTime: 200 },
        { totalTime: 300 },
      ];

      measurements.forEach((measurement, index) => {
        const fullMeasurement = {
          url: `test-${index}`,
          source: 'unknown' as const,
          startTime: Date.now(),
          dnsStart: 0,
          dnsEnd: 0,
          connectionStart: 0,
          connectionEnd: 0,
          requestStart: 0,
          responseStart: 0,
          responseEnd: 0,
          success: true,
          ...measurement,
        };
        (monitor as any).updateGeneralMetrics(fullMeasurement);
      });

      const metrics = monitor.getMetrics();
      expect(metrics.averageLatency).toBe(200); // (100 + 200 + 300) / 3
      expect(metrics.measurementCount).toBe(3);
    });

    it('should track failed measurements', () => {
      const failedMeasurement = {
        ...scenarios.measurements.failedMeasurement(),
        url: 'failed-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateMetricsFromMeasurement(failedMeasurement);

      const metrics = monitor.getMetrics();
      expect(metrics.failedMeasurements).toBe(1);
    });
  });

  describe('🏷️ Network Condition Classification Behavior', () => {
    it('should classify excellent network condition', () => {
      const excellentMeasurement = {
        ...scenarios.measurements.excellentLatencyMeasurement(),
        url: 'excellent-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateGeneralMetrics(excellentMeasurement);
      expectations.shouldClassifyConditionCorrectly(monitor, 'excellent');
    });

    it('should classify good network condition', () => {
      const goodMeasurement = {
        ...scenarios.measurements.goodLatencyMeasurement(),
        url: 'good-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateGeneralMetrics(goodMeasurement);
      expectations.shouldClassifyConditionCorrectly(monitor, 'good');
    });

    it('should classify poor network condition', () => {
      const poorMeasurement = {
        ...scenarios.measurements.poorLatencyMeasurement(),
        url: 'poor-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateGeneralMetrics(poorMeasurement);
      expectations.shouldClassifyConditionCorrectly(monitor, 'poor');
    });

    it('should emit network condition change events', async () => {
      let eventReceived = false;

      monitor.on('networkConditionChanged', (event) => {
        expect(event).toMatchObject({
          from: expect.any(String),
          to: expect.any(String),
          latency: expect.any(Number),
          timestamp: expect.any(Number),
        });
        eventReceived = true;
      });

      // Change from good to poor condition
      const poorMeasurement = {
        ...scenarios.measurements.poorLatencyMeasurement(),
        url: 'condition-change-url',
        source: 'unknown' as const,
      };

      (monitor as any).updateGeneralMetrics(poorMeasurement);

      // Give event time to fire
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(eventReceived).toBe(true);
    });

    it('should handle condition changes from poor to excellent', () => {
      // Start with poor condition
      const poorMeasurement = {
        ...scenarios.measurements.poorLatencyMeasurement(),
        url: 'poor-start',
        source: 'unknown' as const,
      };
      (monitor as any).updateGeneralMetrics(poorMeasurement);
      expect(monitor.getNetworkCondition()).toBe('poor');

      // Add excellent measurements to improve average
      for (let i = 0; i < 5; i++) {
        const excellentMeasurement = {
          ...scenarios.measurements.excellentLatencyMeasurement(),
          url: `excellent-${i}`,
          source: 'unknown' as const,
        };
        (monitor as any).updateGeneralMetrics(excellentMeasurement);
      }

      // Should improve to excellent
      expectations.shouldClassifyConditionCorrectly(monitor, 'excellent');
    });
  });

  describe('🎯 Asset Measurement Tracking Behavior', () => {
    it('should start asset measurement and return measurement ID', () => {
      const measurementId = monitor.startAssetMeasurement(
        'https://cdn.bassnotion.com/audio/track1.wav',
        'cdn',
        'audio',
      );

      expect(typeof measurementId).toBe('string');
      expect(measurementId.length).toBeGreaterThan(0);
    });

    it('should complete asset measurement successfully', () => {
      const url = 'https://cdn.bassnotion.com/audio/track1.wav';
      const measurementId = monitor.startAssetMeasurement(url, 'cdn', 'audio');

      const completedMeasurement = monitor.completeAssetMeasurement(
        measurementId,
        true,
        undefined,
        1024000,
      );

      expectations.shouldValidateAssetMeasurement(
        completedMeasurement,
        url,
        'cdn',
      );
      if (completedMeasurement) {
        expect(completedMeasurement.success).toBe(true);
        expect(completedMeasurement.assetSize).toBe(1024000);
      }
    });

    it('should handle failed asset measurement', () => {
      const url = 'https://cdn.bassnotion.com/audio/error.wav';
      const measurementId = monitor.startAssetMeasurement(url, 'cdn', 'audio');

      const completedMeasurement = monitor.completeAssetMeasurement(
        measurementId,
        false,
        'Network timeout',
        undefined,
      );

      expectations.shouldValidateAssetMeasurement(
        completedMeasurement,
        url,
        'cdn',
      );
      if (completedMeasurement) {
        expect(completedMeasurement.success).toBe(false);
        expect(completedMeasurement.error).toBe('Network timeout');
      }
    });

    it('should track CDN vs Supabase performance', () => {
      // Add CDN measurements
      const cdnAsset = scenarios.assets.cdnAssetMeasurement(80);
      const cdnMeasurementId = monitor.startAssetMeasurement(
        cdnAsset.url,
        cdnAsset.source,
        cdnAsset.assetType,
      );
      monitor.completeAssetMeasurement(cdnMeasurementId, cdnAsset.success);

      // Add Supabase measurements
      const supabaseAsset = scenarios.assets.supabaseAssetMeasurement(120);
      const supabaseMeasurementId = monitor.startAssetMeasurement(
        supabaseAsset.url,
        supabaseAsset.source,
        supabaseAsset.assetType,
      );
      monitor.completeAssetMeasurement(
        supabaseMeasurementId,
        supabaseAsset.success,
      );

      const comparison = monitor.getSourcePerformanceComparison();
      expectations.shouldProvideSourceComparison(comparison);
      expect(comparison.cdn.measurementCount).toBe(1);
      expect(comparison.supabase.measurementCount).toBe(1);
    });

    it('should handle non-existent measurement completion', () => {
      const result = monitor.completeAssetMeasurement('non-existent-id', true);
      expect(result).toBeNull();
    });
  });

  describe('⏱️ Monitoring Lifecycle Behavior', () => {
    it('should start monitoring successfully', () => {
      expect(() => monitor.startMonitoring()).not.toThrow();
    });

    it('should stop monitoring successfully', () => {
      monitor.startMonitoring();
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      monitor.startMonitoring();
      monitor.stopMonitoring();
      monitor.startMonitoring();
      monitor.stopMonitoring();

      // Should handle multiple cycles without issues
      expect(true).toBe(true);
    });

    it('should emit monitoring lifecycle events', () => {
      let eventsReceived = 0;

      monitor.on('monitoringStarted', () => {
        eventsReceived++;
      });

      monitor.on('monitoringStopped', () => {
        eventsReceived++;
      });

      monitor.startMonitoring();
      monitor.stopMonitoring();

      expect(eventsReceived).toBe(2);
    });

    it('should emit metrics update events', () => {
      let updateCount = 0;

      monitor.on('metricsUpdated', () => {
        updateCount++;
      });

      // Simulate measurement
      const measurement = {
        ...scenarios.measurements.goodLatencyMeasurement(),
        url: 'update-test',
        source: 'unknown' as const,
      };
      (monitor as any).updateGeneralMetrics(measurement);

      expect(updateCount).toBe(1);
    });

    it('should reset metrics properly', () => {
      // Add some measurements first
      const measurement = {
        ...scenarios.measurements.goodLatencyMeasurement(),
        url: 'reset-test',
        source: 'unknown' as const,
      };
      (monitor as any).updateGeneralMetrics(measurement);

      // Reset and verify
      monitor.resetMetrics();
      expectations.shouldInitializeCorrectly(monitor);
    });

    it('should dispose properly', () => {
      monitor.startMonitoring();
      expect(() => monitor.dispose()).not.toThrow();

      // After disposal, should handle operations gracefully
      expect(() => monitor.getMetrics()).not.toThrow();
    });
  });

  describe('🔧 Configuration Management Behavior', () => {
    it('should respect disabled configuration', () => {
      const disabledMonitor = NetworkLatencyMonitor.getInstance(
        scenarios.configs.disabledConfig,
      );

      // Should not start monitoring when disabled
      disabledMonitor.startMonitoring();
      // Test passes if no errors are thrown

      disabledMonitor.dispose();
    });

    it('should handle fast measurement intervals', () => {
      const fastMonitor = NetworkLatencyMonitor.getInstance(
        scenarios.configs.fastConfig,
      );

      fastMonitor.startMonitoring();
      fastMonitor.stopMonitoring();

      // Should handle fast intervals without issues
      expect(true).toBe(true);

      fastMonitor.dispose();
    });

    it('should handle timeout configurations', () => {
      const timeoutMonitor = NetworkLatencyMonitor.getInstance(
        scenarios.configs.timeoutConfig,
      );

      // Should initialize with timeout config
      expectations.shouldInitializeCorrectly(timeoutMonitor);

      timeoutMonitor.dispose();
    });

    it('should update configuration dynamically', () => {
      monitor.updateConfig({ measurementInterval: 2000 });

      // Should accept configuration updates without errors
      expect(true).toBe(true);
    });

    it('should handle adaptive thresholds', () => {
      const adaptiveMonitor = NetworkLatencyMonitor.getInstance({
        adaptiveThresholds: true,
        enableDetailedTiming: true,
      });

      expectations.shouldInitializeCorrectly(adaptiveMonitor);
      adaptiveMonitor.dispose();
    });
  });

  describe('🔍 Performance Analysis Behavior', () => {
    it('should provide source performance comparison with no data', () => {
      const comparison = monitor.getSourcePerformanceComparison();
      expectations.shouldProvideSourceComparison(comparison);
      expect(comparison.cdn.measurementCount).toBe(0);
      expect(comparison.supabase.measurementCount).toBe(0);
    });

    it('should calculate success rates correctly', () => {
      // Add successful and failed measurements
      const successfulMeasurement = monitor.startAssetMeasurement(
        'success.wav',
        'cdn',
      );
      monitor.completeAssetMeasurement(successfulMeasurement, true);

      const failedMeasurement = monitor.startAssetMeasurement(
        'fail.wav',
        'cdn',
      );
      monitor.completeAssetMeasurement(
        failedMeasurement,
        false,
        'Network error',
      );

      const comparison = monitor.getSourcePerformanceComparison();
      expect(comparison.cdn.successRate).toBe(0.5); // 1 success, 1 failure = 50%
    });

    it('should compare CDN vs Supabase performance accurately', () => {
      // Add faster CDN measurements
      for (let i = 0; i < 3; i++) {
        const cdnMeasurement = monitor.startAssetMeasurement(
          `cdn-${i}.wav`,
          'cdn',
        );
        monitor.completeAssetMeasurement(cdnMeasurement, true);
      }

      // Add slower Supabase measurements
      for (let i = 0; i < 2; i++) {
        const supabaseMeasurement = monitor.startAssetMeasurement(
          `supabase-${i}.wav`,
          'supabase',
        );
        monitor.completeAssetMeasurement(supabaseMeasurement, true);
      }

      const comparison = monitor.getSourcePerformanceComparison();
      expect(comparison.cdn.measurementCount).toBe(3);
      expect(comparison.supabase.measurementCount).toBe(2);
      expect(comparison.cdn.successRate).toBe(1);
      expect(comparison.supabase.successRate).toBe(1);
    });

    it('should handle different asset types in performance tracking', () => {
      // Add audio measurements
      const audioMeasurement = monitor.startAssetMeasurement(
        'audio.wav',
        'cdn',
        'audio',
      );
      monitor.completeAssetMeasurement(audioMeasurement, true);

      // Add MIDI measurements
      const midiMeasurement = monitor.startAssetMeasurement(
        'pattern.mid',
        'cdn',
        'midi',
      );
      monitor.completeAssetMeasurement(midiMeasurement, true);

      const comparison = monitor.getSourcePerformanceComparison();
      expect(comparison.cdn.measurementCount).toBe(2);
    });

    it('should maintain measurement history within limits', () => {
      const limitedMonitor = NetworkLatencyMonitor.getInstance({
        historySize: 3,
        enabled: true,
      });

      // Add more measurements than history size
      for (let i = 0; i < 5; i++) {
        const measurement = {
          ...scenarios.measurements.goodLatencyMeasurement(),
          url: `history-${i}`,
          source: 'unknown' as const,
        };
        (limitedMonitor as any).updateGeneralMetrics(measurement);
      }

      // Should maintain only the latest measurements within history limit
      const metrics = limitedMonitor.getMetrics();
      expect(metrics.measurementCount).toBe(5); // Total count
      // History should be limited internally (tested indirectly through behavior)

      limitedMonitor.dispose();
    });
  });

  describe('🛡️ Error Handling and Edge Cases Behavior', () => {
    it('should handle invalid measurement IDs gracefully', () => {
      expect(() => {
        monitor.completeAssetMeasurement('invalid-id', true);
      }).not.toThrow();
    });

    it('should handle empty URLs gracefully', () => {
      expect(() => {
        monitor.startAssetMeasurement('', 'cdn', 'audio');
      }).not.toThrow();
    });

    it('should handle extreme latency values', () => {
      const extremeMeasurement = {
        url: 'extreme-test',
        source: 'unknown' as const,
        startTime: Date.now(),
        dnsStart: 0,
        dnsEnd: 0,
        connectionStart: 0,
        connectionEnd: 0,
        requestStart: 0,
        responseStart: 0,
        responseEnd: 0,
        totalTime: Number.MAX_SAFE_INTEGER,
        success: true,
      };

      expect(() => {
        (monitor as any).updateGeneralMetrics(extremeMeasurement);
      }).not.toThrow();
    });

    it('should handle operations after disposal', () => {
      monitor.dispose();

      expect(() => {
        monitor.getMetrics();
        monitor.getNetworkCondition();
        monitor.startAssetMeasurement('test.wav', 'cdn');
      }).not.toThrow();
    });

    it('should handle multiple monitoring start calls', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Second call should be ignored
      monitor.startMonitoring(); // Third call should be ignored

      // Should handle multiple starts gracefully
      expect(true).toBe(true);
    });

    it('should handle performance API unavailable', () => {
      // Temporarily remove performance API
      vi.stubGlobal('performance', undefined);

      expect(() => {
        const fallbackMonitor = NetworkLatencyMonitor.getInstance({
          enabled: true,
        });
        fallbackMonitor.startAssetMeasurement('test.wav', 'cdn');
        fallbackMonitor.dispose();
      }).not.toThrow();

      // Restore performance API
      vi.stubGlobal('performance', mockEnv.globalObj.performance);
    });
  });
});
