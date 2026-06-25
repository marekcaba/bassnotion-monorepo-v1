/**
 * scaleGenerator — the music-theory layer for the gym "Scales" equipment tool.
 *
 * Pure + testable: given a root, a scale type, and the bass config, produce the
 * fretboard positions for ONE OCTAVE in a single box position (ascending), in the
 * `ExerciseNoteInput` shape the production fretboard (Ring3DOverlayCanvas) consumes.
 *
 * STRING CONVENTION (load-bearing — pinned by tests):
 * `ExerciseNoteInput.string` is 1-based BY PITCH, matching
 * Ring3DOverlayCanvas.noteStringToVisualIndex:
 *   4-string: 1=E (lowest), 2=A, 3=D, 4=G (highest)
 *   5-string: 1=B (lowest), 2=E, 3=A, 4=D, 5=G
 *   6-string: 1=B, 2=E, 3=A, 4=D, 5=G, 6=C (highest)
 * A note at (string s, fret f) sounds at MIDI = openStringMidi[s] + f.
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

/** Open-string MIDI by `string` number (1-based, pitch order) per string count.
 *  4-string standard: E1=28, A1=33, D2=38, G2=43. 5-string adds low B0=23. */
const OPEN_STRING_MIDI: Record<StringCount, Record<number, number>> = {
  4: { 1: 28, 2: 33, 3: 38, 4: 43 }, // E A D G
  5: { 1: 23, 2: 28, 3: 33, 4: 38, 5: 43 }, // B E A D G
  6: { 1: 23, 2: 28, 3: 33, 4: 38, 5: 43, 6: 48 }, // B E A D G C
};

/** A single fretboard position the tool renders + sequences. */
export interface ScaleNote {
  /** 1-based string by pitch (see convention above). */
  string: 1 | 2 | 3 | 4 | 5 | 6;
  /** Fret 0..maxFrets (0 = open string). */
  fret: number;
  /** MIDI number (for ordering + the optional audible note later). */
  midi: number;
  /** Pitch-class name (e.g. 'C', 'F#') — for labels. */
  noteName: PitchClass;
  /** True for the scale's root degree (for highlighting the tonic). */
  isRoot: boolean;
}

export interface GenerateScaleOptions {
  root: PitchClass;
  scaleType: ScaleType;
  stringCount: StringCount;
  /** Highest usable fret (so we never place a note past the user's neck). */
  maxFrets: number;
  /** Which string the box starts on (1-based by pitch). Default: the lowest string. */
  startString?: number;
}

function midiToPitchClass(midi: number): PitchClass {
  return PITCH_CLASSES[((midi % 12) + 12) % 12]!;
}

/**
 * Generate a one-octave scale in a single box position, ascending.
 *
 * Strategy (box position): start on the lowest string at the lowest fret that lands
 * the root, then walk UP the scale degrees, advancing to the next string when the
 * next degree's fret would exceed a 4-fret span from the box's starting fret (the
 * "one box / one hand position" feel). Stops after one octave (root → root).
 */
export function generateScale(opts: GenerateScaleOptions): ScaleNote[] {
  const { root, scaleType, stringCount, maxFrets } = opts;
  const startString = opts.startString ?? 1;
  const rootPc = PITCH_CLASSES.indexOf(root);
  const intervals = SCALE_INTERVALS[scaleType];
  const openMidi = OPEN_STRING_MIDI[stringCount];

  // The scale's MIDI sequence for one octave, starting from the lowest root at/above
  // the start string's open note.
  const startOpen = openMidi[startString]!;
  // First root at or above the open string (so the box sits on the neck, not below).
  let rootMidi = startOpen;
  while (((rootMidi % 12) + 12) % 12 !== rootPc) rootMidi++;

  // Box anchor: the fret of that first root on the start string.
  const boxFret = rootMidi - startOpen;
  // A box spans ~4-5 frets; allow up to 5 so wider scales still fit one hand.
  const BOX_SPAN = 5;

  // The one-octave degree MIDIs (root included once at bottom + the octave on top).
  const degreeMidis = [...intervals.map((iv) => rootMidi + iv), rootMidi + 12];

  const notes: ScaleNote[] = [];
  // Walk strings from the start string upward; for each degree, find the lowest
  // string+fret within the box span that produces it, preferring to stay on the
  // current string until the fret leaves the box, then step to the next string.
  let currentString = startString;

  for (let d = 0; d < degreeMidis.length; d++) {
    const targetMidi = degreeMidis[d]!;
    let placed = false;

    // Try the current string first, then climb to higher strings.
    for (let s = currentString; s <= stringCount; s++) {
      const open = openMidi[s]!;
      const fret = targetMidi - open;
      // Must be a real fret, within the neck, and within the box span from boxFret.
      if (fret < 0 || fret > maxFrets) continue;
      if (fret < boxFret - 1 || fret > boxFret + BOX_SPAN) continue;
      notes.push({
        string: s as ScaleNote['string'],
        fret,
        midi: targetMidi,
        noteName: midiToPitchClass(targetMidi),
        isRoot: ((targetMidi % 12) + 12) % 12 === rootPc,
      });
      currentString = s;
      placed = true;
      break;
    }

    // Fallback: if the box-constrained search failed (rare, narrow necks), place it
    // anywhere ascending on the neck so the scale is never silently truncated.
    if (!placed) {
      for (let s = 1; s <= stringCount; s++) {
        const fret = targetMidi - openMidi[s]!;
        if (fret >= 0 && fret <= maxFrets) {
          notes.push({
            string: s as ScaleNote['string'],
            fret,
            midi: targetMidi,
            noteName: midiToPitchClass(targetMidi),
            isRoot: ((targetMidi % 12) + 12) % 12 === rootPc,
          });
          currentString = s;
          break;
        }
      }
    }
  }

  return notes;
}

/** Map generated scale notes to the fretboard's ExerciseNoteInput shape, one note
 *  per beat ascending (so the active-note highlight steps through in time). */
export function scaleToExerciseNotes(notes: ScaleNote[]): {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  duration: string;
  position: { measure: number; beat: number };
}[] {
  return notes.map((n, i) => ({
    string: n.string,
    fret: n.fret,
    duration: '4n',
    position: { measure: Math.floor(i / 4) + 1, beat: (i % 4) + 1 },
  }));
}
