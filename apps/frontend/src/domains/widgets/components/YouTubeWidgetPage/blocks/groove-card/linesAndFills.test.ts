import { describe, it, expect } from 'vitest';
import type { BasslineVariant } from '@bassnotion/contracts';
import {
  DEFAULT_LINE_ID,
  NO_FILL_ID,
  buildLinesAndFillsGroups,
  resolveComboVariantId,
  selectionForVariantId,
} from './linesAndFills';

const v = (
  id: string,
  title: string,
  lineId?: string,
  fillId?: string,
): BasslineVariant => ({ id, title, url: `path/${id}.ogg`, lineId, fillId });

describe('buildLinesAndFillsGroups', () => {
  it('always offers built-in Bass A, even with no variants', () => {
    const g = buildLinesAndFillsGroups([]);
    expect(g).toEqual([{ id: DEFAULT_LINE_ID, label: 'Bass A', fills: [] }]);
  });

  it('BACKWARD-COMPAT: untagged legacy variants each become their own line', () => {
    const g = buildLinesAndFillsGroups([v('x', 'Walking'), v('y', 'Slap')]);
    expect(g.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'x', 'y']);
    expect(g.map((l) => l.label)).toEqual(['Bass A', 'Walking', 'Slap']);
    expect(g.every((l) => l.fills.length === 0)).toBe(true);
  });

  it('groups each line with ITS OWN fills (fills never cross lines)', () => {
    const g = buildLinesAndFillsGroups([
      v('b0', 'Bass B', 'B'),
      v('b1', 'B + Fill 1', 'B', 'b-fill1'),
      v('b2', 'B + Fill 2', 'B', 'b-fill2'),
      v('c0', 'Bass C', 'C'),
      v('c1', 'C + Fill 1', 'C', 'c-fill1'),
    ]);
    expect(g.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'B', 'C']);
    const B = g.find((l) => l.id === 'B')!;
    const C = g.find((l) => l.id === 'C')!;
    expect(B.label).toBe('Bass B');
    expect(B.fills.map((f) => f.id)).toEqual(['b-fill1', 'b-fill2']);
    expect(C.fills.map((f) => f.id)).toEqual(['c-fill1']); // C's own fills only
  });

  it("Bass A's own fills attach to the built-in line (fillId, no lineId)", () => {
    const g = buildLinesAndFillsGroups([
      v('a1', 'A Turnaround', undefined, 'a-fill1'),
    ]);
    expect(g.map((l) => l.id)).toEqual([DEFAULT_LINE_ID]); // no phantom line
    // the built-in line keeps the "Bass A" label — a fill's title must NOT
    // become the line label (regression caught via the admin→player harness).
    expect(g[0].label).toBe('Bass A');
    expect(g[0].fills.map((f) => f.id)).toEqual(['a-fill1']);
  });
});

describe('resolveComboVariantId', () => {
  const variants = [
    v('b0', 'Bass B', 'B'),
    v('b1', 'B + Fill 1', 'B', 'b-fill1'),
    v('a1', 'A Turnaround', undefined, 'a-fill1'),
  ];

  it('built-in Bass A + no fill → null (restore stems.bass)', () => {
    expect(
      resolveComboVariantId(variants, DEFAULT_LINE_ID, NO_FILL_ID),
    ).toBeNull();
  });

  it("Bass A + A's fill resolves to the fillId-only take", () => {
    expect(resolveComboVariantId(variants, DEFAULT_LINE_ID, 'a-fill1')).toBe(
      'a1',
    );
  });

  it('an exact (line, fill) combo resolves to its variant id', () => {
    expect(resolveComboVariantId(variants, 'B', 'b-fill1')).toBe('b1');
    expect(resolveComboVariantId(variants, 'B', NO_FILL_ID)).toBe('b0');
  });

  it("a fill that doesn't belong to the line resolves to undefined", () => {
    // B has no a-fill1 take (fills don't cross lines).
    expect(resolveComboVariantId(variants, 'B', 'a-fill1')).toBeUndefined();
  });
});

describe('selectionForVariantId', () => {
  const variants = [v('b1', 'B + Fill 1', 'B', 'b-fill1'), v('b0', 'Bass B', 'B')];

  it('null (built-in bass) maps to (Bass A, none)', () => {
    expect(selectionForVariantId(variants, null)).toEqual({
      lineId: DEFAULT_LINE_ID,
      fillId: NO_FILL_ID,
    });
  });

  it('a variant id maps back to its (line, fill)', () => {
    expect(selectionForVariantId(variants, 'b1')).toEqual({
      lineId: 'B',
      fillId: 'b-fill1',
    });
    expect(selectionForVariantId(variants, 'b0')).toEqual({
      lineId: 'B',
      fillId: NO_FILL_ID,
    });
  });

  it('round-trips: resolve(selection(id)) === id', () => {
    for (const variant of variants) {
      const sel = selectionForVariantId(variants, variant.id);
      expect(resolveComboVariantId(variants, sel.lineId, sel.fillId)).toBe(
        variant.id,
      );
    }
  });
});
