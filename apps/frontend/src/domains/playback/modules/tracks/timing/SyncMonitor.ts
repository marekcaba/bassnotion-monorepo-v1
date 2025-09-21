/**
 * Sync Monitor
 *
 * Monitors synchronization health across all tracks and generates reports.
 */

import type {
  TrackTimingState,
  TrackSyncMetrics,
  CrossTrackSyncReport,
  TimingSyncConfig,
} from './types';
import { DriftCompensator } from './DriftCompensator.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('SyncMonitor');

export class SyncMonitor {
  private lastSyncReport: CrossTrackSyncReport | null = null;
  private syncCheckInterval: number | null = null;
  private driftCompensator: DriftCompensator;

  constructor(
    private readonly config: TimingSyncConfig,
    private readonly onSyncCheck: () => void,
  ) {
    this.driftCompensator = new DriftCompensator(
      config.driftTolerance,
      config.driftHistorySize,
      config.sampleRate,
    );
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.syncCheckInterval) return;

    this.syncCheckInterval = window.setInterval(() => {
      this.onSyncCheck();
    }, this.config.syncCheckInterval);

    logger.info('Sync monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }

    logger.info('Sync monitoring stopped');
  }

  /**
   * Generate sync report
   */
  generateSyncReport(
    trackStates: Map<string, TrackTimingState>,
    audioWorkletTime: number,
  ): CrossTrackSyncReport {
    const metrics: TrackSyncMetrics[] = [];
    let maxDrift = 0;

    // Calculate metrics for each active track
    for (const [trackId, state] of trackStates.entries()) {
      if (!state.isActive) continue;

      const metric = this.calculateTrackMetrics(trackId, state);
      metrics.push(metric);

      maxDrift = Math.max(maxDrift, Math.abs(metric.avgDrift));
    }

    // Generate report
    const report: CrossTrackSyncReport = {
      timestamp: Date.now(),
      audioWorkletTime,
      tracks: metrics,
      overallDrift: this.calculateOverallDrift(metrics),
      maxTrackDrift: maxDrift,
      syncHealth: this.calculateSyncHealth(metrics),
      warnings: this.generateWarnings(metrics),
    };

    this.lastSyncReport = report;

    // Log warnings if any
    if (report.warnings.length > 0) {
      logger.warn('Sync warnings:', { warnings: report.warnings });
    }

    return report;
  }

  /**
   * Calculate metrics for a single track
   */
  private calculateTrackMetrics(
    trackId: string,
    state: TrackTimingState,
  ): TrackSyncMetrics {
    const { driftHistory } = state;

    if (driftHistory.length === 0) {
      return {
        trackId,
        avgDrift: 0,
        maxDrift: 0,
        minDrift: 0,
        stability: 100,
        sampleAccuracy: true,
        errorRate: 0,
        compensationApplied: state.compensationOffset,
      };
    }

    const avgDrift = this.driftCompensator.calculateAverageDrift(driftHistory);
    const maxDrift = Math.max(...driftHistory);
    const minDrift = Math.min(...driftHistory);
    const stability = this.driftCompensator.calculateStability(driftHistory);
    const sampleAccuracy = this.driftCompensator.isSampleAccurate(maxDrift);

    // Calculate error rate
    const errorRate =
      (state.errorCount / Math.max(1, driftHistory.length)) * 100;

    return {
      trackId,
      avgDrift,
      maxDrift,
      minDrift,
      stability,
      sampleAccuracy,
      errorRate,
      compensationApplied: state.compensationOffset,
    };
  }

  /**
   * Calculate overall drift across all tracks
   */
  private calculateOverallDrift(metrics: TrackSyncMetrics[]): number {
    if (metrics.length === 0) return 0;

    const totalDrift = metrics.reduce(
      (sum, m) => sum + Math.abs(m.avgDrift),
      0,
    );
    return totalDrift / metrics.length;
  }

  /**
   * Calculate overall sync health (0-100%)
   */
  private calculateSyncHealth(metrics: TrackSyncMetrics[]): number {
    if (metrics.length === 0) return 100;

    let healthScore = 100;

    for (const metric of metrics) {
      // Deduct points for drift
      healthScore -= Math.abs(metric.avgDrift) * 10;

      // Deduct points for instability
      healthScore -= (100 - metric.stability) * 0.5;

      // Deduct points for errors
      healthScore -= metric.errorRate * 2;

      // Bonus for sample accuracy
      if (metric.sampleAccuracy) {
        healthScore += 5;
      }
    }

    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * Generate warnings based on metrics
   */
  private generateWarnings(metrics: TrackSyncMetrics[]): string[] {
    const warnings: string[] = [];

    for (const metric of metrics) {
      // Check drift tolerance
      if (Math.abs(metric.avgDrift) > this.config.driftTolerance) {
        warnings.push(
          `Track ${metric.trackId} exceeds drift tolerance: ${metric.avgDrift.toFixed(3)}ms`,
        );
      }

      // Check stability
      if (metric.stability < 80) {
        warnings.push(
          `Track ${metric.trackId} has unstable timing: ${metric.stability.toFixed(1)}% stability`,
        );
      }

      // Check error rate
      if (metric.errorRate > 10) {
        warnings.push(
          `Track ${metric.trackId} has high error rate: ${metric.errorRate.toFixed(1)}%`,
        );
      }

      // Check sample accuracy
      if (!metric.sampleAccuracy) {
        warnings.push(`Track ${metric.trackId} lacks sample-accurate timing`);
      }
    }

    return warnings;
  }

  /**
   * Get last sync report
   */
  getLastReport(): CrossTrackSyncReport | null {
    return this.lastSyncReport;
  }

  /**
   * Validate synchronization
   */
  validateSync(): boolean {
    if (!this.lastSyncReport) return true;

    // Check overall drift
    if (this.lastSyncReport.overallDrift > this.config.driftTolerance) {
      return false;
    }

    // Check individual tracks
    for (const metric of this.lastSyncReport.tracks) {
      if (Math.abs(metric.avgDrift) > this.config.driftTolerance) {
        return false;
      }
    }

    // Check sync health
    return this.lastSyncReport.syncHealth >= 90;
  }

  /**
   * Get sync quality rating
   */
  getSyncQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (!this.lastSyncReport) return 'excellent';

    const health = this.lastSyncReport.syncHealth;

    if (health >= 95) return 'excellent';
    if (health >= 85) return 'good';
    if (health >= 70) return 'fair';
    return 'poor';
  }

  /**
   * Check if any track needs attention
   */
  getTracksNeedingAttention(): string[] {
    if (!this.lastSyncReport) return [];

    return this.lastSyncReport.tracks
      .filter(
        (metric) =>
          Math.abs(metric.avgDrift) > this.config.driftTolerance ||
          metric.stability < 80 ||
          metric.errorRate > 10 ||
          !metric.sampleAccuracy,
      )
      .map((metric) => metric.trackId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimingSyncConfig>): void {
    Object.assign(this.config, config);

    // Recreate drift compensator with new config
    this.driftCompensator = new DriftCompensator(
      this.config.driftTolerance,
      this.config.driftHistorySize,
      this.config.sampleRate,
    );

    // Restart monitoring if interval changed
    if (config.syncCheckInterval !== undefined && this.syncCheckInterval) {
      this.stop();
      this.start();
    }
  }
}
