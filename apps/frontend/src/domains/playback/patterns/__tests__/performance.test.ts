/**
 * Performance Tests for Architectural Patterns
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Validates performance characteristics of the new service architecture
 * and ensures optimization goals are met.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { EventBus } from '../../services/core/EventBus.js';
import { EnhancedCircuitBreaker } from '../CircuitBreaker.js';
import { ServiceErrorBoundary } from '../ErrorBoundary.js';
import { EnhancedPerformanceMonitor } from '../PerformanceMonitor.js';
import { CommandQueue } from '../../commands/CommandQueue.js';
import { Command, CommandResult } from '../../commands/Command.js';
import { CircuitBreaker } from '../../services/errors/CircuitBreaker.js';

// Mock service for testing
class MockService {
  private operationCount = 0;
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async start(): Promise<void> {
    // Mock start
  }
  
  async stop(): Promise<void> {
    // Mock stop
  }
  
  async performOperation(duration = 1): Promise<void> {
    this.operationCount++;
    await new Promise(resolve => setTimeout(resolve, duration));
  }
  
  getOperationCount(): number {
    return this.operationCount;
  }
  
  reset(): void {
    this.operationCount = 0;
  }
}

// Mock command for testing
class TestCommand extends Command<string> {
  constructor(private value: string) {
    super('test-command');
  }
  
  async execute(): Promise<CommandResult<string>> {
    return {
      success: true,
      data: this.value,
      timestamp: Date.now(),
    };
  }
  
  async undo(): Promise<CommandResult<string>> {
    return {
      success: true,
      data: `Undone: ${this.value}`,
      timestamp: Date.now(),
    };
  }
  
  clone(): TestCommand {
    return new TestCommand(this.value);
  }
}

describe('Performance Tests', () => {
  let eventBus: EventBus;
  let mockService: MockService;

  beforeEach(() => {
    eventBus = new EventBus();
    mockService = new MockService();
  });

  afterEach(async () => {
    await eventBus.dispose();
  });

  describe('Pattern Overhead', () => {
    it('should have minimal overhead for circuit breaker', async () => {
      const circuitBreaker = new CircuitBreaker('test', {
        failureThreshold: 5,
        recoveryTimeout: 1000,
      });

      const iterations = 1000;
      const directStart = Date.now();
      
      // Direct calls
      for (let i = 0; i < iterations; i++) {
        await mockService.performOperation(0);
      }
      
      const directTime = Date.now() - directStart;
      mockService.reset();

      // Calls through circuit breaker
      const cbStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await circuitBreaker.execute(() => mockService.performOperation(0));
      }
      
      const cbTime = Date.now() - cbStart;
      
      const overhead = (cbTime - directTime) / iterations;
      console.log(`Circuit Breaker overhead: ${overhead.toFixed(3)}ms per operation`);
      
      // Should have less than 0.5ms overhead per operation
      expect(overhead).toBeLessThan(0.5);
    });

    it('should have minimal overhead for error boundary', async () => {
      const errorBoundary = new ServiceErrorBoundary(eventBus);
      
      const iterations = 1000;
      const directStart = Date.now();
      
      // Direct calls
      for (let i = 0; i < iterations; i++) {
        await mockService.performOperation(0);
      }
      
      const directTime = Date.now() - directStart;
      mockService.reset();

      // Calls through error boundary
      const ebStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await errorBoundary.protect('test', 'performOperation', () => mockService.performOperation(0));
      }
      
      const ebTime = Date.now() - ebStart;
      
      const overhead = (ebTime - directTime) / iterations;
      console.log(`Error Boundary overhead: ${overhead.toFixed(3)}ms per operation`);
      
      // Should have less than 0.5ms overhead per operation
      expect(overhead).toBeLessThan(0.5);
    });

    it('should have acceptable overhead for combined patterns', async () => {
      const circuitBreaker = new CircuitBreaker('test');
      const errorBoundary = new ServiceErrorBoundary(eventBus);
      const performanceMonitor = new EnhancedPerformanceMonitor('test');
      
      const iterations = 100;
      const directStart = Date.now();
      
      // Direct calls
      for (let i = 0; i < iterations; i++) {
        await mockService.performOperation(0);
      }
      
      const directTime = Date.now() - directStart;
      mockService.reset();

      // Calls through combined patterns
      const stackStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await performanceMonitor.measure('test', 'operation', async () => {
          await errorBoundary.protect('test', 'performOperation', async () => {
            return circuitBreaker.execute(() => mockService.performOperation(0));
          });
        });
      }
      
      const stackTime = Date.now() - stackStart;
      
      const overhead = (stackTime - directTime) / iterations;
      console.log(`Combined patterns overhead: ${overhead.toFixed(3)}ms per operation`);
      
      // Should have less than 1ms overhead per operation
      expect(overhead).toBeLessThan(1);
    });
  });

  describe('Command Queue Performance', () => {
    it('should process commands efficiently', async () => {
      const commandQueue = new CommandQueue(eventBus);
      const commands: TestCommand[] = [];
      const commandCount = 100;
      
      // Create commands
      for (let i = 0; i < commandCount; i++) {
        commands.push(new TestCommand(`command-${i}`));
      }
      
      const start = Date.now();
      
      // Execute all commands
      const results = await Promise.all(
        commands.map(cmd => commandQueue.execute(cmd))
      );
      
      const executionTime = Date.now() - start;
      const throughput = commandCount / (executionTime / 1000);
      
      console.log(`Command execution time for ${commandCount} commands: ${executionTime}ms`);
      console.log(`Command throughput: ${throughput.toFixed(2)} commands/second`);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(throughput).toBeGreaterThan(100); // At least 100 commands/second
    });

    it('should handle undo/redo efficiently', async () => {
      const commandQueue = new CommandQueue(eventBus);
      const commands: TestCommand[] = [];
      const operationCount = 50;
      
      // Execute commands
      for (let i = 0; i < operationCount; i++) {
        await commandQueue.execute(new TestCommand(`command-${i}`));
      }
      
      // Measure undo performance
      const undoStart = Date.now();
      for (let i = 0; i < operationCount; i++) {
        await commandQueue.undo();
      }
      const undoTime = Date.now() - undoStart;
      
      // Measure redo performance
      const redoStart = Date.now();
      for (let i = 0; i < operationCount; i++) {
        await commandQueue.redo();
      }
      const redoTime = Date.now() - redoStart;
      
      console.log(`Undo time for ${operationCount} operations: ${undoTime}ms`);
      console.log(`Redo time for ${operationCount} operations: ${redoTime}ms`);
      
      expect(undoTime).toBeLessThan(operationCount * 10); // Less than 10ms per operation
      expect(redoTime).toBeLessThan(operationCount * 10);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory in event bus', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;
      
      // Subscribe and unsubscribe many times
      for (let i = 0; i < iterations; i++) {
        const handler = () => {};
        const unsubscribe = eventBus.on(`event-${i}`, handler);
        unsubscribe();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const growthPerIteration = memoryGrowth / iterations;
      
      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Growth per iteration: ${growthPerIteration.toFixed(2)} bytes`);
      
      // Should have minimal memory growth
      expect(growthPerIteration).toBeLessThan(1000); // Less than 1KB per iteration
    });

    it('should properly clean up disposed services', async () => {
      const registry = new ServiceRegistry();
      const services: MockService[] = [];
      
      // Register many services
      for (let i = 0; i < 100; i++) {
        const service = new MockService();
        services.push(service);
        registry.register(`service-${i}`, service);
      }
      
      await registry.initialize();
      await registry.start();
      
      const beforeDispose = process.memoryUsage().heapUsed;
      
      // Dispose registry
      await registry.dispose();
      
      // Clear references
      services.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterDispose = process.memoryUsage().heapUsed;
      
      console.log(`Memory before dispose: ${(beforeDispose / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory after dispose: ${(afterDispose / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory should decrease after disposal
      expect(afterDispose).toBeLessThan(beforeDispose * 1.1); // Allow 10% margin
    });
  });

  describe('Scalability', () => {
    it('should handle many services efficiently', async () => {
      const registry = new ServiceRegistry();
      const serviceCount = 50; // Reduced for faster testing
      
      // Register many services
      const registerStart = Date.now();
      
      for (let i = 0; i < serviceCount; i++) {
        registry.register(`service-${i}`, new MockService());
      }
      
      const registerTime = Date.now() - registerStart;
      
      // Initialize all services
      const initStart = Date.now();
      await registry.initialize();
      const initTime = Date.now() - initStart;
      
      // Start all services
      const startStart = Date.now();
      await registry.start();
      const startTime = Date.now() - startStart;
      
      console.log(`Registration time for ${serviceCount} services: ${registerTime}ms`);
      console.log(`Initialization time: ${initTime}ms`);
      console.log(`Start time: ${startTime}ms`);
      
      // Should complete in reasonable time
      expect(registerTime).toBeLessThan(50);
      expect(initTime).toBeLessThan(500);
      expect(startTime).toBeLessThan(500);
      
      // Get service report for all services
      const reportStart = Date.now();
      const report = registry.getServiceReport();
      const reportTime = Date.now() - reportStart;
      
      console.log(`Service report time: ${reportTime}ms`);
      expect(reportTime).toBeLessThan(100);
      expect(Object.keys(report)).toHaveLength(serviceCount);
      
      await registry.dispose();
    });

    it('should handle high event throughput', async () => {
      const eventCount = 10000;
      let receivedCount = 0;
      
      eventBus.on('test-event', () => {
        receivedCount++;
      });
      
      const start = Date.now();
      
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('test-event', { index: i });
      }
      
      const emitTime = Date.now() - start;
      const throughput = eventCount / (emitTime / 1000);
      
      console.log(`Event emission time: ${emitTime}ms`);
      console.log(`Event throughput: ${throughput.toFixed(0)} events/second`);
      
      expect(receivedCount).toBe(eventCount);
      expect(throughput).toBeGreaterThan(10000); // At least 10k events/second
    });
  });

  describe('Performance Monitoring', () => {
    it('should track metrics with minimal overhead', async () => {
      const monitor = new EnhancedPerformanceMonitor('test');
      const iterations = 1000;
      
      // Measure overhead of metric tracking
      const withoutMetricsStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await mockService.performOperation(0);
      }
      
      const withoutMetricsTime = Date.now() - withoutMetricsStart;
      mockService.reset();
      
      const withMetricsStart = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await monitor.measure('test', 'operation', async () => {
          await mockService.performOperation(0);
        });
      }
      
      const withMetricsTime = Date.now() - withMetricsStart;
      
      const overhead = (withMetricsTime - withoutMetricsTime) / iterations;
      console.log(`Performance monitoring overhead: ${overhead.toFixed(3)}ms per operation`);
      
      // Should have minimal overhead
      expect(overhead).toBeLessThan(0.1);
    });
  });

  describe('Integration Performance', () => {
    it('should maintain performance with service registry and patterns', async () => {
      const registry = new ServiceRegistry();
      const circuitBreaker = new CircuitBreaker('test-service');
      const errorBoundary = new ServiceErrorBoundary(eventBus);
      
      // Register services
      for (let i = 0; i < 10; i++) {
        registry.register(`service-${i}`, new MockService());
      }
      
      await registry.initialize();
      await registry.start();

      const operations = 100;
      const concurrency = 10;
      
      const start = Date.now();
      
      // Run concurrent operations through patterns
      const batches = [];
      for (let i = 0; i < operations / concurrency; i++) {
        const batch = Array(concurrency).fill(null).map(() =>
          errorBoundary.protect('test-service', 'performOperation', () =>
            circuitBreaker.execute(() => mockService.performOperation(5))
          )
        );
        batches.push(Promise.all(batch));
      }
      
      await Promise.all(batches);
      
      const totalTime = Date.now() - start;
      const throughput = operations / (totalTime / 1000);
      const avgLatency = totalTime / operations;
      
      console.log(`Total operations: ${operations}`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} ops/second`);
      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      
      // Performance requirements
      expect(throughput).toBeGreaterThan(50); // At least 50 ops/second
      expect(avgLatency).toBeLessThan(20); // Less than 20ms average latency
      
      await registry.dispose();
    });
  });
});