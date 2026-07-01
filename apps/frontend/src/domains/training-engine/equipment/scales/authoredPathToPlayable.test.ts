import { describe, it, expect } from 'vitest';
import {
  authoredPathToPlayable,
  authoredPathBeats,
  buildUpDownEvents,
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

describe('buildUpDownEvents — paths run up to the top, then back down', () => {
  it('reverses the middle — BOTH endpoints dropped (top + bottom play once per loop)', () => {
    const asc = [note(4, 0), note(4, 2), note(4, 4)]; // E F# G# (up)
    const out = buildUpDownEvents(asc, null);
    // up E F# G#, then DOWN only the middle (F#) — the top G# (turnaround) and the bottom E
    // (first note of the NEXT loop) are both skipped, so the loop reads E F# G# F# | E F# …
    expect(out.map((e) => (e as { fret: number }).fret)).toEqual([0, 2, 4, 2]);
  });

  it('loop seam does NOT duplicate the bottom note', () => {
    const asc = [note(4, 0), note(4, 2), note(4, 4)];
    const out = buildUpDownEvents(asc, null);
    const frets = out.map((e) => (e as { fret: number }).fret);
    // The last event of the sequence is NOT the same as the first (no doubled bottom on wrap).
    expect(frets[frets.length - 1]).not.toBe(frets[0]);
  });

  it('uses the authored descending array when present (admin owns those notes)', () => {
    const asc = [note(4, 0), note(4, 2)];
    const desc = [note(3, 5), note(3, 2)]; // a different hand-authored descent
    const out = buildUpDownEvents(asc, desc);
    expect(out).toEqual([...asc, ...desc]);
  });

  it('drops trailing rests before reversing (descent does not open on silence)', () => {
    const asc = [note(4, 0), note(4, 2), note(4, 4), rest(240)];
    const out = buildUpDownEvents(asc, null);
    // trailing rest trimmed; reverse the middle only → just F# on the way down.
    expect(out.map((e) => (e as { fret?: number }).fret)).toEqual([
      0,
      2,
      4,
      undefined, // the trailing rest stays in the ASCENDING half (it has no fret)
      2,
    ]);
  });

  it('a two-note path has no middle to mirror (just up)', () => {
    const asc = [note(4, 0), note(4, 2)];
    expect(buildUpDownEvents(asc, null)).toEqual(asc); // E F# — nothing between the endpoints
  });

  it('a single-note path has no descent to add', () => {
    const asc = [note(4, 0)];
    expect(buildUpDownEvents(asc, null)).toEqual(asc);
  });

  it('is empty for an empty / malformed ascending', () => {
    expect(buildUpDownEvents([], null)).toEqual([]);
    expect(buildUpDownEvents(null, null)).toEqual([]);
  });

  it('plays as a real up-down sequence through authoredPathToPlayable', () => {
    const asc = [note(4, 0, 240), note(4, 2, 240), note(4, 4, 240)];
    const out = authoredPathToPlayable(buildUpDownEvents(asc, null));
    // E F# G# F# — climbs to the top midi then steps back down; loops cleanly to E.
    expect(out.map((n) => n.midi)).toEqual([28, 30, 32, 30]);
  });
});
