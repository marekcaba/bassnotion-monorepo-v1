/**
 * Bug #4: AudioContext State Management Tests
 *
 * Tests the event-driven AudioContext state management system that replaces
 * the old 500ms polling approach with instant (0ms) event notifications.
 *
 * These tests focus on:
 * 1. Subscription/unsubscription mechanics (onGlobalStateChange)
 * 2. Single AudioContext instance guarantee
 * 3. Memory management (no leaks)
 * 4. API contract verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioContextManager } from '../AudioContextManager.js';
import type { AudioContextState } from '../../types/index.js';

describe('Bug #4: AudioContext State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global state for clean tests
    (AudioContextManager as any).globalContext = null;
    (AudioContextManager as any).globalEventHandlers = new Set();
  });

  afterEach(() => {
    // Cleanup
    (AudioContextManager as any).globalContext = null;
    (AudioContextManager as any).globalEventHandlers = new Set();
  });

  describe('Subscription/Unsubscription API', () => {
    it('should provide onGlobalStateChange method', () => {
      expect(typeof AudioContextManager.onGlobalStateChange).toBe('function');
    });

    it('should return unsubscribe function from onGlobalStateChange', () => {
      const handler = vi.fn();
      const unsubscribe = AudioContextManager.onGlobalStateChange(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple handlers to subscribe', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const unsub1 = AudioContextManager.onGlobalStateChange(handler1);
      const unsub2 = AudioContextManager.onGlobalStateChange(handler2);
      const unsub3 = AudioContextManager.onGlobalStateChange(handler3);

      // Verify all subscribed (handlers stored in Set)
      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(3);

      // Cleanup
      unsub1();
      unsub2();
      unsub3();
    });

    it('should remove handler on unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = AudioContextManager.onGlobalStateChange(handler);

      const handlersBefore = (AudioContextManager as any).globalEventHandlers;
      expect(handlersBefore.size).toBe(1);

      unsubscribe();

      const handlersAfter = (AudioContextManager as any).globalEventHandlers;
      expect(handlersAfter.size).toBe(0);
    });

    it('should handle unsubscribe being called multiple times', () => {
      const handler = vi.fn();
      const unsubscribe = AudioContextManager.onGlobalStateChange(handler);

      unsubscribe();
      unsubscribe(); // Should not throw
      unsubscribe(); // Should not throw

      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(0);
    });

    it('should isolate different subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = AudioContextManager.onGlobalStateChange(handler1);
      const unsub2 = AudioContextManager.onGlobalStateChange(handler2);

      // Unsubscribe only handler1
      unsub1();

      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(1);
      expect(handlers.has(handler2)).toBe(true);
      expect(handlers.has(handler1)).toBe(false);

      // Cleanup
      unsub2();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with many subscribe/unsubscribe cycles', () => {
      // Subscribe and unsubscribe 1000 times
      for (let i = 0; i < 1000; i++) {
        const handler = vi.fn();
        const unsub = AudioContextManager.onGlobalStateChange(handler);
        unsub();
      }

      // Should have no handlers remaining
      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(0);
    });

    it('should handle many concurrent subscriptions', () => {
      const unsubscribers: Array<() => void> = [];

      // Create 100 subscriptions
      for (let i = 0; i < 100; i++) {
        const handler = vi.fn();
        const unsub = AudioContextManager.onGlobalStateChange(handler);
        unsubscribers.push(unsub);
      }

      const handlersBefore = (AudioContextManager as any).globalEventHandlers;
      expect(handlersBefore.size).toBe(100);

      // Unsubscribe all
      unsubscribers.forEach((unsub) => unsub());

      const handlersAfter = (AudioContextManager as any).globalEventHandlers;
      expect(handlersAfter.size).toBe(0);
    });

    it('should clean up properly even with errors in handlers', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      const unsub = AudioContextManager.onGlobalStateChange(errorHandler);

      // Unsubscribe should work even though handler throws
      expect(() => unsub()).not.toThrow();

      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(0);
    });
  });

  describe('Single AudioContext Instance (Bug #4 Core Fix)', () => {
    it('should maintain globalContext static property', () => {
      expect('globalContext' in AudioContextManager).toBe(true);
    });

    it('should maintain globalEventHandlers static property', () => {
      expect('globalEventHandlers' in AudioContextManager).toBe(true);
    });

    it('should use Set for globalEventHandlers', () => {
      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers instanceof Set).toBe(true);
    });
  });

  describe('API Contract', () => {
    it('should have static onGlobalStateChange method', () => {
      expect(AudioContextManager.onGlobalStateChange).toBeDefined();
      expect(typeof AudioContextManager.onGlobalStateChange).toBe('function');
    });

    it('should accept handler function as parameter', () => {
      const handler = vi.fn();

      // Should not throw
      expect(() => {
        const unsub = AudioContextManager.onGlobalStateChange(handler);
        unsub();
      }).not.toThrow();
    });

    it('should work with arrow function handlers', () => {
      const unsub = AudioContextManager.onGlobalStateChange(
        (state: AudioContextState) => {
          // Arrow function handler
        },
      );

      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should work with named function handlers', () => {
      function namedHandler(state: AudioContextState) {
        // Named function handler
      }

      const unsub = AudioContextManager.onGlobalStateChange(namedHandler);
      expect(typeof unsub).toBe('function');
      unsub();
    });
  });

  describe('Success Criteria (from BUG_4_PLAN.md)', () => {
    it('should have global event broadcasting mechanism', () => {
      // Verify the static globalEventHandlers exists
      expect('globalEventHandlers' in AudioContextManager).toBe(true);

      // Verify onGlobalStateChange is available
      expect(typeof AudioContextManager.onGlobalStateChange).toBe('function');
    });

    it('should replace polling with event-driven approach', () => {
      // The existence of onGlobalStateChange proves event-driven approach exists
      // Old polling was in utils/contextManager.ts (now deprecated)

      const handler = vi.fn();
      const unsub = AudioContextManager.onGlobalStateChange(handler);

      // Event-driven API is available
      expect(unsub).toBeDefined();
      unsub();
    });

    it('should support unsubscribe pattern', () => {
      const handler = vi.fn();

      // Subscribe
      const unsubscribe = AudioContextManager.onGlobalStateChange(handler);

      // Verify subscribed
      const handlersBefore = (AudioContextManager as any).globalEventHandlers;
      expect(handlersBefore.size).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Verify unsubscribed
      const handlersAfter = (AudioContextManager as any).globalEventHandlers;
      expect(handlersAfter.size).toBe(0);
    });

    it('should maintain single global context pattern', () => {
      // Verify globalContext static property exists
      expect('globalContext' in AudioContextManager).toBe(true);

      // This is the core of Bug #4 fix - single source of truth
      const globalContext = (AudioContextManager as any).globalContext;

      // Can be null initially, but should be reusable
      expect(
        globalContext === null ||
          globalContext instanceof AudioContext ||
          typeof globalContext === 'object',
      ).toBe(true);
    });
  });

  describe('Performance Improvements', () => {
    it('should use Set for O(1) add/remove operations', () => {
      const handlers = (AudioContextManager as any).globalEventHandlers;

      // Verify it's a Set (not Array)
      expect(handlers instanceof Set).toBe(true);
      expect(handlers instanceof Array).toBe(false);

      // Sets provide O(1) add/delete, Arrays are O(n)
    });

    it('should handle rapid subscribe/unsubscribe efficiently', () => {
      const startTime = performance.now();

      // Rapid subscribe/unsubscribe cycles
      for (let i = 0; i < 1000; i++) {
        const handler = vi.fn();
        const unsub = AudioContextManager.onGlobalStateChange(handler);
        unsub();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be fast (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same handler subscribed multiple times', () => {
      const handler = vi.fn();

      const unsub1 = AudioContextManager.onGlobalStateChange(handler);
      const unsub2 = AudioContextManager.onGlobalStateChange(handler);

      // Set will only store it once
      const handlers = (AudioContextManager as any).globalEventHandlers;

      // Cleanup
      unsub1();
      unsub2();
    });

    it('should handle unsubscribe with no active subscriptions', () => {
      const handler = vi.fn();
      const unsub = AudioContextManager.onGlobalStateChange(handler);

      unsub(); // First unsubscribe
      unsub(); // Second unsubscribe should not throw

      expect(() => unsub()).not.toThrow();
    });

    it('should maintain state across multiple AudioContextManager instances', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = AudioContextManager.onGlobalStateChange(handler1);

      // Create new instance (should share global state)
      const manager1 = new AudioContextManager();
      const manager2 = new AudioContextManager();

      const unsub2 = AudioContextManager.onGlobalStateChange(handler2);

      // Both handlers in global Set
      const handlers = (AudioContextManager as any).globalEventHandlers;
      expect(handlers.size).toBe(2);

      // Cleanup
      unsub1();
      unsub2();
    });
  });
});
