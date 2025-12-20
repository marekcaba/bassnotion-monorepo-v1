/**
 * Bass Articulation
 *
 * Handles bass playing techniques and articulations
 */

import { getTone } from '@/domains/playback/utils/tone';
import type { BassNote } from './BassSynthEngine.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('BassArticulation');

export interface ArticulationParams {
  // Timing adjustments
  attackTime?: number;
  releaseTime?: number;
  noteLength?: number; // Percentage of full duration

  // Tonal adjustments
  filterModulation?: {
    amount: number;
    attack: number;
    decay: number;
  };

  // Pitch adjustments
  pitchBend?: {
    amount: number; // Semitones
    time: number; // Duration of bend
    curve: 'linear' | 'exponential';
  };

  // Dynamics
  velocityCurve?: {
    attack: number; // 0-1
    sustain: number; // 0-1
  };
}

export interface TechniqueDefinition {
  id: string;
  name: string;
  description?: string;
  params: ArticulationParams;
  // Additional effects specific to the technique
  effects?: {
    distortion?: number;
    chorus?: number;
    phaser?: boolean;
  };
}

export interface ArticulationState {
  currentTechnique: string;
  techniques: Map<string, TechniqueDefinition>;
  customTechniques: Map<string, TechniqueDefinition>;
}

/**
 * Manages bass articulation and playing techniques
 */
export class BassArticulation {
  private state: ArticulationState = {
    currentTechnique: 'fingered',
    techniques: new Map(),
    customTechniques: new Map(),
  };

  // Built-in technique definitions
  private builtInTechniques: Record<string, TechniqueDefinition> = {
    fingered: {
      id: 'fingered',
      name: 'Fingered',
      description: 'Standard fingerstyle bass playing',
      params: {
        attackTime: 0.01,
        releaseTime: 0.3,
        noteLength: 0.95,
        filterModulation: {
          amount: 0.2,
          attack: 0.02,
          decay: 0.1,
        },
      },
    },

    picked: {
      id: 'picked',
      name: 'Picked',
      description: 'Playing with a pick for brighter attack',
      params: {
        attackTime: 0.005,
        releaseTime: 0.2,
        noteLength: 0.9,
        filterModulation: {
          amount: 0.4,
          attack: 0.001,
          decay: 0.05,
        },
        velocityCurve: {
          attack: 1.2,
          sustain: 0.8,
        },
      },
    },

    slapped: {
      id: 'slapped',
      name: 'Slapped',
      description: 'Slap bass technique with percussive attack',
      params: {
        attackTime: 0.001,
        releaseTime: 0.1,
        noteLength: 0.7,
        filterModulation: {
          amount: 0.8,
          attack: 0.001,
          decay: 0.03,
        },
        velocityCurve: {
          attack: 1.5,
          sustain: 0.3,
        },
      },
      effects: {
        distortion: 0.1,
      },
    },

    popped: {
      id: 'popped',
      name: 'Popped',
      description: 'Pop technique for bright, snappy sound',
      params: {
        attackTime: 0.002,
        releaseTime: 0.15,
        noteLength: 0.8,
        filterModulation: {
          amount: 0.9,
          attack: 0.001,
          decay: 0.04,
        },
        pitchBend: {
          amount: 0.5,
          time: 0.01,
          curve: 'exponential',
        },
        velocityCurve: {
          attack: 1.3,
          sustain: 0.5,
        },
      },
    },

    muted: {
      id: 'muted',
      name: 'Palm Muted',
      description: 'Muted strings for short, punchy notes',
      params: {
        attackTime: 0.005,
        releaseTime: 0.05,
        noteLength: 0.3,
        filterModulation: {
          amount: -0.5,
          attack: 0.01,
          decay: 0.02,
        },
        velocityCurve: {
          attack: 0.8,
          sustain: 0.2,
        },
      },
    },

    harmonics: {
      id: 'harmonics',
      name: 'Harmonics',
      description: 'Natural and artificial harmonics',
      params: {
        attackTime: 0.02,
        releaseTime: 0.8,
        noteLength: 1.0,
        filterModulation: {
          amount: 1.0,
          attack: 0.05,
          decay: 0.3,
        },
      },
      effects: {
        chorus: 0.3,
      },
    },

    tapped: {
      id: 'tapped',
      name: 'Tapped',
      description: 'Two-handed tapping technique',
      params: {
        attackTime: 0.003,
        releaseTime: 0.15,
        noteLength: 0.85,
        filterModulation: {
          amount: 0.6,
          attack: 0.002,
          decay: 0.06,
        },
        velocityCurve: {
          attack: 1.1,
          sustain: 0.6,
        },
      },
      effects: {
        distortion: 0.05,
        chorus: 0.2,
      },
    },

    slideUp: {
      id: 'slideUp',
      name: 'Slide Up',
      description: 'Sliding up to the target note',
      params: {
        attackTime: 0.01,
        releaseTime: 0.3,
        noteLength: 1.0,
        pitchBend: {
          amount: -12, // Start 1 octave below
          time: 0.2,
          curve: 'exponential',
        },
      },
    },

    slideDown: {
      id: 'slideDown',
      name: 'Slide Down',
      description: 'Sliding down from the note',
      params: {
        attackTime: 0.01,
        releaseTime: 0.5,
        noteLength: 1.2,
        pitchBend: {
          amount: -5, // Slide down 5 semitones
          time: 0.3,
          curve: 'linear',
        },
      },
    },

    hammerOn: {
      id: 'hammerOn',
      name: 'Hammer-On',
      description: 'Hammer-on technique without picking',
      params: {
        attackTime: 0.02,
        releaseTime: 0.2,
        noteLength: 0.9,
        velocityCurve: {
          attack: 0.7,
          sustain: 0.8,
        },
        filterModulation: {
          amount: 0.3,
          attack: 0.03,
          decay: 0.1,
        },
      },
    },

    pullOff: {
      id: 'pullOff',
      name: 'Pull-Off',
      description: 'Pull-off technique',
      params: {
        attackTime: 0.01,
        releaseTime: 0.2,
        noteLength: 0.85,
        velocityCurve: {
          attack: 0.8,
          sustain: 0.7,
        },
        pitchBend: {
          amount: -0.2,
          time: 0.02,
          curve: 'exponential',
        },
      },
    },
  };

  constructor() {
    // Initialize built-in techniques
    for (const [key, technique] of Object.entries(this.builtInTechniques)) {
      this.state.techniques.set(key, technique);
    }

    logger.info('BassArticulation initialized', {
      techniques: this.state.techniques.size,
    });
  }

  /**
   * Apply articulation to a bass note
   */
  applyArticulation(
    note: BassNote,
    synth: any, // Tone.Synth or similar
    filter?: any, // Optional filter for modulation
  ): BassNote {
    const technique = note.technique || this.state.currentTechnique;
    const definition = this.getTechnique(technique);

    if (!definition) {
      logger.warn(`Unknown technique: ${technique}`);
      return note;
    }

    const params = definition.params;
    const modifiedNote = { ...note };

    // Apply timing modifications
    if (params.noteLength !== undefined && modifiedNote.duration) {
      modifiedNote.duration *= params.noteLength;
    }

    // Apply attack time
    if (params.attackTime !== undefined && synth.envelope) {
      synth.envelope.attack = params.attackTime;
    }

    // Apply release time
    if (params.releaseTime !== undefined && synth.envelope) {
      synth.envelope.release = params.releaseTime;
    }

    // Apply velocity curve
    if (params.velocityCurve) {
      modifiedNote.velocity = this.applyVelocityCurve(
        modifiedNote.velocity,
        params.velocityCurve,
      );
    }

    // Schedule filter modulation
    if (params.filterModulation && filter) {
      this.scheduleFilterModulation(filter, params.filterModulation, note.time);
    }

    // Schedule pitch bend
    if (params.pitchBend && synth.detune) {
      this.schedulePitchBend(synth.detune, params.pitchBend, note.time);
    }

    logger.debug(`Applied ${technique} articulation`, {
      originalDuration: note.duration,
      modifiedDuration: modifiedNote.duration,
    });

    return modifiedNote;
  }

  /**
   * Get technique definition
   */
  getTechnique(techniqueId: string): TechniqueDefinition | undefined {
    return (
      this.state.techniques.get(techniqueId) ||
      this.state.customTechniques.get(techniqueId)
    );
  }

  /**
   * Add custom technique
   */
  addCustomTechnique(technique: TechniqueDefinition): void {
    this.state.customTechniques.set(technique.id, technique);
    logger.info(`Added custom technique: ${technique.name}`);
  }

  /**
   * Remove custom technique
   */
  removeCustomTechnique(techniqueId: string): void {
    this.state.customTechniques.delete(techniqueId);
    logger.info(`Removed custom technique: ${techniqueId}`);
  }

  /**
   * Set current default technique
   */
  setDefaultTechnique(techniqueId: string): void {
    if (this.getTechnique(techniqueId)) {
      this.state.currentTechnique = techniqueId;
      logger.info(`Default technique set to: ${techniqueId}`);
    } else {
      logger.warn(`Cannot set unknown technique as default: ${techniqueId}`);
    }
  }

  /**
   * Get all available techniques
   */
  getAllTechniques(): TechniqueDefinition[] {
    return [
      ...this.state.techniques.values(),
      ...this.state.customTechniques.values(),
    ];
  }

  /**
   * Apply velocity curve
   */
  private applyVelocityCurve(
    velocity: number,
    curve: { attack: number; sustain: number },
  ): number {
    // Simple implementation - could be more sophisticated
    const adjusted = velocity * curve.attack;
    return Math.round(Math.max(1, Math.min(127, adjusted)));
  }

  /**
   * Schedule filter modulation
   */
  private async scheduleFilterModulation(
    filter: any,
    modulation: ArticulationParams['filterModulation'],
    startTime?: number,
  ): Promise<void> {
    if (!modulation) return;

    const Tone = await getTone();
    const time = startTime || Tone.now();
    const originalFreq = filter.frequency.value;
    const targetFreq = originalFreq * (1 + modulation.amount);

    // Attack
    filter.frequency.setValueAtTime(originalFreq, time);
    filter.frequency.exponentialRampToValueAtTime(
      targetFreq,
      time + modulation.attack,
    );

    // Decay
    filter.frequency.exponentialRampToValueAtTime(
      originalFreq,
      time + modulation.attack + modulation.decay,
    );
  }

  /**
   * Schedule pitch bend
   */
  private async schedulePitchBend(
    detuneParam: any,
    bend: ArticulationParams['pitchBend'],
    startTime?: number,
  ): Promise<void> {
    if (!bend) return;

    const Tone = await getTone();
    const time = startTime || Tone.now();
    const cents = bend.amount * 100; // Convert semitones to cents

    // Set initial value
    detuneParam.setValueAtTime(cents, time);

    // Ramp to target
    if (bend.curve === 'exponential') {
      detuneParam.exponentialRampToValueAtTime(0, time + bend.time);
    } else {
      detuneParam.linearRampToValueAtTime(0, time + bend.time);
    }
  }

  /**
   * Create a legato connection between notes
   */
  createLegato(
    fromNote: BassNote,
    toNote: BassNote,
    glideTime = 0.05,
  ): { from: BassNote; to: BassNote } {
    // Extend the first note
    const modifiedFrom = {
      ...fromNote,
      duration: (fromNote.duration || 1) + glideTime,
      technique: 'fingered' as const,
    };

    // Delay and soften the attack of the second note
    const modifiedTo = {
      ...toNote,
      velocity: toNote.velocity * 0.8,
      technique: 'hammerOn' as const,
    };

    return { from: modifiedFrom, to: modifiedTo };
  }

  /**
   * Create a ghost note
   */
  createGhostNote(note: BassNote): BassNote {
    return {
      ...note,
      velocity: Math.round(note.velocity * 0.4),
      duration: (note.duration || 1) * 0.5,
      technique: 'muted',
    };
  }

  /**
   * Create an accented note
   */
  createAccentedNote(note: BassNote): BassNote {
    return {
      ...note,
      velocity: Math.min(127, Math.round(note.velocity * 1.4)),
      technique: note.technique || 'picked',
    };
  }
}

/**
 * Articulation chain for combining techniques
 */
export class ArticulationChain {
  private techniques: string[] = [];

  /**
   * Add technique to chain
   */
  add(technique: string): ArticulationChain {
    this.techniques.push(technique);
    return this;
  }

  /**
   * Apply chain to note
   */
  apply(
    note: BassNote,
    articulation: BassArticulation,
    synth: any,
    filter?: any,
  ): BassNote {
    let result = note;

    for (const technique of this.techniques) {
      result = {
        ...result,
        technique: technique as BassNote['technique'],
      };
      result = articulation.applyArticulation(result, synth, filter);
    }

    return result;
  }

  /**
   * Clear chain
   */
  clear(): void {
    this.techniques = [];
  }
}

/**
 * Common articulation patterns
 */
export const ArticulationPatterns = {
  // Funk slap pattern
  funkSlap: ['slapped', 'popped', 'muted', 'slapped'],

  // Rock fingerstyle
  rockFinger: ['fingered', 'fingered', 'picked', 'fingered'],

  // Jazz walking
  jazzWalk: ['fingered', 'hammerOn', 'fingered', 'slideUp'],

  // Metal picking
  metalPick: ['picked', 'picked', 'muted', 'picked'],

  // Reggae style
  reggae: ['muted', 'fingered', 'muted', 'fingered'],
};
