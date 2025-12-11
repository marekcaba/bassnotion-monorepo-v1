/**
 * widget-migration-regression.test.ts
 *
 * Phase 2.2 Day 4: Regression Testing for Widget Migration
 *
 * Purpose: Verify that all 3 migrated widgets (DrummerWidget, HarmonyWidget,
 * MetronomeWidget) work correctly with PlaybackEngine API after migration
 * from RegionProcessor.
 *
 * Test Coverage:
 * - Individual widget functionality with PlaybackEngine
 * - Multi-widget scenarios (all 3 widgets playing together)
 * - Exercise switching with active widgets
 * - Tempo changes during playback
 * - Track registration/unregistration patterns
 * - State management across widgets
 *
 * Migration Verification:
 * - getPlaybackEngine() returns valid instance
 * - registerTrack() replaces registerTracks()
 * - unregisterTrack() + registerTrack() replaces updateTracks()
 * - getState() replaces isRunning property
 * - Buffer management is internal (no setHarmonyBuffers)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackEngine } from '../PlaybackEngine.js';
import type { EventBus } from '../EventBus.js';
import type { PluginManager } from '../PluginManager.js';

// Mock dependencies
const createMockEventBus = (): EventBus => ({
  emit: vi.fn(),
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
});

const createMockAudioContext = (): AudioContext => {
  const mockContext = {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      playbackRate: { value: 1 },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    destination: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  return mockContext as unknown as AudioContext;
};

const createMockAudioDestination = (): AudioNode => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  context: createMockAudioContext(),
  numberOfInputs: 1,
  numberOfOutputs: 1,
  channelCount: 2,
  channelCountMode: 'max',
  channelInterpretation: 'speakers',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const createMockPluginManager = (): PluginManager => ({
  getPlugin: vi.fn(() => ({
    unwrap: vi.fn(() => ({
      keyboard: {} as any,
    })),
  })),
  loadPlugin: vi.fn(),
  hasPlugin: vi.fn(),
  dispose: vi.fn(),
});

describe('Phase 2.2 Day 4: Widget Migration Regression Tests', () => {
  let eventBus: EventBus;
  let audioContext: AudioContext;
  let audioDestination: AudioNode;
  let playbackEngine: PlaybackEngine;
  let pluginManager: PluginManager;

  beforeEach(async () => {
    eventBus = createMockEventBus();
    audioContext = createMockAudioContext();
    audioDestination = createMockAudioDestination();
    pluginManager = createMockPluginManager();

    playbackEngine = new PlaybackEngine(eventBus);
    await playbackEngine.initialize(audioContext, audioDestination);
    playbackEngine.setPluginManager(pluginManager);

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (playbackEngine) {
      playbackEngine.dispose();
    }
  });

  // ============================================================================
  // Test Group 1: Individual Widget Functionality
  // ============================================================================

  describe('DrummerWidget Integration', () => {
    it('should register drummer track with PlaybackEngine', () => {
      // Simulate DrummerWidget registration (line 513)
      const drummerTrack = {
        id: 'drummer-widget-track',
        name: 'Drummer Track',
        regions: [
          {
            id: 'drummer-region-1',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'kick', velocity: 1.0 },
                { position: '0:2:0', type: 'snare', velocity: 0.8 },
              ],
            },
          },
        ],
        instrumentType: 'drums',
        exerciseId: 'test-exercise',
      };

      playbackEngine.registerTrack(drummerTrack);

      // Verify track is registered
      expect(playbackEngine.getTracks().has('drummer-widget-track')).toBe(true);
      const track = playbackEngine.getTracks().get('drummer-widget-track');
      expect(track?.name).toBe('Drummer Track');
      expect(track?.regions).toHaveLength(1);
    });

    it('should update drummer track using unregister + register pattern', () => {
      // Initial registration
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer Track',
        regions: [
          {
            id: 'region-1',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [] },
          },
        ],
        instrumentType: 'drums',
      });

      // Simulate DrummerWidget pattern update (line 836)
      playbackEngine.unregisterTrack('drummer-widget-track');
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer Track',
        regions: [
          {
            id: 'region-2',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [{ position: '0:0:0', type: 'hihat', velocity: 0.6 }],
            },
          },
        ],
        instrumentType: 'drums',
      });

      // Verify track was updated
      const track = playbackEngine.getTracks().get('drummer-widget-track');
      expect(track?.regions[0].id).toBe('region-2');
      expect(track?.regions[0].pattern?.events).toHaveLength(1);
    });
  });

  describe('HarmonyWidget Integration', () => {
    it('should register harmony track with PlaybackEngine', () => {
      // Simulate HarmonyWidget registration (line 1758)
      const harmonyTrack = {
        id: 'harmony-widget-track',
        name: 'Harmony Track',
        regions: [
          {
            id: 'harmony-region-1',
            trackId: 'harmony-widget-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'C3',
                  velocity: 0.8,
                  duration: '1m',
                },
                {
                  position: '1:0:0',
                  type: 'E3',
                  velocity: 0.8,
                  duration: '1m',
                },
              ],
            },
          },
        ],
        instrumentType: 'harmony',
        exerciseId: 'test-exercise',
      };

      playbackEngine.registerTrack(harmonyTrack);

      // Verify track is registered
      expect(playbackEngine.getTracks().has('harmony-widget-track')).toBe(true);
      const track = playbackEngine.getTracks().get('harmony-widget-track');
      expect(track?.name).toBe('Harmony Track');
      expect(track?.instrumentType).toBe('harmony');
    });

    it('should handle state checking with getState() method', () => {
      // Simulate HarmonyWidget state check (line 1748)
      const isRunning = playbackEngine.getState() === 'playing';
      expect(isRunning).toBe(false); // Should be 'ready' state

      // Start playback
      playbackEngine.start();
      const isRunningAfterStart = playbackEngine.getState() === 'playing';
      expect(isRunningAfterStart).toBe(true);

      // Stop playback
      playbackEngine.stop();
      const isRunningAfterStop = playbackEngine.getState() === 'playing';
      expect(isRunningAfterStop).toBe(false);
    });

    it('should handle track updates during playback', () => {
      // Register initial track
      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony Track',
        regions: [],
        instrumentType: 'harmony',
      });

      // Start playback
      playbackEngine.start();

      // Simulate HarmonyWidget update during playback (line 1754-1758)
      const isRunning = playbackEngine.getState() === 'playing';
      if (isRunning) {
        playbackEngine.unregisterTrack('harmony-widget-track');
        playbackEngine.registerTrack({
          id: 'harmony-widget-track',
          name: 'Harmony Track',
          regions: [
            {
              id: 'new-region',
              trackId: 'harmony-widget-track',
              startTime: 0,
              duration: 8,
              pattern: {
                events: [{ position: '0:0:0', type: 'A3', velocity: 0.9 }],
              },
            },
          ],
          instrumentType: 'harmony',
        });
      }

      // Verify track was updated even during playback
      const track = playbackEngine.getTracks().get('harmony-widget-track');
      expect(track?.regions).toHaveLength(1);
      expect(track?.regions[0].id).toBe('new-region');
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should access WAM keyboard through PlaybackEngine', () => {
      // Simulate HarmonyWidget accessing keyboard
      const keyboard = playbackEngine.getWamKeyboard();

      // Should return keyboard from PluginManager
      expect(keyboard).toBeDefined();
    });
  });

  describe('MetronomeWidget Integration', () => {
    it('should register metronome track with PlaybackEngine', () => {
      // Simulate MetronomeWidget registration (line 333)
      const metronomeTrack = {
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'metronome-region',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'accent', velocity: 1.0 },
                { position: '0:1:0', type: 'click', velocity: 0.7 },
                { position: '0:2:0', type: 'click', velocity: 0.7 },
                { position: '0:3:0', type: 'click', velocity: 0.7 },
              ],
            },
          },
        ],
        instrumentType: 'metronome',
      };

      playbackEngine.registerTrack(metronomeTrack);

      // Verify track is registered
      expect(playbackEngine.getTracks().has('metronome-track')).toBe(true);
      const track = playbackEngine.getTracks().get('metronome-track');
      expect(track?.name).toBe('Metronome');
      expect(track?.regions[0].pattern?.events).toHaveLength(4);
    });

    it('should update metronome on time signature change', () => {
      // Initial 4/4 registration
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'region-4-4',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'accent', velocity: 1.0 },
                { position: '0:1:0', type: 'click', velocity: 0.7 },
                { position: '0:2:0', type: 'click', velocity: 0.7 },
                { position: '0:3:0', type: 'click', velocity: 0.7 },
              ],
            },
          },
        ],
        instrumentType: 'metronome',
      });

      // Simulate MetronomeWidget time signature change to 3/4 (line 426)
      playbackEngine.unregisterTrack('metronome-track');
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'region-3-4',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 3,
            pattern: {
              events: [
                { position: '0:0:0', type: 'accent', velocity: 1.0 },
                { position: '0:1:0', type: 'click', velocity: 0.7 },
                { position: '0:2:0', type: 'click', velocity: 0.7 },
              ],
            },
          },
        ],
        instrumentType: 'metronome',
      });

      // Verify time signature updated
      const track = playbackEngine.getTracks().get('metronome-track');
      expect(track?.regions[0].duration).toBe(3);
      expect(track?.regions[0].pattern?.events).toHaveLength(3);
    });

    it('should update metronome on BPM change', () => {
      // Initial registration at 120 BPM
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'region-120bpm',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [] },
          },
        ],
        instrumentType: 'metronome',
      });

      // Simulate MetronomeWidget BPM change to 140 (line 483)
      playbackEngine.unregisterTrack('metronome-track');
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'region-140bpm',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [] },
          },
        ],
        instrumentType: 'metronome',
      });

      // Verify track was re-registered
      const track = playbackEngine.getTracks().get('metronome-track');
      expect(track?.regions[0].id).toBe('region-140bpm');
    });
  });

  // ============================================================================
  // Test Group 2: Multi-Widget Scenarios
  // ============================================================================

  describe('Multi-Widget Integration', () => {
    it('should support all 3 widgets playing together', () => {
      // Register all 3 widgets
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'metronome-region',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [{ position: '0:0:0', type: 'accent' }] },
          },
        ],
        instrumentType: 'metronome',
      });

      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer Track',
        regions: [
          {
            id: 'drummer-region',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [{ position: '0:0:0', type: 'kick' }] },
          },
        ],
        instrumentType: 'drums',
      });

      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony Track',
        regions: [
          {
            id: 'harmony-region',
            trackId: 'harmony-widget-track',
            startTime: 0,
            duration: 4,
            pattern: { events: [{ position: '0:0:0', type: 'C3' }] },
          },
        ],
        instrumentType: 'harmony',
      });

      // Verify all 3 tracks are registered
      expect(playbackEngine.getTracks().size).toBe(3);
      expect(playbackEngine.getTracks().has('metronome-track')).toBe(true);
      expect(playbackEngine.getTracks().has('drummer-widget-track')).toBe(true);
      expect(playbackEngine.getTracks().has('harmony-widget-track')).toBe(true);
    });

    it('should handle playback with all 3 widgets active', () => {
      // Register all widgets
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
      });
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer',
        regions: [],
        instrumentType: 'drums',
      });
      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony',
        regions: [],
        instrumentType: 'harmony',
      });

      // Start playback
      playbackEngine.start();

      // All tracks should be in playing state
      expect(playbackEngine.getState()).toBe('playing');
      expect(playbackEngine.getTracks().size).toBe(3);

      // Stop playback
      playbackEngine.stop();
      expect(playbackEngine.getState()).toBe('stopped');
    });

    it('should handle individual widget updates without affecting others', () => {
      // Register all widgets
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [
          {
            id: 'met-1',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 4,
          },
        ],
        instrumentType: 'metronome',
      });
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer',
        regions: [
          {
            id: 'drum-1',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 4,
          },
        ],
        instrumentType: 'drums',
      });
      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony',
        regions: [
          {
            id: 'harm-1',
            trackId: 'harmony-widget-track',
            startTime: 0,
            duration: 4,
          },
        ],
        instrumentType: 'harmony',
      });

      // Update only drummer track
      playbackEngine.unregisterTrack('drummer-widget-track');
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer Updated',
        regions: [
          {
            id: 'drum-2',
            trackId: 'drummer-widget-track',
            startTime: 0,
            duration: 8,
          },
        ],
        instrumentType: 'drums',
      });

      // Verify only drummer was updated
      expect(playbackEngine.getTracks().size).toBe(3);
      expect(
        playbackEngine.getTracks().get('drummer-widget-track')?.regions[0].id,
      ).toBe('drum-2');
      expect(
        playbackEngine.getTracks().get('metronome-track')?.regions[0].id,
      ).toBe('met-1');
      expect(
        playbackEngine.getTracks().get('harmony-widget-track')?.regions[0].id,
      ).toBe('harm-1');
    });
  });

  // ============================================================================
  // Test Group 3: Exercise Switching with Active Widgets
  // ============================================================================

  describe('Exercise Switching', () => {
    it('should handle exercise switch with all widgets active', () => {
      // Register widgets for Exercise 1
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
        exerciseId: 'exercise-1',
      });
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer',
        regions: [],
        instrumentType: 'drums',
        exerciseId: 'exercise-1',
      });

      expect(playbackEngine.getTracks().size).toBe(2);

      // Simulate exercise switch - unregister old, register new
      playbackEngine.unregisterTrack('metronome-track');
      playbackEngine.unregisterTrack('drummer-widget-track');

      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
        exerciseId: 'exercise-2',
      });
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer',
        regions: [],
        instrumentType: 'drums',
        exerciseId: 'exercise-2',
      });

      // Verify tracks were switched
      expect(playbackEngine.getTracks().size).toBe(2);
      expect(
        playbackEngine.getTracks().get('metronome-track')?.exerciseId,
      ).toBe('exercise-2');
      expect(
        playbackEngine.getTracks().get('drummer-widget-track')?.exerciseId,
      ).toBe('exercise-2');
    });

    it('should handle multiple rapid exercise switches', () => {
      const exerciseIds = ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ex-5'];

      exerciseIds.forEach((exerciseId) => {
        // Unregister previous
        playbackEngine.unregisterTrack('metronome-track');
        playbackEngine.unregisterTrack('harmony-widget-track');

        // Register new
        playbackEngine.registerTrack({
          id: 'metronome-track',
          name: 'Metronome',
          regions: [],
          instrumentType: 'metronome',
          exerciseId,
        });
        playbackEngine.registerTrack({
          id: 'harmony-widget-track',
          name: 'Harmony',
          regions: [],
          instrumentType: 'harmony',
          exerciseId,
        });
      });

      // Verify final state
      expect(playbackEngine.getTracks().size).toBe(2);
      expect(
        playbackEngine.getTracks().get('metronome-track')?.exerciseId,
      ).toBe('ex-5');
      expect(
        playbackEngine.getTracks().get('harmony-widget-track')?.exerciseId,
      ).toBe('ex-5');
    });
  });

  // ============================================================================
  // Test Group 4: Tempo Changes During Playback
  // ============================================================================

  describe('Tempo Changes with Active Widgets', () => {
    it('should handle tempo changes with all widgets playing', () => {
      // Register all widgets
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
      });
      playbackEngine.registerTrack({
        id: 'drummer-widget-track',
        name: 'Drummer',
        regions: [],
        instrumentType: 'drums',
      });
      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony',
        regions: [],
        instrumentType: 'harmony',
      });

      // Start playback
      playbackEngine.start();

      // Change tempo multiple times
      playbackEngine.updateTempo(120);
      playbackEngine.updateTempo(140);
      playbackEngine.updateTempo(100);

      // Verify engine still playing
      expect(playbackEngine.getState()).toBe('playing');
      expect(playbackEngine.getTracks().size).toBe(3);
    });
  });

  // ============================================================================
  // Test Group 5: Track Registration Patterns
  // ============================================================================

  describe('Track Registration Patterns', () => {
    it('should handle registerTrack() replacing registerTracks()', () => {
      // Old pattern: registerTracks([track1, track2])
      // New pattern: registerTrack(track1), registerTrack(track2)

      const track1 = {
        id: 'track-1',
        name: 'Track 1',
        regions: [],
        instrumentType: 'metronome' as const,
      };

      const track2 = {
        id: 'track-2',
        name: 'Track 2',
        regions: [],
        instrumentType: 'drums' as const,
      };

      // New pattern (individual registration)
      playbackEngine.registerTrack(track1);
      playbackEngine.registerTrack(track2);

      // Verify both registered
      expect(playbackEngine.getTracks().size).toBe(2);
      expect(playbackEngine.getTracks().has('track-1')).toBe(true);
      expect(playbackEngine.getTracks().has('track-2')).toBe(true);
    });

    it('should handle unregister + register replacing updateTracks()', () => {
      // Old pattern: updateTracks([track])
      // New pattern: unregisterTrack(id), registerTrack(track)

      // Initial registration
      playbackEngine.registerTrack({
        id: 'widget-track',
        name: 'Widget Track v1',
        regions: [
          {
            id: 'region-1',
            trackId: 'widget-track',
            startTime: 0,
            duration: 4,
          },
        ],
        instrumentType: 'harmony',
      });

      // Update using new pattern
      playbackEngine.unregisterTrack('widget-track');
      playbackEngine.registerTrack({
        id: 'widget-track',
        name: 'Widget Track v2',
        regions: [
          {
            id: 'region-2',
            trackId: 'widget-track',
            startTime: 0,
            duration: 8,
          },
        ],
        instrumentType: 'harmony',
      });

      // Verify update worked
      const track = playbackEngine.getTracks().get('widget-track');
      expect(track?.name).toBe('Widget Track v2');
      expect(track?.regions[0].id).toBe('region-2');
      expect(track?.regions[0].duration).toBe(8);
    });
  });

  // ============================================================================
  // Test Group 6: State Management Across Widgets
  // ============================================================================

  describe('State Management', () => {
    it('should provide consistent state across all widget queries', () => {
      // Register multiple widgets
      playbackEngine.registerTrack({
        id: 'metronome-track',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
      });
      playbackEngine.registerTrack({
        id: 'harmony-widget-track',
        name: 'Harmony',
        regions: [],
        instrumentType: 'harmony',
      });

      // All widgets check state using getState()
      const metronomeIsPlaying = playbackEngine.getState() === 'playing';
      const harmonyIsPlaying = playbackEngine.getState() === 'playing';
      expect(metronomeIsPlaying).toBe(false);
      expect(harmonyIsPlaying).toBe(false);

      // Start playback
      playbackEngine.start();

      // All widgets should see playing state
      const metronomeAfterStart = playbackEngine.getState() === 'playing';
      const harmonyAfterStart = playbackEngine.getState() === 'playing';
      expect(metronomeAfterStart).toBe(true);
      expect(harmonyAfterStart).toBe(true);
    });

    it('should handle state transitions with multiple widgets', () => {
      // Register widgets
      playbackEngine.registerTrack({
        id: 'track-1',
        name: 'Track 1',
        regions: [],
        instrumentType: 'metronome',
      });
      playbackEngine.registerTrack({
        id: 'track-2',
        name: 'Track 2',
        regions: [],
        instrumentType: 'drums',
      });

      // Verify initial state
      expect(playbackEngine.getState()).toBe('ready');

      // Transition: ready -> playing
      playbackEngine.start();
      expect(playbackEngine.getState()).toBe('playing');

      // Transition: playing -> paused
      playbackEngine.pause();
      expect(playbackEngine.getState()).toBe('paused');

      // Transition: paused -> playing (use resume, not start)
      playbackEngine.resume();
      expect(playbackEngine.getState()).toBe('playing');

      // Transition: playing -> stopped
      playbackEngine.stop();
      expect(playbackEngine.getState()).toBe('stopped');
    });
  });
});
