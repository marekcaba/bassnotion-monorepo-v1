/**
 * Drift Compensator
 * 
 * Manages drift measurement and compensation for sample-accurate timing.
 * Extracted from MultiTrackTimingSynchronizer.
 */

import type { TrackTimingState } from './types';

export class DriftCompensator {
  private readonly SAMPLES_PER_MS = 48; // 48 samples per millisecond at 48kHz
  
  constructor(
    private readonly driftTolerance: number,
    private readonly driftHistorySize: number,
    private readonly sampleRate: number
  ) {}
  
  /**
   * Measure drift between expected and actual timing
   */
  measureDrift(expectedTime: number, actualTime: number): number {
    return (actualTime - expectedTime) * 1000; // Convert to milliseconds
  }
  
  /**
   * Update drift history for a track
   */
  updateDriftHistory(timingState: TrackTimingState, drift: number): void {
    timingState.driftMeasurement = drift;
    timingState.driftHistory.push(drift);
    
    // Maintain history size
    if (timingState.driftHistory.length > this.driftHistorySize) {
      timingState.driftHistory.shift();
    }
  }
  
  /**
   * Calculate average drift from history
   */
  calculateAverageDrift(driftHistory: number[]): number {
    if (driftHistory.length === 0) return 0;
    return driftHistory.reduce((a, b) => a + b, 0) / driftHistory.length;
  }
  
  /**
   * Calculate drift variance for stability measurement
   */
  calculateDriftVariance(driftHistory: number[]): number {
    if (driftHistory.length === 0) return 0;
    
    const mean = this.calculateAverageDrift(driftHistory);
    const squaredDiffs = driftHistory.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / driftHistory.length);
  }
  
  /**
   * Calculate stability percentage based on drift variance
   */
  calculateStability(driftHistory: number[]): number {
    const variance = this.calculateDriftVariance(driftHistory);
    // 100% stability = no drift variation
    return Math.max(0, 100 - variance * 10);
  }
  
  /**
   * Check if drift is within tolerance
   */
  isDriftWithinTolerance(drift: number): boolean {
    return Math.abs(drift) <= this.driftTolerance;
  }
  
  /**
   * Check if timing is sample-accurate
   */
  isSampleAccurate(drift: number): boolean {
    const driftSamples = Math.abs(drift) * this.SAMPLES_PER_MS;
    return driftSamples < 1;
  }
  
  /**
   * Calculate compensation offset for a track
   */
  calculateCompensation(timingState: TrackTimingState): number {
    if (timingState.driftHistory.length === 0) return 0;
    
    // Use negative of average drift as compensation
    const avgDrift = this.calculateAverageDrift(timingState.driftHistory);
    return -avgDrift;
  }
  
  /**
   * Apply compensation to a scheduled time
   */
  applyCompensation(scheduledTime: number, compensationOffset: number): number {
    return scheduledTime + compensationOffset / 1000; // Convert ms to seconds
  }
  
  /**
   * Convert drift to sample count
   */
  driftToSamples(driftMs: number): number {
    return Math.abs(driftMs) * this.SAMPLES_PER_MS;
  }
  
  /**
   * Get maximum acceptable drift in samples
   */
  getMaxDriftSamples(): number {
    return this.driftTolerance * this.SAMPLES_PER_MS;
  }
  
  /**
   * Analyze drift pattern for anomalies
   */
  analyzeDriftPattern(driftHistory: number[]): {
    hasAnomaly: boolean;
    anomalyType?: 'sudden_jump' | 'increasing_drift' | 'oscillation';
    severity?: number;
  } {
    if (driftHistory.length < 3) {
      return { hasAnomaly: false };
    }
    
    // Check for sudden jumps
    for (let i = 1; i < driftHistory.length; i++) {
      const change = Math.abs(driftHistory[i] - driftHistory[i - 1]);
      if (change > this.driftTolerance * 3) {
        return {
          hasAnomaly: true,
          anomalyType: 'sudden_jump',
          severity: change / this.driftTolerance,
        };
      }
    }
    
    // Check for consistently increasing drift
    let increasingCount = 0;
    for (let i = 1; i < driftHistory.length; i++) {
      if (Math.abs(driftHistory[i]) > Math.abs(driftHistory[i - 1])) {
        increasingCount++;
      }
    }
    
    if (increasingCount > driftHistory.length * 0.7) {
      return {
        hasAnomaly: true,
        anomalyType: 'increasing_drift',
        severity: increasingCount / driftHistory.length,
      };
    }
    
    // Check for oscillation
    let directionChanges = 0;
    for (let i = 2; i < driftHistory.length; i++) {
      const prev = driftHistory[i - 1] - driftHistory[i - 2];
      const curr = driftHistory[i] - driftHistory[i - 1];
      if (prev * curr < 0) { // Sign change indicates direction change
        directionChanges++;
      }
    }
    
    if (directionChanges > driftHistory.length * 0.5) {
      return {
        hasAnomaly: true,
        anomalyType: 'oscillation',
        severity: directionChanges / driftHistory.length,
      };
    }
    
    return { hasAnomaly: false };
  }
}