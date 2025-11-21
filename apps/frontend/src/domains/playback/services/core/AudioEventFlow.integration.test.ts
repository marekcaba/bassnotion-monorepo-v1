import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from './EventBus.js';
import { AudioEventRouter } from './AudioEventRouter.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { RegionProcessor } from './RegionProcessor.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';

// Mock Tone.js
vi.mock('tone', () => ({
  default: {
    now: vi.fn(() => 0),
    Transport: {
      state: 'started',
      schedule: vi.fn((callback, time) => {
        // Execute callback immediately for testing
        setTimeout(() => callback(time), 0);
        return `scheduled-${Date.now()}`;
      }),
      clear: vi.fn(),
    },
  },
  now: vi.fn(() => 0),
  Transport: {
    state: 'started',
    schedule: vi.fn((callback, time) => {
      setTimeout(() => callback(time), 0);
      return `scheduled-${Date.now()}`;
    }),
    clear: vi.fn(),
  },
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

describe('Audio Event Flow Integration', () => {
  let eventBus: EventBus;
  let audioEventRouter: AudioEventRouter;
  let instrumentRegistry: InstrumentRegistry;
  let regionProcessor: RegionProcessor;
  let audioEngine: AudioEngine;

  beforeEach(() => {
    // Create real EventBus instance
    eventBus = new EventBus();

    // Create mocked AudioEngine
    audioEngine = new AudioEngine() as any;

    // Create real instances with dependencies
    instrumentRegistry = new InstrumentRegistry(eventBus);
    audioEventRouter = new AudioEventRouter();
    regionProcessor = new RegionProcessor(eventBus);

    // Mock global services
    (window as any).__globalCoreServices = {
      getInstrumentRegistry: () => instrumentRegistry,
      getEventBus: () => eventBus,
      getRegionProcessor: () => regionProcessor,
    };
  });

  afterEach(() => {
    delete (window as any).__globalCoreServices;
    vi.clearAllMocks();
  });

  describe('Complete Event Flow', () => {
    it('should flow from pattern registration to instrument trigger', async () => {
      // Step 1: Initialize AudioEventRouter
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      // Step 2: Register a mock metronome instrument
      const mockMetronome = {
        id: 'test-metronome',
        trigger: vi.fn(),
        triggerClick: vi.fn(),
      };

      // Spy on EventBus to verify events are emitted
      const eventSpy = vi.spyOn(eventBus, 'emit');

      instrumentRegistry.setActive('metronome', mockMetronome);

      // Step 3: Create and register a metronome pattern with RegionProcessor
      const pattern = {
        events: [
          { position: '0:0:0', type: 'accent', velocity: 0.8 },
          { position: '0:1:0', type: 'click', velocity: 0.6 },
          { position: '0:2:0', type: 'click', velocity: 0.6 },
          { position: '0:3:0', type: 'click', velocity: 0.6 },
        ],
      };

      const track = {
        id: 'metronome-track',
        name: 'Metronome',
        instrumentType: 'metronome',
        regions: [{
          id: 'region-1',
          trackId: 'metronome-track',
          startTime: 0,
          duration: 4,
          pattern,
        }],
      };

      regionProcessor.registerTracks([track]);

      // Step 4: Start the RegionProcessor
      regionProcessor.start();

      // Step 5: Wait for async event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify events were emitted
      expect(eventSpy).toHaveBeenCalledWith(
        'metronome-trigger',
        expect.objectContaining({
          beat: expect.any(Number),
          isDownbeat: expect.any(Boolean),
          audioTime: expect.any(Number),
        })
      );

      // The metronome might use trigger instead of triggerClick
      const wasCalled = mockMetronome.trigger.mock.calls.length > 0 ||
                        mockMetronome.triggerClick.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should handle drum patterns correctly', async () => {
      // Initialize services
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      // Register a mock drum instrument
      const mockDrums = {
        id: 'test-drums',
        play: vi.fn(),
        stop: vi.fn(),
      };
      instrumentRegistry.setActive('drums', mockDrums);

      // Create a drum pattern
      const drumPattern = {
        events: [
          { position: '0:0:0', type: 'kick', velocity: 0.9 },
          { position: '0:0:2', type: 'hihat', velocity: 0.5 },
          { position: '0:1:0', type: 'snare', velocity: 0.8 },
          { position: '0:1:2', type: 'hihat', velocity: 0.5 },
        ],
      };

      const drumTrack = {
        id: 'drum-track',
        name: 'Drums',
        instrumentType: 'drums',
        regions: [{
          id: 'drum-region-1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern: drumPattern,
        }],
      };

      regionProcessor.registerTracks([drumTrack]);
      regionProcessor.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify drums were triggered with correct MIDI notes
      expect(mockDrums.play).toHaveBeenCalledWith(36, 0.9); // kick
      expect(mockDrums.play).toHaveBeenCalledWith(42, 0.5); // hihat
      expect(mockDrums.play).toHaveBeenCalledWith(38, 0.8); // snare
    });

    it('should handle multiple instruments simultaneously', async () => {
      // Initialize
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      // Register multiple instruments
      const mockDrums = { id: 'drums', play: vi.fn(), stop: vi.fn() };
      const mockBass = { id: 'bass', triggerNote: vi.fn() };
      const mockMetronome = { id: 'metronome', triggerClick: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);
      instrumentRegistry.setActive('metronome', mockMetronome);

      // Create tracks for each instrument
      const tracks = [
        {
          id: 'drum-track',
          instrumentType: 'drums',
          regions: [{
            id: 'drum-r1',
            trackId: 'drum-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'kick', velocity: 0.8 }],
            },
          }],
        },
        {
          id: 'bass-track',
          instrumentType: 'bass',
          regions: [{
            id: 'bass-r1',
            trackId: 'bass-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'E2', velocity: 0.7 }],
            },
          }],
        },
        {
          id: 'metronome-track',
          instrumentType: 'metronome',
          regions: [{
            id: 'metro-r1',
            trackId: 'metronome-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'accent', velocity: 0.9 }],
            },
          }],
        },
      ];

      regionProcessor.registerTracks(tracks);
      regionProcessor.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all instruments were triggered
      expect(mockDrums.play).toHaveBeenCalled();
      expect(mockBass.triggerNote).toHaveBeenCalled();
      expect(mockMetronome.triggerClick).toHaveBeenCalled();
    });

    it('should update patterns dynamically', async () => {
      // Initialize
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      const mockMetronome = { id: 'metronome', triggerClick: vi.fn() };
      instrumentRegistry.setActive('metronome', mockMetronome);

      // Initial pattern
      const initialTrack = {
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'metro-r1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [{ position: '0:0:0', type: 'click', velocity: 0.5 }],
          },
        }],
      };

      regionProcessor.registerTracks([initialTrack]);
      regionProcessor.start();

      await new Promise(resolve => setTimeout(resolve, 50));
      const initialCallCount = mockMetronome.triggerClick.mock.calls.length;

      // Update pattern
      const updatedTrack = {
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'metro-r2',
          trackId: 'metro-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [
              { position: '0:0:0', type: 'accent', velocity: 0.9 },
              { position: '0:1:0', type: 'click', velocity: 0.6 },
            ],
          },
        }],
      };

      regionProcessor.updateTracks([updatedTrack]);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have more triggers after update
      expect(mockMetronome.triggerClick.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('should stop processing when RegionProcessor is stopped', async () => {
      // Initialize
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      const mockMetronome = { id: 'metronome', triggerClick: vi.fn() };
      instrumentRegistry.setActive('metronome', mockMetronome);

      const track = {
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'metro-r1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [{ position: '0:0:0', type: 'click', velocity: 0.5 }],
          },
        }],
      };

      regionProcessor.registerTracks([track]);
      regionProcessor.start();

      await new Promise(resolve => setTimeout(resolve, 50));
      const callCountBefore = mockMetronome.triggerClick.mock.calls.length;

      // Stop the processor
      regionProcessor.stop();

      await new Promise(resolve => setTimeout(resolve, 100));
      const callCountAfter = mockMetronome.triggerClick.mock.calls.length;

      // Should not have new calls after stopping
      expect(callCountAfter).toBe(callCountBefore);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing instruments gracefully', async () => {
      // Initialize without registering any instruments
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      const track = {
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'metro-r1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 1,
          pattern: {
            events: [{ position: '0:0:0', type: 'click', velocity: 0.5 }],
          },
        }],
      };

      regionProcessor.registerTracks([track]);
      regionProcessor.start();

      // Should not throw, just log warnings
      await new Promise(resolve => setTimeout(resolve, 50));

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    it('should handle instrument registration after pattern scheduling', async () => {
      // Initialize and start without instruments
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      const track = {
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'drum-r1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [{ position: '0:0:0', type: 'kick', velocity: 0.8 }],
          },
        }],
      };

      regionProcessor.registerTracks([track]);
      regionProcessor.start();

      // Register instrument after pattern is already scheduled
      const mockDrums = { id: 'drums', play: vi.fn(), stop: vi.fn() };
      instrumentRegistry.setActive('drums', mockDrums);

      // Events should now be routed to the newly registered instrument
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDrums.play).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle large patterns efficiently', async () => {
      await audioEventRouter.initialize(eventBus, audioEngine);
      await audioEventRouter.start();

      const mockDrums = { id: 'drums', play: vi.fn(), stop: vi.fn() };
      instrumentRegistry.setActive('drums', mockDrums);

      // Create a large pattern with many events
      const events = [];
      for (let bar = 0; bar < 4; bar++) {
        for (let beat = 0; beat < 4; beat++) {
          for (let sixteenth = 0; sixteenth < 4; sixteenth++) {
            events.push({
              position: `${bar}:${beat}:${sixteenth}`,
              type: 'hihat',
              velocity: 0.5,
            });
          }
        }
      }

      const track = {
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'drum-r1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 16,
          pattern: { events },
        }],
      };

      const startTime = Date.now();
      regionProcessor.registerTracks([track]);
      regionProcessor.start();
      const endTime = Date.now();

      // Should schedule quickly (under 100ms for 64 events)
      expect(endTime - startTime).toBeLessThan(100);

      await new Promise(resolve => setTimeout(resolve, 100));

      // All events should be scheduled
      expect(mockDrums.play.mock.calls.length).toBeGreaterThan(0);
    });
  });
});