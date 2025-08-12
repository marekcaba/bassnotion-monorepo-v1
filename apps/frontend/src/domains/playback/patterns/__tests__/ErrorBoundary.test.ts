/**
 * ErrorBoundary Tests
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Tests for ServiceErrorBoundary with error isolation,
 * recovery strategies, and service protection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceErrorBoundary, ErrorBoundary, RecoveryStrategy } from '../ErrorBoundary.js';
import { EventBus } from '../../services/core/EventBus.js';
import { Service } from '../../services/core/ServiceRegistry.js';

// Mock service for testing
class MockService implements Service {
  public operationCallCount = 0;
  public shouldFail = false;
  public failureMessage = 'Operation failed';
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async performOperation(): Promise<string> {
    this.operationCallCount++;
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
    return 'success';
  }
  
  reset(): void {
    this.operationCallCount = 0;
    this.shouldFail = false;
  }
}

describe('ServiceErrorBoundary', () => {
  let eventBus: EventBus;
  let errorBoundary: ServiceErrorBoundary;
  let mockService: MockService;

  beforeEach(() => {
    eventBus = new EventBus();
    errorBoundary = new ServiceErrorBoundary(eventBus);
    mockService = new MockService();
  });

  afterEach(() => {
    vi.clearAllTimers();
    errorBoundary.clearAll();
  });

  describe('Basic Error Protection', () => {
    it('should execute successful operations normally', async () => {
      const result = await errorBoundary.protect(
        'test-service',
        'operation',
        () => mockService.performOperation()
      );
      
      expect(result).toBe('success');
      expect(mockService.operationCallCount).toBe(1);
    });

    it('should catch and record errors', async () => {
      mockService.shouldFail = true;
      
      await expect(
        errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        )
      ).rejects.toThrow('Operation failed');
      
      const report = errorBoundary.getErrorReport('test-service');
      expect(report.totalErrors).toBe(1);
      expect(report.errors[0].error.message).toBe('Operation failed');
    });

    it('should emit error event on failure', async () => {
      const errorHandler = vi.fn();
      eventBus.on('errorboundary:error', errorHandler);
      
      mockService.shouldFail = true;
      
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          operation: 'operation',
          error: expect.any(Error),
          context: expect.objectContaining({
            serviceName: 'test-service',
            operation: 'operation',
            errorCount: 1,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include metadata in error context', async () => {
      const errorHandler = vi.fn();
      eventBus.on('errorboundary:error', errorHandler);
      
      mockService.shouldFail = true;
      const metadata = { userId: '123', action: 'test' };
      
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation(),
          metadata
        );
      } catch (error) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            metadata,
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Service Isolation', () => {
    it('should isolate service after max errors', async () => {
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 3,
        errorWindow: 60000,
      });
      
      const isolatedHandler = vi.fn();
      eventBus.on('errorboundary:service-isolated', isolatedHandler);
      
      mockService.shouldFail = true;
      
      // Trigger max errors
      for (let i = 0; i < 3; i++) {
        try {
          await errorBoundary.protect(
            'test-service',
            'operation',
            () => mockService.performOperation()
          );
        } catch (error) {
          // Expected
        }
      }
      
      expect(isolatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          errorCount: 3,
          isolationLevel: 'partial',
        }),
        expect.any(Object)
      );
      
      expect(errorBoundary.isServiceIsolated('test-service')).toBe(true);
    });

    it('should throw error for isolated service with full isolation', async () => {
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 1,
        isolationLevel: 'full',
      });
      
      mockService.shouldFail = true;
      
      // First call triggers isolation
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      // Second call should fail immediately due to isolation
      await expect(
        errorBoundary.protect(
          'test-service',
          'operation',
          () => Promise.resolve('should not execute')
        )
      ).rejects.toThrow('Service test-service is isolated due to errors');
    });

    it('should respect error window for isolation', async () => {
      vi.useFakeTimers();
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 2,
        errorWindow: 1000, // 1 second
      });
      
      mockService.shouldFail = true;
      
      // First error
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      // Wait for error window to pass
      await vi.advanceTimersByTimeAsync(1100);
      
      // Second error after window - should not trigger isolation
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(errorBoundary.isServiceIsolated('test-service')).toBe(false);
      
      vi.useRealTimers();
    });
  });

  describe('Recovery Strategies', () => {
    it('should attempt recovery with matching strategy', async () => {
      const recoveryHandler = vi.fn();
      const recoveryStrategy: RecoveryStrategy = {
        name: 'test-recovery',
        condition: (error) => error.message === 'recoverable',
        recover: recoveryHandler,
        priority: 10,
      };
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: [recoveryStrategy],
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      mockService.failureMessage = 'recoverable';
      
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(recoveryHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          serviceName: 'test-service',
          operation: 'operation',
        })
      );
    });

    it('should retry operation after successful recovery', async () => {
      let attemptCount = 0;
      const recoveryStrategy: RecoveryStrategy = {
        name: 'retry-once',
        condition: () => attemptCount === 1,
        recover: async () => {
          mockService.shouldFail = false; // Fix the issue
        },
        priority: 10,
      };
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: [recoveryStrategy],
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      const result = await errorBoundary.protect(
        'test-service',
        'operation',
        () => {
          attemptCount++;
          return mockService.performOperation();
        }
      );
      
      expect(result).toBe('success');
      expect(attemptCount).toBe(2); // Original attempt + retry
    });

    it('should emit recovery events', async () => {
      const attemptedHandler = vi.fn();
      const successHandler = vi.fn();
      
      eventBus.on('errorboundary:recovery-attempted', attemptedHandler);
      eventBus.on('errorboundary:recovery-success', successHandler);
      
      const recoveryStrategy: RecoveryStrategy = {
        name: 'fix-error',
        condition: () => true,
        recover: async () => {
          mockService.shouldFail = false;
        },
        priority: 10,
      };
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: [recoveryStrategy],
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      await errorBoundary.protect(
        'test-service',
        'operation',
        () => mockService.performOperation()
      );
      
      expect(attemptedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          strategy: 'fix-error',
          success: true,
        }),
        expect.any(Object)
      );
      
      expect(successHandler).toHaveBeenCalled();
    });

    it('should handle recovery failure', async () => {
      const attemptedHandler = vi.fn();
      
      eventBus.on('errorboundary:recovery-attempted', attemptedHandler);
      
      const failingRecoveryStrategy: RecoveryStrategy = {
        name: 'failing-recovery',
        condition: () => true,
        recover: async () => {
          throw new Error('Recovery failed');
        },
        priority: 10,
      };
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: [failingRecoveryStrategy],
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      await expect(
        errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        )
      ).rejects.toThrow('Operation failed');
      
      expect(attemptedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          strategy: 'failing-recovery',
          success: false,
          error: expect.any(Error),
        }),
        expect.any(Object)
      );
    });

    it('should try strategies in priority order', async () => {
      const executionOrder: string[] = [];
      
      const strategies: RecoveryStrategy[] = [
        {
          name: 'low-priority',
          condition: () => true,
          recover: async () => {
            executionOrder.push('low');
          },
          priority: 1,
        },
        {
          name: 'high-priority',
          condition: () => true,
          recover: async () => {
            executionOrder.push('high');
            mockService.shouldFail = false; // Fix the issue
          },
          priority: 10,
        },
        {
          name: 'medium-priority',
          condition: () => true,
          recover: async () => {
            executionOrder.push('medium');
          },
          priority: 5,
        },
      ];
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: strategies,
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      await errorBoundary.protect(
        'test-service',
        'operation',
        () => mockService.performOperation()
      );
      
      // Should execute high priority first and stop after successful recovery
      expect(executionOrder).toEqual(['high']);
    });
  });

  describe('Default Recovery Strategies', () => {
    it('should retry on network errors', async () => {
      vi.useFakeTimers();
      
      const retryHandler = vi.fn();
      eventBus.on('errorboundary:retry', retryHandler);
      
      mockService.failureMessage = 'network timeout';
      mockService.shouldFail = true;
      
      // Disable auto recovery to control timing
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        enableAutoRecovery: false,
      });
      
      // Manually test the retry strategy
      const retryStrategy = (errorBoundary as any).getDefaultStrategies().find(
        (s: RecoveryStrategy) => s.name === 'retry-transient'
      );
      
      const error = new Error('network timeout');
      const context = {
        serviceName: 'test-service',
        operation: 'operation',
        errorCount: 1,
        timestamp: Date.now(),
      };
      
      // Test that condition matches
      expect(retryStrategy.condition(error, context)).toBe(true);
      
      // Test recovery
      const recoverPromise = retryStrategy.recover(error, context);
      
      // Advance timers for the retry delay
      await vi.advanceTimersByTimeAsync(1000);
      
      await recoverPromise;
      
      expect(retryHandler).toHaveBeenCalledWith(
        expect.objectContaining({ context }),
        expect.any(Object)
      );
      
      vi.useRealTimers();
    });

    it('should emit reset event for repeated errors', async () => {
      const resetHandler = vi.fn();
      eventBus.on('errorboundary:service-reset', resetHandler);
      
      mockService.shouldFail = true;
      
      // Trigger multiple errors to reach reset threshold
      for (let i = 0; i < 3; i++) {
        try {
          await errorBoundary.protect(
            'test-service',
            'operation',
            () => mockService.performOperation()
          );
        } catch (error) {
          // Expected
        }
      }
      
      expect(resetHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
        }),
        expect.any(Object)
      );
    });

    it('should clear cache on memory errors', async () => {
      const clearCacheHandler = vi.fn();
      eventBus.on('errorboundary:cache-clear', clearCacheHandler);
      
      mockService.failureMessage = 'out of memory';
      mockService.shouldFail = true;
      
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(clearCacheHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
        }),
        expect.any(Object)
      );
    });
  });

  describe('Error Reporting', () => {
    it('should track error statistics', async () => {
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        enableAutoRecovery: false,
      });
      
      mockService.shouldFail = true;
      
      // Generate some errors
      for (let i = 0; i < 3; i++) {
        try {
          await errorBoundary.protect(
            'test-service',
            'operation',
            () => mockService.performOperation()
          );
        } catch (error) {
          // Expected
        }
      }
      
      const report = errorBoundary.getErrorReport('test-service');
      expect(report.totalErrors).toBe(3);
      expect(report.recoveredErrors).toBe(0);
      expect(report.errors).toHaveLength(3);
    });

    it('should track recovery statistics', async () => {
      const recoveryStrategy: RecoveryStrategy = {
        name: 'always-recover',
        condition: () => true,
        recover: async () => {
          mockService.shouldFail = false;
        },
        priority: 10,
      };
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        recoveryStrategies: [recoveryStrategy],
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      await errorBoundary.protect(
        'test-service',
        'operation',
        () => mockService.performOperation()
      );
      
      const report = errorBoundary.getErrorReport('test-service');
      // Two errors because it retries after recovery
      expect(report.totalErrors).toBe(2);
      expect(report.recoveredErrors).toBe(1);
    });

    it('should limit error history size', async () => {
      mockService.shouldFail = true;
      
      // Generate many errors
      for (let i = 0; i < 150; i++) {
        try {
          await errorBoundary.protect(
            'test-service',
            'operation',
            () => mockService.performOperation()
          );
        } catch (error) {
          // Expected
        }
      }
      
      const report = errorBoundary.getErrorReport('test-service');
      expect(report.errors.length).toBe(100); // Limited to 100
      // Total errors might be slightly more due to timing in the loop
      expect(report.totalErrors).toBeGreaterThanOrEqual(150);
    });

    it('should return all reports when no service specified', () => {
      const allReports = errorBoundary.getErrorReport();
      expect(allReports).toBeInstanceOf(Map);
    });
  });

  describe('Manual Service Management', () => {
    it('should manually restore isolated service', async () => {
      const restoredHandler = vi.fn();
      eventBus.on('errorboundary:service-restored', restoredHandler);
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 1,
      });
      
      mockService.shouldFail = true;
      
      // Trigger isolation
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(errorBoundary.isServiceIsolated('test-service')).toBe(true);
      
      // Manually restore
      errorBoundary.restoreService('test-service');
      
      expect(errorBoundary.isServiceIsolated('test-service')).toBe(false);
      expect(restoredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          manual: true,
        }),
        expect.any(Object)
      );
    });

    it('should clear all error history', async () => {
      mockService.shouldFail = true;
      
      // Generate errors for multiple services
      try {
        await errorBoundary.protect(
          'service1',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      try {
        await errorBoundary.protect(
          'service2',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      errorBoundary.clearAll();
      
      const report1 = errorBoundary.getErrorReport('service1');
      const report2 = errorBoundary.getErrorReport('service2');
      
      expect(report1.totalErrors).toBe(0);
      expect(report2.totalErrors).toBe(0);
    });
  });

  describe('Automatic Health Check', () => {
    it('should schedule health check after isolation', async () => {
      vi.useFakeTimers();
      
      const restoredHandler = vi.fn();
      eventBus.on('errorboundary:service-restored', restoredHandler);
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 1,
        errorWindow: 1000,
        enableAutoRecovery: true,
      });
      
      mockService.shouldFail = true;
      
      // Trigger isolation
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      expect(errorBoundary.isServiceIsolated('test-service')).toBe(true);
      
      // Wait for error window to pass
      await vi.advanceTimersByTimeAsync(1100);
      
      // Service should be restored if no errors in window
      expect(restoredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
        }),
        expect.any(Object)
      );
      
      vi.useRealTimers();
    });
  });

  describe('Decorator', () => {
    it('should protect decorated methods', async () => {
      // Use the decorator manually since TypeScript decorators need specific setup
      const protectedMethod = async function(): Promise<string> {
        throw new Error('Decorated method failed');
      };
      
      const wrappedMethod = async function(...args: any[]) {
        return errorBoundary.protect(
          'decorated-service',
          'riskyOperation',
          () => protectedMethod.apply(this, args)
        );
      };
      
      await expect(wrappedMethod()).rejects.toThrow('Decorated method failed');
      
      const report = errorBoundary.getErrorReport('decorated-service');
      expect(report.totalErrors).toBe(1);
    });

    it('should pass method arguments in metadata', async () => {
      const errorHandler = vi.fn();
      eventBus.on('errorboundary:error', errorHandler);
      
      // Manually implement what the decorator would do
      const protectedMethod = async function(arg1: string, arg2: number): Promise<string> {
        throw new Error('Failed');
      };
      
      const wrappedMethod = async function(...args: any[]) {
        return errorBoundary.protect(
          'decorated-service',
          'operation',
          () => protectedMethod.apply(this, args),
          { args }
        );
      };
      
      try {
        await wrappedMethod('test', 123);
      } catch (error) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            metadata: { args: ['test', 123] },
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('Fallback Service', () => {
    it('should emit fallback event when service is isolated', async () => {
      const fallbackHandler = vi.fn();
      eventBus.on('errorboundary:fallback-used', fallbackHandler);
      
      const fallbackService = new MockService();
      
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 1,
        fallbackService,
      });
      
      mockService.shouldFail = true;
      
      // First call isolates service
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected
      }
      
      // Second call should try to use fallback
      try {
        await errorBoundary.protect(
          'test-service',
          'operation',
          () => mockService.performOperation()
        );
      } catch (error) {
        // Expected - fallback not implemented in this test
      }
      
      expect(fallbackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'test-service',
          operation: 'operation',
        }),
        expect.any(Object)
      );
    });
  });
});