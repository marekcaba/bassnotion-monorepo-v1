/**
 * Bass Instrument
 * 
 * A modular bass instrument implementation that follows the Instrument interface.
 * This implementation wraps the existing BassInstrumentProcessor for backward compatibility
 * while providing a cleaner interface for the track system.
 */

import { Sampler } from '../../base/Sampler.js';
import type { InstrumentConfig, InstrumentEvent, InstrumentMetrics } from '../../types/index.js';
import type { BassEvent, BassConfig } from '../../types/index.js';
import { BassInstrumentProcessor } from './BassInstrumentProcessor.js';

export interface BassInstrumentConfig extends InstrumentConfig {
  type: 'bass';
  noteRange?: {
    lowest: string;
    highest: string;
  };
  samples?: Record<string, string[]>;
  useSynth?: boolean;
  synthType?: 'sawtooth' | 'square' | 'triangle' | 'sine';
  ampSimulation?: boolean;
  velocityLayers?: number;
  articulationSupport?: string[];
  pitchBendRange?: number;
}

/**
 * Bass instrument implementation
 */
export class BassInstrument extends Sampler {
  private processor: BassInstrumentProcessor;
  private noteRange: { lowest: string; highest: string };
  private useSynth: boolean;
  private synthType: string;

  constructor(config: BassInstrumentConfig) {
    super({
      ...config,
      samples: config.samples,
      velocityLayers: config.velocityLayers || 6,
      roundRobin: true,
    });
    
    this.noteRange = config.noteRange || { lowest: 'B0', highest: 'G4' };
    this.useSynth = config.useSynth ?? true; // Default to synth if no samples
    this.synthType = config.synthType || 'sawtooth';

    // Create processor with configuration
    this.processor = new BassInstrumentProcessor({
      noteRange: {
        lowest: this.noteRange.lowest,
        highest: this.noteRange.highest,
        totalNotes: 41,
      },
      velocityLayers: config.velocityLayers || 6,
      roundRobinVariations: 3,
      articulationSupport: (config.articulationSupport || []) as any,
      pitchBendRange: config.pitchBendRange || 2,
      ampSimulation: {
        enabled: config.ampSimulation ?? true,
        preamp: { gain: 0.7, tone: 0.6, presence: 0.5 },
        eq: { bass: 0.6, mid: 0.5, treble: 0.4 },
        compression: { threshold: -18, ratio: 3, attack: 0.003, release: 0.1 },
        cabinet: { model: 'vintage', micPosition: 'close' },
      },
      dynamicRange: {
        velocityCurve: 'exponential',
        dynamicResponse: 0.8,
        noiseGate: { threshold: -60, ratio: 10 },
      },
    });
  }

  async initialize(context?: any): Promise<void> {
    if (this._state.isInitialized) return;

    this._state.isLoading = true;

    try {
      // Convert kit samples to processor format
      const bassSamples: Record<string, string[]> = {};
      
      if (this.samples.size > 0 || Object.keys(this.samples).length > 0) {
        // Use provided samples
        for (const [note, loadedSamples] of this.samples) {
          bassSamples[note] = loadedSamples.map(s => s.buffer || '');
        }
      } else if (!this.useSynth) {
        // Generate empty sample map for bass notes
        const bassNotes = this.generateBassNotes();
        bassNotes.forEach(note => {
          bassSamples[note] = []; // Empty array will trigger synth fallback
        });
      }

      await this.processor.initialize(bassSamples);
      
      this._state.isInitialized = true;
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize bass: ${error}`;
      throw error;
    }
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      console.warn(`Bass ${this.name} not initialized`);
      return;
    }

    // Extract bass-specific data
    const bassEvent = event.data as BassEvent;
    
    // Call processor's trigger method
    this.processor.triggerNote({
      note: bassEvent?.note || 'E2',
      velocity: event.velocity || 0.8,
      time: event.audioTime,
      duration: event.duration || '8n',
    });

    this._state.isPlaying = true;
  }

  /**
   * Stop a specific note
   */
  stop(note: string | number, time?: number): void {
    if (!this._state.isInitialized) return;

    if (typeof note === 'string') {
      // Parse note string (e.g., "C3" -> note: "C", octave: 3)
      const noteMatch = note.match(/([A-G]#?)(\d)/);
      if (noteMatch) {
        const [, noteName, octaveStr] = noteMatch;
        const octave = parseInt(octaveStr, 10);
        this.processor.stopNote(noteName, octave, time);
      }
    }
    
    this._state.isPlaying = false;
  }

  /**
   * Trigger specific bass note
   */
  playNote(note: string, velocity: number = 0.8, duration: string = '8n', time?: number): void {
    if (!this._state.isInitialized) {
      console.warn('Bass not initialized');
      return;
    }
    
    this.processor.triggerNote({
      note,
      velocity,
      time: time || Date.now() / 1000,
      duration,
    });
  }

  /**
   * Set pitch bend
   */
  setPitchBend(pitchBend: number): void {
    this.processor.updatePitchBend(pitchBend);
  }

  /**
   * Update expression controls
   */
  updateExpression(expression: {
    pitchBend?: number;
    modulation?: number;
    expression?: number;
    aftertouch?: number;
    sustainPedal?: boolean;
  }): void {
    this.processor.updateExpression(expression);
  }

  updateParams(params: Partial<BassInstrumentConfig>): void {
    super.updateParams(params);
    
    if (params.synthType !== undefined) {
      this.synthType = params.synthType;
      // Would need to reinitialize processor with new synth type
    }
    
    if (params.samples) {
      // Would need to reload samples
      this.loadSamples(params.samples);
    }
  }

  async dispose(): Promise<void> {
    this.processor.dispose();
    this.clearSamples();
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
    // Update expression to affect volume
    this.processor.updateExpression({
      expression: Math.round(this._volume * 127),
    });
  }

  protected applyPan(): void {
    // Bass is typically mono, but could implement stereo width
  }

  protected applyMute(): void {
    if (this._muted && this._state.isPlaying) {
      // Stop all playing notes
      // Would need note tracking to stop specific notes
    }
  }

  protected async performSampleLoading(sampleMap: any): Promise<void> {
    // Convert sampleMap to our internal format
    for (const [note, urls] of Object.entries(sampleMap)) {
      if (Array.isArray(urls)) {
        const loadedSamples = urls.map((url, index) => ({
          buffer: url, // In real implementation, this would be the loaded AudioBuffer
          note,
          roundRobinIndex: index,
        }));
        this.samples.set(note, loadedSamples);
      }
    }
  }

  getMetrics(): InstrumentMetrics {
    const baseMetrics = super.getMetrics();
    const status = this.processor.getStatus();
    
    return {
      ...baseMetrics,
      cpuUsage: this._state.isPlaying ? 3 : 0, // Moderate CPU usage
      memoryUsage: status.loadedSamples * 0.3, // Estimate 0.3MB per sample
      voiceCount: this._state.isPlaying ? 1 : 0, // Bass is monophonic
      latency: 15, // Typical bass processing latency
    };
  }

  /**
   * Get current bass status
   */
  getBassStatus() {
    return this.processor.getStatus();
  }

  /**
   * Get supported note range
   */
  getNoteRange(): { lowest: string; highest: string } {
    return this.noteRange;
  }

  private generateBassNotes(): string[] {
    // Generate standard bass guitar notes from B0 to G4
    const notes = ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#'];
    const bassNotes: string[] = [];
    
    // B0
    bassNotes.push('B0');
    
    // C1 to G4
    for (let octave = 1; octave <= 4; octave++) {
      for (const note of notes) {
        bassNotes.push(`${note}${octave}`);
        if (note === 'G' && octave === 4) break; // Stop at G4
      }
    }
    
    return bassNotes;
  }
}