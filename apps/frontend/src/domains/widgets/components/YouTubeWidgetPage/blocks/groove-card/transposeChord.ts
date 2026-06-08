/**
 * transposeChordSymbol — transpose a chord-symbol STRING by N semitones.
 *
 * Chords are authored at the groove's original key; when the loop transposes,
 * the displayed symbols must move with it. We transpose the ROOT (and the slash
 * BASS note, if any), keep the QUALITY suffix verbatim, and re-spell using the
 * same flat/sharp convention as the key label (driven by the groove's
 * originalKey) so keys and chords agree on accidentals.
 *
 *   "Dm7"    + 3, key E  → "Fm7"
 *   "C/E"    + 2, key E  → "D/F♯"
 *   "B♭maj7" + 2, key E  → "Cmaj7"
 *   "F♯m7♭5" + 0         → "F♯m7♭5" (unchanged)
 *
 * Unparseable roots return the symbol unchanged (mirrors formatKeyLabel).
 */

import { parsePitchClass, spellPitchClass, prefersFlats } from './pitchClass';

// Root = note letter + optional accidental(s); the rest is the quality suffix.
const ROOT_RE = /^([A-Ga-g](?:##|bb|[#b♯♭])?)(.*)$/;

/** Transpose a single note token (root or slash bass) by `semitones`. Returns
 *  the re-spelled note, or the original token if it can't be parsed. */
function transposeNote(
  token: string,
  semitones: number,
  useFlats: boolean,
): string {
  const pc = parsePitchClass(token);
  if (pc == null) return token;
  return spellPitchClass(pc + semitones, useFlats) || token;
}

export function transposeChordSymbol(
  symbol: string,
  semitones: number,
  originalKey: string,
): string {
  const sym = symbol.trim();
  if (sym === '') return sym;
  const n = Math.round(semitones);
  if (n === 0) return sym; // unison — no change

  const useFlats = prefersFlats(originalKey);

  // Split an optional slash bass: "C/E" → main "C", bass "E".
  const slashIdx = sym.indexOf('/');
  const main = slashIdx >= 0 ? sym.slice(0, slashIdx) : sym;
  const bass = slashIdx >= 0 ? sym.slice(slashIdx + 1) : null;

  // Split the main part into root + quality.
  const m = main.match(ROOT_RE);
  if (!m) return sym; // not a parseable chord — leave verbatim
  const root = m[1] ?? '';
  const quality = m[2] ?? '';
  const newRoot = transposeNote(root, n, useFlats);

  const newMain = newRoot + quality;
  if (bass == null) return newMain;
  return `${newMain}/${transposeNote(bass, n, useFlats)}`;
}
