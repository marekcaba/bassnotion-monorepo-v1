import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus } from '../../shared/index.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

describe('SampleCache', () => {
  let cache: SampleCache;
  let eventBus: EventBus;

  const testMetadata: AudioSampleMetadata = {
    sampleId: 'test-sample',
    name: 'Test Sample',
    fileSize: 1024,
    duration: 1.5,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    format: 'wav',
  };

  beforeEach(() => {
    eventBus = new EventBus();
    cache = new SampleCache(
      {
        maxSize: 10 * 1024 * 1024, // 10MB
        maxEntries: 100,
        evictionStrategy: 'lru',
        enableAnalytics: true,
      },
      eventBus,
    );
  });

  describe('basic operations', () => {
    it('should set and get data', () => {
      const data = new ArrayBuffer(1024);
      const result = cache.set('sample1', data, testMetadata);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);

      const retrieved = cache.getData('sample1');
      expect(retrieved).toBe(data);
    });

    it('should return cache hit on second access', () => {
      const data = new ArrayBuffer(1024);
      cache.set('sample1', data, testMetadata);

      const result = cache.get('sample1');
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
    });

    it('should return cache miss for non-existent data', () => {
      const result = cache.get('non-existent');
      expect(result.success).toBe(false);
      expect(result.fromCache).toBe(false);
    });

    it('should delete data', () => {
      const data = new ArrayBuffer(1024);
      cache.set('sample1', data, testMetadata);

      const deleteResult = cache.delete('sample1');
      expect(deleteResult.success).toBe(true);

      const getResult = cache.get('sample1');
      expect(getResult.success).toBe(false);
    });

    it('should check if data exists', () => {
      const data = new ArrayBuffer(1024);

      expect(cache.has('sample1')).toBe(false);

      cache.set('sample1', data, testMetadata);

      expect(cache.has('sample1')).toBe(true);
    });
  });

  describe('eviction', () => {
    it('should evict when max size exceeded', () => {
      const cache = new SampleCache({
        maxSize: 3000, // 3KB
        maxEntries: 10,
        evictionStrategy: 'lru',
        enableAnalytics: false,
        minRetentionTime: 0, // Allow immediate eviction
      });

      // Add samples that exceed max size
      cache.set('sample1', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample1',
      });
      cache.set('sample2', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample2',
      });
      cache.set('sample3', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample3',
      });
      cache.set('sample4', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample4',
      });

      // sample1 should be evicted (LRU)
      expect(cache.has('sample1')).toBe(false);
      expect(cache.has('sample2')).toBe(true);
      expect(cache.has('sample3')).toBe(true);
      expect(cache.has('sample4')).toBe(true);
    });

    it('should respect locked samples during eviction', () => {
      const cache = new SampleCache({
        maxSize: 2000, // 2KB
        maxEntries: 10,
        evictionStrategy: 'lru',
        enableAnalytics: false,
        minRetentionTime: 0, // Allow immediate eviction
      });

      cache.set('sample1', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample1',
      });
      cache.lock('sample1');

      cache.set('sample2', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample2',
      });
      cache.set('sample3', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'sample3',
      });

      // sample1 should not be evicted because it's locked
      expect(cache.has('sample1')).toBe(true);
      expect(cache.has('sample2')).toBe(false); // Evicted
      expect(cache.has('sample3')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', () => {
      const data = new ArrayBuffer(1024);

      // Miss
      cache.get('sample1');

      // Set and hit
      cache.set('sample1', data, testMetadata);
      cache.get('sample1');
      cache.get('sample1');

      const stats = cache.getStats();
      expect(stats.entries).toBe(1);
      expect(stats.totalSize).toBe(1024);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.missRate).toBeGreaterThan(0);
    });
  });

  describe('bulk operations', () => {
    it('should preload multiple samples', async () => {
      const samples = [
        {
          sampleId: 'sample1',
          data: new ArrayBuffer(1024),
          metadata: { ...testMetadata, sampleId: 'sample1' },
        },
        {
          sampleId: 'sample2',
          data: new ArrayBuffer(1024),
          metadata: { ...testMetadata, sampleId: 'sample2' },
        },
        {
          sampleId: 'sample3',
          data: new ArrayBuffer(1024),
          metadata: { ...testMetadata, sampleId: 'sample3' },
        },
      ];

      const results = await cache.preloadMultiple(samples);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      expect(cache.has('sample1')).toBe(true);
      expect(cache.has('sample2')).toBe(true);
      expect(cache.has('sample3')).toBe(true);
    });

    it('should get entries by tags', () => {
      cache.set('sample1', new ArrayBuffer(1024), {
        ...testMetadata,
        sampleId: 'sample1',
        tags: ['drum', 'kick'],
      });

      cache.set('sample2', new ArrayBuffer(1024), {
        ...testMetadata,
        sampleId: 'sample2',
        tags: ['drum', 'snare'],
      });

      cache.set('sample3', new ArrayBuffer(1024), {
        ...testMetadata,
        sampleId: 'sample3',
        tags: ['bass'],
      });

      const drumSamples = cache.getByTags(['drum']);
      expect(drumSamples).toHaveLength(2);

      const kickSamples = cache.getByTags(['kick']);
      expect(kickSamples).toHaveLength(1);
    });
  });

  describe('events', () => {
    it('should emit cache events', () => {
      const onHit = vi.fn();
      const onMiss = vi.fn();
      const onSet = vi.fn();

      eventBus.on('cache:hit', onHit);
      eventBus.on('cache:miss', onMiss);
      eventBus.on('cache:set', onSet);

      // Miss
      cache.get('sample1');
      expect(onMiss).toHaveBeenCalledOnce();

      // Set
      cache.set('sample1', new ArrayBuffer(1024), testMetadata);
      expect(onSet).toHaveBeenCalledOnce();

      // Hit
      cache.get('sample1');
      expect(onHit).toHaveBeenCalledOnce();
    });
  });

  describe('optimization', () => {
    it('should optimize cache', () => {
      const cache = new SampleCache({
        maxSize: 5000,
        maxEntries: 10,
        evictionStrategy: 'adaptive',
        enableAnalytics: true,
      });

      // Add samples with different priorities
      cache.set('essential1', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'essential1',
        tags: ['essential'],
      });

      cache.set('normal1', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'normal1',
      });

      cache.set('normal2', new ArrayBuffer(1000), {
        ...testMetadata,
        sampleId: 'normal2',
      });

      // Access essential more
      for (let i = 0; i < 10; i++) {
        cache.get('essential1');
      }

      cache.get('normal1');
      cache.get('normal2');

      // Optimize should keep frequently accessed items
      cache.optimize();

      expect(cache.has('essential1')).toBe(true);
    });
  });
});
