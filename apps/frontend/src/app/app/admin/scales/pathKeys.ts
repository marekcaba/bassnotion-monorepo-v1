/**
 * The 12 musical keys, ASCII-spelled (flats: Db/Eb/Gb/Ab/Bb — never sharps, never the Unicode
 * ♭/♯ glyphs). This is the canonical "PathKey" vocabulary: scale exercises are authored PER KEY
 * keyed by these strings, and the gym tool normalizes its key wheel to them for the byKey lookup.
 * A typo'd or sharp-spelled key would silently miss that lookup — so anything that lets an admin
 * PICK a key uses this fixed list, never free text.
 *
 * Single source of truth for both the scales path editor (where exercises are authored) and the
 * gig builder (where a gig's locked key is chosen).
 */
export const SCALE_KEYS_ASCII = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

export type PathKey = (typeof SCALE_KEYS_ASCII)[number];
