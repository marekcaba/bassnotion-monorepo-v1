/**
 * Track Timing Synchronizer
 * 
 * Ensures sample-accurate synchronization across all tracks using the
 * Transport's AudioWorklet master clock. Implements timing isolation
 * to prevent cascade failures and provides per-track drift compensation.
 * 
 * Extracted from MultiTrackTimingSynchronizer with all critical features preserved.
 */

import type { Transport } from '../../../transport/core/Transport';
import type { EventBus } from '../../../../services/core/EventBus';
import type { MusicalPosition } from '../../../transport/types';
import type * as Tone from 'tone';
import { TimingStateManager } from './TimingStateManager';
import { DriftCompensator } from './DriftCompensator';
import { SyncMonitor } from './SyncMonitor';
import type {
  ITrackTimingSynchronizer,
  TrackTimingState,
  CrossTrackSyncReport,
  ScheduledTrackEvent,
  TimingSyncConfig,
  TrackRegistrationOptions,
  EventSchedulingOptions,
  EventPriority,
} from './types';
import { PlaybackError, ErrorSeverity } from '../../../../errors/base';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TrackTimingSynchronizer');

export class TrackTimingSynchronizer implements ITrackTimingSynchronizer {
  private static instance: TrackTimingSynchronizer | null = null;
  
  // Core dependencies
  private transport: Transport | null = null;
  private eventBus: EventBus | null = null;
  private tone: typeof Tone | null = null;
  
  // Configuration
  private config: TimingSyncConfig = {
    driftTolerance: 1.0,          // 1ms tolerance per track
    sampleRate: 48000,            // Assumed sample rate
    driftHistorySize: 10,         // Drift measurements to keep
    errorThreshold: 5,            // Errors before isolation
    syncCheckInterval: 100,       // Sync check every 100ms
  };
  
  // Core components
  private stateManager: TimingStateManager;
  private driftCompensator: DriftCompensator;
  private syncMonitor: SyncMonitor;
  
  // Event scheduling
  private scheduledEvents = new Map<string, ScheduledTrackEvent>();
  
  // Service state
  private isInitialized = false;
  private isRunning = false;
  
  private constructor() {
    this.stateManager = new TimingStateManager(this.config.errorThreshold);
    this.driftCompensator = new DriftCompensator(
      this.config.driftTolerance,
      this.config.driftHistorySize,
      this.config.sampleRate
    );
    this.syncMonitor = new SyncMonitor(
      this.config,
      this.performSyncCheck.bind(this)
    );
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): TrackTimingSynchronizer {
    if (!TrackTimingSynchronizer.instance) {
      TrackTimingSynchronizer.instance = new TrackTimingSynchronizer();
    }
    return TrackTimingSynchronizer.instance;
  }
  
  /**
   * Initialize with dependencies
   */
  async initialize(transport: Transport, eventBus: EventBus): Promise<void> {
    if (this.isInitialized) return;
    
    this.transport = transport;
    this.eventBus = eventBus;
    
    // Subscribe to transport timing updates
    eventBus.on('transport:timing-update', (data) => {
      this.handleTransportTimingUpdate(data);
    });
    
    // Start sync monitoring
    this.syncMonitor.start();
    
    logger.info('🎯 TrackTimingSynchronizer initialized with AudioWorklet master clock');
    this.isInitialized = true;
  }
  
  /**
   * Initialize with Tone.js
   */
  initializeTone(tone: typeof Tone): void {
    this.tone = tone;
  }
  
  /**
   * Register a track for timing synchronization
   */
  registerTrack(trackId: string, options: TrackRegistrationOptions = {}): void {
    this.stateManager.createTrackState(trackId, options);
    
    logger.info(`🎯 Registered track ${trackId} with priority ${options.priority || 50}`);
    
    this.eventBus?.emit('timing:trackRegistered', {
      trackId,
      priority: options.priority || 50,
    });
  }
  
  /**
   * Unregister a track
   */
  unregisterTrack(trackId: string): void {
    this.stateManager.removeTrackState(trackId);
    
    // Remove scheduled events for this track
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
  scheduleTrackEvent(
    trackId: string,
    callback: (time: number) => void,
    musicalPosition: MusicalPosition,
    options: EventSchedulingOptions = {}
  ): string {
    const timingState = this.stateManager.getTrackState(trackId);
    if (!timingState) {
      throw new PlaybackError(
        `Track ${trackId} not registered for timing sync`,
        ErrorSeverity.HIGH,
        'TRACK_NOT_REGISTERED'
      );
    }
    
    if (!timingState.isActive) {
      throw new PlaybackError(
        `Track ${trackId} is isolated due to timing errors`,
        ErrorSeverity.MEDIUM,
        'TRACK_ISOLATED'
      );
    }
    
    // Convert musical position to seconds
    const scheduledTime = this.musicalPositionToSeconds(musicalPosition);
    const audioWorkletTime = this.getCurrentAudioWorkletTime();
    
    // Apply compensation if enabled
    const compensatedTime = options.compensate !== false
      ? this.driftCompensator.applyCompensation(scheduledTime, timingState.compensationOffset)
      : scheduledTime;
    
    // Create scheduled event
    const eventId = options.eventId || `${trackId}-${Date.now()}`;
    const priorityValue = this.mapPriority(options.priority || 'normal');
    
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
  cancelTrackEvent(eventId: string): void {
    this.scheduledEvents.delete(eventId);
  }
  
  /**
   * Get current sync report
   */
  getSyncReport(): CrossTrackSyncReport | null {
    return this.syncMonitor.getLastReport();
  }
  
  /**
   * Get timing state for a track
   */
  getTrackTimingState(trackId: string): TrackTimingState | undefined {
    return this.stateManager.getTrackState(trackId);
  }
  
  /**
   * Validate multi-track synchronization
   */
  validateSync(): boolean {
    return this.syncMonitor.validateSync();
  }
  
  /**
   * Reset error count for a track
   */
  resetTrackErrors(trackId: string): void {
    this.stateManager.resetTrackErrors(trackId);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<TimingSyncConfig>): void {
    Object.assign(this.config, config);
    
    // Update components with new config
    if (config.errorThreshold !== undefined) {
      this.stateManager = new TimingStateManager(this.config.errorThreshold);
    }
    
    if (config.driftTolerance !== undefined || 
        config.driftHistorySize !== undefined ||
        config.sampleRate !== undefined) {
      this.driftCompensator = new DriftCompensator(
        this.config.driftTolerance,
        this.config.driftHistorySize,
        this.config.sampleRate
      );
    }
    
    this.syncMonitor.updateConfig(config);
  }
  
  /**
   * Get configuration
   */
  getConfig(): TimingSyncConfig {
    return { ...this.config };
  }
  
  /**
   * Execute a scheduled track event
   */
  private executeTrackEvent(eventId: string, actualTime: number): void {
    const event = this.scheduledEvents.get(eventId);
    if (!event) return;
    
    const timingState = this.stateManager.getTrackState(event.trackId);
    if (!timingState || !timingState.isActive) return;
    
    // Measure drift
    const drift = this.driftCompensator.measureDrift(event.scheduledTime, actualTime);
    
    // Update timing state
    this.stateManager.updateTimingMeasurements(
      event.trackId,
      actualTime,
      this.getCurrentAudioWorkletTime(),
      drift
    );
    
    // Update drift history
    this.driftCompensator.updateDriftHistory(timingState, drift);
    
    // Check drift tolerance
    if (!this.driftCompensator.isDriftWithinTolerance(drift)) {
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
   * Handle transport timing updates
   */
  private handleTransportTimingUpdate(data: any): void {
    // Update AudioWorklet timing reference for all tracks
    const audioWorkletTime = data.time;
    const trackStates = this.stateManager.getAllTrackStates();
    
    for (const state of trackStates.values()) {
      if (state.isActive) {
        state.lastAudioWorkletTime = audioWorkletTime;
      }
    }
  }
  
  /**
   * Handle drift tolerance violation
   */
  private handleDriftViolation(trackId: string, drift: number): void {
    logger.warn(`⚠️ Track ${trackId} drift violation: ${drift.toFixed(3)}ms`);
    
    this.stateManager.recordError(trackId, `Drift violation: ${drift.toFixed(3)}ms`);
    
    if (this.stateManager.shouldIsolateTrack(trackId)) {
      this.isolateTrack(trackId);
    } else {
      this.applyDriftCompensation(trackId);
    }
    
    this.eventBus?.emit('timing:driftViolation', {
      trackId,
      drift,
      errorCount: this.stateManager.getTrackState(trackId)?.errorCount || 0,
    });
  }
  
  /**
   * Apply drift compensation to a track
   */
  private applyDriftCompensation(trackId: string): void {
    const timingState = this.stateManager.getTrackState(trackId);
    if (!timingState) return;
    
    const compensation = this.driftCompensator.calculateCompensation(timingState);
    this.stateManager.applyCompensation(trackId, compensation);
    
    this.eventBus?.emit('timing:compensationApplied', {
      trackId,
      offset: compensation,
      avgDrift: this.driftCompensator.calculateAverageDrift(timingState.driftHistory),
    });
  }
  
  /**
   * Isolate a track due to timing errors
   */
  private isolateTrack(trackId: string): void {
    this.stateManager.isolateTrack(trackId);
    
    const state = this.stateManager.getTrackState(trackId);
    if (state) {
      this.eventBus?.emit('timing:trackIsolated', {
        trackId,
        errorCount: state.errorCount,
        lastError: state.lastError,
      });
    }
  }
  
  /**
   * Handle track execution error
   */
  private handleTrackError(trackId: string, error: any): void {
    const errorMessage = error?.message || 'Unknown error';
    logger.error(`Track ${trackId} execution error:`, error);
    
    this.stateManager.recordError(trackId, errorMessage);
    
    if (this.stateManager.shouldIsolateTrack(trackId)) {
      this.isolateTrack(trackId);
    }
  }
  
  /**
   * Perform synchronization check
   */
  private performSyncCheck(): void {
    if (!this.transport) return;
    
    const audioWorkletTime = this.getCurrentAudioWorkletTime();
    const trackStates = this.stateManager.getAllTrackStates();
    
    const report = this.syncMonitor.generateSyncReport(trackStates, audioWorkletTime);
    
    this.eventBus?.emit('timing:syncReport', report);
  }
  
  /**
   * Get current AudioWorklet time
   */
  private getCurrentAudioWorkletTime(): number {
    // Get from transport if available
    if (this.transport) {
      const metrics = this.transport.getMetrics();
      return metrics.currentTime;
    }
    
    // Fallback to audio context time
    if (this.tone?.context) {
      return this.tone.context.currentTime;
    }
    
    return 0;
  }
  
  /**
   * Convert musical position to seconds
   */
  private musicalPositionToSeconds(position: MusicalPosition): number {
    if (!this.transport) return 0;
    
    const tempo = this.transport.getTempo();
    const beatDuration = 60 / tempo;
    
    const totalBeats = position.bars * 4 + position.beats + position.sixteenths / 4;
    const totalSeconds = totalBeats * beatDuration;
    
    // Add tick precision (960 PPQ)
    const tickDuration = beatDuration / 960;
    return totalSeconds + position.ticks * tickDuration;
  }
  
  /**
   * Map priority string to numeric value
   */
  private mapPriority(priority: EventPriority): number {
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
   * Dispose of the synchronizer
   */
  dispose(): void {
    this.syncMonitor.stop();
    this.stateManager.clear();
    this.scheduledEvents.clear();
    this.isInitialized = false;
    this.isRunning = false;
    
    TrackTimingSynchronizer.instance = null;
    logger.info('🎯 TrackTimingSynchronizer disposed');
  }
}