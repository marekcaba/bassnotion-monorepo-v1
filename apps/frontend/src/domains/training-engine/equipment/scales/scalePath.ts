/**
 * scalePath — Phase C: turn a set of scale notes (a box or the whole neck) into an
 * ORDERED, TIMED sequence the audio engine can play and the fretboard can light.
 *
 * The visual layer (noteUniverse/selectBox) gives an unordered SET of (string, fret,
 * midi) scale notes. To PLAY a scale you need a PATH: an order (ascending then back
 * down) and a RHYTHM (each note's duration + beat position). This module is that path.
 *
 * Pure + testable. No audio, no React. The output `PlayableNote[]` is consumed by:
 *   - the bass sampler (midi + time + duration → an audible note), and
 *   - the fretboard sync (string + fret + position → a lit dot),
 * so the heard note and the lit dot are the SAME event.
 *
 * RHYTHM: straight eighths for now (the "authored per-scale rhythm" admin field lands
 * in Phase B). `rhythm` is already a parameter here so that swap is a one-line change at
 * the call site, not a rewrite — see {@link ScaleRhythm}.
 */

import type { UniverseNote } from './noteUniverse';

/** A single note in the play sequence: where it sounds, what it sounds, how long. */
export interface PlayableNote {
  /** MIDI note number (drives the bass sampler). */
  midi: number;
  /** 1-based string (drives the fretboard dot, with `fret`). */
  string: number;
  fret: number;
  /** Tone.js duration notation: '4n' quarter, '8n' eighth, '16n' sixteenth. */
  duration: ScaleRhythm;
  /** 0-based step index in the sequence (its slot in the rhythm grid). */
  step: number;
  /** Beats from the sequence start (at the grid's note value). With straight eighths,
   *  step 0 → beat 0, step 1 → beat 0.5, … — i.e. `step * beatsPerStep`. */
  startBeat: number;
  /** True when this is the scale's tonic — for emphasis (louder, or the root dot). */
  isRoot: boolean;
}

/** Rhythm = one Tone.js duration per step. '8t' = eighth-note TRIPLET (three per beat). */
export type ScaleRhythm = '4n' | '8n' | '8t' | '16n';

/** Beats occupied by one step of a given rhythm (quarter-note = 1 beat). */
const BEATS_PER_STEP: Record<ScaleRhythm, number> = {
  '4n': 1,
  '8n': 0.5,
  '8t': 1 / 3, // eighth-note triplet — three notes per beat
  '16n': 0.25,
};

export interface BuildScalePathOptions {
  /** Walk back DOWN the scale after the top note (classic scale practice). The top
   *  note isn't repeated; the bottom root IS the start of the next loop, so it's not
   *  repeated at the seam either. Default true. */
  descend?: boolean;
  /** The note value each step occupies. Default '8n' (straight eighths). */
  rhythm?: ScaleRhythm;
}

/**
 * Build the ordered, timed play sequence from a set of scale notes.
 *
 * The input `notes` (a box or the whole universe) is sorted ASCENDING by pitch; we play
 * them low→high, then (if `descend`) high→low excluding the endpoints so the loop reads
 * as one continuous up-and-down run with no doubled notes at the turns/seam.
 */
export function buildScalePath(
  notes: UniverseNote[],
  options: BuildScalePathOptions = {},
): PlayableNote[] {
  const { descend = true, rhythm = '8n' } = options;
  if (notes.length === 0) return [];

  const ascending = [...notes].sort(
    (a, b) => a.midi - b.midi || a.string - b.string,
  );

  // Up the scale, then back down without repeating the top note or the bottom note
  // (the bottom note starts the next loop, the top is the single turn-around).
  const ordered: UniverseNote[] =
    descend && ascending.length > 1
      ? [...ascending, ...ascending.slice(1, -1).reverse()]
      : ascending;

  const beatsPerStep = BEATS_PER_STEP[rhythm];
  return ordered.map((n, step) => ({
    midi: n.midi,
    string: n.string,
    fret: n.fret,
    duration: rhythm,
    step,
    startBeat: step * beatsPerStep,
    isRoot: n.isRoot,
  }));
}

/** Total length of a path in BEATS (quarter notes) — the loop length for scheduling. */
export function scalePathBeats(path: PlayableNote[]): number {
  if (path.length === 0) return 0;
  const last = path[path.length - 1]!;
  return last.startBeat + BEATS_PER_STEP[last.duration];
}
