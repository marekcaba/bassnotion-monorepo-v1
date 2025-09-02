import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalSampleCache } from '../GlobalSampleCache';

describe('GlobalSampleCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    GlobalSampleCache.clear();
  });

  describe('URL Caching', () => {
    it('should cache and retrieve URLs', () => {
      const path = 'drums/kick.mp3';
      const url = 'https://example.com/kick.mp3';

      GlobalSampleCache.cacheUrl(path, url);
      
      expect(GlobalSampleCache.getCachedUrl(path)).toBe(url);
      expect(GlobalSampleCache.hasSample(path)).toBe(true);
    });

    it('should handle multiple URL aliases', () => {
      const url = 'https://example.com/kick.mp3';

      GlobalSampleCache.cacheUrl('drums/kick.mp3', url);
      GlobalSampleCache.cacheUrl('drum-pad-1', url);

      expect(GlobalSampleCache.getCachedUrl('drums/kick.mp3')).toBe(url);
      expect(GlobalSampleCache.getCachedUrl('drum-pad-1')).toBe(url);
    });
  });

  describe('Buffer Caching', () => {
    it('should cache and retrieve audio buffers', () => {
      const path = 'piano/C4.mp3';
      const mockBuffer = {
        duration: 2.5,
        numberOfChannels: 2,
        sampleRate: 44100,
        length: 110250
      } as AudioBuffer;

      GlobalSampleCache.cacheBuffer(path, mockBuffer);

      expect(GlobalSampleCache.getCachedBuffer(path)).toBe(mockBuffer);
      expect(GlobalSampleCache.hasSample(path)).toBe(true);
    });

    it('should update existing sample with buffer', () => {
      const path = 'piano/C4.mp3';
      const url = 'https://example.com/C4.mp3';
      const mockBuffer = {} as AudioBuffer;

      // First cache URL
      GlobalSampleCache.cacheUrl(path, url);
      
      // Then add buffer
      GlobalSampleCache.cacheBuffer(path, mockBuffer);

      // Should have both
      expect(GlobalSampleCache.getCachedUrl(path)).toBe(url);
      expect(GlobalSampleCache.getCachedBuffer(path)).toBe(mockBuffer);
    });
  });

  describe('Sampler Caching', () => {
    it('should cache and retrieve Tone.js samplers', () => {
      const path = 'piano-sampler';
      const mockSampler = {
        dispose: () => {},
        triggerAttackRelease: () => {}
      } as any;

      GlobalSampleCache.cacheSampler(path, mockSampler);

      expect(GlobalSampleCache.getCachedSampler(path)).toBe(mockSampler);
      expect(GlobalSampleCache.hasSample(path)).toBe(true);
    });
  });

  describe('Instrument Caching', () => {
    it('should cache and retrieve instruments', () => {
      const mockHarmonyInstrument = {
        audioNode: { connect: () => {} },
        type: 'WamKeyboard'
      };

      GlobalSampleCache.cacheInstrument('harmony-preloaded', mockHarmonyInstrument);

      expect(GlobalSampleCache.getCachedInstrument('harmony-preloaded')).toBe(mockHarmonyInstrument);
      expect(GlobalSampleCache.hasInstrument('harmony-preloaded')).toBe(true);
    });

    it('should cache drum instruments as object with multiple pads', () => {
      const mockDrumPads = {
        1: { type: 'Player', name: 'kick' },
        3: { type: 'Player', name: 'snare' },
        5: { type: 'Player', name: 'hihat' }
      };

      GlobalSampleCache.cacheInstrument('drums-preloaded', mockDrumPads);

      const cached = GlobalSampleCache.getCachedInstrument('drums-preloaded');
      expect(cached).toBe(mockDrumPads);
      expect(cached[1].name).toBe('kick');
      expect(cached[3].name).toBe('snare');
      expect(cached[5].name).toBe('hihat');
    });
  });

  describe('Statistics', () => {
    it('should report cache statistics', () => {
      // Add some samples
      GlobalSampleCache.cacheUrl('sample1', 'url1');
      GlobalSampleCache.cacheUrl('sample2', 'url2');
      GlobalSampleCache.cacheBuffer('sample1', {} as AudioBuffer);
      GlobalSampleCache.cacheInstrument('harmony', {});
      GlobalSampleCache.cacheInstrument('drums', {});

      const stats = GlobalSampleCache.getStats();
      
      expect(stats.samplesCount).toBe(2); // 2 samples
      expect(stats.instrumentsCount).toBe(2); // 2 instruments
      expect(stats.totalSize).toBe(4); // Total items
    });

    it('should report detailed cache statistics', () => {
      const mockBuffer = {
        numberOfChannels: 2,
        length: 44100, // 1 second at 44.1kHz
      } as AudioBuffer;

      GlobalSampleCache.cacheUrl('url1', 'http://example.com');
      GlobalSampleCache.cacheBuffer('buffer1', mockBuffer);

      const stats = GlobalSampleCache.getCacheStats();

      expect(stats.bufferCount).toBe(1);
      expect(stats.urlCount).toBe(1);
      expect(stats.totalCachedBuffers).toBe(1);
      expect(stats.totalCachedUrls).toBe(1);
      expect(stats.estimatedMemoryMB).toBeCloseTo(0.337, 2); // ~0.34 MB for stereo 1s buffer
    });
  });

  describe('Cache Management', () => {
    it('should clear specific buffer while keeping URL', () => {
      const path = 'sample.mp3';
      const url = 'https://example.com/sample.mp3';
      const buffer = {} as AudioBuffer;

      GlobalSampleCache.cacheUrl(path, url);
      GlobalSampleCache.cacheBuffer(path, buffer);

      // Clear only buffer
      GlobalSampleCache.clearBuffer(path);

      expect(GlobalSampleCache.getCachedUrl(path)).toBe(url); // URL still there
      expect(GlobalSampleCache.getCachedBuffer(path)).toBeUndefined(); // Buffer cleared
    });

    it('should clear all buffers but keep URLs', () => {
      // Add multiple samples
      for (let i = 0; i < 3; i++) {
        GlobalSampleCache.cacheUrl(`sample${i}`, `url${i}`);
        GlobalSampleCache.cacheBuffer(`sample${i}`, {} as AudioBuffer);
      }

      GlobalSampleCache.clearAllBuffers();

      // URLs should remain
      expect(GlobalSampleCache.getCachedUrl('sample0')).toBe('url0');
      expect(GlobalSampleCache.getCachedUrl('sample1')).toBe('url1');
      expect(GlobalSampleCache.getCachedUrl('sample2')).toBe('url2');

      // Buffers should be cleared
      expect(GlobalSampleCache.getCachedBuffer('sample0')).toBeUndefined();
      expect(GlobalSampleCache.getCachedBuffer('sample1')).toBeUndefined();
      expect(GlobalSampleCache.getCachedBuffer('sample2')).toBeUndefined();
    });

    it('should clear entire cache', () => {
      // Add various items
      GlobalSampleCache.cacheUrl('url', 'http://example.com');
      GlobalSampleCache.cacheBuffer('buffer', {} as AudioBuffer);
      GlobalSampleCache.cacheSampler('sampler', {} as any);
      GlobalSampleCache.cacheInstrument('instrument', {});

      GlobalSampleCache.clear();

      const stats = GlobalSampleCache.getStats();
      expect(stats.samplesCount).toBe(0);
      expect(stats.instrumentsCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should always return the same instance', () => {
      // Access through the exported instance
      const cache1 = GlobalSampleCache;
      const cache2 = GlobalSampleCache;

      expect(cache1).toBe(cache2);
      
      // Test that state is shared
      cache1.cacheUrl('test', 'url');
      expect(cache2.getCachedUrl('test')).toBe('url');
    });
  });
});