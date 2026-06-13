/**
 * Fill-region geometry — converts a fill's (bar, beat) span into the fractional
 * bar positions the waveform draws against.
 *
 * Bars and beats are 1-indexed (bar 1..lengthBars, beat 1..4 in 4/4), the way a
 * player counts. The waveform maps a FRACTIONAL bar position `f` (0 = loop
 * start, lengthBars = loop end) to an x pixel via `(f / lengthBars) * width`
 * (mirroring the existing bar-line / selection-bracket math), so this module's
 * job is only to turn (bar, beat) → `f` and clamp the result to the loop.
 */

import type { BasslineVariant } from '@bassnotion/contracts';

/** Beats per bar (the engine only supports 4/4, same as the rest of the card). */
const BEATS_PER_BAR = 4;

export interface FillRegionFractions {
  /** Fractional-bar start (0 = loop start). */
  startFrac: number;
  /** Fractional-bar end (> startFrac). */
  endFrac: number;
}

/**
 * A 1-indexed (bar, beat) position → fractional bars from the loop start.
 * bar 1 beat 1 → 0; bar 7 beat 3 → 6 + 2/4 = 6.5; bar 8 beat 4 → 7.75.
 */
export function barBeatToFraction(bar: number, beat: number): number {
  return bar - 1 + (beat - 1) / BEATS_PER_BAR;
}

/**
 * Resolve a fill's region into clamped fractional-bar [start, end] for the
 * waveform, or `null` when there's nothing valid to draw:
 *  - the variant has no `fillRegion`, or
 *  - the span is empty / inverted after clamping to [0, lengthBars].
 *
 * The end (endBar, endBeat) is INCLUSIVE of the whole beat: "endBar 8, endBeat 4"
 * highlights THROUGH the end of beat 4 of bar 8 (i.e. to the bar's end), not just
 * up to that beat's start. So the end fraction is the start of (endBar, endBeat)
 * plus one beat. Both ends are clamped so an out-of-range region (e.g. authored
 * before lengthBars shrank) still draws something sane instead of overflowing.
 */
export function resolveFillRegionFractions(
  region: BasslineVariant['fillRegion'] | undefined | null,
  lengthBars: number,
): FillRegionFractions | null {
  if (!region || lengthBars <= 0) return null;
  const clamp = (f: number) => Math.max(0, Math.min(lengthBars, f));
  const startFrac = clamp(barBeatToFraction(region.startBar, region.startBeat));
  // Inclusive end: extend through the WHOLE of (endBar, endBeat) by adding one beat.
  const endFrac = clamp(
    barBeatToFraction(region.endBar, region.endBeat) + 1 / BEATS_PER_BAR,
  );
  if (!(endFrac > startFrac)) return null; // empty or inverted → nothing to draw
  return { startFrac, endFrac };
}
