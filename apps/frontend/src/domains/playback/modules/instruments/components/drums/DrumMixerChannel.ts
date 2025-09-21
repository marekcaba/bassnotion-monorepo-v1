/**
 * Drum Mixer Channel
 *
 * Individual drum channel mixing with volume, pan, sends, and EQ
 */

import * as Tone from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('DrumMixerChannel');

export interface DrumChannelConfig {
  id: string;
  name: string;
  volume?: number; // dB
  pan?: number; // -1 to 1
  mute?: boolean;
  solo?: boolean;
  sends?: {
    [sendName: string]: number; // Send amount 0-1
  };
  eq?: {
    high?: { frequency: number; gain: number };
    mid?: { frequency: number; gain: number; q?: number };
    low?: { frequency: number; gain: number };
  };
  compressor?: {
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  };
}

export interface DrumChannelState {
  isMuted: boolean;
  isSoloed: boolean;
  volume: number;
  pan: number;
  sends: Map<string, number>;
  peakLevel: number;
  rmsLevel: number;
}

/**
 * Individual mixer channel for a drum piece
 */
export class DrumMixerChannel {
  readonly id: string;
  readonly name: string;

  // Audio nodes
  private input: Tone.Gain;
  private volume: Tone.Volume;
  private panner: Tone.Panner;
  private eq3: Tone.EQ3;
  private compressor: Tone.Compressor;
  private meter: Tone.Meter;
  private mute: Tone.Gain;
  private output: Tone.Gain;

  // Sends
  private sendNodes: Map<string, Tone.Gain> = new Map();
  private sendTargets: Map<string, Tone.ToneAudioNode> = new Map();

  // State
  private state: DrumChannelState = {
    isMuted: false,
    isSoloed: false,
    volume: 0,
    pan: 0,
    sends: new Map(),
    peakLevel: 0,
    rmsLevel: 0,
  };

  // Metering
  private meterUpdateInterval: number | null = null;
  private levelCallbacks: Set<(peak: number, rms: number) => void> = new Set();

  constructor(config: DrumChannelConfig) {
    this.id = config.id;
    this.name = config.name;

    // Create audio chain
    this.input = new Tone.Gain(1);
    this.compressor = new Tone.Compressor({
      threshold: config.compressor?.threshold || -12,
      ratio: config.compressor?.ratio || 4,
      attack: config.compressor?.attack || 0.003,
      release: config.compressor?.release || 0.1,
    });
    this.eq3 = new Tone.EQ3({
      high: config.eq?.high?.gain || 0,
      mid: config.eq?.mid?.gain || 0,
      low: config.eq?.low?.gain || 0,
      highFrequency: config.eq?.high?.frequency || 5000,
      lowFrequency: config.eq?.low?.frequency || 400,
    });
    this.volume = new Tone.Volume(config.volume || 0);
    this.panner = new Tone.Panner(config.pan || 0);
    this.meter = new Tone.Meter({ normalRange: true });
    this.mute = new Tone.Gain(config.mute ? 0 : 1);
    this.output = new Tone.Gain(1);

    // Connect chain
    this.input.connect(this.compressor);
    this.compressor.connect(this.eq3);
    this.eq3.connect(this.volume);
    this.volume.connect(this.panner);
    this.panner.connect(this.meter);
    this.meter.connect(this.mute);
    this.mute.connect(this.output);

    // Initialize sends
    if (config.sends) {
      for (const [sendName, amount] of Object.entries(config.sends)) {
        this.createSend(sendName, amount);
      }
    }

    // Initialize state
    this.state.volume = config.volume || 0;
    this.state.pan = config.pan || 0;
    this.state.isMuted = config.mute || false;

    // Start metering
    this.startMetering();

    logger.info('Drum mixer channel created', {
      id: this.id,
      name: this.name,
    });
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
   * Set volume
   */
  setVolume(volumeDb: number): void {
    this.volume.volume.rampTo(volumeDb, 0.05);
    this.state.volume = volumeDb;
    logger.debug(`Channel ${this.name} volume: ${volumeDb}dB`);
  }

  /**
   * Get volume
   */
  getVolume(): number {
    return this.state.volume;
  }

  /**
   * Set pan
   */
  setPan(pan: number): void {
    const clampedPan = Math.max(-1, Math.min(1, pan));
    this.panner.pan.rampTo(clampedPan, 0.05);
    this.state.pan = clampedPan;
    logger.debug(`Channel ${this.name} pan: ${clampedPan}`);
  }

  /**
   * Get pan
   */
  getPan(): number {
    return this.state.pan;
  }

  /**
   * Set mute
   */
  setMute(muted: boolean): void {
    this.mute.gain.rampTo(muted ? 0 : 1, 0.05);
    this.state.isMuted = muted;
    logger.debug(`Channel ${this.name} muted: ${muted}`);
  }

  /**
   * Get mute state
   */
  isMuted(): boolean {
    return this.state.isMuted;
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.setMute(!this.state.isMuted);
  }

  /**
   * Set solo
   */
  setSolo(soloed: boolean): void {
    this.state.isSoloed = soloed;
    // Solo logic is handled by the mixer
    logger.debug(`Channel ${this.name} soloed: ${soloed}`);
  }

  /**
   * Get solo state
   */
  isSoloed(): boolean {
    return this.state.isSoloed;
  }

  /**
   * Toggle solo
   */
  toggleSolo(): void {
    this.setSolo(!this.state.isSoloed);
  }

  /**
   * Set EQ parameters
   */
  setEQ(
    band: 'high' | 'mid' | 'low',
    gain: number,
    frequency?: number,
    q?: number,
  ): void {
    switch (band) {
      case 'high':
        this.eq3.high.value = gain;
        if (frequency) this.eq3.highFrequency.value = frequency;
        break;
      case 'mid':
        this.eq3.mid.value = gain;
        if (q) this.eq3.Q.value = q;
        break;
      case 'low':
        this.eq3.low.value = gain;
        if (frequency) this.eq3.lowFrequency.value = frequency;
        break;
    }

    logger.debug(`Channel ${this.name} EQ ${band}: ${gain}dB`);
  }

  /**
   * Get EQ settings
   */
  getEQ(): { high: number; mid: number; low: number } {
    return {
      high: this.eq3.high.value,
      mid: this.eq3.mid.value,
      low: this.eq3.low.value,
    };
  }

  /**
   * Set compressor parameters
   */
  setCompressor(params: {
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  }): void {
    if (params.threshold !== undefined) {
      this.compressor.threshold.value = params.threshold;
    }
    if (params.ratio !== undefined) {
      this.compressor.ratio.value = params.ratio;
    }
    if (params.attack !== undefined) {
      this.compressor.attack.value = params.attack;
    }
    if (params.release !== undefined) {
      this.compressor.release.value = params.release;
    }

    logger.debug(`Channel ${this.name} compressor updated`, params);
  }

  /**
   * Get compressor settings
   */
  getCompressor(): {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    reduction: number;
  } {
    return {
      threshold: this.compressor.threshold.value,
      ratio: this.compressor.ratio.value,
      attack: this.compressor.attack.value,
      release: this.compressor.release.value,
      reduction: this.compressor.reduction,
    };
  }

  /**
   * Create a send
   */
  createSend(sendName: string, amount = 0): void {
    if (this.sendNodes.has(sendName)) {
      logger.warn(`Send ${sendName} already exists`);
      return;
    }

    const send = new Tone.Gain(amount);
    this.panner.connect(send);
    this.sendNodes.set(sendName, send);
    this.state.sends.set(sendName, amount);

    logger.debug(`Channel ${this.name} created send: ${sendName}`);
  }

  /**
   * Set send amount
   */
  setSendAmount(sendName: string, amount: number): void {
    const send = this.sendNodes.get(sendName);
    if (!send) {
      logger.warn(`Send ${sendName} not found`);
      return;
    }

    const clampedAmount = Math.max(0, Math.min(1, amount));
    send.gain.rampTo(clampedAmount, 0.05);
    this.state.sends.set(sendName, clampedAmount);

    logger.debug(`Channel ${this.name} send ${sendName}: ${clampedAmount}`);
  }

  /**
   * Get send amount
   */
  getSendAmount(sendName: string): number {
    return this.state.sends.get(sendName) || 0;
  }

  /**
   * Connect send to target
   */
  connectSend(sendName: string, target: Tone.ToneAudioNode): void {
    const send = this.sendNodes.get(sendName);
    if (!send) {
      logger.warn(`Send ${sendName} not found`);
      return;
    }

    // Disconnect previous target if exists
    const previousTarget = this.sendTargets.get(sendName);
    if (previousTarget) {
      send.disconnect(previousTarget);
    }

    // Connect new target
    send.connect(target);
    this.sendTargets.set(sendName, target);

    logger.debug(`Channel ${this.name} connected send ${sendName}`);
  }

  /**
   * Remove send
   */
  removeSend(sendName: string): void {
    const send = this.sendNodes.get(sendName);
    if (!send) return;

    send.disconnect();
    send.dispose();
    this.sendNodes.delete(sendName);
    this.sendTargets.delete(sendName);
    this.state.sends.delete(sendName);

    logger.debug(`Channel ${this.name} removed send: ${sendName}`);
  }

  /**
   * Get current levels
   */
  getLevels(): { peak: number; rms: number } {
    return {
      peak: this.state.peakLevel,
      rms: this.state.rmsLevel,
    };
  }

  /**
   * Add level callback
   */
  addLevelCallback(callback: (peak: number, rms: number) => void): void {
    this.levelCallbacks.add(callback);
  }

  /**
   * Remove level callback
   */
  removeLevelCallback(callback: (peak: number, rms: number) => void): void {
    this.levelCallbacks.delete(callback);
  }

  /**
   * Start metering
   */
  private startMetering(): void {
    if (this.meterUpdateInterval) return;

    this.meterUpdateInterval = window.setInterval(() => {
      const level = this.meter.getValue();
      if (typeof level === 'number') {
        // Convert to dB
        const db = 20 * Math.log10(Math.max(0.00001, level));
        this.state.peakLevel = db;
        this.state.rmsLevel = db - 3; // Approximate RMS

        // Notify callbacks
        for (const callback of this.levelCallbacks) {
          try {
            callback(this.state.peakLevel, this.state.rmsLevel);
          } catch (error) {
            logger.error('Level callback error', error);
          }
        }
      }
    }, 50); // 20 FPS metering
  }

  /**
   * Stop metering
   */
  private stopMetering(): void {
    if (this.meterUpdateInterval) {
      clearInterval(this.meterUpdateInterval);
      this.meterUpdateInterval = null;
    }
  }

  /**
   * Get channel state
   */
  getState(): DrumChannelState {
    return { ...this.state, sends: new Map(this.state.sends) };
  }

  /**
   * Reset channel to defaults
   */
  reset(): void {
    this.setVolume(0);
    this.setPan(0);
    this.setMute(false);
    this.setSolo(false);
    this.setEQ('high', 0);
    this.setEQ('mid', 0);
    this.setEQ('low', 0);
    this.setCompressor({
      threshold: -12,
      ratio: 4,
      attack: 0.003,
      release: 0.1,
    });

    // Reset sends
    for (const [sendName] of this.state.sends) {
      this.setSendAmount(sendName, 0);
    }

    logger.info(`Channel ${this.name} reset to defaults`);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopMetering();

    // Dispose sends
    for (const send of this.sendNodes.values()) {
      send.dispose();
    }
    this.sendNodes.clear();
    this.sendTargets.clear();

    // Dispose audio nodes
    this.input.dispose();
    this.compressor.dispose();
    this.eq3.dispose();
    this.volume.dispose();
    this.panner.dispose();
    this.meter.dispose();
    this.mute.dispose();
    this.output.dispose();

    this.levelCallbacks.clear();

    logger.info(`Channel ${this.name} disposed`);
  }
}

/**
 * Channel strip preset
 */
export interface ChannelPreset {
  name: string;
  volume: number;
  pan: number;
  eq: {
    high: number;
    mid: number;
    low: number;
  };
  compressor: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  sends: Record<string, number>;
}

/**
 * Common channel presets
 */
export const ChannelPresets: Record<string, ChannelPreset> = {
  kick: {
    name: 'Kick',
    volume: 0,
    pan: 0,
    eq: { high: -3, mid: 2, low: 4 },
    compressor: { threshold: -8, ratio: 6, attack: 0.001, release: 0.1 },
    sends: {},
  },
  snare: {
    name: 'Snare',
    volume: 0,
    pan: 0,
    eq: { high: 2, mid: 3, low: -2 },
    compressor: { threshold: -10, ratio: 4, attack: 0.002, release: 0.15 },
    sends: {},
  },
  hihat: {
    name: 'Hi-Hat',
    volume: -3,
    pan: 0.2,
    eq: { high: 4, mid: -1, low: -6 },
    compressor: { threshold: -15, ratio: 3, attack: 0.001, release: 0.05 },
    sends: {},
  },
  tom: {
    name: 'Tom',
    volume: -2,
    pan: -0.3,
    eq: { high: 0, mid: 2, low: 3 },
    compressor: { threshold: -12, ratio: 4, attack: 0.003, release: 0.2 },
    sends: {},
  },
  cymbal: {
    name: 'Cymbal',
    volume: -4,
    pan: 0.5,
    eq: { high: 3, mid: -2, low: -8 },
    compressor: { threshold: -18, ratio: 2.5, attack: 0.005, release: 0.3 },
    sends: {},
  },
};
