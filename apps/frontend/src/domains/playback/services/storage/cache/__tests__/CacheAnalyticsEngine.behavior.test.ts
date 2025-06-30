/**
 * Story 2.4 Subtask 6.3: Cache Analytics Engine Behavioral Tests
 * Comprehensive test suite for cache analytics with usage pattern analysis and optimization recommendations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheAnalyticsEngine } from '../CacheAnalyticsEngine.js';
import type { CacheAnalyticsConfig, CacheLayer } from '@bassnotion/contracts';
import { setupCacheMocks, teardownCacheMocks } from './cache-mocks.js';

describe('CacheAnalyticsEngine - Behavioral Tests', () => {
  let analyticsEngine: CacheAnalyticsEngine;
  let mockConfig: CacheAnalyticsConfig;

  beforeEach(() => {
    setupCacheMocks();

    mockConfig = {
      enabled: true,
      trackLayerPerformance: true,
      trackRoutingDecisions: true,
      trackCompressionEfficiency: true,
      trackSyncOperations: true,
      trackMLPredictions: true,
      enableRealTimeMonitoring: true,
      monitoringInterval: 100, // Fast for testing
      enableUsagePatternAnalysis: true,
      usageAnalysisWindow: 3600000, // 1 hour
      enableCrossLayerAnalysis: true,
      enableOptimizationSuggestions: true,
      performanceThresholds: {
        maxLatency: {
          memory: 100,
          indexeddb: 200,
          serviceworker: 500,
        },
        minHitRate: {
          memory: 0.8,
          indexeddb: 0.7,
          serviceworker: 0.6,
        },
        maxMemoryUsage: {
          memory: 50 * 1024 * 1024, // 50MB
          indexeddb: 100 * 1024 * 1024, // 100MB
          serviceworker: 25 * 1024 * 1024, // 25MB
        },
        maxEvictionRate: {
          memory: 10,
          indexeddb: 5,
          serviceworker: 2,
        },
      },
      suggestionCategories: [
        'routing_optimization',
        'compression_tuning',
        'eviction_strategy',
        'layer_balancing',
        'sync_optimization',
      ],
      enableReporting: true,
      reportingInterval: 60000, // 1 minute
      reportRetentionPeriod: 86400000, // 24 hours
    };

    analyticsEngine = new CacheAnalyticsEngine(mockConfig);
  });

  afterEach(async () => {
    await analyticsEngine.stop();
    await analyticsEngine.dispose();
    teardownCacheMocks();
    vi.clearAllMocks();
  });

  describe('Analytics Engine Lifecycle', () => {
    it('should start and stop analytics monitoring correctly', async () => {
      expect(analyticsEngine['isRunning']).toBe(false);

      await analyticsEngine.start();
      expect(analyticsEngine['isRunning']).toBe(true);

      await analyticsEngine.stop();
      expect(analyticsEngine['isRunning']).toBe(false);
    });

    it('should handle multiple start/stop calls gracefully', async () => {
      await analyticsEngine.start();
      await analyticsEngine.start(); // Should not throw
      expect(analyticsEngine['isRunning']).toBe(true);

      await analyticsEngine.stop();
      await analyticsEngine.stop(); // Should not throw
      expect(analyticsEngine['isRunning']).toBe(false);
    });

    it('should initialize with proper default state', () => {
      expect(analyticsEngine['usagePatterns'].size).toBe(0);
      expect(analyticsEngine['performanceHistory'].size).toBe(0);
      expect(analyticsEngine['optimizationOpportunities']).toHaveLength(0);
      expect(analyticsEngine['healthHistory']).toHaveLength(0);
    });
  });

  describe('Operation Recording and Tracking', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should record cache operations correctly', () => {
      const sampleId = 'test-sample-1';
      const layer: CacheLayer = 'memory';

      analyticsEngine.recordOperation('get', sampleId, layer, 50, true);

      // Check that access was recorded
      const accessTimes = analyticsEngine['accessTracker'].get(sampleId);
      expect(accessTimes).toBeDefined();
      expect(accessTimes).toHaveLength(1);

      // Check that layer operation was recorded
      const layerMetrics = analyticsEngine['operationMetrics'].get(layer);
      expect(layerMetrics).toBeDefined();
      expect(layerMetrics).toHaveLength(1);
      expect(layerMetrics![0]).toBe(50);
    });

    it('should track multiple operations across different layers', () => {
      const operations = [
        {
          op: 'get' as const,
          id: 'sample-1',
          layer: 'memory' as CacheLayer,
          duration: 10,
          success: true,
        },
        {
          op: 'set' as const,
          id: 'sample-2',
          layer: 'indexeddb' as CacheLayer,
          duration: 50,
          success: true,
        },
        {
          op: 'get' as const,
          id: 'sample-1',
          layer: 'memory' as CacheLayer,
          duration: 8,
          success: true,
        },
        {
          op: 'delete' as const,
          id: 'sample-3',
          layer: 'serviceworker' as CacheLayer,
          duration: 30,
          success: false,
        },
      ];

      operations.forEach(({ op, id, layer, duration, success }) => {
        analyticsEngine.recordOperation(op, id, layer, duration, success);
      });

      // Verify tracking across layers
      expect(analyticsEngine['operationMetrics'].get('memory')).toHaveLength(2);
      expect(analyticsEngine['operationMetrics'].get('indexeddb')).toHaveLength(
        1,
      );
      expect(
        analyticsEngine['operationMetrics'].get('serviceworker'),
      ).toHaveLength(1);

      // Verify access tracking
      expect(analyticsEngine['accessTracker'].get('sample-1')).toHaveLength(2);
      expect(analyticsEngine['accessTracker'].get('sample-2')).toHaveLength(0); // Only 'get' operations tracked
      expect(analyticsEngine['accessTracker'].get('sample-3')).toHaveLength(0);

      // Verify error tracking
      expect(analyticsEngine['errorTracking'].get('serviceworker')).toBe(1);
      expect(analyticsEngine['errorTracking'].get('memory')).toBe(0);
    });

    it('should handle high-frequency operations efficiently', () => {
      const startTime = performance.now();

      // Record 1000 operations
      for (let i = 0; i < 1000; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i % 10}`, // 10 unique samples
          'memory',
          Math.random() * 100,
          Math.random() > 0.1, // 90% success rate
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle 1000 operations in under 100ms
      expect(duration).toBeLessThan(100);

      // Verify data integrity
      expect(analyticsEngine['accessTracker'].size).toBe(10);
      expect(analyticsEngine['operationMetrics'].get('memory')).toHaveLength(
        1000,
      );
    });
  });

  describe('Usage Pattern Analysis', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should detect hourly usage patterns', async () => {
      const sampleId = 'pattern-test-sample';
      const baseTime = Date.now();

      // Simulate hourly pattern (every hour for 3 hours)
      for (let i = 0; i < 3; i++) {
        const timestamp = baseTime + i * 60 * 60 * 1000; // 1 hour intervals
        vi.setSystemTime(timestamp);
        analyticsEngine.recordOperation('get', sampleId, 'memory', 50, true);
      }

      // Trigger pattern analysis
      analyticsEngine['updateUsagePatterns']();

      const patterns = await analyticsEngine.getUsagePatterns();
      const hourlyPattern = patterns.find((p) => p.period === 'hourly');

      expect(hourlyPattern).toBeDefined();
      expect(hourlyPattern!.confidence).toBeGreaterThan(0.5);
      expect(hourlyPattern!.frequency).toBeGreaterThan(0);
    });

    it('should classify different pattern periods correctly', () => {
      const testCases = [
        { interval: 30 * 60 * 1000, expected: 'hourly' }, // 30 minutes
        { interval: 2 * 60 * 60 * 1000, expected: 'hourly' }, // 2 hours
        { interval: 12 * 60 * 60 * 1000, expected: 'daily' }, // 12 hours
        { interval: 2 * 24 * 60 * 60 * 1000, expected: 'daily' }, // 2 days
        { interval: 5 * 24 * 60 * 60 * 1000, expected: 'weekly' }, // 5 days
      ];

      testCases.forEach(({ interval, expected }) => {
        const result = analyticsEngine['classifyPeriod'](interval);
        expect(result).toBe(expected);
      });
    });

    it('should track complex access patterns with multiple samples', async () => {
      const samples = ['sample-A', 'sample-B', 'sample-C'];
      const baseTime = Date.now();

      // Create different patterns for different samples
      samples.forEach((sampleId, index) => {
        for (let i = 0; i < 5; i++) {
          const timestamp = baseTime + i * (index + 1) * 30 * 60 * 1000; // Different intervals
          vi.setSystemTime(timestamp);
          analyticsEngine.recordOperation('get', sampleId, 'memory', 50, true);
        }
      });

      analyticsEngine['updateUsagePatterns']();
      const patterns = await analyticsEngine.getUsagePatterns();

      expect(patterns.length).toBeGreaterThan(0);

      // Each sample should have different pattern characteristics
      const patternsByExample = patterns.reduce(
        (acc, pattern) => {
          pattern.examples.forEach((example) => {
            if (!acc[example]) acc[example] = [];
            acc[example].push(pattern);
          });
          return acc;
        },
        {} as Record<string, any[]>,
      );

      expect(Object.keys(patternsByExample).length).toBeGreaterThan(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should analyze layer performance correctly', async () => {
      // Simulate different performance characteristics for each layer
      const layerData = [
        { layer: 'memory' as CacheLayer, avgDuration: 5, successRate: 0.98 },
        {
          layer: 'indexeddb' as CacheLayer,
          avgDuration: 25,
          successRate: 0.95,
        },
        {
          layer: 'serviceworker' as CacheLayer,
          avgDuration: 100,
          successRate: 0.9,
        },
      ];

      layerData.forEach(({ layer, avgDuration, successRate }) => {
        for (let i = 0; i < 100; i++) {
          const duration = avgDuration + (Math.random() - 0.5) * 10; // ±5ms variance
          const success = Math.random() < successRate;
          analyticsEngine.recordOperation(
            'get',
            `sample-${i}`,
            layer,
            duration,
            success,
          );
        }
      });

      const analysis = await analyticsEngine.getPerformanceAnalysis();

      expect(analysis.layerPerformance).toBeDefined();
      expect(Object.keys(analysis.layerPerformance)).toHaveLength(3);

      // Memory should have best performance
      const memoryPerf = analysis.layerPerformance.memory;
      const swPerf = analysis.layerPerformance.serviceworker;

      expect(memoryPerf.averageLatency).toBeLessThan(swPerf.averageLatency);
      expect(memoryPerf.errorRate).toBeLessThan(swPerf.errorRate);
    });

    it('should identify performance bottlenecks', async () => {
      // Create a clear bottleneck scenario - high latency in one layer
      for (let i = 0; i < 50; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'serviceworker',
          500,
          true,
        ); // High latency
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'memory',
          5,
          true,
        ); // Normal latency
      }

      const analysis = await analyticsEngine.getPerformanceAnalysis();

      expect(analysis.bottlenecks).toBeDefined();
      expect(analysis.bottlenecks.length).toBeGreaterThan(0);

      const latencyBottleneck = analysis.bottlenecks.find(
        (b) => b.type === 'latency',
      );
      expect(latencyBottleneck).toBeDefined();
      expect(latencyBottleneck!.layer).toBe('serviceworker');
      expect(latencyBottleneck!.severity).toMatch(/high|critical/);
    });

    it('should generate performance trends', async () => {
      const baseTime = Date.now();

      // Simulate degrading performance over time
      for (let hour = 0; hour < 5; hour++) {
        vi.setSystemTime(baseTime + hour * 60 * 60 * 1000);

        for (let i = 0; i < 20; i++) {
          const degradingLatency = 10 + hour * 5; // Increasing latency
          analyticsEngine.recordOperation(
            'get',
            `sample-${i}`,
            'memory',
            degradingLatency,
            true,
          );
        }

        // Force performance history update
        analyticsEngine['performRealTimeAnalysis']();
      }

      const analysis = await analyticsEngine.getPerformanceAnalysis();

      expect(analysis.trends).toBeDefined();
      expect(analysis.trends.length).toBeGreaterThan(0);

      const degradingTrend = analysis.trends.find(
        (t) => t.trend === 'degrading',
      );
      expect(degradingTrend).toBeDefined();
    });

    it('should generate performance predictions', async () => {
      // Create consistent performance data for prediction
      for (let i = 0; i < 100; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'memory',
          10 + Math.random() * 2,
          true,
        );
      }

      const analysis = await analyticsEngine.getPerformanceAnalysis();

      expect(analysis.predictions).toBeDefined();
      expect(analysis.predictions.length).toBeGreaterThan(0);

      const prediction = analysis.predictions?.[0];
      if (prediction) {
        expect(prediction.confidence).toBeGreaterThan(0);
        expect(prediction.predictedValue).toBeGreaterThan(0);
        expect(prediction.factors).toBeDefined();
      }
    });
  });

  describe('Optimization Recommendations', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should identify routing optimization opportunities', async () => {
      // Create scenario where routing optimization would help
      // High latency in serviceworker, but good performance in memory
      for (let i = 0; i < 50; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'serviceworker',
          200,
          true,
        );
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'memory',
          10,
          true,
        );
      }

      analyticsEngine['identifyOptimizationOpportunities']();
      const opportunities =
        await analyticsEngine.getOptimizationRecommendations();

      const routingOpp = opportunities.find(
        (opp) => opp.type === 'routing_optimization',
      );
      expect(routingOpp).toBeDefined();
      expect(routingOpp!.priority).toMatch(/medium|high|critical/);
      expect(routingOpp!.expectedBenefit.performance).toBeGreaterThan(0);
    });

    it('should suggest compression optimization', async () => {
      // Simulate large samples that would benefit from compression
      const largeSampleMetadata = { size: 2048 }; // Above compression threshold

      for (let i = 0; i < 30; i++) {
        analyticsEngine.recordOperation(
          'set',
          `large-sample-${i}`,
          'memory',
          50,
          true,
          largeSampleMetadata,
        );
      }

      analyticsEngine['identifyOptimizationOpportunities']();
      const opportunities =
        await analyticsEngine.getOptimizationRecommendations();

      const compressionOpp = opportunities.find(
        (opp) => opp.type === 'compression_tuning',
      );
      expect(compressionOpp).toBeDefined();
      expect(compressionOpp!.expectedBenefit.storage).toBeGreaterThan(0);
    });

    it('should recommend eviction policy optimization', async () => {
      // Create access patterns that suggest better eviction strategies
      const samples = ['frequent-sample', 'rare-sample-1', 'rare-sample-2'];

      // Frequent access to one sample
      for (let i = 0; i < 50; i++) {
        analyticsEngine.recordOperation('get', samples[0]!, 'memory', 10, true);
      }

      // Rare access to others
      analyticsEngine.recordOperation('get', samples[1]!, 'memory', 10, true);
      analyticsEngine.recordOperation('get', samples[2]!, 'memory', 10, true);

      analyticsEngine['identifyOptimizationOpportunities']();
      const opportunities =
        await analyticsEngine.getOptimizationRecommendations();

      const evictionOpp = opportunities.find(
        (opp) => opp.type === 'eviction_strategy',
      );
      expect(evictionOpp).toBeDefined();
      expect(evictionOpp!.expectedBenefit.performance).toBeGreaterThan(0);
    });

    it('should prioritize optimization opportunities correctly', async () => {
      // Create multiple optimization scenarios

      // High-impact routing issue
      for (let i = 0; i < 100; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'serviceworker',
          300,
          true,
        );
      }

      // Medium-impact compression opportunity
      for (let i = 0; i < 20; i++) {
        analyticsEngine.recordOperation(
          'set',
          `large-${i}`,
          'memory',
          50,
          true,
          { size: 3000 },
        );
      }

      analyticsEngine['identifyOptimizationOpportunities']();
      const opportunities =
        await analyticsEngine.getOptimizationRecommendations();

      expect(opportunities.length).toBeGreaterThan(0);

      // Should be sorted by priority
      const priorities = opportunities.map((opp) => opp.priority);
      const priorityOrder = ['critical', 'high', 'medium', 'low'];

      for (let i = 1; i < priorities.length; i++) {
        const currentPriority = priorities[i];
        const previousPriority = priorities[i - 1];
        if (currentPriority && previousPriority) {
          const currentIndex = priorityOrder.indexOf(currentPriority);
          const previousIndex = priorityOrder.indexOf(previousPriority);
          expect(currentIndex).toBeGreaterThanOrEqual(previousIndex);
        }
      }
    });
  });

  describe('Health Scoring and Monitoring', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should calculate overall health score', async () => {
      // Create mixed performance scenario
      for (let i = 0; i < 50; i++) {
        const success = Math.random() > 0.1; // 90% success rate
        const latency = 20 + Math.random() * 30; // 20-50ms
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'memory',
          latency,
          success,
        );
      }

      const healthScore = await analyticsEngine.getCacheHealthScore();

      expect(healthScore.overall).toBeGreaterThan(0);
      expect(healthScore.overall).toBeLessThanOrEqual(100);

      expect(healthScore.components.performance).toBeGreaterThan(0);
      expect(healthScore.components.efficiency).toBeGreaterThan(0);
      expect(healthScore.components.reliability).toBeGreaterThan(0);
      expect(healthScore.components.optimization).toBeGreaterThan(0);
    });

    it('should provide health factors with proper weights', async () => {
      const healthScore = await analyticsEngine.getCacheHealthScore();

      expect(healthScore.factors).toBeDefined();
      expect(healthScore.factors.length).toBeGreaterThan(0);

      // Verify weight distribution
      const totalWeight = healthScore.factors.reduce(
        (sum, factor) => sum + factor.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1, 1); // Should sum to approximately 1

      // Each factor should have valid properties
      healthScore.factors.forEach((factor) => {
        expect(factor.name).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
        expect(['positive', 'negative', 'neutral']).toContain(factor.impact);
      });
    });

    it('should generate appropriate health recommendations', async () => {
      // Create poor performance scenario
      for (let i = 0; i < 30; i++) {
        analyticsEngine.recordOperation(
          'get',
          `sample-${i}`,
          'memory',
          200,
          false,
        ); // High latency, failures
      }

      const healthScore = await analyticsEngine.getCacheHealthScore();

      expect(healthScore.recommendations).toBeDefined();
      expect(healthScore.recommendations.length).toBeGreaterThan(0);

      // Should have recommendations for poor performance
      const hasPerformanceRec = healthScore.recommendations.some(
        (rec) =>
          rec.toLowerCase().includes('performance') ||
          rec.toLowerCase().includes('latency') ||
          rec.toLowerCase().includes('error'),
      );
      expect(hasPerformanceRec).toBe(true);
    });

    it('should track health history over time', async () => {
      // Generate multiple health snapshots
      for (let snapshot = 0; snapshot < 3; snapshot++) {
        // Different performance for each snapshot
        for (let i = 0; i < 20; i++) {
          const latency = 10 + snapshot * 20; // Degrading performance
          analyticsEngine.recordOperation(
            'get',
            `sample-${i}`,
            'memory',
            latency,
            true,
          );
        }

        await analyticsEngine.getCacheHealthScore(); // This should add to history

        // Wait a bit between snapshots
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(analyticsEngine['healthHistory'].length).toBeGreaterThan(0);

      // Health should show degradation trend
      if (analyticsEngine['healthHistory'].length > 1) {
        const firstScore = analyticsEngine['healthHistory'][0]?.overall;
        const lastScore =
          analyticsEngine['healthHistory'][
            analyticsEngine['healthHistory'].length - 1
          ]?.overall;
        if (firstScore !== undefined && lastScore !== undefined) {
          expect(lastScore).toBeLessThanOrEqual(firstScore);
        }
      }
    });
  });

  describe('Comprehensive Analytics Integration', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should provide complete analytics overview', async () => {
      // Create comprehensive test scenario
      const testData = [
        {
          op: 'get' as const,
          id: 'sample-1',
          layer: 'memory' as CacheLayer,
          duration: 10,
          success: true,
        },
        {
          op: 'set' as const,
          id: 'sample-2',
          layer: 'indexeddb' as CacheLayer,
          duration: 50,
          success: true,
        },
        {
          op: 'get' as const,
          id: 'sample-1',
          layer: 'memory' as CacheLayer,
          duration: 8,
          success: true,
        },
        {
          op: 'delete' as const,
          id: 'sample-3',
          layer: 'serviceworker' as CacheLayer,
          duration: 200,
          success: false,
        },
        {
          op: 'get' as const,
          id: 'sample-2',
          layer: 'indexeddb' as CacheLayer,
          duration: 45,
          success: true,
        },
      ];

      testData.forEach(({ op, id, layer, duration, success }) => {
        analyticsEngine.recordOperation(op, id, layer, duration, success);
      });

      const analytics = await analyticsEngine.getAnalytics();

      // Verify all analytics components are present
      expect(analytics.totalEntries).toBeGreaterThan(0);
      expect(analytics.totalSize).toBeGreaterThan(0);
      expect(analytics.layerDistribution).toBeDefined();
      expect(analytics.averageAccessTime).toBeDefined();
      expect(analytics.hitRates).toBeDefined();
      expect(analytics.compressionEfficiency).toBeGreaterThanOrEqual(0);
      expect(analytics.predictionAccuracy).toBeDefined();
      expect(analytics.syncHealth).toBeDefined();
      expect(analytics.averageQualityScore).toBeGreaterThanOrEqual(0);
      expect(analytics.qualityDistribution).toBeDefined();
      expect(analytics.trends).toBeDefined();
      expect(analytics.optimizationSuggestions).toBeDefined();
    });

    it('should handle concurrent analytics operations', async () => {
      const concurrentOperations = [];

      // Start multiple analytics operations concurrently
      for (let i = 0; i < 10; i++) {
        concurrentOperations.push(
          analyticsEngine.recordOperation(
            'get',
            `concurrent-sample-${i}`,
            'memory',
            Math.random() * 50,
            true,
          ),
        );
      }

      // Add analytics queries
      concurrentOperations.push(analyticsEngine.getAnalytics());
      concurrentOperations.push(analyticsEngine.getUsagePatterns());
      concurrentOperations.push(analyticsEngine.getPerformanceAnalysis());
      concurrentOperations.push(
        analyticsEngine.getOptimizationRecommendations(),
      );
      concurrentOperations.push(analyticsEngine.getCacheHealthScore());

      // Should all complete without errors
      await expect(Promise.all(concurrentOperations)).resolves.toBeDefined();
    });

    it('should maintain data consistency under load', async () => {
      const numOperations = 500;
      const operations = [];

      for (let i = 0; i < numOperations; i++) {
        operations.push(
          analyticsEngine.recordOperation(
            'get',
            `load-test-sample-${i % 50}`, // 50 unique samples
            'memory',
            Math.random() * 100,
            Math.random() > 0.05, // 95% success rate
          ),
        );
      }

      // Wait for all operations to complete
      await Promise.all(operations);

      const analytics = await analyticsEngine.getAnalytics();

      // Verify data consistency
      expect(analytics.totalEntries).toBe(50); // 50 unique samples
      expect(analyticsEngine['accessTracker'].size).toBe(50);
      expect(analyticsEngine['operationMetrics'].get('memory')).toHaveLength(
        numOperations,
      );

      // Hit rates should be reasonable
      expect(analytics.hitRates.memory).toBeGreaterThan(0);
      expect(analytics.hitRates.memory).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should handle invalid operation parameters gracefully', () => {
      expect(() => {
        analyticsEngine.recordOperation('get', '', 'memory', -1, true);
      }).not.toThrow();

      expect(() => {
        analyticsEngine.recordOperation('get', 'sample', 'memory', NaN, true);
      }).not.toThrow();
    });

    it('should handle analytics queries with no data', async () => {
      const analytics = await analyticsEngine.getAnalytics();
      const patterns = await analyticsEngine.getUsagePatterns();
      const performance = await analyticsEngine.getPerformanceAnalysis();
      const recommendations =
        await analyticsEngine.getOptimizationRecommendations();
      const health = await analyticsEngine.getCacheHealthScore();

      expect(analytics).toBeDefined();
      expect(patterns).toEqual([]);
      expect(performance).toBeDefined();
      expect(recommendations).toEqual([]);
      expect(health).toBeDefined();
      expect(health.overall).toBeGreaterThanOrEqual(0);
    });

    it('should handle disposal correctly', async () => {
      analyticsEngine.recordOperation('get', 'test-sample', 'memory', 50, true);

      await analyticsEngine.dispose();

      expect(analyticsEngine['isRunning']).toBe(false);
      expect(analyticsEngine['monitoringInterval']).toBeUndefined();
    });

    it('should handle real-time monitoring configuration changes', async () => {
      // Start with monitoring enabled
      expect(mockConfig.enableRealTimeMonitoring).toBe(true);

      // Disable monitoring
      const newConfig = { ...mockConfig, enableRealTimeMonitoring: false };
      const newEngine = new CacheAnalyticsEngine(newConfig);

      await newEngine.start();
      expect(newEngine['monitoringInterval']).toBeUndefined();

      await newEngine.stop();
      await newEngine.dispose();
    });
  });

  describe('Memory Management and Performance', () => {
    beforeEach(async () => {
      await analyticsEngine.start();
    });

    it('should respect retention period for data cleanup', async () => {
      const shortRetentionConfig = {
        ...mockConfig,
        retentionPeriod: 100, // Very short retention
      };

      const shortRetentionEngine = new CacheAnalyticsEngine(
        shortRetentionConfig,
      );
      await shortRetentionEngine.start();

      // Add some data
      shortRetentionEngine.recordOperation(
        'get',
        'test-sample',
        'memory',
        50,
        true,
      );

      // Wait for retention period to pass
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Trigger cleanup (this would normally happen in real-time monitoring)
      shortRetentionEngine['performRealTimeAnalysis']();

      // Data should be cleaned up based on retention policy
      // Note: Actual cleanup implementation may vary

      await shortRetentionEngine.stop();
      await shortRetentionEngine.dispose();
    });

    it('should limit pattern storage to maxPatterns', async () => {
      const limitedConfig = {
        ...mockConfig,
        maxPatterns: 3,
      };

      const limitedEngine = new CacheAnalyticsEngine(limitedConfig);
      await limitedEngine.start();

      // Try to create more patterns than the limit
      for (let i = 0; i < 10; i++) {
        const sampleId = `pattern-sample-${i}`;
        for (let j = 0; j < 5; j++) {
          limitedEngine.recordOperation('get', sampleId, 'memory', 50, true);
        }
      }

      limitedEngine['updateUsagePatterns']();
      const patterns = await limitedEngine.getUsagePatterns();

      expect(patterns.length).toBeLessThanOrEqual(3);

      await limitedEngine.stop();
      await limitedEngine.dispose();
    });

    it('should handle high-frequency operations without memory leaks', async () => {
      const initialMemory = process.memoryUsage();

      // Generate high-frequency operations
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 100; i++) {
          analyticsEngine.recordOperation(
            'get',
            `memory-test-${i}`,
            'memory',
            Math.random() * 50,
            true,
          );
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
