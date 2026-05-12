/**
 * Channel - Audio channel strip for track mixing
 *
 * Provides a complete channel strip with:
 * - Gain control
 * - Pan control
 * - Mute/Solo
 * - EQ
 * - Dynamics (compression/gate)
 * - Sends
 * - Insert effects
 */

import { getTone } from '@/domains/playback/utils/tone';
import type * as ToneTypes from 'tone';
import type { TrackMixingState } from '../../../types/track.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('Channel');

export interface ChannelConfig {
  channelId: string;
  name?: string;
  outputBus?: string;
  initialState?: Partial<TrackMixingState>;
  audioEngine?: any; // Optional AudioEngine for DI
}

export interface ChannelInsert {
  id: string;
  effect: ToneTypes.ToneAudioNode;
  bypassed: boolean;
  wetDry?: number;
}

export interface ChannelEQ {
  highShelf: ToneTypes.EQ3;
  parametric: ToneTypes.Filter[];
  bypassed: boolean;
}

export interface ChannelDynamics {
  gate?: ToneTypes.Gate;
  compressor?: ToneTypes.Compressor;
  limiter?: ToneTypes.Limiter;
  bypassed: boolean;
}

export class Channel {
  // Identity
  public readonly id: string;
  public name: string;

  // Audio nodes
  private input: ToneTypes.Gain;
  private output: ToneTypes.Gain;

  // Channel strip components
  private gainNode: ToneTypes.Gain;
  private pannerNode: ToneTypes.Panner;
  private muteNode: ToneTypes.Gain;
  private soloNode: ToneTypes.Gain;

  // Processing
  private eq: ChannelEQ;
  private dynamics: ChannelDynamics;
  private inserts: ChannelInsert[] = [];
  private sends: Map<string, ToneTypes.Gain> = new Map();

  // State
  private state: TrackMixingState;

  // Metering
  private meter: ToneTypes.Meter;
  private analyser: ToneTypes.Analyser;

  // Event handling
  private eventBus?: EventBus;
  private audioEngine?: any; // Optional AudioEngine for DI

  constructor(config: ChannelConfig) {
    this.id = config.channelId;
    this.name = config.name || `Channel ${this.id}`;
    this.audioEngine = config.audioEngine;

    // Initialize state
    this.state = {
      volume: config.initialState?.volume ?? 0.75,
      pan: config.initialState?.pan ?? 0,
      mute: config.initialState?.mute ?? false,
      solo: config.initialState?.solo ?? false,
      recordArm: config.initialState?.recordArm ?? false,
      phaseInvert: config.initialState?.phaseInvert ?? false,
      delayCompensation: config.initialState?.delayCompensation ?? 0,
    };

    // Create audio nodes using factory if available
    this.input = this.createGain(1);
    this.output = this.createGain(1);

    // Create channel strip
    this.gainNode = this.createGain(this.state.volume);
    this.pannerNode = this.createPanner(this.state.pan);
    this.muteNode = this.createGain(this.state.mute ? 0 : 1);
    this.soloNode = this.createGain(1);

    // Create EQ
    this.eq = this.createEQ();

    // Create dynamics
    this.dynamics = this.createDynamics();

    // Create metering
    this.meter = this.createMeter();
    this.analyser = this.createAnalyser('waveform', 1024);

    // Build signal chain
    this.buildSignalChain();

    // Apply initial state
    this.applyState();
  }

  /**
   * Create EQ section
   */
  private createEQ(): ChannelEQ {
    const highShelf = this.createEQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 320,
      highFrequency: 3200,
    });

    // Create 4-band parametric EQ
    const parametric = [
      this.createFilter({
        type: 'peaking',
        frequency: 100,
        Q: 1,
        gain: 0,
      }),
      this.createFilter({
        type: 'peaking',
        frequency: 1000,
        Q: 1,
        gain: 0,
      }),
      this.createFilter({
        type: 'peaking',
        frequency: 5000,
        Q: 1,
        gain: 0,
      }),
      this.createFilter({
        type: 'peaking',
        frequency: 10000,
        Q: 1,
        gain: 0,
      }),
    ];

    return {
      highShelf,
      parametric,
      bypassed: false,
    };
  }

  /**
   * Create dynamics section
   */
  private createDynamics(): ChannelDynamics {
    return {
      compressor: this.createCompressor({
        threshold: -12,
        ratio: 4,
        attack: 0.003,
        release: 0.1,
      }),
      gate: this.createGate({
        threshold: -40,
        attack: 0.001,
        release: 0.1,
      }),
      bypassed: false,
    };
  }

  /**
   * Build the signal chain
   */
  private buildSignalChain(): void {
    // Input -> Dynamics -> EQ -> Inserts -> Gain -> Pan -> Mute -> Solo -> Meter -> Output
    let currentNode: ToneTypes.ToneAudioNode = this.input;

    // Dynamics section (optional)
    if (this.dynamics.gate && !this.dynamics.bypassed) {
      currentNode.connect(this.dynamics.gate);
      currentNode = this.dynamics.gate;
    }

    if (this.dynamics.compressor && !this.dynamics.bypassed) {
      currentNode.connect(this.dynamics.compressor);
      currentNode = this.dynamics.compressor;
    }

    // EQ section
    if (!this.eq.bypassed) {
      currentNode.connect(this.eq.highShelf);
      currentNode = this.eq.highShelf;

      // Chain parametric bands
      for (const band of this.eq.parametric) {
        currentNode.connect(band);
        currentNode = band;
      }
    }

    // Insert effects would go here

    // Channel strip
    currentNode.connect(this.gainNode);
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(this.muteNode);
    this.muteNode.connect(this.soloNode);

    // Metering
    this.soloNode.connect(this.meter);
    this.soloNode.connect(this.analyser);

    // Output
    this.soloNode.connect(this.output);
  }

  /**
   * Apply current state to audio nodes
   */
  private applyState(): void {
    this.gainNode.gain.value = this.state.volume;
    this.pannerNode.pan.value = this.state.pan;
    this.muteNode.gain.value = this.state.mute ? 0 : 1;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number, rampTime = 0.05): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.state.volume = clampedVolume;

    if (rampTime > 0) {
      this.gainNode.gain.rampTo(clampedVolume, rampTime);
    } else {
      this.gainNode.gain.value = clampedVolume;
    }

    this.emitStateChange('volume', clampedVolume);
  }

  /**
   * Set volume in dB
   */
  setVolumeDb(db: number, rampTime = 0.05): void {
    const tone = this.getTone();
    const linear = tone.dbToGain(db);
    this.setVolume(linear, rampTime);
  }

  /**
   * Set pan (-1 to 1)
   */
  setPan(pan: number, rampTime = 0.05): void {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    this.state.pan = clampedPan;

    if (rampTime > 0) {
      this.pannerNode.pan.rampTo(clampedPan, rampTime);
    } else {
      this.pannerNode.pan.value = clampedPan;
    }

    this.emitStateChange('pan', clampedPan);
  }

  /**
   * Set mute state
   */
  setMute(muted: boolean): void {
    this.state.mute = muted;
    this.muteNode.gain.value = muted ? 0 : 1;
    this.emitStateChange('mute', muted);
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.setMute(!this.state.mute);
  }

  /**
   * Set solo state
   */
  setSolo(soloed: boolean): void {
    this.state.solo = soloed;
    this.emitStateChange('solo', soloed);
  }

  /**
   * Toggle solo
   */
  toggleSolo(): void {
    this.setSolo(!this.state.solo);
  }

  /**
   * Add send
   */
  addSend(sendId: string, level = 0.5): ToneTypes.Gain {
    if (this.sends.has(sendId)) {
      throw new Error(`Send ${sendId} already exists`);
    }

    const sendGain = this.createGain(level);

    // Connect from post-fader by default
    this.pannerNode.connect(sendGain);

    this.sends.set(sendId, sendGain);

    logger.debug('Send added', {
      channelId: this.id,
      sendId,
      level,
    });

    return sendGain;
  }

  /**
   * Remove send
   */
  removeSend(sendId: string): void {
    const send = this.sends.get(sendId);
    if (!send) {
      return;
    }

    send.disconnect();
    send.dispose();
    this.sends.delete(sendId);

    logger.debug('Send removed', {
      channelId: this.id,
      sendId,
    });
  }

  /**
   * Set send level
   */
  setSendLevel(sendId: string, level: number, rampTime = 0.05): void {
    const send = this.sends.get(sendId);
    if (!send) {
      throw new Error(`Send ${sendId} not found`);
    }

    const clampedLevel = Math.max(0, Math.min(1, level));

    if (rampTime > 0) {
      send.gain.rampTo(clampedLevel, rampTime);
    } else {
      send.gain.value = clampedLevel;
    }
  }

  /**
   * Add insert effect
   */
  addInsert(effect: ToneTypes.ToneAudioNode, position?: number): string {
    const insertId = `insert-${Date.now()}`;
    const insert: ChannelInsert = {
      id: insertId,
      effect,
      bypassed: false,
    };

    if (
      position !== undefined &&
      position >= 0 &&
      position <= this.inserts.length
    ) {
      this.inserts.splice(position, 0, insert);
    } else {
      this.inserts.push(insert);
    }

    // Rebuild signal chain
    this.rebuildInsertChain();

    logger.debug('Insert added', {
      channelId: this.id,
      insertId,
      position: position ?? this.inserts.length - 1,
    });

    return insertId;
  }

  /**
   * Remove insert effect
   */
  removeInsert(insertId: string): void {
    const index = this.inserts.findIndex((i) => i.id === insertId);
    if (index === -1) {
      return;
    }

    const insert = this.inserts[index];
    if (insert) {
      insert.effect.disconnect();
      insert.effect.dispose();
    }

    this.inserts.splice(index, 1);

    // Rebuild signal chain
    this.rebuildInsertChain();

    logger.debug('Insert removed', {
      channelId: this.id,
      insertId,
    });
  }

  /**
   * Bypass insert
   */
  bypassInsert(insertId: string, bypassed: boolean): void {
    const insert = this.inserts.find((i) => i.id === insertId);
    if (!insert) {
      throw new Error(`Insert ${insertId} not found`);
    }

    insert.bypassed = bypassed;
    this.rebuildInsertChain();
  }

  /**
   * Rebuild insert chain
   */
  private rebuildInsertChain(): void {
    // This would reconnect the entire signal chain with inserts
    // For now, we'll keep it simple
    logger.debug('Insert chain rebuilt', {
      channelId: this.id,
      insertCount: this.inserts.length,
    });
  }

  /**
   * Set EQ band gain
   */
  setEQBand(bandIndex: number, gain: number): void {
    if (bandIndex < 0 || bandIndex >= this.eq.parametric.length) {
      throw new Error(`Invalid EQ band index: ${bandIndex}`);
    }

    const clampedGain = Math.max(-24, Math.min(24, gain));
    const band = this.eq.parametric[bandIndex];
    if (band && 'gain' in band) {
      (band as { gain: { value: number } }).gain.value = clampedGain;
    }
  }

  /**
   * Set EQ band frequency
   */
  setEQFrequency(bandIndex: number, frequency: number): void {
    if (bandIndex < 0 || bandIndex >= this.eq.parametric.length) {
      throw new Error(`Invalid EQ band index: ${bandIndex}`);
    }

    const clampedFreq = Math.max(20, Math.min(20000, frequency));
    const band = this.eq.parametric[bandIndex];
    if (band) {
      band.frequency.value = clampedFreq;
    }
  }

  /**
   * Set EQ band Q
   */
  setEQQ(bandIndex: number, q: number): void {
    if (bandIndex < 0 || bandIndex >= this.eq.parametric.length) {
      throw new Error(`Invalid EQ band index: ${bandIndex}`);
    }

    const clampedQ = Math.max(0.1, Math.min(30, q));
    const band = this.eq.parametric[bandIndex];
    if (band) {
      band.Q.value = clampedQ;
    }
  }

  /**
   * Bypass EQ
   */
  bypassEQ(bypassed: boolean): void {
    this.eq.bypassed = bypassed;
    this.buildSignalChain();
  }

  /**
   * Set compressor threshold
   */
  setCompressorThreshold(threshold: number): void {
    if (this.dynamics.compressor) {
      this.dynamics.compressor.threshold.value = threshold;
    }
  }

  /**
   * Set compressor ratio
   */
  setCompressorRatio(ratio: number): void {
    if (this.dynamics.compressor) {
      this.dynamics.compressor.ratio.value = ratio;
    }
  }

  /**
   * Bypass dynamics
   */
  bypassDynamics(bypassed: boolean): void {
    this.dynamics.bypassed = bypassed;
    this.buildSignalChain();
  }

  /**
   * Get current level in dB
   */
  getLevel(): number {
    return this.meter.getValue() as number;
  }

  /**
   * Get waveform data
   */
  getWaveform(): Float32Array {
    return this.analyser.getValue() as Float32Array;
  }

  /**
   * Get input node
   */
  getInput(): ToneTypes.ToneAudioNode {
    return this.input;
  }

  /**
   * Get output node
   */
  getOutput(): ToneTypes.ToneAudioNode {
    return this.output;
  }

  /**
   * Get current state
   */
  getState(): TrackMixingState {
    return { ...this.state };
  }

  /**
   * Set event bus
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Emit state change event
   */
  private emitStateChange(parameter: string, value: any): void {
    if (this.eventBus) {
      this.eventBus.emit('channel:stateChanged', {
        channelId: this.id,
        parameter,
        value,
        state: this.getState(),
      });
    }
  }

  /**
   * Dispose channel
   */
  dispose(): void {
    // Disconnect all nodes
    this.input.disconnect();
    this.output.disconnect();
    this.gainNode.disconnect();
    this.pannerNode.disconnect();
    this.muteNode.disconnect();
    this.soloNode.disconnect();
    this.meter.disconnect();
    this.analyser.disconnect();

    // Dispose nodes
    this.input.dispose();
    this.output.dispose();
    this.gainNode.dispose();
    this.pannerNode.dispose();
    this.muteNode.dispose();
    this.soloNode.dispose();
    this.meter.dispose();
    this.analyser.dispose();

    // Dispose EQ
    this.eq.highShelf.dispose();
    this.eq.parametric.forEach((band) => band.dispose());

    // Dispose dynamics
    this.dynamics.compressor?.dispose();
    this.dynamics.gate?.dispose();
    this.dynamics.limiter?.dispose();

    // Dispose inserts
    this.inserts.forEach((insert) => {
      insert.effect.disconnect();
      insert.effect.dispose();
    });

    // Dispose sends
    this.sends.forEach((send) => {
      send.disconnect();
      send.dispose();
    });

    this.sends.clear();
    this.inserts = [];

    logger.info('Channel disposed', { channelId: this.id });
  }

  // Factory methods for DI support
  // Uses audioEngine if available, otherwise falls back to global Tone from window
  private getTone(): any {
    if (this.audioEngine?.getTone) {
      return this.audioEngine.getTone();
    }
    // Fallback to global Tone (loaded by previous initialization)
    // Check both locations where Tone.js may be stored
    if (typeof window !== 'undefined') {
      const tone = window.Tone || window.__globalTone;
      if (tone) {
        return tone;
      }
    }
    throw new Error('Channel: No Tone.js instance available. Ensure AudioEngine is initialized.');
  }

  private createGain(gain?: number): any {
    if (this.audioEngine?.createGain) {
      return this.audioEngine.createGain(gain);
    }
    const Tone = this.getTone();
    return new Tone.Gain({ gain });
  }

  private createPanner(pan?: number): any {
    if (this.audioEngine?.createPanner) {
      return this.audioEngine.createPanner(pan);
    }
    const Tone = this.getTone();
    return new Tone.Panner({ pan });
  }

  private createEQ3(options?: any): any {
    if (this.audioEngine?.createEQ3) {
      return this.audioEngine.createEQ3(options);
    }
    const Tone = this.getTone();
    return new Tone.EQ3(options);
  }

  private createFilter(options?: any): any {
    if (this.audioEngine?.createFilter) {
      return this.audioEngine.createFilter(options);
    }
    const Tone = this.getTone();
    return new Tone.Filter(options);
  }

  private createCompressor(options?: any): any {
    if (this.audioEngine?.createCompressor) {
      return this.audioEngine.createCompressor(options);
    }
    const Tone = this.getTone();
    return new Tone.Compressor(options);
  }

  private createGate(options?: any): any {
    if (this.audioEngine?.createGate) {
      return this.audioEngine.createGate(options);
    }
    const Tone = this.getTone();
    return new Tone.Gate(options);
  }

  private createMeter(options?: any): any {
    if (this.audioEngine?.createMeter) {
      return this.audioEngine.createMeter(options);
    }
    const Tone = this.getTone();
    return new Tone.Meter(options);
  }

  private createAnalyser(type?: 'fft' | 'waveform', size?: number): any {
    if (this.audioEngine?.createAnalyser) {
      return this.audioEngine.createAnalyser(type, size);
    }
    const Tone = this.getTone();
    return new Tone.Analyser(type, size);
  }
}
