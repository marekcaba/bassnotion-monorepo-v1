import { describe, it, expect } from 'vitest';
import {
  PPQ,
  DURATIONS,
  ticksPerMeasure,
  resolveTimeline,
  tickToPosition,
  noteStartTick,
  type TimedNote,
  type TimeSignature,
} from './musicalTime';

const FOUR_FOUR: TimeSignature = { numerator: 4, denominator: 4 };
const THREE_FOUR: TimeSignature = { numerator: 3, denominator: 4 };
const SIX_EIGHT: TimeSignature = { numerator: 6, denominator: 8 };

const note = (durationTicks: number): TimedNote => ({
  string: 4,
  fret: 0,
  durationTicks,
});

describe('duration ticks (480 PPQ)', () => {
  it('quarter = 480, eighth = 240, sixteenth = 120', () => {
    expect(DURATIONS.quarter).toBe(480);
    expect(DURATIONS.eighth).toBe(240);
    expect(DURATIONS.sixteenth).toBe(120);
    expect(DURATIONS.whole).toBe(1920);
  });

  it('triplets divide evenly (three 8th-triplets = one quarter)', () => {
    expect(DURATIONS['eighth-triplet'] * 3).toBe(DURATIONS.quarter);
    expect(DURATIONS['sixteenth-triplet'] * 3).toBe(DURATIONS.eighth);
    expect(DURATIONS['quarter-triplet'] * 3).toBe(DURATIONS.half);
  });

  it('dotted = 1.5× the base', () => {
    expect(DURATIONS['dotted-quarter']).toBe(DURATIONS.quarter * 1.5);
    expect(DURATIONS['dotted-eighth']).toBe(DURATIONS.eighth * 1.5);
  });
});

describe('ticksPerMeasure', () => {
  it('4/4 = 1920, 3/4 = 1440, 6/8 = 1440', () => {
    expect(ticksPerMeasure(FOUR_FOUR)).toBe(1920);
    expect(ticksPerMeasure(THREE_FOUR)).toBe(1440);
    expect(ticksPerMeasure(SIX_EIGHT)).toBe(1440);
  });
});

describe('resolveTimeline — measure placement', () => {
  it('four quarters in 4/4 = one full measure, no ties', () => {
    const notes = [
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
    ];
    const r = resolveTimeline(notes, FOUR_FOUR);
    expect(r.measureCount).toBe(1);
    expect(r.segments).toHaveLength(4);
    expect(r.segments.every((s) => s.measure === 0)).toBe(true);
    expect(r.segments.every((s) => !s.tiedToNext && !s.tiedFromPrev)).toBe(
      true,
    );
    // start ticks: 0, 480, 960, 1440
    expect(r.segments.map((s) => s.startTickInMeasure)).toEqual([
      0, 480, 960, 1440,
    ]);
  });

  it('five quarters in 4/4 spill into measure 2', () => {
    const notes = Array.from({ length: 5 }, () => note(DURATIONS.quarter));
    const r = resolveTimeline(notes, FOUR_FOUR);
    expect(r.measureCount).toBe(2);
    expect(r.segments[4]!.measure).toBe(1); // the 5th quarter is in measure 2
    expect(r.segments[4]!.startTickInMeasure).toBe(0); // at its downbeat
  });
});

describe('resolveTimeline — barline crossing → tie split', () => {
  it('a half note starting on beat 4 of 4/4 ties across the barline', () => {
    // 3 quarters (fills beats 1-3), then a half note on beat 4 (480 in this measure +
    // 480 spilling into the next).
    const notes = [
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      note(DURATIONS.half),
    ];
    const r = resolveTimeline(notes, FOUR_FOUR);
    // The half note (index 3) becomes TWO segments, tied.
    const halfSegs = r.segments.filter((s) => s.noteIndex === 3);
    expect(halfSegs).toHaveLength(2);
    expect(halfSegs[0]).toMatchObject({
      measure: 0,
      startTickInMeasure: 1440,
      durationTicks: 480,
      tiedFromPrev: false,
      tiedToNext: true,
    });
    expect(halfSegs[1]).toMatchObject({
      measure: 1,
      startTickInMeasure: 0,
      durationTicks: 480,
      tiedFromPrev: true,
      tiedToNext: false,
    });
    expect(r.measureCount).toBe(2);
  });

  it('a whole note in 3/4 spans two barlines → three tied segments', () => {
    // 3/4 measure = 1440 ticks; a whole note = 1920 → 1440 + 480? No: starts at 0,
    // fills measure 1 (1440), spills 480 into measure 2. Two segments.
    const r = resolveTimeline([note(DURATIONS.whole)], THREE_FOUR);
    const segs = r.segments.filter((s) => s.noteIndex === 0);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ measure: 0, durationTicks: 1440 });
    expect(segs[1]).toMatchObject({ measure: 1, durationTicks: 480 });
    expect(segs[0]!.tiedToNext).toBe(true);
    expect(segs[1]!.tiedFromPrev).toBe(true);
  });

  it('triplets sum exactly across a beat (no spurious ties)', () => {
    const notes = Array.from({ length: 3 }, () =>
      note(DURATIONS['eighth-triplet']),
    );
    const r = resolveTimeline(notes, FOUR_FOUR);
    expect(r.segments).toHaveLength(3); // no splits
    expect(r.segments.every((s) => !s.tiedToNext)).toBe(true);
    // they occupy exactly one quarter (0..480)
    expect(r.totalTicks).toBe(DURATIONS.quarter);
  });
});

describe('tickToPosition', () => {
  it('reads measure + beat in 4/4', () => {
    expect(tickToPosition(0, FOUR_FOUR)).toMatchObject({ measure: 1, beat: 1 });
    expect(tickToPosition(480, FOUR_FOUR)).toMatchObject({
      measure: 1,
      beat: 2,
    });
    expect(tickToPosition(1440, FOUR_FOUR)).toMatchObject({
      measure: 1,
      beat: 4,
    });
    expect(tickToPosition(1920, FOUR_FOUR)).toMatchObject({
      measure: 2,
      beat: 1,
    });
  });

  it('6/8 counts in eighth-note beats (1..6)', () => {
    const eighth = PPQ / 2; // 240
    expect(tickToPosition(eighth * 5, SIX_EIGHT)).toMatchObject({
      measure: 1,
      beat: 6,
    });
    expect(tickToPosition(eighth * 6, SIX_EIGHT)).toMatchObject({
      measure: 2,
      beat: 1,
    });
  });
});

describe('rests — silence that advances the clock', () => {
  it('a rest occupies time but renders as isRest (no head)', () => {
    const notes = [
      note(DURATIONS.quarter),
      { kind: 'rest' as const, durationTicks: DURATIONS.quarter },
      note(DURATIONS.quarter),
    ];
    const r = resolveTimeline(notes, FOUR_FOUR);
    expect(r.segments).toHaveLength(3);
    expect(r.segments[0]!.isRest).toBe(false);
    expect(r.segments[1]!.isRest).toBe(true); // the rest
    expect(r.segments[2]!.isRest).toBe(false);
    // the third note starts on beat 3 (after note + rest = 960 ticks)
    expect(r.segments[2]!.startTickInMeasure).toBe(960);
  });

  it('a rest crossing a barline splits like a note (but stays a rest)', () => {
    // 3 quarters fill beats 1-3, then a half REST on beat 4 → spills into M2.
    const notes = [
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      note(DURATIONS.quarter),
      { kind: 'rest' as const, durationTicks: DURATIONS.half },
    ];
    const r = resolveTimeline(notes, FOUR_FOUR);
    const restSegs = r.segments.filter((s) => s.isRest);
    expect(restSegs).toHaveLength(2);
    expect(restSegs.every((s) => s.isRest)).toBe(true);
    expect(restSegs[0]!.measure).toBe(0);
    expect(restSegs[1]!.measure).toBe(1);
  });
});

describe('noteStartTick', () => {
  it('accumulates prior durations', () => {
    const notes = [
      note(DURATIONS.quarter),
      note(DURATIONS.eighth),
      note(DURATIONS.eighth),
    ];
    expect(noteStartTick(notes, 0)).toBe(0);
    expect(noteStartTick(notes, 1)).toBe(480);
    expect(noteStartTick(notes, 2)).toBe(720);
  });
});
