/**
 * Interval naming for the Dynamic Loop dial.
 *
 * The dial transposes RELATIVE to wherever the user set the key — "play this,
 * then move it up a minor third" — not to a fixed destination note. So the
 * control shows the MOVE (an interval) rather than a note name. We name each
 * ±1..±6 semitone offset with its quality+number, and a direction word.
 *
 * Magnitudes 0..6 (we cap at ±6 semitones — past 6 the two directions converge
 * at the tritone and the pitch-shift artifacts dominate anyway):
 *   0 unison · 1 m2 · 2 M2 · 3 m3 · 4 M3 · 5 P4 · 6 TT (tritone)
 */

const INTERVAL_BY_MAGNITUDE = [
  'unison', // 0
  'm2', // 1  minor second
  'M2', // 2  major second
  'm3', // 3  minor third
  'M3', // 4  major third
  'P4', // 5  perfect fourth
  'TT', // 6  tritone
] as const;

/** Longer names for tooltips / accessibility. */
const INTERVAL_FULL_BY_MAGNITUDE = [
  'unison',
  'minor 2nd',
  'major 2nd',
  'minor 3rd',
  'major 3rd',
  'perfect 4th',
  'tritone',
] as const;

function magnitudeName(magnitude: number): string {
  const m = Math.min(6, Math.abs(Math.round(magnitude)));
  return INTERVAL_BY_MAGNITUDE[m] ?? `${m}st`;
}

function magnitudeFullName(magnitude: number): string {
  const m = Math.min(6, Math.abs(Math.round(magnitude)));
  return INTERVAL_FULL_BY_MAGNITUDE[m] ?? `${m} semitones`;
}

/**
 * Short dial label for a signed semitone offset:
 *   0  → "unison"
 *   +3 → "up m3"
 *   −5 → "down P4"
 */
export function formatIntervalLabel(semitones: number): string {
  const s = Math.round(semitones);
  if (s === 0) return 'unison';
  const dir = s > 0 ? 'up' : 'down';
  return `${dir} ${magnitudeName(s)}`;
}

/**
 * Full spoken label for aria / tooltips:
 *   +3 → "up a minor 3rd"
 *   −5 → "down a perfect 4th"
 *   0  → "no change"
 */
export function formatIntervalAria(semitones: number): string {
  const s = Math.round(semitones);
  if (s === 0) return 'no change';
  const dir = s > 0 ? 'up' : 'down';
  return `${dir} a ${magnitudeFullName(s)}`;
}
