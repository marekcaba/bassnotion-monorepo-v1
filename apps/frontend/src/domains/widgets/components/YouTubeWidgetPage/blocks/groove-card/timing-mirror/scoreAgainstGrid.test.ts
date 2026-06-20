import { describe, it, expect } from 'vitest';
import {
  snapOnsetToGrid,
  scoreOnsetsAgainstGrid,
  type GridParams,
} from './scoreAgainstGrid';

// Step 1 of the timing-mirror spike (docs/TIMING_MIRROR_SPIKE_PLAN.md): prove the
// CLOCK BRIDGE math is correct BEFORE any mic. If these pass, the
// audioContext-seconds → BeatTimingAnalyzer-ms reconciliation is sound and the
// only remaining risks are in capture/onset-detection, not the scoring.

// A concrete grid: 120 BPM, 4 bars, 4/4. One beat = 0.5s, one bar = 2s,
// loop = 8s. Bar-1 downbeat anchored 10s into the (synthetic) audio clock.
const BPM = 120;
const grid: GridParams = {
  loopStartAudioTime: 10,
  loopDurationSeconds: 8, // 4 bars * 2s
  lengthBars: 4,
  bpm: BPM,
};
const BEAT_SEC = 0.5; // 60 / 120
const T0 = grid.loopStartAudioTime;

/** Onset times for N perfectly-on-grid quarter notes starting at bar-1 downbeat. */
function onGridQuarters(n: number, offsetSec = 0): number[] {
  return Array.from({ length: n }, (_, i) => T0 + i * BEAT_SEC + offsetSec);
}

describe('snapOnsetToGrid', () => {
  it('snaps a dead-on downbeat to bar 0 beat 0, zero error', () => {
    const s = snapOnsetToGrid(T0, grid);
    expect(s).toMatchObject({ measureNumber: 0, beatNumber: 0, beforeGrid: false });
    expect(s.errorSec).toBeCloseTo(0, 9);
  });

  it('snaps the 5th quarter to bar 1 beat 0 (4/4 wrap)', () => {
    const s = snapOnsetToGrid(T0 + 4 * BEAT_SEC, grid);
    expect(s).toMatchObject({ measureNumber: 1, beatNumber: 0, beforeGrid: false });
  });

  it('snaps beat 3 of bar 1 correctly', () => {
    const s = snapOnsetToGrid(T0 + (4 + 2) * BEAT_SEC, grid); // bar1 + 2 beats
    expect(s).toMatchObject({ measureNumber: 1, beatNumber: 2 });
  });

  it('reports a small late error without changing the slot', () => {
    const s = snapOnsetToGrid(T0 + BEAT_SEC + 0.02, grid); // beat 1, +20ms late
    expect(s).toMatchObject({ measureNumber: 0, beatNumber: 1, beforeGrid: false });
    expect(s.errorSec).toBeCloseTo(0.02, 6);
  });

  it('flags onsets before the first downbeat (count-in) as beforeGrid', () => {
    const s = snapOnsetToGrid(T0 - 0.5, grid);
    expect(s.beforeGrid).toBe(true);
  });

  it('re-derives the grid from LIVE loop duration (tempo change → tighter grid)', () => {
    // Same onset, but the loop is now half as long (double tempo) → beat = 0.25s.
    const faster: GridParams = { ...grid, loopDurationSeconds: 4, bpm: 240 };
    const s = snapOnsetToGrid(T0 + 0.25, faster);
    expect(s).toMatchObject({ measureNumber: 0, beatNumber: 1 });
    expect(s.errorSec).toBeCloseTo(0, 9);
  });
});

describe('subdivision snapping (the off-beat / 150ms-jitter fix)', () => {
  // The bug: a real bassline plays EIGHTH notes; snapping each to the nearest
  // QUARTER mis-scores every off-beat by ~half a beat (250ms @ 120bpm) → erratic
  // jitter on a perfectly tight take. Sixteenth-snapping must score eighths clean.
  it('eighth notes played dead-on → jitter ≈ 0 (would be ~125ms erratic on a quarter grid)', () => {
    const EIGHTH = BEAT_SEC / 2; // 0.25s
    const onsets = Array.from({ length: 8 }, (_, i) => T0 + i * EIGHTH); // 8 eighths
    const { stats } = scoreOnsetsAgainstGrid(onsets, grid);
    expect(stats.totalBeats).toBe(8);
    expect(stats.averageDrift).toBeCloseTo(0, 2);
    expect(stats.jitter).toBeCloseTo(0, 2); // the fix: NOT ~125ms
    expect(stats.syncScore).toBeCloseTo(100, 2);
  });

  it('two notes in the SAME beat are not deduped away (16ths model)', () => {
    // On the old quarter model both landed on beat 0 → the 100ms same-beat dedup
    // dropped one. At sixteenth resolution they occupy distinct subIndices.
    const onsets = [T0, T0 + BEAT_SEC / 2]; // downbeat + the 'and'
    const { stats } = scoreOnsetsAgainstGrid(onsets, grid);
    expect(stats.totalBeats).toBe(2);
  });

  it('a syncopated 16th-note offset reads as small drift, not half a beat', () => {
    // Note on the 'e' of beat 1 (one sixteenth past the downbeat), played +15ms late.
    const sixteenth = BEAT_SEC / 4; // 0.125s
    const { stats } = scoreOnsetsAgainstGrid([T0 + sixteenth + 0.015], grid);
    expect(stats.averageDrift).toBeCloseTo(15, 0); // ~15ms, not ~125ms
  });
});

describe('scoreOnsetsAgainstGrid — the clock bridge', () => {
  it('perfectly on-grid onsets → jitter ≈ 0, syncScore ≈ 100, avgDrift ≈ 0', () => {
    const { stats, skippedBeforeGrid } = scoreOnsetsAgainstGrid(onGridQuarters(8), grid);
    expect(skippedBeforeGrid).toBe(0);
    expect(stats.totalBeats).toBe(8);
    expect(stats.averageDrift).toBeCloseTo(0, 3);
    expect(stats.jitter).toBeCloseTo(0, 3);
    expect(stats.syncScore).toBeCloseTo(100, 3);
    expect(stats.driftTrend).toBe('stable');
  });

  it('a CONSTANT +30ms shift → averageDrift ≈ 30ms, jitter ≈ 0 (the offset/jitter split)', () => {
    // +30ms in seconds = 0.03. This is the system-latency case: a pure offset,
    // not a timing-quality problem. The bridge must surface it as drift, not jitter.
    const { stats } = scoreOnsetsAgainstGrid(onGridQuarters(8, 0.03), grid);
    expect(stats.averageDrift).toBeCloseTo(30, 1);
    expect(stats.jitter).toBeCloseTo(0, 2);
    expect(stats.driftTrend).toBe('late');
  });

  it('the ×1000 is real: a 30ms shift must read 30 (ms), not 0.03 — guards the unit bug', () => {
    const { stats } = scoreOnsetsAgainstGrid(onGridQuarters(8, 0.03), grid);
    // If someone dropped the *1000, averageDrift would be ~0.03 and round to ~0.
    expect(Math.abs(stats.averageDrift)).toBeGreaterThan(1);
  });

  it('injected jitter (stddev) is reflected in stats.jitter', () => {
    // Symmetric ±40ms alternating offsets → mean 0, stddev 40ms.
    const wobble = [0.04, -0.04, 0.04, -0.04, 0.04, -0.04, 0.04, -0.04];
    const onsets = onGridQuarters(8).map((t, i) => t + wobble[i]!);
    const { stats } = scoreOnsetsAgainstGrid(onsets, grid);
    expect(stats.averageDrift).toBeCloseTo(0, 1);
    expect(stats.jitter).toBeCloseTo(40, 0); // |±40| stddev
    expect(stats.driftTrend).toBe('erratic'); // jitter > 20
  });

  it('count-in onsets are skipped, not scored', () => {
    const onsets = [T0 - 1.0, T0 - 0.5, ...onGridQuarters(4)];
    const { stats, skippedBeforeGrid } = scoreOnsetsAgainstGrid(onsets, grid);
    expect(skippedBeforeGrid).toBe(2);
    expect(stats.totalBeats).toBe(4);
    expect(stats.syncScore).toBeCloseTo(100, 3);
  });

  it('an onset exactly on the anchor (relMs 0) is NOT lost to the falsy-zero trap', () => {
    // recordBeat does `actualTime || performance.now()` — a raw 0 would fall back
    // to wall-clock and corrupt the score. The EPSILON nudge must keep it on-grid.
    const { stats } = scoreOnsetsAgainstGrid([T0], grid); // single onset at exactly T0
    expect(stats.totalBeats).toBe(1);
    expect(Math.abs(stats.averageDrift)).toBeLessThan(1); // ~0, not a wall-clock blowup
  });

  it('uses a FRESH analyzer per call — no cross-call history bleed', () => {
    const sloppy = scoreOnsetsAgainstGrid(onGridQuarters(8, 0.05), grid);
    const tight = scoreOnsetsAgainstGrid(onGridQuarters(8), grid);
    // If the second call shared the first's history, tight.averageDrift would be
    // pulled toward 50ms. It must be ~0.
    expect(tight.stats.averageDrift).toBeCloseTo(0, 2);
    expect(sloppy.stats.averageDrift).toBeCloseTo(50, 1);
  });
});
