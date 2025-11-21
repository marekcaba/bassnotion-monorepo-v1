/**
 * Metronome Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import mock utilities
import { createMockAudioEngine, mockTone } from './mocks/mockAudioEngine.js';

// Mock toneLoader to return our mockTone
vi.mock('../../../services/plugins/toneLoader.js', () => ({
  loadGlobalTone: vi.fn(() => Promise.resolve(mockTone)),
}));

// Mock useCorrelation
vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: vi.fn(() => ({
    correlationId: 'test-correlation-id',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  })),
}));

import { Metronome } from '../implementations/metronome/Metronome.js';
import type { MetronomeInstrumentConfig } from '../implementations/metronome/Metronome.js';
import type { InstrumentEvent } from '../types/index.js';
import { loadGlobalTone } from '../../shared/loaders/toneLoader.js';

// Mock logger globally
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
(globalThis as any).logger = mockLogger;

// Create mock AudioEngine
const mockAudioEngine = createMockAudioEngine();

describe('Metronome', () => {
  let metronome: Metronome;
  let config: MetronomeInstrumentConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    vi.clearAllMocks();

    // Ensure loadGlobalTone returns mockTone
    vi.mocked(loadGlobalTone).mockResolvedValue(mockTone);

    config = {
      type: 'metronome',
      name: 'Test Metronome',
      clickSounds: {
        click: 'http://example.com/click.wav',
        accent: 'http://example.com/accent.wav',
      },
      tempo: 140,
      timeSignature: '4/4',
      clickVolume: 0.8,
      accentVolume: 0.9,
    };

    metronome = new Metronome(config, mockAudioEngine);
  });

  afterEach(async () => {
    if (metronome) {
      await metronome.dispose();
    }
  });

  describe('initialization', () => {
    it('should initialize with config values', () => {
      expect(metronome.type).toBe('metronome');
      expect(metronome.name).toBe('Test Metronome');
      expect(metronome.state.isInitialized).toBe(false);
    });

    it('should initialize the processor', async () => {
      await metronome.initialize();

      expect(metronome.state.isInitialized).toBe(true);
      expect(metronome.state.isLoading).toBe(false);
    });

    it('should handle initialization errors', async () => {
      // Create a metronome with a mock processor that fails to initialize
      const failingMetronome = new Metronome(config);

      // Mock the processor's initialize method to throw an error
      const mockProcessor = (failingMetronome as any).processor;
      mockProcessor.initialize = vi
        .fn()
        .mockRejectedValueOnce(new Error('Init failed'));

      await expect(failingMetronome.initialize()).rejects.toThrow(
        'Init failed',
      );
      expect(failingMetronome.state.error).toContain(
        'Failed to initialize metronome: Error: Init failed',
      );
    });
  });

  describe('triggering', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should trigger click events', () => {
      const event: InstrumentEvent = {
        audioTime: 1.0,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { type: 'click' },
      };

      metronome.trigger(event);
      expect(metronome.state.isPlaying).toBe(true);
    });

    it('should trigger accent events', () => {
      const event: InstrumentEvent = {
        audioTime: 2.0,
        timestamp: Date.now(),
        velocity: 1.0,
        data: { type: 'accent' },
      };

      metronome.trigger(event);
      expect(metronome.state.isPlaying).toBe(true);
    });

    it('should not trigger if not initialized', () => {
      const uninitializedMetronome = new Metronome(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      uninitializedMetronome.trigger({
        audioTime: 1.0,
        timestamp: Date.now(),
      });

      // Check that console.warn was called with structured logging format
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0][0];
      expect(callArgs).toContain('Metronome Test Metronome not initialized');
      expect(callArgs).toContain('"level":"WARN"');
      consoleSpy.mockRestore();
    });
  });

  describe('transport controls', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should start the metronome', () => {
      metronome.start();
      expect(metronome.state.isPlaying).toBe(true);
    });

    it('should stop the metronome', () => {
      metronome.start();
      metronome.stop();
      expect(metronome.state.isPlaying).toBe(false);
    });
  });

  describe('tempo control', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should set tempo immediately', () => {
      metronome.setTempo(160);
      // Verify the tempo was set in internal state
      expect((metronome as any).tempo).toBe(160);
    });

    it('should set tempo with transition', () => {
      metronome.setTempo(100, 2.5);
      expect((metronome as any).tempo).toBe(100);
    });

    it('should tap tempo', () => {
      // Just verify the method exists and doesn't throw
      expect(() => metronome.tapTempo()).not.toThrow();
    });
  });

  describe('time signature', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should set common time signature', () => {
      metronome.setTimeSignature('3/4');
      expect((metronome as any).timeSignature).toBe('3/4');
    });

    it('should create custom time signature', () => {
      metronome.setTimeSignature('5/4');
      expect((metronome as any).timeSignature).toBe('5/4');
    });
  });

  describe('parameter updates', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should update tempo via updateParams', () => {
      metronome.updateParams({ tempo: 180 });
      expect((metronome as any).tempo).toBe(180);
    });

    it('should update time signature via updateParams', () => {
      metronome.updateParams({ timeSignature: '6/8' });
      expect((metronome as any).timeSignature).toBe('6/8');
    });

    it('should update click volume', () => {
      expect(() => metronome.updateParams({ clickVolume: 0.5 })).not.toThrow();
    });

    it('should update accent volume', () => {
      expect(() => metronome.updateParams({ accentVolume: 0.7 })).not.toThrow();
    });
  });

  describe('volume control', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should apply volume scaling', () => {
      expect(() => metronome.setVolume(0.5)).not.toThrow();
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should report metrics when playing', () => {
      metronome.start();
      const metrics = metronome.getMetrics();

      expect(metrics.cpuUsage).toBe(1);
      expect(metrics.voiceCount).toBe(1);
      expect(metrics.latency).toBe(25);
    });

    it('should report zero metrics when stopped', () => {
      const metrics = metronome.getMetrics();

      expect(metrics.cpuUsage).toBe(0);
      expect(metrics.voiceCount).toBe(0);
    });
  });

  describe('state access', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should get metronome state', () => {
      const state = metronome.getMetronomeState();
      // Just verify it returns something without throwing
      expect(state).toBeDefined();
    });

    it('should register event callbacks', () => {
      const callback = vi.fn();
      expect(() => metronome.onMetronomeEvent(callback)).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should dispose processor', async () => {
      await metronome.initialize();
      await metronome.dispose();

      expect(metronome.state.isInitialized).toBe(false);
      expect(metronome.state.isPlaying).toBe(false);
    });
  });
});
