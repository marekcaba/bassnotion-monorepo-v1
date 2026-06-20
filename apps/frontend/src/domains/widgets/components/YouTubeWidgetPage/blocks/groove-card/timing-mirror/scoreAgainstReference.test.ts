import { describe, it, expect } from 'vitest';
import { scoreAgainstReference } from './scoreAgainstReference';
import type { GridParams } from './scoreAgainstGrid';

// 120 BPM, 4 bars, 4/4. beat = 0.5s, sixteenth = 0.125s. Anchor at 10s.
const grid: GridParams = {
  loopStartAudioTime: 10,
  loopDurationSeconds: 8,
  lengthBars: 4,
  bpm: 120,
};
const T0 = 10;
const BEAT = 0.5;

/** A reference performance: 8 quarter notes, slightly human (not on the grid). */
const reference = Array.from({ length: 8 }, (_, i) => T0 + i * BEAT + (i % 2 ? 0.01 : -0.005));

describe('scoreAgainstReference — the headline', () => {
  it('a player who matches the reference exactly grades as locked/tight', () => {
    const res = scoreAgainstReference(reference, reference, grid);
    expect(res.untrustworthy).toBe(false);
    expect(res.jitterMs).toBeCloseTo(0, 1);
    expect(res.offsetMs).toBeCloseTo(0, 1);
    expect(['locked', 'tight']).toContain(res.grade.tier);
    expect(res.coverage).toBe(1);
    expect(res.matchedCount).toBe(8);
  });

  it('splits a CONSTANT lag from feel: a player 25ms behind the reference', () => {
    const player = reference.map((t) => t + 0.025); // uniformly 25ms late vs the record
    const res = scoreAgainstReference(player, reference, grid);
    expect(res.offsetMs).toBeCloseTo(25, 0); // the constant lag (calibration)
    expect(res.jitterMs).toBeCloseTo(0, 1); // ...but the FEEL is tight
    expect(['locked', 'tight']).toContain(res.grade.tier);
    expect(res.grade.feel).toBe('dragging'); // a consistent lean behind the record
  });

  it('calibrates out a LARGE constant offset (mic latency) — no false misses', () => {
    // The real bug: a +76ms constant shift (mic latency) was bigger than half a
    // sixteenth, so notes snapped to the wrong slot → coverage collapsed to ~62%,
    // 14 false misses, on a tight take. The gross-offset calibration must restore
    // full coverage and grade the (tight) feel correctly.
    const player = reference.map((t) => t + 0.076); // uniformly 76ms late
    const res = scoreAgainstReference(player, reference, grid);
    expect(res.coverage).toBeCloseTo(1, 2); // NOT ~0.62
    expect(res.missedCount).toBe(0); // NOT 14
    expect(res.offsetMs).toBeCloseTo(76, 0); // reported as the constant lean
    expect(res.jitterMs).toBeCloseTo(0, 1); // ...feel is tight once calibrated
    expect(['locked', 'tight']).toContain(res.grade.tier);
  });

  it('grades a sloppy player worse than a tight one (same reference)', () => {
    const wobble = [0.04, -0.05, 0.05, -0.04, 0.05, -0.05, 0.04, -0.04];
    const sloppy = reference.map((t, i) => t + wobble[i]!);
    const tight = scoreAgainstReference(reference, reference, grid);
    const loose = scoreAgainstReference(sloppy, reference, grid);
    expect(loose.jitterMs).toBeGreaterThan(tight.jitterMs);
    expect(loose.grade.score).toBeLessThan(tight.grade.score);
  });

  it('reports missed and extra notes', () => {
    const player = [reference[0]!, reference[2]!, reference[3]!, reference[1]! + 0.001 + 0.06]; // skip-ish + a stray
    const res = scoreAgainstReference(player, reference, grid, { minCoverage: 0 });
    expect(res.missedCount).toBeGreaterThan(0);
  });

  describe('trust guards', () => {
    it('refuses to grade when the reference detection diverges from the authored count', () => {
      // reference has 8 notes but the exercise was authored with ~20 → mis-detected.
      const res = scoreAgainstReference(reference, reference, grid, {
        expectedReferenceCount: 20,
      });
      expect(res.untrustworthy).toBe(true);
      expect(res.untrustworthyReason).toMatch(/mis-tuned|wrong target/i);
    });

    it('accepts when the reference count is within tolerance of authored', () => {
      const res = scoreAgainstReference(reference, reference, grid, {
        expectedReferenceCount: 8,
      });
      expect(res.untrustworthy).toBe(false);
    });

    it('refuses (play-more state) when coverage is too low', () => {
      const player = [reference[0]!, reference[1]!]; // played 2 of 8 notes
      const res = scoreAgainstReference(player, reference, grid);
      expect(res.untrustworthy).toBe(true);
      expect(res.untrustworthyReason).toMatch(/play more/i);
      expect(res.coverage).toBeCloseTo(0.25, 2);
    });
  });
});
