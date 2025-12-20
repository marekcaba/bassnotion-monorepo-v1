/**
 * Drum Effects Rack
 *
 * Effects processing for drum instruments
 */

import type * as ToneTypes from 'tone';

// Helper to get Tone from window (must be initialized before DrumEffectsRack is used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('DrumEffectsRack: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}
import { BaseInstrumentEffects } from '../../architecture/IInstrumentEffects.js';
import type {
  EffectsChainConfig,
  EffectParams,
} from '../../architecture/IInstrumentEffects.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('DrumEffectsRack');

export interface DrumEffectParams extends EffectParams {
  // Drum-specific effect parameters
  gateThreshold?: number;
  gateRelease?: number;
  transientShaper?: {
    attack: number;
    sustain: number;
  };
  bitCrusher?: {
    bits: number;
    normFreq: number;
  };
}

export interface DrumEffectsConfig extends EffectsChainConfig {
  effects: DrumEffectParams;
  // Drum-specific sends
  parallelCompression?: {
    enabled: boolean;
    amount: number;
    threshold: number;
    ratio: number;
  };
  roomAmbience?: {
    enabled: boolean;
    size: number;
    damping: number;
    mix: number;
  };
}

/**
 * Effects rack optimized for drum processing
 */
export class DrumEffectsRack extends BaseInstrumentEffects {
  // Additional drum-specific effects
  private gate: ToneTypes.Gate | null = null;
  private transientShaper: ToneTypes.Envelope | null = null;
  private bitCrusher: ToneTypes.BitCrusher | null = null;
  private saturator: ToneTypes.Distortion | null = null;

  // Parallel processing
  private parallelCompressor: ToneTypes.Compressor | null = null;
  private parallelMix: ToneTypes.CrossFade | null = null;

  // Room ambience
  private roomReverb: ToneTypes.Reverb | null = null;
  private roomMix: ToneTypes.CrossFade | null = null;

  constructor(config?: DrumEffectsConfig) {
    super(config);

    if (config) {
      this.setupDrumEffects(config);
    }
  }

  /**
   * Setup drum-specific effects
   */
  private setupDrumEffects(config: DrumEffectsConfig): void {
    const Tone = getTone();

    // Gate
    if (config.effects.gateThreshold !== undefined) {
      this.gate = new Tone.Gate({
        threshold: config.effects.gateThreshold,
        attack: 0.001,
        release: config.effects.gateRelease || 0.1,
      });
    }

    // Bit crusher for lo-fi effects
    if (config.effects.bitCrusher) {
      this.bitCrusher = new Tone.BitCrusher({
        bits: config.effects.bitCrusher.bits,
        wet: 1,
      });
    }

    // Saturator for warmth
    this.saturator = new Tone.Distortion({
      distortion: 0.1,
      wet: 0,
    });

    // Parallel compression
    if (config.parallelCompression?.enabled) {
      this.setupParallelCompression(config.parallelCompression);
    }

    // Room ambience
    if (config.roomAmbience?.enabled) {
      this.setupRoomAmbience(config.roomAmbience);
    }

    // Rebuild chain with drum effects
    this.rebuildEffectsChain();
  }

  /**
   * Setup parallel compression
   */
  private setupParallelCompression(config: {
    amount: number;
    threshold: number;
    ratio: number;
  }): void {
    const Tone = getTone();

    this.parallelCompressor = new Tone.Compressor({
      threshold: config.threshold,
      ratio: config.ratio,
      attack: 0.001,
      release: 0.05,
    });

    this.parallelMix = new Tone.CrossFade(config.amount);

    // Connect parallel path
    // This will be integrated in rebuildEffectsChain

    logger.info('Parallel compression enabled', config);
  }

  /**
   * Setup room ambience
   */
  private setupRoomAmbience(config: {
    size: number;
    damping: number;
    mix: number;
  }): void {
    const Tone = getTone();

    this.roomReverb = new Tone.Reverb({
      decay: config.size,
      preDelay: 0.01,
      wet: 1,
    });

    this.roomMix = new Tone.CrossFade(config.mix);

    logger.info('Room ambience enabled', config);
  }

  /**
   * Override to include drum-specific effects
   */
  protected rebuildEffectsChain(): void {
    // Disconnect all existing connections
    for (const effect of this.effectNodes.values()) {
      effect.disconnect();
    }

    let previousNode = this.input;

    // Gate (if enabled)
    if (this.gate) {
      previousNode.connect(this.gate);
      previousNode = this.gate;
    }

    // EQ
    if (this.effectNodes.get('eq')) {
      const eq = this.effectNodes.get('eq')!;
      previousNode.connect(eq);
      previousNode = eq;
    }

    // Saturator
    if (this.saturator && this.saturator.wet.value > 0) {
      previousNode.connect(this.saturator);
      previousNode = this.saturator;
    }

    // Compressor
    if (this.effectNodes.get('compressor')) {
      const comp = this.effectNodes.get('compressor')!;
      previousNode.connect(comp);
      previousNode = comp;
    }

    // Bit crusher (if enabled)
    if (this.bitCrusher) {
      previousNode.connect(this.bitCrusher);
      previousNode = this.bitCrusher;
    }

    // Parallel compression
    if (this.parallelCompressor && this.parallelMix) {
      // Dry path
      previousNode.connect(this.parallelMix.a);

      // Wet path (heavy compression)
      previousNode.connect(this.parallelCompressor);
      this.parallelCompressor.connect(this.parallelMix.b);

      previousNode = this.parallelMix;
    }

    // Filter
    if (this.effectNodes.get('filter')) {
      const filter = this.effectNodes.get('filter')!;
      previousNode.connect(filter);
      previousNode = filter;
    }

    // Distortion
    if (this.effectNodes.get('distortion')) {
      const dist = this.effectNodes.get('distortion')!;
      previousNode.connect(dist);
      previousNode = dist;
    }

    // Delay
    if (this.effectNodes.get('delay')) {
      const delay = this.effectNodes.get('delay')!;
      previousNode.connect(delay);
      previousNode = delay;
    }

    // Room ambience
    if (this.roomReverb && this.roomMix) {
      // Dry path
      previousNode.connect(this.roomMix.a);

      // Wet path (room reverb)
      previousNode.connect(this.roomReverb);
      this.roomReverb.connect(this.roomMix.b);

      previousNode = this.roomMix;
    }

    // Main reverb
    if (this.effectNodes.get('reverb')) {
      const reverb = this.effectNodes.get('reverb')!;
      previousNode.connect(reverb);
      previousNode = reverb;
    }

    // Final connection to output
    previousNode.connect(this.output);

    logger.debug('Effects chain rebuilt with drum effects');
  }

  /**
   * Set gate parameters
   */
  setGate(threshold: number, release?: number): void {
    if (!this.gate) {
      const Tone = getTone();
      this.gate = new Tone.Gate({
        threshold,
        attack: 0.001,
        release: release || 0.1,
      });
      this.rebuildEffectsChain();
    } else {
      this.gate.threshold = threshold;
      if (release !== undefined) {
        this.gate.release = release;
      }
    }

    logger.debug('Gate settings updated', { threshold, release });
  }

  /**
   * Disable gate
   */
  disableGate(): void {
    if (this.gate) {
      this.gate.dispose();
      this.gate = null;
      this.rebuildEffectsChain();
    }
  }

  /**
   * Set bit crusher
   */
  setBitCrusher(bits: number, mix = 1): void {
    if (!this.bitCrusher) {
      const Tone = getTone();
      this.bitCrusher = new Tone.BitCrusher({ bits, wet: mix });
      this.rebuildEffectsChain();
    } else {
      this.bitCrusher.bits = bits;
      this.bitCrusher.wet.value = mix;
    }

    logger.debug('Bit crusher updated', { bits, mix });
  }

  /**
   * Disable bit crusher
   */
  disableBitCrusher(): void {
    if (this.bitCrusher) {
      this.bitCrusher.dispose();
      this.bitCrusher = null;
      this.rebuildEffectsChain();
    }
  }

  /**
   * Set saturation amount
   */
  setSaturation(amount: number): void {
    if (this.saturator) {
      this.saturator.distortion = amount;
      this.saturator.wet.value = amount > 0 ? 1 : 0;
      if (amount > 0) {
        this.rebuildEffectsChain();
      }
    }

    logger.debug('Saturation updated', { amount });
  }

  /**
   * Set parallel compression
   */
  setParallelCompression(
    enabled: boolean,
    amount?: number,
    threshold?: number,
    ratio?: number,
  ): void {
    if (enabled && !this.parallelCompressor) {
      this.setupParallelCompression({
        amount: amount || 0.5,
        threshold: threshold || -20,
        ratio: ratio || 10,
      });
      this.rebuildEffectsChain();
    } else if (!enabled && this.parallelCompressor) {
      this.parallelCompressor.dispose();
      this.parallelMix?.dispose();
      this.parallelCompressor = null;
      this.parallelMix = null;
      this.rebuildEffectsChain();
    } else if (this.parallelCompressor && this.parallelMix) {
      // Update existing
      if (amount !== undefined) {
        this.parallelMix.fade.value = amount;
      }
      if (threshold !== undefined) {
        this.parallelCompressor.threshold.value = threshold;
      }
      if (ratio !== undefined) {
        this.parallelCompressor.ratio.value = ratio;
      }
    }

    logger.debug('Parallel compression updated', {
      enabled,
      amount,
      threshold,
      ratio,
    });
  }

  /**
   * Set room ambience
   */
  setRoomAmbience(enabled: boolean, size?: number, mix?: number): void {
    if (enabled && !this.roomReverb) {
      this.setupRoomAmbience({
        size: size || 1.5,
        damping: 0.5,
        mix: mix || 0.2,
      });
      this.rebuildEffectsChain();
    } else if (!enabled && this.roomReverb) {
      this.roomReverb.dispose();
      this.roomMix?.dispose();
      this.roomReverb = null;
      this.roomMix = null;
      this.rebuildEffectsChain();
    } else if (this.roomReverb && this.roomMix) {
      // Update existing
      if (size !== undefined) {
        this.roomReverb.decay = size;
      }
      if (mix !== undefined) {
        this.roomMix.fade.value = mix;
      }
    }

    logger.debug('Room ambience updated', { enabled, size, mix });
  }

  /**
   * Apply punch enhancement (transient shaping)
   */
  setPunch(attack: number, sustain: number): void {
    // This would require a more sophisticated transient shaper
    // For now, we can approximate with compressor settings
    const compressor = this.effectNodes.get('compressor') as ToneTypes.Compressor;
    if (compressor) {
      compressor.attack.value = Math.max(0.001, 0.01 - attack * 0.009);
      compressor.release.value = Math.max(0.01, 0.1 * sustain);
    }

    logger.debug('Punch settings updated', { attack, sustain });
  }

  /**
   * Get drum-specific effect states
   */
  getDrumEffectStates(): {
    gateEnabled: boolean;
    gateThreshold?: number;
    bitCrusherEnabled: boolean;
    bitCrusherBits?: number;
    saturation: number;
    parallelCompressionEnabled: boolean;
    parallelCompressionAmount?: number;
    roomAmbienceEnabled: boolean;
    roomAmbienceMix?: number;
  } {
    return {
      gateEnabled: this.gate !== null,
      gateThreshold: this.gate?.threshold,
      bitCrusherEnabled: this.bitCrusher !== null,
      bitCrusherBits: this.bitCrusher?.bits,
      saturation: this.saturator?.distortion || 0,
      parallelCompressionEnabled: this.parallelCompressor !== null,
      parallelCompressionAmount: this.parallelMix?.fade.value,
      roomAmbienceEnabled: this.roomReverb !== null,
      roomAmbienceMix: this.roomMix?.fade.value,
    };
  }

  /**
   * Override dispose to clean up drum-specific effects
   */
  dispose(): void {
    // Dispose drum-specific effects
    this.gate?.dispose();
    this.transientShaper?.dispose();
    this.bitCrusher?.dispose();
    this.saturator?.dispose();
    this.parallelCompressor?.dispose();
    this.parallelMix?.dispose();
    this.roomReverb?.dispose();
    this.roomMix?.dispose();

    // Call parent dispose
    super.dispose();

    logger.info('DrumEffectsRack disposed');
  }
}

/**
 * Drum effect presets
 */
export const DrumEffectPresets: Record<string, DrumEffectsConfig> = {
  clean: {
    effects: {
      eq: { low: 0, mid: 0, high: 0 },
      compressor: { threshold: -12, ratio: 4 },
      reverb: { mix: 0.1, decay: 0.5 },
    },
    bypass: false,
  },

  punchy: {
    effects: {
      eq: { low: 3, mid: 1, high: 2 },
      compressor: { threshold: -8, ratio: 6 },
      reverb: { mix: 0.05, decay: 0.3 },
      gateThreshold: -40,
    },
    parallelCompression: {
      enabled: true,
      amount: 0.4,
      threshold: -20,
      ratio: 10,
    },
    bypass: false,
  },

  vintage: {
    effects: {
      eq: { low: 2, mid: -1, high: -3 },
      compressor: { threshold: -15, ratio: 3 },
      reverb: { mix: 0.2, decay: 1.2 },
      distortion: { amount: 0.2 },
      bitCrusher: { bits: 8, normFreq: 0.5 },
    },
    roomAmbience: {
      enabled: true,
      size: 1.5,
      damping: 0.7,
      mix: 0.3,
    },
    bypass: false,
  },

  lofi: {
    effects: {
      eq: { low: -4, mid: 2, high: -6 },
      compressor: { threshold: -6, ratio: 8 },
      filter: { type: 'lowpass', frequency: 5000, resonance: 2 },
      bitCrusher: { bits: 6, normFreq: 0.3 },
      distortion: { amount: 0.4 },
    },
    bypass: false,
  },

  stadium: {
    effects: {
      eq: { low: 4, mid: 0, high: 3 },
      compressor: { threshold: -10, ratio: 5 },
      reverb: { mix: 0.4, decay: 3 },
      delay: { time: 0.125, feedback: 0.3, mix: 0.2 },
    },
    roomAmbience: {
      enabled: true,
      size: 4,
      damping: 0.3,
      mix: 0.5,
    },
    bypass: false,
  },

  gated: {
    effects: {
      eq: { low: 1, mid: 0, high: 1 },
      compressor: { threshold: -10, ratio: 6 },
      gateThreshold: -30,
      gateRelease: 0.05,
      reverb: { mix: 0, decay: 0 },
    },
    bypass: false,
  },
};
