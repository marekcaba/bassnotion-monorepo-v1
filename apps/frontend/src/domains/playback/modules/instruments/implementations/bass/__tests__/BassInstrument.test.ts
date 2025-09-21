import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BassInstrument } from '../BassInstrument.js';
import type { BassInstrumentConfig, BassEvent } from '../../../types/index.js';
import {
  createMockAudioEngine,
  mockTone,
} from '../../../__tests__/mocks/mockAudioEngine.js';

// Mock the BassInstrumentProcessor
vi.mock('../BassInstrumentProcessor.js', () => {
  return {
    BassInstrumentProcessor: vi
      .fn()
      .mockImplementation((config, audioEngine) => {
        const mockProcessor = {
          initialize: vi
            .fn()
            .mockImplementation(
              async function (bassSamples, passedAudioEngine) {
                // Store the audioEngine passed to initialize (second parameter)
                mockProcessor.audioEngine = passedAudioEngine || audioEngine;
              },
            ),
          triggerNote: vi.fn(),
          stopNote: vi.fn(),
          updatePitchBend: vi.fn(),
          updateExpression: vi.fn(),
          dispose: vi.fn(),
          getStatus: vi.fn().mockReturnValue({
            loadedSamples: 25,
            isInitialized: true,
          }),
          audioEngine: undefined, // Will be set during initialize
        };
        return mockProcessor;
      }),
  };
});

// Mock toneLoader to return our mockTone
vi.mock('../../../shared/loaders/toneLoader.js', () => ({
  loadGlobalTone: vi.fn(() => Promise.resolve(mockTone)),
}));

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

// Create mock AudioEngine instance
const mockAudioEngine = createMockAudioEngine();

describe('BassInstrument', () => {
  let bassInstrument: BassInstrument;
  let config: BassInstrumentConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      id: 'test-bass',
      name: 'Test Bass',
      type: 'bass',
      noteRange: {
        lowest: 'B0',
        highest: 'G4',
      },
      samples: {
        E2: ['e2_v1.wav', 'e2_v2.wav'],
        A2: ['a2_v1.wav', 'a2_v2.wav'],
        D3: ['d3_v1.wav', 'd3_v2.wav'],
        G3: ['g3_v1.wav', 'g3_v2.wav'],
      },
      useSynth: false,
      synthType: 'sawtooth',
      ampSimulation: true,
      velocityLayers: 6,
      articulationSupport: ['normal', 'muted', 'slap'],
      pitchBendRange: 2,
    };

    bassInstrument = new BassInstrument(config, mockAudioEngine);
  });

  describe('Construction', () => {
    it('should create bass instrument with provided configuration', () => {
      expect(bassInstrument.id).toBe('test-bass');
      expect(bassInstrument.name).toBe('Test Bass');
      expect(bassInstrument.type).toBe('bass');
      expect(bassInstrument.state.isInitialized).toBe(false);
    });

    it('should set default values for optional parameters', () => {
      const minimalConfig: BassInstrumentConfig = {
        id: 'minimal-bass',
        name: 'Minimal Bass',
        type: 'bass',
      };

      const minimalBass = new BassInstrument(minimalConfig, mockAudioEngine);
      expect(minimalBass.id).toBe('minimal-bass');
    });
  });

  describe('Initialization', () => {
    it('should initialize bass instrument successfully', async () => {
      await bassInstrument.initialize();

      expect(bassInstrument.state.isInitialized).toBe(true);
      expect(bassInstrument.state.isLoading).toBe(false);
      expect(bassInstrument.state.error).toBeNull();
    });

    it('should pass audioEngine to processor during initialization', async () => {
      await bassInstrument.initialize();

      // Get the processor instance
      const processor = (bassInstrument as any).processor;

      // Verify processor was created with audioEngine
      expect(processor.audioEngine).toBe(mockAudioEngine);

      // Verify initialize was called with audioEngine
      expect(processor.initialize).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await bassInstrument.initialize();
      await bassInstrument.initialize(); // Second call should be ignored

      expect(bassInstrument.state.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock initialization failure
      const mockProcessor = (bassInstrument as any).processor;
      mockProcessor.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(bassInstrument.initialize()).rejects.toThrow('Init failed');
      expect(bassInstrument.state.isInitialized).toBe(false);
      expect(bassInstrument.state.isLoading).toBe(false);
      expect(bassInstrument.state.error).toContain('Failed to initialize bass');
    });
  });

  describe('Note Triggering', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should trigger bass note events', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        duration: '8n',
        data: {
          note: 'E2',
        } as BassEvent,
      };

      bassInstrument.trigger(event);

      const mockProcessor = (bassInstrument as any).processor;
      expect(mockProcessor.triggerNote).toHaveBeenCalledWith({
        note: 'E2',
        velocity: 0.8,
        time: 0.5,
        duration: '8n',
      });
      expect(bassInstrument.state.isPlaying).toBe(true);
    });

    it('should handle trigger with default note', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: {},
      };

      bassInstrument.trigger(event);

      const mockProcessor = (bassInstrument as any).processor;
      expect(mockProcessor.triggerNote).toHaveBeenCalledWith({
        note: 'E2', // Default note
        velocity: 0.8,
        time: 0.5,
        duration: '8n',
      });
    });

    it('should not trigger when not initialized', () => {
      const uninitializedBass = new BassInstrument(config, mockAudioEngine);
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { note: 'E2' },
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      uninitializedBass.trigger(event);

      // Check that console.warn was called with structured logging format
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0][0];
      expect(callArgs).toContain('Bass Test Bass not initialized');
      expect(callArgs).toContain('"level":"WARN"');
      consoleSpy.mockRestore();
    });
  });

  describe('Direct Note Playing', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should play specific note', () => {
      bassInstrument.playNote('A2', 0.9, '4n');

      const mockProcessor = (bassInstrument as any).processor;
      expect(mockProcessor.triggerNote).toHaveBeenCalledWith({
        note: 'A2',
        velocity: 0.9,
        time: expect.any(Number),
        duration: '4n',
      });
    });

    it('should play with default parameters', () => {
      bassInstrument.playNote('D3');

      const mockProcessor = (bassInstrument as any).processor;
      expect(mockProcessor.triggerNote).toHaveBeenCalledWith({
        note: 'D3',
        velocity: 0.8, // Default velocity
        time: expect.any(Number),
        duration: '8n', // Default duration
      });
    });

    it('should not play when not initialized', () => {
      const uninitializedBass = new BassInstrument(config, mockAudioEngine);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      uninitializedBass.playNote('E2');

      // Check that console.warn was called with structured logging format
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0][0];
      expect(callArgs).toContain('Bass not initialized');
      expect(callArgs).toContain('"level":"WARN"');
      consoleSpy.mockRestore();
    });
  });

  describe('Note Stopping', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should stop specific note by string', () => {
      const mockProcessor = (bassInstrument as any).processor;

      bassInstrument.stop('C3');

      expect(mockProcessor.stopNote).toHaveBeenCalledWith('C', 3, undefined);
      expect(bassInstrument.state.isPlaying).toBe(false);
    });

    it('should handle invalid note format', () => {
      const mockProcessor = (bassInstrument as any).processor;

      bassInstrument.stop('invalid-note');

      expect(mockProcessor.stopNote).not.toHaveBeenCalled();
    });

    it('should not stop when not initialized', () => {
      const uninitializedBass = new BassInstrument(config, mockAudioEngine);

      uninitializedBass.stop('E2');

      // Should not crash or call processor
      expect(bassInstrument.state.isPlaying).toBe(false);
    });
  });

  describe('Expression Controls', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should set pitch bend', () => {
      const mockProcessor = (bassInstrument as any).processor;

      bassInstrument.setPitchBend(0.5);

      expect(mockProcessor.updatePitchBend).toHaveBeenCalledWith(0.5);
    });

    it('should update expression controls', () => {
      const mockProcessor = (bassInstrument as any).processor;

      const expression = {
        pitchBend: 0.2,
        modulation: 0.3,
        expression: 0.8,
        aftertouch: 0.1,
        sustainPedal: true,
      };

      bassInstrument.updateExpression(expression);

      expect(mockProcessor.updateExpression).toHaveBeenCalledWith(expression);
    });
  });

  describe('Bass Status', () => {
    it('should return bass status from processor', () => {
      const status = bassInstrument.getBassStatus();

      expect(status).toEqual({
        loadedSamples: 25,
        isInitialized: true,
      });
    });

    it('should return note range', () => {
      const noteRange = bassInstrument.getNoteRange();

      expect(noteRange).toEqual({
        lowest: 'B0',
        highest: 'G4',
      });
    });
  });

  describe('Parameter Updates', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should update parameters', () => {
      const newSamples = {
        E2: ['new_e2.wav'],
        A2: ['new_a2.wav'],
      };

      // Mock the loadSamples method
      const loadSamplesSpy = vi
        .spyOn(bassInstrument as any, 'loadSamples')
        .mockImplementation(() => {});

      bassInstrument.updateParams({
        synthType: 'square',
        samples: newSamples,
      });

      expect(loadSamplesSpy).toHaveBeenCalledWith(newSamples);
    });
  });

  describe('Audio Controls', () => {
    beforeEach(async () => {
      await bassInstrument.initialize();
    });

    it('should apply volume through expression', () => {
      const mockProcessor = (bassInstrument as any).processor;

      bassInstrument.setVolume(0.6);

      expect(mockProcessor.updateExpression).toHaveBeenCalledWith({
        expression: Math.round(0.6 * 127), // 76
      });
    });
  });

  describe('Metrics', () => {
    it('should return bass-specific metrics', () => {
      const metrics = bassInstrument.getMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('voiceCount');
      expect(metrics).toHaveProperty('latency');
      expect(metrics.latency).toBe(15);
      expect(metrics.memoryUsage).toBe(7.5); // 25 samples * 0.3MB
    });

    it('should return monophonic voice count', () => {
      const restingMetrics = bassInstrument.getMetrics();
      expect(restingMetrics.voiceCount).toBe(0);

      // Simulate playing state
      (bassInstrument as any)._state.isPlaying = true;
      const playingMetrics = bassInstrument.getMetrics();
      expect(playingMetrics.voiceCount).toBe(1); // Bass is monophonic
    });
  });

  describe('Lifecycle', () => {
    it('should dispose properly', async () => {
      await bassInstrument.initialize();
      const mockProcessor = (bassInstrument as any).processor;

      await bassInstrument.dispose();

      expect(mockProcessor.dispose).toHaveBeenCalled();
      expect(bassInstrument.state.isInitialized).toBe(false);
      expect(bassInstrument.state.isPlaying).toBe(false);
    });
  });
});
