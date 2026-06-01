/**
 * wsolaStretch validation — the load-bearing invariant is EXACT OUTPUT LENGTH
 * (caller derives it from the grid; any drift here would desync drums from
 * bass/harmony). Plus: stereo preserved, energy roughly preserved (no blow-up /
 * collapse), no NaN, and the WSOLA-over-OLA property — a PERIODIC input stays
 * periodic after a stretch (the correlation lag search keeps windows in phase,
 * so the pitch/period survives instead of combing).
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeWsola,
  synthesizeWsola,
  wsolaIsUsable,
} from '../wsolaStretch.js';

const SR = 48000;

/** A pure sine — periodic content whose period must survive the stretch. */
function sine(seconds: number, freq: number, amp = 0.5): Float32Array {
  const n = Math.round(seconds * SR);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return data;
}

/** Decaying broadband noise — a hi-hat-like texture. Seeded/deterministic. */
function noise(seconds: number, amp = 0.4): Float32Array {
  const n = Math.round(seconds * SR);
  const data = new Float32Array(n);
  let s = 99991;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < n; i++) data[i] = rnd() * amp;
  return data;
}

function rms(a: Float32Array, start = 0, end = a.length): number {
  let acc = 0;
  for (let i = start; i < end; i++) acc += a[i]! * a[i]!;
  return Math.sqrt(acc / Math.max(1, end - start));
}
function peak(a: Float32Array): number {
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]!));
  return p;
}
function anyNaN(a: Float32Array): boolean {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i]!)) return true;
  return false;
}

/** Estimate the dominant period (samples) via autocorrelation over a lag band. */
function dominantPeriod(a: Float32Array, minLag: number, maxLag: number): number {
  let mean = 0;
  for (let i = 0; i < a.length; i++) mean += a[i]!;
  mean /= a.length;
  let bestLag = minLag;
  let bestAc = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < a.length; i++) acc += (a[i]! - mean) * (a[i + lag]! - mean);
    if (acc > bestAc) {
      bestAc = acc;
      bestLag = lag;
    }
  }
  return bestLag;
}

describe('synthesizeWsola — exact length (the sync-critical invariant)', () => {
  it('produces EXACTLY the requested output length (slowdown)', () => {
    const a = analyzeWsola([noise(0.3)], SR);
    const outLen = Math.round(0.45 * SR); // stretch 0.3s → 0.45s (ratio 0.667)
    const out = synthesizeWsola(a, outLen);
    expect(out.length).toBe(1);
    expect(out[0]!.length).toBe(outLen);
  });

  it('hits exact length across many target lengths (no accumulation)', () => {
    const a = analyzeWsola([noise(0.25)], SR);
    for (const sec of [0.26, 0.3, 0.4, 0.55, 0.8, 1.2]) {
      const outLen = Math.round(sec * SR);
      const out = synthesizeWsola(a, outLen);
      expect(out[0]!.length).toBe(outLen);
    }
  });

  it('preserves stereo (one out channel per in channel, both exact length)', () => {
    const a = analyzeWsola([noise(0.3), noise(0.3)], SR);
    const outLen = Math.round(0.5 * SR);
    const out = synthesizeWsola(a, outLen);
    expect(out.length).toBe(2);
    expect(out[0]!.length).toBe(outLen);
    expect(out[1]!.length).toBe(outLen);
  });
});

describe('synthesizeWsola — well-formed output', () => {
  it('is non-silent, bounded, and NaN-free', () => {
    const a = analyzeWsola([noise(0.3)], SR);
    const out = synthesizeWsola(a, Math.round(0.45 * SR))[0]!;
    expect(anyNaN(out)).toBe(false);
    expect(rms(out)).toBeGreaterThan(1e-3);
    expect(peak(out)).toBeLessThan(1.5);
  });

  it('roughly preserves RMS level (no big gain step vs source)', () => {
    const src = noise(0.3);
    const a = analyzeWsola([src], SR);
    const out = synthesizeWsola(a, Math.round(0.5 * SR))[0]!;
    const srcRms = rms(src);
    const outRms = rms(out, Math.round(0.05 * SR), out.length - Math.round(0.05 * SR));
    // Within a factor of ~2 either way (OLA of windowed noise + COLA norm).
    expect(outRms).toBeGreaterThan(srcRms * 0.4);
    expect(outRms).toBeLessThan(srcRms * 2.2);
  });
});

describe('synthesizeWsola — WSOLA periodicity (the reason it is not plain OLA)', () => {
  it('keeps a periodic input periodic at its original period after a stretch', () => {
    // 200 Hz sine → period = 240 samples @ 48k. Stretch 0.3s → 0.45s.
    const freq = 200;
    const periodSamples = Math.round(SR / freq);
    const a = analyzeWsola([sine(0.3, freq)], SR, { searchSeconds: 0.014 });
    const out = synthesizeWsola(a, Math.round(0.45 * SR))[0]!;
    // The dominant period in a steady mid-region should match the source period
    // (time-stretch changes DURATION, not PITCH). Search ±25% around it.
    const mid = out.subarray(Math.round(0.1 * SR), Math.round(0.4 * SR));
    const est = dominantPeriod(
      mid,
      Math.round(periodSamples * 0.75),
      Math.round(periodSamples * 1.25),
    );
    // Within ~6% of the true period (a comb/OLA failure would shift it).
    expect(Math.abs(est - periodSamples) / periodSamples).toBeLessThan(0.06);
  });
});

describe('synthesizeWsola — no manufactured silence (the bed continuity guarantee)', () => {
  it('a continuous (non-silent) input stretches to a continuous output: no long silent run', () => {
    // The whole-loop "bed" is one continuous stretch; if a continuous input
    // produced a silent stretch, slowing would re-introduce the gap bug. Assert
    // the longest near-silent run in a 2× slowdown of continuous noise is short.
    const src = noise(0.5, 0.4); // continuous, no internal silence
    const a = analyzeWsola([src], SR, { windowSeconds: 0.05 });
    const out = synthesizeWsola(a, Math.round(1.0 * SR))[0]!; // 0.5s → 1.0s (2×)
    const thresh = 1e-3;
    let longest = 0;
    let run = 0;
    for (let i = 0; i < out.length; i++) {
      if (Math.abs(out[i]!) < thresh) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    // No silent run longer than one window (50ms) — a true continuous stretch
    // never goes silent for a whole window. A gap-opening bug would show a run
    // of thousands of samples.
    const windowSamples = Math.round(0.05 * SR);
    expect(longest).toBeLessThan(windowSamples);
  });
});

describe('wsolaIsUsable', () => {
  it('accepts a segment ≥ ~1.5 windows', () => {
    expect(wsolaIsUsable(analyzeWsola([noise(0.2)], SR))).toBe(true);
  });
  it('rejects a segment shorter than ~1.5 windows', () => {
    // window default 50ms → 1.5× = 75ms; 40ms is too short.
    expect(wsolaIsUsable(analyzeWsola([noise(0.04)], SR))).toBe(false);
  });
});
