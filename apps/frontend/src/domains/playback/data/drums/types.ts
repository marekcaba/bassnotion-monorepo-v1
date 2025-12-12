/**
 * Drum Kit Manifest Types
 *
 * TypeScript definitions for drum kit configuration files.
 * Used by DrumPreloadStrategy and DrumInstrumentProcessor.
 */

/**
 * All available drum pieces in the standard kit.
 * Matches DrumPiece enum in DrumInstrumentProcessor.
 */
export type DrumPiece =
  | 'kick'
  | 'snare'
  | 'hihat_closed'
  | 'hihat_open'
  | 'hihat_pedal'
  | 'crash_1'
  | 'crash_2'
  | 'ride'
  | 'ride_bell'
  | 'tom_1'
  | 'tom_2'
  | 'tom_3'
  | 'clap'
  | 'cowbell'
  | 'tambourine'
  | 'shaker'
  | 'side_stick'
  | 'rimshot';

/**
 * Velocity layer identifiers (v1-v5)
 */
export type VelocityLayer = 'v1' | 'v2' | 'v3' | 'v4' | 'v5';

/**
 * Configuration for a single drum piece
 */
export interface DrumPieceConfig {
  /** Display name for UI */
  displayName: string;
  /** General MIDI note number */
  midiNote: number;
  /** Available velocity samples */
  samples: VelocityLayer[];
  /** Color for UI (hex) */
  color: string;
}

/**
 * Velocity range mapping
 */
export interface VelocityRange {
  /** Minimum velocity (1-127) */
  min: number;
  /** Maximum velocity (1-127) */
  max: number;
  /** Human-readable label */
  label: string;
}

/**
 * Complete drum kit manifest
 */
export interface DrumKitManifest {
  /** Kit name */
  name: string;
  /** Semantic version */
  version: string;
  /** Kit description */
  description: string;
  /** Base path for samples in storage (e.g., "drums/standard-kit") */
  basePath: string;
  /** Configuration for each drum piece */
  pieces: Record<DrumPiece, DrumPieceConfig>;
  /** Velocity to layer mapping */
  velocityMapping: Record<VelocityLayer, VelocityRange>;
  /** Fallback kit path if samples are missing */
  fallbackKit?: string;
}

/**
 * Get the velocity layer for a given MIDI velocity value
 */
export function getVelocityLayer(
  velocity: number,
  mapping: Record<VelocityLayer, VelocityRange>,
): VelocityLayer {
  if (velocity <= mapping.v1.max) return 'v1';
  if (velocity <= mapping.v2.max) return 'v2';
  if (velocity <= mapping.v3.max) return 'v3';
  if (velocity <= mapping.v4.max) return 'v4';
  return 'v5';
}

/**
 * Build sample URL from kit manifest and piece/velocity
 */
export function buildSampleUrl(
  manifest: DrumKitManifest,
  piece: DrumPiece,
  velocity: VelocityLayer,
  supabaseUrl: string,
): string {
  const basePath = manifest.basePath;
  return `${supabaseUrl}/storage/v1/object/public/audio-samples/${basePath}/${piece}/${piece}-${velocity}.wav`;
}

/**
 * All drum pieces in display order (for grid editor)
 */
export const DRUM_PIECES_ORDER: DrumPiece[] = [
  'kick',
  'snare',
  'side_stick',
  'rimshot',
  'clap',
  'hihat_closed',
  'hihat_open',
  'hihat_pedal',
  'tom_1',
  'tom_2',
  'tom_3',
  'crash_1',
  'crash_2',
  'ride',
  'ride_bell',
  'cowbell',
  'tambourine',
  'shaker',
];
