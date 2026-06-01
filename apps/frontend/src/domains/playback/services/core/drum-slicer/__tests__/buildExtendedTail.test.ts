/**
 * buildExtendedTail validation — synthesize a continued hi-hat decay from a
 * short noisy tail and assert the load-bearing invariants: requested length,
 * gates (usable / too-short / silent), continuing decay, bounded + non-silent
 * output, stereo preserved, and — the critical one — NO strong periodicity in
 * the synthesized bed (decorrelated grains must not comb or pulse).
 */
import { describe, it, expect } from 'vitest';
import {
  buildExtendedTail,
  transientEndOffset,
  tailIsUsable,
} from '../buildExtendedTail.js';

const SR = 48000;

/** Decaying broadband NOISE tail (what a hi-hat tail actually is). Seeded so
 *  the test is deterministic. */
function noiseTail(seconds: number, tauSec = 0.08, amp = 0.6): Float32Array {
  const n = Math.ceil(seconds * SR);
  const data = new Float32Array(n);
  let s = 12345;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < n; i++) data[i] = rnd() * amp * Math.exp(-i / (tauSec * SR));
  return data;
}

function peak(a: Float32Array): number {
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]!));
  return p;
}
function rms(a: Float32Array, start = 0, end = a.length): number {
  let acc = 0;
  for (let i = start; i < end; i++) acc += a[i]! * a[i]!;
  return Math.sqrt(acc / Math.max(1, end - start));
}

describe('buildExtendedTail', () => {
  it('produces a fill of the requested length (mono)', () => {
    const fill = buildExtendedTail([noiseTail(0.15)], SR, 0.4, { seed: 1 });
    expect(fill.length).toBe(1);
    expect(fill[0]!.length).toBe(Math.round(0.4 * SR));
  });

  it('preserves stereo (one channel out per channel in)', () => {
    const fill = buildExtendedTail([noiseTail(0.15), noiseTail(0.15)], SR, 0.3, {
      seed: 2,
    });
    expect(fill.length).toBe(2);
    expect(fill[1]!.length).toBe(Math.round(0.3 * SR));
  });

  it('output is non-silent at the start and bounded (no blow-up)', () => {
    const fill = buildExtendedTail([noiseTail(0.2)], SR, 0.5, { seed: 3 });
    const out = fill[0]!;
    expect(rms(out, 0, Math.round(0.05 * SR))).toBeGreaterThan(1e-3);
    expect(peak(out)).toBeLessThan(1.5);
  });

  it('keeps decaying — end is quieter than the start', () => {
    const fill = buildExtendedTail([noiseTail(0.2, 0.08)], SR, 0.6, { seed: 4 });
    const out = fill[0]!;
    const head = rms(out, 0, Math.round(0.05 * SR));
    const tail = rms(out, out.length - Math.round(0.05 * SR), out.length);
    expect(tail).toBeLessThan(head);
  });

  it('begins near the source splice level (no big step at the seam)', () => {
    const src = noiseTail(0.2, 0.08);
    const spliceRms = rms(src, src.length - Math.round(0.005 * SR), src.length);
    const fill = buildExtendedTail([src], SR, 0.4, { seed: 5 });
    // Measure just after the 10ms fade-in so we read the seeded level.
    const startRms = rms(
      fill[0]!,
      Math.round(0.012 * SR),
      Math.round(0.03 * SR),
    );
    // Within a factor of ~2.5 of the splice level (granular variance + decay).
    expect(startRms).toBeGreaterThan(spliceRms * 0.3);
    expect(startRms).toBeLessThan(spliceRms * 2.5);
  });

  it('has NO strong periodicity (decorrelated grains: no comb / secondary rhythm)', () => {
    const fill = buildExtendedTail([noiseTail(0.25, 0.2)], SR, 0.6, { seed: 6 });
    const out = fill[0]!;
    // Autocorrelation over a steady mid-region; any sharp peak at a non-zero
    // lag in the grain-rate band would betray periodicity. Grain=45ms → hop
    // 22.5ms → ~1080 samples; check lags 5ms..120ms.
    const seg = out.subarray(
      Math.round(0.1 * SR),
      Math.round(0.45 * SR),
    );
    let mean = 0;
    for (let i = 0; i < seg.length; i++) mean += seg[i]!;
    mean /= seg.length;
    let denom = 0;
    for (let i = 0; i < seg.length; i++) denom += (seg[i]! - mean) ** 2;
    let maxAC = 0;
    for (let lagMs = 5; lagMs <= 120; lagMs += 1) {
      const lag = Math.round((lagMs / 1000) * SR);
      let acc = 0;
      for (let i = 0; i + lag < seg.length; i++) {
        acc += (seg[i]! - mean) * (seg[i + lag]! - mean);
      }
      const ac = denom > 0 ? Math.abs(acc / denom) : 0;
      if (ac > maxAC) maxAC = ac;
    }
    // Decorrelated noise: normalized autocorr at all non-zero lags stays low.
    // A comb/loop would show a peak approaching 1.0; require well below.
    expect(maxAC).toBeLessThan(0.3);
  });

  it('returns [] for a tail too short to extend (Gate B)', () => {
    const fill = buildExtendedTail([noiseTail(0.01)], SR, 0.3, { seed: 7 });
    expect(fill.length).toBe(0);
  });

  it('returns [] for a near-silent tail (no manufactured hiss)', () => {
    const silent = new Float32Array(Math.round(0.15 * SR)); // all zeros
    const fill = buildExtendedTail([silent], SR, 0.3, { seed: 8 });
    expect(fill.length).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const src = noiseTail(0.2);
    const a = buildExtendedTail([src], SR, 0.3, { seed: 42 });
    const b = buildExtendedTail([src], SR, 0.3, { seed: 42 });
    expect(a[0]!.length).toBe(b[0]!.length);
    let identical = true;
    for (let i = 0; i < a[0]!.length; i++) {
      if (a[0]![i] !== b[0]![i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
  });
});

describe('transientEndOffset', () => {
  it('returns ~12ms in samples', () => {
    expect(transientEndOffset(SR)).toBe(Math.round(0.012 * SR));
  });
});

describe('tailIsUsable', () => {
  it('accepts a sustained noisy tail', () => {
    expect(tailIsUsable([noiseTail(0.2, 0.2)], SR)).toBe(true);
  });
  it('rejects a too-short tail', () => {
    expect(tailIsUsable([noiseTail(0.01)], SR)).toBe(false);
  });
  it('rejects a silent tail', () => {
    expect(tailIsUsable([new Float32Array(Math.round(0.15 * SR))], SR)).toBe(
      false,
    );
  });
  it('rejects a decayed transient (energy gate): a spike then silence', () => {
    // Loud 2ms spike, then ~silence — like a kick/closed tick post-guard.
    const n = Math.round(0.15 * SR);
    const data = new Float32Array(n);
    const spike = Math.round(0.002 * SR);
    for (let i = 0; i < spike; i++) data[i] = 0.9;
    expect(tailIsUsable([data], SR)).toBe(false);
  });
});
