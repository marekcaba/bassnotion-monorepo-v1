/**
 * Integration Tests for Service Architecture Patterns
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Tests the interaction between:
 * - ServiceRegistry and EventBus
 * - CircuitBreaker, ErrorBoundary, and PerformanceMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { EventBus } from '../../services/core/EventBus.js';
import { ServiceErrorBoundary } from '../ErrorBoundary.js';
import { EnhancedCircuitBreaker, CircuitBreakerFactory } from '../CircuitBreaker.js';
import { EnhancedPerformanceMonitor } from '../PerformanceMonitor.js';
import { Service } from '../../services/core/ServiceRegistry.js';
import { CircuitState } from '../../services/errors/CircuitBreaker.js';

// Mock services for testing
class MockDatabaseService implements Service {
  private failureCount = 0;
  private shouldFail = false;
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async query(sql: string): Promise<any[]> {
    if (this.shouldFail) {
      this.failureCount++;
      throw new Error('Database connection failed');
    }
    return [{ id: 1, name: 'Test' }];
  }
  
  setFailure(fail: boolean): void {
    this.shouldFail = fail;
  }
  
  getFailureCount(): number {
    return this.failureCount;
  }
}

class MockCacheService implements Service {
  private cache = new Map<string, any>();
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }
  
  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Mock operation result type
interface UserData {
  id: number;
  name: string;
}

describe('Service Architecture Integration', () => {
  let serviceRegistry: ServiceRegistry;
  let eventBus: EventBus;
  let errorBoundary: ServiceErrorBoundary;
  let circuitBreakerFactory: CircuitBreakerFactory;
  let performanceMonitor: EnhancedPerformanceMonitor;
  let dbService: MockDatabaseService;
  let cacheService: MockCacheService;

  beforeEach(() => {
    // Mock timers
    vi.stubGlobal('setInterval', vi.fn(() => Math.random()));
    vi.stubGlobal('clearInterval', vi.fn());
    
    eventBus = new EventBus();
    serviceRegistry = new ServiceRegistry(eventBus);
    errorBoundary = new ServiceErrorBoundary(eventBus);
    circuitBreakerFactory = new CircuitBreakerFactory(eventBus);
    performanceMonitor = new EnhancedPerformanceMonitor(eventBus);
    
    dbService = new MockDatabaseService();
    cacheService = new MockCacheService();
    
    // Register services
    serviceRegistry.register('database', dbService);
    serviceRegistry.register('cache', cacheService);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    performanceMonitor.dispose();
  });

  describe('Service with Circuit Breaker and Error Boundary', () => {
    it('should protect service calls with circuit breaker and error boundary', async () => {
      const circuitBreaker = circuitBreakerFactory.create('db-breaker', 'high-throughput', {
        failureThreshold: 3,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      
      // Protected service method
      const protectedQuery = async (sql: string) => {
        return errorBoundary.protect(
          'database',
          'query',
          () => circuitBreaker.execute(() => dbService.query(sql))
        );
      };
      
      // Successful call
      const result1 = await protectedQuery('SELECT * FROM users');
      expect(result1).toEqual([{ id: 1, name: 'Test' }]);
      
      // Trigger failures
      dbService.setFailure(true);
      
      // Failures should be caught by error boundary
      const failurePromises = [];
      for (let i = 0; i < 10; i++) {
        failurePromises.push(
          protectedQuery('SELECT * FROM users').catch(err => err)
        );
      }
      
      const errors = await Promise.all(failurePromises);
      expect(errors.every(e => e instanceof Error)).toBe(true);
      
      // Circuit should be open after failures
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Service should be isolated
      expect(errorBoundary.isServiceIsolated('database')).toBe(true);
    });

    it('should emit events for monitoring', async () => {
      const events: any[] = [];
      
      // Subscribe to events
      eventBus.on('circuitbreaker:state-changed', (event) => {
        events.push({ type: 'circuit-state', ...event });
      });
      
      eventBus.on('errorboundary:error', (event) => {
        events.push({ type: 'error', ...event });
      });
      
      eventBus.on('performance:slow-operation', (event) => {
        events.push({ type: 'slow-op', ...event });
      });
      
      const circuitBreaker = circuitBreakerFactory.create('db-breaker', 'critical', {
        failureThreshold: 2,
      });
      
      // Mock slow operation
      const slowQuery = async () => {
        const start = performance.now();
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return errorBoundary.protect(
          'database',
          'slowQuery',
          () => circuitBreaker.execute(async () => {
            if (dbService['shouldFail']) {
              throw new Error('Query timeout');
            }
            return [];
          })
        );
      };
      
      // Configure performance monitor for low threshold
      performanceMonitor = new EnhancedPerformanceMonitor(eventBus, {
        performanceWarningThreshold: 50, // 50ms
      });
      
      // Execute slow operation
      dbService.setFailure(true);
      
      try {
        await performanceMonitor.measure(
          'database',
          'slowQuery',
          () => slowQuery()
        );
      } catch (error) {
        // Expected
      }
      
      // Should have error and circuit state events
      expect(events.some(e => e.type === 'error')).toBe(true);
      expect(events.some(e => e.type === 'slow-op')).toBe(true);
    });
  });

  describe('Service Operations with Protection', () => {
    it('should execute operations with full protection stack', async () => {
      const circuitBreaker = circuitBreakerFactory.create('user-service', 'critical');
      
      // Protected operation with caching
      const getUser = async (id: number): Promise<UserData> => {
        // Check cache first
        const cached = await cacheService.get(`user:${id}`);
        if (cached) {
          return cached;
        }
        
        // Query database with protection
        const data = await errorBoundary.protect(
          'database',
          'getUser',
          () => circuitBreaker.execute(
            () => performanceMonitor.measure(
              'database',
              'getUser',
              async () => {
                const result = await dbService.query(`SELECT * FROM users WHERE id = ${id}`);
                if (result.length === 0) {
                  throw new Error('User not found');
                }
                return result[0];
              }
            )
          )
        );
        
        // Cache result
        await cacheService.set(`user:${id}`, data);
        
        return data;
      };
      
      // Execute operation
      const result = await getUser(1);
      expect(result).toEqual({ id: 1, name: 'Test' });
      
      // Verify cached
      const cached = await cacheService.get('user:1');
      expect(cached).toEqual({ id: 1, name: 'Test' });
      
      // Test with failure
      dbService.setFailure(true);
      cacheService.clear();
      
      await expect(getUser(2)).rejects.toThrow();
    });
  });

  describe('Recovery and Fallback Mechanisms', () => {
    it('should use fallback service when primary fails', async () => {
      const primaryBreaker = circuitBreakerFactory.create('primary-db', 'critical', {
        failureThreshold: 1,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
        fallbackOperation: async () => {
          // Fallback to cache
          return cacheService.get('fallback-data') || { id: 0, name: 'Fallback' };
        }
      });
      
      // Prepare fallback data
      await cacheService.set('fallback-data', { id: 99, name: 'Cached Fallback' });
      
      // Primary service fails immediately
      dbService.setFailure(true);
      
      // First call opens circuit
      try {
        await primaryBreaker.execute(() => dbService.query('SELECT * FROM users'));
      } catch (error) {
        // Expected
      }
      
      // Second call should use fallback
      const result = await primaryBreaker.execute(() => dbService.query('SELECT * FROM users'));
      expect(result).toEqual({ id: 99, name: 'Cached Fallback' });
    });

    it('should recover service after health check', async () => {
      vi.useFakeTimers();
      
      const healthCheckHandler = vi.fn();
      const recoveredHandler = vi.fn();
      
      eventBus.on('circuitbreaker:state-changed', (event) => {
        if (event.reason === 'health-check-passed') {
          healthCheckHandler(event);
        }
      });
      
      eventBus.on('errorboundary:service-restored', recoveredHandler);
      
      const circuitBreaker = circuitBreakerFactory.create('db-health', 'critical', {
        failureThreshold: 1,
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
        healthCheckInterval: 1000,
        healthCheckOperation: async () => {
          // Check if database is responding
          dbService.setFailure(false);
          try {
            await dbService.query('SELECT 1');
            return true;
          } catch {
            return false;
          }
        }
      });
      
      // Configure error boundary for auto recovery
      errorBoundary = new ServiceErrorBoundary(eventBus, {
        maxErrors: 1,
        errorWindow: 5000,
        enableAutoRecovery: true,
      });
      
      // Fail the service
      dbService.setFailure(true);
      
      try {
        await errorBoundary.protect(
          'database',
          'query',
          () => circuitBreaker.execute(() => dbService.query('SELECT * FROM users'))
        );
      } catch (error) {
        // Expected
      }
      
      // Circuit is open, service is isolated
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(errorBoundary.isServiceIsolated('database')).toBe(true);
      
      // Advance time for health check
      await vi.advanceTimersByTimeAsync(1000);
      
      // Health check should pass and circuit should move to half-open
      expect(healthCheckHandler).toHaveBeenCalled();
      
      // Advance time for error window
      await vi.advanceTimersByTimeAsync(5000);
      
      // Service should be restored
      expect(recoveredHandler).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Performance Monitoring and Optimization', () => {
    it('should monitor and optimize under load', async () => {
      const memoryOptimizedHandler = vi.fn();
      const poolExhaustedHandler = vi.fn();
      
      eventBus.on('performance:memory-optimized', memoryOptimizedHandler);
      eventBus.on('performance:pool-exhausted', poolExhaustedHandler);
      
      // Create resource pool for connections with small size
      const connectionPool = performanceMonitor.createResourcePool(
        'db-connections',
        2, // Small pool to ensure exhaustion
        () => ({ id: Math.random(), connected: true }),
        (conn) => { conn.connected = false; }
      );
      
      // Mock performance.now for consistent timing
      let timeOffset = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => Date.now() + (timeOffset += 10));
      
      // Acquire all connections without releasing to force exhaustion
      const conn1 = performanceMonitor.acquireFromPool('db-connections');
      const conn2 = performanceMonitor.acquireFromPool('db-connections');
      const conn3 = performanceMonitor.acquireFromPool('db-connections'); // This should fail
      
      expect(conn1).not.toBeNull();
      expect(conn2).not.toBeNull();
      expect(conn3).toBeNull(); // Pool exhausted
      expect(poolExhaustedHandler).toHaveBeenCalled();
      
      // Now measure some operations
      if (conn1) performanceMonitor.releaseToPool('db-connections', conn1);
      
      await performanceMonitor.measure(
        'database',
        'query',
        async () => {
          const conn = performanceMonitor.acquireFromPool('db-connections');
          if (!conn) {
            throw new Error('No connections available');
          }
          
          try {
            return { success: true };
          } finally {
            performanceMonitor.releaseToPool('db-connections', conn);
          }
        }
      );
      
      // Generate report
      const report = performanceMonitor.generateReport('database');
      expect(report).toHaveLength(1);
      expect(report[0].totalOperations).toBeGreaterThan(0);
    });

    it('should compare performance with baseline', async () => {
      // Mock performance.now for consistent timing
      let timeOffset = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        // Return increasing time with consistent increments
        return Date.now() + (timeOffset += 50); // 50ms per operation for baseline
      });
      
      // Generate baseline metrics
      for (let i = 0; i < 10; i++) {
        await performanceMonitor.measure(
          'database',
          'query',
          async () => {
            return { success: true };
          }
        );
      }
      
      const baseline = performanceMonitor.generateReport('database');
      expect(baseline).toHaveLength(1);
      expect(baseline[0].totalOperations).toBe(10);
      
      // Clear metrics and generate improved performance
      performanceMonitor.dispose();
      // Re-mock setInterval for the new monitor instance
      vi.stubGlobal('setInterval', vi.fn(() => Math.random()));
      vi.stubGlobal('clearInterval', vi.fn());
      performanceMonitor = new EnhancedPerformanceMonitor(eventBus);
      
      // Reset timing for improved performance (20ms per operation)
      timeOffset = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        return Date.now() + (timeOffset += 20); // Faster operations
      });
      
      for (let i = 0; i < 10; i++) {
        await performanceMonitor.measure(
          'database',
          'query',
          async () => {
            return { success: true };
          }
        );
      }
      
      const current = performanceMonitor.generateReport('database');
      expect(current).toHaveLength(1);
      expect(current[0].totalOperations).toBe(10);
      
      // Compare
      const comparison = performanceMonitor.compareWithBaseline(baseline, current);
      
      expect(comparison['database']).toBeDefined();
      expect(comparison['database'].durationImprovement.average).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Service Flow', () => {
    it('should handle complete request flow with all protections', async () => {
      // Setup monitoring
      const events: any[] = [];
      const eventTypes = [
        'service:registered',
        'circuitbreaker:state-changed',
        'errorboundary:error',
        'performance:measured',
        'performance:pool-created',
      ];
      
      eventTypes.forEach(type => {
        eventBus.on(type, (event) => {
          events.push({ type, timestamp: Date.now(), ...event });
        });
      });
      
      // Create protected service method
      const protectedDbQuery = async (sql: string) => {
        const circuitBreaker = circuitBreakerFactory.create('db-query', 'high-throughput', {
          retryPolicy: {
            maxRetries: 0,
            retryableErrors: [],
          },
        });
        
        return await errorBoundary.protect(
          'database',
          'query',
          () => circuitBreaker.execute(
            () => performanceMonitor.measure(
              'database',
              'query',
              () => dbService.query(sql)
            )
          )
        );
      };
      
      // Create cached query function
      const cachedQuery = async (sql: string): Promise<any[]> => {
        const cacheKey = `query:${sql}`;
        
        // Check cache
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached;
        }
        
        // Execute protected query
        const result = await protectedDbQuery(sql);
        
        // Cache result
        await cacheService.set(cacheKey, result);
        
        return result;
      };
      
      // Execute query multiple times
      const sql = 'SELECT * FROM products';
      
      // First call - hits database
      const result1 = await cachedQuery(sql);
      expect(result1).toEqual([{ id: 1, name: 'Test' }]);
      
      // Second call - hits cache
      const result2 = await cachedQuery(sql);
      expect(result2).toEqual([{ id: 1, name: 'Test' }]);
      
      // Create a resource pool to trigger an event
      performanceMonitor.createResourcePool(
        'test-pool',
        1,
        () => ({ resource: true })
      );
      
      // Verify event flow - should have events from operations
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'performance:pool-created')).toBe(true);
      
      // Test failure scenario
      dbService.setFailure(true);
      cacheService.clear();
      
      try {
        await cachedQuery('SELECT * FROM orders');
      } catch (error) {
        // Expected failure
      }
      
      // Generate performance report
      const reports = performanceMonitor.generateReport();
      expect(reports.length).toBeGreaterThan(0);
      
      // Get error report
      const errorReport = errorBoundary.getErrorReport('database');
      expect(errorReport.totalErrors).toBeGreaterThan(0);
    });
  });
});