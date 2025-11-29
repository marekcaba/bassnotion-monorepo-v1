/**
 * HarmonySchedulerV2 Integration Tests
 *
 * Comprehensive test coverage for modular harmony scheduler
 * Tests integration of all 5 extracted modules working together
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HarmonySchedulerV2 } from '../HarmonySchedulerV2.js';
import { GlobalSampleCache } from '../../../../modules/storage/cache/GlobalSampleCache.js';
import type { PatternEvent } from '../../types/region.types.js';

// Mock AudioContext and Web Audio API
function createMockAudioContext(): AudioContext {
  const mockGainNode = {
    gain: {
      value: 1.0,
      setValueAtTime: vi.fn().mockReturnThis(),
      linearRampToValueAtTime: vi.fn().mockReturnThis(),
      exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSource = {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1.0 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };

  return {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBufferSource: vi.fn(() => mockSource),
    createGain: vi.fn(() => mockGainNode),
  } as any;
}

// Mock AudioBuffer
function createMockBuffer(duration: number = 2.0): AudioBuffer {
  return {
    duration,
    length: duration * 48000,
    numberOfChannels: 2,
    sampleRate: 48000,
  } as AudioBuffer;
}

// Mock destination node
function createMockDestination(): AudioNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as any;
}

// Mock CC64TimelineBuilder
const mockCC64Builder = {
  buildTimeline: vi.fn(() => new Map()),
} as any;

// Mock SustainPedalAnalyzer
const mockSustainAnalyzer = {
  setExerciseTiming: vi.fn(),
  isPedalDownAtTime: vi.fn(() => false),
  findNextCC64Up: vi.fn(() => null),
  isNoteHeldUntilExerciseEnd: vi.fn(() => false),
} as any;

// Mock GlobalSampleCache
vi.mock('../../../../modules/storage/cache/GlobalSampleCache.js', () => {
  const mockCache = new Map<string, AudioBuffer>();

  return {
    GlobalSampleCache: {
      getCachedBuffer: vi.fn((key: string) => mockCache.get(key) || null),
      getInstance: vi.fn(() => ({
        samples: mockCache,
        getCachedMetadata: vi.fn(() => null),
      })),
      __setMockCache: (key: string, buffer: AudioBuffer) =>
        mockCache.set(key, buffer),
      __clearMockCache: () => mockCache.clear(),
    },
  };
});

// Mock GrandPianoMapper
vi.mock('../GrandPianoMapper.js', () => ({
  GrandPianoMapper: {
    hasKeyboardMap: vi.fn(() => false),
    loadKeyboardMap: vi.fn(async () => {}),
    mapNote: vi.fn(() => null),
  },
}));

describe('HarmonySchedulerV2', () => {
  let scheduler: HarmonySchedulerV2;
  let audioContext: AudioContext;
  let destination: AudioNode;
  let tracks: Map<string, any>;

  beforeEach(() => {
    audioContext = createMockAudioContext();
    destination = createMockDestination();
    tracks = new Map();

    scheduler = new HarmonySchedulerV2(
      'test-instance',
      tracks,
      mockCC64Builder,
      mockSustainAnalyzer,
    );

    scheduler.setAudioContext(audioContext);

    vi.clearAllMocks();
    (GlobalSampleCache as any).__clearMockCache();
  });

  afterEach(() => {
    (GlobalSampleCache as any).__clearMockCache();
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  describe('Initialization', () => {
    it('should initialize with audio context', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.getCurrentInstrument()).toBeNull();
    });

    it('should set audio context and sample rate', () => {
      const context = createMockAudioContext();
      scheduler.setAudioContext(context, 1.5);
      expect(scheduler).toBeDefined();
    });

    it('should set exercise timing', () => {
      scheduler.setExerciseTiming(10.0, 9.0);
      expect(mockSustainAnalyzer.setExerciseTiming).toHaveBeenCalledWith(
        10.0,
        9.0,
      );
    });

    it('should set CC64 timeline', () => {
      const timeline = new Map([
        [1.0, true],
        [2.0, false],
      ]);
      scheduler.setCurrentCC64Timeline(timeline);
      expect(scheduler).toBeDefined();
    });
  });

  // ============================================================================
  // BUFFER INJECTION
  // ============================================================================
  describe('Buffer Injection', () => {
    it('should set harmony buffers for Wurlitzer', async () => {
      const buffers = new Map([['v3', new Map([['C4', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');
      expect(scheduler.getCurrentInstrument()).toBe('wurlitzer');
    });

    it('should set harmony buffers for Grand Piano', async () => {
      const buffers = new Map([['v5', new Map([['A4', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'grandpiano');
      expect(scheduler.getCurrentInstrument()).toBe('grandpiano');
    });

    it('should configure velocity layer selector with per-note ranges', async () => {
      const buffers = new Map([['v3', new Map([['C4', createMockBuffer()]])]]);

      const perNoteRanges = {
        C4: [
          { layer: 'v2', min: 0, max: 63 },
          { layer: 'v3', min: 64, max: 127 },
        ],
      };

      await scheduler.setBuffers(
        buffers,
        destination,
        perNoteRanges,
        'wurlitzer',
      );
      expect(scheduler.getCurrentInstrument()).toBe('wurlitzer');
    });
  });

  // ============================================================================
  // MIDI NOTE SCHEDULING - INTEGRATION WITH ALL 5 MODULES
  // ============================================================================
  describe('MIDI Note Scheduling (Full Integration)', () => {
    beforeEach(async () => {
      // Setup buffers for testing
      // IMPORTANT: Wurlitzer uses 12 semitone octave shift
      // MIDI 60 (C4) → 60 - 12 = 48 (C3)
      // MIDI 72 (C5) → 72 - 12 = 60 (C4)
      const buffers = new Map([
        [
          'v3',
          new Map([
            ['C3', createMockBuffer(2.0)], // For MIDI 60 after octave shift
            ['C4', createMockBuffer(2.0)], // For MIDI 72 after octave shift
            ['D3', createMockBuffer(2.0)],
            ['E3', createMockBuffer(2.0)],
          ]),
        ],
        [
          'v5',
          new Map([
            ['C3', createMockBuffer(2.0)], // For MIDI 60 after octave shift
            ['C4', createMockBuffer(2.0)], // For MIDI 72 after octave shift
          ]),
        ],
      ]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');
    });

    it('should schedule MIDI note with all modules integrated', () => {
      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60, // C4
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);

      expect(result).toBe(true);
      expect(audioContext.createBufferSource).toHaveBeenCalled();
      expect(audioContext.createGain).toHaveBeenCalled();
    });

    it('should apply octave shifting for Wurlitzer (12 semitones down)', () => {
      // MIDI 72 (C5) → shifted to 60 (C4) for Wurlitzer
      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 72, // C5
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);

      // Should find C4 buffer (72 - 12 = 60 = C4)
      expect(result).toBe(true);
    });

    it('should select velocity layer based on MIDI velocity', () => {
      // Low velocity (40) → v3, High velocity (100) → v5
      const lowVelocityEvent: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 40, // Low velocity
        },
        duration: 1.0,
        velocity: 0.3,
      };

      const result1 = scheduler.schedule(lowVelocityEvent, 2.0, 96000);
      expect(result1).toBe(true);

      const highVelocityEvent: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 100, // High velocity
        },
        duration: 1.0,
        velocity: 0.8,
      };

      const result2 = scheduler.schedule(highVelocityEvent, 3.0, 144000);
      expect(result2).toBe(true);
    });

    it('should use BufferFallbackStrategy when primary layer not available', () => {
      // Request v4 (not available), should fallback to v5 or v3
      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 90, // High velocity → would select v4 or v5
        },
        duration: 1.0,
        velocity: 0.7,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true); // Should succeed with fallback
    });

    it('should return false when buffer not found anywhere', () => {
      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 67, // G4 (not in our test buffers)
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // OCTAVE SHIFTING (INSTRUMENT-SPECIFIC)
  // ============================================================================
  describe('Octave Shifting', () => {
    it('should NOT shift Grand Piano notes (octaveShift = 0)', async () => {
      const buffers = new Map([['v5', new Map([['C4', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'grandpiano');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60, // C4
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true); // MIDI 60 → C4 (no shift)
    });

    it('should shift Wurlitzer notes down 12 semitones', async () => {
      const buffers = new Map([['v3', new Map([['C3', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60, // C4
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true); // MIDI 60 - 12 = 48 → C3
    });

    it('should shift Rhodes notes down 12 semitones', async () => {
      const buffers = new Map([['v3', new Map([['C3', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'rhodes');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60, // C4
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true); // MIDI 60 - 12 = 48 → C3
    });
  });

  // ============================================================================
  // CC64 SUSTAIN PEDAL INTEGRATION
  // ============================================================================
  describe('CC64 Sustain Pedal', () => {
    beforeEach(async () => {
      // Wurlitzer MIDI 60 → C3 after octave shift
      const buffers = new Map([
        ['v3', new Map([['C3', createMockBuffer(2.0)]])],
      ]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');
    });

    it('should acknowledge CC64 control change events', () => {
      const event: PatternEvent = {
        type: 'harmony-control-change',
        data: {
          cc: 64,
          value: 127, // Pedal DOWN
        },
        duration: 0,
        velocity: 0,
      };

      const result = scheduler.schedule(event, 1.0, 48000);
      expect(result).toBe(true);
    });

    it('should extend note duration when CC64 pedal is held', () => {
      // Setup CC64 timeline: pedal DOWN at 1.0s, UP at 5.0s
      const timeline = new Map([
        [1.0, true], // DOWN
        [5.0, false], // UP
      ]);

      scheduler.setCurrentCC64Timeline(timeline);

      // Mock sustain analyzer to return extended duration
      mockSustainAnalyzer.findNextCC64Up = vi.fn(() => 5.0);

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0, // Original duration
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true);
      // SustainPedalHandler should extend to 5.0 - 2.0 = 3.0s
    });

    it('should enable looping for sustained notes exceeding buffer duration', () => {
      const timeline = new Map([
        [1.0, true], // DOWN
        [10.0, false], // UP (8s sustain)
      ]);

      scheduler.setCurrentCC64Timeline(timeline);
      mockSustainAnalyzer.findNextCC64Up = vi.fn(() => 10.0);

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true);

      // Should create source with looping enabled
      const mockSource = (audioContext.createBufferSource as any).mock
        .results[0].value;
      expect(mockSource.start).toHaveBeenCalledWith(2.0);
    });
  });

  // ============================================================================
  // LAST-NOTE FADEOUT
  // ============================================================================
  describe('Last-Note Fadeout', () => {
    beforeEach(async () => {
      // Wurlitzer MIDI 60 → C3 after octave shift
      const buffers = new Map([
        ['v3', new Map([['C3', createMockBuffer(2.0)]])],
      ]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');
      scheduler.setExerciseTiming(10.0, 9.0); // Exercise ends at 10s, last beat at 9s
    });

    it('should apply 3-stage fadeout for last notes', () => {
      mockSustainAnalyzer.isNoteHeldUntilExerciseEnd = vi.fn(() => true);

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0, // Note ends at 10.0s (exercise end)
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 9.0, 432000);
      expect(result).toBe(true);

      // Should schedule 3-stage fadeout (verified by gain automation)
      const mockGain = (audioContext.createGain as any).mock.results[0].value;
      expect(mockGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });

    it('should apply normal 30ms fadeout for non-last notes', () => {
      mockSustainAnalyzer.isNoteHeldUntilExerciseEnd = vi.fn(() => false);

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true);

      // Should schedule normal exponential fadeout
      const mockGain = (audioContext.createGain as any).mock.results[0].value;
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GLOBALSAMPLCACHE FALLBACK
  // ============================================================================
  describe('GlobalSampleCache Fallback', () => {
    it('should fallback to GlobalSampleCache when buffer not in internal map', async () => {
      const emptyBuffers = new Map(); // No internal buffers
      await scheduler.setBuffers(
        emptyBuffers,
        destination,
        undefined,
        'wurlitzer',
      );

      // Put buffer in GlobalSampleCache
      // Wurlitzer MIDI 60 → C3 after octave shift
      const buffer = createMockBuffer();
      (GlobalSampleCache as any).__setMockCache('wurlitzer-v3-C3', buffer);

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60, // C4 → C3 after octave shift
          velocity: 64, // Mid velocity → v3
        },
        duration: 1.0,
        velocity: 0.5,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true);
      expect(GlobalSampleCache.getCachedBuffer).toHaveBeenCalledWith(
        'wurlitzer-v3-C3',
      );
    });
  });

  // ============================================================================
  // CLEANUP AND STOPALL
  // ============================================================================
  describe('Cleanup', () => {
    beforeEach(async () => {
      const buffers = new Map([['v3', new Map([['C4', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');
    });

    it('should stop all active sources when stopAll called', async () => {
      // Setup buffers first
      const buffers = new Map([
        ['v3', new Map([['C3', createMockBuffer()]])], // MIDI 60 after octave shift
      ]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      scheduler.schedule(event, 2.0, 96000);

      // Get the mock source that was created
      const createBufferSourceMock = audioContext.createBufferSource as any;
      const mockSource =
        createBufferSourceMock.mock.results[
          createBufferSourceMock.mock.results.length - 1
        ].value;

      scheduler.stopAll();

      expect(mockSource.stop).toHaveBeenCalled();
      expect(mockSource.disconnect).toHaveBeenCalled();
    });

    it('should cleanup source after playback ends', async () => {
      // Setup buffers first
      const buffers = new Map([
        ['v3', new Map([['C3', createMockBuffer()]])], // MIDI 60 after octave shift
      ]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      scheduler.schedule(event, 2.0, 96000);

      // Get the most recent mocks
      const createBufferSourceMock = audioContext.createBufferSource as any;
      const createGainMock = audioContext.createGain as any;
      const mockSource =
        createBufferSourceMock.mock.results[
          createBufferSourceMock.mock.results.length - 1
        ].value;
      const mockGain =
        createGainMock.mock.results[createGainMock.mock.results.length - 1]
          .value;

      // Simulate source.onended callback
      if (mockSource.onended) {
        mockSource.onended();
      }

      expect(mockGain.disconnect).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should return false when audio context not set', () => {
      const newScheduler = new HarmonySchedulerV2(
        'test',
        new Map(),
        mockCC64Builder,
        mockSustainAnalyzer,
      );

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 60,
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = newScheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(false);
    });

    it('should handle unsupported control change events', async () => {
      const buffers = new Map([['v3', new Map([['C4', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');

      const event: PatternEvent = {
        type: 'harmony-control-change',
        data: {
          cc: 7, // Volume (not supported)
          value: 100,
        },
        duration: 0,
        velocity: 0,
      };

      const result = scheduler.schedule(event, 1.0, 48000);
      expect(result).toBe(false);
    });

    it('should handle sharp note names correctly (Cs, Ds, Fs)', async () => {
      // MIDI 61 (C#4) - 12 (Wurlitzer octave shift) = 49 (Cs3)
      const buffers = new Map([['v3', new Map([['Cs3', createMockBuffer()]])]]);

      await scheduler.setBuffers(buffers, destination, undefined, 'wurlitzer');

      const event: PatternEvent = {
        type: 'harmony-note',
        data: {
          midiNote: 61, // C#4 → Cs3 after octave shift
          velocity: 80,
        },
        duration: 1.0,
        velocity: 0.6,
      };

      const result = scheduler.schedule(event, 2.0, 96000);
      expect(result).toBe(true);
    });
  });
});
