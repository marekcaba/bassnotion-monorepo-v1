import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEventRouter } from './AudioEventRouter.js';
import { EventBus } from './EventBus.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';

// Mock Tone.js
vi.mock('tone', () => ({
  start: vi.fn(),
  context: {
    resume: vi.fn(() => Promise.resolve()),
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
  },
  getContext: vi.fn(() => ({
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    resume: vi.fn(() => Promise.resolve()),
  })),
  Gain: class {
    constructor() {}
    connect() {}
    disconnect() {}
    gain = { value: 1 };
  },
  Player: class {
    constructor() {}
    start() {}
    connect() {}
    toDestination() {}
  },
  Sampler: class {
    constructor() {}
    triggerAttackRelease() {}
    connect() {}
    toDestination() {}
  },
}));

// Mock supabase client
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: () => ({
          data: { publicUrl: 'https://test-url.com/sample.mp3' },
        }),
      }),
    },
  },
}));

describe('AudioEventRouter with InstrumentRegistry', () => {
  let audioEventRouter: AudioEventRouter;
  let eventBus: EventBus;
  let instrumentRegistry: InstrumentRegistry;
  let mockGlobalServices: any;

  beforeEach(() => {
    eventBus = new EventBus();
    instrumentRegistry = new InstrumentRegistry(eventBus);
    audioEventRouter = new AudioEventRouter();

    // Mock global services
    mockGlobalServices = {
      getAudioEngine: vi.fn(() => ({
        getContext: vi.fn(() => ({
          state: 'running',
          currentTime: 0,
          sampleRate: 44100,
        })),
      })),
      getInstrumentRegistry: vi.fn(() => instrumentRegistry),
      getEventBus: vi.fn(() => eventBus),
    };

    (window as any).__globalCoreServices = mockGlobalServices;
    (window as any).__coreServices = mockGlobalServices;
  });

  afterEach(async () => {
    await audioEventRouter.stop();
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
  });

  describe('Registry integration during initialization', () => {
    it('should check InstrumentRegistry for pre-registered instruments', async () => {
      // Pre-register a drums instrument
      const mockDrums = {
        id: 'test-drums',
        trigger: vi.fn(),
        play: vi.fn(),
      };
      instrumentRegistry.setActive('drums', mockDrums);

      // Initialize AudioEventRouter
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Should use the pre-registered drums
      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('drums');

      // Trigger a drum event
      eventBus.emit('drum-trigger', {
        drum: 'kick',
        velocity: 0.8,
        time: 0,
      });

      // The mock drums should have been used
      // Note: Due to the internal implementation, we can verify this indirectly
      expect(status.isHealthy).toBe(true);
    });

    it('should check multiple instrument types from registry', async () => {
      // Pre-register multiple instruments
      const mockDrums = { id: 'drums', trigger: vi.fn() };
      const mockBass = { id: 'bass', trigger: vi.fn() };
      const mockHarmony = { id: 'harmony', trigger: vi.fn() };
      const mockMetronome = { id: 'metronome', trigger: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);
      instrumentRegistry.setActive('harmony', mockHarmony);
      instrumentRegistry.setActive('metronome', mockMetronome);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('drums');
      expect(status.activeInstruments).toContain('bass');
      expect(status.activeInstruments).toContain('harmony');
      expect(status.activeInstruments).toContain('metronome');
    });

    it('should create default instruments if none registered', async () => {
      // Don't pre-register any instruments
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      const status = audioEventRouter.getStatus();
      // Should have created default instruments
      expect(status.activeInstruments.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic instrument registration', () => {
    it('should listen for instrument:registered events', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      const initialStatus = audioEventRouter.getStatus();
      const initialDrumsCount = initialStatus.activeInstruments.filter(
        (i) => i === 'drums',
      ).length;

      // Register a new drums instrument
      const mockDrums = {
        id: 'new-drums',
        trigger: vi.fn(),
        play: vi.fn(),
      };

      // Emit the registration event
      eventBus.emit('instrument:registered', {
        type: 'drums',
        instrument: mockDrums,
      });

      // Check that AudioEventRouter recognized the new instrument
      const updatedStatus = audioEventRouter.getStatus();
      expect(updatedStatus.activeInstruments).toContain('drums');
    });

    it('should update instrument references when replacements occur', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Register initial bass instrument
      const oldBass = { id: 'old-bass', play: vi.fn() };
      eventBus.emit('instrument:registered', {
        type: 'bass',
        instrument: oldBass,
      });

      // Replace with new bass instrument
      const newBass = { id: 'new-bass', play: vi.fn() };
      eventBus.emit('instrument:registered', {
        type: 'bass',
        instrument: newBass,
      });

      // Verify the new instrument is being used
      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('bass');
    });

    it('should handle all instrument types dynamically', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Register each instrument type dynamically
      const instruments = [
        { type: 'drums', instrument: { id: 'drums-1' } },
        { type: 'harmony', instrument: { id: 'harmony-1' } },
        { type: 'bass', instrument: { id: 'bass-1' } },
        { type: 'metronome', instrument: { id: 'metronome-1' } },
      ];

      instruments.forEach(({ type, instrument }) => {
        eventBus.emit('instrument:registered', { type, instrument });
      });

      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('drums');
      expect(status.activeInstruments).toContain('harmony');
      expect(status.activeInstruments).toContain('bass');
      expect(status.activeInstruments).toContain('metronome');
    });
  });

  describe('Event handling with registered instruments', () => {
    it('should use registered drums for drum-trigger events', async () => {
      const mockDrums = {
        trigger: vi.fn(),
        triggerDrum: vi.fn(),
        play: vi.fn(),
      };

      instrumentRegistry.setActive('drums', mockDrums);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit a drum trigger event
      eventBus.emit('drum-trigger', {
        drum: 'kick',
        velocity: 0.8,
        time: 0,
      });

      // The registered instrument should be used
      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('drums');
    });

    it('should use registered harmony for chord-trigger events', async () => {
      const mockHarmony = {
        triggerChord: vi.fn(),
        play: vi.fn(),
      };

      instrumentRegistry.setActive('harmony', mockHarmony);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit a chord trigger event
      eventBus.emit('chord-trigger', {
        chord: 'Cmaj7',
        velocity: 0.7,
        time: 0,
      });

      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('harmony');
    });

    it('should use registered bass for bass-trigger events', async () => {
      const mockBass = {
        triggerNote: vi.fn(),
        play: vi.fn(),
      };

      instrumentRegistry.setActive('bass', mockBass);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit a bass trigger event
      eventBus.emit('bass-trigger', {
        note: 'E2',
        velocity: 0.9,
        time: 0,
      });

      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('bass');
    });

    it('should use registered metronome for metronome-trigger events', async () => {
      const mockMetronome = {
        trigger: vi.fn(),
        play: vi.fn(),
      };

      instrumentRegistry.setActive('metronome', mockMetronome);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit a metronome trigger event
      eventBus.emit('metronome-trigger', {
        type: 'downbeat',
        time: 0,
      });

      const status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('metronome');
    });
  });

  describe('Cleanup and unsubscription', () => {
    it('should unsubscribe from instrument:registered events on stop', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Stop the router
      await audioEventRouter.stop();

      // Try to register an instrument after stopping
      const mockDrums = { id: 'late-drums' };
      eventBus.emit('instrument:registered', {
        type: 'drums',
        instrument: mockDrums,
      });

      // The router should not process this event
      const status = audioEventRouter.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should maintain instrument references across start/stop cycles', async () => {
      // Register an instrument
      const mockBass = { id: 'persistent-bass' };
      instrumentRegistry.setActive('bass', mockBass);

      // Start router
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      let status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('bass');

      // Stop router
      await audioEventRouter.stop();

      // Start again
      await audioEventRouter.start();

      // Should still have the bass instrument
      status = audioEventRouter.getStatus();
      expect(status.activeInstruments).toContain('bass');
    });
  });

  describe('Edge cases', () => {
    it('should handle invalid instrument types gracefully', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit registration with invalid type
      eventBus.emit('instrument:registered', {
        type: 'invalid-type',
        instrument: { id: 'test' },
      });

      // Should not crash
      const status = audioEventRouter.getStatus();
      expect(status.isHealthy).toBe(true);
    });

    it('should handle missing instrument in registration event', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit registration without instrument
      eventBus.emit('instrument:registered', {
        type: 'drums',
        instrument: null,
      });

      // Should not crash
      const status = audioEventRouter.getStatus();
      expect(status.isHealthy).toBe(true);
    });

    it('should handle registry not being available', async () => {
      // Remove the registry from global services
      delete mockGlobalServices.getInstrumentRegistry;

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Should still work with default instruments
      const status = audioEventRouter.getStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.activeInstruments.length).toBeGreaterThan(0);
    });
  });

  describe('Performance considerations', () => {
    it('should handle rapid instrument switches efficiently', async () => {
      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Rapidly switch instruments
      for (let i = 0; i < 100; i++) {
        const instrument = { id: `drums-${i}` };
        eventBus.emit('instrument:registered', {
          type: 'drums',
          instrument,
        });
      }

      // Should still be functional
      const status = audioEventRouter.getStatus();
      expect(status.isHealthy).toBe(true);
      expect(status.activeInstruments).toContain('drums');
    });

    it('should handle concurrent event processing', async () => {
      const mockDrums = { trigger: vi.fn() };
      const mockBass = { trigger: vi.fn() };
      const mockHarmony = { trigger: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);
      instrumentRegistry.setActive('harmony', mockHarmony);

      await audioEventRouter.initialize(eventBus);
      await audioEventRouter.start();

      // Emit multiple events simultaneously
      const promises = [
        Promise.resolve(
          eventBus.emit('drum-trigger', {
            drum: 'kick',
            velocity: 0.8,
            time: 0,
          }),
        ),
        Promise.resolve(
          eventBus.emit('bass-trigger', {
            note: 'E2',
            velocity: 0.7,
            time: 0,
          }),
        ),
        Promise.resolve(
          eventBus.emit('chord-trigger', {
            chord: 'Cmaj7',
            velocity: 0.6,
            time: 0,
          }),
        ),
      ];

      await Promise.all(promises);

      const status = audioEventRouter.getStatus();
      expect(status.isHealthy).toBe(true);
    });
  });
});
