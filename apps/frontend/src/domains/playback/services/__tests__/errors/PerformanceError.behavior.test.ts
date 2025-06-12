/**
 * PerformanceError Behavioral Tests
 * Tests for performance threshold violations and NFR compliance monitoring
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  PerformanceError,
  PerformanceErrorCode,
  createPerformanceError,
} from '../../errors/PerformanceError.js';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
} from '../../errors/base.js';

describe('PerformanceError Behavioral Tests', () => {
  // ================================
  // Error Creation Behaviors
  // ================================
  describe('Error Creation Behaviors', () => {
    it('should create performance errors with correct properties', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Audio latency exceeded 50ms threshold',
      );

      expect(error.name).toBe('PerformanceError');
      expect(error.code).toBe(PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED);
      expect(error.category).toBe(ErrorCategory.PERFORMANCE);
      expect(error.message).toBe('Audio latency exceeded 50ms threshold');
    });

    it('should include appropriate recovery actions for performance issues', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        'CPU usage exceeded acceptable threshold',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(1);
      expect(recoveryActions[0]!.type).toBe('degrade');
      expect(recoveryActions[0]!.automatic).toBe(true);
    });

    it('should extract performance metrics from context', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 75,
          cpuUsage: 85,
          memoryUsage: 400,
          responseTime: 250,
          batteryDrain: 8,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Latency threshold exceeded',
        context,
      );

      expect(error.performanceMetrics).toBeDefined();
      expect(error.performanceMetrics?.latency).toBe(75);
      expect(error.measuredValue).toBe(75);
      expect(error.threshold).toBe(50);
    });
  });

  // ================================
  // NFR Compliance Behaviors
  // ================================
  describe('NFR Compliance Behaviors', () => {
    it('should handle NFR-PO-15 latency violations correctly', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 75, // Exceeds 50ms threshold
          cpuUsage: 45,
          memoryUsage: 200,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'NFR-PO-15 violation: Latency exceeded 50ms',
        context,
      );

      expect(error.nfrViolation).toBeDefined();
      expect(error.nfrViolation?.requirement).toBe('NFR-PO-15');
      expect(error.nfrViolation?.threshold).toBe(50);
      expect(error.nfrViolation?.measured).toBe(75);
      expect(error.nfrViolation?.severity).toBe('warning');
    });

    it('should handle NFR-PF-04 response time violations', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          responseTime: 450, // Exceeds 200ms threshold, triggers violation
          latency: 30,
          cpuUsage: 50,
          memoryUsage: 180,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.RESPONSE_TIME_EXCEEDED,
        'NFR-PF-04 violation: Response time exceeded 200ms',
        context,
      );

      expect(error.nfrViolation).toBeDefined();
      expect(error.nfrViolation?.requirement).toBe('NFR-PF-04');
      expect(error.nfrViolation?.threshold).toBe(200);
      expect(error.nfrViolation?.measured).toBe(450);
      expect(error.nfrViolation?.severity).toBe('violation'); // >400ms = violation
    });

    it('should handle NFR-PO-16 battery drain violations', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          batteryDrain: 12, // Exceeds 5% per hour threshold
          latency: 25,
          cpuUsage: 35,
          memoryUsage: 150,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED,
        'NFR-PO-16 violation: Battery drain exceeded 5% per hour',
        context,
      );

      expect(error.nfrViolation).toBeDefined();
      expect(error.nfrViolation?.requirement).toBe('NFR-PO-16');
      expect(error.nfrViolation?.threshold).toBe(5);
      expect(error.nfrViolation?.measured).toBe(12);
      expect(error.nfrViolation?.severity).toBe('violation'); // >10% = violation
    });

    it('should differentiate between warnings and violations', () => {
      const warningContext: Partial<ErrorContext> = {
        performanceMetrics: { latency: 75 }, // Warning level
      };

      const violationContext: Partial<ErrorContext> = {
        performanceMetrics: { latency: 150 }, // Violation level
      };

      const warningError = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Warning level latency',
        warningContext,
      );

      const violationError = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Violation level latency',
        violationContext,
      );

      expect(warningError.nfrViolation?.severity).toBe('warning');
      expect(violationError.nfrViolation?.severity).toBe('violation');
    });
  });

  // ================================
  // Performance Monitoring Behaviors
  // ================================
  describe('Performance Monitoring Behaviors', () => {
    it('should handle audio performance issues', () => {
      const audioErrorCodes = [
        PerformanceErrorCode.AUDIO_DROPOUTS_DETECTED,
        PerformanceErrorCode.BUFFER_UNDERRUN,
        PerformanceErrorCode.SAMPLE_RATE_MISMATCH,
      ];

      audioErrorCodes.forEach((code) => {
        const error = new PerformanceError(code, `Audio issue: ${code}`);
        expect(error.category).toBe(ErrorCategory.PERFORMANCE);
        expect(error.code).toBe(code);
      });
    });

    it('should handle system performance issues', () => {
      const systemErrorCodes = [
        PerformanceErrorCode.CPU_USAGE_HIGH,
        PerformanceErrorCode.MEMORY_USAGE_HIGH,
        PerformanceErrorCode.MEMORY_LEAK_DETECTED,
      ];

      systemErrorCodes.forEach((code) => {
        const error = new PerformanceError(code, `System issue: ${code}`);
        expect(error.category).toBe(ErrorCategory.PERFORMANCE);
        expect(error.code).toBe(code);
      });
    });

    it('should handle network performance issues', () => {
      const networkErrorCodes = [
        PerformanceErrorCode.NETWORK_LATENCY_HIGH,
        PerformanceErrorCode.ASSET_LOADING_SLOW,
        PerformanceErrorCode.CDN_CACHE_MISS,
      ];

      networkErrorCodes.forEach((code) => {
        const error = new PerformanceError(code, `Network issue: ${code}`);
        expect(error.category).toBe(ErrorCategory.PERFORMANCE);
        expect(error.code).toBe(code);
      });
    });

    it('should handle monitoring system failures', () => {
      const monitoringErrorCodes = [
        PerformanceErrorCode.METRICS_COLLECTION_FAILED,
        PerformanceErrorCode.PERFORMANCE_MONITOR_FAILED,
      ];

      monitoringErrorCodes.forEach((code) => {
        const error = new PerformanceError(code, `Monitoring issue: ${code}`);
        expect(error.category).toBe(ErrorCategory.PERFORMANCE);
        expect(error.code).toBe(code);
      });
    });
  });

  // ================================
  // Recovery Strategy Behaviors
  // ================================
  describe('Recovery Strategy Behaviors', () => {
    it('should provide latency-specific recovery strategies', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Latency exceeded threshold',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(2);

      expect(recoveryActions[0]!.type).toBe('degrade');
      expect(recoveryActions[0]!.description).toBe(
        'Increase buffer size to reduce latency spikes',
      );
      expect(recoveryActions[0]!.priority).toBe(9);
      expect(recoveryActions[0]!.estimatedTime).toBe(1000);

      expect(recoveryActions[1]!.description).toBe(
        'Reduce polyphony to lower processing load',
      );
      expect(recoveryActions[1]!.priority).toBe(8);
    });

    it('should provide CPU-specific recovery strategies', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        'CPU usage too high',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(2);

      expect(recoveryActions[0]!.description).toBe(
        'Reduce audio quality to lower CPU usage',
      );
      expect(recoveryActions[0]!.priority).toBe(8);

      expect(recoveryActions[1]!.description).toBe(
        'Disable non-essential audio effects',
      );
      expect(recoveryActions[1]!.priority).toBe(7);
    });

    it('should provide memory-specific recovery strategies', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.MEMORY_USAGE_HIGH,
        'Memory usage excessive',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(2);

      expect(recoveryActions[0]!.description).toBe('Clear audio buffer cache');
      expect(recoveryActions[0]!.priority).toBe(9);
      expect(recoveryActions[0]!.estimatedTime).toBe(500);

      expect(recoveryActions[1]!.description).toBe('Reduce sample rate');
      expect(recoveryActions[1]!.priority).toBe(6);
    });

    it('should provide battery-specific recovery strategies', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED,
        'Battery drain too high',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(1);

      expect(recoveryActions[0]!.description).toBe('Enable battery saver mode');
      expect(recoveryActions[0]!.priority).toBe(8);
    });

    it('should provide generic recovery for monitoring issues', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.METRICS_COLLECTION_FAILED,
        'Metrics collection failed',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions.length).toBeGreaterThanOrEqual(1);

      expect(recoveryActions[0]!.type).toBe('retry');
      expect(recoveryActions[0]!.description).toBe(
        'Restart performance monitoring',
      );
      expect(recoveryActions[0]!.priority).toBe(5);
      expect(recoveryActions[0]!.estimatedTime).toBe(1000);
    });
  });

  // ================================
  // Severity Assessment Behaviors
  // ================================
  describe('Severity Assessment Behaviors', () => {
    it('should assign critical severity for severe performance violations', () => {
      const criticalContext: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 200, // Very high latency
          cpuUsage: 95,
          memoryUsage: 950,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Critical performance degradation',
        criticalContext,
      );

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should assign high severity for moderate violations', () => {
      const moderateContext: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 75,
          cpuUsage: 70,
          memoryUsage: 400,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        'Moderate performance issue',
        moderateContext,
      );

      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should assign medium severity for minor violations', () => {
      const minorContext: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 55, // Slightly over threshold
          cpuUsage: 45,
          memoryUsage: 150,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Minor performance issue',
        minorContext,
      );

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  // ================================
  // Context Preservation Behaviors
  // ================================
  describe('Context Preservation Behaviors', () => {
    it('should preserve performance context with device information', () => {
      const performanceContext: Partial<ErrorContext> = {
        currentOperation: 'Audio processing with effects',
        engineState: 'processing',
        audioContextState: 'running',
        deviceInfo: {
          platform: 'chrome',
          isMobile: false,
          hasLowLatencySupport: true,
          browserVersion: '91.0',
        },
        performanceMetrics: {
          latency: 80,
          cpuUsage: 75,
          memoryUsage: 300,
          responseTime: 150,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        'High CPU usage during processing',
        performanceContext,
      );

      expect(error.context.currentOperation).toBe(
        'Audio processing with effects',
      );
      expect(error.context.deviceInfo?.platform).toBe('chrome');
      expect(error.performanceMetrics?.cpuUsage).toBe(75);
    });

    it('should handle missing performance metrics gracefully', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.AUDIO_DROPOUTS_DETECTED,
        'Audio dropouts without metrics',
      );

      expect(error.performanceMetrics).toBeUndefined();
      expect(error.threshold).toBeUndefined();
      expect(error.measuredValue).toBeUndefined();
      expect(error.nfrViolation).toBeUndefined();
    });

    it('should handle partial performance metrics', () => {
      const partialContext: Partial<ErrorContext> = {
        performanceMetrics: {
          cpuUsage: 85,
          // Missing other metrics
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.CPU_USAGE_HIGH,
        'Partial metrics test',
        partialContext,
      );

      expect(error.performanceMetrics?.cpuUsage).toBe(85);
      expect(error.performanceMetrics?.latency).toBeUndefined();
    });
  });

  // ================================
  // Error Chaining Behaviors
  // ================================
  describe('Error Chaining Behaviors', () => {
    it('should handle error chaining with performance-specific causes', () => {
      const performanceError = new Error('System resource exhausted');

      const error = new PerformanceError(
        PerformanceErrorCode.MEMORY_USAGE_HIGH,
        'Memory exhaustion detected',
        {
          performanceMetrics: {
            memoryUsage: 850,
            cpuUsage: 90,
            latency: 120,
          },
        },
        performanceError,
      );

      expect(error.cause).toBe(performanceError);
      expect(error.message).toBe('Memory exhaustion detected');
      expect(error.performanceMetrics?.memoryUsage).toBe(850);
    });

    it('should maintain error chain information for NFR violations', () => {
      const timeoutError = new Error('Operation timed out');

      const error = new PerformanceError(
        PerformanceErrorCode.RESPONSE_TIME_EXCEEDED,
        'Response time exceeded due to timeout',
        {
          performanceMetrics: {
            responseTime: 350,
            latency: 50,
            cpuUsage: 60,
            memoryUsage: 200,
          },
        },
        timeoutError,
      );

      expect(error.cause).toBe(timeoutError);
      expect(error.nfrViolation?.requirement).toBe('NFR-PF-04');
      expect(error.nfrViolation?.measured).toBe(350);
    });
  });

  // ================================
  // Factory Function Behaviors
  // ================================
  describe('Factory Function Behaviors', () => {
    it('should create performance errors using factory function', () => {
      const error = createPerformanceError(
        PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED,
        'Factory-created battery performance error',
        {
          performanceMetrics: {
            batteryDrain: 8,
            cpuUsage: 40,
            memoryUsage: 180,
          },
        },
      );

      expect(error).toBeInstanceOf(PerformanceError);
      expect(error.code).toBe(PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED);
      expect(error.performanceMetrics?.batteryDrain).toBe(8);
      expect(error.nfrViolation?.requirement).toBe('NFR-PO-16');
    });

    it('should handle factory function with error chaining', () => {
      const originalError = new Error('Performance monitor crashed');

      const error = createPerformanceError(
        PerformanceErrorCode.PERFORMANCE_MONITOR_FAILED,
        'Performance monitoring system failed',
        {
          currentOperation: 'Performance monitoring',
        },
        originalError,
      );

      expect(error.cause).toBe(originalError);
      expect(error.context.currentOperation).toBe('Performance management');
    });

    it('should apply factory function context correctly', () => {
      const error = createPerformanceError(
        PerformanceErrorCode.SAMPLE_RATE_MISMATCH,
        'Factory context test',
        {
          audioContextState: 'suspended',
          deviceInfo: {
            platform: 'safari',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '14.0',
          },
        },
      );

      expect(error.context.currentOperation).toBe('Performance management');
      expect(error.context.audioContextState).toBe('suspended');
      expect(error.context.deviceInfo?.platform).toBe('safari');
    });
  });

  // ================================
  // User Message Behaviors
  // ================================
  describe('User Message Behaviors', () => {
    it('should provide user-friendly messages for performance issues', () => {
      const testCases = [
        {
          code: PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
          expectedMessage:
            'Audio latency is higher than optimal. Performance may be affected.',
        },
        {
          code: PerformanceErrorCode.CPU_USAGE_HIGH,
          expectedMessage:
            'System is under heavy load. Audio quality may be reduced.',
        },
        {
          code: PerformanceErrorCode.MEMORY_USAGE_HIGH,
          expectedMessage:
            'Memory usage is high. Please close other applications.',
        },
        {
          code: PerformanceErrorCode.BATTERY_DRAIN_EXCEEDED,
          expectedMessage:
            'High battery usage detected. Enabling power saving mode.',
        },
      ];

      testCases.forEach(({ code, expectedMessage }) => {
        const error = new PerformanceError(code, 'Test message');
        expect(error.getUserMessage()).toBe(expectedMessage);
      });
    });

    it('should provide technical messages with error codes', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.BUFFER_UNDERRUN,
        'Audio buffer underrun detected during playback',
      );

      expect(error.getTechnicalMessage()).toBe(
        'PERF_BUFFER_UNDERRUN: Audio buffer underrun detected during playback',
      );
    });

    it('should provide documentation URLs for performance issues', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Latency exceeded acceptable threshold',
      );

      expect(error.documentationUrl).toBe('/docs/troubleshooting/performance');
    });
  });

  // ================================
  // Serialization and Metadata Behaviors
  // ================================
  describe('Serialization and Metadata Behaviors', () => {
    it('should serialize performance errors with all metadata', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          latency: 85,
          cpuUsage: 70,
          memoryUsage: 350,
          responseTime: 180,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
        'Performance error serialization test',
        context,
      );

      const serialized = JSON.parse(JSON.stringify(error));

      expect(serialized.name).toBe('PerformanceError');
      expect(serialized.code).toBe(
        PerformanceErrorCode.LATENCY_THRESHOLD_EXCEEDED,
      );
      expect(serialized.category).toBe(ErrorCategory.PERFORMANCE);
      expect(serialized.performanceMetrics?.latency).toBe(85);
      expect(serialized.threshold).toBe(50);
      expect(serialized.measuredValue).toBe(85);
    });

    it('should maintain timestamp consistency', () => {
      const error = new PerformanceError(
        PerformanceErrorCode.METRICS_COLLECTION_FAILED,
        'Timestamp test',
      );

      expect(error.timestamp).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should serialize NFR violation information', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          responseTime: 450,
          latency: 40,
          cpuUsage: 55,
          memoryUsage: 200,
        },
      };

      const error = new PerformanceError(
        PerformanceErrorCode.RESPONSE_TIME_EXCEEDED,
        'NFR violation serialization test',
        context,
      );

      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.nfrViolation?.requirement).toBe('NFR-PF-04');
      expect(serialized.nfrViolation?.threshold).toBe(200);
      expect(serialized.nfrViolation?.measured).toBe(450);
      expect(serialized.nfrViolation?.severity).toBe('violation');
    });
  });
});
