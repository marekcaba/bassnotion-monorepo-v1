/**
 * scalePattern — the PATTERN engine: a small repeating RULE over scale degrees that
 * SLIDES along the scale to generate a full up-and-down exercise (e.g. "3 notes up, back
 * to the anchor, then the 5th — sliding up one scale degree each repeat").
 *
 * The output is a list of ABSOLUTE SCALE-DEGREE INDICES on a single ascending ladder of
 * the scale's pitches (0 = lowest scale note on the neck, 1 = next scale note up, …). A
 * later step maps each ladder index to a fretboard position (nearest-fingering). Keeping
 * this layer pitch-only (no string/fret) makes it pure + testable and key-independent.
 *
 * The rule is fully AUTHOR-CONFIGURABLE — `cell` and `stride` are data; presets are just
 * named (cell, stride) pairs that pre-fill the editor.
 */

import { OPEN_STRING_MIDI, type UniverseNote } from './noteUniverse';
import type { StringCount } from './scaleGenerator';

/** A repeating pattern cell + how far it advances each repeat. All in SCALE DEGREES. */
export interface ScalePatternRule {
  /** Offsets from the cell's anchor degree, in scale steps. e.g. [0, 1, 2, 0, 4] =
   *  anchor, +1, +2 (a 3-note run up), back to anchor, +4 (the fifth). */
  cell: number[];
  /** How many scale degrees the anchor advances for the next repeat (usually +1). */
  stride: number;
}

/** Named presets — common scale patterns, as (cell, stride). Pre-fill the editor; the
 *  admin can tweak any of them. */
export const PATTERN_PRESETS: {
  id: string;
  label: string;
  rule: ScalePatternRule;
}[] = [
  {
    id: 'straight',
    label: 'Straight (up/down)',
    rule: { cell: [0], stride: 1 },
  },
  { id: 'thirds', label: 'Thirds (1-3)', rule: { cell: [0, 2], stride: 1 } },
  { id: 'fourths', label: 'Fourths (1-4)', rule: { cell: [0, 3], stride: 1 } },
  {
    id: 'triads',
    label: 'Triads (1-3-5)',
    rule: { cell: [0, 2, 4], stride: 1 },
  },
  { id: '1235', label: '1-2-3-5', rule: { cell: [0, 1, 2, 4], stride: 1 } },
  {
    id: 'example',
    label: '3-up · back · 5th',
    rule: { cell: [0, 1, 2, 0, 4], stride: 1 },
  },
];

export interface GeneratePatternOptions {
  /** Highest anchor degree to start a cell from (caps how far up the scale it climbs).
   *  Defaults to the top of the ladder. */
  maxAnchor?: number;
  /** Walk back DOWN after reaching the top (the classic up-then-down practice). The
   *  descent mirrors the ascent's anchors in reverse (no doubled turn-around). Default true. */
  descend?: boolean;
}

/**
 * Generate the ordered ABSOLUTE-DEGREE sequence by sliding the cell along the scale.
 *
 * `ladderSize` = how many scale notes exist on the neck (the ladder length). The cell is
 * applied at anchor 0, then anchor `stride`, `2*stride`, … as long as every offset in the
 * cell lands within [0, ladderSize). Cells that would run off the top are skipped (the
 * pattern stops climbing when it can't fit). Then it descends by mirroring the anchors.
 */
export function generatePatternDegrees(
  rule: ScalePatternRule,
  ladderSize: number,
  options: GeneratePatternOptions = {},
): number[] {
  const { descend = true } = options;
  if (ladderSize <= 0 || rule.cell.length === 0) return [];
  const stride = rule.stride === 0 ? 1 : Math.abs(rule.stride);
  const maxAnchor = options.maxAnchor ?? ladderSize - 1;

  // The anchors where a full cell fits within the ladder, ascending.
  const cellMax = Math.max(...rule.cell);
  const cellMin = Math.min(...rule.cell);
  const ascAnchors: number[] = [];
  for (let a = 0; a + cellMax < ladderSize && a <= maxAnchor; a += stride) {
    if (a + cellMin >= 0) ascAnchors.push(a);
  }

  const emit = (anchors: number[]): number[] =>
    anchors.flatMap((a) => rule.cell.map((off) => a + off));

  const ascending = emit(ascAnchors);
  if (!descend || ascAnchors.length <= 1) return ascending;

  // Descend: mirror the anchors in reverse, excluding the top anchor (already played as
  // the turn-around) so the run reads continuously up then down.
  const descAnchors = [...ascAnchors].reverse().slice(1);
  return [...ascending, ...emit(descAnchors)];
}

// ── Degrees → fretboard positions (the seed fingering) ─────────────────────────────────

/** A position on the neck. */
export interface FretPos {
  string: number;
  fret: number;
}

/** One rung of the scale-pitch LADDER: a unique scale pitch + every place it's playable. */
export interface LadderRung {
  midi: number;
  positions: FretPos[]; // all (string, fret) that sound this pitch, ascending by fret
}

/**
 * Build the ascending ladder of UNIQUE scale pitches from the note universe. Index 0 =
 * the lowest scale note on the neck; +1 = the next scale note up. Each rung lists all the
 * fretboard positions that play that pitch (for nearest-fingering choice).
 */
export function buildScaleLadder(universe: UniverseNote[]): LadderRung[] {
  const byMidi = new Map<number, FretPos[]>();
  for (const n of universe) {
    const list = byMidi.get(n.midi) ?? [];
    list.push({ string: n.string, fret: n.fret });
    byMidi.set(n.midi, list);
  }
  return [...byMidi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([midi, positions]) => ({
      midi,
      positions: positions.sort((p, q) => p.fret - q.fret),
    }));
}

/**
 * Build the ladder from a KNOWN, AUTHORED PATH instead of the whole neck — so a pattern
 * generated over it climbs ONLY that path's notes, using the path's own fingering positions.
 * Each distinct pitch in the path's `{string, fret}` events becomes one rung (its midi from
 * the open-string convention); the rung's positions are wherever that pitch appears in the
 * path. Ascending by pitch, so degree 0 = the path's lowest note. Notes off the supported
 * neck are skipped. This is the constrained counterpart to buildScaleLadder.
 */
export function buildLadderFromPath(
  events: { string: number; fret: number }[],
  stringCount: StringCount,
): LadderRung[] {
  const open = OPEN_STRING_MIDI[stringCount];
  const byMidi = new Map<number, FretPos[]>();
  for (const e of events) {
    const openMidi = open[e.string];
    if (openMidi === undefined) continue; // string not on this neck
    const midi = openMidi + e.fret;
    const list = byMidi.get(midi) ?? [];
    // De-dup identical positions (a path may revisit the same spot).
    if (!list.some((p) => p.string === e.string && p.fret === e.fret)) {
      list.push({ string: e.string, fret: e.fret });
    }
    byMidi.set(midi, list);
  }
  return [...byMidi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([midi, positions]) => ({
      midi,
      positions: positions.sort((p, q) => p.fret - q.fret),
    }));
}

/** Distance between two positions — fret gap + a penalty per string change. Lower = closer
 *  to the hand's current spot (the "nearest playable" heuristic). */
function posDistance(a: FretPos, b: FretPos): number {
  return Math.abs(a.fret - b.fret) + Math.abs(a.string - b.string) * 2;
}

/**
 * Map a degree sequence to fretboard positions using NEAREST-position fingering: each
 * note goes to the playable spot CLOSEST to the previous note (minimal hand movement).
 * Degrees outside the ladder are skipped. The first note picks the lowest position of its
 * rung (a sensible neutral start). Returns the seed positions, in order.
 */
export function degreesToPositions(
  degrees: number[],
  ladder: LadderRung[],
): FretPos[] {
  const out: FretPos[] = [];
  let prev: FretPos | null = null;
  for (const d of degrees) {
    const rung = ladder[d];
    if (!rung || rung.positions.length === 0) continue;
    let chosen: FretPos;
    if (prev === null) {
      chosen = rung.positions[0]!; // lowest position to start
    } else {
      const p = prev;
      chosen = rung.positions.reduce((best, cur) =>
        posDistance(cur, p) < posDistance(best, p) ? cur : best,
      );
    }
    out.push(chosen);
    prev = chosen;
  }
  return out;
}
