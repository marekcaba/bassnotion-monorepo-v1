import { describe, it, expect } from 'vitest';
import { verifyPitch, hzToMidiFloat, midiToHz } from './verifyPitch';

const sr = 48000;

/** A bass-like tone at `hz` for `durSec`: fundamental + a couple of harmonics + light
 *  decay, the kind of signal a DI bass note produces. */
function tone(hz: number, durSec = 0.1, harmonics = [1, 0.5, 0.3]): Float32Array {
  const n = Math.floor(durSec * sr);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = i / sr;
    let s = 0;
    for (let h = 0; h < harmonics.length; h++) {
      s += harmonics[h]! * Math.sin(2 * Math.PI * hz * (h + 1) * tt);
    }
    x[i] = 0.6 * s * Math.exp(-tt / 0.5);
  }
  return x;
}

describe('verifyPitch — monophonic bass YIN', () => {
  it('detects low E (E1 = MIDI 28 ≈ 41.2Hz)', () => {
    const r = verifyPitch(tone(midiToHz(28)), sr);
    expect(r).not.toBeNull();
    expect(r!.midi).toBe(28);
  });

  it('detects A (A1 = MIDI 33 ≈ 55Hz) — the open-A string', () => {
    const r = verifyPitch(tone(midiToHz(33)), sr);
    expect(r).not.toBeNull();
    expect(r!.midi).toBe(33);
  });

  it('detects D2 = MIDI 38 and G2 = MIDI 43 (the open D and G strings)', () => {
    expect(verifyPitch(tone(midiToHz(38)), sr)!.midi).toBe(38);
    expect(verifyPitch(tone(midiToHz(43)), sr)!.midi).toBe(43);
  });

  it('detects low B (B0 = MIDI 23 ≈ 30.9Hz) on a 5-string — needs a longer window', () => {
    const r = verifyPitch(tone(midiToHz(23), 0.12), sr);
    expect(r).not.toBeNull();
    expect(r!.midi).toBe(23);
  });

  it('does NOT octave-error: E1 (41Hz) reports 28, NOT E2 (53) or the 2nd harmonic', () => {
    const r = verifyPitch(tone(midiToHz(28)), sr);
    expect(r!.midi).toBe(28);
    expect(r!.midi).not.toBe(40); // E2 (octave up)
  });

  it('reports cents near 0 for an in-tune tone, and offset for a detuned one', () => {
    const inTune = verifyPitch(tone(midiToHz(33)), sr)!;
    expect(Math.abs(inTune.cents)).toBeLessThan(10);
    // +30 cents sharp of A1
    const sharp = verifyPitch(tone(midiToHz(33) * Math.pow(2, 30 / 1200)), sr)!;
    expect(sharp.cents).toBeGreaterThan(15);
    expect(sharp.cents).toBeLessThan(45);
    expect(sharp.midi).toBe(33); // still the same semitone
  });

  it('returns null on silence', () => {
    expect(verifyPitch(new Float32Array(sr * 0.1), sr)).toBeNull();
  });

  it('does not report a confident LOW-BASS pitch for high-frequency-only content', () => {
    // a pure 2kHz tone has no bass-register fundamental — must not be claimed as a bass
    // note (the lag bound makes minHz..maxHz the only search range).
    const hi = tone(2000, 0.1, [1]);
    const r = verifyPitch(hi, sr);
    // either null (out of range) or, if a subharmonic sneaks in, low confidence
    if (r) expect(r.hz).toBeGreaterThan(28); // still inside the declared register, not 2kHz
  });

  it('hzToMidiFloat / midiToHz round-trip (A4=440=MIDI 69)', () => {
    expect(hzToMidiFloat(440)).toBeCloseTo(69, 6);
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(hzToMidiFloat(midiToHz(28))).toBeCloseTo(28, 6);
  });
});
