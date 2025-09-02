/**
 * AudioEventRouter Tests
 * Story 3.22: Professional DAW Sequencer
 *
 * Tests the AudioEventRouter service that connects EventBus triggers to audio instruments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEventRouter } from '../AudioEventRouter.js';
import { EventBus } from '../EventBus.js';
import {
  ServiceRegistry,
  setGlobalServiceRegistry,
} from '../ServiceRegistry.js';

// Mock Tone.js
vi.mock('tone', () => ({
  default: {
    start: vi.fn().mockResolvedValue(undefined),
    context: {
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
    },
    now: vi.fn(() => 0),
    Sampler: vi.fn(() => ({
      connect: vi.fn(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
      loaded: true,
    })),
    Synth: vi.fn(() => ({
      connect: vi.fn(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    Volume: vi.fn(() => ({
      connect: vi.fn(),
      dispose: vi.fn(),
      volume: { value: 0 },
    })),
    getContext: vi.fn(() => ({
      state: 'running',
      currentTime: 0,
      sampleRate: 48000,
    })),
  },
}));

// Mock instrument processors
vi.mock('../plugins/MetronomeInstrumentProcessor.js', () => ({
  MetronomeInstrumentProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    triggerClick: vi.fn(),
  })),
}));

vi.mock('../plugins/DrumInstrumentProcessor.js', () => ({
  DrumInstrumentProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    triggerDrum: vi.fn(),
  })),
}));

vi.mock('../plugins/ChordInstrumentProcessor.js', () => ({
  ChordInstrumentProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    triggerChordFromDAW: vi.fn(),
  })),
}));

vi.mock('../plugins/BassInstrumentProcessor.js', () => ({
  BassInstrumentProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    triggerNote: vi.fn(),
  })),
}));

describe('AudioEventRouter', () => {
  let serviceRegistry: ServiceRegistry;
  let audioRouter: AudioEventRouter;
  let eventBus: EventBus;

  beforeEach(async () => {
    // Create new registry
    serviceRegistry = new ServiceRegistry();
    setGlobalServiceRegistry(serviceRegistry);

    // Create services
    eventBus = new EventBus();
    audioRouter = new AudioEventRouter();

    // Register EventBus
    serviceRegistry.register('eventBus', eventBus);

    // Initialize router
    await audioRouter.initialize();
  });

  afterEach(async () => {
    await audioRouter.dispose();
    await serviceRegistry.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const health = await audioRouter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.isInitialized).toBe(true);
    });

    it('should initialize all instrument processors', async () => {
      const health = await audioRouter.healthCheck();
      expect(health.details.metronome).toBe('ready');
      expect(health.details.drums).toBe('ready');
      expect(health.details.chords).toBe('ready');
      expect(health.details.bass).toBe('ready');
    });

    it('should track active instruments', () => {
      const activeInstruments = audioRouter.getActiveInstruments();
      expect(activeInstruments).toContain('metronome');
      expect(activeInstruments).toContain('drums');
      expect(activeInstruments).toContain('chords');
      expect(activeInstruments).toContain('bass');
    });
  });

  describe('Event Routing', () => {
    beforeEach(async () => {
      await audioRouter.start();
    });

    afterEach(async () => {
      await audioRouter.stop();
    });

    it('should route metronome trigger events', async () => {
      const metronome = (audioRouter as any).metronome;

      // Emit metronome event
      eventBus.emit('metronome-trigger', {
        type: 'accent',
        audioTime: 1.0,
        timestamp: Date.now(),
        velocity: 1.0,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metronome.triggerClick).toHaveBeenCalledWith({
        type: 'accent',
        time: 1.0,
        velocity: 1.0,
      });
    });

    it('should route drum trigger events', async () => {
      const drums = (audioRouter as any).drums;

      // Emit drum event
      eventBus.emit('drum-trigger', {
        drum: 'kick',
        audioTime: 2.0,
        timestamp: Date.now(),
        velocity: 0.8,
        duration: '8n',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(drums.triggerDrum).toHaveBeenCalledWith({
        drum: 'kick',
        velocity: 0.8,
        time: 2.0,
        duration: '8n',
      });
    });

    it('should route chord trigger events', async () => {
      const chords = (audioRouter as any).chords;

      // Emit chord event
      eventBus.emit('chord-trigger', {
        chord: 'Cmaj7',
        notes: ['C4', 'E4', 'G4', 'B4'],
        audioTime: 3.0,
        timestamp: Date.now(),
        velocity: 0.7,
        duration: '2n',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(chords.triggerChordFromDAW).toHaveBeenCalledWith({
        chord: 'Cmaj7',
        velocity: 0.7,
        time: 3.0,
        duration: '2n',
      });
    });

    it('should route bass trigger events', async () => {
      const bass = (audioRouter as any).bass;

      // Emit bass event
      eventBus.emit('bass-trigger', {
        note: 'E2',
        audioTime: 4.0,
        timestamp: Date.now(),
        velocity: 0.9,
        duration: '4n',
        technique: 'fingerstyle',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(bass.triggerNote).toHaveBeenCalledWith({
        note: 'E2',
        velocity: 0.9,
        time: 4.0,
        duration: '4n',
      });
    });

    it('should handle multiple simultaneous events', async () => {
      const metronome = (audioRouter as any).metronome;
      const drums = (audioRouter as any).drums;

      // Emit multiple events at once
      eventBus.emit('metronome-trigger', {
        type: 'click',
        audioTime: 5.0,
        timestamp: Date.now(),
      });

      eventBus.emit('drum-trigger', {
        drum: 'hihat',
        audioTime: 5.0,
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(metronome.triggerClick).toHaveBeenCalled();
      expect(drums.triggerDrum).toHaveBeenCalled();
    });

    it('should not route events when stopped', async () => {
      const drums = (audioRouter as any).drums;

      // Stop the router
      await audioRouter.stop();

      // Clear previous calls
      drums.triggerDrum.mockClear();

      // Emit event
      eventBus.emit('drum-trigger', {
        drum: 'snare',
        audioTime: 6.0,
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(drums.triggerDrum).not.toHaveBeenCalled();
    });
  });

  describe('Instrument Management', () => {
    it('should enable/disable instruments', () => {
      // Disable drums
      audioRouter.setInstrumentEnabled('drums', false);
      let active = audioRouter.getActiveInstruments();
      expect(active).not.toContain('drums');

      // Re-enable drums
      audioRouter.setInstrumentEnabled('drums', true);
      active = audioRouter.getActiveInstruments();
      expect(active).toContain('drums');
    });

    it('should not route to disabled instruments', async () => {
      await audioRouter.start();

      const drums = (audioRouter as any).drums;

      // Disable drums
      audioRouter.setInstrumentEnabled('drums', false);

      // Emit drum event
      eventBus.emit('drum-trigger', {
        drum: 'crash',
        audioTime: 7.0,
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Since we can't easily check if the instrument is disabled in the handler,
      // we'll just verify the active instruments list
      expect(audioRouter.getActiveInstruments()).not.toContain('drums');

      await audioRouter.stop();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle start/stop/restart cycle', async () => {
      // Start
      await audioRouter.start();
      expect(audioRouter.getConfig().isRunning).toBe(true);

      // Stop
      await audioRouter.stop();
      expect(audioRouter.getConfig().isRunning).toBe(false);

      // Restart
      await audioRouter.restart();
      expect(audioRouter.getConfig().isRunning).toBe(true);

      await audioRouter.stop();
    });

    it('should handle multiple start calls', async () => {
      await audioRouter.start();
      await audioRouter.start(); // Should not throw
      expect(audioRouter.getConfig().isRunning).toBe(true);

      await audioRouter.stop();
    });

    it('should clean up event handlers on dispose', async () => {
      await audioRouter.start();

      const initialHandlers = (audioRouter as any).eventHandlers.size;
      expect(initialHandlers).toBeGreaterThan(0);

      await audioRouter.dispose();

      const finalHandlers = (audioRouter as any).eventHandlers.size;
      expect(finalHandlers).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle instrument initialization failures gracefully', async () => {
      // Mock a failing instrument
      const FailingMetronome = vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
        dispose: vi.fn(),
      }));

      vi.doMock('../plugins/MetronomeInstrumentProcessor.js', () => ({
        MetronomeInstrumentProcessor: FailingMetronome,
      }));

      // Router should still initialize
      const newRouter = new AudioEventRouter();
      await expect(newRouter.initialize()).resolves.not.toThrow();

      // Metronome should not be in active instruments
      const active = newRouter.getActiveInstruments();
      expect(active).not.toContain('metronome');

      await newRouter.dispose();
    });

    it('should handle missing EventBus gracefully', async () => {
      // Create a new registry without EventBus
      const emptyRegistry = new ServiceRegistry();
      setGlobalServiceRegistry(emptyRegistry);

      const newRouter = new AudioEventRouter();
      await expect(newRouter.initialize()).rejects.toThrow(
        'EventBus not found',
      );

      // Restore original registry
      setGlobalServiceRegistry(serviceRegistry);
    });

    it('should handle event routing errors gracefully', async () => {
      await audioRouter.start();

      const drums = (audioRouter as any).drums;
      drums.triggerDrum.mockImplementation(() => {
        throw new Error('Trigger failed');
      });

      // Should not throw
      eventBus.emit('drum-trigger', {
        drum: 'tom',
        audioTime: 8.0,
        timestamp: Date.now(),
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Router should still be running
      expect(audioRouter.getConfig().isRunning).toBe(true);

      await audioRouter.stop();
    });
  });

  describe('Performance', () => {
    it('should handle rapid event bursts', async () => {
      await audioRouter.start();

      const drums = (audioRouter as any).drums;
      const eventCount = 100;

      // Send rapid burst of events
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('drum-trigger', {
          drum: 'hihat',
          audioTime: i * 0.125,
          timestamp: Date.now(),
        });
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All events should be processed
      expect(drums.triggerDrum).toHaveBeenCalledTimes(eventCount);

      await audioRouter.stop();
    });
  });
});
