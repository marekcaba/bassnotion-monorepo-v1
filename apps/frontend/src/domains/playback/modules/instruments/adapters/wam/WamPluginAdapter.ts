/**
 * WAM Plugin Adapter
 *
 * Bridges Web Audio Modules (WAM) 2.0 plugins to BassNotion's AudioPlugin interface.
 * Ensures seamless integration with our track-based architecture while maintaining
 * sample-accurate timing precision through UnifiedTransport.
 *
 * Features:
 * - Zero-latency integration with AudioWorklet
 * - Parameter mapping and automation
 * - State persistence
 * - MIDI event forwarding
 * - Transport synchronization
 *
 * Part of Story 3.21 Task 7 - Web Audio Standards Compliance
 */

import type {
  AudioPlugin,
  PluginMetadata,
  PluginConfig,
  PluginCapabilities,
  PluginParameter,
  PluginParameterType,
  PluginProcessingResult,
  PluginAudioContext,
  PluginEvents,
} from '../../../../types/plugin.js';

import {
  PluginState,
  ProcessingResultStatus,
  PluginCategory,
  PluginParameterType as PluginParameterTypeEnum,
  PluginPriority,
} from '../../../../types/plugin.js';

import type {
  WebAudioModule,
  WamNode,
  WamDescriptor,
  WamParameterInfoMap,
  WamParameterDataMap,
  WamEvent,
  WamAutomationEvent,
  WamTransportEvent,
  WamMidiEvent,
  WamParameterMapping,
  WamTimingConfig,
} from '../../types/wam.js';

import { TransportAdapter } from '../../../../services/core/TransportAdapter.js';
import type { MusicalPosition } from '../../../transport/types/index.js';
import { serviceRegistry } from '../../../../services/core/ServiceRegistry.js';
import { EventBus } from '../../../../services/core/EventBus.js';
import {
  PlaybackError,
  ErrorSeverity,
  ErrorCategory,
  createErrorContext,
} from '../../../../services/errors/base.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('WamPluginAdapter');

/**
 * Adapter class that wraps WAM plugins for BassNotion compatibility
 */
export class WamPluginAdapter implements AudioPlugin {
  // WAM instance
  private wamInstance: WebAudioModule | null = null;
  private wamNode: WamNode | null = null;

  // Core properties
  public readonly metadata: PluginMetadata;
  public readonly config: PluginConfig;
  private _state: PluginState = PluginState.UNLOADED;

  // Capabilities derived from WAM descriptor
  public readonly capabilities: PluginCapabilities;
  public readonly parameters = new Map<string, PluginParameter>();

  // Services
  private transport: TransportAdapter;
  private eventBus?: EventBus;

  // Parameter mapping
  private parameterMappings = new Map<string, WamParameterMapping>();
  private wamParameters: WamParameterInfoMap = {};

  // Event handling
  private eventHandlers = new Map<string, Set<Function>>();
  private scheduledEvents: WamEvent[] = [];

  // Timing configuration
  private timingConfig: WamTimingConfig = {
    useMasterClock: true,
    syncMusicalPosition: true,
    compensateLatency: true,
    reportedLatency: 0,
    scheduleAheadTime: 0.1, // 100ms lookahead
  };

  // Performance tracking
  private processingTimeHistory: number[] = [];
  private readonly maxHistorySize = 100;

  constructor(
    private wamUrl: string,
    private wamDescriptor: WamDescriptor,
    config?: Partial<PluginConfig>,
  ) {
    // Initialize metadata from WAM descriptor
    this.metadata = this.createMetadataFromDescriptor(wamDescriptor);

    // Initialize config
    this.config = {
      id: `wam-${wamDescriptor.vendor}-${wamDescriptor.name}`
        .toLowerCase()
        .replace(/\s+/g, '-'),
      name: wamDescriptor.name,
      version: wamDescriptor.version,
      category: wamDescriptor.isInstrument
        ? PluginCategory.INSTRUMENT
        : PluginCategory.EFFECT,
      enabled: true,
      priority: PluginPriority.NORMAL,
      autoStart: true,
      inputChannels: 2,
      outputChannels: 2,
      settings: {},
      ...config,
    };

    // Initialize capabilities from WAM descriptor
    this.capabilities = this.createCapabilitiesFromDescriptor(wamDescriptor);

    // Get services
    this.transport = TransportAdapter.getInstance();
    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('EventBus not found in ServiceRegistry');
    }
  }

  /**
   * Get current plugin state
   */
  get state(): PluginState {
    return this._state;
  }

  /**
   * Get plugin priority
   */
  get priority(): PluginPriority {
    return this.config.priority || PluginPriority.NORMAL;
  }

  /**
   * Load WAM plugin module
   */
  async load(): Promise<void> {
    if (this._state !== PluginState.UNLOADED) {
      throw new PlaybackError({
        code: 'WAM_ALREADY_LOADED',
        message: 'Plugin already loaded',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.CONFIGURATION,
        context: createErrorContext({ currentOperation: 'load' }),
        recoveryActions: [],
      });
    }

    this._state = PluginState.LOADING;

    try {
      // Dynamically import WAM module
      const { default: WamConstructor } = await import(this.wamUrl);

      // Verify it's a valid WAM constructor
      if (!WamConstructor.isWebAudioModuleConstructor) {
        throw new Error(
          'Invalid WAM module: missing isWebAudioModuleConstructor',
        );
      }

      this._state = PluginState.LOADED;

      // Store constructor for later instantiation
      (this as any).WamConstructor = WamConstructor;

      logger.info(`✅ WAM plugin loaded: ${this.metadata.name}`);
    } catch (error) {
      this._state = PluginState.ERROR;
      throw new PlaybackError({
        code: 'WAM_LOAD_FAILED',
        message: `Failed to load WAM plugin: ${error}`,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.RESOURCE,
        context: createErrorContext({ currentOperation: 'load' }),
        recoveryActions: [],
      });
    }
  }

  /**
   * Initialize WAM plugin with audio context
   */
  async initialize(context: PluginAudioContext): Promise<void> {
    if (this._state !== PluginState.LOADED) {
      throw new PlaybackError({
        code: 'WAM_NOT_LOADED',
        message: 'Plugin must be loaded before initialization',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.CONFIGURATION,
        context: createErrorContext({ currentOperation: 'initialize' }),
        recoveryActions: [],
      });
    }

    this._state = PluginState.INITIALIZING;

    try {
      const WamConstructor = (this as any).WamConstructor;
      const audioContext = context.audioContext as unknown as BaseAudioContext;

      // Create WAM instance
      this.wamInstance = await WamConstructor.createInstance(audioContext, {});

      // Create audio node
      this.wamNode = await this.wamInstance.createAudioNode();

      // Get parameter info and create mappings
      this.wamParameters = await this.wamNode.getParameterInfo();
      await this.createParameterMappings();

      // Get initial latency
      this.timingConfig.reportedLatency =
        await this.wamNode.getCompensationDelay();

      this._state = PluginState.ACTIVE;

      // Emit initialization event
      this.eventBus?.emit('wam:initialized', {
        pluginId: this.config.id,
        descriptor: this.wamDescriptor,
        latency: this.timingConfig.reportedLatency,
      });

      logger.info(`✅ WAM plugin initialized: ${this.metadata.name}`);
    } catch (error) {
      this._state = PluginState.ERROR;
      throw new PlaybackError({
        code: 'WAM_INIT_FAILED',
        message: `Failed to initialize WAM plugin: ${error}`,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.AUDIO_CONTEXT,
        context: createErrorContext({ currentOperation: 'initialize' }),
        recoveryActions: [],
      });
    }
  }

  /**
   * Activate plugin
   */
  async activate(): Promise<void> {
    if (
      this._state !== PluginState.INACTIVE &&
      this._state !== PluginState.ACTIVE
    ) {
      throw new PlaybackError({
        code: 'WAM_NOT_INITIALIZED',
        message: 'Plugin must be initialized before activation',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.CONFIGURATION,
        context: createErrorContext({ currentOperation: 'activate' }),
        recoveryActions: [],
      });
    }

    this._state = PluginState.ACTIVE;
    this.config.enabled = true;

    // Start transport sync if enabled
    if (this.timingConfig.syncMusicalPosition) {
      this.startTransportSync();
    }
  }

  /**
   * Deactivate plugin
   */
  async deactivate(): Promise<void> {
    if (this._state !== PluginState.ACTIVE) {
      return;
    }

    this._state = PluginState.INACTIVE;
    this.config.enabled = false;

    // Stop transport sync
    this.stopTransportSync();

    // Clear scheduled events
    if (this.wamNode) {
      this.wamNode.clearEvents();
    }
  }

  /**
   * Dispose plugin and free resources
   */
  async dispose(): Promise<void> {
    this._state = PluginState.DISPOSING;

    // Stop transport sync
    this.stopTransportSync();

    // Destroy WAM node
    if (this.wamNode) {
      await this.wamNode.destroy();
      this.wamNode = null;
    }

    // Clear WAM instance
    this.wamInstance = null;

    // Clear event handlers
    this.eventHandlers.clear();

    this._state = PluginState.UNLOADED;

    logger.info(`🗑️ WAM plugin disposed: ${this.metadata.name}`);
  }

  /**
   * Process audio (WAM plugins process through their audio node)
   */
  async process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    const startTime = performance.now();

    // WAM plugins process audio through their connected audio nodes
    // This method is mainly for compatibility and metrics

    const processingTime = performance.now() - startTime;
    this.updateProcessingMetrics(processingTime);

    return {
      success: true,
      status: this.config.bypassMode
        ? ProcessingResultStatus.BYPASSED
        : ProcessingResultStatus.SUCCESS,
      processingTime,
      bypassMode: this.config.bypassMode,
      processedSamples: inputBuffer.length,
      cpuUsage: this.estimateCpuUsage(processingTime),
      metadata: {
        wamLatency: this.timingConfig.reportedLatency,
      },
    };
  }

  /**
   * Set parameter value
   */
  async setParameter(parameterId: string, value: unknown): Promise<void> {
    if (!this.wamNode) {
      throw new PlaybackError({
        code: 'WAM_NODE_NOT_READY',
        message: 'WAM node not initialized',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.STATE,
        context: createErrorContext({ currentOperation: 'setParameter' }),
        recoveryActions: [],
      });
    }

    // Get parameter mapping
    const mapping = this.parameterMappings.get(parameterId);
    if (!mapping) {
      throw new PlaybackError({
        code: 'WAM_UNKNOWN_PARAMETER',
        message: `Unknown parameter: ${parameterId}`,
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.CONFIGURATION,
        context: createErrorContext({ currentOperation: 'setParameter' }),
        recoveryActions: [],
      });
    }

    // Apply mapping transformation
    let wamValue = value as number;
    if (mapping.scalingFactor) {
      wamValue *= mapping.scalingFactor;
    }
    if (mapping.offset) {
      wamValue += mapping.offset;
    }
    if (mapping.inverseMapping) {
      wamValue = 1 - wamValue;
    }

    // Set WAM parameter
    await this.wamNode.setParameterValues({
      [mapping.wamParamId]: wamValue,
    });

    // Update our parameter map
    const param = this.parameters.get(parameterId);
    if (param) {
      param.defaultValue = value;
    }
  }

  /**
   * Get parameter value
   */
  getParameter(parameterId: string): unknown {
    const param = this.parameters.get(parameterId);
    return param?.defaultValue;
  }

  /**
   * Reset all parameters to defaults
   */
  async resetParameters(): Promise<void> {
    if (!this.wamNode) return;

    const defaultValues: WamParameterDataMap = {};

    for (const [paramId, paramInfo] of Object.entries(this.wamParameters)) {
      defaultValues[paramId] = paramInfo.defaultValue;
    }

    await this.wamNode.setParameterValues(defaultValues);

    // Update our parameter map
    for (const [id, param] of this.parameters.entries()) {
      const mapping = this.parameterMappings.get(id);
      if (mapping) {
        const wamParam = this.wamParameters[mapping.wamParamId];
        if (wamParam) {
          param.defaultValue = wamParam.defaultValue;
        }
      }
    }
  }

  /**
   * Save preset
   */
  async savePreset(name: string): Promise<Record<string, unknown>> {
    if (!this.wamNode) {
      throw new PlaybackError({
        code: 'WAM_NODE_NOT_READY',
        message: 'WAM node not initialized',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.STATE,
        context: createErrorContext({ currentOperation: 'savePreset' }),
        recoveryActions: [],
      });
    }

    const state = await this.wamNode.getState();

    return {
      name,
      wamState: state,
      parameterValues: await this.wamNode.getParameterValues(),
      metadata: {
        savedAt: Date.now(),
        pluginId: this.config.id,
        pluginVersion: this.config.version,
      },
    };
  }

  /**
   * Load preset
   */
  async loadPreset(preset: Record<string, unknown>): Promise<void> {
    if (!this.wamNode) {
      throw new PlaybackError({
        code: 'WAM_NODE_NOT_READY',
        message: 'WAM node not initialized',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.STATE,
        context: createErrorContext({ currentOperation: 'loadPreset' }),
        recoveryActions: [],
      });
    }

    if (preset.wamState) {
      await this.wamNode.setState(preset.wamState as any);
    }

    if (preset.parameterValues) {
      await this.wamNode.setParameterValues(
        preset.parameterValues as WamParameterDataMap,
      );
    }
  }

  /**
   * Event handling
   */
  on<K extends keyof PluginEvents>(
    event: K,
    handler: PluginEvents[K],
  ): () => void {
    const handlers = this.eventHandlers.get(event as string) || new Set();
    handlers.add(handler);
    this.eventHandlers.set(event as string, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  off<K extends keyof PluginEvents>(event: K, handler: PluginEvents[K]): void {
    const handlers = this.eventHandlers.get(event as string);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Get Tone.js compatible audio node
   */
  getToneNode(): any {
    return this.wamNode;
  }

  /**
   * Connect to Tone.js destination
   */
  connectToTone(destination: any): void {
    if (this.wamNode && destination) {
      this.wamNode.connect(destination);
    }
  }

  /**
   * Disconnect from Tone.js
   */
  disconnectFromTone(): void {
    if (this.wamNode) {
      this.wamNode.disconnect();
    }
  }

  /**
   * Schedule automation event at musical position
   */
  scheduleAutomation(
    parameterId: string,
    value: number,
    position: MusicalPosition,
  ): void {
    if (!this.wamNode) return;

    const mapping = this.parameterMappings.get(parameterId);
    if (!mapping) return;

    // Convert musical position to seconds using UnifiedTransport
    const time = this.transport.musicalPositionToSeconds(position);

    // Apply parameter mapping
    let wamValue = value;
    if (mapping.scalingFactor) {
      wamValue *= mapping.scalingFactor;
    }
    if (mapping.offset) {
      wamValue += mapping.offset;
    }
    if (mapping.inverseMapping) {
      wamValue = 1 - wamValue;
    }

    // Create WAM automation event
    const event: WamAutomationEvent = {
      type: 'wam-automation',
      time,
      data: {
        id: mapping.wamParamId,
        value: wamValue,
        normalized: false,
      },
    };

    // Schedule event
    this.wamNode.scheduleEvents(event);
  }

  /**
   * Schedule MIDI event
   */
  scheduleMidiEvent(midiData: Uint8Array, position: MusicalPosition): void {
    if (!this.wamNode || !this.capabilities.supportsMIDI) return;

    const time = this.transport.musicalPositionToSeconds(position);

    const event: WamMidiEvent = {
      type: 'wam-midi',
      time,
      data: {
        bytes: midiData,
      },
    };

    this.wamNode.scheduleEvents(event);
  }

  /**
   * Get WAM GUI element
   */
  async createGui(): Promise<Element | null> {
    if (!this.wamInstance) return null;

    try {
      return await this.wamInstance.createGui();
    } catch (error) {
      logger.warn(`WAM plugin ${this.metadata.name} does not provide GUI`);
      return null;
    }
  }

  /**
   * Destroy WAM GUI
   */
  destroyGui(gui: Element): void {
    if (this.wamInstance && gui) {
      this.wamInstance.destroyGui(gui);
    }
  }

  /**
   * Get WAM-specific info
   */
  getWamInfo(): {
    descriptor: WamDescriptor;
    instance: WebAudioModule | null;
    node: WamNode | null;
    latency: number;
  } {
    return {
      descriptor: this.wamDescriptor,
      instance: this.wamInstance,
      node: this.wamNode,
      latency: this.timingConfig.reportedLatency,
    };
  }

  // Private helper methods

  private createMetadataFromDescriptor(
    descriptor: WamDescriptor,
  ): PluginMetadata {
    return {
      id: `wam-${descriptor.vendor}-${descriptor.name}`
        .toLowerCase()
        .replace(/\s+/g, '-'),
      name: descriptor.name,
      version: descriptor.version,
      vendor: descriptor.vendor,
      description: `${descriptor.name} by ${descriptor.vendor}`,
      category: descriptor.isInstrument
        ? PluginCategory.INSTRUMENT
        : PluginCategory.EFFECT,
      tags: descriptor.keywords,
      author: descriptor.vendor,
      website: descriptor.website,
      thumbnail: descriptor.thumbnail,
    };
  }

  private createCapabilitiesFromDescriptor(
    descriptor: WamDescriptor,
  ): PluginCapabilities {
    return {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: false,
      supportsAudioWorklet: true, // WAM 2.0 uses AudioWorklet
      supportsMIDI: descriptor.hasMidiInput,
      supportsAutomation: true,
      supportsPresets: true,
      supportsSidechain: false, // Not in WAM descriptor
      supportsMultiChannel: false, // Assume stereo
      maxLatency: 0, // Will be updated after initialization
      cpuUsage: 0.5, // Default estimate
      memoryUsage: 10, // Default estimate MB
      minSampleRate: 44100,
      maxSampleRate: 96000,
      supportedBufferSizes: [128, 256, 512, 1024, 2048],
    };
  }

  private async createParameterMappings(): Promise<void> {
    this.parameters.clear();
    this.parameterMappings.clear();

    for (const [wamParamId, wamParam] of Object.entries(this.wamParameters)) {
      // Create BassNotion parameter
      const paramId = this.sanitizeParameterId(wamParamId);

      const parameter: PluginParameter = {
        id: paramId,
        name: wamParam.label || wamParamId,
        description: `${wamParam.label || wamParamId} (${wamParam.units || ''})`,
        type: this.mapWamParameterType(wamParam.type),
        defaultValue: wamParam.defaultValue,
        min: wamParam.minValue,
        max: wamParam.maxValue,
        step: wamParam.discreteStep,
        unit: wamParam.units,
        options: wamParam.choices?.map((choice, index) => ({
          value: index,
          label: choice,
        })),
        automatable: true,
      };

      this.parameters.set(paramId, parameter);

      // Create mapping
      const mapping: WamParameterMapping = {
        wamParamId,
        bassNotionParamId: paramId,
      };

      this.parameterMappings.set(paramId, mapping);
    }
  }

  private sanitizeParameterId(wamParamId: string): string {
    return wamParamId
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private mapWamParameterType(wamType?: string): PluginParameterType {
    switch (wamType) {
      case 'float':
        return PluginParameterTypeEnum.FLOAT;
      case 'int':
        return PluginParameterTypeEnum.NUMBER;
      case 'boolean':
        return PluginParameterTypeEnum.BOOLEAN;
      case 'choice':
        return PluginParameterTypeEnum.ENUM;
      default:
        return PluginParameterTypeEnum.FLOAT;
    }
  }

  private startTransportSync(): void {
    if (!this.wamNode) return;

    // Subscribe to transport position updates
    this.transport.on('position', this.handleTransportPosition.bind(this));
    this.transport.on(
      'stateChange',
      this.handleTransportStateChange.bind(this),
    );
  }

  private stopTransportSync(): void {
    this.transport.off('position', this.handleTransportPosition.bind(this));
    this.transport.off(
      'stateChange',
      this.handleTransportStateChange.bind(this),
    );
  }

  private handleTransportPosition(
    position: MusicalPosition & { seconds: number },
  ): void {
    if (!this.wamNode || !this.timingConfig.syncMusicalPosition) return;

    // Create transport event for WAM
    const event: WamTransportEvent = {
      type: 'wam-transport',
      time: position.seconds,
      data: {
        playing: this.transport.isPlaying(),
        recording: false, // BassNotion doesn't have recording yet
        hostBpm: this.transport.getTempo(),
        hostCurrentBar: position.bars,
        hostCurrentBarStarted:
          position.seconds - (position.beats * 60) / this.transport.getTempo(),
        hostSampleRate: this.transport.getSampleRate(),
        hostBlockSize: 128, // Our AudioWorklet block size
      },
    };

    this.wamNode.scheduleEvents(event);
  }

  private handleTransportStateChange(state: string): void {
    if (!this.wamNode) return;

    if (state === 'stopped') {
      // Clear all scheduled events when transport stops
      this.wamNode.clearEvents();
    }
  }

  private updateProcessingMetrics(processingTime: number): void {
    this.processingTimeHistory.push(processingTime);

    if (this.processingTimeHistory.length > this.maxHistorySize) {
      this.processingTimeHistory.shift();
    }
  }

  private estimateCpuUsage(processingTime: number): number {
    // Estimate based on processing time vs available time
    const availableTime = (128 / 48000) * 1000; // Block size / sample rate * 1000ms
    return Math.min(processingTime / availableTime, 1);
  }
}
