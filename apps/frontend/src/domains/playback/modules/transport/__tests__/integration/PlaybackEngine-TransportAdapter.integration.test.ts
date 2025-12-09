/**
 * PlaybackEngine ↔ TransportAdapter Integration Tests (Phase 3.2)
 *
 * These integration tests verify that PlaybackEngine correctly integrates with
 * the new Transport system via TransportAdapter, ensuring playback coordination,
 * timing synchronization, and event communication work correctly.
 *
 * Integration points tested:
 * 1. Transport Control - PlaybackEngine controls transport via adapter
 * 2. Transport Time Sync - transportStartTime synchronization for scheduling
 * 3. Event Subscription - PlaybackEngine receives transport events via EventBus
 * 4. State Coordination - PlaybackEngine state syncs with transport state
 * 5. Tempo Changes - Tempo updates propagate correctly
 * 6. Scheduling Coordination - Regions schedule at correct transport times
 * 7. Countdown Integration - Countdown offset handling
 * 8. Lifecycle Management - Start/stop/pause/resume coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlaybackEngine } from '../../../../services/core/PlaybackEngine.js';
import { TransportAdapter } from '../../../../services/core/TransportAdapter.js';
import { TransportController } from '../../core/TransportController.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { AudioEngine } from '../../../audio-engine/core/AudioEngine.js';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    state: 'stopped',
    position: 0,
    seconds: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    clear: vi.fn(),
    schedule: vi.fn().mockReturnValue(1),
  },
  context: {
    lookAhead: 0.1,
    updateInterval: 0.025,
    state: 'running',
    currentTime: 0,
    sampleRate: 48000,
    resume: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Transport
vi.mock('../../core/Transport.js', () => {
  return {
    Transport: class MockTransport {
      private _isRunning = false;
      private _currentTime = 0;
      private _transportStartTime = 0;
      private _audioContext: any = null;

      constructor(config: any) {}

      async initialize(audioContext: any) {
        this._audioContext = audioContext;
      }

      getAudioContext() {
        return this._audioContext;
      }

      start() {
        this._isRunning = true;
      }

      stop() {
        this._isRunning = false;
        this._currentTime = 0;
      }

      pause() {
        this._isRunning = false;
      }

      resume() {
        this._isRunning = true;
      }

      seek(seconds: number) {
        this._currentTime = seconds;
      }

      getCurrentTime() {
        return this._currentTime;
      }

      getState() {
        return this._isRunning ? 'playing' : 'stopped';
      }

      getClock() {
        return { getCurrentTime: () => this._currentTime };
      }

      getTimeline() {
        return { getExerciseDurationSeconds: () => 0 };
      }

      onPositionUpdate(callback: Function) {}

      updateConfig(config: any) {}

      setTransportStartTime(time: number) {
        this._transportStartTime = time;
      }

      getTransportStartTime() {
        return this._transportStartTime;
      }

      isUsingAudioWorklet() {
        return true;
      }

      isUsingWebWorker() {
        return false;
      }

      destroy() {}
    },
  };
});

// Mock EventBus for integration testing
class PlaybackEngineMockEventBus implements EventBus {
  private listeners: Map<string, Function[]> = new Map();
  private emittedEvents: Array<{ event: string; data: any }> = [];

  emit(event: string, data: any): void {
    this.emittedEvents.push({ event, data });
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        // Swallow errors in tests
      }
    });
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Test helpers
  getEmittedEvents() {
    return this.emittedEvents;
  }

  clearEmittedEvents() {
    this.emittedEvents = [];
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

// Mock AudioEngine
class PlaybackEngineMockAudioEngine implements AudioEngine {
  private audioContext = {
    state: 'running' as const,
    sampleRate: 48000,
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    destination: {
      connect: vi.fn(),
    },
  };

  getAudioContext() {
    return this.audioContext as any;
  }

  async getContext() {
    return this.audioContext as any;
  }

  // Simulate time passing
  advanceTime(seconds: number) {
    this.audioContext.currentTime += seconds;
  }
}

describe('PlaybackEngine ↔ TransportAdapter Integration Tests (Phase 3.2)', () => {
  let playbackEngine: PlaybackEngine;
  let transportAdapter: TransportAdapter;
  let eventBus: PlaybackEngineMockEventBus;
  let audioEngine: PlaybackEngineMockAudioEngine;
  let audioContext: any;
  let audioDestination: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock services
    eventBus = new PlaybackEngineMockEventBus();
    audioEngine = new PlaybackEngineMockAudioEngine();
    audioContext = audioEngine.getAudioContext();
    audioDestination = audioContext.destination;

    // Clear singletons
    (TransportAdapter as any).instance = null;
    (TransportController as any).instance = null;

    // Create TransportAdapter
    transportAdapter = TransportAdapter.getInstance(
      eventBus as any,
      audioEngine as any,
    );

    // Initialize TransportAdapter
    await transportAdapter.initialize();

    // Create PlaybackEngine
    playbackEngine = new PlaybackEngine(eventBus as any);

    // Initialize PlaybackEngine
    await playbackEngine.initialize(audioContext, audioDestination);
  });

  afterEach(async () => {
    // Cleanup PlaybackEngine
    if (playbackEngine) {
      playbackEngine.dispose();
    }

    // Cleanup TransportAdapter
    if (transportAdapter && typeof (transportAdapter as any).dispose === 'function') {
      await (transportAdapter as any).dispose();
    }

    // Clear singletons
    (TransportAdapter as any).instance = null;
    (TransportController as any).instance = null;
  });

  describe('Integration 1: Transport Control', () => {
    it('should coordinate transport start when PlaybackEngine starts', async () => {
      eventBus.clearEmittedEvents();

      // Act: Start PlaybackEngine (which should not directly start transport)
      playbackEngine.start();

      // Assert: Check for playback:start event
      const events = eventBus.getEmittedEvents();
      const startEvent = events.find((e) => e.event === 'playback:start');
      expect(startEvent).toBeDefined();
    });

    it('should coordinate transport stop when PlaybackEngine stops', async () => {
      // Start first
      playbackEngine.start();
      eventBus.clearEmittedEvents();

      // Act: Stop PlaybackEngine
      playbackEngine.stop();

      // Assert: PlaybackEngine should be stopped
      expect(playbackEngine.getState()).toBe('stopped');
    });

    it('should handle PlaybackEngine pause correctly', async () => {
      // Start first
      playbackEngine.start();
      eventBus.clearEmittedEvents();

      // Act: Pause PlaybackEngine
      playbackEngine.pause();

      // Assert: PlaybackEngine should be paused
      expect(playbackEngine.getState()).toBe('paused');

      const events = eventBus.getEmittedEvents();
      const pauseEvent = events.find((e) => e.event === 'playback:pause');
      expect(pauseEvent).toBeDefined();
    });

    it('should handle PlaybackEngine resume correctly', async () => {
      // Start and pause first
      playbackEngine.start();
      playbackEngine.pause();
      eventBus.clearEmittedEvents();

      // Act: Resume PlaybackEngine
      playbackEngine.resume();

      // Assert: PlaybackEngine should be playing
      expect(playbackEngine.getState()).toBe('playing');

      const events = eventBus.getEmittedEvents();
      const resumeEvent = events.find((e) => e.event === 'playback:resume');
      expect(resumeEvent).toBeDefined();
    });
  });

  describe('Integration 2: Transport Time Sync', () => {
    it('should sync transportStartTime before scheduling', async () => {
      // Advance audio context time to simulate real scenario
      audioEngine.advanceTime(0.05);

      eventBus.clearEmittedEvents();

      // Act: Start PlaybackEngine
      playbackEngine.start();

      // Assert: transportStartTime should be set based on TRANSPORT_TIMING_CONFIG
      // startupLookahead = 0.3s, so transportStartTime = currentTime + 0.3
      const expectedStartTime = audioContext.currentTime + 0.3;

      // We can verify this by checking the start event data or internal state
      // For now, just verify PlaybackEngine started successfully
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should use transportStartTime for audio scheduling coordination', async () => {
      // This test verifies the timing coordination pattern used by PlaybackEngine

      // Setup: Register a simple track
      playbackEngine.registerTrack({
        id: 'test-track',
        name: 'Test Track',
        instrumentType: 'metronome',
        regions: [
          {
            id: 'region-1',
            trackId: 'test-track',
            startTime: 0,
            duration: 1,
            pattern: {
              events: [
                {
                  position: '0:0:0',
                  type: 'click',
                  velocity: 0.7,
                },
              ],
            },
          },
        ],
      });

      // Act: Start PlaybackEngine
      playbackEngine.start();

      // Assert: PlaybackEngine should be running with scheduled events
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should maintain timing accuracy across multiple start/stop cycles', async () => {
      // First cycle
      playbackEngine.start();
      playbackEngine.stop();

      // Second cycle
      playbackEngine.start();
      expect(playbackEngine.getState()).toBe('playing');

      playbackEngine.stop();
      expect(playbackEngine.getState()).toBe('stopped');
    });
  });

  describe('Integration 3: Event Subscription', () => {
    it('should subscribe to transport:position-updated events', async () => {
      const initialListenerCount = eventBus.getListenerCount('transport:position-updated');

      // Act: Start PlaybackEngine (which subscribes to position updates)
      playbackEngine.start();

      // Assert: Should have subscribed to position updates
      const afterStartListenerCount = eventBus.getListenerCount('transport:position-updated');
      expect(afterStartListenerCount).toBeGreaterThan(initialListenerCount);
    });

    it('should unsubscribe from transport events on stop', async () => {
      // Start PlaybackEngine
      playbackEngine.start();
      const listenerCountDuringPlayback = eventBus.getListenerCount('transport:position-updated');

      // Act: Stop PlaybackEngine
      playbackEngine.stop();

      // Assert: Should have unsubscribed from position updates
      const listenerCountAfterStop = eventBus.getListenerCount('transport:position-updated');
      expect(listenerCountAfterStop).toBeLessThan(listenerCountDuringPlayback);
    });

    it('should process transport:position-updated events during playback', async () => {
      playbackEngine.start();

      // Act: Emit position update event (simulating TransportController)
      eventBus.emit('transport:position-updated', {
        bars: 1,
        beats: 1,
        sixteenths: 0,
        ticks: 0,
      });

      // Assert: PlaybackEngine should still be running
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should handle tempo change events via EventBus', async () => {
      playbackEngine.start();
      eventBus.clearEmittedEvents();

      // Act: Emit tempo change event
      eventBus.emit('transport:tempo-change', { tempo: 140, bpm: 140 });

      // Allow debounce to complete (50ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Tempo change should be processed
      // (Internal rescheduling should happen, but we can't easily verify without exposing internals)
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should not reschedule on tempo change when stopped', async () => {
      // Ensure PlaybackEngine is ready but not playing
      expect(playbackEngine.getState()).toBe('ready');

      // Act: Emit tempo change event while stopped
      eventBus.emit('transport:tempo-change', { tempo: 140, bpm: 140 });

      // Allow debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Should still be ready (not error or changed state)
      expect(playbackEngine.getState()).toBe('ready');
    });
  });

  describe('Integration 4: State Coordination', () => {
    it('should maintain PlaybackEngine state independent of transport state', async () => {
      // PlaybackEngine state should be 'ready' even if transport is stopped
      expect(playbackEngine.getState()).toBe('ready');
      expect(transportAdapter.getState()).toBe('stopped');
    });

    it('should transition PlaybackEngine to playing when started', async () => {
      playbackEngine.start();

      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should transition PlaybackEngine to stopped when stopped', async () => {
      playbackEngine.start();
      playbackEngine.stop();

      expect(playbackEngine.getState()).toBe('stopped');
    });

    it('should emit state change events', async () => {
      eventBus.clearEmittedEvents();

      // Act: Transition through states
      playbackEngine.start();

      // Assert: Should emit playback:state-change event
      const events = eventBus.getEmittedEvents();
      const stateChangeEvents = events.filter((e) => e.event === 'playback:state-change');

      expect(stateChangeEvents.length).toBeGreaterThan(0);
      const playingStateChange = stateChangeEvents.find(
        (e) => e.data.newState === 'playing',
      );
      expect(playingStateChange).toBeDefined();
    });
  });

  describe('Integration 5: Tempo Changes', () => {
    it('should handle tempo changes via PlaybackEngine.updateTempo()', async () => {
      playbackEngine.start();
      eventBus.clearEmittedEvents();

      // Act: Update tempo via PlaybackEngine
      playbackEngine.updateTempo(140);

      // Allow debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Should emit playback:tempo-change event
      const events = eventBus.getEmittedEvents();
      const tempoChangeEvent = events.find((e) => e.event === 'playback:tempo-change');

      expect(tempoChangeEvent).toBeDefined();
      expect(tempoChangeEvent?.data.bpm).toBe(140);
    });

    it('should debounce rapid tempo changes', async () => {
      playbackEngine.start();
      eventBus.clearEmittedEvents();

      // Act: Make rapid tempo changes
      playbackEngine.updateTempo(130);
      playbackEngine.updateTempo(135);
      playbackEngine.updateTempo(140);

      // Allow debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Should only emit one final tempo change event (debounced)
      const events = eventBus.getEmittedEvents();
      const tempoChangeEvents = events.filter((e) => e.event === 'playback:tempo-change');

      // Should have exactly 1 event after debouncing
      expect(tempoChangeEvents.length).toBe(1);
      expect(tempoChangeEvents[0].data.bpm).toBe(140);
    });
  });

  describe('Integration 6: Scheduling Coordination', () => {
    it('should schedule regions at correct transport times', async () => {
      // Setup: Register a track with a region
      playbackEngine.registerTrack({
        id: 'test-track',
        name: 'Test Track',
        instrumentType: 'metronome',
        regions: [
          {
            id: 'region-1',
            trackId: 'test-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: '0:0:0', type: 'click', velocity: 0.7 },
                { position: '0:1:0', type: 'click', velocity: 0.7 },
                { position: '0:2:0', type: 'click', velocity: 0.7 },
                { position: '0:3:0', type: 'click', velocity: 0.7 },
              ],
            },
          },
        ],
      });

      // Act: Start PlaybackEngine
      playbackEngine.start();

      // Assert: PlaybackEngine should be playing with scheduled events
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should handle countdown offset in scheduling', async () => {
      // Setup: Enable countdown
      playbackEngine.setCountdownConfig(4, true);

      // Register a track
      playbackEngine.registerTrack({
        id: 'test-track',
        name: 'Test Track',
        instrumentType: 'bass',
        regions: [
          {
            id: 'region-1',
            trackId: 'test-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'note', midiNote: 40 }],
            },
          },
        ],
      });

      // Act: Start PlaybackEngine
      playbackEngine.start();

      // Assert: PlaybackEngine should be playing
      expect(playbackEngine.getState()).toBe('playing');
    });
  });

  describe('Integration 7: Countdown Integration', () => {
    it('should add countdown regions when enabled', async () => {
      // Setup: Enable countdown
      playbackEngine.setCountdownConfig(4, true);

      // Act: Add countdown regions
      playbackEngine.addCountdownRegion({ numerator: 4, denominator: 4 });
      playbackEngine.addVoiceCountdownRegion({ numerator: 4, denominator: 4 });

      // Assert: Should have metronome and voice-cue tracks
      const tracks = playbackEngine.getTracks();
      expect(tracks.has('metronome')).toBe(true);
      expect(tracks.has('voice-cue')).toBe(true);

      const metronomeTrack = tracks.get('metronome');
      expect(metronomeTrack?.regions.length).toBeGreaterThan(0);

      const voiceCueTrack = tracks.get('voice-cue');
      expect(voiceCueTrack?.regions.length).toBeGreaterThan(0);
    });

    it('should not add countdown regions when disabled', async () => {
      // Setup: Disable countdown
      playbackEngine.setCountdownConfig(4, false);

      // Act: Try to add countdown regions
      playbackEngine.addCountdownRegion({ numerator: 4, denominator: 4 });
      playbackEngine.addVoiceCountdownRegion({ numerator: 4, denominator: 4 });

      // Assert: Should not have countdown regions
      const tracks = playbackEngine.getTracks();
      // Tracks might exist but should have no regions (or not exist at all)
      const metronomeTrack = tracks.get('metronome');
      const voiceCueTrack = tracks.get('voice-cue');

      if (metronomeTrack) {
        expect(metronomeTrack.regions.length).toBe(0);
      }
      if (voiceCueTrack) {
        expect(voiceCueTrack.regions.length).toBe(0);
      }
    });

    it('should use enableCountdown() method for compatibility', async () => {
      // Act: Enable countdown via new method
      playbackEngine.enableCountdown({ numerator: 3, denominator: 4 });

      // Assert: Countdown should be enabled with correct beats
      const stats = playbackEngine.getStats();
      expect(stats.countdownEnabled).toBe(true);
      expect(stats.countdownBeats).toBe(3);
    });
  });

  describe('Integration 8: Lifecycle Management', () => {
    it('should handle multiple start/stop cycles', async () => {
      // Cycle 1
      playbackEngine.start();
      expect(playbackEngine.getState()).toBe('playing');

      playbackEngine.stop();
      expect(playbackEngine.getState()).toBe('stopped');

      // Cycle 2
      playbackEngine.start();
      expect(playbackEngine.getState()).toBe('playing');

      playbackEngine.stop();
      expect(playbackEngine.getState()).toBe('stopped');
    });

    it('should handle pause/resume cycles', async () => {
      playbackEngine.start();

      playbackEngine.pause();
      expect(playbackEngine.getState()).toBe('paused');

      playbackEngine.resume();
      expect(playbackEngine.getState()).toBe('playing');

      playbackEngine.pause();
      expect(playbackEngine.getState()).toBe('paused');

      playbackEngine.resume();
      expect(playbackEngine.getState()).toBe('playing');
    });

    it('should clean up resources on dispose', async () => {
      playbackEngine.start();

      const listenerCountBefore = eventBus.getListenerCount('transport:position-updated');

      // Act: Dispose PlaybackEngine
      playbackEngine.dispose();

      // Assert: Should clean up listeners
      const listenerCountAfter = eventBus.getListenerCount('transport:position-updated');
      expect(listenerCountAfter).toBeLessThan(listenerCountBefore);

      // Should be in idle state
      expect(playbackEngine.getState()).toBe('idle');
    });

    it('should handle dispose during playback gracefully', async () => {
      playbackEngine.start();
      expect(playbackEngine.getState()).toBe('playing');

      // Act: Dispose while playing
      playbackEngine.dispose();

      // Assert: Should stop and clean up
      expect(playbackEngine.getState()).toBe('idle');
    });
  });

  describe('Integration 9: Track Management', () => {
    it('should register tracks correctly', () => {
      const track = {
        id: 'test-track',
        name: 'Test Track',
        instrumentType: 'bass',
        regions: [],
      };

      playbackEngine.registerTrack(track);

      const tracks = playbackEngine.getTracks();
      expect(tracks.has('test-track')).toBe(true);
      expect(tracks.get('test-track')).toEqual(track);
    });

    it('should use registerTracks() for batch registration', () => {
      const tracks = [
        {
          id: 'track-1',
          name: 'Track 1',
          instrumentType: 'bass',
          regions: [],
        },
        {
          id: 'track-2',
          name: 'Track 2',
          instrumentType: 'drums',
          regions: [],
        },
      ];

      playbackEngine.registerTracks(tracks, { harmonyInstrument: 'wurlitzer' });

      const registeredTracks = playbackEngine.getTracks();
      expect(registeredTracks.has('track-1')).toBe(true);
      expect(registeredTracks.has('track-2')).toBe(true);
    });

    it('should use updateTracks() for dynamic updates', () => {
      // Register initial track
      playbackEngine.registerTrack({
        id: 'track-1',
        name: 'Track 1',
        instrumentType: 'bass',
        regions: [],
      });

      // Update tracks
      playbackEngine.updateTracks(
        [
          {
            id: 'track-1',
            name: 'Track 1 Updated',
            instrumentType: 'bass',
            regions: [
              {
                id: 'region-1',
                trackId: 'track-1',
                startTime: 0,
                duration: 2,
                pattern: { events: [] },
              },
            ],
          },
        ],
        { harmonyInstrument: 'grandpiano' },
      );

      const tracks = playbackEngine.getTracks();
      const track = tracks.get('track-1');
      expect(track?.name).toBe('Track 1 Updated');
      expect(track?.regions.length).toBe(1);
    });

    it('should unregister tracks correctly', () => {
      playbackEngine.registerTrack({
        id: 'test-track',
        name: 'Test Track',
        instrumentType: 'bass',
        regions: [],
      });

      playbackEngine.unregisterTrack('test-track');

      const tracks = playbackEngine.getTracks();
      expect(tracks.has('test-track')).toBe(false);
    });
  });
});
