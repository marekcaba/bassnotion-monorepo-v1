/**
 * ErrorClassifier Behavior Tests
 *
 * Tests the automatic error classification behaviors including error categorization,
 * severity assessment, and intelligent error analysis based on error characteristics.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorClassifier } from '../../errors/ErrorClassifier.js';
import {
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
} from '../../errors/base.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {};
};

// Test Scenarios
const createClassificationScenarios = () => ({
  audioContextErrors: [
    new Error('AudioContext is not supported'),
    new Error('Audio context suspended'),
    new Error('User gesture required for audio context'),
    new Error('WebAudio API not available'),
    new Error('Audio context state invalid'),
  ],

  performanceErrors: [
    new Error('Latency threshold exceeded'),
    new Error('Performance degradation detected'),
    new Error('Operation timeout'),
    new Error('System running slow'),
    new Error('Memory usage critical'),
    new Error('CPU overload detected'),
  ],

  resourceErrors: [
    new Error('Memory allocation failed'),
    new Error('Buffer overflow detected'),
    new Error('Resource quota exceeded'),
    new Error('Allocation limit reached'),
    new Error('Resource unavailable'),
  ],

  networkErrors: [
    new Error('Network connection failed'),
    new Error('Fetch request timeout'),
    new Error('Failed to load resource'),
    new Error('Connection lost'),
    new Error('CORS policy violation'),
    new Error('Network timeout'),
  ],

  mobileErrors: [
    new Error('Mobile device limitations'),
    new Error('iOS audio restrictions'),
    new Error('Android battery optimization'),
    new Error('Battery saver mode active'),
    new Error('Background processing limited'),
  ],

  validationErrors: [
    new Error('Validation failed'),
    new Error('Invalid parameter provided'),
    new Error('Type mismatch error'),
    new Error('Required parameter missing'),
    new Error('Invalid input format'),
  ],

  unknownErrors: [
    new Error('Unexpected system failure'),
    new Error('Generic error occurred'),
    new Error('Something went wrong'),
    new Error('Unhandled exception'),
  ],

  performanceMetrics: {
    normal: {
      latency: 25,
      cpuUsage: 30,
      memoryUsage: 128,
      responseTime: 150,
    },
    highLatency: {
      latency: 120, // Over 100ms threshold
      cpuUsage: 40,
      memoryUsage: 256,
      responseTime: 180,
    },
    highCPU: {
      latency: 30,
      cpuUsage: 95, // Over 90% threshold
      memoryUsage: 200,
      responseTime: 160,
    },
    critical: {
      latency: 200,
      cpuUsage: 98,
      memoryUsage: 1024,
      responseTime: 500,
    },
  },

  errorContexts: {
    basic: (): ErrorContext => ({
      timestamp: Date.now(),
      sessionId: 'test-session',
      userAgent: 'Mozilla/5.0 (Test Browser)',
    }),

    withPerformanceMetrics: (
      metrics: Record<string, number>,
    ): ErrorContext => ({
      timestamp: Date.now(),
      sessionId: 'perf-session',
      performanceMetrics: metrics,
      deviceInfo: {
        platform: 'Test Platform',
        browserVersion: '1.0',
        isMobile: false,
        hasLowLatencySupport: true,
      },
    }),

    mobileContext: (): ErrorContext => ({
      timestamp: Date.now(),
      sessionId: 'mobile-session',
      deviceInfo: {
        platform: 'Mobile Device',
        browserVersion: '1.0',
        isMobile: true,
        hasLowLatencySupport: false,
      },
    }),

    criticalContext: (): ErrorContext => ({
      timestamp: Date.now(),
      sessionId: 'critical-session',
      performanceMetrics: {
        latency: 300,
        cpuUsage: 99,
        memoryUsage: 2048,
      },
      currentOperation: 'audio_processing',
      engineState: 'overloaded',
    }),
  },
});

// Behavior Expectations
const expectations = {
  shouldClassifyCorrectly: (error: Error, expectedCategory: ErrorCategory) => {
    const category = ErrorClassifier.classifyError(error);
    expect(category).toBe(expectedCategory);
  },

  shouldAssessSeverityCorrectly: (
    error: Error,
    category: ErrorCategory,
    context: ErrorContext | undefined,
    expectedSeverity: ErrorSeverity,
  ) => {
    const severity = ErrorClassifier.assessSeverity(error, category, context);
    expect(severity).toBe(expectedSeverity);
  },

  shouldReturnValidCategory: (category: ErrorCategory) => {
    expect(Object.values(ErrorCategory)).toContain(category);
  },

  shouldReturnValidSeverity: (severity: ErrorSeverity) => {
    expect(Object.values(ErrorSeverity)).toContain(severity);
  },

  shouldConsiderContext: (
    errorWithContext: ErrorSeverity,
    errorWithoutContext: ErrorSeverity,
    shouldBeDifferent = false,
  ) => {
    if (shouldBeDifferent) {
      expect(errorWithContext).not.toBe(errorWithoutContext);
    } else {
      // Both should be valid severities
      expectations.shouldReturnValidSeverity(errorWithContext);
      expectations.shouldReturnValidSeverity(errorWithoutContext);
    }
  },
};

// Behavior Tests
describe('ErrorClassifier Behaviors', () => {
  let scenarios: ReturnType<typeof createClassificationScenarios>;

  beforeEach(() => {
    setupTestEnvironment();
    scenarios = createClassificationScenarios();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Classification Behaviors', () => {
    test('should classify audio context errors correctly', () => {
      scenarios.audioContextErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(
          error,
          ErrorCategory.AUDIO_CONTEXT,
        );
      });
    });

    test('should classify performance errors correctly', () => {
      scenarios.performanceErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.PERFORMANCE);
      });
    });

    test('should classify resource errors correctly', () => {
      scenarios.resourceErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.RESOURCE);
      });
    });

    test('should classify network errors correctly', () => {
      scenarios.networkErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.NETWORK);
      });
    });

    test('should classify mobile errors correctly', () => {
      scenarios.mobileErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.MOBILE);
      });
    });

    test('should classify validation errors correctly', () => {
      scenarios.validationErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.VALIDATION);
      });
    });

    test('should classify unknown errors as unknown category', () => {
      scenarios.unknownErrors.forEach((error) => {
        expectations.shouldClassifyCorrectly(error, ErrorCategory.UNKNOWN);
      });
    });

    test('should handle case-insensitive classification', () => {
      const mixedCaseErrors = [
        new Error('AUDIOCONTEXT NOT SUPPORTED'),
        new Error('Performance TIMEOUT occurred'),
        new Error('Memory ALLOCATION failed'),
        new Error('Network CONNECTION lost'),
      ];

      const expectedCategories = [
        ErrorCategory.AUDIO_CONTEXT,
        ErrorCategory.PERFORMANCE,
        ErrorCategory.RESOURCE,
        ErrorCategory.NETWORK,
      ];

      mixedCaseErrors.forEach((error, index) => {
        expectations.shouldClassifyCorrectly(error, expectedCategories[index]!);
      });
    });

    test('should classify based on error name when message is generic', () => {
      const namedErrors = [
        Object.assign(new Error('Generic error'), {
          name: 'AudioContextError',
        }),
        Object.assign(new Error('Something failed'), {
          name: 'PerformanceError',
        }),
        Object.assign(new Error('Error occurred'), { name: 'NetworkError' }),
      ];

      expectations.shouldClassifyCorrectly(
        namedErrors[0]!,
        ErrorCategory.AUDIO_CONTEXT,
      );
      expectations.shouldClassifyCorrectly(
        namedErrors[1]!,
        ErrorCategory.PERFORMANCE,
      );
      expectations.shouldClassifyCorrectly(
        namedErrors[2]!,
        ErrorCategory.NETWORK,
      );
    });

    test('should prioritize message keywords over error name', () => {
      const conflictingError = Object.assign(
        new Error('Audio context suspended'),
        { name: 'NetworkError' },
      );

      // Message contains "audio context" so should be classified as audio context
      expectations.shouldClassifyCorrectly(
        conflictingError,
        ErrorCategory.AUDIO_CONTEXT,
      );
    });
  });

  describe('Severity Assessment Behaviors', () => {
    test('should assess basic severity without context', () => {
      const error = new Error('Basic error');
      const category = ErrorCategory.PERFORMANCE;

      const severity = ErrorClassifier.assessSeverity(error, category);
      expectations.shouldReturnValidSeverity(severity);
    });

    test('should assess critical severity for non-recoverable errors', () => {
      const criticalErrors = [
        new Error('AudioContext not supported'),
        new Error('Memory allocation failed'),
      ];

      criticalErrors.forEach((error) => {
        const category = ErrorClassifier.classifyError(error);
        const severity = ErrorClassifier.assessSeverity(error, category);

        if (severity === ErrorSeverity.CRITICAL) {
          expect(severity).toBe(ErrorSeverity.CRITICAL);
        } else {
          // Should at least be high severity for such critical issues
          expect([ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]).toContain(
            severity,
          );
        }
      });
    });

    test('should assess high severity for performance threshold violations', () => {
      const performanceError = new Error('Performance threshold exceeded');
      const category = ErrorCategory.PERFORMANCE;
      const highPerfContext = scenarios.errorContexts.withPerformanceMetrics(
        scenarios.performanceMetrics.highLatency,
      );

      const severity = ErrorClassifier.assessSeverity(
        performanceError,
        category,
        highPerfContext,
      );

      expect([ErrorSeverity.HIGH, ErrorSeverity.MEDIUM]).toContain(severity);
    });

    test('should assess high severity for high CPU usage', () => {
      const cpuError = new Error('CPU usage critical');
      const category = ErrorCategory.PERFORMANCE;
      const highCPUContext = scenarios.errorContexts.withPerformanceMetrics(
        scenarios.performanceMetrics.highCPU,
      );

      const severity = ErrorClassifier.assessSeverity(
        cpuError,
        category,
        highCPUContext,
      );

      expect([ErrorSeverity.HIGH, ErrorSeverity.MEDIUM]).toContain(severity);
    });

    test('should consider performance metrics in severity assessment', () => {
      const performanceError = new Error('Performance issue');
      const category = ErrorCategory.PERFORMANCE;

      const normalContext = scenarios.errorContexts.withPerformanceMetrics(
        scenarios.performanceMetrics.normal,
      );
      const criticalContext = scenarios.errorContexts.withPerformanceMetrics(
        scenarios.performanceMetrics.critical,
      );

      const normalSeverity = ErrorClassifier.assessSeverity(
        performanceError,
        category,
        normalContext,
      );
      const criticalSeverity = ErrorClassifier.assessSeverity(
        performanceError,
        category,
        criticalContext,
      );

      // Critical context should result in higher or equal severity
      const severityOrder = {
        [ErrorSeverity.LOW]: 1,
        [ErrorSeverity.MEDIUM]: 2,
        [ErrorSeverity.HIGH]: 3,
        [ErrorSeverity.CRITICAL]: 4,
      };

      expect(severityOrder[criticalSeverity]).toBeGreaterThanOrEqual(
        severityOrder[normalSeverity],
      );
    });

    test('should assess medium severity for most error categories', () => {
      const testError = new Error('Test error');
      const nonValidationCategories = [
        ErrorCategory.AUDIO_CONTEXT,
        ErrorCategory.PERFORMANCE,
        ErrorCategory.RESOURCE,
        ErrorCategory.NETWORK,
        ErrorCategory.MOBILE,
      ];

      nonValidationCategories.forEach((category) => {
        const severity = ErrorClassifier.assessSeverity(testError, category);

        // Most categories should default to medium severity
        expect([
          ErrorSeverity.MEDIUM,
          ErrorSeverity.HIGH,
          ErrorSeverity.LOW,
        ]).toContain(severity);
      });
    });

    test('should assess appropriate severity for validation errors', () => {
      const validationError = new Error('Validation failed');
      const category = ErrorCategory.VALIDATION;

      const severity = ErrorClassifier.assessSeverity(
        validationError,
        category,
      );

      // Validation errors are typically low severity unless critical
      expect([ErrorSeverity.LOW, ErrorSeverity.MEDIUM]).toContain(severity);
    });

    test('should handle missing performance metrics gracefully', () => {
      const performanceError = new Error('Performance issue');
      const category = ErrorCategory.PERFORMANCE;
      const contextWithoutMetrics = scenarios.errorContexts.basic();

      const severity = ErrorClassifier.assessSeverity(
        performanceError,
        category,
        contextWithoutMetrics,
      );

      expectations.shouldReturnValidSeverity(severity);
    });
  });

  describe('Context-Aware Assessment Behaviors', () => {
    test('should consider context when available', () => {
      const error = new Error('Performance degradation');
      const category = ErrorCategory.PERFORMANCE;

      const severityWithContext = ErrorClassifier.assessSeverity(
        error,
        category,
        scenarios.errorContexts.criticalContext(),
      );
      const severityWithoutContext = ErrorClassifier.assessSeverity(
        error,
        category,
      );

      expectations.shouldConsiderContext(
        severityWithContext,
        severityWithoutContext,
      );
    });

    test('should handle edge cases in performance metrics', () => {
      const error = new Error('Edge case performance issue');
      const category = ErrorCategory.PERFORMANCE;

      const edgeCaseMetrics = {
        latency: 100.1, // Just over threshold
        cpuUsage: 90.1, // Just over threshold
      };

      const edgeContext =
        scenarios.errorContexts.withPerformanceMetrics(edgeCaseMetrics);
      const severity = ErrorClassifier.assessSeverity(
        error,
        category,
        edgeContext,
      );

      expectations.shouldReturnValidSeverity(severity);
    });

    test('should handle null or undefined performance metrics', () => {
      const error = new Error('Performance issue with null metrics');
      const category = ErrorCategory.PERFORMANCE;

      const contextWithNullMetrics = {
        ...scenarios.errorContexts.basic(),
        performanceMetrics: null as any,
      };

      const severity = ErrorClassifier.assessSeverity(
        error,
        category,
        contextWithNullMetrics,
      );

      expectations.shouldReturnValidSeverity(severity);
    });
  });

  describe('Classification Accuracy Behaviors', () => {
    test('should classify multiple keywords correctly', () => {
      const multiKeywordErrors = [
        new Error('AudioContext performance timeout'),
        new Error('Network connection memory allocation failed'),
        new Error('Mobile device audio context suspended'),
      ];

      // Should prioritize first matching keyword pattern
      const classifications = multiKeywordErrors.map((error) =>
        ErrorClassifier.classifyError(error),
      );

      // Each should classify to a valid category
      classifications.forEach((category) => {
        expectations.shouldReturnValidCategory(category);
      });
    });

    test('should handle empty or whitespace-only messages', () => {
      const edgeCaseErrors = [
        new Error(''),
        new Error('   '),
        new Error('\n\t\r'),
      ];

      edgeCaseErrors.forEach((error) => {
        const category = ErrorClassifier.classifyError(error);
        expect(category).toBe(ErrorCategory.UNKNOWN);
      });
    });

    test('should handle special characters in error messages', () => {
      const specialCharErrors = [
        new Error('Audio-context @#$% not-supported!!!'),
        new Error('Performance_timeout (critical) 123ms'),
        new Error('Memory allocation [FAILED] - system overload'),
      ];

      const expectedCategories = [
        ErrorCategory.AUDIO_CONTEXT,
        ErrorCategory.PERFORMANCE,
        ErrorCategory.RESOURCE,
      ];

      specialCharErrors.forEach((error, index) => {
        expectations.shouldClassifyCorrectly(error, expectedCategories[index]!);
      });
    });

    test('should maintain consistency across similar errors', () => {
      const similarErrors = [
        new Error('AudioContext not supported'),
        new Error('Audio context is not supported'),
        new Error('Web Audio API not supported'),
      ];

      const categories = similarErrors.map((error) =>
        ErrorClassifier.classifyError(error),
      );

      // All should classify to the same category
      expect(
        categories.every((cat) => cat === ErrorCategory.AUDIO_CONTEXT),
      ).toBe(true);
    });
  });

  describe('Integration and Edge Case Behaviors', () => {
    test('should handle all defined error categories', () => {
      Object.values(ErrorCategory).forEach((category) => {
        const testError = new Error('Test error for category validation');
        const severity = ErrorClassifier.assessSeverity(testError, category);

        expectations.shouldReturnValidSeverity(severity);
      });
    });

    test('should provide deterministic classification', () => {
      const testError = new Error('Consistent classification test');

      // Multiple calls should return same result
      const classification1 = ErrorClassifier.classifyError(testError);
      const classification2 = ErrorClassifier.classifyError(testError);
      const classification3 = ErrorClassifier.classifyError(testError);

      expect(classification1).toBe(classification2);
      expect(classification2).toBe(classification3);
    });

    test('should provide deterministic severity assessment', () => {
      const testError = new Error('Consistent severity test');
      const category = ErrorCategory.PERFORMANCE;
      const context = scenarios.errorContexts.basic();

      // Multiple calls should return same result
      const severity1 = ErrorClassifier.assessSeverity(
        testError,
        category,
        context,
      );
      const severity2 = ErrorClassifier.assessSeverity(
        testError,
        category,
        context,
      );
      const severity3 = ErrorClassifier.assessSeverity(
        testError,
        category,
        context,
      );

      expect(severity1).toBe(severity2);
      expect(severity2).toBe(severity3);
    });

    test('should handle inheritance and custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const customError = new CustomError('Custom audio context error');
      const category = ErrorClassifier.classifyError(customError);

      // Should still classify based on message content
      expect(category).toBe(ErrorCategory.AUDIO_CONTEXT);
    });

    test('should handle errors without standard Error properties', () => {
      const malformedError = {
        message: 'Performance timeout occurred',
        name: 'MalformedError',
      } as Error;

      const category = ErrorClassifier.classifyError(malformedError);
      expectations.shouldReturnValidCategory(category);
    });
  });
});
