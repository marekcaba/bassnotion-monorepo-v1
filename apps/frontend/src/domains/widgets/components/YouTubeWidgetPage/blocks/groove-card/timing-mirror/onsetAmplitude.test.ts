import { describe, it, expect } from 'vitest';
import {
  windowAmplitude,
  onsetAmplitude,
  computeEnvelope,
  noteLengthFromEnvelope,
} from './onsetAmplitude';

const SR = 48000;

/** A constant-amplitude sine over [startSec, startSec+durSec). */
function tone(out: Float32Array, startSec: number, durSec: number, amp: number, freq = 110) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(durSec * SR);
  for (let i = 0; i < len && start + i < out.length; i++) {
    out[start + i]! += Math.sin((2 * Math.PI * freq * i) / SR) * amp;
  }
}

describe('windowAmplitude', () => {
  it('computes RMS and peak of a constant sine (no stack overflow on a big buffer)', () => {
    const sig = new Float32Array(SR); // 1s
    tone(sig, 0, 1, 0.8);
    const { rms, peak } = windowAmplitude(sig, 0, sig.length);
    expect(peak).toBeCloseTo(0.8, 2);
    expect(rms).toBeCloseTo(0.8 / Math.SQRT2, 2); // RMS of a sine = amp/√2
  });

  it('clamps to buffer bounds and returns zeros for an empty window', () => {
    const sig = Float32Array.from([0.5, -0.5, 0.5]);
    expect(windowAmplitude(sig, -10, 2).peak).toBeCloseTo(0.5, 6);
    expect(windowAmplitude(sig, 2, 2)).toEqual({ rms: 0, peak: 0 });
    expect(windowAmplitude(sig, 5, 9)).toEqual({ rms: 0, peak: 0 });
  });

  it('handles a large buffer without spreading (the SpectralAnalyzer footgun)', () => {
    const big = new Float32Array(1_000_000).fill(0.1);
    // Would throw "Maximum call stack" if implemented with Math.max(...spread).
    expect(() => windowAmplitude(big, 0, big.length)).not.toThrow();
    expect(windowAmplitude(big, 0, big.length).peak).toBeCloseTo(0.1, 6);
  });
});

describe('onsetAmplitude — per-note loudness', () => {
  it('reads a LOUD note as higher rms than a quiet (ghost) note', () => {
    const sig = new Float32Array(SR);
    tone(sig, 0.1, 0.2, 0.9); // accent
    tone(sig, 0.5, 0.2, 0.15); // ghost
    const accent = onsetAmplitude(sig, SR, 0.1);
    const ghost = onsetAmplitude(sig, SR, 0.5);
    expect(accent.rms).toBeGreaterThan(ghost.rms * 2);
  });
});

describe('computeEnvelope', () => {
  it('rises on a note and decays after it ends', () => {
    const sig = new Float32Array(SR);
    tone(sig, 0.2, 0.2, 0.8); // note from 0.2 to 0.4s
    const env = computeEnvelope(sig, SR);
    const at = (sec: number) => env.frames[Math.floor(sec / env.hopSec)] ?? 0;
    expect(at(0.05)).toBeLessThan(0.1); // silence before
    expect(at(0.35)).toBeGreaterThan(0.3); // inside the note
    expect(at(0.7)).toBeLessThan(at(0.35)); // decayed after
  });
});

describe('noteLengthFromEnvelope', () => {
  it('measures a short (staccato) note shorter than a long (legato) one', () => {
    const sig = new Float32Array(2 * SR);
    tone(sig, 0.1, 0.1, 0.8); // staccato: 100ms
    tone(sig, 0.8, 0.6, 0.8); // legato: 600ms
    const env = computeEnvelope(sig, SR);
    const shortLen = noteLengthFromEnvelope(env, 0.1, 0.8);
    const longLen = noteLengthFromEnvelope(env, 0.8, null);
    // The RELATIVE contract is what length-grading needs: staccato clearly shorter
    // than legato. (Absolute values include the envelope's decay tail past the hard
    // cutoff — real, and absorbed by relative comparison in the grader.)
    expect(shortLen).toBeLessThan(longLen);
    expect(longLen - shortLen).toBeGreaterThan(0.2); // clearly distinguishable
  });

  it('caps a note at the next onset (does not bleed into the following note)', () => {
    const sig = new Float32Array(SR);
    tone(sig, 0.1, 0.5, 0.8); // long note...
    tone(sig, 0.4, 0.3, 0.8); // ...but next onset at 0.4
    const env = computeEnvelope(sig, SR);
    const len = noteLengthFromEnvelope(env, 0.1, 0.4);
    expect(len).toBeLessThanOrEqual(0.3 + 0.01); // capped near the 0.4 next-onset
  });
});
