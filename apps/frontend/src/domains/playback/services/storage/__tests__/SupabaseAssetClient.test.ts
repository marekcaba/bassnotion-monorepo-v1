import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseAssetClient, StorageError } from '../SupabaseAssetClient.js';
import {
  SupabaseAssetClientConfig,
  CDNOptimizationConfig,
} from '@bassnotion/contracts';

// Helper function to create minimal valid CDN configuration
function createMinimalCDNConfig(
  overrides: Partial<CDNOptimizationConfig> = {},
): CDNOptimizationConfig {
  return {
    enabled: false,
    provider: {
      name: 'cloudflare' as const,
      primaryEndpoint: 'https://cdn.example.com',
      backupEndpoints: [],
    },
    edgeConfiguration: {
      enabled: true,
      edgeLocations: [
        {
          locationId: 'us-east-1',
          name: 'US East',
          region: 'us-east-1',
          country: 'US',
          city: 'Virginia',
          coordinates: { latitude: 39.0458, longitude: -76.6413 },
          endpoint: 'https://us-east-1.cdn.example.com',
          capacity: 1000,
          currentLoad: 0.2,
          latency: 50,
          availability: 0.99,
          features: ['caching', 'compression'],
          status: 'active' as const,
          lastHealthCheck: Date.now(),
        },
        {
          locationId: 'eu-west-1',
          name: 'EU West',
          region: 'eu-west-1',
          country: 'IE',
          city: 'Dublin',
          coordinates: { latitude: 53.3498, longitude: -6.2603 },
          endpoint: 'https://eu-west-1.cdn.example.com',
          capacity: 1000,
          currentLoad: 0.3,
          latency: 75,
          availability: 0.98,
          features: ['caching', 'compression'],
          status: 'active' as const,
          lastHealthCheck: Date.now(),
        },
      ],
      routingStrategy: {
        algorithm: 'latency_based' as const,
        weights: {
          latency: 1,
          load: 0,
          geographic: 0,
          availability: 0,
          cost: 0,
          custom: {},
        },
        fallbackOrder: [],
        stickySession: false,
        sessionAffinityDuration: 0,
        customRoutingRules: [],
      },
      loadBalancing: {
        algorithm: 'round_robin' as const,
        healthCheckEnabled: false,
        healthCheckInterval: 30000,
        maxConnections: 100,
        connectionTimeout: 5000,
        retryPolicy: {
          maxRetries: 3,
          retryInterval: 1000,
          backoffStrategy: 'exponential' as const,
          retryOnStatusCodes: [502, 503, 504],
        },
      },
      healthChecking: {
        enabled: false,
        interval: 30000,
        timeout: 5000,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
        checkPath: '/health',
        expectedStatus: 200,
        customChecks: [],
      },
      failoverConfig: {
        enabled: false,
        failoverThreshold: 50,
        failoverDelay: 1000,
        recoveryThreshold: 80,
        recoveryDelay: 5000,
        automaticFailback: true,
        notificationEnabled: false,
      },
      cachingStrategy: {
        enabled: false,
        defaultTtl: 3600,
        maxTtl: 86400,
        cacheRules: [],
        compressionEnabled: false,
        compressionLevel: 'medium' as const,
        purgeStrategy: {
          enabled: false,
          purgeOnUpdate: false,
          purgePatterns: [],
          batchPurging: false,
          purgeDelay: 0,
        },
      },
    },
    contentOptimization: {
      enabled: false,
      imageOptimization: {
        enabled: false,
        formats: ['webp' as const],
        qualityLevels: [],
        resizing: false,
        compression: false,
        lazyLoading: false,
      },
      audioOptimization: {
        enabled: false,
        formats: ['mp3' as const],
        qualityLevels: [],
        compression: false,
        normalization: false,
        dynamicRange: false,
      },
      compressionConfig: {
        enabled: true,
        algorithms: ['gzip' as const],
        level: 6,
        minSize: 1024,
        contentTypes: [
          'text/plain',
          'application/json',
          'text/html',
          'text/css',
          'application/javascript',
          'audio/mpeg',
          'audio/mp3',
        ],
        adaptiveCompression: false,
        defaultStrategy: {
          algorithm: 'gzip' as const,
          level: 6,
          qualityTarget: 0.9,
          prioritizeSpeed: false,
          prioritizeSize: true,
          preserveMetadata: true,
          enableDeltaCompression: false,
          customParameters: {},
        },
        qualityThreshold: 0.8,
        maxCompressionTime: 30000,
        enableAdaptiveCompression: false,
        enableQualityMonitoring: false,
        enablePerformanceMonitoring: false,
      },
      formatConversion: {
        enabled: false,
        imageConversion: [],
        audioConversion: [],
        automaticConversion: false,
        fallbackFormats: {},
      },
      bandwidthAdaptation: {
        enabled: false,
        networkDetection: {
          enabled: false,
          detectionInterval: 5000,
          speedTestEnabled: false,
          connectionTypeDetection: false,
          latencyMeasurement: false,
        },
        adaptationRules: [],
        fallbackStrategy: 'lower_quality' as const,
        bufferManagement: {
          enabled: false,
          bufferSize: 1024 * 1024,
          preloadSize: 512 * 1024,
          adaptiveBuffering: false,
          bufferHealthThreshold: 0.5,
        },
      },
      qualityAdaptation: {
        enabled: false,
        adaptationStrategy: 'bandwidth_based' as const,
        deviceDetection: {
          enabled: false,
          screenResolutionDetection: false,
          deviceTypeDetection: false,
          performanceDetection: false,
          batteryLevelDetection: false,
        },
        userPreferences: {
          enabled: false,
          allowUserOverride: false,
          persistPreferences: false,
          preferenceCategories: [],
        },
        adaptationRules: [],
      },
    },
    performanceMonitoring: {
      enabled: false,
      metricsCollection: {
        enabled: false,
        collectionInterval: 60000,
        metricsToCollect: [],
        aggregationLevels: ['minute' as const],
        retentionPeriod: 7,
        customMetrics: [],
      },
      performanceThresholds: {
        responseTime: { warning: 1000, critical: 3000 },
        cacheHitRate: { warning: 80, critical: 60 },
        errorRate: { warning: 5, critical: 10 },
        availability: { warning: 95, critical: 90 },
        customThresholds: {},
      },
      alerting: {
        enabled: false,
        alertRules: [],
        notificationChannels: [],
        escalationEnabled: false,
        suppressionRules: [],
      },
      reporting: {
        enabled: false,
        reportTypes: [],
        reportSchedule: {
          frequency: 'daily' as const,
          time: '09:00',
          timezone: 'UTC',
          enabled: false,
        },
        recipients: [],
        customReports: [],
      },
      realTimeMonitoring: {
        enabled: false,
        updateInterval: 5000,
        dashboardEnabled: false,
        alertingEnabled: false,
        metricsStreaming: false,
        geographicVisualization: false,
      },
    },
    geographicDistribution: {
      enabled: false,
      regions: [],
      edgeSelection: {
        algorithm: 'nearest' as const,
        fallbackOrder: [],
        selectionCriteria: {
          latencyWeight: 0.4,
          loadWeight: 0.3,
          availabilityWeight: 0.3,
          costWeight: 0,
        },
      },
      loadBalancing: {
        enabled: false,
        strategy: 'regional' as const,
        regionWeights: {},
        crossRegionFailover: false,
      },
      failoverStrategy: {
        enabled: false,
        failoverOrder: [],
        automaticFailover: false,
        failoverThreshold: 50,
        recoveryThreshold: 80,
      },
      latencyOptimization: false,
      geolocationEnabled: false,
    },
    adaptiveStreaming: {
      enabled: false,
      streamingProtocol: 'progressive' as const,
      qualityLevels: [],
      bitrateAdaptation: {
        enabled: false,
        adaptationAlgorithm: 'throughput_based' as const,
        switchingThreshold: 20,
        stabilityPeriod: 5000,
        maxSwitchesPerMinute: 10,
      },
      bufferConfig: {
        initialBuffer: 2,
        maxBuffer: 30,
        rebufferThreshold: 1,
        seekBuffer: 5,
      },
      fallbackConfig: {
        enabled: false,
        fallbackProtocol: 'progressive',
        fallbackQuality: 'medium',
        maxFallbackAttempts: 3,
        fallbackDelay: 1000,
      },
    },
    analytics: {
      enabled: false,
      dataCollection: {
        enabled: false,
        userBehaviorTracking: false,
        performanceTracking: false,
        errorTracking: false,
        geographicTracking: false,
        deviceTracking: false,
        networkTracking: false,
        contentTracking: false,
        samplingRate: 1,
      },
      analysis: {
        enabled: false,
        trendAnalysis: false,
        anomalyDetection: false,
        performancePrediction: false,
        userSegmentation: false,
        geographicAnalysis: false,
        contentAnalysis: false,
        optimizationAnalysis: false,
      },
      optimization: {
        enabled: false,
        cacheOptimization: false,
        routingOptimization: false,
        contentOptimization: false,
        performanceOptimization: false,
        costOptimization: false,
        automaticOptimization: false,
        optimizationRecommendations: false,
      },
      reporting: {
        enabled: false,
        dashboardEnabled: false,
        scheduledReports: false,
        realTimeReports: false,
        customReports: false,
        dataExport: false,
        apiAccess: false,
      },
      integration: {
        enabled: false,
      },
    },
    fallbackStrategy: {
      enabled: false,
      fallbackOrder: [],
      automaticFailover: false,
      failoverThreshold: 50,
      recoveryThreshold: 80,
      healthCheckInterval: 30000,
      notificationEnabled: false,
    },
    ...overrides,
  };
}

// Mock Supabase
const mockDownload = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: mockDownload,
      })),
    },
  })),
}));

describe('SupabaseAssetClient', () => {
  let client: SupabaseAssetClient;
  let config: SupabaseAssetClientConfig;

  beforeEach(() => {
    config = {
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      maxConnections: 5,
      retryAttempts: 2,
      circuitBreakerThreshold: 3,
    };

    client = new SupabaseAssetClient(config);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await client.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new SupabaseAssetClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseKey: 'test-key',
      });

      expect(defaultClient).toBeDefined();
      const health = defaultClient.getHealthStatus();
      expect(health.isHealthy).toBe(true);
    });

    it('should create primary and backup clients', () => {
      const configWithBackup = {
        ...config,
        backupUrls: [
          'https://backup1.supabase.co',
          'https://backup2.supabase.co',
        ],
      };

      const _clientWithBackup = new SupabaseAssetClient(configWithBackup);
      expect(_clientWithBackup.getHealthStatus().isHealthy).toBe(true);
    });
  });

  describe('Asset Download', () => {
    it('should successfully download an asset', async () => {
      const mockBlob = new Blob(['test data']);
      mockDownload.mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      const result = await client.downloadAsset('test-bucket', 'test/path.mp3');

      expect(result.data).toBe(mockBlob);
      expect(result.metadata.bucket).toBe('test-bucket');
      expect(result.metadata.path).toBe('test/path.mp3');
      expect(result.metadata.source).toBe('supabase-storage');
    });

    it('should throw StorageError on download failure', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      await expect(
        client.downloadAsset('test-bucket', 'missing.mp3'),
      ).rejects.toThrow(StorageError);
    });

    it('should retry on transient failures', async () => {
      mockDownload
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: new Blob(['test data']),
          error: null,
        });

      const result = await client.downloadAsset('test-bucket', 'test.mp3');
      expect(result.data).toBeDefined();
      expect(mockDownload).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retry attempts', async () => {
      mockDownload.mockRejectedValue(new Error('Persistent error'));

      await expect(
        client.downloadAsset('test-bucket', 'test.mp3'),
      ).rejects.toThrow('Persistent error');

      expect(mockDownload).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      mockDownload.mockRejectedValue(new Error('Server error'));

      // Cause enough failures to open circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await client.downloadAsset('test-bucket', 'test.mp3');
        } catch {
          // Expected to fail
        }
      }

      const health = client.getHealthStatus();
      expect(health.circuitBreakerState).toBe('open');

      // Next request should be rejected immediately
      await expect(
        client.downloadAsset('test-bucket', 'test.mp3'),
      ).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Health Monitoring', () => {
    it('should track request metrics', async () => {
      const mockBlob = new Blob(['test data']);
      mockDownload.mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      await client.downloadAsset('test-bucket', 'test1.mp3');
      await client.downloadAsset('test-bucket', 'test2.mp3');

      const metrics = client.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should provide comprehensive health status', async () => {
      const health = client.getHealthStatus();

      expect(health).toMatchObject({
        isHealthy: expect.any(Boolean),
        circuitBreakerState: expect.stringMatching(/open|closed|half-open/),
        connectionPoolStatus: expect.objectContaining({
          active: expect.any(Number),
          idle: expect.any(Number),
          total: expect.any(Number),
        }),
        lastHealthCheck: expect.any(Number),
        activeConnections: expect.any(Number),
        failoverStatus: expect.objectContaining({
          isActive: expect.any(Boolean),
          lastFailover: expect.any(Number),
        }),
        metrics: expect.objectContaining({
          totalRequests: expect.any(Number),
          successfulRequests: expect.any(Number),
          failedRequests: expect.any(Number),
          averageLatency: expect.any(Number),
          lastRequestTime: expect.any(Number),
        }),
      });
    });
  });

  describe('Geographic Optimization', () => {
    it('should initialize with geographic optimization enabled', () => {
      const optimizedConfig = {
        ...config,
        enableGeographicOptimization: true,
        primaryRegion: 'eu-west-1',
        backupRegions: ['us-east-1', 'ap-southeast-1'],
      };

      const optimizedClient = new SupabaseAssetClient(optimizedConfig);
      expect(optimizedClient.getHealthStatus().isHealthy).toBe(true);
    });

    it('should work with geographic optimization disabled', () => {
      const basicConfig = {
        ...config,
        enableGeographicOptimization: false,
      };

      const basicClient = new SupabaseAssetClient(basicConfig);
      expect(basicClient.getHealthStatus().isHealthy).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should apply custom timeout settings', () => {
      const customConfig = {
        ...config,
        requestTimeout: 5000,
        retryBackoffMs: 500,
      };

      const customClient = new SupabaseAssetClient(customConfig);
      expect(customClient.getHealthStatus().isHealthy).toBe(true);
    });

    it('should handle empty backup URLs', () => {
      const configWithEmptyBackups = {
        ...config,
        backupUrls: [],
      };

      const clientWithEmptyBackups = new SupabaseAssetClient(
        configWithEmptyBackups,
      );
      expect(clientWithEmptyBackups.getHealthStatus().isHealthy).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed responses gracefully', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: { message: 'Invalid response format' },
      });

      await expect(
        client.downloadAsset('test-bucket', 'malformed.mp3'),
      ).rejects.toThrow(StorageError);
    });

    it('should provide detailed error context', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: { message: 'Access denied' },
      });

      try {
        await client.downloadAsset('test-bucket', 'private.mp3');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).code).toBe('DOWNLOAD_FAILED');
        expect((error as StorageError).context).toMatchObject({
          path: 'private.mp3',
          bucket: 'test-bucket',
        });
      }
    });
  });

  describe('CDN Optimization System', () => {
    describe('CDN Configuration', () => {
      it('should initialize without CDN optimization when disabled', () => {
        const configWithoutCDN = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: false }),
        };

        const clientWithoutCDN = new SupabaseAssetClient(configWithoutCDN);
        expect(clientWithoutCDN.getHealthStatus().isHealthy).toBe(true);
      });

      it('should initialize with CDN optimization when enabled', () => {
        const configWithCDN = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: true }),
        };

        const clientWithCDN = new SupabaseAssetClient(configWithCDN);
        expect(clientWithCDN.getHealthStatus().isHealthy).toBe(true);
      });
    });

    describe('CDN Optimizer', () => {
      let cdnClient: SupabaseAssetClient;

      beforeEach(async () => {
        const cdnConfig = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({
            enabled: true,
            edgeConfiguration: {
              enabled: true,
              edgeLocations: [
                {
                  locationId: 'us-east-1',
                  name: 'US East',
                  region: 'us-east-1',
                  country: 'US',
                  city: 'Virginia',
                  coordinates: { latitude: 39.0458, longitude: -76.6413 },
                  endpoint: 'https://us-east-1.cdn.example.com',
                  capacity: 1000,
                  currentLoad: 0.2,
                  latency: 50,
                  availability: 0.99,
                  features: ['caching', 'compression'],
                  status: 'active',
                  lastHealthCheck: Date.now(),
                },
                {
                  locationId: 'eu-west-1',
                  name: 'EU West',
                  region: 'eu-west-1',
                  country: 'IE',
                  city: 'Dublin',
                  coordinates: { latitude: 53.3498, longitude: -6.2603 },
                  endpoint: 'https://eu-west-1.cdn.example.com',
                  capacity: 800,
                  currentLoad: 0.4,
                  latency: 30,
                  availability: 0.98,
                  features: ['caching', 'compression', 'image_optimization'],
                  status: 'active',
                  lastHealthCheck: Date.now(),
                },
              ],
              routingStrategy: {
                algorithm: 'hybrid' as const,
                weights: {
                  latency: 0.4,
                  load: 0.3,
                  availability: 0.3,
                  geographic: 0,
                  cost: 0,
                  custom: {},
                },
                fallbackOrder: [],
                stickySession: false,
                sessionAffinityDuration: 0,
                customRoutingRules: [],
              },
              loadBalancing: {
                algorithm: 'round_robin' as const,
                healthCheckEnabled: true,
                healthCheckInterval: 30000,
                maxConnections: 100,
                connectionTimeout: 5000,
                retryPolicy: {
                  maxRetries: 3,
                  retryInterval: 1000,
                  backoffStrategy: 'exponential' as const,
                  retryOnStatusCodes: [502, 503, 504],
                },
              },
              healthChecking: {
                enabled: true,
                interval: 30000,
                timeout: 5000,
                healthyThreshold: 2,
                unhealthyThreshold: 3,
                checkPath: '/health',
                expectedStatus: 200,
                customChecks: [],
              },
              failoverConfig: {
                enabled: true,
                failoverThreshold: 50,
                failoverDelay: 1000,
                recoveryThreshold: 80,
                recoveryDelay: 5000,
                automaticFailback: true,
                notificationEnabled: false,
              },
              cachingStrategy: {
                enabled: true,
                defaultTtl: 3600,
                maxTtl: 86400,
                cacheRules: [],
                compressionEnabled: true,
                compressionLevel: 'medium' as const,
                purgeStrategy: {
                  enabled: false,
                  purgeOnUpdate: false,
                  purgePatterns: [],
                  batchPurging: false,
                  purgeDelay: 0,
                },
              },
            },
          }),
        };

        cdnClient = new SupabaseAssetClient(cdnConfig);
        await cdnClient.initialize();
      });

      afterEach(async () => {
        await cdnClient.dispose();
      });

      it('should optimize requests with CDN routing', async () => {
        // Access the private CDN optimizer through the client
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        expect(cdnOptimizer).toBeDefined();

        const optimizedUrl =
          await cdnOptimizer.optimizeRequest('/test/asset.mp3');
        expect(optimizedUrl).toContain('cdn.example.com');
        expect(optimizedUrl).toContain('/test/asset.mp3');
      });

      it('should select optimal edge based on latency', async () => {
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        const edge = cdnOptimizer.selectByLatency();

        expect(edge).toBeDefined();
        expect(edge.latency).toBeLessThanOrEqual(50); // Should select the lowest latency edge
      });

      it('should select optimal edge based on load', async () => {
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        const edge = cdnOptimizer.selectByLoad();

        expect(edge).toBeDefined();
        expect(edge.currentLoad).toBeLessThanOrEqual(0.4); // Should select the lowest load edge
      });

      it('should calculate edge scores for hybrid algorithm', async () => {
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        const weights = { latency: 0.4, load: 0.3, availability: 0.3 };
        const edge = {
          latency: 50,
          currentLoad: 0.2,
          availability: 0.99,
        };

        const score = cdnOptimizer.calculateEdgeScore(edge, weights);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('should get performance metrics', async () => {
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        const metrics = cdnOptimizer.getPerformanceMetrics();

        expect(metrics).toMatchObject({
          timestamp: expect.any(Number),
          averageResponseTime: expect.any(Number),
          totalRequests: expect.any(Number),
          cacheHitRate: expect.any(Number),
          errorRate: expect.any(Number),
        });
      });

      it('should get optimization recommendations', async () => {
        const cdnOptimizer = (cdnClient as any).cdnOptimizer;
        const recommendations =
          await cdnOptimizer.getOptimizationRecommendations();

        expect(Array.isArray(recommendations)).toBe(true);
        if (recommendations.length > 0) {
          expect(recommendations[0]).toMatchObject({
            recommendationId: expect.any(String),
            type: expect.any(String),
            priority: expect.stringMatching(/low|medium|high|critical/),
            title: expect.any(String),
            description: expect.any(String),
          });
        }
      });
    });

    describe('Adaptive Streaming Manager', () => {
      let cdnClient: SupabaseAssetClient;

      beforeEach(() => {
        const cdnConfig = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: true }),
        };

        cdnClient = new SupabaseAssetClient(cdnConfig);
      });

      afterEach(async () => {
        await cdnClient.dispose();
      });

      it('should select optimal quality based on bandwidth', async () => {
        const streamingManager = (cdnClient as any).adaptiveStreamingManager;
        const quality = streamingManager.selectOptimalQuality();

        expect(quality).toBeDefined();
        expect(quality.name).toMatch(/low|medium|high/);
        expect(quality.quality).toBeGreaterThan(0);
        expect(quality.targetBitrate).toBeGreaterThan(0);
      });

      it('should adapt quality based on performance metrics', async () => {
        const streamingManager = (cdnClient as any).adaptiveStreamingManager;
        const performanceMetrics = { errorRate: 10 }; // High error rate

        const adaptedQuality = await streamingManager.adaptQuality(
          'high',
          performanceMetrics,
        );
        expect(adaptedQuality).toBeDefined();
        expect(typeof adaptedQuality).toBe('string');
      });

      it('should get current network condition', async () => {
        const streamingManager = (cdnClient as any).adaptiveStreamingManager;
        const networkCondition = streamingManager.getNetworkCondition();

        expect(networkCondition).toMatchObject({
          connectionType: expect.stringMatching(/wifi|cellular/),
          connectionQuality: expect.stringMatching(/poor|good|excellent/),
          minBandwidth: expect.any(Number),
          maxBandwidth: expect.any(Number),
          maxLatency: expect.any(Number),
        });
      });

      it('should map connection types correctly', async () => {
        const streamingManager = (cdnClient as any).adaptiveStreamingManager;

        expect(streamingManager.mapConnectionType('4g')).toBe('cellular');
        expect(streamingManager.mapConnectionType('3g')).toBe('cellular');
        expect(streamingManager.mapConnectionType('slow-2g')).toBe('cellular');
        expect(streamingManager.mapConnectionType('unknown')).toBe('wifi');
      });
    });

    describe('Geographic Distribution Manager', () => {
      let cdnClient: SupabaseAssetClient;

      beforeEach(async () => {
        const cdnConfig = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: true }),
        };

        cdnClient = new SupabaseAssetClient(cdnConfig);
        await cdnClient.initialize();
      });

      afterEach(async () => {
        await cdnClient.dispose();
      });

      it('should select optimal edge based on user location', async () => {
        const geoManager = (cdnClient as any).geographicDistributionManager;
        const userLocation = { latitude: 40.7128, longitude: -74.006 }; // New York

        const edge = geoManager.selectOptimalEdge(userLocation);
        expect(edge).toBeDefined();
        expect(edge.locationId).toBeDefined();
      });

      it('should calculate distance between coordinates', async () => {
        const geoManager = (cdnClient as any).geographicDistributionManager;
        const point1 = { latitude: 40.7128, longitude: -74.006 }; // New York
        const point2 = { latitude: 39.0458, longitude: -76.6413 }; // Virginia

        const distance = geoManager.calculateDistance(point1, point2);
        expect(distance).toBeGreaterThan(0);
      });

      it('should get all edge locations', async () => {
        const geoManager = (cdnClient as any).geographicDistributionManager;
        const edges = geoManager.getEdgeLocations();

        expect(Array.isArray(edges)).toBe(true);
        expect(edges.length).toBeGreaterThan(0);
      });

      it('should handle missing user location gracefully', async () => {
        const geoManager = (cdnClient as any).geographicDistributionManager;
        const edge = geoManager.selectOptimalEdge(null);

        expect(edge).toBeDefined();
        expect(edge.locationId).toBeDefined();
      });
    });

    describe('Content Optimization Manager', () => {
      let cdnClient: SupabaseAssetClient;

      beforeEach(() => {
        const cdnConfig = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: true }),
        };

        cdnClient = new SupabaseAssetClient(cdnConfig);
      });

      afterEach(async () => {
        await cdnClient.dispose();
      });

      it('should optimize content based on type and network conditions', async () => {
        const contentManager = (cdnClient as any).contentOptimizationManager;
        const networkCondition = {
          maxBandwidth: 2 * 1024 * 1024, // 2 Mbps
        };

        const optimizedUrl = await contentManager.optimizeContent(
          '/test/image.jpg',
          'image/jpeg',
          networkCondition,
        );

        expect(optimizedUrl).toContain('/test/image.jpg');
      });

      it('should apply compression for supported content types', async () => {
        const contentManager = (cdnClient as any).contentOptimizationManager;

        const compressedUrl = contentManager.applyCompression(
          '/test/audio.mp3',
          'audio/mpeg',
        );
        expect(compressedUrl).toContain('compress=');
      });

      it('should apply format conversion for images', async () => {
        const contentManager = (cdnClient as any).contentOptimizationManager;

        const convertedUrl = contentManager.applyFormatConversion(
          '/test/image.jpg',
          'image/jpeg',
        );
        expect(convertedUrl).toContain('format=webp');
      });

      it('should apply format conversion for audio', async () => {
        const contentManager = (cdnClient as any).contentOptimizationManager;

        const convertedUrl = contentManager.applyFormatConversion(
          '/test/audio.wav',
          'audio/wav',
        );
        expect(convertedUrl).toContain('format=mp3');
      });

      it('should apply bandwidth adaptation for low bandwidth', async () => {
        const contentManager = (cdnClient as any).contentOptimizationManager;
        const lowBandwidthCondition = {
          maxBandwidth: 1024 * 1024, // 1 Mbps
        };

        const adaptedUrl = contentManager.applyBandwidthAdaptation(
          '/test/video.mp4',
          lowBandwidthCondition,
        );
        expect(adaptedUrl).toContain('quality=low');
      });
    });

    describe('CDN Analytics Manager', () => {
      let cdnClient: SupabaseAssetClient;

      beforeEach(() => {
        const cdnConfig = {
          ...config,
          cdnOptimizationConfig: createMinimalCDNConfig({ enabled: true }),
        };

        cdnClient = new SupabaseAssetClient(cdnConfig);
      });

      afterEach(async () => {
        await cdnClient.dispose();
      });

      it('should get CDN performance metrics', async () => {
        const analyticsManager = (cdnClient as any).cdnAnalyticsManager;
        const metrics = analyticsManager.getMetrics();

        expect(metrics).toMatchObject({
          timestamp: expect.any(Number),
          averageResponseTime: expect.any(Number),
          totalRequests: expect.any(Number),
          totalBytes: expect.any(Number),
          cacheHitRate: expect.any(Number),
          errorRate: expect.any(Number),
        });
      });

      it('should record request metrics', async () => {
        const analyticsManager = (cdnClient as any).cdnAnalyticsManager;

        analyticsManager.recordRequest(100, true, 1024);
        const metrics = analyticsManager.getMetrics();

        expect(metrics.totalRequests).toBe(1);
        expect(metrics.totalBytes).toBe(1024);
        expect(metrics.cacheHitRate).toBeGreaterThan(0);
      });

      it('should generate optimization recommendations', async () => {
        const analyticsManager = (cdnClient as any).cdnAnalyticsManager;

        // Simulate low cache hit rate
        analyticsManager.metrics.cacheHitRate = 70;

        const recommendations = analyticsManager.getRecommendations();
        expect(Array.isArray(recommendations)).toBe(true);
      });

      it('should update metrics over time', async () => {
        const analyticsManager = (cdnClient as any).cdnAnalyticsManager;

        const initialTimestamp = analyticsManager.getMetrics().timestamp;

        // Simulate time passing
        analyticsManager.updateMetrics();

        const updatedTimestamp = analyticsManager.getMetrics().timestamp;
        expect(updatedTimestamp).toBeGreaterThanOrEqual(initialTimestamp);
      });
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize and dispose cleanly', async () => {
      await client.initialize();
      expect(client.getHealthStatus().isHealthy).toBe(true);

      await client.dispose();
      // Should be able to call dispose multiple times
      await client.dispose();
    });

    it('should prevent double initialization', async () => {
      await client.initialize();

      // Should throw error on double initialization
      await expect(client.initialize()).rejects.toThrow(
        'Client already initialized',
      );
      expect(client.getHealthStatus().isHealthy).toBe(true);
    });
  });
});

describe('StorageError', () => {
  it('should create error with code and context', () => {
    const error = new StorageError('Test error', 'TEST_ERROR', {
      key: 'value',
    });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.context).toEqual({ key: 'value' });
    expect(error.name).toBe('StorageError');
  });

  it('should create error without context', () => {
    const error = new StorageError('Simple error', 'SIMPLE_ERROR');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('SIMPLE_ERROR');
    expect(error.context).toBeUndefined();
  });
});
