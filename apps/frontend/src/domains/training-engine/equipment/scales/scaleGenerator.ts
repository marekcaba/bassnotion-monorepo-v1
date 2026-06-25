/**
 * scaleGenerator — shared scale music-theory primitives for the gym Scales tool: the
 * pitch-class + scale-type vocabulary, the interval patterns, and rootFromKey (the
 * scale root derived from the playback key). The neck NOTE UNIVERSE + box selection
 * live in noteUniverse.ts (the old single-octave generator was replaced by it).
 *
 * Pure + unit-tested.
 */

/** The 12 chromatic pitch classes, sharps. Index = semitones above C. */
const PITCH_CLASSES = [
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

export type PitchClass = (typeof PITCH_CLASSES)[number];

/** Scale interval patterns (semitones from the root, one octave, not repeating the octave). */
export const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor_pentatonic: [0, 3, 5, 7, 10],
  major_pentatonic: [0, 2, 4, 7, 9],
} as const;

export type ScaleType = keyof typeof SCALE_INTERVALS;

export type StringCount = 4 | 5 | 6;

/** The fretboard view: a box position number, or the whole neck. */
export type ScaleView = number | 'whole';

/** Parse a key label ('E', 'Db', 'F#', 'B♭', 'C♯') to a 0-11 pitch class, or null. */
function parseKeyToPitchClass(key: string): number | null {
  const m = key.trim().match(/^([A-Ga-g])([#♯b♭]?)/);
  if (!m) return null;
  const LETTER: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  let pc = LETTER[m[1]!.toUpperCase()]!;
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  else if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  return ((pc % 12) + 12) % 12;
}

/**
 * The scale ROOT the fretboard should show = the backing's CURRENT key (its original
 * key transposed by the live semitone offset). This unifies the root with the playback
 * key switcher (the `< E >` control) — one source of truth, no separate root picker.
 * Falls back to C if the key label can't be parsed.
 */
export function rootFromKey(
  originalKey: string,
  currentSemitones: number,
): PitchClass {
  const base = parseKeyToPitchClass(originalKey);
  if (base == null) return 'C';
  return PITCH_CLASSES[(((base + currentSemitones) % 12) + 12) % 12]!;
}
