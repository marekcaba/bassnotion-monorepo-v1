/**
 * Integration Tests for Dependency Injection System
 *
 * These tests verify that the entire DI system works together correctly,
 * including CoreServices, AudioEngine, and all instrument components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupDIMocks, cleanupDIMocks } from './mocks/setupDI.js';
import { createMockAudioEngine, mockTone } from './mocks/mockAudioEngine.js';

// Mock Tone globally to track all node creation
vi.mock('tone', () => mockTone);

// Mock all the processors first
vi.mock(
  '../instruments/implementations/bass/BassInstrumentProcessor.js',
  () => ({
    BassInstrumentProcessor: vi
      .fn()
      .mockImplementation((config, audioEngine) => {
        let mockSampler: any = null;
        const createdNodes: any[] = [];
        return {
          initialize: vi.fn().mockImplementation(async (samples, engine) => {
            const actualEngine = engine || audioEngine;
            if (actualEngine && actualEngine.createSampler) {
              mockSampler = actualEngine.createSampler({});
              createdNodes.push(mockSampler);
            }
          }),
          triggerNote: vi.fn().mockImplementation((params) => {
            if (mockSampler && mockSampler.triggerAttackRelease) {
              mockSampler.triggerAttackRelease(
                params.note,
                params.duration || '8n',
                params.time,
                params.velocity,
              );
            }
          }),
          stopNote: vi.fn(),
          dispose: vi.fn().mockImplementation(() => {
            // Dispose all created nodes
            createdNodes.forEach((node) => {
              if (node && node.dispose) {
                node.dispose();
              }
            });
          }),
          audioEngine,
        };
      }),
  }),
);

vi.mock(
  '../instruments/implementations/drums/DrumInstrumentProcessor.js',
  () => ({
    DrumInstrumentProcessor: vi
      .fn()
      .mockImplementation((config, audioEngine) => {
        const createdNodes: any[] = [];
        return {
          initialize: vi.fn().mockImplementation(async (samples, engine) => {
            const actualEngine = engine || audioEngine;
            if (actualEngine && actualEngine.createSampler) {
              const sampler = actualEngine.createSampler({});
              createdNodes.push(sampler);
            }
          }),
          trigger: vi.fn(),
          dispose: vi.fn().mockImplementation(() => {
            // Dispose all created nodes
            createdNodes.forEach((node) => {
              if (node && node.dispose) {
                node.dispose();
              }
            });
          }),
          audioEngine,
        };
      }),
  }),
);

vi.mock(
  '../instruments/implementations/metronome/MetronomeInstrumentProcessor.js',
  () => ({
    MetronomeInstrumentProcessor: vi
      .fn()
      .mockImplementation((config, audioEngine) => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        start: vi.fn(),
        stop: vi.fn(),
        dispose: vi.fn(),
        audioEngine,
      })),
    ClickSoundType: {
      ELECTRONIC_BEEP: 'electronic_beep',
      ACOUSTIC_CLICK: 'acoustic_click',
      WOOD_BLOCK: 'wood_block',
      SIDE_STICK: 'side_stick',
      CLAP: 'clap',
      SYNTH_CLICK: 'synth_click',
      CUSTOM_SAMPLE: 'custom_sample',
      STANDARD: 'standard',
      ELECTRONIC: 'electronic',
      WOODBLOCK: 'woodblock',
      COWBELL: 'cowbell',
      HIHAT: 'hihat',
      RIMSHOT: 'rimshot',
      CLAVES: 'claves',
      TAMBOURINE: 'tambourine',
    },
  }),
);

// Mock correlation hook
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: vi.fn(() => ({
    correlationId: 'test-correlation-id',
    logger: mockLogger,
  })),
}));

// Set global logger
global.logger = mockLogger;

// Test with actual components
import { BassInstrument } from '../instruments/implementations/bass/BassInstrument.js';
import { DrumKit } from '../instruments/implementations/drums/DrumKit.js';
import { Metronome } from '../instruments/implementations/metronome/Metronome.js';
import { Channel } from '../tracks/mixing/Channel.js';
import { Bus } from '../tracks/mixing/Bus.js';

describe('DI Integration Tests', () => {
  describe('Global CoreServices Integration', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should create all instruments with global audioEngine', async () => {
      // Create instruments without explicit audioEngine
      const bass = new BassInstrument({
        id: 'test-bass',
        name: 'Test Bass',
        type: 'bass',
      });

      const drums = new DrumKit({
        id: 'test-drums',
        name: 'Test Drums',
        type: 'drums',
      });

      const metronome = new Metronome({
        type: 'metronome',
        name: 'Test Metronome',
      });

      // Initialize all instruments
      await bass.initialize();
      await drums.initialize();
      await metronome.initialize();

      // Verify all initialized successfully
      expect(bass.state.isInitialized).toBe(true);
      expect(drums.state.isInitialized).toBe(true);
      expect(metronome.state.isInitialized).toBe(true);

      // Verify CoreServices was accessed
      expect(diSetup.coreServices.getAudioEngine).toHaveBeenCalled();
    });

    it('should handle mixed DI usage patterns', async () => {
      const customAudioEngine = createMockAudioEngine();

      // Some with explicit audioEngine
      const bassWithDI = new BassInstrument(
        {
          id: 'bass-di',
          name: 'Bass with DI',
          type: 'bass',
        },
        customAudioEngine,
      );

      // Some using global
      const bassWithGlobal = new BassInstrument({
        id: 'bass-global',
        name: 'Bass with Global',
        type: 'bass',
      });

      await bassWithDI.initialize();
      await bassWithGlobal.initialize();

      // Both should work
      expect(bassWithDI.state.isInitialized).toBe(true);
      expect(bassWithGlobal.state.isInitialized).toBe(true);

      // Verify the custom audioEngine was used for the first
      expect(customAudioEngine.createSampler).toHaveBeenCalled();

      // Verify global was used for the second
      expect(diSetup.coreServices.getAudioEngine).toHaveBeenCalled();
    });
  });

  describe('Full Playback System Integration', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should create complete playback system with DI', async () => {
      // Create mixing infrastructure
      const masterBus = new Bus({
        busId: 'master',
        name: 'Master Bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      const drumsBus = new Bus({
        busId: 'drums',
        name: 'Drums Bus',
        type: 'sub',
        audioEngine: diSetup.audioEngine,
      });

      const bassChannel = new Channel({
        channelId: 'bass',
        name: 'Bass Channel',
        outputBus: 'master',
        audioEngine: diSetup.audioEngine,
      });

      const drumsChannel = new Channel({
        channelId: 'drums',
        name: 'Drums Channel',
        outputBus: 'drums',
        audioEngine: diSetup.audioEngine,
      });

      // Create instruments
      const bass = new BassInstrument(
        {
          id: 'bass',
          name: 'Bass',
          type: 'bass',
        },
        diSetup.audioEngine,
      );

      const drums = new DrumKit(
        {
          id: 'drums',
          name: 'Drums',
          type: 'drums',
        },
        diSetup.audioEngine,
      );

      // Initialize everything
      await bass.initialize();
      await drums.initialize();

      // Verify everything created successfully
      expect(masterBus.getChildBusIds()).toEqual([]);
      expect(bassChannel.getState()).toMatchObject({ volume: 0.75 });
      expect(drumsChannel.getState()).toMatchObject({ volume: 0.75 });
      expect(bass.state.isInitialized).toBe(true);
      expect(drums.state.isInitialized).toBe(true);

      // Verify DI usage across all components
      expect(diSetup.audioEngine.createGain).toHaveBeenCalled();
      expect(diSetup.audioEngine.createSampler).toHaveBeenCalled();
    });

    it('should handle instrument triggering with mocks', async () => {
      const bass = new BassInstrument(
        {
          id: 'test-bass',
          name: 'Test Bass',
          type: 'bass',
        },
        diSetup.audioEngine,
      );

      await bass.initialize();

      // Trigger a note
      bass.trigger({
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { note: 'E1', fret: 0, string: 0 },
      });

      // Verify the mock sampler was triggered
      const mockSampler =
        diSetup.audioEngine.createSampler.mock.results[0].value;
      expect(mockSampler.triggerAttackRelease).toHaveBeenCalledWith(
        'E1',
        expect.any(String),
        0.5,
        0.8,
      );
    });

    it('should handle audio routing between components', () => {
      const channel = new Channel({
        channelId: 'test-channel',
        audioEngine: diSetup.audioEngine,
      });

      const bus = new Bus({
        busId: 'test-bus',
        type: 'sub',
        audioEngine: diSetup.audioEngine,
      });

      // Connect channel to bus
      bus.connectChannel('test-channel', channel);

      // Verify connection was made
      expect(bus.getConnectedChannelIds()).toContain('test-channel');

      // Verify audio nodes were connected
      const channelOutput = channel.getOutput();
      const busInput = bus.getInput();
      expect(channelOutput.connect).toHaveBeenCalledWith(busInput);
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle missing CoreServices', async () => {
      // No global services available
      delete (global as any).window;

      const bass = new BassInstrument({
        id: 'test-bass',
        name: 'Test Bass',
        type: 'bass',
      });

      // Should still work by falling back to Tone.js
      // (This test requires Tone.js to be mocked globally)
      vi.mock('tone', () => ({
        Sampler: vi.fn(() => ({ connect: vi.fn(), dispose: vi.fn() })),
        Volume: vi.fn(() => ({ connect: vi.fn(), dispose: vi.fn() })),
        Destination: { connect: vi.fn() },
        start: vi.fn(),
      }));

      await expect(bass.initialize()).resolves.not.toThrow();
    });

    it('should handle partial audioEngine implementations', async () => {
      // AudioEngine missing some factory methods
      const partialAudioEngine = {
        createSampler: vi.fn(() => ({
          connect: vi.fn(),
          triggerAttackRelease: vi.fn(),
        })),
        // Missing createVolume - should fallback to Tone
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          gain: { value: 1 },
        })),
      };

      vi.mock('tone', () => ({
        Volume: vi.fn(() => ({ connect: vi.fn(), volume: { value: 0 } })),
        Destination: { connect: vi.fn() },
      }));

      const bass = new BassInstrument(
        {
          id: 'test-bass',
          name: 'Test Bass',
          type: 'bass',
        },
        partialAudioEngine,
      );

      await expect(bass.initialize()).resolves.not.toThrow();

      // Should use partial audioEngine where available
      expect(partialAudioEngine.createSampler).toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should handle multiple instrument creation efficiently', async () => {
      const startTime = performance.now();

      const instruments = [];

      // Create multiple instruments of different types
      for (let i = 0; i < 20; i++) {
        instruments.push(
          new BassInstrument(
            {
              id: `bass-${i}`,
              name: `Bass ${i}`,
              type: 'bass',
            },
            diSetup.audioEngine,
          ),

          new DrumKit(
            {
              id: `drums-${i}`,
              name: `Drums ${i}`,
              type: 'drums',
            },
            diSetup.audioEngine,
          ),

          new Metronome(
            {
              type: 'metronome',
              name: `Metronome ${i}`,
            },
            diSetup.audioEngine,
          ),
        );
      }

      // Initialize all instruments
      await Promise.all(
        instruments.map((instrument) => instrument.initialize()),
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete reasonably fast
      expect(totalTime).toBeLessThan(1000); // 1 second for 60 instruments

      // Verify all initialized
      instruments.forEach((instrument) => {
        expect(instrument.state.isInitialized).toBe(true);
      });
    });

    it('should not leak memory in factory methods', () => {
      const initialCallCount = diSetup.audioEngine.createGain.mock.calls.length;

      // Create and dispose multiple channels
      for (let i = 0; i < 50; i++) {
        const channel = new Channel({
          channelId: `channel-${i}`,
          audioEngine: diSetup.audioEngine,
        });

        // Dispose immediately
        channel.dispose();
      }

      const finalCallCount = diSetup.audioEngine.createGain.mock.calls.length;
      const callsPerChannel = (finalCallCount - initialCallCount) / 50;

      // Each channel should create predictable number of gain nodes
      expect(callsPerChannel).toBeGreaterThan(0);
      expect(callsPerChannel).toBeLessThan(10); // Reasonable upper bound
    });
  });

  describe('Real-world Usage Patterns', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should support AudioEventRouter pattern', async () => {
      // Simulate AudioEventRouter usage pattern
      const instruments = new Map();

      // Initialize instruments like AudioEventRouter does
      const metronome = new Metronome(
        {
          type: 'metronome',
          name: 'Metronome',
        },
        diSetup.audioEngine,
      );

      const drums = new DrumKit(
        {
          id: 'drums',
          type: 'drums',
          name: 'Drum Kit',
        },
        diSetup.audioEngine,
      );

      const bass = new BassInstrument(
        {
          id: 'bass',
          type: 'bass',
          name: 'Bass',
        },
        diSetup.audioEngine,
      );

      // Initialize in order (like real system)
      await metronome.initialize(diSetup.audioEngine);
      await drums.initialize(diSetup.audioEngine);
      await bass.initialize(diSetup.audioEngine);

      instruments.set('metronome', metronome);
      instruments.set('drums', drums);
      instruments.set('bass', bass);

      // Verify all instruments are ready
      for (const [name, instrument] of instruments) {
        expect(instrument.state.isInitialized).toBe(true);
        expect(instrument.state.error).toBeNull();
      }

      // Verify audioEngine was used consistently
      expect(diSetup.audioEngine.createSampler).toHaveBeenCalled();
    });

    it('should support mixing system integration', () => {
      // Create a complete mixing setup
      const masterBus = new Bus({
        busId: 'master',
        name: 'Master Bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      const drumsBus = new Bus({
        busId: 'drums',
        name: 'Drums Bus',
        type: 'sub',
        parentBusId: 'master',
        audioEngine: diSetup.audioEngine,
      });

      const bassChannel = new Channel({
        channelId: 'bass',
        name: 'Bass Channel',
        outputBus: 'master',
        audioEngine: diSetup.audioEngine,
      });

      const kickChannel = new Channel({
        channelId: 'kick',
        name: 'Kick Channel',
        outputBus: 'drums',
        audioEngine: diSetup.audioEngine,
      });

      // Connect channels to buses
      masterBus.connectChannel('bass', bassChannel);
      drumsBus.connectChannel('kick', kickChannel);
      masterBus.addChildBus('drums');

      // Verify routing
      expect(masterBus.getConnectedChannelIds()).toContain('bass');
      expect(drumsBus.getConnectedChannelIds()).toContain('kick');
      expect(masterBus.getChildBusIds()).toContain('drums');

      // Test parameter changes
      bassChannel.setVolume(0.8);
      kickChannel.setPan(-0.2);
      drumsBus.setGain(0.9);

      // Verify all mock calls were made
      expect(diSetup.audioEngine.createGain).toHaveBeenCalled();
      expect(diSetup.audioEngine.createPanner).toHaveBeenCalled();
    });
  });

  describe('Cross-Component Communication', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should handle instrument -> channel -> bus signal flow', async () => {
      // Create the signal chain
      const bass = new BassInstrument(
        {
          id: 'bass',
          name: 'Bass',
          type: 'bass',
        },
        diSetup.audioEngine,
      );

      const channel = new Channel({
        channelId: 'bass-channel',
        name: 'Bass Channel',
        audioEngine: diSetup.audioEngine,
      });

      const bus = new Bus({
        busId: 'master',
        name: 'Master Bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      await bass.initialize();

      // Connect signal chain
      bus.connectChannel('bass-channel', channel);
      bass.connect(channel.getInput());

      // Trigger a note
      bass.trigger({
        audioTime: 0,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { note: 'E1', fret: 0, string: 0 },
      });

      // Verify the signal flow
      expect(bus.getConnectedChannelIds()).toContain('bass-channel');

      // Verify instrument triggered
      const mockSampler =
        diSetup.audioEngine.createSampler.mock.results[0].value;
      expect(mockSampler.triggerAttackRelease).toHaveBeenCalled();
    });

    it('should handle synchronized parameter changes', async () => {
      // Create multiple instruments
      const instruments = await Promise.all(
        [
          new BassInstrument(
            { id: 'bass', type: 'bass', name: 'Bass' },
            diSetup.audioEngine,
          ),
          new DrumKit(
            { id: 'drums', type: 'drums', name: 'Drums' },
            diSetup.audioEngine,
          ),
          new Metronome(
            { type: 'metronome', name: 'Metronome' },
            diSetup.audioEngine,
          ),
        ].map(async (instrument) => {
          await instrument.initialize();
          return instrument;
        }),
      );

      // Create channels for each
      const channels = instruments.map(
        (instrument, i) =>
          new Channel({
            channelId: `channel-${i}`,
            name: `Channel ${i}`,
            audioEngine: diSetup.audioEngine,
          }),
      );

      // Apply synchronized changes
      const volumeChanges = [0.6, 0.7, 0.8];
      const panChanges = [-0.3, 0, 0.3];

      channels.forEach((channel, i) => {
        channel.setVolume(volumeChanges[i], 0.1);
        channel.setPan(panChanges[i], 0.1);
      });

      // Verify all channels updated
      channels.forEach((channel, i) => {
        expect(channel.getState().volume).toBe(volumeChanges[i]);
        expect(channel.getState().pan).toBe(panChanges[i]);
      });

      // Verify audioEngine was used to create nodes for channels
      expect(diSetup.audioEngine.createGain.mock.calls.length).toBeGreaterThan(
        0,
      );

      // Get all created gain nodes
      const gainNodes = diSetup.audioEngine.createGain.mock.results
        .map((result) => result.value)
        .filter((node) => node && node.gain && node.gain.rampTo);

      // Verify rampTo was called on at least some nodes
      const rampToCalls = gainNodes.reduce((count, node) => {
        return count + (node.gain.rampTo.mock.calls.length > 0 ? 1 : 0);
      }, 0);

      expect(rampToCalls).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should handle rapid instrument creation and disposal', async () => {
      const cycles = 10;

      for (let i = 0; i < cycles; i++) {
        // Create instruments
        const instruments = [
          new BassInstrument(
            { id: `bass-${i}`, type: 'bass', name: `Bass ${i}` },
            diSetup.audioEngine,
          ),
          new DrumKit(
            { id: `drums-${i}`, type: 'drums', name: `Drums ${i}` },
            diSetup.audioEngine,
          ),
        ];

        // Initialize
        await Promise.all(instruments.map((inst) => inst.initialize()));

        // Verify initialization
        instruments.forEach((inst) => {
          expect(inst.state.isInitialized).toBe(true);
        });

        // Dispose
        await Promise.all(instruments.map((inst) => inst.dispose()));

        // Verify disposal
        instruments.forEach((inst) => {
          expect(inst.state.isInitialized).toBe(false);
        });
      }

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should handle concurrent initialization', async () => {
      const instrumentCount = 50;

      // Create many instruments concurrently
      const instruments = Array.from({ length: instrumentCount }, (_, i) => {
        const type = ['bass', 'drums'][i % 2];
        return type === 'bass'
          ? new BassInstrument(
              { id: `bass-${i}`, type: 'bass', name: `Bass ${i}` },
              diSetup.audioEngine,
            )
          : new DrumKit(
              { id: `drums-${i}`, type: 'drums', name: `Drums ${i}` },
              diSetup.audioEngine,
            );
      });

      const startTime = performance.now();

      // Initialize all concurrently
      await Promise.all(instruments.map((inst) => inst.initialize()));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 50 instruments

      // All should be initialized
      instruments.forEach((inst) => {
        expect(inst.state.isInitialized).toBe(true);
      });

      // Factory methods should have been called many times
      expect(diSetup.audioEngine.createSampler.mock.calls.length).toBe(
        instrumentCount,
      );
    });
  });

  describe('Memory Management', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should properly dispose all created audio nodes', async () => {
      const instruments = [
        new BassInstrument(
          { id: 'bass', type: 'bass', name: 'Bass' },
          diSetup.audioEngine,
        ),
        new DrumKit(
          { id: 'drums', type: 'drums', name: 'Drums' },
          diSetup.audioEngine,
        ),
      ];

      const channels = [
        new Channel({ channelId: 'bass-ch', audioEngine: diSetup.audioEngine }),
        new Channel({
          channelId: 'drums-ch',
          audioEngine: diSetup.audioEngine,
        }),
      ];

      const buses = [
        new Bus({
          busId: 'master',
          type: 'master',
          audioEngine: diSetup.audioEngine,
        }),
        new Bus({
          busId: 'sub',
          type: 'sub',
          audioEngine: diSetup.audioEngine,
        }),
      ];

      // Initialize everything
      await Promise.all(instruments.map((inst) => inst.initialize()));

      // Get all created nodes from audioEngine factory methods
      const factoryMethods = [
        'createGain',
        'createVolume',
        'createSampler',
        'createPanner',
        'createEQ3',
        'createFilter',
        'createMeter',
        'createAnalyser',
        'createCompressor',
        'createLimiter',
        'createGate',
      ];

      const createdNodes: any[] = [];

      // Collect all nodes created by the audioEngine
      factoryMethods.forEach((method) => {
        const mockFn = diSetup.audioEngine[method];
        if (mockFn && mockFn.mock && mockFn.mock.results) {
          mockFn.mock.results.forEach((result: any) => {
            if (result && result.value) {
              createdNodes.push(result.value);
            }
          });
        }
      });

      // Verify we created some nodes
      expect(createdNodes.length).toBeGreaterThan(0);

      // Dispose everything
      await Promise.all(instruments.map((inst) => inst.dispose()));
      channels.forEach((ch) => ch.dispose());
      buses.forEach((bus) => bus.dispose());

      // Verify all nodes with dispose methods were called
      const nodesWithDispose = createdNodes.filter(
        (node) => node && node.dispose && typeof node.dispose === 'function',
      );

      expect(nodesWithDispose.length).toBeGreaterThan(0);

      nodesWithDispose.forEach((node) => {
        expect(node.dispose).toHaveBeenCalled();
      });
    });
  });
});
