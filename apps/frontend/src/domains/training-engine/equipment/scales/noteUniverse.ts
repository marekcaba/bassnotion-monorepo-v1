/**
 * noteUniverse — Phase A.1 of the scale engine (docs/SCALE_ENGINE_DESIGN.md §3,§5).
 *
 * The fretboard MODEL + the scale NOTE UNIVERSE: given the user's bass (string count +
 * fret count) and a scale (root + type), compute EVERY (string, fret) on the neck whose
 * pitch belongs to the scale. Pure + testable. This is the full map a "show the whole
 * scale" mode draws; the box selector (§6) picks a subset for the default position view.
 *
 * The user's fret/string count is load-bearing — it defines which notes exist at all.
 */

import {
  SCALE_INTERVALS,
  type PitchClass,
  type ScaleType,
  type StringCount,
} from './scaleGenerator';
import { SCALE_BLUEPRINTS, type ScalePosition } from './scaleBlueprints';

/** Open-string MIDI by `string` number — the AUTHORITATIVE convention from
 *  ExerciseLoader.ts:991-1000 + the contract (exercise.ts:40):
 *    string number runs HIGH→LOW: 1 = G (highest), higher number = lower pitch.
 *    4-string: 1=G(43) 2=D(38) 3=A(33) 4=E(28, lowest).
 *    5-string: + 5=B(23, the low B).  6-string: + 6=B(18) (a 6th low string).
 *  This is what the fretboard renderer + the audio engine expect — emit THIS, not a
 *  "1=lowest" convention (that rendered the scale upside-down). */
export const OPEN_STRING_MIDI: Record<
  StringCount,
  Record<number, number>
> = {
  4: { 1: 43, 2: 38, 3: 33, 4: 28 }, // G D A E
  5: { 1: 43, 2: 38, 3: 33, 4: 28, 5: 23 }, // G D A E B(low)
  6: { 1: 43, 2: 38, 3: 33, 4: 28, 5: 23, 6: 18 }, // + low F#/Gb? (6th string varies)
};

const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

/** One scale note on a specific fretboard. */
export interface UniverseNote {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  midi: number;
  noteName: PitchClass;
  /** True when this is the scale's tonic (root) pitch class. */
  isRoot: boolean;
  /** 0-based scale degree (0 = root, 1 = 2nd, …) — for box/position selection. */
  degree: number;
}

export interface FretboardModel {
  stringCount: StringCount;
  maxFrets: number;
}

function pcOf(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Parse a root pitch-class name to 0-11 (sharps; flats/glyphs tolerated). */
export function rootToPc(root: PitchClass): number {
  return PITCH_CLASS_NAMES.indexOf(root);
}

/**
 * Every (string, fret) on the user's neck whose pitch is in the scale — the full note
 * universe. Includes the scale degree of each note (for position/box selection).
 */
export function buildNoteUniverse(
  fretboard: FretboardModel,
  root: PitchClass,
  scaleType: ScaleType,
): UniverseNote[] {
  const { stringCount, maxFrets } = fretboard;
  const open = OPEN_STRING_MIDI[stringCount];
  const rootPc = rootToPc(root);
  const intervals = SCALE_INTERVALS[scaleType];
  // pitch-class → degree index (e.g. major: {0:0, 2:1, 4:2, …}).
  const pcToDegree = new Map<number, number>();
  intervals.forEach((iv, i) => pcToDegree.set((rootPc + iv) % 12, i));

  const notes: UniverseNote[] = [];
  for (let s = 1; s <= stringCount; s++) {
    for (let fret = 0; fret <= maxFrets; fret++) {
      const midi = open[s]! + fret;
      const degree = pcToDegree.get(pcOf(midi));
      if (degree === undefined) continue; // not a scale note
      notes.push({
        string: s as UniverseNote['string'],
        fret,
        midi,
        noteName: PITCH_CLASS_NAMES[pcOf(midi)]!,
        isRoot: pcOf(midi) === rootPc,
        degree,
      });
    }
  }
  // Stable order: low pitch → high (so callers can reason about ascending).
  notes.sort((a, b) => a.midi - b.midi || a.string - b.string);
  return notes;
}

/**
 * The fret of the scale's root on the LOWEST string (the box anchor). Returns the
 * lowest non-negative such fret within the neck, or null if the root never falls on
 * the lowest string within the neck.
 */
function rootFretOnLowestString(
  fretboard: FretboardModel,
  root: PitchClass,
): number | null {
  // The lowest string is the HIGHEST string NUMBER (string 1 = highest pitch).
  const lowestString = fretboard.stringCount;
  const open = OPEN_STRING_MIDI[fretboard.stringCount][lowestString]!;
  const rootPc = rootToPc(root);
  for (let fret = 0; fret <= fretboard.maxFrets; fret++) {
    if (pcOf(open + fret) === rootPc) return fret;
  }
  return null;
}

/**
 * BOX SELECTOR (§6 `position` mode): the subset of the universe inside one box position
 * — every scale note within the position's fret window (across all strings). The window
 * = the root's fret on the lowest string + the blueprint's startFretOffset, spanning
 * `span` frets. Clamped to the neck. Returns universe notes (ascending) for that box.
 *
 * This is the first CORRECT visual — a real fingering across the strings, not a
 * single-string line.
 */
export function selectBox(
  universe: UniverseNote[],
  fretboard: FretboardModel,
  root: PitchClass,
  scaleType: ScaleType,
  positionNumber: number,
  // Admin-authored override: the box shapes from the editor / server, replacing the
  // in-code seed. Falls back to SCALE_BLUEPRINTS when absent (production day-1 + tests).
  blueprintOverride?: { positions: ScalePosition[] },
): UniverseNote[] {
  // Use the override only when it actually has positions — an empty/invalid override
  // (e.g. the admin editor before its draft loads) falls back to the seed, never crashes.
  const blueprint =
    blueprintOverride && blueprintOverride.positions.length > 0
      ? blueprintOverride
      : SCALE_BLUEPRINTS[scaleType];
  const pos =
    blueprint.positions.find((p) => p.positionNumber === positionNumber) ??
    blueprint.positions[0];
  if (!pos) return []; // no positions at all → nothing to show (defensive)

  const rootFret = rootFretOnLowestString(fretboard, root);
  if (rootFret === null) return [];

  // The box's fret window on the neck.
  const lo = Math.max(0, rootFret + pos.startFretOffset);
  const hi = Math.min(fretboard.maxFrets, lo + pos.span);

  return universe
    .filter((n) => n.fret >= lo && n.fret <= hi)
    .sort((a, b) => a.midi - b.midi || a.string - b.string);
}
