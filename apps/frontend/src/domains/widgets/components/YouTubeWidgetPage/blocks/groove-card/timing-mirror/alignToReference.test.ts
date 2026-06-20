import { describe, it, expect } from 'vitest';
import { alignToReference } from './alignToReference';
import type { GridParams } from './scoreAgainstGrid';

// 120 BPM, 4 bars, 4/4. beat = 0.5s, sixteenth = 0.125s, loop = 8s. Anchor at 10s.
const grid: GridParams = {
  loopStartAudioTime: 10,
  loopDurationSeconds: 8,
  lengthBars: 4,
  bpm: 120,
};
const T0 = 10;
const BEAT = 0.5;
const SIX = 0.125; // one sixteenth

describe('alignToReference — grid-anchored matching', () => {
  it('matches a player who plays exactly the reference (zero error, full coverage)', () => {
    const ref = [T0, T0 + BEAT, T0 + 2 * BEAT, T0 + 3 * BEAT];
    const res = alignToReference(ref, ref, grid);
    expect(res.matched).toHaveLength(4);
    expect(res.missed).toHaveLength(0);
    expect(res.noise).toHaveLength(0);
    expect(res.coverage).toBe(1);
    res.matched.forEach((p) => expect(p.errorSec).toBeCloseTo(0, 6));
  });

  it('reports a per-note timing error when the player is consistently late', () => {
    const ref = [T0, T0 + BEAT, T0 + 2 * BEAT, T0 + 3 * BEAT];
    const player = ref.map((t) => t + 0.02); // 20ms late (within the slot)
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(4);
    res.matched.forEach((p) => expect(p.errorSec).toBeCloseTo(0.02, 3));
  });

  it('flags a SKIPPED reference note as missed (not a false match)', () => {
    const ref = [T0, T0 + BEAT, T0 + 2 * BEAT, T0 + 3 * BEAT];
    const player = [T0, T0 + 2 * BEAT, T0 + 3 * BEAT]; // skipped beat 2 (index 1)
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(3);
    expect(res.missed).toHaveLength(1);
    expect(res.missed[0]).toBeCloseTo(T0 + BEAT, 3);
    expect(res.noise).toHaveLength(0);
    expect(res.coverage).toBeCloseTo(0.75, 3);
  });

  it('flags an EXTRA player note (a ghost the reference does not have)', () => {
    const ref = [T0, T0 + BEAT];
    const player = [T0, T0 + SIX, T0 + BEAT]; // extra note on the 'e' of beat 1
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(2);
    expect(res.missed).toHaveLength(0);
    expect(res.noise).toHaveLength(1);
    expect(res.noise[0]).toBeCloseTo(T0 + SIX, 3);
  });

  it('matches off-beat (syncopated) reference notes too', () => {
    const ref = [T0 + SIX, T0 + 3 * SIX, T0 + BEAT + SIX]; // all off-beat 16ths
    const res = alignToReference(ref, ref, grid);
    expect(res.matched).toHaveLength(3);
    expect(res.coverage).toBe(1);
  });

  it('over-detection mid-sustain is NOISE — the player count need not match the ref', () => {
    // The real bug: the player detector fired EXTRA onsets in the middle of held
    // notes (sustain wobble). Coach-anchored: each ref marker grabs the nearest
    // real attack; the spurious mid-note onsets are near no ref marker → noise,
    // ignored. Coverage stays full, the take isn't penalised.
    const ref = [T0, T0 + BEAT, T0 + 2 * BEAT];
    const player = [
      T0, T0 + 0.18, // <- spurious wobble mid-note (no ref marker near 0.18)
      T0 + BEAT, T0 + BEAT + 0.2, // <- another wobble
      T0 + 2 * BEAT,
    ];
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(3); // all 3 ref notes hit
    expect(res.coverage).toBe(1);
    expect(res.noise).toHaveLength(2); // the 2 wobble onsets, ignored
    expect(res.missed).toHaveLength(0);
  });

  it('a count-in (pre-downbeat) onset is NOISE, not a penalised match', () => {
    const ref = [T0, T0 + BEAT];
    const player = [T0 - 1.0, T0, T0 + BEAT]; // one onset a second before the part
    const res = alignToReference(player, ref, grid);
    // coach-anchored: the real notes match; the stray pre-roll onset is near no
    // reference marker → classified NOISE (ignored), never hurts the score.
    expect(res.matched).toHaveLength(2);
    expect(res.noise).toEqual([T0 - 1.0]);
  });

  // The plan's open question, now RESOLVED with ±1-slot tolerance: a note played
  // late enough to snap to the NEIGHBOR slot must score as a LATE MATCH (big error),
  // not miss+extra — a feel-grading coach can't punish a recognizably-late note as a
  // skip-plus-ghost.
  it('a note played ~one sixteenth late MATCHES (large error), not miss+extra', () => {
    const ref = [T0, T0 + BEAT];
    const player = [T0, T0 + BEAT + 0.07]; // beat-2 note 70ms late → snaps to next 16th
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(2);
    expect(res.missed).toHaveLength(0);
    expect(res.noise).toHaveLength(0);
    // the late note is a real match carrying its ~70ms error
    const late = res.matched.find((m) => m.referenceSec > T0)!;
    expect(late.errorSec).toBeCloseTo(0.07, 2);
  });

  it('does NOT merge two genuinely distinct adjacent notes into one', () => {
    // ref has notes on TWO adjacent sixteenths; player hits both. Each must match
    // its own ref note — the adjacent reach must not let one ref note steal both.
    const ref = [T0, T0 + SIX];
    const player = [T0, T0 + SIX];
    const res = alignToReference(player, ref, grid);
    expect(res.matched).toHaveLength(2);
    expect(res.noise).toHaveLength(0);
    expect(res.missed).toHaveLength(0);
  });
});
