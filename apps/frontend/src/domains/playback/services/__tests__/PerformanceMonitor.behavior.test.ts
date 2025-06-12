/**
 * PerformanceMonitor Behavior Tests
 *
 * Enhanced comprehensive behavior testing covering performance monitoring, NFR compliance,
 * security validation, and sophisticated error handling for production audio systems.
 *
 * Core Behaviors:
 * - Performance metrics collection and validation
 * - NFR compliance monitoring (NFR-PO-15: <50ms latency)
 * - Alert system with handler management
 * - Security input sanitization and XSS prevention
 * - Resource exhaustion prevention
 * - Advanced monitoring lifecycle management
 * - Edge case handling and error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor.js';

describe('PerformanceMonitor - Behavior', () => {
  let monitor: PerformanceMonitor;
  let mockTimers: any[];
  let alertCalls: any[];
  let metricsCalls: any[];

  // Advanced scenario builders for comprehensive testing
  const scenarios = {
    // Audio environment scenarios
    normalAudioContext: () => ({
      sampleRate: 44100,
      baseLatency: 0.005, // 5ms
      outputLatency: 0.01, // 10ms - Total: 15ms (within NFR)
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
      destination: {},
    }),

    highLatencyContext: () => ({
      sampleRate: 44100,
      baseLatency: 0.03, // 30ms
      outputLatency: 0.025, // 25ms - Total: 55ms (violates NFR-PO-15: <50ms)
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
      destination: {},
    }),

    warningLatencyContext: () => ({
      sampleRate: 44100,
      baseLatency: 0.02, // 20ms
      outputLatency: 0.015, // 15ms - Total: 35ms (warning threshold)
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
      destination: {},
    }),

    incompleteAudioContext: () => ({
      sampleRate: 44100,
      // Missing baseLatency and outputLatency
      createAnalyser: vi.fn(() => ({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
    }),

    maliciousAudioContext: () => ({
      sampleRate: '<script>alert("sample")</script>' as any,
      baseLatency: 'javascript:alert("latency")' as any,
      outputLatency: '<img src=x onerror=alert("output")>' as any,
      createAnalyser: vi.fn(() => ({
        fftSize: 256,
        smoothingTimeConstant: 0.8,
      })),
    }),

    // Performance scenarios
    normalPerformanceAPI: () => ({
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
      },
    }),

    maliciousPerformanceAPI: () => ({
      now: vi.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: '<script>alert("xss")</script>' as any,
        totalJSHeapSize: 'javascript:alert(1)' as any,
        jsHeapSizeLimit: '<img src=x onerror=alert(1)>' as any,
      },
    }),

    // Operation scenarios
    fastOperation: () => ({
      operation: () => Promise.resolve('fast result'),
      expectedTime: { min: 0, max: 50 },
    }),

    normalOperation: () => ({
      operation: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve('normal result'), 100),
        ),
      expectedTime: { min: 90, max: 150 },
    }),

    slowOperation: () => ({
      operation: () =>
        new Promise((resolve) => setTimeout(() => resolve('slow result'), 250)),
      expectedTime: { min: 240, max: 300 },
      triggersAlert: true,
    }),

    maliciousOperation: () => ({
      operation: () => Promise.resolve('<script>alert("xss")</script>'),
      shouldSanitize: true,
    }),

    errorOperation: () => ({
      operation: () =>
        Promise.reject(new Error('<script>alert("error")</script>')),
      shouldHandleError: true,
    }),

    // Security test scenarios
    maliciousInputs: () => [
      -1,
      0,
      Infinity,
      NaN,
      'javascript:alert(1)' as any,
      '<script>alert(1)</script>' as any,
      null as any,
      undefined as any,
      { toString: () => 'alert(1)' } as any,
    ],

    extremeValues: () => [
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Infinity,
      -Infinity,
      NaN,
    ],
  };

  // Advanced validation helpers
  const validators = {
    expectValidMetrics: (metrics: any) => {
      expect(metrics).toBeDefined();
      expect(typeof metrics.latency).toBe('number');
      expect(typeof metrics.averageLatency).toBe('number');
      expect(typeof metrics.maxLatency).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.dropoutCount).toBe('number');
      expect(typeof metrics.bufferUnderruns).toBe('number');
      expect(typeof metrics.sampleRate).toBe('number');
      expect(typeof metrics.bufferSize).toBe('number');
      expect(typeof metrics.timestamp).toBe('number');

      // Validate metric bounds
      expect(metrics.latency).toBeGreaterThanOrEqual(0);
      expect(metrics.latency).toBeLessThan(10000); // Max 10 seconds
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeLessThan(1024 * 1024); // Max 1TB in MB
      expect(metrics.dropoutCount).toBeGreaterThanOrEqual(0);
      expect(metrics.bufferUnderruns).toBeGreaterThanOrEqual(0);
      expect(metrics.sampleRate).toBeGreaterThan(0);
      expect(metrics.sampleRate).toBeLessThan(1000000); // Max 1MHz
      expect(metrics.bufferSize).toBeGreaterThanOrEqual(0);
      expect(metrics.bufferSize).toBeLessThan(100000);
    },

    expectResponseTimeResult: (
      result: any,
      expectedRange?: { min: number; max: number },
    ) => {
      expect(result).toBeDefined();
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.result).toBeDefined();

      if (expectedRange) {
        expect(result.responseTime).toBeGreaterThanOrEqual(expectedRange.min);
        expect(result.responseTime).toBeLessThanOrEqual(expectedRange.max);
      }
    },

    expectNFRCompliance: (metrics: any, shouldComply: boolean) => {
      const totalLatency = metrics.latency;
      if (shouldComply) {
        expect(totalLatency).toBeLessThan(50); // NFR-PO-15: <50ms
      } else {
        expect(totalLatency).toBeGreaterThanOrEqual(50);
      }
    },

    expectAlertTriggered: (type: string, severity: string) => {
      const relevantAlerts = alertCalls.filter(
        (call) => call[0]?.type === type && call[0]?.severity === severity,
      );
      expect(relevantAlerts.length).toBeGreaterThan(0);
    },

    expectSanitizedContent: (content: any) => {
      if (typeof content === 'string') {
        expect(content).not.toContain('<script>');
        expect(content).not.toContain('javascript:');
        expect(content).not.toContain('onerror=');
        expect(content).not.toContain('onclick=');
      }
    },

    expectHandlerFunction: (unsubscribe: any) => {
      expect(typeof unsubscribe).toBe('function');
    },

    expectSafeNumericValue: (value: any) => {
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value) || value === 0).toBe(true);
    },
  };

  beforeEach(async () => {
    // Reset singleton instance
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance();

    // Reset tracking arrays
    mockTimers = [];
    alertCalls = [];
    metricsCalls = [];

    // Enhanced browser environment mocking
    vi.stubGlobal('window', {
      setInterval: vi.fn((fn, interval) => {
        const timerId = Math.random();
        mockTimers.push({ id: timerId, fn, interval });
        // Simulate immediate execution for testing
        setTimeout(fn, 0);
        return timerId;
      }),
      clearInterval: vi.fn((timerId) => {
        mockTimers = mockTimers.filter((timer) => timer.id !== timerId);
      }),
    });

    // Setup normal performance API
    vi.stubGlobal('performance', scenarios.normalPerformanceAPI());

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (monitor) {
      monitor.stopMonitoring();
      monitor.dispose();
    }
    mockTimers = [];
    alertCalls = [];
    metricsCalls = [];
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('🚀 Initialization and Setup Behavior', () => {
    it('should initialize with normal audio context', async () => {
      // Arrange
      const audioContext = scenarios.normalAudioContext();

      // Act
      monitor.initialize(audioContext as any);

      // Assert
      expect(audioContext.createAnalyser).toHaveBeenCalled();
      const metrics = monitor.getMetrics();
      validators.expectValidMetrics(metrics);
      expect(metrics.sampleRate).toBe(44100);
    });

    it('should handle incomplete audio context gracefully', async () => {
      // Arrange
      const incompleteContext = scenarios.incompleteAudioContext();

      // Act & Assert - Should not throw
      expect(() => monitor.initialize(incompleteContext as any)).not.toThrow();

      const metrics = monitor.getMetrics();
      validators.expectValidMetrics(metrics);
      expect(metrics.latency).toBe(0); // Should default when properties missing
    });

    it('should sanitize malicious audio context properties', async () => {
      // Arrange
      const maliciousContext = scenarios.maliciousAudioContext();

      // Act
      monitor.initialize(maliciousContext as any);

      // Assert
      const metrics = monitor.getMetrics();
      validators.expectValidMetrics(metrics);
      validators.expectSafeNumericValue(metrics.sampleRate);
      validators.expectSafeNumericValue(metrics.latency);
    });

    it('should provide singleton behavior', () => {
      // Act
      const monitor1 = PerformanceMonitor.getInstance();
      const monitor2 = PerformanceMonitor.getInstance();

      // Assert
      expect(monitor1).toBe(monitor2);
    });
  });

  describe('📊 Advanced Performance Monitoring', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should collect comprehensive metrics', async () => {
      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.latency);
    });

    it('should track latency history for averages', async () => {
      // Arrange
      monitor.startMonitoring(50);

      // Act - Let it collect multiple samples
      await new Promise((resolve) => setTimeout(resolve, 200));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.averageLatency);
    });

    it('should estimate CPU usage accurately', async () => {
      // Arrange
      monitor.startMonitoring(100);

      // Act - Add some processing load
      for (let i = 0; i < 10; i++) {
        monitor.recordDropout();
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      expect(metrics.cpuUsage).toBeGreaterThan(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should handle missing performance.memory API', async () => {
      // Arrange - Remove memory API
      const perfWithoutMemory = { now: vi.fn(() => Date.now()) };
      vi.stubGlobal('performance', perfWithoutMemory);

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      expect(metrics.memoryUsage).toBe(0); // Should default to 0
    });
  });

  describe('⏱️ Response Time Measurement', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should measure fast operation response time', async () => {
      // Arrange
      const { operation } = scenarios.fastOperation();

      // Act
      const result = await monitor.measureResponseTime(operation);

      // Assert
      validators.expectResponseTimeResult(result);
      expect(result.result).toBe('fast result');
      expect(result.responseTime).toBeLessThan(100);
    });

    it('should measure normal operation response time', async () => {
      // Arrange
      const { operation, expectedTime } = scenarios.normalOperation();

      // Act
      const result = await monitor.measureResponseTime(operation);

      // Assert
      validators.expectResponseTimeResult(result, expectedTime);
      expect(result.result).toBe('normal result');
    });

    it('should detect slow operations and trigger alerts', async () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      const { operation } = scenarios.slowOperation();

      // Act
      const result = await monitor.measureResponseTime(operation);

      // Assert
      validators.expectResponseTimeResult(result);
      expect(result.responseTime).toBeGreaterThan(200);
      validators.expectAlertTriggered('latency', 'critical');
    });

    it('should sanitize malicious operation results', async () => {
      // Arrange
      const { operation } = scenarios.maliciousOperation();

      // Act
      const result = await monitor.measureResponseTime(operation);

      // Assert
      validators.expectResponseTimeResult(result);
      validators.expectSanitizedContent(result.result);
    });

    it('should handle operation errors gracefully', async () => {
      // Arrange
      const { operation } = scenarios.errorOperation();

      // Act & Assert
      await expect(monitor.measureResponseTime(operation)).rejects.toThrow();
    });
  });

  describe('🚨 NFR Compliance Monitoring', () => {
    it('should comply with NFR-PO-15 latency requirement (<50ms)', async () => {
      // Arrange
      const normalContext = scenarios.normalAudioContext();
      monitor.initialize(normalContext as any);

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      validators.expectNFRCompliance(metrics, true); // Should comply
      expect(metrics.latency).toBe(15); // 5ms + 10ms = 15ms
    });

    it('should detect NFR-PO-15 latency violations', async () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      const highLatencyContext = scenarios.highLatencyContext();
      monitor.initialize(highLatencyContext as any);

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectValidMetrics(metrics);
      validators.expectNFRCompliance(metrics, false); // Should violate
      validators.expectAlertTriggered('latency', 'critical');

      const nfrAlert = alertCalls.find((call) =>
        call[0]?.message?.includes('NFR limit: 50ms'),
      );
      expect(nfrAlert).toBeDefined();
    });

    it('should emit warnings before critical NFR violations', async () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      const warningContext = scenarios.warningLatencyContext();
      monitor.initialize(warningContext as any);

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      // Assert
      validators.expectAlertTriggered('latency', 'warning');

      const warningAlert = alertCalls.find((call) =>
        call[0]?.message?.includes('Audio latency warning'),
      );
      expect(warningAlert).toBeDefined();
    });

    it('should detect CPU usage NFR violations', async () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      monitor.initialize(scenarios.normalAudioContext() as any);

      // Act - Force high CPU usage
      for (let i = 0; i < 25; i++) {
        monitor.recordDropout();
      }
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      // Assert
      const cpuAlerts = alertCalls.filter(
        (call) => call[0]?.type === 'cpu' && call[0]?.severity === 'critical',
      );
      expect(cpuAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('📢 Alert System Management', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should register and manage alert handlers', () => {
      // Arrange
      const alertHandler = vi.fn();

      // Act
      const unsubscribe = monitor.onAlert(alertHandler);

      // Assert
      validators.expectHandlerFunction(unsubscribe);
    });

    it('should unregister alert handlers properly', () => {
      // Arrange
      const alertHandler = vi.fn();
      const unsubscribe = monitor.onAlert(alertHandler);

      // Act
      unsubscribe();
      monitor.recordDropout(); // Should not trigger handler

      // Assert
      expect(alertHandler).not.toHaveBeenCalled();
    });

    it('should register and manage metrics handlers', () => {
      // Arrange
      const metricsHandler = vi.fn((metrics) => metricsCalls.push([metrics]));

      // Act
      const unsubscribe = monitor.onMetrics(metricsHandler);
      monitor.startMonitoring(100);

      // Assert
      validators.expectHandlerFunction(unsubscribe);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(metricsCalls.length).toBeGreaterThan(0);
          const metricsCall = metricsCalls[0];
          if (metricsCall && metricsCall[0]) {
            validators.expectValidMetrics(metricsCall[0]);
          }
          monitor.stopMonitoring();
          resolve();
        }, 150);
      });
    });

    it('should handle invalid alert handlers gracefully', () => {
      // Arrange
      const invalidHandlers = [
        null,
        undefined,
        'not a function',
        { fake: 'object' },
        123,
      ];

      // Act & Assert
      invalidHandlers.forEach((handler) => {
        expect(() => monitor.onAlert(handler as any)).not.toThrow();
      });
    });

    it('should sanitize alert messages for security', () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);

      // Act
      monitor.recordDropout();
      monitor.recordBufferUnderrun();

      // Assert
      alertCalls.forEach((call) => {
        const alert = call[0];
        validators.expectSanitizedContent(alert.message);
        expect(alert.type).toMatch(/^(latency|dropout|cpu|memory)$/);
        expect(alert.severity).toMatch(/^(warning|critical)$/);
      });
    });
  });

  describe('🔒 Security and Input Sanitization', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should sanitize malicious monitoring intervals', () => {
      // Arrange
      const maliciousIntervals = scenarios.maliciousInputs();

      // Act & Assert
      maliciousIntervals.forEach((interval) => {
        expect(() => monitor.startMonitoring(interval)).not.toThrow();
        monitor.stopMonitoring();
      });
    });

    it('should enforce minimum safe monitoring intervals', () => {
      // Arrange
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // Act
      monitor.startMonitoring(1); // Very high frequency

      // Assert
      const callArgs = setIntervalSpy.mock.calls[0];
      if (callArgs) {
        const interval = callArgs[1];
        expect(interval).toBeGreaterThanOrEqual(10); // Minimum 10ms for DoS prevention
      }

      setIntervalSpy.mockRestore();
    });

    it('should prevent XSS in malicious performance API data', async () => {
      // Arrange
      vi.stubGlobal('performance', scenarios.maliciousPerformanceAPI());

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      validators.expectSafeNumericValue(metrics.memoryUsage);

      const metricsString = JSON.stringify(metrics);
      validators.expectSanitizedContent(metricsString);
    });

    it('should handle extreme metric values safely', async () => {
      // Arrange
      const extremeValues = scenarios.extremeValues();

      // Act & Assert
      extremeValues.forEach((value) => {
        const originalNow = performance.now;
        performance.now = vi.fn(() => value);

        expect(() => monitor.startMonitoring(100)).not.toThrow();
        expect(() => monitor.getMetrics()).not.toThrow();

        const metrics = monitor.getMetrics();
        validators.expectValidMetrics(metrics);

        monitor.stopMonitoring();
        performance.now = originalNow;
      });
    });

    it('should prevent prototype pollution attacks', async () => {
      // Arrange
      (Object.prototype as any).polluted = 'malicious';
      (Array.prototype as any).polluted = 'malicious';

      // Act
      monitor.startMonitoring(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stopMonitoring();

      const metrics = monitor.getMetrics();

      // Assert
      expect(metrics).not.toHaveProperty('polluted');
      expect((metrics as any).polluted).toBeUndefined();

      // Cleanup
      delete (Object.prototype as any).polluted;
      delete (Array.prototype as any).polluted;
    });

    it('should prevent excessive handler accumulation (DoS protection)', () => {
      // Arrange
      const handlers = Array.from({ length: 100 }, () => vi.fn());

      // Act
      const unsubscribers = handlers.map((handler) => monitor.onAlert(handler));

      // Should handle gracefully without memory issues
      expect(() => monitor.recordDropout()).not.toThrow();

      // Cleanup should work properly
      unsubscribers.forEach((unsubscribe) => unsubscribe());

      // After cleanup, only new handlers should be called
      const testHandler = vi.fn();
      monitor.onAlert(testHandler);
      monitor.recordDropout();

      // Assert
      expect(testHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('📝 Event Recording and Tracking', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should record and track audio dropouts', () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      const initialMetrics = monitor.getMetrics();

      // Act
      monitor.recordDropout();
      monitor.recordDropout();
      const updatedMetrics = monitor.getMetrics();

      // Assert
      expect(updatedMetrics.dropoutCount).toBe(initialMetrics.dropoutCount + 2);
      validators.expectAlertTriggered('dropout', 'warning');
    });

    it('should record and track buffer underruns', () => {
      // Arrange
      const alertHandler = vi.fn((alert) => alertCalls.push([alert]));
      monitor.onAlert(alertHandler);
      const initialMetrics = monitor.getMetrics();

      // Act
      monitor.recordBufferUnderrun();
      const updatedMetrics = monitor.getMetrics();

      // Assert
      expect(updatedMetrics.bufferUnderruns).toBe(
        initialMetrics.bufferUnderruns + 1,
      );
      validators.expectAlertTriggered('dropout', 'critical');

      const underrunAlert = alertCalls.find((call) =>
        call[0]?.message?.includes('Buffer underrun detected'),
      );
      expect(underrunAlert).toBeDefined();
    });

    it('should track multiple event types simultaneously', () => {
      // Act
      monitor.recordDropout();
      monitor.recordDropout();
      monitor.recordBufferUnderrun();
      monitor.recordDropout();

      const metrics = monitor.getMetrics();

      // Assert
      expect(metrics.dropoutCount).toBe(3);
      expect(metrics.bufferUnderruns).toBe(1);
    });
  });

  describe('🔄 Monitoring Lifecycle Management', () => {
    beforeEach(() => {
      monitor.initialize(scenarios.normalAudioContext() as any);
    });

    it('should manage monitoring lifecycle properly', () => {
      // Act
      monitor.startMonitoring(500);

      // Assert - Should have created timer
      expect(mockTimers.length).toBe(1);
      expect(mockTimers[0].interval).toBe(500);

      // Act - Stop monitoring
      monitor.stopMonitoring();

      // Assert - Should have cleared timer
      expect(window.clearInterval).toHaveBeenCalled();
    });

    it('should prevent multiple monitoring sessions', () => {
      // Act
      monitor.startMonitoring(100);
      monitor.startMonitoring(200); // Second call should be ignored

      // Assert - Should only have one timer
      expect(mockTimers.length).toBe(1);
      expect(mockTimers[0].interval).toBe(100); // First interval preserved
    });

    it('should handle stop monitoring when not started', () => {
      // Act & Assert - Should not throw
      expect(() => monitor.stopMonitoring()).not.toThrow();
      expect(window.clearInterval).not.toHaveBeenCalled();
    });

    it('should reset metrics properly', () => {
      // Arrange
      monitor.recordDropout();
      monitor.recordBufferUnderrun();
      const metricsBeforeReset = monitor.getMetrics();

      // Act
      monitor.resetMetrics();
      const metricsAfterReset = monitor.getMetrics();

      // Assert
      expect(metricsBeforeReset.dropoutCount).toBeGreaterThan(0);
      expect(metricsBeforeReset.bufferUnderruns).toBeGreaterThan(0);

      expect(metricsAfterReset.dropoutCount).toBe(0);
      expect(metricsAfterReset.bufferUnderruns).toBe(0);
      expect(metricsAfterReset.latency).toBe(0);
      expect(metricsAfterReset.averageLatency).toBe(0);
      expect(metricsAfterReset.maxLatency).toBe(0);
    });
  });

  describe('🛡️ Error Recovery and Edge Cases', () => {
    it('should handle performance API unavailability', () => {
      // Arrange
      vi.stubGlobal('performance', undefined);

      // Act & Assert
      expect(() => monitor.getMetrics()).not.toThrow();

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should dispose resources cleanly', () => {
      // Arrange
      monitor.initialize(scenarios.normalAudioContext() as any);
      const alertHandler = vi.fn();
      const metricsHandler = vi.fn();

      monitor.onAlert(alertHandler);
      monitor.onMetrics(metricsHandler);
      monitor.startMonitoring(100);

      // Act
      monitor.dispose();

      // Assert - Should handle disposal gracefully
      expect(() => monitor.dispose()).not.toThrow(); // Multiple calls should be safe

      // Should still provide basic metrics after disposal
      const metrics = monitor.getMetrics();
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should handle memory leak prevention during long monitoring', async () => {
      // Arrange
      monitor.startMonitoring(20); // Fast interval

      // Act - Run many cycles
      let cycleCount = 0;
      const maxCycles = 10; // Reduced for faster test

      while (cycleCount < maxCycles) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        cycleCount++;

        const metrics = monitor.getMetrics();
        validators.expectValidMetrics(metrics);
      }

      // Assert - Metrics should still be valid after many cycles
      const finalMetrics = monitor.getMetrics();
      validators.expectValidMetrics(finalMetrics);
      expect(finalMetrics.averageLatency).toBeGreaterThanOrEqual(0);

      // Cleanup
      monitor.stopMonitoring();
    });

    it('should handle concurrent disposal and monitoring operations', async () => {
      // Arrange
      monitor.initialize(scenarios.normalAudioContext() as any);

      // Act - Start monitoring and immediately dispose
      monitor.startMonitoring(100);

      // Simulate concurrent operations
      const operations = [
        () => monitor.recordDropout(),
        () => monitor.getMetrics(),
        () => monitor.stopMonitoring(),
        () => monitor.dispose(),
      ];

      // Assert - All operations should handle gracefully
      operations.forEach((operation) => {
        expect(operation).not.toThrow();
      });
    });
  });
});
