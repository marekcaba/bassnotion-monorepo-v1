/**
 * Unit tests for transposeChordSymbol — transpose chord-symbol strings by N
 * semitones, keeping the quality verbatim and re-spelling in the key's
 * accidental style.
 */
import { describe, expect, it } from 'vitest';
import { transposeChordSymbol } from '../transposeChord.js';

describe('transposeChordSymbol', () => {
  it('transposes the root and keeps the quality verbatim', () => {
    // Sharp key (E): spell in sharps.
    expect(transposeChordSymbol('Dm7', 3, 'E')).toBe('Fm7');
    expect(transposeChordSymbol('A7', 2, 'E')).toBe('B7');
    expect(transposeChordSymbol('Cmaj7', 4, 'E')).toBe('Emaj7');
    expect(transposeChordSymbol('Gsus4', 5, 'E')).toBe('Csus4');
  });

  it('spells in flats when the key is a flat key', () => {
    expect(transposeChordSymbol('Cm7', 1, 'Bb')).toBe('D♭m7');
    expect(transposeChordSymbol('F7', 3, 'Eb')).toBe('A♭7');
    expect(transposeChordSymbol('G', 3, 'Bb')).toBe('B♭');
  });

  it('spells in sharps for a sharp key', () => {
    expect(transposeChordSymbol('C', 1, 'E')).toBe('C♯');
    expect(transposeChordSymbol('A', 3, 'F#')).toBe('C');
  });

  it('handles slash chords (transposes both root and bass)', () => {
    expect(transposeChordSymbol('C/E', 2, 'E')).toBe('D/F♯');
    expect(transposeChordSymbol('G7/B', 1, 'Bb')).toBe('A♭7/C');
    expect(transposeChordSymbol('Dm7/G', 0, 'E')).toBe('Dm7/G'); // unison
  });

  it('parses flat/sharp/glyph roots on input', () => {
    expect(transposeChordSymbol('Bbmaj7', 2, 'E')).toBe('Cmaj7');
    expect(transposeChordSymbol('F#m7b5', 1, 'E')).toBe('Gm7b5');
    expect(transposeChordSymbol('B♭7', 1, 'E')).toBe('B7');
  });

  it('wraps across the octave correctly', () => {
    expect(transposeChordSymbol('B7', 1, 'E')).toBe('C7');
    expect(transposeChordSymbol('C7', -1, 'E')).toBe('B7');
    expect(transposeChordSymbol('Am7', -3, 'E')).toBe('F♯m7');
  });

  it('returns the symbol unchanged at 0 semitones', () => {
    expect(transposeChordSymbol('Dm7b5', 0, 'E')).toBe('Dm7b5');
    expect(transposeChordSymbol('C/E', 0, 'E')).toBe('C/E');
  });

  it('leaves an unparseable root verbatim', () => {
    expect(transposeChordSymbol('N.C.', 3, 'E')).toBe('N.C.');
    expect(transposeChordSymbol('%', 2, 'E')).toBe('%');
  });

  it('handles empty input', () => {
    expect(transposeChordSymbol('', 3, 'E')).toBe('');
    expect(transposeChordSymbol('   ', 3, 'E')).toBe('');
  });
});
