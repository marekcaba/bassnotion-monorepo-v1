import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CDNOptimizationConfig, EdgeLocation } from '../types';

// Mock the logger before importing CDNOptimizer
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// Import after mocking
import { CDNOptimizer } from '../CDNOptimizer';

describe('CDNOptimizer', () => {
  let cdnOptimizer: CDNOptimizer;
  let mockConfig: CDNOptimizationConfig;
  let mockEdgeLocations: EdgeLocation[];

  beforeEach(() => {
    mockEdgeLocations = [
      {
        locationId: 'us-east-1',
        name: 'US East 1',
        region: 'us-east',
        country: 'US',
        city: 'New York',
        coordinates: { latitude: 40.7128, longitude: -74.006 },
        endpoint: 'https://us-east-1.cdn.example.com',
        capacity: 1000,
        currentLoad: 0.3,
        availability: 0.99,
        latency: 20,
        features: ['compression', 'image_optimization', 'caching'],
        status: 'operational',
      },
      {
        locationId: 'eu-west-1',
        name: 'EU West 1',
        region: 'eu-west',
        country: 'UK',
        city: 'London',
        coordinates: { latitude: 51.5074, longitude: -0.1278 },
        endpoint: 'https://eu-west-1.cdn.example.com',
        capacity: 1000,
        currentLoad: 0.5,
        availability: 0.98,
        latency: 30,
        features: ['compression', 'caching'],
        status: 'operational',
      },
      {
        locationId: 'ap-south-1',
        name: 'AP South 1',
        region: 'ap-south',
        country: 'Japan',
        city: 'Tokyo',
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
        endpoint: 'https://ap-south-1.cdn.example.com',
        capacity: 1000,
        currentLoad: 0.7,
        availability: 0.97,
        latency: 40,
        features: ['compression', 'video_transcoding', 'caching'],
        status: 'operational',
      },
    ];

    mockConfig = {
      enabled: true,
      edgeConfiguration: {
        edgeLocations: mockEdgeLocations,
        routingStrategy: {
          algorithm: 'hybrid',
          weights: {
            latency: 0.4,
            load: 0.3,
            availability: 0.2,
            geographic: 0.1,
          },
          fallbackStrategy: 'nearest',
        },
        failoverEnabled: true,
        healthCheckInterval: 60000,
      },
      performanceMonitoring: {
        enabled: true,
        metricsInterval: 5000,
        alertThresholds: {
          errorRate: 0.05,
          latency: 200,
          availability: 0.95,
        },
      },
    };

    cdnOptimizer = new CDNOptimizer(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(cdnOptimizer.initialize()).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await cdnOptimizer.initialize();

      // Initialize again - it should handle this gracefully
      await expect(cdnOptimizer.initialize()).resolves.not.toThrow();

      // The optimizer should still be initialized
      const result = await cdnOptimizer.optimizeRequest('/test.jpg');
      expect(result).toBeDefined();
    });
  });

  describe('edge selection', () => {
    beforeEach(async () => {
      await cdnOptimizer.initialize();
    });

    it('should optimize request URL', async () => {
      const url = '/assets/sample.jpg';
      const result = await cdnOptimizer.optimizeRequest(url);

      expect(result.originalUrl).toBe(url);
      expect(result.optimizedUrl).toContain('.cdn.example.com');
      expect(result.selectedEdge).toBeDefined();
      expect(result.optimizationApplied).toBeInstanceOf(Array);
    });

    it('should select edge by latency when configured', async () => {
      const latencyConfig = {
        ...mockConfig,
        edgeConfiguration: {
          ...mockConfig.edgeConfiguration,
          routingStrategy: {
            ...mockConfig.edgeConfiguration.routingStrategy,
            algorithm: 'latency_based' as const,
          },
        },
      };

      const optimizer = new CDNOptimizer(latencyConfig);
      await optimizer.initialize();

      const result = await optimizer.optimizeRequest('/test.jpg');

      // Should select US East (lowest latency)
      expect(result.selectedEdge.locationId).toBe('us-east-1');
    });

    it('should select edge by load when configured', async () => {
      const loadConfig = {
        ...mockConfig,
        edgeConfiguration: {
          ...mockConfig.edgeConfiguration,
          routingStrategy: {
            ...mockConfig.edgeConfiguration.routingStrategy,
            algorithm: 'load_based' as const,
          },
        },
      };

      const optimizer = new CDNOptimizer(loadConfig);
      await optimizer.initialize();

      const result = await optimizer.optimizeRequest('/test.jpg');

      // Should select US East (lowest load)
      expect(result.selectedEdge.locationId).toBe('us-east-1');
    });

    it('should select edge by geography when user location provided', async () => {
      const geoConfig = {
        ...mockConfig,
        edgeConfiguration: {
          ...mockConfig.edgeConfiguration,
          routingStrategy: {
            ...mockConfig.edgeConfiguration.routingStrategy,
            algorithm: 'geographic' as const,
          },
        },
      };

      const optimizer = new CDNOptimizer(geoConfig);
      await optimizer.initialize();

      // User in Europe
      const result = await optimizer.optimizeRequest('/test.jpg', {
        userLocation: { latitude: 48.8566, longitude: 2.3522 }, // Paris
      });

      // Should select EU West (nearest)
      expect(result.selectedEdge.locationId).toBe('eu-west-1');
    });
  });

  describe('content optimization', () => {
    beforeEach(async () => {
      await cdnOptimizer.initialize();
    });

    it('should apply compression when available', async () => {
      const result = await cdnOptimizer.optimizeRequest('/test.txt');

      expect(result.optimizedUrl).toContain('compress=true');
      expect(result.optimizationApplied).toContain('compression');
    });

    it('should apply image optimization for image URLs', async () => {
      const result = await cdnOptimizer.optimizeRequest('/test.jpg');

      expect(result.optimizedUrl).toContain('format=auto');
      expect(result.optimizedUrl).toContain('quality=85');
      expect(result.optimizationApplied).toContain('image_optimization');
    });

    it('should apply video transcoding for video URLs', async () => {
      // Select edge with video transcoding
      const videoConfig = {
        ...mockConfig,
        edgeConfiguration: {
          ...mockConfig.edgeConfiguration,
          routingStrategy: {
            ...mockConfig.edgeConfiguration.routingStrategy,
            algorithm: 'latency_based' as const,
          },
          edgeLocations: [mockEdgeLocations[2]], // Tokyo has video_transcoding
        },
      };

      const optimizer = new CDNOptimizer(videoConfig);
      await optimizer.initialize();

      const result = await optimizer.optimizeRequest('/test.mp4');

      expect(result.optimizedUrl).toContain('adaptive=true');
      expect(result.optimizedUrl).toContain('codec=h264');
      expect(result.optimizationApplied).toContain('video_transcoding');
    });
  });

  describe('metrics and health', () => {
    beforeEach(async () => {
      await cdnOptimizer.initialize();
    });

    it('should return performance metrics', () => {
      const metrics = cdnOptimizer.getPerformanceMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('requestsTotal', 0);
      expect(metrics).toHaveProperty('cacheHitRate', 0);
      expect(metrics).toHaveProperty('averageLatency', 0);
    });

    it('should return health status', () => {
      const health = cdnOptimizer.getHealthStatus();

      expect(health).toHaveProperty('overall', 'healthy');
      expect(health).toHaveProperty('score', 95);
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('issues');
    });

    it('should generate optimization recommendations', async () => {
      const recommendations =
        await cdnOptimizer.getOptimizationRecommendations();

      expect(recommendations).toBeInstanceOf(Array);
      // Should have cache hit rate recommendation (since it starts at 0)
      expect(
        recommendations.some(
          (r) => r.recommendationId === 'improve-cache-hit-rate',
        ),
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty edge locations', async () => {
      const emptyConfig = {
        ...mockConfig,
        edgeConfiguration: {
          ...mockConfig.edgeConfiguration,
          edgeLocations: [],
        },
      };

      const optimizer = new CDNOptimizer(emptyConfig);
      await optimizer.initialize();

      const result = await optimizer.optimizeRequest('/test.jpg');

      expect(result.selectedEdge.locationId).toBe('default');
    });

    it('should throw error when not initialized', async () => {
      await expect(cdnOptimizer.optimizeRequest('/test.jpg')).rejects.toThrow(
        'CDNOptimizer not initialized',
      );
    });
  });

  describe('disposal', () => {
    it('should dispose resources', async () => {
      await cdnOptimizer.initialize();
      cdnOptimizer.dispose();

      // Should need to reinitialize after disposal
      await expect(cdnOptimizer.optimizeRequest('/test.jpg')).rejects.toThrow(
        'CDNOptimizer not initialized',
      );
    });
  });
});
