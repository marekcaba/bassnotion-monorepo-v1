/**
 * transposePath — move an authored fingered path from one KEY to another. Two methods:
 *
 *   • SLIDE — every note moves +N frets on the SAME string (N = the semitone interval to
 *     the new key). Preserves the exact fingering/shape, relocated on the neck. Notes that
 *     would fall off the neck (fret < 0 or > maxFrets) are DROPPED.
 *
 *   • NEAREST — each note maps to its SCALE DEGREE, then to the new key's nearest playable
 *     position for that degree. Keeps it in a similar region but changes the fingering.
 *
 * Rests pass through untouched. Pure + testable — no React.
 */

import type { PathEvent, TimedNote } from './musicalTime';
import { isRest } from './musicalTime';
import { buildNoteUniverse } from '@/domains/training-engine/equipment/scales/noteUniverse';
import type {
  ScaleType,
  PitchClass,
} from '@/domains/training-engine/equipment/scales/scaleGenerator';
import {
  buildScaleLadder,
  degreesToPositions,
} from '@/domains/training-engine/equipment/scales/scalePattern';

/** Pitch class (0-11) of a key string, flat OR sharp spelled. */
const KEY_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** Semitone interval from `fromKey` to `toKey` (e.g. E→F = +1, E→Eb = -1). */
export function keyInterval(fromKey: string, toKey: string): number {
  const a = KEY_PC[fromKey] ?? 0;
  const b = KEY_PC[toKey] ?? 0;
  return b - a; // signed semitone delta (can be ±11)
}

// ── SLIDE: +N frets, same string, drop off-neck ────────────────────────────────────────

export function transposeBySlide(
  events: PathEvent[],
  semitones: number,
  maxFrets: number,
): PathEvent[] {
  return events.flatMap((e): PathEvent[] => {
    if (isRest(e)) return [e];
    const fret = e.fret + semitones; // same string → +semitones = +that many frets
    if (fret < 0 || fret > maxFrets) return []; // off the neck → drop
    return [{ ...e, fret }];
  });
}

// ── NEAREST: degree-preserving re-map into the new key ─────────────────────────────────

/** MIDI of a note on the given neck (string number high→low: 1=G…). */
const OPEN_MIDI: Record<number, Record<number, number>> = {
  4: { 1: 43, 2: 38, 3: 33, 4: 28 },
  5: { 1: 43, 2: 38, 3: 33, 4: 28, 5: 23 },
  6: { 1: 43, 2: 38, 3: 33, 4: 28, 5: 23, 6: 18 },
};

/**
 * Re-map each note to the new key's scale, preserving the SCALE DEGREE (the note's index
 * on the source ladder → the same index on the target ladder), with nearest-position
 * fingering. Notes off the source scale, or with no target rung, are dropped.
 */
export function transposeByNearest(
  events: PathEvent[],
  fromRoot: PitchClass,
  toRoot: PitchClass,
  scaleType: ScaleType,
  stringCount: 4 | 5 | 6,
  maxFrets: number,
): PathEvent[] {
  const fb = { stringCount, maxFrets };
  const srcLadder = buildScaleLadder(
    buildNoteUniverse(fb, fromRoot, scaleType),
  );
  const dstLadder = buildScaleLadder(buildNoteUniverse(fb, toRoot, scaleType));

  // source (string,fret) → its degree index on the source ladder (by MIDI).
  const open = OPEN_MIDI[stringCount];
  const midiToDegree = new Map<number, number>();
  srcLadder.forEach((rung, i) => midiToDegree.set(rung.midi, i));

  // Resolve each note to a target degree, then map the degrees as a block (so the nearest-
  // position chooser keeps the hand continuous across the whole run).
  const degrees: (number | null)[] = events.map((e) => {
    if (isRest(e)) return null;
    const n = e as TimedNote;
    const midi = (open?.[n.string] ?? 0) + n.fret;
    const deg = midiToDegree.get(midi);
    return deg ?? null; // note not on the source scale → drop
  });

  const validDegrees = degrees.filter((d): d is number => d !== null);
  const positions = degreesToPositions(validDegrees, dstLadder);

  // Stitch positions back in, preserving rests + dropping the invalids/off-ladder.
  let pi = 0;
  return events.flatMap((e, i): PathEvent[] => {
    if (isRest(e)) return [e];
    if (degrees[i] === null) return []; // wasn't on the source scale
    const pos = positions[pi++];
    if (!pos) return []; // no target rung
    return [{ ...(e as TimedNote), string: pos.string, fret: pos.fret }];
  });
}
