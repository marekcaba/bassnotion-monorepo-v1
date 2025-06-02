/**
 * Audio-specific TypeScript interfaces for the Playback Domain
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

export type AudioContextState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted';
export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'loading';
export type AudioSourceType =
  | 'drums'
  | 'bass'
  | 'harmony'
  | 'metronome'
  | 'ambient';

export interface AudioContextError {
  type: 'unsupported' | 'hardware' | 'permission' | 'unknown';
  message: string;
  originalError?: Error;
}

export interface AudioPerformanceMetrics {
  latency: number; // Current audio latency in ms
  averageLatency: number; // Average latency over time
  maxLatency: number; // Maximum recorded latency
  dropoutCount: number; // Number of audio dropouts detected
  bufferUnderruns: number; // Buffer underrun events
  cpuUsage: number; // Estimated CPU usage percentage
  memoryUsage: number; // Memory usage in MB
  sampleRate: number; // Current sample rate
  bufferSize: number; // Current buffer size
  timestamp: number; // Last measurement timestamp
}

export interface PerformanceAlert {
  type: 'latency' | 'dropout' | 'cpu' | 'memory';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<AudioPerformanceMetrics>;
  timestamp: number;
}

export interface AudioSourceConfig {
  id: string;
  type: AudioSourceType;
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
}

export interface CoreAudioEngineConfig {
  masterVolume: number;
  tempo: number; // BPM
  pitch: number; // Semitones offset
  swingFactor: number; // 0-1 (0 = straight, 0.5 = triplet swing)
}

// Mobile-specific audio configuration
export interface MobileAudioConfig {
  optimizeForBattery: boolean;
  reducedLatencyMode: boolean;
  autoSuspendOnBackground: boolean;
  gestureActivationRequired: boolean;
}

// Audio visualization data
export interface AudioVisualizationData {
  waveform: Float32Array;
  spectrum: Float32Array;
  volume: number;
  peak: number;
  timestamp: number;
}

// Event system interfaces
export interface AudioEngineEvents {
  stateChange: (state: PlaybackState) => void;
  audioContextChange: (contextState: AudioContextState) => void;
  performanceAlert: (alert: PerformanceAlert) => void;
  tempoChange: (tempo: number) => void;
  masterVolumeChange: (volume: number) => void;
  sourceVolumeChange: (sourceId: string, volume: number) => void;
  sourceStateChange: (
    sourceId: string,
    state: { muted: boolean; solo: boolean },
  ) => void;
}
