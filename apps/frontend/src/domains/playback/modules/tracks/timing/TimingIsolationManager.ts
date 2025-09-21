/**
 * Timing Isolation Manager
 *
 * Prevents timing errors from cascading across tracks by implementing
 * isolation boundaries and recovery mechanisms. Monitors track health
 * and automatically isolates problematic tracks to maintain overall
 * system stability.
 *
 * Extracted from services/core with all critical functionality preserved.
 */

import type { EventBus } from '../../shared/index.js';
import { TrackTimingSynchronizer } from './TrackTimingSynchronizer.js';
import { createStructuredLogger } from '../../shared/index.js';
import type { CrossTrackSyncReport } from './types.js';

const logger = createStructuredLogger('TimingIsolationManager');

export interface IsolationPolicy {
  maxDriftMs: number;
  maxErrorCount: number;
  minStability: number;
  recoveryAttempts: number;
  recoveryDelayMs: number;
}

export interface IsolatedTrackInfo {
  trackId: string;
  isolatedAt: number;
  reason: string;
  metrics: CrossTrackSyncReport['tracks'][0];
  recoveryAttempts: number;
  canRecover: boolean;
}

export interface IsolationReport {
  totalTracks: number;
  activeTracks: number;
  isolatedTracks: number;
  recoveredTracks: number;
  systemHealth: number; // 0-100%
  isolatedTrackDetails: IsolatedTrackInfo[];
}

export class TimingIsolationManager {
  // Dependencies
  private synchronizer: TrackTimingSynchronizer;
  private eventBus?: EventBus;

  // Isolation tracking
  private isolatedTracks = new Map<string, IsolatedTrackInfo>();
  private recoveredTracks = new Set<string>();

  // Policies
  private defaultPolicy: IsolationPolicy = {
    maxDriftMs: 1.0,
    maxErrorCount: 5,
    minStability: 80,
    recoveryAttempts: 3,
    recoveryDelayMs: 5000,
  };

  private trackPolicies = new Map<string, IsolationPolicy>();

  // Monitoring
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isolationCallbacks = new Map<
    string,
    (info: IsolatedTrackInfo) => void
  >();

  constructor() {
    this.synchronizer = TrackTimingSynchronizer.getInstance();
    this.initialize();
  }

  /**
   * Set event bus for event handling
   */
  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    this.subscribeToEvents();
  }

  /**
   * Initialize isolation manager
   */
  private initialize(): void {
    logger.info('🛡️ Initializing timing isolation manager');
  }

  /**
   * Subscribe to timing events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    this.eventBus.on('timing:driftViolation', (data: any) => {
      this.handleDriftViolation(data);
    });

    this.eventBus.on('timing:trackIsolated', (data: any) => {
      this.handleTrackIsolated(data);
    });

    this.eventBus.on('timing:errorThresholdExceeded', (data: any) => {
      this.handleErrorThreshold(data);
    });

    logger.info('📡 Subscribed to timing events');
  }

  /**
   * Set isolation policy for a specific track
   */
  public setTrackPolicy(
    trackId: string,
    policy: Partial<IsolationPolicy>,
  ): void {
    const currentPolicy = this.trackPolicies.get(trackId) || {
      ...this.defaultPolicy,
    };
    this.trackPolicies.set(trackId, { ...currentPolicy, ...policy });
    logger.info(`📋 Updated policy for track ${trackId}`, { policy });
  }

  /**
   * Start monitoring tracks for isolation conditions
   */
  public startMonitoring(intervalMs = 1000): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkAllTracks();
    }, intervalMs);

    logger.info('🔍 Started track monitoring');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('🛑 Stopped track monitoring');
    }
  }

  /**
   * Check all tracks for isolation conditions
   */
  private checkAllTracks(): void {
    const syncReport = this.synchronizer.getCrossTrackSyncReport();
    if (!syncReport) return;

    for (const trackMetrics of syncReport.tracks) {
      this.evaluateTrackHealth(trackMetrics.trackId, trackMetrics);
    }

    // Emit overall system health
    const report = this.generateIsolationReport();
    this.eventBus?.emit('timing:isolationReport', report);
  }

  /**
   * Evaluate track health and isolate if necessary
   */
  private evaluateTrackHealth(
    trackId: string,
    metrics: CrossTrackSyncReport['tracks'][0],
  ): void {
    const policy = this.trackPolicies.get(trackId) || this.defaultPolicy;

    // Already isolated?
    if (this.isolatedTracks.has(trackId)) {
      this.checkRecovery(trackId);
      return;
    }

    // Check isolation conditions
    const shouldIsolate =
      Math.abs(metrics.avgDrift) > policy.maxDriftMs ||
      metrics.errorRate > policy.maxErrorCount ||
      metrics.stability < policy.minStability;

    if (shouldIsolate) {
      this.isolateTrack(trackId, 'Health check failed', metrics);
    }
  }

  /**
   * Isolate a track
   */
  private isolateTrack(
    trackId: string,
    reason: string,
    metrics: CrossTrackSyncReport['tracks'][0],
  ): void {
    if (this.isolatedTracks.has(trackId)) {
      return;
    }

    const info: IsolatedTrackInfo = {
      trackId,
      isolatedAt: Date.now(),
      reason,
      metrics,
      recoveryAttempts: 0,
      canRecover: true,
    };

    this.isolatedTracks.set(trackId, info);
    this.synchronizer.pauseTrack(trackId);

    logger.warn(`🚨 Isolated track ${trackId}`, { reason, metrics });

    // Emit isolation event
    this.eventBus?.emit('timing:trackIsolated', info);

    // Call isolation callback if registered
    const callback = this.isolationCallbacks.get(trackId);
    if (callback) {
      callback(info);
    }
  }

  /**
   * Attempt to recover an isolated track
   */
  public async recoverTrack(trackId: string): Promise<boolean> {
    const info = this.isolatedTracks.get(trackId);
    if (!info || !info.canRecover) {
      return false;
    }

    const policy = this.trackPolicies.get(trackId) || this.defaultPolicy;
    info.recoveryAttempts++;

    if (info.recoveryAttempts > policy.recoveryAttempts) {
      info.canRecover = false;
      logger.error(`❌ Track ${trackId} exceeded recovery attempts`);
      return false;
    }

    try {
      // Reset track timing
      this.synchronizer.resetTrackErrors(trackId);
      this.synchronizer.resumeTrack(trackId);

      // Wait for stabilization
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if recovery succeeded
      const syncReport = this.synchronizer.getCrossTrackSyncReport();
      const trackMetrics = syncReport?.tracks.find(
        (t) => t.trackId === trackId,
      );

      if (trackMetrics && this.isTrackHealthy(trackMetrics, policy)) {
        this.isolatedTracks.delete(trackId);
        this.recoveredTracks.add(trackId);
        logger.info(`✅ Successfully recovered track ${trackId}`);
        this.eventBus?.emit('timing:trackRecovered', { trackId });
        return true;
      } else {
        // Re-isolate
        this.synchronizer.pauseTrack(trackId);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to recover track ${trackId}`, { error });
      return false;
    }
  }

  /**
   * Check if a track is healthy according to policy
   */
  private isTrackHealthy(
    metrics: CrossTrackSyncReport['tracks'][0],
    policy: IsolationPolicy,
  ): boolean {
    return (
      Math.abs(metrics.avgDrift) <= policy.maxDriftMs &&
      metrics.errorRate <= policy.maxErrorCount &&
      metrics.stability >= policy.minStability
    );
  }

  /**
   * Check recovery for isolated tracks
   */
  private checkRecovery(trackId: string): void {
    const info = this.isolatedTracks.get(trackId);
    if (!info || !info.canRecover) return;

    const policy = this.trackPolicies.get(trackId) || this.defaultPolicy;
    const timeSinceIsolation = Date.now() - info.isolatedAt;

    if (timeSinceIsolation >= policy.recoveryDelayMs) {
      this.recoverTrack(trackId);
    }
  }

  /**
   * Handle drift violation event
   */
  private handleDriftViolation(data: any): void {
    const { trackId, drift } = data;
    const policy = this.trackPolicies.get(trackId) || this.defaultPolicy;

    if (Math.abs(drift) > policy.maxDriftMs) {
      const syncReport = this.synchronizer.getCrossTrackSyncReport();
      const metrics = syncReport?.tracks.find((t) => t.trackId === trackId);
      if (metrics) {
        this.isolateTrack(trackId, `Drift violation: ${drift}ms`, metrics);
      }
    }
  }

  /**
   * Handle track isolated event
   */
  private handleTrackIsolated(data: any): void {
    logger.info('Track isolation event received', { data });
  }

  /**
   * Handle error threshold event
   */
  private handleErrorThreshold(data: any): void {
    const { trackId, errorCount } = data;
    const policy = this.trackPolicies.get(trackId) || this.defaultPolicy;

    if (errorCount >= policy.maxErrorCount) {
      const syncReport = this.synchronizer.getCrossTrackSyncReport();
      const metrics = syncReport?.tracks.find((t) => t.trackId === trackId);
      if (metrics) {
        this.isolateTrack(
          trackId,
          `Error threshold exceeded: ${errorCount}`,
          metrics,
        );
      }
    }
  }

  /**
   * Register isolation callback
   */
  public onTrackIsolated(
    trackId: string,
    callback: (info: IsolatedTrackInfo) => void,
  ): void {
    this.isolationCallbacks.set(trackId, callback);
  }

  /**
   * Remove isolation callback
   */
  public offTrackIsolated(trackId: string): void {
    this.isolationCallbacks.delete(trackId);
  }

  /**
   * Generate isolation report
   */
  public generateIsolationReport(): IsolationReport {
    const syncReport = this.synchronizer.getCrossTrackSyncReport();
    const totalTracks = syncReport?.tracks.length || 0;
    const isolatedTracks = this.isolatedTracks.size;
    const activeTracks = totalTracks - isolatedTracks;
    const recoveredTracks = this.recoveredTracks.size;

    // Calculate system health
    const systemHealth =
      totalTracks > 0 ? (activeTracks / totalTracks) * 100 : 100;

    return {
      totalTracks,
      activeTracks,
      isolatedTracks,
      recoveredTracks,
      systemHealth,
      isolatedTrackDetails: Array.from(this.isolatedTracks.values()),
    };
  }

  /**
   * Clear isolation history
   */
  public clearHistory(): void {
    this.recoveredTracks.clear();
    logger.info('🧹 Cleared isolation history');
  }

  /**
   * Force recover all tracks
   */
  public async forceRecoverAll(): Promise<number> {
    const trackIds = Array.from(this.isolatedTracks.keys());
    let recovered = 0;

    for (const trackId of trackIds) {
      if (await this.recoverTrack(trackId)) {
        recovered++;
      }
    }

    logger.info(
      `🔄 Force recovery completed: ${recovered}/${trackIds.length} tracks`,
    );
    return recovered;
  }

  /**
   * Get isolation info for a track
   */
  public getTrackIsolationInfo(trackId: string): IsolatedTrackInfo | undefined {
    return this.isolatedTracks.get(trackId);
  }

  /**
   * Check if track is isolated
   */
  public isTrackIsolated(trackId: string): boolean {
    return this.isolatedTracks.has(trackId);
  }

  /**
   * Get all isolated track IDs
   */
  public getIsolatedTrackIds(): string[] {
    return Array.from(this.isolatedTracks.keys());
  }

  /**
   * Destroy the manager
   */
  public destroy(): void {
    this.stopMonitoring();
    this.isolationCallbacks.clear();
    this.isolatedTracks.clear();
    this.recoveredTracks.clear();
    this.trackPolicies.clear();
    logger.info('💀 Timing isolation manager destroyed');
  }
}
