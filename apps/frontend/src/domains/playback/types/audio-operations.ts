/**
 * Comprehensive type definitions for all audio operations
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 */

import { AudioError } from '../errors/AudioErrors.js';

// Core audio types
export type AudioState = 'uninitialized' | 'initializing' | 'ready' | 'running' | 'suspended' | 'closed' | 'error';
export type TransportState = 'stopped' | 'started' | 'paused' | 'scheduled';
export type PlaybackPosition = 'bars:beats:sixteenths' | 'seconds';

// Audio operation types
export interface AudioOperation<T = unknown> {
  id: string;
  type: AudioOperationType;
  timestamp: number;
  execute(): Promise<T>;
  rollback?(): Promise<void>;
  validate?(): boolean;
}

export type AudioOperationType = 
  | 'initialize'
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'seek'
  | 'setTempo'
  | 'setVolume'
  | 'loadSample'
  | 'createEffect'
  | 'connect'
  | 'disconnect'
  | 'dispose';

// Transport operation interfaces
export interface TransportOperation extends AudioOperation {
  position?: number | string;
  offset?: number;
}

export interface TempoChange extends TransportOperation {
  type: 'setTempo';
  bpm: number;
  rampTime?: number;
}

export interface VolumeChange extends TransportOperation {
  type: 'setVolume';
  volume: number; // in dB
  rampTime?: number;
  target?: 'master' | 'track' | 'instrument';
  targetId?: string;
}

export interface SeekOperation extends TransportOperation {
  type: 'seek';
  position: number | string;
  immediate?: boolean;
}

// Sample operations
export interface SampleLoadOperation extends AudioOperation {
  type: 'loadSample';
  url: string;
  noteMapping?: Record<string, string>;
  options?: SampleLoadOptions;
}

export interface SampleLoadOptions {
  attack?: number;
  release?: number;
  volume?: number;
  onload?: () => void;
  onerror?: (error: Error) => void;
}

// Effect operations
export interface EffectOperation extends AudioOperation {
  effectType: AudioEffectType;
  parameters: EffectParameters;
  bypass?: boolean;
}

export type AudioEffectType = 
  | 'reverb'
  | 'delay'
  | 'distortion'
  | 'filter'
  | 'compressor'
  | 'eq'
  | 'chorus'
  | 'phaser'
  | 'tremolo'
  | 'vibrato';

export interface EffectParameters {
  [key: string]: number | string | boolean;
}

// Connection operations
export interface ConnectionOperation extends AudioOperation {
  type: 'connect' | 'disconnect';
  source: AudioNodeReference;
  destination: AudioNodeReference;
  output?: number;
  input?: number;
}

export interface AudioNodeReference {
  id: string;
  type: 'instrument' | 'effect' | 'master' | 'track' | 'bus';
  channel?: number;
}

// Scheduling operations
export interface ScheduledOperation extends AudioOperation {
  time: number | string; // Absolute time or transport position
  repeat?: number;
  interval?: number | string;
  callback?: () => void;
}

// Batch operations
export interface BatchOperation extends AudioOperation {
  operations: AudioOperation[];
  parallel?: boolean;
  atomicRollback?: boolean;
}

// Operation results
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: AudioError;
  duration: number;
  metadata?: Record<string, unknown>;
}

// Operation callbacks
export interface OperationCallbacks {
  onStart?: (operation: AudioOperation) => void;
  onProgress?: (operation: AudioOperation, progress: number) => void;
  onComplete?: (operation: AudioOperation, result: OperationResult) => void;
  onError?: (operation: AudioOperation, error: AudioError) => void;
  onCancel?: (operation: AudioOperation) => void;
}

// Audio metrics for operations
export interface AudioOperationMetrics {
  operationId: string;
  type: AudioOperationType;
  startTime: number;
  endTime?: number;
  duration?: number;
  cpuUsage?: number;
  memoryDelta?: number;
  audioDropouts?: number;
  success: boolean;
  error?: string;
}

// Operation queue
export interface OperationQueue {
  pending: AudioOperation[];
  active: AudioOperation[];
  completed: AudioOperation[];
  failed: AudioOperation[];
  maxConcurrent: number;
  priorityMode: 'fifo' | 'lifo' | 'priority';
}

// Operation constraints
export interface OperationConstraints {
  maxDuration?: number;
  maxMemoryUsage?: number;
  maxCpuUsage?: number;
  requiresUserGesture?: boolean;
  requiresAudioContext?: boolean;
  browserSupport?: string[];
}

// Transport scheduling
export interface TransportSchedule {
  events: ScheduledEvent[];
  loop: boolean;
  loopStart: number | string;
  loopEnd: number | string;
  swing?: number;
  swingSubdivision?: number;
}

export interface ScheduledEvent {
  id: string;
  time: number | string;
  callback: (time: number) => void;
  duration?: number | string;
  velocity?: number;
  probability?: number;
  mute?: boolean;
  offset?: number;
}

// Audio analysis operations
export interface AnalysisOperation extends AudioOperation {
  type: 'analyze';
  analysisType: 'waveform' | 'frequency' | 'pitch' | 'rhythm' | 'dynamics';
  bufferSize?: number;
  smoothing?: number;
  callback?: (data: AnalysisData) => void;
}

export interface AnalysisData {
  type: string;
  timestamp: number;
  data: Float32Array | number[];
  metadata?: {
    sampleRate?: number;
    fftSize?: number;
    smoothingTimeConstant?: number;
  };
}

// Plugin operations
export interface PluginOperation extends AudioOperation {
  pluginId: string;
  action: 'load' | 'unload' | 'enable' | 'disable' | 'configure';
  parameters?: Record<string, unknown>;
}

// Resource management
export interface ResourceOperation extends AudioOperation {
  resourceType: 'buffer' | 'sample' | 'preset' | 'plugin';
  action: 'allocate' | 'deallocate' | 'preload' | 'cache' | 'clear';
  resourceId?: string;
  priority?: 'low' | 'normal' | 'high';
}

// Type guards
export function isTransportOperation(op: AudioOperation): op is TransportOperation {
  return ['start', 'stop', 'pause', 'resume', 'seek', 'setTempo'].includes(op.type);
}

export function isSampleOperation(op: AudioOperation): op is SampleLoadOperation {
  return op.type === 'loadSample';
}

export function isEffectOperation(op: AudioOperation): op is EffectOperation {
  return 'effectType' in op;
}

export function isScheduledOperation(op: AudioOperation): op is ScheduledOperation {
  return 'time' in op;
}

export function isBatchOperation(op: AudioOperation): op is BatchOperation {
  return 'operations' in op;
}