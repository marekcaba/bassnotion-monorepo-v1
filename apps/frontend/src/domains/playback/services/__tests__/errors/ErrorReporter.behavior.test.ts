/**
 * ErrorReporter Behavioral Tests
 * Tests for sanitized error logging and reporting functionality
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorReporter } from '../../errors/ErrorReporter.js';
import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  createErrorContext,
} from '../../errors/base.js';

describe('ErrorReporter Behavioral Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockError: PlaybackError;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // Create a mock PlaybackError for testing
    const errorDetails: ErrorDetails = {
      code: 'TEST_ERROR_CODE',
      message: 'Test error message',
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.AUDIO_CONTEXT,
      context: createErrorContext({
        currentOperation: 'Audio processing',
        engineState: 'running',
        audioContextState: 'running',
        deviceInfo: {
          platform: 'chrome',
          browserVersion: '91.0.4472.124',
          isMobile: false,
          hasLowLatencySupport: true,
        },
        performanceMetrics: {
          latency: 45,
          cpuUsage: 75,
          memoryUsage: 512,
          requestedSize: 1024,
          availableSize: 2048,
          utilizationPercentage: 85,
        },
      }),
      recoveryActions: [
        {
          type: 'retry',
          description: 'Retry operation',
          automatic: true,
          priority: 8,
          estimatedTime: 1000,
        },
      ],
      userMessage: 'An error occurred',
      technicalMessage: 'TEST_ERROR_CODE: Test error message',
      documentationUrl: '/docs/errors/test-error',
    };

    mockError = new PlaybackError(errorDetails);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // ================================
  // Error Reporting Behaviors
  // ================================
  describe('Error Reporting Behaviors', () => {
    it('should report errors to console in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'PlaybackError:',
        expect.objectContaining({
          code: 'TEST_ERROR_CODE',
          category: ErrorCategory.AUDIO_CONTEXT,
          severity: ErrorSeverity.HIGH,
        }),
      );
    });

    it('should not log to console in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');

      ErrorReporter.reportError(mockError);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined NODE_ENV gracefully', () => {
      vi.stubEnv('NODE_ENV', undefined);

      expect(() => {
        ErrorReporter.reportError(mockError);
      }).not.toThrow();
    });
  });

  // ================================
  // Error Sanitization Behaviors
  // ================================
  describe('Error Sanitization Behaviors', () => {
    it('should create sanitized reports with required fields', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;

      expect(reportedData).toHaveProperty('code', 'TEST_ERROR_CODE');
      expect(reportedData).toHaveProperty(
        'category',
        ErrorCategory.AUDIO_CONTEXT,
      );
      expect(reportedData).toHaveProperty('severity', ErrorSeverity.HIGH);
      expect(reportedData).toHaveProperty(
        'message',
        'TEST_ERROR_CODE: Test error message',
      );
      expect(reportedData).toHaveProperty('timestamp');
      expect(reportedData).toHaveProperty('recoverable');
      expect(reportedData).toHaveProperty('automaticRecoveries', 1);
    });

    it('should sanitize error context to remove sensitive data', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      const sanitizedContext = reportedData.context;

      // Should include safe context fields
      expect(sanitizedContext).toHaveProperty('timestamp');
      expect(sanitizedContext).toHaveProperty(
        'currentOperation',
        'Audio processing',
      );
      expect(sanitizedContext).toHaveProperty('engineState', 'running');
      expect(sanitizedContext).toHaveProperty('audioContextState', 'running');
    });

    it('should sanitize device info to include only safe fields', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      const deviceInfo = reportedData.context.deviceInfo;

      expect(deviceInfo).toHaveProperty('platform', 'chrome');
      expect(deviceInfo).toHaveProperty('isMobile', false);
      expect(deviceInfo).toHaveProperty('hasLowLatencySupport', true);
      expect(deviceInfo).not.toHaveProperty('browserVersion'); // Should be filtered out
    });

    it('should sanitize performance metrics to include only safe metrics', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      const performanceMetrics = reportedData.context.performanceMetrics;

      expect(performanceMetrics).toHaveProperty('latency', 45);
      expect(performanceMetrics).toHaveProperty('cpuUsage', 75);
      expect(performanceMetrics).toHaveProperty('memoryUsage', 512);
      expect(performanceMetrics).not.toHaveProperty('requestedSize'); // Should be filtered out
      expect(performanceMetrics).not.toHaveProperty('availableSize'); // Should be filtered out
    });
  });

  // ================================
  // Stack Trace Sanitization Behaviors
  // ================================
  describe('Stack Trace Sanitization Behaviors', () => {
    it('should sanitize stack traces by removing file paths', () => {
      const errorWithStack = new Error('Test error with stack');
      errorWithStack.stack = `Error: Test error
        at Object.test (/Users/user/project/src/file.js:10:5)
        at Function.run (/home/app/dist/main.js:25:10)
        at /opt/app/node_modules/lib/index.js:100:20`;

      const playbackError = new PlaybackError(
        {
          code: 'STACK_TEST',
          message: 'Stack test',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.AUDIO_CONTEXT,
          context: createErrorContext({}),
          recoveryActions: [],
          userMessage: 'Stack test',
          technicalMessage: 'Stack test',
        },
        errorWithStack,
      );

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(playbackError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      const sanitizedStack = reportedData.stack;

      expect(sanitizedStack).toContain('/[path]/file.js:10:5');
      expect(sanitizedStack).toContain('/[path]/main.js:25:10');
      expect(sanitizedStack).toContain('/[path]/index.js:100:20');
      expect(sanitizedStack).not.toContain('/Users/user/project');
      expect(sanitizedStack).not.toContain('/home/app/dist');
      expect(sanitizedStack).not.toContain('/opt/app/node_modules');
    });

    it('should handle errors without stack traces', () => {
      const errorWithoutStack = new PlaybackError({
        code: 'NO_STACK_TEST',
        message: 'No stack test',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: createErrorContext({}),
        recoveryActions: [],
        userMessage: 'No stack test',
        technicalMessage: 'No stack test',
      });

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(errorWithoutStack);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(reportedData.stack).toBeUndefined();
    });

    it('should handle empty stack traces', () => {
      const errorWithEmptyStack = new Error('Test error');
      errorWithEmptyStack.stack = '';

      const playbackError = new PlaybackError(
        {
          code: 'EMPTY_STACK_TEST',
          message: 'Empty stack test',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.AUDIO_CONTEXT,
          context: createErrorContext({}),
          recoveryActions: [],
          userMessage: 'Empty stack test',
          technicalMessage: 'Empty stack test',
        },
        errorWithEmptyStack,
      );

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(playbackError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(reportedData.stack).toBe('');
    });
  });

  // ================================
  // Context Sanitization Edge Cases
  // ================================
  describe('Context Sanitization Edge Cases', () => {
    it('should handle missing device info gracefully', () => {
      const errorDetails: ErrorDetails = {
        code: 'NO_DEVICE_INFO',
        message: 'No device info',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AUDIO_CONTEXT,
        context: createErrorContext({
          currentOperation: 'Test operation',
        }),
        recoveryActions: [],
        userMessage: 'No device info',
        technicalMessage: 'No device info',
      };

      const errorWithoutDeviceInfo = new PlaybackError(errorDetails);

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(errorWithoutDeviceInfo);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(reportedData.context.deviceInfo).toBeUndefined();
    });

    it('should handle missing performance metrics gracefully', () => {
      const errorDetails: ErrorDetails = {
        code: 'NO_PERFORMANCE_METRICS',
        message: 'No performance metrics',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AUDIO_CONTEXT,
        context: createErrorContext({
          currentOperation: 'Test operation',
        }),
        recoveryActions: [],
        userMessage: 'No performance metrics',
        technicalMessage: 'No performance metrics',
      };

      const errorWithoutMetrics = new PlaybackError(errorDetails);

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(errorWithoutMetrics);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(reportedData.context.performanceMetrics).toBeUndefined();
    });

    it('should handle partial device info', () => {
      const errorDetails: ErrorDetails = {
        code: 'PARTIAL_DEVICE_INFO',
        message: 'Partial device info',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.AUDIO_CONTEXT,
        context: createErrorContext({
          deviceInfo: {
            platform: 'firefox',
            browserVersion: '89.0',
            isMobile: true,
            hasLowLatencySupport: false,
          },
        }),
        recoveryActions: [],
        userMessage: 'Partial device info',
        technicalMessage: 'Partial device info',
      };

      const errorWithPartialDeviceInfo = new PlaybackError(errorDetails);

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(errorWithPartialDeviceInfo);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      const deviceInfo = reportedData.context.deviceInfo;

      expect(deviceInfo.platform).toBe('firefox');
      expect(deviceInfo.isMobile).toBe(true);
      expect(deviceInfo.hasLowLatencySupport).toBe(false);
    });
  });

  // ================================
  // Error Recovery Information Behaviors
  // ================================
  describe('Error Recovery Information Behaviors', () => {
    it('should report automatic recovery count correctly', () => {
      const errorDetails: ErrorDetails = {
        code: 'MULTIPLE_RECOVERIES',
        message: 'Multiple recoveries test',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RESOURCE,
        context: createErrorContext({}),
        recoveryActions: [
          {
            type: 'retry',
            description: 'Retry operation',
            automatic: true,
            priority: 8,
          },
          {
            type: 'degrade',
            description: 'Reduce quality',
            automatic: true,
            priority: 6,
          },
          {
            type: 'fallback',
            description: 'Use fallback',
            automatic: false,
            priority: 4,
          },
        ],
        userMessage: 'Multiple recoveries',
        technicalMessage: 'Multiple recoveries',
      };

      const errorWithMultipleRecoveries = new PlaybackError(errorDetails);

      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(errorWithMultipleRecoveries);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(reportedData.automaticRecoveries).toBe(2); // Only automatic recoveries
    });

    it('should report error recoverability status', () => {
      vi.stubEnv('NODE_ENV', 'development');

      ErrorReporter.reportError(mockError);

      const reportedData = consoleErrorSpy.mock.calls[0]![1] as any;
      expect(typeof reportedData.recoverable).toBe('boolean');
    });
  });

  // ================================
  // Environment and Configuration Behaviors
  // ================================
  describe('Environment and Configuration Behaviors', () => {
    it('should handle different NODE_ENV values correctly', () => {
      const testValues = ['development', 'production', 'test', 'staging'];

      testValues.forEach((env) => {
        vi.stubEnv('NODE_ENV', env);
        consoleErrorSpy.mockClear();

        ErrorReporter.reportError(mockError);

        if (env === 'development') {
          expect(consoleErrorSpy).toHaveBeenCalled();
        } else {
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        }
      });
    });

    it('should maintain data integrity across multiple reports', () => {
      vi.stubEnv('NODE_ENV', 'development');

      const error1 = new PlaybackError({
        code: 'ERROR_1',
        message: 'First error',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.AUDIO_CONTEXT,
        context: createErrorContext({}),
        recoveryActions: [],
        userMessage: 'First error',
        technicalMessage: 'First error',
      });

      const error2 = new PlaybackError({
        code: 'ERROR_2',
        message: 'Second error',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: createErrorContext({}),
        recoveryActions: [],
        userMessage: 'Second error',
        technicalMessage: 'Second error',
      });

      ErrorReporter.reportError(error1);
      ErrorReporter.reportError(error2);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      const firstReport = consoleErrorSpy.mock.calls[0]![1] as any;
      const secondReport = consoleErrorSpy.mock.calls[1]![1] as any;

      expect(firstReport.code).toBe('ERROR_1');
      expect(firstReport.severity).toBe(ErrorSeverity.HIGH);
      expect(secondReport.code).toBe('ERROR_2');
      expect(secondReport.severity).toBe(ErrorSeverity.LOW);
    });
  });

  // ================================
  // Static Method Behaviors
  // ================================
  describe('Static Method Behaviors', () => {
    it('should be usable as static methods without instantiation', () => {
      expect(() => {
        ErrorReporter.reportError(mockError);
      }).not.toThrow();
    });

    it('should not allow instantiation of ErrorReporter', () => {
      // ErrorReporter should be a utility class with only static methods
      expect(typeof ErrorReporter).toBe('function');
      expect(ErrorReporter.prototype.constructor).toBe(ErrorReporter);
    });
  });
});
