/**
 * Monitoring Adapter for Playback Domain
 *
 * Combines shared monitoring infrastructure with playback-specific monitoring
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import {
  MonitoringService,
  type IMonitoringService,
  type MonitoringConfig,
  type HealthCheck,
  type MetricCollector,
} from '@/shared/infrastructure/storage/index.js';
import type {
  StoragePerformanceMetrics,
  DetailedHealthStatus,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('PlaybackMonitoringAdapter');

export class PlaybackMonitoringService extends MonitoringService {
  private audioHealthChecks: Map<string, HealthCheck> = new Map();
  private audioMetrics: Map<string, number> = new Map();

  constructor(config: MonitoringConfig) {
    super(config);
    this.registerPlaybackHealthChecks();
    this.registerPlaybackMetrics();
  }

  /**
   * Register playback-specific health checks
   */
  private registerPlaybackHealthChecks(): void {
    // Audio context health check
    this.registerHealthCheck({
      name: 'audio_context',
      check: async () => {
        try {
          if (typeof window === 'undefined') return true; // Skip in SSR

          const audioContext = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
          const isHealthy = audioContext.state !== 'suspended';
          audioContext.close();
          return isHealthy;
        } catch {
          return false;
        }
      },
      critical: true,
    });

    // Sample cache health check
    this.registerHealthCheck({
      name: 'sample_cache',
      check: async () => {
        // Check if sample cache is responsive
        // This would integrate with actual cache implementation
        return true;
      },
      critical: false,
    });

    // Audio buffer health check
    this.registerHealthCheck({
      name: 'audio_buffers',
      check: async () => {
        // Check audio buffer availability
        // This would integrate with buffer management
        return true;
      },
      critical: false,
    });

    logger.info('Playback health checks registered');
  }

  /**
   * Register playback-specific metrics collectors
   */
  private registerPlaybackMetrics(): void {
    // Audio latency collector
    this.registerMetricCollector({
      name: 'audio_latency',
      collect: async () => {
        // Get current audio latency
        // This would integrate with audio engine
        return this.audioMetrics.get('latency') || 0;
      },
      unit: 'ms',
      tags: { domain: 'playback', type: 'latency' },
    });

    // Buffer underrun collector
    this.registerMetricCollector({
      name: 'buffer_underruns',
      collect: async () => {
        return this.audioMetrics.get('underruns') || 0;
      },
      unit: 'count',
      tags: { domain: 'playback', type: 'quality' },
    });

    // Sample cache hit rate
    this.registerMetricCollector({
      name: 'sample_cache_hit_rate',
      collect: async () => {
        return this.audioMetrics.get('cache_hit_rate') || 0;
      },
      unit: 'percentage',
      tags: { domain: 'playback', type: 'performance' },
    });

    logger.info('Playback metrics collectors registered');
  }

  /**
   * Record audio-specific metric
   */
  recordAudioMetric(name: string, value: number): void {
    this.audioMetrics.set(name, value);
    this.recordMetric(`audio_${name}`, value, { domain: 'playback' });
  }

  /**
   * Get playback-enhanced health status
   */
  getPlaybackHealthStatus(): DetailedHealthStatus & {
    audioSpecific: {
      audioContextHealthy: boolean;
      cacheHealthy: boolean;
      buffersHealthy: boolean;
    };
  } {
    const health = this.getHealthStatus();

    return {
      ...health,
      audioSpecific: {
        audioContextHealthy:
          health.components.get('audio_context')?.status === 'healthy',
        cacheHealthy:
          health.components.get('sample_cache')?.status === 'healthy',
        buffersHealthy:
          health.components.get('audio_buffers')?.status === 'healthy',
      },
    };
  }

  /**
   * Get playback-enhanced performance metrics
   */
  getPlaybackMetrics(): StoragePerformanceMetrics & {
    audioSpecific: {
      latency: number;
      underruns: number;
      cacheHitRate: number;
      audioQuality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  } {
    const metrics = this.getPerformanceMetrics();

    const latency = this.audioMetrics.get('latency') || 0;
    const underruns = this.audioMetrics.get('underruns') || 0;
    const cacheHitRate = this.audioMetrics.get('cache_hit_rate') || 0;

    // Calculate audio quality based on metrics
    let audioQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';

    if (underruns > 10 || latency > 100) {
      audioQuality = 'poor';
    } else if (underruns > 5 || latency > 50) {
      audioQuality = 'fair';
    } else if (underruns > 0 || latency > 20) {
      audioQuality = 'good';
    }

    return {
      ...metrics,
      audioSpecific: {
        latency,
        underruns,
        cacheHitRate,
        audioQuality,
      },
    };
  }

  /**
   * Record playback event
   */
  recordPlaybackEvent(
    eventType: string,
    data: Record<string, any>,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
  ): void {
    this.recordEvent({
      type: `playback_${eventType}`,
      timestamp: new Date(),
      data: {
        ...data,
        domain: 'playback',
      },
      severity,
    });
  }

  /**
   * Check audio system health
   */
  async checkAudioSystemHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const health = await this.getHealthStatus();
    const issues: string[] = [];

    // Check audio context
    const audioContextHealth = health.components.get('audio_context');
    if (audioContextHealth?.status !== 'healthy') {
      issues.push('Audio context is not healthy');
    }

    // Check cache
    const cacheHealth = health.components.get('sample_cache');
    if (cacheHealth?.status === 'unhealthy') {
      issues.push('Sample cache is unhealthy');
    }

    // Check performance metrics
    const metrics = this.getPlaybackMetrics();
    if (metrics.audioSpecific.audioQuality === 'poor') {
      issues.push('Audio quality is poor');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
