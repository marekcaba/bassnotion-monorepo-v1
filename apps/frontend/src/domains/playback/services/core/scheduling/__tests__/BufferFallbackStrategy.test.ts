/**
 * BufferFallbackStrategy Tests
 *
 * Comprehensive test coverage for buffer resolution and fallback logic
 * Tests internal map, global cache, and velocity layer fallback strategies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BufferFallbackStrategy } from '../BufferFallbackStrategy.js';
import { GlobalSampleCache } from '../../../../modules/storage/cache/GlobalSampleCache.js';

// Mock AudioBuffer
function createMockBuffer(duration: number = 1.0): AudioBuffer {
  return {
    duration,
    length: duration * 48000,
    numberOfChannels: 2,
    sampleRate: 48000,
  } as AudioBuffer;
}

// Mock GlobalSampleCache
vi.mock('../../../../modules/storage/cache/GlobalSampleCache.js', () => {
  const mockCache = new Map<string, AudioBuffer>();

  return {
    GlobalSampleCache: {
      getCachedBuffer: vi.fn((key: string) => mockCache.get(key) || null),
      getInstance: vi.fn(() => ({ samples: mockCache })),
      // Helper to set cache for tests
      __setMockCache: (key: string, buffer: AudioBuffer) =>
        mockCache.set(key, buffer),
      __clearMockCache: () => mockCache.clear(),
    },
  };
});

describe('BufferFallbackStrategy', () => {
  let bufferMap: Map<string, Map<string, AudioBuffer>>;

  beforeEach(() => {
    bufferMap = new Map();
    vi.clearAllMocks();
    (GlobalSampleCache as any).__clearMockCache();
  });

  afterEach(() => {
    (GlobalSampleCache as any).__clearMockCache();
  });

  // ============================================================================
  // STRATEGY 1: Internal Buffer Map
  // ============================================================================
  describe('Strategy 1: Internal Buffer Map', () => {
    it('should find buffer in internal map (fastest path)', () => {
      const buffer = createMockBuffer();
      bufferMap.set('v3', new Map([['A4', buffer]]));

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v3',
        'A4',
      );

      expect(result.buffer).toBe(buffer);
      expect(result.layerUsed).toBe('v3');
      expect(result.source).toBe('internal-map');
      expect(GlobalSampleCache.getCachedBuffer).not.toHaveBeenCalled();
    });

    it('should return buffer for exact layer and note match', () => {
      const buffers = new Map([
        ['C4', createMockBuffer()],
        ['D4', createMockBuffer()],
        ['E4', createMockBuffer()],
      ]);
      bufferMap.set('v2', buffers);

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'wurlitzer',
        'v2',
        'D4',
      );

      expect(result.buffer).not.toBeNull();
      expect(result.source).toBe('internal-map');
    });

    it('should handle sharp notation (Cs, Ds, Fs)', () => {
      const buffer = createMockBuffer();
      bufferMap.set('v4', new Map([['Cs5', buffer]]));

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v4',
        'Cs5',
      );

      expect(result.buffer).toBe(buffer);
      expect(result.source).toBe('internal-map');
    });
  });

  // ============================================================================
  // STRATEGY 2: GlobalSampleCache Fallback
  // ============================================================================
  describe('Strategy 2: GlobalSampleCache Fallback', () => {
    it('should fallback to GlobalSampleCache when not in internal map', () => {
      const buffer = createMockBuffer();
      const cacheKey = 'grandpiano-v3-A4';
      (GlobalSampleCache as any).__setMockCache(cacheKey, buffer);

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v3',
        'A4',
      );

      expect(result.buffer).toBe(buffer);
      expect(result.layerUsed).toBe('v3');
      expect(result.source).toBe('global-cache');
      expect(result.cacheKey).toBe(cacheKey);
      expect(GlobalSampleCache.getCachedBuffer).toHaveBeenCalledWith(cacheKey);
    });

    it('should build correct cache key for different instruments', () => {
      const testCases = [
        {
          instrument: 'grandpiano',
          layer: 'v5',
          note: 'C4',
          expected: 'grandpiano-v5-C4',
        },
        {
          instrument: 'wurlitzer',
          layer: 'v2',
          note: 'Fs3',
          expected: 'wurlitzer-v2-Fs3',
        },
        {
          instrument: 'rhodes',
          layer: 'v4',
          note: 'Gs5',
          expected: 'rhodes-v4-Gs5',
        },
      ];

      testCases.forEach(({ instrument, layer, note, expected }) => {
        const buffer = createMockBuffer();
        (GlobalSampleCache as any).__setMockCache(expected, buffer);

        const result = BufferFallbackStrategy.resolveBuffer(
          bufferMap,
          instrument,
          layer,
          note,
        );

        expect(result.buffer).toBe(buffer);
        expect(result.cacheKey).toBe(expected);
      });
    });

    it('should handle race condition: play before preload completes', () => {
      // Scenario: User clicks play, internal map empty, but GlobalSampleCache has buffers
      const buffer = createMockBuffer();
      (GlobalSampleCache as any).__setMockCache('wurlitzer-v3-D4', buffer);

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap, // Empty internal map
        'wurlitzer',
        'v3',
        'D4',
      );

      expect(result.buffer).toBe(buffer);
      expect(result.source).toBe('global-cache');
    });
  });

  // ============================================================================
  // STRATEGY 3: Velocity Layer Fallback
  // ============================================================================
  describe('Strategy 3: Velocity Layer Fallback', () => {
    it('should fallback to alternative velocity layer if requested layer missing', () => {
      const v5Buffer = createMockBuffer();
      bufferMap.set('v5', new Map([['A4', v5Buffer]]));
      bufferMap.set('v3', new Map([['C4', createMockBuffer()]])); // Different note

      // Request v3, but A4 only exists in v5
      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v3',
        'A4',
      );

      expect(result.buffer).toBe(v5Buffer);
      expect(result.layerUsed).toBe('v5');
      expect(result.source).toBe('fallback-layer');
    });

    it('should try fallback layers from highest to lowest velocity', () => {
      // Setup: v5, v3, v1 available, request v2 (missing)
      const v5Buffer = createMockBuffer();
      const v3Buffer = createMockBuffer();
      const v1Buffer = createMockBuffer();

      bufferMap.set('v5', new Map([['A4', v5Buffer]]));
      bufferMap.set('v3', new Map([['A4', v3Buffer]]));
      bufferMap.set('v1', new Map([['A4', v1Buffer]]));

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'wurlitzer',
        'v2', // Missing layer
        'A4',
      );

      // Should pick v5 (highest available)
      expect(result.buffer).toBe(v5Buffer);
      expect(result.layerUsed).toBe('v5');
    });

    it('should skip requested layer when searching fallbacks', () => {
      const v2Buffer = createMockBuffer();

      bufferMap.set('v3', new Map([['C4', createMockBuffer()]])); // Different note
      bufferMap.set('v2', new Map([['A4', v2Buffer]]));

      // Request v3 for A4 (exists for C4 but not A4)
      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v3',
        'A4',
      );

      // Should use v2 (not re-check v3)
      expect(result.buffer).toBe(v2Buffer);
      expect(result.layerUsed).toBe('v2');
    });

    it('should try GlobalSampleCache for fallback layers too', () => {
      // Setup: v3 requested but missing everywhere
      // v5 exists in GlobalSampleCache
      const v5Buffer = createMockBuffer();
      (GlobalSampleCache as any).__setMockCache('grandpiano-v5-A4', v5Buffer);

      bufferMap.set('v5', new Map()); // Empty layer map

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v3',
        'A4',
      );

      expect(result.buffer).toBe(v5Buffer);
      expect(result.layerUsed).toBe('v5');
      expect(result.source).toBe('global-cache');
      expect(result.cacheKey).toBe('grandpiano-v5-A4');
    });

    it('should handle numeric layer sorting correctly (v10 > v9 > v2 > v1)', () => {
      // Setup layers with double-digit velocity layers
      const v10Buffer = createMockBuffer();
      const v2Buffer = createMockBuffer();

      bufferMap.set('v10', new Map([['A4', v10Buffer]]));
      bufferMap.set('v2', new Map([['A4', v2Buffer]]));
      bufferMap.set('v1', new Map());

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v5', // Missing
        'A4',
      );

      // Should pick v10 (highest), not v2
      expect(result.buffer).toBe(v10Buffer);
      expect(result.layerUsed).toBe('v10');
    });
  });

  // ============================================================================
  // STRATEGY 4: All Strategies Failed
  // ============================================================================
  describe('Strategy 4: Not Found (All Strategies Failed)', () => {
    it('should return null when buffer not found anywhere', () => {
      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap, // Empty
        'grandpiano',
        'v3',
        'A4',
      );

      expect(result.buffer).toBeNull();
      expect(result.source).toBe('not-found');
      expect(result.layerUsed).toBe('v3'); // Original requested layer
    });

    it('should return cache key even when not found', () => {
      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'wurlitzer',
        'v2',
        'Fs4',
      );

      expect(result.buffer).toBeNull();
      expect(result.cacheKey).toBe('wurlitzer-v2-Fs4');
    });

    it('should try all strategies before giving up', () => {
      bufferMap.set('v5', new Map([['C4', createMockBuffer()]])); // Wrong note
      bufferMap.set('v3', new Map([['D4', createMockBuffer()]])); // Wrong note

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v4',
        'A4', // Not in any layer
      );

      expect(result.buffer).toBeNull();
      expect(GlobalSampleCache.getCachedBuffer).toHaveBeenCalledWith(
        'grandpiano-v4-A4',
      );
      // Should have tried fallback layers v5 and v3 too
    });
  });

  // ============================================================================
  // CACHE KEY GENERATION
  // ============================================================================
  describe('Cache Key Generation', () => {
    it('should build correct cache key format', () => {
      const key = BufferFallbackStrategy.buildCacheKey(
        'grandpiano',
        'v3',
        'A4',
      );
      expect(key).toBe('grandpiano-v3-A4');
    });

    it('should handle sharp notation in cache keys', () => {
      const key1 = BufferFallbackStrategy.buildCacheKey(
        'wurlitzer',
        'v2',
        'Cs5',
      );
      const key2 = BufferFallbackStrategy.buildCacheKey('rhodes', 'v4', 'Fs3');

      expect(key1).toBe('wurlitzer-v2-Cs5');
      expect(key2).toBe('rhodes-v4-Fs3');
    });

    it('should generate unique keys for different combinations', () => {
      const keys = [
        BufferFallbackStrategy.buildCacheKey('grandpiano', 'v1', 'C4'),
        BufferFallbackStrategy.buildCacheKey('grandpiano', 'v2', 'C4'),
        BufferFallbackStrategy.buildCacheKey('grandpiano', 'v1', 'D4'),
        BufferFallbackStrategy.buildCacheKey('wurlitzer', 'v1', 'C4'),
      ];

      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(4); // All unique
    });
  });

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  describe('Utility Methods', () => {
    it('should get available layers from buffer map', () => {
      bufferMap.set('v5', new Map());
      bufferMap.set('v3', new Map());
      bufferMap.set('v1', new Map());

      const layers = BufferFallbackStrategy.getAvailableLayers(bufferMap);

      expect(layers).toContain('v5');
      expect(layers).toContain('v3');
      expect(layers).toContain('v1');
      expect(layers.length).toBe(3);
    });

    it('should return empty array for empty buffer map', () => {
      const layers = BufferFallbackStrategy.getAvailableLayers(bufferMap);
      expect(layers).toEqual([]);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================
  describe('Real-World Scenarios', () => {
    it('should handle Grand Piano with 7 velocity layers', () => {
      // Setup Grand Piano with layers v1-v7
      for (let i = 1; i <= 7; i++) {
        bufferMap.set(`v${i}`, new Map([['A4', createMockBuffer()]]));
      }

      // Request v4 (exists)
      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'grandpiano',
        'v4',
        'A4',
      );

      expect(result.buffer).not.toBeNull();
      expect(result.layerUsed).toBe('v4');
      expect(result.source).toBe('internal-map');
    });

    it('should handle Wurlitzer with missing layer (use fallback)', () => {
      // Wurlitzer has v1-v5, but v3 is missing for this note
      bufferMap.set('v5', new Map([['D4', createMockBuffer()]]));
      bufferMap.set('v4', new Map([['D4', createMockBuffer()]]));
      bufferMap.set('v2', new Map([['D4', createMockBuffer()]]));
      bufferMap.set('v1', new Map([['D4', createMockBuffer()]]));

      const result = BufferFallbackStrategy.resolveBuffer(
        bufferMap,
        'wurlitzer',
        'v3', // Missing
        'D4',
      );

      // Should use highest available (v5)
      expect(result.buffer).not.toBeNull();
      expect(result.layerUsed).toBe('v5');
    });

    it("should handle preloading race: cache has buffer but map doesn't", () => {
      const buffer = createMockBuffer();
      (GlobalSampleCache as any).__setMockCache('rhodes-v2-E4', buffer);

      const result = BufferFallbackStrategy.resolveBuffer(
        new Map(), // Empty internal map
        'rhodes',
        'v2',
        'E4',
      );

      expect(result.buffer).toBe(buffer);
      expect(result.source).toBe('global-cache');
    });
  });
});
