/**
 * Bass Sample Loader - Unit Tests
 *
 * Tests for the async sample loading with caching:
 * - setAudioContext: Set context for decoding
 * - loadSamplesForNotes: FAANG smart loading
 * - loadSamples: Load with concurrency control
 * - getBuffers / getBufferMap / getBuffer: Access loaded samples
 * - isLoaded: Check if sample exists
 * - getStatus / getStats: Loading status tracking
 * - clear / dispose: Cleanup
 *
 * Note: These are simplified unit tests that focus on the API behavior.
 * Full integration tests with actual network calls are in the integration test suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BassSampleLoader,
  createBassSampleLoader,
  type LoadProgressCallback,
} from '../BassSampleLoader.js';

// Mock the logger
vi.mock('@bassnotion/contracts', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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
    getChannelData: vi.fn(),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

// Create mock AudioContext
function createMockAudioContext(): AudioContext {
  const mockDecodedBuffer = createMockAudioBuffer();
  return {
    decodeAudioData: vi.fn().mockResolvedValue(mockDecodedBuffer),
    sampleRate: 44100,
    state: 'running',
    destination: {} as AudioDestinationNode,
  } as unknown as AudioContext;
}

describe('BassSampleLoader', () => {
  let loader: BassSampleLoader;
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new BassSampleLoader();
    mockAudioContext = createMockAudioContext();
  });

  afterEach(() => {
    loader.dispose();
  });

  describe('constructor', () => {
    it('should create a new loader instance', () => {
      expect(loader).toBeInstanceOf(BassSampleLoader);
    });
  });

  describe('createBassSampleLoader', () => {
    it('should create a new loader instance via factory', () => {
      const factoryLoader = createBassSampleLoader();
      expect(factoryLoader).toBeInstanceOf(BassSampleLoader);
      factoryLoader.dispose();
    });
  });

  describe('setAudioContext', () => {
    it('should store the AudioContext for decoding', () => {
      // Should not throw
      expect(() => loader.setAudioContext(mockAudioContext)).not.toThrow();
    });
  });

  describe('loadSamplesForNotes', () => {
    beforeEach(() => {
      loader.setAudioContext(mockAudioContext);
    });

    it('should return empty result for empty MIDI notes array', async () => {
      const result = await loader.loadSamplesForNotes([]);
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return empty result for invalid MIDI notes', async () => {
      // Notes outside bass range (23-64)
      const result = await loader.loadSamplesForNotes([0, 10, 100, 127]);
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
    });

    it('should accept valid MIDI notes', async () => {
      // This will attempt to load but may fail due to network
      // We're testing that the API accepts valid notes
      const notes = [28, 33, 38]; // E1, A1, D2
      const result = await loader.loadSamplesForNotes(notes);

      // Result will have errors due to network issues in test,
      // but the API should process the notes
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('loadSamples', () => {
    beforeEach(() => {
      loader.setAudioContext(mockAudioContext);
    });

    it('should return result object with correct structure', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://test.com/E1.ogg',
        },
      ];

      const result = await loader.loadSamples(samples);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should call progress callback during loading', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://test.com/E1.ogg',
        },
        {
          midiNote: 33,
          note: 'A1',
          fret: 0,
          string: 'A' as const,
          url: 'http://test.com/A1.ogg',
        },
      ];

      const progressCalls: Array<[number, number]> = [];
      const onProgress: LoadProgressCallback = (loaded, total) => {
        progressCalls.push([loaded, total]);
      };

      await loader.loadSamples(samples, onProgress);

      // Progress should be called for each sample
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      // Total should be 2
      progressCalls.forEach(([, total]) => {
        expect(total).toBe(2);
      });
    });

    it('should track loading status', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://test.com/E1.ogg',
        },
      ];

      await loader.loadSamples(samples);

      const status = loader.getStatus();
      expect(status.has(28)).toBe(true);
      // Status should be either 'ready' or 'error' after loading
      const sampleStatus = status.get(28);
      expect(['ready', 'error']).toContain(sampleStatus?.status);
    });

    it('should handle error when loading fails', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://invalid-url-that-will-fail.com/sample.ogg',
        },
      ];

      const result = await loader.loadSamples(samples);

      // Should have failed
      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].midiNote).toBe(28);
    });
  });

  describe('getBuffers', () => {
    it('should return empty object when no samples loaded', () => {
      const buffers = loader.getBuffers();
      expect(Object.keys(buffers)).toHaveLength(0);
      expect(typeof buffers).toBe('object');
    });
  });

  describe('getBufferMap', () => {
    it('should return empty Map when no samples loaded', () => {
      const map = loader.getBufferMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(0);
    });

    it('should return a copy of the internal map', () => {
      const map1 = loader.getBufferMap();
      const map2 = loader.getBufferMap();
      expect(map1).not.toBe(map2); // Different instances
    });
  });

  describe('getBuffer', () => {
    it('should return undefined for non-loaded sample', () => {
      expect(loader.getBuffer(28)).toBeUndefined();
      expect(loader.getBuffer(33)).toBeUndefined();
      expect(loader.getBuffer(0)).toBeUndefined();
    });
  });

  describe('isLoaded', () => {
    it('should return false for non-loaded sample', () => {
      expect(loader.isLoaded(28)).toBe(false);
      expect(loader.isLoaded(33)).toBe(false);
      expect(loader.isLoaded(0)).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return empty Map initially', () => {
      const status = loader.getStatus();
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });

    it('should return a copy of the internal status map', () => {
      const status1 = loader.getStatus();
      const status2 = loader.getStatus();
      expect(status1).not.toBe(status2);
    });
  });

  describe('getStats', () => {
    it('should return all zeros initially', () => {
      const stats = loader.getStats();
      expect(stats).toEqual({
        loaded: 0,
        loading: 0,
        pending: 0,
        error: 0,
      });
    });

    it('should have correct stat structure', () => {
      const stats = loader.getStats();
      expect(stats).toHaveProperty('loaded');
      expect(stats).toHaveProperty('loading');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('error');
      expect(typeof stats.loaded).toBe('number');
      expect(typeof stats.loading).toBe('number');
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.error).toBe('number');
    });
  });

  describe('clear', () => {
    it('should reset all internal state', () => {
      loader.clear();

      expect(loader.getBufferMap().size).toBe(0);
      expect(loader.getStatus().size).toBe(0);
      expect(loader.getStats()).toEqual({
        loaded: 0,
        loading: 0,
        pending: 0,
        error: 0,
      });
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        loader.clear();
        loader.clear();
        loader.clear();
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clear everything', () => {
      loader.dispose();

      expect(loader.getBufferMap().size).toBe(0);
      expect(loader.getStatus().size).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        loader.dispose();
        loader.dispose();
        loader.dispose();
      }).not.toThrow();
    });
  });

  describe('createBatches (internal)', () => {
    it('should handle loading multiple samples', async () => {
      loader.setAudioContext(mockAudioContext);

      // Create more samples than batch size (4)
      const samples = [28, 29, 30, 31, 32, 33, 34, 35].map((midiNote) => ({
        midiNote,
        note: `Note${midiNote}`,
        fret: 0,
        string: 'B' as const,
        url: `http://test.com/${midiNote}.ogg`,
      }));

      const progressCalls: number[] = [];
      await loader.loadSamples(samples, (loaded, total) => {
        progressCalls.push(loaded);
      });

      // Should track progress for all 8 samples
      expect(progressCalls.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('status tracking', () => {
    beforeEach(() => {
      loader.setAudioContext(mockAudioContext);
    });

    it('should update status during loading', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://test.com/E1.ogg',
        },
      ];

      await loader.loadSamples(samples);

      const status = loader.getStatus();
      const sampleStatus = status.get(28);

      expect(sampleStatus).toBeDefined();
      expect(sampleStatus?.midiNote).toBe(28);
      expect(sampleStatus?.noteName).toBe('E1');
      // Status should be terminal (ready or error)
      expect(['ready', 'error']).toContain(sampleStatus?.status);
    });

    it('should include error message on failure', async () => {
      const samples = [
        {
          midiNote: 28,
          note: 'E1',
          fret: 0,
          string: 'E' as const,
          url: 'http://invalid.com/fail.ogg',
        },
      ];

      await loader.loadSamples(samples);

      const status = loader.getStatus();
      const sampleStatus = status.get(28);

      expect(sampleStatus?.status).toBe('error');
      expect(sampleStatus?.error).toBeDefined();
    });
  });
});
