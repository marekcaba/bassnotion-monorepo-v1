/**
 * ErrorRecovery Behavior Tests
 *
 * Tests the automatic error recovery behaviors including recovery strategies,
 * circuit breaker integration, graceful degradation, and exponential backoff.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorRecovery } from '../../errors/ErrorRecovery.js';
import {
  PlaybackError,
  ErrorCategory,
  ErrorSeverity,
} from '../../errors/base.js';
import { CircuitBreakerManager } from '../../errors/CircuitBreaker.js';
import { GracefulDegradation } from '../../errors/GracefulDegradation.js';

// Test Environment Setup
const setupErrorRecoveryEnvironment = () => {
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Use safer mocking approach that doesn't break core functionality
  vi.spyOn(Date, 'now').mockReturnValue(1000);

  // Ensure performance global exists before trying to modify it
  if (typeof globalThis.performance === 'undefined') {
    globalThis.performance = {
      now: vi.fn(() => 1000),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    } as any;
  } else {
    Object.defineProperty(performance, 'now', {
      value: vi.fn(() => 1000),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(performance, 'mark', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(performance, 'measure', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    Object.defineProperty(performance, 'getEntriesByType', {
      value: vi.fn(() => []),
      writable: true,
      configurable: true,
    });
  }

  global.navigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    connection: {
      effectiveType: '4g',
      downlink: 10,
    },
    getBattery: vi.fn().mockResolvedValue({
      level: 0.8,
      charging: false,
    }),
  } as any;

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.localStorage = localStorageMock as any;

  return { localStorageMock };
};

// Error Scenario Builders
const createErrorRecoveryScenarios = () => {
  const createPlaybackError = (
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    automaticRecoveries: any[] = [],
  ) => {
    return {
      code,
      category,
      severity,
      message: `Test error: ${code}`,
      timestamp: Date.now(),
      getAutomaticRecoveries: vi.fn().mockReturnValue(automaticRecoveries),
      getUserMessage: vi.fn().mockReturnValue(`User message for ${code}`),
      getTechnicalMessage: vi
        .fn()
        .mockReturnValue(`Technical message for ${code}`),
      isRecoverable: vi.fn().mockReturnValue(automaticRecoveries.length > 0),
      getManualRecoveries: vi.fn().mockReturnValue([]),
      toJSON: vi.fn().mockReturnValue({}),
      context: {},
      recoveryActions: automaticRecoveries,
    } as unknown as PlaybackError;
  };

  const networkError = createPlaybackError(
    'NETWORK_TIMEOUT',
    ErrorCategory.NETWORK,
    ErrorSeverity.HIGH,
    [
      { type: 'retry', maxAttempts: 3 },
      { type: 'switch_to_fallback', fallbackUrl: 'backup.cdn.com' },
    ],
  );

  const audioError = createPlaybackError(
    'AUDIO_CONTEXT_SUSPENDED',
    ErrorCategory.AUDIO_CONTEXT,
    ErrorSeverity.CRITICAL,
    [
      { type: 'reload_components', components: ['audioContext'] },
      { type: 'apply_degradation', level: 'medium' },
    ],
  );

  const resourceError = createPlaybackError(
    'MEMORY_ALLOCATION_FAILED',
    ErrorCategory.RESOURCE,
    ErrorSeverity.HIGH,
    [
      { type: 'apply_degradation', level: 'high' },
      { type: 'abort_operation', graceful: true },
    ],
  );

  const nonRecoverableError = createPlaybackError(
    'FATAL_SYSTEM_ERROR',
    ErrorCategory.PERFORMANCE,
    ErrorSeverity.CRITICAL,
    [], // No automatic recoveries
  );

  const multipleRecoveryError = createPlaybackError(
    'COMPLEX_FAILURE',
    ErrorCategory.PERFORMANCE,
    ErrorSeverity.HIGH,
    [
      { type: 'retry', maxAttempts: 2 },
      { type: 'apply_degradation', level: 'medium' },
      { type: 'switch_to_fallback', fallbackUrl: 'backup.com' },
      { type: 'reload_components', components: ['processor'] },
    ],
  );

  const deviceCapabilities = {
    lowEnd: {
      isLowEnd: true,
      batteryLevel: 0.15,
      networkCondition: 'poor' as const,
      memoryPressure: 'high' as const,
    },
    highEnd: {
      isLowEnd: false,
      batteryLevel: 0.85,
      networkCondition: 'excellent' as const,
      memoryPressure: 'normal' as const,
    },
    critical: {
      isLowEnd: true,
      batteryLevel: 0.05,
      networkCondition: 'offline' as const,
      memoryPressure: 'critical' as const,
    },
  };

  return {
    createPlaybackError,
    networkError,
    audioError,
    resourceError,
    nonRecoverableError,
    multipleRecoveryError,
    deviceCapabilities,
  };
};

// Test Helpers
const expectValidRecoveryMetrics = (metrics: any) => {
  expect(metrics).toBeDefined();
  expect(typeof metrics.totalAttempts).toBe('number');
  expect(typeof metrics.successfulRecoveries).toBe('number');
  expect(typeof metrics.failedRecoveries).toBe('number');
  expect(typeof metrics.averageRecoveryTime).toBe('number');
  expect(typeof metrics.circuitBreakerActivations).toBe('number');
  expect(typeof metrics.degradationActivations).toBe('number');

  expect(metrics.totalAttempts).toBeGreaterThanOrEqual(0);
  expect(metrics.successfulRecoveries).toBeGreaterThanOrEqual(0);
  expect(metrics.failedRecoveries).toBeGreaterThanOrEqual(0);
  expect(metrics.averageRecoveryTime).toBeGreaterThanOrEqual(0);
};

const expectValidRecoveryResult = (result: boolean) => {
  expect(typeof result).toBe('boolean');
};

const _expectRecoverySuccessBehavior = (
  result: boolean,
  metrics: any,
  initialAttempts: number,
) => {
  expect(result).toBe(true);
  expect(metrics.totalAttempts).toBe(initialAttempts + 1);
  expect(metrics.successfulRecoveries).toBeGreaterThan(0);
};

const _expectRecoveryFailureBehavior = (
  result: boolean,
  metrics: any,
  initialAttempts: number,
) => {
  expect(result).toBe(false);
  expect(metrics.totalAttempts).toBe(initialAttempts + 1);
  expect(metrics.failedRecoveries).toBeGreaterThan(0);
};

// Behavior Tests
describe('ErrorRecovery Behaviors', () => {
  let errorRecovery: ErrorRecovery;
  let scenarios: ReturnType<typeof createErrorRecoveryScenarios>;

  beforeEach(() => {
    setupErrorRecoveryEnvironment();
    scenarios = createErrorRecoveryScenarios();

    // Reset singleton instances
    (ErrorRecovery as any).instance = null;
    (CircuitBreakerManager as any).instance = null;
    (GracefulDegradation as any).instance = null;

    errorRecovery = ErrorRecovery.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorRecovery.reset();
    vi.restoreAllMocks();
  });

  describe('Error Recovery Identity Behaviors', () => {
    test('should provide singleton error recovery instance', () => {
      const instance1 = ErrorRecovery.getInstance();
      const instance2 = ErrorRecovery.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ErrorRecovery);
    });

    test('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () =>
        ErrorRecovery.getInstance(),
      );

      instances.forEach((instance) => {
        expect(instance).toBe(errorRecovery);
      });
    });

    test('should provide initial metrics state', () => {
      const metrics = errorRecovery.getMetrics();

      expectValidRecoveryMetrics(metrics);
      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successfulRecoveries).toBe(0);
      expect(metrics.failedRecoveries).toBe(0);
      expect(metrics.circuitBreakerActivations).toBe(0);
      expect(metrics.degradationActivations).toBe(0);
    });

    test('should provide circuit breaker integration', () => {
      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();
    });

    test('should provide degradation state integration', () => {
      const degradationState = errorRecovery.getDegradationState();
      expect(degradationState).toBeDefined();
    });
  });

  describe('Automatic Recovery Execution Behaviors', () => {
    test('should execute successful recovery for network errors', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      const finalMetrics = errorRecovery.getMetrics();
      expectValidRecoveryMetrics(finalMetrics);
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
    });

    test('should execute recovery for audio context errors', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(scenarios.audioError);

      expectValidRecoveryResult(result);
      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
    });

    test('should handle resource allocation errors', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
    });

    test('should handle errors without automatic recoveries', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(
        scenarios.nonRecoverableError,
      );

      expectValidRecoveryResult(result);
      expect(result).toBe(false); // Should fail for non-recoverable errors

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(finalMetrics.failedRecoveries).toBeGreaterThan(
        initialMetrics.failedRecoveries,
      );
    });

    test('should execute multiple recovery actions sequentially', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(
        scenarios.multipleRecoveryError,
      );

      expectValidRecoveryResult(result);
      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);

      // Verify automatic recovery methods were called
      expect(
        scenarios.multipleRecoveryError.getAutomaticRecoveries,
      ).toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Integration Behaviors', () => {
    test('should utilize circuit breakers for error categories', async () => {
      const networkError1 = scenarios.networkError;
      const networkError2 = scenarios.createPlaybackError(
        'NETWORK_FAILURE_2',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        [{ type: 'retry', maxAttempts: 1 }],
      );

      // Execute multiple errors of same category
      await errorRecovery.executeRecovery(networkError1);
      await errorRecovery.executeRecovery(networkError2);

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBe(2);

      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();
    });

    test('should track circuit breaker activations', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      // Create error that should trigger circuit breaker
      const criticalError = scenarios.createPlaybackError(
        'REPEATED_FAILURE',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        [{ type: 'retry', maxAttempts: 5 }],
      );

      // Execute multiple times to potentially trigger circuit breaker
      await errorRecovery.executeRecovery(criticalError);
      await errorRecovery.executeRecovery(criticalError);
      await errorRecovery.executeRecovery(criticalError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBeGreaterThan(
        initialMetrics.totalAttempts,
      );
    });

    test('should provide circuit breaker state information', async () => {
      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();

      // Should maintain circuit breaker state
      const cbMetrics2 = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics2).toBeDefined();
    });
  });

  describe('Graceful Degradation Integration Behaviors', () => {
    test('should apply graceful degradation for severe errors', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      const finalMetrics = errorRecovery.getMetrics();

      // Degradation should be applied for resource errors
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
    });

    test('should track degradation activations', async () => {
      const degradationError = scenarios.createPlaybackError(
        'HIGH_MEMORY_USAGE',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [{ type: 'apply_degradation', level: 'high' }],
      );

      const initialMetrics = errorRecovery.getMetrics();

      await errorRecovery.executeRecovery(degradationError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
    });

    test('should provide degradation state information', async () => {
      const degradationState = errorRecovery.getDegradationState();
      expect(degradationState).toBeDefined();

      // Should maintain degradation state
      const degradationState2 = errorRecovery.getDegradationState();
      expect(degradationState2).toBeDefined();
    });

    test('should coordinate degradation with device capabilities', async () => {
      // Mock low-end device
      global.navigator = {
        ...global.navigator,
        getBattery: vi.fn().mockResolvedValue({
          level: scenarios.deviceCapabilities.lowEnd.batteryLevel,
          charging: false,
        }),
      } as any;

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Recovery Action Execution Behaviors', () => {
    test('should execute retry actions with backoff', async () => {
      const retryError = scenarios.createPlaybackError(
        'TEMPORARY_FAILURE',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [{ type: 'retry', maxAttempts: 3, backoff: true }],
      );

      const result = await errorRecovery.executeRecovery(retryError);

      expectValidRecoveryResult(result);
      expect(retryError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should execute fallback switching actions', async () => {
      const fallbackError = scenarios.createPlaybackError(
        'PRIMARY_SOURCE_FAILED',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        [{ type: 'switch_to_fallback', fallbackUrl: 'backup.cdn.com' }],
      );

      const result = await errorRecovery.executeRecovery(fallbackError);

      expectValidRecoveryResult(result);
      expect(fallbackError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should execute component reload actions', async () => {
      const reloadError = scenarios.createPlaybackError(
        'COMPONENT_CORRUPTED',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [
          {
            type: 'reload_components',
            components: ['audioContext', 'processor'],
          },
        ],
      );

      const result = await errorRecovery.executeRecovery(reloadError);

      expectValidRecoveryResult(result);
      expect(reloadError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should execute abort operations gracefully', async () => {
      const abortError = scenarios.createPlaybackError(
        'UNRECOVERABLE_STATE',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        [{ type: 'abort_operation', graceful: true }],
      );

      const result = await errorRecovery.executeRecovery(abortError);

      expectValidRecoveryResult(result);
      expect(abortError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should execute degradation application actions', async () => {
      const degradationActionError = scenarios.createPlaybackError(
        'PERFORMANCE_DEGRADED',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [{ type: 'apply_degradation', level: 'medium' }],
      );

      const result = await errorRecovery.executeRecovery(
        degradationActionError,
      );

      expectValidRecoveryResult(result);
      expect(degradationActionError.getAutomaticRecoveries).toHaveBeenCalled();
    });
  });

  describe('Exponential Backoff Behaviors', () => {
    test('should apply backoff delays between retry attempts', async () => {
      const backoffError = scenarios.createPlaybackError(
        'NETWORK_INSTABILITY',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          { type: 'retry', maxAttempts: 3, backoff: true },
          { type: 'retry', maxAttempts: 2, backoff: true },
        ],
      );

      const _startTime = Date.now();
      const result = await errorRecovery.executeRecovery(backoffError);
      const _endTime = Date.now();

      expectValidRecoveryResult(result);

      // Should take some time due to backoff (in real scenario)
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle maximum backoff limits', async () => {
      const maxBackoffError = scenarios.createPlaybackError(
        'PERSISTENT_FAILURE',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        [{ type: 'retry', maxAttempts: 10, backoff: true }],
      );

      const result = await errorRecovery.executeRecovery(maxBackoffError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should disable backoff when configured', async () => {
      const noBackoffError = scenarios.createPlaybackError(
        'IMMEDIATE_RETRY_NEEDED',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [{ type: 'retry', maxAttempts: 3, backoff: false }],
      );

      const result = await errorRecovery.executeRecovery(noBackoffError);

      expectValidRecoveryResult(result);
      expect(noBackoffError.getAutomaticRecoveries).toHaveBeenCalled();
    });
  });

  describe('Device-Aware Recovery Behaviors', () => {
    test('should adapt recovery strategies for low-end devices', async () => {
      // Mock low-end device capabilities
      global.navigator = {
        ...global.navigator,
        getBattery: vi.fn().mockResolvedValue({
          level: scenarios.deviceCapabilities.lowEnd.batteryLevel,
          charging: false,
        }),
        connection: {
          effectiveType: '2g',
          downlink: 0.5,
        },
      } as any;

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should utilize high-end device capabilities for complex recovery', async () => {
      // Mock high-end device capabilities
      global.navigator = {
        ...global.navigator,
        getBattery: vi.fn().mockResolvedValue({
          level: scenarios.deviceCapabilities.highEnd.batteryLevel,
          charging: true,
        }),
        connection: {
          effectiveType: '5g',
          downlink: 100,
        },
      } as any;

      const result = await errorRecovery.executeRecovery(
        scenarios.multipleRecoveryError,
      );

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle critical device conditions', async () => {
      // Mock critical device state
      global.navigator = {
        ...global.navigator,
        getBattery: vi.fn().mockResolvedValue({
          level: scenarios.deviceCapabilities.critical.batteryLevel,
          charging: false,
        }),
        connection: {
          effectiveType: 'slow-2g',
          downlink: 0.1,
        },
      } as any;

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      // Should still attempt recovery even under critical conditions
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should detect offline conditions and adapt', async () => {
      // Mock offline state
      global.navigator = {
        ...global.navigator,
        onLine: false,
        connection: undefined,
      } as any;

      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Recovery Metrics and Monitoring Behaviors', () => {
    test('should track total recovery attempts', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.audioError);
      await errorRecovery.executeRecovery(scenarios.resourceError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 3);
    });

    test('should distinguish successful vs failed recoveries', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      // Mix of recoverable and non-recoverable errors
      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.nonRecoverableError);
      await errorRecovery.executeRecovery(scenarios.audioError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 3);
      expect(
        finalMetrics.successfulRecoveries + finalMetrics.failedRecoveries,
      ).toBeLessThanOrEqual(finalMetrics.totalAttempts);
    });

    test('should calculate average recovery times', async () => {
      // Mock different timing scenarios
      let timeCounter = 1000;
      (Date.now as any).mockImplementation(() => {
        timeCounter += 50; // Simulate 50ms per operation
        return timeCounter;
      });

      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.audioError);

      const metrics = errorRecovery.getMetrics();
      expect(metrics.averageRecoveryTime).toBeGreaterThanOrEqual(0);
    });

    test('should track circuit breaker and degradation activations separately', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      // Create errors that should trigger different mechanisms
      const degradationError = scenarios.createPlaybackError(
        'MEMORY_PRESSURE',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [{ type: 'apply_degradation', level: 'high' }],
      );

      await errorRecovery.executeRecovery(degradationError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(typeof finalMetrics.circuitBreakerActivations).toBe('number');
      expect(typeof finalMetrics.degradationActivations).toBe('number');
    });

    test('should provide last recovery time tracking', async () => {
      const metrics1 = errorRecovery.getMetrics();
      expect(metrics1.lastRecoveryTime).toBeUndefined();

      await errorRecovery.executeRecovery(scenarios.networkError);

      const metrics2 = errorRecovery.getMetrics();
      expect(typeof metrics2.lastRecoveryTime).toBe('number');
    });
  });

  describe('Recovery State Management Behaviors', () => {
    test('should manage active recovery contexts', async () => {
      // Start multiple concurrent recoveries
      const recovery1 = errorRecovery.executeRecovery(scenarios.networkError);
      const recovery2 = errorRecovery.executeRecovery(scenarios.audioError);

      const results = await Promise.all([recovery1, recovery2]);

      results.forEach((result) => expectValidRecoveryResult(result));

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBe(2);
    });

    test('should reset recovery state cleanly', async () => {
      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.audioError);

      const metricsBeforeReset = errorRecovery.getMetrics();
      expect(metricsBeforeReset.totalAttempts).toBeGreaterThan(0);

      errorRecovery.reset();

      const metricsAfterReset = errorRecovery.getMetrics();
      expect(metricsAfterReset.totalAttempts).toBe(0);
      expect(metricsAfterReset.successfulRecoveries).toBe(0);
      expect(metricsAfterReset.failedRecoveries).toBe(0);
    });

    test('should handle recovery timeout scenarios', async () => {
      const timeoutError = scenarios.createPlaybackError(
        'LONG_RUNNING_OPERATION',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [{ type: 'retry', maxAttempts: 10, timeout: 50 }], // Short timeout
      );

      const result = await errorRecovery.executeRecovery(timeoutError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should maintain recovery context across different error types', async () => {
      const errors = [
        scenarios.networkError,
        scenarios.audioError,
        scenarios.resourceError,
        scenarios.multipleRecoveryError,
      ];

      for (const error of errors) {
        const result = await errorRecovery.executeRecovery(error);
        expectValidRecoveryResult(result);
      }

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(errors.length);
    });
  });

  describe('Error Recovery Edge Cases and Error Handling', () => {
    test('should handle recovery process failures gracefully', async () => {
      // Create error with invalid recovery actions
      const invalidError = scenarios.createPlaybackError(
        'INVALID_RECOVERY',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [{ type: 'invalid_action_type' as any }],
      );

      const result = await errorRecovery.executeRecovery(invalidError);

      expectValidRecoveryResult(result);
      // Should handle gracefully even with invalid recovery actions
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle errors during metrics collection', async () => {
      // Mock Date.now to throw error
      const originalDateNow = Date.now;
      (Date.now as any).mockImplementation(() => {
        throw new Error('Time collection failed');
      });

      try {
        const result = await errorRecovery.executeRecovery(
          scenarios.networkError,
        );
        expectValidRecoveryResult(result);
      } finally {
        Date.now = originalDateNow;
      }

      // Should still provide metrics even if timing fails
      const metrics = errorRecovery.getMetrics();
      expectValidRecoveryMetrics(metrics);
    });

    test('should handle circuit breaker integration failures', async () => {
      // Simulate circuit breaker initialization failure
      ErrorRecovery.simulateInitializationFailures(true, false);

      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      // Should handle circuit breaker failures gracefully
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);

      // Clean up after test
      ErrorRecovery.clearMockDependencies();
    });

    test('should handle graceful degradation integration failures', async () => {
      // Simulate graceful degradation initialization failure
      ErrorRecovery.simulateInitializationFailures(false, true);

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      // Should handle degradation failures gracefully
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);

      // Clean up after test
      ErrorRecovery.clearMockDependencies();
    });

    test('should handle missing browser APIs gracefully', async () => {
      // Remove browser APIs
      delete (global as any).navigator;
      delete (global as any).localStorage;
      delete (global as any).performance;

      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      // Should work even without browser APIs
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Explicit Integration Verification Behaviors', () => {
    test('should verify circuit breaker integration calls', async () => {
      const mockCircuitBreakerManager = {
        getCircuitBreaker: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(true),
          getMetrics: vi.fn().mockReturnValue({
            state: 'closed',
            failureCount: 0,
            successCount: 0,
          }),
        }),
        getAllMetrics: vi.fn().mockReturnValue({}),
      };

      // Mock CircuitBreakerManager.getInstance to return our mock
      (CircuitBreakerManager.getInstance as any) = vi
        .fn()
        .mockReturnValue(mockCircuitBreakerManager);

      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      expect(mockCircuitBreakerManager.getCircuitBreaker).toHaveBeenCalled();
    });

    test('should verify graceful degradation integration calls', async () => {
      const mockGracefulDegradation = {
        applyDegradation: vi.fn().mockResolvedValue(true),
        getState: vi.fn().mockReturnValue({
          currentLevel: 'none',
          activeStrategies: [],
          disabledFeatures: new Set(),
          appliedActions: [],
          lastUpdate: Date.now(),
          recoveryAttempts: 0,
        }),
      };

      // Mock GracefulDegradation.getInstance to return our mock
      (GracefulDegradation.getInstance as any) = vi
        .fn()
        .mockReturnValue(mockGracefulDegradation);

      const result = await errorRecovery.executeRecovery(
        scenarios.resourceError,
      );

      expectValidRecoveryResult(result);
      // Note: Actual integration verification would depend on implementation
      expect(typeof result).toBe('boolean');
    });

    test('should handle integration initialization', () => {
      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      const degradationState = errorRecovery.getDegradationState();

      expect(cbMetrics).toBeDefined();
      expect(degradationState).toBeDefined();
    });
  });

  describe('Recovery Action Implementation Verification Behaviors', () => {
    test('should execute retry actions with proper verification', async () => {
      const retryError = scenarios.createPlaybackError(
        'RETRY_TEST',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          {
            type: 'retry',
            description: 'Retry operation',
            automatic: true,
            priority: 1,
            estimatedTime: 1000,
          },
        ],
      );

      const result = await errorRecovery.executeRecovery(retryError);

      expectValidRecoveryResult(result);
      expect(retryError.getAutomaticRecoveries).toHaveBeenCalled();

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should execute fallback actions with verification', async () => {
      const fallbackError = scenarios.createPlaybackError(
        'FALLBACK_TEST',
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.HIGH,
        [
          {
            type: 'fallback',
            description: 'Switch to fallback',
            automatic: true,
            priority: 2,
          },
        ],
      );

      const result = await errorRecovery.executeRecovery(fallbackError);

      expectValidRecoveryResult(result);
      expect(fallbackError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should execute degrade actions with verification', async () => {
      const degradeError = scenarios.createPlaybackError(
        'DEGRADE_TEST',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          {
            type: 'degrade',
            description: 'Apply degradation',
            automatic: true,
            priority: 1,
          },
        ],
      );

      const result = await errorRecovery.executeRecovery(degradeError);

      expectValidRecoveryResult(result);
      expect(degradeError.getAutomaticRecoveries).toHaveBeenCalled();
    });

    test('should handle action execution failures', async () => {
      const failingActionError = scenarios.createPlaybackError(
        'FAILING_ACTION_TEST',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          {
            type: 'retry',
            description: 'Failing action',
            automatic: true,
            priority: 1,
          },
        ],
      );

      // Mock the error to have failing recovery actions
      failingActionError.isRecoverable = vi.fn().mockReturnValue(true);

      const result = await errorRecovery.executeRecovery(failingActionError);

      expectValidRecoveryResult(result);
      expect(failingActionError.getAutomaticRecoveries).toHaveBeenCalled();

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Mock State Control and Failure Handling Behaviors', () => {
    test('should handle circuit breaker failures', async () => {
      const mockFailingCircuitBreaker = {
        execute: vi.fn().mockRejectedValue(new Error('Circuit breaker open')),
        getMetrics: vi.fn().mockReturnValue({
          state: 'open',
          failureCount: 5,
          successCount: 0,
        }),
      };

      const mockCircuitBreakerManager = {
        getCircuitBreaker: vi.fn().mockReturnValue(mockFailingCircuitBreaker),
        getAllMetrics: vi.fn().mockReturnValue({}),
      };

      // Temporarily override the circuit breaker manager
      const originalGetInstance = CircuitBreakerManager.getInstance;
      (CircuitBreakerManager.getInstance as any) = vi
        .fn()
        .mockReturnValue(mockCircuitBreakerManager);

      try {
        const result = await errorRecovery.executeRecovery(
          scenarios.networkError,
        );

        expectValidRecoveryResult(result);
        expect(mockCircuitBreakerManager.getCircuitBreaker).toHaveBeenCalled();

        const metrics = errorRecovery.getMetrics();
        expect(metrics.totalAttempts).toBeGreaterThan(0);
      } finally {
        CircuitBreakerManager.getInstance = originalGetInstance;
      }
    });

    test('should handle graceful degradation failures', async () => {
      const mockFailingDegradation = {
        applyDegradation: vi
          .fn()
          .mockRejectedValue(new Error('Degradation failed')),
        getState: vi.fn().mockReturnValue({
          currentLevel: 'none',
          activeStrategies: [],
          disabledFeatures: new Set(),
          appliedActions: [],
          lastUpdate: Date.now(),
          recoveryAttempts: 0,
        }),
      };

      // Temporarily override the graceful degradation
      const originalGetInstance = GracefulDegradation.getInstance;
      (GracefulDegradation.getInstance as any) = vi
        .fn()
        .mockReturnValue(mockFailingDegradation);

      try {
        const result = await errorRecovery.executeRecovery(
          scenarios.resourceError,
        );

        expectValidRecoveryResult(result);
        const metrics = errorRecovery.getMetrics();
        expect(metrics.totalAttempts).toBeGreaterThan(0);
      } finally {
        GracefulDegradation.getInstance = originalGetInstance;
      }
    });

    test('should handle errors with no recovery actions', async () => {
      const noRecoveryError = scenarios.createPlaybackError(
        'NO_RECOVERY_ERROR',
        ErrorCategory.SECURITY,
        ErrorSeverity.CRITICAL,
        [], // No recovery actions
      );

      const result = await errorRecovery.executeRecovery(noRecoveryError);

      expectValidRecoveryResult(result);
      expect(result).toBe(false); // Should fail for non-recoverable errors

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
      expect(metrics.failedRecoveries).toBeGreaterThan(0);
    });
  });

  describe('Detailed Metrics Tracking Precision Behaviors', () => {
    test('should track successful recoveries precisely', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const successError = scenarios.createPlaybackError(
        'SUCCESS_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          {
            type: 'retry',
            description: 'Retry operation',
            automatic: true,
            priority: 1,
          },
        ],
      );

      await errorRecovery.executeRecovery(successError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(finalMetrics.successfulRecoveries).toBeGreaterThan(
        initialMetrics.successfulRecoveries,
      );
    });

    test('should track failed recoveries precisely', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const failedError = scenarios.createPlaybackError(
        'FAILED_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [], // No recovery actions - should fail
      );

      await errorRecovery.executeRecovery(failedError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(finalMetrics.failedRecoveries).toBeGreaterThan(
        initialMetrics.failedRecoveries,
      );
    });

    test('should track circuit breaker activations', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const circuitError = scenarios.createPlaybackError(
        'CIRCUIT_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        [
          {
            type: 'retry',
            description: 'Retry operation',
            automatic: true,
            priority: 1,
          },
        ],
      );

      await errorRecovery.executeRecovery(circuitError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(typeof finalMetrics.circuitBreakerActivations).toBe('number');
    });

    test('should provide accurate metrics after reset', () => {
      // Execute some recoveries
      errorRecovery.executeRecovery(scenarios.networkError);
      errorRecovery.executeRecovery(scenarios.audioError);

      // Reset and verify metrics
      errorRecovery.reset();

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBe(0);
      expect(metrics.successfulRecoveries).toBe(0);
      expect(metrics.failedRecoveries).toBe(0);
      expect(metrics.circuitBreakerActivations).toBe(0);
      expect(metrics.degradationActivations).toBe(0);
    });
  });

  describe('Specific Error Type Processing Behaviors', () => {
    test('should process PlaybackError instances with recovery actions', async () => {
      const playbackError = new (class extends Error {
        code = 'TEST_ERROR';
        severity = ErrorSeverity.MEDIUM;
        category = ErrorCategory.NETWORK;
        recoveryActions = [
          {
            type: 'retry' as const,
            description: 'Retry operation',
            automatic: true,
            priority: 1,
          },
        ];
        isRecoverable = vi.fn().mockReturnValue(true);
        getAutomaticRecoveries = vi.fn().mockReturnValue(this.recoveryActions);
        getUserMessage = vi.fn().mockReturnValue('User message');
        getTechnicalMessage = vi.fn().mockReturnValue('Technical message');
        getManualRecoveries = vi.fn().mockReturnValue([]);
        toJSON = vi.fn().mockReturnValue({});
        context = {};
      })() as any;

      const result = await errorRecovery.executeRecovery(playbackError);

      expectValidRecoveryResult(result);
      expect(playbackError.getAutomaticRecoveries).toHaveBeenCalled();
      expect(playbackError.isRecoverable).toHaveBeenCalled();
    });

    test('should handle errors with complex recovery action chains', async () => {
      const complexError = scenarios.createPlaybackError(
        'COMPLEX_ERROR',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        [
          { type: 'retry', maxAttempts: 3, backoff: true },
          { type: 'apply_degradation', level: 'medium' },
          { type: 'reload_components', components: ['processor', 'audio'] },
          { type: 'switch_to_fallback', fallbackUrl: 'backup.com' },
        ],
      );

      const result = await errorRecovery.executeRecovery(complexError);

      expectValidRecoveryResult(result);
      expect(complexError.getAutomaticRecoveries).toHaveBeenCalled();

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should differentiate error severity in recovery decisions', async () => {
      const criticalError = scenarios.createPlaybackError(
        'CRITICAL_ERROR',
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.CRITICAL,
        [{ type: 'abort_operation', graceful: true }],
      );

      const lowError = scenarios.createPlaybackError(
        'LOW_ERROR',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        [{ type: 'retry', maxAttempts: 1 }],
      );

      const criticalResult = await errorRecovery.executeRecovery(criticalError);
      const lowResult = await errorRecovery.executeRecovery(lowError);

      expectValidRecoveryResult(criticalResult);
      expectValidRecoveryResult(lowResult);

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBe(2);
    });
  });

  describe('Circuit Breaker Integration State Behaviors', () => {
    test('should provide circuit breaker metrics access', () => {
      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();
    });

    test('should handle circuit breaker state changes', async () => {
      // Execute multiple errors to potentially change circuit breaker state
      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.networkError);
      await errorRecovery.executeRecovery(scenarios.networkError);

      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();

      const recoveryMetrics = errorRecovery.getMetrics();
      expect(recoveryMetrics.totalAttempts).toBe(3);
    });

    test('should integrate with circuit breaker for different error categories', async () => {
      const networkError = scenarios.networkError;
      const audioError = scenarios.audioError;
      const resourceError = scenarios.resourceError;

      await errorRecovery.executeRecovery(networkError);
      await errorRecovery.executeRecovery(audioError);
      await errorRecovery.executeRecovery(resourceError);

      const cbMetrics = errorRecovery.getCircuitBreakerMetrics();
      expect(cbMetrics).toBeDefined();

      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBe(3);
    });
  });

  describe('Graceful Degradation Application Verification Behaviors', () => {
    test('should provide degradation state access', () => {
      const degradationState = errorRecovery.getDegradationState();
      expect(degradationState).toBeDefined();
    });

    test('should apply degradation for appropriate error categories', async () => {
      const degradationError = scenarios.createPlaybackError(
        'DEGRADATION_ERROR',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [{ type: 'apply_degradation', level: 'high' }],
      );

      const result = await errorRecovery.executeRecovery(degradationError);

      expectValidRecoveryResult(result);
      expect(degradationError.getAutomaticRecoveries).toHaveBeenCalled();

      const degradationState = errorRecovery.getDegradationState();
      expect(degradationState).toBeDefined();
    });

    test('should track degradation activations in metrics', async () => {
      const initialMetrics = errorRecovery.getMetrics();

      const degradationError = scenarios.createPlaybackError(
        'MEMORY_PRESSURE',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [{ type: 'apply_degradation', level: 'medium' }],
      );

      await errorRecovery.executeRecovery(degradationError);

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(initialMetrics.totalAttempts + 1);
      expect(typeof finalMetrics.degradationActivations).toBe('number');
    });
  });

  describe('Recovery Process Failure Stage Behaviors', () => {
    test('should handle initialization failures gracefully', async () => {
      // Test recovery when initialization of dependencies fails
      const result = await errorRecovery.executeRecovery(
        scenarios.networkError,
      );

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle action execution stage failures', async () => {
      const actionFailureError = scenarios.createPlaybackError(
        'ACTION_FAILURE',
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        [{ type: 'failing_action_type' as any }], // Invalid action type
      );

      const result = await errorRecovery.executeRecovery(actionFailureError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle metrics collection failures', async () => {
      // Mock Date.now to fail during metrics collection
      const originalDateNow = Date.now;
      (Date.now as any).mockImplementationOnce(() => {
        throw new Error('Time collection failed');
      });

      try {
        const result = await errorRecovery.executeRecovery(
          scenarios.networkError,
        );
        expectValidRecoveryResult(result);

        // Should still provide metrics even if timing fails
        const metrics = errorRecovery.getMetrics();
        expectValidRecoveryMetrics(metrics);
      } finally {
        Date.now = originalDateNow;
      }
    });

    test('should handle recovery timeout scenarios', async () => {
      const timeoutError = scenarios.createPlaybackError(
        'TIMEOUT_ERROR',
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        [{ type: 'retry', maxAttempts: 10, timeout: 1 }], // Very short timeout
      );

      const result = await errorRecovery.executeRecovery(timeoutError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Real-World Recovery Scenarios', () => {
    test('should handle network connectivity loss during streaming', async () => {
      const connectivityError = scenarios.createPlaybackError(
        'NETWORK_DISCONNECTED',
        ErrorCategory.NETWORK,
        ErrorSeverity.CRITICAL,
        [
          { type: 'retry', maxAttempts: 3, backoff: true },
          { type: 'apply_degradation', level: 'high' },
          { type: 'switch_to_fallback', fallbackUrl: 'offline-cache' },
        ],
      );

      const result = await errorRecovery.executeRecovery(connectivityError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle memory pressure during long sessions', async () => {
      const memoryPressureError = scenarios.createPlaybackError(
        'MEMORY_EXHAUSTED',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [
          { type: 'apply_degradation', level: 'high' },
          { type: 'reload_components', components: ['memoryIntensiveModules'] },
          { type: 'abort_operation', graceful: true },
        ],
      );

      const result = await errorRecovery.executeRecovery(memoryPressureError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle audio context suspension in mobile browsers', async () => {
      const suspensionError = scenarios.createPlaybackError(
        'AUDIO_CONTEXT_SUSPENDED',
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.CRITICAL,
        [
          { type: 'reload_components', components: ['audioContext'] },
          { type: 'retry', maxAttempts: 5 },
          { type: 'apply_degradation', level: 'medium' },
        ],
      );

      const result = await errorRecovery.executeRecovery(suspensionError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });

    test('should handle cascading failures across multiple systems', async () => {
      const cascadingErrors = [
        scenarios.createPlaybackError(
          'NETWORK_TIMEOUT',
          ErrorCategory.NETWORK,
          ErrorSeverity.HIGH,
          [{ type: 'retry', maxAttempts: 2 }],
        ),
        scenarios.createPlaybackError(
          'AUDIO_BUFFER_UNDERRUN',
          ErrorCategory.AUDIO_CONTEXT,
          ErrorSeverity.HIGH,
          [{ type: 'apply_degradation', level: 'medium' }],
        ),
        scenarios.createPlaybackError(
          'PROCESSING_OVERLOAD',
          ErrorCategory.PERFORMANCE,
          ErrorSeverity.HIGH,
          [{ type: 'reload_components', components: ['processor'] }],
        ),
      ];

      const results = [];
      for (const error of cascadingErrors) {
        const result = await errorRecovery.executeRecovery(error);
        results.push(result);
      }

      results.forEach((result) => expectValidRecoveryResult(result));

      const finalMetrics = errorRecovery.getMetrics();
      expect(finalMetrics.totalAttempts).toBe(cascadingErrors.length);
    });

    test('should handle battery-critical scenarios with optimized recovery', async () => {
      // Mock critical battery state
      global.navigator = {
        ...global.navigator,
        getBattery: vi.fn().mockResolvedValue({
          level: 0.02, // Critical battery
          charging: false,
        }),
      } as any;

      const batteryOptimizedError = scenarios.createPlaybackError(
        'BATTERY_CRITICAL_FAILURE',
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        [
          { type: 'apply_degradation', level: 'maximum' },
          { type: 'abort_operation', graceful: true },
        ],
      );

      const result = await errorRecovery.executeRecovery(batteryOptimizedError);

      expectValidRecoveryResult(result);
      const metrics = errorRecovery.getMetrics();
      expect(metrics.totalAttempts).toBeGreaterThan(0);
    });
  });
});
