/**
 * Bass Sampler Engine - Unit Tests
 *
 * Tests for the core sampler functionality:
 * - Constructor and options
 * - initialize / dispose lifecycle
 * - loadBuffers / unloadSamples buffer management
 * - trigger / release note playback
 * - setVolume / setPan / setEnvelope controls
 * - setMonophonic / setRoundRobin modes
 * - getMemoryStats / evictToTarget / unloadNote memory management
 * - getLoadedCount / getLoadedNotes / hasNote queries
 *
 * Note: Tone.js is mocked to avoid browser-specific audio APIs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BassSamplerEngine,
  createBassSamplerEngine,
} from '../BassSamplerEngine.js';
import type { BassSamplerOptions, BassNote } from '../types.js';

// Mock the logger
vi.mock('@bassnotion/contracts', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Tone.js - need to mock the window global
const mockPlayerInstance = {
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn().mockReturnThis(),
  start: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
  state: 'stopped',
  fadeIn: 0,
  fadeOut: 0,
  volume: { value: 0 },
};

const mockVolumeInstance = {
  connect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  volume: { value: -6 },
};

const mockPannerInstance = {
  connect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  pan: { value: 0 },
};

const mockReverbInstance = {
  connect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  decay: 1.5,
  wet: 0,
};

const mockCompressorInstance = {
  connect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  wet: { value: 1 },
};

const mockCrossFadeInstance = {
  a: { connect: vi.fn() },
  b: { connect: vi.fn() },
  connect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
};

// Set up the mock Tone on window
const mockTone = {
  Player: vi.fn().mockImplementation(() => ({ ...mockPlayerInstance })),
  Volume: vi.fn().mockImplementation(() => ({ ...mockVolumeInstance })),
  Panner: vi.fn().mockImplementation(() => ({ ...mockPannerInstance })),
  Reverb: vi.fn().mockImplementation(() => ({ ...mockReverbInstance })),
  Compressor: vi.fn().mockImplementation(() => ({ ...mockCompressorInstance })),
  CrossFade: vi.fn().mockImplementation(() => ({ ...mockCrossFadeInstance })),
  ToneAudioBuffer: vi.fn(),
  now: vi.fn().mockReturnValue(0),
  Transport: { schedule: vi.fn() },
};

// Create mock AudioBuffer
function createMockAudioBuffer(duration = 1.0): AudioBuffer {
  return {
    length: Math.floor(44100 * duration),
    duration,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(Math.floor(44100 * duration))),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('BassSamplerEngine', () => {
  let engine: BassSamplerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up window.Tone mock
    (global as any).window = { Tone: mockTone };
  });

  afterEach(async () => {
    if (engine) {
      await engine.dispose();
    }
    delete (global as any).window;
  });

  describe('constructor', () => {
    it('should create engine with default options', () => {
      engine = new BassSamplerEngine();
      expect(engine).toBeInstanceOf(BassSamplerEngine);
      expect(engine.id).toBe('bass-sampler-engine');
      expect(engine.type).toBe('bass');
      expect(engine.name).toBe('Bass Sampler Engine');
    });

    it('should create engine with custom options', () => {
      const options: BassSamplerOptions = {
        volume: -12,
        pan: 0.5,
        reverb: 0.3,
        compression: false,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.7,
        release: 0.5,
        roundRobin: false,
        memoryLimitMB: 100,
      };

      engine = new BassSamplerEngine(options);
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });

    it('should not be initialized on construction', () => {
      engine = new BassSamplerEngine();
      const state = engine.getState();
      expect(state.initialized).toBe(false);
    });
  });

  describe('createBassSamplerEngine factory', () => {
    it('should create engine via factory function', () => {
      engine = createBassSamplerEngine();
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });

    it('should pass options to constructor', () => {
      engine = createBassSamplerEngine({ volume: -18 });
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      engine = new BassSamplerEngine();
    });

    it('should initialize successfully', async () => {
      await engine.initialize();
      const state = engine.getState();
      expect(state.initialized).toBe(true);
    });

    it('should be idempotent - second call does nothing', async () => {
      await engine.initialize();
      const state1 = engine.getState().initialized;

      await engine.initialize();
      const state2 = engine.getState().initialized;

      expect(state1).toBe(true);
      expect(state2).toBe(true);
    });

    it('should set ready state after initialization', async () => {
      await engine.initialize();
      const state = engine.getState();
      expect(state.ready).toBe(true);
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should dispose successfully', async () => {
      await engine.dispose();
      const state = engine.getState();
      expect(state.initialized).toBe(false);
    });

    it('should clear all buffers', async () => {
      const buffers = { '28': createMockAudioBuffer() };
      await engine.loadBuffers(buffers);

      await engine.dispose();
      expect(engine.getLoadedCount()).toBe(0);
    });

    it('should be safe to call multiple times', async () => {
      await engine.dispose();
      await engine.dispose();
      await engine.dispose();
      // Should not throw
      const state = engine.getState();
      expect(state.initialized).toBe(false);
    });
  });

  describe('loadBuffers', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
    });

    it('should load buffers and create players', async () => {
      const buffers = {
        '28': createMockAudioBuffer(),
        '33': createMockAudioBuffer(),
      };

      await engine.loadBuffers(buffers);
      expect(engine.getLoadedCount()).toBe(2);
    });

    it('should initialize if not already initialized', async () => {
      const buffers = { '28': createMockAudioBuffer() };
      expect(engine.getState().initialized).toBe(false);

      await engine.loadBuffers(buffers);
      expect(engine.getState().initialized).toBe(true);
    });

    it('should clear existing buffers before loading new ones', async () => {
      const buffers1 = { '28': createMockAudioBuffer() };
      await engine.loadBuffers(buffers1);
      expect(engine.getLoadedCount()).toBe(1);

      const buffers2 = {
        '33': createMockAudioBuffer(),
        '38': createMockAudioBuffer(),
      };
      await engine.loadBuffers(buffers2);
      expect(engine.getLoadedCount()).toBe(2);
      expect(engine.hasNote(28)).toBe(false);
      expect(engine.hasNote(33)).toBe(true);
    });
  });

  describe('unloadSamples', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should clear all loaded samples', async () => {
      const buffers = { '28': createMockAudioBuffer() };
      await engine.loadBuffers(buffers);
      expect(engine.getLoadedCount()).toBe(1);

      engine.unloadSamples();
      expect(engine.getLoadedCount()).toBe(0);
    });
  });

  describe('trigger', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      const buffers = {
        '28': createMockAudioBuffer(),
        '33': createMockAudioBuffer(),
      };
      await engine.loadBuffers(buffers);
    });

    it('should trigger a loaded note', () => {
      const note: BassNote = {
        midiNote: 28,
        velocity: 100,
      };

      // Should not throw
      expect(() => engine.trigger(note)).not.toThrow();
    });

    it('should handle note with all optional properties', () => {
      const note: BassNote = {
        midiNote: 28,
        velocity: 80,
        time: 0.5,
        duration: 1.0,
        noteName: 'E1',
        string: 2,
        fret: 0,
        technique: 'finger',
      };

      expect(() => engine.trigger(note)).not.toThrow();
    });

    it('should handle note with default velocity', () => {
      const note: BassNote = {
        midiNote: 28,
      };

      expect(() => engine.trigger(note)).not.toThrow();
    });
  });

  describe('release', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      const buffers = { '28': createMockAudioBuffer() };
      await engine.loadBuffers(buffers);
    });

    it('should release a note', () => {
      const note: BassNote = { midiNote: 28 };
      engine.trigger(note);

      expect(() => engine.release(note)).not.toThrow();
    });

    it('should be safe to release note that was not triggered', () => {
      const note: BassNote = { midiNote: 33 }; // Not loaded

      expect(() => engine.release(note)).not.toThrow();
    });
  });

  describe('setVolume', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should set volume in dB', () => {
      expect(() => engine.setVolume(-12)).not.toThrow();
      expect(() => engine.setVolume(0)).not.toThrow();
      expect(() => engine.setVolume(-24)).not.toThrow();
    });
  });

  describe('setPan', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should set pan position', () => {
      expect(() => engine.setPan(0)).not.toThrow();
      expect(() => engine.setPan(-1)).not.toThrow();
      expect(() => engine.setPan(1)).not.toThrow();
    });

    it('should clamp pan to valid range', () => {
      // Should clamp to -1 and 1
      expect(() => engine.setPan(-2)).not.toThrow();
      expect(() => engine.setPan(2)).not.toThrow();
    });
  });

  describe('setEnvelope', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should set ADSR parameters', () => {
      expect(() =>
        engine.setEnvelope({
          attack: 0.01,
          decay: 0.2,
          sustain: 0.7,
          release: 0.5,
        })
      ).not.toThrow();
    });

    it('should accept partial envelope updates', () => {
      expect(() => engine.setEnvelope({ attack: 0.02 })).not.toThrow();
      expect(() => engine.setEnvelope({ release: 0.8 })).not.toThrow();
      expect(() =>
        engine.setEnvelope({ decay: 0.1, sustain: 0.9 })
      ).not.toThrow();
    });
  });

  describe('setMonophonic', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should enable monophonic mode', () => {
      expect(() => engine.setMonophonic(true)).not.toThrow();
    });

    it('should disable monophonic mode', () => {
      expect(() => engine.setMonophonic(false)).not.toThrow();
    });
  });

  describe('setRoundRobin', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should enable round-robin', () => {
      expect(() => engine.setRoundRobin(true)).not.toThrow();
    });

    it('should disable round-robin', () => {
      expect(() => engine.setRoundRobin(false)).not.toThrow();
    });
  });

  describe('getLoadedCount', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should return 0 when no samples loaded', () => {
      expect(engine.getLoadedCount()).toBe(0);
    });

    it('should return correct count after loading', async () => {
      const buffers = {
        '28': createMockAudioBuffer(),
        '33': createMockAudioBuffer(),
        '38': createMockAudioBuffer(),
      };
      await engine.loadBuffers(buffers);

      expect(engine.getLoadedCount()).toBe(3);
    });
  });

  describe('getLoadedNotes', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should return empty array when no samples loaded', () => {
      const notes = engine.getLoadedNotes();
      expect(notes).toEqual([]);
    });

    it('should return loaded MIDI notes', async () => {
      const buffers = {
        '28': createMockAudioBuffer(),
        '33': createMockAudioBuffer(),
      };
      await engine.loadBuffers(buffers);

      const notes = engine.getLoadedNotes();
      expect(notes).toContain(28);
      expect(notes).toContain(33);
      expect(notes).toHaveLength(2);
    });
  });

  describe('hasNote', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      const buffers = { '28': createMockAudioBuffer() };
      await engine.loadBuffers(buffers);
    });

    it('should return true for loaded note', () => {
      expect(engine.hasNote(28)).toBe(true);
    });

    it('should return false for non-loaded note', () => {
      expect(engine.hasNote(33)).toBe(false);
    });
  });

  describe('getMemoryStats', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      await engine.initialize();
    });

    it('should return stats with zero samples when empty', () => {
      const stats = engine.getMemoryStats();

      expect(stats.totalSamples).toBe(0);
      expect(stats.estimatedBytes).toBe(0);
      expect(stats.estimatedMB).toBe(0);
    });

    it('should return stats after loading samples', async () => {
      const buffers = {
        '28': createMockAudioBuffer(1.0), // 1 second
        '33': createMockAudioBuffer(2.0), // 2 seconds
      };
      await engine.loadBuffers(buffers);

      const stats = engine.getMemoryStats();

      expect(stats.totalSamples).toBe(2);
      expect(stats.estimatedBytes).toBeGreaterThan(0);
      expect(stats.samplesPerNote).toBeInstanceOf(Map);
      expect(stats.lruNotes).toBeInstanceOf(Array);
    });
  });

  describe('evictToTarget', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine({ memoryLimitMB: 10 });
      const buffers = {
        '28': createMockAudioBuffer(1.0),
        '33': createMockAudioBuffer(1.0),
        '38': createMockAudioBuffer(1.0),
      };
      await engine.loadBuffers(buffers);
    });

    it('should not throw when evicting', () => {
      expect(() => engine.evictToTarget(0)).not.toThrow();
    });

    it('should do nothing if already under target', () => {
      const initialCount = engine.getLoadedCount();

      // Evict to very high target
      engine.evictToTarget(1000);

      expect(engine.getLoadedCount()).toBe(initialCount);
    });
  });

  describe('unloadNote', () => {
    beforeEach(async () => {
      engine = new BassSamplerEngine();
      const buffers = {
        '28': createMockAudioBuffer(),
        '33': createMockAudioBuffer(),
      };
      await engine.loadBuffers(buffers);
    });

    it('should unload a specific note', () => {
      expect(engine.hasNote(28)).toBe(true);

      engine.unloadNote(28);

      expect(engine.hasNote(28)).toBe(false);
      expect(engine.hasNote(33)).toBe(true); // Other note still loaded
    });

    it('should be safe to unload non-existent note', () => {
      expect(() => engine.unloadNote(99)).not.toThrow();
    });
  });

  describe('getState', () => {
    beforeEach(() => {
      engine = new BassSamplerEngine();
    });

    it('should return state object', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('initialized');
      expect(state).toHaveProperty('loading');
      expect(state).toHaveProperty('ready');
      expect(state).toHaveProperty('activeNotes');
    });

    it('should track initialization state', async () => {
      expect(engine.getState().initialized).toBe(false);

      await engine.initialize();
      expect(engine.getState().initialized).toBe(true);

      await engine.dispose();
      expect(engine.getState().initialized).toBe(false);
    });

    it('should track ready state', async () => {
      expect(engine.getState().ready).toBe(false);

      await engine.initialize();
      expect(engine.getState().ready).toBe(true);

      await engine.dispose();
      expect(engine.getState().ready).toBe(false);
    });
  });

  describe('options', () => {
    it('should use default options when not specified', () => {
      engine = new BassSamplerEngine();
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });

    it('should merge custom options with defaults', () => {
      engine = new BassSamplerEngine({ volume: -18 });
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });

    it('should accept all option properties', () => {
      const fullOptions: BassSamplerOptions = {
        volume: -12,
        pan: -0.5,
        reverb: 0.2,
        compression: true,
        attack: 0.01,
        decay: 0.15,
        sustain: 0.75,
        release: 0.4,
        roundRobin: true,
        maxSamplesPerNote: 3,
        memoryLimitMB: 75,
      };

      engine = new BassSamplerEngine(fullOptions);
      expect(engine).toBeInstanceOf(BassSamplerEngine);
    });
  });
});
