/**
 * bassSampleMap — build a {noteName: url} map for a Tone.Sampler covering a set of scale
 * notes, using the SAME Supabase bass samples the rest of the app uses.
 *
 * Why Tone.Sampler (not BassSamplerEngine + BassSampleLoader): the standalone loader
 * path is broken (it calls a GlobalSampleCache method that doesn't exist on the cache
 * facade → `cache.getBuffer is not a function` → zero buffers). The proven path (used by
 * BassInstrumentProcessor) is a plain Tone.Sampler built from a note→url map: Tone fetches
 * + decodes internally (Tone.loaded()) AND pitch-interpolates between anchors.
 *
 * STRING MATTERS: the same pitch sounds DIFFERENT on different strings — the open A and
 * the E-string-5th-fret A are both midi 33 but the open string is bright/ringing and the
 * fretted one is dark. Picking by MIDI alone defaulted to the LOWEST string (manifest
 * order B→E→A…), i.e. the dullest, most-muffled version of every note. So we resolve each
 * sample by the note's ACTUAL string (the box fingering the fretboard shows) → the heard
 * note matches the fingered note. Within one box each pitch is on ONE string, so the
 * Sampler's note-name keys don't collide.
 *
 * NAMING: the sample FILES spell accidentals with 's' ('Cs3', 'Fs2'); Tone.Sampler keys
 * want '#' ('C#3', 'F#2'). We map a '#' KEY → the 's' URL so triggerAttackRelease('C#3')
 * resolves to the Cs3 file.
 */

import { getSampleForMidiNote } from '@/domains/playback/modules/instruments/implementations/bass-sampler/BassSampleManifest';
import {
  midiNoteToName,
  type BassString,
} from '@/domains/playback/modules/instruments/implementations/bass-sampler/types';

/** A MIDI note's Tone-compatible name with a sharp glyph: 39 → 'D#2'. */
export function midiToToneNote(midi: number): string {
  return midiNoteToName(midi).replace('s', '#');
}

/** The scale-path string number (1=G,2=D,3=A,4=E,5=B — high→low) → the manifest's open
 *  MIDI for that string, so we can ask getSampleForMidiNote for the RIGHT string. */
const STRING_NUMBER_TO_OPEN_MIDI: Record<number, number> = {
  1: 43, // G
  2: 38, // D
  3: 33, // A
  4: 28, // E
  5: 23, // B (low)
};

/** A scale note as the path knows it: pitch + where it's fingered. */
export interface PathNoteRef {
  midi: number;
  string: number; // 1=G (highest) … 5=B (lowest), matching noteUniverse
  fret: number;
}

/** The manifest BassString whose OPEN midi matches this string number, or undefined. */
function stringNameFor(stringNumber: number): BassString | undefined {
  const open = STRING_NUMBER_TO_OPEN_MIDI[stringNumber];
  if (open == null) return undefined;
  // The manifest names are the open-note letters; map open midi → letter via pitch class.
  const NAMES: Record<number, BassString> = {
    43: 'G',
    38: 'D',
    33: 'A',
    28: 'E',
    23: 'B',
  };
  return NAMES[open];
}

/**
 * Build a Tone.Sampler URL map keyed by sharp NOTE NAME, resolving each note on its OWN
 * string (so the timbre matches the fingering). Notes whose string/fret has no sample
 * fall back to the default string for that pitch; truly out-of-range notes are skipped
 * (Tone pitch-shifts a neighbour).
 */
export function buildBassSamplerUrls(
  notes: PathNoteRef[],
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const n of notes) {
    const sample =
      getSampleForMidiNote(n.midi, stringNameFor(n.string)) ??
      getSampleForMidiNote(n.midi);
    if (!sample) continue; // out of bass range → Tone interpolates from neighbours
    urls[midiToToneNote(n.midi)] = sample.url;
  }
  return urls;
}
