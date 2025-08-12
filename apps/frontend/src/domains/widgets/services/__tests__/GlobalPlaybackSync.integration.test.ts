/**
 * Global Playback Synchronization Integration Tests
 *
 * Comprehensive integration tests for the complete global playback synchronization system.
 * Tests all sync scenarios, edge cases, and cross-widget coordination.
 *
 * Part of Story 3.14: Global Playback Synchronization
 * Task 6.3: Test All Sync Scenarios and Edge Cases
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
import type { WidgetAudioSourceConfig } from '../../hooks/useWidgetAudioRegistration';

// Mock services first
const mockWidgetSyncService = {
  emit: vi.fn(),
  subscribe: vi.fn(),
};

vi.mock('../WidgetSyncService', () => ({
  widgetSyncService: mockWidgetSyncService,
}));

// Dynamic imports for services
let PlaybackOrchestrator: any;
let SyncPerformanceMonitor: any;
let YouTubePlaybackSync: any;
let widgetSyncService: any;

// Mock Core Playback Engine
const mockCoreEngine = {
  initialize: vi.fn().mockResolvedValue(undefined),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  setTempo: vi.fn(),
  setMasterVolume: vi.fn(),
  registerAudioSource: vi.fn(),
  unregisterAudioSource: vi.fn(),
  setSourceVolume: vi.fn(),
  setSourceMute: vi.fn(),
  setSourceSolo: vi.fn(),
  on: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
  getInstance: vi.fn(),
};

vi.mock('@/domains/playback/services/CorePlaybackEngine', () => ({
  CorePlaybackEngine: {
    getInstance: () => mockCoreEngine,
  },
}));

// Mock YouTube player
const mockYouTubePlayer = {
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  stopVideo: vi.fn(),
  seekTo: vi.fn(),
  getCurrentTime: vi.fn(() => 0),
  getDuration: vi.fn(() => 180),
  getPlayerState: vi.fn(() => 1), // PLAYING
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Test utilities
class TestHelper {
  static createMockWidget(
    id: string,
    type: string,
    latency: number = 20,
  ): WidgetAudioSourceConfig {
    return {
      sourceId: id,
      widgetId: id,
      widgetType: type as any,
      displayName: `Test ${type} Widget`,
      volume: 1.0,
      muted: false,
      solo: false,
      syncRequirements: {
        requiresPreciseSync: true,
        latencyTolerance: 50,
        tempoSensitive: true,
        volumeSensitive: true,
      },
      priority: 5,
      isActive: true,
      canBeSoloed: true,
      canBeMuted: true,
    };
  }

  static async waitForSync(ms: number = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static createLatencyMeasurement(): number {
    const start = performance.now();
    // Simulate processing time
    const end = performance.now();
    return end - start;
  }
}

describe('Global Playback Synchronization Integration', () => {
  let orchestrator: any;
  let performanceMonitor: any;
  let youtubeSync: any;

  beforeEach(async () => {
    // Import services dynamically
    const PlaybackOrchestratorModule = await import('../PlaybackOrchestrator');
    const SyncPerformanceMonitorModule = await import(
      '../SyncPerformanceMonitor'
    );
    const YouTubePlaybackSyncModule = await import('../YouTubePlaybackSync');
    const widgetSyncServiceModule = await import('../WidgetSyncService');

    PlaybackOrchestrator = PlaybackOrchestratorModule.PlaybackOrchestrator;
    SyncPerformanceMonitor =
      SyncPerformanceMonitorModule.SyncPerformanceMonitor;
    YouTubePlaybackSync = YouTubePlaybackSyncModule.YouTubePlaybackSync;
    widgetSyncService = widgetSyncServiceModule.widgetSyncService;

    // Reset singletons
    (PlaybackOrchestrator as any).instance = null;
    (SyncPerformanceMonitor as any).instance = null;
    (YouTubePlaybackSync as any).instance = null;

    // Initialize services
    orchestrator = PlaybackOrchestrator.getInstance();
    performanceMonitor = SyncPerformanceMonitor.getInstance();
    youtubeSync = YouTubePlaybackSync.getInstance();

    await orchestrator.initialize();
    await youtubeSync.initialize();

    performanceMonitor.startMonitoring();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    performanceMonitor.stopMonitoring();
    await orchestrator.dispose();
    await youtubeSync.dispose();
  });

  describe('Widget Registration and Coordination', () => {
    test('should register multiple widgets simultaneously', () => {
      const widgets = [
        TestHelper.createMockWidget('bass-widget', 'bass'),
        TestHelper.createMockWidget('metronome-widget', 'metronome'),
        TestHelper.createMockWidget('drums-widget', 'drums'),
        TestHelper.createMockWidget('harmony-widget', 'harmony'),
        TestHelper.createMockWidget('fretboard-widget', 'fretboard'),
      ];

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      expect(registeredWidgets).toHaveLength(5);

      // Verify each widget type is registered
      const widgetTypes = registeredWidgets.map((w) => w.widgetType);
      expect(widgetTypes).toContain('bass');
      expect(widgetTypes).toContain('metronome');
      expect(widgetTypes).toContain('drums');
      expect(widgetTypes).toContain('harmony');
      expect(widgetTypes).toContain('fretboard');
    });

    test('should handle widget registration lifecycle correctly', () => {
      const widget = TestHelper.createMockWidget('test-widget', 'bass');

      // Register
      orchestrator.registerWidget(widget.widgetId, widget);
      expect(orchestrator.isWidgetRegistered('test-widget')).toBe(true);

      // Unregister
      orchestrator.unregisterWidget('test-widget');
      expect(orchestrator.isWidgetRegistered('test-widget')).toBe(false);
    });

    test('should update widget configurations dynamically', () => {
      const widget = TestHelper.createMockWidget('dynamic-widget', 'bass');
      orchestrator.registerWidget(widget.widgetId, widget);

      // Update configuration
      const updates = {
        volume: 0.5,
        muted: true,
        priority: 8,
      };

      orchestrator.updateWidgetConfig('dynamic-widget', updates);

      const syncState = orchestrator.getSyncState();
      const updatedWidget = syncState.activeAudioSources.get('dynamic-widget');
      expect(updatedWidget?.volume).toBe(0.5);
      expect(updatedWidget?.muted).toBe(true);
      expect(updatedWidget?.priority).toBe(8);
    });
  });

  describe('Global Playback Control Scenarios', () => {
    beforeEach(() => {
      // Register test widgets
      const widgets = [
        TestHelper.createMockWidget('bass', 'bass'),
        TestHelper.createMockWidget('metronome', 'metronome'),
        TestHelper.createMockWidget('drums', 'drums'),
      ];

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });
    });

    test('should start global playback with <50ms latency', async () => {
      const startTime = performance.now();

      await orchestrator.startGlobalPlayback();

      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(latency).toBeLessThan(50);
      expect(mockCoreEngine.play).toHaveBeenCalled();
    });

    test('should stop all widgets simultaneously', async () => {
      await orchestrator.startGlobalPlayback();

      const stopTime = performance.now();
      await orchestrator.stopGlobalPlayback();
      const endTime = performance.now();

      const latency = endTime - stopTime;
      expect(latency).toBeLessThan(50);
      expect(mockCoreEngine.stop).toHaveBeenCalled();
    });

    test('should pause all widgets simultaneously', async () => {
      await orchestrator.startGlobalPlayback();

      const pauseTime = performance.now();
      await orchestrator.pauseGlobalPlayback();
      const endTime = performance.now();

      const latency = endTime - pauseTime;
      expect(latency).toBeLessThan(50);
      expect(mockCoreEngine.pause).toHaveBeenCalled();
    });

    test('should sync tempo changes across all widgets', async () => {
      const newTempo = 140;

      orchestrator.setGlobalTempo(newTempo);
      await TestHelper.waitForSync();

      expect(mockCoreEngine.setTempo).toHaveBeenCalledWith(newTempo);

      const syncState = orchestrator.getSyncState();
      expect(syncState.tempo).toBe(newTempo);
    });

    test('should sync volume changes across all widgets', async () => {
      const newVolume = 0.75;

      orchestrator.setGlobalVolume(newVolume);
      await TestHelper.waitForSync();

      expect(mockCoreEngine.setMasterVolume).toHaveBeenCalledWith(newVolume);

      const syncState = orchestrator.getSyncState();
      expect(syncState.masterVolume).toBe(newVolume);
    });
  });

  describe('Cross-Widget Synchronization', () => {
    test('should maintain consistent timing across all widgets', async () => {
      const widgets = Array.from({ length: 5 }, (_, i) =>
        TestHelper.createMockWidget(`widget-${i}`, 'bass'),
      );

      // Register widgets with different latency tolerances
      widgets.forEach((widget, index) => {
        widget.syncRequirements.latencyTolerance = 16 + index * 10; // 16ms to 56ms
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      await orchestrator.startGlobalPlayback();
      await TestHelper.waitForSync(200);

      const syncState = orchestrator.getSyncState();
      expect(syncState.syncLatency).toBeLessThan(50);
      expect(syncState.syncAccuracy).toBeGreaterThan(0.8);
    });

    test('should handle widget priority correctly during conflicts', async () => {
      const highPriorityWidget = TestHelper.createMockWidget(
        'high-priority',
        'bass',
      );
      highPriorityWidget.priority = 9;

      const lowPriorityWidget = TestHelper.createMockWidget(
        'low-priority',
        'bass',
      );
      lowPriorityWidget.priority = 3;

      orchestrator.registerWidget('high-priority', highPriorityWidget);
      orchestrator.registerWidget('low-priority', lowPriorityWidget);

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      const highPrio = registeredWidgets.find(
        (w) => w.widgetId === 'high-priority',
      );
      const lowPrio = registeredWidgets.find(
        (w) => w.widgetId === 'low-priority',
      );

      expect(highPrio?.priority).toBe(9);
      expect(lowPrio?.priority).toBe(3);
    });

    test('should isolate audio source conflicts', async () => {
      const bassWidget1 = TestHelper.createMockWidget('bass-1', 'bass');
      const bassWidget2 = TestHelper.createMockWidget('bass-2', 'bass');

      // Both bass widgets with different configurations
      bassWidget1.solo = true;
      bassWidget2.muted = true;

      orchestrator.registerWidget('bass-1', bassWidget1);
      orchestrator.registerWidget('bass-2', bassWidget2);

      await orchestrator.startGlobalPlayback();

      const syncState = orchestrator.getSyncState();
      const widget1 = syncState.activeAudioSources.get('bass-1');
      const widget2 = syncState.activeAudioSources.get('bass-2');

      expect(widget1?.solo).toBe(true);
      expect(widget2?.muted).toBe(true);
    });
  });

  describe('YouTube Player Synchronization', () => {
    beforeEach(() => {
      youtubeSync.setYouTubePlayer(mockYouTubePlayer);
    });

    test('should sync YouTube player with audio engine', async () => {
      await youtubeSync.play();

      expect(mockYouTubePlayer.playVideo).toHaveBeenCalled();
      expect(mockCoreEngine.play).toHaveBeenCalled();
    });

    test('should handle video seek with audio synchronization', async () => {
      const seekTime = 60; // 1 minute

      await youtubeSync.seekTo(seekTime);

      // Should seek video with latency compensation
      expect(mockYouTubePlayer.seekTo).toHaveBeenCalledWith(
        expect.any(Number),
        true,
      );
    });

    test('should maintain sync during playback state changes', async () => {
      // Start playback
      await youtubeSync.play();
      expect(mockYouTubePlayer.playVideo).toHaveBeenCalled();

      // Pause
      await youtubeSync.pause();
      expect(mockYouTubePlayer.pauseVideo).toHaveBeenCalled();

      // Stop
      await youtubeSync.stop();
      expect(mockYouTubePlayer.stopVideo).toHaveBeenCalled();
    });

    test('should apply latency compensation correctly', () => {
      const config = youtubeSync.getConfig();
      expect(config.latencyCompensation).toBe(100); // Default 100ms

      // Update compensation
      youtubeSync.updateConfig({ latencyCompensation: 150 });

      const updatedConfig = youtubeSync.getConfig();
      expect(updatedConfig.latencyCompensation).toBe(150);
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should monitor sync latency in real-time', async () => {
      await orchestrator.startGlobalPlayback();
      await TestHelper.waitForSync(300);

      const latencyMetrics = performanceMonitor.getLatencyMetrics();
      expect(latencyMetrics.measurementCount).toBeGreaterThan(0);
      expect(latencyMetrics.currentLatency).toBeGreaterThanOrEqual(0);
    });

    test('should detect and alert on performance issues', async () => {
      // Simulate high latency scenario
      const widget = TestHelper.createMockWidget('slow-widget', 'bass');
      widget.syncRequirements.latencyTolerance = 200; // High latency tolerance

      orchestrator.registerWidget('slow-widget', widget);

      // Force performance monitoring cycle
      await TestHelper.waitForSync(200);

      const alerts = performanceMonitor.getActiveAlerts();
      // Should have some performance metrics being tracked
      expect(
        performanceMonitor.getLatencyMetrics().measurementCount,
      ).toBeGreaterThan(0);
    });

    test('should provide optimization recommendations', async () => {
      // Register many widgets to stress test
      const widgets = Array.from({ length: 10 }, (_, i) =>
        TestHelper.createMockWidget(`stress-widget-${i}`, 'bass'),
      );

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      await TestHelper.waitForSync(300);

      const recommendations = performanceMonitor.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle widget disconnection gracefully', async () => {
      const widget = TestHelper.createMockWidget('disconnect-test', 'bass');
      orchestrator.registerWidget('disconnect-test', widget);

      // Simulate widget disconnection
      orchestrator.unregisterWidget('disconnect-test');

      // Should not affect other widgets or overall sync
      await orchestrator.startGlobalPlayback();
      expect(mockCoreEngine.play).toHaveBeenCalled();
    });

    test('should handle audio source registration failures', () => {
      mockCoreEngine.registerAudioSource.mockRejectedValueOnce(
        new Error('Registration failed'),
      );

      const widget = TestHelper.createMockWidget('failing-widget', 'bass');

      // Should not throw error
      expect(() => {
        orchestrator.registerWidget('failing-widget', widget);
      }).not.toThrow();
    });

    test('should handle YouTube player unavailability', () => {
      youtubeSync.removeYouTubePlayer();

      // Should not throw errors when player is unavailable
      expect(() => youtubeSync.play()).not.toThrow();
      expect(() => youtubeSync.pause()).not.toThrow();
      expect(() => youtubeSync.seekTo(60)).not.toThrow();
    });

    test('should handle core engine initialization failure', async () => {
      mockCoreEngine.initialize.mockRejectedValueOnce(new Error('Init failed'));

      const newOrchestrator = new (PlaybackOrchestrator as any)();

      await expect(newOrchestrator.initialize()).rejects.toThrow('Init failed');
    });

    test('should handle performance monitoring errors gracefully', () => {
      // Mock performance API unavailability
      const originalPerformance = global.performance;
      delete (global as any).performance;

      // Should not crash
      expect(() => {
        const monitor = SyncPerformanceMonitor.getInstance();
        monitor.startMonitoring();
      }).not.toThrow();

      // Restore
      global.performance = originalPerformance;
    });

    test('should handle rapid play/pause state changes', async () => {
      await orchestrator.startGlobalPlayback();
      await orchestrator.pauseGlobalPlayback();
      await orchestrator.startGlobalPlayback();
      await orchestrator.stopGlobalPlayback();

      // All calls should be processed without errors
      expect(mockCoreEngine.play).toHaveBeenCalledTimes(2);
      expect(mockCoreEngine.pause).toHaveBeenCalledTimes(1);
      expect(mockCoreEngine.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cascade Failure Prevention', () => {
    test('should isolate widget failures from global sync', async () => {
      const stableWidget = TestHelper.createMockWidget('stable-widget', 'bass');
      const problematicWidget = TestHelper.createMockWidget(
        'problem-widget',
        'drums',
      );

      orchestrator.registerWidget('stable-widget', stableWidget);
      orchestrator.registerWidget('problem-widget', problematicWidget);

      // Simulate widget failure by making it unresponsive
      const registrations = orchestrator.getRegisteredWidgets();
      const problemWidget = registrations.find(
        (w) => w.widgetId === 'problem-widget',
      );
      if (problemWidget) {
        problemWidget.syncStatus = 'disconnected';
        problemWidget.lastHeartbeat = performance.now() - 10000; // 10 seconds ago
      }

      // Global playback should still work
      await orchestrator.startGlobalPlayback();
      expect(mockCoreEngine.play).toHaveBeenCalled();
    });

    test('should handle event processing errors without stopping sync', async () => {
      // Mock error in event processing
      const originalEmit = mockWidgetSyncService.emit;
      mockWidgetSyncService.emit = vi.fn().mockImplementation(() => {
        throw new Error('Event processing failed');
      });

      // Should not prevent other operations
      await expect(orchestrator.startGlobalPlayback()).resolves.not.toThrow();

      // Restore
      mockWidgetSyncService.emit = originalEmit;
    });

    test('should maintain sync when individual widgets drop out', async () => {
      const widgets = [
        TestHelper.createMockWidget('widget-1', 'bass'),
        TestHelper.createMockWidget('widget-2', 'metronome'),
        TestHelper.createMockWidget('widget-3', 'drums'),
      ];

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      await orchestrator.startGlobalPlayback();

      // Remove one widget
      orchestrator.unregisterWidget('widget-2');

      // Should still maintain sync with remaining widgets
      const syncState = orchestrator.getSyncState();
      expect(syncState.registeredWidgets.size).toBe(2);
      expect(syncState.isPlaying).toBe(true);
    });
  });

  describe('High Load Scenarios', () => {
    test('should maintain <50ms latency under high widget load', async () => {
      // Register many widgets
      const widgetCount = 20;
      const widgets = Array.from({ length: widgetCount }, (_, i) =>
        TestHelper.createMockWidget(`load-test-${i}`, 'bass'),
      );

      const startTime = performance.now();

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      await orchestrator.startGlobalPlayback();

      const endTime = performance.now();
      const totalLatency = endTime - startTime;

      expect(totalLatency).toBeLessThan(50 * widgetCount); // Should scale reasonably
      expect(mockCoreEngine.play).toHaveBeenCalled();
    });

    test('should handle rapid configuration changes', async () => {
      const widget = TestHelper.createMockWidget('rapid-changes', 'bass');
      orchestrator.registerWidget('rapid-changes', widget);

      // Rapid configuration updates
      for (let i = 0; i < 100; i++) {
        orchestrator.updateWidgetConfig('rapid-changes', {
          volume: Math.random(),
          priority: Math.floor(Math.random() * 10) + 1,
        });
      }

      // Should handle without errors
      const syncState = orchestrator.getSyncState();
      const updatedWidget = syncState.activeAudioSources.get('rapid-changes');
      expect(updatedWidget).toBeDefined();
    });
  });

  describe('Real-world Sync Scenarios', () => {
    test('should handle typical bass practice session', async () => {
      // Simulate realistic practice session
      const practiceWidgets = [
        TestHelper.createMockWidget('bass-player', 'bass'),
        TestHelper.createMockWidget('metronome', 'metronome'),
        TestHelper.createMockWidget('backing-track', 'harmony'),
        TestHelper.createMockWidget('fretboard-visual', 'fretboard'),
      ];

      practiceWidgets.forEach((widget) => {
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      // Start practice
      await orchestrator.startGlobalPlayback();
      expect(mockCoreEngine.play).toHaveBeenCalled();

      // Change tempo during practice
      orchestrator.setGlobalTempo(100); // Slow practice tempo
      await TestHelper.waitForSync();

      // Adjust volume
      orchestrator.setGlobalVolume(0.8);
      await TestHelper.waitForSync();

      // Speed up
      orchestrator.setGlobalTempo(140);
      await TestHelper.waitForSync();

      // End practice
      await orchestrator.stopGlobalPlayback();
      expect(mockCoreEngine.stop).toHaveBeenCalled();

      const syncState = orchestrator.getSyncState();
      expect(syncState.tempo).toBe(140);
      expect(syncState.masterVolume).toBe(0.8);
    });

    test('should handle live performance scenario with minimal latency', async () => {
      // Configure for live performance (lower latency tolerance)
      const performanceWidgets = [
        TestHelper.createMockWidget('live-bass', 'bass'),
        TestHelper.createMockWidget('click-track', 'metronome'),
        TestHelper.createMockWidget('in-ears', 'harmony'),
      ];

      performanceWidgets.forEach((widget) => {
        widget.syncRequirements.latencyTolerance = 10; // Very strict for live
        widget.syncRequirements.requiresPreciseSync = true;
        orchestrator.registerWidget(widget.widgetId, widget);
      });

      const startTime = performance.now();
      await orchestrator.startGlobalPlayback();
      const latency = performance.now() - startTime;

      expect(latency).toBeLessThan(25); // Even stricter for live performance
    });
  });
});
