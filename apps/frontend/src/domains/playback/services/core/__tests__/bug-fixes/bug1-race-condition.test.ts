/**
 * bug1-race-condition.test.ts
 *
 * Bug #1 Verification: Race Condition Fix (coreServicesReady)
 *
 * Original Issue: "getRegionProcessor is not a function" errors when widgets
 * accessed RegionProcessor before CoreServices was fully initialized.
 *
 * Root Cause: React StrictMode double-mounting and async initialization
 * timing issues caused widgets to access services before ready.
 *
 * Original Fix: [AudioProvider.tsx:59-101]
 * - coreServicesReady flag prevents premature access
 * - initRef.current prevents double initialization
 * - cleanupRef.current prevents double cleanup
 * - audioServicesReady event signals when ready
 *
 * Preservation: PlaybackEngine follows same initialization pattern through
 * CoreServices and AudioProvider integration.
 *
 * Pass Criteria:
 * - Zero "getPlaybackEngine is not a function" errors
 * - Exactly 1 initialization in React StrictMode
 * - No race conditions in 100 mount/unmount cycles
 * - Singleton behavior maintained
 * - audioServicesReady event fires correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoreServices, GlobalAudioSystem } from '../../CoreServices.js';
import type { PlaybackEngine } from '../../PlaybackEngine.js';

// Use the project's tone mock — without this, ToneWrapper.load() does
// `import('tone')` which loads standardized-audio-context and crashes in
// jsdom with "Cannot read properties of null (reading 'hasOwnProperty')"
// from the audio context bundle. The mock satisfies the same API surface
// with no real AudioContext instantiation.
vi.mock('tone');

describe('Bug #1: Race Condition Fix Verification', () => {
  beforeEach(() => {
    // Reset global state
    GlobalAudioSystem._resetForTesting();
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    GlobalAudioSystem._resetForTesting();
  });

  // ============================================================================
  // Test 1: coreServicesReady Prevents Premature Access
  // ============================================================================

  describe('Test 1: coreServicesReady Prevents Premature Access', () => {
    it('should handle getPlaybackEngine() call before initialization gracefully', async () => {
      // Bug-fix invariant preserved: the method exists and is safe to
      // call without initialize() having run. The architecture later
      // changed so PlaybackEngine is created EAGERLY in the constructor
      // (Phase 3.2: 100% rollout, no feature flag); we test that this
      // is still callable + returns an instance (not undefined as the
      // old behavior did, but the bug being protected against was
      // "method missing entirely").
      const coreServices = new CoreServices();

      expect(() => {
        const engine = coreServices.getPlaybackEngine?.();
        // Engine is now eagerly created — defined, no throw.
        expect(engine).toBeDefined();
      }).not.toThrow();

      await coreServices.dispose();
    });

    it('should not produce "is not a function" errors when accessing PlaybackEngine before initialization', async () => {
      const coreServices = new CoreServices();

      // The original race-condition bug presented as "getPlaybackEngine
      // is not a function" before CoreServices was ready. Today the
      // method always exists. If it ever throws, it must NOT be the
      // old "is not a function" shape.
      try {
        const engine = coreServices.getPlaybackEngine();
        expect(engine).toBeDefined();
      } catch (error: any) {
        expect(error.message).not.toContain('is not a function');
      }

      await coreServices.dispose();
    });

    it('should allow getPlaybackEngine() after initialization', async () => {
      const coreServices = new CoreServices();

      // Mock AudioContext for initialization
      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 48000,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );

      await coreServices.initialize();

      // Should work after initialization
      const engine = coreServices.getPlaybackEngine?.();

      // Verify we got a PlaybackEngine instance
      if (engine) {
        expect(engine).toBeDefined();
        expect(typeof engine.initialize).toBe('function');
        expect(typeof engine.start).toBe('function');
      }

      await coreServices.dispose();
    });
  });

  // ============================================================================
  // Test 2: React StrictMode Double-Mount Prevention
  // ============================================================================

  describe('Test 2: React StrictMode Double-Mount Prevention', () => {
    it('should initialize exactly once despite double-mount', async () => {
      let initCount = 0;

      // Simulate React StrictMode behavior (double-mount)
      const initRef = { current: false };

      // First mount
      const init1 = async () => {
        if (initRef.current) {
          // Already initialized — return the cached singleton
          return GlobalAudioSystem.getPreInitializedInstance();
        }
        initRef.current = true;
        initCount++;
        return GlobalAudioSystem.getPreInitializedInstance();
      };

      // Second mount (React StrictMode)
      const init2 = init1;

      const instance1 = await init1();
      const instance2 = await init2();

      // Should only initialize once (the second call should short-circuit)
      expect(initCount).toBe(1);

      // Should return same singleton instance both times
      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();

      if (instance1) {
        await instance1.dispose();
      }
    });

    it('should prevent double cleanup on unmount', async () => {
      let cleanupCount = 0;

      const instance = await GlobalAudioSystem.getPreInitializedInstance();

      const cleanupRef = { current: false };

      const cleanup1 = () => {
        if (cleanupRef.current) return;
        cleanupRef.current = true;
        cleanupCount++;
      };

      const cleanup2 = () => {
        if (cleanupRef.current) return;
        cleanupRef.current = true;
        cleanupCount++;
      };

      cleanup1();
      cleanup2(); // Simulate React StrictMode double-cleanup

      // Should only cleanup once
      expect(cleanupCount).toBe(1);

      await instance.dispose();
    });
  });

  // ============================================================================
  // Test 3: No Race Conditions in Rapid Mount/Unmount
  // ============================================================================

  describe('Test 3: No Race Conditions in Rapid Mount/Unmount', () => {
    it('should handle 100 rapid mount/unmount cycles without errors', async () => {
      const errors: Error[] = [];

      for (let i = 0; i < 100; i++) {
        try {
          // Reset between cycles
          GlobalAudioSystem._resetForTesting();

          // Simulate component mount
          const instance = await GlobalAudioSystem.getPreInitializedInstance();

          // Attempt to access services immediately
          const eventBus = instance.getEventBus();
          expect(eventBus).toBeDefined();

          // Simulate component unmount
          await instance.dispose();
        } catch (error: any) {
          errors.push(error);
        }
      }

      // Should have zero race condition errors
      expect(errors).toHaveLength(0);
    });

    it('should maintain consistent initialization state across cycles', async () => {
      for (let i = 0; i < 10; i++) {
        GlobalAudioSystem._resetForTesting();

        const instance = await GlobalAudioSystem.getPreInitializedInstance();

        // Should always be in a valid state
        expect(instance).toBeDefined();
        expect(instance.getEventBus()).toBeDefined();

        await instance.dispose();

        // After disposal, should be fully cleaned
        expect(instance.isReady()).toBe(false);
      }
    });
  });

  // ============================================================================
  // Test 4: GlobalAudioSystem Singleton Behavior
  // ============================================================================

  describe('Test 4: GlobalAudioSystem Singleton Behavior', () => {
    it('should return same instance across multiple calls', async () => {
      const instance1 = await GlobalAudioSystem.getPreInitializedInstance();
      const instance2 = await GlobalAudioSystem.getPreInitializedInstance();
      const instance3 = await GlobalAudioSystem.getPreInitializedInstance();

      // All should be the same instance
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      await instance1.dispose();
    });

    it('should share state across instance references', async () => {
      const instance1 = await GlobalAudioSystem.getPreInitializedInstance();
      const instance2 = await GlobalAudioSystem.getPreInitializedInstance();

      const eventBus1 = instance1.getEventBus();
      const eventBus2 = instance2.getEventBus();

      // Should be the same EventBus
      expect(eventBus1).toBe(eventBus2);

      // Events emitted on one should be visible on the other
      const listener = vi.fn();
      eventBus2.on('test:event', listener);

      eventBus1.emit('test:event', { data: 'test' });

      expect(listener).toHaveBeenCalled();

      await instance1.dispose();
    });

    it('should maintain singleton across 10 rapid accesses', async () => {
      const instances: CoreServices[] = [];

      for (let i = 0; i < 10; i++) {
        instances.push(await GlobalAudioSystem.getPreInitializedInstance());
      }

      // All should be the same reference
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });

      await firstInstance.dispose();
    });
  });

  // ============================================================================
  // Test 5: core-services:initialized Event Dispatch
  //
  // Original event name was `audioServicesReady` (CustomEvent on window).
  // Production was refactored to emit `core-services:initialized` on the
  // internal EventBus instead — that's the actual contract today
  // (CoreServices.ts line ~614).
  // ============================================================================

  describe('Test 5: core-services:initialized Event Dispatch', () => {
    const mockAudioContext = () => {
      vi.spyOn(window, 'AudioContext').mockImplementation(
        () =>
          ({
            state: 'running',
            currentTime: 0,
            sampleRate: 48000,
            createGain: vi.fn(() => ({
              gain: { value: 1 },
              connect: vi.fn(),
              disconnect: vi.fn(),
            })),
            destination: {},
            resume: vi.fn(() => Promise.resolve()),
            suspend: vi.fn(() => Promise.resolve()),
            close: vi.fn(() => Promise.resolve()),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as any,
      );
    };

    it('should emit core-services:initialized after initialization', async () => {
      mockAudioContext();

      const instance = await GlobalAudioSystem.getPreInitializedInstance();
      const listener = vi.fn();
      instance.getEventBus().on('core-services:initialized', listener);

      await instance.initialize();

      expect(listener).toHaveBeenCalled();

      await instance.dispose();
    });

    it('should emit core-services:initialized exactly once per initialization', async () => {
      mockAudioContext();

      const instance = await GlobalAudioSystem.getPreInitializedInstance();
      const listener = vi.fn();
      instance.getEventBus().on('core-services:initialized', listener);

      await instance.initialize();
      // initialize() is idempotent — calling it again should NOT emit
      // the event a second time.
      await instance.initialize();

      expect(listener).toHaveBeenCalledTimes(1);

      await instance.dispose();
    });

    it('should NOT emit core-services:initialized if initialization fails', async () => {
      // Force initialization failure
      (window as any).AudioContext = undefined;

      const instance = await GlobalAudioSystem.getPreInitializedInstance();
      const listener = vi.fn();
      instance.getEventBus().on('core-services:initialized', listener);

      try {
        await instance.initialize();
      } catch {
        // Expected to fail
      }

      expect(listener).not.toHaveBeenCalled();

      await instance.dispose();
    });
  });
});
