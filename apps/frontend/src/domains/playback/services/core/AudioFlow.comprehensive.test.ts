import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

// Mock Tone.js with factory function to avoid hoisting issues
vi.mock('tone', () => {
  const mockTransport = {
    state: 'stopped',
    seconds: 0,
    position: 0,
    bpm: { value: 120 },
    timeSignature: [4, 4],
    loop: false,
    loopStart: 0,
    loopEnd: 4,
    schedule: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  };

  // Update state in mock methods
  mockTransport.start.mockImplementation(() => {
    mockTransport.state = 'started';
  });
  mockTransport.stop.mockImplementation(() => {
    mockTransport.state = 'stopped';
    mockTransport.position = 0;
  });
  mockTransport.pause.mockImplementation(() => {
    mockTransport.state = 'paused';
  });

  return {
    default: {
      now: vi.fn(() => 0),
      Transport: mockTransport,
      Time: vi.fn((position: string) => ({
        toSeconds: () => {
          // Simple parser for "bar:beat:sixteenth"
          const parts = position.split(':');
          if (parts.length === 3) {
            const [bar, beat, sixteenth] = parts.map(Number);
            return (bar * 4 + beat + sixteenth / 16) * (60 / 120); // Assuming 120 BPM
          }
          return 0;
        }
      })),
    },
    Transport: mockTransport,
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
  };
});

// Now import modules that use Tone
import { EventBus } from './EventBus.js';
import { AudioEventRouter } from './AudioEventRouter.js';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { RegionProcessor } from './RegionProcessor.js';
import { CoreServices, GlobalAudioSystem } from './CoreServices.js';
import { TransportAdapter } from './TransportAdapter.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
import * as Tone from 'tone';

// Mock AudioEngine
vi.mock('../../modules/audio-engine/core/AudioEngine.js', () => ({
  AudioEngine: vi.fn().mockImplementation(() => {
    const mockContext = {
      sampleRate: 48000,
      currentTime: 0,
      baseLatency: 0.01,
    };
    return {
      getContext: vi.fn(() => mockContext),
      preInitialize: vi.fn(() => Promise.resolve()),
      initialize: vi.fn(() => Promise.resolve()),
      isInitialized: vi.fn(() => true),
      createSampler: vi.fn(() => ({})),
      getTransport: vi.fn(() => ({})),
      getTone: vi.fn(() => ({})),
    };
  }),
}));

// Mock TransportController
vi.mock('../../modules/transport/core/TransportController.js', () => ({
  TransportController: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      start: vi.fn(() => {
        mockToneTransport.start();
      }),
      stop: vi.fn(() => {
        mockToneTransport.stop();
      }),
      pause: vi.fn(() => {
        mockToneTransport.pause();
      }),
      getState: vi.fn(() => 'playing'),
      getTempo: vi.fn(() => 120),
      getMetrics: vi.fn(() => ({})),
    }))
  }
}));

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Comprehensive Audio Flow Test Suite', () => {
  let coreServices: CoreServices;
  let eventBus: EventBus;
  let audioEventRouter: AudioEventRouter;
  let instrumentRegistry: InstrumentRegistry;
  let regionProcessor: RegionProcessor;
  let transport: TransportAdapter;
  let audioEngine: AudioEngine;
  let mockToneTransport: any;

  beforeAll(() => {
    // Reset singleton
    GlobalAudioSystem._resetForTesting();
    // Get reference to mocked Tone Transport
    mockToneTransport = Tone.Transport;
  });

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    mockToneTransport.state = 'stopped';
    mockToneTransport.schedule.mockClear();

    coreServices = new CoreServices({
      enableHighPrecisionTiming: true,
      enablePerformanceMonitoring: true,
    });

    // Get services
    eventBus = coreServices.getEventBus();
    instrumentRegistry = coreServices.getInstrumentRegistry();
    regionProcessor = coreServices.getRegionProcessor();
    transport = coreServices.getUnifiedTransport();

    // Initialize AudioEventRouter
    audioEventRouter = coreServices.getAudioEventRouter();
  });

  afterEach(() => {
    // Clean up
    regionProcessor.stop();
    GlobalAudioSystem._resetForTesting();
  });

  describe('1. Core Services Initialization', () => {
    it('should pre-initialize without user interaction', async () => {
      await coreServices.preInitialize();
      expect(audioEngine.preInitialize).toHaveBeenCalled();
    });

    it('should fully initialize with user interaction', async () => {
      await coreServices.initialize();
      expect(audioEngine.initialize).toHaveBeenCalled();
      expect(coreServices.isReady()).toBe(true);
    });

    it('should start all services in correct order', async () => {
      await coreServices.initialize();
      await coreServices.start();

      const status = coreServices.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should handle GlobalAudioSystem singleton correctly', async () => {
      const instance1 = await GlobalAudioSystem.getPreInitializedInstance();
      const instance2 = await GlobalAudioSystem.getPreInitializedInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('2. Transport and Tone.js Synchronization', () => {
    it('should start Tone.Transport when our transport starts', async () => {
      await coreServices.initialize();
      expect(mockToneTransport.state).toBe('stopped');

      await transport.start();
      expect(mockToneTransport.state).toBe('started');
    });

    it('should stop Tone.Transport when our transport stops', async () => {
      await coreServices.initialize();
      await transport.start();
      expect(mockToneTransport.state).toBe('started');

      await transport.stop();
      expect(mockToneTransport.state).toBe('stopped');
      expect(mockToneTransport.position).toBe(0);
    });

    it('should pause Tone.Transport when our transport pauses', async () => {
      await coreServices.initialize();
      await transport.start();
      await transport.pause();
      expect(mockToneTransport.state).toBe('paused');
    });

    it('should sync tempo changes', async () => {
      await coreServices.initialize();
      await transport.setTempo(140);
      expect(mockToneTransport.bpm.value).toBe(140);
    });

    it('should sync time signature changes', async () => {
      await coreServices.initialize();
      await transport.setTimeSignature({ numerator: 3, denominator: 4 });
      expect(mockToneTransport.timeSignature).toEqual([3, 4]);
    });
  });

  describe('3. Instrument Registration', () => {
    it('should register instruments correctly', () => {
      const mockDrums = { id: 'test-drums', play: vi.fn() };
      instrumentRegistry.setActive('drums', mockDrums);

      expect(instrumentRegistry.hasActive('drums')).toBe(true);
      expect(instrumentRegistry.getActive('drums')).toBe(mockDrums);
    });

    it('should emit events when instruments are registered', () => {
      const eventSpy = vi.spyOn(eventBus, 'emit');
      const mockBass = { id: 'test-bass', triggerNote: vi.fn() };

      instrumentRegistry.setActive('bass', mockBass);

      expect(eventSpy).toHaveBeenCalledWith('instrument:registered', {
        type: 'bass',
        instrument: mockBass
      });
    });

    it('should handle multiple instrument types', () => {
      const mockDrums = { id: 'drums', play: vi.fn() };
      const mockBass = { id: 'bass', triggerNote: vi.fn() };
      const mockMetronome = { id: 'metronome', trigger: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);
      instrumentRegistry.setActive('metronome', mockMetronome);

      expect(instrumentRegistry.getAllActive()).toHaveLength(3);
    });

    it('should clear instruments correctly', () => {
      const mockDrums = { id: 'drums', play: vi.fn() };
      instrumentRegistry.setActive('drums', mockDrums);

      instrumentRegistry.clearActive('drums');
      expect(instrumentRegistry.hasActive('drums')).toBe(false);
    });
  });

  describe('4. Pattern Registration and Processing', () => {
    it('should register tracks with patterns', () => {
      const pattern = {
        events: [
          { position: '0:0:0', type: 'kick', velocity: 0.8 },
          { position: '0:2:0', type: 'snare', velocity: 0.7 },
        ]
      };

      const track = {
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'region-1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern
        }]
      };

      regionProcessor.registerTracks([track]);
      // Verify no errors thrown
      expect(true).toBe(true);
    });

    it('should schedule events when started', () => {
      const pattern = {
        events: [
          { position: '0:0:0', type: 'accent', velocity: 0.9 },
          { position: '0:1:0', type: 'click', velocity: 0.6 },
        ]
      };

      regionProcessor.registerTracks([{
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'region-1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 4,
          pattern
        }]
      }]);

      regionProcessor.start();

      expect(mockToneTransport.schedule).toHaveBeenCalledTimes(2);
    });

    it('should emit correct events for different instrument types', async () => {
      const eventSpy = vi.spyOn(eventBus, 'emit');

      // Register metronome pattern
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
      const scheduleCalls = mockToneTransport.schedule.mock.calls;
      for (const [callback] of scheduleCalls) {
        callback(0);
      }

      expect(eventSpy).toHaveBeenCalledWith('metronome-trigger', expect.objectContaining({
        beat: expect.any(Number),
        isDownbeat: expect.any(Boolean),
        audioTime: expect.any(Number),
        timestamp: expect.any(Number),
        velocity: 0.8
      }));
    });

    it('should handle pattern updates', () => {
      const initialPattern = {
        events: [{ position: '0:0:0', type: 'kick', velocity: 0.8 }]
      };

      regionProcessor.registerTracks([{
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'region-1',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern: initialPattern
        }]
      }]);

      regionProcessor.start();
      const initialCalls = mockToneTransport.schedule.mock.calls.length;

      // Update with new pattern
      const updatedPattern = {
        events: [
          { position: '0:0:0', type: 'kick', velocity: 0.8 },
          { position: '0:1:0', type: 'snare', velocity: 0.7 },
        ]
      };

      regionProcessor.updateTracks([{
        id: 'drum-track',
        instrumentType: 'drums',
        regions: [{
          id: 'region-2',
          trackId: 'drum-track',
          startTime: 0,
          duration: 4,
          pattern: updatedPattern
        }]
      }]);

      expect(mockToneTransport.schedule.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  describe('5. Event Routing', () => {
    beforeEach(async () => {
      await coreServices.initialize();
      await audioEventRouter.start();
    });

    it('should route metronome events to registered instrument', async () => {
      const mockMetronome = {
        id: 'test-metronome',
        trigger: vi.fn(),
        triggerClick: vi.fn()
      };

      instrumentRegistry.setActive('metronome', mockMetronome);

      // Emit a metronome event
      eventBus.emit('metronome-trigger', {
        beat: 1,
        isDownbeat: true,
        audioTime: 0,
        timestamp: Date.now(),
        velocity: 0.8
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check if either trigger or triggerClick was called
      const wasCalled = mockMetronome.trigger.mock.calls.length > 0 ||
                       mockMetronome.triggerClick.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should route drum events to registered instrument', async () => {
      const mockDrums = {
        id: 'test-drums',
        play: vi.fn(),
        stop: vi.fn()
      };

      instrumentRegistry.setActive('drums', mockDrums);

      eventBus.emit('drum-trigger', {
        drum: 'kick',
        audioTime: 0,
        timestamp: Date.now(),
        velocity: 0.8
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDrums.play).toHaveBeenCalledWith(36, 0.8); // 36 is MIDI for kick
    });

    it('should handle missing instruments gracefully', async () => {
      // No instruments registered

      // Should not throw
      expect(() => {
        eventBus.emit('drum-trigger', {
          drum: 'kick',
          audioTime: 0,
          timestamp: Date.now(),
          velocity: 0.8
        });
      }).not.toThrow();
    });

    it('should handle late instrument registration', async () => {
      // Emit event before instrument is registered
      eventBus.emit('bass-trigger', {
        note: 'E2',
        audioTime: 0,
        timestamp: Date.now(),
        velocity: 0.7
      });

      // Register instrument after event
      const mockBass = {
        id: 'test-bass',
        triggerNote: vi.fn()
      };
      instrumentRegistry.setActive('bass', mockBass);

      // Emit another event
      eventBus.emit('bass-trigger', {
        note: 'A2',
        audioTime: 1,
        timestamp: Date.now(),
        velocity: 0.7
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Only the second event should be handled
      expect(mockBass.triggerNote).toHaveBeenCalledTimes(1);
      expect(mockBass.triggerNote).toHaveBeenCalledWith('A2', 0.7);
    });
  });

  describe('6. Complete Flow Integration', () => {
    it('should handle complete flow from pattern to instrument', async () => {
      // Initialize everything
      await coreServices.initialize();
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
            events: [
              { position: '0:0:0', type: 'accent', velocity: 0.9 },
              { position: '0:1:0', type: 'click', velocity: 0.6 }
            ]
          }
        }]
      }]);

      // Start processing
      regionProcessor.start();

      // Start transport (should start Tone.Transport)
      await transport.start();
      expect(mockToneTransport.state).toBe('started');

      // Trigger scheduled events
      const scheduleCalls = mockToneTransport.schedule.mock.calls;
      for (const [callback] of scheduleCalls) {
        callback(0);
      }

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify instrument was triggered
      const wasCalled = mockMetronome.trigger.mock.calls.length > 0 ||
                       mockMetronome.triggerClick.mock.calls.length > 0;
      expect(wasCalled).toBe(true);
    });

    it('should handle multiple instruments playing simultaneously', async () => {
      await coreServices.initialize();
      await audioEventRouter.start();

      // Register multiple instruments
      const mockDrums = { id: 'drums', play: vi.fn(), stop: vi.fn() };
      const mockBass = { id: 'bass', triggerNote: vi.fn() };
      const mockMetronome = { id: 'metronome', trigger: vi.fn(), triggerClick: vi.fn() };

      instrumentRegistry.setActive('drums', mockDrums);
      instrumentRegistry.setActive('bass', mockBass);
      instrumentRegistry.setActive('metronome', mockMetronome);

      // Register multiple tracks
      regionProcessor.registerTracks([
        {
          id: 'drum-track',
          instrumentType: 'drums',
          regions: [{
            id: 'drum-region',
            trackId: 'drum-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'kick', velocity: 0.8 }]
            }
          }]
        },
        {
          id: 'bass-track',
          instrumentType: 'bass',
          regions: [{
            id: 'bass-region',
            trackId: 'bass-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'E2', velocity: 0.7 }]
            }
          }]
        },
        {
          id: 'metro-track',
          instrumentType: 'metronome',
          regions: [{
            id: 'metro-region',
            trackId: 'metro-track',
            startTime: 0,
            duration: 2,
            pattern: {
              events: [{ position: '0:0:0', type: 'accent', velocity: 0.9 }]
            }
          }]
        }
      ]);

      regionProcessor.start();
      await transport.start();

      // Trigger all scheduled events
      const scheduleCalls = mockToneTransport.schedule.mock.calls;
      for (const [callback] of scheduleCalls) {
        callback(0);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all instruments were triggered
      expect(mockDrums.play).toHaveBeenCalled();
      expect(mockBass.triggerNote).toHaveBeenCalled();
      const metronomeTriggered = mockMetronome.trigger.mock.calls.length > 0 ||
                                mockMetronome.triggerClick.mock.calls.length > 0;
      expect(metronomeTriggered).toBe(true);
    });

    it('should stop all processing when transport stops', async () => {
      await coreServices.initialize();
      await audioEventRouter.start();

      const mockMetronome = {
        id: 'metronome',
        trigger: vi.fn(),
        triggerClick: vi.fn()
      };
      instrumentRegistry.setActive('metronome', mockMetronome);

      regionProcessor.registerTracks([{
        id: 'metro-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'region-1',
          trackId: 'metro-track',
          startTime: 0,
          duration: 10,
          pattern: {
            events: Array.from({ length: 10 }, (_, i) => ({
              position: `0:${i}:0`,
              type: i === 0 ? 'accent' : 'click',
              velocity: 0.7
            }))
          }
        }]
      }]);

      regionProcessor.start();
      await transport.start();

      // Stop after a short time
      await transport.stop();
      expect(mockToneTransport.state).toBe('stopped');

      // Clear should have been called for scheduled events
      const clearCalls = mockToneTransport.clear.mock.calls.length;

      // Try to trigger events after stop - they shouldn't fire
      regionProcessor.stop();

      const callsBefore = mockMetronome.trigger.mock.calls.length +
                         mockMetronome.triggerClick.mock.calls.length;

      await new Promise(resolve => setTimeout(resolve, 100));

      const callsAfter = mockMetronome.trigger.mock.calls.length +
                        mockMetronome.triggerClick.mock.calls.length;

      // No new calls should happen after stop
      expect(callsAfter).toBe(callsBefore);
    });
  });

  describe('7. Error Handling and Recovery', () => {
    it('should handle initialization errors gracefully', async () => {
      audioEngine.initialize = vi.fn(() => Promise.reject(new Error('Audio context failed')));

      await expect(coreServices.initialize()).rejects.toThrow();
      expect(coreServices.isReady()).toBe(false);
    });

    it('should handle invalid patterns', () => {
      expect(() => {
        regionProcessor.registerTracks([{
          id: 'bad-track',
          instrumentType: 'drums',
          regions: [{
            id: 'bad-region',
            trackId: 'bad-track',
            startTime: 0,
            duration: 4,
            pattern: {
              events: [
                { position: 'invalid', type: 'kick', velocity: 0.8 }
              ]
            }
          }]
        }]);
        regionProcessor.start();
      }).not.toThrow();
    });

    it('should recover from transport errors', async () => {
      await coreServices.initialize();

      // Force an error state
      const controller = (transport as any).controller;
      controller.start = vi.fn(() => Promise.reject(new Error('Transport error')));

      await expect(transport.start()).rejects.toThrow();

      // Should be able to recover
      controller.start = vi.fn(() => Promise.resolve());
      await expect(transport.start()).resolves.not.toThrow();
    });
  });

  describe('8. Performance and Timing', () => {
    it('should handle high-frequency events', () => {
      // Create a pattern with many events
      const events = Array.from({ length: 100 }, (_, i) => ({
        position: `${Math.floor(i / 16)}:${Math.floor((i % 16) / 4)}:${i % 4}`,
        type: 'hihat',
        velocity: 0.5
      }));

      const startTime = Date.now();

      regionProcessor.registerTracks([{
        id: 'hihat-track',
        instrumentType: 'drums',
        regions: [{
          id: 'hihat-region',
          trackId: 'hihat-track',
          startTime: 0,
          duration: 10,
          pattern: { events }
        }]
      }]);

      regionProcessor.start();

      const endTime = Date.now();

      // Should schedule quickly (under 100ms for 100 events)
      expect(endTime - startTime).toBeLessThan(100);
      expect(mockToneTransport.schedule).toHaveBeenCalledTimes(100);
    });

    it('should maintain timing accuracy', async () => {
      await coreServices.initialize();

      const timings: number[] = [];

      // Track actual callback times
      mockToneTransport.schedule.mockImplementation((callback, time) => {
        setTimeout(() => {
          timings.push(time);
          callback(time);
        }, 0);
        return `scheduled-${Date.now()}`;
      });

      regionProcessor.registerTracks([{
        id: 'timing-track',
        instrumentType: 'metronome',
        regions: [{
          id: 'timing-region',
          trackId: 'timing-track',
          startTime: 0,
          duration: 4,
          pattern: {
            events: [
              { position: '0:0:0', type: 'click', velocity: 0.5 },
              { position: '0:1:0', type: 'click', velocity: 0.5 },
              { position: '0:2:0', type: 'click', velocity: 0.5 },
              { position: '0:3:0', type: 'click', velocity: 0.5 },
            ]
          }
        }]
      }]);

      regionProcessor.start();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify events are scheduled at correct times (0.5s intervals at 120 BPM)
      expect(timings).toHaveLength(4);
      expect(timings[0]).toBeCloseTo(0, 1);
      expect(timings[1]).toBeCloseTo(0.5, 1);
      expect(timings[2]).toBeCloseTo(1, 1);
      expect(timings[3]).toBeCloseTo(1.5, 1);
    });
  });
});