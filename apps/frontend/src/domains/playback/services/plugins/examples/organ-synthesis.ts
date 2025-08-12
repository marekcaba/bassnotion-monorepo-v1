// import * as Tone from 'tone'; // Removed - Story 3.18.3
import { getTone } from '../../ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../../../config/featureFlags.js';

/**
 * Hammond B3-style drawbar organ synthesis
 */
export function createDrawbarOrgan(): any {
  const Tone = getTone();
  const organ = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: 'custom',
      partials: [1, 0, 0.5, 0, 0.33, 0, 0, 0.25, 0.125], // Classic drawbar settings
    },
    envelope: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.9,
      release: 0.2,
    },
  });

  // Add rotary speaker simulation
  const flags = getAudioArchitectureFlags();
  if (flags.ENABLE_MIGRATION_MONITORING) {
    console.log('[organ-synthesis] Using Tone from dependency injection');
  }
  const chorus = new Tone.Chorus(4, 2.5, 0.5).start();
  const tremolo = new Tone.Tremolo(6, 0.8).start();

  organ.connect(chorus).connect(tremolo);

  return organ;
}

// Different drawbar presets
export const ORGAN_PRESETS = {
  full: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  jazz: [0.8, 0.8, 0.8, 0, 0, 0, 0, 0, 0],
  rock: [0.8, 0.8, 0, 0, 0, 0.8, 0, 0, 0.8],
  gospel: [0.8, 0, 0.8, 0.6, 0, 0.4, 0, 0, 0.8],
  mellow: [0, 0, 0.8, 0, 0, 0, 0, 0, 0],
};
