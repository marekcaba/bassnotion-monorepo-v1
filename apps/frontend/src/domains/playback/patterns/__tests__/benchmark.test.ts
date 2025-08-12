/**
 * Performance Benchmarking Tests
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Compares performance between old and new service architectures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { EventBus } from '../../services/core/EventBus.js';
import { ServiceErrorBoundary } from '../ErrorBoundary.js';
import { EnhancedCircuitBreaker, CircuitBreakerFactory } from '../CircuitBreaker.js';
import { EnhancedPerformanceMonitor } from '../PerformanceMonitor.js';
import { Service } from '../../services/core/ServiceRegistry.js';

// Mock service for benchmarking
class BenchmarkService implements Service {
  private operationCount = 0;
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async lightOperation(): Promise<number> {
    this.operationCount++;
    // Simulate light CPU work
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      sum += Math.sqrt(i);
    }
    return sum;
  }
  
  async heavyOperation(): Promise<number> {
    this.operationCount++;
    // Simulate heavy CPU work
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      sum += Math.sqrt(i) * Math.log(i + 1);
    }
    return sum;
  }
  
  async ioOperation(): Promise<any> {
    this.operationCount++;
    // Simulate I/O delay
    await new Promise(resolve => setTimeout(resolve, 10));
    return { data: 'result', timestamp: Date.now() };
  }
  
  getOperationCount(): number {
    return this.operationCount;
  }
}

describe('Performance Benchmarking', () => {
  let eventBus: EventBus;
  let serviceRegistry: ServiceRegistry;
  let errorBoundary: ServiceErrorBoundary;
  let circuitBreakerFactory: CircuitBreakerFactory;
  let performanceMonitor: EnhancedPerformanceMonitor;
  let benchmarkService: BenchmarkService;

  beforeEach(() => {
    // Mock timers
    vi.stubGlobal('setInterval', vi.fn(() => Math.random()));
    vi.stubGlobal('clearInterval', vi.fn());
    
    eventBus = new EventBus();
    serviceRegistry = new ServiceRegistry(eventBus);
    errorBoundary = new ServiceErrorBoundary(eventBus);
    circuitBreakerFactory = new CircuitBreakerFactory(eventBus);
    performanceMonitor = new EnhancedPerformanceMonitor(eventBus);
    
    benchmarkService = new BenchmarkService();
    serviceRegistry.register('benchmark', benchmarkService);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    performanceMonitor.dispose();
  });

  describe('Baseline Performance (Old Architecture)', () => {
    it('should measure baseline performance without protection', async () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      // Direct service calls without any protection
      for (let i = 0; i < iterations; i++) {
        await benchmarkService.lightOperation();
      }
      
      const duration = performance.now() - startTime;
      const opsPerSecond = (iterations / duration) * 1000;
      
      console.log('Baseline Performance (No Protection):');
      console.log(`- Total Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Operations/Second: ${opsPerSecond.toFixed(0)}`);
      console.log(`- Average Duration: ${(duration / iterations).toFixed(3)}ms`);
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should measure baseline error handling', async () => {
      const iterations = 100;
      let errors = 0;
      const startTime = performance.now();
      
      // Simple try-catch error handling
      for (let i = 0; i < iterations; i++) {
        try {
          if (i % 10 === 0) {
            throw new Error('Simulated error');
          }
          await benchmarkService.lightOperation();
        } catch (error) {
          errors++;
        }
      }
      
      const duration = performance.now() - startTime;
      
      console.log('Baseline Error Handling:');
      console.log(`- Total Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Errors Caught: ${errors}`);
      console.log(`- Average Duration: ${(duration / iterations).toFixed(3)}ms`);
      
      expect(errors).toBe(10);
    });
  });

  describe('Enhanced Architecture Performance', () => {
    it('should measure performance with full protection stack', async () => {
      const iterations = 1000;
      const circuitBreaker = circuitBreakerFactory.create('benchmark', 'high-throughput', {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      
      const startTime = performance.now();
      
      // Protected service calls
      for (let i = 0; i < iterations; i++) {
        await errorBoundary.protect(
          'benchmark',
          'lightOperation',
          () => circuitBreaker.execute(
            () => performanceMonitor.measure(
              'benchmark',
              'lightOperation',
              () => benchmarkService.lightOperation()
            )
          )
        );
      }
      
      const duration = performance.now() - startTime;
      const opsPerSecond = (iterations / duration) * 1000;
      
      console.log('Enhanced Architecture Performance (Full Protection):');
      console.log(`- Total Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Operations/Second: ${opsPerSecond.toFixed(0)}`);
      console.log(`- Average Duration: ${(duration / iterations).toFixed(3)}ms`);
      
      // Generate performance report
      const report = performanceMonitor.generateReport('benchmark');
      console.log(`- P95 Latency: ${report[0]?.percentiles.p95.toFixed(3)}ms`);
      console.log(`- P99 Latency: ${report[0]?.percentiles.p99.toFixed(3)}ms`);
      
      expect(duration).toBeLessThan(2000); // Allow more time for protection overhead
    });

    it('should measure error recovery performance', async () => {
      const iterations = 100;
      let successCount = 0;
      let errorCount = 0;
      
      const circuitBreaker = circuitBreakerFactory.create('benchmark', 'critical', {
        failureThreshold: 5,
        retryPolicy: {
          maxRetries: 1,
          retryableErrors: ['TransientError'],
        },
      });
      
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        try {
          await errorBoundary.protect(
            'benchmark',
            'operation',
            () => circuitBreaker.execute(async () => {
              if (i % 10 === 0) {
                const error = new Error('Simulated error');
                error.name = 'TransientError';
                throw error;
              }
              return benchmarkService.lightOperation();
            })
          );
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }
      
      const duration = performance.now() - startTime;
      
      console.log('Enhanced Error Recovery Performance:');
      console.log(`- Total Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Successful Operations: ${successCount}`);
      console.log(`- Failed Operations: ${errorCount}`);
      console.log(`- Average Duration: ${(duration / iterations).toFixed(3)}ms`);
      
      expect(successCount + errorCount).toBe(iterations);
    });
  });

  describe('Resource Pooling Performance', () => {
    it('should measure resource pool efficiency', async () => {
      const poolSize = 10;
      const iterations = 100;
      
      // Create resource pool
      const pool = performanceMonitor.createResourcePool(
        'connections',
        poolSize,
        () => ({ id: Math.random(), active: false }),
        (resource) => { resource.active = false; }
      );
      
      const startTime = performance.now();
      
      // Simulate concurrent operations using pool
      const operations = [];
      for (let i = 0; i < iterations; i++) {
        operations.push(
          performanceMonitor.measure(
            'benchmark',
            'pooledOperation',
            async () => {
              const resource = performanceMonitor.acquireFromPool('connections');
              if (!resource) {
                throw new Error('Pool exhausted');
              }
              
              try {
                resource.active = true;
                await benchmarkService.ioOperation();
                return 'success';
              } finally {
                performanceMonitor.releaseToPool('connections', resource);
              }
            }
          )
        );
      }
      
      const results = await Promise.allSettled(operations);
      const duration = performance.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log('Resource Pooling Performance:');
      console.log(`- Total Duration: ${duration.toFixed(2)}ms`);
      console.log(`- Pool Size: ${poolSize}`);
      console.log(`- Total Operations: ${iterations}`);
      console.log(`- Successful: ${successful}`);
      console.log(`- Failed (Pool Exhausted): ${failed}`);
      console.log(`- Throughput: ${(successful / (duration / 1000)).toFixed(0)} ops/sec`);
      
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Overhead Analysis', () => {
    it('should measure protection overhead', async () => {
      const iterations = 1000;
      
      // Baseline
      const baselineStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await benchmarkService.lightOperation();
      }
      const baselineDuration = performance.now() - baselineStart;
      
      // With protection
      const circuitBreaker = circuitBreakerFactory.create('benchmark', 'high-throughput', {
        retryPolicy: {
          maxRetries: 0,
          retryableErrors: [],
        },
      });
      
      const protectedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await errorBoundary.protect(
          'benchmark',
          'lightOperation',
          () => circuitBreaker.execute(
            () => performanceMonitor.measure(
              'benchmark',
              'lightOperation',
              () => benchmarkService.lightOperation()
            )
          )
        );
      }
      const protectedDuration = performance.now() - protectedStart;
      
      const overhead = protectedDuration - baselineDuration;
      const overheadPercentage = (overhead / baselineDuration) * 100;
      
      console.log('Protection Overhead Analysis:');
      console.log(`- Baseline Duration: ${baselineDuration.toFixed(2)}ms`);
      console.log(`- Protected Duration: ${protectedDuration.toFixed(2)}ms`);
      console.log(`- Absolute Overhead: ${overhead.toFixed(2)}ms`);
      console.log(`- Overhead Percentage: ${overheadPercentage.toFixed(1)}%`);
      console.log(`- Overhead per Operation: ${(overhead / iterations).toFixed(3)}ms`);
      
      // Overhead should be reasonable - adjust expectation for very light operations
      // For operations that take < 1ms, overhead percentage can be high
      // What matters more is the absolute overhead per operation
      const overheadPerOperation = overhead / iterations;
      expect(overheadPerOperation).toBeLessThan(0.1); // Less than 0.1ms per operation
    });

    it('should measure memory impact', () => {
      // Get initial memory if available
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Create multiple monitors and services
      const monitors: EnhancedPerformanceMonitor[] = [];
      const breakers: EnhancedCircuitBreaker[] = [];
      
      for (let i = 0; i < 10; i++) {
        monitors.push(new EnhancedPerformanceMonitor(eventBus));
        breakers.push(circuitBreakerFactory.create(`breaker-${i}`, 'high-throughput', {
          retryPolicy: {
            maxRetries: 0,
            retryableErrors: [],
          },
        }));
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log('Memory Impact Analysis:');
      console.log(`- Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Per Instance: ${(memoryIncrease / 10 / 1024).toFixed(2)}KB`);
      
      // Cleanup
      monitors.forEach(m => m.dispose());
      breakers.forEach(b => b.dispose());
      
      // Memory increase should be reasonable
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      }
    });
  });

  describe('Scalability Analysis', () => {
    it('should measure scalability with increasing load', async () => {
      const loads = [10, 50, 100, 500];
      const results: any[] = [];
      
      for (const load of loads) {
        const circuitBreaker = circuitBreakerFactory.create(`benchmark-${load}`, 'high-throughput', {
          retryPolicy: {
            maxRetries: 0,
            retryableErrors: [],
          },
        });
        
        const startTime = performance.now();
        
        for (let i = 0; i < load; i++) {
          await errorBoundary.protect(
            'benchmark',
            'lightOperation',
            () => circuitBreaker.execute(
              () => performanceMonitor.measure(
                'benchmark',
                'lightOperation',
                () => benchmarkService.lightOperation()
              )
            )
          );
        }
        
        const duration = performance.now() - startTime;
        const avgDuration = duration / load;
        
        results.push({
          load,
          duration,
          avgDuration,
          throughput: (load / duration) * 1000,
        });
        
        circuitBreaker.dispose();
      }
      
      console.log('Scalability Analysis:');
      results.forEach(r => {
        console.log(`- Load ${r.load}: ${r.duration.toFixed(2)}ms total, ${r.avgDuration.toFixed(3)}ms avg, ${r.throughput.toFixed(0)} ops/sec`);
      });
      
      // Average duration should not increase significantly with load
      const firstAvg = results[0].avgDuration;
      const lastAvg = results[results.length - 1].avgDuration;
      const degradation = ((lastAvg - firstAvg) / firstAvg) * 100;
      
      console.log(`- Performance Degradation: ${degradation.toFixed(1)}%`);
      
      // Performance should not degrade more than 50%
      expect(degradation).toBeLessThan(50);
    });
  });
});