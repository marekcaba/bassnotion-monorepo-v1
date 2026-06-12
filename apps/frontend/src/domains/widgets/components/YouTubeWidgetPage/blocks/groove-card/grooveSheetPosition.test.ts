import { describe, it, expect } from 'vitest';
import { phaseToTransportPosition } from './grooveSheetPosition';

describe('phaseToTransportPosition (8 bars, 4/4)', () => {
  const pos = (phase: number) => phaseToTransportPosition(phase, 8, 4);

  it('phase 0 → bar 0, beat 0', () => {
    expect(pos(0)).toEqual({ bars: 0, beats: 0, sixteenths: 0, ticks: 0 });
  });

  it('halfway through the loop → bar 4, beat 0', () => {
    expect(pos(0.5)).toEqual({ bars: 4, beats: 0, sixteenths: 0, ticks: 0 });
  });

  it('one bar in (1/8) → bar 1, beat 0', () => {
    expect(pos(1 / 8)).toEqual({ bars: 1, beats: 0, sixteenths: 0, ticks: 0 });
  });

  it('beat 3 of bar 1 → bar 1, beat 2', () => {
    // bar 1 start = 1/8; +2 beats = 2/(8*4) = 1/16 further → phase 3/16
    expect(pos(3 / 16)).toEqual({ bars: 1, beats: 2, sixteenths: 0, ticks: 0 });
  });

  it('an eighth past a beat → sixteenths 2, ticks ~480', () => {
    // half a beat into bar 0 beat 0: phase = 0.5 beat / (8*4) = 0.015625
    const r = pos(0.5 / 32);
    expect(r.bars).toBe(0);
    expect(r.beats).toBe(0);
    expect(r.sixteenths).toBe(2); // half a beat = 2/4 sixteenths
    expect(r.ticks).toBe(480); // 0.5 * 960
  });

  it('clamps the last instant to the final bar (never overflows)', () => {
    const r = pos(0.9999999);
    expect(r.bars).toBe(7); // last bar (0-indexed, 8 bars)
    expect(r.beats).toBeLessThanOrEqual(3);
    expect(r.ticks).toBeLessThanOrEqual(959);
  });

  it('wraps a negative phase into the loop', () => {
    expect(pos(-0.001).bars).toBe(7); // -0.001 wraps to ~0.999 → last bar
  });

  it('wraps a phase ≥ 1 back into the loop', () => {
    expect(pos(1)).toEqual(pos(0));
    expect(pos(1.5)).toEqual(pos(0.5));
  });
});

describe('phaseToTransportPosition (4 bars, 3/4)', () => {
  it('respects a non-4 beatsPerBar', () => {
    // 3/4, 4 bars. Halfway = bar 2, beat 0.
    expect(phaseToTransportPosition(0.5, 4, 3)).toEqual({
      bars: 2,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    });
    // One beat into bar 0: phase = 1 beat / (4 bars * 3 beats) = 1/12
    expect(phaseToTransportPosition(1 / 12, 4, 3).beats).toBe(1);
  });
});
