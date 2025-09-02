import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HarmonyInstrument } from '../HarmonyInstrument.js';
import type { HarmonyInstrumentConfig, ChordEvent } from '../../../types/index.js';

// Mock the WamHarmonyProcessor
vi.mock('../../../../../services/plugins/WamHarmonyProcessor.js', () => {
  return {
    WamHarmonyProcessor: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      triggerChord: vi.fn(),
      stopChord: vi.fn(),
      setVolume: vi.fn(),
      setPan: vi.fn(),
      muteAll: vi.fn(),
      setVoicing: vi.fn(),
      setInstrument: vi.fn(),
      setSustainPedal: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

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

describe('HarmonyInstrument', () => {
  let harmonyInstrument: HarmonyInstrument;
  let config: HarmonyInstrumentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      id: 'test-harmony',
      name: 'Test Piano',
      type: 'harmony',
      instrument: 'piano',
      samples: {
        'C4': 'c4.wav',
        'D4': 'd4.wav',
        'E4': 'e4.wav',
      },
      useWAM: true,
      wamPlugin: 'piano-plugin',
      voicing: 'close',
      velocitySensitivity: 0.8,
      sustainPedal: false,
    };

    harmonyInstrument = new HarmonyInstrument(config);
  });

  describe('Construction', () => {
    it('should create harmony instrument with provided configuration', () => {
      expect(harmonyInstrument.id).toBe('test-harmony');
      expect(harmonyInstrument.name).toBe('Test Piano');
      expect(harmonyInstrument.type).toBe('harmony');
      expect(harmonyInstrument.state.isInitialized).toBe(false);
    });

    it('should set default values for optional parameters', () => {
      const minimalConfig: HarmonyInstrumentConfig = {
        id: 'minimal-harmony',
        name: 'Minimal Piano',
        type: 'harmony',
      };

      const minimalHarmony = new HarmonyInstrument(minimalConfig);
      expect(minimalHarmony.id).toBe('minimal-harmony');
      expect(minimalHarmony.getInstrument()).toBe('piano'); // Default
      expect(minimalHarmony.getVoicing()).toBe('close'); // Default
    });
  });

  describe('Initialization', () => {
    it('should initialize harmony instrument successfully', async () => {
      // Mock window.AudioContext
      (global as any).window = {
        AudioContext: vi.fn(),
        webkitAudioContext: vi.fn(),
      };

      await harmonyInstrument.initialize();
      
      expect(harmonyInstrument.state.isInitialized).toBe(true);
      expect(harmonyInstrument.state.isLoading).toBe(false);
      expect(harmonyInstrument.state.error).toBeNull();
    });

    it('should not reinitialize if already initialized', async () => {
      (global as any).window = {
        AudioContext: vi.fn(),
        webkitAudioContext: vi.fn(),
      };

      await harmonyInstrument.initialize();
      await harmonyInstrument.initialize(); // Second call should be ignored
      
      expect(harmonyInstrument.state.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock initialization failure
      const mockProcessor = (harmonyInstrument as any).processor;
      mockProcessor.initialize.mockRejectedValueOnce(new Error('WAM init failed'));

      await expect(harmonyInstrument.initialize()).rejects.toThrow('WAM init failed');
      expect(harmonyInstrument.state.isInitialized).toBe(false);
      expect(harmonyInstrument.state.isLoading).toBe(false);
      expect(harmonyInstrument.state.error).toContain('Failed to initialize harmony');
    });
  });

  describe('Chord Triggering', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should trigger chord events', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        duration: '4n',
        data: {
          chord: 'Cmaj7',
          notes: ['C4', 'E4', 'G4', 'B4'],
        } as ChordEvent,
      };

      harmonyInstrument.trigger(event);

      const mockProcessor = (harmonyInstrument as any).processor;
      expect(mockProcessor.triggerChord).toHaveBeenCalledWith({
        chord: 'Cmaj7',
        notes: ['C4', 'E4', 'G4', 'B4'],
        velocity: 0.8,
        time: 0.5,
        duration: '4n',
      });
      expect(harmonyInstrument.state.isPlaying).toBe(true);
    });

    it('should handle trigger with default chord', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: {},
      };

      harmonyInstrument.trigger(event);

      const mockProcessor = (harmonyInstrument as any).processor;
      expect(mockProcessor.triggerChord).toHaveBeenCalledWith({
        chord: 'C', // Default chord
        notes: ['C4', 'E4', 'G4'], // Default notes
        velocity: 0.8,
        time: 0.5,
        duration: '4n',
      });
    });

    it('should not trigger when not initialized', () => {
      const uninitializedHarmony = new HarmonyInstrument(config);
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { chord: 'C' },
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      uninitializedHarmony.trigger(event);
      
      expect(consoleSpy).toHaveBeenCalledWith('Harmony Test Piano not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Direct Chord Playing', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should play chord with all parameters', () => {
      harmonyInstrument.playChord('Am7', ['A4', 'C5', 'E5', 'G5'], 0.9, '2n');

      const mockProcessor = (harmonyInstrument as any).processor;
      expect(mockProcessor.triggerChord).toHaveBeenCalledWith({
        chord: 'Am7',
        notes: ['A4', 'C5', 'E5', 'G5'],
        velocity: 0.9,
        time: expect.any(Number),
        duration: '2n',
      });
    });

    it('should play chord with default parameters', () => {
      harmonyInstrument.playChord('G', ['G4', 'B4', 'D5']);

      const mockProcessor = (harmonyInstrument as any).processor;
      expect(mockProcessor.triggerChord).toHaveBeenCalledWith({
        chord: 'G',
        notes: ['G4', 'B4', 'D5'],
        velocity: 0.8, // Default velocity
        time: expect.any(Number),
        duration: '4n', // Default duration
      });
    });

    it('should play single note', () => {
      harmonyInstrument.playNote('F4', 0.7, '8n');

      const mockProcessor = (harmonyInstrument as any).processor;
      expect(mockProcessor.triggerChord).toHaveBeenCalledWith({
        chord: 'F4',
        notes: ['F4'],
        velocity: 0.7,
        time: expect.any(Number),
        duration: '8n',
      });
    });

    it('should not play when not initialized', () => {
      const uninitializedHarmony = new HarmonyInstrument(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      uninitializedHarmony.playChord('C', ['C4', 'E4', 'G4']);
      
      expect(consoleSpy).toHaveBeenCalledWith('Harmony not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Chord Stopping', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should stop chord when processor supports it', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.stop('C4', 1.0);

      expect(mockProcessor.stopChord).toHaveBeenCalledWith('C4', 1.0);
      expect(harmonyInstrument.state.isPlaying).toBe(false);
    });

    it('should handle stop when not initialized', () => {
      const uninitializedHarmony = new HarmonyInstrument(config);

      uninitializedHarmony.stop(['C4', 'E4', 'G4']);

      // Should not crash
      expect(harmonyInstrument.state.isPlaying).toBe(false);
    });
  });

  describe('Instrument Controls', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should set voicing', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setVoicing('drop2');

      expect(harmonyInstrument.getVoicing()).toBe('drop2');
      expect(mockProcessor.setVoicing).toHaveBeenCalledWith('drop2');
    });

    it('should set instrument type', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setInstrument('rhodes');

      expect(harmonyInstrument.getInstrument()).toBe('rhodes');
      expect(mockProcessor.setInstrument).toHaveBeenCalledWith('rhodes');
    });

    it('should set sustain pedal', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setSustainPedal(true);

      expect(mockProcessor.setSustainPedal).toHaveBeenCalledWith(true);
    });
  });

  describe('Chord Utilities', () => {
    it('should provide chord suggestions', () => {
      const suggestions = harmonyInstrument.getChordSuggestions('C');

      expect(suggestions).toContain('C');
      expect(suggestions).toContain('Cm');
      expect(suggestions).toContain('C7');
      expect(suggestions).toContain('Cmaj7');
      expect(suggestions).toContain('Cm7');
      expect(suggestions).toContain('Csus2');
      expect(suggestions).toContain('Csus4');
      expect(suggestions).toContain('Cdim');
      expect(suggestions).toContain('Caug');
    });

    it('should convert chord symbols to notes', () => {
      const cMajorNotes = harmonyInstrument.chordToNotes('C', 4);
      expect(cMajorNotes).toEqual(['C4', 'E4', 'G4']);

      const dMajorNotes = harmonyInstrument.chordToNotes('D', 3);
      expect(dMajorNotes).toEqual(['D3', 'F#3', 'A3']);
    });

    it('should handle unknown chord roots', () => {
      const unknownNotes = harmonyInstrument.chordToNotes('X', 4);
      expect(unknownNotes).toEqual(['C4', 'E4', 'G4']); // Fallback to C major
    });
  });

  describe('Parameter Updates', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should update parameters', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.updateParams({
        instrument: 'wurlitzer',
        voicing: 'open',
        sustainPedal: true,
        samples: {
          'C4': 'new_c4.wav',
          'D4': 'new_d4.wav',
        },
      });

      expect(mockProcessor.setInstrument).toHaveBeenCalledWith('wurlitzer');
      expect(mockProcessor.setVoicing).toHaveBeenCalledWith('open');
      expect(mockProcessor.setSustainPedal).toHaveBeenCalledWith(true);
    });
  });

  describe('Audio Controls', () => {
    beforeEach(async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
    });

    it('should apply volume changes', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setVolume(0.7);

      expect(mockProcessor.setVolume).toHaveBeenCalledWith(0.7);
    });

    it('should apply pan changes', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setPan(-0.3);

      expect(mockProcessor.setPan).toHaveBeenCalledWith(-0.3);
    });

    it('should apply mute', () => {
      const mockProcessor = (harmonyInstrument as any).processor;

      harmonyInstrument.setMuted(true);

      expect(mockProcessor.muteAll).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should return harmony-specific metrics', () => {
      const metrics = harmonyInstrument.getMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('voiceCount');
      expect(metrics).toHaveProperty('latency');
      expect(metrics.latency).toBe(20); // WAM plugin latency
    });

    it('should return polyphonic voice count when playing', () => {
      const restingMetrics = harmonyInstrument.getMetrics();
      expect(restingMetrics.voiceCount).toBe(0);

      // Simulate playing state
      (harmonyInstrument as any)._state.isPlaying = true;
      const playingMetrics = harmonyInstrument.getMetrics();
      expect(playingMetrics.voiceCount).toBe(4); // Typical chord has 3-4 notes
    });

    it('should return higher CPU usage when playing', () => {
      const restingMetrics = harmonyInstrument.getMetrics();
      expect(restingMetrics.cpuUsage).toBe(0);

      // Simulate playing state
      (harmonyInstrument as any)._state.isPlaying = true;
      const playingMetrics = harmonyInstrument.getMetrics();
      expect(playingMetrics.cpuUsage).toBe(8); // Higher CPU for polyphonic harmony
    });
  });

  describe('Lifecycle', () => {
    it('should dispose properly', async () => {
      (global as any).window = { AudioContext: vi.fn() };
      await harmonyInstrument.initialize();
      const mockProcessor = (harmonyInstrument as any).processor;

      await harmonyInstrument.dispose();

      expect(mockProcessor.dispose).toHaveBeenCalled();
      expect(harmonyInstrument.state.isInitialized).toBe(false);
      expect(harmonyInstrument.state.isPlaying).toBe(false);
    });

    it('should connect and disconnect audio routing', () => {
      const destination = { connect: vi.fn() };

      harmonyInstrument.connect(destination);
      expect((harmonyInstrument as any)._destination).toBe(destination);

      harmonyInstrument.disconnect();
      expect((harmonyInstrument as any)._destination).toBeNull();
    });
  });
});