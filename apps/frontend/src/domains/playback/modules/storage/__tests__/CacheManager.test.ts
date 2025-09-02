import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager } from '../cache/CacheManager.js';
import { EventBus } from '../../../services/core/EventBus.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

describe('CacheManager', () => {
  let manager: CacheManager;
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
  });

  describe('single layer configuration', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: false,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should create default layer', () => {
      const layers = manager.getLayers();
      expect(layers).toHaveLength(1);
      expect(layers[0].name).toBe('default');
    });

    it('should store and retrieve data', async () => {
      const data = new ArrayBuffer(1024);
      
      const setResult = await manager.set('sample1', data, testMetadata);
      expect(setResult.success).toBe(true);
      
      const getData = await manager.get('sample1');
      expect(getData).toBe(data);
    });

    it('should delete data', async () => {
      const data = new ArrayBuffer(1024);
      await manager.set('sample1', data, testMetadata);
      
      const deleted = await manager.delete('sample1');
      expect(deleted).toBe(true);
      
      const getData = await manager.get('sample1');
      expect(getData).toBeUndefined();
    });

    it('should check if sample exists', async () => {
      const data = new ArrayBuffer(1024);
      
      expect(manager.has('sample1')).toBe(false);
      
      await manager.set('sample1', data, testMetadata);
      
      expect(manager.has('sample1')).toBe(true);
    });
  });

  describe('multi-layer configuration', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: true,
        layers: [
          { name: 'hot', maxSize: 1024 * 1024, evictionStrategy: 'lfu', priority: 3 },
          { name: 'warm', maxSize: 5 * 1024 * 1024, evictionStrategy: 'lru', priority: 2 },
          { name: 'cold', maxSize: 10 * 1024 * 1024, evictionStrategy: 'adaptive', priority: 1 },
        ],
        enablePredictiveLoading: false,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should create multiple layers', () => {
      const layers = manager.getLayers();
      expect(layers).toHaveLength(3);
      expect(layers.map(l => l.name)).toContain('hot');
      expect(layers.map(l => l.name)).toContain('warm');
      expect(layers.map(l => l.name)).toContain('cold');
    });

    it('should store in appropriate layer based on metadata', async () => {
      const essentialData = new ArrayBuffer(512);
      const normalData = new ArrayBuffer(512);
      
      // Essential should go to higher priority layer
      await manager.set('essential1', essentialData, {
        ...testMetadata,
        sampleId: 'essential1',
        tags: ['essential'],
      });
      
      // Normal should go to lower priority layer
      await manager.set('normal1', normalData, {
        ...testMetadata,
        sampleId: 'normal1',
      });
      
      // Both should be retrievable
      expect(await manager.get('essential1')).toBe(essentialData);
      expect(await manager.get('normal1')).toBe(normalData);
    });
  });

  describe('compression', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: false,
        enableCompression: true,
        compressionThreshold: 500, // Low threshold for testing
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should compress large data', async () => {
      const largeData = new ArrayBuffer(1024);
      
      const setResult = await manager.set('sample1', largeData, testMetadata, {
        compress: true,
      });
      
      expect(setResult.success).toBe(true);
      
      // Data should still be retrievable
      const retrieved = await manager.get('sample1');
      expect(retrieved).toBeDefined();
    });
  });

  describe('preloading', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: true,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should preload multiple samples', async () => {
      const samples = [
        {
          sampleId: 'high1',
          data: new ArrayBuffer(512),
          metadata: { ...testMetadata, sampleId: 'high1' },
          priority: 'high' as const,
        },
        {
          sampleId: 'normal1',
          data: new ArrayBuffer(512),
          metadata: { ...testMetadata, sampleId: 'normal1' },
          priority: 'normal' as const,
        },
        {
          sampleId: 'low1',
          data: new ArrayBuffer(512),
          metadata: { ...testMetadata, sampleId: 'low1' },
          priority: 'low' as const,
        },
      ];

      await manager.preloadSamples(samples);
      
      // All should be loaded
      expect(manager.has('high1')).toBe(true);
      expect(manager.has('normal1')).toBe(true);
      expect(manager.has('low1')).toBe(true);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: false,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should track statistics', async () => {
      const data1 = new ArrayBuffer(1024);
      const data2 = new ArrayBuffer(2048);
      
      // Perform operations
      await manager.get('missing'); // Miss
      await manager.set('sample1', data1, testMetadata);
      await manager.get('sample1'); // Hit
      await manager.set('sample2', data2, testMetadata);
      await manager.get('sample2'); // Hit
      
      const stats = manager.getStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.overallHitRate).toBeGreaterThan(0);
      expect(stats.overallMissRate).toBeGreaterThan(0);
    });
  });

  describe('clear and optimize', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: false,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should clear all caches', async () => {
      await manager.set('sample1', new ArrayBuffer(1024), testMetadata);
      await manager.set('sample2', new ArrayBuffer(1024), testMetadata);
      
      manager.clear();
      
      expect(manager.has('sample1')).toBe(false);
      expect(manager.has('sample2')).toBe(false);
      
      const stats = manager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('should optimize caches', async () => {
      await manager.set('sample1', new ArrayBuffer(1024), testMetadata);
      await manager.set('sample2', new ArrayBuffer(1024), testMetadata);
      
      // Access sample1 more to make it higher priority
      for (let i = 0; i < 5; i++) {
        await manager.get('sample1');
      }
      
      manager.optimize();
      
      // Both should still exist after optimize
      expect(manager.has('sample1')).toBe(true);
      expect(manager.has('sample2')).toBe(true);
    });
  });

  describe('locking', () => {
    beforeEach(() => {
      manager = new CacheManager({
        enableMultiLayer: false,
        enablePredictiveLoading: false,
        enableCompression: false,
        compressionThreshold: 1024 * 1024,
        defaultLayerSize: 10 * 1024 * 1024,
      }, eventBus);
    });

    it('should lock and unlock samples', async () => {
      await manager.set('sample1', new ArrayBuffer(1024), testMetadata);
      await manager.set('sample2', new ArrayBuffer(1024), testMetadata);
      
      manager.lockSamples(['sample1']);
      
      // Locked sample should persist through operations
      manager.optimize();
      
      expect(manager.has('sample1')).toBe(true);
      
      // Unlock and verify
      manager.unlockSamples(['sample1']);
      
      // Sample should still exist after unlock
      expect(manager.has('sample1')).toBe(true);
    });
  });
});