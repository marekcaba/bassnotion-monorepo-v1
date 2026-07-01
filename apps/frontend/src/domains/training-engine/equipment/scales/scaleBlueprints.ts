/**
 * scaleBlueprints — Phase A.2 (docs/SCALE_ENGINE_DESIGN.md §4).
 *
 * The canonical BOX POSITIONS per scale type — the fingering shapes a bassist plays.
 * A position is modelled as a FRET WINDOW relative to where the scale's root sits on
 * the lowest string: the box covers all scale notes within [startFretOffset,
 * startFretOffset + span] across every string. This matches how box positions actually
 * work (a hand position = a fret region) and stays simple to author.
 *
 * SEED DEFAULTS (standard, widely-taught shapes). These are PROPOSED defaults — the
 * admin refines them in the panel later (the blueprints become admin-authored data;
 * see §4). Position 1 = the root box (hand at the root). Higher positions shift up the
 * neck by the standard 3-notes-per-string / CAGED-style spacing.
 */

import type { ScaleType } from './scaleGenerator';

export interface ScalePosition {
  /** 1-based: position 1 = the root box, ascending up the neck. */
  positionNumber: number;
  /** Fret offset of the box's LOW edge, relative to the root's fret on the lowest
   *  string. Position 1 starts a couple frets BELOW the root (the index finger sits
   *  behind the root), so this is usually slightly negative. */
  startFretOffset: number;
  /** How many frets the box spans (the hand position width). */
  span: number;
}

export interface ScaleBlueprint {
  /** How many distinct box positions this scale has (major 7, pentatonic 5, …). */
  positions: ScalePosition[];
}

// A standard box spans ~4 frets; positions step up the neck ~2 frets each (the gap
// between consecutive scale degrees on a string). startFretOffset −1 puts the index
// finger one fret behind the root for the first box.
function standardPositions(count: number): ScalePosition[] {
  const SPAN = 4;
  const STEP = 2; // frets between consecutive positions up the neck
  return Array.from({ length: count }, (_, i) => ({
    positionNumber: i + 1,
    startFretOffset: -1 + i * STEP,
    span: SPAN,
  }));
}

/** Seed blueprints. Position counts = the number of notes in the scale (one box rooted
 *  on each degree). Shapes are the standard-spacing defaults, admin-refinable later. */
export const SCALE_BLUEPRINTS: Record<ScaleType, ScaleBlueprint> = {
  major: { positions: standardPositions(7) },
  natural_minor: { positions: standardPositions(7) },
  dorian: { positions: standardPositions(7) },
  mixolydian: { positions: standardPositions(7) },
  minor_pentatonic: { positions: standardPositions(5) },
  major_pentatonic: { positions: standardPositions(5) },
  lydian_b7: { positions: standardPositions(7) }, // 7-note, standard boxes
  altered: { positions: standardPositions(7) },
};

/** How many box positions a scale type has (for the position picker). */
export function positionCount(scaleType: ScaleType): number {
  return SCALE_BLUEPRINTS[scaleType].positions.length;
}
