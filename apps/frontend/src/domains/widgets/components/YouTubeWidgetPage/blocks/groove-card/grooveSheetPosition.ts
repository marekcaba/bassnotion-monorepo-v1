/**
 * Bridge the groove card's playback clock to the sheet-music player's position.
 *
 * The groove card tracks playback as a loop PHASE in [0, 1) (from the bass
 * worklet read-head, via `getAudioPhase()`), not the global TransportContext.
 * `SheetMusicDisplay` wants a `TransportPosition { bars, beats, sixteenths,
 * ticks }` — 0-indexed bars/beats, 0..3 sixteenths, and ticks at 960 per beat
 * (the value SheetMusicDisplay divides by, `pos.ticks / 960`).
 *
 * This module is the pure conversion `(phase, lengthBars, beatsPerBar) →
 * TransportPosition`. No React, no audio — just the math, so it's unit-testable
 * and reusable.
 */

import type { TransportPosition } from '@/domains/widgets/components/SheetMusic/utils/positionMapBuilder';

/** Ticks per beat that SheetMusicDisplay assumes (`pos.ticks / 960`). */
const TICKS_PER_BEAT = 960;

/**
 * Convert a loop phase [0,1) into the sheet player's TransportPosition.
 *
 * @param phase        playback phase in [0, 1) across the whole loop (the groove
 *                     card's `getAudioPhase()` value); clamped/wrapped to [0,1).
 * @param lengthBars   total bars in the loop.
 * @param beatsPerBar  time-signature numerator (4 for 4/4); defaults to 4.
 */
export function phaseToTransportPosition(
  phase: number,
  lengthBars: number,
  beatsPerBar = 4,
): TransportPosition {
  const bars = Math.max(1, lengthBars);
  const bpb = Math.max(1, beatsPerBar);
  // Wrap into [0,1) so a tiny negative/over-one phase (latency comp, rounding)
  // never escapes the loop.
  let p = phase % 1;
  if (p < 0) p += 1;

  const fracBars = p * bars; // 0 .. bars
  const barIndex = Math.min(bars - 1, Math.floor(fracBars)); // 0-indexed
  const fracBeats = (fracBars - barIndex) * bpb; // 0 .. bpb
  const beatIndex = Math.min(bpb - 1, Math.floor(fracBeats)); // 0-indexed
  const fracWithinBeat = fracBeats - beatIndex; // 0 .. 1
  const sixteenths = Math.min(3, Math.floor(fracWithinBeat * 4)); // 0..3
  const ticks = Math.min(
    TICKS_PER_BEAT - 1,
    Math.round(fracWithinBeat * TICKS_PER_BEAT),
  );

  return { bars: barIndex, beats: beatIndex, sixteenths, ticks };
}
