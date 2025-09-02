/**
 * Pattern Scheduling Types
 * 
 * Professional DAW-style pattern scheduling with region-based playback,
 * lookahead scheduling, and sample-accurate timing.
 */

import type { MusicalPosition } from '../types';
import type { Region, MidiEvent } from '../../../types/region';
import type { Pattern } from '../../../types/pattern';

/**
 * Schedulable event interface
 */
export interface SchedulableEvent {
  time: MusicalPosition;
  callback: (time: number) => void;
  priority: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

/**
 * Scheduled region state
 */
export interface ScheduledRegion {
  region: Region;
  trackId: string;
  nextEventIndex: number;           // Next event to schedule
  events: SchedulableEvent[];       // All events in this region
  lastScheduledTime: number;        // Last time we scheduled events
  currentLoop: number;              // Current loop iteration (0-based)
  loopStartTime: number;            // Absolute time when current loop started
}

/**
 * Pattern scheduler configuration
 */
export interface PatternSchedulerConfig {
  lookaheadTime: number;            // Lookahead window in seconds (default: 0.2)
  scheduleInterval: number;         // How often to check for events (default: 0.00267)
  timingPrecision: number;          // Timing precision in seconds (default: 0.001)
  maxEventsPerCycle: number;        // Max events to process per cycle (default: 50)
  binarySearchThreshold: number;    // Event count to trigger binary search (default: 100)
}

/**
 * Performance metrics for pattern scheduling
 */
export interface PatternSchedulingMetrics {
  scheduledEvents: number;          // Total events scheduled
  missedEvents: number;             // Events that were late
  avgLatency: number;               // Average scheduling latency in ms
  cpuUsage: number;                 // Estimated CPU usage percentage
  activeRegions: number;            // Currently active regions
  totalTracks: number;              // Total tracks with regions
}

/**
 * Musical time calculation options
 */
export interface MusicalTimeOptions {
  tempo: number;                    // BPM
  timeSignature: {                  // Time signature
    numerator: number;
    denominator: number;
  };
  ppq?: number;                     // Pulses per quarter note (default: 960)
}

/**
 * Loop iteration data
 */
export interface LoopIteration {
  index: number;                    // Loop iteration index (0-based)
  startTime: number;                // Start time of this iteration in seconds
  endTime: number;                  // End time of this iteration in seconds
  isActive: boolean;                // Whether this iteration is currently playing
}

/**
 * Region activation state
 */
export interface RegionActivationState {
  regionKey: string;                // Unique region identifier
  isActive: boolean;                // Whether region is currently active
  activationTime: number;           // When region was activated
  lastEventTime: number;            // Last event scheduling time
  completedLoops: number;           // Number of completed loops
}

/**
 * Event scheduling result
 */
export interface EventSchedulingResult {
  eventId: string;                  // Unique event identifier
  scheduledTime: number;            // When event was scheduled (audio time)
  actualTime: number;               // When event should execute (audio time)
  latency: number;                  // Scheduling latency in ms
  success: boolean;                 // Whether scheduling succeeded
  error?: string;                   // Error message if failed
}

/**
 * Pattern scheduler interface
 */
export interface IPatternScheduler {
  // Track management
  registerTrack(trackId: string, regions: Region[]): void;
  unregisterTrack(trackId: string): void;
  
  // Region management
  updateTrackRegions(trackId: string, regions: Region[]): void;
  getActiveRegions(): Map<string, ScheduledRegion>;
  
  // Metrics
  getMetrics(): PatternSchedulingMetrics;
  
  // Configuration
  updateConfig(config: Partial<PatternSchedulerConfig>): void;
  getConfig(): PatternSchedulerConfig;
  
  // Control
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Events emitted by pattern scheduler
 */
export interface PatternSchedulerEvents {
  'pattern:regionActivated': {
    trackId: string;
    regionId: string;
    startTime: number;
    loopIteration: number;
  };
  
  'pattern:regionDeactivated': {
    trackId: string;
    regionId: string;
    endTime: number;
    completedLoops: number;
  };
  
  'pattern:eventScheduled': EventSchedulingResult;
  
  'pattern:eventMissed': {
    trackId: string;
    regionId: string;
    eventTime: number;
    currentTime: number;
    lateness: number;
  };
  
  'pattern:loopCompleted': {
    trackId: string;
    regionId: string;
    loopIndex: number;
    totalLoops: number;
  };
  
  'pattern:performanceWarning': {
    metric: string;
    value: number;
    threshold: number;
    suggestion: string;
  };
}