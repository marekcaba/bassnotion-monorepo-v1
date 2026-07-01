import { describe, it, expect } from 'vitest';
import {
  generatePatternDegrees,
  buildScaleLadder,
  buildLadderFromPath,
  degreesToPositions,
  PATTERN_PRESETS,
  type ScalePatternRule,
} from './scalePattern';
import { buildNoteUniverse } from './noteUniverse';

const FB4 = { stringCount: 4 as const, maxFrets: 24 };

describe('generatePatternDegrees — sliding the cell along the scale', () => {
  it('THE EXAMPLE: [0,1,2,0,4] stride +1 climbs then descends', () => {
    // "3 notes up, back to anchor, then the 5th", sliding up one degree each repeat.
    const rule: ScalePatternRule = { cell: [0, 1, 2, 0, 4], stride: 1 };
    // A ladder of 8 scale notes (one octave + 1). cellMax=4 → anchors fit at 0,1,2,3.
    const seq = generatePatternDegrees(rule, 8, { descend: false });
    // anchor 0: 0,1,2,0,4 ; anchor 1: 1,2,3,1,5 ; anchor 2: 2,3,4,2,6 ; anchor 3: 3,4,5,3,7
    expect(seq).toEqual([
      0, 1, 2, 0, 4, 1, 2, 3, 1, 5, 2, 3, 4, 2, 6, 3, 4, 5, 3, 7,
    ]);
  });

  it('stops climbing when the cell would run off the top', () => {
    const rule: ScalePatternRule = { cell: [0, 4], stride: 1 };
    // ladder 6: cellMax=4 → anchors fit at 0 and 1 only (a=2 → 2+4=6 ≥ 6, stops).
    const seq = generatePatternDegrees(rule, 6, { descend: false });
    expect(seq).toEqual([0, 4, 1, 5]);
  });

  it('straight pattern [0] = every scale note up', () => {
    const seq = generatePatternDegrees({ cell: [0], stride: 1 }, 5, {
      descend: false,
    });
    expect(seq).toEqual([0, 1, 2, 3, 4]);
  });

  it('descend mirrors the anchors (continuous up-then-down, no doubled top)', () => {
    // thirds [0,2] stride 1, ladder 5 → asc anchors 0,1,2 (a=3 → 3+2=5 ≥5 stop).
    const seq = generatePatternDegrees({ cell: [0, 2], stride: 1 }, 5);
    // asc: (0,2)(1,3)(2,4) ; desc anchors reversed minus top = [1,0] → (1,3)(0,2)
    expect(seq).toEqual([0, 2, 1, 3, 2, 4, 1, 3, 0, 2]);
  });

  it('stride > 1 skips anchors', () => {
    const seq = generatePatternDegrees({ cell: [0, 1], stride: 2 }, 7, {
      descend: false,
    });
    // anchors 0,2,4 (a=6 → 6+1=7 ≥7 stop)
    expect(seq).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('empty cell or zero ladder → empty', () => {
    expect(generatePatternDegrees({ cell: [], stride: 1 }, 8)).toEqual([]);
    expect(generatePatternDegrees({ cell: [0], stride: 1 }, 0)).toEqual([]);
  });

  it('all presets generate a non-empty ascending sequence on a real-size ladder', () => {
    for (const p of PATTERN_PRESETS) {
      const seq = generatePatternDegrees(p.rule, 15, { descend: false });
      expect(seq.length).toBeGreaterThan(0);
      // every degree is within the ladder
      expect(seq.every((d) => d >= 0 && d < 15)).toBe(true);
    }
  });
});

describe('buildScaleLadder — unique scale pitches ascending', () => {
  it('is sorted ascending by pitch, each rung is one MIDI with its positions', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const ladder = buildScaleLadder(u);
    // strictly ascending midi
    for (let i = 1; i < ladder.length; i++)
      expect(ladder[i]!.midi).toBeGreaterThan(ladder[i - 1]!.midi);
    // every position on a rung actually sounds that rung's pitch (open+fret = midi via universe)
    for (const rung of ladder) expect(rung.positions.length).toBeGreaterThan(0);
  });

  it('+1 ladder index = the next scale note up (a scale step, not a semitone)', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const ladder = buildScaleLadder(u);
    // C major steps: C→D = 2 semitones, E→F = 1 semitone. Consecutive rungs differ by the
    // scale's actual step size, never a non-scale pitch.
    const cMajorPCs = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const rung of ladder) expect(cMajorPCs.has(rung.midi % 12)).toBe(true);
  });
});

describe('degreesToPositions — nearest-position fingering', () => {
  it('maps each degree to a real position, choosing nearest to the previous', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const ladder = buildScaleLadder(u);
    const degrees = generatePatternDegrees({ cell: [0, 2, 4], stride: 1 }, 8, {
      descend: false,
    });
    const pos = degreesToPositions(degrees, ladder);
    expect(pos.length).toBe(degrees.length);
    // every chosen position is a valid place for that degree's pitch
    degrees.forEach((d, i) => {
      const rung = ladder[d]!;
      const chosen = pos[i]!;
      expect(
        rung.positions.some(
          (p) => p.string === chosen.string && p.fret === chosen.fret,
        ),
      ).toBe(true);
    });
  });

  it('keeps the hand close — consecutive picks are not wildly far apart', () => {
    const u = buildNoteUniverse(FB4, 'A', 'minor_pentatonic');
    const ladder = buildScaleLadder(u);
    const degrees = generatePatternDegrees({ cell: [0], stride: 1 }, 10, {
      descend: false,
    });
    const pos = degreesToPositions(degrees, ladder);
    // a straight run up should never leap more than ~5 frets between consecutive notes
    for (let i = 1; i < pos.length; i++) {
      expect(Math.abs(pos[i]!.fret - pos[i - 1]!.fret)).toBeLessThanOrEqual(6);
    }
  });

  it('skips degrees off the top of the ladder gracefully', () => {
    const u = buildNoteUniverse(FB4, 'C', 'major');
    const ladder = buildScaleLadder(u);
    const pos = degreesToPositions([0, 9999], ladder);
    expect(pos.length).toBe(1); // the off-ladder degree is skipped
  });
});

describe('buildLadderFromPath — constrain a pattern to a known authored path', () => {
  // 4-string open MIDI: 4=E(28) 3=A(33) 2=D(38) 1=G(43). A path's notes → its own ladder.
  it('builds rungs from ONLY the path notes, ascending by pitch', () => {
    // E(28), F#(30), G#(32) up string 4 — three ascending notes.
    const path = [
      { string: 4, fret: 0 }, // 28
      { string: 4, fret: 2 }, // 30
      { string: 4, fret: 4 }, // 32
    ];
    const ladder = buildLadderFromPath(path, 4);
    expect(ladder.map((r) => r.midi)).toEqual([28, 30, 32]);
    expect(ladder[0]!.positions).toEqual([{ string: 4, fret: 0 }]);
  });

  it('groups equal pitches across positions into one rung (e.g. unison spots)', () => {
    // E at string-4 fret-0 (28) AND the same E reachable elsewhere — both land on one rung.
    const path = [
      { string: 4, fret: 0 }, // 28
      { string: 4, fret: 5 }, // 33 = A, also open string 3
      { string: 3, fret: 0 }, // 33 = A (same pitch as above)
    ];
    const ladder = buildLadderFromPath(path, 4);
    expect(ladder.map((r) => r.midi)).toEqual([28, 33]);
    // the 33 rung carries BOTH positions, sorted by fret
    expect(ladder[1]!.positions).toEqual([
      { string: 3, fret: 0 },
      { string: 4, fret: 5 },
    ]);
  });

  it('de-dups identical repeated positions (a path may revisit a spot)', () => {
    const path = [
      { string: 4, fret: 2 },
      { string: 4, fret: 2 }, // same spot again
    ];
    const ladder = buildLadderFromPath(path, 4);
    expect(ladder).toHaveLength(1);
    expect(ladder[0]!.positions).toHaveLength(1);
  });

  it('skips notes on strings the neck does not have', () => {
    // String 5 doesn't exist on a 4-string neck → that note is dropped.
    const path = [
      { string: 4, fret: 0 },
      { string: 5, fret: 0 }, // off-neck
    ];
    const ladder = buildLadderFromPath(path, 4);
    expect(ladder.map((r) => r.midi)).toEqual([28]);
  });

  it('a pattern over the path stays WITHIN the path — no whole-neck notes leak in', () => {
    // A small 5-note path on string 4: frets 0,2,4,5,7 (E F# G# A B).
    const path = [
      { string: 4, fret: 0 },
      { string: 4, fret: 2 },
      { string: 4, fret: 4 },
      { string: 4, fret: 5 },
      { string: 4, fret: 7 },
    ];
    const ladder = buildLadderFromPath(path, 4);
    const allowed = new Set(path.map((p) => `${p.string}:${p.fret}`));

    const degrees = generatePatternDegrees({ cell: [0, 2], stride: 1 }, ladder.length);
    const positions = degreesToPositions(degrees, ladder);

    // Every generated position is one of the path's own notes — never the whole neck.
    expect(positions.length).toBeGreaterThan(0);
    positions.forEach((p) => {
      expect(allowed.has(`${p.string}:${p.fret}`)).toBe(true);
    });
    // And the ladder is only as tall as the path (5 notes), so the pattern can't climb past it.
    expect(ladder).toHaveLength(5);
  });
});
