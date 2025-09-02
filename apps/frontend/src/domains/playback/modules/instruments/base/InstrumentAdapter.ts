/**
 * Instrument Adapter
 * 
 * Adapts existing instrument processors to the new Instrument interface.
 * This allows gradual migration while maintaining backward compatibility.
 */

import { BaseInstrument, type InstrumentConfig, type InstrumentEvent } from './Instrument.js';
import type { InstrumentType } from '../../../services/plugins/TrackManagerProcessor.js';

/**
 * Generic processor interface that existing instruments implement
 */
export interface LegacyProcessor {
  initialize?(context?: any): Promise<void>;
  dispose?(): void;
  // Instrument-specific trigger methods
  [key: string]: any;
}

/**
 * Adapter to wrap existing instrument processors
 */
export class InstrumentAdapter extends BaseInstrument {
  private processor: LegacyProcessor;
  private triggerMethod: string;
  private context?: any;

  constructor(
    config: InstrumentConfig,
    processor: LegacyProcessor,
    triggerMethod: string
  ) {
    super(config);
    this.processor = processor;
    this.triggerMethod = triggerMethod;
  }

  async initialize(context?: any): Promise<void> {
    if (this._state.isInitialized) return;

    this.context = context;
    this._state.isLoading = true;

    try {
      // Call processor's initialize method if it exists
      if (this.processor.initialize) {
        await this.processor.initialize(context);
      }

      this._state.isInitialized = true;
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize: ${error}`;
      throw error;
    }
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      console.warn(`Instrument ${this.name} not initialized`);
      return;
    }

    // Call the processor's trigger method
    const method = this.processor[this.triggerMethod];
    if (typeof method === 'function') {
      // Transform event to processor-specific format
      const processorEvent = this.transformEvent(event);
      method.call(this.processor, processorEvent);
      this._state.isPlaying = true;
    } else {
      console.error(`Trigger method ${this.triggerMethod} not found on processor`);
    }
  }

  stop(noteId: string | number, time?: number): void {
    // Call processor's stop method if it exists
    if (this.processor.stopNote) {
      this.processor.stopNote(noteId, time);
    }
    this._state.isPlaying = false;
  }

  updateParams(params: Partial<InstrumentConfig>): void {
    // Update internal state
    if (params.name !== undefined) this.name = params.name;
    if (params.volume !== undefined) this.setVolume(params.volume);
    if (params.pan !== undefined) this.setPan(params.pan);
    if (params.muted !== undefined) this.setMuted(params.muted);

    // Pass custom config to processor if it has update methods
    if (params.customConfig && this.processor.updateParams) {
      this.processor.updateParams(params.customConfig);
    }
  }

  async dispose(): Promise<void> {
    if (this.processor.dispose) {
      this.processor.dispose();
    }
    this._state.isInitialized = false;
    this._state.isPlaying = false;
    this._destination = null;
  }

  connect(destination: any): void {
    this._destination = destination;
    if (this.processor.connect) {
      this.processor.connect(destination);
    }
  }

  disconnect(): void {
    if (this.processor.disconnect) {
      this.processor.disconnect();
    }
    this._destination = null;
  }

  protected applyVolume(): void {
    if (this.processor.setVolume) {
      this.processor.setVolume(this._volume);
    }
  }

  protected applyPan(): void {
    if (this.processor.setPan) {
      this.processor.setPan(this._pan);
    }
  }

  protected applyMute(): void {
    if (this.processor.setMuted) {
      this.processor.setMuted(this._muted);
    }
  }

  /**
   * Transform generic instrument event to processor-specific format
   */
  private transformEvent(event: InstrumentEvent): any {
    // This will be customized based on the specific processor
    // For now, return a generic format that most processors expect
    return {
      time: event.audioTime,
      velocity: event.velocity ?? 0.8,
      duration: event.duration ?? '8n',
      timestamp: event.timestamp,
      ...event.data,
    };
  }

  /**
   * Get the underlying processor (for advanced use cases)
   */
  getProcessor(): LegacyProcessor {
    return this.processor;
  }
}

/**
 * Factory function to create instrument adapters for specific processor types
 */
export function createInstrumentAdapter(
  type: InstrumentType,
  processor: LegacyProcessor,
  config?: Partial<InstrumentConfig>
): InstrumentAdapter {
  const baseConfig: InstrumentConfig = {
    type,
    name: config?.name ?? type,
    ...config,
  };

  // Map instrument types to their trigger methods
  const triggerMethodMap: Record<InstrumentType, string> = {
    bass: 'triggerNote',
    drums: 'triggerDrum',
    metronome: 'triggerClick',
    harmony: 'triggerChord',
    melody: 'triggerNote',
  };

  const triggerMethod = triggerMethodMap[type] || 'trigger';

  return new InstrumentAdapter(baseConfig, processor, triggerMethod);
}