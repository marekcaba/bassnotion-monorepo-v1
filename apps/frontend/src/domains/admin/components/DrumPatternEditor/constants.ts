/**
 * Drum Pattern Editor - Constants
 *
 * Configuration constants for the 18-lane drum grid editor.
 * Lane order matches DrumInstrumentProcessor for consistency.
 */

import type { MidiDrumType } from '@bassnotion/contracts';
import type { DrumLaneConfig, GridResolution } from './types.js';

/**
 * Default drum lane configurations (18 lanes)
 * Ordered for typical drum machine layout: kick/snare at top, cymbals in middle, percussion at bottom
 */
export const DEFAULT_DRUM_LANES: DrumLaneConfig[] = [
  // Core kit - top section
  { drum: 'kick', displayName: 'Kick', color: '#EF4444', midiNote: 36, volume: 1, muted: false, collapsed: false },
  { drum: 'snare', displayName: 'Snare', color: '#F97316', midiNote: 38, volume: 1, muted: false, collapsed: false },
  { drum: 'snare_rimshot', displayName: 'Rimshot', color: '#FB923C', midiNote: 37, volume: 1, muted: false, collapsed: false },
  { drum: 'clap', displayName: 'Clap', color: '#FBBF24', midiNote: 39, volume: 1, muted: false, collapsed: false },

  // Hi-hats section
  { drum: 'hihat_closed', displayName: 'Hi-Hat Closed', color: '#EAB308', midiNote: 42, volume: 1, muted: false, collapsed: false },
  { drum: 'hihat_open', displayName: 'Hi-Hat Open', color: '#84CC16', midiNote: 46, volume: 1, muted: false, collapsed: false },
  { drum: 'hihat_pedal', displayName: 'Hi-Hat Pedal', color: '#A3E635', midiNote: 44, volume: 1, muted: false, collapsed: false },

  // Toms section
  { drum: 'tom_high', displayName: 'High Tom', color: '#22C55E', midiNote: 50, volume: 1, muted: false, collapsed: false },
  { drum: 'tom_mid', displayName: 'Mid Tom', color: '#14B8A6', midiNote: 48, volume: 1, muted: false, collapsed: false },
  { drum: 'tom_low', displayName: 'Low Tom', color: '#0EA5E9', midiNote: 47, volume: 1, muted: false, collapsed: false },
  { drum: 'floor_tom', displayName: 'Floor Tom', color: '#06B6D4', midiNote: 45, volume: 1, muted: false, collapsed: false },

  // Cymbals section
  { drum: 'crash', displayName: 'Crash', color: '#A855F7', midiNote: 49, volume: 1, muted: false, collapsed: false },
  { drum: 'ride', displayName: 'Ride', color: '#EC4899', midiNote: 51, volume: 1, muted: false, collapsed: false },
  { drum: 'ride_bell', displayName: 'Ride Bell', color: '#F472B6', midiNote: 53, volume: 1, muted: false, collapsed: false },

  // Percussion section
  { drum: 'cowbell', displayName: 'Cowbell', color: '#78716C', midiNote: 56, volume: 1, muted: false, collapsed: false },
  { drum: 'tambourine', displayName: 'Tambourine', color: '#A8A29E', midiNote: 54, volume: 1, muted: false, collapsed: false },
];

/**
 * All visible lanes by default (all 16 lanes)
 */
export const DEFAULT_VISIBLE_LANES: MidiDrumType[] = DEFAULT_DRUM_LANES.map(lane => lane.drum);

/**
 * Essential lanes for minimal view
 */
export const ESSENTIAL_LANES: MidiDrumType[] = [
  'kick',
  'snare',
  'hihat_closed',
  'hihat_open',
];

/**
 * MIDI note to drum type mapping
 */
export const MIDI_NOTE_TO_DRUM: Record<number, MidiDrumType> = {
  35: 'kick',       // Acoustic Bass Drum
  36: 'kick',       // Bass Drum 1
  37: 'snare_rimshot', // Side Stick
  38: 'snare',      // Acoustic Snare
  39: 'clap',       // Hand Clap
  40: 'snare',      // Electric Snare
  42: 'hihat_closed', // Closed Hi-Hat
  44: 'hihat_pedal', // Pedal Hi-Hat
  46: 'hihat_open', // Open Hi-Hat
  45: 'floor_tom',  // Low Tom
  47: 'tom_low',    // Low-Mid Tom
  48: 'tom_mid',    // Hi-Mid Tom
  50: 'tom_high',   // High Tom
  49: 'crash',      // Crash Cymbal 1
  51: 'ride',       // Ride Cymbal 1
  52: 'crash',      // Chinese Cymbal
  53: 'ride_bell',  // Ride Bell
  54: 'tambourine', // Tambourine
  55: 'crash',      // Splash Cymbal
  56: 'cowbell',    // Cowbell
  57: 'crash',      // Crash Cymbal 2
  59: 'ride',       // Ride Cymbal 2
};

/**
 * Drum type to MIDI note mapping (inverse)
 */
export const DRUM_TO_MIDI_NOTE: Record<MidiDrumType, number> = Object.fromEntries(
  DEFAULT_DRUM_LANES.map(lane => [lane.drum, lane.midiNote])
) as Record<MidiDrumType, number>;

/**
 * Grid resolution to ticks per cell (at 480 PPQ)
 */
export const RESOLUTION_TO_TICKS: Record<GridResolution, number> = {
  '1/4': 480,   // Quarter notes
  '1/8': 240,   // 8th notes
  '1/16': 120,  // 16th notes
  '1/32': 60,   // 32nd notes
};

/**
 * Grid resolution to cells per beat
 */
export const RESOLUTION_TO_CELLS_PER_BEAT: Record<GridResolution, number> = {
  '1/4': 1,
  '1/8': 2,
  '1/16': 4,
  '1/32': 8,
};

/**
 * Default editor settings
 */
export const DEFAULT_EDITOR_SETTINGS = {
  gridResolution: '1/16' as GridResolution,
  bars: 2,
  tempo: 120,
  swingAmount: 0,
  zoomLevel: 1.0,
  snapEnabled: true,
  timeSignature: { numerator: 4, denominator: 4 },
} as const;

/**
 * Default velocity for new hits
 */
export const DEFAULT_VELOCITY = 100;

/**
 * Velocity presets
 */
export const VELOCITY_PRESETS = {
  ghost: 40,
  soft: 64,
  normal: 100,
  accent: 127,
} as const;

/**
 * History limit for undo/redo
 */
export const MAX_HISTORY_SIZE = 50;

/**
 * Cell dimensions (pixels)
 */
export const CELL_DIMENSIONS = {
  minWidth: 20,
  maxWidth: 60,
  height: 28,
  laneHeaderWidth: 120,
} as const;

/**
 * PPQ (Pulses Per Quarter note) - standard MIDI resolution
 */
export const PPQ = 480;

/**
 * Zoom limits
 */
export const ZOOM_LIMITS = {
  min: 0.5,
  max: 2.0,
  step: 0.1,
} as const;

/**
 * Bar count options
 */
export const BAR_OPTIONS = [1, 2, 4, 8] as const;

/**
 * Grid resolution options for UI
 */
export const GRID_RESOLUTION_OPTIONS: { value: GridResolution; label: string }[] = [
  { value: '1/4', label: '1/4 Notes' },
  { value: '1/8', label: '1/8 Notes' },
  { value: '1/16', label: '1/16 Notes' },
  { value: '1/32', label: '1/32 Notes' },
];

/**
 * Tempo limits for preview playback
 */
export const TEMPO_LIMITS = {
  min: 40,
  max: 300,
  default: 120,
} as const;
