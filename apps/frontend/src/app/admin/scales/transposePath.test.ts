import { describe, it, expect } from 'vitest';
import {
  keyInterval,
  transposeBySlide,
  transposeByNearest,
} from './transposePath';
import { DURATIONS, type PathEvent } from './musicalTime';

const note = (string: number, fret: number): PathEvent => ({
  string,
  fret,
  durationTicks: DURATIONS.eighth,
});

describe('keyInterval', () => {
  it('E→F = +1, E→Eb = -1, C→G = +7', () => {
    expect(keyInterval('E', 'F')).toBe(1);
    expect(keyInterval('E', 'Eb')).toBe(-1);
    expect(keyInterval('C', 'G')).toBe(7);
  });
  it('handles flat + sharp spellings of the same pitch', () => {
    expect(keyInterval('Db', 'C#')).toBe(0); // same pitch
    expect(keyInterval('C', 'Db')).toBe(1);
  });
});

describe('transposeBySlide — +N frets, same string, drop off-neck', () => {
  it('slides every note up by the interval on the same string', () => {
    const path = [note(4, 0), note(4, 2), note(3, 0)];
    const out = transposeBySlide(path, 2, 24); // +2 frets
    expect(out).toEqual([note(4, 2), note(4, 4), note(3, 2)]);
  });

  it('drops notes that fall below fret 0 when sliding DOWN', () => {
    const path = [note(4, 0), note(4, 3)];
    const out = transposeBySlide(path, -1, 24); // -1: fret 0 → -1 (drop), 3 → 2
    expect(out).toEqual([note(4, 2)]);
  });

  it('drops notes past the top fret when sliding UP', () => {
    const path = [note(1, 22), note(1, 10)];
    const out = transposeBySlide(path, 5, 24); // 22+5=27 > 24 drop; 10+5=15 ok
    expect(out).toEqual([note(1, 15)]);
  });

  it('passes rests through untouched', () => {
    const rest: PathEvent = { kind: 'rest', durationTicks: DURATIONS.quarter };
    const out = transposeBySlide([note(4, 0), rest, note(4, 2)], 2, 24);
    expect(out).toEqual([note(4, 2), rest, note(4, 4)]);
  });
});

describe('transposeByNearest — degree-preserving re-map into the new key', () => {
  it('moves an E-major fingering to F major, keeping it playable + in region', () => {
    // E major on a 4-string: E open (string 4 fret 0) is the root, degree 0.
    const path = [note(4, 0), note(4, 2), note(3, 0)]; // E, F#, A (roughly)
    const out = transposeByNearest(path, 'E', 'F', 'major', 4, 24);
    // Same count (all on-scale), every note is a valid playable position.
    expect(out.length).toBe(3);
    out.forEach((e) => {
      if (e.kind === 'rest') return;
      expect(e.fret).toBeGreaterThanOrEqual(0);
      expect(e.fret).toBeLessThanOrEqual(24);
    });
  });

  it('the re-mapped notes are F-major pitches (not E-major)', () => {
    const path = [note(4, 0)]; // E root in E major
    const out = transposeByNearest(path, 'E', 'F', 'major', 4, 24);
    // F major pitch classes; the mapped note must be one of them.
    const fMajorPCs = new Set([5, 7, 9, 10, 0, 2, 4]); // F G A Bb C D E
    const open: Record<number, number> = { 1: 43, 2: 38, 3: 33, 4: 28 };
    out.forEach((e) => {
      if (e.kind === 'rest') return;
      const midi = open[e.string]! + e.fret;
      expect(fMajorPCs.has(midi % 12)).toBe(true);
    });
  });

  it('drops notes that are not on the source scale', () => {
    // string 4 fret 1 = F, which is NOT in E major → should be dropped.
    const path = [note(4, 0), note(4, 1)];
    const out = transposeByNearest(path, 'E', 'F', 'major', 4, 24);
    expect(out.length).toBe(1); // the off-scale note dropped
  });

  it('passes rests through', () => {
    const rest: PathEvent = { kind: 'rest', durationTicks: DURATIONS.eighth };
    const out = transposeByNearest(
      [note(4, 0), rest],
      'E',
      'F',
      'major',
      4,
      24,
    );
    expect(out.some((e) => e.kind === 'rest')).toBe(true);
  });
});
