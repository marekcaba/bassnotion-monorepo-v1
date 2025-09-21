/**
 * Drum Kit Configuration Types
 *
 * Type definitions for drum kit configurations loaded from JSON files.
 * These types ensure type safety when working with drum kit data.
 */

export interface DrumEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface DrumPiece {
  noteMapping: number;
  samples: Record<string, string>;
  defaultSample: string;
  volume: number;
  pan: number;
  envelope: DrumEnvelope;
}

export interface DrumKitSettings {
  humanizeAmount: number;
  swingAmount: number;
  defaultVelocity: number;
}

export interface DrumKitConfig {
  name: string;
  version: string;
  author?: string;
  description?: string;
  pieces: Record<string, DrumPiece>;
  settings: DrumKitSettings;
}

export interface GeneralMidiDrumMap {
  name: string;
  version: string;
  description: string;
  drumMap: Record<string, string>;
  commonMapping: Record<string, number>;
  noteToName?: Record<string, string>;
}

export interface DrumKitLoaderOptions {
  basePath?: string;
  cache?: boolean;
  validate?: boolean;
}
