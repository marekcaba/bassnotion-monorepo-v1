import { describe, it, expect } from 'vitest';
import {
  authoredPathToPlayable,
  authoredPathBeats,
} from './authoredPathToPlayable';

const note = (string: number, fret: number, durationTicks = 240) => ({
  string,
  fret,
  durationTicks,
});
const rest = (durationTicks = 240) => ({ kind: 'rest', durationTicks });

describe('authoredPathToPlayable', () => {
  it('maps (string,fret) to MIDI using the high→low convention (4-string)', () => {
    // 4-string open: 1=G(43) 2=D(38) 3=A(33) 4=E(28). Fret adds semitones.
    const out = authoredPathToPlayable([note(4, 0), note(4, 3), note(3, 0)]);
    expect(out.map((n) => n.midi)).toEqual([28, 31, 33]); // E, G, A
    expect(out.map((n) => n.string)).toEqual([4, 4, 3]);
  });

  it('converts ticks → Tone.js rhythm + accumulates startBeat', () => {
    const out = authoredPathToPlayable([
      note(4, 0, 480), // quarter → 1 beat
      note(4, 2, 240), // eighth → 0.5 beat
      note(4, 4, 240),
    ]);
    expect(out.map((n) => n.duration)).toEqual(['4n', '8n', '8n']);
    expect(out.map((n) => n.startBeat)).toEqual([0, 1, 1.5]);
    expect(out.map((n) => n.step)).toEqual([0, 1, 2]);
  });

  it('rests advance time but emit no note (next startBeat jumps the gap)', () => {
    const out = authoredPathToPlayable([
      note(4, 0, 240), // beat 0
      rest(240), // silence 0.5..1.0
      note(4, 2, 240), // beat 1.0
    ]);
    expect(out.length).toBe(2);
    expect(out.map((n) => n.startBeat)).toEqual([0, 1]);
  });

  it('slides every note +N frets on the same string (transpose to key)', () => {
    const out = authoredPathToPlayable([note(4, 0), note(4, 2)], {
      semitones: 3,
    });
    expect(out.map((n) => n.fret)).toEqual([3, 5]);
    expect(out.map((n) => n.midi)).toEqual([31, 33]); // E+3=G, F#+3=A
  });

  it('drops notes sliding off the neck but keeps the time slot', () => {
    const out = authoredPathToPlayable([note(1, 23, 240), note(1, 10, 240)], {
      semitones: 5,
      maxFrets: 24,
    });
    // 23+5=28 > 24 → dropped; 10+5=15 ok. The kept note still starts at beat 0.5.
    expect(out.length).toBe(1);
    expect(out[0]!.fret).toBe(15);
    expect(out[0]!.startBeat).toBe(0.5);
  });

  it('flags the tonic when rootPc is given', () => {
    // E on string 4 fret 0 = MIDI 28, pc 4 = E. Root E → isRoot true.
    const out = authoredPathToPlayable([note(4, 0), note(4, 2)], {
      rootPc: 'E',
    });
    expect(out[0]!.isRoot).toBe(true); // E
    expect(out[1]!.isRoot).toBe(false); // F#
  });

  it('returns [] for malformed / non-array payloads (tool falls back safely)', () => {
    expect(authoredPathToPlayable(null)).toEqual([]);
    expect(authoredPathToPlayable(undefined)).toEqual([]);
    expect(authoredPathToPlayable('nope')).toEqual([]);
    expect(authoredPathToPlayable([{ junk: 1 }, { string: 4 }])).toEqual([]);
  });

  it('skips strings absent on the chosen neck', () => {
    // string 5 doesn't exist on a 4-string neck → skipped.
    const out = authoredPathToPlayable([note(5, 0), note(4, 0)], {
      stringCount: 4,
    });
    expect(out.length).toBe(1);
    expect(out[0]!.string).toBe(4);
  });
});

describe('authoredPathBeats', () => {
  it('counts notes AND trailing rests', () => {
    expect(authoredPathBeats([note(4, 0, 480), rest(240)])).toBe(1.5);
  });
  it('is 0 for empty / malformed', () => {
    expect(authoredPathBeats([])).toBe(0);
    expect(authoredPathBeats(null)).toBe(0);
  });
});
