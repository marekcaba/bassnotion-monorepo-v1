/**
 * GlobalSampleCache Double-Caching Tests
 *
 * Tests the fix for the double-caching bug where calling cacheBuffer()
 * twice with the same key but different buffer types would cause data loss.
 *
 * Bug: When caching ArrayBuffer then AudioBuffer (or vice versa) with the
 * same key, the second call would overwrite the entire cache entry, losing
 * the first buffer.
 *
 * Fix: Cache entries now merge data instead of replacing, allowing both
 * rawBuffer and buffer to coexist.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlobalSampleCache } from '../GlobalSampleCache.js';

// Mock dependencies
vi.mock('@/utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/shared/messaging/EventBus', () => ({
  EventBus: class {
    on = vi.fn();
    emit = vi.fn();
    off = vi.fn();
  },
}));

// Mock AudioBuffer class for Node.js environment
class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  private channelData: Float32Array[];

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.numberOfChannels = options.numberOfChannels;
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = options.length / options.sampleRate;
    this.channelData = Array.from(
      { length: options.numberOfChannels },
      () => new Float32Array(options.length)
    );
  }

  getChannelData(channel: number): Float32Array {
    return this.channelData[channel];
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel = 0): void {
    const data = this.getChannelData(channelNumber);
    destination.set(data.slice(startInChannel));
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel = 0): void {
    const data = this.getChannelData(channelNumber);
    data.set(source, startInChannel);
  }
}

// Define AudioBuffer globally for Node.js test environment if it doesn't exist
if (typeof AudioBuffer === 'undefined') {
  (global as any).AudioBuffer = MockAudioBuffer;
}

describe('GlobalSampleCache - Double-Caching Fix', () => {
  let cache: ReturnType<typeof GlobalSampleCache.getInstance>;
  let testArrayBuffer: ArrayBuffer;
  let testAudioBuffer: AudioBuffer;

  beforeEach(async () => {
    // Get fresh cache instance
    // Note: IndexedDB won't be available in test environment, but memory cache will work
    cache = GlobalSampleCache.getInstance();

    // Clear memory cache before each test
    cache.clear();

    // Create test ArrayBuffer (1KB of data)
    testArrayBuffer = new ArrayBuffer(1024);
    const view = new Uint8Array(testArrayBuffer);
    for (let i = 0; i < 1024; i++) {
      view[i] = i % 256;
    }

    // Create test AudioBuffer using MockAudioBuffer
    testAudioBuffer = new MockAudioBuffer({
      numberOfChannels: 2,
      length: 44100,
      sampleRate: 44100,
    }) as any as AudioBuffer;

    // Fill with test audio data
    for (let channel = 0; channel < 2; channel++) {
      const channelData = testAudioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
      }
    }
  });

  describe('ArrayBuffer → AudioBuffer caching', () => {
    it('should preserve rawBuffer when caching AudioBuffer after ArrayBuffer', async () => {
      const key = 'test-sample-1';

      // First: Cache ArrayBuffer
      await cache.cacheBuffer(key, testArrayBuffer);

      // Verify rawBuffer is cached
      const rawBufferAfterFirst = await cache.getCachedRawBuffer(key);
      expect(rawBufferAfterFirst).toBe(testArrayBuffer);

      // Second: Cache AudioBuffer with same key (must await even though AudioBuffer path is sync)
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      // ✅ Both should still be retrievable (this is the fix)
      const rawBufferAfterSecond = await cache.getCachedRawBuffer(key);
      const audioBufferAfterSecond = cache.getCachedBuffer(key);

      expect(rawBufferAfterSecond).toBe(testArrayBuffer);
      expect(audioBufferAfterSecond).toBe(testAudioBuffer);
    });

    it('should have both buffers accessible via public API', async () => {
      const key = 'test-sample-2';

      await cache.cacheBuffer(key, testArrayBuffer);
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      const rawBuffer = await cache.getCachedRawBuffer(key);
      const audioBuffer = cache.getCachedBuffer(key);

      expect(rawBuffer).toBe(testArrayBuffer);
      expect(audioBuffer).toBe(testAudioBuffer);
    });
  });

  describe('AudioBuffer → ArrayBuffer caching', () => {
    it('should preserve buffer when caching ArrayBuffer after AudioBuffer', async () => {
      const key = 'test-sample-3';

      // First: Cache AudioBuffer
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      // Verify AudioBuffer is cached
      const audioBufferAfterFirst = cache.getCachedBuffer(key);
      expect(audioBufferAfterFirst).toBe(testAudioBuffer);

      // Second: Cache ArrayBuffer with same key
      await cache.cacheBuffer(key, testArrayBuffer);

      // ✅ Both should still be retrievable (this is the fix)
      const audioBufferAfterSecond = cache.getCachedBuffer(key);
      const rawBufferAfterSecond = await cache.getCachedRawBuffer(key);

      expect(audioBufferAfterSecond).toBe(testAudioBuffer);
      expect(rawBufferAfterSecond).toBe(testArrayBuffer);
    });
  });

  describe('Real-world WamDrummer/WamMetronome pattern', () => {
    it('should handle the WamDrummer caching pattern', async () => {
      const drumKey = 'drum-kick';

      // 1. Fetch from network and cache raw ArrayBuffer
      await cache.cacheBuffer(drumKey, testArrayBuffer);

      // 2. Decode and cache AudioBuffer (what WamDrummer does)
      await cache.cacheBuffer(drumKey, testAudioBuffer, { isContextCompatible: true });

      // 3. Also cache with pad number (WamDrummer does this)
      await cache.cacheBuffer(`drum-pad-1`, testArrayBuffer);
      await cache.cacheBuffer(`drum-pad-1`, testAudioBuffer, { isContextCompatible: true });

      // ✅ Verify all buffers are still accessible
      expect(await cache.getCachedRawBuffer(drumKey)).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer(drumKey)).toBe(testAudioBuffer);
      expect(await cache.getCachedRawBuffer('drum-pad-1')).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer('drum-pad-1')).toBe(testAudioBuffer);
    });

    it('should handle the WamMetronome caching pattern', async () => {
      const highKey = 'metronome-high';
      const lowKey = 'metronome-low';

      // Cache high click (raw then decoded)
      await cache.cacheBuffer(highKey, testArrayBuffer);
      await cache.cacheBuffer(highKey, testAudioBuffer, { isContextCompatible: true });

      // Cache low click (raw then decoded)
      await cache.cacheBuffer(lowKey, testArrayBuffer);
      await cache.cacheBuffer(lowKey, testAudioBuffer, { isContextCompatible: true });

      // ✅ Verify all buffers are still accessible
      expect(await cache.getCachedRawBuffer(highKey)).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer(highKey)).toBe(testAudioBuffer);
      expect(await cache.getCachedRawBuffer(lowKey)).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer(lowKey)).toBe(testAudioBuffer);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple overwrites gracefully', async () => {
      const key = 'test-sample-4';

      // Cache sequence: Array → Audio → Array → Audio
      await cache.cacheBuffer(key, testArrayBuffer);
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });
      await cache.cacheBuffer(key, testArrayBuffer);
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      // Both should still be accessible
      expect(await cache.getCachedRawBuffer(key)).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer(key)).toBe(testAudioBuffer);
    });

    it('should preserve both buffers across multiple caching operations', async () => {
      const key = 'test-sample-5';

      // Cache AudioBuffer with compatibility flag
      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      // Verify AudioBuffer is cached
      const audioBuffer1 = cache.getCachedBuffer(key);
      expect(audioBuffer1).toBe(testAudioBuffer);

      // Cache ArrayBuffer (should preserve AudioBuffer)
      await cache.cacheBuffer(key, testArrayBuffer);

      // Both should still be accessible
      const audioBuffer2 = cache.getCachedBuffer(key);
      const rawBuffer = await cache.getCachedRawBuffer(key);

      expect(audioBuffer2).toBe(testAudioBuffer);
      expect(rawBuffer).toBe(testArrayBuffer);
    });
  });

  describe('Backwards compatibility', () => {
    it('should still work when caching only ArrayBuffer', async () => {
      const key = 'test-sample-7';

      await cache.cacheBuffer(key, testArrayBuffer);

      expect(await cache.getCachedRawBuffer(key)).toBe(testArrayBuffer);
      expect(cache.getCachedBuffer(key)).toBeUndefined();
    });

    it('should still work when caching only AudioBuffer', async () => {
      const key = 'test-sample-8';

      await cache.cacheBuffer(key, testAudioBuffer, { isContextCompatible: true });

      expect(cache.getCachedBuffer(key)).toBe(testAudioBuffer);
      // Note: getCachedRawBuffer will be undefined since we didn't cache raw data
      expect(await cache.getCachedRawBuffer(key)).toBeUndefined();
    });
  });
});
