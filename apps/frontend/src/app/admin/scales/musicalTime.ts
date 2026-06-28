/**
 * musicalTime — the pure spine of the rhythmic path editor: note durations as TICKS
 * (480 PPQ, matching the audio engine's durationTicks), a time signature, and a position
 * accumulator that places each note in musical time (which measure, which beat) and
 * detects when a note CROSSES a barline (→ it ties across).
 *
 * No React, no audio — just the math, so it can be unit-tested in isolation. Everything
 * the timeline strip + playback derive comes from here.
 */

/** MIDI-standard pulses per quarter note. 120 ticks = one sixteenth. */
export const PPQ = 480;

/** The duration palette (full set), each as ticks @ 480 PPQ. */
export const DURATIONS = {
  whole: PPQ * 4, // 1920
  'dotted-half': PPQ * 3, // 1440
  half: PPQ * 2, // 960
  'dotted-quarter': PPQ * 1.5, // 720
  quarter: PPQ, // 480
  'quarter-triplet': (PPQ * 2) / 3, // 320 — three per half note
  'dotted-eighth': PPQ * 0.75, // 360
  eighth: PPQ / 2, // 240
  'eighth-triplet': PPQ / 3, // 160 — three per quarter
  sixteenth: PPQ / 4, // 120
  'sixteenth-triplet': PPQ / 6, // 80 — three per eighth
  'thirty-second': PPQ / 8, // 60
} as const;

export type DurationName = keyof typeof DURATIONS;

/** Display label + the toolbar order. */
export const DURATION_ORDER: { name: DurationName; label: string }[] = [
  { name: 'whole', label: '𝅝 whole' },
  { name: 'dotted-half', label: '𝅗𝅥. dotted half' },
  { name: 'half', label: '𝅗𝅥 half' },
  { name: 'dotted-quarter', label: '♩. dotted qtr' },
  { name: 'quarter', label: '♩ quarter' },
  { name: 'quarter-triplet', label: '♩³ qtr triplet' },
  { name: 'dotted-eighth', label: '♪. dotted 8th' },
  { name: 'eighth', label: '♪ eighth' },
  { name: 'eighth-triplet', label: '♪³ 8th triplet' },
  { name: 'sixteenth', label: '𝅘𝅥𝅯 sixteenth' },
  { name: 'sixteenth-triplet', label: '𝅘𝅥𝅯³ 16th triplet' },
  { name: 'thirty-second', label: '𝅘𝅥𝅰 32nd' },
];

export interface TimeSignature {
  numerator: number; // beats per measure
  denominator: number; // beat unit (4 = quarter, 8 = eighth)
}

export const COMMON_METERS: { label: string; sig: TimeSignature }[] = [
  { label: '4/4', sig: { numerator: 4, denominator: 4 } },
  { label: '3/4', sig: { numerator: 3, denominator: 4 } },
  { label: '2/4', sig: { numerator: 2, denominator: 4 } },
  { label: '6/8', sig: { numerator: 6, denominator: 8 } },
  { label: '5/4', sig: { numerator: 5, denominator: 4 } },
  { label: '7/8', sig: { numerator: 7, denominator: 8 } },
];

/** Ticks in one measure of the given meter. 4/4 = 1920; 6/8 = 1440. */
export function ticksPerMeasure(sig: TimeSignature): number {
  // One beat = a (1/denominator) note = PPQ * 4 / denominator ticks.
  const ticksPerBeat = (PPQ * 4) / sig.denominator;
  return ticksPerBeat * sig.numerator;
}

/** A note in the rhythmic path: a pitch position + a duration (ticks). */
export interface TimedNote {
  kind?: 'note'; // discriminant (optional so existing note literals stay valid)
  string: number;
  fret: number;
  durationTicks: number;
}

/** A REST: silence for a duration (no pitch). Advances the musical clock without sounding. */
export interface RestEvent {
  kind: 'rest';
  durationTicks: number;
}

/** A path is an ordered list of EVENTS — each a note or a rest. */
export type PathEvent = TimedNote | RestEvent;

export function isRest(e: PathEvent): e is RestEvent {
  return e.kind === 'rest';
}

/** One segment of a placed event within a single measure. A note/rest that crosses a
 *  barline yields MORE THAN ONE segment (a note's parts are tied; a rest's just continue). */
export interface NoteSegment {
  noteIndex: number; // index of the source event in the path
  isRest: boolean; // a rest renders as a gap/rest glyph, no head
  measure: number; // 0-based measure this segment sits in
  startTickInMeasure: number; // where in the measure it begins
  durationTicks: number; // this segment's length
  tiedFromPrev: boolean; // true if this continues an event from the previous measure
  tiedToNext: boolean; // true if this event continues into the next measure
}

/** The fully-resolved timeline: every note split into per-measure segments, plus the
 *  total measure count. Barline-crossing notes appear as multiple tied segments. */
export interface ResolvedTimeline {
  segments: NoteSegment[];
  measureCount: number;
  totalTicks: number;
}

/**
 * Walk the notes in order, accumulating ticks, and split each note at every barline it
 * crosses. Returns per-measure segments with tie flags. This is THE function the timeline
 * strip renders from and playback schedules from.
 */
export function resolveTimeline(
  events: PathEvent[],
  sig: TimeSignature,
): ResolvedTimeline {
  const measureTicks = ticksPerMeasure(sig);
  const segments: NoteSegment[] = [];
  let cursor = 0; // absolute tick position of the next event's start

  events.forEach((event, noteIndex) => {
    const rest = isRest(event);
    let remaining = event.durationTicks;
    let pos = cursor;
    let first = true;

    while (remaining > 0) {
      const measure = Math.floor(pos / measureTicks);
      const startTickInMeasure = pos - measure * measureTicks;
      const roomInMeasure = measureTicks - startTickInMeasure;
      const take = Math.min(remaining, roomInMeasure);
      const willTieToNext = take < remaining; // more of this event spills past the barline

      segments.push({
        noteIndex,
        isRest: rest,
        measure,
        startTickInMeasure,
        durationTicks: take,
        tiedFromPrev: !first,
        tiedToNext: willTieToNext,
      });

      remaining -= take;
      pos += take;
      first = false;
    }

    cursor += event.durationTicks;
  });

  const totalTicks = cursor;
  const measureCount = Math.max(1, Math.ceil(totalTicks / measureTicks));
  return { segments, measureCount, totalTicks };
}

/** Human position of an absolute tick: 1-based measure + beat (e.g. "M2 · b3"). The beat
 *  is the (1/denominator) unit, so 4/4 → beats 1..4, 6/8 → beats 1..6. */
export function tickToPosition(
  tick: number,
  sig: TimeSignature,
): { measure: number; beat: number; beatFraction: number } {
  const measureTicks = ticksPerMeasure(sig);
  const ticksPerBeat = (PPQ * 4) / sig.denominator;
  const measure = Math.floor(tick / measureTicks);
  const tickInMeasure = tick - measure * measureTicks;
  const beatFloat = tickInMeasure / ticksPerBeat;
  return {
    measure: measure + 1,
    beat: Math.floor(beatFloat) + 1,
    beatFraction: beatFloat - Math.floor(beatFloat),
  };
}

/** The absolute start tick of event[index] (sum of prior durations). */
export function noteStartTick(events: PathEvent[], index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < events.length; i++)
    t += events[i]!.durationTicks;
  return t;
}
