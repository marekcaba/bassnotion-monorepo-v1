/**
 * Metronome Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Metronome } from '../implementations/metronome/Metronome.js';
import type { MetronomeInstrumentConfig } from '../implementations/metronome/Metronome.js';
import type { InstrumentEvent } from '../types/index.js';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Set global logger for the mocked module
(global as any).logger = mockLogger;

// Mock window and CoreServices
(global as any).window = {
  __coreServices: {
    tone: {
      context: { currentTime: 0 },
    },
  },
};

// Mock CoreServices and toneLoader first
vi.mock('../../../../services/plugins/toneLoader.js', () => ({
  loadGlobalTone: vi.fn().mockResolvedValue({
    context: { currentTime: 0 },
  }),
}));

// Mock the MetronomeInstrumentProcessor
vi.mock('../../../../services/plugins/MetronomeInstrumentProcessor.js', () => ({
  MetronomeInstrumentProcessor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    triggerClick: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setTempo: vi.fn(),
    setTimeSignature: vi.fn(),
    getAvailableTimeSignatures: vi.fn().mockReturnValue({
      '4/4': { numerator: 4, denominator: 4, display: '4/4', accentBeats: [1], strongBeats: [1] },
      '3/4': { numerator: 3, denominator: 4, display: '3/4', accentBeats: [1], strongBeats: [1] },
    }),
    createCustomTimeSignature: vi.fn().mockReturnValue({
      numerator: 5,
      denominator: 4,
      display: '5/4',
      accentBeats: [1],
      strongBeats: [1],
    }),
    tapTempo: vi.fn(),
    getState: vi.fn().mockReturnValue({
      isRunning: false,
      currentTempo: 120,
      currentMeasure: 0,
      currentBeat: 0,
      currentSubdivision: 0,
      timeSignature: { numerator: 4, denominator: 4, display: '4/4', accentBeats: [1], strongBeats: [1] },
      nextEventTime: 0,
      totalBeats: 0,
      elapsedTime: 0,
    }),
    getConfig: vi.fn().mockReturnValue({
      clickSounds: {
        regular: { type: 'electronic_beep', volume: 0.7 },
        accent: { type: 'electronic_beep', volume: 1.0 },
      },
    }),
    setCustomClickSound: vi.fn(),
    dispose: vi.fn(),
    onEvent: vi.fn(),
  })),
  ClickSoundType: {
    ELECTRONIC_BEEP: 'electronic_beep',
    ACOUSTIC_CLICK: 'acoustic_click',
    WOOD_BLOCK: 'wood_block',
    SIDE_STICK: 'side_stick',
    REGULAR: 'regular',
    ACCENT: 'accent',
    STRONG: 'strong',
  },
}));

// Mock toneLoader
vi.mock('../../../../services/plugins/toneLoader.js', () => ({
  loadGlobalTone: vi.fn().mockResolvedValue({
    start: vi.fn(),
    Transport: {},
  }),
}));

// Mock useCorrelation
vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: vi.fn(() => ({
    correlationId: 'test-correlation-id',
    logger: mockLogger,
  })),
}));

describe('Metronome', () => {
  let metronome: Metronome;
  let config: MetronomeInstrumentConfig;

  beforeEach(() => {
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

    metronome = new Metronome(config);
  });

  afterEach(async () => {
    await metronome.dispose();
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
      
      const processor = (metronome as any).processor;
      expect(processor.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          electronic_beep: 'http://example.com/click.wav',
          regular: 'http://example.com/click.wav',
          accent: 'http://example.com/accent.wav',
          strong: 'http://example.com/accent.wav',
        })
      );
    });

    it('should handle initialization errors', async () => {
      const processor = (metronome as any).processor;
      processor.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(metronome.initialize()).rejects.toThrow('Init failed');
      expect(metronome.state.error).toContain('Init failed');
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

      const processor = (metronome as any).processor;
      expect(processor.triggerClick).toHaveBeenCalledWith({
        type: 'click',
        time: 1.0,
        velocity: 0.8,
      });
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

      const processor = (metronome as any).processor;
      expect(processor.triggerClick).toHaveBeenCalledWith({
        type: 'accent',
        time: 2.0,
        velocity: 1.0,
      });
    });

    it('should not trigger if not initialized', () => {
      const uninitializedMetronome = new Metronome(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      uninitializedMetronome.trigger({
        audioTime: 1.0,
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Metronome Test Metronome not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('transport controls', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should start the metronome', () => {
      metronome.start();

      const processor = (metronome as any).processor;
      expect(processor.start).toHaveBeenCalled();
      expect(metronome.state.isPlaying).toBe(true);
    });

    it('should stop the metronome', () => {
      metronome.start();
      metronome.stop();

      const processor = (metronome as any).processor;
      expect(processor.stop).toHaveBeenCalled();
      expect(metronome.state.isPlaying).toBe(false);
    });
  });

  describe('tempo control', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should set tempo immediately', () => {
      metronome.setTempo(160);

      const processor = (metronome as any).processor;
      expect(processor.setTempo).toHaveBeenCalledWith(160, undefined);
    });

    it('should set tempo with transition', () => {
      metronome.setTempo(100, 2.5);

      const processor = (metronome as any).processor;
      expect(processor.setTempo).toHaveBeenCalledWith(100, 2.5);
    });

    it('should tap tempo', () => {
      metronome.tapTempo();

      const processor = (metronome as any).processor;
      expect(processor.tapTempo).toHaveBeenCalled();
    });
  });

  describe('time signature', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should set common time signature', () => {
      metronome.setTimeSignature('3/4');

      const processor = (metronome as any).processor;
      expect(processor.setTimeSignature).toHaveBeenCalledWith({
        numerator: 3,
        denominator: 4,
        display: '3/4',
        accentBeats: [1],
        strongBeats: [1],
      });
    });

    it('should create custom time signature', () => {
      metronome.setTimeSignature('5/4');

      const processor = (metronome as any).processor;
      expect(processor.createCustomTimeSignature).toHaveBeenCalledWith(5, 4, [1]);
      expect(processor.setTimeSignature).toHaveBeenCalled();
    });
  });

  describe('parameter updates', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should update tempo via updateParams', () => {
      metronome.updateParams({ tempo: 180 });

      const processor = (metronome as any).processor;
      expect(processor.setTempo).toHaveBeenCalledWith(180, undefined);
    });

    it('should update time signature via updateParams', () => {
      metronome.updateParams({ timeSignature: '6/8' });

      const processor = (metronome as any).processor;
      expect(processor.createCustomTimeSignature).toHaveBeenCalledWith(6, 8, [1]);
    });

    it('should update click volume', () => {
      metronome.updateParams({ clickVolume: 0.5 });

      const processor = (metronome as any).processor;
      expect(processor.setCustomClickSound).toHaveBeenCalledWith(
        'regular',
        expect.objectContaining({ volume: 0.5 })
      );
    });

    it('should update accent volume', () => {
      metronome.updateParams({ accentVolume: 0.7 });

      const processor = (metronome as any).processor;
      expect(processor.setCustomClickSound).toHaveBeenCalledWith(
        'accent',
        expect.objectContaining({ volume: 0.7, pitch: 200 })
      );
    });
  });

  describe('volume control', () => {
    beforeEach(async () => {
      await metronome.initialize();
    });

    it('should apply volume scaling', () => {
      metronome.setVolume(0.5);

      const processor = (metronome as any).processor;
      // Should update both regular and accent volumes
      expect(processor.setCustomClickSound).toHaveBeenCalledTimes(2);
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

      expect(state).toEqual({
        isRunning: false,
        currentTempo: 120,
        currentMeasure: 0,
        currentBeat: 0,
        currentSubdivision: 0,
        timeSignature: expect.any(Object),
        nextEventTime: 0,
        totalBeats: 0,
        elapsedTime: 0,
      });
    });

    it('should register event callbacks', () => {
      const callback = vi.fn();
      metronome.onMetronomeEvent(callback);

      const processor = (metronome as any).processor;
      expect(processor.onEvent).toHaveBeenCalledWith(callback);
    });
  });

  describe('disposal', () => {
    it('should dispose processor', async () => {
      await metronome.initialize();
      await metronome.dispose();

      const processor = (metronome as any).processor;
      expect(processor.dispose).toHaveBeenCalled();
      expect(metronome.state.isInitialized).toBe(false);
      expect(metronome.state.isPlaying).toBe(false);
    });
  });
});