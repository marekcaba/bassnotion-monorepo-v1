/**
 * BaseAudioPlugin - Abstract base class for audio plugins
 *
 * Provides a standard implementation foundation for all audio plugins
 * in the system, implementing the AudioPlugin interface with common
 * lifecycle management and state handling.
 */

import type {
  AudioPlugin,
  PluginMetadata,
  PluginConfig,
  PluginState,
  PluginCapabilities,
  PluginParameter,
  PluginAudioContext,
  PluginProcessingResult,
  ProcessingResultStatus,
} from '../types/plugin.js';
import { EventEmitter } from 'events';

export abstract class BaseAudioPlugin
  extends EventEmitter
  implements AudioPlugin
{
  abstract readonly metadata: PluginMetadata;
  abstract readonly config: PluginConfig;
  abstract readonly capabilities: PluginCapabilities;

  protected _state: PluginState = 'unloaded';
  protected _parameters = new Map<string, PluginParameter>();
  protected _context: PluginAudioContext | null = null;
  protected _isProcessing = false;

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
    if (this._state !== 'unloaded') {
      throw new Error(`Cannot load plugin in state: ${this._state}`);
    }

    this._state = 'loading';

    try {
      await this.onLoad();
      this._state = 'loaded';
      this.emit('loaded');
    } catch (error) {
      this._state = 'error';
      this.emit('error', error, { phase: 'load' });
      throw error;
    }
  }

  /**
   * Initialize plugin with audio context
   */
  async initialize(context: PluginAudioContext): Promise<void> {
    if (this._state !== 'loaded') {
      throw new Error(`Cannot initialize plugin in state: ${this._state}`);
    }

    this._state = 'initializing';
    this._context = context;

    try {
      await this.onInitialize(context);
      this._state = 'inactive';
      this.emit('initialized');
    } catch (error) {
      this._state = 'error';
      this.emit('error', error, { phase: 'initialize' });
      throw error;
    }
  }

  /**
   * Activate plugin for processing
   */
  async activate(): Promise<void> {
    if (this._state !== 'inactive') {
      throw new Error(`Cannot activate plugin in state: ${this._state}`);
    }

    try {
      await this.onActivate();
      this._state = 'active';
      this.emit('activated');
    } catch (error) {
      this._state = 'error';
      this.emit('error', error, { phase: 'activate' });
      throw error;
    }
  }

  /**
   * Deactivate plugin processing
   */
  async deactivate(): Promise<void> {
    if (this._state !== 'active') {
      throw new Error(`Cannot deactivate plugin in state: ${this._state}`);
    }

    // Wait for any ongoing processing to complete
    while (this._isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    try {
      await this.onDeactivate();
      this._state = 'inactive';
      this.emit('deactivated');
    } catch (error) {
      this._state = 'error';
      this.emit('error', error, { phase: 'deactivate' });
      throw error;
    }
  }

  /**
   * Dispose of plugin resources
   */
  async dispose(): Promise<void> {
    if (this._state === 'disposing' || this._state === 'unloaded') {
      return;
    }

    this._state = 'disposing';

    try {
      // Deactivate if active
      if (this._state === 'active') {
        await this.deactivate();
      }

      await this.onDispose();
      this._state = 'unloaded';
      this._context = null;
      this._parameters.clear();
      this.emit('disposed');
      this.removeAllListeners();
    } catch (error) {
      this.emit('error', error, { phase: 'dispose' });
      throw error;
    }
  }

  /**
   * Process audio - delegates to implementation
   */
  async processAudio(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    parameters?: Map<string, unknown>,
  ): Promise<PluginProcessingResult> {
    if (this._state !== 'active') {
      return {
        success: false,
        status: 'bypassed' as ProcessingResultStatus,
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
        parameters,
      );
      this.emit('audioProcessed', inputBuffer, outputBuffer);
      return result;
    } catch (error) {
      this.emit('error', error, { phase: 'process' });
      return {
        success: false,
        status: 'error' as ProcessingResultStatus,
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
  setParameter(id: string, value: unknown): void {
    const param = this._parameters.get(id);
    if (!param) {
      throw new Error(`Unknown parameter: ${id}`);
    }

    // TODO: Add validation based on parameter type
    this.onParameterChanged(id, value);
    this.emit('parameterChanged', id, value);
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
    return this._state === 'active' && this._context !== null;
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
    parameters?: Map<string, unknown>,
  ): Promise<PluginProcessingResult>;
  protected abstract onParameterChanged(id: string, value: unknown): void;
}
