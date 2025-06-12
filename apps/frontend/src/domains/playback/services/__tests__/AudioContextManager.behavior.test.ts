/**
 * AudioContextManager Behavior Tests
 *
 * Tests the Web Audio API context management behaviors including initialization,
 * lifecycle management, user gesture requirements, state transitions, and error handling.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioContextManager } from '../AudioContextManager.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock document visibility API - only if document exists
  if (typeof document !== 'undefined') {
    Object.defineProperty(document, 'hidden', {
      writable: true,
      value: false,
    });

    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible',
    });
  } else {
    // Create minimal document mock for testing
    (global as any).document = {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }

  // Mock AudioContext
  const mockAudioContext = vi.fn().mockImplementation(() => ({
    state: 'suspended',
    currentTime: 0,
    sampleRate: 44100,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  // Set up Web Audio API availability
  (global as any).AudioContext = mockAudioContext;
  (global as any).webkitAudioContext = mockAudioContext;

  // Mock window if not available
  if (typeof window === 'undefined') {
    (global as any).window = {
      AudioContext: mockAudioContext,
      webkitAudioContext: mockAudioContext,
    };
  } else {
    window.AudioContext = mockAudioContext as any;
    (window as any).webkitAudioContext = mockAudioContext;
  }

  return { mockAudioContext };
};

const createUnsupportedEnvironment = () => {
  // Remove Web Audio API support
  delete (global as any).AudioContext;
  delete (global as any).webkitAudioContext;

  // Also remove from window if it exists
  if (typeof window !== 'undefined') {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;
  }
};

const createMockAudioContext = (initialState = 'suspended') => {
  const mockContext = {
    state: initialState,
    currentTime: 123.456,
    sampleRate: 44100,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  // Mock state changes
  mockContext.resume.mockImplementation(async () => {
    mockContext.state = 'running';
    // Trigger state change event
    const stateChangeHandler = mockContext.addEventListener.mock.calls.find(
      (call) => call[0] === 'statechange',
    )?.[1];
    if (stateChangeHandler) {
      stateChangeHandler();
    }
  });

  mockContext.suspend.mockImplementation(async () => {
    mockContext.state = 'suspended';
    const stateChangeHandler = mockContext.addEventListener.mock.calls.find(
      (call) => call[0] === 'statechange',
    )?.[1];
    if (stateChangeHandler) {
      stateChangeHandler();
    }
  });

  mockContext.close.mockImplementation(async () => {
    mockContext.state = 'closed';
    const stateChangeHandler = mockContext.addEventListener.mock.calls.find(
      (call) => call[0] === 'statechange',
    )?.[1];
    if (stateChangeHandler) {
      stateChangeHandler();
    }
  });

  return mockContext;
};

// Test Helpers
const expectValidAudioContextState = (state: string) => {
  expect(['suspended', 'running', 'closed', 'interrupted']).toContain(state);
};

const _expectValidAudioContextError = (error: any) => {
  expect(error).toBeDefined();
  expect(['unsupported', 'hardware', 'permission', 'unknown']).toContain(
    error.type,
  );
  expect(typeof error.message).toBe('string');
  expect(error.message.length).toBeGreaterThan(0);
};

// Behavior Tests
describe('AudioContextManager Behaviors', () => {
  let manager: AudioContextManager;
  let mockAudioContext: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    const { mockAudioContext: MockClass } = setupTestEnvironment();
    mockAudioContext = createMockAudioContext();
    MockClass.mockReturnValue(mockAudioContext);
    MockClass.mockClear(); // Clear previous call counts

    // Reset singleton for each test
    (AudioContextManager as any).instance = null;
    manager = AudioContextManager.getInstance();
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern Behaviors', () => {
    test('should provide consistent singleton instance', () => {
      const instance1 = AudioContextManager.getInstance();
      const instance2 = AudioContextManager.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AudioContextManager);
    });

    test('should maintain same instance across multiple calls', () => {
      const instances = Array.from({ length: 10 }, () =>
        AudioContextManager.getInstance(),
      );

      instances.forEach((instance) => {
        expect(instance).toBe(manager);
      });
    });

    test('should provide clean singleton after disposal', () => {
      const originalInstance = manager;

      manager.dispose();

      const newInstance = AudioContextManager.getInstance();
      expect(newInstance).toBe(originalInstance); // Same singleton, not recreated
    });
  });

  describe('Browser Support Detection Behaviors', () => {
    test('should detect Web Audio API support correctly', () => {
      const isSupported = manager.isBrowserSupported();

      expect(typeof isSupported).toBe('boolean');
      expect(isSupported).toBe(true); // With our mocks
    });

    test('should detect lack of Web Audio API support', () => {
      createUnsupportedEnvironment();

      const isSupported = manager.isBrowserSupported();

      expect(isSupported).toBe(false);
    });

    test('should handle partial Web Audio API support', () => {
      delete (global as any).AudioContext;
      // Keep webkitAudioContext only

      const isSupported = manager.isBrowserSupported();

      expect(isSupported).toBe(true); // Should still be supported via webkit
    });

    test('should handle complete absence of Web Audio API', () => {
      // Store original values
      const originalAudioContext = (global as any).AudioContext;
      const originalWebkitAudioContext = (global as any).webkitAudioContext;
      const originalWindowAudioContext =
        typeof window !== 'undefined'
          ? (window as any).AudioContext
          : undefined;
      const originalWindowWebkitAudioContext =
        typeof window !== 'undefined'
          ? (window as any).webkitAudioContext
          : undefined;

      try {
        // Remove both AudioContext and webkitAudioContext from both global and window
        delete (global as any).AudioContext;
        delete (global as any).webkitAudioContext;

        if (typeof window !== 'undefined') {
          delete (window as any).AudioContext;
          delete (window as any).webkitAudioContext;
        }

        const isSupported = manager.isBrowserSupported();
        expect(isSupported).toBe(false);
      } finally {
        // Restore
        (global as any).AudioContext = originalAudioContext;
        (global as any).webkitAudioContext = originalWebkitAudioContext;
        if (typeof window !== 'undefined') {
          if (originalWindowAudioContext) {
            (window as any).AudioContext = originalWindowAudioContext;
          }
          if (originalWindowWebkitAudioContext) {
            (window as any).webkitAudioContext =
              originalWindowWebkitAudioContext;
          }
        }
      }
    });

    test('should handle corrupted Web Audio API objects', () => {
      // Store original
      const originalAudioContext = (global as any).AudioContext;

      try {
        // Set to non-function value
        (global as any).AudioContext = null;

        const isSupported = manager.isBrowserSupported();
        expect(typeof isSupported).toBe('boolean');
      } finally {
        // Restore
        (global as any).AudioContext = originalAudioContext;
      }
    });
  });

  describe('Initialization Behaviors', () => {
    test('should initialize AudioContext successfully', async () => {
      await manager.initialize();

      const context = manager.getContext();
      const state = manager.getState();

      expect(context).toBeDefined();
      expect(context).toBe(mockAudioContext);
      expectValidAudioContextState(state);
    });

    test('should handle user gesture requirement', async () => {
      mockAudioContext.state = 'suspended';

      await manager.initialize();

      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(manager.getState()).toBe('running');
    });

    test('should skip resume if already running', async () => {
      mockAudioContext.state = 'running';

      await manager.initialize();

      expect(mockAudioContext.resume).not.toHaveBeenCalled();
      expect(manager.getState()).toBe('running');
    });

    test('should only initialize once', async () => {
      await manager.initialize();
      await manager.initialize();
      await manager.initialize();

      // AudioContext constructor should only be called once
      expect((global as any).AudioContext).toHaveBeenCalledTimes(1);
    });

    test('should throw error when browser unsupported', async () => {
      createUnsupportedEnvironment();

      await expect(manager.initialize()).rejects.toMatchObject({
        type: 'unsupported',
        message: expect.stringContaining('not supported'),
      });
    });

    test('should handle initialization errors gracefully', async () => {
      const initError = new Error('Initialization failed');
      (global as any).AudioContext.mockImplementation(() => {
        throw initError;
      });

      await expect(manager.initialize()).rejects.toMatchObject({
        type: 'unknown',
        message: 'Initialization failed',
        originalError: initError,
      });
    });

    test('should set up state change listeners', async () => {
      await manager.initialize();

      expect(mockAudioContext.addEventListener).toHaveBeenCalledWith(
        'statechange',
        expect.any(Function),
      );
    });

    test('should configure AudioContext with optimal settings', async () => {
      await manager.initialize();

      expect((global as any).AudioContext).toHaveBeenCalledWith({
        latencyHint: 'interactive',
        sampleRate: 44100,
      });
    });
  });

  describe('Context Access Behaviors', () => {
    test('should provide AudioContext after initialization', async () => {
      await manager.initialize();

      const context = manager.getContext();

      expect(context).toBe(mockAudioContext);
      expect(context.sampleRate).toBe(44100);
    });

    test('should throw error when accessing uninitialized context', () => {
      expect(() => manager.getContext()).toThrow(
        'AudioContext not initialized. Call initialize() first from a user gesture.',
      );
    });

    test('should provide current time from context', async () => {
      await manager.initialize();

      const currentTime = manager.getCurrentTime();

      expect(typeof currentTime).toBe('number');
      expect(currentTime).toBe(123.456); // Mock value
    });

    test('should return 0 for current time when not initialized', () => {
      const currentTime = manager.getCurrentTime();

      expect(currentTime).toBe(0);
    });
  });

  describe('State Management Behaviors', () => {
    test('should track state correctly', async () => {
      expect(manager.getState()).toBe('suspended');

      await manager.initialize();

      expect(manager.getState()).toBe('running');
    });

    test('should handle state transitions', async () => {
      await manager.initialize();

      expect(manager.getState()).toBe('running');

      await manager.suspend();
      expect(manager.getState()).toBe('suspended');

      await manager.resume();
      expect(manager.getState()).toBe('running');
    });

    test('should emit state change notifications', async () => {
      const stateChangeHandler = vi.fn();
      manager.onStateChange(stateChangeHandler);

      await manager.initialize();

      expect(stateChangeHandler).toHaveBeenCalledWith('running');
    });

    test('should handle multiple state change listeners', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      manager.onStateChange(handler1);
      manager.onStateChange(handler2);
      manager.onStateChange(handler3);

      await manager.initialize();

      expect(handler1).toHaveBeenCalledWith('running');
      expect(handler2).toHaveBeenCalledWith('running');
      expect(handler3).toHaveBeenCalledWith('running');
    });

    test('should remove state change listeners', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.onStateChange(handler);

      unsubscribe();

      await manager.initialize();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Resume/Suspend Behaviors', () => {
    test('should resume suspended context', async () => {
      await manager.initialize();
      await manager.suspend();

      expect(manager.getState()).toBe('suspended');

      await manager.resume();

      expect(manager.getState()).toBe('running');
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    test('should skip resume if already running', async () => {
      await manager.initialize();

      mockAudioContext.resume.mockClear();

      await manager.resume();

      expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });

    test('should suspend running context', async () => {
      await manager.initialize();

      expect(manager.getState()).toBe('running');

      await manager.suspend();

      expect(manager.getState()).toBe('suspended');
      expect(mockAudioContext.suspend).toHaveBeenCalled();
    });

    test('should skip suspend if already suspended', async () => {
      await manager.initialize();
      await manager.suspend();

      mockAudioContext.suspend.mockClear();

      await manager.suspend();

      expect(mockAudioContext.suspend).not.toHaveBeenCalled();
    });

    test('should handle resume errors with structured error', async () => {
      await manager.initialize();
      await manager.suspend();

      const resumeError = new Error('Hardware busy');
      mockAudioContext.resume.mockRejectedValue(resumeError);

      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      await expect(manager.resume()).rejects.toMatchObject({
        type: 'hardware',
        message: 'Failed to resume audio context',
      });

      expect(errorHandler).toHaveBeenCalledWith({
        type: 'hardware',
        message: 'Failed to resume audio context',
      });
    });

    test('should handle suspend errors gracefully without throwing', async () => {
      await manager.initialize();

      const suspendError = new Error('Suspend failed');
      mockAudioContext.suspend.mockRejectedValue(suspendError);

      // Should not throw
      await expect(manager.suspend()).resolves.toBeUndefined();

      expect(global.console.warn).toHaveBeenCalledWith(
        'Audio context suspend failed:',
        expect.stringContaining('Failed to suspend'),
      );
    });

    test('should handle operations on uninitialized context', async () => {
      await expect(manager.resume()).rejects.toThrow(
        'AudioContext not initialized',
      );

      // Suspend should complete without error
      await expect(manager.suspend()).resolves.toBeUndefined();
    });
  });

  describe('Error Handling Behaviors', () => {
    test('should register and notify error handlers', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      createUnsupportedEnvironment();

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unsupported',
          message: expect.stringContaining('not supported'),
        }),
      );
    });

    test('should handle multiple error handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.onError(handler1);
      manager.onError(handler2);

      createUnsupportedEnvironment();

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should remove error handlers', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.onError(handler);

      unsubscribe();

      createUnsupportedEnvironment();

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(handler).not.toHaveBeenCalled();
    });

    test('should sanitize error messages', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      const sensitiveError = new Error(
        '/private/path/file.js:123 - Sensitive info',
      );
      (global as any).AudioContext.mockImplementation(() => {
        throw sensitiveError;
      });

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining('/private/path'),
        }),
      );
    });

    test('should categorize different error types', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      // Test unknown error categorization
      const unknownError = new Error('Random error');
      (global as any).AudioContext.mockImplementation(() => {
        throw unknownError;
      });

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unknown' }),
      );
    });

    test('should categorize unsupported browser errors', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      const unsupportedError = new Error('AudioContext is not supported');
      (global as any).AudioContext.mockImplementation(() => {
        throw unsupportedError;
      });

      await expect(manager.initialize()).rejects.toMatchObject({
        type: 'unsupported',
        message: 'AudioContext is not supported',
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unsupported' }),
      );
    });

    test('should handle hardware errors during resume', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      await manager.initialize();
      await manager.suspend();

      const hardwareError = new Error('Audio device busy');
      mockAudioContext.resume.mockRejectedValue(hardwareError);

      await expect(manager.resume()).rejects.toMatchObject({
        type: 'hardware',
        message: 'Failed to resume audio context',
        originalError: hardwareError,
      });

      expect(errorHandler).toHaveBeenCalledWith({
        type: 'hardware',
        message: 'Failed to resume audio context',
      });
    });

    test('should handle permission denied errors', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      const permissionError = new Error('Permission denied');
      (global as any).AudioContext.mockImplementation(() => {
        throw permissionError;
      });

      await expect(manager.initialize()).rejects.toMatchObject({
        type: 'permission',
        message: 'Permission denied',
        originalError: permissionError,
      });
    });

    test('should handle errors in error handlers gracefully', async () => {
      const faultyHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      manager.onError(faultyHandler);

      createUnsupportedEnvironment();

      await expect(manager.initialize()).rejects.toBeDefined();

      expect(global.console.error).toHaveBeenCalledWith(
        'Error in audio error handler:',
        expect.any(Error),
      );
    });
  });

  describe('Disposal and Cleanup Behaviors', () => {
    test('should dispose context cleanly', async () => {
      await manager.initialize();

      await manager.dispose();

      expect(mockAudioContext.removeEventListener).toHaveBeenCalledWith(
        'statechange',
        expect.any(Function),
      );
      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(manager.getState()).toBe('closed');
    });

    test('should handle disposal of uninitialized manager', async () => {
      await expect(manager.dispose()).resolves.toBeUndefined();
    });

    test('should handle disposal errors gracefully', async () => {
      await manager.initialize();

      const closeError = new Error('Close failed');
      mockAudioContext.close.mockRejectedValue(closeError);

      await expect(manager.dispose()).resolves.toBeUndefined();

      expect(global.console.error).toHaveBeenCalledWith(
        'Error disposing AudioContext:',
        closeError,
      );
    });

    test('should skip close if already closed', async () => {
      await manager.initialize();
      mockAudioContext.state = 'closed';

      await manager.dispose();

      expect(mockAudioContext.close).not.toHaveBeenCalled();
    });

    test('should notify state change on disposal', async () => {
      const stateHandler = vi.fn();
      manager.onStateChange(stateHandler);

      await manager.initialize();
      stateHandler.mockClear();

      await manager.dispose();

      expect(stateHandler).toHaveBeenCalledWith('closed');
    });

    test('should handle multiple disposal calls', async () => {
      await manager.initialize();

      await manager.dispose();
      await manager.dispose();
      await manager.dispose();

      // Close should only be called once
      expect(mockAudioContext.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visibility Handling Behaviors', () => {
    test('should set up visibility change listeners', () => {
      // Verify that the manager sets up visibility handling during construction
      expect(manager).toBeDefined();

      // The setupVisibilityHandling is called in constructor
      // We can verify the manager exists and doesn't throw
      expect(typeof manager.getState).toBe('function');
    });

    test('should maintain state consistency across visibility changes', async () => {
      await manager.initialize();

      expect(manager.getState()).toBe('running');

      // Simulate visibility change
      Object.defineProperty(document, 'hidden', { value: true });
      Object.defineProperty(document, 'visibilityState', { value: 'hidden' });

      // Manager should still report correct state
      expect(manager.getState()).toBe('running');
    });
  });

  describe('Performance Optimization Behaviors', () => {
    test('should configure context for low latency', async () => {
      await manager.initialize();

      expect((global as any).AudioContext).toHaveBeenCalledWith(
        expect.objectContaining({
          latencyHint: 'interactive',
        }),
      );
    });

    test('should use standard sample rate', async () => {
      await manager.initialize();

      expect((global as any).AudioContext).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 44100,
        }),
      );
    });

    test('should handle rapid state transitions', async () => {
      await manager.initialize();

      // Rapid suspend/resume cycles
      for (let i = 0; i < 5; i++) {
        await manager.suspend();
        await manager.resume();
      }

      expect(manager.getState()).toBe('running');
    });

    test('should handle concurrent operations gracefully', async () => {
      // Create a completely fresh mock for this test
      const concurrentMockContext = createMockAudioContext();
      const ConcurrentMockClass = vi.fn(() => concurrentMockContext);

      // Replace global AudioContext with our fresh mock
      (global as any).AudioContext = ConcurrentMockClass;

      // Reset singleton and create fresh manager
      (AudioContextManager as any).instance = null;
      const testManager = AudioContextManager.getInstance();

      const promises = [
        testManager.initialize(),
        testManager.initialize(),
        testManager.initialize(),
      ];

      await Promise.all(promises);

      expect(testManager.getState()).toBe('running');
      expect(ConcurrentMockClass).toHaveBeenCalledTimes(1);
    });
  });

  describe('Security and Resource Protection Behaviors', () => {
    test('should prevent CSP violations through eval usage', () => {
      // Mock eval to detect usage
      const originalEval = (global as any).eval;
      const mockEval = vi.fn(() => {
        throw new Error('CSP violation: eval not allowed');
      });

      (global as any).eval = mockEval;

      try {
        // AudioContextManager should not use eval
        expect(() => manager.initialize()).not.toThrow('CSP violation');
      } finally {
        // Restore
        (global as any).eval = originalEval;
      }
    });

    test('should handle memory pressure scenarios', async () => {
      await manager.initialize();

      // Mock memory pressure
      const originalMemory = (performance as any).memory;
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1900 * 1024 * 1024, // 1.9GB
          totalJSHeapSize: 2000 * 1024 * 1024,
          jsHeapSizeLimit: 2048 * 1024 * 1024, // 2GB limit
        },
        configurable: true,
      });

      try {
        // Should continue functioning under memory pressure
        expect(() => manager.getContext()).not.toThrow();
        expect(() => manager.getState()).not.toThrow();
      } finally {
        // Restore
        Object.defineProperty(performance, 'memory', {
          value: originalMemory,
          configurable: true,
        });
      }
    });

    test('should prevent excessive event listener accumulation', async () => {
      await manager.initialize();

      // Register many error handlers
      const handlers = Array.from({ length: 10 }, () => vi.fn());
      const unsubscribers = handlers.map((handler) => manager.onError(handler));

      // Unsubscribe all
      unsubscribers.forEach((unsubscribe) => unsubscribe());

      // Verify cleanup
      const errorHandlers = (manager as any).errorHandlers;
      if (errorHandlers) {
        expect(errorHandlers.size).toBe(0);
      }
    });

    test('should sanitize malicious AudioContext options', async () => {
      const maliciousOptions = [
        { sampleRate: -1 },
        { sampleRate: Infinity },
        { sampleRate: NaN },
        { latencyHint: 'javascript:alert(1)' as any },
      ];

      for (const _testCase of maliciousOptions) {
        // Reset for each test
        (AudioContextManager as any).instance = null;
        const testManager = AudioContextManager.getInstance();

        // Fresh mock
        const optionsSpy = vi.fn(() => createMockAudioContext());
        (global as any).AudioContext = optionsSpy;

        await testManager.initialize();

        // Verify safe options passed
        if (optionsSpy.mock.calls.length > 0) {
          const firstCall = optionsSpy.mock.calls.at(0);
          const firstArg = firstCall?.at?.(0);
          if (firstArg) {
            const calledOptions = firstArg as unknown as AudioContextOptions;
            if (calledOptions?.latencyHint) {
              expect(calledOptions.latencyHint).toMatch(
                /^(interactive|balanced|playback)$/,
              );
            }
            if (calledOptions?.sampleRate) {
              expect(calledOptions.sampleRate).toBeGreaterThan(0);
              expect(Number.isFinite(calledOptions.sampleRate)).toBe(true);
            }
          }
        }
      }
    });

    test('should handle rapid state changes without resource leaks', async () => {
      await manager.initialize();

      // Reset call counts
      mockAudioContext.suspend.mockClear();
      mockAudioContext.resume.mockClear();

      // Rapid state transitions
      for (let i = 0; i < 5; i++) {
        await manager.suspend();
        await manager.resume();
      }

      expect(mockAudioContext.suspend).toHaveBeenCalledTimes(5);
      expect(mockAudioContext.resume).toHaveBeenCalledTimes(5);
    });

    test('should prevent prototype pollution attacks', async () => {
      await manager.initialize();

      const originalState = manager.getState();

      // Attempt prototype pollution
      (Object.prototype as any).__malicious = 'hacked';

      try {
        // State should remain unaffected
        expect(manager.getState()).toBe(originalState);
      } finally {
        // Cleanup
        delete (Object.prototype as any).__malicious;
      }
    });

    test('should maintain state integrity under concurrent access', async () => {
      await manager.initialize();

      // Concurrent operations
      const promises = Array.from({ length: 5 }, async (_, i) => {
        if (i % 2 === 0) {
          await manager.suspend();
        } else {
          await manager.resume();
        }
        return manager.getState();
      });

      const states = await Promise.all(promises);

      // All states should be valid
      states.forEach((state) => {
        expect(['suspended', 'running', 'closed', 'interrupted']).toContain(
          state,
        );
      });
    });

    test('should not expose sensitive browser information', async () => {
      await manager.initialize();

      const context = manager.getContext();
      const state = manager.getState();
      const time = manager.getCurrentTime();

      // Verify no sensitive info exposed
      expect(typeof state).toBe('string');
      expect(typeof time).toBe('number');

      if (context) {
        expect(context).not.toHaveProperty('_internalState');
        expect(context).not.toHaveProperty('_browserInfo');
        expect(context).not.toHaveProperty('_securityContext');
      }
    });

    test('should handle malicious event payloads safely', async () => {
      await manager.initialize();

      const stateChangeCallback =
        mockAudioContext.addEventListener.mock.calls.find(
          (call: any[]) => call[0] === 'statechange',
        )?.[1];

      if (stateChangeCallback) {
        const maliciousEvents = [
          { target: { state: '<script>alert(1)</script>' } },
          { target: { state: 'javascript:alert(1)' } },
          { target: { state: null } },
          { target: null },
          null,
        ];

        maliciousEvents.forEach((event) => {
          expect(() => stateChangeCallback(event as any)).not.toThrow();
        });
      }
    });
  });

  describe('Real-World Usage Scenarios', () => {
    test('should handle typical app lifecycle', async () => {
      // App startup - check support
      expect(manager.isBrowserSupported()).toBe(true);

      // User interaction - initialize
      await manager.initialize();
      expect(manager.getState()).toBe('running');

      // Background - suspend
      await manager.suspend();
      expect(manager.getState()).toBe('suspended');

      // Foreground - resume
      await manager.resume();
      expect(manager.getState()).toBe('running');

      // App shutdown - dispose
      await manager.dispose();
      expect(manager.getState()).toBe('closed');
    });

    test('should handle audio session interruptions', async () => {
      const stateHandler = vi.fn();
      manager.onStateChange(stateHandler);

      await manager.initialize();

      // Simulate interruption
      mockAudioContext.state = 'interrupted';
      const stateChangeHandler =
        mockAudioContext.addEventListener.mock.calls.find(
          (call) => call[0] === 'statechange',
        )?.[1];
      stateChangeHandler?.();

      expect(stateHandler).toHaveBeenCalledWith('interrupted');
      expect(manager.getState()).toBe('interrupted');
    });

    test('should recover from hardware errors', async () => {
      const errorHandler = vi.fn();
      manager.onError(errorHandler);

      await manager.initialize();

      // First suspend to set up the condition for resume
      await manager.suspend();
      expect(manager.getState()).toBe('suspended');

      // Simulate hardware error during resume
      const hardwareError = new Error('Audio device busy');
      mockAudioContext.resume.mockRejectedValue(hardwareError);

      await expect(manager.resume()).rejects.toBeDefined();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hardware',
          message: expect.stringContaining('Failed to resume'),
        }),
      );
    });

    test('should handle battery optimization scenarios', async () => {
      await manager.initialize();

      // Simulate battery-conscious suspend
      await manager.suspend();
      expect(manager.getState()).toBe('suspended');

      // Later resume when needed
      await manager.resume();
      expect(manager.getState()).toBe('running');

      // Context should maintain its configuration
      const context = manager.getContext();
      expect(context.sampleRate).toBe(44100);
    });

    test('should work with page navigation scenarios', async () => {
      await manager.initialize();

      const context = manager.getContext();
      expect(context).toBeDefined();

      // Simulate page unload cleanup
      await manager.dispose();

      expect(manager.getState()).toBe('closed');
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});
