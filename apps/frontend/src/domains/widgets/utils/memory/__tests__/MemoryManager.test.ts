/**
 * Test Suite for MemoryManager
 *
 * Tests comprehensive memory management functionality including:
 * - Component registration and tracking
 * - Memory usage monitoring and alerting
 * - Leak detection and cleanup strategies
 * - React hook integration
 *
 * @author BassNotion Team
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MemoryManager,
  useMemoryManager,
  type MemoryUsageMetrics,
} from '../MemoryManager.js';

// Mock performance.memory
const mockPerformanceMemory = {
  usedJSHeapSize: 50 * 1024 * 1024, // 50MB
  totalJSHeapSize: 60 * 1024 * 1024, // 60MB
  jsHeapSizeLimit: 2048 * 1024 * 1024, // 2GB
};

// Mock performance.now
const mockPerformanceNow = vi.fn();

// Mock console methods
const mockConsoleDebug = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock setTimeout/clearTimeout for interval management
const mockSetTimeout = vi.fn();
const mockClearTimeout = vi.fn();
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('MemoryManager', () => {
  let memManager: MemoryManager;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock performance
    global.performance = {
      ...global.performance,
      now: mockPerformanceNow,
      memory: mockPerformanceMemory,
    };
    mockPerformanceNow.mockReturnValue(1000);

    // Mock console methods
    global.console = {
      ...global.console,
      debug: mockConsoleDebug,
      warn: mockConsoleWarn,
      error: mockConsoleError,
    };

    // Mock timers
    global.setTimeout = mockSetTimeout as any;
    global.clearTimeout = mockClearTimeout as any;
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;

    // Mock setInterval to return a mock timer ID
    mockSetInterval.mockReturnValue(12345);

    // Get fresh instance
    memManager = MemoryManager.getInstance();
  });

  afterEach(() => {
    // Clean up singleton instance
    if (memManager) {
      memManager.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MemoryManager.getInstance();
      const instance2 = MemoryManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = MemoryManager.getInstance();
      instance1.destroy();

      const instance2 = MemoryManager.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Component Registration', () => {
    it('should register component with default values', () => {
      memManager.registerComponent('TestComponent');

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[MemoryManager] Registered component: TestComponent (0MB estimated)',
      );
    });

    it('should register component with estimated size', () => {
      memManager.registerComponent('LargeComponent', 25);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[MemoryManager] Registered component: LargeComponent (25MB estimated)',
      );
    });

    it('should register component with cleanup callback', () => {
      const cleanupCallback = vi.fn();
      memManager.registerComponent('ComponentWithCleanup', 10, cleanupCallback);

      memManager.unregisterComponent('ComponentWithCleanup');
      expect(cleanupCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple cleanup callbacks', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      memManager.registerComponent('TestComponent', 5, cleanup1);
      memManager.addCleanupCallback('TestComponent', cleanup2);

      memManager.unregisterComponent('TestComponent');

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it('should warn when unregistering unknown component', () => {
      memManager.unregisterComponent('UnknownComponent');

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[MemoryManager] Attempted to unregister unknown component: UnknownComponent',
      );
    });

    it('should warn when adding cleanup to unknown component', () => {
      const cleanup = vi.fn();
      memManager.addCleanupCallback('UnknownComponent', cleanup);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[MemoryManager] Cannot add cleanup to unknown component: UnknownComponent',
      );
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should get current memory usage with performance.memory', () => {
      const usage = memManager.getCurrentMemoryUsage();

      expect(usage.heapUsed).toBeCloseTo(50, 1); // 50MB estimation from fallback
      expect(usage.heapTotal).toBeCloseTo(60, 1); // 60MB estimation from fallback
      expect(usage.heapLimit).toBeCloseTo(2048, 1); // 2GB estimation from fallback
      expect(usage.timestamp).toBeGreaterThan(0);
    });

    it('should fallback to estimation when performance.memory unavailable', () => {
      // Remove performance.memory
      delete (global.performance as any).memory;

      memManager.registerComponent('Component1', 20);
      memManager.registerComponent('Component2', 15);

      const usage = memManager.getCurrentMemoryUsage();

      expect(usage.heapUsed).toBe(85); // 50 (base) + 20 + 15
      expect(usage.heapTotal).toBeCloseTo(102, 1); // 85 * 1.2
      expect(usage.heapLimit).toBe(2048);
    });

    it('should track component access time', () => {
      memManager.registerComponent('TestComponent');

      // Mock Date.now to track access time
      const originalDateNow = Date.now;
      const mockDateNow = vi.fn(() => 2000);
      Date.now = mockDateNow;

      memManager.touchComponent('TestComponent');

      // Component should be marked as recently accessed
      expect(mockDateNow).toHaveBeenCalled();

      // Restore original Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect emergency threshold breach', () => {
      // Mock high memory usage
      mockPerformanceMemory.usedJSHeapSize = 300 * 1024 * 1024; // 300MB

      const alerts = memManager.checkForMemoryLeaks();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.type).toBe('absolute_threshold');
      expect(alerts[0]?.severity).toBe('critical');
      expect(alerts[0]?.message).toContain(
        'Emergency memory threshold exceeded',
      );
    });

    it('should detect critical threshold breach', () => {
      // Mock critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 220 * 1024 * 1024; // 220MB

      const alerts = memManager.checkForMemoryLeaks();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.type).toBe('absolute_threshold');
      expect(alerts[0]?.severity).toBe('high');
      expect(alerts[0]?.message).toContain(
        'Critical memory threshold exceeded',
      );
    });

    it('should detect warning threshold breach', () => {
      // Mock warning memory usage
      mockPerformanceMemory.usedJSHeapSize = 170 * 1024 * 1024; // 170MB

      const alerts = memManager.checkForMemoryLeaks();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.type).toBe('absolute_threshold');
      expect(alerts[0]?.severity).toBe('medium');
      expect(alerts[0]?.message).toContain('Warning memory threshold exceeded');
    });

    it('should detect high memory growth rate', () => {
      // Simulate memory history with growth
      const baseTime = Date.now();
      const memoryHistory: MemoryUsageMetrics[] = [];

      for (let i = 0; i < 10; i++) {
        memoryHistory.push({
          heapUsed: 50 + i * 2, // Growing by 2MB each measurement
          heapTotal: 60 + i * 2,
          heapLimit: 2048,
          external: 0,
          arrayBuffers: 0,
          timestamp: baseTime + i * 1000 * 60 * 6, // 6 minutes apart
        });
      }

      // Inject history into memory manager
      (memManager as any).memoryHistory = memoryHistory;

      const alerts = memManager.checkForMemoryLeaks();

      const growthAlert = alerts.find((alert) => alert.type === 'growth_rate');
      expect(growthAlert).toBeDefined();
      expect(growthAlert?.severity).toBe('high');
      expect(growthAlert?.message).toContain(
        'High memory growth rate detected',
      );
    });

    it('should detect stale components', () => {
      // Register component
      memManager.registerComponent('StaleComponent', 15);

      // Mock old last access time (15 minutes ago)
      const component = (memManager as any).components.get('StaleComponent');
      if (component) {
        component.lastAccessed = Date.now() - 15 * 60 * 1000; // 15 minutes ago
      }

      const alerts = memManager.checkForMemoryLeaks();

      const staleAlert = alerts.find(
        (alert) => alert.type === 'component_leak',
      );
      expect(staleAlert).toBeDefined();
      expect(staleAlert?.severity).toBe('medium');
      expect(staleAlert?.message).toContain(
        'Stale component detected: StaleComponent',
      );
      expect(staleAlert?.component).toBe('StaleComponent');
    });

    it('should not alert for small stale components', () => {
      // Register small component
      memManager.registerComponent('SmallComponent', 5); // Under 10MB threshold

      // Mock old last access time
      const component = (memManager as any).components.get('SmallComponent');
      if (component) {
        component.lastAccessed = Date.now() - 15 * 60 * 1000;
      }

      const alerts = memManager.checkForMemoryLeaks();

      const staleAlert = alerts.find(
        (alert) => alert.type === 'component_leak',
      );
      expect(staleAlert).toBeUndefined();
    });
  });

  describe('Cleanup Management', () => {
    it('should trigger cleanup when critical threshold exceeded', () => {
      const globalCleanup = vi.fn();
      memManager.registerGlobalCleanup(globalCleanup);

      // Mock critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 220 * 1024 * 1024; // 220MB

      memManager.triggerCleanup();

      expect(globalCleanup).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[MemoryManager] Triggering cleanup - Memory usage:',
        ),
      );
    });

    it('should force cleanup when requested', () => {
      const globalCleanup = vi.fn();
      memManager.registerGlobalCleanup(globalCleanup);

      // Normal memory usage
      mockPerformanceMemory.usedJSHeapSize = 100 * 1024 * 1024; // 100MB

      memManager.triggerCleanup(true); // Force cleanup

      expect(globalCleanup).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup callback errors gracefully', () => {
      const errorCleanup = vi.fn(() => {
        throw new Error('Cleanup failed');
      });
      const successCleanup = vi.fn();

      memManager.registerGlobalCleanup(errorCleanup);
      memManager.registerGlobalCleanup(successCleanup);

      memManager.triggerCleanup(true);

      expect(errorCleanup).toHaveBeenCalledTimes(1);
      expect(successCleanup).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[MemoryManager] Error in global cleanup callback:',
        expect.any(Error),
      );
    });

    it('should unregister global cleanup callbacks', () => {
      const cleanup = vi.fn();

      memManager.registerGlobalCleanup(cleanup);
      memManager.unregisterGlobalCleanup(cleanup);

      memManager.triggerCleanup(true);

      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe('Memory Monitoring', () => {
    it('should start monitoring on initialization', () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        5000, // 5 second interval
      );
    });

    it('should stop monitoring on destroy', () => {
      memManager.stopMonitoring();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
    });

    it('should maintain memory history within limits', () => {
      const history = memManager.getMemoryHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive memory report', () => {
      memManager.registerComponent('Component1', 20);
      memManager.registerComponent('Component2', 15);

      const report = memManager.generateMemoryReport();

      expect(report).toContain('Memory Usage Report');
      expect(report).toContain('Heap Used:');
      expect(report).toContain('Registered Components (2)');
      expect(report).toContain('Component1: 20MB');
      expect(report).toContain('Component2: 15MB');
    });

    it('should include alerts in report', () => {
      // Mock critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 220 * 1024 * 1024; // 220MB

      const report = memManager.generateMemoryReport();

      expect(report).toContain('Alerts (1)');
      expect(report).toContain('[HIGH] Critical memory threshold exceeded');
    });

    it('should show no alerts when memory is normal', () => {
      // Normal memory usage
      mockPerformanceMemory.usedJSHeapSize = 100 * 1024 * 1024; // 100MB

      const report = memManager.generateMemoryReport();

      expect(report).toContain('No memory alerts detected');
    });
  });
});

describe('useMemoryManager Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock performance
    global.performance = {
      ...global.performance,
      memory: mockPerformanceMemory,
    };

    // Mock console
    global.console = {
      ...global.console,
      debug: mockConsoleDebug,
      warn: mockConsoleWarn,
    };

    // Mock timers
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;
    mockSetInterval.mockReturnValue(12345);
  });

  afterEach(() => {
    // Clean up singleton
    const manager = MemoryManager.getInstance();
    if (manager) {
      manager.destroy();
    }
  });

  it('should register component on mount', () => {
    renderHook(() => useMemoryManager('TestComponent', 10));

    expect(mockConsoleDebug).toHaveBeenCalledWith(
      '[MemoryManager] Registered component: TestComponent (10MB estimated)',
    );
  });

  it('should unregister component on unmount', () => {
    const { unmount } = renderHook(() => useMemoryManager('TestComponent', 10));

    unmount();

    expect(mockConsoleDebug).toHaveBeenCalledWith(
      '[MemoryManager] Unregistered component: TestComponent',
    );
  });

  it('should provide cleanup utilities', () => {
    const { result } = renderHook(() => useMemoryManager('TestComponent', 10));

    expect(typeof result.current.addCleanupCallback).toBe('function');
    expect(typeof result.current.triggerCleanup).toBe('function');
    expect(typeof result.current.getMemoryUsage).toBe('function');
  });

  it('should allow adding cleanup callbacks', () => {
    const { result } = renderHook(() => useMemoryManager('TestComponent', 10));
    const cleanup = vi.fn();

    act(() => {
      result.current.addCleanupCallback(cleanup);
    });

    // Trigger component cleanup
    const manager = MemoryManager.getInstance();
    manager.unregisterComponent('TestComponent');

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should provide memory usage access', () => {
    const { result } = renderHook(() => useMemoryManager('TestComponent', 10));

    act(() => {
      const usage = result.current.getMemoryUsage();
      expect(usage).toBeDefined();
      expect(typeof usage.heapUsed).toBe('number');
    });
  });
});
