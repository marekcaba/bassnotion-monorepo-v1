/**
 * Metronome Instrument
 *
 * A simplified, modular metronome implementation that follows the Instrument interface.
 * This implementation wraps the existing MetronomeInstrumentProcessor for backward compatibility
 * while providing a cleaner interface for the track system.
 */

import { BaseInstrument } from '../../base/Instrument.js';
import type {
  InstrumentConfig,
  InstrumentEvent,
  InstrumentMetrics,
} from '../../types/index.js';
import type { MetronomeEvent } from '../../types/index.js';
import {
  MetronomeInstrumentProcessor,
  ClickSoundType,
} from '../../../shared/legacy-bridge.js';
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('Metronome');

export interface MetronomeInstrumentConfig extends InstrumentConfig {
  type: 'metronome';
  clickSounds?: {
    click: string;
    accent: string;
  };
  tempo?: number;
  timeSignature?: string;
  clickVolume?: number;
  accentVolume?: number;
}

/**
 * Metronome instrument implementation
 */
export class Metronome extends BaseInstrument {
  private processor: MetronomeInstrumentProcessor;
  private clickSounds: Record<string, string>;
  private tempo: number;
  private _timeSignature: string;
  private audioEngine?: any;

  constructor(config: MetronomeInstrumentConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;

    this.clickSounds = config.clickSounds || {
      click: '',
      accent: '',
    };
    this.tempo = config.tempo || 120;
    this._timeSignature = config.timeSignature || '4/4';

    // Create processor with configuration
    this.processor = new MetronomeInstrumentProcessor({
      tempo: this.tempo,
      clickSounds: {
        regular: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: config.clickVolume || 0.7,
        },
        accent: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: config.accentVolume || 1.0,
          pitch: 200, // Higher pitch for accent
        },
        subdivision: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: 0.3,
          pitch: -100,
        },
        currentPreset: 'classic' as any,
        customSounds: new Map(),
      },
    });
  }

  async initialize(_context?: any): Promise<void> {
    if (this._state.isInitialized) return;

    // Try to get audioEngine from global DI if not already set
    if (!this.audioEngine && typeof window !== 'undefined') {
      const globalServices =
        window.__coreServices || window.__globalCoreServices;
      if (
        globalServices &&
        typeof globalServices === 'object' &&
        'getAudioEngine' in globalServices
      ) {
        this.audioEngine = (
          globalServices as { getAudioEngine: () => unknown }
        ).getAudioEngine();
      }
    }

    this._state.isLoading = true;

    try {
      // Initialize processor with click samples
      const clickSamples: Record<ClickSoundType, string> = {};

      if (this.clickSounds.click) {
        clickSamples[ClickSoundType.ELECTRONIC_BEEP] = this.clickSounds.click;
        clickSamples[ClickSoundType.REGULAR] = this.clickSounds.click;
      }

      if (this.clickSounds.accent) {
        clickSamples[ClickSoundType.ACCENT] = this.clickSounds.accent;
        clickSamples[ClickSoundType.STRONG] = this.clickSounds.accent;
      }

      // Pass audioEngine to processor initialize if available
      await this.processor.initialize(clickSamples, this.audioEngine);

      this._state.isInitialized = true;
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize metronome: ${error}`;
      throw error;
    }
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      logger.warn(`Metronome ${this.name} not initialized`);
      return;
    }

    // Extract metronome-specific data
    const metronomeEvent = event.data as MetronomeEvent;

    // Call processor's trigger method
    this.processor.triggerClick({
      type: metronomeEvent?.type || 'click',
      time: event.audioTime,
      velocity: event.velocity,
    });

    this._state.isPlaying = true;
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number, transitionTime?: number): void {
    this.tempo = bpm;
    this.processor.setTempo(bpm, transitionTime);
  }

  /**
   * Set time signature
   */
  setTimeSignature(signature: string): void {
    this._timeSignature = signature;

    // Parse signature and set on processor
    const [numerator, denominator] = signature.split('/').map(Number);
    const timeSignatures = this.processor.getAvailableTimeSignatures();

    if (timeSignatures[signature]) {
      this.processor.setTimeSignature(timeSignatures[signature]);
    } else {
      // Create custom time signature
      const customSignature = this.processor.createCustomTimeSignature(
        numerator,
        denominator,
        [1], // Default accent on first beat
      );
      this.processor.setTimeSignature(customSignature);
    }
  }

  /**
   * Tap tempo
   */
  tapTempo(): void {
    this.processor.tapTempo();
  }

  /**
   * Start the metronome
   */
  start(): void {
    if (!this._state.isInitialized) {
      logger.warn('Metronome not initialized');
      return;
    }

    this.processor.start();
    this._state.isPlaying = true;
  }
  /**
   * Stop the metronome
   */
  stop(_noteId?: string | number, _time?: number): void {
    if (this.processor) {
      this.processor.stop();
      this._state.isPlaying = false;
    }
  }

  updateParams(params: Partial<MetronomeInstrumentConfig>): void {
    // Update base parameters
    if (params.name !== undefined) this.name = params.name;
    if (params.volume !== undefined) this.setVolume(params.volume);
    if (params.pan !== undefined) this.setPan(params.pan);
    if (params.muted !== undefined) this.setMuted(params.muted);

    if (params.tempo !== undefined) {
      this.setTempo(params.tempo);
    }

    if (params.timeSignature !== undefined) {
      this.setTimeSignature(params.timeSignature);
    }

    if (params.clickVolume !== undefined) {
      this.processor.setCustomClickSound(ClickSoundType.REGULAR, {
        type: ClickSoundType.ELECTRONIC_BEEP,
        volume: params.clickVolume,
      });
    }

    if (params.accentVolume !== undefined) {
      this.processor.setCustomClickSound(ClickSoundType.ACCENT, {
        type: ClickSoundType.ELECTRONIC_BEEP,
        volume: params.accentVolume,
        pitch: 200,
      });
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

  // Remove duplicate updateParams - it already exists above

  protected applyVolume(): void {
    // Update all click volumes proportionally
    const config = this.processor.getConfig();

    this.processor.setCustomClickSound(ClickSoundType.REGULAR, {
      ...config.clickSounds.regular,
      volume: config.clickSounds.regular.volume * this._volume,
    });

    this.processor.setCustomClickSound(ClickSoundType.ACCENT, {
      ...config.clickSounds.accent,
      volume: config.clickSounds.accent.volume * this._volume,
    });
  }

  protected applyPan(): void {
    // Metronome typically doesn't support panning
    // Could be implemented with custom audio routing
  }

  protected applyMute(): void {
    if (this._muted && this._state.isPlaying) {
      this.stop();
    }
  }

  getMetrics(): InstrumentMetrics {
    const baseMetrics = super.getMetrics();

    // Add metronome-specific metrics
    // const state = this.processor.getState();

    return {
      ...baseMetrics,
      cpuUsage: this._state.isPlaying ? 1 : 0, // Minimal CPU usage
      voiceCount: this._state.isPlaying ? 1 : 0,
      latency: 25, // Typical lookahead time
    };
  }

  /**
   * Get current metronome state
   */
  getMetronomeState() {
    return this.processor.getState();
  }

  /**
   * Register callback for metronome events
   */
  onMetronomeEvent(callback: (event: any) => void): void {
    this.processor.onEvent(callback);
  }

  /**
   * Get current beat position info
   */
  getBeatPosition(): {
    currentBeat: number;
    totalBeats: number;
    measureNumber: number;
  } {
    const state = this.processor.getState();
    const timeSignature = this.processor.getTimeSignature();

    return {
      currentBeat: state.currentBeat || 0,
      totalBeats: timeSignature.numerator,
      measureNumber: state.currentMeasure || 0,
    };
  }

  /**
   * Get time signature
   */
  getTimeSignature(): string {
    return this._timeSignature;
  }

  /**
   * Get time signature (getter property for compatibility)
   */
  get timeSignature(): string {
    return this._timeSignature;
  }
}
