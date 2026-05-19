/**
 * BassPreloadStrategy Unit Tests
 *
 * Tests the BassPreloadStrategy class API behavior:
 * - loadEssentialSamples (skipped for bass)
 * - loadFullSamples behavior with exercise.notes (fretboard data)
 * - Progress tracking
 * - getLoadedBuffers
 * - clear
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Metadata storage for mock
const metadataStore = new Map<string, any>();
const bufferStore = new Map<string, ArrayBuffer>();

// Mock GlobalSampleCache with new methods for ArrayBuffer caching
vi.mock('../../../storage/cache/GlobalSampleCache.js', () => ({
  GlobalSampleCache: {
    getInstance: vi.fn(() => ({
      getMetadata: vi.fn((key: string) => metadataStore.get(key)),
      cacheMetadata: vi.fn((key: string, data: any) => {
        metadataStore.set(key, data);
      }),
      clearMetadata: vi.fn((key: string) => {
        metadataStore.delete(key);
      }),
      getCachedRawBuffer: vi.fn(
        async (key: string) => bufferStore.get(key) || null,
      ),
      cacheBuffer: vi.fn(async (key: string, buffer: ArrayBuffer) => {
        bufferStore.set(key, buffer);
      }),
    })),
  },
}));

// Mock the logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock fetch for sample downloading - MUST be before imports
const mockArrayBuffer = new ArrayBuffer(1024);
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(mockArrayBuffer.slice(0)), // Return a copy each time
  }),
);

// Mock BassSampleLoader class constructor
const mockBuffers = {
  '28': {} as AudioBuffer,
  '33': {} as AudioBuffer,
  '38': {} as AudioBuffer,
  '43': {} as AudioBuffer,
};

class MockBassSampleLoader {
  setAudioContext = vi.fn();
  loadSamplesForNotes = vi.fn().mockImplementation((notes, onProgress) => {
    if (onProgress) onProgress(4, 4);
    return Promise.resolve({ success: true, loaded: 4, failed: 0, errors: [] });
  });
  getBuffers = vi.fn().mockReturnValue(mockBuffers);
  dispose = vi.fn();
}

// Mock bass-sampler module with getSampleForMidiNote
vi.mock('../../../instruments/implementations/bass-sampler/index.js', () => ({
  BassSampleLoader: vi
    .fn()
    .mockImplementation(() => new MockBassSampleLoader()),
  BASS_TUNING: { B: 23, E: 28, A: 33, D: 38, G: 43 },
  STRING_NUMBER_TO_NAME: { 1: 'B', 2: 'E', 3: 'A', 4: 'D', 5: 'G' },
  getSampleForMidiNote: vi.fn().mockImplementation((midiNote: number) => ({
    midiNote,
    note: `note-${midiNote}`,
    url: `https://example.com/bass/${midiNote}.ogg`,
    string: 'E',
    fret: midiNote - 28,
  })),
  noteNameToMidi: vi.fn().mockImplementation((note) => {
    const mapping: Record<string, number> = { E1: 28, A1: 33, D2: 38, G2: 43 };
    return mapping[note] || 40;
  }),
}));

import { BassPreloadStrategy } from '../BassPreloadStrategy.js';

describe('BassPreloadStrategy', () => {
  let strategy: BassPreloadStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    metadataStore.clear();
    bufferStore.clear();
    // Clean window state
    delete (window as any).__globalCoreServices;
    delete (window as any).__coreServices;
    strategy = new BassPreloadStrategy();
  });

  afterEach(async () => {
    await strategy.clear();
  });

  describe('constructor', () => {
    it('should create strategy with name "bass"', () => {
      expect(strategy.name).toBe('bass');
    });
  });

  describe('loadEssentialSamples', () => {
    it('should skip essential loading (returns success with 0 loaded)', async () => {
      const result = await strategy.loadEssentialSamples();

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('loadFullSamples', () => {
    it('should return success with 0 samples when no exercise provided', async () => {
      const result = await strategy.loadFullSamples();

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should return success with 0 samples when exercise has no notes', async () => {
      const exercise = {
        id: 'test-exercise',
        title: 'Test Exercise',
        notes: [], // Empty notes array
      };

      const result = await strategy.loadFullSamples(undefined, exercise as any);

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should extract correct number of MIDI notes from exercise.notes', async () => {
      // Exercise data uses guitar-style string numbering (string 1 = highest
      // pitch = G2 = MIDI 43; string 4 = lowest = E1 = MIDI 28). See
      // getMidiFromStringAndFret() doc-comment in BassPreloadStrategy.ts.
      const exercise = {
        id: 'test-exercise',
        title: 'Test Exercise',
        notes: [
          { string: 2, fret: 0, duration: 0.5, startTime: 0 }, // D2 = MIDI 38
          { string: 2, fret: 5, duration: 0.5, startTime: 0.5 }, // G2 = MIDI 43
          { string: 3, fret: 0, duration: 0.5, startTime: 1.0 }, // A1 = MIDI 33
          { string: 4, fret: 0, duration: 0.5, startTime: 1.5 }, // E1 = MIDI 28
        ],
      };

      const result = await strategy.loadFullSamples(undefined, exercise as any);

      // Should extract 4 unique MIDI notes: 28, 33, 38, 43 (no duplicates here).
      expect(result.total).toBe(4);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('loaded');
      expect(result).toHaveProperty('metadata');
      expect((result.metadata as any)?.midiNotes).toEqual([28, 33, 38, 43]);
    });

    it('should skip non-bass string notes', async () => {
      const exercise = {
        id: 'test-exercise',
        title: 'Test Exercise',
        notes: [
          { string: 2, fret: 0, duration: 0.5, startTime: 0 }, // D2 = MIDI 38 (valid bass)
          { string: 6, fret: 0, duration: 0.5, startTime: 0.5 }, // Invalid string (only 1-5 valid)
          { string: 0, fret: 0, duration: 0.5, startTime: 1.0 }, // Invalid string
        ],
      };

      const result = await strategy.loadFullSamples(undefined, exercise as any);

      // Should only include 1 note (the valid bass note on string 2).
      expect(result.total).toBe(1);
      expect((result.metadata as any)?.midiNotes).toEqual([38]);
    });
  });

  describe('setProgressCallback', () => {
    it('should accept progress callback without error', () => {
      const callback = vi.fn();
      expect(() => strategy.setProgressCallback(callback)).not.toThrow();
    });
  });

  describe('getProgress', () => {
    it('should return correct progress structure', () => {
      const progress = strategy.getProgress();

      expect(progress).toHaveProperty('loaded');
      expect(progress).toHaveProperty('total');
      expect(progress).toHaveProperty('progress');
      expect(typeof progress.progress).toBe('number');
    });

    it('should return 0 progress when nothing loaded', () => {
      const progress = strategy.getProgress();

      expect(progress.loaded).toBe(0);
      expect(progress.total).toBe(0);
      expect(progress.progress).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear internal state', async () => {
      await strategy.clear();

      const progress = strategy.getProgress();
      expect(progress.loaded).toBe(0);
      expect(progress.total).toBe(0);
    });

    it('should be safe to call multiple times', async () => {
      await strategy.clear();
      await strategy.clear();
      await strategy.clear();

      expect(strategy.getProgress().loaded).toBe(0);
    });
  });

  describe('getLoadedBuffers', () => {
    it('should return null when no loader exists', () => {
      const buffers = strategy.getLoadedBuffers();
      expect(buffers).toBeNull();
    });
  });

  describe('loadFromCachedMetadata', () => {
    it('should return success with 0 when no cached metadata', async () => {
      const mockContext = {
        state: 'running',
        decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
      } as unknown as AudioContext;

      const result = await strategy.loadFromCachedMetadata(mockContext);

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
    });

    it('should decode cached ArrayBuffers when metadata exists', async () => {
      // Setup cached metadata
      metadataStore.set('bass-required-notes', {
        exerciseId: 'test-exercise',
        requiredNotes: ['E1', 'A1'],
        midiNotes: [28, 33],
        noteCount: 2,
      });

      // Cache key format: `bass-{midiNote}-{string}` (see buildBassCacheKey
      // in BassPreloadStrategy.ts). The mocked getSampleForMidiNote() at the
      // top of this file always returns `string: 'E'` regardless of MIDI
      // note, so the legacy path here builds bass-28-E and bass-33-E.
      bufferStore.set('bass-28-E', new ArrayBuffer(512));
      bufferStore.set('bass-33-E', new ArrayBuffer(512));

      const mockContext = {
        state: 'running',
        decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
      } as unknown as AudioContext;

      const result = await strategy.loadFromCachedMetadata(mockContext);

      expect(result.success).toBe(true);
      expect(result.loaded).toBe(2);
      expect(mockContext.decodeAudioData).toHaveBeenCalledTimes(2);
    });
  });
});

describe('BassPreloadStrategy with CoreServices', () => {
  let strategy: BassPreloadStrategy;
  let mockContext: any;
  let mockPlaybackEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    metadataStore.clear();
    bufferStore.clear();

    // Setup mock AudioContext with decodeAudioData
    mockContext = {
      state: 'running',
      destination: {},
      sampleRate: 48000,
      decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
    };

    const mockAudioEngine = {
      isReady: vi.fn().mockReturnValue(true),
      getContext: vi.fn().mockReturnValue(mockContext),
    };

    mockPlaybackEngine = {
      setBassBuffers: vi.fn(),
    };

    (window as any).__globalCoreServices = {
      getAudioEngine: vi.fn().mockReturnValue(mockAudioEngine),
      getPlaybackEngine: vi.fn().mockReturnValue(mockPlaybackEngine),
    };

    strategy = new BassPreloadStrategy();
  });

  afterEach(async () => {
    delete (window as any).__globalCoreServices;
    await strategy.clear();
  });

  it('should attempt to download samples when exercise has notes', async () => {
    // Guitar-style string numbering: 1=G2(43), 2=D2(38), 3=A1(33), 4=E1(28), 5=B0(23)
    const exercise = {
      id: 'test-exercise',
      title: 'Test Exercise',
      notes: [
        { string: 2, fret: 0, duration: 0.5, startTime: 0 }, // D2 = MIDI 38
        { string: 3, fret: 0, duration: 0.5, startTime: 0.5 }, // A1 = MIDI 33
      ],
    };

    const result = await strategy.loadFullSamples(undefined, exercise as any);

    // Should identify 2 unique notes (sorted ascending)
    expect(result.total).toBe(2);
    expect((result.metadata as any)?.midiNotes).toEqual([33, 38]);
  });

  it('should cache metadata for deferred loading', async () => {
    const exercise = {
      id: 'test-exercise',
      title: 'Test Exercise',
      notes: [
        { string: 2, fret: 0, duration: 0.5, startTime: 0 }, // D2 = MIDI 38
      ],
    };

    await strategy.loadFullSamples(undefined, exercise as any);

    // Metadata should be cached
    const cached = metadataStore.get('bass-required-notes');
    expect(cached).toBeDefined();
    expect(cached.exerciseId).toBe('test-exercise');
    expect(cached.midiNotes).toEqual([38]);
  });
});
