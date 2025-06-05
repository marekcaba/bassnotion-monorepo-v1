/**
 * CacheMetricsCollector Tests
 *
 * Comprehensive unit tests for cache performance tracking and optimization metrics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheMetricsCollector } from '../CacheMetricsCollector.js';

// Mock AudioBuffer for tests
global.AudioBuffer = class MockAudioBuffer {
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {}
} as any;

describe('CacheMetricsCollector', () => {
  let collector: CacheMetricsCollector;

  beforeEach(() => {
    // Reset singleton state
    (CacheMetricsCollector as any).instance = undefined;
    collector = CacheMetricsCollector.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    collector.dispose?.();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CacheMetricsCollector.getInstance();
      const instance2 = CacheMetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = CacheMetricsCollector.getInstance();
      const instance2 = CacheMetricsCollector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initial State', () => {
    it('should have default metrics on initialization', () => {
      const metrics = collector.getMetrics();

      expect(metrics.hitRate).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalHits).toBe(0);
      expect(metrics.totalMisses).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.evictionCount).toBe(0);
      expect(metrics.averageLoadTime).toBe(0);
      expect(metrics.hitRateByType instanceof Map).toBe(true);
      expect(metrics.hitRateByType.size).toBe(0);
    });

    it('should start with clean hit rate tracking', () => {
      const metrics = collector.getMetrics();
      expect(metrics.hitRateByType.get('midi')).toBeUndefined();
      expect(metrics.hitRateByType.get('audio')).toBeUndefined();
    });
  });

  describe('Cache Operation Recording', () => {
    it('should record cache hit correctly', () => {
      collector.recordOperation('test-asset.mp3', 'hit', {
        assetType: 'audio',
      });
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalHits).toBe(1);
      expect(metrics.totalMisses).toBe(0);
      expect(metrics.hitRate).toBe(1.0);
    });

    it('should record cache miss correctly', () => {
      collector.recordOperation('test-asset.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 150,
      });
      const metrics = collector.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalHits).toBe(0);
      expect(metrics.totalMisses).toBe(1);
      expect(metrics.hitRate).toBe(0.0);
    });

    it('should calculate hit rate correctly with mixed operations', () => {
      collector.recordOperation('asset1.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('asset2.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 100,
      });
      collector.recordOperation('asset3.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('asset4.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 200,
      });

      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.totalHits).toBe(2);
      expect(metrics.totalMisses).toBe(2);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('should track hit rates by asset type', () => {
      collector.recordOperation('song.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('track.midi', 'miss', {
        assetType: 'midi',
        loadTime: 80,
      });
      collector.recordOperation('beat.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 120,
      });
      collector.recordOperation('melody.midi', 'hit', { assetType: 'midi' });

      const metrics = collector.getMetrics();
      expect(metrics.hitRateByType.get('audio')).toBe(0.5); // 1 hit, 1 miss
      expect(metrics.hitRateByType.get('midi')).toBe(0.5); // 1 hit, 1 miss
    });
  });

  describe('Cache Eviction Tracking', () => {
    it('should record cache evictions', () => {
      collector.recordOperation('test-asset.mp3', 'eviction', {
        assetType: 'audio',
        cacheSize: 1024,
      });
      const metrics = collector.getMetrics();

      expect(metrics.evictionCount).toBe(1);
    });

    it('should track multiple evictions', () => {
      collector.recordOperation('asset1.mp3', 'eviction', {
        assetType: 'audio',
        cacheSize: 1024,
      });
      collector.recordOperation('asset2.midi', 'eviction', {
        assetType: 'midi',
        cacheSize: 512,
      });
      collector.recordOperation('asset3.mp3', 'eviction', {
        assetType: 'audio',
        cacheSize: 2048,
      });

      const metrics = collector.getMetrics();
      expect(metrics.evictionCount).toBe(3);
    });
  });

  describe('Performance Analysis', () => {
    it('should record operations and track basic metrics', () => {
      // Simulate poor cache performance
      for (let i = 0; i < 10; i++) {
        collector.recordOperation(`miss${i}.mp3`, 'miss', {
          assetType: 'audio',
          loadTime: 200,
        });
      }
      collector.recordOperation('hit1.mp3', 'hit', { assetType: 'audio' });

      const metrics = collector.getMetrics();
      expect(metrics.hitRate).toBeLessThan(0.3); // Low hit rate
      expect(metrics.totalMisses).toBe(10);
      expect(metrics.totalHits).toBe(1);
    });

    it('should recognize good cache performance', () => {
      // Simulate good cache performance
      for (let i = 0; i < 8; i++) {
        collector.recordOperation(`hit${i}.mp3`, 'hit', { assetType: 'audio' });
      }
      for (let i = 0; i < 2; i++) {
        collector.recordOperation(`miss${i}.mp3`, 'miss', {
          assetType: 'audio',
          loadTime: 100,
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics.hitRate).toBe(0.8); // 80% hit rate
      expect(metrics.totalHits).toBe(8);
      expect(metrics.totalMisses).toBe(2);
    });

    it('should track efficiency score', () => {
      collector.recordOperation('test1.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('test2.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 100,
      });

      const efficiencyScore = collector.getEfficiencyScore();
      expect(typeof efficiencyScore).toBe('number');
      expect(efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(efficiencyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Asset Type Analysis', () => {
    it('should track hit rates by asset type', () => {
      // Poor MIDI performance
      for (let i = 0; i < 5; i++) {
        collector.recordOperation(`midi${i}.mid`, 'miss', {
          assetType: 'midi',
          loadTime: 50,
        });
      }
      // Good audio performance
      for (let i = 0; i < 5; i++) {
        collector.recordOperation(`audio${i}.mp3`, 'hit', {
          assetType: 'audio',
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics.hitRateByType.get('midi')).toBe(0);
      expect(metrics.hitRateByType.get('audio')).toBe(1);
    });

    it('should calculate metrics correctly with mixed asset types', () => {
      collector.recordOperation('audio1.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 100,
      });
      collector.recordOperation('audio2.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 200,
      });
      collector.recordOperation('midi1.mid', 'miss', {
        assetType: 'midi',
        loadTime: 50,
      });
      collector.recordOperation('midi2.mid', 'miss', {
        assetType: 'midi',
        loadTime: 70,
      });

      const metrics = collector.getMetrics();
      expect(metrics.hitRateByType.get('audio')).toBe(0);
      expect(metrics.hitRateByType.get('midi')).toBe(0);
      expect(metrics.totalMisses).toBe(4);
    });
  });

  describe('Analytics', () => {
    it('should provide analytics data', () => {
      collector.recordOperation('test1.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('test2.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 100,
      });

      const analytics = collector.getAnalytics();
      expect(analytics).toHaveProperty('hitRateByTimeOfDay');
      expect(analytics).toHaveProperty('popularAssets');
      expect(analytics).toHaveProperty('evictionPatterns');
      expect(analytics).toHaveProperty('performanceTrends');
      expect(analytics.hitRateByTimeOfDay instanceof Map).toBe(true);
    });
  });

  describe('Real-time Metrics', () => {
    it('should update lastUpdated timestamp', () => {
      const beforeTime = Date.now();
      collector.recordOperation('test.mp3', 'hit', { assetType: 'audio' });
      const afterTime = Date.now();

      const metrics = collector.getMetrics();
      expect(metrics.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
      expect(metrics.lastUpdated).toBeLessThanOrEqual(afterTime);
    });

    it('should track memory usage from cache store stats', () => {
      const mockCacheStore = new Map();
      mockCacheStore.set('test1.mp3', 'dummy string data');
      mockCacheStore.set('test2.mp3', 'another dummy string');

      const stats = collector.getCacheStoreStats(mockCacheStore);
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('itemCount');
      expect(stats).toHaveProperty('memoryPressure');
      expect(stats.itemCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const metrics = collector.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.hitRate).toBe('number');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics to default state', () => {
      // Record some operations
      collector.recordOperation('test1.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('test2.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 100,
      });
      collector.recordOperation('test3.mp3', 'eviction', {
        assetType: 'audio',
        cacheSize: 512,
      });

      // Reset metrics
      collector.resetMetrics();

      // Verify reset state
      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalHits).toBe(0);
      expect(metrics.totalMisses).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.evictionCount).toBe(0);
      expect(metrics.hitRateByType.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid asset types gracefully', () => {
      expect(() => {
        collector.recordOperation('test.mp3', 'hit', {
          assetType: 'invalid' as any,
        });
      }).not.toThrow();
    });

    it('should handle invalid operation types', () => {
      expect(() => {
        collector.recordOperation('test.mp3', 'invalid' as any, {
          assetType: 'audio',
        });
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should dispose properly', () => {
      expect(() => {
        collector.dispose();
      }).not.toThrow();
    });

    it('should track operations without memory leaks', () => {
      const maxOperations = 100;

      // Add operations
      for (let i = 0; i < maxOperations; i++) {
        collector.recordOperation(`test${i}.mp3`, 'hit', {
          assetType: 'audio',
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics.totalRequests).toBe(maxOperations);
      expect(metrics.totalHits).toBe(maxOperations);
    });
  });

  describe('Integration Requirements', () => {
    it('should provide Epic 2 compliant metrics interface', () => {
      const metrics = collector.getMetrics();

      // Check Epic 2 interface compliance
      expect(typeof metrics.hitRate).toBe('number');
      expect(typeof metrics.totalRequests).toBe('number');
      expect(typeof metrics.totalHits).toBe('number');
      expect(typeof metrics.totalMisses).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.evictionCount).toBe('number');
      expect(typeof metrics.lastUpdated).toBe('number');
      expect(metrics.hitRateByType instanceof Map).toBe(true);
    });

    it('should support asset type-specific tracking', () => {
      collector.recordOperation('test.mp3', 'hit', { assetType: 'audio' });
      collector.recordOperation('test.mid', 'miss', {
        assetType: 'midi',
        loadTime: 50,
      });

      const metrics = collector.getMetrics();
      expect(metrics.hitRateByType.has('audio')).toBe(true);
      expect(metrics.hitRateByType.has('midi')).toBe(true);
      expect(metrics.hitRateByType.get('audio')).toBe(1);
      expect(metrics.hitRateByType.get('midi')).toBe(0);
    });

    it('should maintain performance tracking capabilities', () => {
      collector.recordOperation('test1.mp3', 'miss', {
        assetType: 'audio',
        loadTime: 200,
      });
      collector.recordOperation('test2.mp3', 'hit', { assetType: 'audio' });

      const metrics = collector.getMetrics();
      const efficiency = collector.getEfficiencyScore();
      const analytics = collector.getAnalytics();

      expect(metrics.hitRate).toBe(0.5);
      expect(typeof efficiency).toBe('number');
      expect(analytics).toBeDefined();
    });
  });
});
