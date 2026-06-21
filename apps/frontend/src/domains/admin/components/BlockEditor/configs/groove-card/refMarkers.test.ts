import { describe, it, expect } from 'vitest';
import { sortMarkers, toOnsets, toAnalysis, fromAnalysis } from './refMarkers';
import type { RefMarker } from './ReferenceTransientEditor';

let _id = 0;
const nextId = () => ++_id;
const mk = (timeSec: number, ann: Partial<RefMarker> = {}): RefMarker => ({
  id: nextId(),
  timeSec,
  ...ann,
});

describe('refMarkers — annotations never desync from their marker (the Step-2 fix)', () => {
  it('DRAG-reorder: a label rides its marker across the re-sort', () => {
    // marker at 0.2 labelled "A string"; drag it PAST the 0.5 marker (now at 0.7).
    const a = mk(0.2, { string: 3, fret: 0 }); // open A
    const b = mk(0.5, { string: 4, fret: 3 }); // E string, fret 3
    // drag a to 0.7 (mutate its time; object keeps its annotation)
    const dragged = [{ ...a, timeSec: 0.7 }, b];
    const sorted = sortMarkers(dragged);
    // order is now [b@0.5, a@0.7] — but a STILL carries string 3, b still string 4
    expect(sorted[0]!.timeSec).toBe(0.5);
    expect(sorted[0]!.string).toBe(4); // b's label intact
    expect(sorted[1]!.timeSec).toBe(0.7);
    expect(sorted[1]!.string).toBe(3); // a's label rode along — NOT swapped
  });

  it('DELETE a middle marker: later labels stay on their own notes (no off-by-one)', () => {
    const markers = [
      mk(0.1, { string: 4, fret: 0 }),
      mk(0.2, { string: 3, fret: 0 }), // ← delete this
      mk(0.3, { string: 2, fret: 5, role: 'ghost' }),
    ];
    const afterDelete = markers.filter((_, i) => i !== 1);
    const sorted = sortMarkers(afterDelete);
    expect(sorted).toHaveLength(2);
    expect(sorted[0]!.string).toBe(4);
    // the 0.3 marker keeps ITS label (string 2, ghost) — not shifted onto 0.1's slot
    expect(sorted[1]!.timeSec).toBe(0.3);
    expect(sorted[1]!.string).toBe(2);
    expect(sorted[1]!.role).toBe('ghost');
  });

  it('ADD a marker in the middle: existing labels unaffected', () => {
    const markers = [
      mk(0.1, { string: 4 }),
      mk(0.5, { string: 3, role: 'accent' }),
    ];
    const added = [...markers, mk(0.3)]; // new unannotated marker between them
    const sorted = sortMarkers(added);
    expect(sorted.map((m) => m.timeSec)).toEqual([0.1, 0.3, 0.5]);
    expect(sorted[0]!.string).toBe(4);
    expect(sorted[1]!.string).toBeUndefined(); // the new one, unannotated
    expect(sorted[2]!.string).toBe(3); // the 0.5 marker's label intact
    expect(sorted[2]!.role).toBe('accent');
  });

  it('toOnsets emits sorted times (what the editor saves this step)', () => {
    expect(toOnsets([mk(0.5), mk(0.1), mk(0.3)])).toEqual([0.1, 0.3, 0.5]);
  });
});

describe('refMarkers — toAnalysis / fromAnalysis round-trip preserves alignment', () => {
  it('zips to full-length parallel arrays index-aligned to onsetsSec', () => {
    const a = toAnalysis(
      [
        mk(0.5, { string: 3, fret: 5, pluckStyle: 'slap_thumb', role: 'accent' }),
        mk(0.2, { string: 4, fret: 0, connectionFromPrev: null }),
      ],
      '4',
    );
    // sorted by time → 0.2 first
    expect(a.onsetsSec).toEqual([0.2, 0.5]);
    expect(a.stringNumbers).toEqual([4, 3]);
    expect(a.frets).toEqual([0, 5]);
    expect(a.pluckStyles).toEqual([null, 'slap_thumb']);
    expect(a.roles).toEqual([null, 'accent']);
    expect(a.bassType).toBe('4');
  });

  it('round-trips: markers → analysis → markers preserves every label by position', () => {
    _id = 0;
    const original = [
      mk(0.2, { string: 4, fret: 3, role: 'normal' }),
      mk(0.5, { string: 3, fret: 0, pluckStyle: 'pick', connectionFromPrev: 'hammer_on' }),
    ];
    const analysis = toAnalysis(original, '4');
    const back = fromAnalysis(analysis, nextId);
    expect(back[0]!.string).toBe(4);
    expect(back[0]!.fret).toBe(3);
    expect(back[1]!.string).toBe(3);
    expect(back[1]!.pluckStyle).toBe('pick');
    expect(back[1]!.connectionFromPrev).toBe('hammer_on');
  });

  it('fromAnalysis tolerates a legacy blob with ONLY onsetsSec (defaults null)', () => {
    const back = fromAnalysis({ onsetsSec: [0.1, 0.2] }, nextId);
    expect(back).toHaveLength(2);
    expect(back[0]!.string).toBeNull();
    expect(back[0]!.techniques).toEqual([]);
  });
});
