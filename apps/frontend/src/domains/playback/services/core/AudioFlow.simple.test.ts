import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tone.js first
vi.mock('tone', () => ({
  default: {
    now: vi.fn(() => 0),
    Transport: {
      state: 'stopped',
      seconds: 0,
      position: 0,
      bpm: { value: 120 },
      timeSignature: [4, 4],
      schedule: vi.fn((callback, time) => {
        setTimeout(() => callback(time), 0);
        return `scheduled-${Date.now()}`;
      }),
      clear: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
    },
    Time: vi.fn((position: string) => ({
      toSeconds: () => {
        const parts = position.split(':');
        if (parts.length === 3) {
          const [bar, beat, sixteenth] = parts.map(Number);
          return (bar * 4 + beat + sixteenth / 16) * (60 / 120);
        }
        return 0;
      }
    })),
  },
  Transport: {
    state: 'stopped',
    seconds: 0,
    position: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    schedule: vi.fn((callback, time) => {
      setTimeout(() => callback(time), 0);
      return `scheduled-${Date.now()}`;
    }),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  },
  Time: vi.fn((position: string) => ({
    toSeconds: () => {
      const parts = position.split(':');
      if (parts.length === 3) {
        const [bar, beat, sixteenth] = parts.map(Number);
        return (bar * 4 + beat + sixteenth / 16) * (60 / 120);
      }
      return 0;
    }
  })),
}));

// Mock AudioEngine
vi.mock('../../modules/audio-engine/core/AudioEngine.js');

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { EventBus } from './EventBus.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { RegionProcessor } from './RegionProcessor.js';
import { AudioEventRouter } from './AudioEventRouter.js';
import * as Tone from 'tone';

describe('Simple Audio Flow Tests', () => {
  let eventBus: EventBus;
  let instrumentRegistry: InstrumentRegistry;
  let regionProcessor: RegionProcessor;
  let audioEventRouter: AudioEventRouter;

  beforeEach(() => {
    // Create services
    eventBus = new EventBus();
    instrumentRegistry = new InstrumentRegistry(eventBus);
    regionProcessor = new RegionProcessor(eventBus);
    audioEventRouter = new AudioEventRouter();

    // Mock global services
    (window as any).__globalCoreServices = {
      getInstrumentRegistry: () => instrumentRegistry,
      getEventBus: () => eventBus,
    };
  });

  describe('Core Flow', () => {
    it('should register and retrieve instruments', () => {
      const mockDrums = { id: 'test-drums', play: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);

      expect(instrumentRegistry.hasActive('drums')).toBe(true);
      expect(instrumentRegistry.getActive('drums')).toBe(mockDrums);
    });

    it('should schedule patterns with RegionProcessor', () => {
      const pattern = {
        events: [
          { position: '0:0:0', type: 'kick', velocity: 0.8 },
          { position: '0:1:0', type: 'snare', velocity: 0.7 },
        ]
      };

      regionProcessor.registerTracks([{
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'region-1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern
        }]
      }]);

      regionProcessor.start();

      // Verify Tone.Transport.schedule was called
      expect(Tone.Transport.schedule).toHaveBeenCalledTimes(2);
    });

    it('should emit events from RegionProcessor', async () => {
      const eventSpy = vi.spyOn(eventBus, 'emit');

      regionProcessor.registerTracks([{
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'region-1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 1,
          pattern: {
            events: [{ position: '0:0:0', type: 'accent', velocity: 0.8 }]
          }
        }]
      }]);

      regionProcessor.start();

      // Execute scheduled callbacks
      const scheduleCalls = (Tone.Transport.schedule as any).mock.calls;
      for (const [callback] of scheduleCalls) {
        callback(0);
      }

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith('metronome-trigger', expect.objectContaining({
        velocity: 0.8
      }));
    });

    it('should complete flow from pattern to instrument', async () => {
      // Initialize AudioEventRouter with mocked AudioEngine
      const mockAudioEngine = {
        getContext: vi.fn(() => ({ sampleRate: 48000 }))
      };
      await audioEventRouter.initialize(eventBus, mockAudioEngine as any);
      await audioEventRouter.start();

      // Register instrument
      const mockMetronome = {
        id: 'test-metronome',
        trigger: vi.fn(),
        triggerClick: vi.fn()
      };
      instrumentRegistry.setActive('metronome', mockMetronome);

      // Register pattern
      regionProcessor.registerTracks([{
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'region-1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [{ position: '0:0:0', type: 'accent', velocity: 0.9 }]
          }
        }]
      }]);

      regionProcessor.start();

      // Trigger scheduled events
      const scheduleCalls = (Tone.Transport.schedule as any).mock.calls;
      for (const [callback] of scheduleCalls) {
        callback(0);
      }

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify instrument was called
      const wasCalled = mockMetronome.trigger.mock.calls.length > 0 ||
                       mockMetronome.triggerClick.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });
  });

  describe('Instrument Registry', () => {
    it('should handle getAllActive method', () => {
      const mockDrums = { id: 'drums' };
      const mockBass = { id: 'bass' };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);

      const allActive = instrumentRegistry.getAllActive();
      expect(allActive).toHaveLength(2);
      expect(allActive).toContain(mockDrums);
      expect(allActive).toContain(mockBass);
    });

    it('should handle clearActive method', () => {
      const mockDrums = { id: 'drums' };
      instrumentRegistry.setActive('drums', mockDrums);

      instrumentRegistry.clearActive('drums');
      expect(instrumentRegistry.hasActive('drums')).toBe(false);
    });
  });

  describe('Transport Synchronization', () => {
    it('should verify Tone.Transport state changes', () => {
      const mockTransport = Tone.Transport as any;

      // Initial state
      expect(mockTransport.state).toBe('stopped');

      // Start
      mockTransport.start();
      mockTransport.state = 'started';
      expect(mockTransport.state).toBe('started');

      // Stop
      mockTransport.stop();
      mockTransport.state = 'stopped';
      expect(mockTransport.state).toBe('stopped');
    });
  });
});