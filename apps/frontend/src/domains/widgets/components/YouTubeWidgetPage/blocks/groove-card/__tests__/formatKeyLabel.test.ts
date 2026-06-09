/**
 * Unit tests for formatKeyLabel — renders a real note name from an original key
 * + a semitone offset, parsing flats/sharps/glyphs and spelling the result in
 * the original key's accidental style.
 */
import { describe, expect, it } from 'vitest';
import { formatKeyLabel } from '../GrooveCardControls.js';

describe('formatKeyLabel', () => {
  it('renders sharps from a sharp/natural key', () => {
    expect(formatKeyLabel('E', 0)).toBe('E');
    expect(formatKeyLabel('E', 2)).toBe('F♯');
    expect(formatKeyLabel('E', 3)).toBe('G');
    expect(formatKeyLabel('C', 1)).toBe('C♯');
  });

  it('parses ASCII flat keys (the reported bug: "Db" no longer shows "Db +3")', () => {
    expect(formatKeyLabel('Db', 0)).toBe('D♭');
    expect(formatKeyLabel('Db', 3)).toBe('E'); // D♭ + m3 → E (not "Db +3")
    expect(formatKeyLabel('Db', 6)).toBe('G'); // D♭ + tritone → G
    expect(formatKeyLabel('Db', -2)).toBe('B'); // D♭ − M2 → B (wraps)
  });

  it('spells flat keys in flats (bass-friendly)', () => {
    expect(formatKeyLabel('Bb', 0)).toBe('B♭');
    expect(formatKeyLabel('Bb', 3)).toBe('D♭'); // B♭ + m3 → D♭, not C♯
    expect(formatKeyLabel('Eb', 5)).toBe('A♭');
  });

  it('parses glyph accidentals (♭ / ♯)', () => {
    expect(formatKeyLabel('D♭', 3)).toBe('E');
    expect(formatKeyLabel('F♯', 1)).toBe('G');
  });

  it('parses ASCII sharp keys', () => {
    expect(formatKeyLabel('F#', 0)).toBe('F♯');
    expect(formatKeyLabel('C#', 2)).toBe('D♯');
  });

  it('wraps across the octave correctly', () => {
    expect(formatKeyLabel('B', 1)).toBe('C');
    expect(formatKeyLabel('C', -1)).toBe('B');
  });

  it('falls back to ±N only for genuinely unparseable keys', () => {
    expect(formatKeyLabel('???', 0)).toBe('???');
    expect(formatKeyLabel('???', 3)).toBe('??? +3');
    expect(formatKeyLabel('???', -2)).toBe('??? -2');
  });
});
