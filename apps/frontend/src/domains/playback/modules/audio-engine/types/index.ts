/**
 * Audio Engine Module Types
 *
 * Core types and interfaces for the audio engine module
 */

// Re-export common types from parent domain
export type { TransportState } from '../../../types/audio-operations.js';

/**
 * Audio engine configuration
 */
export interface AudioEngineConfig {
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  lookAhead?: number;
  updateInterval?: number;
  maxInitRetries?: number;
  initRetryDelay?: number;
  enableBrowserCheck?: boolean;
  enableValidation?: boolean;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    timeout?: number;
    successThreshold?: number;
  };
}

/**
 * Audio context state
 */
export type AudioContextState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted';

/**
 * Audio metrics for monitoring
 */
export interface AudioMetrics {
  latency: number;
  sampleRate: number;
  bufferSize: number;
  cpuUsage: number;
  memoryUsage: number;
  dropouts: number;
  bufferUnderruns: number;
}

/**
 * Sampler configuration
 */
export interface SamplerConfig {
  urls?: Record<string, string>;
  baseUrl?: string;
  release?: number;
  attack?: number;
  volume?: number;
  onload?: () => void;
  onerror?: (error: Error) => void;
}

/**
 * Audio sampler interface
 */
export interface AudioSampler {
  triggerAttack(note: string, time?: number, velocity?: number): void;
  triggerRelease(note: string, time?: number): void;
  triggerAttackRelease(
    note: string,
    duration: number,
    time?: number,
    velocity?: number,
  ): void;
  connect(destination: AudioNode | AudioSampler): void;
  disconnect(): void;
  dispose(): void;
}

/**
 * Audio node wrapper interface
 */
export interface AudioNodeWrapper {
  node: AudioNode;
  input: AudioNode;
  output: AudioNode;
  connect(destination: AudioNode | AudioNodeWrapper): void;
  disconnect(): void;
  dispose(): void;
}

/**
 * Effects chain configuration
 */
export interface EffectsConfig {
  reverb?: {
    enabled: boolean;
    wetness: number;
    roomSize: number;
  };
  delay?: {
    enabled: boolean;
    time: number;
    feedback: number;
    wetness: number;
  };
  compressor?: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
}

/**
 * Browser information
 */
export interface BrowserInfo {
  name: string;
  version: number;
  supportsAudioWorklet: boolean;
  supportsWebAudio: boolean;
}

/**
 * Tone.js module interface (minimal type definition)
 */
export interface ToneModule {
  start(): Promise<void>;
  now(): number;
  setContext(context: AudioContext): void;
  getContext(): any; // Tone's context wrapper
  context: any; // Tone's context property
  Transport: any; // Tone's Transport
  Sampler: new (config: SamplerConfig) => any;
}
