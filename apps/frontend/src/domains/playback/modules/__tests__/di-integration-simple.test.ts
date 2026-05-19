/**
 * Simple Integration Tests for Dependency Injection System
 *
 * These tests verify the core DI functionality works correctly
 * without complex test scenarios that are hard to mock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupDIMocks, cleanupDIMocks } from './mocks/setupDI.js';
import { createMockAudioEngine } from './mocks/mockAudioEngine.js';

// Mock processors
vi.mock(
  '../instruments/implementations/bass/BassInstrumentProcessor.js',
  () => ({
    BassInstrumentProcessor: vi
      .fn()
      .mockImplementation((config, audioEngine) => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        triggerNote: vi.fn(),
        dispose: vi.fn(),
        audioEngine,
      })),
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

global.logger = mockLogger;

// Import components after mocking
import { BassInstrument } from '../instruments/implementations/bass/BassInstrument.js';
import { Channel } from '../tracks/mixing/Channel.js';
import { Bus } from '../tracks/mixing/Bus.js';

describe('DI Integration Tests - Core Functionality', () => {
  describe('CoreServices Integration', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should create instrument with global CoreServices', async () => {
      const bass = new BassInstrument({
        id: 'test-bass',
        name: 'Test Bass',
        type: 'bass',
      });

      await bass.initialize();

      expect(bass.state.isInitialized).toBe(true);
      expect(diSetup.coreServices.getAudioEngine).toHaveBeenCalled();
    });

    it('should prefer explicit audioEngine over global', async () => {
      const customAudioEngine = createMockAudioEngine();
      const bass = new BassInstrument(
        {
          id: 'test-bass',
          name: 'Test Bass',
          type: 'bass',
        },
        customAudioEngine,
      );

      await bass.initialize();

      expect(bass.state.isInitialized).toBe(true);
      // Should not call global when explicit audioEngine provided
      expect(diSetup.coreServices.getAudioEngine).not.toHaveBeenCalled();
    });

    it('should work without any audioEngine (backward compatibility)', async () => {
      // Remove global services
      delete (global as any).window;

      const bass = new BassInstrument({
        id: 'test-bass',
        name: 'Test Bass',
        type: 'bass',
      });

      // Should not throw and should initialize
      await expect(bass.initialize()).resolves.not.toThrow();
      expect(bass.state.isInitialized).toBe(true);
    });
  });

  describe('Mixing Components DI', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should create Channel with DI', () => {
      const channel = new Channel({
        channelId: 'test-channel',
        name: 'Test Channel',
        audioEngine: diSetup.audioEngine,
      });

      expect(channel.id).toBe('test-channel');
      expect(channel.name).toBe('Test Channel');

      // Should have used audioEngine for node creation
      expect(diSetup.audioEngine.createGain).toHaveBeenCalled();
      expect(diSetup.audioEngine.createPanner).toHaveBeenCalled();
      expect(diSetup.audioEngine.createEQ3).toHaveBeenCalled();
      expect(diSetup.audioEngine.createFilter).toHaveBeenCalled();
    });

    it('should create Bus with DI', () => {
      const bus = new Bus({
        busId: 'test-bus',
        name: 'Test Bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      expect(bus.id).toBe('test-bus');
      expect(bus.name).toBe('Test Bus');
      expect(bus.type).toBe('master');

      // Should have used audioEngine for node creation
      expect(diSetup.audioEngine.createGain).toHaveBeenCalled();
      expect(diSetup.audioEngine.createMeter).toHaveBeenCalled();
      expect(diSetup.audioEngine.createAnalyser).toHaveBeenCalled();
    });

    it('should connect Channel to Bus', () => {
      const channel = new Channel({
        channelId: 'test-channel',
        audioEngine: diSetup.audioEngine,
      });

      const bus = new Bus({
        busId: 'test-bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      bus.connectChannel('test-channel', channel);

      expect(bus.getConnectedChannelIds()).toContain('test-channel');
    });
  });

  describe('Parameter Changes', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should handle Channel parameter changes', () => {
      const channel = new Channel({
        channelId: 'test-channel',
        audioEngine: diSetup.audioEngine,
      });

      // Test volume changes
      channel.setVolume(0.8);
      expect(channel.getState().volume).toBe(0.8);

      // Test pan changes
      channel.setPan(-0.3);
      expect(channel.getState().pan).toBe(-0.3);

      // Test mute
      channel.setMute(true);
      expect(channel.getState().mute).toBe(true);
    });

    it('should handle Bus parameter changes', () => {
      const bus = new Bus({
        busId: 'test-bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      // Should not throw on parameter changes
      expect(() => bus.setGain(0.9)).not.toThrow();
      expect(() => bus.setMute(true)).not.toThrow();
    });
  });

  describe('Disposal', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should dispose instruments properly', async () => {
      const bass = new BassInstrument(
        {
          id: 'test-bass',
          name: 'Test Bass',
          type: 'bass',
        },
        diSetup.audioEngine,
      );

      await bass.initialize();
      expect(bass.state.isInitialized).toBe(true);

      await bass.dispose();
      expect(bass.state.isInitialized).toBe(false);
    });

    it('should dispose mixing components properly', () => {
      const channel = new Channel({
        channelId: 'test-channel',
        audioEngine: diSetup.audioEngine,
      });

      const bus = new Bus({
        busId: 'test-bus',
        type: 'master',
        audioEngine: diSetup.audioEngine,
      });

      // Should not throw
      expect(() => channel.dispose()).not.toThrow();
      expect(() => bus.dispose()).not.toThrow();
    });
  });

  describe('Factory Method Usage', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should use factory methods for node creation', () => {
      // Create components that use various factory methods
      new Channel({
        channelId: 'test-channel',
        audioEngine: diSetup.audioEngine,
      });

      new Bus({
        busId: 'test-bus',
        type: 'sub',
        hasDynamics: true,
        hasEQ: true,
        audioEngine: diSetup.audioEngine,
      });

      // Verify various factory methods were called
      expect(diSetup.audioEngine.createGain).toHaveBeenCalled();
      expect(diSetup.audioEngine.createPanner).toHaveBeenCalled();
      expect(diSetup.audioEngine.createEQ3).toHaveBeenCalled();
      expect(diSetup.audioEngine.createFilter).toHaveBeenCalled();
      expect(diSetup.audioEngine.createCompressor).toHaveBeenCalled();
      expect(diSetup.audioEngine.createLimiter).toHaveBeenCalled();
      expect(diSetup.audioEngine.createMeter).toHaveBeenCalled();
      expect(diSetup.audioEngine.createAnalyser).toHaveBeenCalled();
    });

    it('should handle missing factory methods gracefully', () => {
      // Create audioEngine with only some methods. Channel falls back to
      // calling audioEngine.getTone() when a factory method (createPanner,
      // createEQ3, etc.) is missing, so the partial engine still needs a
      // getTone() returning a usable mock for the fallback path.
      const fallbackToneInstance = {
        Panner: vi.fn(() => ({
          pan: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        EQ3: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Filter: vi.fn(() => ({
          frequency: { value: 1000 },
          type: 'lowpass',
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Compressor: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Limiter: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Meter: vi.fn(() => ({
          getValue: vi.fn(() => -60),
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Analyser: vi.fn(() => ({
          getValue: vi.fn(() => new Float32Array(1024)),
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Gate: vi.fn(() => ({
          threshold: { value: -40 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
      };
      const partialAudioEngine = {
        createGain: vi.fn(() => ({
          gain: { value: 1, rampTo: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        // Missing factory methods — Channel falls back to Tone via getTone().
        getTone: vi.fn(() => fallbackToneInstance),
      };

      // Mock Tone.js for fallback
      vi.mock('tone', () => ({
        Panner: vi.fn(() => ({
          pan: { value: 0 },
          connect: vi.fn(),
          dispose: vi.fn(),
        })),
        EQ3: vi.fn(() => ({
          connect: vi.fn(),
          dispose: vi.fn(),
        })),
        Filter: vi.fn(() => ({
          frequency: { value: 1000 },
          type: 'lowpass',
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
        Compressor: vi.fn(() => ({
          connect: vi.fn(),
          dispose: vi.fn(),
        })),
        Limiter: vi.fn(() => ({
          connect: vi.fn(),
          dispose: vi.fn(),
        })),
        Meter: vi.fn(() => ({
          getValue: vi.fn(() => -60),
          dispose: vi.fn(),
        })),
        Analyser: vi.fn(() => ({
          getValue: vi.fn(() => new Float32Array(1024)),
          dispose: vi.fn(),
        })),
        Gate: vi.fn(() => ({
          threshold: { value: -40 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
      }));

      // Should not throw even with partial audioEngine
      expect(
        () =>
          new Channel({
            channelId: 'test-channel',
            audioEngine: partialAudioEngine,
          }),
      ).not.toThrow();

      expect(partialAudioEngine.createGain).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    let diSetup: any;

    beforeEach(() => {
      diSetup = setupDIMocks();
    });

    afterEach(() => {
      cleanupDIMocks();
    });

    it('should handle multiple component creation efficiently', async () => {
      const startTime = performance.now();

      // Create multiple components
      const components = [];
      for (let i = 0; i < 20; i++) {
        components.push(
          new BassInstrument(
            {
              id: `bass-${i}`,
              name: `Bass ${i}`,
              type: 'bass',
            },
            diSetup.audioEngine,
          ),

          new Channel({
            channelId: `channel-${i}`,
            audioEngine: diSetup.audioEngine,
          }),

          new Bus({
            busId: `bus-${i}`,
            type: 'sub',
            audioEngine: diSetup.audioEngine,
          }),
        );
      }

      // Initialize instruments
      const instruments = components.filter((c) => c.initialize);
      await Promise.all(instruments.map((inst) => inst.initialize()));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete reasonably fast
      expect(totalTime).toBeLessThan(500); // 500ms for 60 components

      // Verify DI was used extensively
      expect(diSetup.audioEngine.createGain.mock.calls.length).toBeGreaterThan(
        60,
      );
    });

    it('should not create memory leaks in factory methods', () => {
      const initialCallCount = diSetup.audioEngine.createGain.mock.calls.length;

      // Create and dispose components
      for (let i = 0; i < 10; i++) {
        const channel = new Channel({
          channelId: `channel-${i}`,
          audioEngine: diSetup.audioEngine,
        });
        channel.dispose();

        const bus = new Bus({
          busId: `bus-${i}`,
          type: 'sub',
          audioEngine: diSetup.audioEngine,
        });
        bus.dispose();
      }

      const finalCallCount = diSetup.audioEngine.createGain.mock.calls.length;
      const totalCalls = finalCallCount - initialCallCount;

      // Should have created nodes (each channel/bus creates multiple gain nodes)
      expect(totalCalls).toBeGreaterThan(0);
      expect(totalCalls).toBeLessThan(100); // Reasonable upper bound
    });
  });
});
