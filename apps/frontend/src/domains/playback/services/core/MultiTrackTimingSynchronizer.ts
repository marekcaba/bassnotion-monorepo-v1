/**
 * Multi-Track Timing Synchronizer
 *
 * Ensures sample-accurate synchronization across all tracks using the
 * UnifiedTransport's AudioWorklet master clock. Implements timing isolation
 * to prevent cascade failures and provides per-track drift compensation.
 *
 * Part of Story 3.21 Task 5 - Multi-Track Timing Precision
 */

import {
  UnifiedTransport,
  type MusicalPosition,
  type TransportPosition,
  type TimingMetrics,
} from './UnifiedTransport.js';
import { Track } from './Track.js';
import { EventBus } from './EventBus.js';
import {
  Service,
  serviceRegistry,
  type ServiceConfig,
  type HealthCheckResult,
} from './ServiceRegistry.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';
import type * as Tone from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';

export interface TrackTimingState {
  trackId: string;
  lastScheduledTime: number;
  lastAudioWorkletTime: number;
  driftMeasurement: number; // in milliseconds
  driftHistory: number[]; // Last N measurements for averaging
  compensationOffset: number; // Applied compensation in ms
  priority: number;
  isActive: boolean;
  errorCount: number;
  lastError?: string;
}

export interface TrackSyncMetrics {
  trackId: string;
  avgDrift: number;
  maxDrift: number;
  minDrift: number;
  stability: number; // 0-100%
  sampleAccuracy: boolean;
  errorRate: number;
  compensationApplied: number;
}

export interface CrossTrackSyncReport {
  timestamp: number;
  audioWorkletTime: number;
  tracks: TrackSyncMetrics[];
  overallDrift: number;
  maxTrackDrift: number;
  syncHealth: number; // 0-100%
  warnings: string[];
}

interface ScheduledTrackEvent {
  trackId: string;
  eventId: string;
  scheduledTime: number;
  audioWorkletTime: number;
  callback: (time: number) => void;
  priority: number;
}

/**
 * Manages sample-accurate timing synchronization across multiple tracks
 */
export class MultiTrackTimingSynchronizer implements Service {
  // Singleton instance
  private static instance: MultiTrackTimingSynchronizer | null = null;

  // Core dependencies
  private transport: UnifiedTransport;
  private eventBus?: EventBus;
  private tone: typeof Tone | null = null;

  // Track timing state
  private trackTimingStates = new Map<string, TrackTimingState>();
  private scheduledEvents = new Map<string, ScheduledTrackEvent>();

  // Timing configuration
  private readonly DRIFT_TOLERANCE = 1.0; // 1ms tolerance per track
  private readonly SAMPLE_RATE = 48000; // Assumed sample rate
  private readonly SAMPLES_PER_MS = 48; // 48 samples per millisecond
  private readonly DRIFT_HISTORY_SIZE = 10;
  private readonly ERROR_THRESHOLD = 5; // Errors before isolation

  // Performance monitoring
  private lastSyncReport: CrossTrackSyncReport | null = null;
  private syncCheckInterval: number | null = null;

  // Service state
  private isInitialized = false;
  private isRunning = false;

  private constructor() {
    // Don't initialize in constructor - wait for initialize() to be called
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MultiTrackTimingSynchronizer {
    if (!MultiTrackTimingSynchronizer.instance) {
      MultiTrackTimingSynchronizer.instance =
        new MultiTrackTimingSynchronizer();
    }
    return MultiTrackTimingSynchronizer.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (MultiTrackTimingSynchronizer.instance) {
      MultiTrackTimingSynchronizer.instance.dispose();
      MultiTrackTimingSynchronizer.instance = null;
    }
  }

  /**
   * Initialize synchronizer (Service interface)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Get transport instance
    this.transport = UnifiedTransport.getInstance();
    // Get EventBus from various sources
    if (!this.eventBus) {
      // Try service registry first
      try {
        this.eventBus = serviceRegistry.get<EventBus>('eventBus');
      } catch (e) {
        // Try global instance
        if (typeof window !== 'undefined' && (window as any).__globalEventBus) {
          this.eventBus = (window as any).__globalEventBus;
        }
      }
    }

    if (!this.eventBus) {
      throw new PlaybackError(
        'EventBus not available for MultiTrackTimingSynchronizer',
        ErrorSeverity.HIGH,
        'EVENTBUS_NOT_AVAILABLE',
      );
    }

    // Subscribe to transport timing updates via EventBus
    this.eventBus.on(
      'transport:position-updated',
      (data: { position: TransportPosition }) => {
        this.handleTransportPosition(data.position);
      },
    );

    // Start sync monitoring
    this.startSyncMonitoring();

    logger.info(
      '🎯 MultiTrackTimingSynchronizer: Initialized with AudioWorklet master clock',
    );

    this.isInitialized = true;
  }

  /**
   * Start synchronizer (Service interface)
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new PlaybackError(
        'MultiTrackTimingSynchronizer not initialized',
        ErrorSeverity.HIGH,
        'NOT_INITIALIZED',
      );
    }
    this.isRunning = true;
  }

  /**
   * Stop synchronizer (Service interface)
   */
  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Dispose synchronizer (Service interface)
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.stopSyncMonitoring();
    this.trackTimingStates.clear();
    this.scheduledEvents.clear();
    this.isInitialized = false;
    logger.info('🎯 MultiTrackTimingSynchronizer: Disposed');
  }

  /**
   * Health check (Service interface)
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const healthy = this.isInitialized && this.isRunning;
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy
        ? 'MultiTrackTimingSynchronizer is operating normally'
        : 'MultiTrackTimingSynchronizer has issues',
      details: {
        isInitialized: this.isInitialized,
        isRunning: this.isRunning,
        trackedTracks: this.trackTimingStates.size,
        scheduledEvents: this.scheduledEvents.size,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get configuration (Service interface)
   */
  getConfig(): ServiceConfig {
    return {
      driftTolerance: this.DRIFT_TOLERANCE,
      sampleRate: this.SAMPLE_RATE,
      driftHistorySize: this.DRIFT_HISTORY_SIZE,
      errorThreshold: this.ERROR_THRESHOLD,
    };
  }

  /**
   * Initialize with Tone.js
   */
  public initializeTone(tone: typeof Tone): void {
    this.tone = tone;
  }

  /**
   * Register a track for timing synchronization
   */
  public registerTrack(track: Track, priority = 50): void {
    const timingState: TrackTimingState = {
      trackId: track.id,
      lastScheduledTime: 0,
      lastAudioWorkletTime: 0,
      driftMeasurement: 0,
      driftHistory: [],
      compensationOffset: 0,
      priority,
      isActive: true,
      errorCount: 0,
    };

    this.trackTimingStates.set(track.id, timingState);

    logger.info(`🎯 Registered track ${track.id} with priority ${priority}`);

    this.eventBus?.emit('timing:trackRegistered', {
      trackId: track.id,
      priority,
    });
  }

  /**
   * Unregister a track
   */
  public unregisterTrack(trackId: string): void {
    this.trackTimingStates.delete(trackId);

    // Remove any scheduled events for this track
    for (const [eventId, event] of this.scheduledEvents.entries()) {
      if (event.trackId === trackId) {
        this.scheduledEvents.delete(eventId);
      }
    }

    logger.info(`🎯 Unregistered track ${trackId}`);
  }

  /**
   * Schedule an event for a track with sample-accurate timing
   */
  public scheduleTrackEvent(
    trackId: string,
    callback: (time: number) => void,
    musicalPosition: MusicalPosition,
    options?: {
      priority?: 'high' | 'normal' | 'low';
      eventId?: string;
    },
  ): string {
    const timingState = this.trackTimingStates.get(trackId);
    if (!timingState) {
      throw new PlaybackError(
        `Track ${trackId} not registered for timing sync`,
        'TRACK_NOT_REGISTERED',
        ErrorSeverity.HIGH,
      );
    }

    if (!timingState.isActive) {
      throw new PlaybackError(
        `Track ${trackId} is isolated due to timing errors`,
        'TRACK_ISOLATED',
        ErrorSeverity.MEDIUM,
      );
    }

    // Convert musical position to seconds
    const scheduledTime = this.musicalPositionToSeconds(musicalPosition);
    const audioWorkletTime = this.transport.getCurrentTime();

    // Apply track-specific compensation
    const compensatedTime =
      scheduledTime + timingState.compensationOffset / 1000;

    // Create scheduled event
    const eventId = options?.eventId || `${trackId}-${Date.now()}`;
    const priorityValue = this.mapPriority(options?.priority || 'normal');

    const scheduledEvent: ScheduledTrackEvent = {
      trackId,
      eventId,
      scheduledTime: compensatedTime,
      audioWorkletTime,
      callback,
      priority: priorityValue,
    };

    this.scheduledEvents.set(eventId, scheduledEvent);

    // Schedule with Tone.js Transport
    if (this.tone) {
      this.tone.Transport.schedule((time) => {
        this.executeTrackEvent(eventId, time);
      }, compensatedTime);
    }

    return eventId;
  }

  /**
   * Cancel a scheduled event
   */
  public cancelTrackEvent(eventId: string): void {
    this.scheduledEvents.delete(eventId);
  }

  /**
   * Execute a scheduled track event
   */
  private executeTrackEvent(eventId: string, actualTime: number): void {
    const event = this.scheduledEvents.get(eventId);
    if (!event) return;

    const timingState = this.trackTimingStates.get(event.trackId);
    if (!timingState || !timingState.isActive) return;

    // Measure drift
    const expectedTime = event.scheduledTime;
    const drift = (actualTime - expectedTime) * 1000; // Convert to ms

    // Update timing state
    timingState.lastScheduledTime = actualTime;
    timingState.lastAudioWorkletTime = this.transport.getCurrentTime();
    timingState.driftMeasurement = drift;

    // Update drift history
    timingState.driftHistory.push(drift);
    if (timingState.driftHistory.length > this.DRIFT_HISTORY_SIZE) {
      timingState.driftHistory.shift();
    }

    // Check drift tolerance
    if (Math.abs(drift) > this.DRIFT_TOLERANCE) {
      this.handleDriftViolation(event.trackId, drift);
    }

    // Execute callback
    try {
      event.callback(actualTime);
    } catch (error) {
      this.handleTrackError(event.trackId, error);
    }

    // Clean up
    this.scheduledEvents.delete(eventId);
  }

  /**
   * Handle transport position updates
   */
  private handleTransportPosition(position: TransportPosition): void {
    // Update AudioWorklet timing reference for all tracks
    const audioWorkletTime = position.seconds;

    for (const timingState of this.trackTimingStates.values()) {
      if (timingState.isActive) {
        timingState.lastAudioWorkletTime = audioWorkletTime;
      }
    }
  }

  /**
   * Handle drift tolerance violation
   */
  private handleDriftViolation(trackId: string, drift: number): void {
    const timingState = this.trackTimingStates.get(trackId);
    if (!timingState) return;

    logger.warn(`⚠️ Track ${trackId} drift violation: ${drift.toFixed(3)}ms`);

    timingState.errorCount++;
    timingState.lastError = `Drift violation: ${drift.toFixed(3)}ms`;

    // Apply compensation if not too many errors
    if (timingState.errorCount < this.ERROR_THRESHOLD) {
      this.applyDriftCompensation(trackId);
    } else {
      // Isolate track if too many errors
      this.isolateTrack(trackId);
    }

    this.eventBus?.emit('timing:driftViolation', {
      trackId,
      drift,
      errorCount: timingState.errorCount,
    });
  }

  /**
   * Apply drift compensation to a track
   */
  private applyDriftCompensation(trackId: string): void {
    const timingState = this.trackTimingStates.get(trackId);
    if (!timingState || timingState.driftHistory.length === 0) return;

    // Calculate average drift
    const avgDrift =
      timingState.driftHistory.reduce((a, b) => a + b, 0) /
      timingState.driftHistory.length;

    // Apply compensation (negative of average drift)
    timingState.compensationOffset = -avgDrift;

    logger.info(
      `🎯 Applied drift compensation to track ${trackId}: ${timingState.compensationOffset.toFixed(3)}ms`,
    );
  }

  /**
   * Isolate a track due to timing errors
   */
  private isolateTrack(trackId: string): void {
    const timingState = this.trackTimingStates.get(trackId);
    if (!timingState) return;

    timingState.isActive = false;

    logger.error(`❌ Track ${trackId} isolated due to timing errors`);

    this.eventBus?.emit('timing:trackIsolated', {
      trackId,
      errorCount: timingState.errorCount,
      lastError: timingState.lastError,
    });
  }

  /**
   * Handle track execution error
   */
  private handleTrackError(trackId: string, error: any): void {
    const timingState = this.trackTimingStates.get(trackId);
    if (!timingState) return;

    timingState.errorCount++;
    timingState.lastError = error?.message || 'Unknown error';

    logger.error(`Track ${trackId} execution error:`, error);

    if (timingState.errorCount >= this.ERROR_THRESHOLD) {
      this.isolateTrack(trackId);
    }
  }

  /**
   * Stop synchronization monitoring
   */
  private stopSyncMonitoring(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }
  }

  /**
   * Start synchronization monitoring
   */
  private startSyncMonitoring(): void {
    // Monitor every 100ms
    this.syncCheckInterval = window.setInterval(() => {
      this.performSyncCheck();
    }, 100);
  }

  /**
   * Perform synchronization check across all tracks
   */
  private performSyncCheck(): void {
    const audioWorkletTime = this.transport.getCurrentTime();
    const metrics: TrackSyncMetrics[] = [];
    let maxDrift = 0;

    for (const [trackId, timingState] of this.trackTimingStates.entries()) {
      if (!timingState.isActive) continue;

      const metric = this.calculateTrackMetrics(trackId, timingState);
      metrics.push(metric);

      maxDrift = Math.max(maxDrift, Math.abs(metric.avgDrift));
    }

    // Calculate overall sync health
    const syncHealth = this.calculateSyncHealth(metrics);

    // Create sync report
    const report: CrossTrackSyncReport = {
      timestamp: Date.now(),
      audioWorkletTime,
      tracks: metrics,
      overallDrift: this.calculateOverallDrift(metrics),
      maxTrackDrift: maxDrift,
      syncHealth,
      warnings: this.generateWarnings(metrics),
    };

    this.lastSyncReport = report;

    // Emit sync report
    this.eventBus?.emit('timing:syncReport', report);

    // Log warnings if any
    if (report.warnings.length > 0) {
      logger.warn('🎯 Sync warnings:', report.warnings);
    }
  }

  /**
   * Calculate metrics for a track
   */
  private calculateTrackMetrics(
    trackId: string,
    timingState: TrackTimingState,
  ): TrackSyncMetrics {
    const driftHistory = timingState.driftHistory;

    if (driftHistory.length === 0) {
      return {
        trackId,
        avgDrift: 0,
        maxDrift: 0,
        minDrift: 0,
        stability: 100,
        sampleAccuracy: true,
        errorRate: 0,
        compensationApplied: timingState.compensationOffset,
      };
    }

    const avgDrift =
      driftHistory.reduce((a, b) => a + b, 0) / driftHistory.length;
    const maxDrift = Math.max(...driftHistory);
    const minDrift = Math.min(...driftHistory);

    // Calculate stability (100% = no drift variation)
    const driftVariance = this.calculateVariance(driftHistory);
    const stability = Math.max(0, 100 - driftVariance * 10);

    // Check sample accuracy (<1 sample drift)
    const maxDriftSamples = Math.abs(maxDrift) * this.SAMPLES_PER_MS;
    const sampleAccuracy = maxDriftSamples < 1;

    // Calculate error rate
    const errorRate =
      (timingState.errorCount / Math.max(1, driftHistory.length)) * 100;

    return {
      trackId,
      avgDrift,
      maxDrift,
      minDrift,
      stability,
      sampleAccuracy,
      errorRate,
      compensationApplied: timingState.compensationOffset,
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
   * Calculate sync health percentage
   */
  private calculateSyncHealth(metrics: TrackSyncMetrics[]): number {
    if (metrics.length === 0) return 100;

    let healthScore = 100;

    for (const metric of metrics) {
      // Deduct for drift
      healthScore -= Math.abs(metric.avgDrift) * 10;

      // Deduct for instability
      healthScore -= (100 - metric.stability) * 0.5;

      // Deduct for errors
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
      if (Math.abs(metric.avgDrift) > this.DRIFT_TOLERANCE) {
        warnings.push(
          `Track ${metric.trackId} exceeds drift tolerance: ${metric.avgDrift.toFixed(3)}ms`,
        );
      }

      if (metric.stability < 80) {
        warnings.push(
          `Track ${metric.trackId} has unstable timing: ${metric.stability.toFixed(1)}% stability`,
        );
      }

      if (metric.errorRate > 10) {
        warnings.push(
          `Track ${metric.trackId} has high error rate: ${metric.errorRate.toFixed(1)}%`,
        );
      }

      if (!metric.sampleAccuracy) {
        warnings.push(`Track ${metric.trackId} lacks sample-accurate timing`);
      }
    }

    return warnings;
  }

  /**
   * Convert musical position to seconds
   */
  private musicalPositionToSeconds(position: MusicalPosition): number {
    const tempo = this.transport.getTempo();
    const beatDuration = 60 / tempo;

    const totalBeats =
      position.bars * 4 + position.beats + position.sixteenths / 4;
    const totalSeconds = totalBeats * beatDuration;

    // Add tick precision
    const tickDuration = beatDuration / 960; // 960 PPQ
    return totalSeconds + position.ticks * tickDuration;
  }

  /**
   * Map priority string to numeric value
   */
  private mapPriority(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 100;
      case 'normal':
        return 50;
      case 'low':
        return 10;
    }
  }

  /**
   * Calculate variance of drift measurements
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Get current sync report
   */
  public getSyncReport(): CrossTrackSyncReport | null {
    return this.lastSyncReport;
  }

  /**
   * Get timing state for a track
   */
  public getTrackTimingState(trackId: string): TrackTimingState | undefined {
    return this.trackTimingStates.get(trackId);
  }

  /**
   * Reset error count for a track
   */
  public resetTrackErrors(trackId: string): void {
    const timingState = this.trackTimingStates.get(trackId);
    if (timingState) {
      timingState.errorCount = 0;
      timingState.lastError = undefined;
      timingState.isActive = true;

      logger.info(`🎯 Reset errors for track ${trackId}`);
    }
  }

  /**
   * Validate multi-track synchronization
   */
  public validateSync(): boolean {
    if (!this.lastSyncReport) return true;

    // Check overall drift
    if (this.lastSyncReport.overallDrift > this.DRIFT_TOLERANCE) {
      return false;
    }

    // Check individual tracks
    for (const metric of this.lastSyncReport.tracks) {
      if (Math.abs(metric.avgDrift) > this.DRIFT_TOLERANCE) {
        return false;
      }
    }

    return this.lastSyncReport.syncHealth >= 90;
  }
}
