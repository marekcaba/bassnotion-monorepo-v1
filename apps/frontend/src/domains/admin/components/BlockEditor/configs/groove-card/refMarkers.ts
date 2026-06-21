/**
 * refMarkers — pure marker-list operations for ReferenceTransientEditor, extracted so the
 * desync-safety can be UNIT-TESTED without rendering the canvas component.
 *
 * THE INVARIANT these guarantee: a marker's authored annotation (string/fret/technique/
 * role/connection) NEVER separates from its marker across an edit. Because the editor
 * re-sorts markers by time on every add/delete/drag, a flat parallel-array model would
 * scramble labels the instant the sort permutes indices. Keeping each marker as an OBJECT
 * and sorting OBJECTS makes the annotation ride the sort atomically.
 */

import type { ReferenceAnalysis } from '@bassnotion/contracts';
import type { RefMarker } from './ReferenceTransientEditor';

/** Sort markers ascending by time. Each object carries its own annotations, so the sort
 *  can never desync a label from its marker. */
export function sortMarkers(markers: RefMarker[]): RefMarker[] {
  return [...markers].sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * REORDER GUARD: after a sort, flag any marker whose `connectionFromPrev` now points at a
 * DIFFERENT previous marker than it did before (a drag moved a marker between a legato
 * pair, or moved one of the pair). A hammer-on/pull-off is a relationship between two
 * SPECIFIC notes; the object-rides-the-sort guarantee does NOT cover that 2-marker link.
 * We flag `connectionStale` (loud, re-checkable) rather than auto-relink onto the wrong
 * notes. `prev` = the list BEFORE the edit (by id → predecessor id), `next` = after.
 * A marker whose predecessor id is unchanged keeps its (clean) connection.
 */
export function flagStaleConnections(
  prev: RefMarker[],
  next: RefMarker[],
): RefMarker[] {
  const prevSorted = sortMarkers(prev);
  const prevPredOf = new Map<number, number | null>();
  prevSorted.forEach((m, i) => {
    prevPredOf.set(m.id, i > 0 ? prevSorted[i - 1]!.id : null);
  });
  const nextSorted = sortMarkers(next);
  return nextSorted.map((m, i) => {
    if (!m.connectionFromPrev) {
      // no connection → nothing to flag; also clear any stale flag.
      return m.connectionStale ? { ...m, connectionStale: false } : m;
    }
    const nextPredId = i > 0 ? nextSorted[i - 1]!.id : null;
    const hadPredId = prevPredOf.has(m.id) ? prevPredOf.get(m.id)! : null;
    // predecessor changed (or this marker is now first, with no previous note)
    const changed = nextPredId !== hadPredId || nextPredId === null;
    if (changed && !m.connectionStale) return { ...m, connectionStale: true };
    return m;
  });
}

/** The onset times only (what the editor emits this step). */
export function toOnsets(markers: RefMarker[]): number[] {
  return sortMarkers(markers).map((m) => m.timeSec);
}

/**
 * Zip sorted markers → ReferenceAnalysis parallel arrays at the SAVE boundary. Full-length
 * arrays, index-aligned to onsetsSec; null/empty for unannotated fields. (Used in a later
 * step when the editor emits the full analysis; included now so the round-trip is tested.)
 */
export function toAnalysis(
  markers: RefMarker[],
  bassType: '4' | '5' | '6' = '4',
): Required<
  Pick<
    ReferenceAnalysis,
    | 'onsetsSec'
    | 'bassType'
    | 'stringNumbers'
    | 'frets'
    | 'pluckStyles'
    | 'techniques'
    | 'roles'
    | 'connectionsFromPrev'
  >
> {
  const ms = sortMarkers(markers);
  return {
    onsetsSec: ms.map((m) => m.timeSec),
    bassType,
    stringNumbers: ms.map((m) => m.string ?? null),
    frets: ms.map((m) => m.fret ?? null),
    pluckStyles: ms.map((m) => m.pluckStyle ?? null),
    techniques: ms.map((m) => m.techniques ?? []),
    roles: ms.map((m) => m.role ?? null),
    connectionsFromPrev: ms.map((m) => m.connectionFromPrev ?? null),
  };
}

/**
 * Unzip a stored ReferenceAnalysis → RefMarker[] on load, assigning fresh editor-local
 * ids. Length-asserts each parallel array against onsetsSec (pads/truncates with a
 * default rather than silently misaligning). `nextId` supplies stable ids.
 */
export function fromAnalysis(
  value: Partial<ReferenceAnalysis> | undefined,
  nextId: () => number,
): RefMarker[] {
  const onsets = value?.onsetsSec ?? [];
  const at = <T>(arr: readonly T[] | undefined, i: number): T | undefined =>
    arr && i < arr.length ? arr[i] : undefined;
  return onsets.map((t, i) => ({
    id: nextId(),
    timeSec: t,
    string: at(value?.stringNumbers, i) ?? null,
    fret: at(value?.frets, i) ?? null,
    pluckStyle: at(value?.pluckStyles, i) ?? null,
    techniques: at(value?.techniques, i) ?? [],
    role: at(value?.roles, i) ?? null,
    connectionFromPrev: at(value?.connectionsFromPrev, i) ?? null,
  }));
}
