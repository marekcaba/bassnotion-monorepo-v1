/**
 * fretboardTo3DCoords - Convert 2D Fretboard Positions to 3D World Coordinates
 *
 * This module handles the mapping between 2D fretboard positions (string index, fret number)
 * and 3D world coordinates for the ring overlay canvas.
 *
 * The 3D coordinate system:
 * - X-axis: Horizontal (fret positions, left-to-right)
 * - Y-axis: Vertical (height above fretboard)
 * - Z-axis: Depth (string positions, front-to-back)
 *
 * @module fretboardTo3DCoords
 * @since Phase 1 - Foundation
 */

import type { Fret } from '../../types/fretboardTypes';

/**
 * Configuration for 2D to 3D coordinate mapping.
 */
export interface CoordMappingConfig {
  /** Maximum fret number on the fretboard */
  maxFrets: number;
  /** Number of strings (4, 5, or 6) */
  stringCount: 4 | 5 | 6;
  /** Width of the 3D world space for frets (X-axis) */
  worldWidth: number;
  /** Depth of the 3D world space for strings (Z-axis) */
  worldDepth: number;
}

/**
 * Default mapping configuration.
 * These values are calibrated to match the overlay camera FOV.
 */
export const DEFAULT_COORD_CONFIG: CoordMappingConfig = {
  maxFrets: 24,
  stringCount: 4,
  worldWidth: 20, // -10 to +10 on X-axis
  worldDepth: 6, // -3 to +3 on Z-axis
};

/**
 * 3D position tuple [x, y, z].
 */
export type Position3D = [x: number, y: number, z: number];

/**
 * Convert a fret position to X coordinate.
 * Fret 0 (open string) is at the left edge, higher frets move right.
 *
 * @param fret - Fret number (0-24) or 'open'
 * @param config - Mapping configuration
 * @returns X coordinate in 3D world space
 */
export function fretToX(
  fret: Fret,
  config: CoordMappingConfig = DEFAULT_COORD_CONFIG,
): number {
  const fretNum = fret === 'open' ? 0 : fret;
  const halfWidth = config.worldWidth / 2;

  // Map fret (0 to maxFrets) to X (-halfWidth to +halfWidth)
  return (fretNum / config.maxFrets) * config.worldWidth - halfWidth;
}

/**
 * Convert a string index to Z coordinate.
 * String 0 (lowest, E string) is at the front, higher strings are towards back.
 *
 * @param stringIndex - 0-based string index
 * @param config - Mapping configuration
 * @returns Z coordinate in 3D world space
 */
export function stringToZ(
  stringIndex: number,
  config: CoordMappingConfig = DEFAULT_COORD_CONFIG,
): number {
  const halfDepth = config.worldDepth / 2;
  const maxStringIndex = config.stringCount - 1;

  // Map stringIndex (0 to stringCount-1) to Z (-halfDepth to +halfDepth)
  return (stringIndex / maxStringIndex) * config.worldDepth - halfDepth;
}

/**
 * Convert 2D fretboard position to 3D world coordinates.
 * Y coordinate is 0 (fretboard surface) - caller handles height animation.
 *
 * @param stringIndex - 0-based string index
 * @param fret - Fret number or 'open'
 * @param config - Optional mapping configuration
 * @returns [x, y, z] position in 3D world space
 */
export function fretboardTo3DPosition(
  stringIndex: number,
  fret: Fret,
  config: CoordMappingConfig = DEFAULT_COORD_CONFIG,
): Position3D {
  return [fretToX(fret, config), 0, stringToZ(stringIndex, config)];
}

/**
 * Create a memoized position calculator with fixed configuration.
 * Use this to avoid recalculating config on every call.
 *
 * @param config - Mapping configuration
 * @returns Function that converts string/fret to 3D position
 */
export function createPositionCalculator(
  config: CoordMappingConfig,
): (stringIndex: number, fret: Fret) => Position3D {
  return (stringIndex: number, fret: Fret): Position3D => {
    return fretboardTo3DPosition(stringIndex, fret, config);
  };
}

/**
 * Calculate the camera height needed to see the entire fretboard.
 * This helps ensure the overlay camera is positioned correctly.
 *
 * @param config - Mapping configuration
 * @param fov - Camera field of view in degrees
 * @returns Recommended camera Y position
 */
export function calculateCameraHeight(
  config: CoordMappingConfig = DEFAULT_COORD_CONFIG,
  fov = 50,
): number {
  // Calculate the diagonal of the fretboard area
  const diagonal = Math.sqrt(
    Math.pow(config.worldWidth, 2) + Math.pow(config.worldDepth, 2),
  );

  // Calculate height needed to see the diagonal at given FOV
  const fovRadians = (fov * Math.PI) / 180;
  const height = diagonal / (2 * Math.tan(fovRadians / 2));

  // Add some margin
  return height * 1.2;
}
