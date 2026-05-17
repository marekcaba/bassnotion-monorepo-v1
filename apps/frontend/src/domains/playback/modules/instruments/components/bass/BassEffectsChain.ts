/**
 * Bass Effects Chain
 *
 * Effects processing optimized for bass frequencies
 */

import { getTone } from '@/domains/playback/utils/tone';
import type * as ToneTypes from 'tone';
import { BaseInstrumentEffects } from '../../architecture/IInstrumentEffects.js';
import type {
  EffectsChainConfig,
  EffectParams,
} from '../../architecture/IInstrumentEffects.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('BassEffectsChain');

export interface BassEffectParams extends EffectParams {
  // Bass-specific parameters
  enhancer?: {
    low: number; // Low frequency enhancement 0-1
    sub: number; // Sub-bass enhancement 0-1
    harmonics: number; // Harmonic generation 0-1
  };

  octaver?: {
    wet: number; // Mix 0-1
    octaveDown: number; // -2 to 0
    octaveUp: number; // 0 to 2
  };

  envelope?: {
    sensitivity: number; // Envelope follower sensitivity
    attack: number;
    release: number;
  };
}

export interface BassEffectsConfig extends EffectsChainConfig {
  effects: BassEffectParams;
  // Bass-specific chain options
  sidechain?: {
    enabled: boolean;
    source?: string; // 'kick' or custom source
    amount: number;
    attack: number;
    release: number;
  };

  ampSimulation?: {
    enabled: boolean;
    model: 'tube' | 'solid-state' | 'hybrid';
    gain: number;
    presence: number;
  };
}

/**
 * Effects chain optimized for bass processing
 */
export class BassEffectsChain extends BaseInstrumentEffects {
  // Bass-specific effects
  private bassEnhancer: ToneTypes.MultibandSplit | null = null;
  private subEnhancer: ToneTypes.Oscillator | null = null;
  private octaver: ToneTypes.PitchShift | null = null;
  private envelopeFollower: ToneTypes.Follower | null = null;
  private autoWah: ToneTypes.AutoWah | null = null;

  // Amp simulation
  private preAmp: ToneTypes.Distortion | null = null;
  private toneStack: ToneTypes.EQ3 | null = null;
  private cabinet: ToneTypes.Convolver | null = null;

  // Sidechain compression
  private sidechainCompressor: ToneTypes.Compressor | null = null;
  private sidechainGate: ToneTypes.Gate | null = null;

  constructor(config?: BassEffectsConfig) {
    super(config);

    if (config) {
      this.setupBassEffects(config);
    }
  }

  /**
   * Setup bass-specific effects
   */
  private async setupBassEffects(config: BassEffectsConfig): Promise<void> {
    // Bass enhancer
    if (config.effects.enhancer) {
      await this.setupBassEnhancer(config.effects.enhancer);
    }

    // Octaver
    if (config.effects.octaver) {
      await this.setupOctaver(config.effects.octaver);
    }

    // Envelope follower / Auto-wah
    if (config.effects.envelope) {
      await this.setupEnvelopeEffects(config.effects.envelope);
    }

    // Amp simulation
    if (config.ampSimulation?.enabled) {
      await this.setupAmpSimulation(config.ampSimulation);
    }

    // Sidechain compression
    if (config.sidechain?.enabled) {
      await this.setupSidechain(config.sidechain);
    }

    // Rebuild the effects chain
    this.rebuildEffectsChain();
  }

  /**
   * Setup bass frequency enhancer
   */
  private async setupBassEnhancer(
    params: BassEffectParams['enhancer'],
  ): Promise<void> {
    if (!params) return;

    const Tone = await getTone();

    // Create multiband splitter for frequency-specific processing
    this.bassEnhancer = new Tone.MultibandSplit({
      lowFrequency: 100,
      highFrequency: 500,
    });

    // Sub-bass enhancer using a sine oscillator
    if (params.sub > 0) {
      this.subEnhancer = new Tone.Oscillator({
        type: 'sine',
        frequency: 50,
        volume: -12,
      });
      this.subEnhancer.start();
    }

    logger.info('Bass enhancer configured', params);
  }

  /**
   * Setup octaver effect
   */
  private async setupOctaver(
    params: BassEffectParams['octaver'],
  ): Promise<void> {
    if (!params) return;

    const Tone = await getTone();

    this.octaver = new Tone.PitchShift({
      pitch: params.octaveDown || -12, // Default one octave down
      windowSize: 0.1,
      delayTime: 0,
      feedback: 0,
      wet: params.wet,
    });

    logger.info('Octaver configured', params);
  }

  /**
   * Setup envelope-based effects
   */
  private async setupEnvelopeEffects(
    params: BassEffectParams['envelope'],
  ): Promise<void> {
    if (!params) return;

    const Tone = await getTone();

    // Envelope follower
    this.envelopeFollower = new Tone.Follower({
      attack: params.attack || 0.01,
      release: params.release || 0.1,
    });

    // Auto-wah controlled by envelope
    this.autoWah = new Tone.AutoWah({
      baseFrequency: 100,
      octaves: 2,
      sensitivity: params.sensitivity || 0,
      Q: 2,
      gain: 2,
      follower: {
        attack: params.attack || 0.01,
        release: params.release || 0.1,
      },
    });

    logger.info('Envelope effects configured', params);
  }

  /**
   * Setup amp simulation
   */
  private async setupAmpSimulation(
    config: BassEffectsConfig['ampSimulation'],
  ): Promise<void> {
    if (!config) return;

    const Tone = await getTone();

    // Pre-amp stage
    this.preAmp = new Tone.Distortion({
      distortion: config.gain * 0.3,
      wet: 1,
    });

    // Tone stack (bass, mid, treble)
    this.toneStack = new Tone.EQ3({
      low: 4,
      mid: -2,
      high: config.presence * 6,
      lowFrequency: 100,
      highFrequency: 3000,
    });

    // Cabinet simulation would require IR (Impulse Response)
    // For now, we'll use EQ to simulate cabinet coloration

    logger.info('Amp simulation configured', config);
  }

  /**
   * Setup sidechain compression
   */
  private async setupSidechain(
    config: BassEffectsConfig['sidechain'],
  ): Promise<void> {
    if (!config) return;

    const Tone = await getTone();

    this.sidechainCompressor = new Tone.Compressor({
      threshold: -20,
      ratio: 8,
      attack: config.attack || 0.001,
      release: config.release || 0.1,
    });

    // Gate for rhythmic effects
    this.sidechainGate = new Tone.Gate({
      threshold: -40,
      attack: 0.001,
      release: 0.1,
    });

    logger.info('Sidechain configured', config);
  }

  /**
   * Override to include bass-specific effects
   */
  protected rebuildEffectsChain(): void {
    // Disconnect all existing connections
    for (const effect of this.effectNodes.values()) {
      effect.disconnect();
    }

    let previousNode = this.input;

    // Pre-effects: Octaver
    if (this.octaver) {
      previousNode.connect(this.octaver);
      previousNode = this.octaver;
    }

    // EQ (from base class)
    if (this.effectNodes.get('eq')) {
      const eq = this.effectNodes.get('eq')!;
      previousNode.connect(eq);
      previousNode = eq;
    }

    // Bass enhancer
    if (this.bassEnhancer) {
      previousNode.connect(this.bassEnhancer);
      // Process low band with enhancement
      // This is simplified - in reality you'd process each band separately
      previousNode = this.bassEnhancer;
    }

    // Compressor (from base class)
    if (this.effectNodes.get('compressor')) {
      const comp = this.effectNodes.get('compressor')!;
      previousNode.connect(comp);
      previousNode = comp;
    }

    // Envelope effects
    if (this.autoWah) {
      previousNode.connect(this.autoWah);
      previousNode = this.autoWah;
    }

    // Amp simulation
    if (this.preAmp && this.toneStack) {
      previousNode.connect(this.preAmp);
      this.preAmp.connect(this.toneStack);
      previousNode = this.toneStack;
    }

    // Distortion (from base class)
    if (this.effectNodes.get('distortion')) {
      const dist = this.effectNodes.get('distortion')!;
      previousNode.connect(dist);
      previousNode = dist;
    }

    // Filter (from base class)
    if (this.effectNodes.get('filter')) {
      const filter = this.effectNodes.get('filter')!;
      previousNode.connect(filter);
      previousNode = filter;
    }

    // Delay (from base class)
    if (this.effectNodes.get('delay')) {
      const delay = this.effectNodes.get('delay')!;
      previousNode.connect(delay);
      previousNode = delay;
    }

    // Reverb (from base class)
    if (this.effectNodes.get('reverb')) {
      const reverb = this.effectNodes.get('reverb')!;
      previousNode.connect(reverb);
      previousNode = reverb;
    }

    // Final connection to output
    previousNode.connect(this.output);

    logger.debug('Bass effects chain rebuilt');
  }

  /**
   * Set bass enhancer parameters
   */
  setBassEnhancer(low: number, sub: number, harmonics: number): void {
    if (!this.bassEnhancer) {
      this.setupBassEnhancer({ low, sub, harmonics });
      this.rebuildEffectsChain();
      return;
    }

    // Update existing enhancer
    // This is simplified - actual implementation would adjust multiband processing
    if (this.subEnhancer) {
      this.subEnhancer.volume.value = -12 + sub * 12;
    }

    logger.debug('Bass enhancer updated', { low, sub, harmonics });
  }

  /**
   * Set octaver parameters
   */
  setOctaver(wet: number, octaveDown: number, octaveUp?: number): void {
    if (!this.octaver) {
      this.setupOctaver({ wet, octaveDown, octaveUp: octaveUp || 0 });
      this.rebuildEffectsChain();
      return;
    }

    this.octaver.wet.value = wet;
    this.octaver.pitch = octaveDown * 12; // Convert octaves to semitones

    logger.debug('Octaver updated', { wet, octaveDown, octaveUp });
  }

  /**
   * Set envelope filter sensitivity
   */
  setEnvelopeFilter(
    sensitivity: number,
    attack?: number,
    release?: number,
  ): void {
    if (!this.autoWah) {
      this.setupEnvelopeEffects({
        sensitivity,
        attack: attack || 0.01,
        release: release || 0.1,
      });
      this.rebuildEffectsChain();
      return;
    }

    this.autoWah.sensitivity = sensitivity;
    if (attack !== undefined) {
      this.autoWah.follower.attack = attack;
    }
    if (release !== undefined) {
      this.autoWah.follower.release = release;
    }

    logger.debug('Envelope filter updated', { sensitivity, attack, release });
  }

  /**
   * Set amp simulation parameters
   */
  setAmpSimulation(
    enabled: boolean,
    model?: 'tube' | 'solid-state' | 'hybrid',
    gain?: number,
    presence?: number,
  ): void {
    if (!enabled) {
      if (this.preAmp) {
        this.preAmp.dispose();
        this.preAmp = null;
      }
      if (this.toneStack) {
        this.toneStack.dispose();
        this.toneStack = null;
      }
      this.rebuildEffectsChain();
      return;
    }

    if (!this.preAmp || !this.toneStack) {
      this.setupAmpSimulation({
        enabled: true,
        model: model || 'tube',
        gain: gain || 0.5,
        presence: presence || 0.5,
      });
      this.rebuildEffectsChain();
      return;
    }

    // Update existing amp
    if (gain !== undefined) {
      this.preAmp.distortion = gain * 0.3;
    }
    if (presence !== undefined) {
      this.toneStack.high.value = presence * 6;
    }

    logger.debug('Amp simulation updated', { model, gain, presence });
  }

  /**
   * Trigger sidechain (e.g., from kick drum)
   */
  async triggerSidechain(): Promise<void> {
    if (!this.sidechainCompressor) return;

    // In a real implementation, this would be triggered by an external source
    // For now, we'll simulate it
    const Tone = await getTone();
    const now = Tone.now();
    this.sidechainCompressor.reduction;

    logger.debug('Sidechain triggered');
  }

  /**
   * Get bass-specific effect states
   */
  getBassEffectStates(): {
    enhancerEnabled: boolean;
    enhancerLow?: number;
    enhancerSub?: number;
    octaverEnabled: boolean;
    octaverWet?: number;
    octaverPitch?: number;
    envelopeEnabled: boolean;
    envelopeSensitivity?: number;
    ampEnabled: boolean;
    ampGain?: number;
    sidechainEnabled: boolean;
  } {
    return {
      enhancerEnabled: this.bassEnhancer !== null,
      enhancerLow: 0.5, // Placeholder
      enhancerSub: this.subEnhancer ? 0.5 : 0,
      octaverEnabled: this.octaver !== null,
      octaverWet: this.octaver?.wet.value,
      octaverPitch: this.octaver?.pitch,
      envelopeEnabled: this.autoWah !== null,
      envelopeSensitivity: this.autoWah?.sensitivity,
      ampEnabled: this.preAmp !== null,
      ampGain: this.preAmp?.distortion,
      sidechainEnabled: this.sidechainCompressor !== null,
    };
  }

  /**
   * Override dispose to clean up bass-specific effects
   */
  dispose(): void {
    // Dispose bass-specific effects
    this.bassEnhancer?.dispose();
    this.subEnhancer?.dispose();
    this.octaver?.dispose();
    this.envelopeFollower?.dispose();
    this.autoWah?.dispose();
    this.preAmp?.dispose();
    this.toneStack?.dispose();
    this.cabinet?.dispose();
    this.sidechainCompressor?.dispose();
    this.sidechainGate?.dispose();

    // Call parent dispose
    super.dispose();

    logger.info('BassEffectsChain disposed');
  }
}

/**
 * Bass effect presets
 */
export const BassEffectPresets: Record<string, BassEffectsConfig> = {
  clean: {
    effects: {
      eq: { low: 2, mid: 0, high: -1 },
      compressor: { threshold: -15, ratio: 3 },
      reverb: { mix: 0.05, decay: 0.3 },
    },
    bypass: false,
  },

  warm: {
    effects: {
      eq: { low: 4, mid: -1, high: -3 },
      compressor: { threshold: -12, ratio: 4 },
      enhancer: { low: 0.3, sub: 0.2, harmonics: 0.1 },
      reverb: { mix: 0.1, decay: 0.5 },
    },
    ampSimulation: {
      enabled: true,
      model: 'tube',
      gain: 0.3,
      presence: 0.4,
    },
    bypass: false,
  },

  funky: {
    effects: {
      eq: { low: 0, mid: 4, high: 3 },
      compressor: { threshold: -10, ratio: 6 },
      envelope: { sensitivity: 0.6, attack: 0.005, release: 0.1 },
      filter: { type: 'bandpass', frequency: 1000, resonance: 4 },
    },
    bypass: false,
  },

  rock: {
    effects: {
      eq: { low: 3, mid: 2, high: 1 },
      compressor: { threshold: -8, ratio: 5 },
      distortion: { amount: 0.3 },
      enhancer: { low: 0.4, sub: 0.3, harmonics: 0.2 },
    },
    ampSimulation: {
      enabled: true,
      model: 'solid-state',
      gain: 0.6,
      presence: 0.7,
    },
    bypass: false,
  },

  dubstep: {
    effects: {
      eq: { low: 6, mid: -4, high: -6 },
      compressor: { threshold: -6, ratio: 8 },
      filter: { type: 'lowpass', frequency: 400, resonance: 2 },
      enhancer: { low: 0.8, sub: 0.9, harmonics: 0.1 },
      octaver: { wet: 0.4, octaveDown: -1, octaveUp: 0 },
    },
    sidechain: {
      enabled: true,
      source: 'kick',
      amount: 0.7,
      attack: 0.001,
      release: 0.1,
    },
    bypass: false,
  },

  vintage: {
    effects: {
      eq: { low: 2, mid: -2, high: -4 },
      compressor: { threshold: -18, ratio: 2.5 },
      enhancer: { low: 0.2, sub: 0.1, harmonics: 0.3 },
      reverb: { mix: 0.2, decay: 1.2 },
    },
    ampSimulation: {
      enabled: true,
      model: 'tube',
      gain: 0.4,
      presence: 0.3,
    },
    bypass: false,
  },
};
