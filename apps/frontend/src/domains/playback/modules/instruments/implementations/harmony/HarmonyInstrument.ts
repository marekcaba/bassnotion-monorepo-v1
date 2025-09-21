/**
 * Harmony Instrument
 *
 * A modular harmony/chord instrument implementation that follows the Instrument interface.
 * This implementation wraps the existing WamHarmonyProcessor for backward compatibility
 * while providing a cleaner interface for the track system.
 */

import { BaseInstrument } from '../../base/Instrument.js';
import type {
  InstrumentConfig,
  InstrumentEvent,
  InstrumentMetrics,
} from '../../types/index.js';
import type { ChordEvent } from '../../types/index.js';
import { WamHarmonyProcessor } from '../../adapters/wam/WamHarmonyProcessor.js';
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('HarmonyInstrument');

export interface HarmonyInstrumentConfig extends InstrumentConfig {
  type: 'chords';
  instrument?: 'piano' | 'rhodes' | 'wurlitzer' | 'organ';
  samples?: Record<string, string>;
  useWAM?: boolean;
  wamPlugin?: string;
  voicing?: 'close' | 'open' | 'drop2' | 'drop3';
  velocitySensitivity?: number;
  sustainPedal?: boolean;
}

/**
 * Harmony instrument implementation
 */
export class HarmonyInstrument extends BaseInstrument {
  private processor: WamHarmonyProcessor;
  private instrument: string;
  private voicing: string;
  private samples: Record<string, string>;
  private _useWAM: boolean;
  private audioEngine?: any;

  constructor(config: HarmonyInstrumentConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;

    this.instrument = config.instrument || 'piano';
    this.voicing = config.voicing || 'close';
    this.samples = config.samples || {};
    this._useWAM = config.useWAM ?? true;

    // Create processor
    this.processor = new WamHarmonyProcessor();
  }

  async initialize(context?: any, audioEngine?: any): Promise<void> {
    if (this._state.isInitialized) return;

    this._state.isLoading = true;

    // Support both context and audioEngine parameters
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    try {
      // Initialize processor with audio context
      const audioContext =
        context ||
        (window as any).AudioContext ||
        (window as any).webkitAudioContext;
      // Pass audioEngine to processor if it supports it
      await this.processor.initialize(audioContext, this.audioEngine);

      this._state.isInitialized = true;
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize harmony: ${error}`;
      throw error;
    }
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      logger.warn(`Harmony ${this.name} not initialized`);
      return;
    }

    // Extract chord-specific data
    const chordEvent = event.data as ChordEvent;

    // Call processor's trigger method
    this.processor.triggerChord({
      chord: chordEvent?.chord || 'C',
      notes: chordEvent?.notes || ['C4', 'E4', 'G4'],
      velocity: event.velocity || 0.8,
      time: event.audioTime,
      duration:
        (typeof event.duration === 'string' ? event.duration : undefined) ||
        '4n',
    });

    this._state.isPlaying = true;
  }

  /**
   * Trigger specific chord
   */
  playChord(
    chord: string,
    notes: string[],
    velocity = 0.8,
    duration = '4n',
    time?: number,
  ): void {
    if (!this._state.isInitialized) {
      logger.warn('Harmony not initialized');
      return;
    }

    this.processor.triggerChord({
      chord,
      notes,
      velocity,
      time: time || Date.now() / 1000,
      duration,
    });
  }

  /**
   * Play single note
   */
  playNote(note: string, velocity = 0.8, duration = '4n', time?: number): void {
    this.playChord(note, [note], velocity, duration, time);
  }

  /**
   * Stop specific chord/notes
   */
  stop(notes: string | string[], time?: number): void {
    if (!this._state.isInitialized) return;

    // WAM processor handles note-off internally
    if ((this.processor as any).stopChord) {
      (this.processor as any).stopChord(notes, time);
    }

    this._state.isPlaying = false;
  }

  /**
   * Set chord voicing style
   */
  setVoicing(voicing: 'close' | 'open' | 'drop2' | 'drop3'): void {
    this.voicing = voicing;
    // Update processor if it supports voicing
    if ((this.processor as any).setVoicing) {
      (this.processor as any).setVoicing(voicing);
    }
  }

  /**
   * Set instrument type (piano, rhodes, etc.)
   */
  setInstrument(instrument: 'piano' | 'rhodes' | 'wurlitzer' | 'organ'): void {
    this.instrument = instrument;
    // Update processor if it supports instrument switching
    if ((this.processor as any).setInstrument) {
      (this.processor as any).setInstrument(instrument);
    }
  }

  /**
   * Set sustain pedal
   */
  setSustainPedal(pressed: boolean): void {
    if ((this.processor as any).setSustainPedal) {
      (this.processor as any).setSustainPedal(pressed);
    }
  }

  updateParams(params: Partial<HarmonyInstrumentConfig>): void {
    // Update base parameters
    if (params.volume !== undefined) {
      this.setVolume(params.volume);
    }
    if (params.pan !== undefined) {
      this.setPan(params.pan);
    }
    if (params.muted !== undefined) {
      this.setMuted(params.muted);
    }

    if (params.instrument !== undefined) {
      this.setInstrument(params.instrument);
    }

    if (params.voicing !== undefined) {
      this.setVoicing(params.voicing);
    }

    if (params.sustainPedal !== undefined) {
      this.setSustainPedal(params.sustainPedal);
    }

    if (params.samples) {
      this.samples = params.samples;
      // Would need to reinitialize with new samples
    }
  }

  async dispose(): Promise<void> {
    this.processor.dispose();
    // Clear samples
    this.samples = {};
    this._state.isInitialized = false;
    this._state.isPlaying = false;
  }

  connect(destination: any): void {
    this._destination = destination;
    // WAM processor handles its own connections
  }

  disconnect(): void {
    this._destination = null;
    // WAM processor handles its own connections
  }

  protected applyVolume(): void {
    // Update processor volume if supported
    if ((this.processor as any).setVolume) {
      (this.processor as any).setVolume(this._volume);
    }
  }

  protected applyPan(): void {
    // Update processor pan if supported
    if ((this.processor as any).setPan) {
      (this.processor as any).setPan(this._pan);
    }
  }

  protected applyMute(): void {
    // Mute all active notes
    if (this._muted && (this.processor as any).muteAll) {
      (this.processor as any).muteAll();
    }
  }

  protected async performSampleLoading(sampleMap: any): Promise<void> {
    // For harmony instruments, samples are typically handled by the WAM plugin
    // This method is a placeholder for future sample-based harmony instruments
    for (const [note, url] of Object.entries(sampleMap)) {
      if (typeof url === 'string') {
        // Store the sample URL for this note
        this.samples[note] = url;
      }
    }
  }

  getMetrics(): InstrumentMetrics {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      cpuUsage: this._state.isPlaying ? 8 : 0, // Higher CPU for polyphonic harmony
      memoryUsage: Object.keys(this.samples).length * 0.2, // Estimate 0.2MB per sample
      voiceCount: this._state.isPlaying ? 4 : 0, // Typical chord has 3-4 notes
      latency: 20, // WAM plugin latency
    };
  }

  /**
   * Get current instrument type
   */
  getInstrument(): string {
    return this.instrument;
  }

  /**
   * Get current voicing
   */
  getVoicing(): string {
    return this.voicing;
  }

  /**
   * Check if WAM is enabled
   */
  get useWAM(): boolean {
    return this._useWAM;
  }

  /**
   * Get chord suggestions for a given root note
   */
  getChordSuggestions(root: string): string[] {
    return [
      `${root}`, // Major
      `${root}m`, // Minor
      `${root}7`, // Dominant 7
      `${root}maj7`, // Major 7
      `${root}m7`, // Minor 7
      `${root}sus2`, // Suspended 2
      `${root}sus4`, // Suspended 4
      `${root}dim`, // Diminished
      `${root}aug`, // Augmented
    ];
  }

  /**
   * Convert chord symbol to notes
   */
  chordToNotes(chord: string, octave = 4): string[] {
    // Simplified chord parsing - would be more comprehensive in real implementation
    const root = chord.replace(/[^A-G#b].*/, '');
    const chordType = chord.replace(root, '');

    // Basic chord mapping (simplified)
    const baseNotes = {
      C: ['C', 'E', 'G'],
      D: ['D', 'F#', 'A'],
      E: ['E', 'G#', 'B'],
      F: ['F', 'A', 'C'],
      G: ['G', 'B', 'D'],
      A: ['A', 'C#', 'E'],
      B: ['B', 'D#', 'F#'],
    };

    const notes = baseNotes[root as keyof typeof baseNotes] || ['C', 'E', 'G'];

    // Apply chord modifications based on type
    if (chordType.includes('m') && !chordType.includes('maj')) {
      // Minor chord - flatten the third
      // This is a simplified implementation
    }

    return notes.map((note) => `${note}${octave}`);
  }
}
