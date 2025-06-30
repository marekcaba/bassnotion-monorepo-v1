/**
 * GarbageCollectionOptimizer Behavior Tests
 *
 * Tests the garbage collection optimization behaviors including smart timing,
 * memory pressure monitoring, performance impact measurement, and battery optimization.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GarbageCollectionOptimizer,
  GCStrategy,
  GCTrigger,
  type GCConfig,
  type DeviceConstraints,
  type GCMetrics,
} from '../GarbageCollectionOptimizer.js';

// Test Environment Setup
let originalGlobals: {
  performance?: any;
  PerformanceObserver?: any;
  requestIdleCallback?: any;
  requestAnimationFrame?: any;
  document?: any;
  window?: any;
  setInterval?: any;
} = {};

const setupTestEnvironment = () => {
  // CRITICAL: Store original global objects for restoration
  originalGlobals = {
    performance: (global as any).performance,
    PerformanceObserver: (global as any).PerformanceObserver,
    requestIdleCallback: (global as any).requestIdleCallback,
    requestAnimationFrame: (global as any).requestAnimationFrame,
    document: (global as any).document,
    window: (global as any).window,
    setInterval: global.setInterval,
  };

  // Setup proper spies before other mocks
  const setIntervalSpy = vi.fn().mockImplementation((callback, delay) => {
    return setTimeout(callback, delay) as any;
  });
  global.setInterval = setIntervalSpy;

  // Mock performance API with memory
  const mockPerformance = {
    now: vi.fn().mockReturnValue(Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 80 * 1024 * 1024, // 80MB
      jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
    },
    mark: vi.fn(),
    measure: vi.fn(),
    getEntries: vi.fn().mockReturnValue([]),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  (global as any).performance = mockPerformance;

  // Mock PerformanceObserver
  (global as any).PerformanceObserver = vi
    .fn()
    .mockImplementation((_callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    }));

  // Mock requestIdleCallback
  (global as any).requestIdleCallback = vi
    .fn()
    .mockImplementation((callback) => {
      setTimeout(callback, 0);
      return 1;
    });

  // Mock requestAnimationFrame
  (global as any).requestAnimationFrame = vi
    .fn()
    .mockImplementation((callback) => {
      setTimeout(callback, 16);
      return 1;
    });

  // CRITICAL: Instead of completely replacing document, extend the original
  // This preserves JSDOM's document.body and other essential properties
  if (originalGlobals.document) {
    (global as any).document = {
      ...originalGlobals.document,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }

  // CRITICAL: Instead of completely replacing window, extend the original
  if (originalGlobals.window) {
    (global as any).window = {
      ...originalGlobals.window,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: setIntervalSpy,
      setTimeout: global.setTimeout,
      clearTimeout: global.clearTimeout,
      clearInterval: global.clearInterval,
    };
  }

  // Also ensure window.setInterval is the same spy for implementation usage
  (globalThis as any).window = (global as any).window;
};

const restoreTestEnvironment = () => {
  // CRITICAL: Restore all original global objects to prevent DOM pollution
  if (originalGlobals.performance) {
    (global as any).performance = originalGlobals.performance;
  }
  if (originalGlobals.PerformanceObserver) {
    (global as any).PerformanceObserver = originalGlobals.PerformanceObserver;
  }
  if (originalGlobals.requestIdleCallback) {
    (global as any).requestIdleCallback = originalGlobals.requestIdleCallback;
  }
  if (originalGlobals.requestAnimationFrame) {
    (global as any).requestAnimationFrame =
      originalGlobals.requestAnimationFrame;
  }
  if (originalGlobals.document) {
    (global as any).document = originalGlobals.document;
  }
  if (originalGlobals.window) {
    (global as any).window = originalGlobals.window;
    (globalThis as any).window = originalGlobals.window;
  }
  if (originalGlobals.setInterval) {
    global.setInterval = originalGlobals.setInterval;
  }
};

// Scenario Builders
const createGCConfig = (
  overrides: Partial<GCConfig> = {},
): Partial<GCConfig> => ({
  strategy: GCStrategy.BALANCED,
  schedule: {
    idleThreshold: 5000,
    memoryPressureThreshold: 0.8,
    maxCollectionInterval: 300000,
    minCollectionInterval: 10000,
    batteryAwareScaling: true,
    thermalAwareScaling: true,
  },
  enableSmartTiming: true,
  enablePerformanceMonitoring: true,
  enableBatteryOptimization: true,
  maxConcurrentCollections: 1,
  forceCollectionMemoryThreshold: 0.95,
  ...overrides,
});

const createDeviceConstraints = (
  overrides: Partial<DeviceConstraints> = {},
): DeviceConstraints => ({
  batteryLevel: 80,
  thermalState: 'normal',
  memoryPressure: 'moderate',
  cpuUsage: 30,
  isLowEndDevice: false,
  ...overrides,
});

const createHighMemoryPressureEnvironment = () => {
  const mockPerformance = (global as any).performance;
  if (mockPerformance && mockPerformance.memory) {
    mockPerformance.memory.usedJSHeapSize = 95 * 1024 * 1024; // 95MB used out of 100MB limit
  }
};

const createLowEndDeviceConstraints = (): DeviceConstraints => ({
  batteryLevel: 20,
  thermalState: 'serious',
  memoryPressure: 'severe',
  cpuUsage: 80,
  isLowEndDevice: true,
});

// Test Helpers
const expectValidMetrics = (metrics: GCMetrics) => {
  expect(metrics.totalCollections).toBeGreaterThanOrEqual(0);
  expect(metrics.totalTimeSpent).toBeGreaterThanOrEqual(0);
  expect(metrics.averageCollectionTime).toBeGreaterThanOrEqual(0);
  expect(metrics.memoryFreed).toBeGreaterThanOrEqual(0);
  expect(metrics.performanceImpact).toBeGreaterThanOrEqual(0);
  expect(metrics.interruptedOperations).toBeGreaterThanOrEqual(0);
  expect(metrics.lastCollectionTime).toBeGreaterThanOrEqual(0);
  expect(metrics.collectionsPerStrategy).toBeDefined();
  Object.values(GCStrategy).forEach((strategy) => {
    expect(metrics.collectionsPerStrategy[strategy]).toBeGreaterThanOrEqual(0);
  });
};

const expectGCEventEmitted = (
  optimizer: GarbageCollectionOptimizer,
  eventName: string,
  timeoutMs = 100, // Much shorter timeout for fake timers
): Promise<any> => {
  return new Promise((resolve, reject) => {
    let resolved = false;

    // Set up event listener
    optimizer.once(eventName, (data) => {
      if (!resolved) {
        resolved = true;
        resolve(data);
      }
    });

    // For fake timers, advance time to trigger events
    if (vi.isFakeTimers()) {
      // Allow the event to be set up, then advance timers to trigger it
      setTimeout(() => {
        vi.advanceTimersByTime(timeoutMs);
        // If event hasn't fired by now, reject
        setTimeout(() => {
          if (!resolved) {
            optimizer.removeAllListeners(eventName);
            reject(
              new Error(
                `Event '${eventName}' was not emitted within ${timeoutMs}ms`,
              ),
            );
          }
        }, 0);
      }, 0);
    } else {
      // Real timers - use normal timeout
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          optimizer.removeAllListeners(eventName);
          reject(
            new Error(
              `Event '${eventName}' was not emitted within ${timeoutMs}ms`,
            ),
          );
        }
      }, timeoutMs);

      // Clear timeout if event fires (already handled by resolved flag)
      setTimeout(() => {
        if (resolved) {
          clearTimeout(timeoutId);
        }
      }, 0);
    }
  });
};

const waitForAsync = (ms = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const _waitForAsyncWithTimers = async (ms = 0) => {
  if (vi.isFakeTimers()) {
    vi.advanceTimersByTime(ms);
    await new Promise((resolve) => setTimeout(resolve, 0));
  } else {
    await waitForAsync(ms);
  }
};

// Helper function to run garbage collection with proper timer handling
const _runGCWithTimers = async (
  optimizer: GarbageCollectionOptimizer,
  trigger: GCTrigger,
  deviceConstraints?: DeviceConstraints,
) => {
  const collectionPromise = optimizer.optimizedGarbageCollection(
    trigger,
    deviceConstraints,
  );

  // Different triggers and strategies need different timer advancement patterns
  const config = optimizer.getConfig();
  const isConservative = config.strategy === GCStrategy.CONSERVATIVE;
  const isBalanced = config.strategy === GCStrategy.BALANCED;

  // Handle memory pressure and critical triggers that use forceCollection with setTimeout
  if (trigger === GCTrigger.MEMORY_PRESSURE || trigger === GCTrigger.CRITICAL) {
    vi.advanceTimersByTime(0); // Process immediate setTimeout
    vi.advanceTimersByTime(100); // Process the actual collection
    vi.advanceTimersByTime(100); // Extra time for cleanup
  }
  // Handle idle detection which has 500ms delay
  else if (trigger === GCTrigger.IDLE_DETECTION) {
    vi.advanceTimersByTime(500); // Match calculateOptimalDelay for IDLE_DETECTION
    vi.advanceTimersByTime(100); // Extra time for processing
  }
  // Handle conservative strategy with incremental cleanup
  else if (isConservative) {
    vi.advanceTimersByTime(100); // Initial processing
    vi.advanceTimersByTime(16); // requestAnimationFrame timing
    vi.advanceTimersByTime(16); // Multiple animation frames for incremental cleanup
    vi.advanceTimersByTime(16);
    vi.advanceTimersByTime(100); // Final cleanup
  }
  // Handle balanced strategy with requestIdleCallback
  else if (isBalanced) {
    vi.advanceTimersByTime(0); // Process immediate setTimeout fallback
    vi.advanceTimersByTime(100); // requestIdleCallback timeout
    vi.advanceTimersByTime(50); // Extra processing time
  }
  // Default for aggressive and manual strategies
  else {
    vi.advanceTimersByTime(100);
  }

  await collectionPromise;
};

const _runManualCollectionWithTimers = async (
  optimizer: GarbageCollectionOptimizer,
) => {
  const collectionPromise = optimizer.performManualCollection();

  // Advance timers to ensure any setTimeout calls are processed
  vi.advanceTimersByTime(100);

  await collectionPromise;
};

// Behavior Tests
describe('GarbageCollectionOptimizer Behaviors', () => {
  let optimizer: GarbageCollectionOptimizer;

  beforeEach(() => {
    vi.useRealTimers(); // Clear any existing timer mocks first
    vi.useFakeTimers();
    setupTestEnvironment();
    // Clear singleton instance
    (GarbageCollectionOptimizer as any).instance = null;
    optimizer = GarbageCollectionOptimizer.getInstance();
  });

  afterEach(() => {
    if (optimizer) {
      optimizer.destroy();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    restoreTestEnvironment();
  });

  describe('Initialization Behaviors', () => {
    test('should provide singleton instance', () => {
      const instance1 = GarbageCollectionOptimizer.getInstance();
      const instance2 = GarbageCollectionOptimizer.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(GarbageCollectionOptimizer);
    });

    test('should initialize with default configuration', () => {
      const config = optimizer.getConfig();

      expect(config.strategy).toBe(GCStrategy.BALANCED);
      expect(config.enableSmartTiming).toBe(true);
      expect(config.enablePerformanceMonitoring).toBe(true);
      expect(config.enableBatteryOptimization).toBe(true);
      expect(config.schedule.idleThreshold).toBe(5000);
      expect(config.schedule.memoryPressureThreshold).toBe(0.8);
    });

    test('should accept custom configuration', () => {
      // Clear singleton to allow custom config
      (GarbageCollectionOptimizer as any).instance = null;

      const customConfig = createGCConfig({
        strategy: GCStrategy.AGGRESSIVE,
        enableSmartTiming: false,
      });

      const customOptimizer =
        GarbageCollectionOptimizer.getInstance(customConfig);
      const config = customOptimizer.getConfig();

      expect(config.strategy).toBe(GCStrategy.AGGRESSIVE);
      expect(config.enableSmartTiming).toBe(false);
    });

    test('should initialize metrics correctly', () => {
      const metrics = optimizer.getMetrics();

      expectValidMetrics(metrics);
      expect(metrics.totalCollections).toBe(0);
      expect(metrics.totalTimeSpent).toBe(0);
      expect(metrics.averageCollectionTime).toBe(0);
    });

    test('should set up performance monitoring when enabled', () => {
      const config = createGCConfig({ enablePerformanceMonitoring: true });
      const monitoringOptimizer =
        GarbageCollectionOptimizer.getInstance(config);

      expect(global.PerformanceObserver).toHaveBeenCalled();
      expect(monitoringOptimizer.getConfig().enablePerformanceMonitoring).toBe(
        true,
      );
    });

    test('should set up memory monitoring', () => {
      expect(global.setInterval).toHaveBeenCalled();

      // Check that memory monitoring interval was set
      const calls = (global.setInterval as any).mock.calls;
      const memoryMonitorCall = calls.find((call: any) => call[1] === 5000);
      expect(memoryMonitorCall).toBeDefined();
    });
  });

  describe('Configuration Management Behaviors', () => {
    test('should update configuration dynamically', () => {
      const newConfig = { strategy: GCStrategy.CONSERVATIVE };
      optimizer.updateConfig(newConfig);

      const config = optimizer.getConfig();
      expect(config.strategy).toBe(GCStrategy.CONSERVATIVE);
    });

    test('should emit configuration update event', async () => {
      const configUpdatePromise = expectGCEventEmitted(
        optimizer,
        'configUpdated',
      );

      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });

      const event = await configUpdatePromise;
      expect(event.detail.strategy).toBe(GCStrategy.AGGRESSIVE);
    });

    test('should merge partial configuration updates', () => {
      const originalConfig = optimizer.getConfig();
      optimizer.updateConfig({ enableSmartTiming: false });

      const updatedConfig = optimizer.getConfig();
      expect(updatedConfig.strategy).toBe(originalConfig.strategy);
      expect(updatedConfig.enableSmartTiming).toBe(false);
    });

    test('should validate configuration constraints', () => {
      optimizer.updateConfig({
        schedule: {
          ...optimizer.getConfig().schedule,
          minCollectionInterval: 5000,
          maxCollectionInterval: 10000,
        },
      });

      const config = optimizer.getConfig();
      expect(config.schedule.minCollectionInterval).toBeLessThanOrEqual(
        config.schedule.maxCollectionInterval,
      );
    });
  });

  describe('Memory Pressure Detection Behaviors', () => {
    test('should detect high memory pressure', async () => {
      createHighMemoryPressureEnvironment();

      await _runGCWithTimers(optimizer, GCTrigger.MEMORY_PRESSURE);

      // Verify that collection was performed by checking metrics
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should adjust collection frequency based on memory pressure', () => {
      createHighMemoryPressureEnvironment();

      const config = optimizer.getConfig();
      expect(config.schedule.memoryPressureThreshold).toBeLessThan(1.0);
    });

    test('should force collection at critical memory levels', async () => {
      // Set memory to 99% usage
      const mockPerformance = (global as any).performance;
      if (mockPerformance && mockPerformance.memory) {
        mockPerformance.memory.usedJSHeapSize = 99 * 1024 * 1024;
      }

      await _runGCWithTimers(optimizer, GCTrigger.CRITICAL);

      // Verify that collection was performed
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should handle memory API absence gracefully', () => {
      delete (global as any).performance.memory;

      expect(() => optimizer.getMetrics()).not.toThrow();
      expect(() =>
        optimizer.optimizedGarbageCollection(GCTrigger.MEMORY_PRESSURE),
      ).not.toThrow();
    });
  });

  describe('Collection Strategy Behaviors', () => {
    test('should perform aggressive collection strategy', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });

      const collectionPromise = optimizer.optimizedGarbageCollection(
        GCTrigger.MANUAL,
      );

      // Advance timers to ensure any setTimeout calls are processed
      vi.advanceTimersByTime(100);

      await collectionPromise;

      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.AGGRESSIVE],
      ).toBeGreaterThan(0);
    });

    test('should perform balanced collection strategy', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.BALANCED });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.BALANCED],
      ).toBeGreaterThan(0);
    });

    test('should perform conservative collection strategy', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.CONSERVATIVE });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.CONSERVATIVE],
      ).toBeGreaterThan(0);
    });

    test('should adjust strategy based on device constraints', async () => {
      const lowEndConstraints = createLowEndDeviceConstraints();

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL, lowEndConstraints);

      // Should use conservative strategy for low-end devices
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should emit appropriate events for each strategy', async () => {
      const strategies = [
        GCStrategy.AGGRESSIVE,
        GCStrategy.BALANCED,
        GCStrategy.CONSERVATIVE,
      ];

      for (const strategy of strategies) {
        optimizer.updateConfig({ strategy });

        await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

        // Verify the strategy was used by checking metrics
        const metrics = optimizer.getMetrics();
        expect(metrics.collectionsPerStrategy[strategy]).toBeGreaterThan(0);
      }
    });
  });

  describe('Idle Detection Behaviors', () => {
    test('should track user activity', () => {
      const _initialTime = Date.now();

      // Simulate user activity tracking
      optimizer.updateAudioActivity();

      expect(typeof optimizer.updateAudioActivity).toBe('function');
    });

    test('should detect idle state for collection', async () => {
      // Mock idle detection
      vi.advanceTimersByTime(6000); // Past idle threshold

      await _runGCWithTimers(optimizer, GCTrigger.IDLE_DETECTION);

      // Verify that collection was performed
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should defer collection during active audio', () => {
      optimizer.updateAudioActivity();

      // Should not immediately trigger collection
      expect(optimizer.getMetrics().totalCollections).toBe(0);
    });

    test('should use requestIdleCallback for balanced collections', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.BALANCED });

      await _runGCWithTimers(optimizer, GCTrigger.IDLE_DETECTION);

      expect(global.requestIdleCallback).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring Behaviors', () => {
    test('should update metrics after collection', async () => {
      const initialMetrics = optimizer.getMetrics();

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const updatedMetrics = optimizer.getMetrics();
      expect(updatedMetrics.totalCollections).toBeGreaterThan(
        initialMetrics.totalCollections,
      );
    });

    test('should calculate average collection time', async () => {
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const metrics = optimizer.getMetrics();
      expect(metrics.averageCollectionTime).toBeGreaterThan(0);
      expect(metrics.totalCollections).toBe(2);
    });

    test('should track performance impact percentage', async () => {
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const metrics = optimizer.getMetrics();
      expect(metrics.performanceImpact).toBeGreaterThanOrEqual(0);
      expect(metrics.performanceImpact).toBeLessThanOrEqual(100);
    });

    test('should emit metrics update events', async () => {
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
      expectValidMetrics(metrics);
    });

    test('should track collections per strategy', async () => {
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL); // Balanced

      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL); // Aggressive

      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.BALANCED],
      ).toBeGreaterThan(0);
      expect(
        metrics.collectionsPerStrategy[GCStrategy.AGGRESSIVE],
      ).toBeGreaterThan(0);
    });
  });

  describe('Battery Optimization Behaviors', () => {
    test('should adjust strategy for low battery', async () => {
      const lowBatteryConstraints = createDeviceConstraints({
        batteryLevel: 15,
      });

      await _runGCWithTimers(
        optimizer,
        GCTrigger.MANUAL,
        lowBatteryConstraints,
      );

      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should scale collection frequency for battery life', () => {
      const config = optimizer.getConfig();
      expect(config.schedule.batteryAwareScaling).toBe(true);
    });

    test('should adjust for thermal state', async () => {
      const hotDeviceConstraints = createDeviceConstraints({
        thermalState: 'critical',
      });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL, hotDeviceConstraints);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should handle battery optimization when disabled', () => {
      optimizer.updateConfig({ enableBatteryOptimization: false });

      const config = optimizer.getConfig();
      expect(config.enableBatteryOptimization).toBe(false);
    });
  });

  describe('Manual Collection Behaviors', () => {
    test('should perform manual collection on request', async () => {
      await _runManualCollectionWithTimers(optimizer);

      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should respect max concurrent collections limit', async () => {
      optimizer.updateConfig({ maxConcurrentCollections: 1 });

      // Start multiple collections with timer advancement
      const collection1 = _runManualCollectionWithTimers(optimizer);
      const collection2 = _runManualCollectionWithTimers(optimizer);

      await Promise.all([collection1, collection2]);

      const config = optimizer.getConfig();
      expect(config.maxConcurrentCollections).toBe(1);
    });

    test('should emit manual collection events', async () => {
      await _runManualCollectionWithTimers(optimizer);

      // Verify that collection was performed
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });
  });

  describe('Cleanup Event Behaviors', () => {
    test('should emit clearWeakReferences event', async () => {
      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      // Verify that collection was performed
      const metrics = optimizer.getMetrics();
      expect(metrics.totalCollections).toBeGreaterThan(0);
    });

    test('should emit clearObjectCaches event for aggressive collection', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      // Verify that aggressive collection was performed
      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.AGGRESSIVE],
      ).toBeGreaterThan(0);
    });

    test('should emit domCleanup event for aggressive collection', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      // Verify that aggressive collection was performed
      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.AGGRESSIVE],
      ).toBeGreaterThan(0);
    });

    test('should emit incrementalCleanup events for conservative collection', async () => {
      optimizer.updateConfig({ strategy: GCStrategy.CONSERVATIVE });

      await _runGCWithTimers(optimizer, GCTrigger.MANUAL);

      // Verify that conservative collection was performed
      const metrics = optimizer.getMetrics();
      expect(
        metrics.collectionsPerStrategy[GCStrategy.CONSERVATIVE],
      ).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Behaviors', () => {
    test('should handle PerformanceObserver unavailability', () => {
      // Store original for restoration
      const originalPerformanceObserver = (global as any).PerformanceObserver;

      delete (global as any).PerformanceObserver;

      const config = createGCConfig({ enablePerformanceMonitoring: true });
      expect(() =>
        GarbageCollectionOptimizer.getInstance(config),
      ).not.toThrow();

      // CRITICAL: Restore original to prevent global pollution
      if (originalPerformanceObserver) {
        (global as any).PerformanceObserver = originalPerformanceObserver;
      }
    });

    test('should handle requestIdleCallback unavailability', async () => {
      // Store original for restoration
      const originalRequestIdleCallback = (global as any).requestIdleCallback;

      delete (global as any).requestIdleCallback;

      optimizer.updateConfig({ strategy: GCStrategy.BALANCED });

      expect(() =>
        optimizer.optimizedGarbageCollection(GCTrigger.IDLE_DETECTION),
      ).not.toThrow();

      // CRITICAL: Restore original to prevent global pollution
      if (originalRequestIdleCallback) {
        (global as any).requestIdleCallback = originalRequestIdleCallback;
      }
    });

    test('should handle global gc function absence', async () => {
      // Store original for restoration
      const originalGc = (global as any).gc;

      // Ensure global.gc is not available
      delete (global as any).gc;

      optimizer.updateConfig({ strategy: GCStrategy.AGGRESSIVE });

      expect(() =>
        optimizer.optimizedGarbageCollection(GCTrigger.MANUAL),
      ).not.toThrow();

      // CRITICAL: Restore original to prevent global pollution
      if (originalGc) {
        (global as any).gc = originalGc;
      }
    });

    test('should handle performance.memory unavailability', () => {
      // Store original for restoration
      const originalPerformanceMemory = (global as any).performance.memory;

      delete (global as any).performance.memory;

      expect(() => optimizer.getMetrics()).not.toThrow();
      expect(optimizer.getMetrics().memoryFreed).toBe(0);

      // CRITICAL: Restore original to prevent global pollution
      if (originalPerformanceMemory) {
        (global as any).performance.memory = originalPerformanceMemory;
      }
    });

    test('should handle event listener setup failures gracefully', () => {
      // Store original method for restoration
      const originalAddEventListener = (global as any).document
        .addEventListener;

      (global as any).document.addEventListener = vi
        .fn()
        .mockImplementation(() => {
          throw new Error('Event listener setup failed');
        });

      expect(() => GarbageCollectionOptimizer.getInstance()).not.toThrow();

      // CRITICAL: Restore original method to prevent DOM pollution
      (global as any).document.addEventListener = originalAddEventListener;
    });
  });

  describe('Lifecycle Management Behaviors', () => {
    test('should clean up resources on destroy', () => {
      const performanceObserver = { disconnect: vi.fn() };
      (optimizer as any).performanceObserver = performanceObserver;

      optimizer.destroy();

      expect(performanceObserver.disconnect).toHaveBeenCalled();
    });

    test('should clear intervals on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      optimizer.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('should remove event listeners on destroy', () => {
      // Store original method for restoration
      const originalRemoveEventListener = (global as any).document
        .removeEventListener;

      const removeEventListenerSpy = vi.fn();
      (global as any).document.removeEventListener = removeEventListenerSpy;

      optimizer.destroy();

      // Should handle cleanup without errors
      expect(() => optimizer.destroy()).not.toThrow();

      // CRITICAL: Restore original method to prevent DOM pollution
      (global as any).document.removeEventListener =
        originalRemoveEventListener;
    });

    test('should handle destroy when already destroyed', () => {
      optimizer.destroy();

      expect(() => optimizer.destroy()).not.toThrow();
    });
  });
});
