/**
 * Types specific to key detection module
 */

export interface KeyDetectionConfig {
  windowSize: number;
  hopSize: number;
  chromaNormalization: 'none' | 'max' | 'sum';
}

export interface ChromaVector {
  values: Float32Array;
  timestamp: number;
}

export interface KeyProfile {
  note: string;
  mode: 'major' | 'minor';
  correlation: number;
}

export const KEY_PROFILES = {
  major: [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
  minor: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
} as const;

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;
