/**
 * BaseAudioPlugin - Abstract base class for audio plugins
 *
 * Provides a standard implementation foundation for all audio plugins
 * in the system, implementing the AudioPlugin interface with common
 * lifecycle management and state handling.
 */

import {
  PluginState,
  ProcessingResultStatus,
  type AudioPlugin,
  type PluginMetadata,
  type PluginConfig,
  type PluginCapabilities,
  type PluginParameter,
  type PluginAudioContext,
  type PluginProcessingResult,
  type PluginEvents,
} from '../../../types/plugin.js';
import { EventEmitter } from 'events';

export abstract class BaseAudioPlugin implements AudioPlugin {
  abstract readonly metadata: PluginMetadata;
  abstract readonly config: PluginConfig;
  abstract readonly capabilities: PluginCapabilities;

  protected _state: PluginState = PluginState.UNLOADED;
  protected _parameters = new Map<string, PluginParameter>();
  protected _context: PluginAudioContext | null = null;
  protected _isProcessing = false;
  protected _emitter = new EventEmitter();

  get state(): PluginState {
    return this._state;
  }

  get parameters(): Map<string, PluginParameter> {
    return new Map(this._parameters);
  }

  /**
   * Load plugin resources
   */
  async load(): Promise<void> {
    if (this._state !== PluginState.UNLOADED) {
      throw new Error(`Cannot load plugin in state: ${this._state}`);
    }

    this._state = PluginState.LOADING;

    try {
      await this.onLoad();
      this._state = PluginState.LOADED;
      this._emitter.emit(PluginState.LOADED);
    } catch (error) {
      this._state = PluginState.ERROR;
      this._emitter.emit(PluginState.ERROR, error, { phase: 'load' });
      throw error;
    }
  }

  /**
   * Initialize plugin with audio context
   */
  async initialize(context: PluginAudioContext): Promise<void> {
    if (this._state !== PluginState.LOADED) {
      throw new Error(`Cannot initialize plugin in state: ${this._state}`);
    }

    this._state = PluginState.INITIALIZING;
    this._context = context;

    try {
      await this.onInitialize(context);
      this._state = PluginState.INACTIVE;
      this._emitter.emit('initialized');
    } catch (error) {
      this._state = PluginState.ERROR;
      this._emitter.emit(PluginState.ERROR, error, { phase: 'initialize' });
      throw error;
    }
  }

  /**
   * Activate plugin for processing
   */
  async activate(): Promise<void> {
    if (this._state !== PluginState.INACTIVE) {
      throw new Error(`Cannot activate plugin in state: ${this._state}`);
    }

    try {
      await this.onActivate();
      this._state = PluginState.ACTIVE;
      this._emitter.emit('activated');
    } catch (error) {
      this._state = PluginState.ERROR;
      this._emitter.emit(PluginState.ERROR, error, { phase: 'activate' });
      throw error;
    }
  }

  /**
   * Deactivate plugin processing
   */
  async deactivate(): Promise<void> {
    if (this._state !== PluginState.ACTIVE) {
      throw new Error(`Cannot deactivate plugin in state: ${this._state}`);
    }

    // Wait for any ongoing processing to complete
    while (this._isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    try {
      await this.onDeactivate();
      this._state = PluginState.INACTIVE;
      this._emitter.emit('deactivated');
    } catch (error) {
      this._state = PluginState.ERROR;
      this._emitter.emit(PluginState.ERROR, error, { phase: 'deactivate' });
      throw error;
    }
  }

  /**
   * Dispose of plugin resources
   */
  async dispose(): Promise<void> {
    if (
      this._state === PluginState.DISPOSING ||
      this._state === PluginState.UNLOADED
    ) {
      return;
    }

    // Store current state before changing to disposing
    const previousState = this._state;
    this._state = PluginState.DISPOSING;

    try {
      // Deactivate if was active
      if (previousState === PluginState.ACTIVE) {
        // Temporarily restore state for deactivate to work
        this._state = PluginState.ACTIVE;
        await this.deactivate();
        // Set back to disposing
        this._state = PluginState.DISPOSING;
      }

      await this.onDispose();
      this._state = PluginState.UNLOADED;
      this._context = null;
      this._parameters.clear();
      this._emitter.emit('disposed');
      this._emitter.removeAllListeners();
    } catch (error) {
      this._emitter.emit(PluginState.ERROR, error, { phase: 'dispose' });
      throw error;
    }
  }

  /**
   * Process audio - delegates to implementation
   */
  async process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    if (this._state !== PluginState.ACTIVE) {
      return {
        success: false,
        status: ProcessingResultStatus.BYPASSED,
        processingTime: 0,
        bypassMode: true,
        processedSamples: 0,
        cpuUsage: 0,
      };
    }

    this._isProcessing = true;
    const startTime = performance.now();

    try {
      const result = await this.onProcessAudio(
        inputBuffer,
        outputBuffer,
        context,
      );
      this._emitter.emit('audioProcessed', inputBuffer, outputBuffer);
      return result;
    } catch (error) {
      this._emitter.emit(PluginState.ERROR, error, { phase: 'process' });
      return {
        success: false,
        status: ProcessingResultStatus.ERROR,
        processingTime: performance.now() - startTime,
        bypassMode: false,
        processedSamples: 0,
        cpuUsage: 0,
        error: {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
      };
    } finally {
      this._isProcessing = false;
    }
  }

  /**
   * Get parameter value
   */
  getParameter(id: string): unknown {
    const param = this._parameters.get(id);
    return param?.defaultValue;
  }

  /**
   * Set parameter value
   */
  async setParameter(id: string, value: unknown): Promise<void> {
    const param = this._parameters.get(id);
    if (!param) {
      throw new Error(`Unknown parameter: ${id}`);
    }

    // TODO: Add validation based on parameter type
    await this.onParameterChanged(id, value);
    this._emitter.emit('parameterChanged', id, value);
  }

  /**
   * Get current state
   */
  getState(): PluginState {
    return this._state;
  }

  /**
   * Check if processing is supported
   */
  canProcess(): boolean {
    return this._state === PluginState.ACTIVE && this._context !== null;
  }

  /**
   * Reset all parameters to default values
   */
  async resetParameters(): Promise<void> {
    for (const [id, param] of this._parameters) {
      await this.setParameter(id, param.defaultValue);
    }
  }

  /**
   * Save current parameter values as a preset
   */
  async savePreset(name: string): Promise<Record<string, unknown>> {
    const preset: Record<string, unknown> = {
      name,
      timestamp: Date.now(),
      parameters: {},
    };

    for (const [id, param] of this._parameters) {
      (preset.parameters as Record<string, unknown>)[id] =
        this.getParameter(id) ?? param.defaultValue;
    }

    return preset;
  }

  /**
   * Load parameter values from a preset
   */
  async loadPreset(preset: Record<string, unknown>): Promise<void> {
    if (!preset.parameters || typeof preset.parameters !== 'object') {
      throw new Error('Invalid preset format');
    }

    const parameters = preset.parameters as Record<string, unknown>;
    for (const [id, value] of Object.entries(parameters)) {
      if (this._parameters.has(id)) {
        await this.setParameter(id, value);
      }
    }
  }

  /**
   * Add event listener - implements AudioPlugin interface
   */
  on<K extends keyof PluginEvents>(
    event: K,
    handler: PluginEvents[K],
  ): () => void {
    this._emitter.on(event as string, handler as any);
    // Return unsubscribe function
    return () => this._emitter.off(event as string, handler as any);
  }

  /**
   * Remove event listener - implements AudioPlugin interface
   */
  off<K extends keyof PluginEvents>(event: K, handler: PluginEvents[K]): void {
    this._emitter.off(event as string, handler as any);
  }

  // Abstract methods for subclasses to implement
  protected abstract onLoad(): Promise<void>;
  protected abstract onInitialize(context: PluginAudioContext): Promise<void>;
  protected abstract onActivate(): Promise<void>;
  protected abstract onDeactivate(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
  protected abstract onProcessAudio(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult>;
  protected abstract onParameterChanged(
    id: string,
    value: unknown,
  ): Promise<void>;
}
