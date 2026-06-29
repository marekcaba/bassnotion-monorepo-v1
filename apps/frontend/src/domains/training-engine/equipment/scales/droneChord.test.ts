import { describe, it, expect } from 'vitest';
import { droneChordSymbol } from './droneChord';
import { parseChord } from '@/domains/playback/utils/chordParser';

describe('droneChordSymbol — auto drone chord per scale + root', () => {
  it('mixolydian → dominant 7 (A mixolydian → A7)', () => {
    expect(droneChordSymbol('A', 'mixolydian')).toBe('A7');
  });

  it('major → maj7', () => {
    expect(droneChordSymbol('C', 'major')).toBe('Cmaj7');
    expect(droneChordSymbol('G', 'major_pentatonic')).toBe('Gmaj7');
  });

  it('minor modes → m7', () => {
    expect(droneChordSymbol('E', 'natural_minor')).toBe('Em7');
    expect(droneChordSymbol('D', 'dorian')).toBe('Dm7');
    expect(droneChordSymbol('A', 'minor_pentatonic')).toBe('Am7');
  });

  it('every emitted symbol is parseable by the real chordParser (no orphan suffix)', () => {
    const roots = ['C', 'C#', 'F#', 'A', 'B'] as const;
    const scales = [
      'major',
      'natural_minor',
      'dorian',
      'mixolydian',
      'minor_pentatonic',
      'major_pentatonic',
    ] as const;
    for (const r of roots)
      for (const s of scales) {
        const symbol = droneChordSymbol(r, s);
        const notes = parseChord(symbol);
        // A valid chord → at least a triad of note names with octaves. chordParser
        // spells accidentals as a trailing 's' (e.g. 'Cs4', 'Fs5'), not '#'/'b'.
        expect(notes.length).toBeGreaterThanOrEqual(3);
        expect(notes.every((n) => /^[A-G]s?\d$/.test(n))).toBe(true);
      }
  });

  it('the chord ROOT matches the scale root (A7 → starts on A)', () => {
    const notes = parseChord(droneChordSymbol('A', 'mixolydian'));
    // chordParser keeps the root letter (A has no accidental); strip the octave.
    expect(notes[0]!.replace(/\d$/, '')).toBe('A');
  });
});
