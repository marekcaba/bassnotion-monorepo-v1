/**
 * Plugin Architecture Types - Professional Audio Plugin System
 *
 * Provides type-safe, extensible plugin architecture for audio processing modules
 * with comprehensive lifecycle management and Epic 2 integration support.
 *
 * Part of Story 2.1: Task 1, Subtask 1.4
 */

import * as Tone from 'tone';
import type { ErrorContext } from '../services/errors/base';

/**
 * Plugin categories for organization and filtering
 */
export enum PluginCategory {
  INSTRUMENT = 'instrument',
  EFFECT = 'effect',
  ANALYZER = 'analyzer',
  UTILITY = 'utility',
  GENERATOR = 'generator',
  PROCESSOR = 'processor',
}

/**
 * Processing result status indicators
 */
export enum ProcessingResultStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
  ERROR = 'error',
  BYPASSED = 'bypassed',
  TIMEOUT = 'timeout',
}

/**
 * Plugin parameter types for validation
 */
export enum PluginParameterType {
  NUMBER = 'number',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  STRING = 'string',
  ENUM = 'enum',
  ARRAY = 'array',
  OBJECT = 'object',
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DISPOSING = 'disposing',
}

/**
 * Plugin priority levels for processing order
 */
export enum PluginPriority {
  CRITICAL = 1000,
  HIGH = 750,
  MEDIUM = 625,
  NORMAL = 500,
  LOW = 250,
  BACKGROUND = 100,
}

/**
 * Plugin capabilities and feature flags
 */
export interface PluginCapabilities {
  // Audio processing capabilities
  supportsRealtimeProcessing: boolean;
  supportsOfflineProcessing: boolean;
  supportsAudioWorklet: boolean;
  supportsMIDI: boolean;

  // Feature support
  supportsAutomation: boolean;
  supportsPresets: boolean;
  supportsSidechain: boolean;
  supportsMultiChannel: boolean;

  // Performance characteristics
  maxLatency: number; // in milliseconds
  cpuUsage: number; // estimated relative CPU usage (0-1)
  memoryUsage: number; // estimated memory usage in MB

  // Compatibility
  minSampleRate: number;
  maxSampleRate: number;
  supportedBufferSizes: number[];

  // Epic 2 integration
  supportsN8nPayload: boolean;
  supportsAssetLoading: boolean;
  supportsMobileOptimization: boolean;
}

/**
 * Plugin configuration and settings
 */
export interface PluginConfig {
  // Basic plugin info
  id: string;
  name: string;
  version: string;
  category: PluginCategory;

  // Runtime configuration
  enabled: boolean;
  priority: PluginPriority;
  autoStart: boolean;

  // Audio routing
  inputChannels: number;
  outputChannels: number;

  // Plugin-specific settings (plugin defines the shape)
  settings: Record<string, unknown>;

  // Performance constraints
  maxCpuUsage?: number;
  maxMemoryUsage?: number;

  // Epic 2 integration settings
  n8nIntegration?: {
    acceptsPayload: boolean;
    payloadTypes: string[];
  };
}

/**
 * Plugin metadata and registration info
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;

  // Plugin classification
  category: PluginCategory;
  tags: string[];

  // Technical requirements
  capabilities: PluginCapabilities;
  dependencies: string[];

  // Epic 2 integration metadata
  epicIntegration?: {
    supportedMidiTypes: string[];
    supportedAudioFormats: string[];
    assetProcessingCapabilities: string[];
  };
}

/**
 * Plugin event system
 */
export interface PluginEvents {
  // Lifecycle events
  loaded: () => void;
  initialized: () => void;
  activated: () => void;
  deactivated: () => void;
  disposed: () => void;
  error: (error: Error, context: ErrorContext) => void;

  // Audio events
  audioProcessed: (inputBuffer: AudioBuffer, outputBuffer: AudioBuffer) => void;
  parameterChanged: (parameterId: string, value: unknown) => void;

  // Epic 2 integration events
  n8nPayloadReceived?: (payload: unknown) => void;
  assetLoaded?: (assetId: string, asset: AudioBuffer | ArrayBuffer) => void;
}

/**
 * Plugin audio processing context
 */
export interface PluginAudioContext {
  audioContext: AudioContext;
  sampleRate: number;
  bufferSize: number;
  currentTime: number;

  // Tone.js integration
  toneContext: Tone.BaseContext;
  transport: typeof Tone.Transport;

  // Performance monitoring
  performanceMetrics: {
    processingTime: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

/**
 * Plugin parameter definition
 */
export interface PluginParameter {
  id: string;
  name: string;
  description: string;
  type: PluginParameterType;
  defaultValue: unknown;

  // For number/float parameters
  min?: number;
  max?: number;
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;

  // For enum parameters
  options?: { value: unknown; label: string }[];

  // UI hints
  displayName?: string;
  group?: string;
  automatable: boolean;
}

/**
 * Plugin processing result
 */
export interface PluginProcessingResult {
  success: boolean;
  status: ProcessingResultStatus;
  processingTime: number;
  bypassMode: boolean;

  // Processing metrics
  processedSamples: number;
  cpuUsage: number;
  memoryDelta?: number;
  memoryUsage?: number;

  // Optional metadata
  metadata?: Record<string, unknown>;

  // Error information if failed
  error?:
    | {
        code: string;
        message: string;
        recoverable: boolean;
      }
    | Error;
}

/**
 * Base Audio Plugin Interface
 *
 * All audio plugins must implement this interface for integration
 * with the CoreAudioEngine and plugin management system.
 */
export interface AudioPlugin {
  // Plugin identity and metadata
  readonly metadata: PluginMetadata;
  readonly config: PluginConfig;
  readonly state: PluginState;

  // Plugin capabilities
  readonly capabilities: PluginCapabilities;
  readonly parameters: Map<string, PluginParameter>;

  /**
   * Plugin lifecycle methods
   */
  load(): Promise<void>;
  initialize(context: PluginAudioContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;

  /**
   * Audio processing (main plugin functionality)
   */
  process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult>;

  /**
   * Parameter management
   */
  setParameter(parameterId: string, value: unknown): Promise<void>;
  getParameter(parameterId: string): unknown;
  resetParameters(): Promise<void>;

  /**
   * Preset management
   */
  savePreset(name: string): Promise<Record<string, unknown>>;
  loadPreset(preset: Record<string, unknown>): Promise<void>;

  /**
   * Event handling
   */
  on<K extends keyof PluginEvents>(
    event: K,
    handler: PluginEvents[K],
  ): () => void;

  off<K extends keyof PluginEvents>(event: K, handler: PluginEvents[K]): void;

  /**
   * Tone.js integration
   */
  getToneNode?(): Tone.ToneAudioNode | null;
  connectToTone?(destination: Tone.ToneAudioNode): void;
  disconnectFromTone?(): void;

  /**
   * Epic 2 integration (optional)
   */
  processN8nPayload?(payload: unknown): Promise<void>;
  loadAsset?(assetId: string, asset: AudioBuffer | ArrayBuffer): Promise<void>;
  optimizeForMobile?(): Promise<void>;
}

/**
 * Plugin manager events
 */
export interface PluginManagerEvents {
  pluginRegistered: (plugin: AudioPlugin) => void;
  pluginUnregistered: (pluginId: string) => void;
  pluginStateChanged: (pluginId: string, state: PluginState) => void;
  pluginError: (pluginId: string, error: Error) => void;
  processingOrderChanged: (order: string[]) => void;
}

/**
 * Plugin registry entry for manager tracking
 */
export interface PluginRegistryEntry {
  plugin: AudioPlugin;
  registeredAt: number;
  lastUsed: number;
  usageCount: number;

  // **ARCHITECTURE UPGRADE**: PluginManager-controlled state tracking
  // Since plugin.state is readonly, the manager maintains authoritative state
  managerState: PluginState;

  // Performance tracking
  averageProcessingTime: number;
  averageCpuUsage: number;
  totalErrors: number;

  // Dependencies tracking
  dependents: Set<string>;
  dependencies: Set<string>;
}

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  // Performance limits
  maxConcurrentPlugins: number;
  maxTotalCpuUsage: number;
  maxTotalMemoryUsage: number;

  // Processing configuration
  processingBufferSize: number;
  enableParallelProcessing: boolean;

  // Error handling
  errorRecoveryAttempts: number;
  failureTimeout: number;

  // Epic 2 integration
  enableN8nIntegration: boolean;
  enableAssetLoading: boolean;
  enableMobileOptimizations: boolean;
}
