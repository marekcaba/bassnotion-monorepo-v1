import { describe, it, expect } from 'vitest';
import { rootFromKey } from './scaleGenerator';

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
