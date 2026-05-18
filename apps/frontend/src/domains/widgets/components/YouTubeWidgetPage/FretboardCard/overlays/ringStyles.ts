/**
 * ringStyles - Technique-Specific Ring Colors Using BassArticulationType
 *
 * This module defines color mappings for different bass playing techniques.
 * Colors are derived from the existing TechniqueRenderer.tsx to maintain
 * visual consistency across the application.
 *
 * @module ringStyles
 * @since Phase 1 - Foundation
 */

import type { BassArticulationType } from '@bassnotion/contracts';

/**
 * Core technique colors mapped to BassArticulationType.
 * These are the primary colors used for ring visualization.
 *
 * Color choices follow established bass learning conventions:
 * - Normal: Yellow (default, neutral)
 * - Hammer-on: Red (aggressive, forward motion)
 * - Pull-off: Teal (contrasts with hammer-on)
 * - Slides: Blue (smooth, flowing motion)
 * - Bend: Green (pitch alteration)
 * - Ghost note: Gray (subtle, muted)
 * - Accent: Bright Red (emphasis)
 * - Trill: Lighter Green (rapid alternation)
 */
export const TECHNIQUE_COLORS: Record<BassArticulationType | 'normal', string> =
  {
    normal: '#FACC15', // Yellow (Tailwind yellow-400)
    'ghost-note': '#6B7280', // Gray (Tailwind gray-500)
    accent: '#EF4444', // Bright Red (Tailwind red-500)
    'hammer-on': '#FF6B6B', // Warm Red
    'pull-off': '#4ECDC4', // Teal
    'slide-up': '#45B7D1', // Sky Blue
    'slide-down': '#45B7D1', // Sky Blue (same as slide-up)
    bend: '#96CEB4', // Sage Green
    trill: '#22C55E', // Emerald (Tailwind green-500)
  };

/**
 * Extended technique colors for future bass techniques.
 * Includes techniques not yet in BassArticulationType but planned for future.
 */
export const EXTENDED_TECHNIQUE_COLORS = {
  ...TECHNIQUE_COLORS,
  harmonic: '#FFD700', // Gold
  slap: '#A855F7', // Purple (Tailwind purple-500)
  pop: '#EC4899', // Pink (Tailwind pink-500)
  tap: '#F97316', // Orange (Tailwind orange-500)
  vibrato: '#22C55E', // Green (same as trill)
  'let-ring': '#60A5FA', // Light Blue (Tailwind blue-400)
  staccato: '#F59E0B', // Amber (Tailwind amber-500)
} as const;

/**
 * Get the ring color for a given technique.
 * Falls back to normal (yellow) if technique is unknown.
 *
 * @param technique - The bass articulation technique
 * @returns Hex color string for the ring
 */
export function getTechniqueColor(
  technique: BassArticulationType | undefined,
): string {
  if (!technique) {
    return TECHNIQUE_COLORS.normal;
  }
  return TECHNIQUE_COLORS[technique] ?? TECHNIQUE_COLORS.normal;
}

/**
 * Get the emissive color for a technique (same as base color for glow effect).
 * The emissive color creates the glow effect on the 3D ring.
 *
 * @param technique - The bass articulation technique
 * @returns Hex color string for emissive glow
 */
export function getTechniqueEmissive(
  technique: BassArticulationType | undefined,
): string {
  // For now, emissive matches the base color
  // Future enhancement: could return a brighter/lighter version
  return getTechniqueColor(technique);
}

/**
 * Opacity values for rings based on their position in the queue.
 * Earlier rings (closer in time) are more opaque.
 */
export const RING_OPACITY_BY_INDEX = [
  1.0, // First ring (closest) - fully opaque
  0.8, // Second ring
  0.6, // Third ring
  0.4, // Fourth ring
  0.3, // Fifth ring and beyond
] as const;

/**
 * Calculate opacity for a ring based on its index in the upcoming notes queue.
 * Rings further in the future are more transparent.
 *
 * @param ringIndex - 0-based index in the upcoming notes queue
 * @returns Opacity value between 0.3 and 1.0
 */
export function getRingOpacity(ringIndex: number): number {
  if (ringIndex < RING_OPACITY_BY_INDEX.length) {
    return RING_OPACITY_BY_INDEX[ringIndex];
  }
  return RING_OPACITY_BY_INDEX[RING_OPACITY_BY_INDEX.length - 1];
}
