/**
 * EventBus Enhanced Tests
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Comprehensive tests for enhanced EventBus features including:
 * - Event batching
 * - Schema validation
 * - Event analytics
 * - Performance metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, EventData, EventHandler } from '../EventBus.js';

describe('EventBus - Enhanced Features', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({
      maxEventHistory: 10,
      enableReplay: true,
      enableBatching: false, // Disable by default for most tests
      enableSchemaValidation: false,
    });
  });

  afterEach(async () => {
    await eventBus.dispose();
    vi.clearAllTimers();
  });

  describe('Event Batching', () => {
    it('should batch events when enabled', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        batchSize: 3,
        batchTimeout: 100,
      });

      const handler = vi.fn();
      eventBus.on('test-event', handler);

      // Emit multiple events
      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });
      
      // Events should not be processed yet
      expect(handler).not.toHaveBeenCalled();

      // Wait for batch timeout
      await vi.advanceTimersByTimeAsync(100);

      // Now events should be processed
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ value: 1 }),
        expect.any(Object)
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ value: 2 }),
        expect.any(Object)
      );

      vi.useRealTimers();
    });

    it('should flush batch when size limit reached', async () => {
      eventBus = new EventBus({
        enableBatching: true,
        batchSize: 2,
        batchTimeout: 1000, // Long timeout
      });

      const handler = vi.fn();
      eventBus.on('test-event', handler);

      // Emit events up to batch size
      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });

      // Batch should be flushed immediately
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should emit batch-processed event after batch execution', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        batchSize: 5,
        batchTimeout: 50,
      });

      const batchHandler = vi.fn();
      eventBus.on('eventbus:batch-processed', batchHandler);

      await eventBus.emit('test-event', { value: 1 });
      await eventBus.emit('test-event', { value: 2 });

      await vi.advanceTimersByTimeAsync(50);

      expect(batchHandler).toHaveBeenCalledWith(
        expect.objectContaining({ batchSize: 2 }),
        expect.any(Object)
      );

      vi.useRealTimers();
    });
  });

  describe('Schema Validation', () => {
    it('should validate event data against schema', async () => {
      eventBus = new EventBus({
        enableSchemaValidation: true,
      });

      // Register a simple schema
      const schema = {
        required: ['userId', 'action'],
        properties: {
          userId: { type: 'string' },
          action: { type: 'string' },
        },
      };
      
      eventBus.registerSchema('user-action', schema);

      // Mock validation to return false for invalid data
      const validateSpy = vi.spyOn(eventBus as any, 'validateEventData')
        .mockReturnValue(false);

      await expect(
        eventBus.emit('user-action', { invalid: 'data' })
      ).rejects.toThrow('Event data validation failed');

      validateSpy.mockRestore();
    });

    it('should allow valid event data', async () => {
      eventBus = new EventBus({
        enableSchemaValidation: true,
      });

      const schema = { type: 'object' };
      eventBus.registerSchema('test-event', schema);

      // Mock validation to return true
      vi.spyOn(eventBus as any, 'validateEventData').mockReturnValue(true);

      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await expect(
        eventBus.emit('test-event', { valid: 'data' })
      ).resolves.not.toThrow();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Event Analytics', () => {
    it('should track event metrics', async () => {
      const handler = vi.fn();
      eventBus.on('test-event', handler);

      // Emit multiple events
      for (let i = 0; i < 5; i++) {
        await eventBus.emit('test-event', { index: i });
      }

      const analytics = eventBus.getEventAnalytics();
      
      expect(analytics['test-event']).toBeDefined();
      expect(analytics['test-event'].count).toBe(5);
      expect(analytics['test-event'].lastEmitted).toBeDefined();
      expect(analytics['test-event'].averageTime).toBeGreaterThanOrEqual(0);
      expect(analytics['test-event'].handlerCount).toBe(1);
    });

    it('should calculate average execution time', async () => {
      const handler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      eventBus.on('slow-event', handler);

      await eventBus.emit('slow-event', {});
      await eventBus.emit('slow-event', {});

      const analytics = eventBus.getEventAnalytics();
      expect(analytics['slow-event'].averageTime).toBeGreaterThan(0);
      expect(analytics['slow-event'].totalTime).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker Metrics', () => {
    it('should track circuit breaker metrics per event', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      eventBus.on('failing-event', failingHandler);

      // Trigger multiple failures
      for (let i = 0; i < 3; i++) {
        try {
          await eventBus.emit('failing-event', {});
        } catch (error) {
          // Expected
        }
      }

      const metrics = eventBus.getCircuitBreakerMetrics();
      expect(metrics['failing-event']).toBeDefined();
      expect(metrics['failing-event'].failureCount).toBeGreaterThan(0);
    });
  });

  describe('Event History with Batching', () => {
    it('should maintain history even with batching enabled', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        enableReplay: true,
        batchTimeout: 50,
      });

      await eventBus.emit('event1', { data: 'test1' });
      await eventBus.emit('event2', { data: 'test2' });

      // Process batch
      await vi.advanceTimersByTimeAsync(50);

      const history = eventBus.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].event).toBe('event1');
      expect(history[1].event).toBe('event2');

      vi.useRealTimers();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high volume of events efficiently', async () => {
      const handler = vi.fn();
      eventBus.on('load-test', handler);

      const startTime = performance.now();
      const eventCount = 1000;

      // Emit many events
      const promises = [];
      for (let i = 0; i < eventCount; i++) {
        promises.push(eventBus.emit('load-test', { index: i }));
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(handler).toHaveBeenCalledTimes(eventCount);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second

      const analytics = eventBus.getEventAnalytics();
      expect(analytics['load-test'].count).toBe(eventCount);
    });

    it('should efficiently batch high volume events', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        batchSize: 100,
        batchTimeout: 50,
      });

      const handler = vi.fn();
      eventBus.on('batch-load-test', handler);

      // Emit many events
      for (let i = 0; i < 250; i++) {
        await eventBus.emit('batch-load-test', { index: i });
      }

      // Should have processed 2 full batches immediately
      expect(handler).toHaveBeenCalledTimes(200);

      // Process remaining batch
      await vi.advanceTimersByTimeAsync(50);
      expect(handler).toHaveBeenCalledTimes(250);

      vi.useRealTimers();
    });
  });

  describe('Stop and Dispose with Batching', () => {
    it('should flush pending batch on stop', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        batchTimeout: 1000, // Long timeout
      });

      const handler = vi.fn();
      eventBus.on('test-event', handler);

      await eventBus.emit('test-event', { value: 1 });
      
      // Stop should flush batch
      await eventBus.stop();

      expect(handler).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should clean up all resources on dispose', async () => {
      eventBus = new EventBus({
        enableBatching: true,
        enableSchemaValidation: true,
      });

      eventBus.registerSchema('test', {});
      eventBus.on('test', vi.fn());
      
      await eventBus.emit('test', {});
      
      await eventBus.dispose();

      expect(eventBus.getHistory()).toEqual([]);
      expect(eventBus.getEventAnalytics()).toEqual({});
      expect(eventBus.getRegisteredEvents()).toEqual([]);
    });
  });

  describe('Error Handling in Batch Mode', () => {
    it('should handle errors in batch processing', async () => {
      vi.useFakeTimers();
      
      eventBus = new EventBus({
        enableBatching: true,
        batchTimeout: 50,
      });

      const errorHandler = vi.fn().mockRejectedValue(new Error('Batch handler error'));
      const successHandler = vi.fn();
      
      eventBus.on('error-event', errorHandler);
      eventBus.on('success-event', successHandler);

      await eventBus.emit('error-event', {});
      await eventBus.emit('success-event', {});

      await vi.advanceTimersByTimeAsync(50);

      // Both handlers should be called despite error
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});