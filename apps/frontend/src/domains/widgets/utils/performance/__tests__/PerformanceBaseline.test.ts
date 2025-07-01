/**
 * Tests for PerformanceBaseline utility
 *
 * Validates performance measurement functionality for Story 3.9
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PerformanceBaseline,
  type WidgetPerformanceMetrics,
} from '../PerformanceBaseline';

// Mock the PerformanceMonitor
vi.mock('../../../../playback/services/PerformanceMonitor.js', () => ({
  PerformanceMonitor: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getMetrics: vi.fn(() => ({
        latency: 25,
        dropoutCount: 0,
        bufferUnderruns: 0,
        cpuUsage: 0.15,
      })),
    })),
  },
}));

// Mock global performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  },
  getEntriesByType: vi.fn((type: string) => {
    if (type === 'navigation') {
      return [
        {
          fetchStart: 1000,
          loadEventEnd: 3500,
        },
      ];
    }
    if (type === 'resource') {
      return [
        { name: 'app.js', startTime: 100, responseEnd: 300 },
        { name: 'styles.css', startTime: 150, responseEnd: 250 },
        { name: 'font.woff', startTime: 200, responseEnd: 400 },
      ];
    }
    return [];
  }),
};

// Mock AudioContext
const mockAudioContext = vi.fn(() => ({}));

// Mock requestAnimationFrame
const mockRequestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16.67); // Simulate 60fps
  return 1;
});

// Mock DOM
const mockDocument = {
  querySelector: vi.fn(() => ({ tagName: 'CANVAS' })),
  querySelectorAll: vi.fn(() => ({ length: 500 })), // 500 DOM nodes
};

describe('PerformanceBaseline', () => {
  let performanceBaseline: PerformanceBaseline;

  beforeEach(() => {
    // Setup global mocks
    global.performance = mockPerformance as any;
    global.AudioContext = mockAudioContext as any;
    global.requestAnimationFrame = mockRequestAnimationFrame;
    global.document = mockDocument as any;

    performanceBaseline = new PerformanceBaseline();

    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceBaseline.stop();
  });

  describe('startBaseline', () => {
    it('should measure comprehensive performance metrics', async () => {
      const metrics = await performanceBaseline.startBaseline();

      expect(metrics).toMatchObject({
        rendering: {
          fps: expect.any(Number),
          frameTime: expect.any(Number),
          droppedFrames: expect.any(Number),
          renderCalls: expect.any(Number),
          threejsObjects: expect.any(Number),
        },
        memory: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number),
          domNodes: expect.any(Number),
        },
        components: {
          fretboardRenderTime: expect.any(Number),
          widgetSyncTime: expect.any(Number),
          noteEditingLatency: expect.any(Number),
          autoSaveLatency: expect.any(Number),
        },
        interaction: {
          clickResponseTime: expect.any(Number),
          dragResponseTime: expect.any(Number),
          keyboardResponseTime: expect.any(Number),
          scrollPerformance: expect.any(Number),
        },
        loading: {
          initialPageLoad: expect.any(Number),
          exerciseSwitch: expect.any(Number),
          widgetInitialization: expect.any(Number),
          assetLoadTime: expect.any(Number),
        },
        audio: {
          latency: 25,
          dropouts: 0,
          bufferUnderruns: 0,
          cpuUsage: 0.15,
        },
        timestamp: expect.any(Number),
      });
    });

    it('should calculate correct memory metrics', async () => {
      const metrics = await performanceBaseline.startBaseline();

      expect(metrics.memory.heapUsed).toBeCloseTo(50, 1); // ~50MB
      expect(metrics.memory.heapTotal).toBeCloseTo(100, 1); // ~100MB
      expect(metrics.memory.domNodes).toBe(500);
    });

    it('should calculate correct loading metrics', async () => {
      const metrics = await performanceBaseline.startBaseline();

      expect(metrics.loading.initialPageLoad).toBe(2500); // 3500 - 1000
      expect(metrics.loading.assetLoadTime).toBe(200); // Average of (200, 100, 200)
    });

    it('should handle missing performance API gracefully', async () => {
      global.performance = { ...mockPerformance, memory: undefined } as any;

      const metrics = await performanceBaseline.startBaseline();

      expect(metrics.memory.heapUsed).toBe(0);
      expect(metrics.memory.heapTotal).toBe(0);
    });
  });

  describe('analyzePerformance', () => {
    const mockMetrics: WidgetPerformanceMetrics = {
      rendering: {
        fps: 55,
        frameTime: 18,
        droppedFrames: 2,
        renderCalls: 60,
        threejsObjects: 100,
      },
      memory: {
        heapUsed: 120,
        heapTotal: 200,
        external: 10,
        arrayBuffers: 5,
        domNodes: 500,
      },
      components: {
        fretboardRenderTime: 5,
        widgetSyncTime: 3,
        noteEditingLatency: 15,
        autoSaveLatency: 20,
      },
      interaction: {
        clickResponseTime: 80,
        dragResponseTime: 90,
        keyboardResponseTime: 70,
        scrollPerformance: 58,
      },
      loading: {
        initialPageLoad: 2800,
        exerciseSwitch: 400,
        widgetInitialization: 250,
        assetLoadTime: 150,
      },
      audio: { latency: 35, dropouts: 0, bufferUnderruns: 0, cpuUsage: 0.2 },
      timestamp: Date.now(),
    };

    it('should analyze performance targets correctly', () => {
      const targets = performanceBaseline.analyzePerformance(mockMetrics);

      expect(targets).toHaveLength(6);

      // Check FPS analysis
      const fpsTarget = targets.find((t) => t.metric === 'rendering.fps');
      expect(fpsTarget).toMatchObject({
        current: 55,
        target: 60,
        critical: 30,
        unit: 'fps',
        status: 'good', // 55 is between 45 (good) and 60 (excellent)
      });

      // Check memory analysis
      const memoryTarget = targets.find((t) => t.metric === 'memory.heapUsed');
      expect(memoryTarget).toMatchObject({
        current: 120,
        target: 150,
        critical: 250,
        unit: 'MB',
        status: 'excellent', // 120 < 150 (excellent threshold)
      });

      // Check audio latency
      const audioTarget = targets.find((t) => t.metric === 'audio.latency');
      expect(audioTarget).toMatchObject({
        current: 35,
        target: 30,
        critical: 50,
        unit: 'ms',
        status: 'good', // 35 is between 30 and 40
      });
    });

    it('should identify critical performance issues', () => {
      const criticalMetrics: WidgetPerformanceMetrics = {
        ...mockMetrics,
        rendering: { ...mockMetrics.rendering, fps: 25 }, // Critical: < 30
        memory: { ...mockMetrics.memory, heapUsed: 300 }, // Critical: > 250
        audio: { ...mockMetrics.audio, latency: 60 }, // Critical: > 50
      };

      const targets = performanceBaseline.analyzePerformance(criticalMetrics);
      const criticalTargets = targets.filter((t) => t.status === 'critical');

      expect(criticalTargets).toHaveLength(3);
      expect(criticalTargets.map((t) => t.metric)).toContain('rendering.fps');
      expect(criticalTargets.map((t) => t.metric)).toContain('memory.heapUsed');
      expect(criticalTargets.map((t) => t.metric)).toContain('audio.latency');
    });
  });

  describe('generateReport', () => {
    const mockMetrics: WidgetPerformanceMetrics = {
      rendering: {
        fps: 58,
        frameTime: 17.2,
        droppedFrames: 1,
        renderCalls: 60,
        threejsObjects: 85,
      },
      memory: {
        heapUsed: 145,
        heapTotal: 180,
        external: 8,
        arrayBuffers: 4,
        domNodes: 450,
      },
      components: {
        fretboardRenderTime: 4.5,
        widgetSyncTime: 2.8,
        noteEditingLatency: 12,
        autoSaveLatency: 18,
      },
      interaction: {
        clickResponseTime: 75,
        dragResponseTime: 85,
        keyboardResponseTime: 65,
        scrollPerformance: 59,
      },
      loading: {
        initialPageLoad: 2600,
        exerciseSwitch: 380,
        widgetInitialization: 220,
        assetLoadTime: 140,
      },
      audio: { latency: 28, dropouts: 0, bufferUnderruns: 0, cpuUsage: 0.18 },
      timestamp: 1704312000000, // Fixed timestamp for testing
    };

    it('should generate comprehensive performance report', () => {
      const report = performanceBaseline.generateReport(mockMetrics);

      expect(report).toContain('Performance Baseline Report');
      expect(report).toContain('2024-01-03T20:00:00.000Z'); // Fixed timestamp
      expect(report).toContain('## Summary');
      expect(report).toContain('## Key Metrics');

      // Check specific metrics in report
      expect(report).toContain('**FPS:** 58');
      expect(report).toContain('**Frame Time:** 17.2ms');
      expect(report).toContain('**Heap Used:** 145MB');
      expect(report).toContain('**Latency:** 28ms');
      expect(report).toContain('**Page Load:** 2600ms');
    });

    it('should categorize performance issues correctly', () => {
      const report = performanceBaseline.generateReport(mockMetrics);

      // Should show good performance for most metrics
      expect(report).toMatch(/Good Performance:\s*\d+\s*metrics/);
      expect(report).toMatch(/Warnings:\s*\d+\s*metrics/);
      expect(report).toMatch(/Critical Issues:\s*\d+\s*metrics/);
    });

    it('should handle critical issues in report', () => {
      const criticalMetrics: WidgetPerformanceMetrics = {
        ...mockMetrics,
        rendering: { ...mockMetrics.rendering, fps: 20 },
        loading: { ...mockMetrics.loading, initialPageLoad: 6000 },
      };

      const report = performanceBaseline.generateReport(criticalMetrics);

      expect(report).toContain('## Critical Issues');
      expect(report).toContain('🚨 **rendering.fps:** 20fps');
      expect(report).toContain('🚨 **loading.initialPageLoad:** 6000ms');
    });
  });

  describe('performance measurement methods', () => {
    it('should measure rendering performance within reasonable bounds', async () => {
      const renderingMetrics = await (
        performanceBaseline as any
      ).measureRenderingPerformance();

      expect(renderingMetrics.fps).toBeGreaterThan(0);
      expect(renderingMetrics.fps).toBeLessThanOrEqual(120); // Reasonable upper bound
      expect(renderingMetrics.frameTime).toBeGreaterThan(0);
      expect(renderingMetrics.droppedFrames).toBeGreaterThanOrEqual(0);
      expect(renderingMetrics.renderCalls).toBeGreaterThan(0);
    });

    it('should measure memory usage correctly', async () => {
      const memoryMetrics = await (
        performanceBaseline as any
      ).measureMemoryUsage();

      expect(memoryMetrics.heapUsed).toBeGreaterThanOrEqual(0);
      expect(memoryMetrics.heapTotal).toBeGreaterThanOrEqual(
        memoryMetrics.heapUsed,
      );
      expect(memoryMetrics.domNodes).toBe(500); // From mock
    });

    it('should simulate component performance measurements', async () => {
      const componentMetrics = await (
        performanceBaseline as any
      ).measureComponentPerformance();

      expect(componentMetrics.fretboardRenderTime).toBeGreaterThan(0);
      expect(componentMetrics.widgetSyncTime).toBeGreaterThan(0);
      expect(componentMetrics.noteEditingLatency).toBeGreaterThan(0);
      expect(componentMetrics.autoSaveLatency).toBeGreaterThan(0);
    });
  });

  describe('cleanup and error handling', () => {
    it('should stop monitoring cleanly', () => {
      performanceBaseline.stop();

      // Should not throw errors
      expect(() => performanceBaseline.stop()).not.toThrow();
    });

    it('should handle missing AudioContext gracefully', async () => {
      global.AudioContext = undefined as any;

      const metrics = await performanceBaseline.startBaseline();

      // Should still return valid metrics
      expect(metrics.audio).toBeDefined();
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should handle missing canvas element', async () => {
      mockDocument.querySelector.mockReturnValueOnce(null as any);

      const metrics = await performanceBaseline.startBaseline();

      expect(metrics.rendering.threejsObjects).toBe(100); // Default estimate
    });
  });
});
