/**
 * Bus - Audio bus for mixing and routing
 *
 * Types of buses:
 * - Master Bus: Final output destination
 * - Sub Bus: Group multiple tracks (e.g., drums bus)
 * - Aux Bus: Effects sends (reverb, delay)
 * - Monitor Bus: Separate monitoring mix
 */

import * as Tone from 'tone';
import { Channel } from './Channel.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('Bus');

export type BusType = 'master' | 'sub' | 'aux' | 'monitor';

export interface BusConfig {
  busId: string;
  name?: string;
  type: BusType;
  parentBusId?: string;
  initialGain?: number;
  hasDynamics?: boolean;
  hasEQ?: boolean;
  audioEngine?: any; // Optional AudioEngine for DI
}

export interface BusDynamics {
  compressor: Tone.Compressor;
  limiter: Tone.Limiter;
  bypassed: boolean;
}

export interface BusInsert {
  id: string;
  effect: Tone.ToneAudioNode;
  bypassed: boolean;
  wetDry?: number;
}

export class Bus {
  // Identity
  public readonly id: string;
  public name: string;
  public readonly type: BusType;
  public parentBusId?: string;

  // Audio nodes
  private input: Tone.Gain;
  private output: Tone.Gain;
  private gainNode: Tone.Gain;

  // Processing
  private dynamics?: BusDynamics;
  private eq?: Tone.EQ3;
  private inserts: BusInsert[] = [];

  // Child management
  private childBusIds = new Set<string>();
  private connectedChannels = new Set<string>();

  // Metering
  private meter: Tone.Meter;
  private analyser: Tone.Analyser;

  // State
  private gain: number;
  private isMuted = false;

  // Event handling
  private eventBus?: EventBus;
  private audioEngine?: any; // Optional AudioEngine for DI

  constructor(config: BusConfig) {
    this.id = config.busId;
    this.name = config.name || `${config.type} Bus`;
    this.type = config.type;
    this.parentBusId = config.parentBusId;
    this.gain = config.initialGain ?? 1;
    this.audioEngine = config.audioEngine;

    // Create audio nodes using factory if available
    this.input = this.createGain(1);
    this.output = this.createGain(1);
    this.gainNode = this.createGain(this.gain);

    // Create metering
    this.meter = this.createMeter();
    this.analyser = this.createAnalyser('waveform', 2048);

    // Create optional processing
    if (config.hasDynamics ?? (this.type === 'master' || this.type === 'sub')) {
      this.createDynamics();
    }

    if (config.hasEQ ?? (this.type === 'master' || this.type === 'sub')) {
      this.createEQ();
    }

    // Build signal chain
    this.buildSignalChain();

    logger.info('Bus created', {
      busId: this.id,
      name: this.name,
      type: this.type,
    });
  }

  /**
   * Create dynamics processing
   */
  private createDynamics(): void {
    const compressor = this.createCompressor({
      threshold: -12,
      ratio: 3,
      attack: 0.01,
      release: 0.1,
      knee: 2,
    });

    const limiter = this.createLimiter({
      threshold: -1,
    });

    this.dynamics = {
      compressor,
      limiter,
      bypassed: false,
    };
  }

  /**
   * Create EQ
   */
  private createEQ(): void {
    this.eq = this.createEQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 250,
      highFrequency: 2500,
    });
  }

  /**
   * Build signal chain
   */
  private buildSignalChain(): void {
    let currentNode: Tone.ToneAudioNode = this.input;

    // Gain stage
    currentNode.connect(this.gainNode);
    currentNode = this.gainNode;

    // EQ (optional)
    if (this.eq) {
      currentNode.connect(this.eq);
      currentNode = this.eq;
    }

    // Insert effects would go here
    for (const insert of this.inserts) {
      if (!insert.bypassed) {
        currentNode.connect(insert.effect);
        currentNode = insert.effect;
      }
    }

    // Dynamics (optional)
    if (this.dynamics && !this.dynamics.bypassed) {
      currentNode.connect(this.dynamics.compressor);
      currentNode = this.dynamics.compressor;

      if (this.type === 'master') {
        currentNode.connect(this.dynamics.limiter);
        currentNode = this.dynamics.limiter;
      }
    }

    // Metering
    currentNode.connect(this.meter);
    currentNode.connect(this.analyser);

    // Output
    currentNode.connect(this.output);
  }

  /**
   * Connect a channel to this bus
   */
  connectChannel(channelId: string, channel: Channel): void {
    if (this.connectedChannels.has(channelId)) {
      logger.warn('Channel already connected', { channelId, busId: this.id });
      return;
    }

    channel.getOutput().connect(this.input);
    this.connectedChannels.add(channelId);

    logger.debug('Channel connected to bus', {
      channelId,
      busId: this.id,
    });

    this.emitEvent('channelConnected', { channelId });
  }

  /**
   * Disconnect a channel from this bus
   */
  disconnectChannel(channelId: string, channel: Channel): void {
    if (!this.connectedChannels.has(channelId)) {
      return;
    }

    channel.getOutput().disconnect(this.input);
    this.connectedChannels.delete(channelId);

    logger.debug('Channel disconnected from bus', {
      channelId,
      busId: this.id,
    });

    this.emitEvent('channelDisconnected', { channelId });
  }

  /**
   * Add child bus
   */
  addChildBus(childBusId: string): void {
    if (this.childBusIds.has(childBusId)) {
      return;
    }

    this.childBusIds.add(childBusId);

    logger.debug('Child bus added', {
      parentBusId: this.id,
      childBusId,
    });

    this.emitEvent('childBusAdded', { childBusId });
  }

  /**
   * Remove child bus
   */
  removeChildBus(childBusId: string): void {
    this.childBusIds.delete(childBusId);

    logger.debug('Child bus removed', {
      parentBusId: this.id,
      childBusId,
    });

    this.emitEvent('childBusRemoved', { childBusId });
  }

  /**
   * Set gain (0-2, where 1 is unity)
   */
  setGain(gain: number, rampTime = 0.05): void {
    const clampedGain = Math.max(0, Math.min(2, gain));
    this.gain = clampedGain;

    if (rampTime > 0) {
      this.gainNode.gain.rampTo(clampedGain, rampTime);
    } else {
      this.gainNode.gain.value = clampedGain;
    }

    this.emitEvent('gainChanged', { gain: clampedGain });
  }

  /**
   * Set gain in dB
   */
  setGainDb(db: number, rampTime = 0.05): void {
    const tone = this.audioEngine?.getTone?.() || Tone;
    const linear = tone.dbToGain(db);
    this.setGain(linear, rampTime);
  }

  /**
   * Mute bus
   */
  setMute(muted: boolean): void {
    this.isMuted = muted;
    this.gainNode.gain.value = muted ? 0 : this.gain;
    this.emitEvent('muteChanged', { muted });
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.setMute(!this.isMuted);
  }

  /**
   * Set EQ low band
   */
  setEQLow(gain: number): void {
    if (!this.eq) {
      throw new Error('Bus has no EQ');
    }

    const clampedGain = Math.max(-24, Math.min(24, gain));
    this.eq.low.value = clampedGain;
  }

  /**
   * Set EQ mid band
   */
  setEQMid(gain: number): void {
    if (!this.eq) {
      throw new Error('Bus has no EQ');
    }

    const clampedGain = Math.max(-24, Math.min(24, gain));
    this.eq.mid.value = clampedGain;
  }

  /**
   * Set EQ high band
   */
  setEQHigh(gain: number): void {
    if (!this.eq) {
      throw new Error('Bus has no EQ');
    }

    const clampedGain = Math.max(-24, Math.min(24, gain));
    this.eq.high.value = clampedGain;
  }

  /**
   * Set compressor threshold
   */
  setCompressorThreshold(threshold: number): void {
    if (!this.dynamics) {
      throw new Error('Bus has no dynamics');
    }

    this.dynamics.compressor.threshold.value = threshold;
  }

  /**
   * Set compressor ratio
   */
  setCompressorRatio(ratio: number): void {
    if (!this.dynamics) {
      throw new Error('Bus has no dynamics');
    }

    this.dynamics.compressor.ratio.value = ratio;
  }

  /**
   * Bypass dynamics
   */
  bypassDynamics(bypassed: boolean): void {
    if (!this.dynamics) {
      return;
    }

    this.dynamics.bypassed = bypassed;
    this.buildSignalChain();
  }

  /**
   * Add insert effect
   */
  addInsert(effect: Tone.ToneAudioNode, position?: number): string {
    const insertId = `bus-insert-${Date.now()}`;
    const insert: BusInsert = {
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

    this.buildSignalChain();

    logger.debug('Insert added to bus', {
      busId: this.id,
      insertId,
    });

    return insertId;
  }

  /**
   * Remove insert
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
    this.buildSignalChain();

    logger.debug('Insert removed from bus', {
      busId: this.id,
      insertId,
    });
  }

  /**
   * Bypass insert
   */
  bypassInsert(insertId: string, bypassed: boolean): void {
    const insert = this.inserts.find((i) => i.id === insertId);
    if (!insert) {
      return;
    }

    insert.bypassed = bypassed;
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
   * Get peak level
   */
  getPeak(): number {
    const waveform = this.getWaveform();
    let peak = 0;

    for (let i = 0; i < waveform.length; i++) {
      const sample = waveform[i];
      if (sample !== undefined) {
        peak = Math.max(peak, Math.abs(sample));
      }
    }

    const tone = this.audioEngine?.getTone?.() || Tone;
    return tone.gainToDb(peak);
  }

  /**
   * Get RMS level
   */
  getRMS(): number {
    const waveform = this.getWaveform();
    let sum = 0;

    for (let i = 0; i < waveform.length; i++) {
      const sample = waveform[i];
      if (sample !== undefined) {
        sum += sample * sample;
      }
    }

    const rms = Math.sqrt(sum / waveform.length);
    const tone = this.audioEngine?.getTone?.() || Tone;
    return tone.gainToDb(rms);
  }

  /**
   * Get input node
   */
  getInput(): Tone.ToneAudioNode {
    return this.input;
  }

  /**
   * Get output node
   */
  getOutput(): Tone.ToneAudioNode {
    return this.output;
  }

  /**
   * Get child bus IDs
   */
  getChildBusIds(): string[] {
    return Array.from(this.childBusIds);
  }

  /**
   * Get connected channel IDs
   */
  getConnectedChannelIds(): string[] {
    return Array.from(this.connectedChannels);
  }

  /**
   * Set event bus
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Emit event
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventBus) {
      this.eventBus.emit(`bus:${event}`, {
        busId: this.id,
        busType: this.type,
        ...data,
      });
    }
  }

  /**
   * Dispose bus
   */
  dispose(): void {
    // Disconnect all nodes
    this.input.disconnect();
    this.output.disconnect();
    this.gainNode.disconnect();
    this.meter.disconnect();
    this.analyser.disconnect();

    // Dispose nodes
    this.input.dispose();
    this.output.dispose();
    this.gainNode.dispose();
    this.meter.dispose();
    this.analyser.dispose();

    // Dispose optional components
    if (this.eq) {
      this.eq.disconnect();
      this.eq.dispose();
    }

    if (this.dynamics) {
      this.dynamics.compressor.disconnect();
      this.dynamics.compressor.dispose();
      this.dynamics.limiter.disconnect();
      this.dynamics.limiter.dispose();
    }

    // Dispose inserts
    this.inserts.forEach((insert) => {
      insert.effect.disconnect();
      insert.effect.dispose();
    });

    this.inserts = [];
    this.connectedChannels.clear();
    this.childBusIds.clear();

    logger.info('Bus disposed', {
      busId: this.id,
      busType: this.type,
    });
  }

  // Factory methods for DI support
  private createGain(gain?: number): any {
    return this.audioEngine?.createGain?.(gain) || new Tone.Gain({ gain });
  }

  private createMeter(options?: any): any {
    return this.audioEngine?.createMeter?.(options) || new Tone.Meter(options);
  }

  private createAnalyser(type?: string, size?: number): any {
    return (
      this.audioEngine?.createAnalyser?.(type, size) ||
      new Tone.Analyser(type as any, size)
    );
  }

  private createCompressor(options?: any): any {
    return (
      this.audioEngine?.createCompressor?.(options) ||
      new Tone.Compressor(options)
    );
  }

  private createLimiter(options?: any): any {
    return (
      this.audioEngine?.createLimiter?.(options) || new Tone.Limiter(options)
    );
  }

  private createEQ3(options?: any): any {
    return this.audioEngine?.createEQ3?.(options) || new Tone.EQ3(options);
  }
}
