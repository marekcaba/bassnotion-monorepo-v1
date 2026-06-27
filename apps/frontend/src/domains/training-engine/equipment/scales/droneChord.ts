/**
 * droneChord — derive the sustained backing PAD chord for a scale, automatically.
 *
 * The Scales tool plays the scale over a held harmonic drone so the ear hears the
 * scale's TONALITY (a bare scale over silence is ambiguous — is E dorian or D major?).
 * The drone is the scale's characteristic 7th chord: the chord that voices the mode.
 *
 *   mixolydian → dominant 7  (A mixolydian → A7)
 *   major / major_pentatonic → major 7
 *   natural_minor / dorian / minor_pentatonic → minor 7
 *
 * Output is a chord SYMBOL string ('A7', 'Cmaj7', 'Em7') that the existing
 * playback/utils/chordParser.parseChord() turns into note names for HarmonyInstrument.
 * Pure + testable; no audio.
 */

import type { PitchClass, ScaleType } from './scaleGenerator';

/** Chord-quality suffix per scale type, matching chordParser's CHORD_INTERVALS keys. */
const SCALE_DRONE_QUALITY: Record<ScaleType, string> = {
  major: 'maj7',
  major_pentatonic: 'maj7',
  mixolydian: '7', // the dominant 7 — the mode's defining color
  natural_minor: 'm7',
  dorian: 'm7',
  minor_pentatonic: 'm7',
};

/**
 * The drone chord symbol for a scale at a given root, e.g. ('A','mixolydian') → 'A7'.
 * The root is the scale's tonic pitch class (sharps; chordParser maps to flats itself).
 */
export function droneChordSymbol(
  root: PitchClass,
  scaleType: ScaleType,
): string {
  return `${root}${SCALE_DRONE_QUALITY[scaleType]}`;
}
