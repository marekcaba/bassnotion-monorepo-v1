/**
 * Base PlaybackError Behavior Tests
 *
 * Tests the foundational error handling behaviors including error categorization,
 * severity assessment, recovery action management, and context serialization.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorRecoveryAction,
  ErrorMetrics,
  createErrorContext,
  determineSeverity,
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

  // Mock Date for consistent timestamps
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-01'));

  // Mock Error.captureStackTrace for environments that support it
  const captureStackTraceSpy = vi.fn();
  if (!Error.captureStackTrace) {
    (Error as any).captureStackTrace = captureStackTraceSpy;
  } else {
    vi.spyOn(Error, 'captureStackTrace').mockImplementation(
      captureStackTraceSpy,
    );
  }

  return {};
};

// Test Scenarios
const createErrorScenarios = () => ({
  basicErrorDetails: (): ErrorDetails => ({
    code: 'TEST_ERROR_001',
    message: 'Test error message',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.AUDIO_CONTEXT,
    context: createErrorContext({
      timestamp: Date.now(),
      sessionId: 'test-session',
      userAgent: 'Mozilla/5.0 (Test Browser)',
    }),
    recoveryActions: [
      {
        type: 'retry',
        description: 'Retry the operation',
        automatic: true,
        priority: 9,
        estimatedTime: 1000,
      },
      {
        type: 'fallback',
        description: 'Use fallback method',
        automatic: true,
        priority: 5,
      },
    ],
    userMessage: "Something went wrong. We're trying to fix it.",
    technicalMessage: 'Error occurred in audio context initialization',
    documentationUrl: 'https://docs.example.com/error-codes/TEST_ERROR_001',
  }),

  criticalErrorDetails: (): ErrorDetails => ({
    code: 'CRITICAL_ERROR_001',
    message: 'Critical system failure',
    severity: ErrorSeverity.CRITICAL,
    category: ErrorCategory.PERFORMANCE,
    context: createErrorContext({
      timestamp: Date.now(),
      sessionId: 'critical-session',
      performanceMetrics: {
        latency: 150,
        cpuUsage: 95,
        memoryUsage: 1024,
      },
    }),
    recoveryActions: [
      {
        type: 'abort',
        description: 'Abort current operation',
        automatic: true,
        priority: 10,
      },
    ],
    userMessage: 'A critical error occurred. Please restart the application.',
    technicalMessage: 'System resources exhausted',
  }),

  noRecoveryErrorDetails: (): ErrorDetails => ({
    code: 'NO_RECOVERY_ERROR',
    message: 'Error with no recovery options',
    severity: ErrorSeverity.HIGH,
    category: ErrorCategory.VALIDATION,
    context: createErrorContext(),
    recoveryActions: [],
    userMessage: 'Invalid input provided',
  }),

  mixedRecoveryErrorDetails: (): ErrorDetails => ({
    code: 'MIXED_RECOVERY_ERROR',
    message: 'Error with mixed recovery types',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.NETWORK,
    context: createErrorContext(),
    recoveryActions: [
      {
        type: 'retry',
        description: 'Automatic retry',
        automatic: true,
        priority: 8,
        estimatedTime: 2000,
      },
      {
        type: 'reload',
        description: 'Manual page reload',
        automatic: false,
        priority: 7,
      },
      {
        type: 'degrade',
        description: 'Reduce quality automatically',
        automatic: true,
        priority: 6,
      },
      {
        type: 'fallback',
        description: 'Manual fallback selection',
        automatic: false,
        priority: 9,
      },
    ],
  }),

  errorMetrics: (): ErrorMetrics => ({
    occurrenceCount: 3,
    firstOccurrence: Date.now() - 10000,
    lastOccurrence: Date.now(),
    averageResolutionTime: 2500,
    successfulRecoveries: 2,
    failedRecoveries: 1,
  }),

  sensitiveContext: (): Partial<ErrorContext> => ({
    timestamp: Date.now(),
    sessionId: 'sensitive-session',
    userId: 'user-12345',
    userAgent: 'Mozilla/5.0 (Browser with sensitive data)',
    performanceMetrics: {
      latency: 50,
      memoryUsage: 256,
    },
    configSnapshot: {
      apiKey: 'secret-api-key',
      userToken: 'sensitive-token',
      audioConfig: {
        bufferSize: 1024,
        sampleRate: 44100,
      },
    },
  }),
});

// Behavior Expectations
const expectations = {
  shouldCreateError: (error: PlaybackError) => {
    expect(error).toBeInstanceOf(PlaybackError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PlaybackError');
  },

  shouldHaveValidProperties: (error: PlaybackError, details: ErrorDetails) => {
    expect(error.code).toBe(details.code);
    expect(error.message).toBe(details.message);
    expect(error.severity).toBe(details.severity);
    expect(error.category).toBe(details.category);
    expect(error.context).toBe(details.context);
    expect(error.recoveryActions).toBe(details.recoveryActions);
    expect(error.timestamp).toBeDefined();
  },

  shouldProvideUserMessage: (error: PlaybackError) => {
    const userMessage = error.getUserMessage();
    expect(typeof userMessage).toBe('string');
    expect(userMessage.length).toBeGreaterThan(0);
  },

  shouldProvideTechnicalMessage: (error: PlaybackError) => {
    const technicalMessage = error.getTechnicalMessage();
    expect(typeof technicalMessage).toBe('string');
    expect(technicalMessage.length).toBeGreaterThan(0);
  },

  shouldAssessRecoverability: (
    error: PlaybackError,
    expectedRecoverable: boolean,
  ) => {
    const isRecoverable = error.isRecoverable();
    expect(typeof isRecoverable).toBe('boolean');
    expect(isRecoverable).toBe(expectedRecoverable);

    if (expectedRecoverable) {
      expect(error.recoveryActions.length).toBeGreaterThan(0);
      expect(error.severity).not.toBe(ErrorSeverity.CRITICAL);
    }
  },

  shouldSeparateRecoveryTypes: (error: PlaybackError) => {
    const automaticRecoveries = error.getAutomaticRecoveries();
    const manualRecoveries = error.getManualRecoveries();

    expect(Array.isArray(automaticRecoveries)).toBe(true);
    expect(Array.isArray(manualRecoveries)).toBe(true);

    automaticRecoveries.forEach((action) => {
      expect(action.automatic).toBe(true);
    });

    manualRecoveries.forEach((action) => {
      expect(action.automatic).toBe(false);
    });

    // Total should equal original recovery actions
    const totalRecoveries =
      automaticRecoveries.length + manualRecoveries.length;
    expect(totalRecoveries).toBe(error.recoveryActions.length);
  },

  shouldPrioritizeRecoveries: (recoveryActions: ErrorRecoveryAction[]) => {
    // Should be sorted by priority in descending order
    for (let i = 1; i < recoveryActions.length; i++) {
      expect(recoveryActions[i - 1]!.priority).toBeGreaterThanOrEqual(
        recoveryActions[i]!.priority,
      );
    }
  },

  shouldSerializeCorrectly: (error: PlaybackError) => {
    const serialized = error.toJSON();

    expect(typeof serialized).toBe('object');
    expect(serialized.name).toBe('PlaybackError');
    expect(serialized.code).toBe(error.code);
    expect(serialized.message).toBe(error.message);
    expect(serialized.severity).toBe(error.severity);
    expect(serialized.category).toBe(error.category);
    expect(serialized.timestamp).toBe(error.timestamp);
    expect(serialized.context).toBeDefined();
    expect(serialized.recoveryActions).toBeDefined();
  },

  shouldSanitizeContext: (serialized: Record<string, unknown>) => {
    const context = serialized.context as any;

    // Should preserve non-sensitive information
    expect(context.timestamp).toBeDefined();
    expect(context.performanceMetrics).toBeDefined();
    expect(context.deviceInfo).toBeDefined();

    // Should sanitize sensitive information
    expect(context.userId).toBeUndefined();
    expect(context.userAgent).toBeUndefined();
    expect(context.configSnapshot).toBeUndefined();
  },
};

// Behavior Tests
describe('PlaybackError Base Behaviors', () => {
  let scenarios: ReturnType<typeof createErrorScenarios>;

  beforeEach(() => {
    setupTestEnvironment();
    scenarios = createErrorScenarios();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Error Creation Behaviors', () => {
    test('should create basic playback error', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldCreateError(error);
      expectations.shouldHaveValidProperties(error, details);
    });

    test('should create error with cause chain', () => {
      const details = scenarios.basicErrorDetails();
      const cause = new Error('Original system error');
      const error = new PlaybackError(details, cause);

      expectations.shouldCreateError(error);
      expect(error.stack).toContain('Caused by:');
      expect(error.stack).toContain('Original system error');
    });

    test('should capture stack trace when available', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expect(error.stack).toBeDefined();
      if (Error.captureStackTrace) {
        expect(Error.captureStackTrace).toHaveBeenCalledWith(
          error,
          PlaybackError,
        );
      }
    });

    test('should set timestamp on creation', () => {
      const details = scenarios.basicErrorDetails();
      const beforeCreation = Date.now();
      const error = new PlaybackError(details);
      const afterCreation = Date.now();

      expect(error.timestamp).toBeGreaterThanOrEqual(beforeCreation);
      expect(error.timestamp).toBeLessThanOrEqual(afterCreation);
    });
  });

  describe('Message Handling Behaviors', () => {
    test('should provide user-friendly messages', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldProvideUserMessage(error);
      expect(error.getUserMessage()).toBe(details.userMessage);
    });

    test('should provide technical messages', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldProvideTechnicalMessage(error);
      expect(error.getTechnicalMessage()).toBe(details.technicalMessage);
    });

    test('should fallback to default user message when none provided', () => {
      const details = scenarios.basicErrorDetails();
      delete details.userMessage;
      const error = new PlaybackError(details);

      expectations.shouldProvideUserMessage(error);
      const userMessage = error.getUserMessage();
      expect(userMessage).not.toBe(details.message);
      expect(userMessage.length).toBeGreaterThan(0);
    });

    test('should fallback to main message for technical details', () => {
      const details = scenarios.basicErrorDetails();
      delete details.technicalMessage;
      const error = new PlaybackError(details);

      expectations.shouldProvideTechnicalMessage(error);
      expect(error.getTechnicalMessage()).toBe(details.message);
    });
  });

  describe('Recovery Assessment Behaviors', () => {
    test('should assess recoverability for errors with recovery actions', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldAssessRecoverability(error, true);
    });

    test('should assess non-recoverability for critical errors', () => {
      const details = scenarios.criticalErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldAssessRecoverability(error, false);
    });

    test('should assess non-recoverability for errors without recovery actions', () => {
      const details = scenarios.noRecoveryErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldAssessRecoverability(error, false);
    });

    test('should separate automatic and manual recovery actions', () => {
      const details = scenarios.mixedRecoveryErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldSeparateRecoveryTypes(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      const manualRecoveries = error.getManualRecoveries();

      expect(automaticRecoveries.length).toBe(2); // retry and degrade
      expect(manualRecoveries.length).toBe(2); // reload and fallback
    });

    test('should prioritize automatic recovery actions', () => {
      const details = scenarios.mixedRecoveryErrorDetails();
      const error = new PlaybackError(details);

      const automaticRecoveries = error.getAutomaticRecoveries();
      expectations.shouldPrioritizeRecoveries(automaticRecoveries);
    });

    test('should prioritize manual recovery actions', () => {
      const details = scenarios.mixedRecoveryErrorDetails();
      const error = new PlaybackError(details);

      const manualRecoveries = error.getManualRecoveries();
      expectations.shouldPrioritizeRecoveries(manualRecoveries);
    });
  });

  describe('Error Serialization Behaviors', () => {
    test('should serialize basic error information', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expectations.shouldSerializeCorrectly(error);

      const serialized = error.toJSON();
      expect(serialized.userMessage).toBe(details.userMessage);
      expect(serialized.technicalMessage).toBe(details.technicalMessage);
      expect(serialized.recoveryActions).toEqual(details.recoveryActions);
    });

    test('should include metrics when available', () => {
      const details = scenarios.basicErrorDetails();
      details.metrics = scenarios.errorMetrics();
      const error = new PlaybackError(details);

      const serialized = error.toJSON();
      expect(serialized.metrics).toEqual(details.metrics);
    });

    test('should sanitize sensitive context information', () => {
      const details = scenarios.basicErrorDetails();
      details.context = createErrorContext(scenarios.sensitiveContext());
      const error = new PlaybackError(details);

      const serialized = error.toJSON();
      expectations.shouldSanitizeContext(serialized);
    });

    test('should preserve non-sensitive context information', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      const serialized = error.toJSON();
      const context = serialized.context as any;

      expect(context.timestamp).toBeDefined();
      expect(context.audioContextState).toBeDefined();
      expect(context.performanceMetrics).toBeDefined();
      expect(context.deviceInfo).toBeDefined();
      expect(context.currentOperation).toBeDefined();
      expect(context.engineState).toBeDefined();
    });
  });

  describe('Error Context Behaviors', () => {
    test('should create error context with defaults', () => {
      const context = createErrorContext();

      expect(context.timestamp).toBeDefined();
      expect(typeof context.timestamp).toBe('number');
      expect(context.timestamp).toBeGreaterThan(0);
    });

    test('should merge partial context with defaults', () => {
      const partialContext = {
        sessionId: 'test-session',
        audioContextState: 'running',
      };

      const context = createErrorContext(partialContext);

      expect(context.sessionId).toBe('test-session');
      expect(context.audioContextState).toBe('running');
      expect(context.timestamp).toBeDefined();
    });

    test('should preserve provided context values', () => {
      const providedContext = scenarios.sensitiveContext();
      const context = createErrorContext(providedContext);

      expect(context.sessionId).toBe(providedContext.sessionId);
      expect(context.userId).toBe(providedContext.userId);
      expect(context.performanceMetrics).toBe(
        providedContext.performanceMetrics,
      );
      expect(context.configSnapshot).toBe(providedContext.configSnapshot);
    });
  });

  describe('Severity Determination Behaviors', () => {
    test('should determine critical severity for non-recoverable core issues', () => {
      const severity = determineSeverity(
        ErrorCategory.AUDIO_CONTEXT,
        false, // not recoverable
        true, // affects core
      );

      expect(severity).toBe(ErrorSeverity.CRITICAL);
    });

    test('should determine high severity for recoverable core issues', () => {
      const severity = determineSeverity(
        ErrorCategory.PERFORMANCE,
        true, // recoverable
        true, // affects core
      );

      expect(severity).toBe(ErrorSeverity.HIGH);
    });

    test('should determine medium severity for non-core issues', () => {
      const severity = determineSeverity(
        ErrorCategory.NETWORK,
        true, // recoverable
        false, // doesn\'t affect core
      );

      expect(severity).toBe(ErrorSeverity.MEDIUM);
    });

    test('should determine low severity for validation issues', () => {
      const severity = determineSeverity(
        ErrorCategory.VALIDATION,
        true, // recoverable
        false, // doesn\'t affect core
      );

      expect(severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('Error Integration Behaviors', () => {
    test('should handle all error categories', () => {
      Object.values(ErrorCategory).forEach((category) => {
        const details = scenarios.basicErrorDetails();
        details.category = category;

        const error = new PlaybackError(details);
        expect(error.category).toBe(category);
      });
    });

    test('should handle all error severities', () => {
      Object.values(ErrorSeverity).forEach((severity) => {
        const details = scenarios.basicErrorDetails();
        details.severity = severity;

        const error = new PlaybackError(details);
        expect(error.severity).toBe(severity);
      });
    });

    test('should handle all recovery action types', () => {
      const recoveryTypes = [
        'retry',
        'fallback',
        'degrade',
        'abort',
        'reload',
      ] as const;

      recoveryTypes.forEach((type) => {
        const details = scenarios.basicErrorDetails();
        details.recoveryActions = [
          {
            type,
            description: `Test ${type} action`,
            automatic: true,
            priority: 5,
          },
        ];

        const error = new PlaybackError(details);
        expect(error.recoveryActions[0]!.type).toBe(type);
      });
    });

    test('should maintain error inheritance chain', () => {
      const details = scenarios.basicErrorDetails();
      const error = new PlaybackError(details);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof PlaybackError).toBe(true);
      expect(error.constructor.name).toBe('PlaybackError');
    });
  });
});
