/**
 * BaseAudioPlugin - Foundation class for audio plugins
 *
 * Provides common implementation patterns and utilities for building
 * audio plugins that integrate with the plugin architecture system.
 *
 * Part of Story 2.1: Task 1, Subtask 1.4
 */

import * as Tone from 'tone';
import {
  AudioPlugin,
  PluginMetadata,
  PluginConfig,
  PluginState,
  PluginCapabilities,
  PluginParameter,
  PluginEvents,
  PluginAudioContext,
  PluginProcessingResult,
} from '../types/plugin';
import type { ErrorContext } from '../services/errors/base';

export abstract class BaseAudioPlugin implements AudioPlugin {
  // Required plugin properties
  public abstract readonly metadata: PluginMetadata;
  public abstract readonly config: PluginConfig;
  public abstract readonly capabilities: PluginCapabilities;

  // Plugin state management
  protected _state: PluginState = PluginState.UNLOADED;
  protected _parameters: Map<string, PluginParameter> = new Map();
  protected _parameterValues: Map<string, unknown> = new Map();

  // Event handling
  protected _eventHandlers: Map<
    keyof PluginEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  // Tone.js integration
  protected _toneNode: Tone.ToneAudioNode | null = null;
  protected _audioContext: PluginAudioContext | null = null;

  constructor() {
    this.initializeEventHandlers();
    this.initializeParameters();
  }

  // Required interface implementation
  public get state(): PluginState {
    return this._state;
  }

  public get parameters(): Map<string, PluginParameter> {
    return this._parameters;
  }

  /**
   * Plugin lifecycle methods
   */
  public async load(): Promise<void> {
    if (this._state !== PluginState.UNLOADED) {
      console.warn(`Plugin ${this.metadata.id} is not in unloaded state`);
      return;
    }

    try {
      this._state = PluginState.LOADING;
      await this.onLoad();
      this._state = PluginState.LOADED;
      this.emit('loaded');
    } catch (error) {
      this._state = PluginState.ERROR;
      this.handleError(error as Error);
      throw error;
    }
  }

  public async initialize(context: PluginAudioContext): Promise<void> {
    if (this._state !== PluginState.LOADED) {
      throw new Error(
        `Plugin ${this.metadata.id} must be loaded before initialization`,
      );
    }

    try {
      this._state = PluginState.INITIALIZING;
      this._audioContext = context;
      await this.onInitialize(context);
      this._state = PluginState.INACTIVE;
      this.emit('initialized');
    } catch (error) {
      this._state = PluginState.ERROR;
      this.handleError(error as Error);
      throw error;
    }
  }

  public async activate(): Promise<void> {
    if (this._state !== PluginState.INACTIVE) {
      throw new Error(
        `Plugin ${this.metadata.id} must be inactive before activation`,
      );
    }

    try {
      await this.onActivate();
      this._state = PluginState.ACTIVE;
      this.emit('activated');
    } catch (error) {
      this._state = PluginState.ERROR;
      this.handleError(error as Error);
      throw error;
    }
  }

  public async deactivate(): Promise<void> {
    if (this._state !== PluginState.ACTIVE) {
      throw new Error(
        `Plugin ${this.metadata.id} must be active before deactivation`,
      );
    }

    try {
      await this.onDeactivate();
      this._state = PluginState.INACTIVE;
      this.emit('deactivated');
    } catch (error) {
      this._state = PluginState.ERROR;
      this.handleError(error as Error);
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    try {
      // Store current state before setting to disposing
      const wasActive = this._state === PluginState.ACTIVE;
      this._state = PluginState.DISPOSING;

      // Deactivate if was active
      if (wasActive) {
        // Temporarily reset state to active so deactivate can work
        this._state = PluginState.ACTIVE;
        await this.deactivate();
        this._state = PluginState.DISPOSING;
      }

      // Clean up resources
      await this.onDispose();

      // Clear event handlers
      this._eventHandlers.clear();

      // Disconnect from Tone.js
      if (this._toneNode) {
        this._toneNode.dispose();
        this._toneNode = null;
      }

      this._state = PluginState.UNLOADED;
      this.emit('disposed');
    } catch (error) {
      this._state = PluginState.ERROR;
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Audio processing (must be implemented by subclasses)
   */
  public abstract process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    context: PluginAudioContext,
  ): Promise<PluginProcessingResult>;

  /**
   * Parameter management
   */
  public async setParameter(
    parameterId: string,
    value: unknown,
  ): Promise<void> {
    const parameter = this._parameters.get(parameterId);
    if (!parameter) {
      throw new Error(`Parameter ${parameterId} not found`);
    }

    // Validate parameter value
    const validatedValue = this.validateParameterValue(parameter, value);

    // Store the value
    this._parameterValues.set(parameterId, validatedValue);

    // Apply the parameter change
    await this.onParameterChanged(parameterId, validatedValue);

    this.emit('parameterChanged', parameterId, validatedValue);
  }

  public getParameter(parameterId: string): unknown {
    return this._parameterValues.get(parameterId);
  }

  public async resetParameters(): Promise<void> {
    for (const [parameterId, parameter] of Array.from(
      this._parameters.entries(),
    )) {
      await this.setParameter(parameterId, parameter.defaultValue);
    }
  }

  /**
   * Preset management
   */
  public async savePreset(name: string): Promise<Record<string, unknown>> {
    const preset: Record<string, unknown> = {
      name,
      pluginId: this.metadata.id,
      version: this.metadata.version,
      parameters: {},
    };

    // Save all parameter values
    for (const parameterId of Array.from(this._parameters.keys())) {
      preset.parameters = {
        ...(preset.parameters as object),
        [parameterId]: this.getParameter(parameterId),
      };
    }

    return preset;
  }

  public async loadPreset(preset: Record<string, unknown>): Promise<void> {
    if (preset.pluginId !== this.metadata.id) {
      throw new Error(
        `Preset is for plugin ${preset.pluginId}, not ${this.metadata.id}`,
      );
    }

    const parameters = preset.parameters as Record<string, unknown>;
    if (parameters) {
      for (const [parameterId, value] of Object.entries(parameters)) {
        if (this._parameters.has(parameterId)) {
          await this.setParameter(parameterId, value);
        }
      }
    }
  }

  /**
   * Event handling
   */
  public on<K extends keyof PluginEvents>(
    event: K,
    handler: PluginEvents[K],
  ): () => void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }

    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler as (...args: any[]) => void);

      return () => handlers.delete(handler as (...args: any[]) => void);
    }

    return () => {
      // No-op function when handlers don't exist
    };
  }

  public off<K extends keyof PluginEvents>(
    event: K,
    handler: PluginEvents[K],
  ): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as (...args: any[]) => void);
    }
  }

  /**
   * Tone.js integration (optional)
   */
  public getToneNode(): Tone.ToneAudioNode | null {
    return this._toneNode;
  }

  public connectToTone(destination: Tone.ToneAudioNode): void {
    if (this._toneNode) {
      this._toneNode.connect(destination);
    }
  }

  public disconnectFromTone(): void {
    if (this._toneNode) {
      this._toneNode.disconnect();
    }
  }

  /**
   * Epic 2 integration (optional - can be overridden)
   */
  public async processN8nPayload?(payload: unknown): Promise<void> {
    console.log(`Plugin ${this.metadata.id} received n8n payload:`, payload);
    // Default implementation - plugins can override
  }

  public async loadAsset?(
    assetId: string,
    _asset: AudioBuffer | ArrayBuffer,
  ): Promise<void> {
    console.log(`Plugin ${this.metadata.id} received asset ${assetId}`);
    // Default implementation - plugins can override
  }

  public async optimizeForMobile?(): Promise<void> {
    console.log(`Plugin ${this.metadata.id} optimizing for mobile`);
    // Default implementation - plugins can override
  }

  // Protected methods for subclasses to override

  protected abstract onLoad(): Promise<void>;
  protected abstract onInitialize(context: PluginAudioContext): Promise<void>;
  protected abstract onActivate(): Promise<void>;
  protected abstract onDeactivate(): Promise<void>;
  protected abstract onDispose(): Promise<void>;
  protected abstract onParameterChanged(
    parameterId: string,
    value: unknown,
  ): Promise<void>;

  // Utility methods

  protected addParameter(parameter: PluginParameter): void {
    this._parameters.set(parameter.id, parameter);
    this._parameterValues.set(parameter.id, parameter.defaultValue);
  }

  protected validateParameterValue(
    parameter: PluginParameter,
    value: unknown,
  ): unknown {
    switch (parameter.type) {
      case 'number': {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error(`Parameter ${parameter.id} must be a number`);
        }
        if (parameter.min !== undefined && numValue < parameter.min) {
          return parameter.min;
        }
        if (parameter.max !== undefined && numValue > parameter.max) {
          return parameter.max;
        }
        return numValue;
      }

      case 'boolean':
        return Boolean(value);

      case 'string':
        return String(value);

      case 'enum':
        if (
          parameter.options &&
          !parameter.options.some((opt) => opt.value === value)
        ) {
          throw new Error(
            `Parameter ${parameter.id} must be one of: ${parameter.options.map((opt) => opt.value).join(', ')}`,
          );
        }
        return value;

      default:
        return value;
    }
  }

  protected emit(event: keyof PluginEvents, ...args: any[]): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in plugin event handler for ${event}:`, error);
        }
      });
    }
  }

  protected handleError(error: Error): void {
    const context: ErrorContext = {
      timestamp: Date.now(),
      currentOperation: `Plugin ${this.metadata.id} operation`,
    };

    this.emit('error', error, context);
  }

  private initializeEventHandlers(): void {
    const events: Array<keyof PluginEvents> = [
      'loaded',
      'initialized',
      'activated',
      'deactivated',
      'disposed',
      'error',
      'audioProcessed',
      'parameterChanged',
    ];

    events.forEach((event) => {
      this._eventHandlers.set(event, new Set());
    });
  }

  private initializeParameters(): void {
    // Subclasses should override this to define their parameters
  }
}
