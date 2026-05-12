/**
 * Type-Safe Conversion Utilities
 *
 * Provides type-safe conversion functions to replace `as any` casts
 * in migration utilities and other code paths dealing with string-to-enum
 * or number-to-constrained-type conversions.
 *
 * These helpers validate input at runtime and return properly typed results,
 * eliminating the need for unsafe type assertions.
 */

import type { DrumType } from '../types/musical-time.js';
import type { PatternGenerationOptions } from '../services/ProfessionalDrumProcessor.js';

// ============================================================================
// DrumType Conversion
// ============================================================================

/**
 * All valid drum types as a const array for validation
 */
export const VALID_DRUM_TYPES = [
  'kick',
  'snare',
  'hihat',
  'crash',
  'ride',
  'tom',
  'tom1',
  'tom2',
  'tom3',
  'splash',
  'china',
  'bell',
] as const;

/**
 * Type guard to check if a string is a valid DrumType
 */
export function isDrumType(value: string): value is DrumType {
  return VALID_DRUM_TYPES.includes(value as DrumType);
}

/**
 * Safely convert a string to DrumType
 * @param value - String value to convert
 * @param fallback - Fallback drum type if value is invalid (default: 'kick')
 * @returns Valid DrumType
 */
export function toDrumType(value: string, fallback: DrumType = 'kick'): DrumType {
  return isDrumType(value) ? value : fallback;
}

/**
 * Convert a string to DrumType or throw if invalid
 * @param value - String value to convert
 * @throws Error if value is not a valid DrumType
 * @returns Valid DrumType
 */
export function toDrumTypeStrict(value: string): DrumType {
  if (!isDrumType(value)) {
    throw new Error(
      `Invalid drum type: '${value}'. Valid types are: ${VALID_DRUM_TYPES.join(', ')}`
    );
  }
  return value;
}

// ============================================================================
// Complexity Level Conversion
// ============================================================================

/**
 * Valid complexity levels (1-10)
 */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Type guard to check if a number is a valid ComplexityLevel
 */
export function isComplexityLevel(value: number): value is ComplexityLevel {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

/**
 * Safely convert a number to ComplexityLevel
 * Clamps values outside 1-10 range
 * @param value - Number value to convert
 * @returns Valid ComplexityLevel (clamped to 1-10)
 */
export function toComplexityLevel(value: number): ComplexityLevel {
  const clamped = Math.min(Math.max(Math.round(value), 1), 10);
  return clamped as ComplexityLevel;
}

// ============================================================================
// Drum Style Conversion
// ============================================================================

/**
 * Valid drum pattern styles
 */
export type DrumStyle = PatternGenerationOptions['style'];

/**
 * All valid drum styles as a const array
 */
export const VALID_DRUM_STYLES = [
  'rock',
  'jazz',
  'funk',
  'latin',
  'shuffle',
  'reggae',
  'punk',
  'metal',
] as const;

/**
 * Type guard to check if a string is a valid DrumStyle
 */
export function isDrumStyle(value: string): value is DrumStyle {
  return VALID_DRUM_STYLES.includes(value as DrumStyle);
}

/**
 * Safely convert a string to DrumStyle
 * @param value - String value to convert
 * @param fallback - Fallback style if value is invalid (default: 'rock')
 * @returns Valid DrumStyle
 */
export function toDrumStyle(value: string, fallback: DrumStyle = 'rock'): DrumStyle {
  return isDrumStyle(value) ? value : fallback;
}

/**
 * Map common style aliases to valid DrumStyle values
 */
export const STYLE_ALIASES: Record<string, DrumStyle> = {
  'rock steady': 'rock',
  'jazz swing': 'jazz',
  'funk groove': 'funk',
  'bossa nova': 'latin',
  bossa: 'latin',
  swing: 'shuffle',
  'heavy metal': 'metal',
  hardcore: 'punk',
  alternative: 'rock',
  blues: 'shuffle',
};

/**
 * Convert a style string to DrumStyle, including alias resolution
 * @param value - Style string (may include aliases)
 * @param fallback - Fallback style if not recognized
 * @returns Valid DrumStyle
 */
export function resolveStyleAlias(value: string, fallback: DrumStyle = 'rock'): DrumStyle {
  const normalized = value.toLowerCase().trim();

  // Check direct match first
  if (isDrumStyle(normalized)) {
    return normalized;
  }

  // Check aliases
  if (normalized in STYLE_ALIASES) {
    return STYLE_ALIASES[normalized];
  }

  return fallback;
}

// ============================================================================
// Tom Type Conversion
// ============================================================================

/**
 * Specific tom drum types
 */
export type TomType = 'tom' | 'tom1' | 'tom2' | 'tom3';

/**
 * All valid tom types
 */
export const VALID_TOM_TYPES = ['tom', 'tom1', 'tom2', 'tom3'] as const;

/**
 * Type guard for tom types
 */
export function isTomType(value: string): value is TomType {
  return VALID_TOM_TYPES.includes(value as TomType);
}

/**
 * Get tom type from array index (for fill patterns)
 * @param index - Array index (0-2 for specific toms)
 * @returns Tom type ('tom1', 'tom2', or 'tom3')
 */
export function getTomTypeByIndex(index: number): TomType {
  const toms: TomType[] = ['tom1', 'tom2', 'tom3'];
  return toms[Math.abs(index) % 3];
}

// ============================================================================
// Velocity Conversion
// ============================================================================

/**
 * MIDI velocity value (0-127)
 */
export type MidiVelocity = number;

/**
 * Clamp a velocity value to valid MIDI range (0-127)
 */
export function toMidiVelocity(value: number): MidiVelocity {
  return Math.min(Math.max(Math.round(value), 0), 127);
}

/**
 * Check if a value is a valid MIDI velocity
 */
export function isMidiVelocity(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 127;
}
