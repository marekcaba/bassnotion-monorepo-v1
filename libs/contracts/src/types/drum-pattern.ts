/**
 * Drum Pattern Types
 * Shared between frontend and backend for drummer MIDI conversion
 * Similar to ExerciseNote for bass fretboard positions
 */

/**
 * Drum kit piece (General MIDI drum map)
 * Named MidiDrumType to avoid conflict with DrumType from musical-time.ts
 *
 * NOTE: Primary types used are 'kick', 'snare', 'hihat' to match available drum samples.
 * Other types kept for future expansion and backward compatibility.
 */
export type MidiDrumType =
  | 'kick'
  | 'snare'
  | 'snare_rimshot'
  | 'hihat' // Simplified hi-hat (covers closed, open, pedal)
  | 'hihat_closed' // Legacy - use 'hihat' instead
  | 'hihat_open' // Legacy - use 'hihat' instead
  | 'hihat_pedal' // Legacy - use 'hihat' instead
  | 'crash'
  | 'ride'
  | 'ride_bell'
  | 'tom_low'
  | 'tom_mid'
  | 'tom_high'
  | 'floor_tom'
  | 'cowbell'
  | 'tambourine'
  | 'clap' // Legacy - typically mapped to snare now
  | 'unknown';

/**
 * Musical position (measure, beat, subdivision, tick precision)
 */
export interface MusicalPosition {
  measure: number;
  beat: number;
  subdivision: number;
  tick?: number; // Precise position within beat (0-479 at 480 PPQ) - preserves sub-16th timing
}

/**
 * Single drum hit in a pattern
 */
export interface DrumHit {
  id: string;
  drum: MidiDrumType;
  velocity: number; // 0-127
  position: MusicalPosition;
  durationTicks: number;
  midiNote: number; // Original MIDI note number for reference
}

/**
 * Statistics about a drum pattern
 */
export interface DrumPatternStats {
  totalHits: number;
  uniqueDrums: number;
  drumCounts: Record<MidiDrumType, number>;
  unknownCount: number;
  measureCount: number;
}

/**
 * Validation result for drum pattern
 */
export interface DrumPatternValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Display names for drum types
 */
export const DRUM_DISPLAY_NAMES: Record<MidiDrumType, string> = {
  kick: 'Kick Drum',
  snare: 'Snare',
  snare_rimshot: 'Rimshot',
  hihat: 'Hi-Hat',
  hihat_closed: 'Hi-Hat (Closed)',
  hihat_open: 'Hi-Hat (Open)',
  hihat_pedal: 'Hi-Hat (Pedal)',
  crash: 'Crash Cymbal',
  ride: 'Ride Cymbal',
  ride_bell: 'Ride Bell',
  tom_low: 'Low Tom',
  tom_mid: 'Mid Tom',
  tom_high: 'High Tom',
  floor_tom: 'Floor Tom',
  cowbell: 'Cowbell',
  tambourine: 'Tambourine',
  clap: 'Hand Clap',
  unknown: 'Unknown',
};

/**
 * Color coding for drum visualization (matches common drum notation)
 */
export const DRUM_COLORS: Record<MidiDrumType, string> = {
  kick: '#FF6B6B', // Red
  snare: '#4ECDC4', // Teal
  snare_rimshot: '#45B7D1', // Light Blue
  hihat: '#FFA07A', // Light Salmon
  hihat_closed: '#FFA07A', // Light Salmon
  hihat_open: '#FFD93D', // Yellow
  hihat_pedal: '#F9E79F', // Light Yellow
  crash: '#A569BD', // Purple
  ride: '#85C1E2', // Sky Blue
  ride_bell: '#5DADE2', // Bright Blue
  tom_low: '#58D68D', // Green
  tom_mid: '#82E0AA', // Light Green
  tom_high: '#ABEBC6', // Pale Green
  floor_tom: '#48C9B0', // Turquoise
  cowbell: '#F8B739', // Orange
  tambourine: '#E59866', // Peach
  clap: '#D7BDE2', // Lavender
  unknown: '#95A5A6', // Gray
};

/**
 * General MIDI drum map (note numbers)
 * https://www.midi.org/specifications-old/item/gm-level-1-sound-set
 */
export const GENERAL_MIDI_DRUM_MAP: Record<number, MidiDrumType> = {
  // Kick drums
  35: 'kick', // Acoustic Bass Drum
  36: 'kick', // Bass Drum 1

  // Snares
  38: 'snare', // Acoustic Snare
  40: 'snare', // Electric Snare
  37: 'snare_rimshot', // Side Stick / Rimshot

  // Hi-hats
  42: 'hihat_closed', // Closed Hi-Hat
  44: 'hihat_pedal', // Pedal Hi-Hat
  46: 'hihat_open', // Open Hi-Hat

  // Cymbals
  49: 'crash', // Crash Cymbal 1
  57: 'crash', // Crash Cymbal 2
  51: 'ride', // Ride Cymbal 1
  59: 'ride', // Ride Cymbal 2
  53: 'ride_bell', // Ride Bell

  // Toms
  41: 'tom_low', // Low Floor Tom
  43: 'tom_low', // High Floor Tom
  45: 'tom_mid', // Low Tom
  47: 'tom_mid', // Low-Mid Tom
  48: 'tom_high', // Hi-Mid Tom
  50: 'tom_high', // High Tom

  // Percussion
  39: 'clap', // Hand Clap
  56: 'cowbell', // Cowbell
  54: 'tambourine', // Tambourine
};
