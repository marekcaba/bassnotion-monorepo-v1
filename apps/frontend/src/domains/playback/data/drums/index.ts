/**
 * Drum Kit Configuration
 *
 * Exports drum kit configuration for use throughout the playback system.
 * Provides configurable kit paths with fallback support.
 */

import type { DrumKitManifest, DrumPiece, VelocityLayer } from './types.js';

// Standard kit configuration
export const STANDARD_KIT: DrumKitManifest = {
  name: 'Standard Kit',
  version: '1.0.0',
  description: 'Default drum kit with 18 pieces and 5 velocity layers',
  basePath: 'drums/standard-kit',
  pieces: {
    kick: {
      displayName: 'Kick',
      midiNote: 36,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#EF4444',
    },
    snare: {
      displayName: 'Snare',
      midiNote: 38,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#F97316',
    },
    hihat_closed: {
      displayName: 'Hi-Hat Closed',
      midiNote: 42,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#EAB308',
    },
    hihat_open: {
      displayName: 'Hi-Hat Open',
      midiNote: 46,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#84CC16',
    },
    hihat_pedal: {
      displayName: 'Hi-Hat Pedal',
      midiNote: 44,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#A3E635',
    },
    crash_1: {
      displayName: 'Crash 1',
      midiNote: 49,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#A855F7',
    },
    crash_2: {
      displayName: 'Crash 2',
      midiNote: 57,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#D946EF',
    },
    ride: {
      displayName: 'Ride',
      midiNote: 51,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#EC4899',
    },
    ride_bell: {
      displayName: 'Ride Bell',
      midiNote: 53,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#F472B6',
    },
    tom_1: {
      displayName: 'High Tom',
      midiNote: 50,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#22C55E',
    },
    tom_2: {
      displayName: 'Mid Tom',
      midiNote: 48,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#14B8A6',
    },
    tom_3: {
      displayName: 'Floor Tom',
      midiNote: 45,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#06B6D4',
    },
    clap: {
      displayName: 'Clap',
      midiNote: 39,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#3B82F6',
    },
    cowbell: {
      displayName: 'Cowbell',
      midiNote: 56,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#78716C',
    },
    tambourine: {
      displayName: 'Tambourine',
      midiNote: 54,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#A8A29E',
    },
    shaker: {
      displayName: 'Shaker',
      midiNote: 70,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#D6D3D1',
    },
    side_stick: {
      displayName: 'Side Stick',
      midiNote: 37,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#6366F1',
    },
    rimshot: {
      displayName: 'Rimshot',
      midiNote: 40,
      samples: ['v1', 'v2', 'v3', 'v4', 'v5'],
      color: '#8B5CF6',
    },
  },
  velocityMapping: {
    v1: { min: 1, max: 25, label: 'Ghost' },
    v2: { min: 26, max: 50, label: 'Soft' },
    v3: { min: 51, max: 76, label: 'Medium' },
    v4: { min: 77, max: 102, label: 'Loud' },
    v5: { min: 103, max: 127, label: 'Accent' },
  },
  fallbackKit: 'drums/hydrogen-kits/colombo-acoustic',
};

// Export kit paths for easy access
export const DEFAULT_KIT_PATH = STANDARD_KIT.basePath;
export const FALLBACK_KIT_PATH = STANDARD_KIT.fallbackKit || 'drums/hydrogen-kits/colombo-acoustic';

// Re-export types
export type { DrumKitManifest, DrumPiece, VelocityLayer } from './types.js';
export {
  getVelocityLayer,
  buildSampleUrl,
  DRUM_PIECES_ORDER,
} from './types.js';
