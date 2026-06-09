/**
 * Pitch-class spelling primitives — the single source of truth for parsing and
 * spelling note names in the groove card. Used by both the KEY label
 * (formatKeyLabel) and the CHORD-symbol transposer (transposeChordSymbol), so
 * keys and chords always agree on flats-vs-sharps.
 */

// Pitch-class index (0..11) for every common note spelling. Handles naturals,
// sharps and flats, in both ASCII (#/b) and glyph (♯/♭) accidentals, plus the
// rare B♯/E♯/C♭/F♭ enharmonics and double-accidentals.
export const PITCH_CLASS_BY_NAME: Record<string, number> = {
  c: 0,
  'b#': 0,
  dbb: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'c##': 2,
  ebb: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  fb: 4,
  'd##': 4,
  f: 5,
  'e#': 5,
  gbb: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'f##': 7,
  abb: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'g##': 9,
  bbb: 9,
  'a#': 10,
  bb: 10,
  b: 11,
  cb: 11,
  'a##': 11,
};

// Output spellings. Flat-key contexts read better in flats (bass-friendly);
// otherwise sharps. The caller picks the table via `prefersFlats`.
export const SHARP_LABELS = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;
export const FLAT_LABELS = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;

/** Normalise a free-text note name to a pitch class 0..11, or null if we can't
 *  parse it. Accepts "Db", "D♭", "F#", "F♯", "b#", double-accidentals, etc. */
export function parsePitchClass(name: string): number | null {
  const normalised = name
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .toLowerCase();
  const pc = PITCH_CLASS_BY_NAME[normalised];
  return pc == null ? null : pc;
}

/** True when a note name uses a flat accidental (so its key/chords spell in
 *  flats). Slices off the leading letter so the `b` in "B" natural isn't read
 *  as a flat. */
export function prefersFlats(noteName: string): boolean {
  return /♭|b/.test(noteName.trim().replace(/♯/g, '#').slice(1));
}

/** Spell a pitch class (0..11) as a note name, in flats or sharps. */
export function spellPitchClass(pitchClass: number, useFlats: boolean): string {
  const pc = (((Math.round(pitchClass) % 12) + 12) % 12) as number;
  const labels = useFlats ? FLAT_LABELS : SHARP_LABELS;
  return labels[pc] ?? '';
}
