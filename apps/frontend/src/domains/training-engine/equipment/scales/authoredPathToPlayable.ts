/**
 * authoredPathToPlayable — adapt an AUTHORED exercise (the admin's hand-drawn PathsByKey,
 * stored as opaque JSON in gym_exercises.payload) into the sequencer's PlayableNote[].
 *
 * The admin editor stores notes as {string, fret, durationTicks} per key (480 PPQ ticks),
 * with rests. The sequencer + fretboard want PlayableNote[] (midi + string/fret + Tone.js
 * duration + startBeat). This module bridges the two, and transposes to the chosen key by
 * sliding +N frets on the same string (the same "slide" the admin populate uses) so the
 * student's key wheel works on authored content exactly like it does on generated scales.
 *
 * Pure + testable. No audio, no React. The payload arrives untyped from the API, so we
 * narrow it defensively here — a malformed/empty exercise yields an empty path (the tool
 * then falls back to the generated scale, never crashes).
 */

import { OPEN_STRING_MIDI } from './noteUniverse';
import type { ScaleRhythm, PlayableNote } from './scalePath';
import type { PitchClass, StringCount } from './scaleGenerator';

const PPQ = 480; // ticks per quarter note (matches the admin editor + audio engine)

/** Map a tick duration to the nearest Tone.js rhythm token the sequencer understands.
 *  Authored notes can be any value; we snap to the grid the player supports. */
function ticksToRhythm(ticks: number): ScaleRhythm {
  // quarter=480, eighth=240, eighth-triplet=160, sixteenth=120.
  const candidates: { token: ScaleRhythm; ticks: number }[] = [
    { token: '4n', ticks: 480 },
    { token: '8n', ticks: 240 },
    { token: '8t', ticks: 160 },
    { token: '16n', ticks: 120 },
  ];
  let best = candidates[0]!;
  let bestErr = Infinity;
  for (const c of candidates) {
    const err = Math.abs(c.ticks - ticks);
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best.token;
}

/** A 12-name chromatic, sharp-spelled — to resolve a (string,fret) MIDI to its pitch class
 *  for the isRoot flag. */
const PC_INDEX: Record<PitchClass, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

/** The authored event shapes we read out of the opaque payload. */
interface AuthoredNote {
  string: number;
  fret: number;
  durationTicks: number;
}
interface AuthoredRest {
  kind: 'rest';
  durationTicks: number;
}
type AuthoredEvent = AuthoredNote | AuthoredRest;

function isAuthoredRest(e: AuthoredEvent): e is AuthoredRest {
  return (e as AuthoredRest).kind === 'rest';
}

/** Narrow one event from the untyped payload; returns null if it isn't a usable event. */
function readEvent(raw: unknown): AuthoredEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ticks = typeof o.durationTicks === 'number' ? o.durationTicks : null;
  if (ticks === null || ticks <= 0) return null;
  if (o.kind === 'rest') return { kind: 'rest', durationTicks: ticks };
  if (typeof o.string === 'number' && typeof o.fret === 'number') {
    return { string: o.string, fret: o.fret, durationTicks: ticks };
  }
  return null;
}

export interface AuthoredToPlayableOptions {
  /** Slide every note +this many frets on the same string (transpose to the chosen key).
   *  Notes pushed past the neck (fret < 0 or > maxFrets) are DROPPED. Default 0. */
  semitones?: number;
  /** Neck length — for dropping notes that slide off the top. Default 24. */
  maxFrets?: number;
  /** The sounding root pitch class (after transpose) — to flag tonic notes (root dot /
   *  emphasis). If omitted, no note is flagged root. */
  rootPc?: PitchClass;
  /** The neck the exercise is fingered for (open-string MIDI table). Default 4. */
  stringCount?: StringCount;
}

/**
 * Convert an authored event list (one key's `ascending` array, already chosen by the
 * caller) into PlayableNote[]. Rests advance time but emit no note (the next note's
 * startBeat jumps over the silence). Notes sliding off the neck are dropped.
 */
export function authoredPathToPlayable(
  events: unknown,
  options: AuthoredToPlayableOptions = {},
): PlayableNote[] {
  const { semitones = 0, maxFrets = 24, rootPc, stringCount = 4 } = options;
  if (!Array.isArray(events)) return [];

  const open = OPEN_STRING_MIDI[stringCount];
  const rootIdx = rootPc !== undefined ? PC_INDEX[rootPc] : null;

  const out: PlayableNote[] = [];
  let beatCursor = 0; // beats elapsed from the sequence start
  let step = 0;

  for (const raw of events) {
    const e = readEvent(raw);
    if (!e) continue;
    const beats = e.durationTicks / PPQ;

    if (isAuthoredRest(e)) {
      beatCursor += beats; // silence — advance time, emit nothing
      continue;
    }

    const fret = e.fret + semitones; // slide-transpose, same string
    if (fret < 0 || fret > maxFrets) {
      beatCursor += beats; // off-neck → drop the note but keep its time slot
      continue;
    }

    const openMidi = open?.[e.string];
    if (openMidi === undefined) {
      beatCursor += beats; // unknown string for this neck → skip
      continue;
    }
    const midi = openMidi + fret;
    const isRoot = rootIdx !== null && midi % 12 === rootIdx;

    out.push({
      midi,
      string: e.string,
      fret,
      duration: ticksToRhythm(e.durationTicks),
      step,
      startBeat: beatCursor,
      isRoot,
    });
    step += 1;
    beatCursor += beats;
  }

  return out;
}

/** Total length of an authored event list in BEATS (notes + rests), for loop scheduling.
 *  Unlike scalePathBeats (which reads the last note), this counts trailing rests too. */
export function authoredPathBeats(events: unknown): number {
  if (!Array.isArray(events)) return 0;
  let beats = 0;
  for (const raw of events) {
    const e = readEvent(raw);
    if (e) beats += e.durationTicks / PPQ;
  }
  return beats;
}
