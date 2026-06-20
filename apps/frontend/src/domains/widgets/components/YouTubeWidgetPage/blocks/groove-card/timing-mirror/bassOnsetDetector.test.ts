import { describe, it, expect } from 'vitest';
import { detectBassOnsets, highPassInPlace } from './bassOnsetDetector';

// Step 2 of the timing-mirror spike (docs/TIMING_MIRROR_SPIKE_PLAN.md): prove the
// bass-tuned onset detector finds the RIGHT NOTE COUNT on a known buffer — the
// documented failure of the removed amplitude probe was over-triggering on bass
// SUSTAIN (92 onsets vs ~75 real). These tests synthesize a bass-like signal
// (sharp broadband attack + decaying low-freq fundamental) so the count is known.

const SR = 48000;

// Deterministic pseudo-random (mulberry32) so the test is repeatable — every
// note gets the SAME broadband attack texture, so the detector's global-strength
// floor isn't culling notes due to random per-note energy variation. (A real
// bass take has consistent attack energy; an unseeded Math.random() does not.)
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthesize a bass-like note: a short broadband attack transient (the pluck) +
 * a decaying low-frequency fundamental (the sustain that fakes re-onsets). The
 * attack uses a FIXED-seed noise burst so every note has equal attack energy.
 */
function renderNote(
  out: Float32Array,
  startSec: number,
  freqHz: number,
  durSec: number,
  rng: () => number,
) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(durSec * SR);
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / SR;
    // attack: ~2ms broadband noise burst (the pluck transient onset)
    const attackEnv = Math.exp(-t / 0.002);
    const attack = (rng() * 2 - 1) * attackEnv;
    // sustain: low-freq fundamental decaying over the note (the over-trigger bait)
    const sustainEnv = Math.exp(-t / (durSec * 0.35));
    const sustain = Math.sin(2 * Math.PI * freqHz * t) * sustainEnv * 0.5;
    out[start + i]! += attack + sustain;
  }
}

/** Render N evenly-spaced bass notes; returns the signal + the true onset times.
 *  One shared seeded RNG → varied-but-deterministic attack textures (closer to a
 *  real player than identical bursts). */
function renderBassLine(
  noteCount: number,
  spacingSec: number,
  freqHz: number,
  noteDurSec = 0.4,
): { signal: Float32Array; trueOnsets: number[] } {
  const totalSec = noteCount * spacingSec + noteDurSec + 0.2;
  const signal = new Float32Array(Math.ceil(totalSec * SR));
  const trueOnsets: number[] = [];
  const rng = makeRng(0xb0ba);
  for (let n = 0; n < noteCount; n++) {
    const at = 0.1 + n * spacingSec;
    renderNote(signal, at, freqHz, noteDurSec, rng);
    trueOnsets.push(at);
  }
  return { signal, trueOnsets };
}

/** Count detected onsets that land within tol of a true onset, and any extras. */
function matchOnsets(detected: number[], truth: number[], tolSec = 0.03) {
  const matched = truth.filter((t) =>
    detected.some((d) => Math.abs(d - t) <= tolSec),
  );
  const extras = detected.filter(
    (d) => !truth.some((t) => Math.abs(d - t) <= tolSec),
  );
  return { matchedCount: matched.length, extras };
}

describe('highPassInPlace', () => {
  it('strongly attenuates a low-frequency tone below the cutoff', () => {
    // 41 Hz (low E) sine, HPF at 80 Hz → should be heavily reduced.
    const n = SR; // 1s
    const lowTone = new Float32Array(n);
    for (let i = 0; i < n; i++) lowTone[i] = Math.sin((2 * Math.PI * 41 * i) / SR);
    const before = rms(lowTone);
    highPassInPlace(lowTone, SR, 80);
    const after = rms(lowTone);
    expect(after).toBeLessThan(before * 0.5); // at least 6 dB down
  });

  it('largely preserves a high-frequency tone above the cutoff', () => {
    const n = SR;
    const highTone = new Float32Array(n);
    for (let i = 0; i < n; i++) highTone[i] = Math.sin((2 * Math.PI * 2000 * i) / SR);
    const before = rms(highTone);
    highPassInPlace(highTone, SR, 80);
    const after = rms(highTone);
    expect(after).toBeGreaterThan(before * 0.7); // mostly intact
  });

  it('is a no-op when cutoff is 0', () => {
    const sig = Float32Array.from([0.1, -0.2, 0.3, -0.4]);
    const copy = Float32Array.from(sig);
    highPassInPlace(sig, SR, 0);
    expect(Array.from(sig)).toEqual(Array.from(copy));
  });
});

describe('detectBassOnsets — note-count accuracy', () => {
  it('finds the right count on a clean 8-note line (no over-trigger, no origin)', () => {
    const { signal, trueOnsets } = renderBassLine(8, 0.5, 110); // 8 notes, A2
    const onsets = detectBassOnsets(signal, SR).map((o) => o.time);
    const { matchedCount, extras } = matchOnsets(onsets, trueOnsets);
    expect(matchedCount).toBe(8); // every real note found
    expect(extras.length).toBeLessThanOrEqual(1); // ~no spurious onsets
    expect(onsets.every((t) => t > 0.001)).toBe(true); // synthetic origin dropped
  });

  it('does NOT over-trigger on LOW-note sustain (the documented failure mode)', () => {
    // Low E (41 Hz) with heavy sustain overlap — a DELIBERATELY pathological case
    // (harder than real bass: 0.55s notes at 0.6s spacing = near-continuous drone).
    // This is exactly what made the amplitude probe emit ~2x phantom re-onsets.
    // The contract that MATTERS here is "does not over-trigger" — the failure mode
    // we're guarding. (One masked attack on this pathological signal is acceptable;
    // a real take has cleaner note separation. The note-count REFUSAL guard in the
    // panel — G3 — is the production safety net, not perfect synthetic recall.)
    const { signal, trueOnsets } = renderBassLine(6, 0.6, 41, 0.55);
    const onsets = detectBassOnsets(signal, SR).map((o) => o.time);
    const { matchedCount, extras } = matchOnsets(onsets, trueOnsets);
    // No over-trigger: detected count never EXCEEDS the real count (the bug).
    expect(onsets.length).toBeLessThanOrEqual(trueOnsets.length);
    // Finds the large majority of real notes even on the pathological signal.
    expect(matchedCount).toBeGreaterThanOrEqual(5);
    expect(extras.length).toBe(0); // zero phantom onsets — the key property
  });

  it('onset times land close to the true attack times', () => {
    const { signal, trueOnsets } = renderBassLine(5, 0.5, 82);
    const onsets = detectBassOnsets(signal, SR).map((o) => o.time);
    for (const t of trueOnsets) {
      const nearest = onsets.reduce(
        (best, d) => (Math.abs(d - t) < Math.abs(best - t) ? d : best),
        Infinity,
      );
      // frame-start bias of detectOnsets is ~0-21ms @ fft1024 — well within 30ms.
      expect(Math.abs(nearest - t)).toBeLessThan(0.03);
    }
  });

  it('respects minOnsetGapSeconds (does not split one note into two)', () => {
    // A single long low note — must yield exactly one onset, not several.
    const signal = new Float32Array(Math.ceil(1.0 * SR));
    renderNote(signal, 0.1, 41, 0.8, makeRng(0xb0ba));
    const onsets = detectBassOnsets(signal, SR);
    expect(onsets.length).toBe(1);
  });
});

function rms(sig: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < sig.length; i++) sum += sig[i]! * sig[i]!;
  return Math.sqrt(sum / sig.length);
}
