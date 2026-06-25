import { describe, it, expect } from 'vitest';
import {
  generateScale,
  scaleToExerciseNotes,
  rootFromKey,
  SCALE_INTERVALS,
  type ScaleNote,
} from './scaleGenerator';

describe('rootFromKey — root follows the playback key', () => {
  it('returns the original key at 0 semitones', () => {
    expect(rootFromKey('E', 0)).toBe('E');
    expect(rootFromKey('C', 0)).toBe('C');
  });

  it('transposes up by the semitone offset (E +2 = F#)', () => {
    expect(rootFromKey('E', 2)).toBe('F#');
    expect(rootFromKey('C', 1)).toBe('C#');
  });

  it('transposes down + wraps the octave (C −1 = B)', () => {
    expect(rootFromKey('C', -1)).toBe('B');
    expect(rootFromKey('E', -5)).toBe('B');
  });

  it('parses flats/glyphs (Bb, F♯) to the right pitch class', () => {
    expect(rootFromKey('Bb', 0)).toBe('A#'); // our PitchClass spells sharps
    expect(rootFromKey('F♯', 0)).toBe('F#');
  });

  it('falls back to C on an unparseable key', () => {
    expect(rootFromKey('???', 3)).toBe('C');
  });
});

// MIDI helpers for assertions: open strings 4-string standard = E1 28, A1 33, D2 38, G2 43.
const midiOf = (note: ScaleNote) => note.midi;

describe('generateScale — note content (theory correctness)', () => {
  it('C major, 4-string: produces 8 ascending notes (root → octave) with correct pitch classes', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    // one octave = 7 degrees + the octave root = 8 notes
    expect(notes).toHaveLength(8);
    // C D E F G A B C
    expect(notes.map((n) => n.noteName)).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
      'C',
    ]);
  });

  it('is strictly ascending in MIDI (a play-along scale must go up)', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    for (let i = 1; i < notes.length; i++) {
      expect(midiOf(notes[i]!)).toBeGreaterThan(midiOf(notes[i - 1]!));
    }
  });

  it('spans exactly one octave (12 semitones root→octave)', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    expect(midiOf(notes.at(-1)!) - midiOf(notes[0]!)).toBe(12);
  });

  it('marks ONLY the root degrees (bottom + octave) as isRoot', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    expect(notes.filter((n) => n.isRoot).map((n) => n.noteName)).toEqual([
      'C',
      'C',
    ]);
    expect(notes[0]!.isRoot).toBe(true);
    expect(notes.at(-1)!.isRoot).toBe(true);
  });

  it('every position is a REAL fret on the neck (0..maxFrets) and a valid string', () => {
    const notes = generateScale({
      root: 'G',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 12,
    });
    for (const n of notes) {
      expect(n.fret).toBeGreaterThanOrEqual(0);
      expect(n.fret).toBeLessThanOrEqual(12);
      expect(n.string).toBeGreaterThanOrEqual(1);
      expect(n.string).toBeLessThanOrEqual(4);
    }
  });

  it('the string+fret of each note actually SOUNDS its claimed MIDI (mapping integrity)', () => {
    // open-string MIDI for 4-string by `string` (1=E..4=G)
    const open: Record<number, number> = { 1: 28, 2: 33, 3: 38, 4: 43 };
    const notes = generateScale({
      root: 'A',
      scaleType: 'natural_minor',
      stringCount: 4,
      maxFrets: 14,
    });
    for (const n of notes) {
      expect(open[n.string]! + n.fret).toBe(n.midi);
    }
  });

  it('stays within a box position (~5-fret span) for C major', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    const frets = notes.map((n) => n.fret);
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5);
  });

  it('respects scale type — pentatonic has 5 degrees (+octave = 6 notes)', () => {
    const notes = generateScale({
      root: 'E',
      scaleType: 'minor_pentatonic',
      stringCount: 4,
      maxFrets: 14,
    });
    expect(notes).toHaveLength(SCALE_INTERVALS.minor_pentatonic.length + 1);
  });

  it('works on a 5-string (string 1 = low B)', () => {
    const notes = generateScale({
      root: 'B',
      scaleType: 'major',
      stringCount: 5,
      maxFrets: 14,
    });
    expect(notes[0]!.noteName).toBe('B');
    // open low B on string 1 = MIDI 23 → root at fret 0
    expect(notes[0]!.string).toBe(1);
    expect(notes[0]!.fret).toBe(0);
  });
});

describe('scaleToExerciseNotes — fretboard input mapping', () => {
  it('emits one note per beat, 4 beats per measure, ascending', () => {
    const notes = generateScale({
      root: 'C',
      scaleType: 'major',
      stringCount: 4,
      maxFrets: 14,
    });
    const ex = scaleToExerciseNotes(notes);
    expect(ex).toHaveLength(8);
    // first 4 in measure 1 beats 1-4, next 4 in measure 2 beats 1-4
    expect(ex[0]!.position).toEqual({ measure: 1, beat: 1 });
    expect(ex[3]!.position).toEqual({ measure: 1, beat: 4 });
    expect(ex[4]!.position).toEqual({ measure: 2, beat: 1 });
    // preserves string+fret from the generated notes
    expect(ex[0]!.string).toBe(notes[0]!.string);
    expect(ex[0]!.fret).toBe(notes[0]!.fret);
  });
});
