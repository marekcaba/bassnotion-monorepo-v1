/**
 * Instrument Effects Interface
 *
 * Manages audio effects and signal processing
 */

import type * as ToneTypes from 'tone';

// Helper to get Tone from window (must be initialized before effects are used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone as typeof import('tone');
    }
  }
  throw new Error(
    'IInstrumentEffects: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

export interface AudioEffect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  wet: number; // 0-1
  params: Record<string, any>;
  node?: ToneTypes.ToneAudioNode;
}

export type EffectType =
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'phaser'
  | 'distortion'
  | 'filter'
  | 'compressor'
  | 'eq'
  | 'tremolo'
  | 'vibrato'
  | 'autowah'
  | 'bitcrusher'
  | 'custom';

export interface EffectPreset {
  id: string;
  name: string;
  description?: string;
  effects: Partial<AudioEffect>[];
}

export interface EffectsChainOptions {
  bypass?: boolean;
  inputGain?: number; // in dB
  outputGain?: number; // in dB
  dryWet?: number; // 0-1 global mix
}

/**
 * Effects management for instruments
 */
export interface IInstrumentEffects {
  // Effect management
  addEffect(effect: AudioEffect | EffectType, params?: any): string; // returns effect ID
  removeEffect(effectId: string): void;
  updateEffect(effectId: string, params: Partial<AudioEffect>): void;

  // Chain management
  getEffects(): AudioEffect[];
  clearEffects(): void;
  reorderEffects(effectIds: string[]): void;

  // Presets
  loadPreset(preset: EffectPreset): void;
  savePreset(name: string, description?: string): EffectPreset;

  // Control
  bypass(bypass: boolean): void;
  setEffectEnabled(effectId: string, enabled: boolean): void;
  setWetAmount(effectId: string, wet: number): void;

  // Chain options
  setChainOptions(options: EffectsChainOptions): void;
  getChainOptions(): EffectsChainOptions;
}

/**
 * Factory for creating effect nodes
 */
export interface IEffectFactory {
  createEffect(type: EffectType, params?: any): ToneTypes.ToneAudioNode;
  getDefaultParams(type: EffectType): Record<string, any>;
  validateParams(type: EffectType, params: any): boolean;
}

/**
 * Base effects implementation
 */
export abstract class BaseInstrumentEffects implements IInstrumentEffects {
  protected effects: Map<string, AudioEffect> = new Map();
  protected effectOrder: string[] = [];
  protected chainOptions: EffectsChainOptions = {
    bypass: false,
    inputGain: 0,
    outputGain: 0,
    dryWet: 1,
  };

  protected input!: ToneTypes.Gain;
  protected output!: ToneTypes.Gain;
  protected drySignal!: ToneTypes.Gain;
  protected wetSignal!: ToneTypes.Gain;
  protected effectsChain: ToneTypes.ToneAudioNode[] = [];

  constructor() {
    const Tone = getTone();

    // Create signal flow
    this.input = new Tone.Gain({ gain: 1 });
    this.output = new Tone.Gain({ gain: 1 });
    this.drySignal = new Tone.Gain({ gain: 1 });
    this.wetSignal = new Tone.Gain({ gain: 1 });

    // Connect dry path
    this.input.connect(this.drySignal);
    this.drySignal.connect(this.output);

    // Wet path will be connected through effects
    this.input.connect(this.wetSignal);
  }

  abstract createEffect(
    type: EffectType,
    params?: any,
  ): ToneTypes.ToneAudioNode;

  addEffect(effectOrType: AudioEffect | EffectType, params?: any): string {
    let effect: AudioEffect;

    if (typeof effectOrType === 'string') {
      const node = this.createEffect(effectOrType, params);
      effect = {
        id: this.generateEffectId(),
        type: effectOrType,
        name: effectOrType,
        enabled: true,
        wet: 1,
        params: params || {},
        node,
      };
    } else {
      effect = effectOrType;
      if (!effect.node) {
        effect.node = this.createEffect(effect.type, effect.params);
      }
    }

    this.effects.set(effect.id, effect);
    this.effectOrder.push(effect.id);
    this.rebuildChain();

    return effect.id;
  }

  removeEffect(effectId: string): void {
    const effect = this.effects.get(effectId);
    if (effect) {
      if (effect.node) {
        effect.node.dispose();
      }
      this.effects.delete(effectId);
      this.effectOrder = this.effectOrder.filter((id) => id !== effectId);
      this.rebuildChain();
    }
  }

  updateEffect(effectId: string, params: Partial<AudioEffect>): void {
    const effect = this.effects.get(effectId);
    if (effect) {
      Object.assign(effect, params);

      // Update node parameters
      if (effect.node && params.params) {
        for (const [key, value] of Object.entries(params.params)) {
          if (key in effect.node) {
            (effect.node as any)[key].value = value;
          }
        }
      }

      // Update wet amount if changed
      if (params.wet !== undefined && effect.node && 'wet' in effect.node) {
        (effect.node as any).wet.value = params.wet;
      }

      // Rebuild if enabled state changed
      if (params.enabled !== undefined) {
        this.rebuildChain();
      }
    }
  }

  getEffects(): AudioEffect[] {
    return this.effectOrder.map((id) => this.effects.get(id)!).filter(Boolean);
  }

  clearEffects(): void {
    for (const effect of this.effects.values()) {
      if (effect.node) {
        effect.node.dispose();
      }
    }
    this.effects.clear();
    this.effectOrder = [];
    this.rebuildChain();
  }

  reorderEffects(effectIds: string[]): void {
    // Validate all IDs exist
    const validIds = effectIds.filter((id) => this.effects.has(id));
    if (validIds.length === this.effectOrder.length) {
      this.effectOrder = validIds;
      this.rebuildChain();
    }
  }

  loadPreset(preset: EffectPreset): void {
    this.clearEffects();
    for (const effectData of preset.effects) {
      this.addEffect(effectData as AudioEffect);
    }
  }

  savePreset(name: string, description?: string): EffectPreset {
    return {
      id: this.generatePresetId(),
      name,
      description,
      effects: this.getEffects().map((effect) => ({
        type: effect.type,
        name: effect.name,
        enabled: effect.enabled,
        wet: effect.wet,
        params: { ...effect.params },
      })),
    };
  }

  bypass(bypass: boolean): void {
    this.chainOptions.bypass = bypass;
    this.updateDryWetMix();
  }

  setEffectEnabled(effectId: string, enabled: boolean): void {
    this.updateEffect(effectId, { enabled });
  }

  setWetAmount(effectId: string, wet: number): void {
    this.updateEffect(effectId, { wet: Math.max(0, Math.min(1, wet)) });
  }

  setChainOptions(options: EffectsChainOptions): void {
    const Tone = getTone();
    this.chainOptions = { ...this.chainOptions, ...options };

    if (options.inputGain !== undefined) {
      this.input.gain.value = Tone.dbToGain(options.inputGain);
    }

    if (options.outputGain !== undefined) {
      this.output.gain.value = Tone.dbToGain(options.outputGain);
    }

    if (options.bypass !== undefined || options.dryWet !== undefined) {
      this.updateDryWetMix();
    }
  }

  getChainOptions(): EffectsChainOptions {
    return { ...this.chainOptions };
  }

  protected rebuildChain(): void {
    // Disconnect existing chain
    this.wetSignal.disconnect();
    for (const node of this.effectsChain) {
      node.disconnect();
    }

    // Build new chain
    this.effectsChain = [];
    let lastNode: ToneTypes.ToneAudioNode = this.wetSignal;

    for (const effectId of this.effectOrder) {
      const effect = this.effects.get(effectId);
      if (effect && effect.enabled && effect.node) {
        lastNode.connect(effect.node);
        lastNode = effect.node;
        this.effectsChain.push(effect.node);
      }
    }

    // Connect to output
    lastNode.connect(this.output);
    this.updateDryWetMix();
  }

  protected updateDryWetMix(): void {
    if (this.chainOptions.bypass) {
      this.drySignal.gain.value = 1;
      this.wetSignal.gain.value = 0;
    } else {
      const wet = this.chainOptions.dryWet || 1;
      this.drySignal.gain.value = 1 - wet;
      this.wetSignal.gain.value = wet;
    }
  }

  protected generateEffectId(): string {
    return `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generatePresetId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  dispose(): void {
    this.clearEffects();
    this.input.dispose();
    this.output.dispose();
    this.drySignal.dispose();
    this.wetSignal.dispose();
  }
}

/**
 * Common effect presets
 */
export const CommonEffectPresets: Record<string, EffectPreset> = {
  clean: {
    id: 'clean',
    name: 'Clean',
    description: 'No effects',
    effects: [],
  },

  ambient: {
    id: 'ambient',
    name: 'Ambient',
    description: 'Spacious reverb and delay',
    effects: [
      {
        type: 'reverb',
        name: 'Hall Reverb',
        enabled: true,
        wet: 0.6,
        params: {
          roomSize: 0.8,
          dampening: 3000,
          preDelay: 0.01,
        },
      },
      {
        type: 'delay',
        name: 'Echo',
        enabled: true,
        wet: 0.3,
        params: {
          delayTime: '8n',
          feedback: 0.3,
        },
      },
    ],
  },

  vintage: {
    id: 'vintage',
    name: 'Vintage',
    description: 'Classic analog-style effects',
    effects: [
      {
        type: 'distortion',
        name: 'Tube Drive',
        enabled: true,
        wet: 0.3,
        params: {
          distortion: 0.3,
        },
      },
      {
        type: 'chorus',
        name: 'Analog Chorus',
        enabled: true,
        wet: 0.5,
        params: {
          frequency: 1.5,
          delayTime: 3.5,
          depth: 0.7,
        },
      },
    ],
  },
};
