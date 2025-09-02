// import * as Tone from 'tone'; // Removed - Story 3.18.3
import { getTone } from '../../ServiceAdapter.js';
import { getAudioArchitectureFlags } from '../../../config/featureFlags.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Warm analog-style pad synthesizer
 */
export function createWarmPadSynth(): any {
  const Tone = getTone();
  const warmPad = new Tone.PolySynth(Tone.FatOscillator, {
    oscillator: {
      type: 'sawtooth',
      spread: 30,
      count: 3,
    },
    envelope: {
      attack: 0.8,
      decay: 0.5,
      sustain: 0.8,
      release: 2.0,
    },
  });

  // Create filter
  const flags = getAudioArchitectureFlags();
  if (flags.ENABLE_MIGRATION_MONITORING) {
    logger.info('[pad-synthesis] Using Tone from dependency injection');
  }
  const filter = new Tone.Filter({
    type: 'lowpass',
    frequency: 800,
    rolloff: -24,
  });

  // Add effects
  const chorus = new Tone.Chorus(2, 3.5, 0.7).start();
  const reverb = new Tone.Reverb({ decay: 4, wet: 0.3 });

  warmPad.connect(filter).connect(chorus).connect(reverb);

  return warmPad;
}

// Preset variations
export const PAD_PRESETS = {
  warm: { spread: 30, filterFreq: 800 },
  bright: { spread: 20, filterFreq: 2000 },
  dark: { spread: 40, filterFreq: 400 },
  evolving: { spread: 50, filterFreq: 600 },
};
