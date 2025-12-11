/**
 * LocalProvider Performance Metrics Tests
 *
 * Tests the performance tracking functionality of LocalProvider.
 * Since LocalProvider heavily depends on IndexedDB which is not available in Node,
 * these tests focus on the metrics interface structure and basic functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalProvider, type LocalProviderMetrics } from '../LocalProvider.js';

// Mock structured logger
vi.mock('../../shared/index.js', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('LocalProvider - Performance Metrics', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalProvider();
  });

  describe('getPerformanceMetrics()', () => {
    it('should return a valid metrics structure', () => {
      const metrics = provider.getPerformanceMetrics();

      expect(metrics).toHaveProperty('hitRate');
      expect(metrics).toHaveProperty('missRate');
      expect(metrics).toHaveProperty('averageLatencyMs');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('totalOperations');
      expect(metrics).toHaveProperty('totalBytes');
      expect(metrics).toHaveProperty('storeCount');
      expect(metrics).toHaveProperty('retrieveCount');
      expect(metrics).toHaveProperty('deleteCount');
      expect(metrics).toHaveProperty('hits');
      expect(metrics).toHaveProperty('misses');
      expect(metrics).toHaveProperty('errors');
    });

    it('should have zero metrics initially', () => {
      const metrics = provider.getPerformanceMetrics();

      expect(metrics.hitRate).toBe(0);
      expect(metrics.missRate).toBe(0);
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.errors).toBe(0);
    });

    it('should return numeric values for all metrics', () => {
      const metrics = provider.getPerformanceMetrics();

      expect(typeof metrics.hitRate).toBe('number');
      expect(typeof metrics.missRate).toBe('number');
      expect(typeof metrics.averageLatencyMs).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.totalOperations).toBe('number');
      expect(typeof metrics.totalBytes).toBe('number');
      expect(typeof metrics.storeCount).toBe('number');
      expect(typeof metrics.retrieveCount).toBe('number');
      expect(typeof metrics.deleteCount).toBe('number');
      expect(typeof metrics.hits).toBe('number');
      expect(typeof metrics.misses).toBe('number');
      expect(typeof metrics.errors).toBe('number');
    });

    it('should not have NaN values', () => {
      const metrics = provider.getPerformanceMetrics();

      expect(Number.isNaN(metrics.hitRate)).toBe(false);
      expect(Number.isNaN(metrics.missRate)).toBe(false);
      expect(Number.isNaN(metrics.averageLatencyMs)).toBe(false);
      expect(Number.isNaN(metrics.errorRate)).toBe(false);
    });

    it('should return 0 for hitRate when no operations occurred', () => {
      const metrics = provider.getPerformanceMetrics();
      // When hits + misses = 0, hitRate should be 0 (not NaN)
      expect(metrics.hitRate).toBe(0);
      expect(metrics.missRate).toBe(0);
    });

    it('should have non-negative values', () => {
      const metrics = provider.getPerformanceMetrics();

      expect(metrics.hitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.missRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.totalOperations).toBeGreaterThanOrEqual(0);
      expect(metrics.totalBytes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LocalProviderMetrics interface', () => {
    it('should have all required fields as documented', () => {
      const metrics = provider.getPerformanceMetrics();

      // Verify the interface matches our documentation
      const expectedKeys: (keyof LocalProviderMetrics)[] = [
        'hitRate',
        'missRate',
        'averageLatencyMs',
        'errorRate',
        'totalOperations',
        'totalBytes',
        'storeCount',
        'retrieveCount',
        'deleteCount',
        'hits',
        'misses',
        'errors',
      ];

      for (const key of expectedKeys) {
        expect(metrics).toHaveProperty(key);
      }
    });
  });

  describe('Metrics calculations', () => {
    it('should calculate totalOperations as sum of store, retrieve, delete', () => {
      const metrics = provider.getPerformanceMetrics();
      // Initially all should be 0
      expect(metrics.totalOperations).toBe(
        metrics.storeCount + metrics.retrieveCount + metrics.deleteCount,
      );
    });

    it('should calculate hitRate as hits / (hits + misses)', () => {
      const metrics = provider.getPerformanceMetrics();
      // When both are 0, should be 0
      expect(metrics.hitRate).toBe(0);
      // The formula should work once we have data
      const expectedRate =
        metrics.hits + metrics.misses > 0
          ? metrics.hits / (metrics.hits + metrics.misses)
          : 0;
      expect(metrics.hitRate).toBe(expectedRate);
    });

    it('should calculate missRate as 1 - hitRate when there are operations', () => {
      const metrics = provider.getPerformanceMetrics();
      // When no operations, both should be 0
      if (metrics.hits + metrics.misses === 0) {
        expect(metrics.missRate).toBe(0);
      } else {
        expect(metrics.missRate).toBe(1 - metrics.hitRate);
      }
    });
  });

  describe('Provider creation', () => {
    it('should create provider without throwing', () => {
      expect(() => new LocalProvider()).not.toThrow();
    });

    it('should have getPerformanceMetrics method', () => {
      const provider = new LocalProvider();
      expect(typeof provider.getPerformanceMetrics).toBe('function');
    });

    it('should return consistent metrics structure on multiple calls', () => {
      const provider = new LocalProvider();
      const metrics1 = provider.getPerformanceMetrics();
      const metrics2 = provider.getPerformanceMetrics();

      // Should have same structure
      expect(Object.keys(metrics1)).toEqual(Object.keys(metrics2));
    });
  });
});
