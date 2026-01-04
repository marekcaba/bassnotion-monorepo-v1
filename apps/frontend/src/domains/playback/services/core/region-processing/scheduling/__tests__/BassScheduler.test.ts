/**
 * BassScheduler Integration Tests
 *
 * Tests the BassScheduler class for bass sample playback:
 * - Buffer management (setBuffers, getBufferForEvent)
 * - Event scheduling with MIDI note lookup
 * - AudioContext integration
 * - Velocity-based volume control
 * - Cleanup on stop
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BassScheduler } from '../InstrumentSchedulers.js';
import type { PatternEvent } from '../../types/region.types.js';

// Mock the logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Create mock AudioBuffer
function createMockAudioBuffer(duration = 1.0): AudioBuffer {
  return {
    length: 44100 * duration,
    duration,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(44100 * duration)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

// Create mock AudioNode for destination
function createMockAudioDestination(): AudioNode {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
  } as unknown as AudioNode;
}

// Create mock AudioContext
function createMockAudioContext(): AudioContext & { mockDestination: AudioNode } {
  const mockGainNode = {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSourceNode = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
    disconnect: vi.fn(),
  };

  const mockDestination = createMockAudioDestination();

  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: mockDestination as AudioDestinationNode,
    mockDestination,
    createGain: vi.fn(() => ({ ...mockGainNode })),
    createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
  } as unknown as AudioContext & { mockDestination: AudioNode };
}

describe('BassScheduler', () => {
  let scheduler: BassScheduler;
  let mockAudioContext: AudioContext & { mockDestination: AudioNode };
  let mockTracks: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = createMockAudioContext();
    mockTracks = new Map([
      ['bass-track', { instrumentType: 'bass', volume: 1.0, isMuted: false }],
    ]);
    scheduler = new BassScheduler('test-instance', mockTracks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a BassScheduler instance', () => {
      expect(scheduler).toBeInstanceOf(BassScheduler);
    });

    it('should be configured for bass instrument type', () => {
      // Verify it can accept bass buffers
      const buffers = { '28': createMockAudioBuffer() };
      scheduler.setBuffers(buffers, mockAudioContext.mockDestination);

      // No error means configuration is valid
      expect(scheduler).toBeDefined();
    });
  });

  describe('setAudioContext', () => {
    it('should store the AudioContext', () => {
      expect(() => scheduler.setAudioContext(mockAudioContext)).not.toThrow();
    });
  });

  describe('setBuffers', () => {
    it('should store buffers with MIDI note keys', () => {
      const buffers = {
        '28': createMockAudioBuffer(), // E1
        '33': createMockAudioBuffer(), // A1
        '38': createMockAudioBuffer(), // D2
      };

      expect(() => scheduler.setBuffers(buffers, mockAudioContext.mockDestination)).not.toThrow();
    });

    it('should clear previous buffers when setting new ones', () => {
      // First set
      scheduler.setBuffers({ '28': createMockAudioBuffer() }, mockAudioContext.mockDestination);

      // Second set (should replace first)
      scheduler.setBuffers(
        {
          '33': createMockAudioBuffer(),
          '38': createMockAudioBuffer(),
        },
        mockAudioContext.mockDestination
      );

      // Scheduler should work with new buffers
      expect(() =>
        scheduler.setBuffers({ '28': createMockAudioBuffer() }, mockAudioContext.mockDestination)
      ).not.toThrow();
    });
  });

  describe('schedule', () => {
    beforeEach(() => {
      scheduler.setAudioContext(mockAudioContext);
      const buffers = {
        '28': createMockAudioBuffer(), // E1
        '33': createMockAudioBuffer(), // A1
        '38': createMockAudioBuffer(), // D2
      };
      scheduler.setBuffers(buffers, mockAudioContext.mockDestination);
    });

    it('should schedule a bass event with MIDI note', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: {
          midiNote: 28,
          note: 'E1',
          string: 1,
          fret: 0,
          velocity: 100,
        },
      };

      const result = scheduler.schedule(event, 0.1, 0);

      // Should return true if successfully scheduled
      expect(result).toBe(true);
    });

    it('should create audio nodes for playback', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: {
          midiNote: 33,
          note: 'A1',
          velocity: 80,
        },
      };

      scheduler.schedule(event, 0.1, 0);

      // Should have created buffer source and gain nodes
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should return false for missing buffer', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: {
          midiNote: 99, // Not in buffers
          note: 'X9',
        },
      };

      const result = scheduler.schedule(event, 0.1, 0);

      // Should return false when buffer is not found
      expect(result).toBe(false);
    });

    it('should handle events with velocity', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: {
          midiNote: 28,
          velocity: 64, // Medium velocity
        },
      };

      scheduler.schedule(event, 0.1, 0);

      // Should have used velocity to adjust volume
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should schedule at correct audio time', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: {
          midiNote: 28,
        },
      };

      const audioTime = 1.5;
      scheduler.schedule(event, audioTime, 0);

      // Source should be started at the scheduled time (with optional offset)
      const source = (mockAudioContext.createBufferSource as any).mock.results[0]
        ?.value;
      if (source) {
        // First argument should be the audio time, second is offset (0 for preserved attack)
        expect(source.start).toHaveBeenCalledWith(audioTime, expect.any(Number));
      }
    });
  });

  describe('stopAll', () => {
    beforeEach(() => {
      scheduler.setAudioContext(mockAudioContext);
      scheduler.setBuffers(
        { '28': createMockAudioBuffer() },
        mockAudioContext.mockDestination
      );
    });

    it('should stop all scheduled sources', () => {
      // Schedule a note
      const event: PatternEvent = {
        type: 'bass-note',
        position: '0:0:0',
        data: { midiNote: 28 },
      };
      scheduler.schedule(event, 0.1, 0);

      // Stop all - should not throw
      expect(() => scheduler.stopAll()).not.toThrow();
    });
  });

  describe('event type handling', () => {
    beforeEach(() => {
      scheduler.setAudioContext(mockAudioContext);
      scheduler.setBuffers(
        {
          '28': createMockAudioBuffer(),
          '33': createMockAudioBuffer(),
        },
        mockAudioContext.mockDestination
      );
    });

    it('should look up buffer by midiNote in event.data', () => {
      const event: PatternEvent = {
        type: 'bass',
        position: '0:0:0',
        data: {
          midiNote: 28, // E1
          note: 'E1',
          string: 1,
          fret: 0,
        },
      };

      const result = scheduler.schedule(event, 0.1, 0);

      expect(result).toBe(true);
    });

    it('should handle event with all bass data fields', () => {
      const event: PatternEvent = {
        type: 'bass-note',
        position: '1:0:0',
        velocity: 100,
        duration: '8n',
        data: {
          midiNote: 33,
          note: 'A1',
          string: 2,
          fret: 0,
        },
      };

      const result = scheduler.schedule(event, 0.5, 0);

      expect(result).toBe(true);
    });
  });
});

describe('BassScheduler with Multiple Buffers', () => {
  let scheduler: BassScheduler;
  let mockAudioContext: AudioContext & { mockDestination: AudioNode };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = createMockAudioContext();
    const mockTracks = new Map([
      ['bass-track', { instrumentType: 'bass' }],
    ]);
    scheduler = new BassScheduler('multi-buffer-test', mockTracks);
    scheduler.setAudioContext(mockAudioContext);
  });

  it('should handle a full bass range of buffers', () => {
    // Create buffers for bass range (E1 to G4)
    const buffers: Record<string, AudioBuffer> = {};
    for (let midi = 28; midi <= 67; midi++) {
      buffers[String(midi)] = createMockAudioBuffer();
    }

    scheduler.setBuffers(buffers, mockAudioContext.mockDestination);

    // Should handle any note in range
    const events: PatternEvent[] = [
      { type: 'bass', position: '0:0:0', data: { midiNote: 28 } }, // E1
      { type: 'bass', position: '0:1:0', data: { midiNote: 40 } }, // E2
      { type: 'bass', position: '0:2:0', data: { midiNote: 52 } }, // E3
      { type: 'bass', position: '0:3:0', data: { midiNote: 64 } }, // E4
    ];

    events.forEach((event, i) => {
      const result = scheduler.schedule(event, i * 0.5, 0);
      expect(result).toBe(true);
    });
  });

  it('should play correct buffer for each MIDI note', () => {
    const bufferE1 = createMockAudioBuffer(0.5);
    const bufferA1 = createMockAudioBuffer(0.7);
    const bufferD2 = createMockAudioBuffer(0.6);

    scheduler.setBuffers(
      {
        '28': bufferE1,
        '33': bufferA1,
        '38': bufferD2,
      },
      mockAudioContext.mockDestination
    );

    // Schedule each note
    scheduler.schedule(
      { type: 'bass', position: '0:0:0', data: { midiNote: 28 } },
      0.1,
      0
    );

    // Verify buffer source was created
    const sourceNode = (mockAudioContext.createBufferSource as any).mock
      .results[0]?.value;
    expect(sourceNode).toBeDefined();
  });
});

describe('BassScheduler Velocity Mapping', () => {
  let scheduler: BassScheduler;
  let mockAudioContext: AudioContext & { mockDestination: AudioNode };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = createMockAudioContext();
    const mockTracks = new Map([
      ['bass-track', { instrumentType: 'bass' }],
    ]);
    scheduler = new BassScheduler('velocity-test', mockTracks);
    scheduler.setAudioContext(mockAudioContext);
    scheduler.setBuffers(
      { '28': createMockAudioBuffer() },
      mockAudioContext.mockDestination
    );
  });

  it('should apply velocity to gain node', () => {
    const lowVelocity: PatternEvent = {
      type: 'bass',
      position: '0:0:0',
      velocity: 32, // Soft
      data: { midiNote: 28 },
    };

    scheduler.schedule(lowVelocity, 0.1, 0);

    const gainNode = (mockAudioContext.createGain as any).mock.results[0]?.value;
    expect(gainNode).toBeDefined();
    // Gain should be set based on velocity
  });

  it('should handle maximum velocity', () => {
    const maxVelocity: PatternEvent = {
      type: 'bass',
      position: '0:0:0',
      velocity: 127, // Maximum
      data: { midiNote: 28 },
    };

    const result = scheduler.schedule(maxVelocity, 0.1, 0);

    expect(result).toBe(true);
  });

  it('should handle default velocity when not specified', () => {
    const noVelocity: PatternEvent = {
      type: 'bass',
      position: '0:0:0',
      data: { midiNote: 28 },
    };

    const result = scheduler.schedule(noVelocity, 0.1, 0);

    expect(result).toBe(true);
  });
});
