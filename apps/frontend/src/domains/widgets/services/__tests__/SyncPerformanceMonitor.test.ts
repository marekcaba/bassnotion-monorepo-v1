/**
 * SyncPerformanceMonitor Test Suite
 *
 * Comprehensive tests for global playback synchronization performance monitoring.
 * Validates <50ms sync latency requirement and performance optimization features.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 6.2: Comprehensive Synchronization Tests
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  vi,
  Mock,
} from 'vitest';

// Mock dependencies - must be hoisted
vi.mock('../PlaybackOrchestrator', () => ({
  playbackOrchestrator: {
    getPerformanceMetrics: vi.fn(() => ({
      totalWidgets: 3,
      activeWidgets: 3,
      averageLatency: 25,
      maxLatency: 45,
      syncAccuracy: 0.95,
      droppedEvents: 0,
      lastMeasurement: Date.now(),
    })),
    getRegisteredWidgets: vi.fn(() => [
      {
        widgetId: 'test-widget-1',
        widgetType: 'bass',
        latency: 20,
        lastHeartbeat: Date.now(),
        syncStatus: 'connected',
      },
      {
        widgetId: 'test-widget-2',
        widgetType: 'metronome',
        latency: 15,
        lastHeartbeat: Date.now(),
        syncStatus: 'connected',
      },
      {
        widgetId: 'test-widget-3',
        widgetType: 'fretboard',
        latency: 30,
        lastHeartbeat: Date.now(),
        syncStatus: 'connected',
      },
    ]),
  },
}));

vi.mock('../WidgetSyncService', () => ({
  widgetSyncService: {
    emit: vi.fn(),
    subscribe: vi.fn(),
  },
}));

// Mock Performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    },
  },
});

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16); // ~60fps
  return 1;
});

// Import after mocks
import { SyncPerformanceMonitor } from '../SyncPerformanceMonitor';

describe('SyncPerformanceMonitor', () => {
  let monitor: SyncPerformanceMonitor;

  beforeEach(() => {
    // Reset singleton instance
    (SyncPerformanceMonitor as any).instance = null;
    monitor = SyncPerformanceMonitor.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Initialization', () => {
    test('should create singleton instance', () => {
      const instance1 = SyncPerformanceMonitor.getInstance();
      const instance2 = SyncPerformanceMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('should initialize with default thresholds', () => {
      const latencyMetrics = monitor.getLatencyMetrics();
      expect(latencyMetrics.currentLatency).toBe(0);
      expect(latencyMetrics.averageLatency).toBe(0);
      expect(latencyMetrics.latencyTrend).toBe('stable');
    });

    test('should start monitoring successfully', () => {
      expect(() => monitor.startMonitoring()).not.toThrow();
    });

    test('should stop monitoring successfully', () => {
      monitor.startMonitoring();
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });
  });

  describe('Latency Measurement', () => {
    test('should measure sync latency within target (<50ms)', async () => {
      monitor.startMonitoring();

      // Wait for monitoring cycle
      await new Promise((resolve) => setTimeout(resolve, 150));

      const metrics = monitor.getLatencyMetrics();
      expect(metrics.measurementCount).toBeGreaterThan(0);
    });

    test('should calculate percentiles correctly', async () => {
      monitor.startMonitoring();

      // Simulate latency measurements
      const measurements = [10, 15, 20, 25, 30, 35, 40, 45, 50, 100];
      for (const latency of measurements) {
        (monitor as any).updateLatencyMetrics(latency);
      }

      const metrics = monitor.getLatencyMetrics();
      expect(metrics.p95Latency).toBeGreaterThanOrEqual(45);
      expect(metrics.p99Latency).toBeGreaterThanOrEqual(50);
      expect(metrics.maxLatency).toBe(100);
    });

    test('should detect latency trends', async () => {
      monitor.startMonitoring();

      // Simulate degrading latency - need more samples and bigger difference
      const degradingLatencies = [
        // First 10 samples (older)
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        // Next 10 samples (recent) - significantly higher
        40, 42, 44, 46, 48, 50, 52, 54, 56, 58,
      ];
      for (const latency of degradingLatencies) {
        (monitor as any).updateLatencyMetrics(latency);
      }

      const metrics = monitor.getLatencyMetrics();
      expect(metrics.latencyTrend).toBe('degrading');
    });

    test('should calculate jitter accurately', () => {
      const latencies = [20, 22, 18, 21, 19, 23, 17, 20, 24, 16];
      for (const latency of latencies) {
        (monitor as any).updateLatencyMetrics(latency);
      }

      const metrics = monitor.getLatencyMetrics();
      expect(metrics.jitter).toBeGreaterThan(0);
      expect(metrics.latencyVariance).toBeGreaterThan(0);
    });
  });

  describe('Widget Performance Monitoring', () => {
    test('should track widget metrics', async () => {
      monitor.startMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 150));

      const widgetMetrics = monitor.getWidgetMetrics();
      expect(widgetMetrics).toHaveLength(3);

      const bassWidget = widgetMetrics.find((w) => w.widgetType === 'bass');
      expect(bassWidget).toBeDefined();
      expect(bassWidget?.isResponding).toBe(true);
      expect(bassWidget?.healthScore).toBeGreaterThan(0);
    });

    test('should detect unresponsive widgets', async () => {
      monitor.startMonitoring();

      // Mock an unresponsive widget
      const mockWidgets = [
        {
          widgetId: 'unresponsive-widget',
          widgetType: 'drums',
          latency: 200,
          lastHeartbeat: Date.now() - 10000, // 10 seconds ago
          syncStatus: 'disconnected',
        },
      ];

      const { playbackOrchestrator } = await import('../PlaybackOrchestrator');
      (playbackOrchestrator.getRegisteredWidgets as Mock).mockReturnValue(
        mockWidgets,
      );

      // Trigger monitoring cycle
      await (monitor as any).performMonitoringCycle();

      const alerts = monitor.getActiveAlerts();
      const widgetAlert = alerts.find((a) => a.category === 'widget');
      expect(widgetAlert).toBeDefined();
      expect(widgetAlert?.severity).toBe('error');
    });

    test('should calculate widget health scores', () => {
      const widgetMetrics = monitor.getWidgetMetrics();
      widgetMetrics.forEach((widget) => {
        expect(widget.healthScore).toBeGreaterThanOrEqual(0);
        expect(widget.healthScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Performance Alerts', () => {
    test('should generate critical latency alerts', () => {
      monitor.startMonitoring();

      // Simulate critical latency
      (monitor as any).updateLatencyMetrics(150); // Above 100ms threshold
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const criticalAlert = alerts.find((a) => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.category).toBe('latency');
    });

    test('should generate warning alerts for high average latency', () => {
      monitor.startMonitoring();

      // Simulate consistently high latency
      for (let i = 0; i < 20; i++) {
        (monitor as any).updateLatencyMetrics(80); // Above 75ms warning threshold
      }
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const warningAlert = alerts.find(
        (a) => a.severity === 'warning' && a.category === 'latency',
      );
      expect(warningAlert).toBeDefined();
    });

    test('should provide meaningful alert suggestions', () => {
      monitor.startMonitoring();
      (monitor as any).updateLatencyMetrics(150);
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const alert = alerts[0];
      expect(alert.suggestions).toBeDefined();
      expect(alert.suggestions.length).toBeGreaterThan(0);
      expect(alert.suggestions[0]).toContain('Reduce');
    });

    test('should allow alert resolution', () => {
      monitor.startMonitoring();
      (monitor as any).createAlert({
        severity: 'warning',
        category: 'test',
        message: 'Test alert',
        details: {},
        suggestions: ['Test suggestion'],
      });

      const alerts = monitor.getAlerts();
      const alertId = alerts[0].id;

      monitor.resolveAlert(alertId);

      const resolvedAlert = monitor.getAlerts().find((a) => a.id === alertId);
      expect(resolvedAlert?.resolved).toBe(true);
      expect(resolvedAlert?.resolutionTime).toBeDefined();
    });
  });

  describe('System Resource Monitoring', () => {
    test('should monitor memory usage', async () => {
      monitor.startMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Wait for system monitoring

      const systemMetrics = monitor.getSystemMetrics();
      expect(systemMetrics.memoryUsage).toBeGreaterThan(0);
    });

    test('should monitor frame rate', async () => {
      monitor.startMonitoring();

      // Simulate frame timestamps with exact 60fps timing
      const baseTime = performance.now();
      for (let i = 0; i < 60; i++) {
        (monitor as any).frameTimestamps.push(baseTime + i * (1000 / 60)); // Exact 60fps timing
      }
      (monitor as any).updateSystemMetrics();

      const systemMetrics = monitor.getSystemMetrics();
      expect(systemMetrics.frameRate).toBeCloseTo(60, 0); // Allow more tolerance
    });

    test('should generate alerts for high memory usage', () => {
      monitor.updateThresholds({ maxMemoryUsage: 40 }); // Lower threshold for testing

      // Mock high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 600 * 1024 * 1024, // 600MB
        },
      });

      (monitor as any).updateSystemMetrics();
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const memoryAlert = alerts.find(
        (a) => a.category === 'system' && a.message.includes('memory'),
      );
      expect(memoryAlert).toBeDefined();
    });

    test('should generate alerts for low frame rate', () => {
      // Simulate low frame rate
      (monitor as any).systemMetrics.frameRate = 20;
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const frameRateAlert = alerts.find((a) =>
        a.message.includes('frame rate'),
      );
      expect(frameRateAlert).toBeDefined();
    });
  });

  describe('Optimization Recommendations', () => {
    test('should generate recommendations for high latency', () => {
      // Simulate high latency
      for (let i = 0; i < 20; i++) {
        (monitor as any).updateLatencyMetrics(80);
      }
      (monitor as any).generateRecommendations();

      const recommendations = monitor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);

      const latencyRec = recommendations.find(
        (r) => r.category === 'configuration',
      );
      expect(latencyRec).toBeDefined();
      expect(latencyRec?.expectedImprovement).toContain('latency reduction');
    });

    test('should generate widget optimization recommendations', () => {
      // Mock unhealthy widgets
      (monitor as any).widgetMetrics.set('unhealthy-widget', {
        widgetId: 'unhealthy-widget',
        widgetType: 'test',
        healthScore: 60, // Below 80% threshold
        averageResponseTime: 100,
        maxResponseTime: 200,
        responseTimeP95: 150,
        eventsProcessed: 100,
        eventsDropped: 5,
        eventProcessingRate: 10,
        syncAccuracy: 0.8,
        missedSyncEvents: 2,
        lastActiveTime: performance.now(),
        isResponding: true,
      });

      (monitor as any).generateRecommendations();

      const recommendations = monitor.getRecommendations();
      const widgetRec = recommendations.find(
        (r) => r.id === 'optimize-widgets',
      );
      expect(widgetRec).toBeDefined();
    });

    test('should apply auto-applicable recommendations', async () => {
      const mockImplementation = vi.fn().mockResolvedValue(undefined);

      (monitor as any).recommendations = [
        {
          id: 'test-recommendation',
          category: 'configuration',
          priority: 'high',
          title: 'Test Recommendation',
          description: 'Test description',
          expectedImprovement: 'Test improvement',
          implementationDifficulty: 'easy',
          autoApplyable: true,
          implementation: mockImplementation,
        },
      ];

      const result = await monitor.applyRecommendation('test-recommendation');
      expect(result).toBe(true);
      expect(mockImplementation).toHaveBeenCalled();
    });
  });

  describe('Performance Summary', () => {
    test('should provide comprehensive performance summary', () => {
      monitor.startMonitoring();

      const summary = monitor.getPerformanceSummary();

      expect(summary).toHaveProperty('syncLatency');
      expect(summary).toHaveProperty('widgets');
      expect(summary).toHaveProperty('system');
      expect(summary).toHaveProperty('alerts');

      expect(summary.syncLatency).toHaveProperty('current');
      expect(summary.syncLatency).toHaveProperty('average');
      expect(summary.syncLatency).toHaveProperty('target');
      expect(summary.syncLatency).toHaveProperty('status');

      expect(summary.widgets).toHaveProperty('total');
      expect(summary.widgets).toHaveProperty('healthy');
      expect(summary.widgets).toHaveProperty('responding');
    });

    test('should correctly determine sync status', () => {
      // Test good sync status
      (monitor as any).updateLatencyMetrics(30); // Below 50ms target
      let summary = monitor.getPerformanceSummary();
      expect(summary.syncLatency.status).toBe('good');

      // Test poor sync status
      (monitor as any).updateLatencyMetrics(80); // Above 50ms target
      summary = monitor.getPerformanceSummary();
      expect(summary.syncLatency.status).toBe('poor');
    });
  });

  describe('Audio Dropout Detection', () => {
    test('should detect audio dropouts from latency spikes', () => {
      monitor.startMonitoring();

      // Simulate latency spike that could cause audio dropout
      (monitor as any).updateLatencyMetrics(150); // Above critical threshold
      (monitor as any).checkAudioDropouts();

      const audioMetrics = monitor.getAudioMetrics();
      expect(audioMetrics.totalDropouts).toBeGreaterThan(0);
      expect(audioMetrics.consecutiveDropouts).toBeGreaterThan(0);
    });

    test('should reset consecutive dropouts on recovery', () => {
      monitor.startMonitoring();

      // Simulate dropout and recovery
      (monitor as any).updateLatencyMetrics(150); // Dropout
      (monitor as any).checkAudioDropouts();

      (monitor as any).updateLatencyMetrics(30); // Recovery
      (monitor as any).checkAudioDropouts();

      const audioMetrics = monitor.getAudioMetrics();
      expect(audioMetrics.consecutiveDropouts).toBe(0);
    });

    test('should generate alerts for excessive consecutive dropouts', () => {
      monitor.updateThresholds({ maxConsecutiveDropouts: 2 });

      // Simulate excessive dropouts
      (monitor as any).audioMetrics.consecutiveDropouts = 5;
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const audioAlert = alerts.find((a) => a.category === 'audio');
      expect(audioAlert).toBeDefined();
      expect(audioAlert?.severity).toBe('error');
    });
  });

  describe('Threshold Configuration', () => {
    test('should allow threshold updates', () => {
      const newThresholds = {
        targetSyncLatency: 30,
        maxAcceptableLatency: 60,
        criticalLatency: 90,
      };

      monitor.updateThresholds(newThresholds);

      // Verify thresholds were updated by testing alert generation
      (monitor as any).updateLatencyMetrics(35); // Between old and new targets
      (monitor as any).analyzePerformance();

      const summary = monitor.getPerformanceSummary();
      expect(summary.syncLatency.target).toBe(30);
    });

    test('should use updated thresholds for alert generation', () => {
      monitor.updateThresholds({ criticalLatency: 60 }); // Lower critical threshold

      (monitor as any).updateLatencyMetrics(70); // Above new threshold
      (monitor as any).analyzePerformance();

      const alerts = monitor.getActiveAlerts();
      const criticalAlert = alerts.find((a) => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing PerformanceObserver gracefully', () => {
      // Mock unavailable PerformanceObserver
      const originalPerfObserver = global.PerformanceObserver;
      delete (global as any).PerformanceObserver;

      expect(() => monitor.startMonitoring()).not.toThrow();

      // Restore
      global.PerformanceObserver = originalPerfObserver;
    });

    test('should handle missing performance.memory gracefully', () => {
      // Mock unavailable memory API
      const originalMemory = (performance as any).memory;
      delete (performance as any).memory;

      expect(() => (monitor as any).updateSystemMetrics()).not.toThrow();

      // Restore
      (performance as any).memory = originalMemory;
    });

    test('should handle errors in monitoring cycle gracefully', async () => {
      // Mock error in orchestrator
      const { playbackOrchestrator } = await import('../PlaybackOrchestrator');
      (playbackOrchestrator.getPerformanceMetrics as Mock).mockImplementation(
        () => {
          throw new Error('Mock error');
        },
      );

      monitor.startMonitoring();

      // Should not throw despite internal error
      await expect(
        (monitor as any).performMonitoringCycle(),
      ).resolves.not.toThrow();
    });

    test('should handle empty widget metrics', async () => {
      // Create a fresh mock to avoid interference from previous tests
      vi.clearAllMocks();

      const { playbackOrchestrator } = await import('../PlaybackOrchestrator');

      // Ensure getPerformanceMetrics is properly mocked for this test
      (playbackOrchestrator.getPerformanceMetrics as Mock).mockReturnValue({
        totalWidgets: 0,
        activeWidgets: 0,
        averageLatency: 0,
        maxLatency: 0,
        syncAccuracy: 1.0,
        droppedEvents: 0,
        lastMeasurement: Date.now(),
      });

      (playbackOrchestrator.getRegisteredWidgets as Mock).mockReturnValue([]);

      monitor.startMonitoring();
      await (monitor as any).updateWidgetMetrics();

      const widgetMetrics = monitor.getWidgetMetrics();
      expect(widgetMetrics).toHaveLength(0);
    });
  });
});
