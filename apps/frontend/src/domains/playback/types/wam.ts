/**
 * Web Audio Modules (WAM) 2.0 Type Definitions
 *
 * Provides TypeScript interfaces for WAM 2.0 plugin standard integration.
 * These types enable interoperability between BassNotion and the wider
 * web audio plugin ecosystem while maintaining our timing precision.
 *
 * Part of Story 3.21 Task 7 - Web Audio Standards Compliance
 */

import type { MusicalPosition } from '../services/core/UnifiedTransport.js';

/**
 * WAM descriptor containing plugin metadata
 */
export interface WamDescriptor {
  name: string;
  vendor: string;
  version: string;
  sdkVersion: string;
  thumbnail: string;
  keywords: string[];
  isInstrument: boolean;
  website: string;
  hasAudioInput: boolean;
  hasAudioOutput: boolean;
  hasMidiInput: boolean;
  hasMidiOutput: boolean;
  supportsMpe: boolean;
}

/**
 * WAM parameter types
 */
export type WamParameterType = 'float' | 'int' | 'boolean' | 'choice';

/**
 * WAM parameter configuration
 */
export interface WamParameterConfiguration {
  label?: string;
  type?: WamParameterType;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  discreteStep?: number;
  exponent?: number;
  choices?: string[];
  units?: string;
}

/**
 * WAM parameter info map
 */
export type WamParameterInfoMap = Record<string, WamParameterConfiguration>;

/**
 * WAM parameter data
 */
export interface WamParameterData {
  id: string;
  value: number;
  normalized: boolean;
}

/**
 * WAM parameter data map
 */
export type WamParameterDataMap = Record<string, number>;

/**
 * WAM event types
 */
export type WamEventType =
  | 'wam-automation'
  | 'wam-transport'
  | 'wam-midi'
  | 'wam-sysex'
  | 'wam-mpe'
  | 'wam-osc';

/**
 * Base WAM event
 */
export interface WamEvent {
  type: WamEventType;
  time?: number;
  data: any;
}

/**
 * WAM automation event
 */
export interface WamAutomationEvent extends WamEvent {
  type: 'wam-automation';
  data: WamParameterData;
}

/**
 * WAM transport event
 */
export interface WamTransportEvent extends WamEvent {
  type: 'wam-transport';
  data: {
    playing: boolean;
    recording: boolean;
    hostBpm: number;
    hostCurrentBar: number;
    hostCurrentBarStarted: number;
    hostSampleRate: number;
    hostBlockSize: number;
  };
}

/**
 * WAM MIDI event
 */
export interface WamMidiEvent extends WamEvent {
  type: 'wam-midi';
  data: {
    bytes: Uint8Array;
  };
}

/**
 * WAM state
 */
export interface WamState {
  parameterValues: WamParameterDataMap;
  internalState?: any;
}

/**
 * WAM node interface extending AudioNode
 */
export interface WamNode extends AudioNode {
  // Core properties
  readonly module: WebAudioModule;

  // State management
  getState(): Promise<WamState>;
  setState(state: WamState): Promise<void>;

  // Parameter handling
  getParameterInfo(): Promise<WamParameterInfoMap>;
  getParameterValues(): Promise<WamParameterDataMap>;
  setParameterValues(values: WamParameterDataMap): Promise<void>;
  getCompensationDelay(): Promise<number>;

  // Event scheduling
  scheduleEvents(...events: WamEvent[]): void;
  clearEvents(): void;

  // Lifecycle
  destroy(): Promise<void>;
}

/**
 * WAM processor interface (runs in AudioWorklet)
 */
export type WamProcessor = AudioWorkletProcessor;

/**
 * WAM constructor interface
 */
export interface WamConstructor {
  new (audioContext: BaseAudioContext, initialState?: any): WebAudioModule;

  // Static properties
  readonly isWebAudioModuleConstructor: true;
  readonly descriptor: WamDescriptor;

  // Factory method
  createInstance(
    audioContext: BaseAudioContext,
    initialState?: any,
  ): Promise<WebAudioModule>;
}

/**
 * Main WebAudioModule interface
 */
export interface WebAudioModule {
  // Core properties
  readonly audioContext: BaseAudioContext;
  readonly audioNode: WamNode;
  readonly initialized: boolean;
  readonly descriptor: WamDescriptor;
  readonly instanceId: string;
  readonly moduleId: string;

  // Lifecycle methods
  initialize(state?: any): Promise<WebAudioModule>;
  createAudioNode(options?: any): Promise<WamNode>;

  // GUI management
  createGui(): Promise<Element>;
  destroyGui(gui: Element): void;

  // State persistence
  getState(): Promise<any>;
  setState(state: any): Promise<void>;
}

/**
 * WAM environment configuration
 */
export interface WamEnvConfig {
  hostId: string;
  groupId: string;
}

/**
 * WAM group for managing multiple WAMs
 */
export interface WamGroup {
  readonly groupId: string;
  readonly hostId: string;

  addWam(wam: WebAudioModule): void;
  removeWam(instanceId: string): void;
  connectWams(from: string, to: string, output?: number, input?: number): void;
  disconnectWams(
    from: string,
    to: string,
    output?: number,
    input?: number,
  ): void;
}

/**
 * WAM environment singleton
 */
export interface WamEnv {
  readonly apiVersion: string;

  // Group management
  createGroup(hostId: string, groupId: string): WamGroup;
  deleteGroup(groupId: string): void;

  // Global utilities
  getModuleUrl(moduleId: string): string | undefined;
  registerModule(moduleId: string, url: string): void;
}

/**
 * WAM host capabilities for BassNotion
 */
export interface WamHostCapabilities {
  // Timing precision
  supportsAudioWorklet: boolean;
  supportsSampleAccurateTiming: boolean;
  maxDriftTolerance: number; // ms

  // Audio features
  supportsMultiChannel: boolean;
  maxChannelCount: number;
  supportsSidechain: boolean;

  // Transport sync
  supportsTransportSync: boolean;
  supportsMusicalTime: boolean;
  supportsBarBeatSync: boolean;

  // Automation
  supportsParameterAutomation: boolean;
  supportsPatternBasedAutomation: boolean;

  // Performance
  maxPluginsPerTrack: number;
  supportsPluginLatencyCompensation: boolean;
}

/**
 * WAM plugin registration info
 */
export interface WamPluginRegistration {
  moduleId: string;
  url: string;
  descriptor: WamDescriptor;
  loadedAt: number;
  instanceCount: number;
}

/**
 * WAM to BassNotion parameter mapping
 */
export interface WamParameterMapping {
  wamParamId: string;
  bassNotionParamId: string;
  scalingFactor?: number;
  offset?: number;
  inverseMapping?: boolean;
}

/**
 * WAM timing sync configuration
 */
export interface WamTimingConfig {
  // Use UnifiedTransport as master clock
  useMasterClock: boolean;

  // Sync musical position to WAM
  syncMusicalPosition: boolean;

  // Latency compensation
  compensateLatency: boolean;
  reportedLatency: number;

  // Event scheduling
  scheduleAheadTime: number; // seconds
  eventQuantization?: MusicalPosition;
}

/**
 * WAM error types
 */
export enum WamErrorType {
  LOAD_FAILED = 'LOAD_FAILED',
  INIT_FAILED = 'INIT_FAILED',
  AUDIO_NODE_CREATION_FAILED = 'AUDIO_NODE_CREATION_FAILED',
  PARAMETER_ERROR = 'PARAMETER_ERROR',
  STATE_ERROR = 'STATE_ERROR',
  TIMING_ERROR = 'TIMING_ERROR',
  COMPATIBILITY_ERROR = 'COMPATIBILITY_ERROR',
}

/**
 * WAM error interface
 */
export interface WamError extends Error {
  type: WamErrorType;
  moduleId?: string;
  instanceId?: string;
  details?: any;
}
