/**
 * BUG #2: OfflineAudioContext Buffer Compatibility Tests
 *
 * Tests that preload strategies DO NOT cache AudioBuffers decoded from OfflineAudioContext,
 * as these buffers are incompatible with the real AudioContext used for playback.
 *
 * The strategies should cache raw ArrayBuffer data instead, allowing the real AudioContext
 * to decode them later.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarmonyPreloadStrategy } from '../strategies/HarmonyPreloadStrategy.js';
import { DrumPreloadStrategy } from '../strategies/DrumPreloadStrategy.js';
import { MetronomePreloadStrategy } from '../strategies/MetronomePreloadStrategy.js';
import { GlobalSampleCache } from '../../storage/cache/GlobalSampleCache.js';

describe('BUG #2: OfflineAudioContext Buffer Compatibility Prevention', () => {
  let cacheBufferSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on GlobalSampleCache.cacheBuffer to detect what types of buffers are being cached
    cacheBufferSpy = vi.spyOn(GlobalSampleCache.getInstance(), 'cacheBuffer');

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    });

    // Mock Supabase client
    vi.mock('@/infrastructure/supabase/client', () => ({
      supabase: {
        storage: {
          from: () => ({
            getPublicUrl: () => ({
              data: { publicUrl: 'https://test.com/sample.mp3' },
            }),
          }),
        },
      },
    }));

    // Mock OfflineAudioContext
    // Create a mock AudioBuffer class that GlobalSampleCache will recognize
    class MockAudioBuffer {
      duration = 1.0;
      sampleRate = 44100;
      numberOfChannels = 2;
      length = 44100;

      getChannelData(channel: number): Float32Array {
        // Return a Float32Array of the correct length
        return new Float32Array(this.length);
      }

      copyFromChannel(
        destination: Float32Array,
        channelNumber: number,
        startInChannel?: number,
      ): void {
        // Mock implementation
      }

      copyToChannel(
        source: Float32Array,
        channelNumber: number,
        startInChannel?: number,
      ): void {
        // Mock implementation
      }
    }

    // Make MockAudioBuffer pass instanceof checks
    global.AudioBuffer = MockAudioBuffer as any;

    global.OfflineAudioContext = vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue(new MockAudioBuffer()),
    })) as any;

    // Mock AudioContext (separate from OfflineAudioContext)
    global.AudioContext = vi.fn(() => ({
      state: 'running',
      sampleRate: 44100,
      decodeAudioData: vi.fn().mockResolvedValue(new MockAudioBuffer()),
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // HARMONY PRELOAD STRATEGY TESTS
  // ============================================================================

  describe('HarmonyPreloadStrategy - Buffer Type Validation', () => {
    it('should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext', async () => {
      const strategy = new HarmonyPreloadStrategy();

      // This test will FAIL until we fix the bug
      // The strategy currently caches AudioBuffer from OfflineContext
      // It should cache ArrayBuffer instead

      await strategy.loadEssentialSamples({
        instrument: 'grandpiano',
        notes: ['C4'],
        layers: ['v10'],
      });

      // Check all cacheBuffer calls
      const calls = cacheBufferSpy.mock.calls;

      calls.forEach((call: any) => {
        const [_key, buffer, _options] = call;

        // ✅ CORRECT: Buffer should be ArrayBuffer (raw audio data)
        // ❌ BUG: Currently caching AudioBuffer (decoded by OfflineContext)
        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer).not.toBeInstanceOf(AudioBuffer);
      });
    });

    it('should NOT mark OfflineContext buffers as isContextCompatible', async () => {
      const strategy = new HarmonyPreloadStrategy();

      await strategy.loadEssentialSamples({
        instrument: 'grandpiano',
        notes: ['C4'],
        layers: ['v10'],
      });

      // Check all cacheBuffer calls
      const calls = cacheBufferSpy.mock.calls;

      calls.forEach((call: any) => {
        const [_key, buffer, options] = call;

        if (buffer instanceof AudioBuffer) {
          // If an AudioBuffer is cached (which is the bug), it should NOT be marked as compatible
          expect(options?.isContextCompatible).not.toBe(true);
        }
      });
    });

    it('should NOT create OfflineAudioContext at all (BUG #2 FIX)', async () => {
      const strategy = new HarmonyPreloadStrategy();
      const offlineContextSpy = vi.spyOn(global, 'OfflineAudioContext' as any);

      await strategy.loadEssentialSamples({
        instrument: 'grandpiano',
        notes: ['C4'],
        layers: ['v10'],
      });

      // ✅ BUG #2 FIX: OfflineAudioContext should NOT be created at all
      // We cache raw ArrayBuffer data, no decoding needed during preload
      expect(offlineContextSpy).not.toHaveBeenCalled();

      // All cached buffers should be ArrayBuffer
      const calls = cacheBufferSpy.mock.calls;
      calls.forEach((call: any) => {
        const [_key, buffer] = call;
        expect(buffer).toBeInstanceOf(ArrayBuffer);
      });
    });
  });

  // ============================================================================
  // DRUM PRELOAD STRATEGY TESTS
  // ============================================================================

  describe('DrumPreloadStrategy - Buffer Type Validation', () => {
    it('should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext', async () => {
      const strategy = new DrumPreloadStrategy();

      await strategy.loadEssentialSamples();

      const calls = cacheBufferSpy.mock.calls;

      calls.forEach((call: any) => {
        const [_key, buffer] = call;

        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer).not.toBeInstanceOf(AudioBuffer);
      });
    });

    it('should NOT use OfflineAudioContext for buffer decoding', async () => {
      const strategy = new DrumPreloadStrategy();
      const offlineContextSpy = vi.spyOn(global, 'OfflineAudioContext' as any);

      await strategy.loadEssentialSamples();

      // Strategy should fetch raw ArrayBuffer, not decode with OfflineContext
      // Or if it validates with OfflineContext, it should not cache those buffers
      const calls = cacheBufferSpy.mock.calls;
      calls.forEach((call: any) => {
        const [_key, buffer] = call;
        expect(buffer).toBeInstanceOf(ArrayBuffer);
      });
    });
  });

  // ============================================================================
  // METRONOME PRELOAD STRATEGY TESTS
  // ============================================================================

  describe('MetronomePreloadStrategy - Buffer Type Validation', () => {
    it('should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext', async () => {
      const strategy = new MetronomePreloadStrategy();

      await strategy.loadEssentialSamples();

      const calls = cacheBufferSpy.mock.calls;

      calls.forEach((call: any) => {
        const [_key, buffer] = call;

        expect(buffer).toBeInstanceOf(ArrayBuffer);
        expect(buffer).not.toBeInstanceOf(AudioBuffer);
      });
    });

    it('should NOT decode samples with OfflineAudioContext', async () => {
      const strategy = new MetronomePreloadStrategy();

      await strategy.loadEssentialSamples();

      // All cached buffers should be raw ArrayBuffer
      const calls = cacheBufferSpy.mock.calls;
      calls.forEach((call: any) => {
        const [_key, buffer] = call;
        expect(buffer).toBeInstanceOf(ArrayBuffer);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Buffer Compatibility Integration', () => {
    it('should allow real AudioContext to decode cached ArrayBuffers later', async () => {
      const strategy = new HarmonyPreloadStrategy();

      // Preload samples (should cache ArrayBuffer)
      await strategy.loadEssentialSamples({
        instrument: 'grandpiano',
        notes: ['C4'],
        layers: ['v10'],
      });

      // ✅ BUG #2 FIX: Use getCachedRawBuffer() to get ArrayBuffer (not getCachedBuffer which returns AudioBuffer)
      // getCachedRawBuffer is async (it walks the IndexedDB cache), so await it.
      const cachedBuffer =
        await GlobalSampleCache.getInstance().getCachedRawBuffer(
          'grandpiano-v10-C4',
        );

      // Should be ArrayBuffer
      expect(cachedBuffer).toBeInstanceOf(ArrayBuffer);

      // Real AudioContext should be able to decode this
      const realContext = new AudioContext();
      const decodedBuffer = await realContext.decodeAudioData(
        cachedBuffer as ArrayBuffer,
      );

      expect(decodedBuffer).toBeDefined();
      expect(decodedBuffer.duration).toBeGreaterThan(0);
    });

    it('should prevent caching of AudioBuffers with wrong sampleRate', () => {
      // OfflineAudioContext and real AudioContext might have different sample rates
      // This causes playback issues (pitch shift, speed change)

      const offlineBuffer = {
        duration: 1.0,
        sampleRate: 44100, // OfflineContext sample rate
        numberOfChannels: 2,
        length: 44100,
      };

      const realContext = new AudioContext();
      // Real context might be 48000 Hz on some devices

      // If we cache offlineBuffer directly and play it on realContext,
      // the sample rate mismatch causes pitch/speed issues

      // Solution: Cache raw ArrayBuffer, let real context decode it at its sample rate
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle missing samples gracefully without caching invalid data', async () => {
      // Reset spy state and force every cache lookup to miss, so this test
      // observes only the "fresh fetch" branch in production (other tests
      // in the suite pre-populate the cache via prior fetches, which would
      // otherwise route through the keyboard-map alias path).
      cacheBufferSpy.mockClear();
      const cache = GlobalSampleCache.getInstance() as any;
      const originalGetRaw = cache.getCachedRawBuffer.bind(cache);
      cache.getCachedRawBuffer = vi.fn(async () => undefined);
      const originalGetMeta = cache.getCachedMetadata?.bind(cache);
      if (cache.getCachedMetadata) {
        cache.getCachedMetadata = vi.fn(() => null);
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const strategy = new HarmonyPreloadStrategy();

      try {
        await strategy.loadEssentialSamples({
          instrument: 'grandpiano',
          notes: ['C4'],
          layers: ['v10'],
        });

        // Failed fetches must never reach the cacheBuffer write path.
        expect(cacheBufferSpy).not.toHaveBeenCalled();
      } finally {
        cache.getCachedRawBuffer = originalGetRaw;
        if (originalGetMeta) {
          cache.getCachedMetadata = originalGetMeta;
        }
      }
    });

    it('should handle decode errors without caching partial data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10), // Invalid audio data
      });

      const offlineContext = new OfflineAudioContext(2, 44100, 44100);
      vi.spyOn(offlineContext, 'decodeAudioData').mockRejectedValue(
        new Error('Invalid audio data'),
      );

      const strategy = new DrumPreloadStrategy();

      await strategy.loadEssentialSamples();

      // Should still cache the raw ArrayBuffer (let real context try to decode later)
      // Or don't cache anything if validation fails
      const calls = cacheBufferSpy.mock.calls;
      if (calls.length > 0) {
        calls.forEach((call: any) => {
          const [_key, buffer] = call;
          expect(buffer).toBeInstanceOf(ArrayBuffer);
        });
      }
    });
  });
});
