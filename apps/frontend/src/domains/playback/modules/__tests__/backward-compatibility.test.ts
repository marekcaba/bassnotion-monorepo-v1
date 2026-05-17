/**
 * Backward Compatibility Tests
 *
 * These tests verify that the dependency injection refactoring
 * maintains backward compatibility with existing code that doesn't
 * use the new DI pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BassInstrument } from '../instruments/implementations/bass/BassInstrument.js';
import { DrumKit } from '../instruments/implementations/drums/DrumKit.js';
import { Metronome } from '../instruments/implementations/metronome/Metronome.js';
import { Channel } from '../tracks/mixing/Channel.js';
import { Bus } from '../tracks/mixing/Bus.js';

// Mock Tone.js
const mockToneNode = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  toDestination: vi.fn().mockReturnThis(),
});

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  context: {
    state: 'running',
    _context: {},
  },
  Gain: vi.fn(() => ({
    ...mockToneNode(),
    gain: { value: 1 },
  })),
  Panner: vi.fn(() => ({
    ...mockToneNode(),
    pan: { value: 0 },
  })),
  EQ3: vi.fn(() => mockToneNode()),
  Volume: vi.fn(() => ({
    ...mockToneNode(),
    volume: { value: 0 },
  })),
  Meter: vi.fn(() => ({
    ...mockToneNode(),
    getValue: vi.fn(() => -60),
  })),
  Analyser: vi.fn(() => ({
    ...mockToneNode(),
    getValue: vi.fn(() => new Float32Array(512)),
  })),
  Filter: vi.fn(() => mockToneNode()),
  Compressor: vi.fn(() => mockToneNode()),
  Limiter: vi.fn(() => mockToneNode()),
  Gate: vi.fn(() => mockToneNode()),
  Synth: vi.fn(() => ({
    ...mockToneNode(),
    triggerAttackRelease: vi.fn(),
  })),
  Destination: {
    connect: vi.fn(),
  },
}));

describe('Backward Compatibility Tests', () => {
  describe('Instruments without DI', () => {
    it('should create BassInstrument without audioEngine', () => {
      const config = {
        id: 'test-bass',
        name: 'Test Bass',
        type: 'bass' as const,
      };

      // This should work without throwing
      const bass = new BassInstrument(config);

      expect(bass).toBeDefined();
      expect(bass.id).toBe('test-bass');
      expect(bass.type).toBe('bass');
    });

    it('should create DrumKit without audioEngine', () => {
      const config = {
        id: 'test-drums',
        name: 'Test Drums',
        type: 'drums' as const,
      };

      // This should work without throwing
      const drums = new DrumKit(config);

      expect(drums).toBeDefined();
      expect(drums.id).toBe('test-drums');
      expect(drums.type).toBe('drums');
    });

    it('should create Metronome without audioEngine', () => {
      const config = {
        type: 'metronome' as const,
        name: 'Test Metronome',
      };

      // This should work without throwing
      const metronome = new Metronome(config);

      expect(metronome).toBeDefined();
      expect(metronome.type).toBe('metronome');
      expect(metronome.name).toBe('Test Metronome');
    });
  });

  describe('Mixing components without DI', () => {
    it('should create Channel without audioEngine', () => {
      const config = {
        channelId: 'test-channel',
        name: 'Test Channel',
      };

      // This should work without throwing
      const channel = new Channel(config);

      expect(channel).toBeDefined();
      expect(channel.id).toBe('test-channel');
      expect(channel.name).toBe('Test Channel');
    });

    it('should create Bus without audioEngine', () => {
      const config = {
        busId: 'test-bus',
        name: 'Test Bus',
        type: 'sub' as const,
      };

      // This should work without throwing
      const bus = new Bus(config);

      expect(bus).toBeDefined();
      expect(bus.id).toBe('test-bus');
      expect(bus.name).toBe('Test Bus');
      expect(bus.type).toBe('sub');
    });
  });

  describe('Window globals fallback', () => {
    beforeEach(() => {
      // Setup minimal window.__coreServices
      (global as any).window = {
        navigator: {
          userAgent: 'Mozilla/5.0 (Testing) AppleWebKit/537.36',
        },
        location: {
          hostname: 'localhost',
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        __coreServices: {
          getAudioEngine: vi.fn(() => ({
            isReady: vi.fn(() => true),
            getTone: vi.fn(() => ({
              start: vi.fn().mockResolvedValue(undefined),
              context: {
                state: 'running',
                _context: {},
              },
            })),
          })),
        },
      };
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it('should use window.__coreServices when no audioEngine provided', async () => {
      const { loadGlobalTone } =
        await import('../shared/loaders/toneLoader.js');

      // Should use window.__coreServices
      const tone = await loadGlobalTone();

      expect(tone).toBeDefined();
      expect(
        (global as any).window.__coreServices.getAudioEngine,
      ).toHaveBeenCalled();
    });

    it('should accept provided audioEngine parameter', async () => {
      const mockAudioEngine = {
        isReady: vi.fn(() => true),
        getTone: vi.fn(() => ({
          start: vi.fn().mockResolvedValue(undefined),
          context: {
            state: 'running',
            _context: {},
          },
        })),
      };

      const { loadGlobalTone } =
        await import('../shared/loaders/toneLoader.js');

      // Should not throw when audioEngine is provided
      await expect(loadGlobalTone(mockAudioEngine)).resolves.toBeDefined();
    });
  });

  describe('Processor backward compatibility', () => {
    it('should create BassInstrumentProcessor without audioEngine', async () => {
      const { BassInstrumentProcessor } =
        await import('../instruments/implementations/bass/BassInstrumentProcessor.js');

      const config = {
        noteRange: {
          lowest: 'B0',
          highest: 'G4',
          totalNotes: 41,
        },
      };

      // This should work without throwing
      const processor = new BassInstrumentProcessor(config);

      expect(processor).toBeDefined();
    });

    it('should create DrumInstrumentProcessor without audioEngine', async () => {
      const { DrumInstrumentProcessor } =
        await import('../instruments/implementations/drums/DrumInstrumentProcessor.js');

      const config = {
        generalMidiCompliance: true,
        velocityLayers: 4,
      };

      // This should work without throwing
      const processor = new DrumInstrumentProcessor(config);

      expect(processor).toBeDefined();
    });
  });

  describe('Real-world usage patterns', () => {
    it('should handle mixed usage (some with DI, some without)', () => {
      const mockAudioEngine = {
        createGain: vi.fn(() => ({
          gain: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          dispose: vi.fn(),
        })),
      };

      // Create one with DI
      const bassWithDI = new BassInstrument(
        {
          id: 'bass-di',
          name: 'Bass with DI',
          type: 'bass',
        },
        mockAudioEngine,
      );

      // Create one without DI
      const bassWithoutDI = new BassInstrument({
        id: 'bass-no-di',
        name: 'Bass without DI',
        type: 'bass',
      });

      // Both should work
      expect(bassWithDI).toBeDefined();
      expect(bassWithoutDI).toBeDefined();
      expect(bassWithDI.id).toBe('bass-di');
      expect(bassWithoutDI.id).toBe('bass-no-di');
    });

    it('should handle initialize without audioEngine after construction with audioEngine', async () => {
      const mockAudioEngine = {
        isReady: vi.fn(() => true),
        getTone: vi.fn(() => ({
          start: vi.fn().mockResolvedValue(undefined),
          context: {
            state: 'running',
            _context: {},
          },
          Synth: vi.fn(() => ({
            ...mockToneNode(),
            triggerAttackRelease: vi.fn(),
          })),
        })),
        createGain: vi.fn(() => ({
          gain: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        })),
        createSynth: vi.fn(() => ({
          ...mockToneNode(),
          triggerAttackRelease: vi.fn(),
        })),
      };

      // Create with audioEngine
      const metronome = new Metronome(
        {
          type: 'metronome',
          name: 'Test',
        },
        mockAudioEngine,
      );

      // Initialize without audioEngine - should use the one from constructor
      await expect(metronome.initialize()).resolves.not.toThrow();
    });
  });
});
