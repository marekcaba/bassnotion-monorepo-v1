import { describe, it, expect } from 'vitest';
import { buildNoteUniverse, selectBox } from './noteUniverse';

const FB4 = { stringCount: 4 as const, maxFrets: 24 };

describe('buildNoteUniverse — the full scale map on the neck', () => {
  it('every note is a scale pitch class (C major = C D E F G A B)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const cMajor = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    for (const n of u) expect(cMajor.has(n.noteName)).toBe(true);
  });

  it('the string+fret of each note sounds its MIDI (authoritative convention: 1=G high … 4=E low)', () => {
    const open: Record<number, number> = { 1: 43, 2: 38, 3: 33, 4: 28 };
    const u = buildNoteUniverse(FB4, 'A', 'natural_minor');
    for (const n of u) expect(open[n.string]! + n.fret).toBe(n.midi);
  });

  it('string 1 is the HIGHEST pitch, the highest string number is the LOWEST (not inverted)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    // The lowest-MIDI note must be on string 4 (E, lowest); never on string 1 (G, highest).
    const lowest = u[0]!; // sorted ascending by midi
    expect(lowest.string).toBe(4);
  });

  it('spans ALL strings (the whole neck, not one string)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const strings = new Set(u.map((n) => n.string));
    expect(strings).toEqual(new Set([1, 2, 3, 4]));
  });

  it('marks roots + assigns ascending degrees (0=root)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const roots = u.filter((n) => n.isRoot);
    expect(roots.length).toBeGreaterThan(0);
    for (const r of roots) {
      expect(r.noteName).toBe('C');
      expect(r.degree).toBe(0);
    }
  });

  it('a bigger neck (24 vs 21 frets) yields MORE notes (fret count is load-bearing)', () => {
    const big = buildNoteUniverse(
      { stringCount: 4, maxFrets: 24 },
      'C',
      'major',
    );
    const small = buildNoteUniverse(
      { stringCount: 4, maxFrets: 21 },
      'C',
      'major',
    );
    expect(big.length).toBeGreaterThan(small.length);
  });

  it('a 5-string adds the low B range', () => {
    const u4 = buildNoteUniverse(
      { stringCount: 4, maxFrets: 24 },
      'C',
      'major',
    );
    const u5 = buildNoteUniverse(
      { stringCount: 5, maxFrets: 24 },
      'C',
      'major',
    );
    expect(u5.length).toBeGreaterThan(u4.length);
    expect(u5.some((n) => n.string === 5)).toBe(true);
  });
});

describe('selectBox — one position is a REAL fingering across strings (the bug fix)', () => {
  it('C major position 1: notes on MULTIPLE strings (not a single-string line)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    expect(box.length).toBeGreaterThan(0);
    const strings = new Set(box.map((n) => n.string));
    // The whole point: a box spans several strings, not one.
    expect(strings.size).toBeGreaterThanOrEqual(3);
  });

  it('the box stays within a narrow fret window (a hand position)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box = selectBox(u, FB4, 'C', 'major', 1);
    const frets = box.map((n) => n.fret);
    // span is ~4 frets in the blueprint; allow a little slack for the clamp.
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(6);
  });

  it('every box note is still a scale note + ascending', () => {
    const u = buildNoteUniverse(FB4, 'G', 'minor_pentatonic');
    const box = selectBox(u, FB4, 'G', 'minor_pentatonic', 1);
    const gMinPent = new Set(['G', 'A#', 'C', 'D', 'F']);
    for (const n of box) expect(gMinPent.has(n.noteName)).toBe(true);
    for (let i = 1; i < box.length; i++) {
      expect(box[i]!.midi).toBeGreaterThanOrEqual(box[i - 1]!.midi);
    }
  });

  it('a higher position sits higher up the neck than position 1', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const box1 = selectBox(u, FB4, 'C', 'major', 1);
    const box3 = selectBox(u, FB4, 'C', 'major', 3);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(box3.map((n) => n.fret))).toBeGreaterThan(
      avg(box1.map((n) => n.fret)),
    );
  });
});
