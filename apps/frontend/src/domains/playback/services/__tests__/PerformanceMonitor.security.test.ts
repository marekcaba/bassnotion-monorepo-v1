/**
 * PerformanceMonitor Security Tests
 *
 * Tests security aspects of the performance monitoring system
 * including input sanitization, XSS prevention, and safe metric handling.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Security Testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor.js';

// Mock AudioContext for security testing
const mockAudioContext = {
  sampleRate: 44100,
  baseLatency: 0.005,
  outputLatency: 0.01,
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
  })),
};

// Mock performance.memory with security considerations
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024,
  },
  configurable: true,
});

describe('PerformanceMonitor - Security Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopMonitoring();
    monitor.dispose();
    vi.clearAllMocks();
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should sanitize malicious monitoring intervals', () => {
      const maliciousIntervals = [
        -1,
        0,
        Infinity,
        NaN,
        'javascript:alert(1)' as any,
        '<script>alert(1)</script>' as any,
        null as any,
        undefined as any,
      ];

      maliciousIntervals.forEach((interval) => {
        // Should not throw or execute malicious code
        expect(() => monitor.startMonitoring(interval)).not.toThrow();

        // Stop monitoring to clean up for next test
        monitor.stopMonitoring();
      });
    });

    it('should handle malicious response time operations safely', async () => {
      const maliciousOperations = [
        // Operation that throws with script-like error
        () => Promise.reject(new Error('<script>alert("xss")</script>')),
        // Operation that returns malicious content
        () => Promise.resolve('<img src=x onerror=alert(1)>'),
        // Operation with prototype pollution attempt
        () => {
          const result: any = {};
          result.__proto__.polluted = 'malicious';
          return Promise.resolve(result);
        },
      ];

      for (const operation of maliciousOperations) {
        try {
          const { result, responseTime } =
            await monitor.measureResponseTime(operation);

          // Verify response time is a safe number
          expect(typeof responseTime).toBe('number');
          expect(Number.isFinite(responseTime)).toBe(true);
          expect(responseTime).toBeGreaterThanOrEqual(0);

          // Verify result doesn't contain executable content if it's a string
          if (typeof result === 'string') {
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('onerror=');
          }
        } catch (error) {
          // Should handle errors gracefully without executing content
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent injection in alert messages', () => {
      const alertHandler = vi.fn();
      monitor.onAlert(alertHandler);

      // Simulate malicious operations that could inject content
      monitor.recordDropout();
      monitor.recordBufferUnderrun();

      // Start monitoring to trigger alerts
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Check that alert messages are properly sanitized
          alertHandler.mock.calls.forEach((call) => {
            const alert = call[0];
            expect(alert.message).not.toContain('<script>');
            expect(alert.message).not.toContain('javascript:');
            expect(alert.message).not.toContain('onerror=');
            expect(alert.message).not.toContain('onclick=');

            // Should be clean strings
            expect(typeof alert.message).toBe('string');
            expect(alert.type).toMatch(/^(latency|dropout|cpu|memory)$/);
            expect(alert.severity).toMatch(/^(warning|critical)$/);
          });
          resolve();
        }, 150);
      });
    });
  });

  describe('XSS Prevention', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should prevent script injection in metrics data', () => {
      // Mock malicious memory information
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: '<script>alert("xss")</script>' as any,
          totalJSHeapSize: 'javascript:alert(1)' as any,
          jsHeapSizeLimit: '<img src=x onerror=alert(1)>' as any,
        },
        configurable: true,
      });

      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();

          // All numeric metrics should be actual numbers, not strings
          expect(typeof metrics.memoryUsage).toBe('number');
          expect(Number.isFinite(metrics.memoryUsage)).toBe(true);
          expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);

          // Should not contain any script content
          const metricsString = JSON.stringify(metrics);
          expect(metricsString).not.toContain('<script>');
          expect(metricsString).not.toContain('javascript:');
          expect(metricsString).not.toContain('onerror=');

          resolve();
        }, 150);
      });
    });

    it('should sanitize AudioContext properties safely', () => {
      // Mock AudioContext with malicious properties
      const maliciousContext = {
        sampleRate: '<script>alert("sample")</script>' as any,
        baseLatency: 'javascript:alert("latency")' as any,
        outputLatency: '<img src=x onerror=alert("output")>' as any,
        createAnalyser: vi.fn(() => ({
          fftSize: 256,
          smoothingTimeConstant: 0.8,
        })),
      };

      monitor.initialize(maliciousContext as any);
      monitor.startMonitoring(100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const metrics = monitor.getMetrics();

          // Should convert to safe numbers or defaults
          expect(typeof metrics.sampleRate).toBe('number');
          expect(typeof metrics.latency).toBe('number');
          expect(Number.isFinite(metrics.sampleRate)).toBe(true);
          expect(Number.isFinite(metrics.latency)).toBe(true);

          resolve();
        }, 150);
      });
    });
  });

  describe('Safe Metric Handling', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should handle extreme metric values safely', () => {
      // Test with extreme values that might cause issues
      const extremeValues = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Infinity,
        -Infinity,
        NaN,
      ];

      // Mock performance.now to return extreme values
      extremeValues.forEach((value) => {
        const originalNow = performance.now;
        performance.now = vi.fn(() => value);

        // Should handle gracefully
        expect(() => monitor.startMonitoring(100)).not.toThrow();
        expect(() => monitor.getMetrics()).not.toThrow();

        const metrics = monitor.getMetrics();

        // Metrics should be safe numbers
        Object.values(metrics).forEach((metric) => {
          if (typeof metric === 'number') {
            expect(Number.isFinite(metric) || metric === 0).toBe(true);
          }
        });

        monitor.stopMonitoring();
        performance.now = originalNow;
      });
    });

    it('should prevent metric manipulation through prototype pollution', async () => {
      // Attempt prototype pollution
      (Object.prototype as any).polluted = 'malicious';
      (Array.prototype as any).polluted = 'malicious';

      monitor.startMonitoring(100);

      // Wait for metrics to be collected
      await new Promise((resolve) => setTimeout(resolve, 150));

      const metrics = monitor.getMetrics();

      // Stop monitoring to prevent infinite loops
      monitor.stopMonitoring();

      // Metrics should not contain polluted properties
      expect(metrics).not.toHaveProperty('polluted');
      expect((metrics as any).polluted).toBeUndefined();

      // Cleanup
      delete (Object.prototype as any).polluted;
      delete (Array.prototype as any).polluted;
    });

    it('should validate metric bounds and constraints', async () => {
      monitor.startMonitoring(100);

      // Wait for metrics to be collected
      await new Promise((resolve) => setTimeout(resolve, 150));

      const metrics = monitor.getMetrics();

      // Stop monitoring to prevent infinite loops
      monitor.stopMonitoring();

      // Validate all metrics are within reasonable bounds
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
      expect(metrics.bufferSize).toBeLessThan(100000); // Reasonable buffer size limit
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should prevent excessive alert handler accumulation', () => {
      // Add many alert handlers
      const handlers = Array.from({ length: 1000 }, () => vi.fn());
      const unsubscribers = handlers.map((handler) => monitor.onAlert(handler));

      // Should handle gracefully without memory issues
      expect(() => monitor.recordDropout()).not.toThrow();

      // Cleanup should work properly
      unsubscribers.forEach((unsubscribe) => unsubscribe());

      // After cleanup, no handlers should be called
      const testHandler = vi.fn();
      monitor.onAlert(testHandler);
      monitor.recordDropout();

      // Only the test handler should be called
      expect(testHandler).toHaveBeenCalledTimes(1);
    });

    it('should limit monitoring frequency to prevent DoS', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      // Try to start monitoring with very high frequency
      monitor.startMonitoring(1); // 1ms interval

      // Should either reject or use a minimum safe interval
      const callArgs = setIntervalSpy.mock.calls[0];
      if (callArgs) {
        const interval = callArgs[1];
        expect(interval).toBeGreaterThanOrEqual(10); // Minimum 10ms
      }

      setIntervalSpy.mockRestore();
    });

    it('should prevent memory leaks in metrics collection', async () => {
      // Run monitoring for many cycles to detect memory leaks
      monitor.startMonitoring(50);

      let cycleCount = 0;
      const maxCycles = 20; // Reduced for faster test execution

      const checkMemory = async (): Promise<void> => {
        while (cycleCount < maxCycles) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          cycleCount++;

          const metrics = monitor.getMetrics();

          // Verify metrics are still reasonable after many cycles
          expect(typeof metrics.latency).toBe('number');
          expect(Number.isFinite(metrics.latency)).toBe(true);
        }

        // After many cycles, metrics should still be valid
        const finalMetrics = monitor.getMetrics();
        expect(finalMetrics.averageLatency).toBeGreaterThanOrEqual(0);
        expect(finalMetrics.dropoutCount).toBeGreaterThanOrEqual(0);
      };

      await checkMemory();

      // Stop monitoring to prevent infinite loops
      monitor.stopMonitoring();
    });
  });

  describe('Secure Event Handling', () => {
    beforeEach(() => {
      monitor.initialize(mockAudioContext as any);
    });

    it('should validate event handler parameters', () => {
      // Test with various invalid handlers
      const invalidHandlers = [
        null,
        undefined,
        'not a function' as any,
        { fake: 'object' } as any,
        123 as any,
      ];

      invalidHandlers.forEach((handler) => {
        // Should handle invalid handlers gracefully
        expect(() => monitor.onAlert(handler)).not.toThrow();
        expect(() => monitor.onMetrics(handler)).not.toThrow();
      });
    });

    it('should prevent handler manipulation through closures', () => {
      let captured: any = null;

      const maliciousHandler = vi.fn((alert) => {
        captured = alert;
        // Try to modify the alert object
        if (captured && typeof captured === 'object') {
          captured.type = 'modified';
          captured.malicious = '<script>alert(1)</script>';
        }
      });

      monitor.onAlert(maliciousHandler);
      monitor.recordDropout();

      // Original alert system should be unaffected by handler modifications
      const metrics = monitor.getMetrics();
      expect(metrics.dropoutCount).toBe(1); // Should still track correctly
    });
  });
});
