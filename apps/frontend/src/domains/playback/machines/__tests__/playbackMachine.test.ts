/**
 * PlaybackMachine Unit Tests
 *
 * Phase 4: Test Infrastructure
 *
 * These tests verify:
 * 1. State transition correctness
 * 2. Guard conditions
 * 3. Context mutations
 * 4. Event handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import {
  playbackMachine,
  type PlaybackMachineContext,
  type MachineTrack,
} from '../playbackMachine.js';
import {
  createMockAudioContext,
  createMockAudioDestination,
  createMockEventBus,
  runMachineWithEvents,
} from './testUtils.js';

// ============================================================================
// Test Setup
// ============================================================================

function createTestTrack(overrides?: Partial<MachineTrack>): MachineTrack {
  return {
    id: `track-${Math.random().toString(36).substring(7)}`,
    name: 'Test Track',
    instrumentType: 'bass',
    regions: [],
    ...overrides,
  };
}

// ============================================================================
// State Transition Tests
// ============================================================================

describe('PlaybackMachine', () => {
  describe('Initial State', () => {
    it('should start in idle state', () => {
      const actor = createActor(playbackMachine);
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle');
      expect(snapshot.context.audioContext).toBeNull();
      expect(snapshot.context.tracks.size).toBe(0);

      actor.stop();
    });

    it('should have default context values', () => {
      const actor = createActor(playbackMachine);
      actor.start();

      const { context } = actor.getSnapshot();
      expect(context.sampleRate).toBe(44100);
      expect(context.countdownBeats).toBe(4);
      expect(context.countdownEnabled).toBe(false);
      expect(context.lookAheadTime).toBe(0.1);
      expect(context.currentTempo).toBe(120);
      expect(context.error).toBeNull();
      expect(context.instanceId).toBeDefined();

      actor.stop();
    });

    it('should accept custom input for instanceId', () => {
      const actor = createActor(playbackMachine, {
        input: { instanceId: 'custom-id-123' },
      });
      actor.start();

      expect(actor.getSnapshot().context.instanceId).toBe('custom-id-123');

      actor.stop();
    });
  });

  describe('Initialization Flow', () => {
    it('should transition from idle to loading on INITIALIZE', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const snapshot = await runMachineWithEvents(playbackMachine, [
        {
          type: 'INITIALIZE',
          audioContext: mockAudioContext,
          audioDestination: mockDestination,
        },
      ]);

      // After initialization actor completes, should be in ready state
      expect(snapshot.value).toBe('ready');
      expect(snapshot.context.audioContext).toBe(mockAudioContext);
      expect(snapshot.context.sampleRate).toBe(44100);
    });

    it('should set audioContext and destination on INITIALIZE', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const snapshot = await runMachineWithEvents(playbackMachine, [
        {
          type: 'INITIALIZE',
          audioContext: mockAudioContext,
          audioDestination: mockDestination,
        },
      ]);

      expect(snapshot.context.audioContext).toBe(mockAudioContext);
      expect(snapshot.context.audioDestination).toBe(mockDestination);
    });
  });

  describe('Playback Flow (ready -> starting -> playing)', () => {
    it('should transition from ready to starting on START', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize first
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });

      // Wait for loading to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send START
      actor.send({ type: 'START' });

      // Should be in starting or playing state
      const snapshot = actor.getSnapshot();
      expect(['starting', 'playing']).toContain(snapshot.value);

      actor.stop();
    });

    it('should complete full playback cycle', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // After full cycle, should be in playing
      expect(actor.getSnapshot().value).toBe('playing');
      actor.stop();
    });
  });

  describe('Stop Flow', () => {
    it('should transition from playing to stopping on STOP', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Stop
      actor.send({ type: 'STOP' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be in stopped state
      expect(actor.getSnapshot().value).toBe('stopped');
      actor.stop();
    });

    it('should clear scheduled state on STOP', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start then Stop
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      actor.send({ type: 'STOP' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(actor.getSnapshot().context.scheduledIds.size).toBe(0);
      expect(actor.getSnapshot().context.scheduledEvents.size).toBe(0);
      expect(actor.getSnapshot().context.transportStartTime).toBe(0);
      actor.stop();
    });
  });

  describe('Pause/Resume Flow', () => {
    it('should transition from playing to paused on PAUSE', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start then Pause
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      actor.send({ type: 'PAUSE' });

      expect(actor.getSnapshot().value).toBe('paused');
      actor.stop();
    });

    it('should transition from paused to playing on RESUME', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start -> Pause -> Resume
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      actor.send({ type: 'PAUSE' });
      actor.send({ type: 'RESUME' });

      expect(actor.getSnapshot().value).toBe('playing');
      actor.stop();
    });
  });

  describe('Track Management', () => {
    it('should register tracks in ready state', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const testTrack = createTestTrack({ id: 'bass-track-1', instrumentType: 'bass' });

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Register track
      actor.send({ type: 'REGISTER_TRACK', track: testTrack });

      expect(actor.getSnapshot().context.tracks.size).toBe(1);
      expect(actor.getSnapshot().context.tracks.get('bass-track-1')).toEqual(testTrack);
      actor.stop();
    });

    it('should unregister tracks', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const testTrack = createTestTrack({ id: 'bass-track-1' });

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Register then unregister track
      actor.send({ type: 'REGISTER_TRACK', track: testTrack });
      expect(actor.getSnapshot().context.tracks.size).toBe(1);

      actor.send({ type: 'UNREGISTER_TRACK', trackId: 'bass-track-1' });
      expect(actor.getSnapshot().context.tracks.size).toBe(0);
      actor.stop();
    });

    it('should handle singleton instrument types (metronome)', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const metronome1 = createTestTrack({ id: 'metronome-1', instrumentType: 'metronome' });
      const metronome2 = createTestTrack({ id: 'metronome-2', instrumentType: 'metronome' });

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Register two metronomes - second should replace first
      actor.send({ type: 'REGISTER_TRACK', track: metronome1 });
      actor.send({ type: 'REGISTER_TRACK', track: metronome2 });

      // Should only have one metronome track (the second one replaced the first)
      expect(actor.getSnapshot().context.tracks.size).toBe(1);
      expect(actor.getSnapshot().context.tracks.has('metronome-2')).toBe(true);
      expect(actor.getSnapshot().context.tracks.has('metronome-1')).toBe(false);
      actor.stop();
    });

    it('should update multiple tracks at once', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const tracks = [
        createTestTrack({ id: 'track-1', name: 'Bass' }),
        createTestTrack({ id: 'track-2', name: 'Drums' }),
        createTestTrack({ id: 'track-3', name: 'Harmony' }),
      ];

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Update tracks
      actor.send({ type: 'UPDATE_TRACKS', tracks });

      expect(actor.getSnapshot().context.tracks.size).toBe(3);
      actor.stop();
    });
  });

  describe('Tempo Management', () => {
    it('should update tempo in ready state', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Set tempo
      actor.send({ type: 'SET_TEMPO', bpm: 140 });

      expect(actor.getSnapshot().context.currentTempo).toBe(140);
      actor.stop();
    });

    it('should update tempo during playback', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Set tempo during playback
      actor.send({ type: 'SET_TEMPO', bpm: 160 });

      expect(actor.getSnapshot().context.currentTempo).toBe(160);
      expect(actor.getSnapshot().value).toBe('playing');
      actor.stop();
    });
  });

  describe('Countdown Configuration', () => {
    it('should update countdown settings', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Set countdown
      actor.send({ type: 'SET_COUNTDOWN', beats: 8, enabled: true });

      expect(actor.getSnapshot().context.countdownBeats).toBe(8);
      expect(actor.getSnapshot().context.countdownEnabled).toBe(true);
      actor.stop();
    });
  });

  describe('Restart from Stopped', () => {
    it('should allow START from stopped state', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Stop
      actor.send({ type: 'STOP' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify stopped
      expect(actor.getSnapshot().value).toBe('stopped');

      // Start again
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(actor.getSnapshot().value).toBe('playing');
      actor.stop();
    });

    it('should use FORCE_READY to transition from stopped to ready', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Start -> Stop -> Force Ready
      actor.send({ type: 'START' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      actor.send({ type: 'STOP' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      actor.send({ type: 'FORCE_READY' });

      expect(actor.getSnapshot().value).toBe('ready');
      actor.stop();
    });
  });

  describe('Dispose Flow', () => {
    it('should transition to disposing on DISPOSE from ready', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify ready
      expect(actor.getSnapshot().value).toBe('ready');

      // Dispose
      actor.send({ type: 'DISPOSE' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // After disposing completes, should be back in idle
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.audioContext).toBeNull();

      actor.stop();
    });

    it('should reset context after dispose', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const testTrack = createTestTrack();

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize and set up some state
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      actor.send({ type: 'REGISTER_TRACK', track: testTrack });
      actor.send({ type: 'SET_TEMPO', bpm: 180 });

      // Verify state was set
      expect(actor.getSnapshot().context.tracks.size).toBe(1);
      expect(actor.getSnapshot().context.currentTempo).toBe(180);

      // Dispose
      actor.send({ type: 'DISPOSE' });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Context should be reset
      expect(actor.getSnapshot().context.audioContext).toBeNull();
      expect(actor.getSnapshot().context.tracks.size).toBe(0);

      actor.stop();
    });
  });

  describe('Guard Conditions', () => {
    it('should not allow START from idle (no audio context)', () => {
      const actor = createActor(playbackMachine);
      actor.start();

      // Try to start without initializing
      actor.send({ type: 'START' });

      // Should still be in idle
      expect(actor.getSnapshot().value).toBe('idle');

      actor.stop();
    });

    it('should not allow PAUSE from non-playing state', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const snapshot = await runMachineWithEvents(
        playbackMachine,
        [
          {
            type: 'INITIALIZE',
            audioContext: mockAudioContext,
            audioDestination: mockDestination,
          },
          { type: 'PAUSE' }, // Should be ignored in ready state
        ],
        { timeout: 500 }
      );

      // Should still be in ready (PAUSE ignored)
      expect(snapshot.value).toBe('ready');
    });
  });

  describe('Harmony Instrument', () => {
    it('should track current harmony instrument', async () => {
      const mockAudioContext = createMockAudioContext();
      const mockDestination = createMockAudioDestination();

      const harmonyTrack = createTestTrack({ id: 'harmony-1', instrumentType: 'harmony' });

      const actor = createActor(playbackMachine);
      actor.start();

      // Initialize
      actor.send({
        type: 'INITIALIZE',
        audioContext: mockAudioContext,
        audioDestination: mockDestination,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Update tracks with harmony instrument
      actor.send({ type: 'UPDATE_TRACKS', tracks: [harmonyTrack], harmonyInstrument: 'wurlitzer' });

      expect(actor.getSnapshot().context.currentHarmonyInstrument).toBe('wurlitzer');

      actor.stop();
    });
  });
});

// ============================================================================
// Event Bus Integration Tests
// ============================================================================

describe('PlaybackMachine EventBus Integration', () => {
  it('should emit events via EventBus when provided', async () => {
    const mockEventBus = createMockEventBus();
    const emittedEvents: string[] = [];

    // Listen to events
    mockEventBus.on('playback:state-change', () => emittedEvents.push('state-change'));
    mockEventBus.on('playback:starting', () => emittedEvents.push('starting'));
    mockEventBus.on('playback:start', () => emittedEvents.push('start'));
    mockEventBus.on('playback:stop', () => emittedEvents.push('stop'));

    const mockAudioContext = createMockAudioContext();
    const mockDestination = createMockAudioDestination();

    const actor = createActor(playbackMachine, {
      input: { eventBus: mockEventBus as any },
    });
    actor.start();

    actor.send({
      type: 'INITIALIZE',
      audioContext: mockAudioContext,
      audioDestination: mockDestination,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    actor.send({ type: 'START' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    actor.send({ type: 'STOP' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    actor.stop();

    // Verify events were emitted (exact order may vary due to async)
    expect(emittedEvents).toContain('state-change');
  });
});
