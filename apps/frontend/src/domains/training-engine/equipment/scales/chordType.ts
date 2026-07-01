/**
 * chordType — the gym Scales tool is organised around CHORD SOUNDS, not modes. The student
 * picks a CHORD TYPE + key (the tonal centre they're playing over); within that chord type
 * live the runs / patterns / paths, the practiced fretboard notes are the chord's PARENT
 * SCALE, and the looping drone IS that chord.
 *
 * This module is the single source of truth tying the three together:
 *   chord type → drone QUALITY  (the suffix droneChordSymbol builds + the drone library folder)
 *   chord type → parent SCALE   (ScaleType for note generation / box selection)
 *
 * Pure + testable; no audio, no React.
 */

import type { ScaleType } from './scaleGenerator';

/** The chord sounds the tool offers — each backed by a drone in the library + a parent scale.
 *  ('maj' = a plain major triad drone; the rest match the library folders.) */
export type ChordType =
  | 'maj7'
  | '7'
  | 'm7'
  | 'm'
  | 'm9'
  | 'm11'
  | '13'
  | '13#11'
  | 'sus13'
  | '7alt';

/** The chord QUALITY suffix appended to the root to form the drone symbol + pick the library
 *  folder, e.g. ('C','maj7') → "Cmaj7", ('A','13#11') → "A13#11". For most chord types the
 *  suffix IS the type; this map keeps it explicit so a type's display/id can diverge from its
 *  drone-file suffix later without breaking the loader. */
export const CHORD_DRONE_QUALITY: Record<ChordType, string> = {
  maj7: 'maj7',
  '7': '7',
  m7: 'm7',
  m: 'm',
  m9: 'm9',
  m11: 'm11_1', // the m11 library ships two voicings (m11_1 / m11_2); default to _1
  '13': '13',
  '13#11': '13#11',
  sus13: 'sus13',
  '7alt': '7alt',
};

/** The parent SCALE whose notes the student practices for each chord — the standard
 *  chord-scale relationships. (Diminished / half-diminished / Locrian chords come later as we
 *  add those scales; for now every chord maps to a scale the engine already generates.) */
export const CHORD_PARENT_SCALE: Record<ChordType, ScaleType> = {
  maj7: 'major',
  '7': 'mixolydian',
  m7: 'dorian',
  m: 'natural_minor',
  m9: 'dorian',
  m11: 'dorian',
  '13': 'mixolydian',
  sus13: 'mixolydian',
  '13#11': 'lydian_b7', // Lydian dominant
  '7alt': 'altered', // altered (super-Locrian)
};

/** The chord types in picker order (major-ish → dominant → minor → colours). */
export const CHORD_TYPES: { value: ChordType; label: string }[] = [
  { value: 'maj7', label: 'Maj7' },
  { value: '7', label: 'Dom7' },
  { value: 'm7', label: 'Min7' },
  { value: 'm', label: 'Minor' },
  { value: 'm9', label: 'Min9' },
  { value: 'm11', label: 'Min11' },
  { value: '13', label: '13' },
  { value: 'sus13', label: 'Sus13' },
  { value: '13#11', label: '13♯11' },
  { value: '7alt', label: '7alt' },
];

/** The drone chord SYMBOL for a chord type at a root, e.g. ('A','13#11') → "A13#11". The root
 *  is the tonic pitch class (sharps; the loader folds '#'→'s' for storage). */
export function chordDroneSymbol(root: string, chord: ChordType): string {
  return `${root}${CHORD_DRONE_QUALITY[chord]}`;
}

/** The parent scale to GENERATE the practiced notes for a chord type. */
export function parentScaleFor(chord: ChordType): ScaleType {
  return CHORD_PARENT_SCALE[chord];
}

/** Best-effort reverse map: an existing exercise's ScaleType → a sensible default ChordType,
 *  for back-compat with content authored before chord types existed. */
export function chordTypeForScale(scale: ScaleType): ChordType {
  switch (scale) {
    case 'major':
    case 'major_pentatonic':
      return 'maj7';
    case 'mixolydian':
      return '7';
    case 'natural_minor':
      return 'm';
    case 'dorian':
    case 'minor_pentatonic':
      return 'm7';
    case 'lydian_b7':
      return '13#11';
    case 'altered':
      return '7alt';
    default:
      return 'maj7';
  }
}
