/**
 * DAW Integration Tests
 * Story 3.22: Professional DAW Sequencer
 *
 * Tests the complete flow from UnifiedTransport → PatternScheduler → EventBus → AudioEventRouter → Instruments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedTransport } from '../UnifiedTransport.js';
import { PatternScheduler } from '../PatternScheduler.js';
import { EventBus } from '../EventBus.js';
import { AudioEventRouter } from '../AudioEventRouter.js';
import {
  ServiceRegistry,
  setGlobalServiceRegistry,
} from '../ServiceRegistry.js';
import { Track } from '../Track.js';
import { toMusicalPosition } from '../../../types/pattern.js';
import type { Region } from '../../../types/region.js';
import type {
  DrumPattern,
  MetronomePattern,
  Pattern,
} from '../../../types/pattern.js';

// Mock Tone.js
vi.mock('tone', () => ({
  default: {
    start: vi.fn().mockResolvedValue(undefined),
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      schedule: vi.fn(),
      scheduleRepeat: vi.fn(),
      clear: vi.fn(),
      cancel: vi.fn(),
      state: 'stopped',
      position: 0,
      seconds: 0,
      bpm: { value: 120 },
      timeSignature: [4, 4],
      PPQ: 192,
    },
    context: {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
    },
    Gain: vi.fn(() => ({
      connect: vi.fn(),
      gain: { value: 1 },
    })),
    getContext: vi.fn(() => ({
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
    })),
  },
}));

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  sampleRate: 48000,
  currentTime: 0,
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 },
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
  })),
  destination: {},
};

// Mock AudioEngine
const mockAudioEngine = {
  initialize: vi.fn().mockResolvedValue(undefined),
  preInitialize: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn().mockResolvedValue(undefined),
  restart: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn(() => mockAudioContext),
  getConfig: vi.fn(() => ({})),
  healthCheck: vi.fn().mockResolvedValue({
    status: 'healthy',
    message: 'AudioEngine operating normally',
    details: { contextState: 'running' },
  }),
};

describe('DAW Integration Tests', () => {
  let serviceRegistry: ServiceRegistry;
  let eventBus: EventBus;
  let transport: UnifiedTransport;
  let scheduler: PatternScheduler;
  let audioRouter: AudioEventRouter;
  let capturedEvents: any[] = [];

  beforeEach(async () => {
    // Create new service registry for each test
    serviceRegistry = new ServiceRegistry();
    setGlobalServiceRegistry(serviceRegistry);
    capturedEvents = [];

    // Create services
    eventBus = new EventBus();
    transport = UnifiedTransport.getInstance(eventBus, mockAudioEngine as any);
    scheduler = new PatternScheduler();
    audioRouter = new AudioEventRouter();

    // Register services
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('audioEngine', mockAudioEngine as any);
    serviceRegistry.register('unifiedTransport', transport);
    serviceRegistry.register('patternScheduler', scheduler);
    serviceRegistry.register('audioEventRouter', audioRouter);

    // Initialize services
    await serviceRegistry.initialize();

    // Capture all trigger events
    const triggerTypes = [
      'drum-trigger',
      'metronome-trigger',
      'chord-trigger',
      'bass-trigger',
    ];
    triggerTypes.forEach((eventType) => {
      eventBus.on(eventType, (data: any) => {
        capturedEvents.push({ type: eventType, data, timestamp: Date.now() });
      });
    });
  });

  afterEach(async () => {
    await serviceRegistry.dispose();
    vi.clearAllMocks();
  });

  describe('Complete DAW Flow', () => {
    it('should trigger audio events when transport plays a pattern', async () => {
      // Create a metronome track with pattern
      const metronomeTrack = new Track({
        id: 'test-metronome',
        name: 'Test Metronome',
        type: 'metronome',
      });

      const metronomePattern: MetronomePattern = {
        type: 'metronome',
        events: [
          { position: toMusicalPosition(0, 0, 0), type: 'accent' },
          { position: toMusicalPosition(0, 1, 0), type: 'click' },
          { position: toMusicalPosition(0, 2, 0), type: 'click' },
          { position: toMusicalPosition(0, 3, 0), type: 'click' },
        ],
      };

      const metronomeRegion = metronomeTrack.createRegionFromPattern(
        metronomePattern,
        {
          name: 'Test Metronome Region',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0, // Infinite loop
        },
      );

      // Register track with scheduler
      scheduler.registerTrack(metronomeTrack.id, metronomeTrack.getRegions());

      // Start transport
      await transport.start();

      // Wait for events to be scheduled and triggered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify metronome events were triggered
      const metronomeEvents = capturedEvents.filter(
        (e) => e.type === 'metronome-trigger',
      );
      expect(metronomeEvents.length).toBeGreaterThan(0);
      expect(metronomeEvents[0].data).toMatchObject({
        type: expect.stringMatching(/accent|click/),
        audioTime: expect.any(Number),
        timestamp: expect.any(Number),
      });

      // Stop transport
      await transport.stop();
    });

    it('should trigger drum events with correct timing', async () => {
      // Create a drum track with pattern
      const drumTrack = new Track({
        id: 'test-drums',
        name: 'Test Drums',
        type: 'drums',
      });

      const drumPattern: DrumPattern = {
        type: 'drums',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            drum: 'kick',
            velocity: 1.0,
            duration: '8n',
          },
          {
            position: toMusicalPosition(0, 1, 0),
            drum: 'snare',
            velocity: 0.8,
            duration: '8n',
          },
          {
            position: toMusicalPosition(0, 2, 0),
            drum: 'kick',
            velocity: 1.0,
            duration: '8n',
          },
          {
            position: toMusicalPosition(0, 3, 0),
            drum: 'snare',
            velocity: 0.8,
            duration: '8n',
          },
        ],
      };

      const drumRegion = drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Test Drum Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 1, // Play once
      });

      // Register track with scheduler
      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      // Start transport
      await transport.start();

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify drum events
      const drumEvents = capturedEvents.filter(
        (e) => e.type === 'drum-trigger',
      );
      expect(drumEvents.length).toBeGreaterThanOrEqual(4);

      // Check kick drums
      const kickEvents = drumEvents.filter((e) => e.data.drum === 'kick');
      expect(kickEvents.length).toBeGreaterThanOrEqual(2);
      expect(kickEvents[0].data.velocity).toBe(1.0);

      // Check snare drums
      const snareEvents = drumEvents.filter((e) => e.data.drum === 'snare');
      expect(snareEvents.length).toBeGreaterThanOrEqual(2);
      expect(snareEvents[0].data.velocity).toBe(0.8);

      await transport.stop();
    });

    it('should handle transport state changes correctly', async () => {
      const stateChanges: string[] = [];

      eventBus.on('transport:start', () => stateChanges.push('start'));
      eventBus.on('transport:stop', () => stateChanges.push('stop'));
      eventBus.on('transport:pause', () => stateChanges.push('pause'));

      // Test state transitions
      await transport.start();
      expect(transport.getState()).toBe('playing');

      await transport.pause();
      expect(transport.getState()).toBe('paused');

      await transport.start();
      expect(transport.getState()).toBe('playing');

      await transport.stop();
      expect(transport.getState()).toBe('stopped');

      // Verify events were emitted
      expect(stateChanges).toContain('start');
      expect(stateChanges).toContain('pause');
      expect(stateChanges).toContain('stop');
    });

    it('should synchronize multiple tracks', async () => {
      // Create metronome track
      const metronomeTrack = new Track({
        id: 'sync-metronome',
        name: 'Sync Metronome',
        type: 'metronome',
      });

      const metronomePattern: MetronomePattern = {
        type: 'metronome',
        events: [
          { position: toMusicalPosition(0, 0, 0), type: 'accent' },
          { position: toMusicalPosition(0, 2, 0), type: 'click' },
        ],
      };

      metronomeTrack.createRegionFromPattern(metronomePattern, {
        name: 'Sync Metronome Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 0,
      });

      // Create drum track
      const drumTrack = new Track({
        id: 'sync-drums',
        name: 'Sync Drums',
        type: 'drums',
      });

      const drumPattern: DrumPattern = {
        type: 'drums',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            drum: 'kick',
            velocity: 1.0,
            duration: '4n',
          },
          {
            position: toMusicalPosition(0, 2, 0),
            drum: 'snare',
            velocity: 0.8,
            duration: '4n',
          },
        ],
      };

      drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Sync Drum Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 0,
      });

      // Register both tracks
      scheduler.registerTrack(metronomeTrack.id, metronomeTrack.getRegions());
      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      // Start transport
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Check that events from both tracks were triggered
      const metronomeEvents = capturedEvents.filter(
        (e) => e.type === 'metronome-trigger',
      );
      const drumEvents = capturedEvents.filter(
        (e) => e.type === 'drum-trigger',
      );

      expect(metronomeEvents.length).toBeGreaterThan(0);
      expect(drumEvents.length).toBeGreaterThan(0);

      // Verify timing alignment (events at position 0,0,0 should be close in time)
      const firstMetronome = metronomeEvents[0];
      const firstDrum = drumEvents.find((e) => e.data.drum === 'kick');

      if (firstMetronome && firstDrum) {
        const timeDiff = Math.abs(
          firstMetronome.data.audioTime - firstDrum.data.audioTime,
        );
        expect(timeDiff).toBeLessThan(0.01); // Within 10ms
      }

      await transport.stop();
    });

    it('should handle region looping correctly', async () => {
      const drumTrack = new Track({
        id: 'loop-drums',
        name: 'Loop Drums',
        type: 'drums',
      });

      const drumPattern: DrumPattern = {
        type: 'drums',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            drum: 'kick',
            velocity: 1.0,
            duration: '4n',
          },
        ],
      };

      // Create a region that loops 3 times
      drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Loop Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(0, 1, 0), // 1 beat
        loopCount: 3,
      });

      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const kickEvents = capturedEvents.filter(
        (e) => e.type === 'drum-trigger' && e.data.drum === 'kick',
      );

      // Should have exactly 3 kick events (one per loop)
      expect(kickEvents.length).toBe(3);

      await transport.stop();
    });

    it('should route events to AudioEventRouter', async () => {
      // Verify router is initialized
      const health = await audioRouter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.isInitialized).toBe(true);
      expect(health.details.activeInstruments).toContain('metronome');
      expect(health.details.activeInstruments).toContain('drums');

      // Create and play a pattern
      const drumTrack = new Track({
        id: 'router-test',
        name: 'Router Test',
        type: 'drums',
      });

      const drumPattern: DrumPattern = {
        type: 'drums',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            drum: 'kick',
            velocity: 1.0,
            duration: '4n',
          },
        ],
      };

      drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Router Test Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(0, 1, 0),
        loopCount: 1,
      });

      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      // Start router
      await audioRouter.start();
      expect(audioRouter.getConfig().isRunning).toBe(true);

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify events were captured
      const drumEvents = capturedEvents.filter(
        (e) => e.type === 'drum-trigger',
      );
      expect(drumEvents.length).toBeGreaterThan(0);

      await transport.stop();
      await audioRouter.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tracks gracefully', async () => {
      // Try to register a non-existent track
      scheduler.registerTrack('non-existent', []);

      // Should not throw when starting
      await expect(transport.start()).resolves.not.toThrow();
      await transport.stop();
    });

    it('should handle invalid patterns gracefully', async () => {
      const track = new Track({
        id: 'invalid-track',
        name: 'Invalid Track',
        type: 'drums',
      });

      // Add region with invalid pattern
      const invalidRegion = track.createRegionFromPattern(
        { type: 'invalid' as any, events: [] },
        {
          name: 'Invalid Region',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 1,
        },
      );
      scheduler.registerTrack(track.id, track.getRegions());

      // Should not throw
      await expect(transport.start()).resolves.not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await transport.stop();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency events efficiently', async () => {
      const drumTrack = new Track({
        id: 'perf-drums',
        name: 'Performance Drums',
        type: 'drums',
      });

      // Create a pattern with many events (16th note hi-hats)
      const events = [];
      for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
        events.push({
          position: toMusicalPosition(
            0,
            Math.floor(sixteenth / 4),
            sixteenth % 4,
          ),
          drum: 'hihat',
          velocity: 0.6,
          duration: '16n',
        });
      }

      const drumPattern: DrumPattern = {
        type: 'drums',
        events,
      };

      drumTrack.createRegionFromPattern(drumPattern, {
        name: 'Performance Region',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 1,
      });

      scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());

      const startTime = Date.now();
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await transport.stop();
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(300);

      // Should have triggered all events
      const hihatEvents = capturedEvents.filter(
        (e) => e.type === 'drum-trigger' && e.data.drum === 'hihat',
      );
      expect(hihatEvents.length).toBe(16);
    });
  });
});
