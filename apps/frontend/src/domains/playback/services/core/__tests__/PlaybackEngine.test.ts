/**
 * PlaybackEngine.test.ts - Comprehensive test suite for PlaybackEngine
 *
 * Test Coverage:
 * - Initialization and configuration
 * - State machine transitions
 * - Track management
 * - Playback control (start/stop/pause/resume)
 * - Tempo management with debouncing (Bug #6)
 * - PluginManager integration
 * - Lifecycle and cleanup (Bug #7)
 * - Integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PlaybackEngine,
  type Track,
  type PlaybackEngineConfig,
} from '../PlaybackEngine.js';
import type { EventBus } from '../EventBus.js';
import type { PluginManager } from '../PluginManager.js';
import type { WamKeyboard } from '../../../modules/instruments/adapters/wam/WamKeyboard.js';
import type { WamKeyboardPlugin } from '../../../modules/instruments/adapters/wam/WamKeyboardPlugin.js';

// Mock dependencies
const createMockEventBus = (): EventBus => ({
  emit: vi.fn(),
  on: vi.fn(() => vi.fn()), // Returns unsubscribe function
  off: vi.fn(),
});

const createMockAudioContext = (): AudioContext => {
  const mockContext = {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBufferSource: vi.fn(),
    createGain: vi.fn(),
    destination: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
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

const createMockWamKeyboard = (): WamKeyboard =>
  ({
    scheduleEvents: vi.fn(),
    clearSchedule: vi.fn(),
    // Add other required WamKeyboard methods as needed
  }) as unknown as WamKeyboard;

const createMockWamKeyboardPlugin = (
  wamKeyboard: WamKeyboard | null = null,
): WamKeyboardPlugin =>
  ({
    getWamKeyboard: vi.fn(() => wamKeyboard),
    initialize: vi.fn(),
    dispose: vi.fn(),
    // Add other required WamKeyboardPlugin methods as needed
  }) as unknown as WamKeyboardPlugin;

const createMockPluginManager = (
  wamKeyboardPlugin: WamKeyboardPlugin | null = null,
): PluginManager =>
  ({
    getPlugin: vi.fn((pluginId: string) => {
      if (pluginId === 'wam-keyboard') {
        return wamKeyboardPlugin;
      }
      return null;
    }),
    // Add other required PluginManager methods as needed
  }) as unknown as PluginManager;

describe('PlaybackEngine', () => {
  let eventBus: EventBus;
  let audioContext: AudioContext;
  let audioDestination: AudioNode;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = createMockEventBus();
    audioContext = createMockAudioContext();
    audioDestination = createMockAudioDestination();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================================================
  // 1. Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const engine = new PlaybackEngine(eventBus);

      expect(engine.getState()).toBe('idle');
      expect(engine.isReady()).toBe(false);

      const stats = engine.getStats();
      expect(stats.state).toBe('idle');
      expect(stats.isInitialized).toBe(false);
      expect(stats.countdownBeats).toBe(4); // Default
      expect(stats.countdownEnabled).toBe(false); // Default
    });

    it('should initialize with custom configuration', () => {
      const config: PlaybackEngineConfig = {
        countdownBeats: 8,
        countdownEnabled: true,
        lookAheadTime: 0.2,
      };

      const engine = new PlaybackEngine(eventBus, config);
      const stats = engine.getStats();

      expect(stats.countdownBeats).toBe(8);
      expect(stats.countdownEnabled).toBe(true);
    });

    it('should initialize audio context and transition to ready state', async () => {
      const engine = new PlaybackEngine(eventBus);

      await engine.initialize(audioContext, audioDestination);

      expect(engine.getState()).toBe('ready');
      expect(engine.isReady()).toBe(true);

      const stats = engine.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should emit state change events during initialization', async () => {
      const engine = new PlaybackEngine(eventBus);

      await engine.initialize(audioContext, audioDestination);

      // Should emit: idle → loading, loading → ready
      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'idle',
        newState: 'loading',
        instanceId: expect.any(String),
      });

      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'loading',
        newState: 'ready',
        instanceId: expect.any(String),
      });
    });

    it('should prevent double initialization', async () => {
      const engine = new PlaybackEngine(eventBus);

      await engine.initialize(audioContext, audioDestination);
      await engine.initialize(audioContext, audioDestination);

      // Should only transition to ready once
      const readyTransitions = (eventBus.emit as any).mock.calls.filter(
        (call: any) =>
          call[0] === 'playback:state-change' && call[1].newState === 'ready',
      );

      expect(readyTransitions).toHaveLength(1);
    });

    it('should handle initialization errors and set error state', async () => {
      const engine = new PlaybackEngine(eventBus);

      // Force error by passing null
      await expect(
        engine.initialize(null as any, audioDestination),
      ).rejects.toThrow();

      expect(engine.getState()).toBe('error');
    });
  });

  // ============================================================================
  // 2. State Machine Tests
  // ============================================================================

  describe('State Machine', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
      vi.clearAllMocks(); // Clear initialization events
    });

    it('should allow valid state transition: ready → playing', () => {
      engine.start();

      expect(engine.getState()).toBe('playing');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'ready',
        newState: 'playing',
        instanceId: expect.any(String),
      });
    });

    it('should allow valid state transition: playing → paused', () => {
      engine.start();
      vi.clearAllMocks();

      engine.pause();

      expect(engine.getState()).toBe('paused');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'playing',
        newState: 'paused',
        instanceId: expect.any(String),
      });
    });

    it('should allow valid state transition: paused → playing', () => {
      engine.start();
      engine.pause();
      vi.clearAllMocks();

      engine.resume();

      expect(engine.getState()).toBe('playing');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'paused',
        newState: 'playing',
        instanceId: expect.any(String),
      });
    });

    it('should allow valid state transition: playing → stopped', () => {
      engine.start();
      vi.clearAllMocks();

      engine.stop();

      expect(engine.getState()).toBe('stopped');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'playing',
        newState: 'stopped',
        instanceId: expect.any(String),
      });
    });

    it('should block invalid state transition: ready → paused', () => {
      expect(engine.getState()).toBe('ready');

      engine.pause();

      // State should remain ready
      expect(engine.getState()).toBe('ready');
      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:state-change',
        expect.any(Object),
      );
    });

    it('should emit state change events for valid transitions', () => {
      engine.start();

      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:state-change',
        expect.objectContaining({
          oldState: 'ready',
          newState: 'playing',
        }),
      );
    });

    it('should include instance ID in state change events', () => {
      const stats = engine.getStats();
      const instanceId = stats.instanceId;

      engine.start();

      expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
        oldState: 'ready',
        newState: 'playing',
        instanceId,
      });
    });

    it('should validate state with isReady()', () => {
      expect(engine.isReady()).toBe(true);

      engine.start();
      expect(engine.isReady()).toBe(false); // Not ready when playing

      engine.stop();
      expect(engine.isReady()).toBe(false); // Not ready after stop (stopped state)
    });

    it('should allow error state to recover', async () => {
      // Force error state
      const errorEngine = new PlaybackEngine(eventBus);
      try {
        await errorEngine.initialize(null as any, audioDestination);
      } catch {
        // Expected error
      }

      expect(errorEngine.getState()).toBe('error');

      // Should be able to initialize again
      await errorEngine.initialize(audioContext, audioDestination);
      expect(errorEngine.getState()).toBe('ready');
    });

    it('should emit correct events for each state transition', () => {
      const transitions = [
        { method: 'start', expectedOld: 'ready', expectedNew: 'playing' },
        { method: 'pause', expectedOld: 'playing', expectedNew: 'paused' },
        { method: 'resume', expectedOld: 'paused', expectedNew: 'playing' },
        { method: 'stop', expectedOld: 'playing', expectedNew: 'stopped' },
      ];

      for (const { method, expectedOld, expectedNew } of transitions) {
        vi.clearAllMocks();

        (engine as any)[method]();

        expect(eventBus.emit).toHaveBeenCalledWith('playback:state-change', {
          oldState: expectedOld,
          newState: expectedNew,
          instanceId: expect.any(String),
        });
      }
    });
  });

  // ============================================================================
  // 3. Track Management Tests
  // ============================================================================

  describe('Track Management', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
    });

    it('should register a track', () => {
      const track: Track = {
        id: 'track-1',
        name: 'Bass Track',
        instrumentType: 'bass',
        regions: [],
      };

      engine.registerTrack(track);

      const tracks = engine.getTracks();
      expect(tracks.size).toBe(1);
      expect(tracks.get('track-1')).toEqual(track);
    });

    it('should unregister a track', () => {
      const track: Track = {
        id: 'track-1',
        name: 'Bass Track',
        instrumentType: 'bass',
        regions: [],
      };

      engine.registerTrack(track);
      expect(engine.getTracks().size).toBe(1);

      engine.unregisterTrack('track-1');
      expect(engine.getTracks().size).toBe(0);
    });

    it('should return track map with getTracks()', () => {
      const track1: Track = {
        id: 'track-1',
        name: 'Bass Track',
        instrumentType: 'bass',
        regions: [],
      };
      const track2: Track = {
        id: 'track-2',
        name: 'Drum Track',
        instrumentType: 'drums',
        regions: [],
      };

      engine.registerTrack(track1);
      engine.registerTrack(track2);

      const tracks = engine.getTracks();
      expect(tracks.size).toBe(2);
      expect(tracks.get('track-1')).toEqual(track1);
      expect(tracks.get('track-2')).toEqual(track2);
    });

    it('should handle multiple track registrations', () => {
      const tracks: Track[] = [
        { id: 'track-1', name: 'Bass', instrumentType: 'bass', regions: [] },
        { id: 'track-2', name: 'Drums', instrumentType: 'drums', regions: [] },
        {
          id: 'track-3',
          name: 'Harmony',
          instrumentType: 'harmony',
          regions: [],
        },
      ];

      tracks.forEach((track) => engine.registerTrack(track));

      const registeredTracks = engine.getTracks();
      expect(registeredTracks.size).toBe(3);

      tracks.forEach((track) => {
        expect(registeredTracks.get(track.id)).toEqual(track);
      });
    });

    it('should update countdown configuration', () => {
      engine.setCountdownConfig(8, true);

      const stats = engine.getStats();
      expect(stats.countdownBeats).toBe(8);
      expect(stats.countdownEnabled).toBe(true);

      engine.setCountdownConfig(2, false);

      const updatedStats = engine.getStats();
      expect(updatedStats.countdownBeats).toBe(2);
      expect(updatedStats.countdownEnabled).toBe(false);
    });
  });

  // ============================================================================
  // 4. Playback Control Tests
  // ============================================================================

  describe('Playback Control', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
      vi.clearAllMocks();
    });

    it('should start playback from ready state', () => {
      engine.start();

      expect(engine.getState()).toBe('playing');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:start', {
        instanceId: expect.any(String),
      });
    });

    it('should start playback from stopped state', () => {
      engine.start();
      engine.stop();
      vi.clearAllMocks();

      engine.start();

      expect(engine.getState()).toBe('playing');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:start', {
        instanceId: expect.any(String),
      });
    });

    it('should block start from invalid states', () => {
      engine.start(); // Now playing
      vi.clearAllMocks();

      engine.start(); // Try to start again

      // Should not emit start event twice
      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:start',
        expect.any(Object),
      );
    });

    it('should stop playback and emit stop event', () => {
      engine.start();
      vi.clearAllMocks();

      engine.stop();

      expect(engine.getState()).toBe('stopped');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:stop', {
        graceful: false,
        instanceId: expect.any(String),
      });
    });

    it('should stop playback gracefully when requested', () => {
      engine.start();
      vi.clearAllMocks();

      engine.stop(true);

      expect(eventBus.emit).toHaveBeenCalledWith('playback:stop', {
        graceful: true,
        instanceId: expect.any(String),
      });
    });

    it('should block stop from invalid states', () => {
      // Engine is in ready state
      vi.clearAllMocks();

      engine.stop();

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:stop',
        expect.any(Object),
      );
    });

    it('should pause playback and emit pause event', () => {
      engine.start();
      vi.clearAllMocks();

      engine.pause();

      expect(engine.getState()).toBe('paused');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:pause', {
        instanceId: expect.any(String),
      });
    });

    it('should resume playback from paused state', () => {
      engine.start();
      engine.pause();
      vi.clearAllMocks();

      engine.resume();

      expect(engine.getState()).toBe('playing');
      expect(eventBus.emit).toHaveBeenCalledWith('playback:resume', {
        instanceId: expect.any(String),
      });
    });

    it('should block resume from invalid states', () => {
      // Engine is in ready state
      vi.clearAllMocks();

      engine.resume();

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:resume',
        expect.any(Object),
      );
    });

    it('should emit all playback events with instance ID', () => {
      const stats = engine.getStats();
      const instanceId = stats.instanceId;

      engine.start();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:start',
        expect.objectContaining({ instanceId }),
      );

      engine.pause();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:pause',
        expect.objectContaining({ instanceId }),
      );

      engine.resume();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:resume',
        expect.objectContaining({ instanceId }),
      );

      engine.stop();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'playback:stop',
        expect.objectContaining({ instanceId }),
      );
    });
  });

  // ============================================================================
  // 5. Tempo Management Tests (Bug #6 validation)
  // ============================================================================

  describe('Tempo Management', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
      vi.clearAllMocks();
    });

    it('should debounce rapid tempo changes', () => {
      engine.updateTempo(120);
      engine.updateTempo(125);
      engine.updateTempo(130);

      // Should not emit yet (debouncing)
      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );

      // Advance timers by 50ms
      vi.advanceTimersByTime(50);

      // Should only emit once with the latest tempo
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 130,
        instanceId: expect.any(String),
      });
    });

    it('should respect 50ms debounce threshold', () => {
      engine.updateTempo(120);

      // Advance by 49ms (not enough)
      vi.advanceTimersByTime(49);
      expect(eventBus.emit).not.toHaveBeenCalled();

      // Advance by 1ms more (total 50ms)
      vi.advanceTimersByTime(1);
      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 120,
        instanceId: expect.any(String),
      });
    });

    it('should clear previous debounce timer on new tempo change', () => {
      engine.updateTempo(120);
      vi.advanceTimersByTime(25); // Halfway through debounce

      engine.updateTempo(130); // Reset debounce timer
      vi.advanceTimersByTime(25); // Only 25ms since last update

      // Should not emit yet
      expect(eventBus.emit).not.toHaveBeenCalled();

      // Advance remaining 25ms
      vi.advanceTimersByTime(25);

      // Should emit the latest tempo
      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 130,
        instanceId: expect.any(String),
      });
    });

    it('should emit tempo change event after debounce', () => {
      engine.updateTempo(140);
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 140,
        instanceId: expect.any(String),
      });
    });

    it('should handle multiple distinct tempo changes', () => {
      // First change
      engine.updateTempo(120);
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 120,
        instanceId: expect.any(String),
      });

      vi.clearAllMocks();

      // Second change
      engine.updateTempo(140);
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 140,
        instanceId: expect.any(String),
      });
    });

    it('should emit tempo change during playback', () => {
      engine.start();
      vi.clearAllMocks();

      engine.updateTempo(150);
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).toHaveBeenCalledWith('playback:tempo-change', {
        bpm: 150,
        instanceId: expect.any(String),
      });
    });

    it('should clear tempo debounce timer on dispose', () => {
      engine.updateTempo(120);

      engine.dispose();

      // Advance timers - should not emit after dispose
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
    });
  });

  // ============================================================================
  // 6. PluginManager Integration Tests
  // ============================================================================

  describe('PluginManager Integration', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
    });

    it('should set PluginManager reference', () => {
      const mockPluginManager = createMockPluginManager();

      engine.setPluginManager(mockPluginManager);

      // getWamKeyboard should now attempt to use the plugin manager
      engine.getWamKeyboard();
      expect(mockPluginManager.getPlugin).toHaveBeenCalledWith('wam-keyboard');
    });

    it('should return null if PluginManager not set', () => {
      expect(engine.getWamKeyboard()).toBeNull();
    });

    it('should return null if wam-keyboard plugin not found', () => {
      const mockPluginManager = createMockPluginManager(null);

      engine.setPluginManager(mockPluginManager);
      const wamKeyboard = engine.getWamKeyboard();

      expect(wamKeyboard).toBeNull();
    });

    it('should perform two-step unwrapping to get WamKeyboard', () => {
      const mockWamKeyboard = createMockWamKeyboard();
      const mockWamKeyboardPlugin =
        createMockWamKeyboardPlugin(mockWamKeyboard);
      const mockPluginManager = createMockPluginManager(mockWamKeyboardPlugin);

      engine.setPluginManager(mockPluginManager);
      const wamKeyboard = engine.getWamKeyboard();

      expect(mockPluginManager.getPlugin).toHaveBeenCalledWith('wam-keyboard');
      expect(mockWamKeyboardPlugin.getWamKeyboard).toHaveBeenCalled();
      expect(wamKeyboard).toBe(mockWamKeyboard);
    });

    it('should handle errors during WamKeyboard retrieval', () => {
      const mockWamKeyboardPlugin = {
        getWamKeyboard: vi.fn(() => {
          throw new Error('Test error');
        }),
      } as unknown as WamKeyboardPlugin;

      const mockPluginManager = createMockPluginManager(mockWamKeyboardPlugin);

      engine.setPluginManager(mockPluginManager);
      const wamKeyboard = engine.getWamKeyboard();

      expect(wamKeyboard).toBeNull();
    });
  });

  // ============================================================================
  // 7. Lifecycle & Cleanup Tests (Bug #7 validation)
  // ============================================================================

  describe('Lifecycle & Cleanup', () => {
    let engine: PlaybackEngine;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);
    });

    it('should stop active playback on dispose', () => {
      engine.start();
      expect(engine.getState()).toBe('playing');

      engine.dispose();

      expect(engine.getState()).toBe('idle');
    });

    it('should clear tempo debounce timer on dispose', () => {
      engine.updateTempo(120);

      engine.dispose();

      // Advance timers - should not emit after dispose
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).not.toHaveBeenCalledWith(
        'playback:tempo-change',
        expect.any(Object),
      );
    });

    it('should unsubscribe from event listeners on dispose', () => {
      const unsubscribeMock = vi.fn();
      (eventBus.on as any).mockReturnValue(unsubscribeMock);

      // Simulate subscribing to an event
      const unsubscribe = eventBus.on('test-event', vi.fn());

      // Manually track the unsubscribe (simulating internal tracking)
      (engine as any).eventListeners.set('test-event', [unsubscribe]);

      engine.dispose();

      // The unsubscribe function should have been called
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should clear all event listeners on dispose', () => {
      const unsubscribe1 = vi.fn();
      const unsubscribe2 = vi.fn();

      (engine as any).eventListeners.set('event-1', [unsubscribe1]);
      (engine as any).eventListeners.set('event-2', [unsubscribe2]);

      engine.dispose();

      expect(unsubscribe1).toHaveBeenCalled();
      expect(unsubscribe2).toHaveBeenCalled();

      const listeners = (engine as any).eventListeners;
      expect(listeners.size).toBe(0);
    });

    it('should dispose scheduler on dispose', () => {
      const scheduler = (engine as any).scheduler;
      const disposeSpy = vi.spyOn(scheduler, 'dispose');

      engine.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear all tracks on dispose', () => {
      const track: Track = {
        id: 'track-1',
        name: 'Test Track',
        instrumentType: 'bass',
        regions: [],
      };

      engine.registerTrack(track);
      expect(engine.getTracks().size).toBe(1);

      engine.dispose();

      expect(engine.getTracks().size).toBe(0);
    });

    it('should reset state to idle on dispose', () => {
      engine.start();
      expect(engine.getState()).toBe('playing');

      engine.dispose();

      expect(engine.getState()).toBe('idle');
      expect(engine.isReady()).toBe(false);
    });

    it('should clear all references on dispose', () => {
      const mockPluginManager = createMockPluginManager();
      engine.setPluginManager(mockPluginManager);

      engine.dispose();

      // References should be cleared
      expect((engine as any).audioContext).toBeNull();
      expect((engine as any).audioDestination).toBeNull();
      expect((engine as any).pluginManager).toBeNull();

      const stats = engine.getStats();
      expect(stats.isInitialized).toBe(false);
    });
  });

  // ============================================================================
  // 8. Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle full lifecycle: initialize → start → stop → dispose', async () => {
      const engine = new PlaybackEngine(eventBus);

      // Initialize
      await engine.initialize(audioContext, audioDestination);
      expect(engine.getState()).toBe('ready');

      // Start
      engine.start();
      expect(engine.getState()).toBe('playing');

      // Stop
      engine.stop();
      expect(engine.getState()).toBe('stopped');

      // Dispose
      engine.dispose();
      expect(engine.getState()).toBe('idle');
      expect(engine.isReady()).toBe(false);
    });

    it('should handle exercise switching flow', async () => {
      const engine = new PlaybackEngine(eventBus);
      await engine.initialize(audioContext, audioDestination);

      // Register first exercise tracks
      const track1: Track = {
        id: 'exercise-1-bass',
        name: 'Exercise 1 Bass',
        instrumentType: 'bass',
        regions: [],
        exerciseId: 'exercise-1',
      };

      engine.registerTrack(track1);
      expect(engine.getTracks().size).toBe(1);

      // Start playback
      engine.start();
      expect(engine.getState()).toBe('playing');

      // Switch exercise: stop, clear tracks, register new tracks
      engine.stop();
      engine.unregisterTrack('exercise-1-bass');

      const track2: Track = {
        id: 'exercise-2-bass',
        name: 'Exercise 2 Bass',
        instrumentType: 'bass',
        regions: [],
        exerciseId: 'exercise-2',
      };

      engine.registerTrack(track2);
      expect(engine.getTracks().size).toBe(1);
      expect(engine.getTracks().get('exercise-2-bass')).toEqual(track2);

      // Resume playback with new exercise
      engine.start();
      expect(engine.getState()).toBe('playing');
    });

    it('should return correct stats for monitoring', async () => {
      const config: PlaybackEngineConfig = {
        countdownBeats: 8,
        countdownEnabled: true,
      };

      const engine = new PlaybackEngine(eventBus, config);
      await engine.initialize(audioContext, audioDestination);

      const track: Track = {
        id: 'track-1',
        name: 'Test Track',
        instrumentType: 'harmony',
        regions: [],
      };

      engine.registerTrack(track);
      engine.start();

      const stats = engine.getStats();

      expect(stats).toEqual({
        state: 'playing',
        isInitialized: true,
        tracksCount: 1,
        schedulerStats: expect.any(Object),
        instanceId: expect.any(String),
        countdownEnabled: true,
        countdownBeats: 8,
      });
    });
  });

  // ==========================================================================
  // TEST SUITE: Exercise Switching Cleanup
  // ==========================================================================
  describe('Exercise Switching Cleanup', () => {
    let engine: PlaybackEngine;
    let audioContext: AudioContext;
    let audioDestination: AudioNode;

    beforeEach(async () => {
      engine = new PlaybackEngine(eventBus);
      audioContext = createMockAudioContext();
      audioDestination = createMockAudioDestination();
      await engine.initialize(audioContext, audioDestination);
    });

    afterEach(() => {
      engine.dispose();
    });

    describe('clearHarmonyTracks', () => {
      it('should remove all harmony tracks from engine', async () => {
        // Register multiple track types
        const harmonyTrack1: Track = {
          id: 'harmony-track-1',
          name: 'Harmony 1',
          instrumentType: 'harmony',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const harmonyTrack2: Track = {
          id: 'harmony-track-2',
          name: 'Harmony 2',
          instrumentType: 'harmony',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const drumTrack: Track = {
          id: 'drum-track',
          name: 'Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const bassTrack: Track = {
          id: 'bass-track',
          name: 'Bass',
          instrumentType: 'bass',
          regions: [],
          exerciseId: 'exercise-1',
        };

        engine.registerTrack(harmonyTrack1);
        engine.registerTrack(harmonyTrack2);
        engine.registerTrack(drumTrack);
        engine.registerTrack(bassTrack);

        expect(engine.getTracks().size).toBe(4);

        // Clear harmony tracks
        engine.clearHarmonyTracks();

        // Only non-harmony tracks should remain
        expect(engine.getTracks().size).toBe(2);
        expect(engine.getTracks().has('harmony-track-1')).toBe(false);
        expect(engine.getTracks().has('harmony-track-2')).toBe(false);
        expect(engine.getTracks().has('drum-track')).toBe(true);
        expect(engine.getTracks().has('bass-track')).toBe(true);
      });

      it('should handle clearing when no harmony tracks exist', async () => {
        const drumTrack: Track = {
          id: 'drum-track',
          name: 'Drums',
          instrumentType: 'drums',
          regions: [],
        };

        engine.registerTrack(drumTrack);
        expect(engine.getTracks().size).toBe(1);

        // Should not throw when no harmony tracks
        expect(() => engine.clearHarmonyTracks()).not.toThrow();
        expect(engine.getTracks().size).toBe(1);
      });

      it('should handle clearing when engine has no tracks', async () => {
        expect(engine.getTracks().size).toBe(0);

        // Should not throw when no tracks at all
        expect(() => engine.clearHarmonyTracks()).not.toThrow();
        expect(engine.getTracks().size).toBe(0);
      });
    });

    describe('clearDrumTracks', () => {
      it('should remove all drum tracks from engine', async () => {
        const harmonyTrack: Track = {
          id: 'harmony-track',
          name: 'Harmony',
          instrumentType: 'harmony',
          regions: [],
        };

        const drumTrack1: Track = {
          id: 'drum-track-1',
          name: 'Drums 1',
          instrumentType: 'drums',
          regions: [],
        };

        const drumTrack2: Track = {
          id: 'drum-track-2',
          name: 'Drums 2',
          instrumentType: 'drums',
          regions: [],
        };

        engine.registerTrack(harmonyTrack);
        engine.registerTrack(drumTrack1);
        engine.registerTrack(drumTrack2);

        expect(engine.getTracks().size).toBe(3);

        engine.clearDrumTracks();

        expect(engine.getTracks().size).toBe(1);
        expect(engine.getTracks().has('harmony-track')).toBe(true);
        expect(engine.getTracks().has('drum-track-1')).toBe(false);
        expect(engine.getTracks().has('drum-track-2')).toBe(false);
      });
    });

    describe('clearBassTracks', () => {
      it('should remove all bass tracks from engine', async () => {
        const harmonyTrack: Track = {
          id: 'harmony-track',
          name: 'Harmony',
          instrumentType: 'harmony',
          regions: [],
        };

        const bassTrack1: Track = {
          id: 'bass-track-1',
          name: 'Bass 1',
          instrumentType: 'bass',
          regions: [],
        };

        const bassTrack2: Track = {
          id: 'bass-track-2',
          name: 'Bass 2',
          instrumentType: 'bass',
          regions: [],
        };

        engine.registerTrack(harmonyTrack);
        engine.registerTrack(bassTrack1);
        engine.registerTrack(bassTrack2);

        expect(engine.getTracks().size).toBe(3);

        engine.clearBassTracks();

        expect(engine.getTracks().size).toBe(1);
        expect(engine.getTracks().has('harmony-track')).toBe(true);
        expect(engine.getTracks().has('bass-track-1')).toBe(false);
        expect(engine.getTracks().has('bass-track-2')).toBe(false);
      });
    });

    describe('Full Exercise Switch Flow', () => {
      it('should properly switch from exercise with harmony to exercise without', async () => {
        // Exercise 1: Has harmony + drums
        const exercise1Harmony: Track = {
          id: 'ex1-harmony',
          name: 'Exercise 1 Harmony',
          instrumentType: 'harmony',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const exercise1Drums: Track = {
          id: 'ex1-drums',
          name: 'Exercise 1 Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-1',
        };

        engine.registerTrack(exercise1Harmony);
        engine.registerTrack(exercise1Drums);
        expect(engine.getTracks().size).toBe(2);

        // Start playback
        engine.start();
        expect(engine.getState()).toBe('playing');

        // Stop for exercise switch
        engine.stop();

        // Clear harmony (Exercise 2 has no harmony)
        engine.clearHarmonyTracks();

        // Clear old drums
        engine.clearDrumTracks();

        // Register Exercise 2 (drums only)
        const exercise2Drums: Track = {
          id: 'ex2-drums',
          name: 'Exercise 2 Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-2',
        };

        engine.registerTrack(exercise2Drums);

        // Verify only Exercise 2 drums remain
        expect(engine.getTracks().size).toBe(1);
        expect(engine.getTracks().has('ex2-drums')).toBe(true);
        expect(engine.getTracks().has('ex1-harmony')).toBe(false);
        expect(engine.getTracks().has('ex1-drums')).toBe(false);
      });

      it('should properly switch back to exercise with harmony', async () => {
        // Start with Exercise 2 (drums only)
        const exercise2Drums: Track = {
          id: 'ex2-drums',
          name: 'Exercise 2 Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-2',
        };

        engine.registerTrack(exercise2Drums);
        expect(engine.getTracks().size).toBe(1);

        // Switch to Exercise 1 (has harmony + drums)
        engine.stop();
        engine.clearDrumTracks();

        const exercise1Harmony: Track = {
          id: 'ex1-harmony',
          name: 'Exercise 1 Harmony',
          instrumentType: 'harmony',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const exercise1Drums: Track = {
          id: 'ex1-drums',
          name: 'Exercise 1 Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-1',
        };

        engine.registerTrack(exercise1Harmony);
        engine.registerTrack(exercise1Drums);

        // Verify Exercise 1 tracks are registered
        expect(engine.getTracks().size).toBe(2);
        expect(engine.getTracks().has('ex1-harmony')).toBe(true);
        expect(engine.getTracks().has('ex1-drums')).toBe(true);
        expect(engine.getTracks().has('ex2-drums')).toBe(false);
      });

      it('should clear all instrument types when doing full exercise switch', async () => {
        // Register all instrument types
        const harmonyTrack: Track = {
          id: 'harmony',
          name: 'Harmony',
          instrumentType: 'harmony',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const drumTrack: Track = {
          id: 'drums',
          name: 'Drums',
          instrumentType: 'drums',
          regions: [],
          exerciseId: 'exercise-1',
        };

        const bassTrack: Track = {
          id: 'bass',
          name: 'Bass',
          instrumentType: 'bass',
          regions: [],
          exerciseId: 'exercise-1',
        };

        engine.registerTrack(harmonyTrack);
        engine.registerTrack(drumTrack);
        engine.registerTrack(bassTrack);
        expect(engine.getTracks().size).toBe(3);

        // Clear all for exercise switch
        engine.clearHarmonyTracks();
        engine.clearDrumTracks();
        engine.clearBassTracks();

        expect(engine.getTracks().size).toBe(0);
      });
    });
  });
});
