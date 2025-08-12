/**
 * Timing Isolation Manager
 * 
 * Prevents timing errors from cascading across tracks by implementing
 * isolation boundaries and recovery mechanisms. Monitors track health
 * and automatically isolates problematic tracks to maintain overall
 * system stability.
 * 
 * Part of Story 3.21 Task 5 - Multi-Track Timing Precision
 */

import { Track } from './Track.js';
import { EventBus } from './EventBus.js';
import { serviceRegistry } from './ServiceRegistry.js';
import { MultiTrackTimingSynchronizer } from './MultiTrackTimingSynchronizer.js';
import type { TrackTimingState, TrackSyncMetrics } from './MultiTrackTimingSynchronizer.js';

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
  metrics: TrackSyncMetrics;
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

/**
 * Manages timing isolation and recovery for tracks
 */
export class TimingIsolationManager {
  // Dependencies
  private synchronizer: MultiTrackTimingSynchronizer;
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
    recoveryDelayMs: 5000
  };
  
  private trackPolicies = new Map<string, IsolationPolicy>();
  
  // Monitoring
  private monitoringInterval: number | null = null;
  private isolationCallbacks = new Map<string, (info: IsolatedTrackInfo) => void>();
  
  constructor() {
    this.synchronizer = MultiTrackTimingSynchronizer.getInstance();
    
    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      console.warn('EventBus not found in ServiceRegistry');
    }
    
    this.initialize();
  }
  
  /**
   * Initialize isolation manager
   */
  private initialize(): void {
    // Subscribe to timing events
    if (this.eventBus) {
      this.eventBus.on('timing:driftViolation', (data: any) => {
        this.handleDriftViolation(data);
      });
      
      this.eventBus.on('timing:trackIsolated', (data: any) => {
        this.handleTrackIsolation(data);
      });
      
      this.eventBus.on('timing:syncReport', (report: any) => {
        this.evaluateTrackHealth(report);
      });
    }
    
    // Start monitoring
    this.startMonitoring();
    
    console.log('🛡️ TimingIsolationManager: Initialized');
  }
  
  /**
   * Set isolation policy for a track
   */
  public setTrackPolicy(trackId: string, policy: Partial<IsolationPolicy>): void {
    const currentPolicy = this.trackPolicies.get(trackId) || { ...this.defaultPolicy };
    this.trackPolicies.set(trackId, { ...currentPolicy, ...policy });
    
    console.log(`🛡️ Updated isolation policy for track ${trackId}:`, policy);
  }
  
  /**
   * Register isolation callback for a track
   */
  public onTrackIsolated(
    trackId: string, 
    callback: (info: IsolatedTrackInfo) => void
  ): () => void {
    this.isolationCallbacks.set(trackId, callback);
    
    // Return unsubscribe function
    return () => {
      this.isolationCallbacks.delete(trackId);
    };
  }
  
  /**
   * Handle drift violation event
   */
  private handleDriftViolation(data: {
    trackId: string;
    drift: number;
    errorCount: number;
  }): void {
    const policy = this.getTrackPolicy(data.trackId);
    
    // Check if track should be isolated
    if (Math.abs(data.drift) > policy.maxDriftMs ||
        data.errorCount >= policy.maxErrorCount) {
      this.isolateTrack(data.trackId, `Drift violation: ${data.drift.toFixed(3)}ms`);
    }
  }
  
  /**
   * Handle track isolation event
   */
  private handleTrackIsolation(data: {
    trackId: string;
    errorCount: number;
    lastError?: string;
  }): void {
    this.isolateTrack(
      data.trackId, 
      data.lastError || `Error count exceeded: ${data.errorCount}`
    );
  }
  
  /**
   * Evaluate track health from sync report
   */
  private evaluateTrackHealth(report: any): void {
    if (!report.tracks) return;
    
    for (const metric of report.tracks) {
      const policy = this.getTrackPolicy(metric.trackId);
      
      // Check health criteria
      if (metric.stability < policy.minStability ||
          Math.abs(metric.avgDrift) > policy.maxDriftMs ||
          metric.errorRate > 20) {
        
        // Check if already isolated
        if (!this.isolatedTracks.has(metric.trackId)) {
          const reasons: string[] = [];
          
          if (metric.stability < policy.minStability) {
            reasons.push(`Low stability: ${metric.stability.toFixed(1)}%`);
          }
          if (Math.abs(metric.avgDrift) > policy.maxDriftMs) {
            reasons.push(`High drift: ${metric.avgDrift.toFixed(3)}ms`);
          }
          if (metric.errorRate > 20) {
            reasons.push(`High error rate: ${metric.errorRate.toFixed(1)}%`);
          }
          
          this.isolateTrack(metric.trackId, reasons.join(', '));
        }
      }
    }
  }
  
  /**
   * Isolate a track
   */
  private isolateTrack(trackId: string, reason: string): void {
    // Check if already isolated
    if (this.isolatedTracks.has(trackId)) return;
    
    // Get current metrics
    const syncReport = this.synchronizer.getSyncReport();
    const metrics = syncReport?.tracks.find(t => t.trackId === trackId);
    
    const isolationInfo: IsolatedTrackInfo = {
      trackId,
      isolatedAt: Date.now(),
      reason,
      metrics: metrics || {
        trackId,
        avgDrift: 0,
        maxDrift: 0,
        minDrift: 0,
        stability: 0,
        sampleAccuracy: false,
        errorRate: 100,
        compensationApplied: 0
      },
      recoveryAttempts: 0,
      canRecover: true
    };
    
    this.isolatedTracks.set(trackId, isolationInfo);
    
    console.warn(`🛡️ Isolated track ${trackId}: ${reason}`);
    
    // Notify callback if registered
    const callback = this.isolationCallbacks.get(trackId);
    if (callback) {
      callback(isolationInfo);
    }
    
    // Emit isolation event
    this.eventBus?.emit('isolation:trackIsolated', isolationInfo);
    
    // Schedule recovery attempt
    this.scheduleRecovery(trackId);
  }
  
  /**
   * Schedule recovery attempt for isolated track
   */
  private scheduleRecovery(trackId: string): void {
    const isolationInfo = this.isolatedTracks.get(trackId);
    if (!isolationInfo || !isolationInfo.canRecover) return;
    
    const policy = this.getTrackPolicy(trackId);
    
    setTimeout(() => {
      this.attemptRecovery(trackId);
    }, policy.recoveryDelayMs);
  }
  
  /**
   * Attempt to recover an isolated track
   */
  private attemptRecovery(trackId: string): void {
    const isolationInfo = this.isolatedTracks.get(trackId);
    if (!isolationInfo) return;
    
    const policy = this.getTrackPolicy(trackId);
    isolationInfo.recoveryAttempts++;
    
    console.log(`🛡️ Attempting recovery for track ${trackId} (attempt ${isolationInfo.recoveryAttempts})`);
    
    // Reset track errors
    this.synchronizer.resetTrackErrors(trackId);
    
    // Monitor recovery
    const recoveryCheckTimeout = setTimeout(() => {
      const timingState = this.synchronizer.getTrackTimingState(trackId);
      
      if (timingState && timingState.isActive && timingState.errorCount === 0) {
        // Recovery successful
        this.isolatedTracks.delete(trackId);
        this.recoveredTracks.add(trackId);
        
        console.log(`✅ Track ${trackId} recovered successfully`);
        
        this.eventBus?.emit('isolation:trackRecovered', {
          trackId,
          attempts: isolationInfo.recoveryAttempts
        });
      } else {
        // Recovery failed
        if (isolationInfo.recoveryAttempts >= policy.recoveryAttempts) {
          isolationInfo.canRecover = false;
          console.error(`❌ Track ${trackId} recovery failed after ${isolationInfo.recoveryAttempts} attempts`);
          
          this.eventBus?.emit('isolation:trackRecoveryFailed', {
            trackId,
            attempts: isolationInfo.recoveryAttempts
          });
        } else {
          // Schedule another recovery attempt
          this.scheduleRecovery(trackId);
        }
      }
    }, 2000); // Check after 2 seconds
  }
  
  /**
   * Manually recover a track
   */
  public recoverTrack(trackId: string): boolean {
    const isolationInfo = this.isolatedTracks.get(trackId);
    if (!isolationInfo) return false;
    
    // Reset and attempt recovery
    isolationInfo.recoveryAttempts = 0;
    isolationInfo.canRecover = true;
    
    this.synchronizer.resetTrackErrors(trackId);
    this.isolatedTracks.delete(trackId);
    this.recoveredTracks.add(trackId);
    
    console.log(`🛡️ Manually recovered track ${trackId}`);
    
    return true;
  }
  
  /**
   * Get track policy
   */
  private getTrackPolicy(trackId: string): IsolationPolicy {
    return this.trackPolicies.get(trackId) || this.defaultPolicy;
  }
  
  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Monitor every 5 seconds
    this.monitoringInterval = window.setInterval(() => {
      this.checkIsolatedTracks();
    }, 5000);
  }
  
  /**
   * Check isolated tracks for recovery
   */
  private checkIsolatedTracks(): void {
    for (const [trackId, info] of this.isolatedTracks.entries()) {
      if (!info.canRecover) continue;
      
      const timeSinceIsolation = Date.now() - info.isolatedAt;
      const policy = this.getTrackPolicy(trackId);
      
      // Check if enough time has passed for next recovery attempt
      if (timeSinceIsolation > policy.recoveryDelayMs * (info.recoveryAttempts + 1)) {
        this.attemptRecovery(trackId);
      }
    }
  }
  
  /**
   * Get isolation report
   */
  public getIsolationReport(): IsolationReport {
    const syncReport = this.synchronizer.getSyncReport();
    const totalTracks = syncReport?.tracks.length || 0;
    const isolatedCount = this.isolatedTracks.size;
    const activeTracks = totalTracks - isolatedCount;
    
    return {
      totalTracks,
      activeTracks,
      isolatedTracks: isolatedCount,
      recoveredTracks: this.recoveredTracks.size,
      systemHealth: syncReport?.syncHealth || 100,
      isolatedTrackDetails: Array.from(this.isolatedTracks.values())
    };
  }
  
  /**
   * Check if track is isolated
   */
  public isTrackIsolated(trackId: string): boolean {
    return this.isolatedTracks.has(trackId);
  }
  
  /**
   * Force isolate a track
   */
  public forceIsolateTrack(trackId: string, reason: string): void {
    this.isolateTrack(trackId, `Forced: ${reason}`);
  }
  
  /**
   * Clear all isolations
   */
  public clearAllIsolations(): void {
    for (const trackId of this.isolatedTracks.keys()) {
      this.recoverTrack(trackId);
    }
    
    console.log('🛡️ Cleared all track isolations');
  }
  
  /**
   * Dispose manager
   */
  public dispose(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isolatedTracks.clear();
    this.recoveredTracks.clear();
    this.isolationCallbacks.clear();
    
    console.log('🛡️ TimingIsolationManager: Disposed');
  }
}