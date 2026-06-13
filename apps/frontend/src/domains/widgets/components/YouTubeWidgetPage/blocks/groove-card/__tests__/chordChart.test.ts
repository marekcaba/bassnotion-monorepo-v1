/**
 * Unit tests for the chord-chart helpers — sparse lookup + phase→position.
 */
import { describe, expect, it } from 'vitest';
import type { ChordChart } from '@bassnotion/contracts';
import {
  chordAt,
  phaseToPosition,
  sortedChart,
  chartCellMap,
  barRender,
  declutterChordX,
} from '../chordChart.js';

// Example from the spec: A7 from bar 1, G7 from bar 2 beat 3. The grid is 16
// sixteenth-slots per bar, so beat 3 = slot 8 (each beat = 4 sixteenths).
const CHART: ChordChart = [
  { bar: 2, slot: 8, symbol: 'G7' }, // intentionally out of order; beat 3
  { bar: 1, slot: 0, symbol: 'A7' },
];

describe('sortedChart', () => {
  it('sorts by absolute position and drops empty/invalid entries', () => {
    const messy: ChordChart = [
      { bar: 3, slot: 0, symbol: 'C7' },
      { bar: 1, slot: 0, symbol: 'A7' },
      { bar: 2, slot: 8, symbol: '   ' }, // blank → dropped
      { bar: 2, slot: 0, symbol: 'D7' },
    ];
    expect(sortedChart(messy).map((e) => e.symbol)).toEqual(['A7', 'D7', 'C7']);
  });

  it('returns [] for undefined/empty', () => {
    expect(sortedChart(undefined)).toEqual([]);
    expect(sortedChart([])).toEqual([]);
  });
});

describe('chordAt — sparse inheritance (chord holds until next change)', () => {
  it('A7 holds from bar 1 through bar 2 beat 2, then G7 from bar 2 beat 3', () => {
    expect(chordAt(CHART, 1, 0)).toBe('A7'); // bar 1 beat 1
    expect(chordAt(CHART, 1, 15)).toBe('A7'); // bar 1 last sixteenth — still A7
    expect(chordAt(CHART, 2, 0)).toBe('A7'); // bar 2 beat 1 — no change yet
    expect(chordAt(CHART, 2, 7)).toBe('A7'); // bar 2 beat 2-a — still A7
    expect(chordAt(CHART, 2, 8)).toBe('G7'); // bar 2 beat 3 — G7 lands
    expect(chordAt(CHART, 2, 15)).toBe('G7'); // bar 2 end — still G7
  });

  it('returns null before the first charted chord', () => {
    const late: ChordChart = [{ bar: 2, slot: 0, symbol: 'G7' }];
    expect(chordAt(late, 1, 0)).toBeNull(); // nothing charted yet in bar 1
    expect(chordAt(late, 2, 0)).toBe('G7');
  });

  it('returns null for an empty chart', () => {
    expect(chordAt([], 1, 0)).toBeNull();
    expect(chordAt(undefined, 1, 0)).toBeNull();
  });
});

describe('phaseToPosition — full groove (4 bars)', () => {
  const BARS = 4; // 64 slots total (16 per bar)

  it('maps the loop start to bar 1 slot 0', () => {
    expect(phaseToPosition(0, BARS)).toEqual({ bar: 1, slot: 0 });
  });

  it('maps mid-loop phases to the right bar/slot', () => {
    // phase 0.25 → 16 slots in → bar 2 slot 0
    expect(phaseToPosition(0.25, BARS)).toEqual({ bar: 2, slot: 0 });
    // bar 2 beat 3 = absolute slot 24 = phase 24/64 = 0.375
    expect(phaseToPosition(0.375, BARS)).toEqual({ bar: 2, slot: 8 });
    // just before the end → bar 4 slot 15
    expect(phaseToPosition(0.999, BARS)).toEqual({ bar: 4, slot: 15 });
  });

  it('clamps phase into [0,1)', () => {
    expect(phaseToPosition(-0.5, BARS)).toEqual({ bar: 1, slot: 0 });
    expect(phaseToPosition(1.5, BARS)).toEqual({ bar: 4, slot: 15 });
  });
});

describe('phaseToPosition — sub-loop (selected bars)', () => {
  it('offsets bars onto the absolute groove when a sub-range loops', () => {
    // A 2-bar selection (bars 3-4): phase spans those 2 bars, barOffset = 2.
    expect(phaseToPosition(0, 2, 2)).toEqual({ bar: 3, slot: 0 });
    expect(phaseToPosition(0.5, 2, 2)).toEqual({ bar: 4, slot: 0 });
    expect(phaseToPosition(0.999, 2, 2)).toEqual({ bar: 4, slot: 15 });
  });

  it('chordAt resolves the right chord for the offset bar', () => {
    // With CHART, a sub-loop on bars 1-2: phase 0.5 → bar 2 slot 0 → A7 still.
    const pos = phaseToPosition(0.5, 2, 0);
    expect(chordAt(CHART, pos.bar, pos.slot)).toBe('A7');
    // phase ~0.75 → bar 2 beat 3 (slot 8) → G7.
    const pos2 = phaseToPosition(0.75, 2, 0);
    expect(chordAt(CHART, pos2.bar, pos2.slot)).toBe('G7');
  });
});

describe('chartCellMap', () => {
  it('maps each authored cell to its symbol (sparse, no inheritance)', () => {
    const m = chartCellMap(CHART);
    expect(m.get('1:0')).toBe('A7');
    expect(m.get('2:8')).toBe('G7');
    expect(m.get('2:0')).toBeUndefined(); // not authored (inherits, but not a cell)
  });
});

describe('barRender — what the ribbon paints per bar', () => {
  it('a single change is reported at its true slot', () => {
    // CHART: A7 on bar 1 downbeat.
    expect(barRender(CHART, 1)).toEqual({
      kind: 'chords',
      changes: [{ slot: 0, symbol: 'A7' }],
    });
  });

  it('a change mid-bar shows at its slot; the bar is a chords bar', () => {
    // Bar 2: G7 at slot 8 (beat 3). A7 rings in but the bar HAS a change.
    expect(barRender(CHART, 2)).toEqual({
      kind: 'chords',
      changes: [{ slot: 8, symbol: 'G7' }],
    });
  });

  it('TWO chords in the second half (beats 3 and 4) BOTH appear at their slots', () => {
    const chart: ChordChart = [
      { bar: 1, slot: 0, symbol: 'Cmaj7' }, // beat 1
      { bar: 1, slot: 8, symbol: 'A7' }, // beat 3
      { bar: 1, slot: 12, symbol: 'Dm7' }, // beat 4
    ];
    expect(barRender(chart, 1)).toEqual({
      kind: 'chords',
      changes: [
        { slot: 0, symbol: 'Cmaj7' },
        { slot: 8, symbol: 'A7' },
        { slot: 12, symbol: 'Dm7' },
      ],
    });
  });

  it('TWO chords in the SAME beat (off-sixteenths) BOTH appear — no snapping/dropping', () => {
    // The reported case: a chord on the 2nd sixteenth of a beat must survive,
    // distinct from the chord on the beat's downbeat.
    const chart: ChordChart = [
      { bar: 1, slot: 0, symbol: 'C' }, // beat 1, sixteenth 1 (downbeat)
      { bar: 1, slot: 1, symbol: 'Eb' }, // beat 1, sixteenth 2 (the "e")
      { bar: 1, slot: 9, symbol: 'F' }, // beat 3, sixteenth 2 (off the beat)
    ];
    expect(barRender(chart, 1)).toEqual({
      kind: 'chords',
      changes: [
        { slot: 0, symbol: 'C' },
        { slot: 1, symbol: 'Eb' }, // NOT collapsed into slot 0
        { slot: 9, symbol: 'F' }, // sits just right of beat 3
      ],
    });
  });

  it('a fully sustained bar renders a REPEAT (simile) mark', () => {
    const chart: ChordChart = [
      { bar: 1, slot: 0, symbol: 'Cmaj7' },
      { bar: 3, slot: 0, symbol: 'Am7' },
    ];
    // Bar 2 holds Cmaj7 with no change of its own → repeat mark.
    expect(barRender(chart, 2)).toEqual({ kind: 'repeat' });
  });

  it('ANTICIPATION: chord struck late in bar N, empty bar N+1 → N+1 is a repeat', () => {
    // Cmaj7 on bar 1 beat 1, A7 anticipated on the "and of 4" (slot 14). Bar 2
    // has no chord → it's the SAME A7 ringing on, so bar 2 = repeat mark, not a
    // second A7 to switch to.
    const chart: ChordChart = [
      { bar: 1, slot: 0, symbol: 'Cmaj7' },
      { bar: 1, slot: 14, symbol: 'A7' }, // anticipation, "and of 4" (16-grid)
    ];
    expect(barRender(chart, 1)).toEqual({
      kind: 'chords',
      changes: [
        { slot: 0, symbol: 'Cmaj7' },
        { slot: 14, symbol: 'A7' }, // struck bright at its true slot
      ],
    });
    expect(barRender(chart, 2)).toEqual({ kind: 'repeat' }); // same A7, repeat
  });

  it('a bar before any charted chord is EMPTY (no repeat, nothing sounding yet)', () => {
    const late: ChordChart = [{ bar: 2, slot: 0, symbol: 'G7' }];
    expect(barRender(late, 1)).toEqual({ kind: 'empty' });
    expect(barRender(late, 2)).toEqual({
      kind: 'chords',
      changes: [{ slot: 0, symbol: 'G7' }],
    });
  });

  it('empty / undefined chart → empty bar', () => {
    expect(barRender([], 1)).toEqual({ kind: 'empty' });
    expect(barRender(undefined, 1)).toEqual({ kind: 'empty' });
  });
});

describe('declutterChordX — keeps crowded chords readable', () => {
  it('leaves well-spaced chords on their natural x', () => {
    // Two chords 100px apart, each 30px wide, min gap 8 → no collision.
    expect(
      declutterChordX(
        [
          { naturalX: 0, width: 30 },
          { naturalX: 100, width: 30 },
        ],
        8,
      ),
    ).toEqual([0, 100]);
  });

  it('pushes a too-close chord right by the minimum gap; first stays put', () => {
    // Chord A at x=0 (width 30); chord B wants x=10 but A's right edge + gap is
    // 0+30+8 = 38, so B is pushed to 38.
    expect(
      declutterChordX(
        [
          { naturalX: 0, width: 30 },
          { naturalX: 10, width: 30 },
        ],
        8,
      ),
    ).toEqual([0, 38]);
  });

  it('cascades the push across a dense cluster', () => {
    // Three chords all near x=0, width 20, gap 5 → 0, 25, 50.
    expect(
      declutterChordX(
        [
          { naturalX: 0, width: 20 },
          { naturalX: 5, width: 20 },
          { naturalX: 10, width: 20 },
        ],
        5,
      ),
    ).toEqual([0, 25, 50]);
  });

  it('a later well-spaced chord is not dragged by an earlier push', () => {
    // A,B crowd at the start; C is far enough that it keeps its natural x.
    expect(
      declutterChordX(
        [
          { naturalX: 0, width: 20 },
          { naturalX: 5, width: 20 },
          { naturalX: 200, width: 20 },
        ],
        5,
      ),
    ).toEqual([0, 25, 200]);
  });

  it('handles empty input', () => {
    expect(declutterChordX([], 8)).toEqual([]);
  });
});
