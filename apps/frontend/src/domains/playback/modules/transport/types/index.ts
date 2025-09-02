/**
 * Transport Module Types
 * Extracted from UnifiedTransport for modular architecture
 */

/**
 * Musical position representation
 * Used throughout the system for precise musical timing
 */
export interface MusicalPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
}

/**
 * Extended transport position with time information
 * Backward compatibility alias that includes both musical and sample-accurate timing
 */
export interface TransportPosition extends MusicalPosition {
  seconds: number;
  frame?: number; // Current frame count from AudioWorklet
  sampleRate?: number; // Sample rate for frame calculations
}

/**
 * Time signature representation
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Transport state
 */
export type TransportState = 'stopped' | 'playing' | 'paused';

/**
 * Scheduled timing event
 */
export interface TimingEvent {
  id: string;
  time: number; // in seconds
  musicalTime?: MusicalPosition;
  callback: (time: number) => void;
  priority: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

/**
 * Transport timing metrics for monitoring
 */
export interface TimingMetrics {
  stability: number; // 0-100%
  avgDrift: number; // ms
  maxDrift: number; // ms
  jitter: number; // ms RMS
  updateRate: number; // Hz
  bufferHealth: number; // 0-100%
  cpuLoad: number; // 0-100%
  totalEvents: number;
  missedEvents: number;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  tempo: number;
  timeSignature: TimeSignature;
  lookAheadTime: number; // seconds
  scheduleInterval: number; // seconds
  enableAudioWorklet: boolean;
  enableWebWorker: boolean;
  driftCompensation: 'off' | 'basic' | 'adaptive';
  bufferStrategy: 'fixed' | 'adaptive';
}

/**
 * Default configuration matching professional DAWs
 */
export const DEFAULT_TRANSPORT_CONFIG: TransportConfig = {
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  lookAheadTime: 0.1, // 100ms - matches Ableton Live
  scheduleInterval: 0.025, // 25ms - 40Hz update rate
  enableAudioWorklet: true,
  enableWebWorker: true,
  driftCompensation: 'adaptive',
  bufferStrategy: 'adaptive',
};

/**
 * Clock synchronization data
 */
export interface ClockSyncData {
  audioTime: number;
  systemTime: number;
  offset: number;
  confidence: number; // 0-1
}

/**
 * Schedule options for events
 */
export interface ScheduleOptions {
  quantize?: string; // e.g., '16n', '8n', '4n'
  offset?: number; // in seconds
  probability?: number; // 0-1 for conditional scheduling
  swing?: number; // 0-1 for swing amount
  humanize?: number; // 0-1 for timing variation
}

/**
 * Transport sync state for multi-component coordination
 */
export interface TransportSyncState {
  isLocked: boolean;
  syncSource: 'internal' | 'external' | 'midi';
  syncOffset: number;
  syncConfidence: number;
}

/**
 * Latency measurement data
 */
export interface LatencyMeasurement {
  input: number;
  output: number;
  roundTrip: number;
  timestamp: number;
  confidence: number;
}

/**
 * Beat grid information
 */
export interface BeatGridInfo {
  currentBeat: number;
  currentBar: number;
  nextBeatTime: number;
  previousBeatTime: number;
  beatDuration: number; // in seconds
  isOnBeat: boolean;
  beatStrength: 'strong' | 'medium' | 'weak';
}

/**
 * Performance optimization hints
 */
export interface PerformanceHints {
  preferAudioWorklet: boolean;
  preferWebWorker: boolean;
  maxLookAhead: number;
  targetLatency: number;
  adaptiveScheduling: boolean;
}