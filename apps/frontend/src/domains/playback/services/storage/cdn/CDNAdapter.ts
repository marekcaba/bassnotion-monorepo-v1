/**
 * CDN Adapter for Playback Domain
 *
 * Combines shared CDN infrastructure with playback-specific
 * CDN modules for audio optimization
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import {
  CDNService,
  ICDNService,
} from '@/shared/infrastructure/storage/index.js';
import {
  CDNOptimizer,
  GeographicDistributionManager,
} from '../../../modules/storage/cdn/index.js';
import type {
  CDNOptimizationConfig,
  EdgeLocation,
  CDNPerformanceMetrics,
  CDNHealthStatus,
  NetworkCondition,
  QualityLevel,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('PlaybackCDNAdapter');

export class PlaybackCDNService extends CDNService {
  // Playback-specific CDN modules
  private cdnOptimizer?: CDNOptimizer;
  private geoDistributionManager?: GeographicDistributionManager;

  // Audio-specific features
  private audioStreamingEnabled = false;
  private adaptiveBitrateEnabled = false;

  constructor(config: CDNOptimizationConfig) {
    super(config);

    // Initialize playback-specific features
    if (config.adaptiveStreamingConfig?.enabled) {
      this.audioStreamingEnabled = true;
      this.adaptiveBitrateEnabled =
        config.adaptiveStreamingConfig.bitrateAdaptation?.enabled || false;
    }
  }

  /**
   * Initialize with playback-specific modules
   */
  async initialize(): Promise<void> {
    await super.initialize();

    try {
      // Initialize playback-specific CDN modules
      this.cdnOptimizer = new CDNOptimizer(this.config);
      await this.cdnOptimizer.initialize();

      this.geoDistributionManager = new GeographicDistributionManager(
        this.config,
      );
      await this.geoDistributionManager.initialize();

      logger.info('Playback CDN service initialized', {
        audioStreamingEnabled: this.audioStreamingEnabled,
        adaptiveBitrateEnabled: this.adaptiveBitrateEnabled,
      });
    } catch (error) {
      logger.error('Failed to initialize playback CDN modules', error);
      throw error;
    }
  }

  /**
   * Get optimal audio endpoint with quality considerations
   */
  async getOptimalAudioEndpoint(
    resourcePath: string,
    quality?: QualityLevel,
    userLocation?: { latitude: number; longitude: number },
  ): Promise<string> {
    const baseEndpoint = await this.getOptimalEndpoint(
      resourcePath,
      userLocation,
    );

    if (!this.audioStreamingEnabled || !quality) {
      return baseEndpoint;
    }

    // Adjust URL for quality level
    const qualityPath = this.getQualityPath(resourcePath, quality);
    return baseEndpoint.replace(resourcePath, qualityPath);
  }

  /**
   * Get path adjusted for quality level
   */
  private getQualityPath(originalPath: string, quality: QualityLevel): string {
    // Extract file extension
    const lastDot = originalPath.lastIndexOf('.');
    if (lastDot === -1) return originalPath;

    const basePath = originalPath.substring(0, lastDot);
    const extension = originalPath.substring(lastDot);

    // Map quality to bitrate suffix
    const qualitySuffix = {
      low: '_64k',
      medium: '_128k',
      high: '_320k',
      lossless: '_flac',
    };

    return `${basePath}${qualitySuffix[quality] || ''}${extension}`;
  }

  /**
   * Warm cache with audio-specific priorities
   */
  async warmAudioCache(
    resources: string[],
    priorities?: Map<string, number>,
  ): Promise<void> {
    logger.info('Warming audio cache', {
      resourceCount: resources.length,
      hasPriorities: !!priorities,
    });

    // Sort resources by priority if provided
    const sortedResources = [...resources];
    if (priorities) {
      sortedResources.sort((a, b) => {
        const priorityA = priorities.get(a) || 0;
        const priorityB = priorities.get(b) || 0;
        return priorityB - priorityA;
      });
    }

    // Warm cache in priority order
    await this.warmCache(sortedResources);
  }

  /**
   * Get audio-optimized network conditions
   */
  getAudioNetworkConditions(): NetworkCondition & {
    recommendedQuality: QualityLevel;
  } {
    const conditions = this.getNetworkConditions();

    // Recommend quality based on bandwidth
    let recommendedQuality: QualityLevel = 'high';

    if (conditions.bandwidth < 0.5) {
      recommendedQuality = 'low';
    } else if (conditions.bandwidth < 1.5) {
      recommendedQuality = 'medium';
    } else if (conditions.bandwidth >= 10) {
      recommendedQuality = 'lossless';
    }

    // Adjust for latency
    if (conditions.latency > 200 && recommendedQuality !== 'low') {
      recommendedQuality = 'medium';
    }

    return {
      ...conditions,
      recommendedQuality,
    };
  }

  /**
   * Get playback-specific performance metrics
   */
  getPlaybackMetrics(): CDNPerformanceMetrics & {
    audioSpecific: {
      bufferUnderruns: number;
      qualitySwitches: number;
      averageBufferHealth: number;
    };
  } {
    const baseMetrics = this.getMetrics();

    // Add audio-specific metrics
    return {
      ...baseMetrics,
      audioSpecific: {
        bufferUnderruns: 0, // Would be tracked by audio engine
        qualitySwitches: 0, // Would be tracked by adaptive streaming
        averageBufferHealth: 1.0, // Would be calculated from buffer states
      },
    };
  }

  /**
   * Get optimization recommendations for audio delivery
   */
  async getAudioOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();
    const conditions = this.getNetworkConditions();

    // Check cache hit rate
    if (metrics.cacheHitRate < 0.7) {
      recommendations.push(
        'Consider pre-warming cache for frequently accessed audio files',
      );
    }

    // Check network conditions
    if (conditions.bandwidth < 1) {
      recommendations.push(
        'Enable adaptive bitrate streaming for better performance on slow connections',
      );
    }

    // Check latency
    if (conditions.latency > 100) {
      recommendations.push(
        'Consider implementing audio pre-buffering for smoother playback',
      );
    }

    // Use CDN optimizer for more recommendations
    if (this.cdnOptimizer) {
      const cdnRecs = await this.cdnOptimizer.getOptimizationRecommendations();
      recommendations.push(...cdnRecs.map((r) => r.description));
    }

    return recommendations;
  }

  /**
   * Dispose playback-specific resources
   */
  async dispose(): Promise<void> {
    if (this.cdnOptimizer) {
      await this.cdnOptimizer.dispose();
    }

    if (this.geoDistributionManager) {
      await this.geoDistributionManager.dispose();
    }

    await super.dispose();
  }
}
