/**
 * Chord Parser Utilities
 *
 * Utilities for parsing chord symbols and converting musical notation
 * Used by FAANG solution for harmony widget direct scheduling
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('ChordParser');

/**
 * Chord note intervals (semitones from root)
 */
const CHORD_INTERVALS: Record<string, number[]> = {
  // Major chords
  '': [0, 4, 7], // Major triad (e.g., "C")
  maj: [0, 4, 7],
  M: [0, 4, 7],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  maj11: [0, 4, 7, 11, 14, 17],
  maj13: [0, 4, 7, 11, 14, 17, 21],

  // Minor chords
  m: [0, 3, 7],
  min: [0, 3, 7],
  '-': [0, 3, 7],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  '-7': [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],

  // Dominant chords
  '7': [0, 4, 7, 10],
  '9': [0, 4, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 17, 21],

  // Diminished chords
  dim: [0, 3, 6],
  o: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  o7: [0, 3, 6, 9],

  // Augmented chords
  aug: [0, 4, 8],
  '+': [0, 4, 8],

  // Suspended chords
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7], // Default to sus4
  '7sus4': [0, 5, 7, 10],
  '7sus2': [0, 2, 7, 10],
};

/**
 * Note names in chromatic order
 */
const CHROMATIC_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Enharmonic equivalents (for sharp notation)
 */
const ENHARMONIC_MAP: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

/**
 * Parse a chord symbol into individual note names with octave
 *
 * @param chordSymbol - Chord symbol (e.g., 'Cmaj7', 'Dm7', 'G7')
 * @param octave - Base octave for the root note (default: 4)
 * @returns Array of note names with octaves (e.g., ['C4', 'E4', 'G4', 'B4'])
 *
 * @example
 * parseChord('Cmaj7') → ['C4', 'E4', 'G4', 'B4']
 * parseChord('Dm7', 3) → ['D3', 'F3', 'A3', 'C4']
 */
export function parseChord(chordSymbol: string, octave: number = 4): string[] {
  // Parse root note and chord quality
  const { root, quality } = parseChordSymbol(chordSymbol);

  // Get intervals for this chord quality
  const intervals = CHORD_INTERVALS[quality];
  if (!intervals) {
    logger.warn(`Unknown chord quality: ${quality}, using major triad`);
    return getNoteNamesFromIntervals(root, CHORD_INTERVALS[''], octave);
  }

  // Convert intervals to note names
  return getNoteNamesFromIntervals(root, intervals, octave);
}

/**
 * Parse chord symbol into root and quality
 *
 * @example
 * 'Cmaj7' → { root: 'C', quality: 'maj7' }
 * 'Dm' → { root: 'D', quality: 'm' }
 * 'G#7' → { root: 'G#', quality: '7' }
 */
function parseChordSymbol(chordSymbol: string): { root: string; quality: string } {
  const normalized = chordSymbol.trim();

  // Handle flat/sharp in root note
  let root = normalized[0].toUpperCase();
  let qualityStart = 1;

  if (normalized.length > 1 && (normalized[1] === 'b' || normalized[1] === '#')) {
    root += normalized[1];
    qualityStart = 2;
  }

  // Normalize sharp to flat for consistency
  if (root.includes('#')) {
    root = ENHARMONIC_MAP[root] || root;
  }

  // Extract quality (everything after root)
  const quality = normalized.slice(qualityStart);

  return { root, quality };
}

/**
 * Convert intervals to note names with octaves
 */
function getNoteNamesFromIntervals(
  root: string,
  intervals: number[],
  baseOctave: number,
): string[] {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  if (rootIndex === -1) {
    logger.error(`Invalid root note: ${root}`);
    return [];
  }

  return intervals.map((interval) => {
    const noteIndex = (rootIndex + interval) % 12;
    const octaveAdjustment = Math.floor((rootIndex + interval) / 12);
    const noteName = CHROMATIC_NOTES[noteIndex];
    const noteOctave = baseOctave + octaveAdjustment;

    // Convert to piano file notation (flat → sharp equivalent using 's')
    const pianoNote = convertToPianoNotation(noteName);

    return `${pianoNote}${noteOctave}`;
  });
}

/**
 * Convert note name to piano sample file naming convention
 * Piano samples use 's' suffix for sharps instead of 'b' for flats
 *
 * @example
 * 'Db' → 'Cs' (C# = Db)
 * 'Eb' → 'Ds' (D# = Eb)
 */
function convertToPianoNotation(noteName: string): string {
  // Piano sample file naming convention (uses sharps with 's' suffix)
  const conversionMap: Record<string, string> = {
    Db: 'Cs', // C# = Db
    Eb: 'Ds', // D# = Eb
    Gb: 'Fs', // F# = Gb
    Ab: 'Gs', // G# = Ab
    Bb: 'As', // A# = Bb
  };

  return conversionMap[noteName] || noteName;
}

/**
 * Map velocity value (0-1) to Salamander velocity layer (v1-v16)
 *
 * @param velocity - Velocity value between 0 and 1
 * @returns Velocity layer name (e.g., 'v10')
 *
 * @example
 * mapVelocityToLayer(0.3) → 'v6'  (soft)
 * mapVelocityToLayer(0.7) → 'v10' (medium)
 * mapVelocityToLayer(0.9) → 'v14' (loud)
 */
export function mapVelocityToLayer(velocity: number): string {
  // Clamp velocity to 0-1 range
  const clampedVelocity = Math.max(0, Math.min(1, velocity));

  // Map to v1-v16 (16 layers)
  // We use a curve that emphasizes mid-range dynamics
  const layerIndex = Math.floor(clampedVelocity * 15) + 1;

  // Round to nearest even layer for better sample availability
  // Most exercises use v6, v10, v14 (soft, medium, loud)
  const roundedLayer = Math.round(layerIndex / 2) * 2;
  const finalLayer = Math.max(2, Math.min(16, roundedLayer));

  return `v${finalLayer}`;
}

/**
 * Parse Tone.js duration notation to seconds
 *
 * @param duration - Tone.js duration string (e.g., '4n', '8n', '2n', '1m')
 * @param bpm - Tempo in beats per minute (default: 120)
 * @returns Duration in seconds
 *
 * @example
 * parseDuration('4n', 120) → 0.5  (quarter note at 120 BPM)
 * parseDuration('8n', 120) → 0.25 (eighth note at 120 BPM)
 * parseDuration('2n', 120) → 1.0  (half note at 120 BPM)
 */
export function parseDuration(duration: string | undefined, bpm: number = 120): number {
  if (!duration) {
    return 0.5; // Default to quarter note
  }

  const beatDuration = 60 / bpm; // Duration of one quarter note in seconds

  // Parse notation
  const match = duration.match(/^(\d+)([a-z]+)$/);
  if (!match) {
    logger.warn(`Invalid duration notation: ${duration}, using 0.5s`);
    return 0.5;
  }

  const [, value, unit] = match;
  const noteValue = parseInt(value, 10);

  switch (unit) {
    case 'n': // Note (e.g., '4n' = quarter note)
      return (4 / noteValue) * beatDuration;

    case 'm': // Measure/bar
      return noteValue * 4 * beatDuration;

    case 't': // Triplet
      return ((4 / noteValue) * beatDuration * 2) / 3;

    default:
      logger.warn(`Unknown duration unit: ${unit}, using quarter note`);
      return beatDuration;
  }
}

/**
 * Helper to get default chord voicing octaves
 * Returns appropriate octave for each note in the chord
 */
export function getChordOctaves(chordNotes: string[]): number[] {
  // Simple approach: bass notes in octave 3, others in octave 4
  return chordNotes.map((_, index) => (index === 0 ? 3 : 4));
}
