/**
 * Timing State Manager
 * 
 * Manages timing state for individual tracks including error tracking
 * and isolation logic.
 */

import type { TrackTimingState, TrackRegistrationOptions } from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TimingStateManager');

export class TimingStateManager {
  private trackStates = new Map<string, TrackTimingState>();
  
  constructor(
    private readonly errorThreshold: number,
    private readonly defaultPriority: number = 50
  ) {}
  
  /**
   * Create initial timing state for a track
   */
  createTrackState(
    trackId: string,
    options: TrackRegistrationOptions = {}
  ): TrackTimingState {
    const state: TrackTimingState = {
      trackId,
      lastScheduledTime: 0,
      lastAudioWorkletTime: 0,
      driftMeasurement: 0,
      driftHistory: [],
      compensationOffset: options.compensationOffset || 0,
      priority: options.priority ?? this.defaultPriority,
      isActive: true,
      errorCount: 0,
    };
    
    this.trackStates.set(trackId, state);
    return state;
  }
  
  /**
   * Get timing state for a track
   */
  getTrackState(trackId: string): TrackTimingState | undefined {
    return this.trackStates.get(trackId);
  }
  
  /**
   * Remove timing state for a track
   */
  removeTrackState(trackId: string): void {
    this.trackStates.delete(trackId);
  }
  
  /**
   * Get all track states
   */
  getAllTrackStates(): Map<string, TrackTimingState> {
    return new Map(this.trackStates);
  }
  
  /**
   * Get active tracks only
   */
  getActiveTrackStates(): TrackTimingState[] {
    return Array.from(this.trackStates.values()).filter(state => state.isActive);
  }
  
  /**
   * Update timing measurements for a track
   */
  updateTimingMeasurements(
    trackId: string,
    scheduledTime: number,
    audioWorkletTime: number,
    drift: number
  ): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.lastScheduledTime = scheduledTime;
    state.lastAudioWorkletTime = audioWorkletTime;
    state.driftMeasurement = drift;
  }
  
  /**
   * Apply compensation offset to a track
   */
  applyCompensation(trackId: string, offset: number): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.compensationOffset = offset;
    logger.info(
      `Applied compensation to track ${trackId}: ${offset.toFixed(3)}ms`
    );
  }
  
  /**
   * Record an error for a track
   */
  recordError(trackId: string, error: string): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.errorCount++;
    state.lastError = error;
    
    logger.warn(`Track ${trackId} error #${state.errorCount}: ${error}`);
  }
  
  /**
   * Check if track should be isolated
   */
  shouldIsolateTrack(trackId: string): boolean {
    const state = this.trackStates.get(trackId);
    if (!state) return false;
    
    return state.errorCount >= this.errorThreshold;
  }
  
  /**
   * Isolate a track due to errors
   */
  isolateTrack(trackId: string): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.isActive = false;
    logger.error(
      `Track ${trackId} isolated after ${state.errorCount} errors. ` +
      `Last error: ${state.lastError}`
    );
  }
  
  /**
   * Reset errors for a track
   */
  resetTrackErrors(trackId: string): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.errorCount = 0;
    state.lastError = undefined;
    state.isActive = true;
    
    logger.info(`Reset errors for track ${trackId}`);
  }
  
  /**
   * Update track priority
   */
  updateTrackPriority(trackId: string, priority: number): void {
    const state = this.trackStates.get(trackId);
    if (!state) return;
    
    state.priority = Math.max(0, Math.min(100, priority));
  }
  
  /**
   * Get tracks sorted by priority
   */
  getTracksByPriority(): TrackTimingState[] {
    return Array.from(this.trackStates.values())
      .sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Check track health
   */
  isTrackHealthy(trackId: string): boolean {
    const state = this.trackStates.get(trackId);
    if (!state) return false;
    
    return state.isActive && state.errorCount === 0;
  }
  
  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    isolatedTracks: number;
    errorsByTrack: Map<string, number>;
  } {
    let totalErrors = 0;
    let isolatedTracks = 0;
    const errorsByTrack = new Map<string, number>();
    
    for (const [trackId, state] of this.trackStates) {
      totalErrors += state.errorCount;
      if (!state.isActive) isolatedTracks++;
      if (state.errorCount > 0) {
        errorsByTrack.set(trackId, state.errorCount);
      }
    }
    
    return { totalErrors, isolatedTracks, errorsByTrack };
  }
  
  /**
   * Clear all timing states
   */
  clear(): void {
    this.trackStates.clear();
  }
}