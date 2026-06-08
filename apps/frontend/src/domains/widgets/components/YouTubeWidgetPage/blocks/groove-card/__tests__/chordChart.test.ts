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
} from '../chordChart.js';

// Example from the spec: A7 from bar 1, G7 from bar 2 beat 3 (slot 4).
const CHART: ChordChart = [
  { bar: 2, slot: 4, symbol: 'G7' }, // intentionally out of order
  { bar: 1, slot: 0, symbol: 'A7' },
];

describe('sortedChart', () => {
  it('sorts by absolute position and drops empty/invalid entries', () => {
    const messy: ChordChart = [
      { bar: 3, slot: 0, symbol: 'C7' },
      { bar: 1, slot: 0, symbol: 'A7' },
      { bar: 2, slot: 4, symbol: '   ' }, // blank → dropped
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
    expect(chordAt(CHART, 1, 7)).toBe('A7'); // bar 1 last eighth — still A7
    expect(chordAt(CHART, 2, 0)).toBe('A7'); // bar 2 beat 1 — no change yet
    expect(chordAt(CHART, 2, 3)).toBe('A7'); // bar 2 beat 2-and — still A7
    expect(chordAt(CHART, 2, 4)).toBe('G7'); // bar 2 beat 3 — G7 lands
    expect(chordAt(CHART, 2, 7)).toBe('G7'); // bar 2 end — still G7
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
  const BARS = 4; // 32 slots total

  it('maps the loop start to bar 1 slot 0', () => {
    expect(phaseToPosition(0, BARS)).toEqual({ bar: 1, slot: 0 });
  });

  it('maps mid-loop phases to the right bar/slot', () => {
    // phase 0.25 → 8 slots in → bar 2 slot 0
    expect(phaseToPosition(0.25, BARS)).toEqual({ bar: 2, slot: 0 });
    // bar 2 beat 3 = absolute slot 12 = phase 12/32 = 0.375
    expect(phaseToPosition(0.375, BARS)).toEqual({ bar: 2, slot: 4 });
    // just before the end → bar 4 slot 7
    expect(phaseToPosition(0.999, BARS)).toEqual({ bar: 4, slot: 7 });
  });

  it('clamps phase into [0,1)', () => {
    expect(phaseToPosition(-0.5, BARS)).toEqual({ bar: 1, slot: 0 });
    expect(phaseToPosition(1.5, BARS)).toEqual({ bar: 4, slot: 7 });
  });
});

describe('phaseToPosition — sub-loop (selected bars)', () => {
  it('offsets bars onto the absolute groove when a sub-range loops', () => {
    // A 2-bar selection (bars 3-4): phase spans those 2 bars, barOffset = 2.
    expect(phaseToPosition(0, 2, 2)).toEqual({ bar: 3, slot: 0 });
    expect(phaseToPosition(0.5, 2, 2)).toEqual({ bar: 4, slot: 0 });
    expect(phaseToPosition(0.999, 2, 2)).toEqual({ bar: 4, slot: 7 });
  });

  it('chordAt resolves the right chord for the offset bar', () => {
    // With CHART, a sub-loop on bars 1-2: phase 0.5 → bar 2 slot 0 → A7 still.
    const pos = phaseToPosition(0.5, 2, 0);
    expect(chordAt(CHART, pos.bar, pos.slot)).toBe('A7');
    // phase ~0.75 → bar 2 slot 4 → G7.
    const pos2 = phaseToPosition(0.75, 2, 0);
    expect(chordAt(CHART, pos2.bar, pos2.slot)).toBe('G7');
  });
});

describe('chartCellMap', () => {
  it('maps each authored cell to its symbol (sparse, no inheritance)', () => {
    const m = chartCellMap(CHART);
    expect(m.get('1:0')).toBe('A7');
    expect(m.get('2:4')).toBe('G7');
    expect(m.get('2:0')).toBeUndefined(); // not authored (inherits, but not a cell)
  });
});
