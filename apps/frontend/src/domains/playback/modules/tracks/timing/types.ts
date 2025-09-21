/**
 * Track Timing Synchronization Types
 *
 * Provides sample-accurate synchronization across multiple tracks
 * using AudioWorklet master clock with drift compensation.
 */

import type { MusicalPosition } from '../../transport/types';

/**
 * Timing state for an individual track
 */
export interface TrackTimingState {
  trackId: string;
  lastScheduledTime: number; // Last scheduled event time in seconds
  lastAudioWorkletTime: number; // Last AudioWorklet time reference
  driftMeasurement: number; // Current drift in milliseconds
  driftHistory: number[]; // History of drift measurements for averaging
  compensationOffset: number; // Applied compensation in milliseconds
  priority: number; // Scheduling priority (0-100)
  isActive: boolean; // Whether track is active (not isolated)
  errorCount: number; // Number of timing errors
  lastError?: string; // Last error message
}

/**
 * Metrics for a single track's timing performance
 */
export interface TrackSyncMetrics {
  trackId: string;
  avgDrift: number; // Average drift in milliseconds
  maxDrift: number; // Maximum drift in milliseconds
  minDrift: number; // Minimum drift in milliseconds
  stability: number; // Stability percentage (0-100%)
  sampleAccuracy: boolean; // Whether timing is sample-accurate
  errorRate: number; // Error rate percentage
  compensationApplied: number; // Current compensation offset
}

/**
 * Cross-track synchronization report
 */
export interface CrossTrackSyncReport {
  timestamp: number; // Report generation time
  audioWorkletTime: number; // Current AudioWorklet time
  tracks: TrackSyncMetrics[]; // Individual track metrics
  overallDrift: number; // Average drift across all tracks
  maxTrackDrift: number; // Maximum drift of any track
  syncHealth: number; // Overall sync health (0-100%)
  warnings: string[]; // Generated warnings
}

/**
 * Scheduled track event
 */
export interface ScheduledTrackEvent {
  trackId: string;
  eventId: string;
  scheduledTime: number; // Scheduled time in seconds
  audioWorkletTime: number; // AudioWorklet time when scheduled
  callback: (time: number) => void; // Callback to execute
  priority: number; // Event priority
}

/**
 * Timing synchronizer configuration
 */
export interface TimingSyncConfig {
  driftTolerance: number; // Maximum acceptable drift in ms (default: 1.0)
  sampleRate: number; // Audio sample rate (default: 48000)
  driftHistorySize: number; // Number of drift measurements to keep (default: 10)
  errorThreshold: number; // Errors before track isolation (default: 5)
  syncCheckInterval: number; // Sync check interval in ms (default: 100)
}

/**
 * Event priority levels
 */
export type EventPriority = 'high' | 'normal' | 'low';

/**
 * Track registration options
 */
export interface TrackRegistrationOptions {
  priority?: number; // Track priority (0-100, default: 50)
  compensationOffset?: number; // Initial compensation offset in ms
}

/**
 * Event scheduling options
 */
export interface EventSchedulingOptions {
  priority?: EventPriority; // Event priority level
  eventId?: string; // Custom event ID
  compensate?: boolean; // Apply drift compensation (default: true)
}

/**
 * Timing synchronizer interface
 */
export interface ITrackTimingSynchronizer {
  // Track management
  registerTrack(trackId: string, options?: TrackRegistrationOptions): void;
  unregisterTrack(trackId: string): void;

  // Event scheduling
  scheduleTrackEvent(
    trackId: string,
    callback: (time: number) => void,
    musicalPosition: MusicalPosition,
    options?: EventSchedulingOptions,
  ): string;

  cancelTrackEvent(eventId: string): void;

  // Monitoring
  getSyncReport(): CrossTrackSyncReport | null;
  getTrackTimingState(trackId: string): TrackTimingState | undefined;
  validateSync(): boolean;

  // Error handling
  resetTrackErrors(trackId: string): void;

  // Configuration
  updateConfig(config: Partial<TimingSyncConfig>): void;
  getConfig(): TimingSyncConfig;
}

/**
 * Timing events emitted via EventBus
 */
export interface TimingEvents {
  'timing:trackRegistered': {
    trackId: string;
    priority: number;
  };

  'timing:driftViolation': {
    trackId: string;
    drift: number;
    errorCount: number;
  };

  'timing:trackIsolated': {
    trackId: string;
    errorCount: number;
    lastError?: string;
  };

  'timing:syncReport': CrossTrackSyncReport;

  'timing:compensationApplied': {
    trackId: string;
    offset: number;
    avgDrift: number;
  };
}
