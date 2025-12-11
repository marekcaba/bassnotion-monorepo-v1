/**
 * CDN Service Implementation
 *
 * Provides generic CDN functionality for all domains
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  CDNOptimizationConfig,
  EdgeLocation,
  CDNPerformanceMetrics,
  CDNHealthStatus,
  NetworkCondition,
} from '@bassnotion/contracts';
import type { ICDNService, GeolocationCoordinates } from './ICDNService.js';
import { EdgeLocationManager } from './EdgeLocationManager.js';

const logger = createStructuredLogger('CDNService');

export class CDNService implements ICDNService {
  private config: CDNOptimizationConfig;
  private edgeManager: EdgeLocationManager;
  private metrics: CDNPerformanceMetrics;
  private healthStatus: CDNHealthStatus;
  private isInitialized = false;

  constructor(config: CDNOptimizationConfig) {
    this.config = config;
    this.edgeManager = new EdgeLocationManager();
    this.metrics = this.initializeMetrics();
    this.healthStatus = this.initializeHealthStatus();
  }

  private initializeMetrics(): CDNPerformanceMetrics {
    return {
      timestamp: Date.now(),
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageLatency: 0,
      p50Latency: 0,
      p90Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      bandwidthUsed: 0,
      bandwidthSaved: 0,
      cacheHitRate: 0,
      originHitRate: 0,
      edgeMetrics: [],
      geographicDistribution: [],
    };
  }

  private initializeHealthStatus(): CDNHealthStatus {
    return {
      timestamp: Date.now(),
      overallHealth: 'healthy',
      components: {
        edgeServers: { status: 'healthy', issues: [] },
        caching: { status: 'healthy', issues: [] },
        routing: { status: 'healthy', issues: [] },
        analytics: { status: 'healthy', issues: [] },
      },
      edgeHealth: [],
      recommendations: [],
    };
  }

  /**
   * Initialize CDN service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize edge locations
      if (this.config.edgeConfiguration?.locations) {
        await this.edgeManager.initialize(
          this.config.edgeConfiguration.locations,
        );
      }

      this.isInitialized = true;
      logger.info('CDN service initialized', {
        edgeLocations: this.edgeManager.getEdgeLocations().length,
      });
    } catch (error) {
      logger.error('Failed to initialize CDN service', error);
      throw error;
    }
  }

  /**
   * Get optimal CDN endpoint for a resource
   */
  async getOptimalEndpoint(
    resourcePath: string,
    userLocation?: GeolocationCoordinates,
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('CDN service not initialized');
    }

    const optimalEdge = this.edgeManager.getOptimalLocation(userLocation);

    if (!optimalEdge) {
      // Fallback to primary CDN URL
      return this.buildCDNUrl(this.config.primaryCdnUrl, resourcePath);
    }

    // Update metrics
    this.metrics.requestsTotal++;

    return this.buildCDNUrl(optimalEdge.url, resourcePath);
  }

  /**
   * Build CDN URL
   */
  private buildCDNUrl(baseUrl: string, resourcePath: string): string {
    // Remove leading slash from resource path
    const cleanPath = resourcePath.startsWith('/')
      ? resourcePath.slice(1)
      : resourcePath;

    // Ensure base URL doesn't end with slash
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    return `${cleanBase}/${cleanPath}`;
  }

  /**
   * Get list of available edge locations
   */
  getEdgeLocations(): EdgeLocation[] {
    return this.edgeManager.getEdgeLocations();
  }

  /**
   * Get current network conditions
   */
  getNetworkConditions(): NetworkCondition {
    return this.edgeManager.getNetworkConditions();
  }

  /**
   * Get CDN performance metrics
   */
  getMetrics(): CDNPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get CDN health status
   */
  getHealthStatus(): CDNHealthStatus {
    return {
      ...this.healthStatus,
      timestamp: Date.now(),
    };
  }

  /**
   * Warm up CDN cache for resources
   */
  async warmCache(resources: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('CDN service not initialized');
    }

    logger.info('Warming CDN cache', { resourceCount: resources.length });

    const edges = this.edgeManager.getEdgeLocations();
    const warmupPromises: Promise<void>[] = [];

    for (const edge of edges) {
      for (const resource of resources) {
        warmupPromises.push(this.warmupResource(edge, resource));
      }
    }

    try {
      await Promise.all(warmupPromises);
      logger.info('CDN cache warmup completed');
    } catch (error) {
      logger.error('CDN cache warmup failed', error);
      throw error;
    }
  }

  /**
   * Warm up a single resource on an edge
   */
  private async warmupResource(
    edge: EdgeLocation,
    resource: string,
  ): Promise<void> {
    const url = this.buildCDNUrl(edge.url, resource);

    try {
      const response = await fetch(url, { method: 'HEAD' });

      if (response.ok) {
        this.metrics.requestsSuccessful++;
      } else {
        this.metrics.requestsFailed++;
      }
    } catch (error) {
      this.metrics.requestsFailed++;
      logger.warn('Failed to warm up resource', {
        edge: edge.id,
        resource,
        error,
      });
    }
  }

  /**
   * Invalidate CDN cache
   */
  async invalidateCache(patterns: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('CDN service not initialized');
    }

    logger.info('Invalidating CDN cache', { patterns });

    // In a real implementation, this would call CDN provider's API
    // For now, we just log the operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info('CDN cache invalidation completed');
  }

  /**
   * Update performance metrics
   */
  updateMetrics(updates: Partial<CDNPerformanceMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...updates,
      timestamp: Date.now(),
    };
  }

  /**
   * Update health status
   */
  updateHealthStatus(
    componentId: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
  ): void {
    if (componentId in this.healthStatus.components) {
      this.healthStatus.components[
        componentId as keyof typeof this.healthStatus.components
      ].status = status;
    }

    // Update overall health based on component health
    const statuses = Object.values(this.healthStatus.components).map(
      (c) => c.status,
    );

    if (statuses.some((s) => s === 'unhealthy')) {
      this.healthStatus.overallHealth = 'unhealthy';
    } else if (statuses.some((s) => s === 'degraded')) {
      this.healthStatus.overallHealth = 'degraded';
    } else {
      this.healthStatus.overallHealth = 'healthy';
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.isInitialized = false;
    logger.info('CDN service disposed');
  }
}
