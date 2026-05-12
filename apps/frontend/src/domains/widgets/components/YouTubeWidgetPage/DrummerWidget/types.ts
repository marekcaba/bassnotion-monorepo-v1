/**
 * DrummerWidget Types
 *
 * Type definitions for the DrummerWidget component and its submodules.
 */

import type { Exercise, MidiDrumType } from '@bassnotion/contracts';

/**
 * Props for the DrummerWidget component
 */
export interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  tutorialId?: string;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility?: () => void;
  onTogglePlay?: () => void;
  isAdminMode?: boolean;
  /** Controlled volume (0-100). If provided, widget uses this instead of local state */
  volume?: number;
  /** Controlled mute state. If provided, widget uses this instead of local state */
  isMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
}

/**
 * Grid cell data structure that tracks main 8th note hits and 16th note subdivisions
 * - main: 1 if there's a hit on the 8th note position (tick 0-119 or 240-359)
 * - sixteenth: 1 if there's a hit on the "e" or "a" subdivision (tick 120-239 or 360-479)
 */
export interface GridCell {
  main: number;
  sixteenth: number;
}

/**
 * Grid pattern with 8 cells per row, each tracking main hit and 16th subdivision
 */
export interface GridPatternWithSixteenths {
  kick: GridCell[];
  snare: GridCell[];
  hihat: GridCell[];
}

/**
 * Drum type for the compact 3-row grid (kick, snare, hihat)
 */
export type DrumGridType = 'kick' | 'snare' | 'hihat';

/**
 * Map MidiDrumType to the 3 basic grid types (kick, snare, hihat)
 * Groups various drum types into the three main categories for the compact grid
 */
export const DRUM_TYPE_TO_GRID: Record<MidiDrumType, DrumGridType | null> = {
  kick: 'kick',
  snare: 'snare',
  snare_rimshot: 'snare',
  hihat: 'hihat',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  hihat_pedal: 'hihat',
  crash: null, // Not displayed in compact grid
  ride: null, // Not displayed in compact grid
  ride_bell: null,
  tom_low: null,
  tom_mid: null,
  tom_high: null,
  floor_tom: null,
  cowbell: null,
  tambourine: null,
  clap: 'snare', // Map clap to snare row
  unknown: null,
};

/**
 * Map MIDI note numbers to drum types (General MIDI drum map)
 */
export const MIDI_DRUM_MAP: Record<number, DrumGridType> = {
  36: 'kick', // Bass Drum 1
  35: 'kick', // Acoustic Bass Drum
  38: 'snare', // Acoustic Snare
  40: 'snare', // Electric Snare
  42: 'hihat', // Closed Hi-Hat
  44: 'hihat', // Pedal Hi-Hat
  46: 'hihat', // Open Hi-Hat
};

/**
 * Empty grid pattern (all zeros) - used when no drum data exists
 * Each cell has main (8th note) and sixteenth (16th subdivision) properties
 */
export const EMPTY_GRID_PATTERN: GridPatternWithSixteenths = {
  kick: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
  snare: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
  hihat: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
};

/**
 * Helper to convert simple array to GridCell array (for preset patterns)
 */
export const toPresetGridCells = (arr: number[]): GridCell[] =>
  arr.map((v) => ({ main: v, sixteenth: 0 }));

/**
 * Drum pattern presets with GridCell format
 */
export const DRUM_PATTERNS: Record<string, GridPatternWithSixteenths> = {
  'Rock Steady': {
    kick: toPresetGridCells([1, 0, 0, 0, 1, 0, 0, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 1, 1, 1, 1, 1, 1]),
  },
  'Jazz Swing': {
    kick: toPresetGridCells([1, 0, 0, 0, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 0, 0, 1, 0, 0, 0]),
    hihat: toPresetGridCells([1, 0, 1, 1, 0, 1, 1, 0]),
  },
  'Bossa Nova': {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 1, 0, 0]),
    hihat: toPresetGridCells([1, 0, 1, 0, 1, 0, 1, 0]),
  },
  'Funk Groove': {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 1, 0, 1, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 0, 1, 1, 0, 1, 1]),
  },
  Latin: {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 1, 0, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 1, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 1, 0, 1, 1, 1, 0]),
  },
  Shuffle: {
    kick: toPresetGridCells([1, 0, 1, 0, 1, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 0, 1, 1, 0, 1, 1, 0]),
  },
};

/**
 * WAM plugin interface
 */
export interface WamPluginInstance {
  createAudioNode: () => Promise<any>;
  loadDefaultKit?: () => Promise<void>;
  audioNode?: any;
}

/**
 * Pattern library item
 */
export interface PatternLibraryItem {
  id: string;
  name: string;
  genre?: string;
  midiFileUrl?: string;
  midiData?: any;
}
