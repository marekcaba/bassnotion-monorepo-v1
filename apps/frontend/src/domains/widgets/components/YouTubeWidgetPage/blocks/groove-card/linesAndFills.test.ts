import { describe, it, expect } from 'vitest';
import type { BasslineVariant } from '@bassnotion/contracts';
import {
  DEFAULT_LINE_ID,
  NO_FILL_ID,
  buildLinesAndFillsModel,
  resolveComboVariantId,
  selectionForVariantId,
} from './linesAndFills';

const v = (
  id: string,
  title: string,
  lineId?: string,
  fillId?: string,
): BasslineVariant => ({ id, title, url: `path/${id}.ogg`, lineId, fillId });

describe('buildLinesAndFillsModel', () => {
  it('returns just the Default line and no Fills row for an empty list', () => {
    const m = buildLinesAndFillsModel([]);
    expect(m.lines).toEqual([{ id: DEFAULT_LINE_ID, label: 'Default' }]);
    expect(m.fills).toEqual([]);
  });

  it('a line-only groove (no fills) yields Lines but no Fills row', () => {
    const m = buildLinesAndFillsModel([
      v('a', 'Walking', 'A'),
      v('b', 'Slap', 'B'),
    ]);
    expect(m.lines.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'A', 'B']);
    expect(m.lines.map((l) => l.label)).toEqual(['Default', 'Walking', 'Slap']);
    expect(m.fills).toEqual([]); // no fills at all → row hidden
  });

  it('BACKWARD-COMPAT: untagged legacy variants each become their own Line', () => {
    // The pre-Fills authoring style — variants with NO lineId/fillId. Each must
    // remain its own swap cell (keyed by id), not collapse into one Default line.
    const m = buildLinesAndFillsModel([v('x', 'Walking'), v('y', 'Slap')]);
    expect(m.lines.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'x', 'y']);
    expect(m.lines.map((l) => l.label)).toEqual(['Default', 'Walking', 'Slap']);
    expect(m.fills).toEqual([]);
  });

  it('surfaces fills with None first and labels from the matching take', () => {
    const m = buildLinesAndFillsModel([
      v('b0', 'Bassline B', 'B'), // B + none
      v('b1', 'B + Fill 1', 'B', 'fill1'),
      v('b3', 'B + Fill 3', 'B', 'fill3'),
    ]);
    expect(m.lines.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'B']);
    expect(m.fills.map((f) => f.id)).toEqual([NO_FILL_ID, 'fill1', 'fill3']);
    expect(m.fills.map((f) => f.label)).toEqual([
      'None',
      'B + Fill 1',
      'B + Fill 3',
    ]);
  });

  it('merges takes that share an explicit lineId into ONE line carrying fills', () => {
    // Two lines (A, B), each with the same two fills → 3 line cells (incl.
    // Default) and 3 fill cells (incl. None); the grid is the cartesian combo.
    const m = buildLinesAndFillsModel([
      v('a0', 'Bassline A', 'A'),
      v('a1', 'A + Fill 1', 'A', 'fill1'),
      v('b0', 'Bassline B', 'B'),
      v('b1', 'B + Fill 1', 'B', 'fill1'),
      v('b2', 'B + Fill 2', 'B', 'fill2'),
    ]);
    expect(m.lines.map((l) => l.id)).toEqual([DEFAULT_LINE_ID, 'A', 'B']);
    expect(m.lines.map((l) => l.label)).toEqual([
      'Default',
      'Bassline A',
      'Bassline B',
    ]);
    expect(m.fills.map((f) => f.id)).toEqual([NO_FILL_ID, 'fill1', 'fill2']);
  });
});

describe('resolveComboVariantId', () => {
  const variants = [
    v('b0', 'Bassline B', 'B'),
    v('b1', 'B + Fill 1', 'B', 'fill1'),
    v('a0', 'Bassline A', 'A'),
  ];

  it('default line + no fill resolves to null (built-in bass)', () => {
    expect(resolveComboVariantId(variants, DEFAULT_LINE_ID, NO_FILL_ID)).toBeNull();
  });

  it('an exact (line, fill) combo resolves to its variant id', () => {
    expect(resolveComboVariantId(variants, 'B', 'fill1')).toBe('b1');
    expect(resolveComboVariantId(variants, 'B', NO_FILL_ID)).toBe('b0');
    expect(resolveComboVariantId(variants, 'A', NO_FILL_ID)).toBe('a0');
  });

  it('an unexported combo resolves to undefined (caller no-ops)', () => {
    // A has no fill1 take.
    expect(resolveComboVariantId(variants, 'A', 'fill1')).toBeUndefined();
  });
});

describe('selectionForVariantId', () => {
  const variants = [v('b1', 'B + Fill 1', 'B', 'fill1'), v('a0', 'A', 'A')];

  it('null (default bass) maps to (default, none)', () => {
    expect(selectionForVariantId(variants, null)).toEqual({
      lineId: DEFAULT_LINE_ID,
      fillId: NO_FILL_ID,
    });
  });

  it('a variant id maps back to its (line, fill)', () => {
    expect(selectionForVariantId(variants, 'b1')).toEqual({
      lineId: 'B',
      fillId: 'fill1',
    });
    expect(selectionForVariantId(variants, 'a0')).toEqual({
      lineId: 'A',
      fillId: NO_FILL_ID,
    });
  });

  it('an unknown id falls back to (default, none)', () => {
    expect(selectionForVariantId(variants, 'ghost')).toEqual({
      lineId: DEFAULT_LINE_ID,
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
