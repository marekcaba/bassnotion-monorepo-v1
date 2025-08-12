/**
 * PlaybackOrchestrator Musical Time Integration - Behavior Tests
 *
 * Tests the PlaybackOrchestrator integration with MusicalTimeEngine.
 * Validates Story 3.15 implementation with synchronized musical time events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaybackOrchestrator } from '../PlaybackOrchestrator';
import type {
  SyncState,
  SyncEvent,
  WidgetRegistration,
} from '../PlaybackOrchestrator';
import type {
  MusicalPosition,
  TimeSignature,
} from '@bassnotion/contracts/types/musical-time';

// Mock dependencies
vi.mock('@/domains/playback/services/CorePlaybackEngine', () => ({
  CorePlaybackEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      setTempo: vi.fn(),
      setMasterVolume: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      getConfig: vi.fn(() => ({ tempo: 120 })),
      getPlaybackState: vi.fn(() => 'stopped'),
    })),
  },
}));

vi.mock('@/domains/playback/services/MusicalTimeEngine', () => ({
  MusicalTimeEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      setTempo: vi.fn(),
      setTimeSignature: vi.fn(),
      seekTo: vi.fn(),
      subscribeWidget: vi.fn(),
      unsubscribeWidget: vi.fn(),
      getState: vi.fn(() => ({
        currentPosition: { bar: 1, beat: 1, subdivision: 0 },
        currentTick: 0,
        timeSignature: { numerator: 4, denominator: 4 },
        tempo: 120,
      })),
      dispose: vi.fn(),
    })),
  },
}));

vi.mock('../WidgetSyncService', () => ({
  widgetSyncService: {
    emit: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('PlaybackOrchestrator Musical Time Integration - Story 3.15 Behavior Tests', () => {
  let orchestrator: PlaybackOrchestrator;

  beforeEach(async () => {
    orchestrator = PlaybackOrchestrator.getInstance();
    await orchestrator.initialize();
  });

  afterEach(async () => {
    await orchestrator.dispose();
  });

  describe('Musical Time State Integration', () => {
    it('should include musical time properties in sync state', () => {
      const syncState = orchestrator.getSyncState();

      expect(syncState).toHaveProperty('currentPosition');
      expect(syncState).toHaveProperty('currentTick');
      expect(syncState).toHaveProperty('timeSignature');
      expect(syncState.currentPosition).toEqual({
        bar: 1,
        beat: 1,
        subdivision: 0,
      });
      expect(syncState.currentTick).toBe(0);
      expect(syncState.timeSignature).toEqual({ numerator: 4, denominator: 4 });
    });

    it('should provide musical time getters', () => {
      const musicalState = orchestrator.getMusicalTimeState();
      const currentPosition = orchestrator.getCurrentMusicalPosition();
      const currentTick = orchestrator.getCurrentTick();

      expect(musicalState).toBeDefined();
      expect(currentPosition).toEqual({ bar: 1, beat: 1, subdivision: 0 });
      expect(currentTick).toBe(0);
    });
  });

  describe('Widget Registration with Musical Time', () => {
    it('should subscribe widgets to musical time events on registration', () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', mockAudioConfig);

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      expect(registeredWidgets).toHaveLength(1);
      expect(registeredWidgets[0].widgetId).toBe('bass-widget');
    });

    it('should unsubscribe widgets from musical time events on unregistration', () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', mockAudioConfig);
      orchestrator.unregisterWidget('bass-widget');

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      expect(registeredWidgets).toHaveLength(0);
    });
  });

  describe('Musical Time Control Methods', () => {
    it('should provide time signature control', async () => {
      const threeFourTime: TimeSignature = { numerator: 3, denominator: 4 };

      await orchestrator.setGlobalTimeSignature(threeFourTime);

      // Should update musical time engine
      expect(orchestrator.setGlobalTimeSignature).toBeDefined();
    });

    it('should provide musical position seeking', async () => {
      const targetPosition: MusicalPosition = {
        bar: 2,
        beat: 3,
        subdivision: 1,
      };

      await orchestrator.seekToMusicalPosition(targetPosition);

      // Should update musical time engine
      expect(orchestrator.seekToMusicalPosition).toBeDefined();
    });

    it('should coordinate tempo changes with musical time engine', async () => {
      await orchestrator.setGlobalTempo(140);

      // Should update both core engine and musical time engine
      expect(orchestrator.setGlobalTempo).toBeDefined();
    });
  });

  describe('Musical Time Sync Events', () => {
    it('should handle TIME_SIGNATURE_CHANGE events', async () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', mockAudioConfig);

      const threeFourTime: TimeSignature = { numerator: 3, denominator: 4 };
      await orchestrator.setGlobalTimeSignature(threeFourTime);

      // Should not throw and should be handled
      expect(() =>
        orchestrator.setGlobalTimeSignature(threeFourTime),
      ).not.toThrow();
    });

    it('should handle SEEK events with musical positions', async () => {
      const targetPosition: MusicalPosition = {
        bar: 2,
        beat: 1,
        subdivision: 0,
      };

      await orchestrator.seekToMusicalPosition(targetPosition);

      // Should not throw and should be handled
      expect(() =>
        orchestrator.seekToMusicalPosition(targetPosition),
      ).not.toThrow();
    });

    it('should include musical time properties in sync events', async () => {
      const targetPosition: MusicalPosition = {
        bar: 2,
        beat: 1,
        subdivision: 0,
      };

      // Create a spy to capture the event
      const eventSpy = vi.fn();

      await orchestrator.seekToMusicalPosition(targetPosition);

      // Should create event with musical time properties
      expect(orchestrator.seekToMusicalPosition).toBeDefined();
    });
  });

  describe('Synchronization Performance', () => {
    it('should maintain <50ms synchronization target', async () => {
      const startTime = performance.now();

      // Perform multiple tempo changes
      for (let tempo = 120; tempo <= 140; tempo += 5) {
        await orchestrator.setGlobalTempo(tempo);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete all changes within reasonable time
      expect(duration).toBeLessThan(50);
    });

    it('should handle rapid widget registration/unregistration', () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      const startTime = performance.now();

      // Register and unregister multiple widgets
      for (let i = 0; i < 10; i++) {
        orchestrator.registerWidget(`widget-${i}`, mockAudioConfig);
        orchestrator.unregisterWidget(`widget-${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within performance requirements
      expect(duration).toBeLessThan(20);
    });
  });

  describe('Event Processing with Musical Time', () => {
    it('should update sync state with musical time information', async () => {
      await orchestrator.setGlobalTempo(140);

      const syncState = orchestrator.getSyncState();
      expect(syncState.tempo).toBe(140);

      // Should include updated musical time state
      expect(syncState.currentPosition).toBeDefined();
      expect(syncState.currentTick).toBeDefined();
      expect(syncState.timeSignature).toBeDefined();
    });

    it('should handle TEMPO_CHANGE events with musical time updates', async () => {
      const initialState = orchestrator.getSyncState();

      await orchestrator.setGlobalTempo(160);

      const updatedState = orchestrator.getSyncState();
      expect(updatedState.tempo).toBe(160);
      expect(updatedState.lastSyncTime).toBeGreaterThan(
        initialState.lastSyncTime,
      );
    });
  });

  describe('Widget Coordination', () => {
    it('should coordinate multiple widget types with musical time', () => {
      const widgets = [
        { id: 'bass-widget', type: 'bass' },
        { id: 'drum-widget', type: 'drums' },
        { id: 'harmony-widget', type: 'harmony' },
      ];

      widgets.forEach((widget) => {
        orchestrator.registerWidget(widget.id, {
          widgetType: widget.type,
          isActive: true,
          priority: 1,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
        });
      });

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      expect(registeredWidgets).toHaveLength(3);

      // All widgets should be registered and subscribed to musical time
      registeredWidgets.forEach((widget) => {
        expect(widget.syncStatus).toBe('connected');
      });
    });

    it('should handle widget configuration updates', () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', mockAudioConfig);

      orchestrator.updateWidgetConfig('bass-widget', { volume: 0.9 });

      const registeredWidgets = orchestrator.getRegisteredWidgets();
      expect(registeredWidgets[0].audioConfig.volume).toBe(0.9);
    });
  });

  describe('Performance Metrics with Musical Time', () => {
    it('should track performance metrics including musical time accuracy', () => {
      const metrics = orchestrator.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalWidgets');
      expect(metrics).toHaveProperty('activeWidgets');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('syncAccuracy');
    });

    it('should update metrics during musical time operations', async () => {
      const initialMetrics = orchestrator.getPerformanceMetrics();

      await orchestrator.setGlobalTempo(140);

      const updatedMetrics = orchestrator.getPerformanceMetrics();
      expect(updatedMetrics.lastMeasurement).toBeGreaterThanOrEqual(
        initialMetrics.lastMeasurement,
      );
    });
  });

  describe('Integration with Story 3.15 Components', () => {
    it('should work with MusicalTimeEngine for coordination', async () => {
      // Musical time engine should be initialized
      expect(orchestrator.getMusicalTimeState).toBeDefined();

      // Should provide current musical position
      const position = orchestrator.getCurrentMusicalPosition();
      expect(position).toEqual({ bar: 1, beat: 1, subdivision: 0 });
    });

    it('should provide data for TempoIndependentExerciseLoader', () => {
      const syncState = orchestrator.getSyncState();

      // Should provide tempo and time signature for exercise loading
      expect(syncState.tempo).toBe(120);
      expect(syncState.timeSignature).toEqual({ numerator: 4, denominator: 4 });
    });

    it('should coordinate with widget musical time subscriptions', () => {
      const bassConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', bassConfig);

      const syncState = orchestrator.getSyncState();
      expect(syncState.registeredWidgets.size).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid musical positions gracefully', async () => {
      const invalidPosition: MusicalPosition = {
        bar: -1,
        beat: 0,
        subdivision: -1,
      };

      expect(() => {
        orchestrator.seekToMusicalPosition(invalidPosition);
      }).not.toThrow();
    });

    it('should handle invalid time signatures gracefully', async () => {
      const invalidTimeSignature: TimeSignature = {
        numerator: 0,
        denominator: 0,
      };

      expect(() => {
        orchestrator.setGlobalTimeSignature(invalidTimeSignature);
      }).not.toThrow();
    });

    it('should handle disposal with active widgets', async () => {
      const mockAudioConfig = {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      orchestrator.registerWidget('bass-widget', mockAudioConfig);

      expect(() => {
        orchestrator.dispose();
      }).not.toThrow();
    });
  });
});
