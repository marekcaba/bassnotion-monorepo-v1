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
