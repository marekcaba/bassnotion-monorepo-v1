/**
 * Test suite for BundleOptimizer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BundleOptimizer,
  type LazyLoadableComponent,
} from '../BundleOptimizer';

// Mock performance API
const mockPerformanceNow = vi.fn();

// Create a simple PerformanceObserver mock
const mockPerformanceObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock DOM APIs
const mockDocument = {
  createElement: vi.fn(),
  head: {
    appendChild: vi.fn(),
  },
};

// Mock window.fetch
const mockFetch = vi.fn();

// Mock console methods
const mockConsoleDebug = vi.fn();
const mockConsoleWarn = vi.fn();
const mockConsoleError = vi.fn();

// Mock timers
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

// Mock component for lazy loading
const mockComponent = { default: () => 'MockComponent' };

describe('BundleOptimizer', () => {
  let bundleOptimizer: BundleOptimizer;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock global APIs
    global.performance = {
      ...global.performance,
      now: mockPerformanceNow,
    };
    mockPerformanceNow.mockReturnValue(1000);

    global.PerformanceObserver = mockPerformanceObserver as any;
    mockPerformanceObserver.mockImplementation((_callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    }));

    global.document = mockDocument as any;

    // Mock window properties
    Object.assign(global.window, {
      fetch: mockFetch,
      performance: global.performance,
      PerformanceObserver: mockPerformanceObserver as any,
    });

    // Mock fetch response
    mockFetch.mockResolvedValue({
      headers: {
        get: vi.fn().mockReturnValue('1024'), // 1KB
      },
    });

    // Mock document.createElement
    const mockLink = {
      rel: '',
      href: '',
      crossOrigin: '',
      onload: null as any,
      onerror: null as any,
    };
    mockDocument.createElement.mockReturnValue(mockLink);

    // Mock console methods - clear previous calls
    mockConsoleDebug.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();

    global.console = {
      ...global.console,
      debug: mockConsoleDebug,
      warn: mockConsoleWarn,
      error: mockConsoleError,
    };

    // Mock timers
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;
    mockSetInterval.mockReturnValue(12345);

    // Get fresh instance
    bundleOptimizer = BundleOptimizer.getInstance();
  });

  afterEach(() => {
    // Clean up singleton instance
    if (bundleOptimizer) {
      bundleOptimizer.destroy();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BundleOptimizer.getInstance();
      const instance2 = BundleOptimizer.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = BundleOptimizer.getInstance();
      instance1.destroy();

      const instance2 = BundleOptimizer.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });

  describe('Lazy Component Registration', () => {
    it('should register lazy component', () => {
      const component: LazyLoadableComponent = {
        componentName: 'TestComponent',
        importPath: './TestComponent',
        priority: 'high',
      };

      bundleOptimizer.registerLazyComponent(component);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Registered lazy component: TestComponent (priority: high)',
      );

      const registry = bundleOptimizer.getChunkRegistry();
      expect(registry.has('TestComponent')).toBe(true);
      expect(registry.get('TestComponent')?.priority).toBe('high');
    });

    it('should register component with preload condition', () => {
      const component: LazyLoadableComponent = {
        componentName: 'PreloadComponent',
        importPath: './PreloadComponent',
        priority: 'critical',
        preloadCondition: () => true,
      };

      bundleOptimizer.registerLazyComponent(component);

      const registry = bundleOptimizer.getChunkRegistry();
      const chunkInfo = registry.get('PreloadComponent');
      expect(chunkInfo?.preload).toBe(true);
    });
  });

  describe('Lazy Component Loading', () => {
    it('should lazy load component successfully', async () => {
      const importFn = vi.fn().mockResolvedValue(mockComponent);
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1100); // 100ms load time

      const component = await bundleOptimizer.lazyLoadComponent(
        'TestComponent',
        importFn,
        { priority: 'high' },
      );

      expect(component).toBe(mockComponent.default);
      expect(importFn).toHaveBeenCalledTimes(1);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Lazy loaded: TestComponent (100.0ms)',
      );
    });

    it('should return cached component on subsequent requests', async () => {
      const importFn = vi.fn().mockResolvedValue(mockComponent);

      // First load
      await bundleOptimizer.lazyLoadComponent('CachedComponent', importFn);

      // Second load (should be cached)
      const component = await bundleOptimizer.lazyLoadComponent(
        'CachedComponent',
        importFn,
      );

      expect(component).toBe(mockComponent.default);
      expect(importFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle loading timeout', async () => {
      const importFn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockComponent), 2000); // 2 second delay
          }),
      );

      await expect(
        bundleOptimizer.lazyLoadComponent('TimeoutComponent', importFn, {
          timeout: 1000,
        }),
      ).rejects.toThrow('Component load timeout: TimeoutComponent');
    });

    it('should handle loading errors', async () => {
      const error = new Error('Import failed');
      const importFn = vi.fn().mockRejectedValue(error);

      await expect(
        bundleOptimizer.lazyLoadComponent('ErrorComponent', importFn),
      ).rejects.toThrow('Import failed');

      expect(mockConsoleError).toHaveBeenCalledWith(
        '[BundleOptimizer] Failed to load component: ErrorComponent',
        error,
      );
    });

    it('should handle concurrent loading requests', async () => {
      const importFn = vi.fn().mockResolvedValue(mockComponent);

      // Start multiple concurrent loads
      const promises = [
        bundleOptimizer.lazyLoadComponent('ConcurrentComponent', importFn),
        bundleOptimizer.lazyLoadComponent('ConcurrentComponent', importFn),
        bundleOptimizer.lazyLoadComponent('ConcurrentComponent', importFn),
      ];

      const results = await Promise.all(promises);

      // All should return the same component
      expect(results[0]).toBe(mockComponent.default);
      expect(results[1]).toBe(mockComponent.default);
      expect(results[2]).toBe(mockComponent.default);

      // Import function should only be called once
      expect(importFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Preloading', () => {
    it('should preload critical components', async () => {
      // Register critical components
      bundleOptimizer.registerLazyComponent({
        componentName: 'CriticalComponent1',
        importPath: './Critical1',
        priority: 'critical',
      });

      bundleOptimizer.registerLazyComponent({
        componentName: 'CriticalComponent2',
        importPath: './Critical2',
        priority: 'high',
        preloadCondition: () => true,
      });

      await bundleOptimizer.preloadCriticalComponents();

      expect(mockDocument.createElement).toHaveBeenCalledWith('link');
      expect(mockDocument.head.appendChild).toHaveBeenCalled();
    });

    it('should create preload links with correct attributes', async () => {
      const mockLink = {
        rel: '',
        href: '',
        crossOrigin: '',
        onload: null as any,
        onerror: null as any,
      };
      mockDocument.createElement.mockReturnValue(mockLink);

      bundleOptimizer.registerLazyComponent({
        componentName: 'PreloadTest',
        importPath: './PreloadTest',
        priority: 'critical',
      });

      await bundleOptimizer.preloadCriticalComponents();

      expect(mockLink.rel).toBe('modulepreload');
      expect(mockLink.crossOrigin).toBe('anonymous');
      expect(mockLink.href).toContain('PreloadTest.js');
    });
  });

  describe('Bundle Metrics', () => {
    it('should calculate current metrics', () => {
      // Register some components
      bundleOptimizer.registerLazyComponent({
        componentName: 'Component1',
        importPath: './Component1',
        priority: 'high',
      });

      bundleOptimizer.registerLazyComponent({
        componentName: 'Component2',
        importPath: './Component2',
        priority: 'medium',
      });

      const metrics = bundleOptimizer.getCurrentMetrics();

      expect(metrics).toHaveProperty('totalBundleSize');
      expect(metrics).toHaveProperty('chunkSizes');
      expect(metrics).toHaveProperty('loadedChunks');
      expect(metrics).toHaveProperty('pendingChunks');
      expect(metrics).toHaveProperty('failedChunks');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('compressionRatio');
      expect(metrics).toHaveProperty('timestamp');

      expect(metrics.chunkSizes.size).toBe(2);
      expect(metrics.compressionRatio).toBe(0.3); // 30%
    });

    it('should calculate cache hit rate correctly', async () => {
      const importFn = vi.fn().mockResolvedValue(mockComponent);

      // Load a component (cache miss)
      await bundleOptimizer.lazyLoadComponent('CacheTest', importFn);

      // Load the same component again (cache hit)
      await bundleOptimizer.lazyLoadComponent('CacheTest', importFn);

      const metrics = bundleOptimizer.getCurrentMetrics();
      expect(metrics.cacheHitRate).toBe(100); // 100% cache hit rate
    });

    it('should maintain metrics history', () => {
      const history = bundleOptimizer.getMetricsHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should start metrics collection timer', () => {
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        10000, // 10 second interval
      );
    });
  });

  describe('Bundle Optimization', () => {
    it('should optimize bundle loading based on patterns', () => {
      // Mock slow loading chunks
      const registry = bundleOptimizer.getChunkRegistry();
      registry.set('SlowComponent', {
        name: 'SlowComponent',
        size: 1024,
        dependencies: [],
        priority: 'medium',
        preload: false,
        loaded: true,
        loadTime: 3000, // 3 seconds (slow)
      });

      bundleOptimizer.optimizeBundleLoading();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Found 1 slow-loading chunks',
      );
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Marked for preload: SlowComponent',
      );

      // Check that the chunk was marked for preload
      const updatedChunk = registry.get('SlowComponent');
      expect(updatedChunk?.preload).toBe(true);
    });

    it('should warn about large bundle sizes', () => {
      // Mock large bundle
      const registry = bundleOptimizer.getChunkRegistry();
      registry.set('LargeComponent', {
        name: 'LargeComponent',
        size: 3 * 1024 * 1024, // 3MB
        dependencies: [],
        priority: 'medium',
        preload: false,
        loaded: true,
      });

      bundleOptimizer.optimizeBundleLoading();

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[BundleOptimizer] Large bundle size detected:',
        ),
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should setup performance observer when available', () => {
      expect(mockPerformanceObserver).toHaveBeenCalled();
    });

    it('should handle missing performance observer gracefully', () => {
      // Mock missing PerformanceObserver
      delete (global.window as any).PerformanceObserver;

      const optimizer = BundleOptimizer.getInstance();
      expect(optimizer).toBeDefined();
    });

    it('should process performance entries correctly', () => {
      // Simulate performance entry processing
      const mockEntry = {
        name: 'https://example.com/chunk-abc123.js',
        duration: 150,
        entryType: 'resource',
      };

      // Register a chunk first
      bundleOptimizer.registerLazyComponent({
        componentName: 'chunk-abc123',
        importPath: './chunk-abc123',
        priority: 'medium',
      });

      // Simulate processing the entry
      const optimizer = bundleOptimizer as any;
      optimizer.processPerformanceEntry(mockEntry);

      const registry = bundleOptimizer.getChunkRegistry();
      const chunk = registry.get('chunk-abc123');
      expect(chunk?.loadTime).toBe(150);
      expect(chunk?.loaded).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxChunkSize: 500 * 1024, // 500KB
        preloadThreshold: 1000, // 1 second
        cacheStrategy: 'aggressive' as const,
      };

      bundleOptimizer.updateConfig(newConfig);

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Configuration updated:',
        expect.objectContaining(newConfig),
      );
    });
  });

  describe('Reporting', () => {
    it('should generate optimization report', async () => {
      // Add some test data
      bundleOptimizer.registerLazyComponent({
        componentName: 'ReportTest',
        importPath: './ReportTest',
        priority: 'high',
      });

      const importFn = vi.fn().mockResolvedValue(mockComponent);
      await bundleOptimizer.lazyLoadComponent('ReportTest', importFn);

      const report = bundleOptimizer.generateOptimizationReport();

      expect(report).toContain('Bundle Optimization Report');
      expect(report).toContain('Bundle Metrics');
      expect(report).toContain('Performance Analysis');
      expect(report).toContain('Chunk Details');
      expect(report).toContain('Optimization Recommendations');
      expect(report).toContain('Configuration');
      expect(report).toContain('ReportTest');
    });

    it('should provide optimization recommendations', () => {
      const report = bundleOptimizer.generateOptimizationReport();

      // Should contain at least one recommendation
      expect(report).toMatch(/✅|⚠️|❌/);
    });
  });

  describe('Resource Tracking', () => {
    it('should track fetch requests for JS files', async () => {
      // Simulate a fetch request for a JS file
      bundleOptimizer.simulateResourceLoad('https://example.com/chunk-test.js');

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Tracked chunk: chunk-test (1024 bytes)',
      );
    });

    it('should extract chunk names correctly', () => {
      const optimizer = bundleOptimizer as any;

      expect(
        optimizer.extractChunkName('https://example.com/chunk-abc123.js'),
      ).toBe('chunk-abc123');
      expect(optimizer.extractChunkName('/static/chunks/widget-main.js')).toBe(
        'widget-main',
      );
      expect(optimizer.extractChunkName('invalid-url')).toBe('invalid-url');
      expect(optimizer.extractChunkName('')).toBe('unknown-chunk');
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch override errors gracefully', () => {
      // Mock fetch that throws
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw when setting up resource tracking
      expect(() => {
        const optimizer = bundleOptimizer as any;
        optimizer.trackResourceLoading();
      }).not.toThrow();
    });

    it('should handle preload errors gracefully', async () => {
      // Mock document.createElement to throw
      mockDocument.createElement.mockImplementation(() => {
        throw new Error('DOM error');
      });

      bundleOptimizer.registerLazyComponent({
        componentName: 'ErrorPreload',
        importPath: './ErrorPreload',
        priority: 'critical',
      });

      // Should not throw
      await expect(
        bundleOptimizer.preloadCriticalComponents(),
      ).resolves.not.toThrow();
    });
  });

  describe('Destruction and Cleanup', () => {
    it('should stop timers on destroy', () => {
      bundleOptimizer.destroy();

      expect(mockClearInterval).toHaveBeenCalledWith(12345);
    });

    it('should clear all data on destroy', () => {
      bundleOptimizer.registerLazyComponent({
        componentName: 'DestroyTest',
        importPath: './DestroyTest',
        priority: 'medium',
      });

      bundleOptimizer.destroy();

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        '[BundleOptimizer] Destroyed',
      );

      // Registry should be empty after destroy
      const newInstance = BundleOptimizer.getInstance();
      expect(newInstance.getChunkRegistry().size).toBe(0);
    });
  });
});
