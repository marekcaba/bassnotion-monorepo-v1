/**
 * DrumKit Instrument
 * 
 * A simplified, modular drum kit implementation that follows the Instrument interface.
 * This implementation wraps the existing DrumInstrumentProcessor for backward compatibility
 * while providing a cleaner interface for the track system.
 */

import { BaseInstrument } from '../../base/Instrument.js';
import type { InstrumentConfig, InstrumentEvent, InstrumentMetrics } from '../../types/index.js';
import type { DrumEvent, DrumKitConfig } from '../../types/index.js';
import { DrumInstrumentProcessor } from './DrumInstrumentProcessor.js';

export interface DrumKitInstrumentConfig extends InstrumentConfig {
  type: 'drums';
  kit?: {
    name: string;
    samples: {
      kick: string[];
      snare: string[];
      hihat: string[];
      openHihat: string[];
      crash: string[];
      ride: string[];
      tom1: string[];
      tom2: string[];
      tom3: string[];
      rimshot: string[];
      clap: string[];
      cowbell: string[];
      tambourine: string[];
      shaker: string[];
    };
  };
  grooveStyle?: string;
  swingAmount?: number;
  humanization?: number;
  velocityLayers?: number;
  roundRobin?: boolean;
}

/**
 * DrumKit instrument implementation
 */
export class DrumKit extends BaseInstrument {
  private processor: DrumInstrumentProcessor;
  private kitSamples: Record<string, string[]>;
  private grooveStyle: string;
  private swingAmount: number;

  constructor(config: DrumKitInstrumentConfig) {
    super(config);
    
    this.kitSamples = config.kit?.samples || {};
    this.grooveStyle = config.grooveStyle || 'straight';
    this.swingAmount = config.swingAmount || 0;

    // Create processor with configuration
    this.processor = new DrumInstrumentProcessor({
      generalMidiCompliance: true,
      velocityLayers: config.velocityLayers || 4,
      humanizationAmount: config.humanization || 0.1,
      loopLength: '4-bars' as any,
      mode: 'pattern' as any,
      grooveStyle: this.grooveStyle as any,
      swingAmount: this.swingAmount,
      fillTriggerMode: 'automatic' as any,
      individualVolumes: this.createDefaultVolumes(),
    });
  }

  async initialize(context?: any): Promise<void> {
    if (this._state.isInitialized) return;

    this._state.isLoading = true;

    try {
      // Convert kit samples to processor format
      const drumSamples: Record<any, string[]> = {};
      
      // Map common drum names to DrumPiece enum values
      const drumMapping = {
        kick: 'KICK',
        snare: 'SNARE',
        hihat: 'HIHAT',
        openHihat: 'HIHAT_OPEN',
        crash: 'CRASH_1',
        ride: 'RIDE',
        tom1: 'TOM_1',
        tom2: 'TOM_2',
        tom3: 'TOM_3',
        rimshot: 'RIMSHOT',
        clap: 'CLAP',
        cowbell: 'COWBELL',
        tambourine: 'TAMBOURINE',
        shaker: 'SHAKER',
      };

      // Convert kit samples to processor format
      for (const [drumName, drumPiece] of Object.entries(drumMapping)) {
        const samples = this.kitSamples[drumName];
        if (samples && samples.length > 0) {
          drumSamples[drumPiece as any] = samples;
        }
      }

      await this.processor.initialize(drumSamples);
      
      this._state.isInitialized = true;
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize drum kit: ${error}`;
      throw error;
    }
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      console.warn(`DrumKit ${this.name} not initialized`);
      return;
    }

    // Extract drum-specific data
    const drumEvent = event.data as DrumEvent;
    
    // Call processor's trigger method
    this.processor.triggerDrum({
      drum: drumEvent?.drum || 'kick',
      velocity: event.velocity || 0.8,
      time: event.audioTime,
      duration: event.duration || '16n',
    });

    this._state.isPlaying = true;
  }

  /**
   * Trigger specific drum piece
   */
  triggerDrum(drum: string, velocity: number = 0.8, time?: number): void {
    if (!this._state.isInitialized) {
      console.warn('DrumKit not initialized');
      return;
    }
    
    this.processor.triggerDrum({
      drum,
      velocity,
      time: time || Date.now() / 1000,
      duration: '16n',
    });
  }

  /**
   * Set groove style
   */
  setGrooveStyle(style: string): void {
    this.grooveStyle = style;
    // Update processor if it has this method
    if ((this.processor as any).setGrooveStyle) {
      (this.processor as any).setGrooveStyle(style);
    }
  }

  /**
   * Set swing amount
   */
  setSwingAmount(amount: number): void {
    this.swingAmount = Math.max(0, Math.min(100, amount));
    // Update processor if it has this method
    if ((this.processor as any).setSwingAmount) {
      (this.processor as any).setSwingAmount(this.swingAmount);
    }
  }

  /**
   * Set individual drum volumes
   */
  setDrumVolume(drum: string, volume: number): void {
    // Update processor if it has this method
    if ((this.processor as any).setDrumVolume) {
      (this.processor as any).setDrumVolume(drum, volume);
    }
  }

  updateParams(params: Partial<DrumKitInstrumentConfig>): void {
    super.updateParams(params);
    
    if (params.grooveStyle !== undefined) {
      this.setGrooveStyle(params.grooveStyle);
    }
    
    if (params.swingAmount !== undefined) {
      this.setSwingAmount(params.swingAmount);
    }
    
    if (params.kit?.samples) {
      this.kitSamples = params.kit.samples;
      // Would need to reinitialize with new samples
    }
  }

  async dispose(): Promise<void> {
    this.processor.dispose();
    this._state.isInitialized = false;
    this._state.isPlaying = false;
  }

  connect(destination: any): void {
    this._destination = destination;
    // Processor handles its own connections internally
  }

  disconnect(): void {
    this._destination = null;
    // Processor handles its own connections internally
  }

  protected applyVolume(): void {
    // Update master volume on processor
    if ((this.processor as any).setMasterVolume) {
      (this.processor as any).setMasterVolume(this._volume);
    }
  }

  protected applyPan(): void {
    // Drums typically use stereo positioning per piece
    // Could be implemented with custom audio routing
  }

  protected applyMute(): void {
    if (this._muted && this._state.isPlaying) {
      // Stop all playing drums
      this.processor.stop();
    }
  }

  getMetrics(): InstrumentMetrics {
    const baseMetrics = super.getMetrics();
    
    // Add drum-specific metrics
    const kitInfo = this.getKitInfo();
    
    return {
      ...baseMetrics,
      cpuUsage: this._state.isPlaying ? 5 : 0, // Moderate CPU usage
      memoryUsage: kitInfo.totalSamples * 0.5, // Estimate 0.5MB per sample
      voiceCount: this._state.isPlaying ? 1 : 0,
      latency: 10, // Typical drum sample latency
    };
  }

  /**
   * Get current kit information
   */
  getKitInfo(): {
    name: string;
    totalSamples: number;
    loadedDrums: string[];
  } {
    return {
      name: this.name,
      totalSamples: Object.values(this.kitSamples).reduce((total, samples) => total + samples.length, 0),
      loadedDrums: Object.keys(this.kitSamples),
    };
  }

  /**
   * Get available drum pieces
   */
  getAvailableDrums(): string[] {
    return Object.keys(this.kitSamples);
  }

  /**
   * Load a different drum kit
   */
  async loadKit(kitConfig: DrumKitConfig): Promise<void> {
    this.kitSamples = kitConfig.samples;
    
    if (this._state.isInitialized) {
      // Reinitialize with new samples
      await this.initialize();
    }
  }

  private createDefaultVolumes() {
    return {
      kick: 0.9,
      snare: 0.8,
      hihat: 0.6,
      openHat: 0.7,
      crash: 0.8,
      ride: 0.7,
      tom1: 0.7,
      tom2: 0.7,
      tom3: 0.7,
      clap: 0.6,
      cowbell: 0.5,
      tambourine: 0.4,
      master: 0.8,
    };
  }
}