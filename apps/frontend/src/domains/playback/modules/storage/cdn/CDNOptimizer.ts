/**
 * CDN Optimizer Module
 *
 * Intelligent CDN optimization with edge routing, content optimization,
 * and performance monitoring. Extracted from SupabaseAssetClient for
 * better modularity and reusability.
 */

import { logger } from '../../../utils/logger.js';
import {
  CDNOptimizationConfig,
  EdgeLocation,
  CDNPerformanceMetrics,
  CDNHealthStatus,
  CDNOptimizationRecommendation,
} from './types.js';

/**
 * CDN Optimizer - Main orchestrator for CDN operations
 * Implements intelligent CDN optimization with edge routing,
 * content optimization, and performance monitoring
 */
export class CDNOptimizer {
  private config: CDNOptimizationConfig;
  private edgeLocations: EdgeLocation[] = [];
  private performanceMetrics: CDNPerformanceMetrics;
  private healthStatus: CDNHealthStatus;
  private isInitialized = false;

  constructor(config: CDNOptimizationConfig) {
    this.config = config;
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.healthStatus = this.initializeHealthStatus();
  }

  private initializePerformanceMetrics(): CDNPerformanceMetrics {
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
      errorRate: 0,
      timeoutRate: 0,
      errorsByType: {},
      edgePerformance: [],
      geographicDistribution: [],
      compressionSavings: 0,
      formatConversionSavings: 0,
      costSavings: 0,
      qualityMetrics: {
        videoQualityScore: 0,
        audioQualityScore: 0,
        imageQualityScore: 0,
      },
    };
  }

  private initializeHealthStatus(): CDNHealthStatus {
    return {
      overall: 'healthy',
      score: 95,
      components: [],
      edgeLocations: [],
      lastCheck: Date.now(),
      issues: [],
      recommendations: [],
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CDNOptimizer already initialized');
      return;
    }

    try {
      await this.loadEdgeLocations();
      await this.setupPerformanceMonitoring();
      this.isInitialized = true;
      logger.info('🌐 CDNOptimizer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CDNOptimizer:', error);
      throw error;
    }
  }

  private async loadEdgeLocations(): Promise<void> {
    this.edgeLocations = this.config.edgeConfiguration?.edgeLocations || [];
    logger.info(`📍 Loaded ${this.edgeLocations.length} edge locations`);
  }

  private async setupPerformanceMonitoring(): Promise<void> {
    if (this.config.performanceMonitoring.enabled) {
      logger.info('📊 CDN performance monitoring enabled');
      // TODO: Implement actual performance monitoring setup
    }
  }

  /**
   * Optimize a request URL for CDN delivery
   */
  async optimizeRequest(
    url: string,
    options: OptimizationOptions = {},
  ): Promise<OptimizedRequest> {
    if (!this.isInitialized) {
      throw new Error('CDNOptimizer not initialized');
    }

    const optimalEdge = await this.selectOptimalEdge(url, options);
    const optimizedUrl = await this.applyContentOptimization(url, optimalEdge);

    this.updateMetrics({
      requestUrl: url,
      selectedEdge: optimalEdge,
      optimizedUrl,
    });

    return {
      originalUrl: url,
      optimizedUrl,
      selectedEdge: optimalEdge,
      optimizationApplied: this.getAppliedOptimizations(url, optimalEdge),
    };
  }

  private async selectOptimalEdge(
    url: string,
    options: OptimizationOptions,
  ): Promise<EdgeLocation> {
    const strategy = this.config.edgeConfiguration.routingStrategy;

    switch (strategy.algorithm) {
      case 'latency_based':
        return this.selectByLatency();
      case 'geographic':
        return this.selectByGeography(options.userLocation);
      case 'load_based':
        return this.selectByLoad();
      case 'hybrid':
        return this.selectByHybridAlgorithm(options);
      default:
        logger.info('🔧 CDNOptimizer: Using default edge selection');
        return this.edgeLocations[0] || this.createDefaultEdge();
    }
  }

  private selectByLatency(): EdgeLocation {
    if (this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    return (
      this.edgeLocations.reduce((best, current) =>
        current.latency < best.latency ? current : best,
      ) || this.createDefaultEdge()
    );
  }

  private selectByGeography(userLocation?: GeographicLocation): EdgeLocation {
    if (!userLocation || this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    return this.edgeLocations.reduce((nearest, current) => {
      const currentDistance = this.calculateDistance(
        userLocation,
        current.coordinates,
      );
      const nearestDistance = this.calculateDistance(
        userLocation,
        nearest.coordinates,
      );
      return currentDistance < nearestDistance ? current : nearest;
    });
  }

  private selectByLoad(): EdgeLocation {
    if (this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    return this.edgeLocations.reduce((best, current) =>
      current.currentLoad < best.currentLoad ? current : best,
    );
  }

  private selectByHybridAlgorithm(options: OptimizationOptions): EdgeLocation {
    if (this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    const weights = this.config.edgeConfiguration.routingStrategy.weights;

    return this.edgeLocations.reduce((best, current) => {
      const currentScore = this.calculateEdgeScore(current, weights, options);
      const bestScore = this.calculateEdgeScore(best, weights, options);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateEdgeScore(
    edge: EdgeLocation,
    weights: any,
    options: OptimizationOptions,
  ): number {
    let score = 0;

    // Latency score (lower is better)
    if (weights.latency) {
      const latencyScore = (1 - edge.latency / 1000) * weights.latency;
      score += latencyScore;
    }

    // Load score (lower is better)
    if (weights.load) {
      const loadScore = (1 - edge.currentLoad) * weights.load;
      score += loadScore;
    }

    // Availability score (higher is better)
    if (weights.availability) {
      const availabilityScore = edge.availability * weights.availability;
      score += availabilityScore;
    }

    // Geographic score (if user location provided)
    if (weights.geographic && options.userLocation) {
      const distance = this.calculateDistance(
        options.userLocation,
        edge.coordinates,
      );
      const geoScore = (1 - Math.min(distance / 20000, 1)) * weights.geographic;
      score += geoScore;
    }

    return score;
  }

  private calculateDistance(
    loc1: GeographicLocation,
    loc2: GeographicLocation,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const lat1 = this.toRad(loc1.latitude);
    const lat2 = this.toRad(loc2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private createDefaultEdge(): EdgeLocation {
    return {
      locationId: 'default',
      name: 'Default Edge',
      region: 'global',
      country: 'US',
      city: 'Default',
      coordinates: { latitude: 0, longitude: 0 },
      endpoint: 'https://default-edge.example.com',
      capacity: 1000,
      currentLoad: 0.5,
      availability: 0.99,
      latency: 50,
      features: ['compression', 'caching'],
      status: 'operational',
    };
  }

  private async applyContentOptimization(
    url: string,
    edge: EdgeLocation,
  ): Promise<string> {
    let optimizedUrl = url;

    if (edge.features.includes('compression')) {
      optimizedUrl = this.addCompressionParams(optimizedUrl);
    }

    if (edge.features.includes('image_optimization')) {
      optimizedUrl = this.addImageOptimizationParams(optimizedUrl);
    }

    if (edge.features.includes('video_transcoding')) {
      optimizedUrl = this.addVideoTranscodingParams(optimizedUrl);
    }

    return `${edge.endpoint}${optimizedUrl}`;
  }

  private addCompressionParams(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}compress=true&encoding=gzip`;
  }

  private addImageOptimizationParams(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}format=auto&quality=85&progressive=true`;
  }

  private addVideoTranscodingParams(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}adaptive=true&codec=h264`;
  }

  private getAppliedOptimizations(url: string, edge: EdgeLocation): string[] {
    const optimizations: string[] = [];

    if (edge.features.includes('compression')) {
      optimizations.push('compression');
    }

    if (edge.features.includes('image_optimization') && this.isImageUrl(url)) {
      optimizations.push('image_optimization');
    }

    if (edge.features.includes('video_transcoding') && this.isVideoUrl(url)) {
      optimizations.push('video_transcoding');
    }

    if (edge.features.includes('caching')) {
      optimizations.push('edge_caching');
    }

    return optimizations;
  }

  private isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
  }

  private isVideoUrl(url: string): boolean {
    return /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
  }

  private updateMetrics(request: any): void {
    this.performanceMetrics.requestsTotal++;
    this.performanceMetrics.requestsSuccessful++;
    // TODO: Implement actual metric updates
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): CDNPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current health status
   */
  getHealthStatus(): CDNHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<
    CDNOptimizationRecommendation[]
  > {
    const recommendations: CDNOptimizationRecommendation[] = [];

    // Check cache hit rate
    if (this.performanceMetrics.cacheHitRate < 0.8) {
      recommendations.push({
        recommendationId: 'improve-cache-hit-rate',
        type: 'configuration',
        priority: 'high',
        title: 'Improve Cache Hit Rate',
        description:
          'Current cache hit rate is below 80%. Consider optimizing cache headers.',
        impact: {
          performance: 25,
          cost: 20,
          reliability: 10,
        },
        implementationDifficulty: 'medium',
        estimatedSavings: 1000,
        effort: 'low',
        timeToImplement: 2,
        requiredResources: ['CDN configuration'],
        risks: ['Potential stale content'],
        steps: ['Update cache headers', 'Monitor cache performance'],
      });
    }

    // Check edge distribution
    const underutilizedEdges = this.edgeLocations.filter(
      (e) => e.currentLoad < 0.2,
    );
    if (underutilizedEdges.length > 0) {
      recommendations.push({
        recommendationId: 'balance-edge-distribution',
        type: 'routing',
        priority: 'medium',
        title: 'Balance Edge Distribution',
        description: `${underutilizedEdges.length} edge locations are underutilized.`,
        impact: {
          performance: 15,
          cost: 10,
          reliability: 20,
        },
        implementationDifficulty: 'medium',
        estimatedSavings: 500,
        effort: 'medium',
        timeToImplement: 3,
        requiredResources: ['Routing configuration'],
        risks: ['Temporary latency increase during transition'],
        steps: ['Analyze traffic patterns', 'Adjust routing weights'],
      });
    }

    return recommendations;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isInitialized = false;
    this.edgeLocations = [];
    logger.info('🛑 CDNOptimizer disposed');
  }
}

// Types
interface OptimizationOptions {
  userLocation?: GeographicLocation;
  contentType?: string;
  priority?: 'low' | 'normal' | 'high';
  qualityPreference?: 'auto' | 'low' | 'medium' | 'high';
}

interface OptimizedRequest {
  originalUrl: string;
  optimizedUrl: string;
  selectedEdge: EdgeLocation;
  optimizationApplied: string[];
}

interface GeographicLocation {
  latitude: number;
  longitude: number;
}
